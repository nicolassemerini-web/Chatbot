import { AiError, type AiProvider, type ChatChunk, type ChatRequest } from "./types";

export type OpenAiCompatibleOptions = {
  /** Dirección base, p. ej. https://api.groq.com/openai/v1 (sin /chat/completions). */
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
};

type StreamEvent = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export function mapHttpStatus(status: number): AiError {
  if (status === 401 || status === 403 || status === 404) {
    return new AiError("misconfigured", `El proveedor de IA rechazó la configuración (${status})`);
  }
  if (status === 429) return new AiError("rate_limited", "El proveedor de IA limita las peticiones");
  return new AiError("unavailable", `El proveedor de IA respondió con error ${status}`);
}

/**
 * Proveedor para cualquier servicio con la API de "chat completions" de OpenAI:
 * Groq, OpenRouter, Google Gemini (modo compatible), Ollama en local, etc.
 * Solo usa `fetch`: no añade ninguna dependencia.
 */
export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): AiProvider {
  const url = `${options.baseURL.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai-compatible",
    async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk> {
      // Si quien consume deja de leer, se corta la conexión con el proveedor.
      const controller = new AbortController();
      const signals = [controller.signal, AbortSignal.timeout(options.timeoutMs ?? 60_000)];
      if (signal) signals.push(signal);

      let finished = false;
      try {
        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            signal: AbortSignal.any(signals),
            headers: {
              "Content-Type": "application/json",
              ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: request.model,
              max_tokens: request.maxOutputTokens,
              stream: true,
              stream_options: { include_usage: true },
              messages: [
                { role: "system", content: request.system.join("\n\n") },
                ...request.messages,
              ],
            }),
          });
        } catch (error) {
          if (signal?.aborted) throw error;
          throw new AiError("unavailable", "No se pudo contactar con el proveedor de IA");
        }

        if (!response.ok || !response.body) throw mapHttpStatus(response.status);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";
        let usage: StreamEvent["usage"] = null;
        let finishReason: string | null = null;

        const handleLine = (line: string): ChatChunk | null => {
          if (!line.startsWith("data:")) return null;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") return null;
          let event: StreamEvent;
          try {
            event = JSON.parse(data) as StreamEvent;
          } catch {
            return null;
          }
          if (event.usage) usage = event.usage;
          const choice = event.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          const piece = choice?.delta?.content;
          if (piece) {
            text += piece;
            return { type: "text", text: piece };
          }
          return null;
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const chunk = handleLine(buffer.slice(0, newline).trim());
            buffer = buffer.slice(newline + 1);
            if (chunk) yield chunk;
          }
        }
        const last = handleLine(buffer.trim());
        if (last) yield last;

        finished = true;
        const inputChars = request.system.join("").length + request.messages.reduce((n, m) => n + m.content.length, 0);
        const finalUsage = usage as StreamEvent["usage"];
        yield {
          type: "done",
          // Si el proveedor no informa del consumo, se estima (≈4 caracteres por token).
          usage: {
            inputTokens: finalUsage?.prompt_tokens ?? Math.ceil(inputChars / 4),
            outputTokens: finalUsage?.completion_tokens ?? Math.ceil(text.length / 4),
          },
          stopReason: finishReason === "length" ? "max_tokens" : finishReason === "content_filter" ? "refused" : "end",
        };
      } finally {
        if (!finished) controller.abort();
      }
    },
  };
}
