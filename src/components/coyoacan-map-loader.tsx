"use client";

import dynamic from "next/dynamic";

const CoyoacanMap = dynamic(
  () => import("@/components/coyoacan-map").then((m) => m.CoyoacanMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(55dvh,640px)] min-h-[280px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm text-[var(--muted)] sm:h-[min(70vh,640px)] sm:min-h-[360px]">
        Cargando mapa…
      </div>
    ),
  }
);

export function CoyoacanMapLoader({
  houses,
}: {
  houses: {
    type: "FeatureCollection";
    features: Array<{
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
    }>;
  };
}) {
  return <CoyoacanMap houses={houses} />;
}
