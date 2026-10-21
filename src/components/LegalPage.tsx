import { SiteHeader } from "@/components/SiteHeader";
import { toParagraphs } from "@/server/content/content";

export function LegalPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {toParagraphs(text).map((p, i) => (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed">
            {p}
          </p>
        ))}
      </main>
    </>
  );
}
