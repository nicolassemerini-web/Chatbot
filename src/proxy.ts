import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/**
 * Refresca la sesión de Supabase en cada petición y la guarda en cookies.
 * No decide permisos: eso se comprueba en cada página, acción y ruta.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabasePublicEnv();

  // Si la dirección de retorno no está autorizada en Supabase, los enlaces de
  // los correos vuelven a la página de inicio con ?code=…: se reconducen a la
  // ruta que completa el acceso.
  const url = request.nextUrl;
  if (env && url.pathname === "/" && (url.searchParams.has("code") || url.searchParams.has("token_hash"))) {
    const callback = url.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Valida el token y, si ha caducado, lo renueva (escribe cookies nuevas).
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Todo salvo archivos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
