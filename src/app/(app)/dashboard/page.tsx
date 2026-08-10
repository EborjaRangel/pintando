import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseStatus } from "@/lib/house-status";
import { ExportExcelButton } from "@/components/export-excel-button";
import { housesWhereForRole } from "@/lib/house-access";
import {
  canExportExcel,
  excelLabelForRole,
  excelScopeForRole,
  isAdmin,
  roleLabel,
} from "@/lib/roles";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const where = housesWhereForRole(role, session!.user.id);

  const houses = await prisma.house.findMany({
    where,
    include: { photos: { select: { slot: true } } },
  });

  const complete = houses.filter((h) => getHouseStatus(h) === "complete").length;
  const incomplete = houses.length - complete;
  const autorizadas = houses.filter((h) => h.autorizado).length;
  const usersCount = isAdmin(role) ? await prisma.user.count() : null;
  const canExport = canExportExcel(role);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--wa-teal)]">
          Programa
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--wa-dark)] sm:text-4xl">
          Pintando Coyoacán
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Hola {session!.user.name} ({roleLabel(role)}). Registra casas con fotos, comprobante y
          geolocalización. El capturista solo ve y exporta lo que él levantó; Admin y Autorización
          ven las de todos.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Casas en tu vista" value={houses.length} />
        <Stat label="Autorizadas" value={autorizadas} tone="green" />
        <Stat label="Expediente completo" value={complete} />
        <Stat label="Expediente pendiente" value={incomplete} tone="orange" />
        {usersCount !== null && <Stat label="Usuarios" value={usersCount} />}
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/casas/nueva" className="btn-primary w-full sm:w-auto">
          Registrar casa
        </Link>
        <Link href="/casas/autorizados" className="btn-secondary w-full sm:w-auto">
          Ver autorizados
        </Link>
        <Link href="/mapa" className="btn-secondary w-full sm:w-auto">
          Ver mapa
        </Link>
        <Link href="/casas" className="btn-secondary w-full sm:w-auto">
          Listado de casas
        </Link>
        {canExport && (
          <ExportExcelButton
            scope={excelScopeForRole(role) ?? undefined}
            label={excelLabelForRole(role)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--wa-green)] px-4 py-2.5 text-sm font-semibold text-[var(--wa-darker)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
          />
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "orange";
}) {
  const color =
    tone === "green"
      ? "text-[var(--wa-teal)]"
      : tone === "orange"
        ? "text-orange-600"
        : "text-[var(--wa-dark)]";

  return (
    <div className="panel">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-2 font-[family-name:var(--font-display)] text-3xl ${color}`}>{value}</p>
    </div>
  );
}
