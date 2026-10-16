import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_FBC, COOKIE_PRUEBA, VIDA_FBC_S, VIDA_PRUEBA_S, cookiesDeLlegada } from "@/lib/meta/cookies";
import { COOKIE_DISPOSITIVO, VIDA_DISPOSITIVO_S, dispositivoValido } from "@/lib/dispositivo";
import { COOKIE_INVITACION, VIDA_COOKIE_INVITACION_S, normalizarCodigo, valorCookieInvitacion } from "@/lib/referido";

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
  if (c.fbc) res.cookies.set(COOKIE_FBC, c.fbc.valor, { path: "/", maxAge: VIDA_FBC_S, sameSite: "lax", ...(c.fbc.dominio ? { domain: c.fbc.dominio } : {}) });
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

export async function middleware(request: NextRequest) {
  // Flow.cl redirige via POST después del pago → convertir a GET.
  // Preservamos el query string (?order=commerceOrder que pone create) para que
  // /payments/return identifique la compra exacta vía /api/payments/status?order=.
  if (request.nextUrl.pathname === "/payments/return" && request.method === "POST") {
    const url = new URL("/payments/return" + request.nextUrl.search, request.url);
    return NextResponse.redirect(url, 303);
  }

  if (SOLO_MEDICION.has(request.nextUrl.pathname)) return conMedicion(request, NextResponse.next());

  // Timeout guard: si updateSession tarda >5s, dejar pasar sin bloquear
  const timeout = new Promise<NextResponse>((resolve) =>
    setTimeout(() => resolve(NextResponse.next()), 5000)
  );
  return conMedicion(request, await Promise.race([updateSession(request), timeout]));
}

export const config = {
  matcher: ["/", "/demo", "/metodologia", "/dashboard/:path*", "/analisis/:path*", "/login", "/register", "/entrar", "/deptos", "/i/:path*", "/pricing", "/auth/callback", "/payments/return"],
};
