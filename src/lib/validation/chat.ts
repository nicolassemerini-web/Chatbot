import { z } from "zod";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS } from "./limits";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

/**
 * Cuerpo de POST /api/chat. En la Fase 1 el historial viaja desde el navegador;
 * en la Fase 2 se leerá de la base de datos y el cliente solo enviará el
 * mensaje nuevo.
 */
export const chatRequestSchema = z
  .object({
    characterSlug: z.string().regex(/^[a-z0-9-]{1,40}$/),
    messages: z.array(messageSchema).min(1).max(MAX_HISTORY_MESSAGES),
  })
  .refine((body) => body.messages.at(-1)?.role === "user", {
    message: "El último mensaje debe ser del usuario",
    path: ["messages"],
  });

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;
