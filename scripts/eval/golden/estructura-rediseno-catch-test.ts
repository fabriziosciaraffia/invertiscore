// ============================================================================
// GOLDEN · LA ESTRUCTURA DEL INFORME — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §2.
//
// La estructura de hoy son secciones de color alternado a sangre. La del contrato es
// papel continuo con DOS cajas: el hero y la recomendación. La diferencia no es
// decorativa — es lo que dice qué hay que leer y qué hay que hojear.
//
// Fija SEIS cosas:
//
//   1. SOLO EL HERO PIDE CAJA HOY. `caja` se emite en un único call site. La
//      recomendación es la otra caja del contrato, pero hoy se monta DENTRO del hero
//      (`HeroLTR` monta `PosicionFranco`): sale a su propia sección en 4c. Este tier
//      fija el número esperado, así que cuando 4c la saque hay que subirlo a mano —
//      que es exactamente la conversación que tiene que pasar.
//
//   2. LA ALTERNANCIA MUERE, Y LE GANA A `.doc-sec.p2`. Las secciones sueltas dejan de
//      pintar fondo. `.doc-sec.p2{background:var(--doc-inset-0)}` tiene la MISMA
//      especificidad que `.doc-r2 .doc-sec` y va después en el archivo, así que la
//      regla del rediseño necesita `.p2` en su propio selector o no pinta nada. Medido
//      en el DOM: sin `.p2` la sección `la-inversion` conservaba su fondo.
//
//   3. LAS DOS FORMAS DEL SELECTOR DEL MARCO. Retirar la sombra huérfana de
//      `.doc-dictamen` exige `.doc-r2.doc-dictamen` (producción: las dos clases en el
//      mismo elemento) Y `.doc-r2 .doc-dictamen` (ruta dev: `.doc-r2` envuelve desde
//      afuera). Con una sola, la ruta de prueba miente. Es la trampa de
//      `docs/wireframes/rediseno-informe/entorno-de-prueba-no-es-produccion.md`.
//
//   4. LA SEPARACIÓN ES ESPACIO, NO COLOR: 38 px entre secciones sueltas, 34 entre
//      cajas, y la última sin margen. Si alguien vuelve a poner `padding` de sangrado
//      en `.doc-sec` dentro del rediseño, el papel continuo se rompe.
//
//   5. EL ANCHO DEL CONTRATO ES 700 px sobre `.doc-page--secciones`.
//
//   6. EL ANDAMIO `--doc-inset` NO SE RETIRA. En el camino nuevo se queda sin trabajo,
//      pero el camino de prosa vieja es PERMANENTE para 453 filas anónimas y lo sigue
//      usando. Borrarlo «porque ya no hace falta» rompe la mitad del parque.
//
// Corre dentro del QUICK (tier "estructura-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/estructura-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const GRID = leer("src/components/analysis/SubjectCardGrid.tsx");
const SECCION = leer("src/components/analysis/SeccionInforme.tsx");
const ZONA = leer("src/components/analysis/zona/ZonaLtr.tsx");
const CTX = leer("src/components/analysis/RedisenoContexto.tsx");

/** Un bloque del rediseño, del encabezado que lo rotula hasta el encabezado siguiente. */
function bloqueDe(rotulo: string): string {
  const marca = CSS.indexOf(rotulo);
  if (marca === -1) return "";
  // Desde el ABRE-COMENTARIO, no desde el rótulo: el rótulo vive DENTRO del comentario,
  // así que cortar ahí deja un `*/` huérfano y el stripper no lo reconoce como comentario.
  // La cola de ese comentario lleva comas y se cuela en el listado de selectores.
  const i = CSS.lastIndexOf("/*", marca);
  // Cierra en el PRÓXIMO bloque del rediseño, sea cual sea: anclarlo a un rótulo puntual
  // se rompe sola cuando alguien inserta una sección en el medio, y el tier pasa a leer
  // reglas ajenas como si fueran de la suya.
  const j = CSS.indexOf("═══ REDISEÑO ·", marca);
  // SIN COMENTARIOS. Cada regla va precedida por su comentario, y los comentarios llevan
  // comas: sin sacarlos, el texto del comentario entra al listado de selectores y
  // ninguna regla se reconoce. La primera versión de este tier dio seis fallas que eran
  // todas del parser.
  return CSS.slice(i, j === -1 ? i + 4000 : j).replace(/\/\*[\s\S]*?\*\//g, "");
}

const BLOQUE = bloqueDe("REDISEÑO · ESTRUCTURA");
const CIFRAS = bloqueDe("REDISEÑO · LAS CIFRAS");
const ZONACSS = bloqueDe("REDISEÑO · LA ZONA");
if (!BLOQUE) F("0 · no existe el bloque «REDISEÑO · ESTRUCTURA» en la portada");
if (!CIFRAS) F("0 · no existe el bloque «REDISEÑO · LAS CIFRAS» en la portada");
if (!ZONACSS) F("0 · no existe el bloque «REDISEÑO · LA ZONA» en la portada");

/** El cuerpo de la primera regla cuyo selector completo contenga exactamente `sel`.
 *  Compara selectores enteros —no substrings— para no confundir `.doc-r2 .doc-sec`
 *  con `.doc-r2 .doc-sec--caja`, que lo contiene como prefijo. */
function reglaDe(sel: string, txt = BLOQUE): string | null {
  for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (selectores.includes(sel)) return m[2];
  }
  return null;
}

