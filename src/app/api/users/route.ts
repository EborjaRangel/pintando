import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { userAdminSchema } from "@/lib/validations";
import { yupErrorDetails } from "@/lib/yup-error";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      passwordPlain: true,
      role: true,
      active: true,
      approved: true,
      createdAt: true,
      _count: { select: { houses: true } },
    },
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const data = await userAdminSchema.validate(body, { abortEarly: false });

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json({ error: "El correo ya existe" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password: hashed,
        passwordPlain: data.password,
        role: data.role,
        approved: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordPlain: true,
        role: true,
        active: true,
        approved: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const details = yupErrorDetails(err);
    if (details) {
      return NextResponse.json({ error: "Datos inválidos", details }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 });
  }
}
