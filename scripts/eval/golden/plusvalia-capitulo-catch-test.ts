// ─────────────────────────────────────────────────────────────────────────────
// TIER PLUSVALÍA-CAPÍTULO (22-sep-2026) · «Plusvalía» (IV LTR / VI STR) según el mockup aprobado
// (docs/wireframes/rediseno-informe/capitulo-iv-plusvalia.html).
//
// Reglas:
//   1 · LA SERIE LLEGA COMPLETA HASTA 2025 por la misma cadena que el histórico: el hallazgo de
//       plusvalía (LTR y STR) trae `serie` GfK 2015→2024 más el cierre 2025 como un punto más, unida;
//       Arenas & Cayo trae los dos extremos; sin serie propia, el promedio Gran Santiago.
//   2 · EL 3% UNA SOLA VEZ en la prosa del capítulo (párrafo «Lo que entra al informe»): el cierre y el
//       pie no lo repiten; el rótulo del gráfico (SVG) es dato, no prosa.
//   3 · LA TERCERA FRASE SOLO CON SOBREPRECIO: «Pagaste X% sobre la mediana…» va detrás de
//       `sobre ?`, en los dos capítulos.
//   4 · SIN VERDE NI OCRE en el capítulo, en SeriePlusvalia ni en su bloque de TokensShared.
//   5 · STR MONTA EL CAPÍTULO: `filaPlus` en `filas`, ROMANO con «plusvalia», la frase «La plusvalía
//       entra como supuesto» fuera de «Tu resultado».
//   6 · lo que salió no vuelve: sin Thermo, sin «Franco no usa el histórico», sin «supuesto neutro», sin
//       la proyección del valor en el capítulo; extremos siempre rotulados y el resto al tocar.
//
// Verificado EN ROJO por mutación (scratchpad mutar11.py).
// Corre solo: node --import tsx scripts/eval/golden/plusvalia-capitulo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { resolveSeriePlusvalia, buildHallazgoPlusvalia, getPlusvaliaRef, resolvePlusvaliaComuna } from "../../../src/lib/plusvalia-hallazgo";
import { cierrePlusvalia } from "../../../src/lib/cierres-capitulos";
import { fuentePlusvaliaLinea } from "../../../src/lib/plusvalia-procedencia";
import { GFK_SERIE, PLUSVALIA_ESTIMADO_2025, ANIO_ESTIMADO } from "../../../src/lib/plusvalia-estimado.gen";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const capitulo = (s: string, desde: string, hasta: string) => { const i = s.indexOf(desde), j = s.indexOf(hasta, i); return i >= 0 && j > i ? s.slice(i, j) : ""; };

