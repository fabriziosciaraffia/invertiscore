// ============================================================================
// GOLDEN · LA CIFRA DE COMPARABLES TIENE UNA SOLA FUENTE — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: la metadescripción decía «35.000+» y la landing «más de 40 mil», cada una
// escrita en su lugar. Ahora todas leen `COMPARABLES_TEXTO` de `src/lib/stats.ts`: los avisos
// ACTIVOS con precio y superficie que usa el motor, redondeados hacia abajo.
//
// FIJA, verificado EN ROJO por mutación:
//   1 · EL TEXTO SALE DEL NÚMERO MEDIDO, redondeado HACIA ABAJO a decenas de miles, y nunca promete
//       más de lo medido. Dos formas del mismo piso (27-sep-2026): «+40.000» sola y grande
//       (`COMPARABLES_CIFRA`) y «más de 40.000» dentro de una frase (`COMPARABLES_TEXTO`).
//   2 · NINGUNA SUPERFICIE PÚBLICA ESCRIBE LA CIFRA A MANO: en el código de `src/` que llega al
//       usuario (sin comentarios, sin `admin/`, `api/` ni `dev/`, fuera de `stats.ts`) no hay un
//       «N mil / N.000(+) propiedades | deptos | departamentos | comparables | avisos».
//   3 · LAS SUPERFICIES QUE CITAN LA CIFRA LA LEEN DE AHÍ: landing, metadatos, página de inicio,
//       FAQ, correo de bienvenida y onboarding interpolan `COMPARABLES_TEXTO`.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/cifra-comparables-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COMPARABLES_CIFRA, COMPARABLES_MEDIDOS, COMPARABLES_PISO, COMPARABLES_TEXTO } from "../../../src/lib/stats";

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
// ACTA (27-sep-2026): la landing v14 reemplazó a la vieja. `SectionWhatFrancoDoes.tsx` se borró con
// ella; la cifra la dice ahora «Por qué creerle» (`Secciones.tsx`), y la página la sigue citando en
// su metadescripción.
const CONSUMIDORES = [
  "src/components/landing-v14/Secciones.tsx",
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
  // ACTA (27-sep-2026, decisión de Fabrizio): de «más de 40 mil» a dos formas del mismo piso,
  // «+40.000» sola y grande y «más de 40.000» en una frase. La regla no cambia: se deriva del número
  // medido, hacia abajo, y nunca promete más.
  const piso = Math.floor(COMPARABLES_MEDIDOS / 10_000) * 10_000;
  const puntos = piso.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (COMPARABLES_PISO !== piso) F(`1 · COMPARABLES_PISO vale ${COMPARABLES_PISO} y lo medido (${COMPARABLES_MEDIDOS}) redondeado hacia abajo da ${piso}`);
  if (COMPARABLES_TEXTO !== `más de ${puntos}`) F(`1 · COMPARABLES_TEXTO dice «${COMPARABLES_TEXTO}» y tendría que decir «más de ${puntos}»`);
  if (COMPARABLES_CIFRA !== `+${puntos}`) F(`1 · COMPARABLES_CIFRA dice «${COMPARABLES_CIFRA}» y tendría que decir «+${puntos}»`);
  for (const [nombre, t] of [["TEXTO", COMPARABLES_TEXTO], ["CIFRA", COMPARABLES_CIFRA]] as const) {
    const prometido = Number((t.match(/(\d{1,3}(?:\.\d{3})+)/) ?? [])[1]?.replace(/\./g, ""));
    if (!(prometido > 0) || prometido > COMPARABLES_MEDIDOS) F(`1 · COMPARABLES_${nombre} promete ${prometido} y se midieron ${COMPARABLES_MEDIDOS}`);
  }
  const fuente = readFileSync(join(RAIZ, FUENTE), "utf8");
  if (
    !/export const COMPARABLES_PISO = Math\.floor\(COMPARABLES_MEDIDOS \/ 10_000\) \* 10_000;/.test(fuente) ||
    !/export const COMPARABLES_CIFRA = `\+\$\{conPuntos\(COMPARABLES_PISO\)\}`;/.test(fuente) ||
    !/export const COMPARABLES_TEXTO = `más de \$\{conPuntos\(COMPARABLES_PISO\)\}`;/.test(fuente)
  ) {
    F("1 · las dos formas ya no se derivan de COMPARABLES_MEDIDOS: vuelve a haber una cifra escrita a mano");
  }

  // ── 2 · nadie la escribe a mano ──
  const rutas = archivos(join(RAIZ, "src"))
    .map((a) => relative(RAIZ, a).replace(/\\/g, "/"))
    .filter((r) => r !== FUENTE && !/^src\/app\/(admin|api|dev)\//.test(r));
  for (const rel of rutas) {
    const src = sinComentarios(readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n"));
    for (const linea of src.split("\n")) {
      const m = linea.match(CIFRA_A_MANO);
      if (m) F(`2 · ${rel} escribe la cifra a mano («${m[0]}»): tiene que leerla de ${FUENTE}`);
    }
  }
  if (rutas.length < 300) F(`0 · el barrido leyó ${rutas.length} archivos de src/: no está leyendo el repo`);

  // ── 3 · las superficies que la citan la leen de la fuente ──
  for (const rel of CONSUMIDORES) {
    const src = sinComentarios(readFileSync(join(RAIZ, rel), "utf8"));
    // ACTA (27-sep-2026): con dos formas, la superficie importa la que usa. La cifra grande de la
    // landing no se interpola en un texto: se pasa entera al contador que la escribe.
    const imp = src.match(/import \{([^}]*)\} from ["'](?:@\/lib|\.)\/stats["'];/);
    const usadas = imp ? (imp[1].match(/\bCOMPARABLES_(?:TEXTO|CIFRA)\b/g) ?? []) : [];
    const sinImport = imp ? src.replace(imp[0], "") : src;
    // la cita: interpolada en un texto («${COMPARABLES_TEXTO}») o pasada entera a un prop («={COMPARABLES_CIFRA}»)
    const cita = (u: string) => sinImport.includes("${" + u) || sinImport.includes("={" + u + "}");
    if (usadas.length === 0 || !usadas.some(cita)) {
      F(`3 · ${rel} no cita la cifra desde ${FUENTE} (COMPARABLES_TEXTO o COMPARABLES_CIFRA)`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ CIFRA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — «${COMPARABLES_CIFRA}» y «${COMPARABLES_TEXTO}» salen de ${COMPARABLES_MEDIDOS} medidos; ${CONSUMIDORES.length} superficies la leen de ${FUENTE} y ninguna de ${rutas.length} archivos la escribe a mano`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCifraComparablesTier();
  process.exit(hard ? 1 : 0);
}
