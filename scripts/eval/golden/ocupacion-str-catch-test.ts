// ─────────────────────────────────────────────────────────────────────────────
// TIER OCUPACIÓN-STR (22-sep-2026) · «Ocupación en renta corta» (III STR) según el mockup aprobado
// (docs/wireframes/rediseno-informe/capitulo-iii-noches-str.html).
//
// Reglas:
//   1 · LA CURVA DIBUJA FLUJO, no ingreso bruto: el capítulo le pasa `fe.map((x) => x.flujo)` a
//       `CurvaFlujoAnual`, y el componente dibuja y colorea LA MISMA serie (`v < 0` → rojo).
//   2 · LA RAMA «CERCA» CORTA EN 5 PUNTOS (`OCC_CERCA_PTS`): 5 es cerca, 6 es lejos/sobre.
//   3 · SIN COMPARABLES NO COMPARA: `ramaOcupacion` da «sin» con null o n=0; el comentario de la
//       brecha va detrás de `rama !== "sin"`; el cierre «sin» no cuenta noches contra los avisos.
//   4 · EL TÍTULO ES EL NUEVO: `pregunta: "Ocupación en renta corta"`.
//   5 · SIN VERDE NI OCRE en el capítulo, en las dos piezas ni en su bloque de TokensShared; el
//       Thermo se retiró con su CSS (y Spark, que usaba su leyenda) y CurvaAnual con él.
//   6 · lo que salió no vuelve al III: ni dial (`dialDesdeFronteras`), ni comuna
//       (`ocupacionVsComuna`/`comunaOcupacion`), ni segunda mención del ramp-up (el cierre no lo
//       dice). La cadena: el recompute conserva `ocupacionRealizadaComparables` y el capítulo lo
//       lee de `results`. El cierre es UNA oración en las cuatro ramas.
//
// Verificado EN ROJO por mutación (scratchpad mutar12.py).
// Corre solo: node --import tsx scripts/eval/golden/ocupacion-str-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OCC_CERCA_PTS, ramaOcupacion } from "../../../src/components/analysis/shared/OcupacionComparables";
import { cierreOcupacionStr } from "../../../src/lib/cierres-capitulos-str";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const capitulo = (s: string, desde: string, hasta: string) => { const i = s.indexOf(desde), j = s.indexOf(hasta, i); return i >= 0 && j > i ? s.slice(i, j) : ""; };
const VERDE_OCRE = /--doc-good|--doc-warn|#2E8B57|#B7791F|#57B98A|#DFA34F/i;

