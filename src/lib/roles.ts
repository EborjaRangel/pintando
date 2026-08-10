export type AppRole = "USER" | "AUTORIZACION" | "ADMIN";

export const ROLES: AppRole[] = ["USER", "AUTORIZACION", "ADMIN"];

export function roleLabel(role: AppRole | string): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "AUTORIZACION":
      return "Autorización";
    case "USER":
      return "Usuario";
    default:
      return role;
  }
}

/** Ve todos los registros (como admin operativo). */
export function canSeeAllHouses(role: AppRole | string): boolean {
  return role === "ADMIN" || role === "AUTORIZACION";
}

/** Solo Autorización puede marcar casas como autorizadas. */
export function canAuthorizeHouses(role: AppRole | string): boolean {
  return role === "AUTORIZACION";
}

/** Solo Admin puede quitar la autorización (después de autorizar / Excel). */
export function canRevokeAuthorization(role: AppRole | string): boolean {
  return role === "ADMIN";
}

/** Solo Autorización exporta a Excel (únicamente casas autorizadas). */
export function canExportExcel(role: AppRole | string): boolean {
  return role === "AUTORIZACION";
}

export function isAdmin(role: AppRole | string): boolean {
  return role === "ADMIN";
}
