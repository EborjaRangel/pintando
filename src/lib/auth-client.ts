/** Claves locales acotadas a este proyecto (evitan mezclar con otras apps). */
const PREFIX = "pintando.auth.";

export const AUTH_USER_ID_KEY = `${PREFIX}userId`;
export const AUTH_ROLE_KEY = `${PREFIX}role`;
export const AUTH_EMAIL_KEY = `${PREFIX}email`;
export const AUTH_EPOCH_KEY = `${PREFIX}epoch`;

export type AuthLocalSnapshot = {
  userId: string | null;
  role: string | null;
  email: string | null;
  epoch: string | null;
};

export function clearAuthLocalState(): void {
  if (typeof window === "undefined") return;

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);

  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

export function bindAuthLocalState(user: {
  id: string;
  role: string;
  email?: string | null;
}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_USER_ID_KEY, user.id);
  localStorage.setItem(AUTH_ROLE_KEY, user.role);
  if (user.email) localStorage.setItem(AUTH_EMAIL_KEY, user.email);
  else localStorage.removeItem(AUTH_EMAIL_KEY);
  // Cambia en cada login: otras pestañas detectan el cambio vía evento `storage`
  localStorage.setItem(AUTH_EPOCH_KEY, String(Date.now()));
}

export function readAuthLocalState(): AuthLocalSnapshot {
  if (typeof window === "undefined") {
    return { userId: null, role: null, email: null, epoch: null };
  }
  return {
    userId: localStorage.getItem(AUTH_USER_ID_KEY),
    role: localStorage.getItem(AUTH_ROLE_KEY),
    email: localStorage.getItem(AUTH_EMAIL_KEY),
    epoch: localStorage.getItem(AUTH_EPOCH_KEY),
  };
}

/**
 * Limpia estado local y cierra cualquier sesión previa en el navegador
 * antes de iniciar una nueva (evita permisos residuales).
 */
export async function prepareFreshLogin(): Promise<void> {
  clearAuthLocalState();
  try {
    const { signOut } = await import("next-auth/react");
    await signOut({ redirect: false });
  } catch {
    // sin sesión previa
  }
}
