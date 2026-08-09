import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

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
      authorized: ({ token }) => Boolean(token),
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
