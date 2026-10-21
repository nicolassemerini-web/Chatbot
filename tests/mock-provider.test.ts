import { describe, expect, it } from "vitest";
import { createMockProvider, pickMockReply, type MockScript } from "@/server/ai/mock";
import type { ChatChunk, ChatRequest } from "@/server/ai/types";

const script: MockScript = {
  characterName: "Lucía",
  greeting: "¡Hola! ¿Qué tal?",
  replies: ["Respuesta A", "Respuesta B"],
};

function request(...userTexts: string[]): ChatRequest {
  const messages = userTexts.flatMap((content, i) =>
    i < userTexts.length - 1
      ? [{ role: "user" as const, content }, { role: "assistant" as const, content: "ok" }]
      : [{ role: "user" as const, content }],
  );
  return { system: ["reglas"], messages, model: "mock", maxOutputTokens: 100 };
}

describe("proveedor simulado", () => {
  it("se identifica como personaje ficticio de IA si se le pregunta", () => {
    for (const q of ["¿Eres humana?", "eres una persona real?", "¿Eres una IA?"]) {
      const reply = pickMockReply(script, request(q));
      expect(reply).toContain("personaje ficticio");
      expect(reply).toContain("No soy una persona real");
    }
  });

  it("saluda si el primer mensaje es un saludo", () => {
    expect(pickMockReply(script, request("Hola"))).toBe(script.greeting);
  });

  it("alterna las respuestas de ejemplo", () => {
    expect(pickMockReply(script, request("Te cuento algo"))).toBe("Respuesta A");
    expect(pickMockReply(script, request("Hola", "Te cuento algo"))).toBe("Respuesta B");
  });

  it("emite el texto completo en fragmentos y termina con el consumo", async () => {
    const provider = createMockProvider(script, 0);
    const chunks: ChatChunk[] = [];
    for await (const c of provider.streamChat(request("Hola"))) chunks.push(c);

    const text = chunks.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    expect(text).toBe(script.greeting);
    const last = chunks.at(-1);
    expect(last?.type).toBe("done");
  });

  it("deja de emitir si se cancela la petición", async () => {
    const provider = createMockProvider(script, 0);
    const controller = new AbortController();
    controller.abort();
    const chunks: ChatChunk[] = [];
    for await (const c of provider.streamChat(request("Hola"), controller.signal)) chunks.push(c);
    expect(chunks).toHaveLength(0);
  });
});
