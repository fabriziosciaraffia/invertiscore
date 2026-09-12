// ============================================================================
// GOLDEN · TIPOGRAFÍA DEL REDISEÑO — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §1.
// Inter como cuerpo, títulos y cifras; Source Serif SOLO en el titular del hero;
// el mono retirado de todas partes.
//
// Fija SEIS cosas, y la tercera es la razón de existir de este tier:
//
//   1. EL INTERRUPTOR — RETIRADO CON ACTA (ver el bloque 1): fijó `false` hasta el
//      encendido, el encendido lo pasó al tier interruptor-rediseno y el retiro del
//      andamio (12-sep-2026) se llevó las constantes; queda acá Inter con preload (4).
//
//   2. LAS FUENTES ESTÁN CARGADAS Y CON LOS PESOS QUE EL CONTRATO PIDE. Source Serif
//      necesita el 600 del titular; sin el peso, el navegador cae al más cercano por
//      font-matching y el titular se rinde en 700. Ya pasó con el 400 el 09-sep.
//
//   3. `tabular-nums` SIGUE EN LA COLUMNA DE CIFRAS. Es el invariante frágil: el mono
//      alineaba por construcción y Inter no. Medido con Range sobre el texto
//      renderizado, sin esta declaración dos cifras del mismo largo se separan hasta
//      27,19 px (`1.111.111` contra `4.444.444` a 15 px) — más de un cuarto de la
//      columna. Con ella, cero. Y se cae en SILENCIO: nada falla, solo se desalinea.
//
//   4. INTER SE PRECARGA. Hasta el goal 4 iba en `preload: false` para que el rediseño
//      apagado no costara bytes; encendido, sin preload el lector ve el fallback y
//      después el salto. Desde el 12-sep-2026 no hay apagado: `true`, sin condición.
//
//   5. LA SERIF SE CAPTURA EN `body`, NO EN `:root`. next/font define
//      `--font-heading` en la clase que monta en `body`; capturarla en `html` la deja
//      sin resolver y el titular cae a Georgia. Medido en el navegador.
//
//   6. EL WORDMARK NO ES TIPOGRAFÍA DEL INFORME. «refranco.ai» va en Source Serif por
//      identidad de marca (CLAUDE.md), y el reapunte de `--font-heading` se lo llevaba
//      puesto. La excepción cuelga de una clase propia y no de una utilidad.
//
// Corre dentro del QUICK (tier "tipografia-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/tipografia-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const LAYOUT = leer("src/app/layout.tsx");
const PORTADA = leer("src/components/analysis/portada/PortadaInforme.tsx");

// ── 1 · EL INVARIANTE DEL INTERRUPTOR SE RETIRA CON ACTA (11-sep-2026) ─────
//
// Pedía que `REDISENO_INFORME` fuera `false` y que `CLASE_REDISENO` fuera vacía, con su
// motivo escrito: el rediseño iba en cuatro partes y producción no podía ver una sola.
// El goal 4d enciende, así que el invariante cumplió su trabajo y se va — su propio
// mensaje decía «si esta es la parte 4, invertí este invariante en el mismo commit que
// lo enciende».
//
// NO SE INVIERTE ACÁ: se reemplaza por el tier `interruptor-rediseno`, que fija las
// CINCO condiciones del encendido —constante en `true`, STR sin la prop y sin el
// provider, Inter con preload, la clase derivada de la constante y el contexto con
// default `false`—. Invertirlo acá habría dejado el mismo chequeo en dos tiers, y con
// dos dueños ninguno lo mantiene.
//
// 12-sep-2026 (retiro del andamio): el tier interruptor-rediseno también se retiró con acta —
// las dos constantes ya no existen— y su chequeo de Inter con preload vive acá (bloque 4).

