// ─────────────────────────────────────────────────────────────────────────────
// Catch-layer de voz chilena — post-LLM, compartido LTR + STR + AMBAS.
//
// Módulo PURO: sin red, sin DB, sin imports. Es el ÚNICO lugar donde vive el
// léxico. Cualquier forma nueva se agrega acá y en ningún otro archivo.
//
// POR QUÉ EXISTE
// ──────────────
// La directiva de prompt (§2.1 de analysis-voice-franco: tuteo neutro chileno,
// cero voseo) es ESTOCÁSTICA: medido en el ciclo editorial, 5 informes
// re-emitieron "commune"/"encontrás"/"negociás" en la primera pasada y la
// segunda limpió. Una regla que se cumple "casi siempre" no es una regla, es
// una tendencia. Esta es la capa que la vuelve invariante.
//
// DOS CAPAS CON CONTRATOS DISTINTOS (no intercambiables)
// ──────────────────────────────────────────────────────
//  1. LÉXICO CERRADO (voseo conocido + typos recurrentes) → DETECTA y CORRIGE.
//     Swap determinístico token a token, cero falsos positivos, cero reintento.
//     Es el patrón `despersonalizarMotor` de STR: garantiza que no llega al
//     usuario sin pagar una regeneración de 8.000 tokens.
//  2. MORFOLÓGICA (-és/-ís desconocidos) + pronombre "vos" → DETECTA, NO corrige.
//     No sabemos a qué tuteo mapea un verbo que no está en la tabla, así que
//     reescribir sería inventar. Estos hits son los que DISPARAN REINTENTO
//     (patrón del catch de "revenue" en ai-generation-str.ts).
//
// LA REGLA -ás: EXISTE, PERO CON DISCRIMINADOR (revisión 2026-08-17)
// ──────────────────────────────────────────────────────────────────
// La versión original de este módulo descartó toda regla -ás porque el futuro
// de tuteo termina igual que el presente de voseo: "comprarás", "tendrás",
// "verás" son tuteo IMPECABLE. El costo de esa decisión se midió en el re-censo
// del 16-ago-2026: el voseo -ás fuera del léxico escapaba ENTERO ("descartás",
// "eliminás", "fijás"), y 8 de las 10 ALTAs de voz del parque eran voseo.
//
// El discriminador que faltaba es morfológico y no necesita diccionario: el
// futuro es INFINITIVO + ás, así que SIEMPRE lleva "r" inmediatamente antes
// ("compra-r-ás", "tend-r-ás", "ve-r-ás", "sald-r-ás"). Excluir /rás$/ retira el
// futuro completo. Lo que queda —"descartás", "eliminás", "pensás"— es voseo o
// no es verbo, y los no-verbos son una lista corta y cerrada (NO_VERBOS_AS).
//
// El precio de la exclusión: el voseo cuya RAÍZ termina en "r" ("cerrás",
// "agarrás", "ahorrás") cae dentro de /rás$/ y el patrón no lo ve. Esos van por
// LÉXICO, donde además se corrigen sin pagar reintento. Medición sobre las 212
// prosas frescas del re-censo + mini-censo: recall 12/12 sobre el corpus real,
// 0 falsos positivos, 0 hits no corregibles.
//
// Lo que NO se hace (decisión de Fabrizio, 17-ago-2026): un último recurso que
// "quite la tilde" para el -ás desconocido. Sería correcto en los verbos que no
// diptongan y agramatical en los que sí ("pensás" → "pensas" en vez de
// "piensas"); la garantía se erosiona en cuanto entre un diptongante que no
// esté en tabla. Para el -ás desconocido el comportamiento correcto es DETECTAR
// y REINTENTAR: mejor un [VOZ-RESIDUAL] ruidoso en el log que una corrección
// silenciosa que publique otro error.
//
// LÍMITE CONOCIDO de la capa morfológica: si un -és/-ís desconocido viene
// precedido de determinante ("los parqués", "unos bebés") se omite por regla
// de contexto — ahí la forma es un sustantivo plural, no un verbo. Un clítico
// homógrafo ("los obtenés") cae en el mismo agujero; lo cubre el léxico, que
// no mira contexto.
// ─────────────────────────────────────────────────────────────────────────────

export type CapaVoz = "lexico" | "typo" | "morfologia" | "pronombre";

