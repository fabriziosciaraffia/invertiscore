import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { conNext, esDestinoSeguro } from "@/lib/auth-next";
import { guardarAtribucion } from "@/lib/attribution";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { ANON_COOKIE } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos, enviarLeadClaim } from "@/lib/anon-claim";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Se lee ANTES de las salidas de error: un link de confirmación vencido
  // también tiene que devolver al usuario a donde iba, no al dashboard.
  const next = requestUrl.searchParams.get("next");

  /** /login con el aviso de error, conservando la intención de destino. */
  const loginConError = () => {
    const u = new URL("/login", request.url);
    u.searchParams.set("confirm_error", "1");
    return NextResponse.redirect(conNext(u, next));
  };
  // Supabase puede redirigir con error en la query cuando el link de
  // confirmación expiró o ya se usó (ej: error=access_denied,
  // error_code=otp_expired).
  const errorParam = requestUrl.searchParams.get("error");

  if (errorParam) {
    return loginConError();
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
      return loginConError();
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

    // Atribución de origen — primera mitad. Acá están las cookies del pixel
    // (_fbp/_fbc), que es lo ÚNICO del origen que viaja en este request: los UTM
    // viven en localStorage del navegador y los completa después el cliente vía
    // POST /api/attribution. La RPC es first-touch y solo rellena NULLs, así que
    // las dos escrituras se suman sin pisarse y el orden da igual.
    //
    // Sin filtro de created_at (a diferencia del bloque de CAPI de arriba): un
    // login recurrente no crea fila nueva ni cambia la existente —la RPC no
    // toca lo ya seteado—, y en cambio permite recuperar la atribución de
    // alguien que se registró antes de que esto existiera.
    //
    // Bloque aislado con el mismo criterio que CAPI: perder una atribución es
    // molesto, romper un login es grave.
    try {
      const user = sessionData?.user;
      if (user?.id) {
        await guardarAtribucion(createAdminServiceClient(), user.id, {
          fbp: cookieStore.get("_fbp")?.value ?? null,
          fbc: cookieStore.get("_fbc")?.value ?? null,
        });
      }
    } catch (e) {
      console.error("[auth/callback] atribución excepción:", e);
    }

    // Claim de análisis anónimos (F2-2): si este navegador creó un análisis
    // sin registro, la sesión recién creada lo adopta ANTES del redirect — el
    // destino (dashboard o el análisis vía ?next=) ya nace con la fila a su
    // nombre. Cubre OAuth y confirmación de email; los logins por password lo
    // hacen client-side. Mismo criterio de aislamiento que CAPI/atribución:
    // perder un claim acá es recuperable (red de seguridad del provider),
    // romper un login no.
    try {
      const user = sessionData?.user;
      const anonToken = cookieStore.get(ANON_COOKIE)?.value;
      if (user?.id && anonToken) {
        const result = await claimAnalisisAnonimos(createAdminServiceClient(), user, anonToken);
        if (result.claimed > 0) {
          // Lead de Meta (decisión 3 F2-1): el gratis se estrenó al reclamar.
          // Awaiteado (route handler sin waitUntil importado acá no lo
          // necesita: enviarLeadClaim ya traga sus errores y Meta tiene
          // timeout corto en el helper).
          await enviarLeadClaim(user, {
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
      console.error("[auth/callback] claim anónimo excepción:", e);
    }
  }

  // Honrar ?next= (intención de compra, ej /checkout?product=X; o el round-trip
  // del wizard). `esDestinoSeguro` solo acepta paths relativos: evita el open
  // redirect a dominios externos.
  const dest = esDestinoSeguro(next) ? next : "/dashboard";

  return NextResponse.redirect(new URL(dest, request.url));
}
