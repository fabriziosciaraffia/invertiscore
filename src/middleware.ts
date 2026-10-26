import { updateSession } from "@/lib/supabase/middleware";
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import {
  CABECERA_VISITA, cuentaDeCookieDeSesion, enviarVista, esCargaDePagina, esVisitaDePrueba, eventoVistaEntrada, idDeLaVisita, idPostHogDeCookies, paginaDeEntrada, serverTimingDeVisita,
} from "@/lib/vista-entrada";
import { COOKIE_FBC, COOKIE_PRUEBA, VIDA_FBC_S, VIDA_PRUEBA_S, cookiesDeLlegada } from "@/lib/meta/cookies";
import { COOKIE_DISPOSITIVO, VIDA_DISPOSITIVO_S, dispositivoValido } from "@/lib/dispositivo";
import { COOKIE_INVITACION, VIDA_COOKIE_INVITACION_S, normalizarCodigo, valorCookieInvitacion } from "@/lib/referido";
import { conPermiso, consentimientoDeCookie } from "@/lib/consentimiento";
import { COOKIE_NAVEGADOR, VIDA_COOKIE_NAVEGADOR_S, almacenSupabase, navegadorDeSesion } from "@/lib/agentes-navegador";
import { createServiceClient } from "@/lib/supabase/service";

/** Rutas que pasan por acá solo por la medición (15-oct-2026): sin sesión que refrescar. Los anuncios llegan a `/`. */
const SOLO_MEDICION = new Set(["/", "/demo", "/metodologia"]);

/**
 * La medición en la llegada (15-oct-2026, src/lib/meta/cookies.ts): guarda el clic del anuncio (`_fbc`, con el
 * `fbclid` de la URL) aunque el pixel no alcance a cargar, y prende o apaga el modo prueba de los eventos del
 * servidor (`?meta_prueba=1|0`). Y el dispositivo (16-oct-2026, src/lib/dispositivo.ts): el id para el tope de regalos.
 * Y la invitación (16-oct-2026, la puerta C, src/lib/referido.ts): abrir «/i/CÓDIGO» deja el código 30 días, con la hora;
 * se cobra al registrarse, venga por donde venga. Si el navegador ya tiene una (o la usó: «usada»), se queda esa.
 */
