import "server-only";

import { createAnthropicProvider } from "./anthropic";
import { createMockProvider, type MockScript } from "./mock";
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
    default:
      throw new AiError("misconfigured", `Proveedor de IA no soportado: ${provider}`);
  }
}
