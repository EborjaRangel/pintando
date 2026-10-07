"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ExportExcelButton } from "@/components/export-excel-button";
import { AuthorizeHouseButton } from "@/components/authorize-house-button";
import { useColoniaSelection } from "@/components/use-colonia-selection";
import {
  getAuthorizationBlockers,
  type CompletenessStatus,
} from "@/lib/house-status";
import type { ExcelExportScope } from "@/lib/roles";
import { formatFolio } from "@/lib/folio";
import { normalizeColoniaKey } from "@/lib/colonias";
import type { DirigenteBusqueda } from "@/lib/dirigentes-por-colonia";

/** Compara calle y número sin acentos, mayúsculas ni puntuación. */
function normalizeAddressSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isStreetSearch(query: string) {
  const q = query.trim().toLowerCase();
  if (/^pc-?\d*$/i.test(q) || /^\d+$/.test(q)) return false;
  return /[a-z]/.test(normalizeAddressSearch(query));
}

function addressMatchesStreet(address: string, query: string) {
  const needle = normalizeAddressSearch(query);
  if (!needle || !isStreetSearch(query)) return false;
  return normalizeAddressSearch(address).includes(needle);
}

function personFields(person: DirigenteBusqueda) {
  return [person.nombre, person.primerApellido, person.segundoApellido]
    .map((part) => normalizeAddressSearch(part))
    .filter((part) => part.length >= 2);
}

/** Nombre, apellido paterno o materno, o una combinación de esos campos. */
function personMatches(person: DirigenteBusqueda, query: string) {
  const q = normalizeAddressSearch(query);
  if (q.length < 3 || !/[a-z]/.test(q) || /\d/.test(q)) return false;
  const fields = personFields(person);
  if (fields.length === 0) return false;
  const tokens = q.split(" ").filter((token) => token.length >= 2);
  if (tokens.length === 0) return false;
  if (tokens.length === 1) {
    const token = tokens[0];
    return fields.some((field) => field === token || field.startsWith(token));
  }
  if (fields.join(" ").includes(q)) return true;
  const used = new Set<number>();
  return tokens.every((token) => {
    const idx = fields.findIndex(
      (field, index) => !used.has(index) && (field === token || field.startsWith(token))
    );
    if (idx < 0) return false;
    used.add(idx);
    return true;
  });
}

function dirigenteLabel(person: DirigenteBusqueda) {
  return [person.nombre, person.primerApellido, person.segundoApellido].filter(Boolean).join(" ");
}

