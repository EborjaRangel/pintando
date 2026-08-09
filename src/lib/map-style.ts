/** Estilo gratuito (OpenFreeMap). No requiere token. */
export const FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Si hay un token Mapbox real (no el de demo), se usan estilos Mapbox.
 * Si no, se usa MapLibre + OpenFreeMap.
 */
export function getMapConfig() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
  const isDemoOrEmpty =
    !token ||
    token.includes("pk.eyJ1IjoibWFwYm94Iiw") ||
    token === "tu-token-publico-de-mapbox";

  if (!isDemoOrEmpty) {
    return {
      provider: "mapbox" as const,
      token,
      style: "mapbox://styles/mapbox/streets-v12",
      lightStyle: "mapbox://styles/mapbox/light-v11",
    };
  }

  return {
    provider: "maplibre" as const,
    token: undefined as string | undefined,
    style: FREE_MAP_STYLE,
    lightStyle: FREE_MAP_STYLE,
  };
}