// ── 1 · solo el hero pide caja ─────────────────────────────────────────────
{
  const CAJAS_ESPERADAS = 1; // sube a 2 cuando 4c saque la recomendación del hero
  const usos = [...GRID.matchAll(/<SeccionInforme\b[^>]*\bcaja\b/g)].length;
  if (usos !== CAJAS_ESPERADAS) {
    F(`1 · hay ${usos} secciones con «caja» y el tier espera ${CAJAS_ESPERADAS}. Si 4c sacó la recomendación del hero, subí la constante; si no, alguien le puso caja a una sección que el contrato deja suelta.`);
  }
  if (!/id="hero"[^>]*\bcaja\b/.test(GRID)) F("1 · el hero dejó de pedir caja: es una de las dos del contrato");
  if (!/caja\s*\?\s*" doc-sec--caja"/.test(SECCION)) F("1 · SeccionInforme no emite la clase doc-sec--caja");
}

// ── 2 · la alternancia muere, y le gana a .doc-sec.p2 ──────────────────────
{
  const suelta = reglaDe(".doc-r2 .doc-sec");
  if (!suelta) F("2 · no existe la regla de la sección suelta");
  else {
    if (!/background:\s*none/.test(suelta)) F("2 · la sección suelta volvió a pintar fondo: el papel es continuo");
    if (/padding:\s*(?!0)/.test(suelta)) F("2 · la sección suelta recuperó padding de sangrado");
  }
  if (reglaDe(".doc-r2 .doc-sec.p2") === null) {
    F("2 · falta «.doc-r2 .doc-sec.p2» en el selector de la sección suelta. `.doc-sec.p2` tiene la MISMA especificidad y va después: sin esto la sección alternada conserva su fondo, medido en el DOM.");
  }
  if (reglaDe(".doc-r2 .doc-sec--caja.p2") === null) {
    F("2 · falta «.doc-r2 .doc-sec--caja.p2»: el hero es p2, así que sin esa forma la caja pierde contra la regla de la suelta");
  }
}

// ── 3 · las dos formas del selector del marco ──────────────────────────────
for (const sel of [".doc-r2.doc-dictamen", ".doc-r2 .doc-dictamen"]) {
  const r = reglaDe(sel);
  if (r === null) {
    F(`3 · falta «${sel}» al retirar la sombra del marco. Hacen falta las DOS formas: en producción «.doc-r2» va en el mismo elemento, en la ruta dev envuelve desde afuera.`);
  } else if (!/box-shadow:\s*none/.test(r)) {
    F(`3 · «${sel}» ya no retira la sombra huérfana del marco: con ella el informe entero flota y las dos cajas dejan de destacarse`);
  }
}

// ── 4 · la separación es espacio ───────────────────────────────────────────
{
  const suelta = reglaDe(".doc-r2 .doc-sec") ?? "";
  const caja = reglaDe(".doc-r2 .doc-sec--caja") ?? "";
  const mb = (c: string) => Number((c.match(/margin-bottom:\s*(\d+)px/) ?? [])[1]);
  if (mb(suelta) !== 38) F(`4 · la separación entre secciones sueltas es ${mb(suelta) || "?"}px y el contrato pide 38`);
  if (mb(caja) !== 34) F(`4 · la separación de las cajas es ${mb(caja) || "?"}px y el contrato pide 34`);
  if (reglaDe(".doc-r2 .doc-sec:last-child") === null) F("4 · la última sección no anula su margen: deja un hueco al pie del informe");
}

