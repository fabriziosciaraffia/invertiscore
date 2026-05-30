import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Supabase puede redirigir con error en la query cuando el link de
  // confirmación expiró o ya se usó (ej: error=access_denied,
  // error_code=otp_expired).
  const errorParam = requestUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL("/login?confirm_error=1", request.url),
    );
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    // exchangeCodeForSession es genérico: funciona tanto para el code de OAuth
    // (Google) como para el code del link de confirmación de email de Supabase.
    // Si falla (link expirado/ya usado), redirigimos a login con aviso claro.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL("/login?confirm_error=1", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
