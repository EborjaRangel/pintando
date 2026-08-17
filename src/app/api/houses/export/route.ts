import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
import { buildHousesExcel } from "@/lib/export-houses-excel";
import { buildHousesHtml } from "@/lib/export-houses-html";
import {
  canExportAllExcel,
  canExportAuthorizedExcel,
  canExportTrackingExcel,
  type ExcelExportScope,
} from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Conversión de fotos a PNG + Excel puede tardar con todos los registros. */
export const maxDuration = 120;

export async function GET(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const role = session!.user.role;
  const userId = session!.user.id;
  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get("scope") as ExcelExportScope | null;
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : null;

  let scope: ExcelExportScope;
  if (scopeParam === "tracking" || scopeParam === "authorized" || scopeParam === "all") {
    scope = scopeParam;
  } else if (canExportAllExcel(role)) {
    scope = "all";
  } else if (canExportTrackingExcel(role)) {
    scope = "tracking";
  } else if (canExportAuthorizedExcel(role)) {
    scope = "authorized";
  } else {
    return NextResponse.json(
      { error: "No tienes permiso para exportar a Excel" },
      { status: 403 }
    );
  }

  if (scope === "authorized" && !canExportAuthorizedExcel(role)) {
    return NextResponse.json(
      { error: "Solo el rol Autorización puede exportar casas autorizadas" },
      { status: 403 }
    );
  }

  if (scope === "tracking" && !canExportTrackingExcel(role)) {
    return NextResponse.json(
      { error: "Solo el capturista puede exportar su Excel de seguimiento" },
      { status: 403 }
    );
  }

  if (scope === "all" && !canExportAllExcel(role)) {
    return NextResponse.json(
      { error: "Solo el administrador puede exportar todas las casas" },
      { status: 403 }
    );
  }

  // Admin: todas. Autorización: solo autorizadas. Usuario: las que él levantó.
  const idFilter = ids?.length ? { id: { in: ids } } : {};
  const where: Prisma.HouseWhereInput =
    scope === "authorized"
      ? { autorizado: true, ...idFilter }
      : scope === "all"
        ? { ...idFilter }
        : { createdById: userId, ...idFilter };

  const houses = await prisma.house.findMany({
    where,
    include: {
      photos: { orderBy: { slot: "asc" }, select: { slot: true, url: true } },
      createdBy: { select: { name: true, email: true } },
      autorizadoBy: { select: { name: true, email: true } },
    },
    orderBy: { folio: "asc" },
  });

  if (houses.length === 0) {
    return NextResponse.json(
      {
        error:
          scope === "authorized"
            ? "No hay casas autorizadas para exportar"
            : scope === "all"
              ? "No hay casas para exportar"
              : "No tienes casas para exportar",
      },
      { status: 404 }
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const format = searchParams.get("format") === "html" ? "html" : "xlsx";

  // HTML: fotos visibles en iPhone/Safari. Excel: útil en PC/tableta.
  if (format === "html") {
    const html = await buildHousesHtml(houses);
    const filename =
      scope === "authorized"
        ? `pintando-autorizados-${stamp}.html`
        : scope === "all"
          ? `pintando-casas-${stamp}.html`
          : `pintando-seguimiento-${stamp}.html`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buffer = await buildHousesExcel(houses);
  const filename =
    scope === "authorized"
      ? `pintando-autorizados-${stamp}.xlsx`
      : scope === "all"
        ? `pintando-casas-${stamp}.xlsx`
        : `pintando-seguimiento-${stamp}.xlsx`;

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
