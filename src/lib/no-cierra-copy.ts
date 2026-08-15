// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO CIERRA (STR) — copy determinístico de los motivos del veredicto.
//
// Fuente única del texto que traduce los brazos de gate (`gates.motivos`, tipados en
// engines/short-term-score.ts) a la lectura que le sirve al usuario. Lo consumen el
// prompt de IA y las superficies; nadie vuelve a escribir estas frases a mano.
//
// POR QUÉ FAMILIAS Y NO UNA FRASE POR BRAZO
// ─────────────────────────────────────────
// El patrón dominante del corpus es `beInviable + flujoSevero + capRateMinimo` (9 de
// los 11 casos con 3+ motivos). Enumerarlos como tres razones distintas sería narrar
// la mecánica del motor (analysis-voice-franco §1.1 y A1): son TRES VISTAS DE LA MISMA
// FALLA — el arriendo corto no da para lo que costó el departamento. El usuario no
// tiene tres problemas, tiene uno grande visto desde tres ángulos.
//
// Por eso los brazos se agrupan en familias semánticas y lo que se cuenta —y se
// narra— son las familias, no los brazos. Con una sola familia la frase es la lectura
// de esa causa; con dos o más, el texto nombra explícitamente que no es un supuesto
// suelto el que falla.
//
// VOZ: tuteo neutro chileno. Prohibido el vocabulario del motor ("gate", "brazo",
// "override", "banda"): el usuario ve consecuencias, no mecánica (A11).
// ─────────────────────────────────────────────────────────────────────────────

import type { BrazoSTR } from "./engines/short-term-score";

export type FamiliaMotivo = "regulacion" | "ingreso" | "bolsillo" | "vsLargo";

/**
 * Brazo → familia. Cada brazo cae en UNA sola familia, la de su lectura dominante.
 *
 * `g1_flujoSevero` (flujo < −$250.000 Y sin ventaja sobre el largo) toca dos temas;
 * se clasifica en "bolsillo" porque esa es la parte que el usuario vive todos los
 * meses — la comparación contra el largo ya tiene su propia familia y su propio brazo.
 */
const FAMILIA_DE: Record<BrazoSTR, FamiliaMotivo> = {
  g1_regulacion: "regulacion",
  g1_beInviable: "ingreso",
  g1_capRateMinimo: "ingreso",
  g2_beApretado: "ingreso",
  g1_cocSevero: "bolsillo",
  g1_flujoSevero: "bolsillo",
  g2_cocFuerte: "bolsillo",
  g2_flujoSinHorizonte: "bolsillo",
  g2_ltrGana: "vsLargo",
};

/** Orden de presentación: primero lo que cierra la puerta, después lo que aprieta. */
const ORDEN_FAMILIA: FamiliaMotivo[] = ["regulacion", "ingreso", "bolsillo", "vsLargo"];

/**
 * Lectura de cada familia. Frase corta, en consecuencia vivida, sin cifras: los montos
 * ya viven en las cards y en los hallazgos, y repetirlos acá sería recitación (A1).
 */
// CRITERIO DE REDACCIÓN: describir el HECHO, no nombrar el CONCEPTO. El lector llega
// con 30% de atención y no comparte nuestro vocabulario. La versión anterior decía
// "el corto", "el aporte mensual", "sin que el horizonte lo devuelva" — tres etiquetas
// internas que obligan a traducir antes de entender. Se reemplazan por lo que
// efectivamente pasa: "arrendando por día", "pones plata de tu bolsillo todos los
// meses", "ni la venta a 10 años alcanza a devolvértela".
//
// Cláusula = la frase pelada, sin apertura, pensada para concatenarse con otra.
const CLAUSULA: Record<FamiliaMotivo, string> = {
  regulacion: "el edificio no permite arriendo por días",
  ingreso: "lo que puede facturar arrendando por día no da para su precio",
  bolsillo: "pones plata de tu bolsillo todos los meses que ni la venta a 10 años alcanza a devolverte",
  vsLargo: "arrendarlo a un arrendatario fijo te dejaría más plata y con menos trabajo",
};

/**
 * Frase COMPLETA cuando la familia es la única causa. No se arma concatenando la
 * cláusula con una apertura genérica: cada una está escrita entera para que lea bien
 * sola, que es como la ve el 15% del parque con una sola causa.
 */
