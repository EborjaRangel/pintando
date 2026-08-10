/** Lado más largo máximo: sigue viéndose bien en móvil/web y en Excel. */
const MAX_EDGE = 1600;
/** Calidad JPEG inicial (~70–75% suele verse bien con mucho menos peso). */
const JPEG_QUALITY = 0.72;
const TARGET_MAX_BYTES = 900 * 1024;

function isCompressibleImage(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  // SVG no se rasteriza aquí; PDF tampoco.
  if (file.type === "image/svg+xml") return false;
  return true;
}

async function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Reduce resolución y convierte a JPEG antes de subir.
 * Si falla o el resultado no ayuda, devuelve el archivo original.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined" || !isCompressibleImage(file)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let quality = JPEG_QUALITY;
    let blob = await canvasToJpeg(canvas, quality);

    // Si sigue pesada, baja calidad una o dos veces.
    while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.45) {
      quality = Math.max(0.45, quality - 0.12);
      blob = await canvasToJpeg(canvas, quality);
    }

    if (!blob) return file;

    // Si no hubo ganancia real (p. ej. ya era chica), conserva el original.
    if (blob.size >= file.size * 0.95 && file.size <= TARGET_MAX_BYTES) {
      return file;
    }

    const base = (file.name.replace(/\.[^.]+$/, "") || "foto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_");

    return new File([blob], `${base || "foto"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
