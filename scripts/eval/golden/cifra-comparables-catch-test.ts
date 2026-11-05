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
import { COMPARABLES_CIFRA, COMPARABLES_MEDIDOS, COMPARABLES_PISO, COMPARABLES_TEXTO, cifraComparables, pisoComparables, textoComparables } from "../../../src/lib/stats";

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
  "src/app/metodologia/page.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/lib/faq-data.ts",
  // src/lib/email/correos.ts salió el 01-oct-2026: la bienvenida usa los bloques del dashboard (BIENVENIDA de
  // bienvenida-copy.ts, que cita la cifra), así que el correo y el dashboard dicen lo mismo por construcción.
  "src/app/dashboard/bienvenida-copy.ts", // antes onboarding-client.tsx (29-sep-2026)
];

export function runCifraComparablesTier(): { hard: number } {
  console.log("\n─── TIER CIFRA-COMPARABLES (una sola fuente para la cifra de comparables · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · el texto sale del número, redondeado hacia abajo ──
  // ACTA (27-sep-2026, decisión de Fabrizio): de «más de 40 mil» a dos formas del mismo piso,
  // «+40.000» sola y grande y «más de 40.000» en una frase. La regla no cambia: se deriva del número
  // medido, hacia abajo, y nunca promete más.
  // ACTA (05-nov-2026, auditoría de promesas parte 3, goal de Fabrizio «"+40.000" sale del conteo vivo»): el número ya no
  // es la constante medida a mano el 25-sep (41.976), sino el conteo de la base cada hora (comparables-vivos.ts); la
  // constante queda de respaldo. Y el piso pasa a MILES: el conteo vivo dio 39.950, que a decenas de miles habría dicho
  // «+30.000» y saltado entre 30 y 40 mil de una noche a otra. Lo que se fija es la REGLA —las funciones de stats.ts—,
  // probada sobre varios conteos, no la cifra de hoy; y el respaldo sale de las mismas funciones.
  for (const n of [999, 39_950, 41_976, 40_000, 100_001]) {
    const piso = Math.floor(n / 1000) * 1000;
    const puntos = piso.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (pisoComparables(n) !== piso) F(`1 · el piso de ${n} es ${pisoComparables(n)}, no ${piso} (hacia abajo, a miles)`);
    if (textoComparables(n) !== `más de ${puntos}`) F(`1 · el texto de ${n} dice «${textoComparables(n)}» y tendría que decir «más de ${puntos}»`);
    if (cifraComparables(n) !== `+${puntos}`) F(`1 · la cifra de ${n} dice «${cifraComparables(n)}» y tendría que decir «+${puntos}»`);
    for (const t of [textoComparables(n), cifraComparables(n)]) {
      const prometido = Number((t.match(/(\d{1,3}(?:\.\d{3})*)/) ?? [])[1]?.replace(/\./g, ""));
      if (prometido > n) F(`1 · «${t}» promete ${prometido} y se contaron ${n}`);
    }
  }
  if (COMPARABLES_PISO !== pisoComparables(COMPARABLES_MEDIDOS) || COMPARABLES_TEXTO !== textoComparables(COMPARABLES_MEDIDOS) || COMPARABLES_CIFRA !== cifraComparables(COMPARABLES_MEDIDOS))
    F("1 · el respaldo ya no sale de las mismas funciones: vuelve a haber una cifra escrita a mano");
  const vivos = readFileSync(join(RAIZ, "src/lib/comparables-vivos.ts"), "utf8");
  if (!/return \{ n, piso: pisoComparables\(n\), cifra: cifraComparables\(n\), texto: textoComparables\(n\) \};/.test(vivos))
    F("1 · el conteo vivo no arma sus dos formas con las funciones de stats.ts");

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

  // ── 3 · las superficies que la citan la leen del conteo vivo ──
  // ACTA (05-nov-2026, conteo vivo): ya no importan la constante de stats.ts. Cada superficie que la dice, o la lee ella
  // misma (`comparablesVivos()`) y cita lo que devuelve, o la recibe por parámetro y la interpola —y entonces quien la
  // dibuja la lee del conteo vivo y se la pasa—. Cada par se fija por separado: que el parámetro exista no prueba que
  // alguien le pase la cifra viva.
  const s = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n"));
  const reglas: Array<[string, RegExp, string]> = [
    ["src/app/metodologia/page.tsx", /const \{ texto: COMPARABLES_TEXTO \} = await comparablesVivos\(\);[\s\S]*\$\{COMPARABLES_TEXTO\} deptos comparables/, "lee el conteo vivo y lo cita"],
    ["src/app/layout.tsx", /const \{ texto: COMPARABLES_VIVOS \} = await comparablesVivos\(\);[\s\S]*\$\{COMPARABLES_VIVOS\} propiedades/, "lee el conteo vivo y lo cita en su descripción"],
    ["src/app/page.tsx", /const \{ texto \} = await comparablesVivos\(\);[\s\S]*contra \$\{texto\} deptos comparables/, "lee el conteo vivo para su descripción"],
    ["src/app/page.tsx", /comparables\] = await Promise\.all\(\[leerDatosLanding\(\), comparablesVivos\(\)\]\)[\s\S]*<PorQueCreerle comparables=\{comparables\} \/>/, "le pasa el conteo vivo a «Por qué creerle»"],
    ["src/components/landing-v14/Secciones.tsx", /<ContadorComparables final=\{comparables\.cifra\} piso=\{comparables\.piso\} \/>/, "dice la cifra que recibe"],
    ["src/lib/faq-data.ts", /\$\{comparables\} propiedades/, "interpola la cifra que recibe"],
    ["src/app/faq/page.tsx", /const \{ texto \} = await comparablesVivos\(\);[\s\S]*faqSecciones\(texto\)/, "le pasa el conteo vivo al FAQ"],
    ["src/app/dashboard/bienvenida-copy.ts", /\(comparables: string = COMPARABLES_TEXTO\) => `[^`]*\$\{comparables\} propiedades/, "interpola la cifra que recibe (con el respaldo por defecto)"],
    ["src/app/dashboard/bienvenida.tsx", /\{h\.texto\(comparables\)\}/, "le pasa la cifra a su texto"],
    ["src/app/dashboard/page.tsx", /<Bienvenida [^>]*comparables=\{\(await comparablesVivos\(\)\)\.texto\}/, "le pasa el conteo vivo a la bienvenida"],
    ["src/lib/email/correos.ts", /analiza\.texto\(p\.comparables\)/, "el correo de bienvenida interpola la cifra que recibe"],
    ["src/lib/email.ts", /comparablesVivos\(\)\)\.then\(\(c\) => c\.texto\)[\s\S]{0,200}correoBienvenida\(\{[^}]*comparables \}/, "le pasa el conteo vivo al correo de bienvenida"],
  ];
  for (const [rel, re, que] of reglas) if (!re.test(s(rel))) F(`3 · ${rel} no ${que}`);
  if (reglas.length < CONSUMIDORES.length) F("3 · hay superficies de la lista sin regla");
  for (const rel of CONSUMIDORES) if (!reglas.some(([r]) => r === rel)) F(`3 · ${rel} cita la cifra y no tiene regla`);

  if (fallas.length) {
    console.log(`  ✗ CIFRA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — la cifra sale del conteo vivo con piso a miles (respaldo «${COMPARABLES_CIFRA}»); ${CONSUMIDORES.length} superficies la reciben de comparablesVivos() y ninguna de ${rutas.length} archivos la escribe a mano`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCifraComparablesTier();
  process.exit(hard ? 1 : 0);
}
