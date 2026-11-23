// ─────────────────────────────────────────────────────────────────────────────
// LO MOSTRADO, RECONSTRUIDO EN EL SERVIDOR (23-nov-2026, regla en cobro-mostrado.ts). Nunca lo que manda el navegador:
//   · desde un correo (semanal o inmediato) con la combinación del correo: el ítem tal como salió, por el token, con la fecha de
//     envío (la ventana de 14 días se mide desde ahí);
//   · desde una pantalla (mapa, Explorar, el pop-up con otra combinación, la guía, Invierte): la misma sonda que la dibuja
//     (estandar-deptos.ts › sondaDeCandidato sobre la evaluación guardada), con el mismo pie, plazo y tasa. Lo que dibuja la
//     pantalla es determinista sobre esa fila, así que reconstruirlo es exacto sin firmar nada en el navegador.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { seleccionPorToken, type ItemSemanal } from "./semanal-servidor";
import { sondaDeCandidato } from "@/lib/avisos/estandar-deptos";
import type { CandidatoGuia } from "./guia-servidor";
import type { Mostrado } from "./cobro-mostrado";

/** El ítem del correo para este aviso, con la fecha de envío. null si el token no es de esta persona o no trae el aviso. */
export async function mostradoDelCorreo(admin: SupabaseClient, token: string, userId: string, avisoId: string): Promise<Mostrado | null> {
  const sel = await seleccionPorToken(admin, token);
  if (!sel || sel.user_id !== userId || !sel.enviadaAt) return null;
  const it = ((sel.items ?? []) as ItemSemanal[]).find((i) => i.avisoId === avisoId);
  if (!it || !it.veredicto) return null;
  return { veredicto: it.veredicto, score: typeof it.score === "number" ? it.score : null, at: sel.enviadaAt, fuente: "correo" };
}

/** Lo que la pantalla dibuja de este aviso con esta combinación, en este momento. */
export function mostradoDePantalla(c: CandidatoGuia, combo: { piePct: number; plazoAnios: number; tasa: number | null }, cfg: { uf: number; tasa: number }, ahora: Date = new Date()): Mostrado | null {
  const s = sondaDeCandidato(c, { piePct: combo.piePct, plazoAnios: combo.plazoAnios, tasa: combo.tasa }, cfg, ahora);
  if (!s || !s.veredicto) return null;
  return { veredicto: s.veredicto, score: s.score, at: ahora.toISOString(), fuente: "pantalla" };
}

/**
 * LO QUE MOSTRÓ LA GUÍA (23-nov-2026, decisión de Fabrizio): la guía se guarda 12 horas (`guias_calculadas`) y la persona la mira
 * hecha. Si esa noche la fila del aviso se reevaluó, la sonda de hoy ya no es lo que vio: lo mostrado es el ítem de la guía
 * guardada, con su fecha, si su combinación es la que se analiza. null si no hay guía guardada con ese aviso y esa combinación.
 */
export async function mostradoDeGuia(admin: SupabaseClient, analysisId: string, avisoId: string, combo: { piePct: number; plazoAnios: number }): Promise<Mostrado | null> {
  const { data } = await admin.from("guias_calculadas").select("resultado, calculada_at").eq("analysis_id", analysisId).maybeSingle();
  const r = data?.resultado as { disponible?: boolean; combinacion?: { piePct?: number; plazoAnios?: number } | null; items?: Array<{ avisoId: string; veredicto: string | null; score: number | null }> } | undefined;
  if (!data || !r?.disponible || !r.combinacion || r.combinacion.piePct !== combo.piePct || r.combinacion.plazoAnios !== combo.plazoAnios) return null;
  const it = (r.items ?? []).find((i) => i.avisoId === avisoId);
  if (!it?.veredicto) return null;
  return { veredicto: it.veredicto, score: typeof it.score === "number" ? it.score : null, at: String(data.calculada_at), fuente: "pantalla" };
}
