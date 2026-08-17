import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { yupErrorDetails } from "@/lib/yup-error";

/** Distingue cuenta pendiente vs credenciales inválidas (sin crear sesión). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await loginSchema.validate(body, { abortEarly: false });

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      select: { password: true, active: true, approved: true },
    });

    if (!user) {
      return NextResponse.json({ status: "invalid" as const });
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      return NextResponse.json({ status: "invalid" as const });
    }

    if (!user.active) {
      return NextResponse.json({ status: "inactive" as const });
    }

    if (!user.approved) {
      return NextResponse.json({ status: "pending" as const });
    }

    return NextResponse.json({ status: "ok" as const });
  } catch (error) {
    const details = yupErrorDetails(error);
    if (details) {
      return NextResponse.json({ error: "Datos inválidos", details }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo verificar" }, { status: 500 });
  }
}
