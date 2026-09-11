// ============================================================================
// GOLDEN · EL HERO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §3.
//
// EL HERO DEL CONTRATO ES LA PORTADA, no la sección que el código llama «hero». §3 lista
// eyebrow, botón de veredicto, score, titular con plumón y cifra clave: eso es
// `.doc-portada`. Lo que el código llama `id="hero"` es la prosa IA y la recomendación.
//
// Fija SEIS cosas:
//
//   1. EL FILTRO VIVE EN UNA CAPA APARTE. `filter` crea contexto de apilado y afecta a
//      todo el subárbol: sobre la sección se comería el titular y el botón. Es el
//      invariante que una reescritura «para simplificar» rompe sin que se note en el
//      shot de un solo veredicto.
//
//   2. EL FONDO NO DEPENDE DEL VEREDICTO. Ni `--verdict` ni `data-verdict` entran al
//      degradado: es el mismo espectro para los tres. La tríada vive en el botón.
//
//   3. EL GRANO, CON SU NÚMERO MEDIDO. `overlay` al .16 = 1,94% de amplitud relativa,
//      medido por diferencia contra el mismo árbol con el grano apagado. El valor
//      anterior del contrato —.12— daba 1,53%, y el .05 que se probó daba 0,83%.
//
//   4. EL PUNTO QUE LATE SE APAGA CON `prefers-reduced-motion`. Es lo único del
//      contrato marcado como OBLIGATORIO, y es exactamente lo que se pierde al mover
//      una animación de lugar.
//
//   5. EL PLUMÓN BLANCO NO REPUNTA `--doc-hl`. Ese token lo usan además las marcas de
//      prosa de las secciones, que van sobre PAPEL: en blanco serían invisibles.
//
//   6. LA BANDA NO SE BORRA. `PortadaInforme` lo monta también STR, así que la banda
//      sigue en el archivo y solo deja de montarse con el interruptor.
//
// Corre dentro del QUICK (tier "hero-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/hero-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const GRID = leer("src/components/analysis/SubjectCardGrid.tsx");
const HERO = leer("src/components/analysis/HeroLTR.tsx");

/** El bloque §3, del abre-comentario que lo rotula hasta el encabezado siguiente, y sin
 *  comentarios: los comentarios llevan comas y se cuelan en el listado de selectores. */
const BLOQUE = (() => {
  const marca = CSS.indexOf("REDISEÑO · EL HERO");
  if (marca === -1) return "";
  const i = CSS.lastIndexOf("/*", marca);
  const j = CSS.indexOf("═══ REDISEÑO ·", marca);
  return CSS.slice(i, j === -1 ? i + 6000 : j).replace(/\/\*[\s\S]*?\*\//g, "");
})();
if (!BLOQUE) F("0 · no existe el bloque «REDISEÑO · EL HERO» en la portada");

/** El cuerpo de la regla cuyo listado de selectores contenga exactamente `sel`. */
function reglaDe(sel: string): string | null {
  for (const m of BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.includes(sel)) return m[2];
  }
  return null;
}

// ── 1 · el filtro va en la capa de fondo, nunca en el hero ────────────────
{
  const bg = reglaDe(".doc-r2 .doc-hero-bg");
  if (!bg) F("1 · no existe la capa de fondo del hero");
  else {
    if (!/filter:\s*brightness\(1\.10\)\s*saturate\(\.90\)/.test(bg)) F("1 · la capa de fondo perdió el filtro del contrato");
    if (!/position:\s*absolute/.test(bg)) F("1 · la capa de fondo dejó de ser absoluta: tiene que ir DETRÁS del contenido, no envolverlo");
  }
  // POR REGLA, NO POR LÍNEA: una declaración puede ir en un renglón distinto al del
  // selector, y escaneando líneas el guard acusaba a la propia capa de fondo. Recorre
  // todas las reglas del bloque y mira el SELECTOR de la que declara el filtro.
  for (const m of BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/filter\s*:/.test(m[2])) continue;
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.every((s) => s.endsWith(".doc-hero-bg"))) continue;
    F(`1 · hay un «filter» fuera de la capa de fondo, en «${sels.join(", ").slice(0, 80)}». Crea contexto de apilado y afecta a TODO el subárbol — se come el titular y el botón.`);
  }
}

