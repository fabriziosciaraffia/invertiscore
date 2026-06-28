import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { resolveDisplayName, ensureWelcomeEmail } from "@/lib/welcome";
import { generateAiAnalysis } from "@/lib/ai-generation";
import { readVeredicto } from "@/lib/results-helpers";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  prefetchMedianaComunaVenta,
  buildMedianaSnapshot,
} from "@/lib/api-helpers/analisis-pipeline";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body: AnalisisInput & { prepaidChargeId?: string } = await request.json();
    const prepaidChargeId = body.prepaidChargeId;

    const charge = await ensureCreditCharged({ user, prepaidChargeId });
    if (!charge.ok) return charge.response;
    const { prepaidNeedClaim } = charge;

    // Pasar UF actual explícitamente al motor (antes era módulo-level mutable;
    // ver audit/sesionA-residual-2/diagnostico.md).
    const ufValue = await getUFValue();
    // Pre-fetch async de la mediana comunal de venta UF/m² para inyectarla al
    // motor síncrono (patrón cap_rate). Defensivo: cae a null sin romper.
    const medianaComuna = await prefetchMedianaComunaVenta(supabase, body, ufValue);
    const result = runAnalysis(body, ufValue, medianaComuna);

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
        tipo_analisis: "long-term",
        // Commit E.1 · 2026-05-13: análisis nuevos usan metodología v2
        // (thresholds 70/45/0 unificados · slider 3 segmentos · sin fallback
        // score 50). Análisis pre-Commit-E quedan como v1 (legacy preservation).
        methodology_version: "v2",
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
        // Snapshot de la mediana resuelta acá (Fase A): fuente única futura para
        // sobreprecio/hero/prosa/zona. Nadie lo lee aún (Fase B cablea lecturas).
        mediana_comuna_snapshot: buildMedianaSnapshot(medianaComuna),
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    // Marcar análisis como premium tras cobro exitoso (o admin bypass).
    // Backlog #3: TODOS los análisis del registrado son premium completos
    // — el welcome credit otorga el mismo nivel que un crédito comprado.
    if (data?.id) {
      await markPremiumAndClaimPrepaid({
        dbClient,
        analysisId: data.id,
        prepaidChargeId,
        prepaidNeedClaim,
      });
      data.is_premium = true;
    }

    // Background: generate AI analysis, luego mandar email cuando esté listo
    // (o cuando falle — no bloqueamos la notificación por error IA, el page
    // puede recuperar la IA vía polling /ai-status). No await: el response
    // al cliente se devuelve inmediato.
    if (data?.id) {
      (async () => {
        // Welcome email idempotente: garantiza que un usuario que llega directo
        // a /analisis/nuevo-v2 (vía deep-link o el héroe del onboarding) sin
        // pasar por /dashboard igual lo reciba. ensureWelcomeEmail usa el claim
        // atómico de welcome_email_sent, así que es seguro dispararlo también
        // acá: envía a lo sumo una vez por usuario (no duplica con /dashboard).
        if (user.email) {
          await ensureWelcomeEmail(
            user.id,
            user.email,
            resolveDisplayName(user.user_metadata, user.email),
          );
        }
        try {
          await generateAiAnalysis(data.id, dbClient);
        } catch (e) {
          console.error("Background AI generation failed:", e);
        }
        if (user.email) {
          try {
            await sendAnalysisReadyEmail(
              user.email,
              resolveDisplayName(user.user_metadata, user.email),
              body.nombre || `${body.comuna} - ${body.superficie}m²`,
              result.score,
              readVeredicto(result) || (result.score >= 70 ? "COMPRAR" : result.score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
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
      { status: 500 },
    );
  }
}
