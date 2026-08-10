"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FeatureCollection } from "geojson";
import { CENTRO_COYOACAN, MAPBOX_TOKEN, mapboxConfigError } from "@/lib/mapbox-config";
import { initBasemap, type AnyMap } from "@/lib/init-map";

type HouseFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    folio: string;
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

type TooltipState = { x: number; y: number; colonia: string };

export function CoyoacanMap({ houses }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AnyMap | null>(null);
  const housesDataRef = useRef(houses);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"mapbox" | "maplibre" | null>(null);
  const [filter, setFilter] = useState<"all" | "authorized" | "complete" | "incomplete">("all");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return houses;
    if (filter === "authorized") {
      return {
        type: "FeatureCollection" as const,
        features: houses.features.filter((f) => f.properties.autorizado),
      };
    }
    return {
      type: "FeatureCollection" as const,
      features: houses.features.filter(
        (f) => !f.properties.autorizado && f.properties.status === filter
      ),
    };
  }, [filter, houses]);

  housesDataRef.current = filtered;

  const stats = useMemo(() => {
    const authorized = houses.features.filter((f) => f.properties.autorizado).length;
    const complete = houses.features.filter(
      (f) => !f.properties.autorizado && f.properties.status === "complete"
    ).length;
    const incomplete = houses.features.filter(
      (f) => !f.properties.autorizado && f.properties.status === "incomplete"
    ).length;
    return {
      authorized,
      complete,
      incomplete,
      total: houses.features.length,
    };
  }, [houses]);

  const selectedHouse =
    filtered.features.find((f) => f.properties.id === selectedHouseId) ?? null;

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
              "houses-circle",
              "colonias-line",
              "colonias-fill",
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

            map.addSource("houses", { type: "geojson", data: housesDataRef.current });
            map.addLayer({
              id: "houses-circle",
              type: "circle",
              source: "houses",
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  11,
                  10,
                  14,
                  14,
                ],
                "circle-color": ["get", "color"],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
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
                setTooltip({ x: event.point.x, y: event.point.y, colonia });
              });
              map.on("mouseleave", "colonias-fill", () => {
                map.getCanvas().style.cursor = "";
                setTooltip(null);
              });
            }

            map.on("click", "colonias-fill", (event: {
              features?: Array<{ properties?: Record<string, unknown> }>;
              point: { x: number; y: number };
            }) => {
              const colonia = String(event.features?.[0]?.properties?.name ?? "");
              if (!colonia) return;
              setTooltip({ x: event.point.x, y: event.point.y, colonia });
            });

            map.on("click", "houses-circle", (event: {
              features?: Array<{ properties?: Record<string, unknown> }>;
            }) => {
              const id = String(event.features?.[0]?.properties?.id ?? "");
              if (id) {
                setTooltip(null);
                setSelectedHouseId(id);
              }
            });
            map.on("mouseenter", "houses-circle", () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", "houses-circle", () => {
              map.getCanvas().style.cursor = "";
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
    if (!map) return;
    const source = map.getSource("houses") as { setData?: (data: unknown) => void } | undefined;
    source?.setData?.(filtered);
  }, [filtered]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)] sm:gap-4">
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

      <div className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div
          ref={containerRef}
          className="h-[min(62dvh,640px)] w-full min-h-[300px] sm:h-[min(70vh,640px)] sm:min-h-[360px]"
        />

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

        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 max-w-[calc(100%-1.5rem)] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm shadow-md"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 320) - 120),
              top: Math.max(8, tooltip.y - 40),
            }}
          >
            <p className="font-semibold text-[var(--ink)]">{tooltip.colonia}</p>
          </div>
        )}

        {selectedHouse && (
          <div className="absolute bottom-3 left-3 right-3 z-20 max-h-[42%] max-w-sm overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white p-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-h-none">
            <p className="text-xs font-semibold text-[var(--wa-teal)]">
              {selectedHouse.properties.folio}
            </p>
            <p className="break-words font-semibold text-[var(--ink)]">
              {selectedHouse.properties.address}
            </p>
            <p className="break-words text-xs text-[var(--muted)]">
              {selectedHouse.properties.colonia}
            </p>
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
