import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAiConfig } from "@/server/ai";
import { requireOnboardedUser } from "@/server/auth/session";
import { toSummary } from "@/server/characters/mapping";
import { getCharacterBySlug, getCharacterSummaryBySlug, listCharacters } from "@/server/characters/repository";
import { getConversationHistory } from "@/server/conversation/history";
import { ChatWindow } from "./ChatWindow";

export async function generateStaticParams() {
  return (await listCharacters()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/chat/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const character = await getCharacterSummaryBySlug(slug);
  return { title: character ? `Chat con ${character.name}` : "Personaje no encontrado" };
}

function ChatSkeleton() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <div className="h-[61px] border-b border-border" />
      <p className="flex-1 p-6 text-center text-sm text-muted">Cargando conversación…</p>
    </div>
  );
}

function NotConfigured() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">Chat no disponible</h1>
      <p className="text-sm text-muted">
        Para chatear hace falta configurar la base de datos (Supabase). Sigue los pasos del README.
      </p>
      <Link href="/personajes" className="underline">
        Volver a personajes
      </Link>
    </main>
  );
}

async function Chat({ params }: Pick<PageProps<"/chat/[slug]">, "params">) {
  // La página depende de la sesión: se renderiza siempre en cada petición.
  await connection();
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const { slug } = await params;
  const character = await getCharacterBySlug(slug);
  if (!character) notFound();

  const { user } = await requireOnboardedUser(`/chat/${slug}`);
  const history = await getConversationHistory(user.id, character.slug);

  return (
    <ChatWindow
      character={toSummary(character)}
      initialMessages={history}
      demoMode={getAiConfig().provider === "mock"}
    />
  );
}

export default function ChatPage({ params }: PageProps<"/chat/[slug]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Chat params={params} />
    </Suspense>
  );
}
