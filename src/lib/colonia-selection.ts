import { normalizeColoniaKey } from "@/lib/colonias";

export const COLONIA_SELECTION_KEY = "pintando.mapa.colonia";
export const COLONIA_SELECTION_EVENT = "pintando:colonia-selection";

export type ColoniaSelection = {
  key: string;
  label: string;
};

/** «Todas las colonias» (o vacío) no cuenta como colonia elegida. */
export function isAllColoniasSelection(value: string | null | undefined): boolean {
  const key = normalizeColoniaKey(value ?? "");
  return !key || key === "todas colonias" || key === "todas";
}

export function coloniaSelectionFromName(name: string): ColoniaSelection | null {
  const label = name.trim();
  const key = normalizeColoniaKey(label);
  if (!key || isAllColoniasSelection(label)) return null;
  return { key, label };
}

export function parseColoniaFilterParam(
  colonia: string | null | undefined,
  coloniaKey?: string | null
): string | null {
  const fromKey = normalizeColoniaKey(coloniaKey ?? "");
  if (fromKey && !isAllColoniasSelection(coloniaKey)) return fromKey;
  const fromName = coloniaSelectionFromName(colonia ?? "");
  return fromName?.key ?? null;
}

export function coloniaFilenamePart(label: string): string {
  const slug = normalizeColoniaKey(label).replace(/\s+/g, "-").slice(0, 48);
  return slug || "colonia";
}

export function readColoniaSelection(): ColoniaSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COLONIA_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ColoniaSelection>;
    return coloniaSelectionFromName(String(parsed.label ?? parsed.key ?? ""));
  } catch {
    return null;
  }
}

export function writeColoniaSelection(selection: ColoniaSelection | null): void {
  if (typeof window === "undefined") return;
  const next = selection ? coloniaSelectionFromName(selection.label) : null;
  if (!next) localStorage.removeItem(COLONIA_SELECTION_KEY);
  else localStorage.setItem(COLONIA_SELECTION_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(COLONIA_SELECTION_EVENT));
}
