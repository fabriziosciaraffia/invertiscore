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
// Ninguna lectura lleva "y" adentro: se concatenan entre sí, y una conjunción interna
// produciría "… departamento y pones … y el horizonte …", que se lee como una sola idea
// mal puntuada en vez de dos causas distintas.
const LECTURA: Record<FamiliaMotivo, string> = {
  regulacion: "el edificio no permite arriendo corto",
  ingreso: "lo que el corto factura no alcanza para lo que costó el departamento",
  bolsillo: "el aporte mensual sale de tu bolsillo sin que el horizonte lo devuelva",
  vsLargo: "el arriendo tradicional deja más neto con menos trabajo",
};

/** Etiqueta breve para chips/tablas, donde no cabe la lectura completa. */
const ETIQUETA: Record<FamiliaMotivo, string> = {
  regulacion: "No está permitido",
  ingreso: "El ingreso no da",
  bolsillo: "Aporte mensual",
  vsLargo: "El largo rinde más",
};

export interface MotivosDescritos {
  /** Familias activas, en orden de presentación. Siempre ≥ 1. */
  familias: FamiliaMotivo[];
  /** Etiquetas breves, mismo orden — para chips. */
  etiquetas: string[];
  /** Una línea. Con 2+ familias declara que no es un solo número el que falla. */
  frase: string;
  /** Las lecturas sueltas, por si una superficie quiere listarlas en vez de la frase. */
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

  const lecturas = familias.map((f) => LECTURA[f]);
  const etiquetas = familias.map((f) => ETIQUETA[f]);

  // La regulación cierra la puerta sola: cuando está, es LA razón y el resto es
  // ruido — no se puede "mejorar el flujo" de una operación que no está permitida.
  if (familias[0] === "regulacion") {
    return {
      familias,
      etiquetas,
      lecturas,
      frase: "Acá no se trata de números: el edificio no permite arriendo corto, así que la operación no es viable como está planteada.",
    };
  }

  if (familias.length === 1) {
    return { familias, etiquetas, lecturas, frase: `No cierra por una razón concreta: ${lecturas[0]}.` };
  }

  // Dos o más: lo importante es que el lector sepa que no hay UN supuesto suelto que
  // arreglar. Prosa unida por comas, no bullets (A8), y el número en palabra —
  // "son 2" se lee como salida de una máquina; "son dos", como alguien contando.
  const CUANTOS = ["", "una", "dos", "tres", "cuatro"];
  const unidas =
    lecturas.length === 2
      ? `${lecturas[0]}, y ${lecturas[1]}`
      : `${lecturas.slice(0, -1).join("; ")}, y ${lecturas[lecturas.length - 1]}`;
  return {
    familias,
    etiquetas,
    lecturas,
    frase: `No es un supuesto el que falla, son ${CUANTOS[familias.length] ?? familias.length}: ${unidas}.`,
  };
}
