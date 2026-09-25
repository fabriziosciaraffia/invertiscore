/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER CAP-RATE-NETO (23-sep-2026) · una sola «cap rate neto» en LTR.
//
// Decisión de Fabrizio: «cap rate neto» es `rentabilidadNeta` (el NOI de mercado: descuenta
// vacancia, corretaje, recambio y administración) en todas partes. `capRate` deja de mostrarse:
// no tiene nombre de mercado y queda entre bruto y neto sin decir nada propio. El motor no se
// toca: score, gate 3 y pop-up ya usaban la correcta. Y el capítulo I compara SIEMPRE bruto
// contra bruto: el 4% nacional se lleva a bruto con el factor de BDO. Censo previo: el hero y el
// pop-up decían dos cifras distintas en 1.212 de 1.213 filas (p50 0,44 puntos). Fija:
//   1 · NINGUNA SUPERFICIE MUESTRA `capRate` COMO «CAP RATE NETO»: el hero renderizado con un
//       `capRate` centinela no lo imprime y sí imprime la neta; el anexo tampoco; y en `src`
//       nadie lee `metrics.capRate` salvo la normalización de filas viejas, ni rotula «Rent.
//       Operativa» / «rentabilidad operativa».
//   2 · HERO Y POP-UP LEEN LA MISMA CIFRA: sobre las seeds, la sonda del pop-up sin parche (el
//       lado «después» de la celda hoy) da exactamente `capRateNetoLtrPct(metrics)`, que es lo que
//       dibuja el hero; el lado «hoy» del pop-up se arma con la misma función; y la planilla y el
//       prompt citan la neta.
//   3 · EL CAPÍTULO I NO TIENE RAMA NETA: todos los peldaños de la referencia salen en base
//       bruta (el nacional = 4,0 ÷ 0,8 = 5,0), el hallazgo compara el bruto del sujeto en todas las
//       seeds, y en el código del capítulo, del builder, de la copy y de la bisección no queda
//       ninguna rama «neta».
// Verificado EN ROJO por mutación. Corre solo: node --import tsx scripts/eval/golden/cap-rate-neto-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runAnalysis, sondaConPatch } from "../../../src/lib/analysis";
import { capRateNetoLtrPct, capRefNacional, capRefDesdeSnapshot, buildHallazgoCapRate, CAP_RATE_REF_NACIONAL, capRateDisplayPct } from "../../../src/lib/cap-rate-hallazgo";
import { brutoImplicitoBdo, type CapRefComunaSnapshot } from "../../../src/lib/capref-comuna";
import { LosNumeros } from "../../../src/components/analysis/LosNumeros";
import { buildResumenLTR } from "../../../src/lib/resumen-anexo";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

// El JSX de los componentes compila a React.createElement bajo tsx: el global lo resuelve.
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const archivos = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, n).replace(/\\/g, "/");
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out);
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
};
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

