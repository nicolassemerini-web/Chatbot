import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p className="text-muted">Lo que buscas no existe o ya no está disponible.</p>
        <Link
          href="/personajes"
          className="flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground"
        >
          Ver personajes
        </Link>
      </main>
    </>
  );
}
