/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · LA FORMA NUEVA DE `VCierre` — catch-test (17-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El cierre («Qué significa» / «Qué haces con esto») perdió el formato editorial: barra
// roja de 3px, caja con fondo, rótulo en versalita ROJA weight 700 y cuerpo en itálica.
// Un solo bloque de CSS gobierna los 28 cierres del informe, así que un solo bloque puede
// deshacerlo sin que nada más se entere.
//
// ⛔ ESTE TIER LEE CSS, ASÍ QUE MIDE GRAFÍA — y eso tiene una trampa conocida: el acta que
// explica la regla NOMBRA todo lo que el predicado prohíbe («Signal Red», «itálica»,
// «--doc-tx4»), así que un guard ingenuo quedaría satisfecho por la PROSA y borrar el CSS
// entero lo dejaría verde. Por eso lo primero que hace el extractor es BORRAR LOS
// COMENTARIOS, y hay un piso de cobertura que exige que las cuatro reglas existan de verdad.
//
// Fija SEIS cosas:
//
//   1. EL CIERRE NO LLEVA SIGNAL RED. Es la decisión entera: el rojo queda para la única
//      alarma real del informe. El precedente estaba escrito desde antes, en el acta de
//      `.v-fuente.aviso` — «un caveat no es una alarma».
//   2. NI ITÁLICA NI SERIF. El cuerpo va en la misma escala que la prosa del capítulo.
//   3. EL PLUMÓN ESTÁ NEUTRALIZADO, NO SACADO DEL SELECTOR. Ésta es la trampa que casi se
//      me pasa: `<mark>` sin regla propia cae al AMARILLO por defecto del navegador, porque
//      el repo no tiene reset global de `mark`. 19 de los 28 cierres pueden traer uno.
//   4. LA PROSA SÍ CONSERVA EL PLUMÓN. Si alguien "limpia" `.v-prosa mark` de paso, el
//      informe pierde su único mecanismo de énfasis.
//   5. EL RÓTULO NO USA `--doc-tx4`. Igualarlo al rótulo de los diagramas sonaba coherente
//      y es una regresión medida: 2,15-2,33:1 contra los papeles del informe, viniendo de
//      4,81:1. Va en `--doc-tx3` (4,06-4,40:1).
//   6. LA REGLA DEGRADADA NO VUELVE. Existía para que dos cierres apilados no dieran dos
//      cajas; sin caja no tiene nada que degradar, y su `border-left` gris chocaría con la
//      regla superior de la forma nueva.
//
//   + PISO DE COBERTURA: las cuatro reglas del cierre tienen que EXISTIR. Sin esto, borrar
//     el bloque entero deja todos los predicados negativos en verde — que es exactamente
//     «un cero de medición que no distingue NO CORRIÓ».
//
// Corre standalone:
//   node --import tsx scripts/eval/golden/cierre-sin-barra-roja-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

const RUTA = join(process.cwd(), "src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
const fuente = readFileSync(RUTA, "utf8");

/** El CSS sin comentarios. Lo primero, y por una razón: el acta nombra todo lo prohibido. */
const css = fuente.replace(/\/\*[\s\S]*?\*\//g, "");

/** Devuelve el cuerpo de una regla CSS por selector exacto, o null si no está. */
function regla(selector: string): string | null {
  const i = css.indexOf(selector + "{");
  if (i === -1) return null;
  const j = css.indexOf("}", i);
  if (j === -1) return null;
  return css.slice(i + selector.length + 1, j);
}

const CIERRE = regla(".v-cierre");
const ROTULO = regla(".v-cierre .t");
const CUERPO = regla(".v-cierre p");
const PLUMON_CIERRE = regla(".v-cierre p mark");
const PLUMON_PROSA = regla(".v-prosa mark");

// ── PISO DE COBERTURA (va PRIMERO: si no hay reglas, lo demás no mide nada) ──
{
  const exigidas: Array<[string, string | null]> = [
    [".v-cierre", CIERRE],
    [".v-cierre .t", ROTULO],
    [".v-cierre p", CUERPO],
    [".v-cierre p mark", PLUMON_CIERRE],
    [".v-prosa mark", PLUMON_PROSA],
  ];
  for (const [nombre, cuerpo] of exigidas) {
    if (cuerpo == null) F(`PISO · la regla \`${nombre}\` no existe — sin ella los predicados de abajo son un cero de medición`);
    else if (!cuerpo.trim()) F(`PISO · la regla \`${nombre}\` está VACÍA`);
  }
  // y el extractor tiene que haber sacado comentarios de verdad
  if (css.includes("/*")) F("PISO · quedaron comentarios en el CSS extraído: los predicados podrían satisfacerse con prosa");
  if (css.length < 2000) F(`PISO · el CSS extraído mide ${css.length} caracteres: el archivo no es el que se cree`);
}

// ── 1 · el cierre no lleva Signal Red ───────────────────────────────────────
for (const [nombre, cuerpo] of [[".v-cierre", CIERRE], [".v-cierre .t", ROTULO], [".v-cierre p", CUERPO]] as const) {
  if (cuerpo && /signal-red/.test(cuerpo)) {
    F(`1 · \`${nombre}\` volvió a Signal Red: el rojo es de la alarma, no del cierre`);
  }
}

// ── 2 · ni itálica ni serif ─────────────────────────────────────────────────
{
  if (CUERPO && /font-style\s*:\s*italic/.test(CUERPO)) F("2 · el cuerpo del cierre volvió a la itálica");
  if (CUERPO && /font-heading/.test(CUERPO)) F("2 · el cuerpo del cierre volvió al serif (--font-heading)");
  if (CUERPO && !/font-body/.test(CUERPO)) F("2 · el cuerpo del cierre no declara --font-body: hereda lo que le toque");
}

// ── 3 · el plumón está NEUTRALIZADO, no sacado ──────────────────────────────
{
  if (PLUMON_CIERRE && !/background\s*:\s*none/.test(PLUMON_CIERRE)) {
    F("3 · `.v-cierre p mark` existe pero no anula el fondo: `<mark>` cae al amarillo del navegador");
  }
  if (PLUMON_CIERRE && /linear-gradient/.test(PLUMON_CIERRE)) {
    F("3 · `.v-cierre p mark` volvió a pintar el plumón");
  }
  // y NO puede volver al selector compartido, que es la forma sutil de reintroducirlo
  if (/\.v-prosa mark\s*,\s*\.v-cierre p mark/.test(css)) {
    F("3 · el cierre volvió al selector compartido con la prosa");
  }
}

// ── 4 · la prosa sí conserva el plumón ──────────────────────────────────────
{
  if (PLUMON_PROSA && !/linear-gradient/.test(PLUMON_PROSA)) {
    F("4 · `.v-prosa mark` dejó de pintar el plumón: el informe se queda sin énfasis");
  }
  if (PLUMON_PROSA && !/--doc-hl/.test(PLUMON_PROSA)) {
    F("4 · `.v-prosa mark` ya no usa --doc-hl: el plumón dejó de seguir al veredicto");
  }
}

// ── 5 · el rótulo no usa --doc-tx4 ──────────────────────────────────────────
{
  if (ROTULO && /--doc-tx4/.test(ROTULO)) {
    F("5 · el rótulo del cierre bajó a --doc-tx4 (2,15-2,33:1 sobre los papeles del informe): es la regresión que se midió y se descartó");
  }
  if (ROTULO && !/--doc-tx3/.test(ROTULO)) {
    F("5 · el rótulo del cierre ya no usa --doc-tx3, que es el único tono medido para esta pieza");
  }
}

// ── 6 · la regla degradada no vuelve ────────────────────────────────────────
{
  if (/:has\(~\s*\.v-cierre\)/.test(css)) {
    F("6 · volvió la regla degradada `.v-cierre:has(~ .v-cierre)`: con la forma única no tiene caja que degradar, y su border-left gris choca con la regla superior");
  }
}

export function runCierreSinBarraRojaTier(): { hard: number } {
  console.log("\n─── TIER CIERRE-SIN-BARRA-ROJA (la forma nueva de VCierre · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el cierre sin Signal Red, sin itálica y sin serif, el plumón neutralizado y no sacado, la prosa conservándolo, el rótulo en --doc-tx3 y la regla degradada sin volver");
  } else {
    for (const m of fallas) console.log(`  ✗ ${m}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCierreSinBarraRojaTier();
  process.exit(hard ? 1 : 0);
}
