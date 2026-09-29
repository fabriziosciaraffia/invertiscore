// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lo-que-sigue/pack (28-sep-2026): el correo va adentro del ticket y el botón rojo va
// directo a Flow, sin salir del informe. Con el correo: la cuenta se crea si no existe (sin
// contraseña), ESTE informe anónimo pasa a esa cuenta (el claim de siempre, por la cookie), y se
// abre la orden en Flow a nombre de esa persona. Vigencia del pack validada acá (410).
// Después de pagar, /payments/return sin sesión explica cómo entrar (código al correo).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { flowPost } from "@/lib/flow";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { ofertaPackVigente, PRODUCTO_PACK, urlRetornoPack } from "@/lib/lo-que-sigue/oferta-pack";
import { eventoPackVencido } from "@/lib/lo-que-sigue/eventos-servidor";
import { capturarServidor, distinctIdDeCorreo } from "@/lib/posthog-servidor";
import { readVeredicto } from "@/lib/results-helpers";
import { captureApiError } from "@/lib/observabilidad";

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
  const { data: analysis } = await admin.from("analisis").select("user_id, created_at, results").eq("id", analysisId).single();
  if (!analysis?.created_at) return NextResponse.json({ error: "No existe ese informe" }, { status: 404 });
  const veredicto = readVeredicto(analysis.results as never) ?? null;

  if (!ofertaPackVigente(analysis.created_at as string)) {
    try {
      await capturarServidor(eventoPackVencido({ userId: distinctIdDeCorreo(email), analysisId, veredicto }));
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
      // Con el informe y su veredicto: /payments/return muestra «Tienes 3 análisis» sin sesión.
      urlReturn: urlRetornoPack(SITE_URL, commerceOrder, analysisId, veredicto),
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
    return NextResponse.json({ url: `${flowResponse.url}?token=${flowResponse.token}` });
  } catch (err) {
    captureApiError(err, { ruta: "POST /api/lo-que-sigue/pack", operacion: "pack-desde-el-ticket" });
    return NextResponse.json({ error: "No pudimos abrir el pago. Intenta de nuevo." }, { status: 500 });
  }
}