export interface VozHit {
  /** Path del string dentro del objeto de IA (ej. `conviene.respuestaDirecta_clp`). */
  path: string;
  /** El token tal como apareció, con su capitalización original. */
  token: string;
  capa: CapaVoz;
  /** Corrección determinística, o `null` si no la sabemos (→ dispara reintento). */
  sugerencia: string | null;
  /** Oración donde apareció, recortada. Alimenta el correctivo de alta saliencia. */
  contexto: string;
}

// ── Léxico cerrado: voseo → tuteo chileno ────────────────────────────────────
//
// Migrado desde `ai-generation-ambas.ts` (donde vivía como safety net SOLO del
// canal comparativo) y extendido con el vocabulario de inversión que faltaba.
// Tabla explícita y no patrón: así "demás", "país", "interés" o "estás"
// (irregular, idéntico en tuteo y voseo) no pueden dispararla nunca.
export const VOSEO_A_TUTEO: Readonly<Record<string, string>> = {
  // ── Indicativo presente ──
  aceptás: "aceptas",
  agarrás: "agarras",
  ahorrás: "ahorras",
  alquilás: "alquilas",
  apalancás: "apalancas",
  aportás: "aportas",
  apostás: "apuestas",
  aprendés: "aprendes",
  arreglás: "arreglas",
  arrendás: "arriendas",
  arriendás: "arriendas",
  arriesgás: "arriesgas",
  armás: "armas",
  asumís: "asumes",
  bajás: "bajas",
  buscás: "buscas",
  calculás: "calculas",
  // Raíz terminada en "r": /rás$/ (el discriminador del futuro) no las ve, así
  // que el léxico es su ÚNICA red. Corpus del re-censo: "cerrás" (d2a5b32e).
  cerrás: "cierras",
  chequeás: "chequeas",
  cobrás: "cobras",
  comparás: "comparas",
  completás: "completas",
  comprás: "compras",
  // Corpus del re-censo (7710a017, e42f9e9f): la capa morfológica SÍ la veía
  // (-és), pero sin entrada de léxico no había swap — solo un reintento que, al
  // no mejorar, publicaba el voseo. Acá se vuelve corrección de coste cero.
  comprometés: "comprometes",
  conseguís: "consigues",
  considerás: "consideras",
  consultás: "consultas",
  contenés: "contienes",
  controlás: "controlas",
  convertís: "conviertes",
  corregís: "corriges",
  corrés: "corres",
  cotizás: "cotizas",
  creés: "crees",
  cubrís: "cubres",
  cumplís: "cumples",
  debés: "debes",
  decidís: "decides",
  decís: "dices",
  definís: "defines",
  dejás: "dejas",
  describís: "describes",
  descartás: "descartas",
  // Observadas EN VIVO por la capa -ás nueva durante el Golden FULL del
  // 17-ago-2026 (GS-3 las emitió las tres): la capa las cazó y el reintento las
  // limpió. Pasan al léxico para que la próxima cuesten un swap y no una
  // regeneración de 8.000 tokens — el ciclo de vida que el módulo prescribe.
  descontás: "descuentas",
  desembolsás: "desembolsas",
  elegís: "eliges",
  eliminás: "eliminas",
  empezás: "empiezas",
  encontrás: "encuentras",
  entendés: "entiendes",
  entrás: "entras",
  escribís: "escribes",
  esperás: "esperas",
  estimás: "estimas",
  evaluás: "evalúas",
  exigís: "exiges",
  fijás: "fijas",
  financiás: "financias",
  firmás: "firmas",
  ganás: "ganas",
  gastás: "gastas",
  generás: "generas",
  hacés: "haces",
  insistís: "insistes",
  invertís: "inviertes",
  leés: "lees",
  llegás: "llegas",
  llevás: "llevas",
  mantenés: "mantienes",
  medís: "mides",
  metés: "metes",
  mirás: "miras",
  movés: "mueves",
  negociás: "negocias",
  obtenés: "obtienes",
  ocupás: "ocupas",
  operás: "operas",
  pagás: "pagas",
  pasás: "pasas",
  pedís: "pides",
  pensás: "piensas",
  perdés: "pierdes",
  permitís: "permites",
  ponés: "pones",
  preferís: "prefieres",
  proyectás: "proyectas",
  querés: "quieres",
  quedás: "quedas",
  recibís: "recibes",
  recuperás: "recuperas",
  repartís: "repartes",
  respondés: "respondes",
  resistís: "resistes",
  revisás: "revisas",
  sabés: "sabes",
  sacás: "sacas",
  salís: "sales",
  seguís: "sigues",
  sentís: "sientes",
  simulás: "simulas",
  sostenés: "sostienes",
  subís: "subes",
  sumás: "sumas",
  tenés: "tienes",
  terminás: "terminas",
  // "tomás" NO entra: colisiona con el nombre propio Tomás y el swap lo
  // renombraría en pantalla. El imperativo "tomá" sí, que es inequívoco.
  transferís: "transfieres",
  usás: "usas",
  validás: "validas",
  vendés: "vendes",
  venís: "vienes",
  verificás: "verificas",
  vivís: "vives",
  volvés: "vuelves",

  // ── Imperativos (vocal acentuada final) ──
  ahorrá: "ahorra",
  andá: "anda",
  anotá: "anota",
  aportá: "aporta",
  bajá: "baja",
  buscá: "busca",
  calculá: "calcula",
  cerrá: "cierra",
  chequeá: "chequea",
  comprá: "compra",
  compará: "compara",
  comprometé: "compromete",
  conseguí: "consigue",
  considerá: "considera",
  cotizá: "cotiza",
  decí: "di",
  dejá: "deja",
  descartá: "descarta",
  eliminá: "elimina",
  esperá: "espera",
  evaluá: "evalúa",
  exigí: "exige",
  fijá: "fija",
  fijate: "fíjate",
  firmá: "firma",
  guardá: "guarda",
  hacé: "haz",
  invertí: "invierte",
  mirá: "mira",
  negociá: "negocia",
  pagá: "paga",
  pedí: "pide",
  pensá: "piensa",
  ponete: "ponte",
  revisá: "revisa",
  sacá: "saca",
  subí: "sube",
  tomá: "toma",
  validá: "valida",
  // Corpus del mini-censo (7710a017, "Verificá"): el presente "verificás" estaba
  // en tabla desde el inicio; el imperativo faltaba y es la forma que más aparece
  // en las cajas accionables.
  verificá: "verifica",
  vendé: "vende",
  vení: "ven",

  // ── Voseo SIN TILDE (el modelo lo desliza y el acento no llega) ──
  //
  // Solo verbos que DIPTONGAN en tuteo (e→ie, o→ue): ahí la forma sin tilde no
  // existe en español, así que la entrada no puede pisar prosa correcta. El caso
  // que lo destapó fue "perdes meses de estabilización" en una prosa v4, que la
  // capa morfológica no ve (busca terminaciones acentuadas) y el léxico no tenía.
  //
  // Los verbos que NO diptongan quedan FUERA a propósito: "compras", "miras" o
  // "aportas" son tuteo impecable, y una entrada así rompería prosa buena —
  // mismo criterio que la nota de arriba sobre la regla genérica -ás.
  // "costas" también queda fuera: es sustantivo ("las costas", "la costa").
  contenes: "contienes",
  devolves: "devuelves",
  dormis: "duermes",
  empezas: "empiezas",
  encontras: "encuentras",
  entendes: "entiendes",
  invertis: "inviertes",
  mantenes: "mantienes",
  moves: "mueves",
  obtenes: "obtienes",
  pensas: "piensas",
  perdes: "pierdes",
  podes: "puedes",
  preferis: "prefieres",
  queres: "quieres",
  recordas: "recuerdas",
  resolves: "resuelves",
  sentis: "sientes",
  sostenes: "sostienes",
  tenes: "tienes",
  venis: "vienes",
  volves: "vuelves",
};

