// ============================================================================
// GOLDEN · EL HERO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §3.
//
// EL HERO DEL CONTRATO ES LA PORTADA, no la sección que el código llama «hero». §3 lista
// eyebrow, botón de veredicto, score, titular con plumón y cifra clave: eso es
// `.doc-portada`. Lo que el código llama `id="hero"` es la prosa IA y la recomendación.
//
// Fija SEIS cosas:
//
//   1. EL FILTRO VIVE EN UNA CAPA APARTE. `filter` crea contexto de apilado y afecta a
//      todo el subárbol: sobre la sección se comería el titular y el botón. Es el
//      invariante que una reescritura «para simplificar» rompe sin que se note en el
//      shot de un solo veredicto.
//
//   2. EL FONDO NO DEPENDE DEL VEREDICTO. Ni `--verdict` ni `data-verdict` entran al
//      degradado: es el mismo espectro para los tres. La tríada vive en el botón.
//
//   3. EL GRANO, CON SU NÚMERO MEDIDO. `overlay` al .16 = 1,94% de amplitud relativa,
//      medido por diferencia contra el mismo árbol con el grano apagado. El valor
//      anterior del contrato —.12— daba 1,53%, y el .05 que se probó daba 0,83%.
//
//   4. EL PUNTO QUE LATE SE APAGA CON `prefers-reduced-motion`. Es lo único del
//      contrato marcado como OBLIGATORIO, y es exactamente lo que se pierde al mover
//      una animación de lugar.
//
//   5. EL PLUMÓN BLANCO NO REPUNTA `--doc-hl`. Ese token lo usan además las marcas de
//      prosa de las secciones, que van sobre PAPEL: en blanco serían invisibles.
//
//   6. LA BANDA NO SE BORRA. `PortadaInforme` lo monta también STR, así que la banda
//      sigue en el archivo y solo deja de montarse con el interruptor.
//
// Corre dentro del QUICK (tier "hero-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/hero-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const GRID = leer("src/components/analysis/SubjectCardGrid.tsx");
const HERO = leer("src/components/analysis/HeroLTR.tsx");

/** El bloque §3, del abre-comentario que lo rotula hasta el encabezado siguiente, y sin
 *  comentarios: los comentarios llevan comas y se cuelan en el listado de selectores. */
const BLOQUE = (() => {
  const marca = CSS.indexOf("REDISEÑO · EL HERO");
  if (marca === -1) return "";
  const i = CSS.lastIndexOf("/*", marca);
  const j = CSS.indexOf("═══ REDISEÑO ·", marca);
  return CSS.slice(i, j === -1 ? i + 6000 : j).replace(/\/\*[\s\S]*?\*\//g, "");
})();
if (!BLOQUE) F("0 · no existe el bloque «REDISEÑO · EL HERO» en la portada");

/** El cuerpo de la regla cuyo listado de selectores contenga exactamente `sel`. */
function reglaDe(sel: string): string | null {
  for (const m of BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.includes(sel)) return m[2];
  }
  return null;
}

// ── 1 · el filtro va en la capa de fondo, nunca en el hero ────────────────
{
  const bg = reglaDe(".doc-dictamen .doc-hero-bg");
  if (!bg) F("1 · no existe la capa de fondo del hero");
  else {
    if (!/filter:\s*brightness\(1\.10\)\s*saturate\(\.90\)/.test(bg)) F("1 · la capa de fondo perdió el filtro del contrato");
    if (!/position:\s*absolute/.test(bg)) F("1 · la capa de fondo dejó de ser absoluta: tiene que ir DETRÁS del contenido, no envolverlo");
  }
  // POR REGLA, NO POR LÍNEA: una declaración puede ir en un renglón distinto al del
  // selector, y escaneando líneas el guard acusaba a la propia capa de fondo. Recorre
  // todas las reglas del bloque y mira el SELECTOR de la que declara el filtro.
  for (const m of BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/filter\s*:/.test(m[2])) continue;
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.every((s) => s.endsWith(".doc-hero-bg"))) continue;
    F(`1 · hay un «filter» fuera de la capa de fondo, en «${sels.join(", ").slice(0, 80)}». Crea contexto de apilado y afecta a TODO el subárbol — se come el titular y el botón.`);
  }
}

