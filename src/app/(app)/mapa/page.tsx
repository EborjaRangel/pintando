import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseStatus, getMapMarkerColor } from "@/lib/house-status";
import { formatFolio } from "@/lib/folio";
import { CoyoacanMapLoader } from "@/components/coyoacan-map-loader";
import { housesWhereForRole } from "@/lib/house-access";

export default async function MapaPage() {
  const session = await getServerSession(authOptions);
  const where = housesWhereForRole(session!.user.role, session!.user.id);

  const houses = await prisma.house.findMany({
    where,
    include: {
      photos: { select: { slot: true } },
      createdBy: { select: { name: true } },
    },
  });

  const geojson = {
    type: "FeatureCollection" as const,
    features: houses.map((house) => {
      const status = getHouseStatus(house);
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [house.longitude, house.latitude] as [number, number],
        },
        properties: {
          id: house.id,
          folio: formatFolio(house.folio),
          address: house.address,
          colonia: house.colonia,
          status,
          autorizado: house.autorizado,
          color: getMapMarkerColor(house),
          expedienteCompleto: house.expedienteCompleto,
          hasComprobante: Boolean(house.comprobanteUrl),
          photosCount: house.photos.length,
          createdBy: house.createdBy.name,
        },
      };
    }),
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h1 className="section-title text-2xl sm:text-3xl">Mapa de Coyoacán</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Azul: autorizada. Verde: expediente completo. Naranja: pendiente.
        </p>
      </div>
      <CoyoacanMapLoader houses={geojson} />
    </div>
  );
}
