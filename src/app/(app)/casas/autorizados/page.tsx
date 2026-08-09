import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseStatus } from "@/lib/house-status";
import { getColorsFromNotes } from "@/lib/paleta-colores";
import { CasasTable } from "@/components/casas-table";
import { autorizadosWhereForRole } from "@/lib/house-access";
import { canAuthorizeHouses, canSeeAllHouses } from "@/lib/roles";

export default async function AutorizadosPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const where = autorizadosWhereForRole(role, session!.user.id);

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
      hasComprobante: Boolean(house.comprobanteUrl),
      status: getHouseStatus(house),
      autorizado: house.autorizado,
      capturista: house.createdBy.name,
    };
  });

  const showAll = canSeeAllHouses(role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title text-2xl sm:text-3xl">Autorizados</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {showAll
              ? "Casas autorizadas de todo el equipo. Solo estas salen en Excel."
              : "Solo las casas autorizadas que tú levantaste."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/casas" className="btn-secondary w-full sm:w-auto">
            Todas las casas
          </Link>
        </div>
      </div>

      {houses.length === 0 ? (
        <div className="panel text-[var(--muted)]">
          Todavía no hay casas autorizadas
          {showAll ? "." : " tuyas."}
        </div>
      ) : (
        <CasasTable
          houses={rows}
          showCapturista={showAll}
          canAuthorize={canAuthorizeHouses(role)}
        />
      )}
    </div>
  );
}
