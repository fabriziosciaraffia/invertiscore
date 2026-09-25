// ============================================================================
// GOLDEN · LA CIFRA DE COMPARABLES TIENE UNA SOLA FUENTE — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: la metadescripción decía «35.000+» y la landing «más de 40 mil», cada una
// escrita en su lugar. Ahora todas leen `COMPARABLES_TEXTO` de `src/lib/stats.ts`: los avisos
// ACTIVOS con precio y superficie que usa el motor, redondeados hacia abajo.
//
// FIJA, verificado EN ROJO por mutación:
//   1 · EL TEXTO SALE DEL NÚMERO MEDIDO, redondeado HACIA ABAJO a decenas de miles, y nunca promete
//       más de lo medido.
//   2 · NINGUNA SUPERFICIE PÚBLICA ESCRIBE LA CIFRA A MANO: en el código de `src/` que llega al
//       usuario (sin comentarios, sin `admin/`, `api/` ni `dev/`, fuera de `stats.ts`) no hay un
//       «N mil / N.000(+) propiedades | deptos | departamentos | comparables | avisos».
//   3 · LAS SUPERFICIES QUE CITAN LA CIFRA LA LEEN DE AHÍ: landing, metadatos, página de inicio,
//       FAQ, correo de bienvenida y onboarding interpolan `COMPARABLES_TEXTO`.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/cifra-comparables-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COMPARABLES_MEDIDOS, COMPARABLES_TEXTO } from "../../../src/lib/stats";

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

const QUE = "(?:propiedades|deptos|departamentos|comparables|avisos)";
/** Una cifra de dataset escrita a mano: «40 mil deptos», «35.000+ propiedades», «más de 40.000 avisos». */
export const CIFRA_A_MANO = new RegExp(`\\b\\d+\\s*mil\\s+${QUE}\\b|\\b\\d{1,3}(?:\\.\\d{3})+\\s*\\+?\\s*${QUE}\\b`, "i");

const FUENTE = "src/lib/stats.ts";
const CONSUMIDORES = [
  "src/components/landing/SectionWhatFrancoDoes.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/lib/faq-data.ts",
  "src/lib/email.ts",
  "src/app/dashboard/onboarding-client.tsx",
];

export function runCifraComparablesTier(): { hard: number } {
  console.log("\n─── TIER CIFRA-COMPARABLES (una sola fuente para la cifra de comparables · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · el texto sale del número, redondeado hacia abajo ──
  const miles = Math.floor(COMPARABLES_MEDIDOS / 10_000) * 10;
  if (COMPARABLES_TEXTO !== `más de ${miles} mil`) F(`1 · COMPARABLES_TEXTO dice «${COMPARABLES_TEXTO}» y el número medido (${COMPARABLES_MEDIDOS}) redondeado hacia abajo da «más de ${miles} mil»`);
  const prometido = Number((COMPARABLES_TEXTO.match(/(\d+)\s*mil/) ?? [])[1]) * 1000;
  if (!(prometido > 0) || prometido > COMPARABLES_MEDIDOS) F(`1 · el texto promete ${prometido} y se midieron ${COMPARABLES_MEDIDOS}`);
  if (!/export const COMPARABLES_TEXTO = `más de \$\{Math\.floor\(COMPARABLES_MEDIDOS \/ 10_000\) \* 10\} mil`;/.test(readFileSync(join(RAIZ, FUENTE), "utf8"))) {
    F("1 · COMPARABLES_TEXTO ya no se deriva de COMPARABLES_MEDIDOS: vuelve a ser una cifra escrita a mano");
  }

  // ── 2 · nadie la escribe a mano ──
  const rutas = archivos(join(RAIZ, "src"))
    .map((a) => relative(RAIZ, a).replace(/\\/g, "/"))
    .filter((r) => r !== FUENTE && !/^src\/app\/(admin|api|dev)\//.test(r));
  for (const rel of rutas) {
    const src = sinComentarios(readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n"));
    for (const linea of src.split("\n")) {
      const m = linea.match(CIFRA_A_MANO);
      if (m) F(`2 · ${rel} escribe la cifra a mano («${m[0]}»): tiene que leer COMPARABLES_TEXTO de ${FUENTE}`);
    }
  }
  if (rutas.length < 300) F(`0 · el barrido leyó ${rutas.length} archivos de src/: no está leyendo el repo`);

  // ── 3 · las superficies que la citan la leen de la fuente ──
  for (const rel of CONSUMIDORES) {
    const src = sinComentarios(readFileSync(join(RAIZ, rel), "utf8"));
    if (!/import \{ COMPARABLES_TEXTO \} from ["'](?:@\/lib|\.)\/stats["'];/.test(src) || !/\$\{COMPARABLES_TEXTO[\s\S]{0,60}?\}/.test(src)) {
      F(`3 · ${rel} no interpola COMPARABLES_TEXTO de ${FUENTE}`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ CIFRA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — «${COMPARABLES_TEXTO}» sale de ${COMPARABLES_MEDIDOS} medidos; ${CONSUMIDORES.length} superficies la leen de ${FUENTE} y ninguna de ${rutas.length} archivos la escribe a mano`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCifraComparablesTier();
  process.exit(hard ? 1 : 0);
}
