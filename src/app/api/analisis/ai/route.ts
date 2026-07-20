import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { generateAiAnalysis, hasNewAiStructure, PROMPT_VERSION_LTR } from "@/lib/ai-generation";

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

// Lock/debounce en proceso: la invalidación lazy-on-open puede disparar aperturas
// concurrentes del mismo análisis → doble LLM + doble write. Un Map colapsa las requests
// del MISMO analysisId a una sola generación. Cross-instance (serverless) es last-write-wins,
// inofensivo. Espejo comparativa/ai/route.ts.
const inflight = new Map<string, Promise<unknown>>();

// Cache VERSION-AWARE: fresca solo si es new-structure Y la versión del prompt coincide.
// Prosa pre-F6 (sin promptVersion) o versión vieja → cae a regen (lazy-on-open).
function cacheEstaFrescaLTR(ai: unknown): boolean {
  return hasNewAiStructure(ai) && (ai as { promptVersion?: number }).promptVersion === PROMPT_VERSION_LTR;
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId } = await request.json();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }

    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const isAdmin = isAdminUser(user.email);

    if (analysis.user_id && analysis.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para analizar este registro" }, { status: 403 });
    }

    // F6 — INVARIANTE DE PLATA: prosa previa en CUALQUIER shape/versión ⇒ el análisis
    // ya se desbloqueó una vez; el regen por versión stale NUNCA vuelve a cobrar. El
    // crédito se consume SOLO en la PRIMERA generación (sin prosa previa). Garantizado
    // por código, no por que la fila sea premium.
    const hadPriorProse = !!analysis.ai_analysis && typeof analysis.ai_analysis === "object";

    // Cache version-aware: sirve tal cual solo si está fresca. Stale/pre-F6 → regen.
    if (cacheEstaFrescaLTR(analysis.ai_analysis)) {
      return NextResponse.json(analysis.ai_analysis);
    }

    // Crédito SOLO en primera generación (sin prosa previa). Regen de stale = gratis.
    if (!hadPriorProse && !analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    // Regen con lock/debounce por analysisId (colapsa aperturas concurrentes).
    const existing = inflight.get(analysisId);
    if (existing) {
      const shared = await existing;
      if (!shared) return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
      return NextResponse.json(shared);
    }
    const task = generateAiAnalysis(analysisId, supabase);
    inflight.set(analysisId, task);
    try {
      const aiResult = await task;
      if (!aiResult) {
        return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
      }
      return NextResponse.json(aiResult);
    } finally {
      inflight.delete(analysisId);
    }
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