// ── 5 · el ancho del contrato ──────────────────────────────────────────────
{
  const p = reglaDe(".doc-r2 .doc-page--secciones");
  if (!p) F("5 · no se fija el ancho de la página de secciones");
  else if (!/max-width:\s*700px/.test(p)) F(`5 · el ancho no es 700px: «${p.trim().slice(0, 60)}»`);
}

// ── 6 · el andamio --doc-inset sigue en pie ────────────────────────────────
{
  // Los tres contextos NO viven en el mismo archivo: `.v-modal` declara su escalera en
  // HallazgosAcordeon. Contar solo la portada da 6 y parece un andamio a medio retirar.
  const conInsets = CSS + leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
  const decls = [...conInsets.matchAll(/--doc-inset-[0-2]\s*:/g)].length;
  if (decls < 9) {
    F(`6 · quedan ${decls} declaraciones de --doc-inset y hacen falta 9 (tres contextos × tres niveles). El camino de prosa vieja es PERMANENTE para 453 filas anónimas y lo sigue usando.`);
  }
}

// ── 7 · las cifras son tarjetas, no una tabla ─────────────────────────────
{
  const nums = reglaDe(".doc-r2 .nums", CIFRAS);
  const cell = reglaDe(".doc-r2 .num-cell", CIFRAS);
  if (!nums) F("7 · el grid de cifras no se reapunta: siguen siendo una tabla de filete");
  else {
    if (!/grid-template-columns:\s*repeat\(2,\s*1fr\)/.test(nums)) F("7 · las cifras no van a DOS columnas: a tres, la traducción de cada cifra no respira");
    if (!/gap:\s*11px/.test(nums)) F("7 · el gap entre tarjetas no es 11px");
    if (!/background:\s*none/.test(nums) || !/border:\s*0/.test(nums)) {
      F("7 · el grid conserva su fondo o su borde: son los que dibujan el filete de 1px que hace que las seis cifras se lean como una tabla");
    }
  }
  if (!cell) F("7 · la tarjeta de cifra no se reapunta");
  else {
    if (!/background:\s*var\(--card\)/.test(cell)) F("7 · la tarjeta de cifra no se apoya en --card");
    if (!/border-radius:\s*var\(--rad-s\)/.test(cell)) F("7 · la tarjeta de cifra no lleva el radio de 12px (--rad-s)");
    if (!/padding:\s*17px/.test(cell)) F("7 · el padding de la tarjeta de cifra no es 17px");
  }
}

