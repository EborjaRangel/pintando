import { readFileSync } from "fs";
import path from "path";
import { coloniaCatalogAtPoint } from "@/lib/colonia-polygon";

type ColoniaFeature = {
  properties?: { name?: string };
  geometry?: { type?: string; coordinates?: number[][][] };
};

let features: ColoniaFeature[] | null = null;

function loadFeatures() {
  if (!features) {
    const file = path.join(process.cwd(), "public", "data", "coyoacan-colonias.geojson");
    const geo = JSON.parse(readFileSync(file, "utf8")) as { features: ColoniaFeature[] };
    features = geo.features;
  }
  return features;
}

/** Colonia del catálogo según el polígono oficial. No usa el nombre que manda el navegador. */
export function coloniaOficialEnServidor(lng: number, lat: number): string | undefined {
  return coloniaCatalogAtPoint(loadFeatures(), lng, lat);
}

export function addressConColoniaOficial(address: string, colonia: string): string {
  if (address.toLocaleLowerCase("es").includes(colonia.toLocaleLowerCase("es"))) return address;
  const marker = ", Coyoacán,";
  if (address.includes(marker)) {
    return address.replace(marker, `, ${colonia}${marker}`);
  }
  return address;
}
