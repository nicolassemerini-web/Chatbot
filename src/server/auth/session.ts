import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

export type Profile = {
  displayName: string | null;
  adultConfirmedAt: string | null;
  termsAcceptedAt: string | null;
  plan: string;
  role: "user" | "admin";
};

/** Usuario de la sesión actual, verificado (firma y caducidad del token). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // La sesión depende de la petición: nunca se prerenderiza.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const email = data?.claims?.email;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** Perfil del usuario actual (leído con su sesión: RLS solo deja ver el propio). */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, adult_confirmed_at, terms_accepted_at, plan, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);
  if (!data) return null;
  return {
    displayName: data.display_name,
    adultConfirmedAt: data.adult_confirmed_at,
    termsAcceptedAt: data.terms_accepted_at,
    plan: data.plan,
    role: data.role === "admin" ? "admin" : "user",
  };
});

/** ¿Ha confirmado la mayoría de edad y aceptado los términos? */
export function isOnboarded(profile: Profile | null): boolean {
  return Boolean(profile?.adultConfirmedAt && profile?.termsAcceptedAt);
}

/** Exige sesión; si no la hay, envía a /entrar y vuelve después a `nextPath`. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Exige sesión y la bienvenida completada (18+ y términos). */
export async function requireOnboardedUser(
  nextPath: string,
): Promise<{ user: CurrentUser; profile: Profile }> {
  const user = await requireUser(nextPath);
  const profile = await getProfile(user.id);
  if (!profile || !isOnboarded(profile)) {
    redirect(`/bienvenida?next=${encodeURIComponent(nextPath)}`);
  }
  return { user, profile };
}
