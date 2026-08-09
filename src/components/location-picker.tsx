"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CENTRO_COYOACAN, MAPBOX_TOKEN } from "@/lib/mapbox-config";
import { reverseGeocodeMapbox } from "@/lib/mapbox-geocode";
import { initBasemap, type AnyMap } from "@/lib/init-map";

type LocationChange = {
  latitude: number;
  longitude: number;
  address: string;
  colonia?: string;
};

type Props = {
  latitude: number;
  longitude: number;
  onChange: (value: LocationChange) => void;
};

type MarkerLike = {
  setLngLat: (lngLat: [number, number]) => unknown;
  remove: () => void;
  on: (event: string, cb: () => void) => void;
  getLngLat: () => { lng: number; lat: number };
};

export function LocationPicker({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AnyMap | null>(null);
  const markerRef = useRef<MarkerLike | null>(null);
  const onChangeRef = useRef(onChange);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [provider, setProvider] = useState<"mapbox" | "maplibre" | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const actualizarPin = useCallback(async (lng: number, lat: number, moverMapa = true) => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const result = await reverseGeocodeMapbox(lng, lat);
      onChangeRef.current({
        latitude: lat,
        longitude: lng,
        address: result.address,
        colonia: result.colonia,
      });
      markerRef.current?.setLngLat([lng, lat]);
      if (moverMapa) {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16 });
      }
    } catch (err) {
      onChangeRef.current({
        latitude: lat,
        longitude: lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
      markerRef.current?.setLngLat([lng, lat]);
      setGeoError(err instanceof Error ? err.message : "Error al obtener la dirección");
    } finally {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;

    (async () => {
      if (!containerRef.current) return;
      const startLng = longitude || CENTRO_COYOACAN.lng;
      const startLat = latitude || CENTRO_COYOACAN.lat;

      dispose = await initBasemap({
        container: containerRef.current,
        center: [startLng, startLat],
        zoom: 14,
        onError: (msg) => {
          if (!cancelled) setMapError(`Mapbox: ${msg}. Usando mapa alterno.`);
        },
        onReady: async (map, usedProvider) => {
          if (cancelled) return;
          mapRef.current = map;
          setProvider(usedProvider);
          if (usedProvider === "mapbox") setMapError(null);

          markerRef.current?.remove();
          markerRef.current = null;

          if (usedProvider === "mapbox") {
            const mapboxgl = (await import("mapbox-gl")).default;
            const marker = new mapboxgl.Marker({ color: "#25D366", draggable: true })
              .setLngLat([startLng, startLat])
              .addTo(map as unknown as import("mapbox-gl").Map);
            marker.on("dragend", () => {
              const pos = marker.getLngLat();
              void actualizarPin(pos.lng, pos.lat, false);
            });
            markerRef.current = marker as unknown as MarkerLike;
          } else {
            const maplibregl = await import("maplibre-gl");
            const marker = new maplibregl.Marker({ color: "#25D366", draggable: true })
              .setLngLat([startLng, startLat])
              .addTo(map as unknown as import("maplibre-gl").Map);
            marker.on("dragend", () => {
              const pos = marker.getLngLat();
              void actualizarPin(pos.lng, pos.lat, false);
            });
            markerRef.current = marker as unknown as MarkerLike;
          }

          try {
            const res = await fetch("/data/coyoacan-colonias.geojson");
            if (res.ok && !cancelled && !map.getSource("colonias")) {
              const colonias = await res.json();
              map.addSource("colonias", { type: "geojson", data: colonias });
              map.addLayer({
                id: "colonias-fill",
                type: "fill",
                source: "colonias",
                paint: { "fill-color": "#128C7E", "fill-opacity": 0.08 },
              });
              map.addLayer({
                id: "colonias-line",
                type: "line",
                source: "colonias",
                paint: { "line-color": "#075E54", "line-width": 1, "line-opacity": 0.6 },
              });
            }
          } catch {
            // pin funciona sin colonias
          }

          map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
            void actualizarPin(e.lngLat.lng, e.lngLat.lat, false);
          });
        },
      });
    })();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      dispose?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualizarPin]);

  useEffect(() => {
    if (!markerRef.current || geoLoading) return;
    markerRef.current.setLngLat([
      longitude || CENTRO_COYOACAN.lng,
      latitude || CENTRO_COYOACAN.lat,
    ]);
  }, [latitude, longitude, geoLoading]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void actualizarPin(pos.coords.longitude, pos.coords.latitude, true);
      },
      () => {
        setGeoLoading(false);
        setGeoError("No se pudo obtener tu ubicación. Activa el GPS o marca en el mapa.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [actualizarPin]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoLoading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {geoLoading ? "Buscando dirección…" : "Usar mi ubicación"}
        </button>
        <p className="text-xs text-[var(--muted)] sm:flex-1">
          Toca el mapa o arrastra el pin
          {MAPBOX_TOKEN ? ": se rellena la dirección con Mapbox." : "."}
          {provider ? ` (${provider === "mapbox" ? "Mapbox" : "mapa alterno"})` : ""}
        </p>
      </div>
      {geoLoading && (
        <p className="text-sm text-[var(--accent-ink)]">Obteniendo dirección del pin seleccionado…</p>
      )}
      {geoError && <p className="text-sm text-orange-700">{geoError}</p>}
      {mapError && <p className="text-sm text-amber-800">{mapError}</p>}
      <div className="relative h-[min(50dvh,20rem)] min-h-[16rem] overflow-hidden rounded-lg border border-[var(--line)] sm:h-80">
        <div ref={containerRef} className="h-full w-full bg-[var(--surface-2)]" />
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[var(--muted)]">Latitud</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={latitude}
            onChange={(e) =>
              onChange({
                latitude: Number(e.target.value),
                longitude,
                address: "",
              })
            }
            className="field"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[var(--muted)]">Longitud</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={longitude}
            onChange={(e) =>
              onChange({
                latitude,
                longitude: Number(e.target.value),
                address: "",
              })
            }
            className="field"
          />
        </label>
      </div>
    </div>
  );
}
