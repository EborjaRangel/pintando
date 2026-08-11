"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthorizeHouseButton({
  houseId,
  autorizado,
  ready = false,
  blockers = [],
  canAuthorize = true,
  canRevoke = false,
}: {
  houseId: string;
  autorizado: boolean;
  /** true si hay 3 fotos + comprobante + expediente completo */
  ready?: boolean;
  blockers?: string[];
  /** Rol Autorización: puede marcar como autorizada */
  canAuthorize?: boolean;
  /** Solo Admin: puede quitar la autorización */
  canRevoke?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTurnOn = !autorizado && canAuthorize && ready;
  const canTurnOff = autorizado && canRevoke;
  const interactive = canTurnOn || canTurnOff;
  const disabled = busy || !interactive;

  async function toggle() {
    if (!interactive) return;
    const next = !autorizado;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/houses/${houseId}/autorizar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autorizado: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <label
        className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
        title={
          autorizado && !canRevoke
            ? "Solo el administrador puede quitar la autorización"
            : !autorizado && !ready && blockers.length
              ? `Para autorizar se necesita: ${blockers.join(", ")}`
              : undefined
        }
      >
        <input
          type="checkbox"
          checked={autorizado}
          disabled={disabled}
          onChange={() => void toggle()}
          className="h-5 w-5 accent-[var(--wa-teal)]"
        />
        <span className="font-medium text-[var(--ink)]">
          {autorizado ? "Autorizada" : "Autorizar"}
        </span>
      </label>
      {!autorizado && canAuthorize && !ready && (
        <p className="max-w-[16rem] text-xs text-[var(--muted)]">
          Requiere: {blockers.length ? blockers.join(", ") : "expediente completo"}
        </p>
      )}
      {autorizado && !canRevoke && (
        <p className="max-w-[16rem] text-xs text-[var(--muted)]">
          Solo el administrador puede quitar la autorización
        </p>
      )}
      {error && <p className="error text-xs">{error}</p>}
    </div>
  );
}
