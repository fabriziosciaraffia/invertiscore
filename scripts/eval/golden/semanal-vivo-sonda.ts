// ============================================================================
// SONDA · SEMANAL-VIVO (23-nov-2026) — en vivo, solo lectura
// ============================================================================
//   ¿El último semanal enviado sigue diciendo lo que diría el informe? Toma una muestra fija de los deptos del último semanal enviado
//   (renta larga) y los recalcula hoy con la función del informe y los supuestos de cada persona (guia/vivo.ts). ROJA si más del
//   TOPE_PCT % de los ítems de la muestra cambiaron de veredicto.
//   Línea base medida sobre el semanal del 23-nov-2026 (antes del arreglo): 92 de 1.428 ítems (6,4 %) con otro veredicto; 131 (9,2 %)
//   con otro veredicto o más de 10 puntos. Con el arreglo, el correo sale confirmado en vivo minutos antes del envío: lo que cambie
//   después es movimiento real del mercado, y por eso se mide el mismo día del envío.
//   Muestra: hasta MUESTRA ítems, ordenados por un hash estable de (persona, aviso) — siempre los mismos para el mismo correo.
//   No corre en el QUICK (lee comparables de ~60 avisos, 1-2 minutos). Se corre el lunes después del envío.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/semanal-vivo-sonda.ts [semana]
// ============================================================================
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { leerConfigGuia } from "../../../src/lib/guia/guia-servidor";
import { candidatoExplorar } from "../../../src/lib/explorar/servidor";
import { evaluadorVivo } from "../../../src/lib/guia/vivo";
import type { ItemSemanal } from "../../../src/lib/guia/semanal-servidor";

export const TOPE_PCT = 2;
export const MUESTRA = 60;

/** El veredicto de un ítem: ¿cambió? Puro (lo usa la sonda y lo prueba la mutación del acta). */
export function cambioDeItem(mostrado: string | null, hoy: string | null): boolean {
  return !!mostrado && hoy !== mostrado;
}
/** ¿Pasa la sonda? Puro. */
export function sondaPasa(cambiados: number, total: number, tope = TOPE_PCT): boolean {
  return total > 0 && (cambiados / total) * 100 <= tope;
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const cfg = await leerConfigGuia(sb);
  const semanaArg = process.argv[2];
  const { data: ult } = await sb.from("semanal_selecciones").select("semana").eq("tipo", "semanal").not("enviada_at", "is", null).order("semana", { ascending: false }).limit(1).maybeSingle();
  const semana = semanaArg ?? (ult?.semana as string | undefined);
  if (!semana) { console.log("✗ SEMANAL-VIVO: no hay semanal enviado"); process.exit(1); }
  const { data: sels, error } = await sb.from("semanal_selecciones").select("user_id, items, combinacion, perfil, origen_analysis_id").eq("semana", semana).eq("tipo", "semanal").not("enviada_at", "is", null).limit(1000);
  if (error) { console.log(`✗ SEMANAL-VIVO: ${error.message}`); process.exit(1); }
  type Item = { user: string; it: ItemSemanal; combo: { piePct: number; plazoAnios: number }; tasa: number; origen: string | null };
  const todos: Item[] = [];
  for (const s of sels ?? []) {
    const combo = s.combinacion as { piePct: number; plazoAnios: number; tasaPct?: number } | null;
    if (!combo) continue;
    const tasa = typeof combo.tasaPct === "number" ? combo.tasaPct : (s.perfil as { tasaPct?: number | null } | null)?.tasaPct ?? cfg.tasa;
    for (const it of (s.items ?? []) as ItemSemanal[]) if (it.veredicto) todos.push({ user: s.user_id as string, it, combo: { piePct: combo.piePct, plazoAnios: combo.plazoAnios }, tasa, origen: (s.origen_analysis_id as string | null) ?? null });
  }
  const hash = (x: Item) => createHash("sha1").update(`${x.user}:${x.it.avisoId}`).digest("hex");
  const muestra = todos.sort((a, b) => hash(a).localeCompare(hash(b))).slice(0, MUESTRA);
  const vivo = evaluadorVivo(sb, cfg);
  let cambiados = 0, sinVivo = 0;
  const detalle: string[] = [];
  for (const x of muestra) {
    const c = await candidatoExplorar(sb, x.it.avisoId).catch(() => null);
    const hoy = c ? await vivo.evaluar(c, { origen: { analysisId: x.origen, tasa: x.tasa } as never, combo: x.combo }) : null;
    if (!hoy) { sinVivo++; continue; }
    if (cambioDeItem(x.it.veredicto, hoy.veredicto)) { cambiados++; detalle.push(`${x.it.avisoId.slice(0, 8)} ${x.it.veredicto} ${x.it.score} → ${hoy.veredicto} ${hoy.score}`); }
  }
  const total = muestra.length - sinVivo;
  const pct = total ? Math.round((cambiados / total) * 1000) / 10 : 0;
  const ok = sondaPasa(cambiados, total);
  console.log(`${ok ? "✓" : "✗"} SEMANAL-VIVO · semana ${semana} · ${cambiados} de ${total} ítems de la muestra cambiaron de veredicto (${pct} %, tope ${TOPE_PCT} %)${sinVivo ? ` · ${sinVivo} sin poder recalcular (dados de baja o sin arriendo)` : ""}`);
  for (const d of detalle) console.log(`   · ${d}`);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) void main();
