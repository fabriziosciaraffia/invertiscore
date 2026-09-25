// ─────────────────────────────────────────────────────────────────────────────
// TIER RETIRO-VENTAJA-LTR (22-sep-2026) · la ventaja sobre el arriendo largo salió de STR entera:
// era un vestigio de AMBAS (LTR no compara contra el corto y no le falta) y el usuario evalúa cada
// modalidad en su mérito. AMBAS conserva lo suyo.
//
// Reglas:
//   1 · EL SCORE NO LEE LA VENTAJA: `PESOS_SCORE_STR` sin `ventaja`, suma 100 con los pesos
//       renormalizados (18,75 · 25 · 25 · 18,75 · 12,5); el desglose de un recompute real no la trae;
//       el score es la media ponderada de las cinco.
//   2 · LOS DOS GATES NO EXISTEN: ni `g1_flujoSevero` ni `g2_ltrGana` en las listas ni en los brazos
//       evaluados; `evalGatesSTR` no recibe la sobre-renta.
//   3 · EL HALLAZGO NO SE EMITE EN STR SUELTO: `buildStrHallazgos` sobre una seed congelada no trae
//       `ventaja_vs_ltr`, y el módulo del hallazgo no existe.
//   4 · EL CAPÍTULO V NO EXISTE: `CapituloStrId` sin «gestion», seis romanos, seis filas, sin
//       «Corto o largo», sin `cierreLargoStr`.
//   5 · AMBAS SIGUE LEYENDO `comparativa.ltr`: el motor lo calcula (NOI del largo finito en la seed) y
//       el comparativo lo consume (`comparativa-client.tsx`, `comparativa-hero-copy.ts`); la banda y
//       `recomendacionModalidad` siguen en el motor.
//   6 · lo que salió no vuelve: sin §3.bis ni «COMPARATIVA STR vs LTR» en el prompt, `vsLTR` fuera del
//       schema (la acción vive en `conviene.estrategiaSugerida`), sin `afirmacionesContraSigno`, sin
//       «Ventaja vs arriendo largo» en el PDF, sin el knob `ventaja_vs_ltr`, sin «Analízalo como renta
//       larga» en el hero.
//
// Verificado EN ROJO por mutación (scratchpad mutar13.py).
// Corre solo: node --env-file=.env.local --import tsx scripts/eval/golden/retiro-ventaja-ltr-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PESOS_SCORE_STR } from "../../../src/lib/score-retorno";
import { G1_BRAZOS, G2_BRAZOS, GLOSA_BRAZO } from "../../../src/lib/engines/short-term-score";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

