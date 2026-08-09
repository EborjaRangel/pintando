/**
 * Paleta oficial de Pintando Coyoacán (muestra de pintura).
 * Hex aproximados tomados de la foto de swatches.
 */
export const PALETA_COLORES = [
  {
    id: "gris-frances",
    name: "Gris Francés",
    hex: "#7B7B77",
  },
  {
    id: "blanco-hueso",
    name: "Blanco Hueso",
    hex: "#F3EFE6",
  },
  {
    id: "azul-francia",
    name: "Azul Francia",
    hex: "#1B3A8C",
  },
  {
    id: "azul-claro",
    name: "Azul claro",
    hex: "#1AA8E0",
  },
] as const;

export type ColorPaletaId = (typeof PALETA_COLORES)[number]["id"];
export type ColorPaletaName = (typeof PALETA_COLORES)[number]["name"];

export const COLOR_NAMES = PALETA_COLORES.map((c) => c.name);

export function getColorByName(name: string | null | undefined) {
  if (!name) return null;
  const trimmed = name.trim();
  return PALETA_COLORES.find((c) => c.name === trimmed || c.id === trimmed) ?? null;
}

/** Parsea 1–4 colores guardados en notes (separados por coma). */
export function parseColors(value: string | null | undefined): ColorPaletaName[] {
  if (!value?.trim()) return [];
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const unique: ColorPaletaName[] = [];
  for (const part of parts) {
    const color = getColorByName(part);
    if (color && !unique.includes(color.name)) {
      unique.push(color.name);
    }
  }
  return unique;
}

export function serializeColors(colors: string[]): string {
  const valid = colors
    .map((c) => getColorByName(c)?.name)
    .filter((c): c is ColorPaletaName => Boolean(c));
  // Mantener orden de la paleta oficial
  return PALETA_COLORES.map((c) => c.name)
    .filter((name) => valid.includes(name))
    .join(", ");
}

export function getColorsFromNotes(notes: string | null | undefined) {
  return parseColors(notes).map((name) => getColorByName(name)!);
}

export function isColorPaleta(value: string): value is ColorPaletaName {
  return COLOR_NAMES.includes(value as ColorPaletaName);
}
