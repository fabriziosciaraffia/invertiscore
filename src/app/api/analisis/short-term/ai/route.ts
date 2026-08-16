import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { PROMPT_VERSION_STR } from "@/lib/ai-generation-str";
import { generarYPersistirProsaStr } from "@/lib/str-prosa-persist";
import type { GeneracionTrigger } from "@/lib/pipeline-timing";

const anthropic = new Anthropic();

// Goal C: techo explícito — hasta 4 llamadas Sonnet seriales (loop de calidad
// + budget-retry quirúrgico); con prompt caching los retries bajan.
export const maxDuration = 300;

// Triggers que el cliente puede declarar (Goal F — espejo LTR). Desde el Goal F
// la generación normal corre en el waitUntil del submit (trigger "background");
// este endpoint queda para el RESCATE con dictamen server, el regen de prosa
// stale y el botón manual. Telemetría, nunca lógica; fuera de lista → "manual".
const TRIGGERS_CLIENTE = new Set<GeneracionTrigger>(["rescate", "manual", "stale-regen"]);

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
// Endpoint STR AI v3 — el prompt v3, los presupuestos y los guards viven en
// `lib/ai-generation-str.ts`; el núcleo generar+persistir en
// `lib/str-prosa-persist.ts` (COMPARTIDO con el waitUntil del submit, Goal F).
// Este handler solo resuelve auth/crédito/cache/lock y delega.
// ─────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // Fuera del try: el catch global lo necesita para que el evento de Sentry diga
  // QUÉ análisis falló, no solo que algo falló.
  let analysisId: string | undefined;

  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const reqBody = await request.json();
    ({ analysisId } = reqBody);
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }
    const trigger: GeneracionTrigger = TRIGGERS_CLIENTE.has(reqBody?.trigger) ? reqBody.trigger : "manual";

    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const isAdmin = isAdminUser(user.email);

    // Fix guard-NULL (F2-2): `user_id NULL` ya no pasa para cualquier logueado.
    // La vía hacia una fila anónima es el claim, nunca esta ruta.
    if (analysis.user_id !== user.id && !isAdmin) {
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

    // Regen con lock/debounce por analysisId. La tarea genera Y persiste; si falla
    // devuelve null (NO persiste → la versión no se sella → se reintenta al reabrir).
    const existing = inflight.get(analysisId);
    if (existing) {
      const shared = await existing;
      if (!shared) return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
      return NextResponse.json(shared);
    }
    const task = generarYPersistirProsaStr({ analysisId, analysis, supabase, anthropic, trigger });
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
    captureApiError(error, { ruta: "POST /api/analisis/short-term/ai", operacion: "generar-prosa-str", analysisId });
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
