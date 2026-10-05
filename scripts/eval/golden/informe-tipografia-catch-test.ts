// ============================================================================
// GOLDEN · INFORME-TIPOGRAFÍA (05-oct-2026) — catch-test
// ============================================================================
//   El interior del informe web (src/components/analysis/** y las dos páginas de resultados) va en la
//   tipografía del cuerpo, en caja de oración (pedido de Fabrizio, 05-oct-2026):
//   1 · SIN MONO: ni la clase `font-mono`, ni `var(--font-mono…)`, `ui-monospace`, «JetBrains» o
//       `monospace` en un estilo. Definir el token (`--font-mono:var(--font-ui)`) sí se puede.
//   2 · SIN MAYÚSCULAS: ni `text-transform:uppercase`, ni `textTransform: "uppercase"`, ni la clase
//       `uppercase`.
//   3 · SIN ESPACIADO DE VERSALITAS: ningún letter-spacing de 0,04em o más (salvo el «.ai» del wordmark).
//   4 · «CÓMO SE CALCULA» NO SE DESBORDA a 390: la tabla del flujo con table-layout fijo al 100%, la
//       primera columna que parte su línea, y los dos modales (largo y corto) en millones en el teléfono.
//   El PDF (/documento) y el tagline de marca (FrancoLogo) quedan fuera: no son el interior del informe.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/informe-tipografia-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
// Sin comentarios de bloque, de línea ni de JSX: un comentario que cuenta la historia no es estilo.
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`\\])\/\/[^\n]*$/gm, "$1");

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}

export const ALCANCE = (): string[] => [
  ...archivos("src/components/analysis"),
  "src/app/analisis/[id]/results-client.tsx",
  "src/app/analisis/renta-corta/[id]/results-client.tsx",
];

export function runInformeTipografiaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER INFORME-TIPOGRAFÍA (el interior del informe sin mono ni mayúsculas · 0 tokens) ───");

  const lista = ALCANCE();
  if (lista.length < 40) F(`0 · el alcance tiene ${lista.length} archivos: el instrumento no está encontrando el informe`);
  for (const p of lista) {
    const lineas = sinComentarios(leer(p)).split("\n");
    lineas.forEach((l, i) => {
      const donde = `${relative(RAIZ, join(RAIZ, p)).replace(/\\/g, "/")}:${i + 1}`;
      if (/(^|[\s"'`{])font-mono(?=[\s"'`}])/.test(l)) F(`1 · ${donde} · clase font-mono`);
      if (/var\(--font-mono|ui-monospace|JetBrains|monospace/.test(l)) F(`1 · ${donde} · una fuente mono en un estilo`);
      if (/text-transform:\s*uppercase|textTransform:\s*["']uppercase["']/.test(l)) F(`2 · ${donde} · mayúsculas por estilo`);
      if (/(^|[\s"'`{])uppercase(?=[\s"'`}])/.test(l)) F(`2 · ${donde} · clase uppercase`);
      const esp = l.match(/letter-spacing:\s*(\.?[0-9]*\.?[0-9]+)em|letterSpacing:\s*["'](\.?[0-9]*\.?[0-9]+)em["']|tracking-\[([0-9.]+)em\]|tracking-(wide|wider|widest)\b/);
      if (esp) {
        const v = esp[4] ? 1 : Number(esp[1] ?? esp[2] ?? esp[3]);
        const wordmarkAi = /\.ai<\/span>/.test(l);
        if (v >= 0.04 && !wordmarkAi) F(`3 · ${donde} · letter-spacing de versalitas (${esp[0]})`);
      }
    });
  }

  // 4 · «Cómo se calcula» a 390
  const portada = sinComentarios(leer("src/components/analysis/portada/PortadaInforme.tsx"));
  if (!/\.pc-flujo\{width:100%;border-collapse:collapse;table-layout:fixed;/.test(portada)) F("4 · la tabla del flujo dejó de tener layout fijo al 100%: a 390 se desborda");
  if (!/\.pc-flujo tbody td:first-child\{[^}]*white-space:normal/.test(portada)) F("4 · la primera columna del flujo no parte su línea («entrega · N meses» se mete en la de al lado)");
  for (const m of ["src/components/analysis/ModalCalculo.tsx", "src/components/analysis/str/ModalCalculoStr.tsx"]) {
    const s = sinComentarios(leer(m));
    if (!/const compacto = useEsHoja\(\);/.test(s) || !/<TablaFlujo filas=\{filas\} moneda=\{currency\} valorUF=\{valorUF\} compacto=\{compacto\} \/>/.test(s)) F(`4 · ${m} no pasa a millones en el teléfono`);
  }

  if (fallas.length) {
    console.log(`  ✗ INFORME-TIPOGRAFÍA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 25)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${lista.length} archivos del informe sin mono, sin mayúsculas y sin espaciado de versalitas; «Cómo se calcula» con layout fijo y millones en el teléfono`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runInformeTipografiaTier().hard ? 1 : 0);
}

// ─── ACTA · verificado EN ROJO por mutación ──────────────────────────────────
// 05-oct-2026: 10/10 ROJO, cada archivo restaurado byte a byte.
//   T1 vuelve la clase font-mono · T2 vuelve la clase uppercase · T3 una regla CSS en mayúsculas · T4 un
//   var(--font-mono) en CSS · T5 textTransform uppercase en línea · T6 espaciado de versalitas · T7 tracking en
//   Tailwind · T8 JetBrains en línea · T9 la tabla del flujo sin layout fijo · T10 el modal corto sin millones.
