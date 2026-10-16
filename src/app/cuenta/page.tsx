import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser, getProfile } from "@/server/auth/session";
import { signOut } from "./acciones";

export const metadata: Metadata = { title: "Cuenta" };

const UPCOMING = [
  {
    title: "Memoria de los personajes",
    text: "Consulta lo que cada personaje recuerda de ti y borra lo que no quieras que recuerde.",
    phase: "Fase 5",
  },
  {
    title: "Exportar mis datos",
    text: "Descarga tus conversaciones, recuerdos y datos de perfil en un archivo.",
    phase: "Fase 6",
  },
  {
    title: "Eliminar mi cuenta",
    text: "Borra de forma definitiva tu cuenta y todos tus datos.",
    phase: "Fase 6",
  },
];

async function AccountDetails() {
  await connection();
  if (!isSupabaseConfigured()) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        La base de datos todavía no está configurada. Sigue los pasos del README.
      </p>
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">No has iniciado sesión.</p>
        <Link
          href="/entrar?next=/cuenta"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground"
        >
          Entrar
        </Link>
      </div>
    );
  }
  const profile = await getProfile(user.id);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Nombre</dt>
        <dd>{profile?.displayName ?? "—"}</dd>
        <dt className="text-muted">Correo</dt>
        <dd className="break-all">{user.email ?? "—"}</dd>
        <dt className="text-muted">Plan</dt>
        <dd>{profile?.plan === "free" ? "Gratuito" : (profile?.plan ?? "—")}</dd>
      </dl>
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:border-accent"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Cuenta</h1>
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
          <AccountDetails />
        </Suspense>

        <h2 className="mt-8 text-sm font-semibold text-muted">Próximamente</h2>
        <ul className="mt-3 space-y-3">
          {UPCOMING.map((s) => (
            <li key={s.title} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{s.title}</h3>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  {s.phase}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