// ── 2 · el fondo no depende del veredicto ─────────────────────────────────
{
  const bg = reglaDe(".doc-dictamen .doc-hero-bg") ?? "";
  if (/var\(--verdict/.test(bg)) F("2 · el fondo del hero pasó a depender del veredicto. §3: es el mismo espectro siempre; la tríada vive en el botón.");
  if (!/#0F2440[\s\S]*#2E1C28[\s\S]*#4E1119/.test(bg)) F("2 · el espectro del fondo no es el del contrato (#0F2440 → #2E1C28 → #4E1119)");
  // Y el botón SÍ lo lleva: si los dos dejan de usarlo, el veredicto deja de tener color.
  const pill = reglaDe(".doc-dictamen .doc-hero-pill") ?? "";
  if (!/background:\s*var\(--verdict\)/.test(pill)) F("2 · el botón dejó de pintarse con --verdict: es la única pieza del hero que lleva el color del veredicto");
  if (!/box-shadow:0 0 0 2px rgba\(255,255,255,\.3\)/.test(pill.replace(/\s*:\s*/g, ":"))) F("2 · el botón perdió el anillo blanco de 2 px del contrato");
}

// ── 3 · el grano, con su número ───────────────────────────────────────────
{
  const OPACIDAD = "0.16"; // 1,94% de amplitud relativa, medido sobre el espectro
  const gr = reglaDe(".doc-dictamen .doc-hero-grain");
  if (!gr) F("3 · no existe la capa de grano del hero");
  else {
    const m = gr.match(/opacity:\s*\.?(\d+)/);
    const val = m ? (gr.match(/opacity:\s*(\.\d+|0?\.\d+|\d+)/)?.[1] ?? "") : "";
    const norm = val.startsWith(".") ? "0" + val : val;
    if (norm !== OPACIDAD) {
      F(`3 · el grano está en «${val || "?"}» y el valor medido es ${OPACIDAD}. Overlay .16 da 1,94% de amplitud; .12 daba 1,53% y .05 daba 0,83%. Si se cambia, se mide de nuevo y se cambia acá.`);
    }
    if (!/mix-blend-mode:\s*overlay/.test(gr)) F("3 · el grano dejó de usar «overlay», que es el modo del contrato");
    if (!/background-image:\s*var\(--doc-grain\)/.test(gr)) F("3 · el grano dejó de salir del token --doc-grain");
  }
}

// ── 4 · el calibre del pulso, con sus números ────────────────────────────
{
  // HASTA EL 11-sep-2026 ESTE INVARIANTE NO FIJABA NADA del calibre: solo exigía que
  // la animación EXISTIERA. Se podía bajar el pulso a la mitad y seguía verde. Ahora
  // fija los números del calibre elegido —doble anillo—, porque son una decisión
  // medida y no un valor por defecto:
  //
  //   · ANILLO de 2 px y NO disco relleno. El disco se disolvía mientras crecía: su
  //     pico de visibilidad (escala² × opacidad) caía en opacidad 0,30, y subirle la
  //     amplitud a 3,2× lo dejaba en 0,28 — más grande e igual de transparente. El
  //     limitante nunca fue el tamaño.
  //   · DOS anillos a MEDIO CICLO (1,6 s con el segundo a 0,8 s). Con uno solo queda
  //     un hueco muerto entre pulsos, y de lejos ese hueco es lo que hacía que el
  //     botón pareciera apagado.
  //   · scale .9 → 3.4 con la opacidad SOSTENIDA hasta el 60%. Esa meseta es lo que
  //     hace que el anillo se lea: sin ella vuelve a desvanecerse apenas arranca.
  if (!/@keyframes docHeroLate/.test(BLOQUE)) F("4 · no existe la animación del punto que late");

  const regla = BLOQUE.match(/\.doc-dictamen \.doc-hero-dot::after,\s*\.doc-dictamen \.doc-hero-dot::before\{([^}]*)\}/)?.[1] ?? "";
  if (!regla) {
    F("4 · los dos anillos del pulso dejaron de compartir su regla. El calibre es «doble anillo»: con uno solo hay un hueco muerto entre pulsos y el botón se lee apagado de lejos.");
  } else {
    if (!/border:\s*2px solid/.test(regla)) {
      F("4 · el pulso volvió a ser un disco relleno, o el anillo perdió sus 2 px. Medido: un disco que se disuelve llega a su pico con opacidad 0,30 y no se ve de lejos por más que crezca.");
    }
    if (/background:\s*#fff/.test(regla)) F("4 · el anillo recuperó su relleno: vuelve a ser el disco que se disuelve");
    if (!/animation:\s*docHeroLate 1\.6s/.test(regla)) F("4 · el ciclo del pulso dejó de ser 1,6 s");
  }

  const dos = BLOQUE.match(/\.doc-dictamen \.doc-hero-dot::before\{animation-delay:\s*\.?8s\}/);
  if (!dos) {
    F("4 · el SEGUNDO anillo perdió su desfase de 0,8 s. Medio ciclo exacto es lo que garantiza que siempre haya uno visible: con otro valor los dos se juntan y vuelve el hueco.");
  }

  // Slice y no regex: el bloque de keyframes tiene llaves ANIDADAS, así que un
  // «[\s\S]*?}» corta en el cierre del primer paso y no en el del bloque — y los
  // dos últimos números quedaban fuera de lo que se miraba.
  const iKf = BLOQUE.indexOf("@keyframes docHeroLate");
  const kf = iKf === -1 ? "" : BLOQUE.slice(iKf, iKf + 240);
  for (const [qué, re] of [
    ["arranca en scale .9", /0%\{transform:scale\(\.9\)/],
    ["llega a scale 3.4", /transform:scale\(3\.4\)/],
    ["sostiene la opacidad hasta el 60%", /60%\{opacity:\.55\}/],
  ] as const) {
    if (!re.test(kf)) {
      F(`4 · el calibre del pulso ya no ${qué}. Los tres números se eligieron mirando los cuatro calibres congelados en la misma fracción del ciclo (docs/wireframes/rediseno-informe/calibres-pulso): cambiar uno cambia la decisión.`);
    }
  }

  // Y lo de siempre: reduced-motion apaga LOS DOS anillos.
  const i = BLOQUE.indexOf("prefers-reduced-motion");
  if (i === -1) F("4 · el bloque del hero no apaga el latido con prefers-reduced-motion. El contrato lo marca OBLIGATORIO: el punto late para siempre en la cara de alguien que pidió que nada se mueva.");
  else {
    const trozo = BLOQUE.slice(i, i + 320);
    if (!/doc-hero-dot/.test(trozo) || !/animation:\s*none/.test(trozo)) {
      F("4 · el bloque de prefers-reduced-motion ya no anula la animación del punto");
    }
    if (!/::before/.test(trozo)) {
      F("4 · reduced-motion apaga un anillo y deja el otro girando. Son DOS desde el calibre nuevo: el que no se nombra sigue latiendo en la cara de quien pidió que nada se mueva.");
    }
  }
}

// ── 4b · el punto va a la DERECHA, el signo a la izquierda ───────────────
{
  // No existía guard de posición: el punto se podía mover de lado sin que nada lo
  // dijera. El orden es signo · rótulo · punto, y no es estético — el signo pertenece
  // al VEREDICTO y viaja pegado a su palabra; el punto es indicador de vida y no dice
  // nada del dictamen, así que va solo al otro extremo.
  const pill = CSS.match(/<span className="doc-hero-pill">([\s\S]*?)<\/span>\s*<\/p>/)?.[1] ?? "";
  if (!pill) F("4b · no se encontró el contenido del botón de veredicto");
  else {
    const iSigno = pill.indexOf("doc-hero-signo");
    const iRotulo = pill.indexOf("{bandaLabel}");
    const iPunto = pill.indexOf("doc-hero-dot");
    if (iSigno === -1 || iRotulo === -1 || iPunto === -1) {
      F("4b · al botón le falta el signo, el rótulo o el punto");
    } else if (!(iSigno < iRotulo && iRotulo < iPunto)) {
      F(`4b · el orden del botón dejó de ser signo · rótulo · punto (posiciones ${iSigno}, ${iRotulo}, ${iPunto}). El punto a la izquierda compite con el signo por el mismo lugar de lectura: el signo es del veredicto y el punto es indicador de vida.`);
    }
  }
  // Y el padding acompaña: más aire del lado del texto que del lado del punto.
  const reglaPill = reglaDe(".doc-dictamen .doc-hero-pill") ?? "";
  const pad = reglaPill.match(/padding:\s*(\d+)px (\d+)px (\d+)px (\d+)px/);
  if (!pad) F("4b · el botón perdió su padding de cuatro valores");
  else if (Number(pad[4]) <= Number(pad[2])) {
    F(`4b · el padding del botón quedó con más aire a la DERECHA (${pad[2]}px) que a la izquierda (${pad[4]}px). Se dio vuelta con el punto: el lado del punto lleva menos, el del texto más.`);
  }
}

// ── 5 · el plumón blanco no repunta el token global ───────────────────────
{
  const mk = reglaDe(".doc-dictamen .doc-hero .doc-headline mark");
  if (!mk) F("5 · el titular del hero no declara su plumón");
  else if (!/rgba\(255,255,255,\.26\)/.test(mk.replace(/\s/g, ""))) F("5 · el plumón del titular no es blanco al 26%");
  for (const linea of BLOQUE.split("\n")) {
    if (/--doc-hl\s*:/.test(linea)) {
      F(`5 · «--doc-hl» se repunta en el bloque del hero: «${linea.trim().slice(0, 80)}». Ese token lo usan también las marcas de prosa de las secciones, que van sobre PAPEL — en blanco serían invisibles.`);
    }
  }
}

// ── 6 · el botón es el único veredicto del hero, y los hallazgos salieron de él ──
// INVERTIDO el 12-sep-2026 (retiro del andamio): ya no hay interruptor ni camino viejo; la
// banda vive en su CSS para el OG y el botón se monta sin condición.
{
  if (!/doc-banda-band/.test(CSS)) {
    F("6 · la banda se borró del archivo: el OG la sigue dibujando.");
  }
  if (/rediseno \?[\s\S]{0,400}doc-hero-pill/.test(CSS)) F("6 · el botón volvió a colgar de un interruptor que ya no existe");
  if (!/className="doc-portada doc-hero"/.test(CSS)) F("6 · la portada dejó de montarse como hero sin condición");
  // Los hallazgos son sección suelta (§2, §4) y su título es la línea que declara (§10).
  // DESDE EL ORDEN (11-sep): la sección la sigue ARMANDO el grid —es quien tiene la
  // lista y sus gates— pero se la pasa a `HeroLTR` por la prop `hallazgos`, que la monta
  // entre el hero y la recomendación. Lo que se fija es que exista y cómo se titula, no
  // dónde queda el JSX; el orden lo fija el invariante 17 del tier de estructura.
  const slot = GRID.slice(GRID.indexOf("hallazgos={"), GRID.indexOf("prosaError="));
  if (!/!\(!prosa && loading\) && hallazgosOrdenados\.length > 0/.test(slot)) {
    F("6 · la sección suelta de hallazgos dejó de montarse (contrato §2 y §4)");
  }
  if (/rediseno &&/.test(slot)) F("6 · la sección de hallazgos volvió a colgar de un interruptor que ya no existe");
  if (!/titulo=\{dosBloques \? lineaQueDeclara\(veredicto\)/.test(slot)) {
    F("6 · la sección de hallazgos dejó de titularse con la línea que declara (§10)");
  }
  if (/razones=\{/.test(GRID) || /\{dosBloques && razones\}/.test(HERO)) {
    F("6 · el hero volvió a recibir las filas de hallazgo: van a su propia sección");
  }
  if (!/\{!dosBloques && \(/.test(HERO)) {
    F("6 · HeroLTR volvió a dibujar su h2 con prosa de dos bloques. La línea que declara se fue con las filas: acá quedaría repetida.");
  }
}

// ── 7 · la regla de apilado no rompe «.sr-only» ──────────────────────────
{
  // «.sr-only» se esconde con «clip», y «clip» SOLO aplica a elementos posicionados en
  // absoluto. La regla que sube el contenido sobre el grano les forzaba
  // «position:relative», y la copia del titular para lectores de pantalla se volvía
  // VISIBLE debajo de la caja. Salió en los primeros shots de 4b, no en el DOM.
  const apila = [...BLOQUE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    (m) => /position:\s*relative/.test(m[2]) && /z-index:\s*2/.test(m[2]) && /doc-hero\s*>/.test(m[1]),
  );
  if (!apila) F("7 · no existe la regla que sube el contenido del hero sobre el grano");
  else if (!/:not\(\.sr-only\)/.test(apila[1])) {
    F("7 · la regla de apilado del hero volvió a alcanzar a «.sr-only». Le fuerza «position:relative», y sin «absolute» el «clip» no esconde nada: la copia del titular para lectores de pantalla se dibuja.");
  }
}

// ── 7 · el botón lleva signo, el eyebrow adelgaza y la modalidad pesa ────
{
  // 7a · EL SIGNO, con el glifo de la landing. No se inventa uno: «✕» y «✓» son los
  // que ya usa `SectionObjections` («✕ Una calculadora dice» / «✓ Franco te dice») y
  // el «−» es el U+2212 con que la landing escribe sus negativos. Cuelgan del
  // VEREDICTO y no de la etiqueta: la etiqueta es copy, el veredicto es un enum.
  // Medido en el DOM, los tres: «✓ COMPRAR», «− AJUSTAR», «✕ BUSCAR OTRO».
  const ESPERADOS: [string, string][] = [
    ["BUSCAR OTRA", "✕"],
    ["AJUSTA SUPUESTOS", "−"],
    ["COMPRAR", "✓"],
  ];
  const i = CSS.indexOf("const SIGNO_VEREDICTO");
  const mapa = i === -1 ? "" : CSS.slice(i, CSS.indexOf("};", i));
  if (!mapa) F("7 · desapareció el mapa de signos del botón de veredicto (§3)");
  else {
    for (const [v, glifo] of ESPERADOS) {
      if (!mapa.includes(glifo)) {
        F(`7 · el signo de ${v} ya no es «${glifo}». Los tres glifos son los de la landing —«✕» y «✓» de SectionObjections, «−» U+2212—: cambiarlos por otros parecidos (x, -, ✔) rompe el que el lector ya vio ahí.`);
      }
    }
  }
  if (!/<span className="doc-hero-signo" aria-hidden="true">\{signoDe\(veredicto\)\}/.test(CSS)) {
    F("7 · el botón dejó de dibujar el signo, o el signo dejó de ser `aria-hidden`. El `aria-label` del <p> ya dice el veredicto entero: leer «equis» antes del rótulo lo empeora.");
  }

  // 7b · EL EYEBROW: solo dirección y comuna. La tipología y la superficie ya viven en
  // la ficha del depto y acá no decían nada que la ficha no dijera mejor.
  const iEye = CSS.indexOf('className="doc-hero-eyebrow-l"');
  const eye = iEye === -1 ? "" : CSS.slice(iEye, CSS.indexOf("</span>", iEye));
  if (!eye) F("7 · no se encontró el eyebrow del rediseño");
  else {
    for (const fuera of ["Tipología", "Superficie"]) {
      if (eye.includes(fuera)) {
        F(`7 · el eyebrow volvió a traer «${fuera}». §3 lo deja en dirección y comuna: eso ya vive en la ficha del depto.`);
      }
    }
    if (!/\{direccion && comuna &&/.test(eye)) {
      F("7 · el eyebrow dejó de mostrar la comuna junto a la dirección («Merced 562 · Santiago»). Sin dirección la comuna es el rótulo, y con dirección va al lado: nunca las dos veces.");
    }
  }

  // 7c · LA MODALIDAD PESA: un punto más que el eyebrow, y en negrita. Medido en el
  // DOM: eyebrow 12 px / 400, modalidad 13 px / 700.
  const reglaMod = CSS.match(/\.doc-dictamen \.doc-hero-modalidad\{([^}]*)\}/)?.[1] ?? "";
  const reglaEye = CSS.match(/\.doc-dictamen \.doc-hero-eyebrow\{([^}]*)\}/)?.[1] ?? "";
  const px = (r: string) => Number(r.match(/font-size:\s*([\d.]+)px/)?.[1] ?? NaN);
  if (!reglaMod) F("7 · la modalidad del eyebrow perdió su regla: vuelve a medir lo mismo que el resto");
  else {
    if (!(px(reglaMod) > px(reglaEye))) {
      F(`7 · la modalidad mide ${px(reglaMod)}px y el eyebrow ${px(reglaEye)}px: §3 la quiere un punto MÁS GRANDE, que es lo que la hace sostener el otro extremo de la línea.`);
    }
    if (!/font-weight:\s*[67]00/.test(reglaMod)) F("7 · la modalidad dejó de ir en negrita (§3)");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runHeroRedisenoTier(): { hard: number } {
  console.log("\n─── TIER HERO-REDISEÑO (contrato §3 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el filtro en su capa, el espectro sin veredicto y el botón con él, el grano en .16 overlay, el latido apagado por reduced-motion, el plumón blanco sin tocar --doc-hl, la banda en el archivo con los hallazgos ya sueltos, y la regla de apilado sin romper el .sr-only");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runHeroRedisenoTier();
  process.exit(hard ? 1 : 0);
}