// ── Typos recurrentes con corrección conocida ────────────────────────────────
//
// Los mismos que los prompts LTR/STR ya piden auto-chequear (y que el modelo
// igual desliza). Cada entrada tiene UNA corrección inequívoca; los errores de
// concordancia ("la gastos comunes", "está parejo") NO viven acá porque no son
// un swap de token y reescribirlos a ciegas rompe la oración.
export const TYPOS_A_CORRECTO: Readonly<Record<string, string>> = {
  commune: "comuna",
  communes: "comunas",
  delgas: "delegas",
  autoggestión: "autogestión",
  autoggestion: "autogestión",
  illíquido: "ilíquido",
  illíquida: "ilíquida",
};

// ── Excepciones de la capa morfológica ───────────────────────────────────────
//
// Palabras españolas terminadas en -és / -ís que NO son voseo: gentilicios,
// sustantivos y plurales de agudas en -é/-í. Sin esta lista, "interés",
// "después" o "parqués" (¡vocabulario inmobiliario!) quemarían un reintento.
const EXCEPCIONES_MORFOLOGIA: ReadonlySet<string> = new Set([
  // sustantivos y adverbios
  "después", "través", "interés", "revés", "estrés", "arnés", "ciempiés",
  "puntapiés", "parqués", "cafés", "bebés", "purés", "canapés", "chalés",
  "clichés", "carnés", "bufés", "cachés", "tés", "país", "anís", "chasís",
  "maravedís", "marqués", "burgués", "cortés",
  // gentilicios frecuentes
  "inglés", "francés", "japonés", "portugués", "holandés", "escocés",
  "irlandés", "danés", "finlandés", "libanés", "aragonés", "montañés",
  // nombres propios
  "andrés", "inés", "ginés", "moisés", "valdés",
  // subjuntivo de tuteo terminado en -és: correcto, no voseo. Medido como falso
  // positivo real sobre las prosas del re-censo (432585ad).
  "estés", "dés",
]);

