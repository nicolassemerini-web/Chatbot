import type { ChatRole } from "@/server/ai/types";
import type { ConversationStore, StoredMessage } from "@/server/conversation/store";

/** Almacén en memoria con la misma interfaz que el de Supabase. */
export function createMemoryStore() {
  const conversations = new Map<string, { id: string; userId: string; characterId: string }>();
  const messages: (StoredMessage & { conversationId: string; userId: string })[] = [];
  let nextId = 1;

  const store: ConversationStore = {
    async resolveCharacterId(slug) {
      return slug === "despublicado" ? null : `id-${slug}`;
    },
    async getOrCreateConversation(userId, characterId) {
      const key = `${userId}:${characterId}`;
      if (!conversations.has(key)) {
        conversations.set(key, { id: `conv-${conversations.size + 1}`, userId, characterId });
      }
      return conversations.get(key)!.id;
    },
    async listRecentMessages(conversationId, userId, limit) {
      return messages
        .filter((m) => m.conversationId === conversationId && m.userId === userId)
        .slice(-limit)
        .map(({ id, role, content }) => ({ id, role, content }));
    },
    async appendMessage(conversationId, userId, role: ChatRole, content) {
      messages.push({ id: nextId++, conversationId, userId, role, content });
    },
  };
  return { store, messages, conversations };
}
