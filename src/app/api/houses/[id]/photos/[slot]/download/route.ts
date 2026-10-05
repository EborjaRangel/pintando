import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; slot: string }> };

function filenameFor(slot: number, contentType: string, sourceUrl: string) {
  const fromUrl = path.extname(new URL(sourceUrl, "https://local.invalid").pathname).toLowerCase();
  const ext =
    fromUrl && fromUrl !== ".bin"
      ? fromUrl
      : contentType.includes("png")
        ? ".png"
        : contentType.includes("webp")
          ? ".webp"
          : ".jpg";
  return `foto-${slot}${ext}`;
}

async function readPhoto(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error("No se pudo leer la foto");
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "image/jpeg",
    };
  }

  const relative = url.replace(/^\//, "");
  const bytes = await readFile(path.join(process.cwd(), "public", relative));
  const ext = path.extname(url).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { bytes, contentType };
}

/** Solo Admin. Fuerza descarga para que el celular ofrezca guardar la foto. */
export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, slot: slotParam } = await params;
  const slot = Number(slotParam);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    return NextResponse.json({ error: "Foto no válida" }, { status: 400 });
  }

  const photo = await prisma.photo.findUnique({
    where: { houseId_slot: { houseId: id, slot } },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  try {
    const { bytes, contentType } = await readPhoto(photo.url);
    const filename = filenameFor(slot, contentType, photo.url);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo descargar la foto" }, { status: 500 });
  }
}
