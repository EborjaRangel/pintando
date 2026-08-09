import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { getHouseStatus, getMapMarkerColor } from "@/lib/house-status";
import { housesWhereForRole } from "@/lib/house-access";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const houses = await prisma.house.findMany({
    where: housesWhereForRole(session!.user.role, session!.user.id),
    include: {
      photos: { select: { slot: true } },
      createdBy: { select: { name: true } },
    },
  });

  const features = houses.map((house) => {
    const status = getHouseStatus(house);
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [house.longitude, house.latitude],
      },
      properties: {
        id: house.id,
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
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  });
}
