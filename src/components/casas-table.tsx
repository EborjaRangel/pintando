"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ExportExcelButton } from "@/components/export-excel-button";
import { AuthorizeHouseButton } from "@/components/authorize-house-button";
import {
  getAuthorizationBlockers,
  type CompletenessStatus,
} from "@/lib/house-status";
import { formatFolio } from "@/lib/folio";

export type CasaRow = {
  id: string;
  folio: number;
  address: string;
  colonia: string;
  colorName?: string | null;
  colorHexes?: string[];
  photosCount: number;
  photoSlots?: number[];
  hasComprobante: boolean;
  expedienteCompleto?: boolean;
  status: CompletenessStatus;
  autorizado: boolean;
  capturista?: string;
};

function authProps(house: CasaRow) {
  const ready = house.status === "complete";
  const blockers = ready
    ? []
    : getAuthorizationBlockers({
        photos: (house.photoSlots ?? []).map((slot) => ({ slot })),
        comprobanteUrl: house.hasComprobante ? "yes" : null,
        expedienteCompleto: Boolean(house.expedienteCompleto),
      });
  return { ready, blockers };
}

function ColorSwatches({
  houseId,
  colorName,
  colorHexes,
}: {
  houseId: string;
  colorName?: string | null;
  colorHexes?: string[];
}) {
  if (!colorName) return <span className="text-[var(--muted)]">—</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 -space-x-1">
        {(colorHexes?.length ? colorHexes : ["#ccc"]).map((hex, i) => (
          <span
            key={`${houseId}-c-${i}`}
            className="h-3.5 w-3.5 rounded-full border border-white"
            style={{ backgroundColor: hex }}
          />
        ))}
      </span>
      <span className="truncate">{colorName}</span>
    </span>
  );
}

export function CasasTable({
  houses,
  showCapturista,
  canAuthorize = false,
  canRevoke = false,
  canExport = false,
}: {
  houses: CasaRow[];
  showCapturista: boolean;
  canAuthorize?: boolean;
  canRevoke?: boolean;
  canExport?: boolean;
}) {
  function showAuthControl(house: CasaRow) {
    if (canAuthorize) return true;
    if (canRevoke && house.autorizado) return true;
    return false;
  }
  const [selected, setSelected] = useState<string[]>([]);

  const allSelected = houses.length > 0 && selected.length === houses.length;
  const selectedIds = useMemo(() => selected, [selected]);

  function toggleAll() {
    setSelected(allSelected ? [] : houses.map((h) => h.id));
  }

  function toggleOne(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-3">
      {canExport && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            {selected.length > 0
              ? `${selected.length} autorizada(s) seleccionada(s)`
              : "Solo se exportan casas autorizadas. Selecciona o baja todas las del listado."}
          </p>
          <ExportExcelButton
            ids={selectedIds.length > 0 ? selectedIds : undefined}
            label={
              selectedIds.length > 0
                ? `Excel (${selectedIds.length})`
                : "Excel (autorizadas)"
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--wa-green)] px-4 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
          />
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {canExport && (
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Seleccionar todas"
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span className="text-sm font-medium">Seleccionar todas</span>
          </label>
        )}

        {houses.map((house) => (
          <article
            key={house.id}
            className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {canExport && (
                <label className="flex min-h-11 min-w-11 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.includes(house.id)}
                    onChange={() => toggleOne(house.id)}
                    aria-label={`Seleccionar ${house.address}`}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                </label>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--wa-teal)]">
                    {formatFolio(house.folio)}
                  </p>
                  {house.autorizado ? (
                    <span className="rounded-full bg-[var(--wa-light)] px-2 py-0.5 text-xs font-medium text-[var(--wa-dark)]">
                      Autorizada
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
                      Pendiente autorización
                    </span>
                  )}
                </div>
                <p className="break-words font-medium text-[var(--ink)]">{house.address}</p>
                <p className="text-sm text-[var(--muted)]">{house.colonia}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={house.status} />
                  <span className="text-xs text-[var(--muted)]">
                    Fotos {house.photosCount}/3 · Comp. {house.hasComprobante ? "Sí" : "No"}
                  </span>
                </div>
                <div className="text-sm">
                  <ColorSwatches
                    houseId={house.id}
                    colorName={house.colorName}
                    colorHexes={house.colorHexes}
                  />
                </div>
                {showCapturista && house.capturista && (
                  <p className="text-xs text-[var(--muted)]">Capturista: {house.capturista}</p>
                )}
                {showAuthControl(house) && (
                  <AuthorizeHouseButton
                    houseId={house.id}
                    autorizado={house.autorizado}
                    canAuthorize={canAuthorize}
                    canRevoke={canRevoke}
                    {...authProps(house)}
                  />
                )}
                <Link href={`/casas/${house.id}`} className="btn-secondary mt-1 w-full">
                  Abrir
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--line)] bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              {canExport && (
                <th className="px-4 py-3 font-medium">
                  <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todas"
                      className="h-5 w-5 accent-[var(--accent)]"
                    />
                  </label>
                </th>
              )}
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Dirección</th>
              <th className="px-4 py-3 font-medium">Colonia</th>
              <th className="px-4 py-3 font-medium">Color</th>
              <th className="px-4 py-3 font-medium">Fotos</th>
              <th className="px-4 py-3 font-medium">Comprobante</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Autorización</th>
              {showCapturista && <th className="px-4 py-3 font-medium">Capturista</th>}
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {houses.map((house) => (
              <tr key={house.id} className="border-t border-[var(--line)]">
                {canExport && (
                  <td className="px-4 py-3">
                    <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selected.includes(house.id)}
                        onChange={() => toggleOne(house.id)}
                        aria-label={`Seleccionar ${house.address}`}
                        className="h-5 w-5 accent-[var(--accent)]"
                      />
                    </label>
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--wa-teal)]">
                  {formatFolio(house.folio)}
                </td>
                <td className="max-w-[14rem] px-4 py-3 font-medium break-words">{house.address}</td>
                <td className="px-4 py-3">{house.colonia}</td>
                <td className="px-4 py-3">
                  <ColorSwatches
                    houseId={house.id}
                    colorName={house.colorName}
                    colorHexes={house.colorHexes}
                  />
                </td>
                <td className="px-4 py-3">{house.photosCount}/3</td>
                <td className="px-4 py-3">{house.hasComprobante ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={house.status} />
                </td>
                <td className="px-4 py-3">
                  {showAuthControl(house) ? (
                    <AuthorizeHouseButton
                      houseId={house.id}
                      autorizado={house.autorizado}
                      canAuthorize={canAuthorize}
                      canRevoke={canRevoke}
                      {...authProps(house)}
                    />
                  ) : house.autorizado ? (
                    <span className="text-[var(--wa-teal)]">Autorizada</span>
                  ) : (
                    <span className="text-[var(--muted)]">Pendiente</span>
                  )}
                </td>
                {showCapturista && <td className="px-4 py-3">{house.capturista}</td>}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/casas/${house.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-[var(--accent-ink)] underline"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
