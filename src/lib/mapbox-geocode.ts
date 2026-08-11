import { MAPBOX_TOKEN } from "@/lib/mapbox-config";
import { COLONIAS_COYOACAN } from "@/lib/colonias";

type GeocodeContext = {
  id?: string;
  text?: string;
  text_es?: string;
};

type GeocodeFeature = {
  place_name?: string;
  place_name_es?: string;
  text?: string;
  address?: string;
  context?: GeocodeContext[];
};

type GeocodeResponse = {
  features?: GeocodeFeature[];
};

export type ReverseGeocodeResult = {
  address: string;
  colonia?: string;
};

/** Etiquetas erróneas / turísticas que Mapbox mete como “región” de CDMX. */
const JUNK_REGION_RE =
  /\b(mexican\s*riviera|riviera\s*maya|pacific\s*coast|baja\s*california\s*sur)\b/gi;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita “Mexican Riviera” y residuos de comas/espacios en direcciones. */
export function sanitizeCdmxAddress(value: string): string {
  return value
    .replace(JUNK_REGION_RE, "")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function contextType(id?: string): string {
  if (!id) return "";
  return id.split(".")[0] || "";
}

function matchColonia(candidates: string[]): string | undefined {
  const normalizedColonias = COLONIAS_COYOACAN.map((c) => ({
    original: c,
    key: normalize(c),
  }));

  for (const candidate of candidates) {
    const key = normalize(candidate.replace(/^(colonia|col\.|barrio)\s+/i, ""));
    if (!key) continue;

    const exact = normalizedColonias.find((c) => c.key === key);
    if (exact) return exact.original;

    const partial = normalizedColonias.find(
      (c) => c.key.includes(key) || key.includes(c.key)
    );
    if (partial) return partial.original;
  }

  return undefined;
}

function buildAddressFromFeature(feature: GeocodeFeature): string {
  const street = feature.text?.trim() || "";
  const number = feature.address?.trim() || "";
  const streetLine = [street, number].filter(Boolean).join(" ").trim();

  const ctx = feature.context ?? [];
  const byType = (type: string) =>
    ctx
      .filter((c) => contextType(c.id) === type)
      .map((c) => (c.text_es || c.text || "").trim())
      .find(Boolean);

  const neighborhood = byType("neighborhood");
  const locality = byType("locality"); // Coyoacán
  const place = byType("place"); // Ciudad de México
  const postcode = byType("postcode");
  const regionRaw = byType("region") || "";
  const regionIsJunk =
    /\b(mexican\s*riviera|riviera\s*maya|pacific\s*coast|baja\s*california\s*sur)\b/i.test(
      regionRaw
    );
  const region = regionIsJunk ? "" : regionRaw;

  // Dirección local: calle, colonia, alcaldía, ciudad — sin “región” turística
  const parts = [
    streetLine,
    neighborhood,
    locality && locality !== neighborhood ? locality : undefined,
    place,
    region && region !== place ? region : undefined,
    postcode,
  ].filter((p): p is string => Boolean(p && p.trim()));

  if (parts.length > 0) {
    return sanitizeCdmxAddress(parts.join(", "));
  }

  const fallback =
    feature.place_name_es?.trim() || feature.place_name?.trim() || streetLine;
  return sanitizeCdmxAddress(fallback);
}

export async function reverseGeocodeMapbox(
  lng: number,
  lat: number
): Promise<ReverseGeocodeResult> {
  if (!MAPBOX_TOKEN) {
    return { address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`
  );
  url.searchParams.set("language", "es");
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi,neighborhood,locality");
  url.searchParams.set("country", "mx");
  // Bbox aprox. de la alcaldía Coyoacán
  url.searchParams.set("bbox", "-99.22,19.28,-99.10,19.38");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("No se pudo obtener la dirección desde Mapbox");
  }

  const data = (await res.json()) as GeocodeResponse;
  const feature = data.features?.[0];

  if (!feature) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  const address = buildAddressFromFeature(feature);
  if (!address) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  const contextNames =
    feature.context?.map((c) => c.text_es || c.text || "").filter(Boolean) ?? [];
  const colonia = matchColonia([
    feature.text || "",
    ...contextNames,
    address,
  ]);

  return { address, colonia };
}
