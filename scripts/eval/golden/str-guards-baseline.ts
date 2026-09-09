// ============================================================================
// GOLDEN STR · BASELINE DE GUARDS — la métrica y su lector. 0 tokens.
// ============================================================================
// El dump de LTR guarda `{ result, warns }` desde siempre; el de STR guardaba todo menos
// el log. Así que el log de guards STR se imprimía filtrado a stderr y se moría con la
// corrida, y la pregunta «¿este bump movió la tasa de guards?» se contestaba contra la
// nada. Ahora `runStrGenerateTier` guarda `warns` y esta es la casa de la cuenta.
//
// LA MÉTRICA ES «GENERACIONES CON ≥1 EVENTO / GENERACIONES CONTADAS», no eventos sueltos:
// un guard que reintenta dos veces dentro de la misma generación es UN caso, no dos. Las
// dos columnas se imprimen, pero la que se compara entre versiones es la primera.
//
// Vive acá y no en str-generate para que haya UNA sola definición: el tier la importa. Si
// la cuenta viviera en los dos lados, tarde o temprano dirían cosas distintas del mismo
// dump — que es exactamente el problema que este archivo existe para evitar.
//
// Uso como lector, sobre dos dumps ya existentes (cero tokens, no genera nada):
//   node --import tsx scripts/eval/golden/str-guards-baseline.ts <dirA> [dirB]
// Con un solo directorio imprime su tabla; con dos, la comparación A→B.
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PREFIJO_GUARD = /^\[([A-Z0-9-]+)\]/;

export interface BaselineGuards {
  /** generaciones con ≥1 evento, por guard. Esta es la tasa comparable. */
  generaciones: Record<string, number>;
  /** eventos totales, por guard. Contexto, no la métrica. */
  eventos: Record<string, number>;
  /** generaciones contadas (el denominador). */
  total: number;
  /** generaciones leídas de un dump SIN la clave `warns`. NO son cero: son sin medir. */
  sinLog: number;
}

export const nuevoBaseline = (): BaselineGuards => ({ generaciones: {}, eventos: {}, total: 0, sinLog: 0 });

/** `warns === null` ⇒ la generación vino de un dump sin log. Se cuenta aparte y NUNCA como
 *  cero eventos: «no lo medí» y «midió cero» no son lo mismo, y confundirlos haría que el
 *  próximo bump «baje» la tasa por arte de magia. */
export function contarGuards(base: BaselineGuards, warns: string[] | null): void {
  base.total++;
  if (warns === null) { base.sinLog++; return; }
  const vistos = new Set<string>();
  for (const w of warns) {
    const m = PREFIJO_GUARD.exec(w.trim());
    if (!m) continue;
    base.eventos[m[1]] = (base.eventos[m[1]] ?? 0) + 1;
    vistos.add(m[1]);
  }
  for (const g of vistos) base.generaciones[g] = (base.generaciones[g] ?? 0) + 1;
}

export function fundir(destino: BaselineGuards, origen: BaselineGuards): void {
  destino.total += origen.total;
  destino.sinLog += origen.sinLog;
  for (const [g, n] of Object.entries(origen.generaciones)) destino.generaciones[g] = (destino.generaciones[g] ?? 0) + n;
  for (const [g, n] of Object.entries(origen.eventos)) destino.eventos[g] = (destino.eventos[g] ?? 0) + n;
}

const ordenados = (b: BaselineGuards) =>
  Object.keys(b.generaciones).sort((x, y) => (b.generaciones[y] - b.generaciones[x]) || x.localeCompare(y));

/** La tabla del baseline: por seed y de la tanda. La imprime `runStrGenerateTier` SIEMPRE
 *  —generando o con `--from`— para que el baseline sea una propiedad de la tanda y no un
 *  ritual que alguien tiene que acordarse de correr. */
