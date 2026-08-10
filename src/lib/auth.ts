import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/roles";

const isProd = process.env.NODE_ENV === "production";
/** Revalidar rol/activo desde BD (evita permisos viejos en el JWT). */
const ROLE_REVALIDATE_MS = 30_000;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  // Cookie propia del proyecto: no se mezcla con otras apps NextAuth en el mismo dominio
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-pintando.session-token" : "pintando.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.active) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
        token.lastValidated = Date.now();
        delete token.error;
        return token;
      }

      if (!token.id) return token;

      const lastValidated = typeof token.lastValidated === "number" ? token.lastValidated : 0;
      if (Date.now() - lastValidated < ROLE_REVALIDATE_MS && token.role && !token.error) {
        return token;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { role: true, active: true, name: true, email: true },
        });

        if (!dbUser || !dbUser.active) {
          return { ...token, error: "AccessDenied", role: undefined };
        }

        token.role = dbUser.role;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.lastValidated = Date.now();
        delete token.error;
      } catch {
        // Si la BD falla un momento, no tumbar la sesión por un error transitorio
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error === "AccessDenied") {
        session.error = "AccessDenied";
        return session;
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppRole;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },
};
