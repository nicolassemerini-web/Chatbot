import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-12">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Conversaciones con personajes que te recuerdan
          </h1>
          <p className="text-lg text-muted">
            Charla con personajes ficticios con personalidad propia. Recuerdan lo que les
            cuentas y retoman los temas que dejasteis pendientes.
          </p>
        </div>

        <Link
          href="/personajes"
          className="flex min-h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground sm:self-start"
        >
          Conocer a los personajes
        </Link>

        <ul className="space-y-2 text-sm text-muted">
          <li>• Los personajes son ficticios y funcionan con inteligencia artificial.</li>
          <li>• Servicio exclusivo para mayores de 18 años.</li>
          <li>• Tus conversaciones son privadas y puedes borrarlas cuando quieras.</li>
        </ul>
      </main>
    </>
  );
}
