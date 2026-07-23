import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { getUFValue } from "@/lib/uf";
import { createSupabaseServer, requireAuthenticatedUser } from "@/lib/api-helpers/analisis-pipeline";
import { evaluarLtr } from "@/lib/dry-run/evaluar";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisis/dry-run — FASE 5
//
// Corre el motor determinístico (SIN IA, SIN persistir, SIN cobrar) y responde
// SOLO si el análisis está "al filo" y qué variables lo mueven:
//   { alFilo: boolean, variablesSensibles: string[] }
// El score / veredicto / Δ / distancia al borde viven y mueren acá dentro.
//
// Δ elegido por calibración empírica del golden set (GS-2 y BE-sensibilidad
// activan; GS-1 y los robustos no): 5%.
//
// Exige sesión (401). Rate-limit básico ~15/min por user.id. Cualquier fallo →
// { alFilo:false } silencioso (la card es no-bloqueante; el submit no depende).
// ─────────────────────────────────────────────────────────────────────────────

const DELTA = 0.05;
const RL_MAX = 15;
const RL_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(userId, arr);
  return arr.length > RL_MAX;
}

interface DryRunBody {
  modalidad?: "ltr" | "str" | "both";
  ltr?: AnalisisInput;
  str?: Record<string, unknown>;
  flags?: {
    arriendoEstimacion?: boolean;
    tasaPerturbable?: boolean; // solo si el usuario aceptó la tasa estimada
    tasaEstimacion?: boolean;
    adrEstimacion?: boolean;
  };
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response; // 401
    const { user } = auth;

    if (rateLimited(user.id)) {
      return NextResponse.json({ error: "Demasiadas consultas. Espera un momento." }, { status: 429 });
    }

    const body: DryRunBody = await request.json().catch(() => ({}));
    const flags = body.flags ?? {};
    const uf = await getUFValue();
    const asOf = new Date();

    const variables: string[] = [];

    // Rama LTR (modalidad ltr, o el lado LTR de both).
    if (body.ltr && (body.modalidad === "ltr" || body.modalidad === "both")) {
      const d = evaluarLtr(body.ltr, uf, undefined, asOf, DELTA, {
        perturbarTasa: flags.tasaPerturbable === true,
        arriendoEsEstimacion: flags.arriendoEstimacion,
        tasaEsEstimacion: flags.tasaEstimacion,
      });
      for (const v of d.variablesSensibles) if (!variables.includes(v)) variables.push(v);
    }

    // Rama STR (str / lado STR de both): se conecta al cablear la card (necesita
    // la reconstrucción AirROI-cacheada). Hasta entonces no aporta variables.
    // TODO(F5): evaluarStr(body.str, uf, DELTA, flags) con tarifa/ocupación.

    return NextResponse.json({ alFilo: variables.length > 0, variablesSensibles: variables });
  } catch {
    // Fallo silencioso: sin card, jamás un error visible por el dry-run.
    return NextResponse.json({ alFilo: false, variablesSensibles: [] });
  }
}
