import { coloniaCatalogName } from "@/lib/colonias";

type ColoniaFeature = {
  properties?: { name?: string };
  geometry?: { type?: string; coordinates?: number[][][] };
};

let featuresPromise: Promise<ColoniaFeature[]> | null = null;

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Nombre de catálogo de la colonia oficial que contiene el pin. */
export function coloniaCatalogAtPoint(
  features: ColoniaFeature[],
  lng: number,
  lat: number
): string | undefined {
  for (const feature of features) {
    if (feature.geometry?.type !== "Polygon") continue;
    const rings = feature.geometry.coordinates ?? [];
    const outer = rings[0];
    if (!outer || !pointInRing(lng, lat, outer)) continue;
    const inHole = rings.slice(1).some((hole) => pointInRing(lng, lat, hole));
    if (inHole) continue;
    return coloniaCatalogName(feature.properties?.name);
  }
  return undefined;
}

async function loadColoniaFeatures(): Promise<ColoniaFeature[]> {
  if (!featuresPromise) {
    featuresPromise = fetch("/data/coyoacan-colonias.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el mapa de colonias");
        return res.json() as Promise<{ features?: ColoniaFeature[] }>;
      })
      .then((data) => data.features ?? [])
      .catch((error) => {
        featuresPromise = null;
        throw error;
      });
  }
  return featuresPromise;
}

export async function coloniaOficialAt(lng: number, lat: number): Promise<string | undefined> {
  const features = await loadColoniaFeatures();
  return coloniaCatalogAtPoint(features, lng, lat);
}
