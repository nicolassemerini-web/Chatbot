import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { CONTENT_DEFAULTS, CONTENT_KEYS, type ContentKey } from "./defaults";

/** Etiqueta de caché: el panel de administración la invalida al guardar. */
export const CONTENT_CACHE_TAG = "site-content";

export type SiteContent = Record<ContentKey, string>;

/** Combina los textos guardados con los valores por defecto. */
export function mergeContent(rows: { key: string; value: string }[]): SiteContent {
  const content: SiteContent = { ...CONTENT_DEFAULTS };
  for (const { key, value } of rows) {
    if ((CONTENT_KEYS as string[]).includes(key) && value.trim()) {
      content[key as ContentKey] = value;
    }
  }
  return content;
}

export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG);
  cacheLife("hours");

  if (!isSupabaseConfigured()) return { ...CONTENT_DEFAULTS };

  const { data, error } = await createPublicClient()
    .from("site_content")
    .select("key, value")
    .in("key", CONTENT_KEYS);

  // Un fallo al leer textos no debe tumbar la web: se usan los de por defecto.
  if (error) {
    console.error("[contenido] no se pudieron leer los textos:", error.message);
    return { ...CONTENT_DEFAULTS };
  }
  return mergeContent(data ?? []);
}

/** Divide un texto en párrafos (separados por una línea en blanco). */
export function toParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** Divide un texto en líneas no vacías (para listas). */
export function toLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
