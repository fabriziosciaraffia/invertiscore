// ============================================================================
// GOLDEN · etiqueta única del veredicto — catch-test (goal 10a · 07-sep-2026). 0 tokens.
// ============================================================================
// Enforcement por construcción: ningún literal de ETIQUETA de veredicto vive en src/
// fuera de src/lib/veredicto-etiqueta.ts. El valor persistido ("BUSCAR OTRA",
// "AJUSTA SUPUESTOS") sí puede aparecer, pero SOLO como valor: un string entero
// (`"BUSCAR OTRA"`), una clave de mapa o una clave CSS (`[data-verdict="BUSCAR OTRA"]`).
// Lo que se caza es la etiqueta escrita para el usuario: las formas capitalizadas
// («Buscar otra», «Ajusta supuestos») en cualquier posición, y las MAYÚSCULAS dentro
// de un texto más largo («…el análisis dice BUSCAR OTRA.», texto JSX suelto).
//
// Exclusiones explícitas (decisión Fabrizio, 07-sep): types.ts y veredicto-etiqueta.ts
// (la identidad y la fuente), ai-generation*.ts (prompts: van a 10b), el PDF
// (/documento LTR, STR y AMBAS: fuera de 10a). Los comentarios no cuentan.
//
// Corre dentro del QUICK del runner (tier "etiqueta") y standalone:
//   node --import tsx scripts/eval/golden/etiqueta-veredicto-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..", "src");

const EXCLUIDOS: RegExp[] = [
  /^src[\\/]lib[\\/]types\.ts$/,
  /^src[\\/]lib[\\/]veredicto-etiqueta\.ts$/,
  /^src[\\/]lib[\\/]ai-generation[^\\/]*\.ts$/,
  /^src[\\/]app[\\/]analisis[\\/]\[id\][\\/]documento[\\/]/,
  /^src[\\/]app[\\/]analisis[\\/]renta-corta[\\/]\[id\][\\/]documento[\\/]/,
  /^src[\\/]app[\\/]share[\\/]comparativa[\\/]\[token\][\\/]documento[\\/]/,
];

/** Formas de etiqueta que nunca son valor: se cazan siempre.
 *  Incluye las dos formas propias de la LÍNEA QUE DECLARA (v21): si alguien la
 *  copia en un componente en vez de pedirla a `lineaQueDeclara`, la escritura del
 *  veredicto vuelve a tener dos fuentes. «Compra.» queda fuera a propósito: es una
 *  palabra corriente del castellano y cazarla daría falsos positivos en cualquier
 *  prosa; las otras dos alcanzan para detectar la copia. */
const FRASE = /Buscar otra|Ajusta supuestos|Ajusta los números|Busca otro/g;
/** Formas en mayúsculas: se cazan salvo como string entero (valor) o clave CSS/mapa. */
const BANDA = /BUSCAR OTRA|AJUSTA SUPUESTOS/g;

function* archivos(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (/\.(ts|tsx)$/.test(e)) yield p;
  }
}

/** Quita comentarios de línea y de bloque (también los de JSX entre llaves), conservando líneas. */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => {
      // `//` fuera de un string: aproximación por posición (suficiente para este corpus).
      const i = l.search(/(^|[^:'"`])\/\//);
      return i === -1 ? l : l.slice(0, i + (l[i] === "/" ? 0 : 1));
    })
    .join("\n");
}

/** ¿La ocurrencia en `idx` es un VALOR (string entero o clave CSS/mapa) y no una etiqueta? */
function esValor(linea: string, idx: number, largo: number): boolean {
  const antes = linea[idx - 1] ?? "";
  const despues = linea[idx + largo] ?? "";
  const entreComillas = /["'`]/.test(antes) && despues === antes;
  return entreComillas;
}

export interface HitEtiqueta { archivo: string; linea: number; texto: string; forma: string }

export function buscarLiterales(): HitEtiqueta[] {
  const hits: HitEtiqueta[] = [];
  for (const abs of archivos(RAIZ)) {
    const rel = relative(join(RAIZ, ".."), abs);
    if (EXCLUIDOS.some((re) => re.test(rel))) continue;
    const lineas = sinComentarios(readFileSync(abs, "utf-8")).split("\n");
    lineas.forEach((l, i) => {
      for (const m of l.matchAll(FRASE)) hits.push({ archivo: rel, linea: i + 1, texto: l.trim().slice(0, 120), forma: m[0] });
      for (const m of l.matchAll(BANDA)) {
        if (m.index === undefined || esValor(l, m.index, m[0].length)) continue;
        hits.push({ archivo: rel, linea: i + 1, texto: l.trim().slice(0, 120), forma: m[0] });
      }
    });
  }
  return hits;
}

/** Tier para el runner: cada literal fuera de la fuente es una falla dura. */
export function runEtiquetaTier(): { hard: number; hits: HitEtiqueta[] } {
  const hits = buscarLiterales();
  console.log("\n─── TIER ETIQUETA (literal de veredicto fuera de veredicto-etiqueta.ts, 0 tokens) ───");
  if (hits.length === 0) console.log("  ✓ VERDE — ningún literal de etiqueta fuera de la fuente única");
  else for (const h of hits) console.log(`  ✗ ${h.archivo}:${h.linea} «${h.forma}» — ${h.texto}`);
  return { hard: hits.length, hits };
}

if (require.main === module) {
  const { hard } = runEtiquetaTier();
  process.exit(hard ? 1 : 0);
}
