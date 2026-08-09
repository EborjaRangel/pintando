import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { saveUpload } from "@/lib/uploads";
import { getHouseStatus } from "@/lib/house-status";
import { canAccessHouse } from "@/lib/house-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const house = await prisma.house.findUnique({
    where: { id },
    include: { photos: true },
  });

  if (!house) {
    return NextResponse.json({ error: "Casa no encontrada" }, { status: 404 });
  }

  if (
    !canAccessHouse({
      role: session!.user.role,
      userId: session!.user.id,
      createdById: house.createdById,
    })
  ) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo leer el archivo. Usa JPG/PNG/WEBP o PDF de máximo 8 MB (sin caracteres raros en el nombre).",
        },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const slotRaw = formData.get("slot");
    const slot = Number(slotRaw);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (![1, 2, 3].includes(slot)) {
      return NextResponse.json({ error: "El slot debe ser 1, 2 o 3" }, { status: 400 });
    }

    const url = await saveUpload(file, "photos");

    await prisma.photo.upsert({
      where: { houseId_slot: { houseId: id, slot } },
      create: { houseId: id, slot, url },
      update: { url },
    });

    const updated = await prisma.house.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { slot: "asc" } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      house: { ...updated!, status: getHouseStatus(updated!) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al subir foto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
