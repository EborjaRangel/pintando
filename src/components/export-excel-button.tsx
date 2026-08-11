"use client";

import { useEffect, useState } from "react";
import type { ExcelExportScope } from "@/lib/roles";

type Props = {
  ids?: string[];
  label?: string;
  className?: string;
  /** authorized = solo autorizadas; tracking = todas las del capturista */
  scope?: ExcelExportScope;
};

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function saveBlob(blob: Blob, filename: string, openInline: boolean) {
  const url = URL.createObjectURL(blob);

  if (openInline || isAppleTouchDevice()) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(url);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 180_000);
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ExportExcelButton({
  ids,
  label,
  className,
  scope,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    setApple(isAppleTouchDevice());
  }, []);

  // En iPhone siempre HTML con fotos (Excel no las muestra bien allí)
  const buttonLabel = apple
    ? "Ver listado con fotos"
    : label || "Bajar a Excel";

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scope) params.set("scope", scope);
      if (ids?.length) params.set("ids", ids.join(","));
      // iPhone/iPad: HTML con fotos visibles. PC/tableta Android: Excel.
      const format = isAppleTouchDevice() ? "html" : "xlsx";
      params.set("format", format);

      const qs = params.toString();
      const res = await fetch(`/api/houses/export?${qs}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo generar el archivo");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const fallback =
        format === "html" ? "pintando-casas.html" : "pintando-casas.xlsx";
      const filename = match?.[1] || fallback;

      saveBlob(blob, filename, format === "html");
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
        title={
          apple
            ? "Abre un listado con fotos visibles en el iPhone"
            : scope === "tracking"
              ? "Descarga tu listado de seguimiento (todas tus casas)"
              : "Descarga casas autorizadas con fotos en Excel"
        }
      >
        {loading ? "Generando…" : buttonLabel}
      </button>
      {error && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 whitespace-normal rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 shadow sm:left-auto sm:right-0 sm:max-w-[18rem]">
          {error}
        </p>
      )}
    </div>
  );
}
