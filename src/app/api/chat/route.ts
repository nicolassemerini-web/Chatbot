import { chatRequestSchema } from "@/lib/validation/chat";
import { AiError } from "@/server/ai/types";
import { CharacterNotFoundError, streamReply } from "@/server/conversation/engine";

const MAX_BODY_BYTES = 128 * 1024;

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return errorResponse(413, "Mensaje demasiado grande");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, "Petición no válida");
  }

  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse(400, "Petición no válida");

  const chunks = streamReply(parsed.data, request.signal);

  // Se pide el primer fragmento antes de responder para poder devolver un
  // código de error correcto si el personaje no existe o la IA falla al inicio.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    if (error instanceof CharacterNotFoundError) return errorResponse(404, error.message);
    if (error instanceof AiError) {
      console.error("[chat] error del proveedor de IA:", error.code);
      return errorResponse(503, "El personaje no puede responder ahora. Inténtalo más tarde.");
    }
    console.error("[chat] error inesperado");
    return errorResponse(500, "Error inesperado");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
        controller.close();
      } catch {
        console.error("[chat] error durante el streaming");
        controller.error(new Error("stream_error"));
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
