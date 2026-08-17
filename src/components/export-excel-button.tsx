"use client";

import { useEffect, useState } from "react";
import type { ExcelExportScope } from "@/lib/roles";

type Props = {
  ids?: string[];
  label?: string;
  className?: string;
  /** authorized = solo autorizadas; tracking = las del capturista; all = todas (admin) */
  scope?: ExcelExportScope;
  /** Solo el botón Excel (sin “Ver listado con fotos”). */
  excelOnly?: boolean;
};

type ExportFormat = "html" | "xlsx";

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isPhoneOrTablet() {
  if (typeof window === "undefined") return false;
  if (isAppleTouchDevice()) return true;
  return window.matchMedia("(pointer: coarse)").matches;
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

const defaultExcelClass =
  "inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg bg-[var(--wa-green)] px-3 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const defaultHtmlClass =
  "inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

function excelTitle(scope?: ExcelExportScope) {
  if (scope === "tracking") return "Descarga tu listado de seguimiento en Excel";
  if (scope === "all") return "Descarga todas las casas en Excel (cualquier estatus)";
  return "Descarga casas autorizadas en Excel";
}

export function ExportExcelButton({
  ids,
  label,
  className,
  scope,
  excelOnly = false,
}: Props) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBoth, setShowBoth] = useState(false);

  useEffect(() => {
    setShowBoth(isPhoneOrTablet());
  }, []);

  const excelLabel = label || "Excel";
  const excelClass = className || defaultExcelClass;

  async function download(format: ExportFormat) {
    setLoading(format);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scope) params.set("scope", scope);
      if (ids?.length) params.set("ids", ids.join(","));
      params.set("format", format);

      const res = await fetch(`/api/houses/export?${params.toString()}`);
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
      setLoading(null);
    }
  }

  return (
    <div className="relative w-full lg:w-auto">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:contents">
        {showBoth && !excelOnly && (
          <button
            type="button"
            onClick={() => void download("html")}
            disabled={loading !== null}
            className={defaultHtmlClass}
            title="Abre un listado con las fotos visibles en el celular"
          >
            {loading === "html" ? "Generando…" : "Ver listado con fotos"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void download("xlsx")}
          disabled={loading !== null}
          className={excelClass}
          title={excelTitle(scope)}
        >
          {loading === "xlsx" ? "Generando…" : excelLabel}
        </button>
      </div>
      {error && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 whitespace-normal rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 shadow sm:left-auto sm:right-0 sm:max-w-[18rem]">
          {error}
        </p>
      )}
    </div>
  );
}
