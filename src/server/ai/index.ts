import "server-only";

import { createMockProvider, type MockScript } from "./mock";
import { AiError, type AiProvider } from "./types";

export type AiConfig = {
  provider: string;
  chatModel: string;
  maxOutputTokens: number;
};

export function getAiConfig(): AiConfig {
  return {
    provider: process.env.AI_PROVIDER ?? "mock",
    chatModel: process.env.AI_CHAT_MODEL ?? "mock",
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
    default:
      // Los proveedores reales se añaden en la Fase 4.
      throw new AiError("misconfigured", `Proveedor de IA no soportado: ${provider}`);
  }
}
