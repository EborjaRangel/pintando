import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_BYTES = 8 * 1024 * 1024;

function resolveMime(file: File): string {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return file.type || "";
}

export async function saveUpload(
  file: File,
  folder: "photos" | "comprobantes"
): Promise<string> {
  const mime = resolveMime(file);
  if (!ALLOWED_TYPES.has(mime)) {
    throw new Error("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o PDF.");
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo pesa ${mb} MB. Máximo 8 MB.`);
  }

  const ext = path.extname(file.name) || mimeToExt(mime);
  const filename = `${randomUUID()}${ext}`;
  const relativeDir = path.join("uploads", folder);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

  await mkdir(absoluteDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(absoluteDir, filename), buffer);

  return `/${relativeDir.replace(/\\/g, "/")}/${filename}`;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}
