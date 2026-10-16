"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { deleteConversation } from "@/server/conversation/history";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export async function deleteConversationAction(slug: string): Promise<{ ok: boolean }> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false };
  const user = await requireUser(`/chat/${parsed.data}`);
  await deleteConversation(user.id, parsed.data);
  return { ok: true };
}
