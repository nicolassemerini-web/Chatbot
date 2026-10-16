import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { createAnthropicProvider } from "@/server/ai/anthropic";
import { AiError, type ChatChunk, type ChatRequest } from "@/server/ai/types";

/** Servidor que imita la API de mensajes de Anthropic (con streaming SSE). */
type Fake = { status: number; body?: string; sse?: string[]; hang?: boolean };
let fake: Fake = { status: 200 };
let lastBody: Record<string, unknown> | null = null;
let lastHeaders: http.IncomingHttpHeaders = {};
let aborted = false;
let server: http.Server;
let baseURL: string;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function okStream(texts: string[], stopReason = "end_turn", usage = { input: 1200, output: 7 }) {
  return [
    sse("message_start", {
      type: "message_start",
      message: {
        id: "msg_1", type: "message", role: "assistant", content: [], model: "claude-haiku-5-5",
        stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input, output_tokens: 1 },
      },
    }),
    sse("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
    ...texts.map((text) =>
      sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }),
    ),
    sse("content_block_stop", { type: "content_block_stop", index: 0 }),
    sse("message_delta", {
      type: "message_delta",
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: usage.output },
    }),
    sse("message_stop", { type: "message_stop" }),
  ];
}

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
      if (fake.hang) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(okStream(["Hola "])[0] + okStream(["Hola "])[1] + okStream(["Hola "])[2]);
        return; // no termina nunca: simula una respuesta larga
      }
      if (fake.sse) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(fake.sse.join(""));
      } else {
        res.writeHead(fake.status, { "content-type": "application/json" });
        res.end(fake.body ?? JSON.stringify({ type: "error", error: { type: "api_error", message: "x" } }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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
  model: "claude-haiku-5-5",
  maxOutputTokens: 400,
};

const provider = () => createAnthropicProvider({ apiKey: "clave-de-prueba", baseURL, maxRetries: 0 });

async function collect(iter: AsyncIterable<ChatChunk>) {
  const chunks: ChatChunk[] = [];
  for await (const c of iter) chunks.push(c);
  return chunks;
}

describe("proveedor de Anthropic", () => {
  it("emite el texto en fragmentos y termina con el consumo real", async () => {
    fake = { status: 200, sse: okStream(["Hola", " qué", " tal"]) };
    const chunks = await collect(provider().streamChat(request));
    const text = chunks.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    expect(text).toBe("Hola qué tal");
    expect(chunks.at(-1)).toEqual({
      type: "done",
      stopReason: "end",
      usage: { inputTokens: 1200, outputTokens: 7 },
    });
  });

  it("envía los parámetros correctos para Claude Haiku 5.5", async () => {
    fake = { status: 200, sse: okStream(["ok"]) };
    await collect(provider().streamChat(request));
    const body = lastBody as unknown as {
      model: string;
      max_tokens: number;
      stream: boolean;
      thinking: unknown;
      output_config: unknown;
      messages: { role: string }[];
      system: { text: string; cache_control?: unknown }[];
    };
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.max_tokens).toBe(400);
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config).toEqual({ effort: "low" });
    // Haiku 5.5 rechaza estos parámetros con un 400.
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("top_k");
    // El historial termina con un mensaje del usuario (sin "prefill").
    expect(body.messages.at(-1)?.role).toBe("user");
    // Las reglas van en bloques de sistema; el último es cacheable.
    expect(body.system.map((b) => b.text)).toEqual(["Reglas fijas", "Ficha del personaje"]);
    expect(body.system[0].cache_control).toBeUndefined();
    expect(body.system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(lastHeaders["x-api-key"]).toBe("clave-de-prueba");
  });

  it("marca la respuesta como rechazada si el modelo se niega", async () => {
    fake = { status: 200, sse: okStream([], "refusal", { input: 50, output: 0 }) };
    const chunks = await collect(provider().streamChat(request));
    expect(chunks.at(-1)).toMatchObject({ type: "done", stopReason: "refused" });
  });

  it("avisa si se corta por longitud", async () => {
    fake = { status: 200, sse: okStream(["texto"], "max_tokens") };
    expect((await collect(provider().streamChat(request))).at(-1)).toMatchObject({ stopReason: "max_tokens" });
  });

  it.each([
    [401, "misconfigured"],
    [403, "misconfigured"],
    [404, "misconfigured"],
    [429, "rate_limited"],
    [500, "unavailable"],
    [529, "unavailable"],
    [400, "unavailable"],
  ] as const)("traduce el error HTTP %i a %s", async (status, code) => {
    fake = { status, body: JSON.stringify({ type: "error", error: { type: "x", message: "secreto-interno" } }) };
    const error = await collect(provider().streamChat(request)).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe(code);
    // El mensaje de error no filtra la clave ni el contenido de la conversación.
    expect(error.message).not.toContain("clave-de-prueba");
    expect(error.message).not.toContain("Hola");
  });

  it("corta la conexión con Anthropic si quien lee deja de leer", async () => {
    fake = { status: 200, hang: true };
    const iterator = provider().streamChat(request)[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.value).toEqual({ type: "text", text: "Hola " });
    await iterator.return?.(undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(aborted).toBe(true);
  });
});
