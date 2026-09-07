import { NextResponse } from "next/server";
import { conCandado, RESPUESTA_GENERANDO, STATUS_GENERANDO } from "@/lib/candado-generacion";
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

// Candado de regeneración (goal #3, 07-sep-2026): vive en la base
// (src/lib/candado-generacion.ts), una generación por fila ENTRE instancias.
// Reemplaza el Map en memoria de esta ruta, que no veía al waitUntil ni al cron.

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
    // T2.1: el admin tampoco: la política UPDATE de `analisis` es auth.uid() = user_id, así
    // que sobre una fila ajena generaba y no guardaba. Regenera solo quien puede persistir.
    if (analysis.user_id !== user.id) {
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

    // Candado cross-instance (goal #3, espejo LTR): otro proceso generando esta fila →
    // 409 { generando: true }. La tarea genera Y persiste; si falla devuelve null (NO
    // persiste → la versión no se sella → se reintenta al reabrir). Suelta en finally.
    const idGen: string = analysisId; // el closure pierde el narrowing de `let analysisId`
    const r = await conCandado(idGen, "str", () => generarYPersistirProsaStr({ analysisId: idGen, analysis, supabase, anthropic, trigger }));
    if (!r.tomado) return NextResponse.json(RESPUESTA_GENERANDO, { status: STATUS_GENERANDO });
    if (!r.resultado) {
      return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
    }
    return NextResponse.json(r.resultado);
  } catch (error) {
    console.error("STR AI v3 error:", error);
    captureApiError(error, { ruta: "POST /api/analisis/short-term/ai", operacion: "generar-prosa-str", analysisId });
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
