import { NextResponse } from "next/server";
import { flowGet } from "@/lib/flow";
import { FLOW_PRODUCTS, resolvePlanId } from "@/lib/flow-products";

// ─────────────────────────────────────────────────────────────────────────────
// LA URL DE AVISO DE CADA PLAN EN FLOW (05-nov-2026, goal del aviso de cobro). Solo lectura: lee `plans/get` de cada plan
// recurrente del catálogo y dice si su urlCallback es la ruta del aviso de este sitio. Las llaves de Flow de producción
// viven solo en Vercel, así que esto es la forma de mirar la configuración de producción sin el panel.
// Flow no deja cambiar la urlCallback por API en un plan con suscriptores (plans/edit solo cambia trial_period_days): si un
// plan no coincide, se cambia en el panel de Flow.
// Auth: `Authorization: Bearer ${CRON_SECRET}`, como los crons.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const esperada = `${SITE_URL}/api/subscriptions/payment-callback`;
  const planes = [];
  for (const [key, p] of Object.entries(FLOW_PRODUCTS)) {
    if (p.kind !== "recurring" || !p.planId) continue;
    const planId = resolvePlanId(p.planId);
    try {
      const plan = (await flowGet("plans/get", { planId })) as { planId?: string; status?: number | string; amount?: number | string; urlCallback?: string };
      planes.push({ key, planId, estado: plan.status ?? null, monto: plan.amount ?? null, urlCallback: plan.urlCallback ?? null, coincide: plan.urlCallback === esperada });
    } catch (e) {
      planes.push({ key, planId, error: e instanceof Error ? e.message.slice(0, 160) : String(e) });
    }
  }
  return NextResponse.json({ entorno: process.env.FLOW_ENV ?? "production", esperada, planes });
}
