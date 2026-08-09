"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthorizeHouseButton({
  houseId,
  autorizado,
}: {
  houseId: string;
  autorizado: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/houses/${houseId}/autorizar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autorizado: !autorizado }),
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
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={autorizado}
          disabled={busy}
          onChange={() => void toggle()}
          className="h-5 w-5 accent-[var(--wa-teal)]"
        />
        <span className="font-medium text-[var(--ink)]">
          {autorizado ? "Autorizada" : "Autorizar"}
        </span>
      </label>
      {error && <p className="error text-xs">{error}</p>}
    </div>
  );
}
