// ============================================================================
// GOLDEN · LA LANDING v14 SOBRE MASTER — catch-test (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// Las decisiones de Fabrizio del QA de la landing (27-sep-2026), fijadas:
//   1 · UNA PUERTA: el hero es `HeroEntrada` y el campo del cierre su `CampoEntrada`; la página
//       monta el header único sobre el material y la dirección va al wizard con `urlDeLlegada`.
//   2 · LA CARD ES LA DEL INFORME: `PosicionFranco` + `LoQueHariaYoBloque` / `CardBuscarOtra`, con
//       el CSS del informe (`DocTokens`). La copia `lr-` no vuelve.
//   3 · LO QUE DICE EL INFORME: el titular del motor (`titularMotor`), la card de
//       `construirCardLtr`, la primera fila de «Esto es lo que pesa» (`filasPrincipales`) y los
//       ejemplos leídos como el informe. Nada de la prosa de la IA.
//   4 · SIN SALTOS AL ROTAR: la miniatura, las cards y las matrices apilan los tres ejemplos en
//       la misma celda y muestran uno.
//   5 · LA CIFRA: la de la fuente única, con signo («+40.000»), que sube con el mapa; sin
//       contador en vivo (ni conteo propio ni «actualizado hoy»).
//   6 · EL MAPA SE PUEBLA en racimos y se queda: sin loop que vuelva a cero y sin la variante de
//       anillos ni su parámetro.
//   7 · EL COPY del QA: sin IA, «los números», sin «mejores opciones en la misma zona», sin «te
//       nombra dónde», «Te dice que no cuando es no»; el pie con el disclaimer canónico, términos
//       y privacidad.
//   8 · DESTACADO SÍ, ROJO NO: ningún bloque de la landing usa el rojo de marca como fondo —ni en
//       el CSS ni en una textura—, salvo el botón de avanzar. El cierre y el pie van sobre el
//       material del hero.
//   9 · LAS COMBINACIONES, dos variantes a elegir: A la matriz quieta (`PopupAjustes estatico`),
//       B el botón que abre el pop-up real, que pausa la rotación.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/landing-v14-catch-test.ts
// ============================================================================
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const DIR = "src/components/landing-v14";

/** Las declaraciones de fondo de un CSS, con su selector. */
function fondos(css: string): { sel: string; decl: string }[] {
  const out: { sel: string; decl: string }[] = [];
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const d of m[2].split(";")) {
      if (/^\s*background(?:-color|-image)?\s*:/.test(d)) out.push({ sel: m[1].trim(), decl: d.trim() });
    }
  }
  return out;
}
const ROJO = /#c8323c\b|rgba?\(\s*200\s*,\s*50\s*,\s*60|var\(--(?:signal-red|lv-red|verdict-buscar)\)|textura-cierre|footer-[dm]2x/i;