export function runOcupacionStrTier(): { hard: number } {
  fallas.length = 0;
  const S = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  const cap = capitulo(S, "const filaIII: FilaHallazgo = (() => {", "const capexStr = hallazgos.find(");
  if (!cap) F("no se encuentra el cuerpo de filaIII");
  const cf = sinComentarios(leer("src/components/analysis/shared/CurvaFlujoAnual.tsx"));
  const oc = sinComentarios(leer("src/components/analysis/shared/OcupacionComparables.tsx"));
  const tk = leer("src/components/analysis/shared/TokensShared.tsx");
  const bloque = capitulo(tk, "/* ── «Ocupación en renta corta»", "/* ── «Plusvalía»");

  // 1 · la curva dibuja flujo y colorea por la misma serie
  if (!/<CurvaFlujoAnual flujos=\{fe\.map\(\(x\) => x\.flujo\)\}/.test(cap)) F("1 · el capítulo no le pasa el flujo de cada mes a CurvaFlujoAnual");
  if (/ingresoBruto/.test(cap.slice(cap.indexOf("<CurvaFlujoAnual"), cap.indexOf("<CurvaFlujoAnual") + 120))) F("1 · la curva recibe ingreso bruto");
  if (!/const pts = flujos\.map\(\(v, i\) => `\$\{x\(i\)\.toFixed\(1\)\},\$\{y\(v\)\.toFixed\(1\)\}`\)/.test(cf)) F("1 · CurvaFlujoAnual no dibuja `flujos`");
  if (!/\{flujos\.map\(\(v, i\) => \([^]*?className=\{v < 0 \? "cf-pt neg" : "cf-pt"\}/.test(cf)) F("1 · el color del punto no sale del signo de la misma serie que se dibuja");
  if (/positivo|ingreso/.test(cf)) F("1 · CurvaFlujoAnual conoce otra serie (positivo / ingreso)");
  if (!/y\(0\)/.test(cf) || !/y\(prom\)/.test(cf) || !/promedio <b>\{fmt\(prom\)\}\/mes<\/b>/.test(cf)) F("1 · faltan la línea del cero, la del promedio o su valor en la leyenda");
  if (!/ticks\.map\(\(t\) => \(/.test(cf) || !/className="cf-tick"/.test(cf)) F("1 · la curva no tiene eje Y con divisiones");

  // 2 · la rama «cerca» corta en 5 puntos
  if (OCC_CERCA_PTS !== 5) F(`2 · OCC_CERCA_PTS es ${OCC_CERCA_PTS}, debía ser 5`);
  const r5 = ramaOcupacion(41, { p50: 0.46, p50Superhost: 0.5, n: 25, nSuperhost: 10 });
  const r6 = ramaOcupacion(41, { p50: 0.47, p50Superhost: 0.5, n: 25, nSuperhost: 10 });
  const m6 = ramaOcupacion(41, { p50: 0.35, p50Superhost: 0.5, n: 25, nSuperhost: 10 });
  if (r5.rama !== "cerca" || r5.deltaPts !== 5) F(`2 · a 5 puntos debía ser cerca (${JSON.stringify(r5)})`);
  if (r6.rama !== "sobre" || r6.deltaPts !== 6) F(`2 · a +6 puntos debía ser sobre (${JSON.stringify(r6)})`);
  if (m6.rama !== "lejos" || m6.deltaPts !== -6) F(`2 · a −6 puntos debía ser lejos (${JSON.stringify(m6)})`);
  if (!/Math\.abs\(deltaPts\) <= OCC_CERCA_PTS/.test(oc)) F("2 · la rama no lee OCC_CERCA_PTS");

  // 3 · sin comparables no compara
  if (ramaOcupacion(47, null).rama !== "sin" || ramaOcupacion(47, { p50: 0.3, p50Superhost: 0, n: 0, nSuperhost: 0 }).rama !== "sin") F("3 · sin comparables (null o n=0) la rama no es «sin»");
  if (!/\{rama !== "sin" && \(\s*<p className="viz-pie">\s*Por qué difieren:/.test(cap)) F("3 · el comentario de la brecha no está detrás de rama !== \"sin\"");
  if (!/No hay avisos parecidos suficientes guardados para contrastar/.test(cap)) F("3 · falta la frase de una sola cláusula sin comparables");
  const base = { noches: 171, ocupacionPct: 47, ocupacionEsDelUsuario: false, realizadaPct: null, rama: "sin" as const, mesesEnRojo: 10 };
  const tSin = cierreOcupacionStr(base).map((s) => s.t).join("");
  if (/avisos parecidos ya las hacen|más de las que|menos de las que/.test(tSin) || !/sin avisos parecidos que la contrasten/.test(tSin)) F(`3 · el cierre sin comparables compara: ${tSin}`);
  if (!/diez meses en rojo/.test(tSin)) F(`3 · el cierre sin comparables no dice los meses en rojo: ${tSin}`);
  if (!/real && real\.n > 0 \? ` · \$\{real\.n\} avisos parecidos, ocupación del último año` : ""/.test(cap)) F("3 · la fuente no lleva el n solo cuando hay comparables");

  // 4 · el título
  if (!/pregunta: "Ocupación en renta corta",/.test(cap)) F("4 · el título del III no es «Ocupación en renta corta»");
  if (/Cuántas noches necesitas/.test(S)) F("4 · «Cuántas noches necesitas» sigue en el archivo");

  // 5 · sin verde ni ocre; los retirados no vuelven
  for (const [n, t] of [["filaIII", cap], ["CurvaFlujoAnual", cf], ["OcupacionComparables", oc], ["TokensShared (bloque)", sinComentarios(bloque)]] as const) {
    if (VERDE_OCRE.test(t)) F(`5 · ${n} nombra verde u ocre`);
  }
  if (!bloque) F("5 · TokensShared no tiene el bloque de «Ocupación en renta corta»");
  if (!/\.cf-pt\.neg\{fill:var\(--signal-red\)\}/.test(bloque) || !/\.cf-pt\{fill:var\(--doc-tx\)\}/.test(bloque)) F("5 · los puntos no son tinta y rojo");
  const voc = sinComentarios(leer("src/components/analysis/hallazgos/vocabulario.tsx"));
  const acord = sinComentarios(leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx"));
  if (/export function Thermo|export function Spark/.test(voc)) F("5 · Thermo o Spark siguen exportados");
  if (/\.thermo|\.spark\{/.test(acord)) F("5 · queda CSS del Thermo o del Spark en el acordeón");
  if (/<Thermo|<CurvaAnual|<Spark/.test(S)) F("5 · el capítulo monta una pieza retirada");
  if (/CurvaAnual/.test(sinComentarios(leer("src/components/analysis/shared/index.ts")))) F("5 · CurvaAnual sigue exportada");

  // 6 · lo que salió no vuelve al III; la cadena; el cierre de una oración
  if (/dialDesdeFronteras|<Dial|ocupacionVsComuna|comunaOcupacion|<Thermo/.test(cap)) F("6 · el III volvió a montar el dial o la comparación con la comuna");
  if ((cap.match(/perdidaRampUp/g) ?? []).length !== 2) F("6 · el ramp-up no se dice UNA vez en el III (guard + texto)");
  if (!/<OcupacionComparables occPct=\{occPct\} noches=\{noches\} esTuya=\{occEsTuya\} real=\{real\} \/>/.test(cap)) F("6 · el capítulo no monta OcupacionComparables con el real del results");
  if (!/const real = results\.ocupacionRealizadaComparables \?\? null;/.test(cap)) F("6 · el capítulo no lee ocupacionRealizadaComparables de results");
  const rc = sinComentarios(leer("src/lib/analysis/recompute-short-term-for-legacy.ts"));
  if (!/persistedResults\?\.ocupacionRealizadaComparables\s*\?\s*\{ ocupacionRealizadaComparables: persistedResults\.ocupacionRealizadaComparables \}/.test(rc)) F("6 · el recompute no conserva ocupacionRealizadaComparables");
  const ens = sinComentarios(leer("src/lib/cierres-str-ensamblador.ts"));
  if (!/const real = r\.ocupacionRealizadaComparables \?\? null;/.test(ens) || !/ramaOcupacion\(occ \* 100, real\)/.test(ens)) F("6 · el ensamblador no deriva la rama del mismo dato");
  if (!/\{esTuya \? "Tu supuesto" : "Estimada para tu depto"\}/.test(oc)) F("6 · con supuesto propio la celda no dice «Tu supuesto»");
  const ramas = [
    { ...base, rama: "cerca" as const, realizadaPct: 47 },
    { ...base, rama: "lejos" as const, realizadaPct: 22 },
    { ...base, rama: "sobre" as const, realizadaPct: 60 },
    { ...base, rama: "lejos" as const, realizadaPct: 22, ocupacionEsDelUsuario: true },
    base,
  ];
  for (const a of ramas) {
    const t = cierreOcupacionStr(a).map((s) => s.t).join("");
    if ((t.match(/\./g) ?? []).length !== 1) F(`6 · el cierre «${a.rama}» no es una oración: ${t}`);
    if (/\$|estabiliz|reseñas/.test(t)) F(`6 · el cierre «${a.rama}» repite el ramp-up: ${t}`);
    if (/sube a|cae a|veredicto sube/.test(t)) F(`6 · el cierre «${a.rama}» repite la frontera del veredicto: ${t}`);
  }
  if (!/Supusiste 171 noches/.test(cierreOcupacionStr(ramas[3]).map((s) => s.t).join(""))) F("6 · con supuesto propio el cierre no dice «Supusiste»");

  const hard = fallas.length;
  if (hard === 0) console.log("   ocupacion-str ✓ (la curva dibuja y colorea el flujo, «cerca» corta en 5 puntos, sin comparables no compara, el título es «Ocupación en renta corta», sin verde ni ocre, Thermo/Spark/CurvaAnual retirados, sin dial ni comuna en el III, ramp-up una vez, la cadena del recompute, cierre de una oración)");
  else { console.log(`   ocupacion-str ✗ ${hard} falla(s)`); for (const x of fallas) console.log(`     - ${x}`); }
  return { hard };
}

if (require.main === module) process.exit(runOcupacionStrTier().hard ? 1 : 0);
