import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getSiteContent, toLines } from "@/server/content/content";

export default async function Home() {
  const content = await getSiteContent();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-12">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{content["home.title"]}</h1>
          <p className="text-lg text-muted">{content["home.subtitle"]}</p>
        </div>

        <Link
          href="/personajes"
          className="flex min-h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground sm:self-start"
        >
          {content["home.cta"]}
        </Link>

        <ul className="space-y-2 text-sm text-muted">
          {toLines(content["home.points"]).map((point) => (
            <li key={point}>• {point}</li>
          ))}
        </ul>
      </main>
      <footer className="mx-auto flex w-full max-w-2xl gap-4 px-4 py-6 text-xs text-muted">
        <Link href="/legal/terminos" className="hover:underline">
          Términos de uso
        </Link>
        <Link href="/legal/privacidad" className="hover:underline">
          Privacidad
        </Link>
      </footer>
    </>
  );
}
