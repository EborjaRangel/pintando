import { MAPBOX_TOKEN } from "@/lib/mapbox-config";
import { coloniaOficialAt } from "@/lib/colonia-polygon";

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
  center?: [number, number];
  context?: GeocodeContext[];
};

type GeocodeResponse = {
  features?: GeocodeFeature[];
};

export type ReverseGeocodeResult = {
  address: string;
  colonia?: string;
  /** Metros entre el pin y el número de calle que devolvió el mapa. */
  snappedMeters?: number;
};

/** Etiquetas erróneas / turísticas que Mapbox mete como “región” de CDMX. */
const JUNK_REGION_RE =
  /\b(mexican\s*riviera|riviera\s*maya|pacific\s*coast|baja\s*california\s*sur)\b/gi;

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

function metersBetween(lng1: number, lat1: number, lng2: number, lat2: number) {
  const earth = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

function closestAddress(features: GeocodeFeature[], lng: number, lat: number) {
  let best: { feature: GeocodeFeature; meters: number } | null = null;
  for (const feature of features) {
    const center = feature.center;
    if (!center || center.length < 2) continue;
    const meters = metersBetween(lng, lat, center[0], center[1]);
    if (!best || meters < best.meters) best = { feature, meters };
  }
  return best ?? { feature: features[0], meters: undefined as number | undefined };
}

function buildAddressFromFeature(feature: GeocodeFeature, colonia?: string): string {
  const street = feature.text?.trim() || "";
  const number = feature.address?.trim() || "";
  const streetLine = [street, number].filter(Boolean).join(" ").trim();

  const ctx = feature.context ?? [];
  const byType = (type: string) =>
    ctx
      .filter((c) => contextType(c.id) === type)
      .map((c) => (c.text_es || c.text || "").trim())
      .find(Boolean);

  const locality = byType("locality");
  const place = byType("place");
  const postcode = byType("postcode");

  const parts = [
    streetLine,
    colonia,
    locality && locality !== colonia ? locality : undefined,
    place,
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
  url.searchParams.set("limit", "5");
  url.searchParams.set("types", "address");
  url.searchParams.set("country", "mx");
  url.searchParams.set("bbox", "-99.22,19.28,-99.10,19.38");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("No se pudo obtener la dirección desde Mapbox");
  }

  const data = (await res.json()) as GeocodeResponse;
  const features = data.features ?? [];
  if (features.length === 0) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  const { feature, meters } = closestAddress(features, lng, lat);
  if (!feature) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  const colonia = await coloniaOficialAt(lng, lat);
  const address = buildAddressFromFeature(feature, colonia);
  if (!address) {
    throw new Error("No se encontró dirección para esta ubicación");
  }

  return { address, colonia, snappedMeters: meters };
}
