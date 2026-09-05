"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FeatureCollection } from "geojson";
import { CENTRO_COYOACAN, MAPBOX_TOKEN, mapboxConfigError } from "@/lib/mapbox-config";
import { initBasemap, type AnyMap } from "@/lib/init-map";
import { normalizeColoniaKey } from "@/lib/colonias";

type HouseFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    folio: string;
    consecutivo: number;
    consecutivoLabel?: string;
    address: string;
    colonia: string;
    status: "complete" | "incomplete";
    autorizado: boolean;
    color: string;
    expedienteCompleto: boolean;
    hasComprobante: boolean;
    photosCount: number;
    createdBy: string;
  };
};

type Props = {
  houses: {
    type: "FeatureCollection";
    features: HouseFeature[];
  };
};

type LngLatBoundsLike = [[number, number], [number, number]];

function boundsFromGeometry(geometry: GeoJSON.Geometry | null | undefined): LngLatBoundsLike | null {
  if (!geometry) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function extend(lng: number, lat: number) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  function walk(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      extend(coords[0], coords[1]);
      return;
    }
    for (const part of coords) walk(part);
  }

  if (geometry.type === "GeometryCollection") {
    for (const part of geometry.geometries) {
      const b = boundsFromGeometry(part);
      if (!b) continue;
      extend(b[0][0], b[0][1]);
      extend(b[1][0], b[1][1]);
    }
  } else {
    walk((geometry as { coordinates: unknown }).coordinates);
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function boundsFromCollection(collection: FeatureCollection): LngLatBoundsLike | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const feature of collection.features) {
    const b = boundsFromGeometry(feature.geometry);
    if (!b) continue;
    minLng = Math.min(minLng, b[0][0]);
    minLat = Math.min(minLat, b[0][1]);
    maxLng = Math.max(maxLng, b[1][0]);
    maxLat = Math.max(maxLat, b[1][1]);
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function houseConsecutivo(feature: HouseFeature): number {
  const raw = feature.properties.consecutivo ?? feature.properties.consecutivoLabel;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function featureName(feature: GeoJSON.Feature | undefined): string {
  return String(feature?.properties?.name ?? "");
}

export function CoyoacanMap({ houses }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AnyMap | null>(null);
  const coloniasGeoRef = useRef<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"mapbox" | "maplibre" | null>(null);
  const [filter, setFilter] = useState<"all" | "authorized" | "complete" | "incomplete">("all");
  const [coloniaKey, setColoniaKey] = useState<string | null>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const balloonElsRef = useRef(new Map<string, HTMLButtonElement>());
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipLabelRef = useRef<HTMLParagraphElement>(null);
  const placeTooltipRef = useRef<(x: number, y: number, colonia: string) => void>(() => {});

  placeTooltipRef.current = (x, y, colonia) => {
    const box = tooltipRef.current;
    const label = tooltipLabelRef.current;
    if (!box || !label) return;
    label.textContent = colonia;
    const width = overlayRef.current?.clientWidth ?? containerRef.current?.clientWidth ?? 320;
    box.style.display = "block";
    box.style.left = `${Math.min(x + 12, width - 120)}px`;
    box.style.top = `${Math.max(8, y - 40)}px`;
  };

  function hideTooltip() {
    const box = tooltipRef.current;
    if (box) box.style.display = "none";
  }

  const activeColoniaKey = coloniaKey;
  const showConsecutivoNumbers = Boolean(coloniaKey);

  const coloniaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const feature of houses.features) names.add(feature.properties.colonia);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [houses]);

  const scopedHouses = useMemo(() => {
    if (!activeColoniaKey) return houses.features;
    return houses.features.filter(
      (feature) => normalizeColoniaKey(feature.properties.colonia) === activeColoniaKey
    );
  }, [activeColoniaKey, houses]);

  const filtered = useMemo(() => {
    const features =
      filter === "all"
        ? scopedHouses
        : filter === "authorized"
          ? scopedHouses.filter((feature) => feature.properties.autorizado)
          : scopedHouses.filter(
              (feature) =>
                !feature.properties.autorizado && feature.properties.status === filter
            );
    return { type: "FeatureCollection" as const, features };
  }, [filter, scopedHouses]);

  const stats = useMemo(() => {
    const authorized = scopedHouses.filter((feature) => feature.properties.autorizado).length;
    const complete = scopedHouses.filter(
      (feature) => !feature.properties.autorizado && feature.properties.status === "complete"
    ).length;
    const incomplete = scopedHouses.filter(
      (feature) => !feature.properties.autorizado && feature.properties.status === "incomplete"
    ).length;
    return {
      authorized,
      complete,
      incomplete,
      total: scopedHouses.length,
    };
  }, [scopedHouses]);

  const activeColoniaLabel = useMemo(() => {
    if (!activeColoniaKey) return null;
    const house = houses.features.find(
      (feature) => normalizeColoniaKey(feature.properties.colonia) === activeColoniaKey
    );
    if (house) return house.properties.colonia;
    const geo = coloniasGeoRef.current?.features.find(
      (feature) => normalizeColoniaKey(featureName(feature)) === activeColoniaKey
    );
    return featureName(geo) || null;
  }, [activeColoniaKey, houses]);

  const selectedHouse =
    filtered.features.find((feature) => feature.properties.id === selectedHouseId) ?? null;

  useEffect(() => {
    if (
      selectedHouseId &&
      !filtered.features.some((feature) => feature.properties.id === selectedHouseId)
    ) {
      setSelectedHouseId(null);
    }
  }, [filtered, selectedHouseId]);

  useEffect(() => {
    const configError = mapboxConfigError();
    if (configError && !MAPBOX_TOKEN) {
      // igual intentamos OpenFreeMap
    }

    let cancelled = false;
    let dispose: (() => void) | undefined;
    const controller = new AbortController();

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const [coloniasRes, alcaldiaRes] = await Promise.all([
          fetch("/data/coyoacan-colonias.geojson", { signal: controller.signal }),
          fetch("/data/coyoacan-alcaldia.geojson", { signal: controller.signal }),
        ]);

        if (!coloniasRes.ok) throw new Error("No se pudieron cargar las colonias");
        const colonias = (await coloniasRes.json()) as FeatureCollection;
        const alcaldia = alcaldiaRes.ok
          ? ((await alcaldiaRes.json()) as FeatureCollection)
          : null;

        if (cancelled || !containerRef.current) return;
        coloniasGeoRef.current = colonias;

        dispose = await initBasemap({
          container: containerRef.current,
          center: [CENTRO_COYOACAN.lng, CENTRO_COYOACAN.lat],
          zoom: 11.5,
          onError: (msg) => {
            if (!cancelled) setError(`Mapbox no cargó tiles (${msg}). Usando mapa alterno.`);
          },
          onReady: (map, usedProvider) => {
            if (cancelled) return;
            mapRef.current = map;
            setProvider(usedProvider);

            for (const id of [
              "colonias-line",
              "colonias-fill",
              "colonias-fill-active",
              "colonias-label",
              "secciones-line",
              "secciones-fill",
              "secciones-label",
              "alcaldia-line",
              "alcaldia-fill",
            ]) {
              if (map.getLayer(id)) map.removeLayer(id);
            }
            for (const id of ["houses", "colonias", "secciones", "alcaldia"]) {
              if (map.getSource(id)) map.removeSource(id);
            }

            if (alcaldia?.features?.length) {
              map.addSource("alcaldia", { type: "geojson", data: alcaldia });
              map.addLayer({
                id: "alcaldia-fill",
                type: "fill",
                source: "alcaldia",
                paint: { "fill-color": "#efefef", "fill-opacity": 0.15 },
              });
              map.addLayer({
                id: "alcaldia-line",
                type: "line",
                source: "alcaldia",
                paint: { "line-color": "#767676", "line-width": 2 },
              });
            }

            map.addSource("colonias", { type: "geojson", data: colonias });
            map.addLayer({
              id: "colonias-fill",
              type: "fill",
              source: "colonias",
              paint: { "fill-color": "#128C7E", "fill-opacity": 0.12 },
            });
            map.addLayer({
              id: "colonias-fill-active",
              type: "fill",
              source: "colonias",
              filter: ["==", ["get", "name"], "__none__"],
              paint: { "fill-color": "#128C7E", "fill-opacity": 0.32 },
            });
            map.addLayer({
              id: "colonias-line",
              type: "line",
              source: "colonias",
              paint: { "line-color": "#075E54", "line-width": 1.1, "line-opacity": 0.85 },
            });
            map.addLayer({
              id: "colonias-label",
              type: "symbol",
              source: "colonias",
              minzoom: 12.5,
              layout: {
                "text-field": ["to-string", ["get", "name"]],
                "text-size": 11,
                "text-max-width": 10,
              },
              paint: {
                "text-color": "#075E54",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.2,
              },
            });

            const coarse =
              typeof window !== "undefined" &&
              window.matchMedia("(pointer: coarse)").matches;

            if (!coarse) {
              map.on("mousemove", "colonias-fill", (event: {
                features?: Array<{ properties?: Record<string, unknown> }>;
                point: { x: number; y: number };
              }) => {
                const colonia = String(event.features?.[0]?.properties?.name ?? "");
                if (!colonia) return;
                map.getCanvas().style.cursor = "pointer";
                placeTooltipRef.current(event.point.x, event.point.y, colonia);
              });
              map.on("mouseleave", "colonias-fill", () => {
                map.getCanvas().style.cursor = "";
                hideTooltip();
              });
            }

            map.on("click", "colonias-fill", (event: {
              features?: Array<{ properties?: Record<string, unknown> }>;
            }) => {
              const colonia = String(event.features?.[0]?.properties?.name ?? "");
              if (!colonia) return;
              setColoniaKey(normalizeColoniaKey(colonia));
              hideTooltip();
            });

            const narrow = typeof window !== "undefined" && window.innerWidth < 640;
            const bounds = boundsFromCollection(colonias);
            if (bounds) {
              map.fitBounds(bounds, {
                padding: narrow
                  ? { top: 24, bottom: 96, left: 24, right: 24 }
                  : 40,
                duration: 0,
                maxZoom: 13,
              });
            }

            setLoading(false);
            setMapVersion((n) => n + 1);
            if (usedProvider === "mapbox") setError(null);
          },
        });
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Error al cargar el mapa");
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      controller.abort();
      dispose?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.setFilter) return;
    const feature = activeColoniaKey
      ? coloniasGeoRef.current?.features.find(
          (item) => normalizeColoniaKey(featureName(item)) === activeColoniaKey
        )
      : undefined;
    map.setFilter("colonias-fill-active", [
      "==",
      ["get", "name"],
      featureName(feature) || "__none__",
    ]);
  }, [activeColoniaKey, mapVersion]);

  useEffect(() => {
    if (!coloniaKey) return;
    const map = mapRef.current;
    const geo = coloniasGeoRef.current;
    if (!map || !geo) return;
    const feature = geo.features.find(
      (item) => normalizeColoniaKey(featureName(item)) === coloniaKey
    );
    const bounds = boundsFromGeometry(feature?.geometry);
    if (!bounds) return;
    map.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: 450 });
  }, [coloniaKey, mapVersion]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map?.project) return;

    let raf = 0;
    const sync = () => {
      const width = overlayRef.current?.clientWidth ?? containerRef.current?.clientWidth ?? 0;
      const height = overlayRef.current?.clientHeight ?? containerRef.current?.clientHeight ?? 0;
      for (const feature of filtered.features) {
        const el = balloonElsRef.current.get(feature.properties.id);
        if (!el) continue;
        const point = map.project(feature.geometry.coordinates);
        const off =
          point.x < -48 ||
          point.y < -48 ||
          point.x > width + 48 ||
          point.y > height + 48;
        if (off) {
          el.style.visibility = "hidden";
          el.style.pointerEvents = "none";
          continue;
        }
        el.style.visibility = "visible";
        el.style.pointerEvents = "auto";
        el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -100%)`;
      }
    };

    const onMove = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        sync();
      });
    };

    sync();
    map.on("move", onMove);
    map.on("resize", onMove);
    return () => {
      window.cancelAnimationFrame(raf);
      map.off("move", onMove);
      map.off("resize", onMove);
    };
  }, [filtered, mapVersion]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="-mx-1 flex flex-wrap items-center gap-2 px-1 pb-1 text-sm">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`shrink-0 rounded-lg px-3 py-2.5 min-h-11 ${filter === "all" ? "bg-[var(--ink)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
            >
              Todas ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilter("authorized")}
              className={`shrink-0 rounded-lg px-3 py-2.5 min-h-11 ${filter === "authorized" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-800"}`}
            >
              Autorizadas ({stats.authorized})
            </button>
            <button
              type="button"
              onClick={() => setFilter("complete")}
              className={`shrink-0 rounded-lg px-3 py-2.5 min-h-11 ${filter === "complete" ? "bg-[var(--wa-teal)] text-white" : "bg-[var(--wa-light)] text-[var(--wa-dark)]"}`}
            >
              Completas ({stats.complete})
            </button>
            <button
              type="button"
              onClick={() => setFilter("incomplete")}
              className={`shrink-0 rounded-lg px-3 py-2.5 min-h-11 ${filter === "incomplete" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-800"}`}
            >
              Pendientes ({stats.incomplete})
            </button>
            <label className="flex min-w-[min(100%,18rem)] flex-1 items-center gap-2 sm:max-w-sm">
              <span className="shrink-0 text-sm font-medium text-[var(--ink)]">Colonia</span>
              <select
                className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]"
                value={coloniaKey ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setColoniaKey(value || null);
                }}
              >
                <option value="">Todas las colonias</option>
                {coloniaOptions.map((colonia) => (
                  <option key={colonia} value={normalizeColoniaKey(colonia)}>
                    {colonia}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)] sm:gap-4">
            {activeColoniaLabel && (
              <span className="text-sm text-[var(--ink)]">
                N.º 1…{stats.total} de <span className="font-semibold">{activeColoniaLabel}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Autorizada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--wa-green)]" /> Completo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Pendiente
            </span>
            {provider && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5">
                {provider === "mapbox" ? "Mapbox" : "Mapa alterno"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div
          ref={containerRef}
          className="h-[min(62dvh,640px)] w-full min-h-[300px] sm:h-[min(70vh,640px)] sm:min-h-[360px]"
        />

        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
        >
          {mapVersion > 0 &&
            filtered.features.map((feature) => {
            const selected = feature.properties.id === selectedHouseId;
            const consecutivo = houseConsecutivo(feature);
            return (
              <button
                key={feature.properties.id}
                ref={(node) => {
                  if (node) balloonElsRef.current.set(feature.properties.id, node);
                  else balloonElsRef.current.delete(feature.properties.id);
                }}
                type="button"
                className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center will-change-transform"
                style={{ zIndex: selected ? 6 : 5 }}
                title={
                  showConsecutivoNumbers
                    ? `N.º ${consecutivo} · ${feature.properties.colonia}`
                    : feature.properties.colonia
                }
                onClick={() => {
                  hideTooltip();
                  setSelectedHouseId(feature.properties.id);
                }}
                aria-label={
                  showConsecutivoNumbers
                    ? `Consecutivo ${consecutivo} de ${feature.properties.colonia}`
                    : `Casa en ${feature.properties.colonia}`
                }
              >
                <span
                  className={`inline-flex items-center justify-center rounded-full border-2 border-white font-extrabold leading-none text-white shadow-md ${
                    showConsecutivoNumbers
                      ? "min-h-7 min-w-7 px-1.5 text-[11px] sm:min-h-8 sm:min-w-8 sm:text-xs"
                      : "h-3 w-3 sm:h-3.5 sm:w-3.5"
                  } ${selected ? "ring-2 ring-[var(--ink)] ring-offset-1" : ""}`}
                  style={{
                    backgroundColor: feature.properties.color,
                    zIndex: selected ? 6 : 5,
                  }}
                >
                  {showConsecutivoNumbers ? consecutivo : null}
                </span>
                <span
                  className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent"
                  style={{ borderTopColor: feature.properties.color }}
                />
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-[var(--muted)]">
            Cargando mapa…
          </div>
        )}

        {error && (
          <div className="absolute inset-x-0 top-0 z-10 m-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}

        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 hidden max-w-[calc(100%-1.5rem)] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm shadow-md"
        >
          <p ref={tooltipLabelRef} className="font-semibold text-[var(--ink)]" />
        </div>

        {selectedHouse && (
          <div className="absolute bottom-3 left-3 right-3 z-20 max-h-[42%] max-w-sm overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white p-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-h-none">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-lg font-bold text-white"
                style={{ backgroundColor: selectedHouse.properties.color }}
              >
                {houseConsecutivo(selectedHouse)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--wa-teal)]">
                  N.º {houseConsecutivo(selectedHouse)} de {selectedHouse.properties.colonia}
                </p>
                <p className="text-xs text-[var(--muted)]">{selectedHouse.properties.folio}</p>
                <p className="break-words font-semibold text-[var(--ink)]">
                  {selectedHouse.properties.address}
                </p>
              </div>
            </div>
            {selectedHouse.properties.autorizado && (
              <p className="mt-1 text-xs font-medium text-blue-700">Autorizada</p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/casas/${selectedHouse.properties.id}`}
                className="btn-primary w-full text-center sm:w-auto"
              >
                Ver expediente
              </Link>
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                onClick={() => setSelectedHouseId(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
