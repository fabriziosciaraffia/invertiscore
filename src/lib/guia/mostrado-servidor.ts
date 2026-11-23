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
