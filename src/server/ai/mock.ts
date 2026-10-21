import type { AiProvider, ChatChunk, ChatRequest } from "./types";

export type MockScript = {
  characterName: string;
  greeting: string;
  replies: string[];
};

const IDENTITY_QUESTION =
  /\b(eres|sos)\b.*\b(humana|humano|persona|real|ia|robot|bot|m[aá]quina|inteligencia artificial)\b/i;
const GREETING = /^\s*(hola|buenas|hey|ey|buenos d[ií]as|buenas tardes|buenas noches)\b/i;

/** Elige la respuesta simulada. Es determinista para poder probarla. */
export function pickMockReply(script: MockScript, request: ChatRequest): string {
  const userMessages = request.messages.filter((m) => m.role === "user");
  const last = userMessages.at(-1)?.content ?? "";

  if (IDENTITY_QUESTION.test(last)) {
    return `Soy ${script.characterName}, un personaje ficticio creado con inteligencia artificial. No soy una persona real, aunque me encanta charlar contigo.`;
  }
  if (userMessages.length === 1 && GREETING.test(last)) {
    return script.greeting;
  }
  return script.replies[(userMessages.length - 1) % script.replies.length];
}

/**
 * Proveedor simulado: responde con textos fijos y los envía palabra a palabra
 * para imitar el streaming. Permite desarrollar y probar sin clave ni coste.
 */
export function createMockProvider(script: MockScript, delayMs = 35): AiProvider {
  return {
    name: "mock",
    async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk> {
      const reply = pickMockReply(script, request);
      const words = reply.split(/(?<=\s)/);
      for (const word of words) {
        if (signal?.aborted) return;
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        yield { type: "text", text: word };
      }
      const inputChars = request.system.join("").length +
        request.messages.reduce((n, m) => n + m.content.length, 0);
      yield {
        type: "done",
        stopReason: "end",
        // Aproximación (≈4 caracteres por token); el proveedor real da el valor exacto.
        usage: { inputTokens: Math.ceil(inputChars / 4), outputTokens: Math.ceil(reply.length / 4) },
      };
    },
  };
}
