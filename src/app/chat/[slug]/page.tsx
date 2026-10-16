import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiConfig } from "@/server/ai";
import { getCharacterSummary, listCharacters } from "@/server/characters/catalog";
import { ChatWindow } from "./ChatWindow";

export function generateStaticParams() {
  return listCharacters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/chat/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const character = getCharacterSummary(slug);
  return { title: character ? `Chat con ${character.name}` : "Personaje no encontrado" };
}

export default async function ChatPage({ params }: PageProps<"/chat/[slug]">) {
  const { slug } = await params;
  const character = getCharacterSummary(slug);
  if (!character) notFound();

  return <ChatWindow character={character} demoMode={getAiConfig().provider === "mock"} />;
}