/**
 * -ás que NO son verbo. Lista cerrada y corta: con /rás$/ ya fuera (el futuro de
 * tuteo completo), lo único que queda por excluir son adverbios, preposiciones y
 * un par de sustantivos. "estás" entra acá porque es idéntico en tuteo y voseo
 * (irregular), igual que el criterio con que "estás" quedó fuera del léxico.
 */
const NO_VERBOS_AS: ReadonlySet<string> = new Set([
  "quizás", "jamás", "además", "atrás", "detrás", "demás", "compás", "estás",
  "vas", "das", "más", "gas", "tras", "sacapuntás",
]);

/** Determinantes: si preceden al candidato, es sustantivo plural, no verbo. */
const DETERMINANTES: ReadonlySet<string> = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "del", "al", "de",
  "mi", "tu", "su", "mis", "tus", "sus", "este", "esta", "estos", "estas",
  "ese", "esa", "esos", "esas", "aquel", "aquellos", "otro", "otros", "otras",
  "varios", "varias", "algunos", "algunas", "muchos", "muchas", "cada",
  "cualquier", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
  "nueve", "diez",
]);

// Lookbehind/lookahead negativos sobre letras ASCII + acentos hispanos. Más
// confiable que `\b`, que NO reconoce vocales acentuadas como word chars
// (entonces el `\b` después de "mirá" no marca límite y la regex falla).
const NO_LETRA_ANTES = "(?<![A-Za-zÀ-ÿ])";
const NO_LETRA_DESPUES = "(?![A-Za-zÀ-ÿ])";
const TOKEN_RE = /[A-Za-zÀ-ÿ]+/g;

/** Tabla única de swaps determinísticos (léxico + typos). */
const SWAPS: Readonly<Record<string, string>> = { ...VOSEO_A_TUTEO, ...TYPOS_A_CORRECTO };

// Alternancia ordenada por largo desc: sin esto "subí" podría ganarle a "subís".
const SWAP_RE = new RegExp(
  `${NO_LETRA_ANTES}(${Object.keys(SWAPS).sort((a, b) => b.length - a.length).join("|")})${NO_LETRA_DESPUES}`,
  "gi",
);

/** Conserva la mayúscula inicial del original en el reemplazo. */
function conCaja(original: string, reemplazo: string): string {
  if (!original || original[0] === original[0].toLowerCase()) return reemplazo;
  return reemplazo.charAt(0).toUpperCase() + reemplazo.slice(1);
}

/** Oración que contiene `idx`, recortada para el correctivo. */
function oracionDe(texto: string, idx: number): string {
  const ini = Math.max(0, texto.lastIndexOf(".", idx) + 1);
  const finRel = texto.indexOf(".", idx);
  const fin = finRel === -1 ? texto.length : finRel + 1;
  return texto.slice(ini, fin).trim().slice(0, 180);
}

/** Aplana todos los strings del objeto con su path (espejo de collectStrings STR). */
function recolectarStrings(node: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof node === "string") { out.push({ path, value: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => recolectarStrings(n, `${path}[${i}]`, out)); return; }
  if (node && typeof node === "object") {
    Object.entries(node as Record<string, unknown>).forEach(([k, v]) =>
      recolectarStrings(v, path ? `${path}.${k}` : k, out),
    );
  }
}

