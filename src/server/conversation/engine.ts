import "server-only";

import { getAiConfig, getAiProvider } from "@/server/ai";
import { getCharacter } from "@/server/characters/catalog";
import type { ChatRequestBody } from "@/lib/validation/chat";
import { buildChatRequest } from "./prompt-builder";

export class CharacterNotFoundError extends Error {
  constructor() {
    super("Personaje no encontrado");
    this.name = "CharacterNotFoundError";
  }
}

/**
 * Flujo de un turno de conversación. Fase 1: sin autenticación, persistencia
 * ni límites (llegan en las Fases 2 y 3). Devuelve el texto en fragmentos.
 */
export async function* streamReply(
  body: ChatRequestBody,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const character = getCharacter(body.characterSlug);
  if (!character) throw new CharacterNotFoundError();

  const config = getAiConfig();
  const provider = getAiProvider({
    characterName: character.name,
    greeting: character.mockLines.greeting,
    replies: character.mockLines.replies,
  });

  const request = buildChatRequest(character, body.messages, {
    model: config.chatModel,
    maxOutputTokens: config.maxOutputTokens,
  });

  for await (const chunk of provider.streamChat(request, signal)) {
    if (chunk.type === "text") yield chunk.text;
    // chunk.type === "done": en la Fase 4 se registra aquí el consumo.
  }
}
