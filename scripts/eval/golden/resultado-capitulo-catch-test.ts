// ─────────────────────────────────────────────────────────────────────────────
// TIER RESULTADO-CAPÍTULO (22-sep-2026) · «Tu resultado a 10 años» (V LTR / VI STR) según el
// mockup aprobado (docs/wireframes/rediseno-informe/capitulo-v-resultado.html).
//
// Reglas:
//   1 · UN SOLO PATRIMONIO: el motor LTR emite `parteAlVender` por año con la fórmula del exit
//       (sobreprecio de hoy plano, comisión sobre lo que paga el mercado); en el año de venta es
//       EXACTAMENTE `exit.equityCLP`, y con sobreprecio NO es valor − deuda (seed GS-2).
//   2 · el gráfico de las dos modalidades lee `parteAlVender`, no valor − deuda ni patrimonioNeto
//       como serie; el componente es PatrimonioBarras (SVG, tokens por clase) en los dos.
//   3 · la venta al año diez trae la fila del sobreprecio cuando existe (`exit.sobreprecioVenta &&`).
//   4 · el aviso de 1,5× está cableado con `avisaCuotaRefi` en los dos capítulos.
//   5 · SIN VERDE NI OCRE: ni los capítulos, ni PatrimonioBarras, ni BarraApiladaB, ni el bloque
//       nuevo de TokensShared nombran --doc-good / --doc-warn ni sus hexes; el pie en claro es
//       #71717A (el que pasa contraste) y el rojo aparece solo en el aporte (plata que sale).
//   6 · lo que salió no vuelve: sin barra del día 1, sin filas con tags, sin nota de aportes, sin
//       «La misma plata en otro lado», sin puente en el capítulo; la barra apilada es BarraApiladaB.
//   7 · el cierre son DOS oraciones (sin la de la caja), y con pie 100% no dice «amortizó $0».
//
// Verificado EN ROJO por mutación (scratchpad mutar10.py).
// Corre solo: node --import tsx scripts/eval/golden/resultado-capitulo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { cierreResultado } from "../../../src/lib/cierres-capitulos";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const capitulo = (s: string, desde: string, hasta: string) => { const i = s.indexOf(desde), j = s.indexOf(hasta, i); return i >= 0 && j > i ? s.slice(i, j) : ""; };

