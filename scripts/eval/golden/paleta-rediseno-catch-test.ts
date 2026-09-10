// ============================================================================
// GOLDEN · LA PALETA DEL REDISEÑO — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §1.
// Tres superficies —page, card, sunk— más las líneas, en los dos temas.
//
// Este tier mide la ESCALA, no la lista de hexes. Un test que compare los valores
// contra una copia de la tabla del contrato solo prueba que alguien copió bien: se
// rompe cuando el contrato cambia y no dice nada sobre si la escala funciona. Lo que
// hay que fijar es la propiedad — que cada superficie se distinga de la siguiente y
// que las líneas se vean sobre la superficie que les toca.
//
// Fija CINCO cosas:
//
//   1. LA ESCALA ESTÁ COMPLETA en los dos temas: page, card, sunk, line, line2 y
//      line-sunk, sin huecos.
//
//   2. CADA PAR ADYACENTE DE SUPERFICIE SE DISTINGUE, medido en ΔL* (claridad
//      perceptual, que es uniforme; el ratio de contraste no lo es en los extremos).
//      Piso 2,0 — bajo 1,0 un borde de área grande es invisible.
//
//   3. CADA LÍNEA SE VE SOBRE LA SUPERFICIE QUE LE TOCA. Es la razón de existir de
//      `--line-sunk`: `--line` contra `--sunk` da ΔL* 0,70 en claro y 0,04 en oscuro
//      —un punto del canal azul— y el separador desaparece. Si alguien vuelve a apuntar
//      esas reglas a `--line`, esto lo caza.
//
//   4. LA DIRECCIÓN DE LA LÍNEA SIGUE AL TEMA: sobre una superficie, la línea es más
//      oscura en claro y más clara en oscuro. Al revés se lee como una ranura.
//
//   5. EL SEMÁFORO DEL DATO NO SE REAPUNTA A LA TRÍADA. `--doc-good`, `--doc-warn` y
//      `--doc-neutral` miden un dato contra un umbral; la tríada nombra un veredicto.
//      Confundirlos fue el error que el goal de la tríada vino a arreglar, y el
//      rediseño no lo re-litiga.
//
// Corre dentro del QUICK (tier "paleta-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/paleta-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const CSS = (() => {
  try { return readFileSync(join(RAIZ, "src/components/analysis/portada/PortadaInforme.tsx"), "utf8"); } catch { return ""; }
})();

const PISO = 2.0;
const TOKENS = ["page", "card", "sunk", "line", "line2", "line-sunk"] as const;
type Tok = (typeof TOKENS)[number];

/** Los valores del bloque del rediseño, por tema. El claro vive tras el selector
 *  `[data-theme="light"] .doc-r2`; lo anterior es el oscuro. */
function paleta(): { oscuro: Record<string, string>; claro: Record<string, string> } {
  const ini = CSS.indexOf("REDISEÑO · PALETA");
  const corte = CSS.indexOf('[data-theme="light"] .doc-r2', ini);
  const fin = CSS.indexOf("REDISEÑO · TIPOGRAFÍA", ini);
  const sacar = (txt: string) => {
    const out: Record<string, string> = {};
    for (const m of txt.matchAll(/--(page|card|sunk|line2|line-sunk|line)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
      if (!out[m[1]]) out[m[1]] = m[2].toUpperCase();
    }
    return out;
  };
  if (ini === -1 || corte === -1) return { oscuro: {}, claro: {} };
  return { oscuro: sacar(CSS.slice(ini, corte)), claro: sacar(CSS.slice(corte, fin === -1 ? undefined : fin)) };
}

const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
function Lstar(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

const P = paleta();

// ── 1 · la escala está completa ────────────────────────────────────────────
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  for (const t of TOKENS) {
    if (!toks[t]) F(`1 · falta --${t} en ${tema}: la escala tiene un hueco`);
  }
}

// ── 2 · las superficies se distinguen entre sí ─────────────────────────────
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  const esc: Tok[] = ["page", "card", "sunk"];
  for (let i = 0; i < esc.length - 1; i++) {
    const a = toks[esc[i]], b = toks[esc[i + 1]];
    if (!a || !b) continue;
    const d = Math.abs(Lstar(b) - Lstar(a));
    if (d < PISO) F(`2 · ${tema}: ${esc[i]}→${esc[i + 1]} da ΔL*=${d.toFixed(2)}, bajo el piso de ${PISO}`);
  }
}

// ── 3 · cada línea se ve sobre la superficie que le toca ───────────────────
// `--line` sirve sobre page y card. Sobre sunk va `--line-sunk`, y por eso existe.
const PARES: [Tok, Tok][] = [["line", "page"], ["line", "card"], ["line-sunk", "sunk"], ["line2", "card"]];
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  for (const [linea, fondo] of PARES) {
    const a = toks[linea], b = toks[fondo];
    if (!a || !b) continue;
    const d = Math.abs(Lstar(a) - Lstar(b));
    if (d < PISO) F(`3 · ${tema}: --${linea} sobre --${fondo} da ΔL*=${d.toFixed(2)} — un separador que no se ve no es un separador`);
  }
  // Y el caso que motivó el token: `--line` sobre `--sunk` NO se usa, pero si alguien
  // lo hace tiene que quedar claro que no sirve.
  const l = toks["line"], s = toks["sunk"];
  if (l && s && Math.abs(Lstar(l) - Lstar(s)) >= PISO) {
    F(`3 · ${tema}: --line ya se distingue de --sunk (ΔL*=${Math.abs(Lstar(l) - Lstar(s)).toFixed(2)}). Si eso es a propósito, --line-sunk sobra y hay que retirarlo con acta.`);
  }
}

// ── 4 · la dirección de la línea sigue al tema ─────────────────────────────
{
  const c = P.claro, o = P.oscuro;
  if (c["line-sunk"] && c["sunk"] && Lstar(c["line-sunk"]) >= Lstar(c["sunk"])) {
    F("4 · claro: --line-sunk tiene que ser MÁS OSCURA que --sunk; más clara se lee como una ranura");
  }
  if (o["line-sunk"] && o["sunk"] && Lstar(o["line-sunk"]) <= Lstar(o["sunk"])) {
    F("4 · oscuro: --line-sunk tiene que ser MÁS CLARA que --sunk; más oscura se lee como una ranura");
  }
}

// ── 5 · el semáforo del dato no se reapunta a la tríada ────────────────────
{
  const bloque = CSS.slice(CSS.indexOf("REDISEÑO · PALETA"), CSS.indexOf("REDISEÑO · TIPOGRAFÍA"));
  for (const t of ["--doc-good", "--doc-warn", "--doc-neutral"]) {
    if (new RegExp(`${t}\\s*:`).test(bloque)) {
      F(`5 · ${t} se reapunta en el bloque del rediseño. El semáforo del dato mide un dato contra un umbral y la tríada nombra un veredicto: son sistemas distintos y confundirlos fue el error que el goal de la tríada arregló.`);
    }
  }
  if (/--verdict\s*:/.test(bloque)) {
    F("5 · la tríada del veredicto se redefine en el bloque de la paleta. §0 del contrato: la tríada Tinta no cambia.");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPaletaRedisenoTier(): { hard: number } {
  console.log("\n─── TIER PALETA-REDISEÑO (contrato §1 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — escala completa en los dos temas, superficies distinguibles, cada línea se ve sobre la suya, la dirección sigue al tema y el semáforo del dato queda intacto");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPaletaRedisenoTier();
  process.exit(hard ? 1 : 0);
}
