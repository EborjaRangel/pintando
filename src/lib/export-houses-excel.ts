import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fixExcelDrawingExtents } from "@/lib/fix-excel-drawings";
import { getHouseStatus, getStatusLabel } from "@/lib/house-status";
import { formatFolio } from "@/lib/folio";

const IMAGE_WIDTH_PX = 120;
const IMAGE_HEIGHT_PX = 90;

function publicBaseUrl(): string {
  const fromAuth = process.env.NEXTAUTH_URL?.trim();
  if (fromAuth) return fromAuth.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

function toAbsoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = publicBaseUrl();
  if (!base) return url;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export type HouseExportRow = {
  id: string;
  folio: number;
  address: string;
  colonia: string;
  latitude: number;
  longitude: number;
  comprobanteUrl: string | null;
  expedienteCompleto: boolean;
  autorizado?: boolean;
  notes: string | null;
  createdAt: Date;
  createdBy: { name: string; email: string };
  photos: { slot: number; url: string }[];
};

function looksLikePdf(buffer: Buffer, contentType?: string | null, url?: string): boolean {
  if (contentType?.includes("pdf")) return true;
  if (url && /\.pdf(\?|$)/i.test(url)) return true;
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

/**
 * Descarga (o lee) cualquier imagen y la convierte a JPEG embebible en Excel.
 * WebP/HEIC/PNG grandes suelen fallar si se pasan “crudos” a ExcelJS.
 */
async function tryReadImage(
  url: string | null | undefined
): Promise<{ buffer: Buffer; extension: "jpeg" } | null> {
  if (!url) return null;

  try {
    let raw: Buffer;
    let contentType: string | null = null;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, { redirect: "follow" });
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
        width: 900,
        height: 900,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return { buffer: jpeg, extension: "jpeg" };
  } catch {
    return null;
  }
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
    { header: "ID", key: "id", width: 28 },
    { header: "Dirección", key: "address", width: 42 },
    { header: "Colonia", key: "colonia", width: 28 },
    { header: "Latitud", key: "latitude", width: 12 },
    { header: "Longitud", key: "longitude", width: 12 },
    { header: "Estado", key: "status", width: 20 },
    { header: "Autorizada", key: "autorizada", width: 12 },
    { header: "Expediente completo", key: "expediente", width: 18 },
    { header: "Comprobante", key: "comprobante", width: 18 },
    { header: "Fotos", key: "fotosCount", width: 10 },
    { header: "Colores", key: "notes", width: 36 },
    { header: "Capturista", key: "capturista", width: 22 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Fecha alta", key: "fecha", width: 18 },
    { header: "Foto 1", key: "foto1", width: 18 },
    { header: "Foto 2", key: "foto2", width: 18 },
    { header: "Foto 3", key: "foto3", width: 18 },
    { header: "Comprobante img", key: "comprobanteImg", width: 18 },
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

  for (let i = 0; i < houses.length; i++) {
    const house = houses[i];
    const status = getHouseStatus(house);
    const photosBySlot = [1, 2, 3].map(
      (slot) => house.photos.find((p) => p.slot === slot)?.url ?? null
    );

    const rowIndex = i + 2;
    const row = sheet.getRow(rowIndex);

    // Columnas de imagen: Foto1=16, Foto2=17, Foto3=18, Comprobante=19 (1-based)
    const imageSlots: Array<{
      url: string | null;
      col: number;
      key: "foto1" | "foto2" | "foto3" | "comprobanteImg";
      empty: string;
      pdfLabel: string;
    }> = [
      { url: photosBySlot[0], col: 16, key: "foto1", empty: "Sin foto", pdfLabel: "PDF" },
      { url: photosBySlot[1], col: 17, key: "foto2", empty: "Sin foto", pdfLabel: "PDF" },
      { url: photosBySlot[2], col: 18, key: "foto3", empty: "Sin foto", pdfLabel: "PDF" },
      {
        url: house.comprobanteUrl,
        col: 19,
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

      const image = await tryReadImage(slot.url);
      if (!image) {
        imageLabels[slot.key] = "No se pudo cargar";
        continue;
      }

      // Texto + enlace: en móvil, si la miniatura no pinta, se puede abrir la foto
      imageLabels[slot.key] = "Ver foto";
      const imageId = workbook.addImage({
        buffer: image.buffer as unknown as ExcelJS.Buffer,
        extension: image.extension,
      });
      const abs = toAbsoluteMediaUrl(slot.url);
      sheet.addImage(imageId, {
        tl: { col: slot.col - 1, row: rowIndex - 1 },
        ext: { width: IMAGE_WIDTH_PX, height: IMAGE_HEIGHT_PX },
        editAs: "oneCell",
        hyperlinks: {
          hyperlink: abs,
          tooltip: abs,
        },
      });
    }

    row.values = {
      folio: formatFolio(house.folio),
      id: house.id,
      address: house.address,
      colonia: house.colonia,
      latitude: house.latitude,
      longitude: house.longitude,
      status: getStatusLabel(status),
      autorizada: house.autorizado ? "Sí" : "No",
      expediente: house.expedienteCompleto ? "Sí" : "No",
      comprobante: house.comprobanteUrl ? "Sí" : "No",
      fotosCount: `${house.photos.length}/3`,
      notes: house.notes ?? "",
      capturista: house.createdBy.name,
      email: house.createdBy.email,
      fecha: house.createdAt.toLocaleString("es-MX"),
      foto1: imageLabels.foto1,
      foto2: imageLabels.foto2,
      foto3: imageLabels.foto3,
      comprobanteImg: imageLabels.comprobanteImg,
    };
    row.height = 96;
    row.alignment = { vertical: "middle", wrapText: true };

    // Hipervínculos en celdas de foto (útil en Excel/Files del celular)
    for (const slot of imageSlots) {
      if (!slot.url || /\.pdf(\?|$)/i.test(slot.url)) continue;
      if (imageLabels[slot.key] !== "Ver foto") continue;
      const cell = row.getCell(slot.col);
      cell.value = {
        text: "Ver foto",
        hyperlink: toAbsoluteMediaUrl(slot.url),
      };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  const resumen = workbook.addWorksheet("Resumen");
  const complete = houses.filter((h) => getHouseStatus(h) === "complete").length;
  resumen.columns = [
    { header: "Métrica", key: "metric", width: 28 },
    { header: "Valor", key: "value", width: 16 },
  ];
  resumen.addRow({ metric: "Total casas", value: houses.length });
  resumen.addRow({ metric: "Completas", value: complete });
  resumen.addRow({ metric: "Pendientes", value: houses.length - complete });
  resumen.addRow({
    metric: "Generado",
    value: new Date().toLocaleString("es-MX"),
  });
  resumen.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  // Parchea dimensiones en drawing XML para que iOS/Android muestren las fotos
  return fixExcelDrawingExtents(buffer, IMAGE_WIDTH_PX, IMAGE_HEIGHT_PX);
}
