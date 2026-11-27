// ─────────────────────────────────────────────────────────────────────────────
// LA FILA COMPLETA DE LA NOCHE (23-nov-2026): lo que el cron evaluar-avisos escribe en `avisos_evaluados` por cada aviso —la
// evaluación (evaluar-aviso.ts), el mismo aviso a 25 años y el descuento a Comprar de los Ajustar—, en UN lugar. Lo usan el cron y
// «Analizar este» cuando el recálculo en vivo da otro veredicto que el guardado (decisión de Fabrizio: la fila se actualiza en ese
// momento, con la misma función de la noche, para que el mapa y los correos dejen de mostrar el número viejo a todos).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluarAviso, type AvisoParaEvaluar } from "./evaluar-aviso";
import { candidatoDeEvaluacion, ESTANDAR25_VACIO, evaluarEstandar25, evaluarPlazosCortos, PLAZOS_CORTOS_VACIO } from "./estandar-deptos";
import { evaluarNegociar, NEGOCIAR_VACIO } from "./negociar";
import type { Sugerencias } from "@/lib/services/market-suggestions";

/** La fila que la noche guarda para este aviso, y cuánto tardó el descuento (el cron lo suma al resumen). */
export async function filaEvaluadaCompleta(
  sb: SupabaseClient,
  a: AvisoParaEvaluar,
  cfg: { uf: number; tasa: number },
  opts: { sug?: { arr: Sugerencias; vta: Sugerencias } } = {},
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sug, ...evaluada } = await evaluarAviso(sb, a, cfg, { segmentar: false, ...(opts.sug ? { sug: opts.sug } : {}) });
  const candidato = evaluada.arriendo ? candidatoDeEvaluacion(a, evaluada) : null;
  const t = Date.now();
  const negociar = candidato ? evaluarNegociar(candidato, evaluada, cfg) : NEGOCIAR_VACIO;
  const msNegociar = Date.now() - t;
  // Los plazos cortos (27-nov-2026): la asesoría filtra con el plazo que la edad permite (estandar-deptos.ts › evaluarPlazosCortos).
  const fila = { ...evaluada, ...(candidato ? evaluarEstandar25(candidato, cfg) : ESTANDAR25_VACIO), ...(candidato ? evaluarPlazosCortos(candidato, cfg) : PLAZOS_CORTOS_VACIO), ...negociar };
  return { fila, msNegociar };
}

/** Reevalúa el aviso con la función de la noche y guarda la fila (upsert por aviso). Devuelve si quedó guardada. */
export async function reevaluarYGuardarFila(
  sb: SupabaseClient,
  a: AvisoParaEvaluar,
  cfg: { uf: number; tasa: number },
  opts: { sug?: { arr: Sugerencias; vta: Sugerencias } } = {},
): Promise<{ ok: boolean; veredicto_20: string | null; error?: string }> {
  const { fila } = await filaEvaluadaCompleta(sb, a, cfg, opts);
  const { error } = await sb.from("avisos_evaluados").upsert(fila, { onConflict: "aviso_id" });
  return { ok: !error, veredicto_20: fila.veredicto_20, ...(error ? { error: error.message } : {}) };
}
