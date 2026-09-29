import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { modalidadDeTipo, ofertaPackVigente, PRODUCTO_PACK, urlRetornoPack } from "@/lib/lo-que-sigue/oferta-pack";
import { eventoPackVencido } from "@/lib/lo-que-sigue/eventos-servidor";
import { capturarServidor } from "@/lib/posthog-servidor";
import { readVeredicto } from "@/lib/results-helpers";
import { randomUUID } from "crypto";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

const PRODUCTS: Record<string, { amount: number; subject: string }> = {
  // Modelo nuevo: pago único de 1 análisis (lee del catálogo único).
  single: { amount: FLOW_PRODUCTS.single.amount, subject: FLOW_PRODUCTS.single.subject },
  // Fase D — desbloqueo one-off del informe íntegro de un par AMBAS (lee del
  // catálogo único). Abre AMBOS hijos vía marca por ambas_group_id en confirm.
  unlock: { amount: FLOW_PRODUCTS.unlock.amount, subject: FLOW_PRODUCTS.unlock.subject },
  // Legacy (deprecados, se conservan por compatibilidad de órdenes en vuelo).
  pro: { amount: 4990, subject: "Franco Pro — Análisis Premium" },
  pack3: { amount: FLOW_PRODUCTS.pack3.amount, subject: FLOW_PRODUCTS.pack3.subject },
};

function createAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { product, analysisId, quantity: rawQuantity, companionStrId, ambasGroupId } = body as {
    product: string;
    analysisId?: string;
    quantity?: number | string;
    // Flujo AMBAS pre-pago: el LTR viaja en analysis_id; el STR (companion) se
    // guarda en payment_data para que confirm desbloquee ambas filas y el
    // return rutee a la comparativa.
    companionStrId?: string;
    // Fase D unlock: el grupo AMBAS a desbloquear. analysis_id lleva el hijo
    // abierto (para ownership + redirect); ambas_group_id se guarda en
    // payment_data como audit y confirm flipea la marca sobre TODO el grupo.
    ambasGroupId?: string;
  };

  if (!product || !PRODUCTS[product]) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  // Cantidad: default 1. Si viene, debe ser entero entre 1 y 20. Solo aplica a la
  // compra de crédito single SIN análisis atado — el paso 4 (analysisId) y los
  // legacy compran siempre 1.
  let quantity = 1;
  if (rawQuantity !== undefined) {
    const n = Number(rawQuantity);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      return NextResponse.json({ error: "Cantidad inválida (1-20)" }, { status: 400 });
    }
    quantity = n;
  }
  if (analysisId || product !== "single") {
    quantity = 1;
  }

  // Ownership check (+ comuna para personalizar el subject de Flow): si el pago
  // es por un análisis, verificar que el user lo posee.
  let analysisComuna: string | null = null;
  let veredictoPack: string | null = null;
  let modalidadPack: "ltr" | "str" = "ltr";
  // «Lo que sigue»: el pack va atado al primer informe y vence 24 h después de creado. Sin
  // analysisId no hay pack; vencido, se rechaza con 410 y queda medido (`pack_vencido`).
  if (product === PRODUCTO_PACK && !analysisId) {
    return NextResponse.json({ error: "El pack va con tu informe" }, { status: 400 });
  }
  if (analysisId) {
    const admin = createAdminClient();
    const { data: analysis } = await admin
      .from("analisis")
      .select("user_id, comuna, created_at, results, tipo_analisis")
      .eq("id", analysisId)
      .single();

    if (analysis && analysis.user_id && analysis.user_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    analysisComuna = (analysis?.comuna as string) ?? null;
    if (product === PRODUCTO_PACK) {
      if (!analysis?.created_at) return NextResponse.json({ error: "No existe ese informe" }, { status: 404 });
      veredictoPack = readVeredicto(analysis.results as never) ?? null;
      modalidadPack = modalidadDeTipo(analysis.tipo_analisis as string);
      if (!ofertaPackVigente(analysis.created_at as string)) {
        try {
          await capturarServidor(eventoPackVencido({ userId: user.id, analysisId, veredicto: readVeredicto(analysis.results as never) ?? null }));
        } catch (e) {
          console.error("[payments/create] pack_vencido excepción:", e);
        }
        return NextResponse.json({ error: "pack_vencido" }, { status: 410 });
      }
    }
  }

  const { amount: unitAmount, subject: catalogSubject } = PRODUCTS[product];
  // Cobro = unitario × cantidad (cantidad ya forzada a 1 fuera de single-crédito).
  const amount = unitAmount * quantity;
  // subject = SOLO el texto que muestra Flow. Single atado a análisis → comuna
  // ("Franco — Análisis Providencia"); crédito con cantidad → "Franco — N créditos";
  // resto → subject del catálogo. El monto sale del cálculo de arriba.
  let subject = catalogSubject;
  if (product === "single") {
    if (analysisComuna) {
      subject = `Franco — Análisis ${analysisComuna}`;
    } else if (quantity > 1) {
      subject = `Franco — ${quantity} análisis`;
    }
  } else if (product === "unlock" && analysisComuna) {
    // Unlock atado a un hijo → subject con comuna ("Franco — Informe completo Providencia").
    subject = `Franco — Informe completo ${analysisComuna}`;
  }
  const commerceOrder = `franco-${randomUUID()}`;

  try {
    // Validate env vars early
    if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) {
      console.error("Payment create: FLOW_API_KEY or FLOW_SECRET_KEY not set");
      return NextResponse.json({
        error: "Error de configuración del servidor",
        details: "Flow API keys not configured",
      }, { status: 500 });
    }

    // Create Flow payment order first
    const flowResponse = await flowPost("payment/create", {
      commerceOrder,
      subject,
      currency: "CLP",
      amount,
      email: user.email!,
      paymentMethod: 9,
      urlConfirmation: `${SITE_URL}/api/payments/confirm`,
      // Propagamos el commerceOrder al return para que /payments/return
      // identifique ESTA compra (no el "último pago del user"). El middleware
      // preserva el query string al convertir el POST de Flow en GET.
      urlReturn: product === PRODUCTO_PACK && analysisId
        ? urlRetornoPack(SITE_URL, commerceOrder, analysisId, veredictoPack, modalidadPack)
        : `${SITE_URL}/payments/return?order=${commerceOrder}`,
    });

    if (!flowResponse.url || !flowResponse.token) {
      console.error("Flow create error — invalid response");
      return NextResponse.json({
        error: "Error al crear orden de pago",
        details: flowResponse?.message || JSON.stringify(flowResponse),
      }, { status: 500 });
    }

    // Insert pending payment record AFTER Flow succeeds (service_role bypasses RLS)
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: commerceOrder,
      flow_order: flowResponse.flowOrder || null,
      product,
      amount,
      quantity,
      status: "pending",
      analysis_id: analysisId || null,
      // payment_data lleva metadata del flujo AMBAS:
      //  - companion_str_id (pre-pago single-AMBAS): confirm desbloquea la 2ª
      //    fila y el return rutea a la comparativa.
      //  - ambas_group_id (unlock, Fase D): audit del grupo desbloqueado. El
      //    flip en confirm deriva el grupo del hijo (analysis_id), pero lo
      //    guardamos acá como fuente de verdad del cobro.
      ...(companionStrId || ambasGroupId
        ? {
            payment_data: {
              ...(companionStrId ? { companion_str_id: companionStrId } : {}),
              ...(ambasGroupId ? { ambas_group_id: ambasGroupId } : {}),
            },
          }
        : {}),
    });

    if (insertError) {
      console.error("Payment insert error:", JSON.stringify(insertError));
      return NextResponse.json({
        error: "Error al registrar pago",
        details: insertError.message || insertError.code || String(insertError),
      }, { status: 500 });
    }

    // Return redirect URL
    const redirectUrl = `${flowResponse.url}?token=${flowResponse.token}`;
    return NextResponse.json({ url: redirectUrl });
  } catch (err: unknown) {
    console.error("Payment create error:", err instanceof Error ? err.message : "Unknown error");
    captureApiError(err, {
      ruta: "POST /api/payments/create",
      operacion: "crear-orden-flow",
    });
    return NextResponse.json({
      error: "Error al procesar pago",
      details: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
