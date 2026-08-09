import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { houseSchema } from "@/lib/validations";
import { getHouseStatus } from "@/lib/house-status";
import { yupErrorDetails } from "@/lib/yup-error";
import { housesWhereForRole } from "@/lib/house-access";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const where = housesWhereForRole(session!.user.role, session!.user.id);

  const houses = await prisma.house.findMany({
    where,
    include: {
      photos: { orderBy: { slot: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const payload = houses.map((house) => ({
    ...house,
    status: getHouseStatus(house),
  }));

  return NextResponse.json({ houses: payload });
}

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const body = await request.json();
    const data = await houseSchema.validate(body, { abortEarly: false });

    const house = await prisma.house.create({
      data: {
        address: data.address.trim(),
        colonia: data.colonia,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes?.trim() || null,
        expedienteCompleto: data.expedienteCompleto,
        createdById: session!.user.id,
      },
      include: {
        photos: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      { house: { ...house, status: getHouseStatus(house) } },
      { status: 201 }
    );
  } catch (err) {
    const details = yupErrorDetails(err);
    if (details) {
      return NextResponse.json({ error: "Datos inválidos", details }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear la casa" }, { status: 500 });
  }
}
