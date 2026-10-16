import "server-only";

import { getAiConfig, getAiProvider } from "@/server/ai";
import { getCharacterBySlug } from "@/server/characters/repository";
import { buildChatRequest, HISTORY_WINDOW } from "./prompt-builder";
import { createSupabaseConversationStore, type ConversationStore } from "./store";

export class CharacterNotFoundError extends Error {
  constructor() {
    super("Personaje no encontrado");
    this.name = "CharacterNotFoundError";
  }
}

export type TurnInput = {
  /** Usuario ya verificado por quien llama (nunca un dato del cliente). */
  userId: string;
  characterSlug: string;
  message: string;
};

/**
 * Flujo de un turno de conversación:
 * 1. Carga el personaje y la conversación (la crea si no existe).
 * 2. Guarda el mensaje del usuario.
 * 3. Lee los últimos mensajes de la base de datos y construye el contexto.
 * 4. Devuelve la respuesta en fragmentos y, al terminar (o si se corta), la guarda.
 *
 * Los límites de consumo llegan en la Fase 4.
 */
export async function* streamReply(
  input: TurnInput,
  signal?: AbortSignal,
  store: ConversationStore = createSupabaseConversationStore(),
): AsyncGenerator<string> {
  const character = await getCharacterBySlug(input.characterSlug);
  // El id se consulta en la base de datos en cada turno: así un personaje
  // despublicado o recreado nunca usa un identificador antiguo de la caché.
  const characterId = character ? await store.resolveCharacterId(character.slug) : null;
  if (!character || !characterId) throw new CharacterNotFoundError();

  const conversationId = await store.getOrCreateConversation(input.userId, characterId);
  await store.appendMessage(conversationId, input.userId, "user", input.message);
  const history = await store.listRecentMessages(conversationId, input.userId, HISTORY_WINDOW);

  const config = getAiConfig();
  const provider = getAiProvider({
    characterName: character.name,
    greeting: character.mockLines.greeting,
    replies: character.mockLines.replies,
  });
  const request = buildChatRequest(
    character,
    history.map(({ role, content }) => ({ role, content })),
    { model: character.model ?? config.chatModel, maxOutputTokens: config.maxOutputTokens },
  );

  let reply = "";
  try {
    for await (const chunk of provider.streamChat(request, signal)) {
      if (chunk.type === "text") {
        reply += chunk.text;
        yield chunk.text;
      }
      // chunk.type === "done": en la Fase 4 se registra aquí el consumo.
    }
  } finally {
    // Se guarda también una respuesta parcial si el usuario cierra el chat a medias.
    if (reply.trim()) {
      await store.appendMessage(conversationId, input.userId, "assistant", reply.trim());
    }
  }
}
