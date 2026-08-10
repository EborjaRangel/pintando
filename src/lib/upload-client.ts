import { compressImageFile } from "@/lib/compress-image";

const MAX_BYTES = 8 * 1024 * 1024;

export function sanitizeUploadFilename(file: File): string {
  const raw = file.name?.trim() || "archivo";
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "");
  return cleaned || "archivo.bin";
}

export function assertUploadableFile(file: File, label = "Archivo"): void {
  if (!file || file.size <= 0) {
    throw new Error(`${label}: el archivo está vacío`);
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `${label} pesa ${mb} MB. Máximo 8 MB. Comprime la foto o el PDF e intenta de nuevo.`
    );
  }
}

/** Prepara el archivo: fotos se aligeran; PDF/comprobante se valida tal cual. */
export async function prepareUploadFile(file: File): Promise<File> {
  const prepared = file.type.startsWith("image/")
    ? await compressImageFile(file)
    : file;
  assertUploadableFile(prepared);
  return prepared;
}

export async function postUpload(
  url: string,
  file: File,
  extra?: Record<string, string>
): Promise<unknown> {
  const prepared = await prepareUploadFile(file);
  const form = new FormData();
  form.append("file", prepared, sanitizeUploadFilename(prepared));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      form.append(key, value);
    }
  }

  const res = await fetch(url, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo subir el archivo");
  }
  return data;
}
