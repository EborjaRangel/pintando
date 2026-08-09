import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { FREE_MAP_STYLE, MAPBOX_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox-config";

/** Interfaz mínima compartida para evitar conflictos de tipos Mapbox/MapLibre. */
export type AnyMap = {
  remove: () => void;
  getLayer: (id: string) => unknown;
  removeLayer: (id: string) => void;
  getSource: (id: string) => unknown;
  removeSource: (id: string) => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  on: (...args: unknown[]) => unknown;
  getCanvas: () => HTMLCanvasElement;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  flyTo: (options: unknown) => void;
  isStyleLoaded: () => boolean;
  once: (type: string, listener: (...args: unknown[]) => void) => unknown;
  addControl: (control: unknown, position?: string) => void;
};

export type RawMap = MapboxMap | MapLibreMap;

type InitOptions = {
  container: HTMLElement;
  center: [number, number];
  zoom: number;
  onReady: (map: AnyMap, provider: "mapbox" | "maplibre") => void;
  onError?: (message: string) => void;
};

/**
 * Intenta Mapbox (como control). Si falla la carga de estilo/tiles, usa MapLibre + OpenFreeMap.
 */
export async function initBasemap(options: InitOptions): Promise<() => void> {
  let disposed = false;
  let map: RawMap | null = null;
  let usedFallback = false;

  const cleanup = () => {
    disposed = true;
    if (map) {
      map.remove();
      map = null;
    }
  };

  async function startMaplibre() {
    if (disposed || usedFallback) return;
    usedFallback = true;

    if (map) {
      map.remove();
      map = null;
    }

    const maplibregl = await import("maplibre-gl");
    await import("maplibre-gl/dist/maplibre-gl.css");
    if (disposed) return;

    const libreMap = new maplibregl.Map({
      container: options.container,
      style: FREE_MAP_STYLE,
      center: options.center,
      zoom: options.zoom,
      attributionControl: {},
    });
    libreMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map = libreMap;

    const ready = () => {
      if (!disposed) options.onReady(libreMap as unknown as AnyMap, "maplibre");
    };
    if (libreMap.isStyleLoaded()) ready();
    else libreMap.once("load", ready);
  }

  async function startMapbox() {
    if (!MAPBOX_TOKEN) {
      await startMaplibre();
      return;
    }

    const mapboxgl = (await import("mapbox-gl")).default;
    await import("mapbox-gl/dist/mapbox-gl.css");
    if (disposed) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const boxMap = new mapboxgl.Map({
      container: options.container,
      style: MAPBOX_STYLE,
      center: options.center,
      zoom: options.zoom,
      attributionControl: true,
    });
    boxMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map = boxMap;

    let settled = false;

    const succeed = () => {
      if (disposed || settled) return;
      settled = true;
      options.onReady(boxMap as unknown as AnyMap, "mapbox");
    };

    const failToLibre = (reason: string) => {
      if (disposed || settled || usedFallback) return;
      settled = true;
      options.onError?.(reason);
      void startMaplibre();
    };

    boxMap.once("load", succeed);
    boxMap.once("error", (e) => {
      const msg =
        (e as { error?: { message?: string } }).error?.message ||
        "No se pudieron cargar los tiles de Mapbox";
      // Solo cae a respaldo si aún no cargó el estilo
      if (!boxMap.isStyleLoaded()) {
        failToLibre(msg);
      }
    });

    // Si Mapbox no responde en 6s, usa respaldo
    window.setTimeout(() => {
      if (!disposed && !settled && !boxMap.isStyleLoaded()) {
        failToLibre("Mapbox tardó demasiado; usando mapa alterno");
      }
    }, 6000);
  }

  try {
    await startMapbox();
  } catch (err) {
    options.onError?.(err instanceof Error ? err.message : "Error al iniciar mapa");
    await startMaplibre();
  }

  return cleanup;
}
