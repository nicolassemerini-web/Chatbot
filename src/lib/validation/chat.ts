import { z } from "zod";
import { MAX_MESSAGE_CHARS } from "./limits";

/**
 * Cuerpo de POST /api/chat. El historial ya no viaja desde el navegador: se lee
 * de la base de datos, así que el cliente solo envía el mensaje nuevo.
 */
export const chatRequestSchema = z.object({
  characterSlug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;
