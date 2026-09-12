// ============================================================================
// GOLDEN · RADIOS, SOMBRA Y AFFORDANCE — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §1 y §9.
//
// Fija SEIS cosas:
//
//   1. LA ESCALA DE RADIOS ESTÁ COMPLETA — los cuatro del contrato más `--rad-bar`,
//      que el contrato no tenía y que existe por una razón medida: 19 de las 52
//      declaraciones del informe son tracks de barra de 6 a 16 px de alto, y un radio
//      de 12 sobre una barra de 14 la convierte en píldora.
//
//   2. LOS RADIOS ESTÁN ORDENADOS Y SON DISTINTOS: bar < xs < s < rad. Si dos
//      coinciden, la escala dejó de ser una escala y alguien va a elegir al azar.
//
//   3. LAS BARRAS NO SE MAPEAN A LA ESCALA DE TARJETAS. Ninguna regla del bloque
//      apunta un track a `--rad-s` ni a `--rad-xs`. Es el error concreto que este
//      tier existe para cazar, porque se ve «prolijo» y arruina la lectura del dato.
//
//   4. LA REGLA DE SOMBRA: solo las dos cajas y el hover de la fila navegable. Ninguna
//      otra pieza del bloque del rediseño lleva `box-shadow`. Las tarjetas de cifra y
//      de zona no reaccionan porque no abren nada, y una sombra las haría prometer un
//      clic que no existe.
//
//   5. EL FOCO NO ES OPCIONAL. Las tres primitivas declaran `:focus-visible`. Es lo
//      que una reescritura de la parte 4 puede perder sin que se note: el hover no
//      existe en teclado ni en táctil, y `.hall-head` ya lo tenía desde antes.
//
//   6. `prefers-reduced-motion` APAGA LAS TRANSFORMACIONES. El botón que baja 1 px y
//      la fila que levanta 1 px son movimiento, y el contrato lo pide explícito para
//      el punto que late del hero.
//
// Corre dentro del QUICK (tier "radios-sombras") y standalone:
//   node --import tsx scripts/eval/golden/radios-sombras-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };
const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");

/** El bloque del rediseño: de la primera sección marcada hasta el cierre del style. */
const BLOQUE = (() => {
  const i = CSS.indexOf("REDISEÑO · LAS TRES PRIMITIVAS");
  const j = CSS.indexOf("REDISEÑO · PALETA");
  return i === -1 || j === -1 ? "" : CSS.slice(Math.min(i, j) - 200, Math.max(i, j) + 6000);
})();

// ── 1 · la escala está completa ────────────────────────────────────────────
const RADIOS = ["rad", "rad-s", "rad-xs", "rad-pill", "rad-bar"] as const;
const valores: Record<string, number> = {};
for (const r of RADIOS) {
  const m = CSS.match(new RegExp(`--${r}\\s*:\\s*(\\d+)px`));
  if (!m) F(`1 · falta --${r}: la escala de radios tiene un hueco`);
  else valores[r] = Number(m[1]);
}

// ── 2 · ordenados y distintos ──────────────────────────────────────────────
{
  const orden: (typeof RADIOS)[number][] = ["rad-bar", "rad-xs", "rad-s", "rad"];
  for (let i = 0; i < orden.length - 1; i++) {
    const a = valores[orden[i]], b = valores[orden[i + 1]];
    if (a === undefined || b === undefined) continue;
    if (a >= b) F(`2 · --${orden[i]} (${a}px) tiene que ser MENOR que --${orden[i + 1]} (${b}px): si no, la escala no es una escala`);
  }
  if (valores["rad-pill"] !== undefined && valores["rad-pill"] < 90) {
    F(`2 · --rad-pill vale ${valores["rad-pill"]}px y tiene que ser una píldora (99px)`);
  }
}

// ── 3 · las barras no se mapean a la escala de tarjetas ────────────────────
{
  const BARRAS = /\.(bar-track|bar-fill|cmp-track|cmp-fill|esc-track|esc-fill|par-track|par-fill|cien-track|compo-track|compo-sw|ba-sw|fbar|dial-track|dial-mark|thermo-track|mz-cell|pal-delta)\b/;
  for (const linea of BLOQUE.split("\n")) {
    if (!/border-radius:\s*var\(--rad-s\)|border-radius:\s*var\(--rad-xs\)|border-radius:\s*var\(--rad\)/.test(linea)) continue;
    if (BARRAS.test(linea)) {
      F(`3 · una barra se mapeó a la escala de tarjetas: «${linea.trim().slice(0, 100)}». Un track de 14 px con radio 12 es una píldora, no una escala.`);
    }
  }
}

