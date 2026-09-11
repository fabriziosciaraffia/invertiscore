// ============================================================================
// GOLDEN · EL INTERRUPTOR DEL REDISEÑO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Este tier existe para el único goal del arco que llega a producción VISIBLE. Todo lo
// demás se construyó apagado; acá se enciende, y solo para LTR.
//
// Fija CINCO cosas:
//
//   1. EL INTERRUPTOR ESTÁ ENCENDIDO. Si alguien lo apaga sin querer —un merge, un
//      revert parcial—, el informe vuelve al de antes en silencio y nadie se entera
//      hasta que lo mira. Es el invariante que hace ruido.
//
//   2. STR SIGUE APAGADO, Y POR CONSTRUCCIÓN. Hay dos call sites de `DocumentoFrame`:
//      el de LTR pasa `rediseno`, el de STR no. Y el contexto tiene default `false`,
//      así que STR no se enciende ni con la constante en `true`.
//
//   3. INTER SE PRECARGA. `preload: false` era lo que hacía que el rediseño no costara
//      nada mientras estaba apagado: sin él, la fuente se descarga recién cuando la
//      primera regla la usa —o sea en el primer render del informe— y el lector ve el
//      fallback y después el salto. Va en el MISMO commit que enciende.
//
//   4. LA CLASE SIGUE SALIENDO DE LA CONSTANTE. `CLASE_REDISENO` derivada a mano —un
//      literal "doc-r2"— haría que apagar el flag ya no apague nada.
//
//   5. EL DEFAULT DEL CONTEXTO SIGUE EN `false`. Con la constante en `true`, un default
//      que la leyera encendería cualquier pieza sin provider — o sea STR.
//
// Corre dentro del QUICK (tier "interruptor-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/interruptor-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

const FLAG = leer("src/lib/rediseno-flag.ts");
const CTX = leer("src/components/analysis/RedisenoContexto.tsx");
const GRID = leer("src/components/analysis/SubjectCardGrid.tsx");
const STR = leer("src/app/analisis/renta-corta/[id]/results-client.tsx");
const LAYOUT = leer("src/app/layout.tsx");

// ── 1 · encendido ─────────────────────────────────────────────────────────
if (!/export const REDISENO_INFORME = true;/.test(FLAG)) {
  F("1 · el interruptor NO está en `true`. Si esto es un apagado deliberado, este tier se retira en el mismo commit; si no, el informe volvió al de antes en silencio.");
}

// ── 2 · STR apagado, por construcción ─────────────────────────────────────
{
  // El call site de STR no pasa la prop. Es lo que lo deja afuera del CSS.
  const strFrame = STR.match(/<DocumentoFrame[^>]*>/)?.[0] ?? "";
  if (!strFrame) F("2 · no se encontró el `DocumentoFrame` de STR");
  else if (/\brediseno\b/.test(strFrame)) {
    F(`2 · el DocumentoFrame de STR pasó a pedir el rediseño: «${strFrame.slice(0, 70)}». STR no tuvo su pasada — encenderle el rediseño es exactamente lo que el gate por modalidad evita (contrato §11).`);
  }
  // Y no monta el provider, que es lo que lo deja afuera del JSX.
  if (/RedisenoProvider/.test(STR)) F("2 · STR pasó a montar el provider del rediseño");
  // LTR sí hace las dos cosas.
  if (!/<DocumentoFrame[^>]*\brediseno\b/.test(GRID)) F("2 · el DocumentoFrame de LTR dejó de pedir el rediseño");
  if (!/<RedisenoProvider valor=\{rediseno\}>/.test(GRID)) F("2 · LTR dejó de montar el provider");
}

// ── 3 · Inter se precarga ─────────────────────────────────────────────────
{
  const i = LAYOUT.indexOf("const inter = Inter({");
  const bloque = i === -1 ? "" : LAYOUT.slice(i, LAYOUT.indexOf("});", i));
  if (!bloque) F("3 · no se encontró la declaración de Inter en el layout");
  else if (/preload:\s*false/.test(bloque)) {
    F("3 · Inter sigue con `preload: false` y el interruptor está encendido. Sin preload la fuente se descarga recién cuando la primera regla la usa —el primer render del informe—, y el lector ve el fallback y después el salto. Va en el MISMO commit que enciende.");
  } else if (!/preload:\s*true/.test(bloque)) {
    F("3 · Inter no declara `preload` de forma explícita: con el rediseño encendido el valor tiene que estar escrito, no heredado del default");
  }
}

// ── 4 · la clase sale de la constante ─────────────────────────────────────
if (!/CLASE_REDISENO = REDISENO_INFORME \?/.test(FLAG)) {
  F("4 · `CLASE_REDISENO` dejó de derivarse de la constante. Con un literal, apagar el interruptor ya no apagaría el CSS.");
}

// ── 5 · el default del contexto sigue en false ────────────────────────────
if (!/createContext<boolean>\(false\)/.test(CTX)) {
  F("5 · el contexto del rediseño dejó de tener default `false`. Con la constante en `true`, un default que la leyera encendería cualquier pieza sin provider — o sea STR.");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runInterruptorRedisenoTier(): { hard: number } {
  console.log("\n─── TIER INTERRUPTOR-REDISEÑO (LTR encendido · STR apagado · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el interruptor en true, STR sin la prop y sin el provider, Inter con preload, la clase derivada de la constante y el contexto con default false");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runInterruptorRedisenoTier();
  process.exit(hard ? 1 : 0);
}
