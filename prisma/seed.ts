import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pintura.local" },
    update: { password, role: "ADMIN", active: true },
    create: {
      name: "Administrador",
      email: "admin@pintura.local",
      password,
      role: "ADMIN",
    },
  });

  const userPassword = await bcrypt.hash("usuario123", 10);
  const user = await prisma.user.upsert({
    where: { email: "usuario@pintura.local" },
    update: { password: userPassword, role: "USER", active: true },
    create: {
      name: "Capturista Demo",
      email: "usuario@pintura.local",
      password: userPassword,
      role: "USER",
    },
  });

  const authPassword = await bcrypt.hash("autoriza123", 10);
  await prisma.user.upsert({
    where: { email: "autorizacion@pintura.local" },
    update: { password: authPassword, role: "AUTORIZACION", active: true },
    create: {
      name: "Autorizador Demo",
      email: "autorizacion@pintura.local",
      password: authPassword,
      role: "AUTORIZACION",
    },
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

  console.log("Seed listo:");
  console.log("  Admin:         admin@pintura.local / admin123");
  console.log("  Autorización:  autorizacion@pintura.local / autoriza123");
  console.log("  Usuario:       usuario@pintura.local / usuario123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