export function runRetiroVentajaLtrTier(): { hard: number } {
  fallas.length = 0;
  // 1 · el score
  const pesos = PESOS_SCORE_STR as Record<string, number>;
  if ("ventaja" in pesos) F("1 · PESOS_SCORE_STR sigue teniendo «ventaja»");
  const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
  if (Math.abs(suma - 100) > 1e-9) F(`1 · los pesos STR suman ${suma}, no 100`);
  for (const [k, v] of Object.entries({ rentabilidad: 18.75, sostenibilidad: 25, factibilidad: 25, cashOnCash: 18.75, tir: 12.5 })) if (pesos[k] !== v) F(`1 · peso «${k}» = ${pesos[k]}, esperado ${v}`);
  const frozen = loadFrozen();
  const seed = STR_GE_SEEDS.find((s) => s.key === "GE-1");
  const rec: any = seed ? recomputeStrSeed(seed, frozen) : null;
  if (!rec) F("1 · no se pudo recomputar GE-1");
  else {
    const fs = rec.score; const d = fs?.desglose ?? {};
    if ("ventaja" in d) F("1 · el desglose del recompute trae «ventaja»");
    let num = 0, den = 0;
    for (const k of Object.keys(pesos)) { const dim = d[k]; if (!dim || dim.aplica === false) continue; num += pesos[k] * dim.score; den += pesos[k]; }
    const esperado = Math.max(0, Math.min(100, Math.round(num / den)));
    if (fs.score !== esperado) F(`1 · el score de GE-1 (${fs.score}) no es la media ponderada de sus cinco dimensiones (${esperado})`);
    // 2 · los gates
    const brazos = fs.gates?.brazos ?? {};
    if ("g1_flujoSevero" in brazos || "g2_ltrGana" in brazos) F("2 · los brazos evaluados traen g1_flujoSevero o g2_ltrGana");
    // 3 · el hallazgo
    const ids = (rec.hz ?? []).map((h: any) => h.id);
    if (ids.includes("ventaja_vs_ltr")) F("3 · el recompute STR sigue emitiendo ventaja_vs_ltr");
    if (!ids.length) F("3 · el recompute no trae hallazgos: el chequeo no midió nada");
    // 5 · AMBAS sigue leyendo comparativa.ltr
    const c = rec.rec.comparativa;
    if (!c || !Number.isFinite(c.ltr?.noiMensual) || !Number.isFinite(c.sobreRentaPct)) F("5 · el motor dejó de calcular comparativa.ltr / sobreRentaPct (AMBAS los lee)");
    if (!rec.rec.veredictoComparativo?.banda || !rec.rec.recomendacionModalidad) F("5 · el motor dejó de emitir la banda / recomendacionModalidad (AMBAS los lee)");
  }
  if ((G1_BRAZOS as readonly string[]).includes("g1_flujoSevero") || (G2_BRAZOS as readonly string[]).includes("g2_ltrGana")) F("2 · las listas de brazos siguen con los gates de la ventaja");
  if ("g1_flujoSevero" in GLOSA_BRAZO || "g2_ltrGana" in GLOSA_BRAZO) F("2 · GLOSA_BRAZO sigue con los gates de la ventaja");
  const score = sinComentarios(leer("src/lib/engines/short-term-score.ts"));
  if (/sobreRentaPct/.test(score)) F("2 · short-term-score.ts sigue leyendo la sobre-renta");
  if (/calcVentaja|ESCALA_SOBRENTA/.test(score)) F("1 · la dimensión ventaja sigue en el score");
  if (existsSync(join(RAIZ, "src/lib/ventaja-vs-ltr-hallazgo.ts"))) F("3 · el módulo ventaja-vs-ltr-hallazgo.ts sigue existiendo");
  if (/ventaja_vs_ltr/.test(sinComentarios(leer("src/lib/str-hallazgos.ts")))) F("3 · str-hallazgos.ts sigue emitiendo ventaja_vs_ltr");
  if (/ventaja_vs_ltr/.test(sinComentarios(leer("src/lib/decisividades-str.ts")))) F("6 · el knob ventaja_vs_ltr sigue en las decisividades");
  // 4 · el capítulo V
  const caps = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  if (!/export type CapituloStrId = "renta" \| "flujo" \| "noches" \| "pagas" \| "plusvalia" \| "resultado";/.test(caps)) F("4 · CapituloStrId no son los seis capítulos");
  if (!/const ROMANO: Record<CapituloStrId, string> = \{ renta: "I", flujo: "II", noches: "III", pagas: "IV", plusvalia: "V", resultado: "VI" \};/.test(caps)) F("4 · los romanos no son I–VI");
  if (!/const filas = \[filaI, filaII, filaIII, filaIV, filaPlus, filaVI\]/.test(caps)) F("4 · las filas no son seis");
  if (/Corto o largo|cierres\.largo|filaV\b|"gestion"/.test(caps)) F("4 · el capítulo V «Corto o largo» sigue montado");
  if (/cierreLargoStr/.test(sinComentarios(leer("src/lib/cierres-capitulos-str.ts")) + sinComentarios(leer("src/lib/cierres-str-ensamblador.ts")))) F("4 · cierreLargoStr sigue existiendo");
  // 5 · AMBAS lo consume
  const cc = sinComentarios(leer("src/app/analisis/comparativa/comparativa-client.tsx"));
  if (!/comparativa\?\.sobreRentaPct/.test(cc) || !/veredictoComparativo\?\.banda/.test(cc)) F("5 · el comparativo dejó de leer la sobre-renta / la banda");
  if (!/comparativa\.ltr\b|comparativa\?\.ltr\b/.test(sinComentarios(leer("src/lib/comparativa-findings.ts")) + cc + sinComentarios(leer("src/lib/comparativa-recomendacion.ts")))) F("5 · ningún consumidor de AMBAS lee comparativa.ltr");
  const eng = sinComentarios(leer("src/lib/engines/short-term-engine.ts"));
  if (!/const ltr_noiMensual = /.test(eng) || !/recomendacionModalidad,/.test(eng) || !/veredictoComparativo,/.test(eng)) F("5 · el motor dejó de calcular la comparativa o la banda");
  // 6 · lo que salió no vuelve
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: se fueron los chequeos del prompt STR (la comparación con el largo, la acción
  // en `conviene.estrategiaSugerida`, la v22); el generador ya no existe.
  const guards = sinComentarios(leer("src/lib/str-guards.ts"));
  if (/afirmacionesContraSigno|"modalidad"|sobreRenta/.test(guards)) F("6 · el guard de modalidad sigue en str-guards.ts");
  if (!/"conviene\.estrategiaSugerida"/.test(guards) || /vsLTR/.test(guards)) F("6 · los paths de prosa no migraron a conviene.estrategiaSugerida");
  const pdf = sinComentarios(leer("src/app/analisis/renta-corta/[id]/documento/DocumentoSTR.tsx"));
  if (/Ventaja vs arriendo largo|Sobre-renta vs LTR|ai\?\.vsLTR|bandaLabel|d\.ventaja/.test(pdf)) F("6 · el PDF STR sigue con la sección de la ventaja");
  const hero = sinComentarios(leer("src/components/analysis/str/HeroStrDictamen.tsx"));
  if (/Analízalo como renta larga|ventaja_vs_ltr|HallazgoVentajaVsLtr/.test(hero)) F("6 · el hero STR sigue con la salida a renta larga");
  // ⚠ ACTA (25-sep-2026) · LA IA SALIÓ DEL INFORME: el hero ya no lee la acción de la prosa (ni
  // de `conviene` ni de `vsLTR`). Lo que queda es que no vuelva a leerla de `vsLTR`.
  if (/vsLTR/.test(hero)) F("6 · el hero volvió a leer la prosa de `vsLTR`");
  const nc = sinComentarios(leer("src/lib/no-cierra-copy.ts"));
  if (/vsLargo|g2_ltrGana|g1_flujoSevero/.test(nc)) F("6 · no-cierra-copy.ts sigue con la familia del largo");

  const hard = fallas.length;
  if (hard === 0) console.log("   retiro-ventaja-ltr ✓ (score sin ventaja y pesos 18,75/25/25/18,75/12,5, sin g1_flujoSevero ni g2_ltrGana, sin ventaja_vs_ltr en STR suelto, sin capítulo V, AMBAS sigue leyendo comparativa.ltr y la banda, prompt v22 sin vsLTR, sin guard de modalidad, PDF y hero sin la ventaja)");
  else { console.log(`   retiro-ventaja-ltr ✗ ${hard} falla(s)`); for (const x of fallas) console.log(`     - ${x}`); }
  return { hard };
}

if (require.main === module) process.exit(runRetiroVentajaLtrTier().hard ? 1 : 0);