// ── 2 · el fondo no depende del veredicto ─────────────────────────────────
{
  const bg = reglaDe(".doc-r2 .doc-hero-bg") ?? "";
  if (/var\(--verdict/.test(bg)) F("2 · el fondo del hero pasó a depender del veredicto. §3: es el mismo espectro siempre; la tríada vive en el botón.");
  if (!/#0F2440[\s\S]*#2E1C28[\s\S]*#4E1119/.test(bg)) F("2 · el espectro del fondo no es el del contrato (#0F2440 → #2E1C28 → #4E1119)");
  // Y el botón SÍ lo lleva: si los dos dejan de usarlo, el veredicto deja de tener color.
  const pill = reglaDe(".doc-r2 .doc-hero-pill") ?? "";
  if (!/background:\s*var\(--verdict\)/.test(pill)) F("2 · el botón dejó de pintarse con --verdict: es la única pieza del hero que lleva el color del veredicto");
  if (!/box-shadow:0 0 0 2px rgba\(255,255,255,\.3\)/.test(pill.replace(/\s*:\s*/g, ":"))) F("2 · el botón perdió el anillo blanco de 2 px del contrato");
}

// ── 3 · el grano, con su número ───────────────────────────────────────────
{
  const OPACIDAD = "0.16"; // 1,94% de amplitud relativa, medido sobre el espectro
  const gr = reglaDe(".doc-r2 .doc-hero-grain");
  if (!gr) F("3 · no existe la capa de grano del hero");
  else {
    const m = gr.match(/opacity:\s*\.?(\d+)/);
    const val = m ? (gr.match(/opacity:\s*(\.\d+|0?\.\d+|\d+)/)?.[1] ?? "") : "";
    const norm = val.startsWith(".") ? "0" + val : val;
    if (norm !== OPACIDAD) {
      F(`3 · el grano está en «${val || "?"}» y el valor medido es ${OPACIDAD}. Overlay .16 da 1,94% de amplitud; .12 daba 1,53% y .05 daba 0,83%. Si se cambia, se mide de nuevo y se cambia acá.`);
    }
    if (!/mix-blend-mode:\s*overlay/.test(gr)) F("3 · el grano dejó de usar «overlay», que es el modo del contrato");
    if (!/background-image:\s*var\(--doc-grain\)/.test(gr)) F("3 · el grano dejó de salir del token --doc-grain");
  }
}

// ── 4 · reduced-motion apaga el punto que late ────────────────────────────
{
  if (!/@keyframes docHeroLate/.test(BLOQUE)) F("4 · no existe la animación del punto que late");
  const i = BLOQUE.indexOf("prefers-reduced-motion");
  if (i === -1) F("4 · el bloque del hero no apaga el latido con prefers-reduced-motion. El contrato lo marca OBLIGATORIO: el punto late para siempre en la cara de alguien que pidió que nada se mueva.");
  else {
    const trozo = BLOQUE.slice(i, i + 300);
    if (!/doc-hero-dot/.test(trozo) || !/animation:\s*none/.test(trozo)) {
      F("4 · el bloque de prefers-reduced-motion ya no anula la animación del punto");
    }
  }
}

// ── 5 · el plumón blanco no repunta el token global ───────────────────────
{
  const mk = reglaDe(".doc-r2 .doc-hero .doc-headline mark");
  if (!mk) F("5 · el titular del hero no declara su plumón");
  else if (!/rgba\(255,255,255,\.26\)/.test(mk.replace(/\s/g, ""))) F("5 · el plumón del titular no es blanco al 26%");
  for (const linea of BLOQUE.split("\n")) {
    if (/--doc-hl\s*:/.test(linea)) {
      F(`5 · «--doc-hl» se repunta en el bloque del hero: «${linea.trim().slice(0, 80)}». Ese token lo usan también las marcas de prosa de las secciones, que van sobre PAPEL — en blanco serían invisibles.`);
    }
  }
}

// ── 6 · la banda no se borra, y los hallazgos salieron del hero ───────────
{
  if (!/doc-banda-band/.test(CSS)) {
    F("6 · la banda se borró del archivo. `PortadaInforme` lo monta también STR: la banda se deja de MONTAR con el interruptor, no se retira.");
  }
  if (!/rediseno \?[\s\S]{0,400}doc-hero-pill/.test(CSS)) F("6 · el botón dejó de estar detrás del interruptor: STR se llevaría el cambio puesto");
  // Los hallazgos son sección suelta (§2, §4) y su título es la línea que declara (§10).
  // DESDE EL ORDEN (11-sep): la sección la sigue ARMANDO el grid —es quien tiene la
  // lista y sus gates— pero se la pasa a `HeroLTR` por la prop `hallazgos`, que la monta
  // entre el hero y la recomendación. Lo que se fija es que exista y cómo se titula, no
  // dónde queda el JSX; el orden lo fija el invariante 17 del tier de estructura.
  const slot = GRID.slice(GRID.indexOf("hallazgos={"), GRID.indexOf("prosaError="));
  if (!/rediseno && !\(!prosa && loading\) && hallazgosOrdenados\.length > 0/.test(slot)) {
    F("6 · la sección suelta de hallazgos dejó de montarse con el rediseño (contrato §2 y §4)");
  }
  if (!/titulo=\{dosBloques \? lineaQueDeclara\(veredicto\)/.test(slot)) {
    F("6 · la sección de hallazgos dejó de titularse con la línea que declara (§10)");
  }
  if (!/!rediseno && dosBloques && hallazgosOrdenados\.length > 0/.test(GRID)) {
    F("6 · el hero volvió a recibir las filas de hallazgo: con el rediseño van a su propia sección");
  }
  if (!/!\(rediseno && dosBloques\)/.test(HERO)) {
    F("6 · HeroLTR volvió a dibujar su h2. La línea que declara se fue con las filas: acá quedaría repetida y encabezando algo que no está.");
  }
}

// ── 7 · la regla de apilado no rompe «.sr-only» ──────────────────────────
{
  // «.sr-only» se esconde con «clip», y «clip» SOLO aplica a elementos posicionados en
  // absoluto. La regla que sube el contenido sobre el grano les forzaba
  // «position:relative», y la copia del titular para lectores de pantalla se volvía
  // VISIBLE debajo de la caja. Salió en los primeros shots de 4b, no en el DOM.
  const apila = [...BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    (m) => /position:\s*relative/.test(m[2]) && /z-index:\s*2/.test(m[2]) && /doc-hero\s*>/.test(m[1]),
  );
  if (!apila) F("7 · no existe la regla que sube el contenido del hero sobre el grano");
  else if (!/:not\(\.sr-only\)/.test(apila[1])) {
    F("7 · la regla de apilado del hero volvió a alcanzar a «.sr-only». Le fuerza «position:relative», y sin «absolute» el «clip» no esconde nada: la copia del titular para lectores de pantalla se dibuja.");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runHeroRedisenoTier(): { hard: number } {
  console.log("\n─── TIER HERO-REDISEÑO (contrato §3 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el filtro en su capa, el espectro sin veredicto y el botón con él, el grano en .16 overlay, el latido apagado por reduced-motion, el plumón blanco sin tocar --doc-hl, la banda en el archivo con los hallazgos ya sueltos, y la regla de apilado sin romper el .sr-only");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runHeroRedisenoTier();
  process.exit(hard ? 1 : 0);
}
