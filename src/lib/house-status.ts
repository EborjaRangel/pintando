export type HouseStatusInput = {
  photos: { slot: number }[];
  comprobanteUrl: string | null;
  expedienteCompleto: boolean;
};

export type CompletenessStatus = "complete" | "incomplete";

export function getHouseStatus(house: HouseStatusInput): CompletenessStatus {
  const slots = new Set(house.photos.map((p) => p.slot));
  const hasThreePhotos = [1, 2, 3].every((slot) => slots.has(slot));
  const hasComprobante = Boolean(house.comprobanteUrl);

  if (hasThreePhotos && hasComprobante && house.expedienteCompleto) {
    return "complete";
  }

  return "incomplete";
}

export const MAP_COLOR_AUTHORIZED = "#2563EB";
export const MAP_COLOR_COMPLETE = "#25D366";
export const MAP_COLOR_INCOMPLETE = "#ea580c";

export function getStatusColor(status: CompletenessStatus): string {
  return status === "complete" ? MAP_COLOR_COMPLETE : MAP_COLOR_INCOMPLETE;
}

/** Color del pin en el mapa: autorizada = azul (prioridad). */
export function getMapMarkerColor(house: HouseStatusInput & { autorizado?: boolean }): string {
  if (house.autorizado) return MAP_COLOR_AUTHORIZED;
  return getStatusColor(getHouseStatus(house));
}

export function getStatusLabel(status: CompletenessStatus): string {
  return status === "complete" ? "Expediente completo" : "Pendiente";
}
