import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { formatFolio } from "@/lib/folio";

/** Siguiente folio estimado (solo vista previa; el real lo asigna la BD al guardar). */
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const agg = await prisma.house.aggregate({ _max: { folio: true } });
  const next = (agg._max.folio ?? 0) + 1;

  return NextResponse.json({
    nextFolio: next,
    label: formatFolio(next),
  });
}
