/**
 * Interfaz neutral del proveedor de IA. El resto de la aplicación solo
 * conoce estos tipos; cada proveedor (mock, Anthropic, ...) los implementa.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  /** Bloques de sistema, de más estable a más variable (favorece la caché). */
  system: string[];
  messages: ChatMessage[];
  model: string;
  maxOutputTokens: number;
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ChatChunk =
  | { type: "text"; text: string }
  | { type: "done"; usage: ChatUsage; stopReason: "end" | "max_tokens" | "refused" };

export interface AiProvider {
  readonly name: string;
  streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk>;
}

/** Errores neutrales que el motor de conversación sabe tratar. */
export class AiError extends Error {
  constructor(
    readonly code: "rate_limited" | "unavailable" | "refused" | "misconfigured",
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}
