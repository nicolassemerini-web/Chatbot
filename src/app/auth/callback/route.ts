import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "magiclink", "email", "recovery", "invite", "email_change"];

/** Destino de los enlaces de los correos de Supabase (confirmación y acceso). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const failure = NextResponse.redirect(new URL(`/entrar?error=enlace&next=${encodeURIComponent(next)}`, url));
  if (!isSupabaseConfigured()) return failure;

  const supabase = await createSessionClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  return ok ? NextResponse.redirect(new URL(next, url)) : failure;
}