export function runResultadoCapituloTier(): { hard: number } {
  fallas.length = 0;

  // 1 · motor LTR
  const gs2 = GOLDEN_SEEDS.find((s) => s.key === "GS-2"), gs1 = GOLDEN_SEEDS.find((s) => s.key === "GS-1");
  if (!gs2 || !gs1) F("1 · faltan las seeds GS-1 / GS-2");
  else {
    for (const s of [gs1, gs2]) {
      const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
      const p = r.projections[r.exitScenario.anios - 1];
      if (p.parteAlVender !== r.exitScenario.equityCLP) F(`1 · ${s.key}: parteAlVender del año de venta (${p.parteAlVender}) ≠ equity (${r.exitScenario.equityCLP})`);
      if (r.projections.some((q: any) => typeof q.parteAlVender !== "number")) F(`1 · ${s.key}: algún año sin parteAlVender`);
      if (s.key === "GS-2") {
        if (!r.exitScenario.sobreprecioVenta) F("1 · GS-2 debía traer sobreprecio (la seed paga 33% sobre la mediana)");
        if (p.parteAlVender === p.valorPropiedad - p.saldoCredito) F("1 · GS-2: parteAlVender es valor − deuda, sin comisión ni sobreprecio");
      }
      const p1 = r.projections[0];
      const esperado = Math.round(p1.valorPropiedad - (r.exitScenario.sobreprecioVenta?.clp ?? 0) - p1.saldoCredito - Math.round((p1.valorPropiedad - (r.exitScenario.sobreprecioVenta?.clp ?? 0)) * 0.02));
      if (p1.parteAlVender !== esperado) F(`1 · ${s.key}: el año 1 no sigue la fórmula del exit (${p1.parteAlVender} vs ${esperado})`);
    }
  }

  // 2–6 · los capítulos
  const L = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  const S = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  const capL = capitulo(L, "const filaV: FilaHallazgo | null =", "const filas = [filaI");
  const capS = capitulo(S, "const filaVI: FilaHallazgo | null =", "const filas = [filaI");
  if (!capL || !capS) F("2 · no se encuentran los cuerpos de filaV / filaVI");
  for (const [mod, c] of [["LTR", capL], ["STR", capS]] as const) {
    if (!/<PatrimonioBarras filas=\{filasBarras\}/.test(c)) F(`2 · ${mod} no dibuja PatrimonioBarras con filasBarras`);
    if (!/parteAlVender/.test(c) || !/parte: .*(parteAlVender|porAnio\.get\(r\.anio\))/.test(c)) F(`2 · ${mod}: la serie no lee parteAlVender`);
    if (/patrimonio: p\.patrimonioNeto|CurvaPatrimonio|PatrimonioChart/.test(c)) F(`2 · ${mod} sigue dibujando patrimonioNeto / la curva vieja / el chart viejo`);
    if (!/\{exit\.sobreprecioVenta && \(\s*<FilaDato k="Menos el sobreprecio de hoy"/.test(c)) F(`3 · ${mod}: la fila del sobreprecio no aparece desde el dato`);
    if (!/avisaCuotaRefi\(refi\.ratioCuota\) && veces && \(/.test(c) || !/fraseAvisoCuotaRefi\(/.test(c)) F(`4 · ${mod}: el aviso de 1,5× no está cableado`);
    if (/--doc-good|--doc-warn|#2E8B57|#B7791F|#57B98A|#DFA34F/i.test(c)) F(`5 · ${mod}: el capítulo nombra verde u ocre`);
    if (/barraDia1|BloqueDia1|La misma plata|<VPuente>|<BarraApilada\b|<Bars\b|tag: "firme"|tag: "no vuelve"|Para llegar acá pusiste/.test(c)) F(`6 · ${mod}: volvió una pieza retirada (día 1, filas con tags, nota, misma plata, puente)`);
    if (!/<BarraApiladaB\s/.test(c) || !/tono: "pie"/.test(c) || !/tono: "amort"/.test(c) || !/tono: "plus"/.test(c)) F(`6 · ${mod}: la barra apilada no es BarraApiladaB con pie · amortización · plusvalía`);
    if (!/rojo: true/.test(c)) F(`6 · ${mod}: cuando no cierra, «Te queda» no va en rojo`);
  }
  // 5 · componentes y tokens
  const pb = sinComentarios(leer("src/components/analysis/shared/PatrimonioBarras.tsx"));
  const bb = sinComentarios(leer("src/components/analysis/shared/BarraApiladaB.tsx"));
  const tk = leer("src/components/analysis/shared/TokensShared.tsx");
  const bloque = capitulo(tk, "/* ── «Tu resultado a 10 años»", "/* ── matriz de sensibilización");
  if (!bloque) F("5 · TokensShared no tiene el bloque de «Tu resultado»");
  for (const [n, t] of [["PatrimonioBarras", pb], ["BarraApiladaB", bb], ["TokensShared (bloque)", sinComentarios(bloque)]] as const) {
    if (/--doc-good|--doc-warn|#2E8B57|#B7791F|#57B98A|#DFA34F/i.test(t)) F(`5 · ${n} nombra verde u ocre`);
    if (/#[0-9a-f]{6}/i.test(t) && n !== "TokensShared (bloque)") F(`5 · ${n} lleva un hex suelto: los colores van por clase`);
  }
  if (!/\[data-theme="light"\] \.doc-dictamen,\[data-theme="light"\] \.doc-tokens\{ --doc-ink1:#71717A;/.test(bloque)) F("5 · el pie en claro no es #71717A");
  if (!/\.doc-dictamen,\.doc-tokens\{ --doc-ink1:#8A8A90;/.test(bloque)) F("5 · el pie en oscuro no es #8A8A90");
  if (!/\.pb-aporte\{fill:var\(--signal-red\)\}/.test(bloque)) F("5 · el aporte acumulado no va en Signal Red");
  if (!/\.pb-parte\{fill:none;stroke:var\(--doc-tx\)/.test(bloque) || !/\.bb-s\.amort\{background:var\(--doc-tx\)\}/.test(bloque) || !/\.bb-s\.pie\{background:var\(--doc-ink1\)\}/.test(bloque)) F("5 · tu parte / amortización / pie no salen de la tinta");
  if (!/\.bb-s\.plus::after\{[^}]*var\(--doc-trama-linea\)/.test(bloque)) F("5 · la plusvalía no lleva trama de tinta");
  if (!/className=\{`bb-s \$\{t\.tono\}\$\{dentro\(t\) \? " bb-lab" : ""\}`\}/.test(bb) || !/const UMBRAL_DENTRO_PCT = 30;/.test(bb) || !/t\.tono !== "plus" && t\.pct >= UMBRAL_DENTRO_PCT && \(ancho == null \|\| \(t\.pct \/ 100\) \* ancho >= MIN_PX_DENTRO\)/.test(bb) || !/const MIN_PX_DENTRO = 130;/.test(bb)) F("6 · BarraApiladaB no es la forma B (rótulo dentro solo si sólido, ≥ 30% y caben 130 px; plusvalía abajo)");
  if (!/width=\{W\} height=\{H\}/.test(pb) || /preserveAspectRatio="none"/.test(pb) || !/useAncho/.test(pb)) F("6 · PatrimonioBarras no se dibuja al ancho medido (estira el texto de los ejes)");

  // 7 · el cierre
  const f = { money: (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`, compact: (n: number) => `$${(n / 1e6).toFixed(1).replace(".", ",")} MM`, pct1: (n: number) => n.toFixed(1).replace(".", ",") };
  const base = { comuna: "Providencia", patrimonioCLP: 93_194_403, aportadoCLP: 42_264_529, pieCLP: 25_488_000, amortizacionCLP: 27_303_074, multiplicador: 2.21, sinCapitalPropio: false, flujoAcumulado: -10_942_166, bolsilloCLP: 10_942_166, tirPct: 9.3, depositoCLP: 51_020_829, proyPct: "3" };
  const texto = (a: typeof base) => cierreResultado(a, f).map((s) => s.t).join("");
  const t1 = texto(base);
  const oraciones = (t: string) => t.trim().split(/(?<=\.)\s+/).filter(Boolean).length;
  if (oraciones(t1) !== 2) F(`7 · el cierre no son dos oraciones (${oraciones(t1)}): ${t1}`);
  if (/motores|caja te pide|ya lo trae descontado/.test(t1)) F("7 · el cierre conserva la oración de la caja");
  const sinCredito = texto({ ...base, pieCLP: 220_649_400, amortizacionCLP: 0, patrimonioCLP: 280_306_684, aportadoCLP: 235_910_984, multiplicador: 1.19 });
  if (!/sin crédito no hay deuda que amortizar/.test(sinCredito) || /amortizó \$0/.test(sinCredito)) F(`7 · con pie 100% el cierre dice «amortizó $0» o no explica la falta de crédito: ${sinCredito}`);
  const menos = texto({ ...base, multiplicador: 0.98, patrimonioCLP: 289_645_133, aportadoCLP: 294_219_891, pieCLP: 77_635_900, amortizacionCLP: 88_941_561 });
  if (!/menos de lo que pusiste \(×0,98\)/.test(menos)) F("7 · con ×0,98 el cierre no dice que terminas con menos de lo puesto");

  const hard = fallas.length;
  if (hard === 0) console.log("   resultado-capitulo ✓ (un solo patrimonio con parteAlVender en los dos motores y los dos gráficos, la venta con la fila del sobreprecio, la barra apilada en forma B, el aviso de 1,5×, sin verde ni ocre, sin las piezas retiradas, cierre de dos oraciones con la rama sin crédito)");
  else { console.log(`   resultado-capitulo ✗ ${hard} falla(s)`); for (const x of fallas) console.log(`     - ${x}`); }
  return { hard };
}

if (require.main === module) process.exit(runResultadoCapituloTier().hard ? 1 : 0);
