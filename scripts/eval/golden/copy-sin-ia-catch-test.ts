// ============================================================================
// GOLDEN · EL PRODUCTO NO PROMETE IA — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: con la IA fuera del informe, sale la promesa de IA del copy — precios,
// landing, SEO, preguntas frecuentes, correos y la firma «Análisis generado por IA» de AMBAS.
// Única excepción: la página de comunas, cuya prosa sí la escribe un modelo (script manual) y
// conserva su sello «Análisis generado por Franco IA».
//
// FIJA, verificado EN ROJO por mutación:
//   1 · NINGUNA SUPERFICIE PÚBLICA DICE «con IA», «por IA» ni «generado por IA». Se barre el código
//       de `src/` que llega al usuario —páginas, componentes, correos, SEO, copy de `src/lib`—
//       sin comentarios (la prosa de un acta no cuenta). Fuera del barrido: `src/app/admin/` y las
//       rutas `src/app/api/`, que no son superficies públicas.
//   2 · LA EXCEPCIÓN ES UNA SOLA FRASE EN UN SOLO ARCHIVO: en la página de comunas solo se admite
//       el sello «Análisis generado por Franco IA», y tiene que seguir ahí (si desaparece, la
//       excepción ya no mide nada y el tier lo dice).
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/copy-sin-ia-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`\w])\/\/.*$/gm, "$1");

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

/** La promesa de IA en el copy: «con IA», «por IA» o «generado por IA», con o sin «Franco» en medio. */
export const PROMESA_IA = /\b(?:con|por)\s+(?:Franco\s+)?IA\b/i;

const COMUNAS = "src/app/comunas/[slug]/page.tsx";
const SELLO_COMUNAS = "Análisis generado por Franco IA";

export function runCopySinIaTier(): { hard: number } {
  console.log("\n─── TIER COPY-SIN-IA (ninguna superficie pública promete IA, salvo el sello de comunas · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  const rutas = archivos(join(RAIZ, "src"))
    .map((a) => relative(RAIZ, a).replace(/\\/g, "/"))
    .filter((r) => !r.startsWith("src/app/admin/") && !r.startsWith("src/app/api/"));
  let conSello = false;
  for (const rel of rutas) {
    let src = sinComentarios(readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n"));
    if (rel === COMUNAS) {
      conSello = src.includes(SELLO_COMUNAS);
      src = src.split(SELLO_COMUNAS).join("");
    }
    for (const linea of src.split("\n")) {
      const m = linea.match(PROMESA_IA);
      if (m) F(`1 · ${rel} promete IA: «${linea.trim().slice(0, 110)}»`);
    }
  }
  if (!conSello) F(`2 · ${COMUNAS} ya no lleva «${SELLO_COMUNAS}»: la excepción no mide nada (sácala del tier o repón el sello)`);
  if (rutas.length < 300) F(`0 · el barrido leyó ${rutas.length} archivos de src/: no está leyendo el repo`);

  if (fallas.length) {
    console.log(`  ✗ COPY-SIN-IA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${rutas.length} archivos públicos de src/ sin «con IA», «por IA» ni «generado por IA»; comunas conserva su sello y nada más`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCopySinIaTier();
  process.exit(hard ? 1 : 0);
}