export function printBaselineGuards(porSeed: Array<[string, BaselineGuards]>, tanda: BaselineGuards): void {
  console.log(`\n─── GUARDS STR · baseline de la tanda ───`);
  console.log(`  métrica: generaciones con ≥1 evento / generaciones contadas — NO eventos sueltos`);
  console.log(`  (entre paréntesis, los eventos totales: un guard que reintenta dos veces en la misma generación es UN caso)`);
  if (tanda.total === 0) { console.log("  (sin generaciones contadas)"); return; }

  console.log(`\n  por seed:`);
  for (const [key, b] of porSeed) {
    const gs = ordenados(b);
    // Cuando TODA la seed viene sin log, «sin eventos» sería la mentira exacta que este
    // módulo existe para no decir: no midió cero, no midió.
    const detalle = b.total === b.sinLog
      ? `SIN LOG (${b.sinLog}/${b.total}) — sin medir`
      : (gs.length ? gs.map((g) => `${g} ${b.generaciones[g]}/${b.total}(${b.eventos[g]})`).join("  ") : "sin eventos") +
        (b.sinLog ? `  · ${b.sinLog}/${b.total} SIN LOG` : "");
    console.log(`    ${key.padEnd(6)} ${detalle}`);
  }

  console.log(`\n  tanda (${tanda.total} generaciones):`);
  const gs = ordenados(tanda);
  if (gs.length === 0) {
    console.log(tanda.total === tanda.sinLog
      ? `    SIN DATOS — las ${tanda.total} generaciones vienen sin log. Esto NO es «ningún guard disparó».`
      : `    ningún guard disparó`);
  }
  for (const g of gs) {
    const pct = ((tanda.generaciones[g] / tanda.total) * 100).toFixed(0);
    console.log(`    ${g.padEnd(30)} ${String(tanda.generaciones[g]).padStart(2)}/${tanda.total} (${pct}%)  · ${tanda.eventos[g]} evento(s)`);
  }
  if (tanda.sinLog) {
    console.log(`\n  ⚠ ${tanda.sinLog}/${tanda.total} generaciones SIN LOG DE GUARDS (dump anterior a este campo).`);
    console.log(`    No cuentan como cero: quedan fuera de la tasa. Para medirlas hay que regenerar.`);
  }
}

// ── Lector: cuenta un directorio de dump ya escrito ──────────────────────────
export function leerDump(dir: string): { porSeed: Array<[string, BaselineGuards]>; tanda: BaselineGuards } {
  const archivos = readdirSync(dir).filter((f) => /-str-run\d+\.json$/.test(f)).sort();
  const mapa = new Map<string, BaselineGuards>();
  const tanda = nuevoBaseline();
  for (const f of archivos) {
    const key = f.replace(/-str-run\d+\.json$/, "");
    const j = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { warns?: unknown };
    if (!mapa.has(key)) mapa.set(key, nuevoBaseline());
    contarGuards(mapa.get(key)!, Array.isArray(j.warns) ? (j.warns as string[]) : null);
  }
  const porSeed = [...mapa.entries()];
  for (const [, b] of porSeed) fundir(tanda, b);
  return { porSeed, tanda };
}

function comparar(a: BaselineGuards, b: BaselineGuards, dirA: string, dirB: string): void {
  console.log(`\n─── COMPARACIÓN  A=${dirA}  →  B=${dirB} ───`);
  if (a.sinLog || b.sinLog) {
    console.log(`  ⚠ hay generaciones SIN LOG (A ${a.sinLog}/${a.total}, B ${b.sinLog}/${b.total}).`);
    console.log(`    La comparación de esos guards NO es válida: no se midieron, no dieron cero.`);
  }
  const tasa = (x: BaselineGuards, g: string) => (x.total ? (x.generaciones[g] ?? 0) / x.total : 0);
  const todos = [...new Set([...Object.keys(a.generaciones), ...Object.keys(b.generaciones)])].sort();
  if (!todos.length) { console.log("  ningún guard disparó en ninguna de las dos"); return; }
  console.log(`  guard                            A            B          delta`);
  for (const g of todos) {
    const ta = tasa(a, g), tb = tasa(b, g);
    const d = (tb - ta) * 100;
    const signo = d > 0 ? `+${d.toFixed(0)}` : d.toFixed(0);
    console.log(`  ${g.padEnd(30)} ${String(a.generaciones[g] ?? 0).padStart(2)}/${a.total} (${(ta * 100).toFixed(0)}%)  ${String(b.generaciones[g] ?? 0).padStart(2)}/${b.total} (${(tb * 100).toFixed(0)}%)   ${signo} pts`);
  }
}

if (require.main === module) {
  const [dirA, dirB] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!dirA) {
    console.error("uso: str-guards-baseline.ts <dirA> [dirB]");
    process.exit(1);
  }
  const A = leerDump(dirA);
  console.log(`\n══ ${dirA} ══`);
  printBaselineGuards(A.porSeed, A.tanda);
  if (dirB) {
    const B = leerDump(dirB);
    console.log(`\n══ ${dirB} ══`);
    printBaselineGuards(B.porSeed, B.tanda);
    comparar(A.tanda, B.tanda, dirA, dirB);
  }
}
