import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { formatFolio } from "@/lib/folio";
import { getHouseStatus, getStatusLabel } from "@/lib/house-status";
import type { HouseExportRow } from "@/lib/export-houses-excel";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function imageToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || /\.pdf(\?|$)/i.test(url)) return null;

  try {
    let raw: Buffer;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return null;
      raw = Buffer.from(await res.arrayBuffer());
    } else {
      const relative = url.replace(/^\//, "");
      raw = await readFile(path.join(process.cwd(), "public", relative));
    }
    if (!raw.length) return null;
    if (raw.length >= 4 && raw.subarray(0, 4).toString("ascii") === "%PDF") return null;

    const jpeg = await sharp(raw)
      .rotate()
      .resize({ width: 720, height: 540, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, progressive: false })
      .toBuffer();

    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Listado HTML con fotos visibles en iPhone/Safari.
 * Excel embebido no muestra imágenes de forma fiable en el celular.
 */
export async function buildHousesHtml(houses: HouseExportRow[]): Promise<string> {
  const cards: string[] = [];

  for (const house of houses) {
    const photos = [1, 2, 3].map(
      (slot) => house.photos.find((p) => p.slot === slot)?.url ?? null
    );
    const photoUris = await Promise.all(photos.map((u) => imageToDataUri(u)));
    const compUri = await imageToDataUri(house.comprobanteUrl);
    const status = getStatusLabel(getHouseStatus(house));

    const photoHtml = photoUris
      .map((uri, idx) =>
        uri
          ? `<figure><img src="${uri}" alt="Foto ${idx + 1}" loading="lazy" /><figcaption>Foto ${idx + 1}</figcaption></figure>`
          : `<figure class="empty">Sin foto ${idx + 1}</figure>`
      )
      .join("");

    const compHtml = compUri
      ? `<figure><img src="${compUri}" alt="Comprobante" loading="lazy" /><figcaption>Comprobante</figcaption></figure>`
      : house.comprobanteUrl && /\.pdf(\?|$)/i.test(house.comprobanteUrl)
        ? `<p class="muted">Comprobante en PDF</p>`
        : `<p class="muted">Sin comprobante</p>`;

    cards.push(`
      <article class="card">
        <header>
          <h2>${escapeHtml(formatFolio(house.folio))}</h2>
          <p class="status">${escapeHtml(status)}${house.autorizado ? " · Autorizada" : ""}</p>
        </header>
        <p class="addr">${escapeHtml(house.address)}</p>
        <p class="meta">${escapeHtml(house.colonia)} · Capturista: ${escapeHtml(house.createdBy.name)}</p>
        <p class="meta">Levantada: ${escapeHtml(house.createdAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City" }))}</p>
        <p class="meta">Georreferencia: ${house.latitude}, ${house.longitude} · <a href="https://www.google.com/maps?q=${house.latitude},${house.longitude}" target="_blank" rel="noopener">Ver mapa</a></p>
        ${house.notes ? `<p class="notes">${escapeHtml(house.notes)}</p>` : ""}
        <div class="gallery">${photoHtml}${compHtml}</div>
      </article>
    `);
  }

  const stamp = new Date().toLocaleString("es-MX");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Pintando Coyoacán · listado con fotos</title>
  <style>
    :root { color-scheme: light; --ink:#111b21; --muted:#667781; --teal:#128c7e; --bg:#ece5dd; --card:#fff; --line:#e9edef; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--ink); }
    header.top { position: sticky; top: 0; z-index: 2; background: #075e54; color: #fff; padding: 14px 16px; padding-top: max(14px, env(safe-area-inset-top)); }
    header.top h1 { margin: 0; font-size: 1.15rem; }
    header.top p { margin: 4px 0 0; opacity: .9; font-size: .85rem; }
    main { padding: 12px 12px 40px; display: grid; gap: 12px; max-width: 920px; margin: 0 auto; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
    .card h2 { margin: 0; color: var(--teal); font-size: 1.05rem; }
    .status { margin: 4px 0 0; color: var(--muted); font-size: .85rem; }
    .addr { margin: 10px 0 4px; font-weight: 600; line-height: 1.35; }
    .meta, .notes, .muted { margin: 0; color: var(--muted); font-size: .9rem; }
    .notes { margin-top: 6px; }
    .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    figure { margin: 0; background: #f0f2f5; border-radius: 10px; overflow: hidden; }
    figure img { display: block; width: 100%; height: 160px; object-fit: cover; background: #ddd; }
    figcaption { padding: 6px 8px; font-size: .75rem; color: var(--muted); }
    figure.empty { min-height: 160px; display: grid; place-items: center; color: var(--muted); font-size: .85rem; padding: 8px; }
    @media (min-width: 700px) { .gallery { grid-template-columns: repeat(4, 1fr); } figure img { height: 180px; } }
  </style>
</head>
<body>
  <header class="top">
    <h1>Pintando Coyoacán</h1>
    <p>${houses.length} casa(s) · generado ${escapeHtml(stamp)}</p>
  </header>
  <main>
    ${cards.join("\n")}
  </main>
</body>
</html>`;
}