const FRASE_SOLA: Record<FamiliaMotivo, string> = {
  regulacion:
    "Acá no se trata de números: el edificio no permite arriendo por días, así que el negocio no se puede hacer como está planteado.",
  ingreso:
    "No cierra por una razón concreta: lo que este depto puede facturar arrendando por día no da para su precio.",
  bolsillo:
    "No cierra por una razón concreta: pones plata de tu bolsillo todos los meses, y ni la venta a 10 años alcanza a devolvértela.",
  vsLargo:
    "No cierra por una razón concreta: arrendarlo a un arrendatario fijo te deja más plata que arrendarlo por días, y con bastante menos trabajo.",
};

/**
 * Frases escritas a medida para las combinaciones que EXISTEN en el parque. Medido
 * sobre los 96 análisis STR: 48 sin causa · 33 ingreso+bolsillo · 12 ingreso · 3
 * bolsillo. O sea la única combinación real es `ingreso+bolsillo`, y se merece una
 * frase propia en vez de dos cláusulas pegadas con "y además".
 *
 * Clave = familias activas unidas por "+" en el orden de ORDEN_FAMILIA.
 */
const FRASE_COMBINADA: Record<string, string> = {
  "ingreso+bolsillo":
    "Lo que este depto puede facturar arrendando por día no da para su precio: la renta que deja es muy baja, y encima pones plata de tu bolsillo todos los meses que ni la venta a 10 años alcanza a devolverte.",
};

/**
 * Etiqueta breve para chips/tablas. Mismo filtro: nombra el hecho, no el concepto —
 * "Aporte mensual" era la etiqueta interna y no le dice nada a quien no la acuñó.
 */
const ETIQUETA: Record<FamiliaMotivo, string> = {
  regulacion: "No está permitido",
  ingreso: "No da para su precio",
  bolsillo: "Pones plata cada mes",
  vsLargo: "Rinde más con arrendatario fijo",
};

export interface MotivosDescritos {
  /** Familias activas, en orden de presentación. Siempre ≥ 1. */
  familias: (FamiliaMotivo | FamiliaMotivoLTR)[];
  /** Etiquetas breves, mismo orden — para chips. */
  etiquetas: string[];
  /** La línea que va en pantalla. Una sola frase, sin bullets. */
  frase: string;
  /** Las cláusulas sueltas, por si una superficie quiere listarlas en vez de la frase. */
  lecturas: string[];
}

/**
 * Traduce los motivos del veredicto a copy. Devuelve null cuando no hay motivos —
 * el veredicto salió de la banda del score y ningún gate disparó. Ahí el silencio es
 * lo correcto: inventar una causa sería peor que no darla (§1.9 regla 3).
 */
export function describirMotivosSTR(motivos: readonly BrazoSTR[]): MotivosDescritos | null {
  if (!motivos || motivos.length === 0) return null;

  const set = new Set<FamiliaMotivo>();
  for (const m of motivos) {
    const f = FAMILIA_DE[m];
    if (f) set.add(f);
  }
  const familias = ORDEN_FAMILIA.filter((f) => set.has(f));
  if (familias.length === 0) return null;

  const lecturas = familias.map((f) => CLAUSULA[f]);
  const etiquetas = familias.map((f) => ETIQUETA[f]);
  const base = { familias, etiquetas, lecturas };

  // La regulación cierra la puerta sola: cuando está, es LA razón y el resto es ruido
  // — no tiene sentido hablar de mejorar la caja de algo que no se puede operar.
  if (familias[0] === "regulacion") {
    return { ...base, frase: FRASE_SOLA.regulacion };
  }

  if (familias.length === 1) {
    return { ...base, frase: FRASE_SOLA[familias[0]] };
  }

  // Combinación con frase propia (hoy solo ingreso+bolsillo, que es 33 de 96).
  const clave = familias.join("+");
  const aMedida = FRASE_COMBINADA[clave];
  if (aMedida) return { ...base, frase: aMedida };

  // Fallback para combinaciones que el parque no produce hoy pero el motor puede
  // generar. Concatena cláusulas — menos fluido que una frase escrita a medida, pero
  // nunca deja la línea vacía. Si alguna de estas empieza a aparecer seguido, merece
  // su entrada en FRASE_COMBINADA.
  const unidas =
    lecturas.length === 2
      ? `${lecturas[0]}, y además ${lecturas[1]}`
      : `${lecturas.slice(0, -1).join("; ")}, y además ${lecturas[lecturas.length - 1]}`;
  return { ...base, frase: `No cierra por una sola cosa: ${unidas}.` };
}

// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO CIERRA (LTR) — espejo del bloque STR para los brazos del Gate 1
// LTR (`Gate1Brazos`, analysis.ts) y la capa del Gate 2. Mismo criterio: se
// narran FAMILIAS en consecuencia vivida, nunca la mecánica (§1.12.8 / A11).
// Los nombres de brazo llegan como strings (`brazosGate1Activos` del hallazgo
// de distancia); la capa del Gate 2 no tiene brazo persistido y se DERIVA en el
// consumidor (score ≥ 70 con veredicto AJUSTA ⇒ el gate capó — patrón puro-gate
// STR), por eso entra como flag aparte.
// ═════════════════════════════════════════════════════════════════════════════

export type FamiliaMotivoLTR = "ingresoLTR" | "bolsilloLTR" | "capitalLTR" | "caroConAporte" | "aporteSobreCapital";

const FAMILIA_DE_LTR: Record<string, FamiliaMotivoLTR> = {
  breakEvenImposible: "ingresoLTR",
  flujoSevero: "bolsilloLTR",
  cocSevero: "capitalLTR",
  plusvaliaConFlujo: "caroConAporte",
};

/** Primero lo que cierra la puerta sola, después lo que aprieta. */
const ORDEN_FAMILIA_LTR: FamiliaMotivoLTR[] = [
  "ingresoLTR",
  "bolsilloLTR",
  "capitalLTR",
  "caroConAporte",
  "aporteSobreCapital",
];

const CLAUSULA_LTR: Record<FamiliaMotivoLTR, string> = {
  ingresoLTR: "el arriendo no alcanza a cubrir la cuota ni con la tasa de interés en cero",
  bolsilloLTR: "cada mes pones de tu bolsillo más de la mitad de lo que pagas de cuota",
  capitalLTR: "lo que pones de tu bolsillo cada año se come más de un tercio del capital que aportaste",
  caroConAporte: "pagarías sobre el valor estimado de la zona y además pondrías plata de tu bolsillo todos los meses",
  aporteSobreCapital: "lo que pones de tu bolsillo pesa sobre el capital que aportaste",
};

const FRASE_SOLA_LTR: Record<FamiliaMotivoLTR, string> = {
  ingresoLTR:
    "No cierra por una razón concreta: el arriendo no alcanza a cubrir la cuota ni con la tasa de interés en cero.",
  bolsilloLTR:
    "No cierra por una razón concreta: cada mes pones de tu bolsillo más de la mitad de lo que pagas de cuota.",
  capitalLTR:
    "No cierra por una razón concreta: lo que pones de tu bolsillo cada año se come más de un tercio del capital que aportaste.",
  caroConAporte:
    "No cierra por una razón concreta: pagarías sobre el valor estimado de la zona y además pondrías plata de tu bolsillo todos los meses.",
  aporteSobreCapital:
    "Los números de calidad dan, pero la operación te exige poner de tu bolsillo un peso que el capital aportado no justifica todavía.",
};

/**
 * Traduce los brazos LTR activos (+ la capa del Gate 2 derivada) a copy. Devuelve
 * null sin motivos — veredicto de banda pura, y el silencio es lo correcto (§1.9.3).
 */
export function describirMotivosLTR(
  brazosGate1Activos: readonly string[],
  gate2Capo: boolean,
): MotivosDescritos | null {
  const set = new Set<FamiliaMotivoLTR>();
  for (const b of brazosGate1Activos ?? []) {
    const f = FAMILIA_DE_LTR[b];
    if (f) set.add(f);
  }
  if (gate2Capo && set.size === 0) set.add("aporteSobreCapital");
  const familias = ORDEN_FAMILIA_LTR.filter((f) => set.has(f));
  if (familias.length === 0) return null;

  const lecturas = familias.map((f) => CLAUSULA_LTR[f]);
  // Etiquetas breves para chips (mismo filtro que STR: el hecho, no el concepto).
  const ETIQUETA_LTR: Record<FamiliaMotivoLTR, string> = {
    ingresoLTR: "No da ni con tasa cero",
    bolsilloLTR: "Pones más de media cuota",
    capitalLTR: "Se come tu capital",
    caroConAporte: "Caro y con aporte",
    aporteSobreCapital: "El aporte pesa sobre tu capital",
  };
  const etiquetas = familias.map((f) => ETIQUETA_LTR[f]);
  const base = { familias, etiquetas, lecturas };

  if (familias.length === 1) {
    return { ...base, frase: FRASE_SOLA_LTR[familias[0]] };
  }
  const unidas =
    lecturas.length === 2
      ? `${lecturas[0]}, y además ${lecturas[1]}`
      : `${lecturas.slice(0, -1).join("; ")}, y además ${lecturas[lecturas.length - 1]}`;
  return { ...base, frase: `No cierra por una sola cosa: ${unidas}.` };
}
