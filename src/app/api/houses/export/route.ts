import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { buildHousesExcel } from "@/lib/export-houses-excel";
import { canExportExcel } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!canExportExcel(session!.user.role)) {
    return NextResponse.json(
      { error: "Solo el rol Autorización puede exportar a Excel" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : null;

  const houses = await prisma.house.findMany({
    where: {
      autorizado: true,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    include: {
      photos: { orderBy: { slot: "asc" }, select: { slot: true, url: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { folio: "asc" },
  });

  if (houses.length === 0) {
    return NextResponse.json(
      { error: "No hay casas autorizadas para exportar" },
      { status: 404 }
    );
  }

  const buffer = await buildHousesExcel(houses);
  const filename = `pintando-autorizados-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
