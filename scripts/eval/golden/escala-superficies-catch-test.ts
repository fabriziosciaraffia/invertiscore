// ============================================================================
// GOLDEN · LA ESCALA DE SUPERFICIES — catch-test del andamio (10-sep-2026). 0 tokens.
// ============================================================================
// El informe alterna el papel de sus secciones, y la alternancia se INVIERTE entre la
// prosa v21+ y el camino viejo (`SubjectCardGrid.tsx`: `dosBloques ? "paper" : "paper2"`).
// El camino viejo no es transitorio: es permanente para 453 filas anónimas que no
// regeneran. Así que una pieza interior que pide `--doc-paper2` a mano contrasta en una
// alternancia y se apila en la otra, y no hay forma de elegir bien el token.
//
// El andamio lo resuelve por construcción: cada contenedor declara su propia escalera
// —`--doc-inset-0/1/2`— y las piezas piden «un escalón adentro» sin saber de qué tono
// parten. Este tier fija que la escalera exista, que esté completa y que ningún escalón
// caiga sobre otro del mismo valor.
//
// Fija CINCO cosas:
//
//   1. LA ESCALERA ESTÁ COMPLETA en los tres contextos que la declaran (`.doc-sec`,
//      `.doc-sec.p2` y `.v-modal`): los tres niveles definidos, sin huecos.
//
//   2. NINGÚN ESCALÓN CAE SOBRE OTRO DEL MISMO VALOR. Se resuelve la escalera a hexes
//      reales, por tema, y se compara. Es el invariante que da nombre al goal: una
//      superficie sobre otra del mismo valor computado es una superficie que no existe.
//
//   3. CADA PAR ADYACENTE SE DISTINGUE, medido en ΔL* (claridad perceptual, que es
//      uniforme; el ratio de contraste no lo es en el extremo claro ni en el oscuro).
//      Piso: ΔL* ≥ 2,0 — bajo 1,0 un borde de área grande es invisible.
//
//   4. EL CUARTO NIVEL EXISTE en los dos temas. Sin él una sección `p2` se queda con un
//      solo escalón hacia adentro y la escalera miente en la mitad de las secciones.
//
//   5. NINGUNA PIEZA MIGRADA VUELVE A PEDIR EL TOKEN GLOBAL, y el selector muerto
//      `.doc-sec--paper2` no vuelve: era el intento anterior de resolver por contexto y
//      nunca lo emitió nadie, así que lleva meses sin hacer nada.
//
// Corre dentro del QUICK (tier "escala-superficies") y standalone:
//   node --import tsx scripts/eval/golden/escala-superficies-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const PORTADA = "src/components/analysis/portada/PortadaInforme.tsx";
const TOKENS_SHARED = "src/components/analysis/shared/TokensShared.tsx";
const ACORDEON = "src/components/analysis/hallazgos/HallazgosAcordeon.tsx";

const css = leer(PORTADA);
/** `.v-modal` declara su hoja en HallazgosAcordeon, no en la portada: la escalera se
 *  busca en las dos, porque los contenedores que la declaran viven en archivos distintos. */
const cssTodo = [css, leer(ACORDEON)].join("\n");

/** Los hexes de los tokens de papel, por tema. El bloque claro vive tras
 *  `[data-theme="light"]`, así que se parte el archivo por ese marcador. */
