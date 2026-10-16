"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { getSiteUrl } from "@/server/auth/site-url";

export type AuthFormState = { error?: string; message?: string };

const NOT_CONFIGURED: AuthFormState = {
  error: "La base de datos todavía no está configurada (ver README).",
};

function readForm(formData: FormData) {
  return {
    email: emailSchema.safeParse(formData.get("email")),
    password: passwordSchema.safeParse(formData.get("password")),
    next: safeNextPath(formData.get("next")),
  };
}

async function callbackUrl(next: string) {
  return `${await getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const { email, password, next } = readForm(formData);
  if (!email.success || !password.success) return { error: "Revisa el correo y la contraseña." };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  // Mensaje genérico: no revela si el correo existe.
  if (error) return { error: "Correo o contraseña incorrectos, o cuenta sin confirmar." };
  redirect(next);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const { email, password, next } = readForm(formData);
  if (!email.success) return { error: "Escribe un correo válido." };
  if (!password.success) return { error: "La contraseña debe tener entre 8 y 72 caracteres." };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: { emailRedirectTo: await callbackUrl(next) },
  });
  if (error) {
    console.error("[auth] error al crear la cuenta:", error.code ?? error.message);
    return { error: "No se ha podido crear la cuenta. Inténtalo de nuevo más tarde." };
  }
  // Si el proyecto no exige confirmar el correo, ya hay sesión.
  if (data.session) redirect(next);
  return {
    message: "Te hemos enviado un correo. Abre el enlace para confirmar tu cuenta.",
  };
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const { email, next } = readForm(formData);
  if (!email.success) return { error: "Escribe un correo válido." };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: await callbackUrl(next), shouldCreateUser: true },
  });
  if (error) {
    console.error("[auth] error al enviar el enlace:", error.code ?? error.message);
    return {
      error: "No se ha podido enviar el enlace. Espera un momento y vuelve a intentarlo.",
    };
  }
  return { message: "Revisa tu correo: te hemos enviado un enlace para entrar." };
}