export function runPlusvaliaCapituloTier(): { hard: number } {
  fallas.length = 0;

  // 1 · la serie
  const stgo = resolveSeriePlusvalia("Santiago");
  const gfk = GFK_SERIE["Santiago"];
  if (!gfk || !PLUSVALIA_ESTIMADO_2025["Santiago"]) F("1 · Santiago perdió la serie GfK o el estimado 2025 del módulo generado");
  else {
    if (stgo.puntos.length !== gfk.valores.length + 1) F(`1 · Santiago: ${stgo.puntos.length} puntos; debía ser la serie GfK más el 2025 (${gfk.valores.length + 1})`);
    if (stgo.puntos[stgo.puntos.length - 1].anio !== ANIO_ESTIMADO || stgo.puntos[stgo.puntos.length - 1].valor !== PLUSVALIA_ESTIMADO_2025["Santiago"].ufM2) F("1 · el último punto de Santiago no es el cierre 2025 estimado");
    if (stgo.puntos[0].anio !== gfk.desde || stgo.puntos[0].valor !== gfk.valores[0]) F("1 · el primer punto de Santiago no es el 2015 de GfK");
    if (stgo.puntos.some((p, i) => i > 0 && p.anio !== stgo.puntos[i - 1].anio + 1)) F("1 · la serie de Santiago tiene años salteados: no está unida");
    if (stgo.unidad !== "uf_m2") F("1 · la serie GfK no declara UF/m²");
  }
  const ac = resolveSeriePlusvalia("Independencia");
  if (ac.puntos.length !== 2 || ac.puntos[0].anio !== 2014 || ac.puntos[1].anio !== 2024 || ac.unidad !== "uf_depto") F(`1 · Arenas & Cayo debía dar los dos extremos 2014 y 2024 en UF por depto (${JSON.stringify(ac)})`);
  const gs = resolveSeriePlusvalia("Comuna Inexistente");
  if (gs.puntos.length < 10 || gs.puntos[0].anio !== 2015) F("1 · sin serie propia debía dar el promedio Gran Santiago desde 2015");
  // por la misma cadena que el histórico: el hallazgo la trae en las dos modalidades
  for (const modalidad of ["ltr", "str"] as const) {
    const r = resolvePlusvaliaComuna("Santiago");
    const h = buildHallazgoPlusvalia({ anualizadaPct: r.anualizada, tieneData: r.tieneData, cobertura: r.cobertura, ref: getPlusvaliaRef(), comuna: "Santiago", modalidad, decisividad: 0, magnitudContinua: 0 });
    if (!h?.valor.serie || h.valor.serie.length !== stgo.puntos.length || h.valor.serieUnidad !== "uf_m2") F(`1 · el hallazgo ${modalidad} no trae la serie completa`);
  }
  const gs2 = GOLDEN_SEEDS.find((s) => s.key === "GS-2");
  if (gs2) {
    const res: any = runAnalysis(gs2.input, GOLDEN_UF, gs2.mediana, GOLDEN_ASOF);
    const h = (res.hallazgos ?? []).find((x: any) => x.id === "plusvalia");
    if (!h?.valor?.serie?.length) F("1 · runAnalysis (GS-2) no emite la serie en el hallazgo de plusvalía");
  }

  // 2–6 · los capítulos
  const L = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  const S = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  const capL = capitulo(L, "const filaIV: FilaHallazgo | null = plus", "const filaV: FilaHallazgo | null =");
  const capS = capitulo(S, "const filaPlus: FilaHallazgo | null = plusStr", "const filaVI: FilaHallazgo | null =");
  if (!capL || !capS) F("2 · no se encuentran los cuerpos de filaIV / filaPlus");
  const prosa = (c: string) => {
    // solo la prosa: VProsa, viz-pie, cierre y fuente; fuera el SVG (rotuloRef/rotuloSerie), el sub y el título del VViz
    const sinGrafico = c.replace(/<SeriePlusvalia[^]*?\/>/g, "").replace(/ksub: \[[^]*?\]\s*\.filter\(Boolean\)\s*\.join\(" · "\),|ksub: \[[^]*?\]\.join\(" · "\),/g, "").replace(/<VViz t=\{`[^`]*`\}>/g, "<VViz>");
    return sinGrafico;
  };
  for (const [mod, c] of [["LTR", capL], ["STR", capS]] as const) {
    const veces = (prosa(c).match(/proyPctNum\}%|(?<![\d,.])3%/g) ?? []).length;
    if (veces !== 1) F(`2 · ${mod}: el 3% aparece ${veces} veces en la prosa del capítulo; debía ser una`);
    if (!/\{sobre \? ` Pagaste \$\{sobre\.desviacionPct\}% sobre la mediana de la comuna: esos \$\{compact\(sobre\.clp\)\} los descuenta «Tu resultado» antes de proyectar\.` : ""\}/.test(c)) F(`3 · ${mod}: la tercera frase no está gateada por el sobreprecio`);
    if (!/const sobre = exit\?\.sobreprecioVenta \?\? null;/.test(c)) F(`3 · ${mod}: el sobreprecio no se lee del exit`);
    if (/--doc-good|--doc-warn|#2E8B57|#B7791F|#57B98A|#DFA34F/i.test(c)) F(`4 · ${mod}: el capítulo nombra verde u ocre`);
    if (/<Thermo|Franco no usa el histórico|supuesto neutro|valorVenta - preEntrega|Lo que Franco proyecta para este depto/.test(mod === "STR" ? c : c.replace(/\{preEntrega && valorVenta > 0 && \([^]*?<VCierre/, "<VCierre"))) F(`6 · ${mod}: volvió una pieza retirada (termómetro, «Franco no usa el histórico», «supuesto neutro», proyección del valor)`);
    if (!/<SeriePlusvalia\s/.test(c) || !/puntos=\{serie\}/.test(c) || !/refPct=\{proyPctNum\}/.test(c)) F(`6 · ${mod}: el gráfico no es SeriePlusvalia con la serie del hallazgo y el 3% como referencia`);
    if (!/const serie = v\.serie \?\? resolveSeriePlusvalia\(comuna\)\.puntos;/.test(c)) F(`1 · ${mod}: el capítulo no lee la serie del hallazgo`);
    if (!/<VFuente>\{fuentePlusvaliaLinea\(comuna, v\.tieneData\)\}<\/VFuente>/.test(c)) F(`6 · ${mod}: la fuente no es la línea única`);
    if (!/<b>Lo que entra al informe\.<\/b> Lo que subió \{nombreSerie\} pesa en tu veredicto\./.test(c)) F(`2 · ${mod}: falta «Lo que entra al informe» para el usuario`);
    if (/dimensión|puntos del score|30%/.test(c)) F(`2 · ${mod}: el párrafo habla en fórmula (dimensión / puntos del score)`);
  }
  if (/Compras en verde/.test(capS)) F("5 · STR monta la compra en verde");
  if (!/<VProsa>La plusvalía es del depto, no de cómo lo operas/.test(capS)) F("5 · STR no lleva la intro de una frase");
  if (!/const filas = \[filaI, filaII, filaIII, filaIV, filaV, filaPlus, filaVI\]/.test(S)) F("5 · STR no monta filaPlus en las filas");
  if (!/plusvalia: "VI", resultado: "VII"/.test(S)) F("5 · STR no numera Plusvalía VI y Tu resultado VII");
  if (/La plusvalía entra como supuesto/.test(S)) F("5 · la frase del 3% sigue en «Tu resultado» STR");
  // 4 · componente y tokens
  const sp = sinComentarios(leer("src/components/analysis/shared/SeriePlusvalia.tsx"));
  const tk = leer("src/components/analysis/shared/TokensShared.tsx");
  const bloque = capitulo(tk, "/* ── «Plusvalía»", "/* ── matriz de sensibilización");
  if (!bloque) F("4 · TokensShared no tiene el bloque de «Plusvalía»");
  for (const [n, t] of [["SeriePlusvalia", sp], ["TokensShared (bloque)", sinComentarios(bloque)]] as const) {
    if (/--doc-good|--doc-warn|#2E8B57|#B7791F|#57B98A|#DFA34F|#[0-9a-f]{6}/i.test(t)) F(`4 · ${n} nombra verde u ocre, o lleva un hex suelto`);
  }
  if (!/\.sp-serie\{fill:none;stroke:var\(--doc-tx\)/.test(bloque) || !/\.sp-ref\{fill:none;stroke:var\(--doc-ink1\)/.test(bloque)) F("4 · la serie y la referencia no salen de la tinta");
  if (!/const conRotulo = \(i: number\) => i === 0 \|\| i === ultimo \|\| activo === i;/.test(sp)) F("6 · los extremos no van siempre rotulados con el resto al tocar");
  if (!/onClick=\{\(\) => setActivo\(i\)\}/.test(sp) || !/onMouseEnter=\{\(\) => setActivo\(i\)\}/.test(sp)) F("6 · el punto no responde al click (tap) y al cursor");
  if (/stroke-dasharray|strokeDasharray/.test(sp.replace(/sp-grid/g, ""))) F("6 · la referencia va punteada");
  // el tap cae en lo último pintado: la zona de toque va DESPUÉS del punto visible, y el punto no captura eventos
  if (sp.indexOf('className="sp-pt"') > sp.indexOf('className="sp-toque"')) F("6 · el punto visible se pinta encima de la zona de toque: el tap no llega al handler");
  if (!/\.sp-pt\{[^}]*pointer-events:none/.test(bloque)) F("6 · .sp-pt captura el tap");
  // 2 · el cierre: una oración, sin el 3%, y la segunda solo con compra en verde
  const f = { money: (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`, compact: (n: number) => `$${(n / 1e6).toFixed(1).replace(".", ",")} MM`, pct1: (n: number) => n.toFixed(1).replace(".", ",") };
  const base = { comuna: "Santiago", anualizadaPct: 5.0, refPct: 3, gapPts: 2.0, tieneData: true, proyPct: "3", preEntrega: null, rango: "2015-2025" };
  const t1 = cierrePlusvalia(base, f).map((s) => s.t).join("");
  if ((t1.match(/\./g) ?? []).length !== 1 || /3%|parejo/.test(t1) || !/2015 y 2025/.test(t1)) F(`2 · el cierre no es una oración sin el 3% y con el período: ${t1}`);
  const t2 = cierrePlusvalia({ ...base, preEntrega: { gananciaCLP: 12_000_000, gananciaPct: 12, aniosEspera: 2 } }, f).map((s) => s.t).join("");
  if (!/tramo en verde/.test(t2)) F("2 · con compra en verde el cierre pierde su oración");
  const t3 = cierrePlusvalia({ ...base, comuna: "Providencia", anualizadaPct: 2.9, gapPts: -0.1 }, f).map((s) => s.t).join("");
  if (!/al ritmo de lo que el informe proyecta/.test(t3)) F("2 · a 0,1 puntos del 3% el cierre no dice «al ritmo»");
  // una oración en las cinco ramas, y ninguna dice el 3%
  const ramas = [t3, cierrePlusvalia({ ...base, anualizadaPct: -0.4, gapPts: -3.4 }, f), cierrePlusvalia({ ...base, anualizadaPct: 2.0, gapPts: -1.0 }, f), cierrePlusvalia({ ...base, tieneData: false }, f)].map((x) => (typeof x === "string" ? x : x.map((s) => s.t).join("")));
  for (const t of ramas) if ((t.match(/\./g) ?? []).length !== 1 || /3%|parejo/.test(t)) F(`2 · una rama del cierre no es una oración sin el 3%: ${t}`);
  // fuente en una línea
  if (fuentePlusvaliaLinea("Santiago", true) !== "Elaboración propia sobre datos de GfK/NielsenIQ 2015–2025.") F(`6 · la fuente de Santiago no es la línea acordada: ${fuentePlusvaliaLinea("Santiago", true)}`);
  if (!/Arenas & Cayo 2014–2024\.$/.test(fuentePlusvaliaLinea("Independencia", true))) F("6 · la fuente de una comuna Arenas & Cayo no nombra el estudio");

  const hard = fallas.length;
  if (hard === 0) console.log("   plusvalia-capitulo ✓ (la serie completa hasta 2025 en el hallazgo LTR y STR, el 3% una sola vez en la prosa, la tercera frase solo con sobreprecio, sin verde ni ocre, STR monta el capítulo, extremos rotulados y el resto al tocar, cierre de una oración, fuente en una línea)");
  else { console.log(`   plusvalia-capitulo ✗ ${hard} falla(s)`); for (const x of fallas) console.log(`     - ${x}`); }
  return { hard };
}

if (require.main === module) process.exit(runPlusvaliaCapituloTier().hard ? 1 : 0);
