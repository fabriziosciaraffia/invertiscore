/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · «CUÁNTO RENTA» HABLA AL USUARIO — catch-test (21-sep-2026). 0 tokens, sin base.
// ============================================================================
// El capítulo I de las dos modalidades se implementó sobre el mockup aprobado con tres
// decisiones de Fabrizio: nomenclatura («Rentabilidad bruta» en LTR, «Rentabilidad» en STR, nada
// de «cap rate» en el capítulo; el neto queda en las seis cifras del hero), la UF del análisis
// fuera de la fuente (trazabilidad: sigue en el dato), y STR con umbral = rentabilidad bruta de
// la comuna + 1 punto (no 5% fijo; 5 solo cuando la comuna no tiene referencia). Fija:
//   1. la fuente en UNA línea por peldaño, sin peldaños, celdas, ventanas, n, BDO ni UF; la
//      muestra débil con una palabra («muestra acotada»), no con la cifra;
//   2. la explicación visible: una frase, qué es la rentabilidad y de dónde sale la referencia;
//   3. el umbral STR: referencia de la comuna + PRIMA_STR_PTS (1,0) en celda/comuna/bdo, y el 5%
//      de siempre en nacional; el hallazgo lo declara con su procedencia; la neutralización y
//      los cierres usan EL MISMO umbral (no la constante);
//   4. el render: los dos capítulos nombran la cifra como «Rentabilidad», no escriben «cap rate»
//      en el capítulo I, no ponen la UF en la fuente y no mencionan BDO ni peldaños; el LTR
//      compara `sujetoPct` (la bruta) y no el neto.
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · `fuenteCapRef` con «peldaño 1 de 4» en la línea → cae 1; con la cifra del n → cae 1;
//   · `explicacionCapRef` en dos temas (cascada) → cae 2;
//   · `PRIMA_STR_PTS` a 2 → cae 3; `umbralStrDesde` devolviendo 5 siempre → cae 3;
//   · el ensamblador STR volviendo a `CAP_STR_UMBRAL_PCT` → cae 3;
//   · el render LTR con «cap rate» en el ksub, o con `valorUF` en la fuente → cae 4.
//   node --import tsx scripts/eval/golden/cuanto-renta-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fuenteCapRef, explicacionCapRef, fuenteUmbralStr, explicacionUmbralStr, NOMBRE_RENTABILIDAD } from "../../../src/lib/capref-copy";
import { buildHallazgoRentabilidadStr, umbralStrDesde, umbralStrNacional, CAP_STR_UMBRAL_PCT, PRIMA_STR_PTS } from "../../../src/lib/rentabilidad-str-hallazgo";
import { capRefNacional, capRefDesdeSnapshot } from "../../../src/lib/cap-rate-hallazgo";
import type { CapRefComunaSnapshot } from "../../../src/lib/capref-comuna";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const snap = (o: Partial<CapRefComunaSnapshot>): CapRefComunaSnapshot => ({
  nivel: "celda", bruto: 3.62, bdoNeto: 3.5, nArriendo: 60, nVenta: 66, ventana: 90,
  celda: { comuna: "Providencia", condicion: "nuevo", dormitorios: 1, superficieM2: 45 },
  arriendoProxyUsado: true, fuente: "x", resolvedAt: "2026-09-21T00:00:00.000Z", ...o,
});
/** Lo que un usuario no tiene por qué leer. */
const TECNICO = /peldaño|celda|ventana|BDO|n por lado|precios pedidos|cascada|snapshot|\bn\s*=|\(\d+ avisos|\d+ avisos de arriendo|UF \d/i;

export function runCuantoRentaTier(): { hard: number } {
  fallas.length = 0;

  // 1 · la fuente, una línea por peldaño
  const vCelda = capRefDesdeSnapshot(snap({}));
  const vComuna = capRefDesdeSnapshot(snap({ nivel: "comuna", bruto: 5.31, nArriendo: 125, nVenta: 372, celda: { comuna: "Las Condes", condicion: "usado", dormitorios: null, superficieM2: 64 }, arriendoProxyUsado: false }));
  const vBdo = capRefDesdeSnapshot(snap({ nivel: "bdo", bruto: null, bdoNeto: 3.4, nArriendo: 3, nVenta: 4, ventana: null, celda: { comuna: "Ñuñoa", condicion: "usado", dormitorios: null, superficieM2: 50 }, arriendoProxyUsado: false }));
  const vNac = capRefNacional("Peñalolén");
  const esperadas: Array<[typeof vCelda, string]> = [
    [vCelda, "Referencia: avisos de arriendo y venta de deptos de 1 dormitorio en Providencia, últimos 90 días."],
    [{ ...vCelda, nArriendo: 20 }, "Referencia: avisos de arriendo y venta de deptos de 1 dormitorio en Providencia, últimos 90 días (muestra acotada)."],
    [{ ...vCelda, celdaDormitorios: 2 }, "Referencia: avisos de arriendo y venta de deptos de 2 dormitorios en Providencia, últimos 90 días."],
    [vComuna, "Referencia: avisos de arriendo y venta de deptos en Las Condes, últimos 90 días."],
    [vBdo, "Referencia: edificios de renta en Ñuñoa."],
    [vNac, "Referencia: promedio de Santiago."],
  ];
  for (const [v, e] of esperadas) {
    const got = fuenteCapRef(v);
    if (got !== e) F(`1 · fuente ${v.nivel}: «${got}» ≠ «${e}»`);
    if (TECNICO.test(got)) F(`1 · la fuente ${v.nivel} habla del cálculo: «${got}»`);
  }
  if (fuenteUmbralStr(vCelda, 4.6) !== "Referencia: un punto sobre lo que rinden los avisos de arriendo y venta de deptos de 1 dormitorio en Providencia, últimos 90 días.") F(`1 · fuente STR celda: «${fuenteUmbralStr(vCelda, 4.6)}»`);
  if (fuenteUmbralStr(vBdo, 5.3) !== "Referencia: un punto sobre lo que rinden los edificios de renta en Ñuñoa.") F(`1 · fuente STR bdo: «${fuenteUmbralStr(vBdo, 5.3)}»`);
  if (fuenteUmbralStr(vNac, 5) !== "Referencia: piso de renta corta de Franco para Santiago (5%).") F(`1 · fuente STR nacional: «${fuenteUmbralStr(vNac, 5)}»`);

  // 2 · la explicación: una cosa, sin cascada
  for (const v of [vCelda, vComuna, vBdo, vNac]) {
    const e = explicacionCapRef(v);
    if (TECNICO.test(e) || e.split(". ").length > 2) F(`2 · explicación ${v.nivel} habla del cálculo o dice más de dos frases: «${e}»`);
    if (!/rentabilidad bruta|rentabilidad es/i.test(e)) F(`2 · explicación ${v.nivel} no dice qué es la rentabilidad`);
    const es = explicacionUmbralStr(v);
    if (TECNICO.test(es) || /cap rate/i.test(es)) F(`2 · explicación STR ${v.nivel} habla del cálculo: «${es}»`);
  }
  if (!/Providencia/.test(explicacionCapRef(vCelda)) || !/edificios de renta/.test(explicacionCapRef(vBdo)) || !/promedio de Santiago/.test(explicacionCapRef(vNac))) F("2 · la explicación nombra la comuna, los edificios de renta o el promedio según el peldaño");

  // 3 · el umbral STR = referencia de la comuna + 1 punto; 5 en nacional
  if (PRIMA_STR_PTS !== 1) F(`3 · la prima STR es un punto (es ${PRIMA_STR_PTS})`);
  const u = umbralStrDesde(vCelda);
  if (u.pct !== 4.6 || u.refPct !== 3.6 || u.nivel !== "celda" || u.comuna !== "Providencia") F(`3 · umbral STR de Providencia 3,62 debía ser 4,6 (dio ${u.pct}/${u.refPct}/${u.nivel})`);
  const uB = umbralStrDesde(vBdo);
  if (uB.pct !== 5.3 || uB.nivel !== "bdo") F(`3 · umbral STR bdo (3,4 neto → 4,25 bruto) debía ser 5,3 (dio ${uB.pct})`);
  const uN = umbralStrDesde(vNac);
  if (uN.pct !== CAP_STR_UMBRAL_PCT || uN.nivel !== "nacional" || umbralStrNacional().pct !== 5) F(`3 · sin referencia el umbral STR sigue siendo 5 (dio ${uN.pct})`);
  const h = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str", umbral: umbralStrDesde({ ...vCelda, pct: 5.0, comuna: "Santiago", celdaDormitorios: 1 }) });
  if (!h || h.valor.umbralPct !== 6 || h.direccion !== "adverso" || h.valor.gapPts !== -0.6 || h.valor.nivel !== "celda" || h.valor.refPct !== 5) F(`3 · con la comuna en 5,0 y el sujeto en 5,4 el hallazgo compara contra 6,0 y es adverso (dio ${h?.valor.umbralPct} ${h?.direccion})`);
  if (h && !/Santiago/.test(h.fraseCanonica)) F("3 · la frase STR nombra la comuna");
  if (h && /cap rate/i.test(h.fraseCanonica)) F("3 · la frase STR dice «cap rate»");
  const h5 = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str" });
  if (!h5 || h5.valor.umbralPct !== 5 || h5.direccion !== "favorable") F("3 · sin umbral el builder usa el 5 nacional");
  const ens = leer("src/lib/cierres-str-ensamblador.ts");
  if (!/const umbralPct = hRenta\?\.valor\.umbralPct \?\? CAP_STR_UMBRAL_PCT;/.test(ens) || !/capRefPct: umbralPct,/.test(ens) || /\(CAP_STR_UMBRAL_PCT \/ 100\) \* precioCLP/.test(ens)) F("3 · los cierres STR no usan el umbral del hallazgo");
  const dec = leer("src/lib/decisividades-str.ts");
  if (!/\(extras\.umbralPct \?\? CAP_STR_UMBRAL_PCT\) \/ 100/.test(dec)) F("3 · la neutralización STR no usa el umbral resuelto");
  const asm = leer("src/lib/str-hallazgos.ts");
  if (!/umbralStrDesde\(getCapRefComuna\(ctx\.comuna \|\| "", ctx\.mediana\.capRefComuna\)\)/.test(asm) || !/umbral: umbralStr,/.test(asm) || !/umbralPct: umbralStr\.pct/.test(asm)) F("3 · el ensamblador STR no resuelve el umbral una vez para hallazgo y decisividad");
  const guards = leer("src/lib/str-guards.ts");
  if (!/div\(r\.capPct, r\.umbralPct \?\? CAP_STR_UMBRAL_PCT\)/.test(guards)) F("3 · el guard STR compara contra la constante, no contra el umbral del hallazgo");

  // 4 · el render: nomenclatura, sin cap rate, sin UF en la fuente, sin BDO
  const capI = (src: string) => {
    const a = src.indexOf("I · CUÁNTO RENTA"); const b = src.indexOf("II · TU FLUJO MENSUAL");
    return a >= 0 && b > a ? src.slice(a, b) : "";
  };
  const ltr = capI(leer("src/components/analysis/CapitulosInversion.tsx"));
  // El render STR nuevo espera la decisión de Fabrizio sobre la copy de los casos COMPRAR bajo el
  // umbral (21-sep-2026): por ahora solo se fija que el capítulo STR anterior lea el umbral del
  // motor y no la constante.
  const str = capI(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  if (!ltr || !str) F("4 · no se encontró el bloque del capítulo I en uno de los dos renders");
  if (/CAP_STR_UMBRAL_PCT/.test(str) || !/umbralStr/.test(str)) F("4 · STR: el capítulo I sigue leyendo la constante 5% y no el umbral del motor");
  for (const [n, src] of [["LTR", ltr]] as const) {
    // Lo que el usuario lee: strings y JSX, sin los comentarios del acta.
    const visible = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[^]*?\*\//g, "");
    if (/cap rate|Cap rate|CAP rate|<Ang>cap/i.test(visible)) F(`4 · ${n}: el capítulo I escribe «cap rate»`);
    if (/BDO|peldaño|celda exacta/.test(visible)) F(`4 · ${n}: el capítulo I menciona BDO o peldaños`);
    if (/<VFuente>[^]*?(ufFecha|valorUF|UF \$)[^]*?<\/VFuente>/.test(visible)) F(`4 · ${n}: la fuente lleva la UF del análisis`);
    if (!/NOMBRE_RENTABILIDAD\./.test(visible)) F(`4 · ${n}: la cifra no se nombra con NOMBRE_RENTABILIDAD`);
  }
  if (!/fuenteCapRef\(v\)/.test(ltr) || !/explicacionCapRef\(v\)/.test(ltr)) F("4 · LTR no usa la fuente y la explicación de capref-copy");
  if (!/conApellido\(nombreCifra, `\$\{pct1\(v\.sujetoPct\)\}%`\)/.test(ltr) || /pct1\(v\.capRatePct\)/.test(ltr)) F("4 · LTR no muestra la bruta (sujetoPct) como cifra del capítulo, o vuelve a mostrar el neto");
  if (NOMBRE_RENTABILIDAD.ltr !== "Rentabilidad bruta" || NOMBRE_RENTABILIDAD.str !== "Rentabilidad") F("4 · la nomenclatura es «Rentabilidad bruta» / «Rentabilidad»");

  if (fallas.length) {
    console.log(`   cuanto-renta ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   cuanto-renta ✓ (fuente en una línea por peldaño, explicación de una frase, umbral STR = comuna + 1, render sin cap rate ni UF ni BDO)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCuantoRentaTier();
  process.exit(hard ? 1 : 0);
}
