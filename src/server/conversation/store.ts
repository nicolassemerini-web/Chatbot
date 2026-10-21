import "server-only";

import { createAdminClient } from "@/server/db/admin";
import type { ChatRole } from "@/server/ai/types";

export type StoredMessage = { id: number; role: ChatRole; content: string };

/** Longitud máxima que admite la columna messages.content. */
export const MAX_STORED_CHARS = 8000;

/**
 * Escritura de conversaciones y mensajes. Lo hace el servidor con la clave
 * secreta (el navegador no tiene permiso), filtrando SIEMPRE por el usuario
 * verificado. Es una interfaz para poder probar el motor sin base de datos.
 */
export interface ConversationStore {
  /** Id actual del personaje publicado (se consulta siempre, sin caché). */
  resolveCharacterId(slug: string): Promise<string | null>;
  getOrCreateConversation(userId: string, characterId: string): Promise<string>;
  listRecentMessages(conversationId: string, userId: string, limit: number): Promise<StoredMessage[]>;
  appendMessage(conversationId: string, userId: string, role: ChatRole, content: string): Promise<void>;
}

export function createSupabaseConversationStore(): ConversationStore {
  const db = createAdminClient();

  async function findConversation(userId: string, characterId: string) {
    const { data, error } = await db
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer la conversación: ${error.message}`);
    return data?.id as string | undefined;
  }

  return {
    async resolveCharacterId(slug) {
      const { data, error } = await db
        .from("characters")
        .select("id")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el personaje: ${error.message}`);
      return (data?.id as string | undefined) ?? null;
    },

    async getOrCreateConversation(userId, characterId) {
      const existing = await findConversation(userId, characterId);
      if (existing) return existing;

      const { data, error } = await db
        .from("conversations")
        .insert({ user_id: userId, character_id: characterId })
        .select("id")
        .single();
      if (!error) return data.id as string;
      // Otra petición simultánea la ha creado: se usa esa.
      if (error.code === "23505") {
        const created = await findConversation(userId, characterId);
        if (created) return created;
      }
      throw new Error(`No se pudo crear la conversación: ${error.message}`);
    },

    async listRecentMessages(conversationId, userId, limit) {
      const { data, error } = await db
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`No se pudieron leer los mensajes: ${error.message}`);
      return (data ?? []).reverse() as StoredMessage[];
    },

    async appendMessage(conversationId, userId, role, content) {
      const { error } = await db.from("messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content: content.slice(0, MAX_STORED_CHARS),
      });
      if (error) throw new Error(`No se pudo guardar el mensaje: ${error.message}`);

      await db
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", userId);
    },
  };
}
