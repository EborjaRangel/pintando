import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fixExcelDrawingExtents } from "@/lib/fix-excel-drawings";
import { getHouseStatus, getStatusLabel } from "@/lib/house-status";
import { formatFolio } from "@/lib/folio";

const IMAGE_WIDTH_PX = 120;
const IMAGE_HEIGHT_PX = 90;

export type HouseExportRow = {
  id: string;
  folio: number;
  consecutivo: number;
  address: string;
  colonia: string;
  latitude: number;
  longitude: number;
  comprobanteUrl: string | null;
  expedienteCompleto: boolean;
  autorizado?: boolean;
  autorizadoAt?: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: { name: string; email: string };
  autorizadoBy?: { name: string; email: string } | null;
  photos: { slot: number; url: string }[];
};

const MEXICO_TZ = "America/Mexico_City";

function formatMexicoDate(value: Date): string {
  return value.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: MEXICO_TZ,
  });
}

function formatMexicoTime(value: Date): string {
  return value.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: MEXICO_TZ,
  });
}

function formatMexicoDateTime(value: Date): string {
  return `${formatMexicoDate(value)} ${formatMexicoTime(value)}`;
}

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function looksLikePdf(buffer: Buffer, contentType?: string | null, url?: string): boolean {
  if (contentType?.includes("pdf")) return true;
  if (url && /\.pdf(\?|$)/i.test(url)) return true;
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

/**
 * Miniatura JPEG para el Excel. PNG a 640px inflaba el archivo y Vercel/Railway
 * no alcanzaban a devolverlo (unas cuantas casas ya superaban 6 MB).
 */
async function tryReadImage(
  url: string | null | undefined
): Promise<{ buffer: Buffer; extension: "jpeg" } | null> {
  if (!url) return null;

  try {
    let raw: Buffer;
    let contentType: string | null = null;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      contentType = res.headers.get("content-type");
      raw = Buffer.from(await res.arrayBuffer());
    } else {
      const relative = url.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", relative);
      raw = await readFile(filePath);
    }

    if (!raw.length) return null;
    if (looksLikePdf(raw, contentType, url)) return null;

    const jpeg = await sharp(raw)
      .rotate()
      .resize({
        width: IMAGE_WIDTH_PX * 2,
        height: IMAGE_HEIGHT_PX * 2,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 52 })
      .toBuffer();

    return { buffer: jpeg, extension: "jpeg" };
  } catch {
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function columnNumber(sheet: ExcelJS.Worksheet, key: string): number {
  const index = (sheet.columns ?? []).findIndex((column) => column.key === key);
  return index >= 0 ? index + 1 : 1;
}

export async function buildHousesExcel(houses: HouseExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pintando Coyoacán";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Casas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Folio", key: "folio", width: 12 },
    { header: "Consecutivo colonia", key: "consecutivo", width: 16 },
    { header: "ID", key: "id", width: 28 },
    { header: "Dirección", key: "address", width: 42 },
    { header: "Colonia", key: "colonia", width: 28 },
    { header: "Latitud", key: "latitude", width: 14 },
    { header: "Longitud", key: "longitude", width: 14 },
    { header: "Mapa (georreferencia)", key: "mapa", width: 28 },
    { header: "Estado expediente", key: "status", width: 20 },
    { header: "Autorizada", key: "autorizada", width: 12 },
    { header: "Fecha autorización", key: "fechaAutorizacion", width: 20 },
    { header: "Autorizó", key: "autorizo", width: 22 },
    { header: "Correo quien autorizó", key: "autorizoEmail", width: 28 },
    { header: "Expediente completo", key: "expediente", width: 18 },
    { header: "Comprobante", key: "comprobante", width: 14 },
    { header: "URL comprobante", key: "comprobanteUrl", width: 36 },
    { header: "Fotos", key: "fotosCount", width: 10 },
    { header: "URL foto 1", key: "foto1Url", width: 36 },
    { header: "URL foto 2", key: "foto2Url", width: 36 },
    { header: "URL foto 3", key: "foto3Url", width: 36 },
    { header: "Colores / notas", key: "notes", width: 36 },
    { header: "Capturista", key: "capturista", width: 22 },
    { header: "Correo capturista", key: "email", width: 28 },
    { header: "Fecha levantamiento", key: "fecha", width: 16 },
    { header: "Hora levantamiento", key: "hora", width: 16 },
    { header: "Última actualización", key: "actualizado", width: 20 },
    { header: "Foto 1", key: "foto1", width: 22 },
    { header: "Foto 2", key: "foto2", width: 22 },
    { header: "Foto 3", key: "foto3", width: 22 },
    { header: "Comprobante img", key: "comprobanteImg", width: 22 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF075E54" },
  };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 22;

  const foto1Col = columnNumber(sheet, "foto1");
  const foto2Col = columnNumber(sheet, "foto2");
  const foto3Col = columnNumber(sheet, "foto3");
  const comprobanteImgCol = columnNumber(sheet, "comprobanteImg");

  const imageUrls = [
    ...new Set(
      houses.flatMap((house) => [
        ...house.photos.map((photo) => photo.url),
        house.comprobanteUrl,
      ]).filter((url): url is string => Boolean(url) && !/\.pdf(\?|$)/i.test(url))
    ),
  ];
  const imageCache = new Map(
    await mapPool(imageUrls, 8, async (url) => [url, await tryReadImage(url)] as const)
  );

  for (let i = 0; i < houses.length; i++) {
    const house = houses[i];
    const status = getHouseStatus(house);
    const photosBySlot = [1, 2, 3].map(
      (slot) => house.photos.find((p) => p.slot === slot)?.url ?? null
    );

    const rowIndex = i + 2;
    const row = sheet.getRow(rowIndex);
    const mapLink = mapsUrl(house.latitude, house.longitude);

    // Columnas de imagen: se calculan por key para no desfasarlas al agregar columnas.
    const imageSlots: Array<{
      url: string | null;
      col: number;
      key: "foto1" | "foto2" | "foto3" | "comprobanteImg";
      empty: string;
      pdfLabel: string;
    }> = [
      { url: photosBySlot[0], col: foto1Col, key: "foto1", empty: "Sin foto", pdfLabel: "PDF" },
      { url: photosBySlot[1], col: foto2Col, key: "foto2", empty: "Sin foto", pdfLabel: "PDF" },
      { url: photosBySlot[2], col: foto3Col, key: "foto3", empty: "Sin foto", pdfLabel: "PDF" },
      {
        url: house.comprobanteUrl,
        col: comprobanteImgCol,
        key: "comprobanteImg",
        empty: "Sin comprobante",
        pdfLabel: "Ver PDF (enlace en app)",
      },
    ];

    const imageLabels: Record<string, string> = {};

    for (const slot of imageSlots) {
      if (!slot.url) {
        imageLabels[slot.key] = slot.empty;
        continue;
      }
      if (/\.pdf(\?|$)/i.test(slot.url)) {
        imageLabels[slot.key] = slot.pdfLabel;
        continue;
      }

      const image = slot.url ? imageCache.get(slot.url) ?? null : null;
      if (!image) {
        imageLabels[slot.key] = "No se pudo cargar";
        continue;
      }

      // Sin texto en la celda (evita leyendas tipo "Ver foto" en iPhone)
      imageLabels[slot.key] = "";
      const imageId = workbook.addImage({
        buffer: image.buffer as unknown as ExcelJS.Buffer,
        extension: image.extension,
      });
      // twoCellAnchor: PC/tableta. En iPhone usar export HTML (format=html).
      sheet.addImage(imageId, {
        tl: { col: slot.col - 1, row: rowIndex - 1 },
        br: { col: slot.col, row: rowIndex },
        editAs: "oneCell",
      } as unknown as ExcelJS.ImagePosition);
    }

    row.values = {
      folio: formatFolio(house.folio),
      consecutivo: Number(house.consecutivo) || 0,
      id: house.id,
      address: house.address,
      colonia: house.colonia,
      latitude: house.latitude,
      longitude: house.longitude,
      mapa: mapLink,
      status: getStatusLabel(status),
      autorizada: house.autorizado ? "Sí" : "No",
      fechaAutorizacion: house.autorizadoAt
        ? formatMexicoDateTime(house.autorizadoAt)
        : "",
      autorizo: house.autorizadoBy?.name ?? "",
      autorizoEmail: house.autorizadoBy?.email ?? "",
      expediente: house.expedienteCompleto ? "Sí" : "No",
      comprobante: house.comprobanteUrl ? "Sí" : "No",
      comprobanteUrl: house.comprobanteUrl ?? "",
      fotosCount: `${house.photos.length}/3`,
      foto1Url: photosBySlot[0] ?? "",
      foto2Url: photosBySlot[1] ?? "",
      foto3Url: photosBySlot[2] ?? "",
      notes: house.notes ?? "",
      capturista: house.createdBy.name,
      email: house.createdBy.email,
      fecha: formatMexicoDate(house.createdAt),
      hora: formatMexicoTime(house.createdAt),
      actualizado: house.updatedAt ? formatMexicoDateTime(house.updatedAt) : "",
      foto1: imageLabels.foto1,
      foto2: imageLabels.foto2,
      foto3: imageLabels.foto3,
      comprobanteImg: imageLabels.comprobanteImg,
    };
    const mapaCell = row.getCell("mapa");
    mapaCell.value = { text: mapLink, hyperlink: mapLink };
    mapaCell.font = { color: { argb: "FF0563C1" }, underline: true };
    row.height = 110;
    row.alignment = { vertical: "middle", wrapText: true };
  }

  const resumen = workbook.addWorksheet("Resumen");
  const complete = houses.filter((h) => getHouseStatus(h) === "complete").length;
  resumen.columns = [
    { header: "Métrica", key: "metric", width: 28 },
    { header: "Valor", key: "value", width: 16 },
  ];
  const autorizadas = houses.filter((h) => h.autorizado).length;
  resumen.addRow({ metric: "Total casas", value: houses.length });
  resumen.addRow({ metric: "Autorizadas", value: autorizadas });
  resumen.addRow({ metric: "Sin autorizar", value: houses.length - autorizadas });
  resumen.addRow({ metric: "Expediente completo", value: complete });
  resumen.addRow({ metric: "Expediente pendiente", value: houses.length - complete });
  resumen.addRow({
    metric: "Generado",
    value: formatMexicoDateTime(new Date()),
  });
  resumen.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  // Parchea dimensiones en drawing XML para que iOS/Android muestren las fotos
  return fixExcelDrawingExtents(buffer, IMAGE_WIDTH_PX, IMAGE_HEIGHT_PX);
}
