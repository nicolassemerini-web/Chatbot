import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(72);

export const welcomeSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  adult: z.literal("on"),
  terms: z.literal("on"),
});
