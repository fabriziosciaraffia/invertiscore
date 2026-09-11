// ============================================================================
// GOLDEN · LA RECOMENDACIÓN Y LOS CAPÍTULOS — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §5 y §7.
//
// Fija SIETE cosas:
//
//   1. EL FONDO DE LA RECOMENDACIÓN ES LA ÚNICA PIEZA QUE DEPENDE DEL VEREDICTO. El
//      hero usa el mismo espectro para los tres precisamente para que esta caja pueda
//      no hacerlo. Si las dos cambian de color, el color deja de significar algo.
//
//   2. EL FILTRO EN SU CAPA, igual que en el hero: sobre la caja se come el texto.
//
//   3. EL COSTO DEL DÍA UNO SIEMPRE ACOMPAÑA AL MIX. Sin esa línea el mix miente por
//      omisión: «pon 10 puntos más de pie» suena gratis hasta que dice cuánta plata es.
//
//   4. SIN FIRMA Y SIN «análisis generado por IA» en la card nueva (§5): la
//      recomendación es del informe, no de un narrador.
//
//   5. EL RÓTULO DE LA ECUACIÓN ES FIJO —96 px, 78 en móvil—. Con `auto` cada fila
//      alinea su valor en un sitio distinto y la columna deja de leerse como columna.
//
//   6. LOS CAPÍTULOS PIERDEN EL ROMANO Y CONSERVAN EL FOCO. `.hall-head` tenía
//      `:focus-visible` desde antes del rediseño; es lo que una reescritura de la fila
//      deja caer sin que se note.
//
//   7. LA PUERTA DE LOS CAPÍTULOS NO CAMBIA. Son un acordeón que expande en el mismo
//      lugar, no un pop-up. `.fila-nav` cambia la FILA, no adónde lleva.
//
// Corre dentro del QUICK (tier "recomendacion-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/recomendacion-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
/** NORMALIZA CRLF. Los archivos del repo se guardan con CRLF en Windows, así que
 *  cualquier ancla escrita con `\n` —«\n  }\n  return (»— no matchea nunca y el guard
 *  se declara «no encontré la rama» con el árbol sano. Pasó acá. */
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const POS = leer("src/components/analysis/shared/PosicionFranco.tsx");
const BLO = leer("src/components/analysis/shared/LoQueHariaYoBloque.tsx");
const HERO = leer("src/components/analysis/HeroLTR.tsx");
const ACO = leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
const CAPS = leer("src/components/analysis/CapitulosInversion.tsx");

/** Un bloque del rediseño, sin comentarios (llevan comas y ensucian los selectores). */
function bloqueDe(rotulo: string): string {
  const marca = CSS.indexOf(rotulo);
  if (marca === -1) return "";
  const i = CSS.lastIndexOf("/*", marca);
  const j = CSS.indexOf("═══ REDISEÑO ·", marca);
  return CSS.slice(i, j === -1 ? i + 7000 : j).replace(/\/\*[\s\S]*?\*\//g, "");
}
const REC = bloqueDe("REDISEÑO · LA RECOMENDACIÓN");
const CAP = bloqueDe("REDISEÑO · LOS CAPÍTULOS");
if (!REC) F("0 · no existe el bloque «REDISEÑO · LA RECOMENDACIÓN»");
if (!CAP) F("0 · no existe el bloque «REDISEÑO · LOS CAPÍTULOS»");

function reglaDe(sel: string, txt: string): string | null {
  for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.includes(sel)) return m[2];
  }
  return null;
}

