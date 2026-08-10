import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { ROLES, type AppRole } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  if (id === session!.user.id && body.active === false) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 400 }
    );
  }

  if (id === session!.user.id && body.role && body.role !== "ADMIN") {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de administrador" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Nadie (ni siquiera vía este endpoint mal usado) deja a AUTORIZACION tocar ADMIN:
  // solo ADMIN llega aquí. Además, no se puede degradar al único admin de forma accidental
  // quitando ADMIN a otro admin sí está permitido solo al admin actual.
  if (target.role === "ADMIN" && body.role && body.role !== "ADMIN" && id === session!.user.id) {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de administrador" },
      { status: 400 }
    );
  }

  let passwordUpdate: { password: string; passwordPlain: string } | undefined;
  if (typeof body.password === "string" && body.password.trim().length >= 6) {
    const plain = body.password.trim();
    passwordUpdate = {
      password: await bcrypt.hash(plain, 10),
      passwordPlain: plain,
    };
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(isAppRole(body.role) ? { role: body.role } : {}),
      ...(passwordUpdate ?? {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      passwordPlain: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  if (id === session!.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    return NextResponse.json(
      { error: "No se puede eliminar un administrador desde aquí" },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
