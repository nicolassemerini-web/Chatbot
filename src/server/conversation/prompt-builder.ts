import type { ChatMessage, ChatRequest } from "@/server/ai/types";
import type { Character } from "@/server/characters/types";
import { SAFETY_RULES } from "./safety";

/** Número máximo de mensajes recientes que se envían al modelo. */
export const HISTORY_WINDOW = 20;

export function buildCharacterBlock(character: Character): string {
  return [
    `Personaje: ${character.name} (${character.age} años). ${character.tagline}.`,
    character.persona,
    `Intereses: ${character.interests.join(", ")}.`,
    `Estilo:\n${character.styleRules.map((r) => `- ${r}`).join("\n")}`,
    `Límites:\n${character.boundaries.map((r) => `- ${r}`).join("\n")}`,
  ].join("\n\n");
}

/**
 * Construye la petición al modelo, de lo más estable a lo más variable:
 * reglas comunes → ficha del personaje → (Fase 5: resumen y recuerdos) →
 * últimos mensajes.
 */
export function buildChatRequest(
  character: Character,
  history: ChatMessage[],
  options: { model: string; maxOutputTokens: number },
): ChatRequest {
  const recent = history.slice(-HISTORY_WINDOW);
  // El modelo exige que la conversación empiece por un mensaje del usuario.
  const firstUser = recent.findIndex((m) => m.role === "user");
  const messages = firstUser === -1 ? [] : recent.slice(firstUser);

  return {
    system: [SAFETY_RULES, buildCharacterBlock(character)],
    messages,
    model: options.model,
    maxOutputTokens: options.maxOutputTokens,
  };
}
