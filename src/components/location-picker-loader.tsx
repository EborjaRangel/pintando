"use client";

import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("@/components/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(50dvh,20rem)] min-h-[16rem] items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-sm text-[var(--muted)] sm:h-80">
        Cargando mapa…
      </div>
    ),
  }
);

export function LocationPickerLoader(props: {
  latitude: number;
  longitude: number;
  onChange: (value: {
    latitude: number;
    longitude: number;
    address: string;
    colonia?: string;
  }) => void;
}) {
  return <LocationPicker {...props} />;
}
