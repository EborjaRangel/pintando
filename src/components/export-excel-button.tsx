"use client";

import { useState } from "react";

type Props = {
  ids?: string[];
  label?: string;
  className?: string;
};

export function ExportExcelButton({
  ids,
  label = "Bajar a Excel",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const params = ids?.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
      const res = await fetch(`/api/houses/export${params}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo generar el Excel");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.href = url;
      a.download = match?.[1] || "pintando-casas.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--wa-green)] px-4 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        }
        title="Descarga todos los registros con fotos en Excel"
      >
        {loading ? "Generando…" : label}
      </button>
      {error && (
        <p className="absolute right-0 top-full z-50 mt-1 max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 shadow">
          {error}
        </p>
      )}
    </div>
  );
}
