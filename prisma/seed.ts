import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Misma contraseña de producción para cuentas demo (Railway + Vercel comparten BD)
  const sharedPassword = "Pintando2026!";
  const password = await bcrypt.hash(sharedPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pintura.local" },
    update: {
      password,
      passwordPlain: sharedPassword,
      role: "ADMIN",
      active: true,
      approved: true,
    },
    create: {
      name: "Administrador",
      email: "admin@pintura.local",
      password,
      passwordPlain: sharedPassword,
      role: "ADMIN",
      approved: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "usuario@pintura.local" },
    update: {
      password,
      passwordPlain: sharedPassword,
      role: "USER",
      active: true,
      approved: true,
    },
    create: {
      name: "Capturista Demo",
      email: "usuario@pintura.local",
      password,
      passwordPlain: sharedPassword,
      role: "USER",
      approved: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "autorizacion@pintura.local" },
    update: {
      password,
      passwordPlain: sharedPassword,
      role: "AUTORIZACION",
      active: true,
      approved: true,
    },
    create: {
      name: "Autorizador Demo",
      email: "autorizacion@pintura.local",
      password,
      passwordPlain: sharedPassword,
      role: "AUTORIZACION",
      approved: true,
    },
  });

  // Resto de usuarios: dejar visible la contraseña actual de producción si está vacía
  await prisma.user.updateMany({
    where: { OR: [{ passwordPlain: null }, { passwordPlain: "" }] },
    data: { passwordPlain: sharedPassword },
  });

  const existingHouses = await prisma.house.count();
  if (existingHouses === 0) {
    await prisma.house.create({
      data: {
        address: "Calle Francisco Sosa 123",
        colonia: "Villa Coyoacán",
        latitude: 19.3492,
        longitude: -99.1648,
        comprobanteUrl: "/uploads/comprobantes/demo.svg",
        expedienteCompleto: true,
        notes: "Azul Francia",
        createdById: admin.id,
        photos: {
          create: [
            { slot: 1, url: "/uploads/photos/demo-1.svg" },
            { slot: 2, url: "/uploads/photos/demo-2.svg" },
            { slot: 3, url: "/uploads/photos/demo-3.svg" },
          ],
        },
      },
    });

    await prisma.house.create({
      data: {
        address: "Av. Universidad 450",
        colonia: "Copilco Universidad",
        latitude: 19.3345,
        longitude: -99.1855,
        comprobanteUrl: null,
        expedienteCompleto: false,
        notes: "Gris Francés",
        createdById: user.id,
        photos: {
          create: [{ slot: 1, url: "/uploads/photos/demo-pending.svg" }],
        },
      },
    });
  }

  console.log("Seed listo (contraseña compartida):");
  console.log(`  ${sharedPassword}`);
  console.log("  admin@pintura.local | usuario@pintura.local | autorizacion@pintura.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
