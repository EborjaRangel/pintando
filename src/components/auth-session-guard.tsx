"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import {
  AUTH_EPOCH_KEY,
  AUTH_ROLE_KEY,
  AUTH_USER_ID_KEY,
  bindAuthLocalState,
  clearAuthLocalState,
  readAuthLocalState,
} from "@/lib/auth-client";

/**
 * Amarra la sesión JWT al localStorage por userId/rol.
 * Si otra pestaña inicia sesión con otro usuario (misma cookie del navegador),
 * esta pestaña se recarga para no seguir mostrando permisos viejos.
 */
export function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const lastBoundId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      clearAuthLocalState();
      lastBoundId.current = null;
      return;
    }

    const user = session?.user;
    if (!user?.id || !user.role) return;

    // Sesión invalidada en el servidor (usuario inactivo / token marcado)
    if (session?.error === "AccessDenied") {
      clearAuthLocalState();
      void signOut({ callbackUrl: "/login" });
      return;
    }

    const stored = readAuthLocalState();

    // Había otro usuario en localStorage → permisos no deben mezclarse
    if (stored.userId && stored.userId !== user.id) {
      bindAuthLocalState({
        id: user.id,
        role: user.role,
        email: user.email,
      });
      lastBoundId.current = user.id;
      window.location.replace("/dashboard");
      return;
    }

    // Mismo usuario pero rol distinto (cambio en BD o token refrescado)
    if (
      stored.userId === user.id &&
      stored.role &&
      stored.role !== user.role &&
      lastBoundId.current === user.id
    ) {
      bindAuthLocalState({
        id: user.id,
        role: user.role,
        email: user.email,
      });
      window.location.reload();
      return;
    }

    if (!stored.userId || stored.role !== user.role || stored.email !== (user.email ?? null)) {
      bindAuthLocalState({
        id: user.id,
        role: user.role,
        email: user.email,
      });
    }
    lastBoundId.current = user.id;
  }, [session, status]);

  // Otra pestaña cambió de usuario / hizo login fresco
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key !== AUTH_USER_ID_KEY &&
        event.key !== AUTH_ROLE_KEY &&
        event.key !== AUTH_EPOCH_KEY
      ) {
        return;
      }

      const stored = readAuthLocalState();
      const currentId = session?.user?.id;

      if (!stored.userId) {
        // Logout en otra pestaña
        if (currentId) {
          void signOut({ callbackUrl: "/login" });
        }
        return;
      }

      if (currentId && stored.userId !== currentId) {
        window.location.replace("/dashboard");
        return;
      }

      if (currentId && stored.role && stored.role !== session?.user?.role) {
        void update().then(() => window.location.reload());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [session?.user?.id, session?.user?.role, update]);

  // Clave de montaje: si cambia el usuario/rol, React tira el árbol y no reutiliza estado
  const sessionKey = session?.user
    ? `${session.user.id}:${session.user.role}`
    : status;

  return <div key={sessionKey}>{children}</div>;
}
