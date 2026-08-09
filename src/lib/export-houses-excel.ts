import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import { getHouseStatus, getStatusLabel } from "@/lib/house-status";
import { formatFolio } from "@/lib/folio";

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

function extensionFromName(name: string): "png" | "jpeg" | "gif" | null {
  const clean = name.split("?")[0].toLowerCase();
  const ext = path.extname(clean);
  if (ext === ".png") return "png";
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".gif") return "gif";
  // webp/svg no embeben bien en ExcelJS
  return null;
}

async function tryReadImage(
  url: string | null | undefined
): Promise<{ buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null> {
  if (!url) return null;

  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const extension = extensionFromName(url);
      if (!extension) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, extension };
    }

    const relative = url.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", relative);
    const extension = extensionFromName(filePath);
    if (!extension) return null;
    const buffer = await readFile(filePath);
    return { buffer, extension };
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
      foto1: photosBySlot[0] ? "Ver imagen" : "Sin foto",
      foto2: photosBySlot[1] ? "Ver imagen" : "Sin foto",
      foto3: photosBySlot[2] ? "Ver imagen" : "Sin foto",
      comprobanteImg: house.comprobanteUrl ? "Ver archivo" : "Sin comprobante",
    };
    row.height = 90;
    row.alignment = { vertical: "middle", wrapText: true };

    // Columnas de imagen: Foto1=16, Foto2=17, Foto3=18, Comprobante=19 (1-based)
    const imageSlots: Array<{ url: string | null; col: number }> = [
      { url: photosBySlot[0], col: 16 },
      { url: photosBySlot[1], col: 17 },
      { url: photosBySlot[2], col: 18 },
      { url: house.comprobanteUrl, col: 19 },
    ];

    for (const slot of imageSlots) {
      const image = await tryReadImage(slot.url);
      if (!image) continue;
      const imageId = workbook.addImage({
        buffer: image.buffer as unknown as ExcelJS.Buffer,
        extension: image.extension,
      });
      sheet.addImage(imageId, {
        tl: { col: slot.col - 1, row: rowIndex - 1 },
        ext: { width: 110, height: 80 },
        editAs: "oneCell",
      });
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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
