import "server-only";

import { createSessionClient } from "@/lib/supabase/server";
import type { StoredMessage } from "./store";

/** Mensajes que se muestran al abrir un chat. */
export const HISTORY_PAGE_SIZE = 50;

/**
 * Id de la conversación del usuario con un personaje. Se busca por el slug del
 * personaje directamente en la base de datos (sin depender de datos en caché)
 * y con la sesión del usuario, así que RLS garantiza que solo ve la suya.
 */
async function findConversationId(userId: string, characterSlug: string): Promise<string | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, characters!inner(slug)")
    .eq("user_id", userId)
    .eq("characters.slug", characterSlug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la conversación: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

/** Últimos mensajes de la conversación del usuario con un personaje. */
export async function getConversationHistory(
  userId: string,
  characterSlug: string,
): Promise<StoredMessage[]> {
  const conversationId = await findConversationId(userId, characterSlug);
  if (!conversationId) return [];

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(HISTORY_PAGE_SIZE);
  if (error) throw new Error(`No se pudieron leer los mensajes: ${error.message}`);
  return ((data ?? []) as StoredMessage[]).reverse();
}

/** Borra la conversación del usuario con un personaje (y sus mensajes). */
export async function deleteConversation(userId: string, characterSlug: string): Promise<void> {
  const conversationId = await findConversationId(userId, characterSlug);
  if (!conversationId) return;

  const supabase = await createSessionClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw new Error(`No se pudo borrar la conversación: ${error.message}`);
}
