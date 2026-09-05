import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { nextConsecutivoForColonia } from "@/lib/consecutivo";

/** Siguiente consecutivo estimado para una colonia (el real se asigna al guardar). */
export async function GET(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const colonia = new URL(request.url).searchParams.get("colonia")?.trim() ?? "";
  if (!colonia) {
    return NextResponse.json({ error: "Falta colonia" }, { status: 400 });
  }

  const next = await nextConsecutivoForColonia(prisma, colonia);

  return NextResponse.json({
    nextConsecutivo: next,
    label: String(next),
  });
}
