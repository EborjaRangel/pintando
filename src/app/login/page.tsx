"use client";

import Link from "next/link";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { bindAuthLocalState, prepareFreshLogin } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validations";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wa-dark)] shadow-lg">
          <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--wa-green)]">
            P
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--wa-dark)] sm:text-4xl">
          Pintando
        </h1>
        <p className="mt-2 text-[var(--muted)]">Coyoacán · captura de expedientes</p>
      </div>

      <div className="panel">
        <h2 className="mb-4 text-lg font-semibold text-[var(--wa-dark)]">Iniciar sesión</h2>
        <Formik
          initialValues={{ email: "", password: "" }}
          validationSchema={loginSchema}
          onSubmit={async (values, { setSubmitting }) => {
            setError(null);
            try {
              // Cierra sesión previa y limpia localStorage para no mezclar permisos
              await prepareFreshLogin();
              const result = await signIn("credentials", {
                email: values.email,
                password: values.password,
                redirect: false,
              });
              if (result?.error) {
                setError("Correo o contraseña incorrectos");
                return;
              }
              const session = await getSession();
              if (session?.user?.id && session.user.role) {
                bindAuthLocalState({
                  id: session.user.id,
                  role: session.user.role,
                  email: session.user.email,
                });
              }
              // Navegación dura: tira estado React de la sesión anterior
              window.location.assign("/dashboard");
            } catch {
              setError("No se pudo iniciar sesión");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <label className="block space-y-1">
                <span className="label">Correo</span>
                <Field
                  name="email"
                  type="email"
                  className="field"
                  placeholder="admin@pintura.local"
                  autoComplete="username"
                />
                <ErrorMessage name="email" component="p" className="error" />
              </label>
              <label className="block space-y-1">
                <span className="label">Contraseña</span>
                <Field name="password" type="password" className="field" autoComplete="current-password" />
                <ErrorMessage name="password" component="p" className="error" />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </Form>
          )}
        </Formik>
        <div className="mt-4 rounded-lg bg-[var(--wa-panel)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          <p className="font-medium text-[var(--wa-dark)]">Cuentas demo (correo completo):</p>
          <p>admin@pintura.local · admin123</p>
          <p>usuario@pintura.local · usuario123</p>
          <p>autorizacion@pintura.local · autoriza123</p>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          ¿Sin cuenta?{" "}
          <Link href="/register" className="font-medium text-[var(--wa-teal)] underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
