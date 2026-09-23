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
//   3. el umbral STR (desde el 21-sep, tarde): el yield neto de los Airbnb de la zona, sin punto
//      (lo fija strref-zona-catch-test); el hallazgo lo declara con su procedencia; la
//      neutralización, los cierres y el guard usan EL MISMO umbral (no la constante);
//   4. el render: los dos capítulos nombran la cifra como «Rentabilidad», no escriben «cap rate»
//      en el capítulo I, no ponen la UF en la fuente y no mencionan BDO ni peldaños; el LTR
//      compara `sujetoPct` (la bruta) y no el neto.
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · `fuenteCapRef` con «peldaño 1 de 4» en la línea → cae 1; con la cifra del n → cae 1;
//   · `explicacionCapRef` en dos temas (cascada) → cae 2;
//   · `umbralStrDesdeZona` sumando un punto → cae 3;
//   · el ensamblador STR volviendo a `CAP_STR_UMBRAL_PCT` → cae 3;
//   · el render LTR con «cap rate» en el ksub, o con `valorUF` en la fuente → cae 4.
//   node --import tsx scripts/eval/golden/cuanto-renta-catch-test.ts
//
// ACTA 23-sep-2026 (decisión de Fabrizio, el ⓘ de los indicadores): LA NOMENCLATURA SE DA VUELTA
// A PROPÓSITO. El capítulo I nombra la cifra con su nombre de mercado —«Cap rate bruto» (o
// «Cap rate neto» cuando la referencia es neta) en LTR, «Cap rate» en STR—, sin cursiva y con su
// ⓘ, que es quien explica qué es. Por eso (2) se invierte: la explicación visible YA NO define la
// cifra (lo hacía porque el ⓘ no abría en el teléfono); dice de dónde sale la referencia. Y el
// umbral STR del render lo lee `referenciaCapRateStr`, la misma función que el hero, en vez de
// derivarlo en el capítulo. El resto (fuente, umbral del motor, COMPRAR bajo la referencia, sin
// referencia no compara) sigue igual.
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fuenteCapRef, explicacionCapRef, NOMBRE_RENTABILIDAD } from "../../../src/lib/capref-copy";
import { buildHallazgoRentabilidadStr, umbralStrDesdeZona, CAP_STR_UMBRAL_PCT, referenciaCapRateStr } from "../../../src/lib/rentabilidad-str-hallazgo";
import { GLOSAS } from "../../../src/lib/glosas-indicadores";
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

  // 2 · la explicación: una cosa, sin cascada
  for (const v of [vCelda, vComuna, vBdo, vNac]) {
    const e = explicacionCapRef(v);
    if (TECNICO.test(e) || e.split(". ").length > 2) F(`2 · explicación ${v.nivel} habla del cálculo o dice más de dos frases: «${e}»`);
    // Qué es la cifra lo dice su ⓘ (acta 23-sep): la explicación no la define, y si la nombra
    // es en minúscula dentro de la frase (§5.7).
    if (/rentabilidad bruta es|rentabilidad es|cap rate (bruto |neto )?es\b/i.test(e)) F(`2 · explicación ${v.nivel} vuelve a definir la cifra (eso es del ⓘ): «${e}»`);
    if (/Cap rate/.test(e.slice(1))) F(`2 · explicación ${v.nivel} escribe «Cap rate» con mayúscula dentro de la frase`);
  }
  if (!/Providencia/.test(explicacionCapRef(vCelda)) || !/edificios de renta/.test(explicacionCapRef(vBdo)) || !/promedio de Santiago/.test(explicacionCapRef(vNac))) F("2 · la explicación nombra la comuna, los edificios de renta o el promedio según el peldaño");

  // 3 · el umbral STR (21-sep, tarde): STR contra STR de la zona, sin punto; lo fija a fondo
  //     strref-zona-catch-test. Acá solo que el motor lo lee del snapshot y no de una constante.
  const uZ = umbralStrDesdeZona({ nivel: "celda", neto: 4.62, bruto: 8.7, ingresoAnual: 6825431, precio: 78688474, m2: 32, costosMes: 187000, nDirecciones: 60, nVenta: 2963, celda: { comuna: "Santiago", dormitorios: 1 }, fuente: "x", resolvedAt: "2026-09-21T00:00:00.000Z" });
  if (uZ.pct !== 4.6 || uZ.nivel !== "celda") F(`3 · el umbral STR es el neto de la zona a un decimal (dio ${uZ.pct}/${uZ.nivel})`);
  const h = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str", umbral: uZ });
  if (!h || h.valor.umbralPct !== 4.6 || h.direccion !== "favorable" || h.valor.gapPts !== 0.8) F(`3 · con la zona en 4,6 y el sujeto en 5,4 el hallazgo es favorable (dio ${h?.valor.umbralPct} ${h?.direccion})`);
  if (h && /cap rate/i.test(h.fraseCanonica)) F("3 · la frase STR dice «cap rate»");
  const h5 = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str" });
  if (!h5 || h5.valor.umbralPct !== CAP_STR_UMBRAL_PCT || h5.valor.nivel !== "sin_referencia") F("3 · sin umbral el builder declara sin_referencia con el 5 de respaldo");
  const ens = leer("src/lib/cierres-str-ensamblador.ts");
  if (!/const umbralPct = hRenta\?\.valor\.umbralPct \?\? CAP_STR_UMBRAL_PCT;/.test(ens) || !/capRefPct: umbralPct,/.test(ens) || /\(CAP_STR_UMBRAL_PCT \/ 100\) \* precioCLP/.test(ens)) F("3 · los cierres STR no usan el umbral del hallazgo");
  const dec = leer("src/lib/decisividades-str.ts");
  if (!/\(extras\.umbralPct \?\? CAP_STR_UMBRAL_PCT\) \/ 100/.test(dec)) F("3 · la neutralización STR no usa el umbral resuelto");
  const asm = leer("src/lib/str-hallazgos.ts");
  if (!/umbralStrDesdeZona\(ctx\.mediana\.strRefZona, ctx\.comuna \|\| ""\)/.test(asm) || !/umbral: umbralStr,/.test(asm) || !/umbralPct: umbralStr\.pct/.test(asm)) F("3 · el ensamblador STR no resuelve el umbral una vez para hallazgo y decisividad");
  const guards = leer("src/lib/str-guards.ts");
  if (!/div\(r\.capPct, r\.umbralPct \?\? CAP_STR_UMBRAL_PCT\)/.test(guards)) F("3 · el guard STR compara contra la constante, no contra el umbral del hallazgo");

  // 4 · el render: nomenclatura, sin cap rate, sin UF en la fuente, sin BDO
  const capI = (src: string) => {
    const a = src.indexOf("I · CUÁNTO RENTA"); const b = src.indexOf("II · TU FLUJO MENSUAL");
    return a >= 0 && b > a ? src.slice(a, b) : "";
  };
  const ltr = capI(leer("src/components/analysis/CapitulosInversion.tsx"));
  const str = capI(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  if (!ltr || !str) F("4 · no se encontró el bloque del capítulo I en uno de los dos renders");
  for (const [n, src] of [["LTR", ltr], ["STR", str]] as const) {
    // Lo que el usuario lee: strings y JSX, sin los comentarios del acta.
    const visible = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[^]*?\*\//g, "");
    // El nombre sale de NOMBRE_RENTABILIDAD (que es el de GLOSAS), nunca escrito a mano.
    if (/"[^"\n]*cap rate[^"\n]*"|`[^`\n]*cap rate[^`\n]*`|>[^<{\n]*cap rate/i.test(visible)) F(`4 · ${n}: el capítulo I escribe «cap rate» a mano en vez de leer NOMBRE_RENTABILIDAD`);
    if (/BDO|peldaño|celda exacta/.test(visible)) F(`4 · ${n}: el capítulo I menciona BDO o peldaños`);
    if (/<VFuente>[^]*?(ufFecha|valorUF|UF \$)[^]*?<\/VFuente>/.test(visible)) F(`4 · ${n}: la fuente lleva la UF del análisis`);
    if (!/NOMBRE_RENTABILIDAD\./.test(visible)) F(`4 · ${n}: la cifra no se nombra con NOMBRE_RENTABILIDAD`);
  }
  if (!/fuenteCapRef\(v\)/.test(ltr) || !/explicacionCapRef\(v\)/.test(ltr)) F("4 · LTR no usa la fuente y la explicación de capref-copy");
  if (!/fuenteUmbralStr\(vRef\)/.test(str) || !/explicacionUmbralStr\(vRef\)/.test(str)) F("4 · STR no usa la fuente y la explicación de capref-copy");
  if (!/conApellido\(nombreCifra, `\$\{pct1\(v\.sujetoPct\)\}%`\)/.test(ltr) || /pct1\(v\.capRatePct\)/.test(ltr)) F("4 · LTR no muestra la bruta (sujetoPct) como cifra del capítulo, o vuelve a mostrar el neto");
  if (!/const ref = referenciaCapRateStr\(hallazgos, comuna\);\s*const umbral = ref\.pct;/.test(str) || /CAP_STR_UMBRAL_PCT/.test(str)) F("4 · STR no toma el umbral del hallazgo por referenciaCapRateStr");
  // Y la función lee el hallazgo, no la constante: con zona 2,2 dice 2,2; sin hallazgo, sin referencia.
  const refZ = referenciaCapRateStr([{ id: "rentabilidad_str", valor: { umbralPct: 2.2, nivel: "celda", comuna: "Providencia", celdaDormitorios: 2 } } as never]);
  if (refZ.pct !== 2.2 || !refZ.hayRef || refZ.comuna !== "Providencia") F(`4 · referenciaCapRateStr no lee el umbral del hallazgo (dio ${refZ.pct} ${refZ.hayRef})`);
  const refN = referenciaCapRateStr([]);
  if (refN.hayRef || refN.nivel !== "sin_referencia") F("4 · referenciaCapRateStr sin hallazgo no declara sin_referencia");
  // 5 · COMPRAR bajo la referencia de la comuna (decisión de Fabrizio, 21-sep-2026): el capítulo
  //     no dice «apuesta»; nombra la tensión (rinde algo menos de lo que Franco pide para renta
  //     corta en esa zona), dice que el caso cierra igual y que el break-even lo confirma.
  const ramaComprar = str.match(/veredicto === "COMPRAR" && cap < umbral[^]*?\?\s*<>([^]*?)<\/>\s*\n\s*:/);
  if (!ramaComprar) F("5 · STR: no existe la rama de COMPRAR bajo el umbral en el cruce");
  else {
    const txt = ramaComprar[1];
    if (/apuesta/i.test(txt)) F("5 · STR: la rama COMPRAR bajo el umbral dice «apuesta»");
    if (!/rinde algo menos de lo que Franco pide para una renta corta en/.test(txt)) F("5 · STR: la rama COMPRAR no nombra la tensión (rinde algo menos de lo que Franco pide…)");
    if (!/el caso cierra igual/.test(txt)) F("5 · STR: la rama COMPRAR no dice que el caso cierra igual");
    if (!/punto de equilibrio/.test(txt)) F("5 · STR: la rama COMPRAR no cita el break-even");
    if (!/\{be\b/.test(txt)) F("5 · STR: la rama COMPRAR no usa el break-even del motor (be)");
  }
  // 6 · sin referencia el capítulo LO DICE y NO COMPARA (decisión de Fabrizio, 21-sep-2026): el
  //     valor no va en rojo, el sub no dice «referencia X», y la rama sin referencia no nombra el
  //     umbral ni la tarifa «para rendir X»; el dial y el break-even quedan (no dependen de la
  //     referencia).
  if (!/const hayRef = ref\.hayRef;/.test(str) || !/const vRef = \{ nivel: ref\.nivel,/.test(str)) F("6 · STR no deriva hayRef del nivel del hallazgo");
  if (!/valorRojo: hayRef && cap < umbral,/.test(str)) F("6 · STR: el rojo del valor no está gateado por hayRef");
  if (!/ksub: hayRef \? `referencia \$\{refTxt\}` : "sin referencia en la zona",/.test(str)) F("6 · STR: el sub no cambia sin referencia");
  // Las dos ramas se cierran en su </VViz>: un `)}` pelado corta en el primer `{pct1(cap)}`.
  const ramas = str.match(/\{hayRef \? \(([^]*?)<\/VViz>\s*\) : \(([^]*?)<\/VViz>\s*\)\}/);
  if (!ramas) F("6 · STR: el cuerpo no bifurca por hayRef");
  else {
    if (!/Para rendir como la referencia/.test(ramas[1]) || !/\{cruce\}/.test(ramas[1])) F("6 · STR: la rama con referencia perdió el centro o el cruce");
    if (/refTxt|adrRef|umbral|\{cruce\}|Para rendir/.test(ramas[2])) F("6 · STR: la rama sin referencia compara contra el umbral");
    if (!/no lo compara/.test(ramas[2]) || !/No hay Airbnb suficientes de \{vRef\.comuna\}/.test(ramas[2])) F("6 · STR: la rama sin referencia no dice que no compara ni por qué");
    if (!/explicacionUmbralStr\(vRef\)/.test(ramas[2])) F("6 · STR: la rama sin referencia no explica qué es la rentabilidad");
  }
  if (!/\{dial && \(/.test(str) || !/\{sensStr && beBar && \(/.test(str)) F("6 · STR: el dial o el break-even dejaron de estar fuera de la bifurcación");
  const posBe = str.indexOf("const be = sensStr"); const posCruce = str.indexOf("const cruce = holgura");
  if (posBe < 0 || posCruce < 0 || posBe > posCruce) F("5 · STR: el break-even se lee después de la copy que lo cita");
  if (NOMBRE_RENTABILIDAD.ltr !== "Cap rate bruto" || NOMBRE_RENTABILIDAD.ltrNeta !== "Cap rate neto" || NOMBRE_RENTABILIDAD.str !== "Cap rate") F("4 · la nomenclatura es «Cap rate bruto» / «Cap rate neto» / «Cap rate»");
  if (NOMBRE_RENTABILIDAD.ltr !== GLOSAS.capRateBruto.nombre || NOMBRE_RENTABILIDAD.str !== GLOSAS.capRateStr.nombre) F("4 · el apellido del capítulo y el título del ⓘ no son el mismo nombre");
  // El ⓘ va en el sub del capítulo abierto (campo `glosa`), no en la fila.
  if (!/glosa: <GlosaIndicador glosa=\{v\.base === "bruta" \? "capRateBruto" : "capRateNeto"\}/.test(ltr)) F("4 · LTR: el capítulo I no lleva el ⓘ del cap rate en el sub");
  if (!/glosa: <GlosaIndicador glosa="capRateStr"/.test(str)) F("4 · STR: el capítulo I no lleva el ⓘ del cap rate en el sub");

  if (fallas.length) {
    console.log(`   cuanto-renta ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   cuanto-renta ✓ (fuente en una línea por peldaño, explicación de una frase, umbral STR = lo que proyectan los Airbnb de la zona, sin referencia no compara, render sin cap rate ni UF ni BDO)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCuantoRentaTier();
  process.exit(hard ? 1 : 0);
}