/** Hits de UN string. Exportado para tests y para escanear prosa suelta. */
export function scanVozChilenaTexto(texto: string, path = ""): VozHit[] {
  const hits: VozHit[] = [];
  if (!texto) return hits;

  // Capa 1 — léxico cerrado + typos (corregibles).
  SWAP_RE.lastIndex = 0;
  for (let m = SWAP_RE.exec(texto); m !== null; m = SWAP_RE.exec(texto)) {
    const token = m[1];
    const sugerencia = conCaja(token, SWAPS[token.toLowerCase()]);
    hits.push({
      path,
      token,
      capa: token.toLowerCase() in TYPOS_A_CORRECTO ? "typo" : "lexico",
      sugerencia,
      contexto: oracionDe(texto, m.index),
    });
  }

  // Capa 2 — morfología -és/-ís/-ás desconocida + pronombre "vos" (NO corregibles).
  const tokens: { t: string; idx: number }[] = [];
  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(texto); m !== null; m = TOKEN_RE.exec(texto)) {
    tokens.push({ t: m[0], idx: m.index });
  }
  for (let i = 0; i < tokens.length; i++) {
    const { t, idx } = tokens[i];
    const low = t.toLowerCase();
    if (low === "vos") {
      hits.push({ path, token: t, capa: "pronombre", sugerencia: null, contexto: oracionDe(texto, idx) });
      continue;
    }
    if (low in SWAPS) continue;                      // ya lo tomó la capa 1
    // -ás: voseo salvo futuro de tuteo (/rás$/ = infinitivo + ás) y no-verbos.
    // Ver la nota de cabecera "LA REGLA -ás".
    const esVoseoAs = /ás$/.test(low) && low.length >= 5 && !/rás$/.test(low) && !NO_VERBOS_AS.has(low);
    if (!esVoseoAs && (!/(és|ís)$/.test(low) || low.length < 5)) continue;
    if (EXCEPCIONES_MORFOLOGIA.has(low)) continue;
    const previo = i > 0 ? tokens[i - 1].t.toLowerCase() : "";
    if (DETERMINANTES.has(previo)) continue;         // "los parqués" = sustantivo
    hits.push({ path, token: t, capa: "morfologia", sugerencia: null, contexto: oracionDe(texto, idx) });
  }

  return hits;
}

/**
 * Escanea TODOS los strings de un objeto de IA. Devuelve la lista de hits
 * (vacía = voz limpia). No muta nada.
 */
export function scanVozChilena(node: unknown): VozHit[] {
  const strings: { path: string; value: string }[] = [];
  recolectarStrings(node, "", strings);
  return strings.flatMap(({ path, value }) => scanVozChilenaTexto(value, path));
}

/** Hits que NINGÚN swap puede arreglar → los únicos que justifican un reintento. */
export function hitsQueExigenReintento(hits: VozHit[]): VozHit[] {
  return hits.filter((h) => h.sugerencia === null);
}

/** Cita de alta saliencia para el correctivo del reintento (patrón CATCH-ROOT-A). */
export function correctivoVoz(hits: VozHit[]): string {
  const citas = hits.slice(0, 4).map((h) => `"${h.token}" en «${h.contexto}»`).join(" · ");
  return (
    `\n\n⚠️ CORRECCIÓN DE VOZ — la versión anterior usó formas que no son español de Chile: ${citas}. ` +
    `Franco habla en tuteo neutro chileno: la segunda persona singular NO lleva tilde final ` +
    `("tú compras", "tienes", "puedes", "inviertes", "prefieres") y el pronombre es "tú", nunca "vos". ` +
    `Reescribe el JSON COMPLETO en tuteo chileno, sin cambiar ninguna cifra ni el veredicto.`
  );
}

/** Reemplaza en UN string. Exportado para prosa suelta (canal comparativo). */
export function sanitizeVozChilenaTexto(texto: string): string {
  if (!texto) return texto;
  return texto.replace(SWAP_RE, (_m, token: string) => conCaja(token, SWAPS[token.toLowerCase()]));
}

/**
 * Red final: aplica los swaps determinísticos a TODOS los strings del objeto.
 * Devuelve una copia (no muta el original). Es word-count neutro —cada swap es
 * 1 token por 1 token—, así que corre después del guard de presupuesto sin
 * invalidarlo.
 */
export function sanitizeVozChilena<T>(node: T, logger: (msg: string) => void = () => {}): T {
  let hits = 0;
  const walk = (n: unknown): unknown => {
    if (typeof n === "string") {
      const out = sanitizeVozChilenaTexto(n);
      if (out !== n) hits++;
      return out;
    }
    if (Array.isArray(n)) return n.map(walk);
    if (n && typeof n === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) out[k] = walk(v);
      return out;
    }
    return n;
  };
  const result = walk(node) as T;
  if (hits > 0) logger(`[VOZ-CHILENA-CORREGIDA] ${hits} campo(s) con voseo/typo reescritos a tuteo chileno`);
  return result;
}