// ── 1 · el fondo depende del veredicto, y es el ÚNICO que lo hace ─────────
{
  const bg = reglaDe(".doc-r2 .rec-bg", REC);
  if (!bg) F("1 · no existe la capa de fondo de la recomendación");
  else if (!/var\(--verdict-deep\)/.test(bg)) {
    F("1 · el fondo de la recomendación dejó de depender del veredicto. §5: es la ÚNICA pieza que lo hace, y el hero usa el mismo espectro para los tres justamente por eso.");
  }
  // Y el hero NO lo hace: si los dos cambian de color, el color deja de significar algo.
  const heroBg = reglaDe(".doc-r2 .doc-hero-bg", bloqueDe("REDISEÑO · EL HERO"));
  if (heroBg && /var\(--verdict/.test(heroBg)) {
    F("1 · el fondo del HERO pasó a depender del veredicto. Entonces son dos, y §5 dice que la recomendación es la única.");
  }
}

// ── 2 · el filtro en su capa ──────────────────────────────────────────────
for (const m of REC.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (!/filter\s*:/.test(m[2])) continue;
  const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (sels.every((s) => s.endsWith(".rec-bg"))) continue;
  F(`2 · hay un «filter» fuera de la capa de fondo de la recomendación, en «${sels.join(", ").slice(0, 70)}». Crea contexto de apilado y se come el texto.`);
}

// ── 3 · el costo del día uno acompaña al mix ──────────────────────────────
{
  if (!/mix\.costo && <p className="rec-cost">/.test(BLO)) {
    F("3 · el costo del día uno dejó de dibujarse bajo el mix. §5: «sin esa línea el mix miente por omisión».");
  }
  if (!reglaDe(".doc-r2 .rec-cost", REC)) F("3 · no existe el estilo del costo del día uno");
}

// ── 4 · la card nueva no lleva firma ──────────────────────────────────────
{
  // ACOTADO AL BLOQUE, no «hasta donde caiga»: la primera versión cortaba con un
  // `indexOf` que no matcheaba y el slice se comía la rama VIEJA, que sí lleva firma —
  // o sea daba rojo con el árbol sano. El cierre de la rama es su `}` seguido del
  // `return (` del camino de siempre.
  const i = POS.indexOf("if (rediseno) {");
  const j = i === -1 ? -1 : POS.indexOf("\n  }\n  return (", i);
  // SIN COMENTARIOS: el comentario que explica por qué la card no lleva la línea de la
  // IA contiene la línea de la IA, y el guard se acusaba a sí mismo.
  const rama = i === -1 || j === -1 ? "" : POS.slice(i, j).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (!rama) F("4 · no se encontró la rama del rediseño en PosicionFranco");
  else {
    if (/pos-firma/.test(rama)) F("4 · la card de §5 volvió a dibujar la firma");
    if (/generado por IA/.test(rama)) F("4 · la card de §5 volvió a decir «análisis generado por IA»: pide leerla como una opinión");
    if (!/rec-cta/.test(rama)) F("4 · la card de §5 perdió su CTA");
  }
  const cta = reglaDe(".doc-r2 .rec-cta", REC);
  if (!cta) F("4 · no existe el estilo del CTA");
  else if (!/background:\s*#fff/.test(cta)) F("4 · el CTA dejó de ser un botón BLANCO SÓLIDO (§5), que es lo que lo distingue de un enlace");
}

// ── 5 · el rótulo de la ecuación es fijo ──────────────────────────────────
{
  const fila = reglaDe(".doc-r2 .rec-row", REC);
  if (!fila) F("5 · no existe la fila de la ecuación");
  else if (!/grid-template-columns:\s*96px\s+1fr/.test(fila)) {
    F("5 · el rótulo de la ecuación dejó de ser de 96 px fijos. Con «auto» cada fila alinea su valor en un sitio distinto y la columna de valores deja de leerse como columna.");
  }
  const movil = REC.slice(REC.indexOf("max-width: 767px"));
  if (!/grid-template-columns:\s*78px\s+1fr/.test(movil)) F("5 · el rótulo no baja a 78 px en móvil");
  const dcto = reglaDe(".doc-r2 .rec-dcto", REC);
  if (dcto && !/font-size:\s*30px/.test(dcto)) F("5 · el descuento dejó de ir a 30 px: más grande compite con la cifra del hero");
}

// ── 6 · los capítulos: sin romano, con foco ───────────────────────────────
{
  const num = reglaDe(".doc-r2 .hall.cap .num", CAP);
  if (!num || !/display:\s*none/.test(num)) F("6 · el número romano volvió a la fila de capítulo (§7 lo saca explícitamente)");
  if (!reglaDe(".doc-r2 .hall.cap .hall-head:focus-visible", CAP)) {
    F("6 · la fila de capítulo del rediseño no declara :focus-visible");
  }
  // Y el de siempre sigue en pie: es el que el tier de la parte 3 fija.
  if (!/\.hall-head:focus-visible/.test(ACO)) F("6 · «.hall-head» perdió su :focus-visible, que tenía desde antes del rediseño");
  const head = reglaDe(".doc-r2 .hall.cap .hall-head", CAP);
  if (!head) F("6 · no existe la regla de la fila de capítulo");
  else if (!/grid-template-columns:\s*1fr auto auto/.test(head)) F("6 · la fila de capítulo no usa la rejilla «1fr auto auto» de la primitiva");
}

// ── 7 · la puerta no cambia ───────────────────────────────────────────────
{
  // El acordeón sigue expandiendo en el mismo lugar. Si alguien lo convierte en modal,
  // eso es el arco de los pop-ups y no entra de pasada por un cambio de fila.
  if (!/\{open && f\.cuerpo && \(/.test(ACO)) {
    F("7 · los capítulos dejaron de expandirse en el mismo lugar. `.fila-nav` cambia la FILA, no adónde lleva; convertirlos en pop-up es un arco propio.");
  }
  // LA LLAMADA, no el import. `/useRediseno/` a secas matchea la línea del `import`, así
  // que con `const rediseno = false` puesto el guard seguía verde: el gate estaba muerto
  // y el tier no lo veía. Se exige la asignación desde el hook.
  for (const [arch, nombre] of [[POS, "PosicionFranco"], [BLO, "el bloque de la ecuación"]] as const) {
    if (!/const rediseno = useRediseno\(\)/.test(arch)) {
      F(`7 · ${nombre} dejó de leer el interruptor con el hook. Es una pieza COMPARTIDA con STR: sin el gate, STR se lleva el rediseño puesto.`);
    }
  }
  if (!/rec-card/.test(POS)) F("7 · PosicionFranco perdió la card del rediseño");
  // La bajada distingue «sin mix» de «sin salida»: con filas, esas filas SON salidas.
  if (!/cruzan > 0/.test(HERO)) {
    F("7 · la bajada volvió a tratar «sin mix» como «sin salida». Medido: decía «No hay forma de que este departamento convenga» encima de «Bajar el precio −24,1%».");
  }
}

// ── 8 · la recomendación apunta SIEMPRE a Comprar ────────────────────────
{
  // §5: «Nunca se muestra un mix que solo llega al escalón intermedio». Un mix que deja
  // en AJUSTA no es una recomendación — es lo que se probó, y vive en el pop-up. La card
  // cae al estado SIN SALIDA. El motor NO se toca: el mix se sigue calculando y el
  // pop-up lo sigue mostrando; lo que cambia es qué lee primero el lector.
  if (!/mix\.destino !== "COMPRAR"/.test(BLO)) {
    F("8 · la card volvió a dibujar la ecuación de un mix que no llega a COMPRAR. §5: el escalón intermedio no es una recomendación, va al pop-up.");
  }
  if (!/mix && mix\.destino === "COMPRAR"/.test(HERO)) {
    F("8 · la bajada volvió a prometer el destino del mix sea cual sea. Con un mix al escalón decía «Para que el veredicto pase a Ajustar», que es justo lo que §5 prohíbe.");
  }
  if (!/Ver qué se probó/.test(HERO)) {
    F("8 · el CTA del estado sin salida dejó de nombrar lo que hay del otro lado: no quedan ajustes, queda ver qué se probó");
  }
}

// ── 9 · la fila de capítulo: sin bajada, disco con «›», cifra apellidada ──
{
  const ksub = reglaDe(".doc-r2 .hall.cap .ksub", CAP);
  if (!ksub || !/display:\s*none/.test(ksub)) F("9 · la bajada volvió a la fila de capítulo (§7: la fila es título y cifra; el ksub es el cuerpo del capítulo)");
  const chev = reglaDe(".doc-r2 .hall.cap .chev::after", CAP);
  if (!chev) F("9 · el disco no dibuja su carácter propio");
  else if (!chev.includes("›")) {
    F(`9 · el disco dejó de llevar «›»: «${chev.slice(0, 50)}». El «↓» dice «esto se despliega»; «›» dice «esto lleva a algo», que es lo que la primitiva promete. Ojo con escribirlo como escape hexadecimal de CSS: pasado por un script de Python el prefijo se lee como octal y sale una «A» (medido en el DOM).`);
  }
  // LA CIFRA CON APELLIDO. En la fila de capítulo el título es una pregunta y la cifra
  // vive al otro extremo: «4,3%» solo no dice de qué. En las tarjetas de cifra y de zona
  // el rótulo va a 9 px ENCIMA del valor —medido—, así que ahí la cifra va sola.
  const APELLIDOS = ["Cap rate", "Flujo", "Precio", "Plusvalía", "Resultado"];
  for (const a of APELLIDOS) {
    if (!CAPS.includes(`conApellido(rediseno, "${a}"`)) {
      F(`9 · la cifra del capítulo perdió su apellido «${a}». Un número sin apellido no se entiende solo salvo que el contexto lo dé pegado, y acá no lo da.`);
    }
  }
  if (!/rediseno \?/.test(CAPS)) F("9 · el apellido dejó de estar detrás del interruptor: el camino de siempre lleva la cifra pelada");
}

// ── 10 · la ecuación: rótulo de una palabra y el «+» que no queda solo ────
{
  if (!/rotuloCorto \?\? f\.titulo/.test(BLO)) {
    F("10 · la ecuación volvió a usar el título largo. «Cuánto aguanta el veredicto» en una columna de 96 px se parte en tres líneas.");
  }
  if (!/rotuloCorto: "Aguanta"/.test(leer("src/lib/lo-que-haria-yo.ts")) || !/rotuloCorto: "Verifica"/.test(leer("src/lib/lo-que-haria-yo.ts"))) {
    F("10 · las filas de COMPRAR perdieron su rótulo de una palabra");
  }
  if (!/rec-chip-g/.test(BLO) || !reglaDe(".doc-r2 .rec-chip-g", REC)) {
    F("10 · el «+» volvió a ir suelto entre los dos chips. A 390 px el salto de línea cae justo antes y el signo queda solo arriba del segundo chip, sumando con la nada (medido).");
  }
}

// ── 11 · «Resultado» también sin mix, cuando las filas cruzan ─────────────
{
  // EL USO, no la declaración: `/mostrarResultado/` a secas matchea el `const`, así que
  // con `{false && (` puesto el guard seguía verde — la fila no se dibujaba y el tier no
  // lo veía. Es la misma trampa que con `useRediseno` y el import.
  if (!BLO.includes("{mostrarResultado && (")) {
    F("11 · la rama sin mix volvió a no dibujar «Resultado». Cuando hay filas, esas filas SON salidas —palancas que cruzan solas, medidas contra COMPRAR— y la transición es tan cierta como con mix.");
  }
  if (!/!soloEscalon && veredicto !== "COMPRAR" && filas\.length > 0/.test(BLO)) {
    F("11 · la condición de «Resultado» sin mix cambió. No va en COMPRAR —ya está ahí— ni en sin salida —no se llega, que es lo que dice—.");
  }
}

// ── 12 · las palancas solas y el mix se leen como ALTERNATIVAS ───────────
{
  const LIB = leer("src/lib/lo-que-haria-yo.ts");
  // Conviven en 302 de las 1.038 filas LTR no-COMPRAR del parque (medido 11-sep-2026), y
  // hasta 4c la card con mix dibujaba SOLO el mix: las palancas que cruzan por su cuenta
  // no se veían. Puestas juntas sin rótulo se leen como una receta de pasos, y cada una
  // llega sola.
  if (!/const solas = filas\.filter\(\(f\) => f\.rotuloCorto\)/.test(BLO)) {
    F("12 · la card con mix dejó de dibujar las palancas que cruzan solas. Son alternativas al mix, no un camino distinto que se esconde.");
  }
  if (!BLO.includes("{solas.map(")) F("12 · las filas de palancas solas no se montan en la rama del mix");
  if (!/<span className="rec-k">Con lo tuyo<\/span>/.test(BLO)) {
    F("12 · el rótulo del mix volvió a «Cambias». «Con lo tuyo» es lo que lo distingue de los caminos que dependen del vendedor o del mercado.");
  }
  for (const [palanca, rotulo] of [["precio", "Solo el precio"], ["arriendo", "Solo el arriendo"], ["adr", "Solo la tarifa"], ["gestion", "Solo la gestión"]] as const) {
    if (!LIB.includes(`${palanca}: "${rotulo}"`)) {
      F(`12 · falta o cambió el rótulo de alternativa de «${palanca}»: se esperaba «${rotulo}». El artículo va escrito y no derivado — «tarifa» y «gestión» son femeninas.`);
    }
  }
  // Y el tachado no repite lo que la fila «Solo el precio» ya dice.
  if (!/mix\.contraste && solas\.length === 0/.test(BLO)) {
    F("12 · el tachado del contraste volvió a dibujarse junto a las filas solas: repetiría la misma cifra dos veces en la misma card");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRecomendacionRedisenoTier(): { hard: number } {
  console.log("\n─── TIER RECOMENDACIÓN-REDISEÑO (contrato §5 y §7 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el fondo por veredicto solo en la recomendación, el filtro en su capa, el costo del día uno con el mix, la card sin firma y con CTA blanco, el rótulo a 96/78 px, los capítulos sin romano y con foco, la puerta intacta detrás del interruptor, la recomendación apuntando SIEMPRE a Comprar, la fila de capítulo sin bajada y con la cifra apellidada, «Resultado» también sin mix, y las palancas solas junto al mix como alternativas");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRecomendacionRedisenoTier();
  process.exit(hard ? 1 : 0);
}
