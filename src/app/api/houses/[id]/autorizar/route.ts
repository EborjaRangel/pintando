import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { canAuthorizeHouses } from "@/lib/roles";
import {
  getAuthorizationBlockers,
  getHouseStatus,
  isReadyForAuthorization,
} from "@/lib/house-status";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!canAuthorizeHouses(session!.user.role)) {
    return NextResponse.json(
      { error: "Solo el rol Autorización puede autorizar casas" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    autorizado?: boolean;
  } | null;

  if (typeof body?.autorizado !== "boolean") {
    return NextResponse.json({ error: "Indica autorizado true/false" }, { status: 400 });
  }

  const house = await prisma.house.findUnique({
    where: { id },
    include: { photos: { select: { slot: true } } },
  });
  if (!house) {
    return NextResponse.json({ error: "Casa no encontrada" }, { status: 404 });
  }

  // Autorizar solo si el expediente está completo (fotos + comprobante + marcado).
  // Quitar autorización siempre está permitido.
  if (body.autorizado && !isReadyForAuthorization(house)) {
    const missing = getAuthorizationBlockers(house);
    return NextResponse.json(
      {
        error: `No se puede autorizar: falta ${missing.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.house.update({
    where: { id },
    data: body.autorizado
      ? {
          autorizado: true,
          autorizadoAt: new Date(),
          autorizadoById: session!.user.id,
        }
      : {
          autorizado: false,
          autorizadoAt: null,
          autorizadoById: null,
        },
    include: {
      photos: { orderBy: { slot: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
      autorizadoBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    house: { ...updated, status: getHouseStatus(updated) },
  });
}
