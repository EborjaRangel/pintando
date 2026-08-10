const isProd = process.env.NODE_ENV === "production";

/** Nombre de cookie de sesión compartido entre NextAuth y middleware. */
export const SESSION_COOKIE_NAME = isProd
  ? "__Secure-pintando.session-token"
  : "pintando.session-token";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: isProd,
};
