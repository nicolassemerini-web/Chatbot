import "server-only";

import { createAnthropicProvider } from "./anthropic";
import { createMockProvider, type MockScript } from "./mock";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { AiError, type AiProvider } from "./types";

export type AiConfig = {
  provider: string;
  chatModel: string;
  maxOutputTokens: number;
};

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";

export function getAiConfig(): AiConfig {
  const provider = process.env.AI_PROVIDER || "mock";
  return {
    provider,
    chatModel:
      process.env.AI_CHAT_MODEL || (provider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : "mock"),
    maxOutputTokens: 400,
  };
}

/**
 * Devuelve el proveedor configurado en AI_PROVIDER. `mockScript` solo lo usa el
 * proveedor simulado; los proveedores reales lo ignoran.
 */
export function getAiProvider(mockScript: MockScript): AiProvider {
  const { provider } = getAiConfig();
  switch (provider) {
    case "mock":
      return createMockProvider(mockScript);
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new AiError("misconfigured", "Falta ANTHROPIC_API_KEY");
      return createAnthropicProvider({ apiKey });
    }
    case "openai-compatible": {
      // Groq, OpenRouter, Ollama, Gemini (modo compatible)... Solo hacen falta
      // la dirección, el modelo y (casi siempre) una clave.
      const baseURL = process.env.AI_BASE_URL;
      if (!baseURL) throw new AiError("misconfigured", "Falta AI_BASE_URL");
      if (!process.env.AI_CHAT_MODEL) throw new AiError("misconfigured", "Falta AI_CHAT_MODEL");
      const temperature = Number(process.env.AI_TEMPERATURE);
      return createOpenAiCompatibleProvider({
        baseURL,
        apiKey: process.env.AI_API_KEY || undefined,
        // Anthropic (Claude Haiku 5.5) no admite este parámetro; aquí sí.
        temperature:
          process.env.AI_TEMPERATURE && Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
            ? temperature
            : undefined,
      });
    }
    default:
      throw new AiError("misconfigured", `Proveedor de IA no soportado: ${provider}`);
  }
}
