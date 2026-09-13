// ============================================================================
// GOLDEN · EL POP-UP DE AJUSTES — catch-test (13-sep-2026). 0 tokens, sin base.
// ============================================================================
// Contrato visual: docs/wireframes/rediseno-informe/popup-palancas-final.html
// Datos: los emite el bloque A (`mixPalancas.celdas`, `.score`, `.despues` y
// `palancas[].score/destino`). Este tier fija el RENDER: que lea del motor y no invente,
// que cada estado dibuje lo suyo, y que el estado sin nada no abra pop-up.
//
// LOS CUATRO ESTADOS (medidos sobre el parque recomputado, 13-sep-2026):
//
//              con grilla   sin grilla+solas   sin nada   COMPRAR
//   LTR            772             0             270        160
//   STR            114             6              73         56
//
// Fija SIETE cosas:
//
//   1. EL POP-UP LEE DEL MOTOR. La matriz sale de `mixPalancas.celdas` y la tabla de
//      `palancas[]`; el componente no recalcula descuentos ni scores. Si alguien mete
//      aritmética de veredicto en el render, el informe puede decir dos cosas distintas
//      del mismo caso.
//
//   2. LA CELDA MUESTRA VEREDICTO Y SCORE, no el descuento. El descuento es del panel de
//      detalle, con el pie extra, y aparece al tocar la celda.
//
//   3. «HOY» NO SE INVENTA. 16 filas LTR y 2 STR no tienen celda actual porque su plazo
//      declarado no está en la grilla del mix. Ahí no se marca nada ni se nombra en la
//      leyenda (decisión Fabrizio, 13-sep-2026).
//
//   4. EL ÓPTIMO SON SIETE PARES y el del retorno va SIEMPRE, con guion cuando no aplica
//      (pie 0: 21 filas LTR, 8 STR). No se omite la fila.
//
//   5. EN COMPRAR NO HAY MATRIZ NI ÓPTIMO: no hay a dónde subir. Van los márgenes de la
//      card —Margen, Precio, Verifica— y la tabla de las solas si alguna mueve algo.
//
//   6. SIN GRILLA NI PALANCAS, NO HAY POP-UP. La card ya lo dice todo —«no hay forma», el
//      número y la alternativa de comunas— y repetirlo en un pop-up es ruido. El botón no
//      se dibuja (decisión Fabrizio, 13-sep-2026).
//
//   7. EL CTA VA INERTE. Se dibuja con el precio negociado y no navega: la decisión de
//      créditos es del bloque C. Un CTA que navega antes de esa decisión cobraría un
//      análisis sin que nadie lo haya decidido.
//
// Corre dentro del QUICK (tier "popup-ajustes") y standalone:
//   node --import tsx scripts/eval/golden/popup-ajustes-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

const POPUP = leer("src/components/analysis/shared/PopupAjustes.tsx");
const HERO_LTR = leer("src/components/analysis/HeroLTR.tsx");
const HERO_STR = leer("src/components/analysis/str/HeroStrDictamen.tsx");

// ── 1 · existe y lee del motor ─────────────────────────────────────────────
{
  if (!POPUP) F("1 · no existe `src/components/analysis/shared/PopupAjustes.tsx`");
  else {
    if (!/mixPalancas/.test(POPUP) || !/\.celdas/.test(POPUP)) F("1 · el pop-up no lee `mixPalancas.celdas`: la matriz saldría de otra fuente que la del motor");
    if (!/despues/.test(POPUP)) F("1 · el pop-up no lee `despues`: los pares del óptimo no tendrían lado derecho");
    // El render NO decide veredictos: nada de recomputar ni de comparar bandas acá.
    if (/deriveVeredicto|calcMetrics|calcScoreFromMetrics|calcularMixPalancas/.test(POPUP)) {
      F("1 · el pop-up llama al motor: el render pinta lo que el motor ya decidió, no lo recalcula");
    }
  }
}

