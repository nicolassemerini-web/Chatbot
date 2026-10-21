import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/server/ai/types";
import { BUILTIN_CHARACTERS } from "@/server/characters/builtin";
import { buildChatRequest, CONVERSATION_GUIDE, HISTORY_WINDOW } from "@/server/conversation/prompt-builder";
import { SAFETY_RULES } from "@/server/conversation/safety";

const character = BUILTIN_CHARACTERS[0];
const options = { model: "mock", maxOutputTokens: 400 };

describe("buildChatRequest", () => {
  it("pone las reglas de seguridad primero y después la ficha", () => {
    const req = buildChatRequest(character, [{ role: "user", content: "Hola" }], options);
    expect(req.system[0]).toBe(SAFETY_RULES);
    expect(req.system[1]).toContain("Lucía");
    expect(req.system[2]).toBe(CONVERSATION_GUIDE);
  });

  it("limita el historial a la ventana configurada", () => {
    const history: ChatMessage[] = Array.from({ length: HISTORY_WINDOW + 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    history.push({ role: "user", content: "último" });
    const req = buildChatRequest(character, history, options);
    expect(req.messages.length).toBeLessThanOrEqual(HISTORY_WINDOW);
    expect(req.messages.at(-1)?.content).toBe("último");
  });

  it("hace que la conversación empiece por un mensaje del usuario", () => {
    const history: ChatMessage[] = Array.from({ length: HISTORY_WINDOW + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const req = buildChatRequest(character, history, options);
    expect(req.messages[0].role).toBe("user");
  });
});
