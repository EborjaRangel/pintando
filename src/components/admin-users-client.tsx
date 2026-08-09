"use client";

import { Formik, Form, Field, ErrorMessage } from "formik";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { userAdminSchema } from "@/lib/validations";
import { roleLabel, type AppRole } from "@/lib/roles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  createdAt: Date | string;
  _count: { houses: number };
};

export function AdminUsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar");
      return;
    }
    router.refresh();
  }

  async function deleteUser(id: string) {
    if (!confirm("¿Eliminar este usuario y sus casas?")) return;
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo eliminar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="panel">
        <h2 className="mb-4 font-semibold">Crear usuario</h2>
        <Formik
          initialValues={{
            name: "",
            email: "",
            password: "",
            role: "USER" as AppRole,
          }}
          validationSchema={userAdminSchema}
          onSubmit={async (values, { setSubmitting, resetForm }) => {
            setError(null);
            const res = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error || "No se pudo crear");
            } else {
              resetForm();
              router.refresh();
            }
            setSubmitting(false);
          }}
        >
          {({ isSubmitting }) => (
            <Form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1">
                <span className="label">Nombre</span>
                <Field name="name" className="field" />
                <ErrorMessage name="name" component="p" className="error" />
              </label>
              <label className="space-y-1">
                <span className="label">Correo</span>
                <Field name="email" type="email" className="field" />
                <ErrorMessage name="email" component="p" className="error" />
              </label>
              <label className="space-y-1">
                <span className="label">Contraseña</span>
                <Field name="password" type="password" className="field" />
                <ErrorMessage name="password" component="p" className="error" />
              </label>
              <label className="space-y-1">
                <span className="label">Rol</span>
                <Field as="select" name="role" className="field">
                  <option value="USER">Usuario</option>
                  <option value="AUTORIZACION">Autorización</option>
                  <option value="ADMIN">Administrador</option>
                </Field>
              </label>
              <div className="flex items-end sm:col-span-2 xl:col-span-1">
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                  {isSubmitting ? "Creando..." : "Crear"}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="space-y-3 md:hidden">
        {initialUsers.map((user) => (
          <article
            key={user.id}
            className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
          >
            <p className="font-medium text-[var(--ink)]">{user.name}</p>
            <p className="break-all text-sm text-[var(--muted)]">{user.email}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {roleLabel(user.role)} · {user._count.houses} casa(s) ·{" "}
              {user.active ? "Activo" : "Inactivo"}
            </p>
            <div className="mt-3 grid gap-2">
              <label className="space-y-1">
                <span className="label">Rol</span>
                <select
                  className="field"
                  value={user.role}
                  disabled={user.id === currentUserId}
                  onChange={(e) =>
                    patchUser(user.id, { role: e.target.value as AppRole })
                  }
                >
                  <option value="USER">Usuario</option>
                  <option value="AUTORIZACION">Autorización</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              {user.role === "AUTORIZACION" && (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => patchUser(user.id, { role: "USER" })}
                  disabled={user.id === currentUserId}
                >
                  Quitar autorización
                </button>
              )}
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => patchUser(user.id, { active: !user.active })}
                disabled={user.id === currentUserId}
              >
                {user.active ? "Desactivar" : "Activar"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                onClick={() => deleteUser(user.id)}
                disabled={user.id === currentUserId || user.role === "ADMIN"}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--line)] bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Casas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((user) => (
              <tr key={user.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="field min-h-10 py-1.5 text-sm"
                    value={user.role}
                    disabled={user.id === currentUserId}
                    onChange={(e) =>
                      patchUser(user.id, { role: e.target.value as AppRole })
                    }
                  >
                    <option value="USER">Usuario</option>
                    <option value="AUTORIZACION">Autorización</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </td>
                <td className="px-4 py-3">{user._count.houses}</td>
                <td className="px-4 py-3">{user.active ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.role === "AUTORIZACION" && (
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                        onClick={() => patchUser(user.id, { role: "USER" })}
                        disabled={user.id === currentUserId}
                      >
                        Quitar autorización
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                      onClick={() => patchUser(user.id, { active: !user.active })}
                      disabled={user.id === currentUserId}
                    >
                      {user.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => deleteUser(user.id)}
                      disabled={user.id === currentUserId || user.role === "ADMIN"}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
