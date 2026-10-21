import "server-only";

import { getAiConfig, getAiProvider } from "@/server/ai";
import { getCharacterBySlug } from "@/server/characters/repository";
import {
  enforceLimits,
  estimateCostMicros,
  getQuotaConfig,
  type QuotaConfig,
  type UsageStore,
} from "@/server/quotas/limits";
import { createSupabaseUsageStore } from "@/server/quotas/supabase-usage-store";
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

export type TurnDeps = {
  store?: ConversationStore;
  usage?: UsageStore;
  quotas?: QuotaConfig;
};

/** Respuesta de cortesía cuando el proveedor declina continuar (sin texto propio). */
export const REFUSAL_FALLBACK = "Prefiero no seguir por ahí. ¿Hablamos de otra cosa?";

/**
 * Flujo de un turno de conversación:
 * 1. Carga el personaje y comprueba los límites de consumo.
 * 2. Guarda el mensaje del usuario y lee el historial de la base de datos.
 * 3. Construye el contexto y devuelve la respuesta en fragmentos.
 * 4. Al terminar (o si se corta) guarda la respuesta y registra el gasto.
 */
export async function* streamReply(
  input: TurnInput,
  signal?: AbortSignal,
  deps: TurnDeps = {},
): AsyncGenerator<string> {
  const store = deps.store ?? createSupabaseConversationStore();
  const usage = deps.usage ?? createSupabaseUsageStore();
  const quotas = deps.quotas ?? getQuotaConfig();

  const character = await getCharacterBySlug(input.characterSlug);
  // El id se consulta en la base de datos en cada turno: así un personaje
  // despublicado o recreado nunca usa un identificador antiguo de la caché.
  const characterId = character ? await store.resolveCharacterId(character.slug) : null;
  if (!character || !characterId) throw new CharacterNotFoundError();

  // Antes de gastar nada: ritmo, freno global y cuota diaria.
  await enforceLimits(input.userId, usage, quotas);

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
  let refused = false;
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    for await (const chunk of provider.streamChat(request, signal)) {
      if (chunk.type === "text") {
        reply += chunk.text;
        yield chunk.text;
      } else {
        tokensIn = chunk.usage.inputTokens;
        tokensOut = chunk.usage.outputTokens;
        refused = chunk.stopReason === "refused";
      }
    }
    if (refused && !reply.trim()) {
      reply = REFUSAL_FALLBACK;
      yield REFUSAL_FALLBACK;
    }
  } finally {
    // Se guarda también una respuesta parcial si el usuario cierra el chat a medias.
    if (reply.trim()) {
      await store.appendMessage(conversationId, input.userId, "assistant", reply.trim());
    }
    if (tokensIn > 0 || tokensOut > 0) {
      await usage.recordUsage(
        input.userId,
        tokensIn,
        tokensOut,
        estimateCostMicros(tokensIn, tokensOut, quotas),
      );
    }
  }
}
