import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_CHARACTERS } from "@/server/characters/builtin";
import { createMemoryStore } from "./helpers/memory-store";

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  onboarded: true,
  store: null as unknown,
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: async () => state.user,
  getProfile: async () => ({ onboarded: state.onboarded }),
  isOnboarded: (p: { onboarded: boolean }) => p.onboarded,
}));
vi.mock("@/server/characters/repository", () => ({
  getCharacterBySlug: async (slug: string) => {
    const c = BUILTIN_CHARACTERS.find((x) => x.slug === slug);
    return c ? { ...c, id: `id-${c.slug}` } : null;
  },
}));
vi.mock("@/server/conversation/store", () => ({
  createSupabaseConversationStore: () => state.store,
}));

const { POST } = await import("@/app/api/chat/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/chat", () => {
  let mem: ReturnType<typeof createMemoryStore>;
  beforeEach(() => {
    mem = createMemoryStore();
    state.store = mem.store;
    state.user = { id: "u1", email: "u1@example.com" };
    state.onboarded = true;
  });

  it("exige sesión (401)", async () => {
    state.user = null;
    const res = await post({ characterSlug: "lucia", message: "Hola" });
    expect(res.status).toBe(401);
    expect(mem.messages).toHaveLength(0);
  });

  it("exige completar la bienvenida (403)", async () => {
    state.onboarded = false;
    const res = await post({ characterSlug: "lucia", message: "Hola" });
    expect(res.status).toBe(403);
  });

  it("responde en streaming y guarda la conversación del usuario de la sesión", async () => {
    const res = await post({ characterSlug: "noa", message: "¿Eres humana?" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("Soy Noa, un personaje ficticio");
    expect(mem.messages.every((m) => m.userId === "u1")).toBe(true);
    expect(mem.messages).toHaveLength(2);
  });

  it("ignora un userId enviado en el cuerpo", async () => {
    await (await post({ characterSlug: "noa", message: "Hola", userId: "otro" })).text();
    expect(mem.messages.every((m) => m.userId === "u1")).toBe(true);
  });

  it("devuelve 404 si el personaje no existe", async () => {
    const res = await post({ characterSlug: "nadie", message: "Hola" });
    expect(res.status).toBe(404);
  });

  it("devuelve 400 con JSON mal formado o inválido", async () => {
    expect((await post("{no es json")).status).toBe(400);
    expect((await post({ characterSlug: "lucia", message: "" })).status).toBe(400);
  });
});
