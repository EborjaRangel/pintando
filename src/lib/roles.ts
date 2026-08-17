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

/** Solo Admin y Autorización ven casas de todos los capturistas. */
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

/** Autorización: Excel solo de casas autorizadas. */
export function canExportAuthorizedExcel(role: AppRole | string): boolean {
  return role === "AUTORIZACION";
}

/** Usuario: Excel de seguimiento de todas sus casas (completas o no). */
export function canExportTrackingExcel(role: AppRole | string): boolean {
  return role === "USER";
}

/** Admin: Excel de todas las casas, sin filtrar por estatus. */
export function canExportAllExcel(role: AppRole | string): boolean {
  return role === "ADMIN";
}

/** Cualquier rol que pueda bajar Excel. */
export function canExportExcel(role: AppRole | string): boolean {
  return (
    canExportAuthorizedExcel(role) ||
    canExportTrackingExcel(role) ||
    canExportAllExcel(role)
  );
}

export type ExcelExportScope = "authorized" | "tracking" | "all";

export function excelScopeForRole(role: AppRole | string): ExcelExportScope | null {
  if (canExportAllExcel(role)) return "all";
  if (canExportAuthorizedExcel(role)) return "authorized";
  if (canExportTrackingExcel(role)) return "tracking";
  return null;
}

export function excelLabelForRole(role: AppRole | string): string {
  return canExportTrackingExcel(role) ? "Mi Excel" : "Excel";
}

export function isAdmin(role: AppRole | string): boolean {
  return role === "ADMIN";
}