// ── 2 · las fuentes y sus pesos ────────────────────────────────────────────
{
  if (!/from "next\/font\/google"/.test(LAYOUT) || !/\bInter\b/.test(LAYOUT)) {
    F("2 · Inter no está cargada en layout.tsx");
  }
  // Source Serif: el bloque de pesos, con el 600 que pide el titular del hero.
  const serif = LAYOUT.slice(LAYOUT.indexOf("Source_Serif_4({"), LAYOUT.indexOf("});", LAYOUT.indexOf("Source_Serif_4({")));
  for (const peso of ["400", "600", "700"]) {
    if (!new RegExp(`"${peso}"`).test(serif)) {
      F(`2 · Source Serif no carga el peso ${peso}: el navegador cae al más cercano por font-matching y el titular se rinde en otro peso`);
    }
  }
  // Inter SIN weight ⇒ Next toma la variable, un archivo para todo el rango.
  const inter = LAYOUT.slice(LAYOUT.indexOf("Inter({"), LAYOUT.indexOf("});", LAYOUT.indexOf("Inter({")));
  if (/weight:/.test(inter)) {
    F("2 · Inter declara `weight`: así Next baja estáticos en vez de la variable, que es un archivo para 400-700");
  }
  if (!/"latin-ext"/.test(inter)) {
    F("2 · Inter sin subset latin-ext: los nombres de comuna llevan tilde y ñ");
  }
  if (!/--font-ui/.test(inter)) F("2 · Inter no expone --font-ui");
}

// ── 3 · tabular-nums en la columna de cifras ───────────────────────────────
{
  const reglaTab = /\.doc-dictamen[^{]*\.hz-n[^{]*\{[^}]*font-variant-numeric:\s*tabular-nums/.test(PORTADA)
    || /font-variant-numeric:\s*tabular-nums/.test(PORTADA.slice(PORTADA.indexOf(".doc-dictamen .hz-n"), PORTADA.indexOf(".doc-dictamen .hz-n") + 400));
  if (!reglaTab) {
    F("3 · la columna de cifras perdió `tabular-nums`. Inter es proporcional: sin esa declaración dos cifras del mismo largo se separan hasta 27 px y la alineación se cae EN SILENCIO");
  }
  // Y va en la clase de la columna, no suelta en un elemento.
  if (/style=\{\{[^}]*fontVariantNumeric/.test(PORTADA)) {
    F("3 · `tabular-nums` aplicado inline: va en la clase de la columna, para que se pueda fijar acá");
  }
}

// ── 4 · Inter se precarga ──────────────────────────────────────────────────
// Mientras el rediseño estuvo apagado iba en `preload: false`; encendido, sin preload la
// fuente se descarga recién cuando la primera regla la usa —el primer render del informe—
// y el lector ve el fallback y después el salto. Venía del tier interruptor-rediseno.
{
  const inter = LAYOUT.slice(LAYOUT.indexOf("Inter({"), LAYOUT.indexOf("});", LAYOUT.indexOf("Inter({")));
  if (!inter) F("4 · no se encontró la declaración de Inter en el layout");
  else if (!/preload:\s*true/.test(inter)) F("4 · Inter no declara `preload: true`: el lector vería el fallback y después el salto");
}

// ── 5 · la serif se captura en body, no en :root ───────────────────────────
{
  if (/:root\{--font-serif/.test(PORTADA)) {
    F("5 · --font-serif capturada en :root: next/font define --font-heading en body, así que en html no existe y el titular del hero cae a Georgia");
  }
  if (!/body\{--font-serif:var\(--font-heading\)\}/.test(PORTADA)) {
    F("5 · falta la captura de la serif en body, antes de reapuntar --font-heading");
  }
}

// ── 6 · el wordmark queda fuera del reapunte ───────────────────────────────
{
  if (!/doc-wordmark/.test(PORTADA)) {
    F("6 · el wordmark no tiene clase propia: la excepción de la serif cuelga de una utilidad de Tailwind y se rompe sola");
  }
  if (!/\.doc-dictamen \.doc-wordmark\{font-family:var\(--font-serif/.test(PORTADA)) {
    F("6 · el wordmark no está exceptuado del reapunte: «refranco.ai» es la marca, no tipografía del informe (CLAUDE.md)");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runTipografiaRedisenoTier(): { hard: number } {
  console.log("\n─── TIER TIPOGRAFÍA-REDISEÑO (contrato §1 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — pesos cargados, tabular-nums en la columna, Inter con preload, serif capturada en body y wordmark exceptuado");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runTipografiaRedisenoTier();
  process.exit(hard ? 1 : 0);
}
