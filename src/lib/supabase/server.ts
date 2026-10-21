import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "./env";

/**
 * Cliente con la sesión del usuario (cookies). Respeta las políticas RLS:
 * solo ve lo que el usuario tiene permitido ver.
 */
export async function createSessionClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el
          // refresco de la sesión lo hace src/proxy.ts en cada petición.
        }
      },
    },
  });
}
