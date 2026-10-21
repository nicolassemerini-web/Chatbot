import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

/**
 * Cliente con la clave SECRETA: salta las políticas RLS. Úsalo solo en el
 * servidor y filtrando siempre por el usuario ya verificado. Se usa para lo que
 * el navegador nunca debe poder hacer por sí mismo: escribir mensajes y
 * conversaciones (y, más adelante, consumo y tareas de mantenimiento).
 */
export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY en las variables de entorno del servidor");
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
