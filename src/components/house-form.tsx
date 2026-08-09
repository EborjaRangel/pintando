"use client";

import { Formik, Form, Field, ErrorMessage } from "formik";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COLONIAS_COYOACAN, COYOACAN_CENTER } from "@/lib/colonias";
import { PALETA_COLORES } from "@/lib/paleta-colores";
import { houseSchema } from "@/lib/validations";
import { formatFolio } from "@/lib/folio";
import { LocationPickerLoader as LocationPicker } from "@/components/location-picker-loader";
import { ColorPalettePicker } from "@/components/color-palette-picker";
import {
  emptyDraftAttachments,
  HouseDraftUploads,
  type DraftAttachments,
} from "@/components/house-draft-uploads";
import { postUpload } from "@/lib/upload-client";

export type HouseFormValues = {
  address: string;
  colonia: string;
  latitude: number;
  longitude: number;
  notes: string;
  expedienteCompleto: boolean;
};

type Props = {
  initialValues?: Partial<HouseFormValues>;
  houseId?: string;
  folio?: number;
  mode?: "create" | "edit";
};

const defaults: HouseFormValues = {
  address: "",
  colonia: COLONIAS_COYOACAN[0],
  latitude: COYOACAN_CENTER.latitude,
  longitude: COYOACAN_CENTER.longitude,
  notes: PALETA_COLORES[0].name,
  expedienteCompleto: false,
};

async function uploadAttachments(houseId: string, attachments: DraftAttachments) {
  for (let i = 0; i < 3; i++) {
    const file = attachments.photos[i];
    if (file) {
      await postUpload(`/api/houses/${houseId}/photos`, file, {
        slot: String(i + 1),
      });
    }
  }
  if (attachments.comprobante) {
    await postUpload(`/api/houses/${houseId}/comprobante`, attachments.comprobante);
  }
}

export function HouseForm({ initialValues, houseId, folio, mode = "create" }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<DraftAttachments>(emptyDraftAttachments);
  const [nextFolioLabel, setNextFolioLabel] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "create") return;
    let cancelled = false;
    void fetch("/api/houses/next-folio")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { label?: string } | null) => {
        if (!cancelled && data?.label) setNextFolioLabel(data.label);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <Formik
      initialValues={{ ...defaults, ...initialValues }}
      validationSchema={houseSchema}
      enableReinitialize
      onSubmit={async (values, { setSubmitting }) => {
        setServerError(null);
        setStatusText(mode === "create" ? "Creando casa…" : "Guardando…");
        try {
          const url = mode === "edit" && houseId ? `/api/houses/${houseId}` : "/api/houses";
          const method = mode === "edit" ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "No se pudo guardar");
          }

          if (mode === "create") {
            const id = data.house.id as string;
            const hasFiles =
              attachments.photos.some(Boolean) || Boolean(attachments.comprobante);
            if (hasFiles) {
              setStatusText("Subiendo fotos y comprobante…");
              await uploadAttachments(id, attachments);
            }
            router.push(`/casas/${id}`);
          } else {
            router.push(`/casas/${data.house.id}`);
          }
          router.refresh();
        } catch (err) {
          setServerError(err instanceof Error ? err.message : "Error al guardar");
          setStatusText(null);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ values, setFieldValue, isSubmitting }) => (
        <Form className="space-y-6">
          <div className="rounded-lg border border-[var(--wa-light)] bg-[var(--wa-light)]/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wa-teal)]">
              Folio
            </p>
            {mode === "edit" && folio != null ? (
              <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--wa-dark)]">
                {formatFolio(folio)}
              </p>
            ) : (
              <>
                <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--wa-dark)]">
                  {nextFolioLabel ?? "PC-······"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Se asigna automáticamente al guardar. Es único y no se puede repetir.
                </p>
              </>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="label">Ubicación en el mapa</legend>
            <p className="text-sm text-[var(--muted)]">
              Toca el mapa, arrastra el pin o usa tu ubicación: Mapbox rellena la dirección
              automáticamente.
            </p>
            <LocationPicker
              latitude={values.latitude}
              longitude={values.longitude}
              onChange={({ latitude, longitude, address, colonia }) => {
                setFieldValue("latitude", latitude);
                setFieldValue("longitude", longitude);
                if (address) {
                  setFieldValue("address", address);
                }
                if (colonia) {
                  setFieldValue("colonia", colonia);
                }
              }}
            />
            <ErrorMessage name="latitude" component="p" className="error" />
            <ErrorMessage name="longitude" component="p" className="error" />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Dirección</span>
              <Field
                name="address"
                className="field"
                placeholder="Se completa al seleccionar el pin en el mapa"
              />
              <ErrorMessage name="address" component="p" className="error" />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="label">Colonia</span>
              <Field as="select" name="colonia" className="field">
                {COLONIAS_COYOACAN.map((colonia) => (
                  <option key={colonia} value={colonia}>
                    {colonia}
                  </option>
                ))}
              </Field>
              <ErrorMessage name="colonia" component="p" className="error" />
            </label>
          </div>

          <div>
            <ColorPalettePicker
              value={values.notes}
              onChange={(colorName) => setFieldValue("notes", colorName)}
            />
            <ErrorMessage name="notes" component="p" className="error mt-2" />
          </div>

          {mode === "create" && (
            <HouseDraftUploads value={attachments} onChange={setAttachments} />
          )}

          <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <Field
              type="checkbox"
              name="expedienteCompleto"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium text-[var(--ink)]">Expediente completo</span>
              <span className="text-sm text-[var(--muted)]">
                Márcalo cuando el trámite administrativo ya esté cerrado. Junto con las 3 fotos y el
                comprobante, la casa aparecerá en verde en el mapa.
              </span>
            </span>
          </label>

          {statusText && isSubmitting && (
            <p className="text-sm text-[var(--wa-teal)]">{statusText}</p>
          )}
          {serverError && <p className="error">{serverError}</p>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
              {isSubmitting
                ? statusText || "Guardando..."
                : mode === "edit"
                  ? "Actualizar casa"
                  : "Registrar casa"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary w-full sm:w-auto"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
