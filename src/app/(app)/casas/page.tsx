import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseStatus } from "@/lib/house-status";
import { getColorsFromNotes } from "@/lib/paleta-colores";
import { CasasTable } from "@/components/casas-table";
import { ExportExcelButton } from "@/components/export-excel-button";
import { housesWhereForRole } from "@/lib/house-access";
import {
  canAuthorizeHouses,
  canRevokeAuthorization,
  canExportExcel,
  canSeeAllHouses,
  roleLabel,
} from "@/lib/roles";

export default async function CasasPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const where = housesWhereForRole(role, session!.user.id);

  const houses = await prisma.house.findMany({
    where,
    include: {
      photos: { select: { slot: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { folio: "desc" },
  });

  const rows = houses.map((house) => {
    const colors = getColorsFromNotes(house.notes);
    return {
      id: house.id,
      folio: house.folio,
      address: house.address,
      colonia: house.colonia,
      colorName: colors.length
        ? colors.map((c) => c.name).join(" · ")
        : house.notes,
      colorHexes: colors.map((c) => c.hex),
      photosCount: house.photos.length,
      photoSlots: house.photos.map((p) => p.slot),
      hasComprobante: Boolean(house.comprobanteUrl),
      expedienteCompleto: house.expedienteCompleto,
      status: getHouseStatus(house),
      autorizado: house.autorizado,
      capturista: house.createdBy.name,
    };
  });

  const showAll = canSeeAllHouses(role);
  const canExport = canExportExcel(role);
  const canAuthorize = canAuthorizeHouses(role);
  const canRevoke = canRevokeAuthorization(role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title text-2xl sm:text-3xl">Casas</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {showAll
              ? `Todos los registros · rol ${roleLabel(role)}. Solo se autoriza con 3 fotos, comprobante y expediente completo.`
              : "Solo ves las casas autorizadas que tú levantaste. Al crear una nueva puedes completar fotos en el expediente."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/casas/autorizados" className="btn-secondary w-full sm:w-auto">
            Ver autorizados
          </Link>
          {canExport && (
            <ExportExcelButton
              label="Excel autorizadas"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--wa-green)] px-4 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
            />
          )}
          <Link href="/casas/nueva" className="btn-primary w-full sm:w-auto">
            Nueva casa
          </Link>
        </div>
      </div>

      {houses.length === 0 ? (
        <div className="panel text-[var(--muted)]">
          Aún no hay casas registradas.{" "}
          <Link href="/casas/nueva" className="text-[var(--accent-ink)] underline">
            Crea la primera
          </Link>
          .
        </div>
      ) : (
        <CasasTable
          houses={rows}
          showCapturista={showAll}
          canAuthorize={canAuthorize}
          canRevoke={canRevoke}
          canExport={canExport}
        />
      )}
    </div>
  );
}
