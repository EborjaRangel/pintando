"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ExportExcelButton } from "@/components/export-excel-button";
import { clearAuthLocalState } from "@/lib/auth-client";
import {
  canExportExcel,
  excelLabelForRole,
  excelScopeForRole,
  isAdmin,
  roleLabel,
  type AppRole,
} from "@/lib/roles";

async function handleSignOut() {
  clearAuthLocalState();
  await signOut({ callbackUrl: "/login" });
}

const links = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/casas", label: "Casas" },
  { href: "/casas/autorizados", label: "Autorizados" },
  { href: "/casas/nueva", label: "Nueva casa" },
  { href: "/mapa", label: "Mapa" },
];

function linkActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/casas") return pathname === "/casas";
  if (href === "/casas/autorizados") return pathname.startsWith("/casas/autorizados");
  if (href === "/casas/nueva") return pathname === "/casas/nueva";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data?.user?.role ?? "USER") as AppRole;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navLinkClass = (active: boolean) =>
    `flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm transition ${
      active
        ? "bg-white/15 text-white"
        : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;

  const navItems = (
    <>
      {links.map((link) => {
        const active = linkActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={navLinkClass(active)}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </Link>
        );
      })}
      {isAdmin(role) && (
        <Link
          href="/admin/usuarios"
          className={navLinkClass(pathname.startsWith("/admin"))}
          onClick={() => setMenuOpen(false)}
        >
          Usuarios
        </Link>
      )}
      {canExportExcel(role) && (
        <ExportExcelButton
          scope={excelScopeForRole(role) ?? undefined}
          label={excelLabelForRole(role)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--wa-green)] px-3 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:opacity-60 lg:w-auto"
        />
      )}
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 bg-[var(--wa-dark)] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="min-w-0 truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:text-xl"
          >
            Pintando <span className="text-[var(--wa-green)]">Coyoacán</span>
          </Link>

          {/* Desktop amplio: menú horizontal. Tablet y móvil: hamburguesa. */}
          <nav className="hidden items-center gap-1 lg:flex">{navItems}</nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[12rem] truncate text-sm text-white/80 xl:inline">
              {data?.user?.name} · {roleLabel(role)}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="hidden min-h-11 items-center rounded-lg border border-white/25 px-3 py-2.5 text-sm text-white transition hover:bg-white/10 lg:inline-flex"
            >
              Salir
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/25 text-white transition hover:bg-white/10 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav"
            className="max-h-[min(70dvh,calc(100dvh-4.5rem))] overflow-y-auto overscroll-contain border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
          >
            <nav className="flex flex-col gap-1">{navItems}</nav>
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 truncate text-sm text-white/70">
                {data?.user?.name} · {roleLabel(role)}
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/25 px-3 py-2.5 text-sm text-white transition hover:bg-white/10"
              >
                Salir
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:py-8">
        {children}
      </main>
    </div>
  );
}