export type CasaRow = {
  id: string;
  folio: number;
  consecutivo: number;
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
  exportScope = "authorized",
  exportLabel = "Excel (autorizadas)",
  showPhotoLink = false,
  enableSearch = false,
  dirigentesByColonia = {},
}: {
  houses: CasaRow[];
  showCapturista: boolean;
  canAuthorize?: boolean;
  canRevoke?: boolean;
  canExport?: boolean;
  exportScope?: ExcelExportScope;
  exportLabel?: string;
  /** Solo Admin: enlace directo a las fotos del registro. */
  showPhotoLink?: boolean;
  /** Solo Admin: folio, globo, calle y número, o dirigente de la colonia. */
  enableSearch?: boolean;
  /** Dirigentes activos por clave de colonia. */
  dirigentesByColonia?: Record<string, DirigenteBusqueda[]>;
}) {
  function showAuthControl(house: CasaRow) {
    if (canAuthorize) return true;
    if (canRevoke && house.autorizado) return true;
    return false;
  }
  const showRowSelect = canExport && exportScope !== "authorized";
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [coloniaKey, setColoniaKey] = useState("");
  const { selection: coloniaSelection } = useColoniaSelection();

  const coloniaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const house of houses) names.add(house.colonia);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [houses]);

  const scopedHouses = useMemo(() => {
    if (!enableSearch || !coloniaKey) return houses;
    return houses.filter((house) => normalizeColoniaKey(house.colonia) === coloniaKey);
  }, [houses, coloniaKey, enableSearch]);

  const matchedDirigentes = useMemo(() => {
    if (!enableSearch || !isStreetSearch(query) || /\d/.test(query)) return [];
    const groups = coloniaKey
      ? [[coloniaKey, dirigentesByColonia[coloniaKey] ?? []] as const]
      : Object.entries(dirigentesByColonia);
    const labels = new Set<string>();
    for (const [, people] of groups) {
      for (const person of people) {
        if (personMatches(person, query)) labels.add(dirigenteLabel(person));
      }
    }
    return [...labels].sort((a, b) => a.localeCompare(b, "es"));
  }, [coloniaKey, dirigentesByColonia, enableSearch, query]);

  const visibleHouses = useMemo(() => {
    if (!enableSearch) return houses;
    const q = query.trim().toLowerCase();
    if (!q) return scopedHouses;
    if (isStreetSearch(q)) {
      const nameKeys = new Set<string>();
      if (!/\d/.test(q)) {
        const groups = coloniaKey
          ? [[coloniaKey, dirigentesByColonia[coloniaKey] ?? []] as const]
          : Object.entries(dirigentesByColonia);
        for (const [key, people] of groups) {
          if (people.some((person) => personMatches(person, q))) nameKeys.add(key);
        }
      }
      if (nameKeys.size > 0) {
        const pool = scopedHouses.filter((house) =>
          nameKeys.has(normalizeColoniaKey(house.colonia))
        );
        const byAddress = pool.filter((house) => addressMatchesStreet(house.address, q));
        if (byAddress.length > 0) return byAddress;
        return pool;
      }
      if (!coloniaKey) return [];
      return scopedHouses.filter((house) => addressMatchesStreet(house.address, q));
    }
    const digits = q.replace(/^pc-?/i, "").replace(/\D/g, "");
    const numeric = digits ? Number(digits) : Number.NaN;
    return scopedHouses.filter((house) => {
      const folioText = formatFolio(house.folio).toLowerCase();
      if (folioText.includes(q) || String(house.folio) === q || String(house.consecutivo) === q) {
        return true;
      }
      return (
        !Number.isNaN(numeric) &&
        (house.folio === numeric || house.consecutivo === numeric)
      );
    });
  }, [scopedHouses, query, enableSearch, coloniaKey, dirigentesByColonia]);

  const allSelected =
    visibleHouses.length > 0 && visibleHouses.every((house) => selected.includes(house.id));
  const selectedIds = useMemo(() => selected, [selected]);

  function toggleAll() {
    setSelected(allSelected ? [] : visibleHouses.map((h) => h.id));
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
            {exportScope === "authorized"
              ? coloniaSelection
                ? `Excel de ${coloniaSelection.label}: todas las casas de esa colonia, con estatus. Elige la colonia en Mapa; no se genera con Todas las colonias.`
                : "Para generar el Excel elige una colonia en Mapa. No se puede con Todas las colonias."
              : selected.length > 0
                ? `${selected.length} casa(s) seleccionada(s)`
                : exportScope === "tracking"
                  ? "Excel de seguimiento: solo las casas que tú levantaste (completas o no)."
                  : exportScope === "all"
                    ? "Excel de todas las casas, sin importar el estatus. Incluye capturista, fecha/hora, georreferencia y fotos."
                    : "Excel de autorizadas (todas las de todos los capturistas). Selecciona o baja el listado."}
          </p>
          <ExportExcelButton
            scope={exportScope}
            ids={
              exportScope === "authorized" || selectedIds.length === 0
                ? undefined
                : selectedIds
            }
            label={
              exportScope === "authorized"
                ? exportLabel
                : selectedIds.length > 0
                  ? `Excel (${selectedIds.length})`
                  : exportLabel
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--wa-green)] px-4 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
          />
        </div>
      )}

      {enableSearch && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[min(100%,18rem)] flex-1 space-y-1 sm:max-w-sm">
            <span className="label">Colonia</span>
            <select
              className="field"
              value={coloniaKey}
              onChange={(event) => setColoniaKey(event.target.value)}
            >
              <option value="">Todas las casas</option>
              {coloniaOptions.map((colonia) => (
                <option key={colonia} value={normalizeColoniaKey(colonia)}>
                  {colonia}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[min(100%,18rem)] flex-1 space-y-1 sm:max-w-md">
            <span className="label">Buscar por folio, globo, dirección o dirigente</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. PC-000012, Hidalgo 65 o García López"
              className="field"
              autoComplete="off"
            />
            <p className="text-xs text-[var(--muted)]">
              Calle y número, o el nombre y apellidos del dirigente, dentro de la colonia
              seleccionada.
            </p>
          </label>
        </div>
      )}

      {enableSearch && matchedDirigentes.length > 0 && (
        <p className="text-sm text-[var(--ink)]">
          Dirigentes de la colonia:{" "}
          {matchedDirigentes.slice(0, 8).join(" · ")}
          {matchedDirigentes.length > 8 ? ` · y ${matchedDirigentes.length - 8} más` : ""}
        </p>
      )}

      {enableSearch && visibleHouses.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          {query.trim()
            ? isStreetSearch(query) && !coloniaKey
              ? "Para buscar por calle y número, selecciona la colonia. El dirigente se busca por nombre o apellidos."
              : coloniaKey
                ? "No hay registros con ese folio, número de globo, dirección o dirigente en la colonia seleccionada."
                : "No hay registros con ese folio o número de globo."
            : "No hay casas en la colonia seleccionada."}
        </p>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {showRowSelect && (
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

        {visibleHouses.map((house) => (
          <article
            key={house.id}
            className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {showRowSelect && (
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
                  <p className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[var(--wa-teal)] px-2 text-sm font-bold text-white">
                    {house.consecutivo}
                  </p>
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
                  {showPhotoLink && (
                    <Link
                      href={`/casas/${house.id}#fotos`}
                      className="text-sm font-semibold text-[var(--wa-teal)] underline"
                    >
                      Ver fotos
                    </Link>
                  )}
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
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  {showPhotoLink && (
                    <Link
                      href={`/casas/${house.id}#fotos`}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Ver fotos
                    </Link>
                  )}
                  <Link href={`/casas/${house.id}`} className="btn-secondary w-full sm:w-auto">
                    Abrir
                  </Link>
                </div>
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
              {showRowSelect && (
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
              <th className="px-4 py-3 font-medium">N.º</th>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Dirección</th>
              <th className="px-4 py-3 font-medium">Colonia</th>
              <th className="px-4 py-3 font-medium">Color</th>
              <th className="px-4 py-3 font-medium">Fotos</th>
              <th className="px-4 py-3 font-medium">Comprobante</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Autorización</th>
              {showCapturista && <th className="px-4 py-3 font-medium">Capturista</th>}
              <th className="sticky right-0 bg-[var(--surface-2)] px-4 py-3 font-medium shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]" />
            </tr>
          </thead>
          <tbody>
            {visibleHouses.map((house) => (
              <tr key={house.id} className="border-t border-[var(--line)]">
                {showRowSelect && (
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
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[var(--wa-teal)] px-2 text-sm font-bold text-white">
                    {house.consecutivo}
                  </span>
                </td>
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
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span>{house.photosCount}/3</span>
                    {showPhotoLink && (
                      <Link
                        href={`/casas/${house.id}#fotos`}
                        className="font-semibold text-[var(--wa-teal)] underline"
                      >
                        Ver fotos
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{house.hasComprobante ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={house.status} />
                </td>
                <td className="min-w-[10rem] px-4 py-3">
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
                <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {showPhotoLink && (
                      <Link
                        href={`/casas/${house.id}#fotos`}
                        className="inline-flex min-h-11 items-center rounded-lg bg-[var(--wa-teal)] px-3 text-sm font-medium text-white hover:bg-[var(--wa-dark)]"
                      >
                        Ver fotos
                      </Link>
                    )}
                    <Link
                      href={`/casas/${house.id}`}
                      className="inline-flex min-h-11 items-center rounded-lg px-3 text-[var(--accent-ink)] underline"
                    >
                      Abrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
