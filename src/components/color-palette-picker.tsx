"use client";

import { PALETA_COLORES, parseColors, serializeColors } from "@/lib/paleta-colores";

type Props = {
  value: string;
  onChange: (colorCombo: string) => void;
  name?: string;
};

export function ColorPalettePicker({ value, onChange, name = "notes" }: Props) {
  const selected = parseColors(value);

  function toggle(colorName: string) {
    const exists = selected.includes(colorName as (typeof selected)[number]);
    let next: string[];

    if (exists) {
      // No permitir dejar en cero
      if (selected.length === 1) return;
      next = selected.filter((c) => c !== colorName);
    } else {
      next = [...selected, colorName];
    }

    onChange(serializeColors(next));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="label">Paleta de colores</legend>
      <p className="text-sm text-[var(--muted)]">
        Puedes elegir desde 1 hasta los 4 colores. Toca para marcar o desmarcar.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PALETA_COLORES.map((color) => {
          const isSelected = selected.includes(color.name);
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => toggle(color.name)}
              className={`relative overflow-hidden rounded-xl border-2 text-left transition ${
                isSelected
                  ? "border-[var(--wa-teal)] ring-2 ring-[var(--wa-light)]"
                  : "border-[var(--line)] opacity-80 hover:border-[var(--wa-teal)]/50 hover:opacity-100"
              }`}
              aria-pressed={isSelected}
            >
              <span
                className="block aspect-square w-full border-b border-[var(--line)]"
                style={{
                  backgroundColor: color.hex,
                  boxShadow:
                    color.id === "blanco-hueso"
                      ? "inset 0 0 0 1px rgba(0,0,0,0.08)"
                      : undefined,
                }}
              />
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wa-teal)] text-xs font-bold text-white shadow">
                  ✓
                </span>
              )}
              <span className="block px-2 py-2 text-xs font-medium text-[var(--ink)] sm:text-sm">
                {color.name}
              </span>
              <span className="block px-2 pb-2 font-mono text-[10px] uppercase text-[var(--muted)]">
                {color.hex}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-[var(--muted)]">
        Seleccionados:{" "}
        <span className="font-medium text-[var(--ink)]">
          {selected.length > 0 ? selected.join(" · ") : "Ninguno"}
        </span>{" "}
        ({selected.length}/4)
      </p>
      <input type="hidden" name={name} value={value} readOnly />
    </fieldset>
  );
}
