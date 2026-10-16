import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "./env";

/**
 * Cliente sin sesión para leer contenido público (personajes, textos). Al no
 * depender de cookies se puede usar dentro de funciones con "use cache".
 */
export function createPublicClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
