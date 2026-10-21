import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createOpenAiCompatibleProvider } from "@/server/ai/openai-compatible";
import { AiError, type ChatChunk, type ChatRequest } from "@/server/ai/types";

type Fake = { status: number; lines?: string[]; hang?: boolean };
let fake: Fake = { status: 200 };
let lastBody: Record<string, unknown> | null = null;
let lastHeaders: http.IncomingHttpHeaders = {};
let lastPath = "";
let aborted = false;
let server: http.Server;
let baseURL: string;

const data = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const ok = (texts: string[], finish = "stop", usage: unknown = { prompt_tokens: 900, completion_tokens: 6 }) => [
  ...texts.map((t) => data({ choices: [{ delta: { content: t }, finish_reason: null }] })),
  data({ choices: [{ delta: {}, finish_reason: finish }] }),
  ...(usage ? [data({ choices: [], usage })] : []),
  "data: [DONE]\n\n",
];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("close", () => {
      if (!res.writableEnded) aborted = true;
    });
    req.on("end", () => {
      lastBody = raw ? JSON.parse(raw) : null;
      lastHeaders = req.headers;
      lastPath = req.url ?? "";
      if (fake.hang) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(ok(["Hola "])[0]);
        return;
      }
      if (fake.status !== 200) {
        res.writeHead(fake.status, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "secreto-interno" } }));
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end((fake.lines ?? []).join(""));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
afterEach(() => {
  fake = { status: 200 };
  lastBody = null;
  aborted = false;
});

const request: ChatRequest = {
  system: ["Reglas fijas", "Ficha del personaje"],
  messages: [{ role: "user", content: "Hola" }],
  model: "llama-3.3-70b-versatile",
  maxOutputTokens: 400,
};
const provider = (apiKey?: string) => createOpenAiCompatibleProvider({ baseURL, apiKey });

async function collect(iter: AsyncIterable<ChatChunk>) {
  const out: ChatChunk[] = [];
  for await (const c of iter) out.push(c);
  return out;
}

describe("proveedor compatible con OpenAI (Groq, OpenRouter, Ollama…)", () => {
  it("emite el texto en fragmentos y termina con el consumo", async () => {
    fake = { status: 200, lines: ok(["Hola", " qué", " tal"]) };
    const chunks = await collect(provider("clave").streamChat(request));
    expect(chunks.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("")).toBe("Hola qué tal");
    expect(chunks.at(-1)).toEqual({ type: "done", stopReason: "end", usage: { inputTokens: 900, outputTokens: 6 } });
  });

  it("envía la petición en el formato de chat completions", async () => {
    fake = { status: 200, lines: ok(["ok"]) };
    await collect(provider("clave-de-prueba").streamChat(request));
    const body = lastBody as unknown as { model: string; stream: boolean; max_tokens: number; temperature: number; messages: { role: string; content: string }[] };
    expect(lastPath).toBe("/v1/chat/completions");
    expect(lastHeaders.authorization).toBe("Bearer clave-de-prueba");
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(400);
    expect(body.temperature).toBe(0.7);
    expect(body.messages[0]).toEqual({ role: "system", content: "Reglas fijas\n\nFicha del personaje" });
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Hola" });
  });

  it("permite ajustar la temperatura", async () => {
    fake = { status: 200, lines: ok(["ok"]) };
    await collect(createOpenAiCompatibleProvider({ baseURL, temperature: 0.3 }).streamChat(request));
    expect((lastBody as unknown as { temperature: number }).temperature).toBe(0.3);
  });

  it("funciona sin clave (p. ej. Ollama en local)", async () => {
    fake = { status: 200, lines: ok(["ok"]) };
    await collect(provider().streamChat(request));
    expect(lastHeaders.authorization).toBeUndefined();
  });

  it("estima el consumo si el proveedor no lo informa", async () => {
    fake = { status: 200, lines: ok(["respuesta de prueba"], "stop", null) };
    const done = (await collect(provider().streamChat(request))).at(-1);
    expect(done).toMatchObject({ type: "done" });
    expect((done as Extract<ChatChunk, { type: "done" }>).usage.outputTokens).toBeGreaterThan(0);
  });

  it("avisa si se corta por longitud", async () => {
    fake = { status: 200, lines: ok(["texto"], "length") };
    expect((await collect(provider().streamChat(request))).at(-1)).toMatchObject({ stopReason: "max_tokens" });
  });

  it("ignora líneas que no son datos y bloques mal formados", async () => {
    fake = { status: 200, lines: [": keep-alive\n\n", "data: {no es json\n\n", ...ok(["bien"])] };
    const text = (await collect(provider().streamChat(request))).flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    expect(text).toBe("bien");
  });

  it.each([
    [401, "misconfigured"],
    [403, "misconfigured"],
    [404, "misconfigured"],
    [429, "rate_limited"],
    [500, "unavailable"],
    [503, "unavailable"],
  ] as const)("traduce el error HTTP %i a %s", async (status, code) => {
    fake = { status };
    const error = await collect(provider("clave-de-prueba").streamChat(request)).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain("secreto-interno");
    expect(error.message).not.toContain("clave-de-prueba");
  });

  it("si no se puede conectar, lo trata como no disponible", async () => {
    const dead = createOpenAiCompatibleProvider({ baseURL: "http://127.0.0.1:1/v1" });
    const error = await collect(dead.streamChat(request)).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe("unavailable");
  });

  it("corta la conexión si quien lee deja de leer", async () => {
    fake = { status: 200, hang: true };
    const iterator = provider().streamChat(request)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ type: "text", text: "Hola " });
    await iterator.return?.(undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(aborted).toBe(true);
  });
});
