import type { Prisma } from "@prisma/client";
import type { AppRole } from "@/lib/roles";
import { canSeeAllHouses } from "@/lib/roles";

/**
 * Visibilidad de casas:
 * - ADMIN / AUTORIZACION → todas las casas de todos los capturistas
 * - USER → SOLO las que ese usuario levantó (createdById)
 */
export function housesWhereForRole(
  role: AppRole | string,
  userId: string
): Prisma.HouseWhereInput {
  if (canSeeAllHouses(role)) return {};
  // Capturista: nunca ve casas de otros usuarios
  return { createdById: userId };
}

/** Autorizados: Admin/Autorización ven todas; Usuario solo las suyas autorizadas. */
export function autorizadosWhereForRole(
  role: AppRole | string,
  userId: string
): Prisma.HouseWhereInput {
  if (canSeeAllHouses(role)) return { autorizado: true };
  return { autorizado: true, createdById: userId };
}

/** Detalle / fotos: el capturista solo abre las que él creó. */
export function canAccessHouse(opts: {
  role: AppRole | string;
  userId: string;
  createdById: string;
}): boolean {
  if (canSeeAllHouses(opts.role)) return true;
  return opts.createdById === opts.userId;
}
