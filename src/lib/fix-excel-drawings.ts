import JSZip from "jszip";

/** 1 px @ 96dpi → EMUs (unidad de dibujo de Office). */
const PX_TO_EMU = 9525;

/**
 * ExcelJS deja `<a:ext cx="0" cy="0"/>` en drawings.
 * Excel de escritorio lo tolera; iOS/Android/Files preview no muestran la imagen.
 * Copiamos el tamaño real de `<xdr:ext>` (o un fallback) a cada `<a:ext>`.
 */
export async function fixExcelDrawingExtents(
  xlsxBuffer: Buffer,
  fallbackWidthPx = 120,
  fallbackHeightPx = 90
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const fallbackCx = String(Math.round(fallbackWidthPx * PX_TO_EMU));
  const fallbackCy = String(Math.round(fallbackHeightPx * PX_TO_EMU));

  const drawingNames = Object.keys(zip.files).filter((name) =>
    /^xl\/drawings\/drawing\d+\.xml$/i.test(name)
  );

  for (const name of drawingNames) {
    const file = zip.file(name);
    if (!file) continue;

    let xml = await file.async("string");

    // oneCellAnchor: <xdr:ext cx="…" cy="…"/> … <a:ext cx="0" cy="0"/>
    xml = xml.replace(
      /<xdr:ext\b([^>]*)\/>([\s\S]*?)<a:ext cx="0" cy="0"\s*\/>/g,
      (full, extAttrs: string, middle: string) => {
        const cx = /(?:^|\s)cx="(\d+)"/.exec(extAttrs)?.[1] ?? fallbackCx;
        const cy = /(?:^|\s)cy="(\d+)"/.exec(extAttrs)?.[1] ?? fallbackCy;
        return `<xdr:ext${extAttrs}/>${middle}<a:ext cx="${cx}" cy="${cy}"/>`;
      }
    );

    // Cualquier cero restante (p. ej. twoCellAnchor)
    xml = xml.replace(
      /<a:ext cx="0" cy="0"\s*\/>/g,
      `<a:ext cx="${fallbackCx}" cy="${fallbackCy}"/>`
    );

    zip.file(name, xml);
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    })
  );
}
