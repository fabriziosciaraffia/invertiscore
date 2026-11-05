import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { captureApiError } from "@/lib/observabilidad";
import { cancelarPlan } from "@/lib/subscriptions/flow-vivas";
import { puertaFlow } from "@/lib/subscriptions/flow-puerta";
import { esperaPrimerCobro, fechaFlowAIso } from "@/lib/subscriptions/suscripcion";

// ─────────────────────────────────────────────────────────────────────────────
// «CANCELAR EL PLAN» (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio).
//   · Pagado y vigente: se cancela en Flow al fin del período (ya lo pagó) y conserva el acceso hasta esa fecha.
//   · En la gracia (past_due) o esperando el primer cobro: se cancela en Flow AHORA. Al fin del período Flow seguiría
//     intentando cobrar el importe impago.
//   · «Cancelas cuando quieras» funciona aunque falte `subscription_id`: se busca la suscripción en Flow por el cliente
//     (flow-vivas.ts › cancelarPlan). Cualquier otra viva del cliente se cancela ahora: nunca quedan dos.
//   · Si Flow no confirma, NO se marca cancelado acá (no hay «cancelado en Franco y cobrando en Flow»).
// Lo fija el tier SUSCRIPCION.
// ─────────────────────────────────────────────────────────────────────────────

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored
          }
        },
      },
    }
  );
}

export async function POST() {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 'active' y 'past_due' (cobro rechazado, en gracia) son una suscripción que la persona tiene y puede cancelar.
    const { data: credits } = await admin
      .from("user_credits")
      .select("subscription_status, subscription_id, subscription_ends_at, flow_customer_id")
      .eq("user_id", user.id)
      .single();

    const status = credits?.subscription_status;
    if (!credits || (status !== "active" && status !== "past_due")) {
      return NextResponse.json({ error: "No tienes suscripción activa" }, { status: 400 });
    }

    const subscriptionId = (credits.subscription_id as string | null) ?? null;
    const customerId = (credits.flow_customer_id as string | null) ?? null;
    // Al fin del período solo lo que ya se pagó.
    const alFinDelPeriodo = status === "active" && !esperaPrimerCobro(credits);

    let finDelAcceso: string | null = alFinDelPeriodo ? ((credits.subscription_ends_at as string | null) ?? null) : new Date().toISOString();

    if (subscriptionId || customerId) {
      const cierre = await cancelarPlan(puertaFlow, { customerId, subscriptionId, alFinDelPeriodo });
      if (!cierre.ok) {
        console.error("[cancel-subscription] Flow no confirmó la cancelación:", JSON.stringify(cierre.fallidas));
        captureApiError(new Error("Cancelación no confirmada por Flow"), {
          ruta: "POST /api/account/cancel-subscription",
          operacion: "cancelar-en-flow",
          userId: user.id,
          extra: { vivas: cierre.vivas, fallidas: cierre.fallidas, lecturaFallida: cierre.lecturaFallida },
        });
        return NextResponse.json(
          { error: "No pudimos cancelar tu plan con Flow. Inténtalo en unos minutos." },
          { status: 502 }
        );
      }
      // Fin del período real según Flow (subscription_end / period_end, en hora de Chile).
      if (alFinDelPeriodo) finDelAcceso = fechaFlowAIso(cierre.finPeriodo) ?? finDelAcceso;
    } else {
      // Sin suscripción ni cliente en Flow no hay nada que cancelar allá.
      console.error("[cancel-subscription] sin subscription_id ni cliente en Flow; solo local para user:", user.id);
    }

    // Marcar cancelled. El acceso sigue hasta subscription_ends_at (corte por fecha vía hasSubscriptionAccess + cron de
    // limpieza); cancelado ahora, termina ahora.
    const updatePayload: Record<string, unknown> = {
      subscription_status: "cancelled",
      grace_ends_at: null,
      updated_at: new Date().toISOString(),
    };
    if (finDelAcceso) updatePayload.subscription_ends_at = finDelAcceso;

    await admin.from("user_credits").update(updatePayload).eq("user_id", user.id);

    return NextResponse.json({ success: true, alFinDelPeriodo });
  } catch (error) {
    console.error("Cancel subscription error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
  }
}
