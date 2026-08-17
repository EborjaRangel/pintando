"use client";

import Link from "next/link";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bindAuthLocalState, prepareFreshLogin } from "@/lib/auth-client";
import { registerSchema } from "@/lib/validations";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wa-dark)] shadow-lg">
          <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--wa-green)]">
            P
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--wa-dark)] sm:text-4xl">
          Pintando
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Solicita acceso; un administrador debe autorizarte antes de operar
        </p>
      </div>

      <div className="panel">
        <Formik
          initialValues={{ name: "", email: "", password: "", confirmPassword: "" }}
          validationSchema={registerSchema}
          onSubmit={async (values, { setSubmitting }) => {
            setError(null);
            try {
              const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error || "No se pudo registrar");
                return;
              }

              // Solo el primer usuario (admin bootstrap) entra de inmediato.
              if (data.user?.approved) {
                await prepareFreshLogin();
                const login = await signIn("credentials", {
                  email: values.email,
                  password: values.password,
                  redirect: false,
                });
                if (login?.error) {
                  router.push("/login");
                } else {
                  const session = await getSession();
                  if (session?.user?.id && session.user.role) {
                    bindAuthLocalState({
                      id: session.user.id,
                      role: session.user.role,
                      email: session.user.email,
                    });
                  }
                  window.location.assign("/dashboard");
                }
                return;
              }

              router.push(
                "/login?registered=1&msg=" +
                  encodeURIComponent(
                    "Registro realizado. Pendiente de autorización del administrador."
                  )
              );
            } catch {
              setError("No se pudo registrar");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <label className="block space-y-1">
                <span className="label">Nombre</span>
                <Field name="name" className="field" />
                <ErrorMessage name="name" component="p" className="error" />
              </label>
              <label className="block space-y-1">
                <span className="label">Correo</span>
                <Field name="email" type="email" className="field" />
                <ErrorMessage name="email" component="p" className="error" />
              </label>
              <label className="block space-y-1">
                <span className="label">Contraseña</span>
                <Field name="password" type="password" className="field" />
                <ErrorMessage name="password" component="p" className="error" />
              </label>
              <label className="block space-y-1">
                <span className="label">Confirmar contraseña</span>
                <Field name="confirmPassword" type="password" className="field" />
                <ErrorMessage name="confirmPassword" component="p" className="error" />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? "Enviando..." : "Solicitar acceso"}
              </button>
            </Form>
          )}
        </Formik>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-[var(--wa-teal)] underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