// ── 4 · la regla de sombra ─────────────────────────────────────────────────
{
  const PERMITIDAS = /\.doc-btn|\.fila-nav|\.caja|--sombra/;
  for (const linea of BLOQUE.split("\n")) {
    // `box-shadow:` DECLARADO. Una `transition:...box-shadow...` no pinta nada — la
    // primera versión de este guard las contaba y daba dos falsos positivos.
    if (!/box-shadow\s*:/.test(linea)) continue;
    if (/transition\s*:[^;}]*box-shadow/.test(linea) && !/box-shadow\s*:\s*(var|0|inset|rgba|#)/.test(linea)) continue;
    if (/inset/.test(linea)) continue; // un anillo inset es un borde, no una sombra
    if (!PERMITIDAS.test(linea)) {
      F(`4 · sombra fuera de las piezas permitidas: «${linea.trim().slice(0, 100)}». El contrato deja sombra solo en las dos cajas y en el hover de la fila navegable.`);
    }
  }
  for (const prohibida of [".num-cell", ".zona-cells", ".hz-lin"]) {
    const re = new RegExp(`\\.doc-dictamen[^{]*\\${prohibida}[^{]*\\{[^}]*box-shadow`);
    if (re.test(BLOQUE)) {
      F(`4 · ${prohibida} lleva sombra: no reacciona porque no abre nada, y una sombra le hace prometer un clic que no existe`);
    }
  }
}

// ── 5 · el foco de las tres primitivas ─────────────────────────────────────
for (const prim of [".doc-btn", ".doc-lnk", ".fila-nav"]) {
  const re = new RegExp(`\\.doc-dictamen \\${prim}:focus-visible`);
  if (!re.test(CSS)) F(`5 · ${prim} no declara :focus-visible. El hover no existe en teclado ni en táctil.`);
}
if (!/\.hall-head:focus-visible/.test(leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx"))) {
  F("5 · .hall-head perdió su :focus-visible, que tenía desde antes del rediseño");
}

// ── 6 · reduced motion ─────────────────────────────────────────────────────
{
  const i = BLOQUE.indexOf("prefers-reduced-motion");
  if (i === -1) F("6 · el bloque del rediseño no apaga las transformaciones con prefers-reduced-motion");
  else {
    const trozo = BLOQUE.slice(i, i + 400);
    if (!/transform:\s*none/.test(trozo)) F("6 · prefers-reduced-motion no anula los `transform`, que son los que marean");
  }
}

// ── 7 · el enlace no dibuja DOS flechas ──────────────────────────────────
{
  // Los tres usos de «.doc-lnk» ya traen la flecha en su propio texto —«Ver cómo se
  // calcula →», «Ver los comparables →»—, así que un «::after» que la agrega dibuja dos.
  // Medido en el DOM del informe encendido: textContent «Ver cómo se calcula →» y
  // ::after content "→", en los dos enlaces de la página.
  //
  // LA QUE SE VA ES LA DEL PSEUDO-ELEMENTO, NO LA DEL TEXTO. Por eso el invariante tiene
  // dos mitades: que el «::after» no la ponga, y que el texto siga trayéndola — si
  // alguien «arregla» el doble sacándola del texto, el enlace queda sin ninguna.
  //
  // LA UNIDAD ES LA FRASE, NO LA LÍNEA. En ZonaLtr el rótulo vive en un ternario junto
  // a «Explorar →», así que una línea que conserva UNA flecha no prueba que la conserve
  // ESTE rótulo: con la línea como unidad, la mutación que se la saca daba verde.
  const m = CSS.match(/\.doc-dictamen \.doc-lnk::after\{([^}]*)\}/);
  if (m && /content:\s*"[^"]*[→›»>]/.test(m[1])) {
    F(`7 · «.doc-dictamen .doc-lnk::after» volvió a poner una flecha ({${m[1]}}). Los tres usos ya la traen en su texto: el pseudo-elemento dibuja la SEGUNDA.`);
  }
  const usos: [string, string][] = [
    ["src/components/analysis/shared/SeisCifras.tsx", "Ver cómo se calcula"],
    ["src/components/analysis/zona/ZonaLtr.tsx", "Ver los comparables"],
  ];
  for (const [ruta, frase] of usos) {
    const txt = leer(ruta);
    if (!txt.includes(frase)) F(`7 · desapareció «${frase}» de ${ruta}`);
    else if (!txt.includes(`${frase} →`)) {
      F(`7 · «${frase}» perdió la flecha de su propio texto en ${ruta}. La que se retiró es la del ::after; sin la del texto el enlace queda sin ninguna.`);
    }
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRadiosSombrasTier(): { hard: number } {
  console.log("\n─── TIER RADIOS-SOMBRAS (contrato §1 y §9 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — escala de radios completa y ordenada, las barras fuera de la escala de tarjetas, sombra solo donde el contrato la deja, foco en las tres primitivas y reduced-motion");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRadiosSombrasTier();
  process.exit(hard ? 1 : 0);
}
