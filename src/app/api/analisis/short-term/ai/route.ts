import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { Hallazgo } from "@/lib/types";
import { generateStrProse } from "@/lib/ai-generation-str";

const anthropic = new Anthropic();

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
            // ignored — server component sin acceso a cookies de respuesta
          }
        },
      },
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Endpoint STR AI v3 — el prompt v3, los presupuestos y los guards (strip de
// eco card↔drawer, monitor de drift) viven en `lib/ai-generation-str.ts`
// (compartidos con el script de regeneración del corpus). Este handler solo
// resuelve auth/crédito/cache y persiste.
// ─────────────────────────────────────────────────────────────────────────
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

    if (!analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    // Cache: si ya hay ai_analysis (cualquier shape v2/v3), devolverlo. El render
    // lee defensivamente por clave (back-compat con prosa v2 persistida).
    if (analysis.ai_analysis && typeof analysis.ai_analysis === "object") {
      return NextResponse.json(analysis.ai_analysis);
    }

    const input = analysis.input_data as Record<string, unknown> | null;
    const results = analysis.results as
      | (ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] })
      | null;

    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const comuna = (analysis.comuna as string) ?? (input.comuna as string) ?? "";

    let aiResult;
    try {
      const gen = await generateStrProse({
        anthropic,
        inp: input,
        r: results,
        comuna,
        logger: (m) => console.warn(`[STR AI v3] ${analysisId}: ${m}`),
      });
      aiResult = gen.ai;
    } catch (genError) {
      console.error("[STR AI v3] generación falló:", genError);
      return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
    }

    await supabase.from("analisis").update({ ai_analysis: aiResult }).eq("id", analysisId);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("STR AI v3 error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
