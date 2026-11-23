// ============================================================================
// GOLDEN · NOCHE-INFORME (23-nov-2026) — catch-test, EN VIVO (lee la base)
// ============================================================================
//   El mismo depto, con los mismos supuestos y los mismos datos de hoy, tiene que dar el MISMO veredicto y el MISMO puntaje en los tres
//   caminos que lo muestran: la evaluación de la noche (avisos/evaluar-aviso.ts › evaluarAviso, la del mapa y los correos), el informe
//   de «Analizar este» (analizar-servidor.ts › cuerpoDelAviso + la mediana + runAnalysis, como la ruta) y la confirmación en vivo del
//   correo (guia/vivo.ts). Si uno de los tres arma la entrada distinto, se separan sin que nadie lo vea: es el caso e828d352 por el
//   lado del método (el de la foto vieja lo cubre CORREO-VIVO).
//   Muestra fija y determinista: el aviso del caso (e151131b) y los primeros Comprar usados activos por id. Pie 20 %, 30 años y la
//   tasa del motor (los supuestos de la noche).
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens; lee la base (comparables por radio).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/noche-informe-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { evaluarAviso } from "../../../src/lib/avisos/evaluar-aviso";
import { runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { METHODOLOGY_VERSION_ACTUAL } from "../../../src/lib/modelo-costos";
import { redondearPiePct } from "../../../src/lib/analysis/pie-input-data";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { avisoDeCandidato, leerConfigGuia, origenSintetico } from "../../../src/lib/guia/guia-servidor";
import { cuerpoDelAviso } from "../../../src/lib/guia/analizar-servidor";
import { candidatoExplorar } from "../../../src/lib/explorar/servidor";
import { antiguedadDeCandidato, evaluadorVivo } from "../../../src/lib/guia/vivo";

const AVISO_CASO = "e151131b-c697-43f8-855c-dba201e7228b";
const N_MUESTRA = 5;

export async function runNocheInformeTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER NOCHE-INFORME (la noche, el informe y el correo dan el mismo veredicto y puntaje para el mismo depto · 0 tokens, lee la base) ───");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) { F("0 · sin credenciales de la base: el tier no corrió (no es un verde)"); return finalizar(fallas); }
  const sb = createClient(url, llave);
  const cfg = await leerConfigGuia(sb);
  const { data: filas, error } = await sb.from("avisos_evaluados").select("aviso_id").eq("veredicto_20", "COMPRAR").eq("condicion", "usado").order("aviso_id").limit(40);
  if (error) { F(`0 · no se pudo leer la muestra: ${error.message}`); return finalizar(fallas); }
  const ids = [AVISO_CASO, ...(filas ?? []).map((f) => f.aviso_id as string).filter((id) => id !== AVISO_CASO)];
  const vivo = evaluadorVivo(sb, cfg);
  const combo = { piePct: 20, plazoAnios: 30 };
  let probados = 0;
  for (const id of ids) {
    if (probados >= N_MUESTRA + 1) break;
    const c = await candidatoExplorar(sb, id).catch(() => null);
    if (!c) continue;
    const antiguedad = antiguedadDeCandidato(c);
    // La noche (lo que guarda avisos_evaluados y muestran el mapa y los correos), corrida hoy.
    const noche = await evaluarAviso(sb, avisoDeCandidato(c, antiguedad.anios), cfg, { segmentar: false }).catch((e) => { F(`${id.slice(0, 8)} · la noche falló: ${(e as Error).message}`); return null; });
    if (!noche) continue;
    // El informe de «Analizar este», como lo arma la ruta.
    const origen = { ...origenSintetico("", { piePct: 20, plazoAnios: 30, comunas: [], dormitorios: [] }, cfg), tasa: cfg.tasa };
    const body = await cuerpoDelAviso(c, origen, combo, antiguedad, cfg).catch(() => null);
    if (!body) { if (noche.veredicto_20) F(`${id.slice(0, 8)} · la noche da ${noche.veredicto_20} y el informe no se puede armar`); continue; }
    if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
    body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
    const mediana = await prefetchMedianaComunaVenta(sb as never, body, cfg.uf);
    const r = runAnalysis(body, cfg.uf, mediana);
    const informe = { veredicto: readVeredicto(r) ?? null, score: typeof r.score === "number" ? Math.round(r.score) : null };
    // La confirmación del correo.
    const correo = await vivo.evaluar(c, { origen, combo });
    probados++;
    const n = { veredicto: noche.veredicto_20, score: noche.score_20 };
    const dice = `noche ${n.veredicto} ${n.score} · informe ${informe.veredicto} ${informe.score} · correo ${correo?.veredicto ?? "—"} ${correo?.score ?? "—"}`;
    if (n.veredicto !== informe.veredicto || n.score !== informe.score) F(`${id.slice(0, 8)} · la noche y el informe se separan con los mismos supuestos (${dice})`);
    if (!correo || correo.veredicto !== informe.veredicto || correo.score !== informe.score) F(`${id.slice(0, 8)} · el correo y el informe se separan con los mismos supuestos (${dice})`);
  }
  if (probados < 3) F(`0 · se probaron ${probados} avisos: la muestra no alcanza para afirmar nada`);
  else console.log(`  · ${probados} avisos probados (incluido el del caso), los tres caminos comparados`);
  return finalizar(fallas);
}

function finalizar(fallas: string[]): { hard: number } {
  if (fallas.length === 0) console.log("  ✓ NOCHE-INFORME: todo en orden");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  if (fallas.length) console.log(`  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runNocheInformeTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ============================================================================
// ACTA DE VERIFICACIÓN EN ROJO (23-nov-2026) — cada mutación, revertida después, puso el tier en rojo:
//   M1 el informe arma el arriendo +12 % (cuerpoDelAviso) ...... «la noche y el informe se separan (noche AJUSTA 66 · informe COMPRAR 71)»
//   M2 el correo arma otro plazo (vivo.ts) ..................... «el correo y el informe se separan (… correo AJUSTA 58)»
//   2/2 en rojo. Verde de base: 6 avisos, ~30 s.
// ============================================================================
