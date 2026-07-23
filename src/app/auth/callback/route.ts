import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/meta/capi";

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
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL("/login?confirm_error=1", request.url),
      );
    }

    // Meta CAPI: CompleteRegistration SOLO en altas nuevas. Este route sirve tanto
    // a la confirmación de email como al primer login OAuth (Google), pero también
    // a logins de usuarios existentes vía OAuth — filtramos por created_at reciente
    // (~10 min) para disparar solo en el alta y excluir logins recurrentes.
    // event_id = reg-<userId> (idempotencia si Supabase reintenta el callback).
    // Este request SÍ trae cookies/IP/UA del navegador → mejor match que los
    // webhooks. Bloque aislado: una falla de Meta jamás rompe el flujo de auth.
    try {
      const user = sessionData?.user;
      if (user?.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        if (ageMs >= 0 && ageMs < 10 * 60 * 1000) {
          await sendMetaCapiEvent({
            eventName: "CompleteRegistration",
            eventId: `reg-${user.id}`,
            email: user.email ?? null,
            eventSourceUrl: requestUrl.origin,
            clientIp:
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
              request.headers.get("x-real-ip"),
            userAgent: request.headers.get("user-agent"),
            fbp: cookieStore.get("_fbp")?.value ?? null,
            fbc: cookieStore.get("_fbc")?.value ?? null,
          });
        }
      }
    } catch (e) {
      console.error("[auth/callback] Meta CAPI CompleteRegistration excepción:", e);
    }
  }

  // Honrar ?next= (intención de compra, ej /checkout?product=X). Solo paths
  // relativos (empiezan con "/") para evitar open redirect a dominios externos.
  const next = requestUrl.searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/dashboard";

  return NextResponse.redirect(new URL(dest, request.url));
}
