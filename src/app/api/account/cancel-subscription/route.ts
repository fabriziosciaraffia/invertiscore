import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { flowPost } from "@/lib/flow";

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

    // Verify a real subscription exists. 'active' y 'past_due' (cargo falló,
    // en gracia) representan una suscripción que el usuario tiene y puede
    // querer cancelar. Solo rechazamos si no hay suscripción real ('none',
    // 'cancelled', o sin fila).
    const { data: credits } = await admin
      .from("user_credits")
      .select("subscription_status, subscription_id, subscription_ends_at")
      .eq("user_id", user.id)
      .single();

    const status = credits?.subscription_status;
    if (!credits || (status !== "active" && status !== "past_due")) {
      return NextResponse.json({ error: "No tienes suscripción activa" }, { status: 400 });
    }

    const subscriptionId = (credits.subscription_id as string | null) ?? null;
    // Fin de ciclo: arrancamos con el valor actual (fallback) y lo pisamos solo
    // si Flow devuelve uno válido. Nunca lo nulificamos.
    let cycleEndIso: string | null =
      (credits.subscription_ends_at as string | null) ?? null;

    if (subscriptionId) {
      // Cancelar en Flow AL FIN DEL PERÍODO: deja de cobrar (next_invoice_date
      // null) pero mantiene la sub activa hasta period_end. Confirmado en sandbox.
      // flowPost firma con apiKey + HMAC y LANZA si Flow responde !ok → un fallo
      // cae al catch y NO marcamos cancelled local (evita "local cancelado pero
      // Flow sigue cobrando").
      let flowResp: { subscriptionId?: string; subscription_end?: string; period_end?: string };
      try {
        flowResp = await flowPost("subscription/cancel", {
          subscriptionId,
          at_period_end: 1,
        });
      } catch (e) {
        console.error(
          "[cancel-subscription] Flow subscription/cancel falló:",
          e instanceof Error ? e.message : String(e)
        );
        return NextResponse.json(
          { error: "No pudimos cancelar tu suscripción con el procesador de pago. Inténtalo en unos minutos." },
          { status: 502 }
        );
      }

      // Flow eco-devuelve subscriptionId en éxito. Si no viene (200 con cuerpo de
      // error), tratamos como fallo: no marcamos cancelled.
      if (!flowResp?.subscriptionId) {
        console.error("[cancel-subscription] respuesta inesperada de Flow:", flowResp);
        return NextResponse.json(
          { error: "No pudimos confirmar la cancelación con el procesador de pago. Inténtalo en unos minutos." },
          { status: 502 }
        );
      }

      // Fin de ciclo real (con at_period_end=1, subscription_end == period_end).
      // Formato Flow "YYYY-MM-DD HH:mm:ss" → ISO. Si no parsea, conservamos el fallback.
      const flowEnd = flowResp.subscription_end || flowResp.period_end;
      if (flowEnd) {
        const parsed = new Date(flowEnd.replace(" ", "T"));
        if (!Number.isNaN(parsed.getTime())) {
          cycleEndIso = parsed.toISOString();
        }
      }
    } else {
      // Legacy/raro: sin subscription_id no podemos avisar a Flow. Degradamos al
      // update local de antes (no romper), pero lo logueamos para visibilidad.
      console.error(
        "[cancel-subscription] sin subscription_id; solo update local para user:",
        user.id
      );
    }

    // Marcar cancelled. Mantiene acceso hasta subscription_ends_at (corte por
    // fecha vía hasSubscriptionAccess + cron de limpieza).
    const updatePayload: Record<string, unknown> = {
      subscription_status: "cancelled",
      updated_at: new Date().toISOString(),
    };
    if (cycleEndIso) updatePayload.subscription_ends_at = cycleEndIso;

    await admin.from("user_credits").update(updatePayload).eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel subscription error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
  }
}
