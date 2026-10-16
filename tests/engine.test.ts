import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_CHARACTERS } from "@/server/characters/builtin";
import { createMemoryStore } from "./helpers/memory-store";
import { createMemoryUsage } from "./helpers/memory-usage";

vi.mock("@/server/characters/repository", () => ({
  getCharacterBySlug: async (slug: string) => {
    const c = BUILTIN_CHARACTERS.find((x) => x.slug === slug);
    return c ? { ...c, id: `id-${c.slug}` } : null;
  },
}));

const { streamReply, CharacterNotFoundError } = await import("@/server/conversation/engine");
const { QuotaError, getQuotaConfig } = await import("@/server/quotas/limits");

async function collect(gen: AsyncGenerator<string>) {
  let text = "";
  for await (const piece of gen) text += piece;
  return text;
}

describe("motor de conversación", () => {
  let mem: ReturnType<typeof createMemoryStore>;
  let quota: ReturnType<typeof createMemoryUsage>;
  const deps = (extra = {}) => ({ store: mem.store, usage: quota.usage, quotas: getQuotaConfig(), ...extra });
  beforeEach(() => {
    mem = createMemoryStore();
    quota = createMemoryUsage();
  });

  it("guarda el mensaje del usuario y la respuesta del personaje", async () => {
    const reply = await collect(
      streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps()),
    );
    expect(reply).toContain("Hola");
    expect(mem.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(mem.messages[1].content).toBe(reply.trim());
  });

  it("usa el historial guardado: el segundo mensaje no es un saludo", async () => {
    await collect(streamReply({ userId: "u1", characterSlug: "noa", message: "Hola" }, undefined, deps()));
    const second = await collect(
      streamReply({ userId: "u1", characterSlug: "noa", message: "Hola otra vez" }, undefined, deps()),
    );
    const noa = BUILTIN_CHARACTERS.find((c) => c.slug === "noa")!;
    expect(second).not.toBe(noa.mockLines.greeting);
    expect(mem.messages).toHaveLength(4);
  });

  it("separa las conversaciones de usuarios distintos", async () => {
    await collect(streamReply({ userId: "u1", characterSlug: "lucia", message: "Soy u1" }, undefined, deps()));
    await collect(streamReply({ userId: "u2", characterSlug: "lucia", message: "Soy u2" }, undefined, deps()));
    expect(mem.conversations.size).toBe(2);
    const ids = new Set(mem.messages.map((m) => m.conversationId));
    expect(ids.size).toBe(2);
  });

  it("guarda la respuesta parcial si el usuario corta la conversación", async () => {
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps());
    const first = await gen.next();
    await gen.return(undefined);
    expect(mem.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(mem.messages[1].content).toBe(String(first.value).trim());
  });

  it("falla con un personaje inexistente sin guardar nada", async () => {
    const gen = streamReply({ userId: "u1", characterSlug: "nadie", message: "Hola" }, undefined, deps());
    await expect(gen.next()).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(mem.messages).toHaveLength(0);
  });

  it("no responde si el personaje ya no está publicado en la base de datos", async () => {
    const store = { ...mem.store, resolveCharacterId: async () => null };
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps({ store }));
    await expect(gen.next()).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(mem.messages).toHaveLength(0);
  });

  it("registra los tokens y el coste estimado de cada respuesta", async () => {
    await collect(streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps()));
    expect(quota.state.records).toHaveLength(1);
    expect(quota.state.records[0].userId).toBe("u1");
    expect(quota.state.records[0].tokensOut).toBeGreaterThan(0);
    expect(quota.state.records[0].costMicros).toBeGreaterThan(0);
  });

  it("bloquea al llegar al límite diario sin guardar ni gastar nada", async () => {
    quota = createMemoryUsage({ quota: 1 });
    await collect(streamReply({ userId: "u1", characterSlug: "lucia", message: "Uno" }, undefined, deps()));
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Dos" }, undefined, deps());
    await expect(gen.next()).rejects.toMatchObject({ code: "daily_limit" });
    expect(mem.messages).toHaveLength(2);
    expect(quota.state.records).toHaveLength(1);
  });

  it("bloquea si se escribe demasiado rápido", async () => {
    quota.state.recent = 10;
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps());
    await expect(gen.next()).rejects.toBeInstanceOf(QuotaError);
    await expect(
      streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps()).next(),
    ).rejects.toMatchObject({ code: "too_fast" });
    expect(mem.messages).toHaveLength(0);
  });

  it("el freno global pausa la IA para todos sin consumir la cuota de nadie", async () => {
    quota.state.globalCostMicros = 500 * 10_000;
    const gen = streamReply({ userId: "u1", characterSlug: "lucia", message: "Hola" }, undefined, deps());
    await expect(gen.next()).rejects.toMatchObject({ code: "budget" });
    expect(quota.state.used).toBe(0);
    expect(mem.messages).toHaveLength(0);
  });
});
