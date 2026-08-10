import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role;
    const path = req.nextUrl.pathname;

    if (token?.error === "AccessDenied") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/api/users") && role !== "ADMIN") {
      return NextResponse.json({ error: "Se requiere rol administrador" }, { status: 403 });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token) && token.error !== "AccessDenied",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/casas/:path*",
    "/mapa/:path*",
    "/admin/:path*",
    // APIs de casas/mapa se autentican en el route handler (requireSession),
    // así las subidas multipart no se truncanan por el proxy (límite 10MB).
    "/api/users/:path*",
  ],
};