export function runLandingV14Tier(): { hard: number } {
  console.log("\n─── TIER LANDING-V14 (las decisiones del QA de la landing · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const page = sinComentarios(leer("src/app/page.tsx"));
  const sec = sinComentarios(leer(`${DIR}/Secciones.tsx`));
  const ent = sinComentarios(leer(`${DIR}/Entrada.tsx`));
  const reco = sinComentarios(leer(`${DIR}/Recomendacion.tsx`));
  const resp = sinComentarios(leer(`${DIR}/Respuesta.tsx`));
  const vivo = sinComentarios(leer("src/lib/landing-vivo.ts"));
  const mapa = sinComentarios(leer(`${DIR}/MapaPuntos.tsx`));
  const css = leer(`${DIR}/landing.css`);
  const tsxs = readdirSync(join(RAIZ, DIR)).filter((f) => /\.tsx?$/.test(f));
  if (tsxs.length < 10) F(`0 · leí ${tsxs.length} archivos de ${DIR}: no está leyendo la landing`);

  // ── 1 · una puerta ──
  if (!/<Hero cabecera=\{<HeaderFranco contexto="wizard" sobreMaterial \/>\} \/>/.test(page)) F("1 · la página no le pasa el header único sobre el material al hero");
  if (!/<HeroEntrada\b/.test(ent) || !/<CampoEntrada\b/.test(ent)) F("1 · la landing no monta HeroEntrada y CampoEntrada");
  if (!/router\.push\(urlDeLlegada\(sel, origen\)\)/.test(ent) || !/router\.push\(urlDeLlegada\(\{ modo \}, origen\)\)/.test(ent)) F("1 · la dirección no viaja al wizard con urlDeLlegada");
  if (!/<HeroLanding cabecera=\{cabecera\} \/>/.test(sec) || !/<CampoLanding ubicacion="cierre" \/>/.test(sec)) F("1 · el hero o el campo del cierre no son los de la entrada");
  if (existsSync(join(RAIZ, `${DIR}/CampoDireccion.tsx`)) || tsxs.some((f) => /useDireccionPlaces\(/.test(leer(`${DIR}/${f}`)))) F("1 · volvió un campo propio de la landing (CampoDireccion o un useDireccionPlaces directo)");

  // ── 2 · la card del informe ──
  for (const pieza of ["PosicionFranco", "LoQueHariaYoBloque", "CardBuscarOtra", "DocTokens"]) {
    if (!new RegExp(`import \\{[^}]*\\b${pieza}\\b[^}]*\\} from "@/components/analysis/`).test(reco)) F(`2 · la card no usa ${pieza} del informe`);
  }
  for (const f of [...tsxs.map((x) => `${DIR}/${x}`), `${DIR}/landing.css`]) {
    if (/\blr-[a-z]/.test(sinComentarios(leer(f)))) F(`2 · vuelve la copia de la card (clases lr-) en ${f}`);
  }

  // ── 3 · lo que dice el informe ──
  if (!/titular: titularMotor\(\{ veredicto, modalidad: "ltr", card \}\)\.titular/.test(vivo)) F("3 · el titular no es el del motor");
  if (!/const card = construirCardLtr\(/.test(vivo)) F("3 · la card no sale de construirCardLtr");
  if (!/filasPrincipales\(ordenarHallazgosPiramide\(results, ai\)\)\[0\]/.test(vivo)) F("3 · la línea de hallazgo no es la primera de «Esto es lo que pesa»");
  if (!/recomputeResultsForLegacy\(input, uf, medianaComuna, new Date\(fila\.created_at\)\)/.test(vivo)) F("3 · los ejemplos no se leen como el informe (recompute con la fecha de la fila)");
  if (/ai_analysis\?\.titular|sanitizeVozChilena|voz-chilena|prosa-marcas/.test(vivo)) F("3 · vuelve la prosa de la IA a la landing");

  // ── 4 · sin saltos al rotar ──
  if (!/\.lv-pila > \.lv-pila-item \{ grid-area: 1 \/ 1;/.test(css) || !/\.lv-pila > \.lv-pila-item:not\(\.on\) \{ visibility: hidden;/.test(css)) F("4 · la pila no apila los ejemplos en la misma celda");
  if (!/<div className="lv-pila">\s*\n\s*\{ejemplos\.map\(\(x, j\) => \(\s*\n\s*<Miniatura key=\{x\.id\}/.test(resp)) F("4 · la miniatura no apila los tres ejemplos");
  if (!/<div className="lv-pila lv-cards">\s*\n\s*\{ejemplos\.map\(/.test(reco) || !/<div className="lv-pila lv-matrices">\s*\n\s*\{ejemplos\.map\(/.test(reco)) F("4 · las cards o las matrices no apilan los tres ejemplos");

  // ── 5 · la cifra ──
  if (!/<ContadorComparables final=\{COMPARABLES_CIFRA\} piso=\{COMPARABLES_PISO\} \/>/.test(sec)) F("5 · la cifra grande no es COMPARABLES_CIFRA (con signo) de la fuente única");
  if (/count: "exact"|scraped_at|avisosActivos|ultimoScrape/.test(vivo + sec)) F("5 · vuelve el contador en vivo (conteo propio o «actualizado hoy»)");
  if (/actualizado \{|lv-base"><i/.test(sec)) F("5 · vuelve la línea «actualizado hoy» con su punto en vivo");

  // ── 6 · el mapa se puebla ──
  if (!/function secuenciaDeRacimos\(/.test(mapa) || !/progreso\?\.set\(hasta \/ n\)/.test(mapa) || !/canvas\.classList\.add\("lleno"\)/.test(mapa)) F("6 · el mapa no se puebla en racimos con el contador");
  if (/CICLO_MS|get\("mapa"\)|ANILLO_|Variante/.test(mapa)) F("6 · vuelve el loop que empieza de cero, la variante de anillos o su parámetro");

  // ── 7 · el copy ──
  const todo = tsxs.map((f) => sinComentarios(leer(`${DIR}/${f}`))).join("\n") + page;
  for (const [re, qué] of [
    [/\b(?:con|por) (?:Franco )?IA\b/, "la promesa de IA"],
    [/Nadie le paga/, "«Nadie le paga por decir que sí»"],
    [/los supuestos no/, "«los supuestos no» (van «los números»)"],
    [/mejores opciones en la misma zona/, "«mejores opciones en la misma zona»"],
    [/te nombra dónde/, "«te nombra dónde un depto así sí convendría»"],
  ] as const) {
    if (re.test(todo)) F(`7 · vuelve ${qué}`);
  }
  if (!/Te dice que no cuando es no\./.test(sec)) F("7 · falta «Te dice que no cuando es no.»");
  const marca = sinComentarios(leer(`${DIR}/Marca.tsx`));
  if (!/import \{ DISCLAIMER_CANONICO \} from "@\/components\/chrome\/AppFooter";/.test(marca) || !/<p>\{DISCLAIMER_CANONICO\}<\/p>/.test(marca) || !/href="\/terms"/.test(marca) || !/href="\/privacy"/.test(marca)) F("7 · el pie no lleva el disclaimer canónico con términos y privacidad");

  // ── 8 · destacado sí, rojo no ──
  const hoja = [`${DIR}/landing.css`, "src/components/entrada/hero-entrada.css", "src/components/metodologia/metodologia.css"];
  for (const f of hoja) {
    for (const { sel, decl } of fondos(leer(f))) {
      if (!ROJO.test(decl)) continue;
      // el único rojo de fondo: el botón de avanzar del campo
      if (/^\.he-box:hover \.he-btn, \.he-btn:focus-visible$/.test(sel)) continue;
      F(`8 · ${f}: «${sel}» usa el rojo de marca de fondo (${decl})`);
    }
  }
  // en los componentes: ninguna textura roja, y ningún estilo en línea con el rojo de fondo. (Los
  // puntos del mapa son dato, no fondo: su escala sale de la tríada y ahí el rojo es visualización.)
  for (const f of tsxs) {
    const src = sinComentarios(leer(`${DIR}/${f}`));
    if (/textura-cierre|footer-[dm]2x/.test(src)) F(`8 · ${DIR}/${f} vuelve a usar la textura roja del cierre o del pie`);
    if (/background(?:Color)?\s*:\s*["'`][^"'`]*(?:#c8323c|rgba?\(\s*200\s*,\s*50\s*,\s*60|--signal-red|--verdict-buscar)/i.test(src)) F(`8 · ${DIR}/${f} pinta un fondo con el rojo de marca`);
  }
  for (const img of ["textura-cierre-d2x.webp", "textura-cierre-m2x.webp", "footer-d2x.webp", "footer-m2x.webp"]) {
    if (existsSync(join(RAIZ, "public/landing", img))) F(`8 · sigue la textura roja public/landing/${img}`);
  }
  if (!/<FondoMaterial \/>/.test(sec) || !/conFondo=\{false\}/.test(sec)) F("8 · el cierre y el pie no van sobre el material del hero");

  // ── 9 · las combinaciones ──
  if (!/<PopupAjustes\b[\s\S]{0,400}?estatico=\{estatico\}/.test(reco) || !/<Combinaciones popup=\{x\.popup\} veredicto=\{x\.veredicto\} valorUF=\{x\.valorUF\} estatico \/>/.test(reco)) F("9 · A · la matriz no es el PopupAjustes real, quieto");
  if (!/btn: puerta\.btn,/.test(reco) || !/PUERTA_COMBINACIONES/.test(reco)) F("9 · B · el botón de la card no abre el pop-up con la puerta del informe");
  if (!/\(e\.target as Element\)\.closest\("\.rec-cta"\) && !pausado\) pausar\(\);/.test(reco)) F("9 · B · abrir el pop-up no pausa la rotación");
  if (!/popup: PopupLanding \| null;/.test(vivo) || !/hayAjustesQueMostrar\(\{ veredicto, distancia, mixComprar \}\)/.test(vivo)) F("9 · los datos del pop-up no se arman como en el informe");

  if (fallas.length) {
    console.log(`  ✗ LANDING-V14 · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — una puerta con el header único, la card y el titular del informe, la primera fila de lo que pesa, tres ejemplos apilados sin saltos, la cifra de la fuente única que sube con el mapa que se puebla, el copy del QA con su pie legal, ningún bloque rojo de fondo y las dos variantes de las combinaciones");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLandingV14Tier();
  process.exit(hard ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (27-sep-2026): cada una en ROJO y restaurada — ver la sesión. Hero propio en
// vez de HeroEntrada · card sin PosicionFranco · titular de la IA · otra fila de hallazgo · la
// miniatura sin pila · la cifra en texto · vuelve «actualizado hoy» · el mapa con loop · «Nadie le
// paga» · el cierre con fondo rojo · una textura roja · la matriz interactiva · abrir sin pausar.
// ─────────────────────────────────────────────────────────────────────────────
