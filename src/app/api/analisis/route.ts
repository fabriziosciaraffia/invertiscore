import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { generateAiAnalysis } from "@/lib/ai-generation";
import { readFrancoVerdict } from "@/lib/results-helpers";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";

function createPaymentsAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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
            // ignored in route handler
          }
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Solo usuarios registrados crean análisis (Backlog #3).
    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      );
    }

    const body: AnalisisInput & { prepaidChargeId?: string } = await request.json();
    const prepaidChargeId = body.prepaidChargeId;

    // Cobro de crédito antes del trabajo costoso. Admin bypass.
    // Si viene prepaidChargeId (flujo AMBAS), validamos contra payments en
    // vez de cobrar de nuevo. Ver /api/credits/charge.
    const isAdmin = isAdminUser(user.email);
    let prepaidNeedClaim = false;

    if (prepaidChargeId) {
      const paymentsAdmin = createPaymentsAdminClient();
      const { data: charge } = await paymentsAdmin
        .from("payments")
        .select("payment_data, consumed_at")
        .eq("commerce_order", prepaidChargeId)
        .eq("user_id", user.id)
        .eq("status", "paid")
        .maybeSingle();

      if (!charge) {
        return NextResponse.json(
          { error: "Charge inválido o no encontrado" },
          { status: 403 },
        );
      }

      if (charge.consumed_at === null) {
        prepaidNeedClaim = true; // somos los primeros, claim post-insert
      } else {
        // Ya consumido: solo permitido si era flujo AMBAS (segundo análisis).
        const intent = (charge.payment_data as { intent?: string } | null)?.intent;
        if (intent !== "both") {
          return NextResponse.json(
            { error: "Charge ya consumido" },
            { status: 403 },
          );
        }
      }
    } else if (!isAdmin) {
      const charge = await chargeAnalysisCredit(user.id, null);
      if (!charge.ok) {
        return NextResponse.json({ error: charge.message }, { status: 403 });
      }
    }

    // Pasar UF actual explícitamente al motor (antes era módulo-level mutable;
    // ver audit/sesionA-residual-2/diagnostico.md).
    const ufValue = await getUFValue();

    const result = runAnalysis(body, ufValue);

    const dbClient = supabase;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user.id,
        nombre: body.nombre,
        comuna: body.comuna,
        ciudad: body.ciudad,
        direccion: body.direccion || null,
        tipo: body.tipo,
        dormitorios: body.dormitorios,
        banos: body.banos,
        superficie: body.superficie,
        antiguedad: body.antiguedad,
        precio: body.precio,
        arriendo: body.arriendo,
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: body,
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 }
      );
    }

    // Marcar análisis como premium tras cobro exitoso (o admin bypass).
    // Backlog #3: TODOS los análisis del registrado son premium completos
    // — el welcome credit otorga el mismo nivel que un crédito comprado.
    if (data?.id) {
      await dbClient.from("analisis").update({ is_premium: true }).eq("id", data.id);
      data.is_premium = true;

      // Claim del prepaid charge si nosotros llegamos primero (flujo AMBAS).
      // .is('consumed_at', null) garantiza idempotencia: si el otro endpoint
      // del mismo flow both ya marcó, este UPDATE no hace nada.
      if (prepaidChargeId && prepaidNeedClaim) {
        const paymentsAdmin = createPaymentsAdminClient();
        await paymentsAdmin
          .from("payments")
          .update({
            consumed_at: new Date().toISOString(),
            consumed_by_analysis_id: data.id,
          })
          .eq("commerce_order", prepaidChargeId)
          .is("consumed_at", null);
      }
    }

    // Background: generate AI analysis, luego mandar email cuando esté listo
    // (o cuando falle — no bloqueamos la notificación por error IA, el page
    // puede recuperar la IA vía polling /ai-status). No await: el response
    // al cliente se devuelve inmediato.
    if (data?.id) {
      (async () => {
        try {
          await generateAiAnalysis(data.id, dbClient);
        } catch (e) {
          console.error("Background AI generation failed:", e);
        }
        if (user.email) {
          try {
            await sendAnalysisReadyEmail(
              user.email,
              user.user_metadata?.nombre || user.user_metadata?.full_name || '',
              body.nombre || `${body.comuna} - ${body.superficie}m²`,
              result.score,
              readFrancoVerdict(result) || (result.score >= 70 ? 'COMPRAR' : result.score >= 40 ? 'AJUSTA EL PRECIO' : 'BUSCAR OTRA'),
              data.id,
            );
          } catch (e) {
            console.error("Analysis email error:", e);
          }
        }
      })();
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
