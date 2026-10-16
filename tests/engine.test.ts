import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_CHARACTERS } from "@/server/characters/builtin";
import { createMemoryStore } from "./helpers/memory-store";

vi.mock("@/server/characters/repository", () => ({
  getCharacterBySlug: async (slug: string) => {
    const c = BUILTIN_CHARACTERS.find((x) => x.slug === slug);
    return c ? { ...c, id: `id-${c.slug}` } : null;
  },
}));

const { streamReply, CharacterNotFoundError } = await import("@/server/conversation/engine");

async function collect(gen: AsyncGenerator<string>) {
  let text = "";
  for await (const piece of gen) text += piece;
  return text;
}

describe("motor de conversación", () => {
  let mem: ReturnType<typeof createMemoryStore>;
  beforeEach(() => {
    mem = createMemoryStore();
  });

  it("guarda el mensaje del usuario y la respuesta del personaje", async () => {
    const reply = await collect(
      streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, mem.store),
    );
    expect(reply).toContain("Hola");
    expect(mem.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(mem.messages[1].content).toBe(reply.trim());
  });

  it("usa el historial guardado: el segundo mensaje no es un saludo", async () => {
    await collect(streamReply({ userId: "u1", characterSlug: "noa", message: "Hola" }, undefined, mem.store));
    const second = await collect(
      streamReply({ userId: "u1", characterSlug: "noa", message: "Hola otra vez" }, undefined, mem.store),
    );
    const noa = BUILTIN_CHARACTERS.find((c) => c.slug === "noa")!;
    expect(second).not.toBe(noa.mockLines.greeting);
    expect(mem.messages).toHaveLength(4);
  });

  it("separa las conversaciones de usuarios distintos", async () => {
    await collect(streamReply({ userId: "u1", characterSlug: "lucia", message: "Soy u1" }, undefined, mem.store));
    await collect(streamReply({ userId: "u2", characterSlug: "lucia", message: "Soy u2" }, undefined, mem.store));
    expect(mem.conversations.size).toBe(2);
    const ids = new Set(mem.messages.map((m) => m.conversationId));
    expect(ids.size).toBe(2);
  });

  it("guarda la respuesta parcial si el usuario corta la conversación", async () => {
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, mem.store);
    const first = await gen.next();
    await gen.return(undefined);
    expect(mem.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(mem.messages[1].content).toBe(String(first.value).trim());
  });

  it("falla con un personaje inexistente sin guardar nada", async () => {
    const gen = streamReply({ userId: "u1", characterSlug: "nadie", message: "Hola" }, undefined, mem.store);
    await expect(gen.next()).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(mem.messages).toHaveLength(0);
  });

  it("no responde si el personaje ya no está publicado en la base de datos", async () => {
    const store = { ...mem.store, resolveCharacterId: async () => null };
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, store);
    await expect(gen.next()).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(mem.messages).toHaveLength(0);
  });
});
