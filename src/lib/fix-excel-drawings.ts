import JSZip from "jszip";

/** 1 px @ 96dpi → EMUs (unidad de dibujo de Office). */
const PX_TO_EMU = 9525;

/**
 * ExcelJS genera drawings incompletos para visores estrictos (iPhone Files / Excel iOS).
 * - `<a:ext cx="0" cy="0"/>` → tamaño real
 * - `oneCellAnchor` → `twoCellAnchor` (mejor soporte en iOS)
 * - quita `cstate="print"` del blip (algunos viewers iOS lo rechazan)
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

    // oneCellAnchor → twoCellAnchor (iPhone/Files lo renderiza mejor)
    xml = xml.replace(
      /<xdr:oneCellAnchor\b([^>]*)>([\s\S]*?)<\/xdr:oneCellAnchor>/g,
      (_full, attrs: string, inner: string) => {
        const fromMatch = /<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(inner);
        const extMatch = /<xdr:ext\b([^>]*)\/>/.exec(inner);
        if (!fromMatch) return _full;

        const col = Number(/<xdr:col>(\d+)<\/xdr:col>/.exec(fromMatch[1])?.[1] ?? 0);
        const row = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(fromMatch[1])?.[1] ?? 0);
        const cx = Number(/(?:^|\s)cx="(\d+)"/.exec(extMatch?.[1] ?? "")?.[1] ?? fallbackCx);
        const cy = Number(/(?:^|\s)cy="(\d+)"/.exec(extMatch?.[1] ?? "")?.[1] ?? fallbackCy);

        const pic = /<xdr:pic>[\s\S]*?<\/xdr:pic>/.exec(inner)?.[0] ?? "";
        const client = /<xdr:clientData\b[^>]*\/>/.exec(inner)?.[0] ?? "<xdr:clientData/>";
        const editAs = /editAs="([^"]+)"/.exec(attrs)?.[1] ?? "oneCell";

        // to = celda siguiente; a:ext dentro del pic se corrige abajo
        return (
          `<xdr:twoCellAnchor editAs="${editAs}">` +
          `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff>` +
          `<xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
          `<xdr:to><xdr:col>${col + 1}</xdr:col><xdr:colOff>0</xdr:colOff>` +
          `<xdr:row>${row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
          pic.replace(/<a:ext cx="0" cy="0"\s*\/>/g, `<a:ext cx="${cx}" cy="${cy}"/>`) +
          client +
          `</xdr:twoCellAnchor>`
        );
      }
    );

    // Copiar tamaño de xdr:ext → a:ext (si aún hay oneCell residual)
    xml = xml.replace(
      /<xdr:ext\b([^>]*)\/>([\s\S]*?)<a:ext cx="0" cy="0"\s*\/>/g,
      (_full, extAttrs: string, middle: string) => {
        const cx = /(?:^|\s)cx="(\d+)"/.exec(extAttrs)?.[1] ?? fallbackCx;
        const cy = /(?:^|\s)cy="(\d+)"/.exec(extAttrs)?.[1] ?? fallbackCy;
        return `<xdr:ext${extAttrs}/>${middle}<a:ext cx="${cx}" cy="${cy}"/>`;
      }
    );

    xml = xml.replace(
      /<a:ext cx="0" cy="0"\s*\/>/g,
      `<a:ext cx="${fallbackCx}" cy="${fallbackCy}"/>`
    );

    // iOS a veces no pinta blips con cstate="print"
    xml = xml.replace(/\s+cstate="print"/g, "");

    zip.file(name, xml);
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    })
  );
}