function conMedicion(request: NextRequest, res: NextResponse): NextResponse {
  const c = cookiesDeLlegada({
    search: request.nextUrl.search,
    host: request.headers.get("host"),
    fbcActual: request.cookies.get(COOKIE_FBC)?.value ?? null,
    ahoraMs: Date.now(),
  });
  // El `_fbc` es del pixel de Meta: solo con el «si» del aviso de cookies (19-oct-2026, lib/consentimiento.ts). Sin
  // elección, el clic se guarda si la persona acepta con la URL del anuncio todavía abierta (MetaPixel).
  if (c.fbc && conPermiso(consentimientoDeCookie(request.headers.get("cookie")))) res.cookies.set(COOKIE_FBC, c.fbc.valor, { path: "/", maxAge: VIDA_FBC_S, sameSite: "lax", ...(c.fbc.dominio ? { domain: c.fbc.dominio } : {}) });
  if (c.prueba === "prender") res.cookies.set(COOKIE_PRUEBA, "1", { path: "/", maxAge: VIDA_PRUEBA_S, sameSite: "lax" });
  if (c.prueba === "apagar") res.cookies.set(COOKIE_PRUEBA, "", { path: "/", maxAge: 0 });
  if (!dispositivoValido(request.cookies.get(COOKIE_DISPOSITIVO)?.value)) {
    res.cookies.set(COOKIE_DISPOSITIVO, crypto.randomUUID(), { path: "/", maxAge: VIDA_DISPOSITIVO_S, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  }
  const invitacion = request.nextUrl.pathname.startsWith("/i/") ? normalizarCodigo(request.nextUrl.pathname.slice(3).split("/")[0]) : null;
  if (invitacion && !request.cookies.has(COOKIE_INVITACION)) {
    res.cookies.set(COOKIE_INVITACION, valorCookieInvitacion(invitacion, Date.now()), { path: "/", maxAge: VIDA_COOKIE_INVITACION_S, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  }
  return res;
}

/**
 * LA VISTA DE LAS PÁGINAS DE ENTRADA (20-oct-2026, src/lib/vista-entrada.ts): la landing, /deptos y /i/CÓDIGO llevan un id
 * de visita que el navegador recibe en `Server-Timing` —con él arranca PostHog— y la página de /i/, en `x-franco-visita`.
 * La landing y /deptos emiten acá su vista; /i/ la emite su página, que sabe el modo. Sin demorar la respuesta.
 */
function conVista(request: NextRequest, res: NextResponse, event: NextFetchEvent | undefined, visita: string | null, persona: { id: string } | null = null): NextResponse {
  const pagina = paginaDeEntrada(request.nextUrl.pathname);
  if (!pagina || !visita) return res;
  const consentimiento = consentimientoDeCookie(request.headers.get("cookie"));
  const idPostHog = idPostHogDeCookies(request.cookies.getAll(), process.env.NEXT_PUBLIC_POSTHOG_KEY);
  res.headers.append("Server-Timing", serverTimingDeVisita(idDeLaVisita({ userId: null, consentimiento, idPostHog, visita }).id));
  if (pagina === "invitacion") return res;
  const ev = eventoVistaEntrada({
    pagina,
    ruta: request.nextUrl.pathname,
    search: request.nextUrl.search,
    referer: request.headers.get("referer"),
    userId: null,
    consentimiento,
    idPostHog,
    visita,
    esCarga: esCargaDePagina(request.headers),
    agente: request.headers.get("user-agent"),
    cabeceras: request.headers,
    prueba: esVisitaDePrueba(request.nextUrl.search, request.cookies.get(COOKIE_PRUEBA)?.value),
    // La marca de cuenta de prueba (21-oct-2026): la sesión que leyó el middleware, o en la landing (que no la lee) la
    // cookie de Supabase, sin verificar: solo marca la vista.
    cuentaDeSesion: persona?.id ?? cuentaDeCookieDeSesion(request.cookies.getAll()),
  });
  if (ev && event) event.waitUntil(enviarVista(ev).catch(() => false));
  return res;
}

/**
 * EL NAVEGADOR DE QUIEN TIENE SESIÓN (20-oct-2026, src/lib/agentes-navegador.ts): ningún evento del servidor sale sin
 * el agente del navegador de la persona, y los de quien Franco todavía no vio esperan en una cola. Al navegar con sesión
 * por la app, una vez por navegador y cuenta (la cookie guarda una marca), su agente queda anotado y sale lo que lo
 * esperaba. Sin demorar la respuesta.
 */
function conNavegador(request: NextRequest, res: NextResponse, event: NextFetchEvent | undefined, persona: { id: string; email?: string | null } | null): NextResponse {
  const nav = navegadorDeSesion({ persona, cabeceras: request.headers, marcaActual: request.cookies.get(COOKIE_NAVEGADOR)?.value });
  if (!nav || !event) return res;
  res.cookies.set(COOKIE_NAVEGADOR, nav.marca, { path: "/", maxAge: VIDA_COOKIE_NAVEGADOR_S, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  event.waitUntil(nav.anotar(almacenSupabase(createServiceClient)).catch(() => 0));
  return res;
}

/** El pedido con el id de la visita para la página (pisa cualquiera que traiga). */
function conVisitaEnCabecera(request: NextRequest, visita: string): NextRequest {
  const h = new Headers(request.headers);
  h.set(CABECERA_VISITA, visita);
  return new NextRequest(request, { headers: h });
}

export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  // Flow.cl redirige via POST después del pago → convertir a GET.
  // Preservamos el query string (?order=commerceOrder que pone create) para que
  // /payments/return identifique la compra exacta vía /api/payments/status?order=.
  if (request.nextUrl.pathname === "/payments/return" && request.method === "POST") {
    const url = new URL("/payments/return" + request.nextUrl.search, request.url);
    return NextResponse.redirect(url, 303);
  }

  const pagina = paginaDeEntrada(request.nextUrl.pathname);
  const visita = pagina ? crypto.randomUUID() : null;
  const req = pagina === "invitacion" && visita ? conVisitaEnCabecera(request, visita) : request;

  if (SOLO_MEDICION.has(req.nextUrl.pathname)) return conVista(req, conMedicion(req, NextResponse.next()), event, visita);

  // Timeout guard: si updateSession tarda >5s, dejar pasar sin bloquear
  const timeout = new Promise<NextResponse>((resolve) =>
    setTimeout(() => resolve(NextResponse.next({ request: req })), 5000)
  );
  let persona: { id: string; email?: string | null } | null = null;
  const res = await Promise.race([updateSession(req, (u) => { persona = u; }), timeout]);
  return conVista(req, conMedicion(req, conNavegador(req, res, event, persona)), event, visita, persona);
}

export const config = {
  matcher: ["/", "/demo", "/metodologia", "/dashboard/:path*", "/explorar", "/analisis/:path*", "/login", "/register", "/entrar", "/deptos", "/i/:path*", "/pricing", "/auth/callback", "/payments/return"],
};
