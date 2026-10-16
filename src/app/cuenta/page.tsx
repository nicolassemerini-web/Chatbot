import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Cuenta" };

const SECTIONS = [
  {
    title: "Perfil",
    text: "Nombre visible, confirmación de mayoría de edad y aceptación de los términos.",
    phase: "Fase 2",
  },
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

export default function AccountPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Cuenta</h1>
        <p className="mt-1 text-sm text-muted">
          El inicio de sesión llega en la Fase 2. Estas secciones todavía no están activas.
        </p>

        <ul className="mt-6 space-y-3">
          {SECTIONS.map((s) => (
            <li key={s.title} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{s.title}</h2>
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
