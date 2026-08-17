import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminUsersClient } from "@/components/admin-users-client";

export default async function AdminUsuariosPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      passwordPlain: true,
      role: true,
      active: true,
      approved: true,
      createdAt: true,
      _count: { select: { houses: true } },
    },
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
  });

  const pendingCount = users.filter((u) => !u.approved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title text-2xl sm:text-3xl">Usuarios</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Solo Admin. Autoriza registros nuevos antes de que puedan operar y levantar casas.
          {pendingCount > 0
            ? ` Hay ${pendingCount} solicitud${pendingCount === 1 ? "" : "es"} pendiente${pendingCount === 1 ? "" : "s"}.`
            : ""}
        </p>
      </div>
      <AdminUsersClient initialUsers={users} currentUserId={session.user.id} />
    </div>
  );
}