// ── 8 · las tarjetas de cifra NO reaccionan ───────────────────────────────
{
  // No abren nada —«div.num-cell» sin onClick— y esa diferencia con la fila navegable ES
  // información (contrato §9). Una sombra o un hover les haría prometer un clic que no
  // existe, que es el error concreto que este invariante existe para cazar.
  if (/\.num-cell[^{]*:hover|\.num-cell[^{}]*\{[^}]*box-shadow/.test(CIFRAS)) {
    F("8 · la tarjeta de cifra ganó hover o sombra: no abre nada, así que estaría prometiendo un clic que no existe");
  }
  const SEIS = leer("src/components/analysis/shared/SeisCifras.tsx");
  if (/onClick/.test(SEIS.slice(0, SEIS.indexOf("nums-foot") === -1 ? SEIS.length : SEIS.indexOf("nums-foot")))) {
    F("8 · alguna celda de SeisCifras ganó onClick. Si las tarjetas tienen que abrir algo, eso es estructura y decisión de producto, no un hover.");
  }
  if (!/className="doc-lnk"/.test(SEIS)) F("8 · «Ver cómo se calcula» dejó de ser el enlace del contrato (.doc-lnk)");
}

// ── 9 · el móvil baja a una columna ───────────────────────────────────────
{
  const movil = CIFRAS.slice(CIFRAS.indexOf("max-width: 767px"));
  if (!CIFRAS.includes("max-width: 767px")) F("9 · el bloque de cifras no define su móvil");
  else if (!/grid-template-columns:\s*1fr/.test(movil)) F("9 · en móvil las cifras no bajan a UNA columna");
  else if (!/font-size:\s*25px/.test(movil)) F("9 · la cifra no baja a 25px en móvil");
}

// ── 10 · la zona: tres tarjetas, el arriendo PRIMERO ─────────────────────
{
  const orden = [...ZONA.matchAll(/className="zc-k">([^<]+)</g)].map((m) => m[1]);
  if (orden.length !== 3) F(`10 · la zona tiene ${orden.length} tarjetas y el contrato §8 pide 3`);
  else if (!/arriendo/i.test(orden[0])) {
    F(`10 · la primera tarjeta de zona es «${orden[0]}». El arriendo va PRIMERO: es el único dato tuyo que puede quedar peor que la referencia y es del que cuelga todo el análisis.`);
  }
  if (!/Ver los comparables/.test(ZONA)) F("10 · la zona no cierra con «Ver los comparables →» (contrato §8)");
  const cards = reglaDe(".doc-r2 .zona-cards", ZONACSS);
  if (!cards) F("10 · no existe la regla del grid de tarjetas de zona");
  else if (!/grid-template-columns:\s*repeat\(3,\s*1fr\)/.test(cards)) F("10 · las tarjetas de zona no van a tres columnas");
  const zc = reglaDe(".doc-r2 .zc", ZONACSS);
  if (!zc) F("10 · no existe la regla de la tarjeta de zona");
  // «mismo estilo que las cifras», dice el contrato: si divergen, son dos sistemas.
  else if (!/background:\s*var\(--card\)/.test(zc) || !/border-radius:\s*var\(--rad-s\)/.test(zc) || !/padding:\s*17px/.test(zc)) {
    F("10 · la tarjeta de zona dejó de compartir el estilo de la tarjeta de cifra (--card, --rad-s, 17px)");
  }
  // SOBRE TODO EL BLOQUE, no sobre el cuerpo de la primera regla: una sombra se agrega
  // en una regla APARTE, y mirando solo la primera el guard daba VERDE con la mutación
  // puesta. Es el mismo error que el tier de la escalera tuvo con `.v-modal`.
  for (const linea of ZONACSS.split("\n")) {
    if (!/\.zc[ {,]|\.zona-cards[ {,]/.test(linea)) continue;
    if (/box-shadow\s*:/.test(linea)) F(`10 · la tarjeta de zona ganó sombra: no abre nada, así que estaría prometiendo un clic que no existe — «${linea.trim().slice(0, 80)}»`);
    if (/:hover/.test(linea)) F(`10 · la tarjeta de zona ganó hover: no abre nada — «${linea.trim().slice(0, 80)}»`);
  }
}

// ── 11 · las píldoras: par direccional, y el SENTIDO de cada una ──────────
{
  for (const [clase, token] of [["zp-mal", "--signal-red"], ["zp-bien", "--up"]] as const) {
    const r = reglaDe(`.doc-r2 .${clase}`, ZONACSS);
    if (!r) { F(`11 · falta la píldora .${clase}`); continue; }
    if (!r.includes(`var(${token})`)) F(`11 · .${clase} no usa ${token}: el color direccional va por token, no hardcodeado`);
    if (!/12%/.test(r)) F(`11 · .${clase} no lleva el fondo al 12% que pide el contrato §8`);
  }
  if (!reglaDe(".doc-r2 .zp-neu", ZONACSS)) F("11 · falta la píldora neutra");
  // EL SENTIDO SE INVIERTE entre tarjetas y es lo más fácil de romper al refactorizar:
  // pagar MÁS por m² es peor y declarar un arriendo por ENCIMA de la mediana es el caso
  // exigente, pero valorizarse MÁS que el promedio es mejor.
  const senses = [...ZONA.matchAll(/(\w+)\s*>\s*0\s*\?\s*"(bien|mal)"/g)].map((m) => `${m[1]}:${m[2]}`);
  for (const esperado of ["brechaPct:mal", "desviacionPct:mal", "deltaPl:bien"]) {
    if (!senses.includes(esperado)) {
      F(`11 · el sentido de la píldora cambió: esperaba «${esperado}» y hay [${senses.join(", ")}]. En arriendo y m² MÁS es peor; en valorización MÁS es mejor.`);
    }
  }
}

// ── 12 · el caveat del período va en el pie COMÚN ─────────────────────────
{
  if (!/zona-caveat/.test(ZONA)) F("12 · no existe el pie común: el caveat del período es de las tres tarjetas, no de una");
  else if (ZONA.indexOf("zona-caveat") < ZONA.indexOf('className="zona-cards"')) {
    F("12 · el pie común va DEBAJO de las tres tarjetas, no arriba");
  }
  // NO ALCANZA CON QUE EXISTA EL NOMBRE: ponerlo en `false` deja el identificador y mata
  // la comparación. Lo que se fija es que COMPARE los dos períodos.
  if (!/pl\.rango\s*!==\s*pl\.rangoReferencia/.test(ZONA)) {
    F("12 · nadie compara el período de la comuna contra el del promedio Gran Santiago. Las 27 comunas con serie propia corren en TRES rangos y el promedio es 2014-2024: sin esto la píldora cruza períodos en silencio.");
  }
}

// ── 13 · el gate de JSX no se enciende solo, y las tres tarjetas degradan ──
{
  if (!/createContext<boolean>\(false\)/.test(CTX)) {
    F("13 · el contexto del rediseño dejó de tener default `false`. Con el default en la constante, el día que 4d la ponga en `true` STR se enciende solo — que es justo lo que el gate por modalidad evita.");
  }
  if (!/REDISENO_INFORME \|\| redisenoHeredado/.test(GRID)) {
    F("13 · el provider de SubjectCardGrid dejó de heredar. Sin el `|| heredado` pisa al de la ruta dev con la constante en `false` y `?rediseno=1` deja de encender la zona: medido, las tarjetas nuevas no montaban.");
  }
  // Las tres tienen que dibujarse con datos faltantes: de 1.447 filas LTR, 670 no tienen
  // mediana de arriendo y 314 no tienen hallazgo de sobreprecio.
  for (const rama of ["Sin arriendos publicados cerca", "Sin mediana comunal de venta", "no tiene serie propia"]) {
    if (!ZONA.includes(rama)) F(`13 · falta la degradación «${rama}»: la tarjeta tiene que decir que no hay dato, no callarse`);
  }
}

// ── 14 · el UF/m² de la zona va sin decimal, y los DOS con la misma regla ──
{
  // La referencia de los hallazgos ya lo decidió («UF 92 · med 94»): un decimal sobre
  // una mediana de N publicaciones es precisión falsa. La tarjeta usa UN solo
  // formateador para tu número y para la mediana, así que no pueden divergir — que es
  // el error concreto: redondear solo uno deja al lector comparando distinta escala.
  const REF = leer("src/components/analysis/referencia-hallazgo.ts");
  if (!/Math\.round\(x\)\.toLocaleString\("es-CL"\)/.test(REF)) {
    F("14 · la referencia de hallazgo dejó de redondear el UF/m²: la tarjeta de zona se alineó a ELLA, así que si cambia hay que decidir las dos juntas");
  }
  // DESDE EL COMPONENTE NUEVO, no desde el primer `fmtM2` del archivo: hay DOS, y el
  // primero es el de las celdas viejas, que conserva el decimal a propósito porque es
  // producción y no se mueve. Apuntando al primero el guard daba rojo con el árbol sano.
  const r2 = ZONA.indexOf("export function ZonaCeldasLtrR2");
  const desde = r2 === -1 ? -1 : ZONA.indexOf("const fmtM2 =", r2);
  const fm = desde === -1 ? "" : ZONA.slice(desde, ZONA.indexOf("const fmtArr =", desde));
  if (!fm) F("14 · no se encontró el formateador de UF/m² de la tarjeta de zona");
  else if (/pct1\(/.test(fm) || !/Math\.round\(/.test(fm)) {
    F(`14 · el UF/m² de la tarjeta volvió al decimal: «${fm.replace(/\s+/g, " ").slice(0, 90)}». Sobre una mediana de N publicaciones es precisión falsa.`);
  }
  // Y que siga siendo UNO solo para las dos cifras: si aparece un segundo formateador
  // de m², tu número y la mediana pueden salir con reglas distintas.
  // También acotado al componente nuevo: contando todo el archivo, las celdas viejas
  // aportan sus propias llamadas y el conteo nunca baja de 2 aunque la tarjeta nueva
  // saque la suya. Medido: con la mutación puesta el guard daba verde.
  const cuerpoR2 = r2 === -1 ? "" : ZONA.slice(r2);
  const usos = [...cuerpoR2.matchAll(/fmtM2\(/g)].length;
  if (usos < 2) F(`14 · la tarjeta de m² usa el formateador ${usos} vez/veces: tu valor y la mediana tienen que pasar por el MISMO, o el lector compara cifras de distinta escala`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runEstructuraRedisenoTier(): { hard: number } {
  console.log("\n─── TIER ESTRUCTURA-REDISEÑO (contrato §2, §6 y §8 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — una sola caja (el hero), la alternancia muerta con la especificidad resuelta, el marco sin sombra en las dos formas del selector, 38/34 px de separación, 700 px de ancho, el andamio --doc-inset en pie, las cifras como tarjetas de dos columnas que no reaccionan, y la zona con el arriendo primero, las píldoras en el par direccional y el caveat del período en el pie común");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runEstructuraRedisenoTier();
  process.exit(hard ? 1 : 0);
}
