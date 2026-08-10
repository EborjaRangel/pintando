"use client";

import { useState } from "react";
import type { ExcelExportScope } from "@/lib/roles";

type Props = {
  ids?: string[];
  label?: string;
  className?: string;
  /** authorized = solo autorizadas; tracking = todas las del capturista */
  scope?: ExcelExportScope;
};

export function ExportExcelButton({
  ids,
  label = "Bajar a Excel",
  className,
  scope,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scope) params.set("scope", scope);
      if (ids?.length) params.set("ids", ids.join(","));
      const qs = params.toString();
      const res = await fetch(`/api/houses/export${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo generar el Excel");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] || "pintando-casas.xlsx";
      const file = new File([blob], filename, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // En celular, ofrecer compartir/guardar (el preview de Files a veces oculta fotos)
      const isCoarsePointer =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches;
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };
      if (
        isCoarsePointer &&
        typeof nav.share === "function" &&
        nav.canShare?.({ files: [file] })
      ) {
        await nav.share({
          files: [file],
          title: filename,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
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
        title={
          scope === "tracking"
            ? "Descarga tu listado de seguimiento (todas tus casas)"
            : "Descarga casas autorizadas con fotos en Excel"
        }
      >
        {loading ? "Generando…" : label}
      </button>
      {error && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 whitespace-normal rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 shadow sm:left-auto sm:right-0 sm:max-w-[18rem]">
          {error}
        </p>
      )}
    </div>
  );
}
