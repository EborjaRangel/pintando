/** Folio consecutivo único de cada casa (asignado por la BD). */
export function formatFolio(folio: number): string {
  return `PC-${String(folio).padStart(6, "0")}`;
}
