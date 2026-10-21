import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { BUILTIN_CHARACTERS } from "./builtin";
import { CHARACTER_COLUMNS, mapCharacterRow, toSummary, type CharacterRow } from "./mapping";
import type { Character, CharacterSummary } from "./types";

/** Etiqueta de caché: el panel de administración la invalida al guardar cambios. */
export const CHARACTERS_CACHE_TAG = "characters";

async function loadActiveCharacters(): Promise<Character[]> {
  "use cache";
  cacheTag(CHARACTERS_CACHE_TAG);
  cacheLife("hours");

  if (!isSupabaseConfigured()) return BUILTIN_CHARACTERS;

  const { data, error } = await createPublicClient()
    .from("characters")
    .select(CHARACTER_COLUMNS)
    .eq("is_active", true)
    .order("sort_order")
    .order("name")
    .overrideTypes<CharacterRow[], { merge: false }>();

  if (error) throw new Error(`No se pudieron cargar los personajes: ${error.message}`);
  return (data ?? []).map(mapCharacterRow);
}

export async function listCharacters(): Promise<CharacterSummary[]> {
  return (await loadActiveCharacters()).map(toSummary);
}

/** Ficha completa (solo servidor). Devuelve null si no existe o no está publicado. */
export async function getCharacterBySlug(slug: string): Promise<Character | null> {
  return (await loadActiveCharacters()).find((c) => c.slug === slug) ?? null;
}

export async function getCharacterSummaryBySlug(slug: string): Promise<CharacterSummary | null> {
  const character = await getCharacterBySlug(slug);
  return character ? toSummary(character) : null;
}
