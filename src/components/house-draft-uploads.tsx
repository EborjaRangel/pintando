"use client";

import { useEffect, useMemo, useState } from "react";
import { compressImageFile } from "@/lib/compress-image";

export type DraftAttachments = {
  photos: [File | null, File | null, File | null];
  comprobante: File | null;
};

export const emptyDraftAttachments = (): DraftAttachments => ({
  photos: [null, null, null],
  comprobante: null,
});

const PHOTO_LABELS = ["Fachada", "Lateral", "Contexto"] as const;

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function PhotoSlot({
  slot,
  file,
  onPick,
}: {
  slot: number;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  const preview = useObjectUrl(file);
  const label = PHOTO_LABELS[slot - 1];
  const [compressing, setCompressing] = useState(false);

  async function handlePick(raw: File | null) {
    if (!raw) {
      onPick(null);
      return;
    }
    setCompressing(true);
    try {
      onPick(await compressImageFile(raw));
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <div className="relative aspect-[4/3] bg-[var(--surface-2)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Foto ${label}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-sm text-[var(--muted)]">
            <span>Foto {slot}</span>
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-center px-3 py-2.5 text-center text-sm font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]">
        {compressing ? "Optimizando…" : file ? "Cambiar foto" : "Tomar / subir foto"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={compressing}
          onChange={(e) => void handlePick(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center border-t border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
          onClick={() => onPick(null)}
        >
          Quitar
        </button>
      )}
    </div>
  );
}

export function HouseDraftUploads({
  value,
  onChange,
}: {
  value: DraftAttachments;
  onChange: (value: DraftAttachments) => void;
}) {
  const comprobantePreview = useObjectUrl(
    value.comprobante?.type.startsWith("image/") ? value.comprobante : null
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="section-title text-lg">Fotografías (3)</h2>
        <p className="text-sm text-[var(--muted)]">
          Sube fachada, lateral y contexto. Se optimizan solas (máx. ~1600px) para pesar menos.
          Puedes completarlas después si hace falta.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((slot) => (
            <PhotoSlot
              key={slot}
              slot={slot}
              file={value.photos[slot - 1]}
              onPick={(file) => {
                const photos = [...value.photos] as DraftAttachments["photos"];
                photos[slot - 1] = file;
                onChange({ ...value, photos });
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title text-lg">Comprobante de domicilio</h2>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          {value.comprobante ? (
            <div className="mb-3 space-y-2">
              {comprobantePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comprobantePreview}
                  alt="Vista previa del comprobante"
                  className="max-h-40 rounded-md border border-[var(--line)] object-contain"
                />
              ) : null}
              <p className="break-all text-sm text-[var(--ink)]">{value.comprobante.name}</p>
            </div>
          ) : (
            <p className="mb-3 text-sm text-[var(--muted)]">Aún no se ha seleccionado comprobante.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="btn-secondary inline-flex w-full cursor-pointer sm:w-auto">
              {value.comprobante ? "Cambiar comprobante" : "Subir comprobante"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const raw = e.target.files?.[0] ?? null;
                  if (!raw) {
                    onChange({ ...value, comprobante: null });
                    return;
                  }
                  if (raw.type.startsWith("image/")) {
                    void compressImageFile(raw).then((file) =>
                      onChange({ ...value, comprobante: file })
                    );
                    return;
                  }
                  onChange({ ...value, comprobante: raw });
                }}
              />
            </label>
            {value.comprobante && (
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                onClick={() => onChange({ ...value, comprobante: null })}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
