import { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
    /** Presente si el usuario fue desactivado o el token ya no es válido */
    error?: "AccessDenied";
  }

  interface User {
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
    lastValidated?: number;
    error?: "AccessDenied";
  }
}
