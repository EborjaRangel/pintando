import type { Prisma } from "@prisma/client";
import type { AppRole } from "@/lib/roles";
import { canSeeAllHouses } from "@/lib/roles";

/**
 * Listado principal:
 * - Autorización / Admin: todas las casas
 * - Usuario: solo las autorizadas que él levantó
 */
export function housesWhereForRole(
  role: AppRole | string,
  userId: string
): Prisma.HouseWhereInput {
  if (canSeeAllHouses(role)) return {};
  return { createdById: userId, autorizado: true };
}

/** Listado de autorizados (misma regla que el usuario en el listado principal). */
export function autorizadosWhereForRole(
  role: AppRole | string,
  userId: string
): Prisma.HouseWhereInput {
  if (canSeeAllHouses(role)) return { autorizado: true };
  return { autorizado: true, createdById: userId };
}

/** Detalle / fotos: el capturista puede abrir las que él creó aunque aún no estén autorizadas. */
export function canAccessHouse(opts: {
  role: AppRole | string;
  userId: string;
  createdById: string;
}): boolean {
  if (canSeeAllHouses(opts.role)) return true;
  return opts.createdById === opts.userId;
}
