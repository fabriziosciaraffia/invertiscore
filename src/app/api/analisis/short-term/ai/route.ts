import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { Hallazgo } from "@/lib/types";
import { generateStrProse, PROMPT_VERSION_STR } from "@/lib/ai-generation-str";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";

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

// Lock/debounce en proceso: colapsa aperturas concurrentes del MISMO analysisId a una
// sola generación (evita doble LLM + doble write en el lazy-on-open). Espejo comparativa.
const inflight = new Map<string, Promise<Record<string, unknown> | null>>();

// Cache VERSION-AWARE: fresca solo si la versión del prompt coincide. Prosa pre-F6 (sin
// promptVersion) o versión vieja → cae a regen (lazy-on-open).
function cacheEstaFrescaSTR(ai: unknown): boolean {
  return !!ai && typeof ai === "object" && (ai as { promptVersion?: number }).promptVersion === PROMPT_VERSION_STR;
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

    // F6 — INVARIANTE DE PLATA: prosa previa en CUALQUIER shape/versión ⇒ ya se
    // desbloqueó una vez; el regen por versión stale NUNCA vuelve a cobrar. El crédito
    // se consume SOLO en la PRIMERA generación (sin prosa previa). Garantizado por código.
    const hadPriorProse = !!analysis.ai_analysis && typeof analysis.ai_analysis === "object";

    // Cache version-aware: sirve tal cual solo si está fresca. Stale/pre-F6 → regen.
    if (cacheEstaFrescaSTR(analysis.ai_analysis)) {
      return NextResponse.json(analysis.ai_analysis);
    }

    // Crédito SOLO en primera generación (sin prosa previa). Regen de stale = gratis.
    if (!hadPriorProse && !analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    const input = analysis.input_data as Record<string, unknown> | null;
    const results = analysis.results as
      | (ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] })
      | null;

    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const comuna = (analysis.comuna as string) ?? (input.comuna as string) ?? "";

    // FIX recompute-antes-de-promptear (espejo del render STR + ambas-generate). La fila
    // persiste `results` de fórmula posiblemente vieja (pre-homologación); si prompteáramos
    // desde ahí, la prosa citaría números stale mientras las cards (recompute-on-load)
    // muestran los actuales. Recomputamos con el motor de hoy desde input + airbnbRaw
    // congelado ANTES de promptear. UF y fecha CONGELADAS a la creación → idempotente.
    // Legacy irreconstruible (sin airbnbRaw) → `?? results` (fallback seguro al persistido).
    // Prompt-only: NO se persiste `results` acá (eso lo hace regen-corpus con gate aparte).
    const precioCompraUF = Number(input.precioCompraUF) || 0;
    const precioCompraCLP = Number(input.precioCompra) || 0;
    const ufFrozen = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : 38800;
    const asOfFrozen = new Date((analysis.created_at as string) ?? new Date().toISOString());
    const medianaStr = await prefetchMedianaComunaVenta(
      supabase,
      {
        comuna: (input.comuna as string) ?? comuna,
        superficie: Number(input.superficieUtil) || 0,
        dormitorios: Number(input.dormitorios) || 0,
      },
      ufFrozen,
    );
    const rGen = (recomputeShortTermForLegacy(input, results, ufFrozen, asOfFrozen, medianaStr) ?? results) as
      ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] };

    // Regen con lock/debounce por analysisId. La tarea genera Y persiste; si falla
    // devuelve null (NO persiste → la versión no se sella → se reintenta al reabrir).
    const existing = inflight.get(analysisId);
    if (existing) {
      const shared = await existing;
      if (!shared) return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
      return NextResponse.json(shared);
    }
    const task = (async (): Promise<Record<string, unknown> | null> => {
      try {
        const gen = await generateStrProse({
          anthropic,
          inp: input,
          r: rGen,
          comuna,
          logger: (m) => console.warn(`[STR AI v3] ${analysisId}: ${m}`),
        });
        const ai = gen.ai as unknown as Record<string, unknown>;
        await supabase.from("analisis").update({ ai_analysis: ai }).eq("id", analysisId);
        return ai;
      } catch (genError) {
        console.error("[STR AI v3] generación falló:", genError);
        return null;
      }
    })();
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
    console.error("STR AI v3 error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
