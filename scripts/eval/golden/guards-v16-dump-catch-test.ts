// ============================================================================
// GOLDEN · guards STR sobre el corpus v16 — catch-test (06-sep-2026). 0 tokens, puro.
// ============================================================================
// Las 12 salidas de la tanda FULL parcial del prompt STR v16 (`str-v16-dump/`, 6 seeds × 2
// corridas, prosa persistida tras los quirúrgicos) son el corpus del goal "guards STR (c) +
// (b)": el juez Opus vio ahí formas de engine-ism que el regex no cazaba (20 oraciones con
// "cruza al veredicto / cruza a COMPRAR / cruza esa línea / ninguno cruza / cruzarlo /
// celdas cruzando", 0 cazadas) y múltiplos de GE-1 mal resueltos ("triplica el neto del
// largo" y "casi tres veces más en NOI neto" con NOI corto/largo 2,98× daban violación;
// "casi dobla" con tarifa/p50 1,58× no daba).
//
// Criterio (Fabrizio, 06-sep): el detector caza TODA oración con la familia y NO dispara
// en ninguna oración sin ella. Las razones del motor salen del recompute determinista de
// cada seed (str-recompute), igual que en la tanda.
//   node --env-file=.env.local --import tsx scripts/eval/golden/guards-v16-dump-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  camposProsa, hitsEngineIsm, violacionesHeroClaimStr, violacionesPorCampo, contextoGuardsStr,
  PROSA_PATHS_STR, PROSA_RETRY_PATHS_STR, PATHS_SIN_RENDER_STR,
} from "../../../src/lib/str-guards";
import type { AIAnalysisSTRv2 } from "../../../src/lib/types";
import { recomputeStrSeed } from "./str-recompute";
import { STR_GE_SEEDS } from "./str-seeds";
import frozen from "./str-seeds-frozen.json";

const DIR = join(__dirname, "str-v16-dump");
const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

/** La familia que el juez marcó en las tandas v15 y v16 (lista literal del FASE 0). Una
 *  oración dispara el detector si y solo si trae alguna de estas formas. */
const FAMILIA = /\bcruz\w*|\bmodelo (?:base|positivo|negativo)\b|\b(?:pasa|llega|vuelve) a (?:positivo|negativo)\b|cambia (?:el|de) signo|ecuaci[óo]n se invierte|marca a favor/i;
const oraciones = (t: string) => t.split(/(?<=[.!?])\s+/).filter((o) => o.trim().length > 3);

const ctxPorSeed = new Map<string, ReturnType<typeof contextoGuardsStr>>();
for (const seed of STR_GE_SEEDS) {
  const fz = (frozen as Record<string, { input_data: Record<string, unknown> }>)[seed.key];
  const r = recomputeStrSeed(seed, frozen as never);
  if (!fz || !r) continue;
  const rec = { ...r.rec, francoScore: r.score, hallazgos: r.hz } as never;
  ctxPorSeed.set(seed.key, contextoGuardsStr(rec, fz.input_data, (fz.input_data.comuna as string) || "", r.sim));
}

const archivos = readdirSync(DIR).filter((x) => x.endsWith(".json")).sort();
if (archivos.length !== 12) F(`el corpus debe tener 12 salidas y tiene ${archivos.length}`);

let conFamilia = 0, cazadas = 0, falsos = 0, heroViol = 0;
const heroEsperadas = new Set([
  "GE-1 r0 riesgos.contenido", "GE-1 r0 francoCaveat", "GE-1 r1 conviene.respuestaDirecta", "GE-1 r1 vsLTR.contenido",
]);
const heroVistas = new Set<string>();

for (const f of archivos) {
  const d = JSON.parse(readFileSync(join(DIR, f), "utf8")) as { key: string; run: number; result: AIAnalysisSTRv2 };
  const ctx = ctxPorSeed.get(d.key);
  if (!ctx) { F(`${d.key}: sin recompute`); continue; }
  const id = `${d.key} r${d.run}`;
  for (const { path, texto } of camposProsa(d.result)) {
    for (const o of oraciones(texto)) {
      const fam = FAMILIA.test(o);
      const hits = hitsEngineIsm(o);
      if (fam) conFamilia++;
      if (fam && hits.length) cazadas++;
      if (fam && !hits.length) F(`${id} ${path}: no caza «${o.trim().slice(0, 140)}»`);
      if (!fam && hits.length) { falsos++; F(`${id} ${path}: dispara sin familia (${hits.join(" | ")}) en «${o.trim().slice(0, 140)}»`); }
    }
    const hero = violacionesHeroClaimStr(texto, ctx.razones);
    if (hero.length) {
      heroViol += hero.length;
      const k = `${id} ${path}`;
      heroVistas.add(k);
      if (!heroEsperadas.has(k)) F(`${k}: hero-claim inesperado — ${hero.join(" | ")}`);
      if (!hero.every((v) => v.includes("1.58×"))) F(`${k}: la violación debía ser la tarifa 1,58× — ${hero.join(" | ")}`);
    }
  }
  // GE-1: los múltiplos de 2,98× (NOI corto/NOI largo) tienen licencia en el titular y en la respuesta directa.
  if (d.key === "GE-1" && d.run === 0) {
    for (const path of ["titular", "conviene.respuestaDirecta"]) {
      const t = camposProsa(d.result, [path])[0]?.texto ?? "";
      if (!/triplica|tres veces/.test(t)) F(`${id} ${path}: el corpus cambió, ya no trae el múltiplo de 2,98×`);
    }
  }
  // Paths sin render: se detectan pero no reintentan. Sobre el corpus, con `solo` nunca aparece uno.
  for (const regla of ["engineism", "hero-claim"] as const) {
    const todo = violacionesPorCampo(d.result, regla, ctx);
    const retry = violacionesPorCampo(d.result, regla, ctx, PROSA_RETRY_PATHS_STR);
    for (const p of Object.keys(retry)) if ((PATHS_SIN_RENDER_STR as readonly string[]).includes(p)) F(`${id}: ${regla} reintentaría ${p}, que nadie renderiza`);
    for (const p of Object.keys(todo)) if (!(p in retry) && !(PATHS_SIN_RENDER_STR as readonly string[]).includes(p)) F(`${id}: ${regla} en ${p} desapareció al acotar a los paths con render`);
  }
}
for (const k of heroEsperadas) if (!heroVistas.has(k)) F(`${k}: debía disparar hero-claim (1,58×) y no disparó`);
if (conFamilia < 20) F(`el corpus debía traer ≥ 20 oraciones con la familia y trae ${conFamilia}`);
if (PROSA_RETRY_PATHS_STR.length !== PROSA_PATHS_STR.length - PATHS_SIN_RENDER_STR.length) F("PROSA_RETRY_PATHS_STR no es PROSA_PATHS_STR menos los sin render");

console.log("\n[GUARDS STR · corpus v16] · catch-test\n");
console.log(`  oraciones con la familia: ${conFamilia} · cazadas: ${cazadas} · disparos sin familia: ${falsos} · hero-claim: ${heroViol} violación(es) en ${heroVistas.size} campo(s)`);
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
