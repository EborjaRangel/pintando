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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
  url.searchParams.set("types", "address,poi,neighborhood,place,locality");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("No se pudo obtener la dirección desde Mapbox");
  }

  const data = (await res.json()) as GeocodeResponse;
  const feature = data.features?.[0];
  const place =
    feature?.place_name_es?.trim() ||
    feature?.place_name?.trim();

  if (!place) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  const contextNames =
    feature?.context?.map((c) => c.text_es || c.text || "").filter(Boolean) ?? [];
  const colonia = matchColonia([
    feature?.text || "",
    ...contextNames,
    place,
  ]);

  return { address: place, colonia };
}