// ── 2 · la celda dice veredicto y score; el descuento es del panel ─────────
{
  if (POPUP && !/score/.test(POPUP)) F("2 · la celda no muestra el score");
  if (POPUP && !/etiquetaVeredicto|veredicto/.test(POPUP)) F("2 · la celda no muestra el veredicto");
  if (POPUP && !/descuentoPct/.test(POPUP)) F("2 · el panel de detalle no muestra el descuento que se pide");
  if (POPUP && !/costoDiaUnoUF/.test(POPUP)) F("2 · el panel de detalle no muestra el pie extra del día uno");
  if (POPUP && !/no llega a/.test(POPUP)) F("2 · el panel no contempla la celda que no cruza («no llega a Comprar»)");
}

// ── 3 · «hoy» no se inventa ────────────────────────────────────────────────
{
  if (POPUP && !/esActual/.test(POPUP)) F("3 · el pop-up no mira `esActual`: no podría marcar la celda de hoy");
  // La leyenda de «hoy» solo existe si alguna celda lo es.
  if (POPUP && !/some\(\(?c\)? => c\.esActual\)|hayActual/.test(POPUP)) {
    F("3 · la leyenda nombra «hoy» sin comprobar que exista la celda: 16 filas LTR y 2 STR no la tienen");
  }
}

// ── 4 · los siete pares, con el retorno siempre ────────────────────────────
{
  if (!POPUP) F("4 · sin componente no hay pares que fijar");
  else {
    for (const [k, etiqueta] of [
      ["Pie el día uno", "el pie del día uno"],
      ["Cuota mensual", "la cuota"],
      ["Flujo mensual", "el flujo"],
      ["Por cada \\$100 que pones", "el retorno sobre lo puesto"],
      ["Cap rate neto", "el cap rate"],
      ["TIR a 10 años", "la TIR"],
      ["Franco Score", "el score"],
    ] as const) {
      if (!new RegExp(k).test(POPUP)) F(`4 · falta el par de ${etiqueta}`);
    }
    // El par del retorno NO se omite con pie 0: va con guion.
    if (!/PAR_SIN_VALOR|—/.test(POPUP)) F("4 · no hay marca de «sin valor»: con pie 0 el par del retorno tiene que ir con guion, no omitirse");
  }
}

// ── 5 · COMPRAR: márgenes, sin matriz ni óptimo ────────────────────────────
{
  if (POPUP && !/Margen/.test(POPUP)) F("5 · en COMPRAR el pop-up no muestra la fila «Margen» de la card");
  if (POPUP && !/Verifica/.test(POPUP)) F("5 · en COMPRAR el pop-up no muestra la fila «Verifica» de la card");
  if (POPUP && !/COMPRAR/.test(POPUP)) F("5 · el pop-up no distingue el caso COMPRAR");
}

// ── 6 · sin grilla ni palancas, no hay botón ───────────────────────────────
{
  for (const [src, quien] of [[HERO_LTR, "HeroLTR"], [HERO_STR, "HeroStrDictamen"]] as const) {
    if (!src) { F(`6 · no se pudo leer ${quien}`); continue; }
    if (!/abrePopupAjustes|hayAjustesQueMostrar/.test(src)) {
      F(`6 · ${quien} no decide si hay algo que mostrar antes de dibujar el botón: el estado sin grilla ni palancas no puede abrir un pop-up que repite la card`);
    }
  }
}

// ── 7 · el CTA va inerte ───────────────────────────────────────────────────
{
  if (POPUP) {
    if (!/Analízalo a UF/.test(POPUP)) F("7 · el CTA no dibuja el precio negociado («Analízalo a UF X»)");
    // Inerte de verdad: ni link ni handler de navegación.
    if (/<Link|href=|router\.push|window\.location/.test(POPUP)) {
      F("7 · el CTA navega: hasta el bloque C tiene que ser inerte (la decisión de créditos no está tomada)");
    }
    if (!/inerte/i.test(POPUP)) F("7 · el CTA no declara en el código que es inerte a propósito: sin esa nota, el próximo lector lo lee como un bug");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPopupAjustesTier(): { hard: number } {
  console.log("\n─── TIER POPUP-AJUSTES (el render del pop-up · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — lee del motor, la celda dice veredicto y score, «hoy» no se inventa, los siete pares con el retorno en guion, COMPRAR sin matriz, sin grilla ni palancas no hay botón y el CTA va inerte");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPopupAjustesTier();
  process.exit(hard ? 1 : 0);
}
