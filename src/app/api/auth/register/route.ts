import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { yupErrorDetails } from "@/lib/yup-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await registerSchema.validate(body, { abortEarly: false });

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json({ error: "El correo ya está registrado" }, { status: 409 });
    }

    const usersCount = await prisma.user.count();
    const hashed = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password: hashed,
        role: usersCount === 0 ? "ADMIN" : "USER",
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const details = yupErrorDetails(error);
    if (details) {
      return NextResponse.json({ error: "Datos inválidos", details }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
