const RAW_TOKEN = (
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  ""
).trim();

export const CENTRO_COYOACAN = { lat: 19.346, lng: -99.162 };

/** Token público de Mapbox; vacío si falta o es un placeholder inválido. */
export const MAPBOX_TOKEN =
  RAW_TOKEN.startsWith("pk.") &&
  !RAW_TOKEN.includes("SENSITIVE") &&
  !RAW_TOKEN.includes("pk.eyJ1IjoibWFwYm94Iiw")
    ? RAW_TOKEN
    : "";

export const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/streets-v12";

/** Respaldo si los tiles de Mapbox fallan en el navegador. */
export const FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function mapboxConfigError(): string | null {
  if (!RAW_TOKEN) {
    return "Configura NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN en .env (token pk.… de Mapbox).";
  }
  if (!MAPBOX_TOKEN) {
    return "El token de Mapbox es inválido o es el token de demo. Usa tu token pk. real.";
  }
  return null;
}