export function runCapRateNetoTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n─── TIER CAP-RATE-NETO (una sola «cap rate neto»: rentabilidadNeta · 0 tokens) ───");
  const seeds = GOLDEN_SEEDS.map((s) => ({ s, r: runAnalysis(s.input as any, GOLDEN_UF, s.mediana, GOLDEN_ASOF) as any }));

  // ── 1 · ninguna superficie muestra capRate como neto ──
  const { r: r0 } = seeds[0];
  const centinela = 77.7;
  const m0 = { ...r0.metrics, capRate: centinela };
  const neto0 = capRateNetoLtrPct(r0.metrics)!;
  if (Math.abs(neto0 - centinela) < 1) F("1 · PISO · el centinela quedó cerca de la neta: no distingue");
  const heroHtml = renderToStaticMarkup(createElement(LosNumeros, { metrics: m0, results: { ...r0, metrics: m0 }, capRefPct: 5, capRefNivel: "nacional", currency: "CLP", valorUF: GOLDEN_UF } as any));
  if (heroHtml.includes(pct1(centinela))) F("1 · el hero imprime `capRate` (el centinela 77,7 aparece)");
  const celdaNeto = heroHtml.match(/Cap rate neto[^]*?(\d+,\d)%/);
  if (!celdaNeto || celdaNeto[1] !== pct1(neto0)) F(`1 · la celda «Cap rate neto» del hero no dice la neta (${celdaNeto?.[1]} en vez de ${pct1(neto0)})`);
  const anexo = buildResumenLTR({ score: r0.score, results: { ...r0, metrics: m0 }, inputData: GOLDEN_SEEDS[0].input as any, ufValue: GOLDEN_UF });
  const kpiCap = anexo.kpis.find((k: any) => /cap rate/i.test(k.label));
  if (!kpiCap || kpiCap.label !== "Cap rate neto" || kpiCap.value !== `${pct1(neto0)}%`) F(`1 · el anexo no dice «Cap rate neto» con la neta (${kpiCap?.label} ${kpiCap?.value})`);
  // Nadie lee `metrics.capRate` para mostrarlo. Se permite la normalización de filas viejas.
  const PERMITIDOS = new Set(["src/components/analysis/utils.ts"]);
  for (const p of archivos("src")) {
    const v = sinComentarios(leer(p));
    const lee = v.match(/\b(?:metrics|m|raw|mEnriched|baseMetrics)\??\.capRate\b|results\??\.metrics\??\.capRate\b/g);
    if (lee && !(PERMITIDOS.has(p) && lee.every((x) => /mEnriched\.capRate|metrics\.capRate/.test(x)) && /capRate: (?:mEnriched|metrics)\.capRate \?\? 0,/.test(v) && lee.length === 1)) F(`1 · ${p} lee capRate (${lee.join(", ")})`);
    // Por línea: el «CAP rate» de STR (`base.capRate`, otro motor) no es el de esta decisión.
    for (const linea of v.split("\n")) {
      const rot = linea.match(/Rent\. Operativa|rentabilidad operativa \(CAP rate\)|"CAP rate"/);
      if (rot && !/base\.capRate|\.capRate \* 100/.test(linea) && !/str|renta-corta|ambas|comparativa/i.test(p)) F(`1 · ${p} rotula «${rot[0]}»`);
    }
  }
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: se fueron los chequeos del prompt («Cap rate neto» citado, su
  // respaldo, el bump a 26 y la invalidación por versión): el generador ya no existe.

  // ── 2 · hero y pop-up leen la misma cifra ──
  let medidas = 0;
  for (const { s, r } of seeds) {
    const hero = capRateNetoLtrPct(r.metrics);
    const sonda = sondaConPatch(s.input as any, GOLDEN_UF, s.mediana, GOLDEN_ASOF, {});
    if (hero == null) { F(`2 · ${s.key}: sin cap rate neto`); continue; }
    medidas++;
    // El hallazgo lleva la misma neta (la cita el prompt como «Cap rate neto»).
    if (r.metrics.hallazgoCapRate && r.metrics.hallazgoCapRate.valor.capRatePct !== hero) F(`2 · ${s.key}: el hallazgo (${r.metrics.hallazgoCapRate.valor.capRatePct}) no lleva la neta del hero (${hero})`);
    if (sonda.metricas?.capRateNetoPct !== hero) F(`2 · ${s.key}: el pop-up (${sonda.metricas?.capRateNetoPct}) no dice lo mismo que el hero (${hero})`);
    if (hero !== capRateDisplayPct(r.metrics.rentabilidadNeta) && Math.abs(hero - r.metrics.rentabilidadNeta) > 0.051) F(`2 · ${s.key}: el hero (${hero}) no es la rentabilidad neta (${r.metrics.rentabilidadNeta})`);
    // La planilla: (arriendo − gastos de la tabla) ÷ precio da la neta.
    const M = r.metrics;
    const cuenta = ((M.ingresoMensual * 12 - (M.egresosMensuales - M.dividendo) * 12) / M.precioCLP) * 100;
    if (Math.abs(cuenta - M.rentabilidadNeta) > 0.006) F(`2 · ${s.key}: la cuenta de la planilla da ${cuenta.toFixed(2)}, no la neta ${M.rentabilidadNeta}`);
  }
  if (!medidas) F("2 · PISO · ninguna seed midió");
  const H = sinComentarios(leer("src/components/analysis/HeroLTR.tsx"));
  // ⚠ ACTA (25-sep-2026) · el lado «hoy» VUELVE: la columna «Hoy» de la tabla del mockup final.
  // El 24-sep este chequeo quedó condicional porque el pop-up no mostraba cap rate; vuelve a ser
  // obligatorio, con la misma cifra que el hero.
  if (!/capRateNetoPct: capRateNetoLtrPct\(results\.metrics\),/.test(H)) F("2 · el lado «hoy» del pop-up no se arma con capRateNetoLtrPct");
  const AN = sinComentarios(leer("src/lib/analysis.ts"));
  if (!/capRateNetoPct: capRateNetoLtrPct\(m\),/.test(AN)) F("2 · la sonda del pop-up no emite capRateNetoLtrPct");
  const LN = sinComentarios(leer("src/components/analysis/LosNumeros.tsx"));
  if (!/k: "Cap rate neto",[^]*?const n = capRateNetoLtrPct\(metrics\);/.test(LN)) F("2 · la celda «Cap rate neto» del hero no lee capRateNetoLtrPct");
  const MC = sinComentarios(leer("src/components/analysis/ModalCalculo.tsx"));
  if (!/const gastosNetosAnual = \(metrics\.egresosMensuales - metrics\.dividendo\) \* 12;/.test(MC) || !/cuenta=\{`\(\$\{P\(arriendoAnual\)\} − \$\{P\(gastosNetosAnual\)\}\) ÷ \$\{P\(precio\)\}`\}\s*resultado=\{pct2\(metrics\.rentabilidadNeta\)\}/.test(MC)) F("2 · la planilla no calcula el cap rate neto con la neta");

  // ── 3 · el capítulo I no tiene rama neta ──
  const nac = capRefNacional("Peñalolén");
  if (nac.base !== "bruta" || nac.pct !== brutoImplicitoBdo(CAP_RATE_REF_NACIONAL) || nac.pct !== 5) F(`3 · el nacional no llega en bruto con el factor de BDO (${nac.base} ${nac.pct})`);
  const celda = { nivel: "celda", bruto: 5.4, bdoNeto: 3.1, fuente: "x", nArriendo: 40, nVenta: 40, arriendoProxyUsado: false, celda: { comuna: "Ñuñoa", dormitorios: 1 }, ventana: 90 } as unknown as CapRefComunaSnapshot;
  for (const snap of [celda, { ...celda, nivel: "comuna" }, { ...celda, nivel: "bdo" }, { ...celda, nivel: "nacional" }] as CapRefComunaSnapshot[]) {
    const ref = capRefDesdeSnapshot(snap);
    if (ref.base !== "bruta") F(`3 · el peldaño ${snap.nivel} sale en base ${ref.base}`);
  }
  const h = buildHallazgoCapRate({ capRatePct: 2.87, brutoPct: 4.21, ref: nac, comuna: "Peñalolén", modalidad: "ltr", decisividad: 0, magnitudContinua: 0 });
  if (!h || h.valor.sujetoPct !== 4.2 || h.valor.capRefPct !== 5 || h.valor.capRatePct !== 2.9 || !/cap rate bruto/.test(h.fraseCanonica)) F(`3 · contra el nacional el hallazgo no compara bruto contra bruto (${h?.valor.sujetoPct} vs ${h?.valor.capRefPct})`);
  for (const { s, r } of seeds) {
    const hc = r.metrics.hallazgoCapRate;
    if (!hc) continue;
    const brutoCrudo = ((r.metrics.ingresoMensual * 12) / r.metrics.precioCLP) * 100;
    if (hc.valor.base !== "bruta" || hc.valor.sujetoPct !== capRateDisplayPct(brutoCrudo)) F(`3 · ${s.key}: el hallazgo no compara el bruto (${hc.valor.base} ${hc.valor.sujetoPct})`);
  }
  const ramas: Array<[string, RegExp]> = [
    ["src/lib/cap-rate-hallazgo.ts", /"neta"|base === "bruta"|base !== "bruta"/],
    ["src/components/analysis/CapitulosInversion.tsx", /base === "bruta"|base !== "bruta"|ltrNeta|"capRateNeto"|gastosOpAnual/],
    ["src/lib/capref-copy.ts", /ltrNeta|base === "bruta"/],
    ["src/components/analysis/referencia-hallazgo.ts", /base === "bruta"/],
    ["src/components/analysis/GenericFindingCard.tsx", /base === "bruta"/],
    ["src/components/analysis/LosNumeros.tsx", /capRefBase|"neta"/],
    ["src/components/analysis/SubjectCardGrid.tsx", /"bruta" \| "neta"|base \?\? "neta"/],
    ["src/lib/analysis.ts", /base: "bruta" \| "neta"|m\.capRate\) < targetCapPct/],
  ];
  for (const [p, rx] of ramas) {
    const x = sinComentarios(leer(p)).match(rx);
    if (x) F(`3 · ${p} conserva una rama neta del capítulo I (${x[0]})`);
  }
  if (!/base: "bruta";/.test(sinComentarios(leer("src/lib/cap-rate-hallazgo.ts")))) F("3 · el tipo de la referencia vuelve a admitir otra base");

  if (fallas.length) {
    console.log(`  ✗ CAP-RATE-NETO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — «cap rate neto» es rentabilidadNeta en el hero, el anexo, la planilla y el prompt; nadie muestra capRate; hero y pop-up dan la misma cifra en ${medidas} seeds; y el capítulo I compara siempre bruto contra bruto (el nacional, 5,0 bruto)`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCapRateNetoTier();
  process.exit(hard ? 1 : 0);
}
