import type { Metadata } from "next";
import Link from "next/link";
import { AiNotice } from "@/components/AiNotice";
import { Avatar } from "@/components/Avatar";
import { SiteHeader } from "@/components/SiteHeader";
import { listCharacters } from "@/server/characters/catalog";

export const metadata: Metadata = { title: "Personajes" };

export default function CharactersPage() {
  const characters = listCharacters();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Personajes</h1>
        <AiNotice className="mt-1" />

        <ul className="mt-6 space-y-3">
          {characters.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/chat/${c.slug}`}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent focus-visible:border-accent"
              >
                <Avatar name={c.name} accent={c.accent} />
                <div className="min-w-0 space-y-1">
                  <h2 className="font-semibold">
                    {c.name}
                    <span className="font-normal text-muted"> · {c.age}</span>
                  </h2>
                  <p className="text-sm font-medium">{c.tagline}</p>
                  <p className="text-sm text-muted">{c.shortBio}</p>
                  <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Intereses">
                    {c.interests.map((i) => (
                      <li
                        key={i}
                        className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                      >
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
