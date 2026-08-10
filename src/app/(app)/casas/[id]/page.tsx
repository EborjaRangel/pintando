import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAuthorizationBlockers,
  getHouseStatus,
  isReadyForAuthorization,
} from "@/lib/house-status";
import { StatusBadge } from "@/components/status-badge";
import { HouseUploads } from "@/components/house-uploads";
import { HouseForm } from "@/components/house-form";
import { getColorsFromNotes, PALETA_COLORES, serializeColors } from "@/lib/paleta-colores";
import { formatFolio } from "@/lib/folio";
import { canAccessHouse } from "@/lib/house-access";
import { canAuthorizeHouses, canRevokeAuthorization } from "@/lib/roles";
import { AuthorizeHouseButton } from "@/components/authorize-house-button";

type Props = { params: Promise<{ id: string }> };

export default async function CasaDetallePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  const house = await prisma.house.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { slot: "asc" } },
      createdBy: { select: { name: true, email: true } },
      autorizadoBy: { select: { name: true } },
    },
  });

  if (!house) notFound();

  if (
    !canAccessHouse({
      role: session!.user.role,
      userId: session!.user.id,
      createdById: house.createdById,
    })
  ) {
    redirect("/casas");
  }

  const status = getHouseStatus(house);
  const colors = getColorsFromNotes(house.notes);
  const role = session!.user.role;
  const canAuthorize = canAuthorizeHouses(role);
  const canRevoke = canRevokeAuthorization(role);
  const showAuthControl = canAuthorize || (canRevoke && house.autorizado);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Link
            href="/casas"
            className="inline-flex min-h-11 items-center text-sm text-[var(--muted)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-[var(--wa-teal)]">
            Folio {formatFolio(house.folio)}
          </p>
          <h1 className="section-title break-words text-2xl sm:text-3xl">{house.address}</h1>
          <p className="break-words text-sm text-[var(--muted)] sm:text-base">
            {house.colonia} · {house.latitude.toFixed(5)}, {house.longitude.toFixed(5)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {house.autorizado ? (
              <span className="rounded-full bg-[var(--wa-light)] px-2.5 py-1 text-xs font-medium text-[var(--wa-dark)]">
                Autorizada
                {house.autorizadoBy?.name ? ` · ${house.autorizadoBy.name}` : ""}
              </span>
            ) : (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">
                Pendiente de autorización
              </span>
            )}
            {colors.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)]">
                <span className="flex -space-x-1">
                  {colors.map((c) => (
                    <span
                      key={c.id}
                      className="h-3.5 w-3.5 rounded-full border border-white"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </span>
                {colors.map((c) => c.name).join(" · ")}
              </span>
            )}
          </div>
        </div>
        <div className="w-full shrink-0 space-y-2 text-sm text-[var(--muted)] sm:w-auto sm:text-right">
          <p className="break-words">Capturista: {house.createdBy.name}</p>
          {showAuthControl && (
            <div className="sm:flex sm:justify-end">
              <AuthorizeHouseButton
                houseId={house.id}
                autorizado={house.autorizado}
                ready={isReadyForAuthorization(house)}
                blockers={getAuthorizationBlockers(house)}
                canAuthorize={canAuthorize}
                canRevoke={canRevoke}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CheckCard
          ok={house.photos.length >= 3 && [1, 2, 3].every((s) => house.photos.some((p) => p.slot === s))}
          label="3 fotografías"
          detail={`${house.photos.length}/3`}
        />
        <CheckCard ok={Boolean(house.comprobanteUrl)} label="Comprobante" detail={house.comprobanteUrl ? "Cargado" : "Falta"} />
        <CheckCard
          ok={house.expedienteCompleto}
          label="Expediente completo"
          detail={house.expedienteCompleto ? "Marcado" : "Sin marcar"}
        />
        <CheckCard
          ok={house.autorizado}
          label="Autorización"
          detail={house.autorizado ? "Autorizada" : "Pendiente"}
        />
      </div>

      <section className="panel">
        <HouseUploads
          houseId={house.id}
          photos={house.photos}
          comprobanteUrl={house.comprobanteUrl}
        />
      </section>

      <section className="panel space-y-4">
        <h2 className="section-title">Editar datos</h2>
        <HouseForm
          mode="edit"
          houseId={house.id}
          folio={house.folio}
          initialValues={{
            address: house.address,
            colonia: house.colonia,
            latitude: house.latitude,
            longitude: house.longitude,
            notes:
              colors.length > 0
                ? serializeColors(colors.map((c) => c.name))
                : PALETA_COLORES[0].name,
            expedienteCompleto: house.expedienteCompleto,
          }}
        />
      </section>
    </div>
  );
}

function CheckCard({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        ok
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-orange-200 bg-orange-50 text-orange-900"
      }`}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  );
}
