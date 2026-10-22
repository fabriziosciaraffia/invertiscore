import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { conNext, esDestinoSeguro } from "@/lib/auth-next";
import { guardarAtribucion } from "@/lib/attribution";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { ANON_COOKIE } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { asegurarRegaloDeAlta, huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { claveDeDestino } from "@/lib/deptos/respuesta";
import { leerPendiente, reclavarPendienteGoogle } from "@/lib/deptos/servidor";
import { metodoDeEntrada } from "@/lib/deptos/entrada";
import { registrarEntrada } from "@/lib/deptos/entrada-servidor";
import { COOKIE_INVITACION_USADA, VINCULO_TERMINADO, vincularInvitacion } from "@/lib/referido-servidor";
import { waitUntil } from "@vercel/functions";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";
import { destinoRecienDentro, esCuentaNueva } from "@/lib/guia/del-dia";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  /** La cuenta acaba de nacer (20-oct-2026): su informe la recibe como recién dentro. */
  let recienDentro = false;
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

    // VUELVE DE GOOGLE DESDE /deptos (16-oct-2026): lo elegido antes de salir estaba guardado con una clave (el destino
    // la trae); ahora que se sabe el correo, pasa a su nombre. Antes de la bienvenida —que no sale a la cuenta de /deptos:
    // su bienvenida es el correo del día— y antes del alta, que lo lee por correo como si hubiera entrado por código.
    try {
      const clave = claveDeDestino(next);
      const user = sessionData?.user;
      if (clave && user?.email) await reclavarPendienteGoogle(createAdminServiceClient(), { clave, correo: user.email, cuentaCreadaAt: user.created_at });
    } catch (e) {
      console.error("[auth/callback] lo elegido en /deptos:", e);
    }
    // LA ENTRADA A /deptos POR EL ENLACE O POR GOOGLE (22-oct-2026): queda registrada (deptos_entradas) si hay algo elegido
    // a su nombre; si el alta no llega dentro del minuto, cuenta como `alta_perdida` (lib/deptos/entrada-servidor.ts).
    try {
      const metodo = metodoDeEntrada(next);
      const user = sessionData?.user;
      if (metodo && user?.email) {
        const adminEntrada = createAdminServiceClient();
        if (await leerPendiente(adminEntrada, user.email)) await registrarEntrada(adminEntrada, { correo: user.email, userId: user.id, metodo });
      }
    } catch (e) {
      console.error("[auth/callback] entrada de /deptos:", e);
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

    // LA INVITACIÓN (16-oct-2026, la puerta C, referido-servidor.ts): si abrió un «/i/CÓDIGO» en los últimos 30 días, la
    // cuenta queda ligada a quien la invitó —y con la puerta C— antes del regalo y del destino. Hecho eso, la cookie se
    // marca «usada»: otra cuenta creada en este navegador no se cobra el mismo código.
    try {
      const user = sessionData?.user;
      const cookieInv = cookieStore.get(COOKIE_INVITACION_USADA.name)?.value ?? null;
      if (user?.id && cookieInv) {
        const vinculo = await vincularInvitacion(createAdminServiceClient(), {
          userId: user.id, creadaAt: user.created_at, cookie: cookieInv,
          huella: huellaDeCabeceras(request.headers, cookieStore.get(COOKIE_DISPOSITIVO)?.value ?? null),
        });
        if (VINCULO_TERMINADO.has(vinculo)) cookieStore.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
      }
    } catch (e) {
      console.error("[auth/callback] invitación excepción:", e);
    }

    // El regalo al registrarse (16-oct-2026, regalo-alta.ts): antes del redirect, así el destino ya lo muestra.
    try {
      const user = sessionData?.user;
      if (user?.id) {
        await asegurarRegaloDeAlta(createAdminServiceClient(), {
          userId: user.id, creadaAt: user.created_at, huella: huellaDeCabeceras(request.headers, cookieStore.get(COOKIE_DISPOSITIVO)?.value ?? null),
        });
      }
    } catch (e) {
      console.error("[auth/callback] regalo excepción:", e);
    }

    // LA PRIMERA SELECCIÓN Y EL CORREO DEL DÍA (20-oct-2026, toda puerta): la cuenta nueva que vuelve por Google o por el
    // enlace del correo queda con su correo del día en cola, antes de la bienvenida (que así no sale). La que vuelve a
    // /deptos o a la página del invitado no: /api/deptos/alta la encola con su perfil de los chips. Y si vuelve a su
    // informe, llega con `?dentro=1`: el informe la trata como recién dentro —«Estás dentro» y la selección sobre él—.
    try {
      const user = sessionData?.user;
      if (user?.id && !claveDeDestino(next)) {
        await encolarPrimeraSeleccion(createAdminServiceClient(), user, { sitio: SITIO, enSegundoPlano: waitUntil, ruta: "GET /auth/callback" });
      }
      if (user?.id) recienDentro = esCuentaNueva(user.created_at);
    } catch (e) {
      console.error("[auth/callback] primera selección excepción:", e);
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

  return NextResponse.redirect(new URL(destinoRecienDentro(dest, recienDentro), request.url));
}
