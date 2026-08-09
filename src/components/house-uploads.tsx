"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { postUpload } from "@/lib/upload-client";

type Photo = { id: string; url: string; slot: number };

type Props = {
  houseId: string;
  photos: Photo[];
  comprobanteUrl: string | null;
};

export function HouseUploads({ houseId, photos, comprobanteUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(slot: number, file: File | null) {
    if (!file) return;
    setBusy(`photo-${slot}`);
    setError(null);
    try {
      await postUpload(`/api/houses/${houseId}/photos`, file, { slot: String(slot) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setBusy(null);
    }
  }

  async function uploadComprobante(file: File | null) {
    if (!file) return;
    setBusy("comprobante");
    setError(null);
    try {
      await postUpload(`/api/houses/${houseId}/comprobante`, file);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="section-title">Fotografías (3 requeridas)</h2>
        <p className="text-sm text-[var(--muted)]">
          Sube una foto de fachada, una lateral y una de contexto. Formatos: JPG, PNG o WEBP.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((slot) => {
            const photo = photos.find((p) => p.slot === slot);
            return (
              <div
                key={slot}
                className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--surface-2)]">
                  {photo ? (
                    <Image
                      src={photo.url}
                      alt={`Foto ${slot}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                      Sin foto {slot}
                    </div>
                  )}
                </div>
                <label className="flex min-h-11 cursor-pointer items-center justify-center px-3 py-2.5 text-center text-sm font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]">
                  {busy === `photo-${slot}`
                    ? "Subiendo..."
                    : photo
                      ? "Reemplazar foto"
                      : "Tomar / subir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => uploadPhoto(slot, e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Comprobante de domicilio</h2>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          {comprobanteUrl ? (
            <p className="mb-3 text-sm">
              Archivo actual:{" "}
              <a
                href={comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--accent-ink)] underline"
              >
                Ver comprobante
              </a>
            </p>
          ) : (
            <p className="mb-3 text-sm text-[var(--muted)]">Aún no se ha subido comprobante.</p>
          )}
          <label className="btn-secondary inline-flex w-full cursor-pointer sm:w-auto">
            {busy === "comprobante" ? "Subiendo..." : "Subir comprobante"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => uploadComprobante(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
