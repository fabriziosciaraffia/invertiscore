// ─────────────────────────────────────────────────────────────────────────────
// EL RECÁLCULO DE UN DEPTO DE LA SELECCIÓN CON OTRO PIE Y PLAZO (23-oct-2026, mockup D2): la MISMA cuenta con que la
// selección lo evaluó —la sonda del motor (sondaConPatch) sobre lo que la fila ya resolvió (contextoDeFila), con la tasa
// del origen (la del informe de origen, o la de mercado en el origen sintético de la puerta B)—, así el veredicto que el
// pop-up muestra es el que el informe va a dar. Solo sobre un depto de una selección de esta persona (el token), como
// «Analizar este». Sin arriendo evaluado o sin la mediana guardada no se recalcula: null, y el pop-up no deja cobrar.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { sondaConPatch } from "@/lib/analysis";
import { payloadDeAviso, respuestasDeAviso } from "@/lib/avisos/evaluar-aviso";
import { avisoDeCandidato, contextoDeFila, leerConfigGuia, leerOrigenGuia, origenSintetico, type OrigenGuia } from "./guia-servidor";
import { leerAvisoGuia } from "./analizar-servidor";
import { seleccionPorToken, type ItemSemanal } from "./semanal-servidor";
import type { Combinacion } from "./seleccion";
import type { Recalculo } from "./recalcular-cliente";

export type ResultadoRecalculo = { ok: true; r: Recalculo } | { ok: false; status: number; error: "seleccion" | "origen" | "aviso" | "sin-datos" };

export async function recalcularAviso(
  admin: SupabaseClient,
  p: { userId: string; token: string; origenId: string | null; avisoId: string; combo: Combinacion },
  ahora: Date = new Date(),
): Promise<ResultadoRecalculo> {
  // La selección es de esta persona, sale de este origen (o de ninguno) y trae este aviso.
  const sel = await seleccionPorToken(admin, p.token);
  if (!sel || sel.user_id !== p.userId || sel.origen_analysis_id !== p.origenId) return { ok: false, status: 403, error: "seleccion" };
  const enItems = (xs: ItemSemanal[] | null | undefined) => (xs ?? []).some((i) => i.avisoId === p.avisoId);
  if (!enItems(sel.items) && !enItems(sel.corto?.items)) return { ok: false, status: 403, error: "seleccion" };
  const cfg = await leerConfigGuia(admin);
  const o: OrigenGuia | null = p.origenId
    ? await leerOrigenGuia(admin, p.origenId, { rentaCorta: true })
    : origenSintetico(p.userId, { ...p.combo, comunas: [], dormitorios: [] }, cfg);
  if (!o || o.userId !== p.userId) return { ok: false, status: 403, error: "origen" };
  const aviso = await leerAvisoGuia(admin, p.avisoId, o);
  if (!aviso) return { ok: false, status: 404, error: "aviso" };
  const ctx = contextoDeFila(aviso, cfg);
  if (!ctx || !aviso.arriendo || aviso.medianaComuna == null) return { ok: false, status: 422, error: "sin-datos" };
  const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(aviso), p.combo.piePct, o.tasa, aviso.arriendo.monto, { plazo: p.combo.plazoAnios, tasaMercado: cfg.tasa }), ctx);
  const s = sondaConPatch(body as never, cfg.uf, aviso.medianaComuna as never, ahora, {});
  return { ok: true, r: {
    veredicto: s.veredicto ?? null,
    score: s.score != null ? Math.round(s.score) : null,
    flujo: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null,
  } };
}
