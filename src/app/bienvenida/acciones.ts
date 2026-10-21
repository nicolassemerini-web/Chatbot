"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSessionClient } from "@/lib/supabase/server";
import { welcomeSchema } from "@/lib/validation/auth";
import { requireUser } from "@/server/auth/session";

export type WelcomeState = { error?: string };

export async function completeWelcome(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const next = safeNextPath(formData.get("next"));
  const user = await requireUser("/bienvenida");

  const parsed = welcomeSchema.safeParse({
    displayName: formData.get("displayName"),
    adult: formData.get("adult"),
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    return { error: "Escribe un nombre (máx. 40 caracteres) y marca las dos casillas." };
  }

  // Se guarda con la sesión del usuario: RLS solo le deja tocar su perfil y
  // los permisos de columna impiden cambiar el plan o el rol.
  const now = new Date().toISOString();
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      adult_confirmed_at: now,
      terms_accepted_at: now,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[bienvenida] no se pudo guardar el perfil:", error.message);
    return { error: "No se ha podido guardar. Inténtalo de nuevo." };
  }
  redirect(next);
}
