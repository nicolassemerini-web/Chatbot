import Anthropic from "@anthropic-ai/sdk";
import { AiError, type AiProvider, type ChatChunk, type ChatRequest } from "./types";

export type AnthropicOptions = {
  apiKey: string;
  /** Solo para pruebas (servidor falso). En producción se usa la URL oficial. */
  baseURL?: string;
  maxRetries?: number;
};

/** Traduce los errores del SDK a los errores neutrales que entiende el motor. */
export function mapAnthropicError(error: unknown): unknown {
  if (error instanceof Anthropic.APIUserAbortError) return error;
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return new AiError("misconfigured", `Anthropic rechazó la configuración (${error.status})`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", "Anthropic limita las peticiones ahora mismo");
  }
  if (error instanceof Anthropic.APIError) {
    // 400 (petición inválida), 5xx y 529 (sobrecarga): no es culpa del usuario.
    return new AiError("unavailable", `Anthropic respondió con error ${error.status ?? "de red"}`);
  }
  return new AiError("unavailable", "No se pudo contactar con Anthropic");
}

/**
 * Proveedor real: Claude de Anthropic en streaming.
 *
 * Ajustes pensados para un chat corto con Claude Haiku 5.5:
 * - Sin razonamiento (`thinking: disabled`) y esfuerzo bajo: respuestas rápidas
 *   y baratas; no se gastan tokens de salida en pensar.
 * - Sin `temperature`/`top_p`: Haiku 5.5 rechaza valores no predeterminados.
 * - El último bloque de sistema se marca como cacheable (se aprovecha cuando
 *   el prefijo es suficientemente largo para el modelo).
 */
export function createAnthropicProvider(options: AnthropicOptions): AiProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    maxRetries: options.maxRetries ?? 1,
    timeout: 60_000,
  });

  return {
    name: "anthropic",
    async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk> {
      const stream = client.messages.stream(
        {
          model: request.model,
          max_tokens: request.maxOutputTokens,
          system: request.system.map((text, index, all) => ({
            type: "text" as const,
            text,
            ...(index === all.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
          })),
          messages: request.messages,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
        },
        { signal },
      );

      let finished = false;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }
        const final = await stream.finalMessage();
        finished = true;

        const usage = final.usage;
        yield {
          type: "done",
          // Estimación prudente: la lectura de caché se cuenta como entrada normal.
          usage: {
            inputTokens:
              usage.input_tokens +
              (usage.cache_creation_input_tokens ?? 0) +
              (usage.cache_read_input_tokens ?? 0),
            outputTokens: usage.output_tokens,
          },
          stopReason:
            final.stop_reason === "refusal"
              ? "refused"
              : final.stop_reason === "max_tokens"
                ? "max_tokens"
                : "end",
        };
      } catch (error) {
        throw mapAnthropicError(error);
      } finally {
        // Si quien consume deja de leer (el usuario cierra el chat), se corta
        // la conexión con Anthropic para no seguir generando (y pagando).
        if (!finished) stream.abort();
      }
    },
  };
}
