// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lo-que-sigue/pack (28-sep-2026): el correo va adentro del ticket y el botón rojo va
// directo a Flow, sin salir del informe. Con el correo: la cuenta se crea si no existe (sin
// contraseña), ESTE informe anónimo pasa a esa cuenta (el claim de siempre, por la cookie), y se
// abre la orden en Flow a nombre de esa persona. Vigencia del pack validada acá (410).
// Después de pagar, /payments/return sin sesión explica cómo entrar (código al correo).
// MEDICIÓN (15-oct-2026): dejar el correo en el ticket es un Lead de Meta (servidor + pixel, mismo id por correo), la
// cuenta queda con la puerta A (el informe), y su navegador queda guardado para que la compra —que confirma el
// webhook de Flow, sin cookies— llegue a Meta con fbp, fbc, IP y navegador.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { flowPost } from "@/lib/flow";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { firmarPago } from "@/lib/lo-que-sigue/firma-pago";
import { ofertaPackVigente, PRODUCTO_PACK, urlRetornoPack } from "@/lib/lo-que-sigue/oferta-pack";
import { eventoPackVencido } from "@/lib/lo-que-sigue/eventos-servidor";
import { capturarServidor, distinctIdDeCorreo } from "@/lib/posthog-servidor";
import { readVeredicto } from "@/lib/results-helpers";
import { captureApiError } from "@/lib/observabilidad";
import { waitUntil } from "@vercel/functions";
import { EVENTOS_META, idLead } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta, guardarContextoMeta } from "@/lib/meta/servidor";
import { guardarAtribucion } from "@/lib/attribution";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { cookieInvitacionDeCabeceras, vincularInvitacion } from "@/lib/referido-servidor";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";

export const dynamic = "force-dynamic";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; analysisId?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const analysisId = body.analysisId ?? "";
  if (!CORREO_OK.test(email)) return NextResponse.json({ error: "Ese correo no se entiende. Revísalo." }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(analysisId)) return NextResponse.json({ error: "El pack va con tu informe" }, { status: 400 });

  const admin = createServiceClient();
  const { data: analysis } = await admin.from("analisis").select("user_id, created_at, results, tipo_analisis").eq("id", analysisId).single();
  if (!analysis?.created_at) return NextResponse.json({ error: "No existe ese informe" }, { status: 404 });
  const veredicto = readVeredicto(analysis.results as never) ?? null;

  if (!ofertaPackVigente(analysis.created_at as string)) {
    try {
      await capturarServidor({ ...eventoPackVencido({ userId: distinctIdDeCorreo(email), analysisId, veredicto }), correo: email });
    } catch (e) {
      console.error("[lo-que-sigue/pack] pack_vencido excepción:", e);
    }
    return NextResponse.json({ error: "pack_vencido" }, { status: 410 });
  }

  try {
    // La cuenta: generateLink crea al usuario si no existe y devuelve su fila; NO manda correo.
    const { data: enlace, error: errUsuario } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(`/analisis/${analysisId}`)}` },
    });
    const user = enlace?.user;
    if (errUsuario || !user) {
      captureApiError(errUsuario, { ruta: "POST /api/lo-que-sigue/pack", operacion: "cuenta-por-correo" });
      return NextResponse.json({ error: "No pudimos crear tu cuenta con ese correo. Intenta de nuevo." }, { status: 500 });
    }
    const contexto = contextoDeRequest(request);
    const lead = await emitirEventoMeta(admin, {
      evento: EVENTOS_META.lead,
      eventId: await idLead(email),
      userId: user.id,
      email,
      datos: { origen: "ticket", puerta: "A" },
      contexto,
      origen: "lead:ticket",
    });
    waitUntil(lead.envio);
    waitUntil(guardarContextoMeta(admin, user.id, contexto));
    // La invitación (16-oct-2026, la puerta C): si abrió un «/i/CÓDIGO», la cuenta que nace acá se liga a quien la invitó
    // antes de la puerta A (el premio se paga cuando conteste el «cuándo» con sesión).
    const cookieInv = cookieInvitacionDeCabeceras(request.headers);
    if (cookieInv) await vincularInvitacion(admin, { userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella: huellaDeRequest(request) });
    waitUntil(guardarAtribucion(admin, user.id, { puerta: "A", puerta_detalle: "ticket", fbp: contexto.fbp, fbc: contexto.fbc }).then(() => undefined));
    // El correo del día (20-oct-2026, toda puerta): la cuenta que nace con el ticket también lo recibe dentro de la hora.
    await encolarPrimeraSeleccion(admin, user, { sitio: SITE_URL, enSegundoPlano: waitUntil, ruta: "POST /api/lo-que-sigue/pack" });

    // Este informe tiene que ser suyo: o ya lo era, o lo adopta ahora por la cookie del cap anónimo.
    if (analysis.user_id && analysis.user_id !== user.id) {
      return NextResponse.json({ error: "Ese informe ya tiene dueño." }, { status: 403 });
    }
    if (!analysis.user_id) {
      const token = tokenAnonDelRequest();
      const claim = token ? await claimAnalisisAnonimos(admin, user, token) : { claimed: 0, redirect: null };
      if (claim.claimed === 0) {
        return NextResponse.json({ error: "No pudimos ligar este informe a tu correo." }, { status: 403 });
      }
    }

    if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) {
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 });
    }
    const producto = FLOW_PRODUCTS[PRODUCTO_PACK];
    const commerceOrder = `franco-${randomUUID()}`;
    const flowResponse = await flowPost("payment/create", {
      commerceOrder,
      subject: producto.subject,
      currency: "CLP",
      amount: producto.amount,
      email,
      paymentMethod: 9,
      urlConfirmation: `${SITE_URL}/api/payments/confirm`,
      // Con la firma del pago: /payments/return verifica el pago y dice el saldo real sin sesión (02-oct-2026). El informe,
      // su veredicto y su modalidad los devuelve el estado del pago (22-oct-2026, lib/compra/retorno-flow.ts).
      urlReturn: urlRetornoPack(SITE_URL, commerceOrder, firmarPago(commerceOrder)),
    });
    if (!flowResponse.url || !flowResponse.token) {
      return NextResponse.json({ error: "Error al crear la orden de pago" }, { status: 500 });
    }
    const { error: insertError } = await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: commerceOrder,
      flow_order: flowResponse.flowOrder || null,
      product: PRODUCTO_PACK,
      amount: producto.amount,
      quantity: 1,
      status: "pending",
      analysis_id: analysisId,
      payment_data: { origen: "lo_que_sigue_ticket" },
    });
    if (insertError) {
      captureApiError(insertError, { ruta: "POST /api/lo-que-sigue/pack", operacion: "insert-payment", userId: user.id });
      return NextResponse.json({ error: "Error al registrar el pago" }, { status: 500 });
    }
    return conEspejo(NextResponse.json({ url: `${flowResponse.url}?token=${flowResponse.token}` }), [lead.espejo], request);
  } catch (err) {
    captureApiError(err, { ruta: "POST /api/lo-que-sigue/pack", operacion: "pack-desde-el-ticket" });
    return NextResponse.json({ error: "No pudimos abrir el pago. Intenta de nuevo." }, { status: 500 });
  }
}
