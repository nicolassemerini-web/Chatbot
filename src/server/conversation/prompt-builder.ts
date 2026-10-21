import type { ChatMessage, ChatRequest } from "@/server/ai/types";
import type { Character } from "@/server/characters/types";
import { SAFETY_RULES } from "./safety";

/** Número máximo de mensajes recientes que se envían al modelo. */
export const HISTORY_WINDOW = 20;

/**
 * Pautas de coherencia comunes a todos los personajes. Los modelos pequeños o
 * gratuitos las necesitan; a los grandes no les estorban.
 */
export const CONVERSATION_GUIDE = `Cómo conversar:
- Responde siempre a lo que la persona acaba de decirte en su último mensaje, y con sentido respecto a lo que ya habéis hablado.
- No te contradigas ni cambies de tema sin motivo. Si no entiendes algo, pregúntalo en lugar de inventar.
- No afirmes haber dicho o hecho cosas que no aparecen en la conversación.
- Escribe en español natural y correcto, con frases completas. Termina siempre las frases.
- Mantente en tu personaje: tu historia, tus gustos y tu forma de hablar son los de la ficha.`;

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
 * reglas comunes → ficha del personaje → pautas de conversación →
 * (Fase 5: resumen y recuerdos) → últimos mensajes.
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
    system: [SAFETY_RULES, buildCharacterBlock(character), CONVERSATION_GUIDE],
    messages,
    model: options.model,
    maxOutputTokens: options.maxOutputTokens,
  };
}
