// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisis/claim — adopción de análisis anónimos (F2-2)
//
// Requiere sesión. Lee la cookie httpOnly `franco_anon` (viaja sola en el
// request; el client no la ve ni la manda) y delega en el núcleo compartido
// `claimAnalisisAnonimos`. Sin cookie → { claimed: 0 } rápido: los call-sites
// (login, register, red de seguridad del provider) lo llaman a ciegas.
//
// LA PUERTA (15-oct-2026): el formulario que reclama manda por dónde entró la cuenta (`{ puerta, puertaDetalle }`:
// el banner del informe y la tarjeta de la guía mandan A) y queda en `user_attribution` (atribucion-puerta.ts).
// El Lead de Meta ya no sale acá: desde el 15-oct-2026 Lead es «dejó su correo» (/api/meta/lead, el ticket).
//
// BIENVENIDA AL REGISTRARSE POR CÓDIGO (01-oct-2026): con `{ porCodigo: true }` en el body —lo mandan
// los formularios del código justo después de verifyOtp— también sale `ensureWelcomeEmail` (una sola
// vez por persona, claim atómico), en waitUntil y ANTES del atajo sin cookie: quien entra por código
// sin informe anónimo también recibe su bienvenida.
//
// EL REGALO AL REGISTRARSE (16-oct-2026, regalo-alta.ts): toda cuenta nueva pasa por acá después del código (banner,
// /entrar, guía) y recibe su análisis de regalo, con los topes por dispositivo, IP y día. Antes de responder: la
// pantalla que sigue ya lo muestra. Una cuenta de antes del corte no hace ninguna consulta.
//
// LA INVITACIÓN (16-oct-2026, la puerta C): si el navegador trae la cookie de un «/i/CÓDIGO», la cuenta se liga a quien la
// invitó ANTES de la puerta del formulario —la del referido es la que queda— y la cookie queda «usada» en la respuesta.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { guardarAtribucion } from "@/lib/attribution";
import { esPuerta } from "@/lib/atribucion-puerta";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";
import { asegurarRegaloDeAlta, huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { emitirRegistroAlCrear } from "@/lib/meta/registro";
import { conEspejo, contextoDeRequest } from "@/lib/meta/servidor";
import { COOKIE_INVITACION_USADA, cookieInvitacionDeCabeceras, VINCULO_TERMINADO, vincularInvitacion, type ResultadoVinculo } from "@/lib/referido-servidor";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

/** La cookie de la invitación ya se cobró: queda «usada» en la respuesta. */
function cerrarInvitacion(res: NextResponse, vinculo: ResultadoVinculo | null): NextResponse {
  if (vinculo && VINCULO_TERMINADO.has(vinculo)) res.cookies.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
  return res;
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const cuerpo = (await request.json().catch(() => null)) as { porCodigo?: unknown; puerta?: unknown; puertaDetalle?: unknown } | null;
    const cookieInv = cookieInvitacionDeCabeceras(request.headers);
    const vinculo = cookieInv
      ? await vincularInvitacion(createAdminServiceClient(), { userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella: huellaDeRequest(request) })
      : null;
    // El regalo antes de la bienvenida: el correo lo dice (welcome.ts).
    await asegurarRegaloDeAlta(createAdminServiceClient(), {
      userId: user.id, creadaAt: user.created_at, huella: huellaDeRequest(request), puerta: esPuerta(cuerpo?.puerta) ? cuerpo.puerta : null,
    });
    // CompleteRegistration al crear la cuenta (22-oct-2026, meta/registro.ts): la puerta A (o la que traiga el reclamo).
    const registro = await emitirRegistroAlCrear(createAdminServiceClient(), user, contextoDeRequest(request), { origen: "claim", puerta: esPuerta(cuerpo?.puerta) ? cuerpo.puerta : null });
    if (registro) waitUntil(registro.envio);
    const puerta = cuerpo?.puerta;
    if (esPuerta(puerta)) {
      const detalle = typeof cuerpo?.puertaDetalle === "string" ? cuerpo.puertaDetalle.slice(0, 60) : null;
      waitUntil(guardarAtribucion(createAdminServiceClient(), user.id, { puerta, puerta_detalle: detalle }).then(() => undefined));
    }

    // El informe anónimo pasa a la cuenta PRIMERO: el correo del día y la primera selección buscan con el perfil de ese
    // informe (visto en el QA del 20-oct-2026: encolado antes del reclamo, la primera vuelta salía vacía).
    const token = tokenAnonDelRequest();
    const result = token ? await claimAnalisisAnonimos(createAdminServiceClient(), user, token) : { claimed: 0, redirect: null };
    // LA PRIMERA SELECCIÓN Y EL CORREO DEL DÍA (20-oct-2026, toda puerta): la cuenta nueva queda con su correo del día en
    // cola (la primera vuelta en el momento) ANTES de la bienvenida, que así ya no sale: su bienvenida es ese correo.
    await encolarPrimeraSeleccion(createAdminServiceClient(), user, { sitio: SITIO, enSegundoPlano: waitUntil, ruta: "POST /api/analisis/claim" });
    if (cuerpo?.porCodigo === true && user.email) {
      waitUntil(ensureWelcomeEmail(user.id, user.email, user.user_metadata ?? null));
    }
    return conEspejo(cerrarInvitacion(NextResponse.json(result), vinculo), [registro?.espejo], request);
  } catch (error) {
    captureApiError(error, { ruta: "POST /api/analisis/claim", operacion: "claim-anonimo" });
    // Fail-soft: un claim caído no debe romper el flujo de auth del caller.
    // La red de seguridad del provider lo reintenta en la próxima carga.
    return NextResponse.json({ claimed: 0, redirect: null });
  }
}
