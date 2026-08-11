import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { houseSchema } from "@/lib/validations";
import { getHouseStatus } from "@/lib/house-status";
import { yupErrorDetails } from "@/lib/yup-error";
import { canAccessHouse } from "@/lib/house-access";
import { sanitizeCdmxAddress } from "@/lib/mapbox-geocode";

type Params = { params: Promise<{ id: string }> };

async function getAuthorizedHouse(id: string, userId: string, role: string) {
  const house = await prisma.house.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { slot: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
      autorizadoBy: { select: { id: true, name: true } },
    },
  });

  if (!house) return { house: null, forbidden: false };
  if (!canAccessHouse({ role, userId, createdById: house.createdById })) {
    return { house: null, forbidden: true };
  }
  return { house, forbidden: false };
}

export async function GET(_request: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const { house, forbidden } = await getAuthorizedHouse(
    id,
    session!.user.id,
    session!.user.role
  );

  if (forbidden) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  if (!house) {
    return NextResponse.json({ error: "Casa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ house: { ...house, status: getHouseStatus(house) } });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const { house, forbidden } = await getAuthorizedHouse(
    id,
    session!.user.id,
    session!.user.role
  );

  if (forbidden) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  if (!house) {
    return NextResponse.json({ error: "Casa no encontrada" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = await houseSchema.validate(body, { abortEarly: false });

    const updated = await prisma.house.update({
      where: { id },
      data: {
        address: sanitizeCdmxAddress(data.address),
        colonia: data.colonia,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes?.trim() || null,
        expedienteCompleto: data.expedienteCompleto,
      },
      include: {
        photos: { orderBy: { slot: "asc" } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      house: { ...updated, status: getHouseStatus(updated) },
    });
  } catch (err) {
    const details = yupErrorDetails(err);
    if (details) {
      return NextResponse.json({ error: "Datos inválidos", details }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const { house, forbidden } = await getAuthorizedHouse(
    id,
    session!.user.id,
    session!.user.role
  );

  if (forbidden) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  if (!house) {
    return NextResponse.json({ error: "Casa no encontrada" }, { status: 404 });
  }

  await prisma.house.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
