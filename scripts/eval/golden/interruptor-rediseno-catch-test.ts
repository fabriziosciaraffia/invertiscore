// ============================================================================
// GOLDEN · EL INTERRUPTOR DEL REDISEÑO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Este tier existe para los dos goals del arco que llegan a producción VISIBLES. Todo lo
// demás se construyó apagado; acá se enciende: LTR el 11-sep-2026 (4d) y STR el
// 12-sep-2026 («Encender el rediseño STR»). ES EL ÚNICO DUEÑO DEL ENCENDIDO: el bloque 1
// del tier estructura-str fijaba la constante STR en `false` y se retiró con acta en el
// commit que la encendió —el mismo chequeo en dos tiers tiene dos dueños y ninguno lo
// mantiene—; ahí queda solo la derivación.
//
// Fija CINCO cosas:
//
//   1. EL INTERRUPTOR ESTÁ ENCENDIDO. Si alguien lo apaga sin querer —un merge, un
//      revert parcial—, el informe vuelve al de antes en silencio y nadie se entera
//      hasta que lo mira. Es el invariante que hace ruido.
//
//   2. STR TAMBIÉN ESTÁ ENCENDIDO, Y POR SU PROPIO INTERRUPTOR. Desde el bloque A de «STR
//      al rediseño» (11-sep-2026) los dos call sites de `DocumentoFrame` pasan `rediseno`,
//      y el de STR lo deriva de `REDISENO_INFORME_STR` —en `true` desde el 12-sep— o del
//      contexto heredado. Nunca de la constante de LTR: las dos se apagan por separado, con
//      su propio revert, y compartirlas volvería a atar una modalidad a la otra (§11).
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

// ── 2 · STR encendido, por su propio interruptor ──────────────────────────
{
  if (!/export const REDISENO_INFORME_STR = true;/.test(FLAG)) {
    F("2 · `REDISENO_INFORME_STR` no está en `true`. Si esto es un apagado deliberado de STR, es el revert del commit que lo encendió y este bloque vuelve a `false` en el mismo commit; si no, el informe STR volvió al de antes en silencio.");
  }
  // El call site de STR pasa la prop DERIVADA de su constante o del contexto, nunca de la de LTR.
  const strFrame = STR.match(/<DocumentoFrame[^>]*>/)?.[0] ?? "";
  if (!strFrame) F("2 · no se encontró el `DocumentoFrame` de STR");
  else if (!/\brediseno=\{rediseno\}/.test(strFrame)) {
    F(`2 · el DocumentoFrame de STR no pasa \`rediseno={rediseno}\`: «${strFrame.slice(0, 70)}». Desde el bloque A la prop viaja y la decide REDISENO_INFORME_STR.`);
  }
  if (!/const rediseno = REDISENO_INFORME_STR \|\| redisenoHeredado;/.test(STR)) {
    F("2 · la página STR no deriva `rediseno` de `REDISENO_INFORME_STR || redisenoHeredado`. Con la constante de LTR, STR se encendería solo.");
  }
  if (/REDISENO_INFORME\b(?!_STR)/.test(STR)) F("2 · la página STR lee `REDISENO_INFORME` (la de LTR): el gate por modalidad muere ahí");
  // Y monta el provider con ESE valor, para que las piezas compartidas lo lean.
  if (!/<RedisenoProvider valor=\{rediseno\}>/.test(STR)) F("2 · STR no monta `<RedisenoProvider valor={rediseno}>`");
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
  console.log("\n─── TIER INTERRUPTOR-REDISEÑO (LTR y STR encendidos, cada uno por su interruptor · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — los dos interruptores en true, STR derivando la prop de su constante o del contexto, Inter con preload, la clase derivada de la constante y el contexto con default false");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runInterruptorRedisenoTier();
  process.exit(hard ? 1 : 0);
}
