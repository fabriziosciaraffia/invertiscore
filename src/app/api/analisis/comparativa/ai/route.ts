import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAdminUser } from "@/lib/admin";
import type { FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { PROMPT_VERSION_AMBAS } from "@/lib/ai-generation-ambas";
import { generateComparativaAI } from "@/lib/ai-generation-ambas-generate";
import { createAnonPipelineClient, sha256Hex, tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";

// Goal C: techo explícito — hasta 3 llamadas Sonnet seriales + 2 recomputes de
// motor; con prompt caching los retries bajan.
export const maxDuration = 300;

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
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignored
          }
        },
      },
    },
  );
}

type LTRResultsWithCache = FullAnalysisResult & {
  comparativaAI?: AIAnalysisComparativa;
  tipoAnalisis?: string;
};

type STRResultsExtended = ShortTermResult & {
  tipoAnalisis?: string;
};

// ─── Lock / debounce en proceso ──────────────────────────────────────────
// La invalidación lazy-on-open (regen al abrir cuando la prosa quedó vieja) puede
// disparar dos aperturas concurrentes del mismo par → doble llamada al LLM + doble
// write. Un Map en memoria colapsa las requests concurrentes del MISMO ltrId dentro
// de esta instancia a una sola generación (las demás esperan y comparten el resultado).
// Carreras cross-instance (serverless) son raras y last-write-wins: inofensivas.
const inflight = new Map<string, Promise<AIAnalysisComparativa | null>>();

// Versión de la prosa cacheada. `undefined` (prosa v0) siempre se considera vieja.
function cacheEstaFresca(ai: AIAnalysisComparativa | undefined | null): boolean {
  return !!ai && typeof ai === "object" && ai.promptVersion === PROMPT_VERSION_AMBAS;
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const body = (await request.json()) as { ltrId?: string; strId?: string };
    const ltrId = body.ltrId;
    const strId = body.strId;
    if (!ltrId || !strId) {
      return NextResponse.json({ error: "ltrId y strId requeridos" }, { status: 400 });
    }

    const [{ data: ltrRow }, { data: strRow }] = await Promise.all([
      supabase.from("analisis").select("*").eq("id", ltrId).single(),
      supabase.from("analisis").select("*").eq("id", strId).single(),
    ]);

    if (!ltrRow || !strRow) {
      return NextResponse.json({ error: "Análisis no encontrados" }, { status: 404 });
    }

    // Anónimo-DUEÑO del par (cap F2-2): sin sesión, la prosa comparativa
    // igual se puede generar SI la cookie httpOnly de este navegador calza con
    // el hash de AMBAS filas anónimas — el comparativo ES el análisis que el
    // cap le entregó, y su prosa se genera on-demand (no en el submit). El
    // write del cache pasa a service-role (sin sesión no hay RLS que valga).
    let esAnonDueno = false;
    if (!user) {
      const anonToken = tokenAnonDelRequest();
      const hashCookie = anonToken ? sha256Hex(anonToken) : null;
      esAnonDueno =
        !!hashCookie &&
        ltrRow.user_id === null && strRow.user_id === null &&
        ltrRow.anon_claim_token_hash === hashCookie &&
        strRow.anon_claim_token_hash === hashCookie;
      if (!esAnonDueno) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    } else {
      const isAdmin = isAdminUser(user.email);
      // Fix guard-NULL (F2-2): `user_id NULL` ya no pasa para cualquier logueado.
      // El par anónimo se adopta vía claim, nunca por esta ruta.
      if (ltrRow.user_id !== user.id && !isAdmin) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      if (strRow.user_id !== user.id && !isAdmin) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const ltrResultsPersisted = (ltrRow.results ?? null) as LTRResultsWithCache | null;
    const strResultsPersisted = (strRow.results ?? null) as STRResultsExtended | null;

    if (!ltrResultsPersisted || !strResultsPersisted) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    // ─── Cache VERSION-AWARE (persistente en ltr.results.comparativaAI) ──────
    // Sirve el cache solo si la versión del prompt coincide. Prosa v0 (sin
    // promptVersion) o versión vieja → cae a regeneración (invalidación lazy-on-open).
    if (cacheEstaFresca(ltrResultsPersisted.comparativaAI)) {
      return NextResponse.json(ltrResultsPersisted.comparativaAI);
    }

    // ─── Regeneración con lock/debounce por ltrId ────────────────────────────
    const existing = inflight.get(ltrId);
    if (existing) {
      const shared = await existing;
      if (!shared) return NextResponse.json({ error: "Error generando narrativa IA" }, { status: 500 });
      return NextResponse.json(shared);
    }
    const task = generateComparativaAI({
      ltrId,
      strId,
      // Anónimo-dueño: el persist del cache escribe en `analisis.results` de una
      // fila sin dueño — el client con cookies de sesión no existe, va service-role.
      supabase: esAnonDueno ? createAnonPipelineClient() : supabase,
      persist: true,
    });
    inflight.set(ltrId, task);
    try {
      const aiResult = await task;
      if (!aiResult) {
        return NextResponse.json({ error: "Error generando narrativa IA" }, { status: 500 });
      }
      return NextResponse.json(aiResult);
    } finally {
      inflight.delete(ltrId);
    }
  } catch (error) {
    console.error("Comparativa AI error:", error);
    captureApiError(error, { ruta: "POST /api/analisis/comparativa/ai", operacion: "generar-prosa-ambas" });
    return NextResponse.json({ error: "Error generando narrativa IA" }, { status: 500 });
  }
}
