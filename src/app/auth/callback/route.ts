import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { conNext, esDestinoSeguro } from "@/lib/auth-next";
import { guardarAtribucion } from "@/lib/attribution";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { ANON_COOKIE } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { waitUntil } from "@vercel/functions";

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

    // CompleteRegistration ya no sale acá (15-oct-2026): desde la medición para la campaña sale cuando la persona,
    // con sesión, contesta «¿Cuándo piensas comprar?» (src/lib/meta/registro.ts), en todos los caminos de alta.

    // Atribución de origen — primera mitad. Acá están las cookies del pixel
    // (_fbp/_fbc), que es lo ÚNICO del origen que viaja en este request: los UTM
    // viven en localStorage del navegador y los completa después el cliente vía
    // POST /api/attribution. La RPC es first-touch y solo rellena NULLs, así que
    // las dos escrituras se suman sin pisarse y el orden da igual.
    //
    // Sin filtro de created_at: un
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
        // El Lead ya no sale al reclamar (15-oct-2026): Lead es «dejó su correo» (/api/meta/lead, el ticket).
        await claimAnalisisAnonimos(createAdminServiceClient(), user, anonToken);
      }
    } catch (e) {
      console.error("[auth/callback] claim anónimo excepción:", e);
    }

    // La bienvenida AL REGISTRARSE (01-oct-2026), no al abrir el dashboard: quien entra por el enlace
    // del correo del código o por Google vuelve por acá. Una sola vez por persona (claim atómico de
    // ensureWelcomeEmail; si ya salió, no hace nada). En waitUntil: el correo no demora el redirect.
    try {
      const user = sessionData?.user;
      if (user?.id && user.email) {
        waitUntil(ensureWelcomeEmail(user.id, user.email, user.user_metadata ?? null));
      }
    } catch (e) {
      console.error("[auth/callback] bienvenida excepción:", e);
    }
  }

  // Honrar ?next= (intención de compra, ej /checkout?product=X; o el round-trip
  // del wizard). `esDestinoSeguro` solo acepta paths relativos: evita el open
  // redirect a dominios externos.
  const dest = esDestinoSeguro(next) ? next : "/dashboard";

  return NextResponse.redirect(new URL(dest, request.url));
}