function tokensDePapel(): { oscuro: Record<string, string>; claro: Record<string, string> } {
  const corte = css.indexOf('[data-theme="light"] .doc-dictamen');
  const partes = corte === -1 ? [css, ""] : [css.slice(0, corte), css.slice(corte)];
  const sacar = (txt: string) => {
    const out: Record<string, string> = {};
    for (const m of txt.matchAll(/--doc-(paper[0-9]?)\s*:\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2].toUpperCase();
    return out;
  };
  return { oscuro: sacar(partes[0]), claro: sacar(partes[1]) };
}

/** La escalera declarada por un contexto: `--doc-inset-N: var(--doc-paperM)`. */
function escaleraDe(selector: string): Record<string, string> {
  // El bloque del selector, hasta la llave de cierre.
  const i = cssTodo.indexOf(selector + "{");
  if (i === -1) return {};
  const j = cssTodo.indexOf("}", i);
  const bloque = cssTodo.slice(i, j === -1 ? undefined : j);
  const out: Record<string, string> = {};
  for (const m of bloque.matchAll(/--doc-inset-([0-2])\s*:\s*var\(\s*(--doc-paper[0-9]?)\s*\)/g)) {
    out[m[1]] = m[2].replace("--doc-", "");
  }
  return out;
}

const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
function Lstar(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

const PISO_DELTA_L = 2.0;
const CONTEXTOS = [".doc-sec", ".doc-sec.p2", ".v-modal"];

// ── 1 · la escalera está completa ──────────────────────────────────────────
const escaleras: Record<string, Record<string, string>> = {};
for (const ctx of CONTEXTOS) {
  const e = escaleraDe(ctx);
  escaleras[ctx] = e;
  for (const n of ["0", "1", "2"]) {
    if (!e[n]) F(`1 · ${ctx} no declara --doc-inset-${n}: la escalera tiene un hueco`);
  }
}

// ── 4 · el cuarto nivel existe en los dos temas ────────────────────────────
const papel = tokensDePapel();
for (const [tema, toks] of [["oscuro", papel.oscuro], ["claro", papel.claro]] as const) {
  if (!toks["paper4"]) {
    F(`4 · falta --doc-paper4 en ${tema}: una sección p2 se queda con un solo escalón hacia adentro`);
  }
}

// ── 2 y 3 · ningún escalón cae sobre otro, y cada par se distingue ─────────
for (const ctx of CONTEXTOS) {
  const e = escaleras[ctx];
  if (!e["0"] || !e["1"] || !e["2"]) continue; // ya reportado en 1
  for (const [tema, toks] of [["oscuro", papel.oscuro], ["claro", papel.claro]] as const) {
    const hexes = ["0", "1", "2"].map((n) => ({ n, tok: e[n], hex: toks[e[n]] }));
    const falta = hexes.find((x) => !x.hex);
    if (falta) { F(`2 · ${ctx} · ${tema}: --doc-inset-${falta.n} apunta a --doc-${falta.tok}, que no existe en ese tema`); continue; }
    for (let i = 0; i < hexes.length; i++) {
      for (let j = i + 1; j < hexes.length; j++) {
        if (hexes[i].hex === hexes[j].hex) {
          F(`2 · ${ctx} · ${tema}: inset-${hexes[i].n} e inset-${hexes[j].n} son el MISMO valor (${hexes[i].hex}) — una superficie sobre otra igual no existe`);
        }
      }
    }
    for (let i = 0; i < hexes.length - 1; i++) {
      const d = Math.abs(Lstar(hexes[i + 1].hex) - Lstar(hexes[i].hex));
      if (d < PISO_DELTA_L) {
        F(`3 · ${ctx} · ${tema}: inset-${hexes[i].n}→inset-${hexes[i + 1].n} da ΔL*=${d.toFixed(2)}, bajo el piso de ${PISO_DELTA_L}`);
      }
    }
  }
}

// ── 5 · las piezas migradas no vuelven al token global ─────────────────────
{
  const acordeon = leer(ACORDEON);
  const vCierre = acordeon.split("\n").find((l) => l.includes(".v-cierre{")) ?? "";
  if (!vCierre) F("5 · no se encontró la regla de .v-cierre");
  else if (/background:\s*var\(--doc-paper[0-9]?\)/.test(vCierre)) {
    F(`5 · .v-cierre volvió a pedir el token global en vez de la escalera: «${vCierre.trim().slice(0, 90)}»`);
  }
  const shared = leer(TOKENS_SHARED);
  if (/\.doc-sec--paper2/.test(shared)) {
    F("5 · el selector muerto .doc-sec--paper2 volvió: nadie lo emite, así que no hace nada");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runEscalaSuperficiesTier(): { hard: number } {
  console.log("\n─── TIER ESCALA-SUPERFICIES (el andamio --doc-inset, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la escalera está completa en los tres contextos, ningún escalón cae sobre otro del mismo valor y cada par se distingue en los dos temas");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runEscalaSuperficiesTier();
  process.exit(hard ? 1 : 0);
}
