import { HouseForm } from "@/components/house-form";

export default function NuevaCasaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="section-title text-2xl sm:text-3xl">Nueva casa</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          El folio se asigna solo al guardar. Captura ubicación, colores, fotos y comprobante.
        </p>
      </div>
      <div className="panel">
        <HouseForm mode="create" />
      </div>
    </div>
  );
}
