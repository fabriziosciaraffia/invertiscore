// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Grafo de navegación (lógica pura, sin React)
//
// Doctrina: una pregunta por pantalla (GOV.UK one-thing-per-page). Cada nodo es
// una pantalla. Los "actos" son solo rótulo de contexto + barra de progreso; NO
// son páginas. El gate del edificio sigue en el Acto 3. El grafo con ramas:
//
//   dir → tipo ─(usado)→ ant → tam → precio → pie → tasa → plazo → mod → [rama]
//              └(nuevo)→ ent → tam
//
//   mod ─(ltr)→ arr → resumen
//       ├(str)→ gate ─(sí/no-seguro)→ adr → resumen
//       │        └(no)→ gateNo ─(cambiar a ltr)→ arr → resumen  (arr pendiente)
//       └(both)→ arr → gate ─(sí/no-seguro)→ adr → resumen      (agrupado por modalidad)
//                        └(no)→ gateNo ─(seguir ltr)→ resumen   (arr ya listo)
//
// LA MODALIDAD VA AL FINAL (19-ago-2026). Estuvo de primera pantalla y era la
// mayor fuga del wizard: 29% de abandono, 214 salidas, 61 personas que se iban
// SIN TOCAR NADA. No era una pregunta difícil —1,0 toques promedio, cero cambios
// de opción en 30 días— sino una pregunta puesta antes de que existiera contexto
// para responderla: se le pedía elegir un producto a alguien que todavía no
// había dicho ni dónde queda el depto.
//
// Moverla es barato porque NO bifurca nada hasta acá: ninguna pantalla de los
// actos 1 y 2 lee `modalidad`. La bifurcación real siempre ocurrió recién
// después de `plazo`, así que el nodo se mudó al lugar donde ya estaba el corte.
//
// tasaFix / arrFix / adrFix = detours de corrección inline (se entran con botón,
// no por computeNext; su "siguiente" es el mismo que el de su pantalla padre).
// ─────────────────────────────────────────────────────────────────────────────

import type { Decimales } from "@/lib/numero-cl";

export type NodeId =
  | "dir"
  | "tipo"
  | "ent"
  | "ant"
  | "tam"
  | "precio"
  | "pie"
  | "tasa"
  | "tasaFix"
  | "plazo"
  | "mod"
  | "gate"
  | "gateNo"
  | "arr"
  | "arrFix"
  | "adr"
  | "adrFix"
  | "resumen";

export type Acto = "compra" | "finanza" | "informe" | "renta" | "resumen";

export type TipoPropiedad = "usado" | "nuevo";
export type TasaModo = "estimada" | "preaprobada";
export type Modalidad = "ltr" | "str" | "both";
export type GateResp = "si" | "no_seguro" | "no";
export type EstimModo = "estimacion" | "corregir";

/**
 * Respuestas del wizard. En Fase 1 solo viven los campos que *deciden
 * navegación* (ramas). Los campos de datos reales (dirección, precio, arriendo,
 * etc.) se agregan en Fases 2-4 extendiendo esta interfaz — se dejan opcionales
 * y sin index signature para conservar type-safety.
 */
export type Antiguedad = "" | "0-2" | "3-5" | "6-10" | "11-20" | "20+";
export type EstadoVenta = "inmediata" | "futura";
export type PieUnidad = "clp" | "uf" | "pct";

// ─────────────────────────────────────────────────────────────────────────────
// PRECISIÓN POR CAMPO — fuente única
//
// Cuántos decimales admite cada campo. Vive acá, y en un solo lugar, porque el
// bug que la migración a `NumericInput` viene a cerrar era EXACTAMENTE que el
// mismo campo se leía distinto según la pantalla: la ocupación daba 625 en el
// Acto 3 y 62 en el resumen, porque cada superficie traía su propio filtro.
// Un valor acá, importado por la pantalla Y por el submit, hace que eso no se
// pueda volver a separar.
//
// Cambiar un número de esta tabla cambia qué acepta el campo en las dos
// superficies a la vez. Es la intención.
// ─────────────────────────────────────────────────────────────────────────────

export const DEC = {
  superficie: 1,
  estacionamientos: 0,
  bodegas: 0,
  precioUF: 2,
  precioCLP: 0,
  // 2 y no 1 (fix pie-redondeo): la precisión canónica del pie en % es 2
  // decimales — un pie tipeado en $ y convertido a % por el toggle puede caer
  // legítimamente en "20,62", y con 1 decimal ese texto sería ilegible
  // (parseNumeroCL regla 4 → null → 0).
  piePct: 2,
  pieUF: 2,
  pieCLP: 0,
  tasa: 2,
  arriendo: 0,
  tarifa: 0,
  ocupacion: 1,
  gastosComunes: 0,
  contribuciones: 0,
  vacancia: 1,
  comisionAdmin: 1,
  costos: 0,
} as const satisfies Record<string, Decimales>;

/** Decimales del monto del pie según la unidad en que lo esté escribiendo. */
export function decPie(unidad: PieUnidad | undefined): Decimales {
  if (unidad === "uf") return DEC.pieUF;
  if (unidad === "clp") return DEC.pieCLP;
  return DEC.piePct; // "pct" es el default del selector
}
/** Fase 5b · opciones de "¿Por qué no pones pie?" (mockup 5f7c4f9 + corrección
 *  de 4→3: "pie en cuotas" se eliminó porque NO produce pie 0 — el pie existe,
 *  solo se paga fraccionado, y ofrecerla induciría a declarar 0 falsamente).
 *  Mapean 1:1 a RazonSinCapital (lib/types.ts) en el payload. */
export type PieRazon = "bono_pie" | "otra_fuente" | "no_declarada";

/** Etiquetas del selector — fuente única para el wizard y el resumen. */
export const PIE_RAZON_OPCIONES: ReadonlyArray<{ value: PieRazon; label: string; sub?: string }> = [
  { value: "bono_pie", label: "Bono pie de la inmobiliaria", sub: "la inmobiliaria lo cubre como promoción" },
  { value: "otra_fuente", label: "Lo cubro con otra fuente", sub: "ahorro, familia, otra propiedad" },
  { value: "no_declarada", label: "Prefiero no decir" },
];

export const PIE_RAZON_LABEL: Record<PieRazon, string> = {
  bono_pie: "Bono pie de la inmobiliaria",
  otra_fuente: "Lo cubro con otra fuente",
  no_declarada: "Prefiero no decir",
};

export interface WizardV4Answers {
  // ── Decisiones de rama (dirigen computeNext) ──
  tipoPropiedad?: TipoPropiedad;
  tasaModo?: TasaModo;
  modalidad?: Modalidad;
  edificioPermiteAirbnb?: GateResp;
  arrModo?: EstimModo;
  adrModo?: EstimModo;

  // ── Acto 1 · qué compras ──
  direccion?: string;
  /** Última dirección confirmada vía Places (gate compara contra `direccion`). */
  direccionConfirmada?: string;
  lat?: number | null;
  lng?: number | null;
  comuna?: string;
  ciudad?: string;
  superficieUtil?: string; // m², decimal-locale
  dormitorios?: string;
  banos?: string;
  esStudio?: boolean;
  estacionamientos?: string;
  bodegas?: string;
  antiguedad?: Antiguedad; // solo usado
  estadoVenta?: EstadoVenta; // solo nuevo
  fechaEntregaMes?: string;
  fechaEntregaAnio?: string;

  // ── Acto 2 · cómo lo financias ──
  precio?: string; // UF — SIN prefill (Franco no lo sugiere, lo evalúa)
  pieMonto?: string; // valor crudo en la unidad elegida
  pieUnidad?: PieUnidad;
  /** Fase 5b · "¿Por qué no pones pie?". Obligatoria SOLO con pie exactamente 0;
   *  se descarta en silencio si el pie vuelve a > 0 (decisión cerrada). */
  pieRazon?: PieRazon;
  plazoCredito?: string; // "20" | "25" | "30"
  tasaInteres?: string; // % anual, coma decimal

  // ── Acto 3 · cómo lo rentabilizas (ingresos con estimación/corrección) ──
  arriendo?: string; // CLP/mes (LTR/both) — estimado o corregido
  adrTarifa?: string; // CLP/noche (STR/both)
  adrOcupacion?: string; // % ocupación estabilizada (STR/both)

  // ── Supuestos DIFERIDOS (default silencioso; editables en el resumen) ──
  gastosComunes?: string; // CLP/mes
  contribuciones?: string; // CLP/trimestre
  vacanciaPct?: string; // % (LTR)
  comisionAdminPct?: string; // % administración LTR
  // STR:
  modoGestion?: "auto" | "administrador";
  comisionStrPct?: string; // % operador STR
  costoElectricidad?: string;
  costoAgua?: string;
  costoWifi?: string;
  costoInsumos?: string;
  mantencionStr?: string;
  estaAmoblado?: boolean;
  costoAmoblamiento?: string;
}

/** Todos los nodos válidos (para validar drafts al cargar). */
export const ALL_NODES: ReadonlySet<NodeId> = new Set<NodeId>([
  "dir", "tipo", "ent", "ant", "tam", "precio", "pie", "tasa", "tasaFix", "plazo",
  "mod", "gate", "gateNo", "arr", "arrFix", "adr", "adrFix", "resumen",
]);

/** Pantallas de corrección inline (detours, no cuentan progreso). */
export const FIX_NODES: ReadonlySet<NodeId> = new Set<NodeId>(["tasaFix", "arrFix", "adrFix"]);

/** Nodos de la rama del Acto 3 (renta) — se invalidan al cambiar modalidad. */
export const BRANCH_ACTO3: readonly NodeId[] = ["gate", "gateNo", "arr", "arrFix", "adr", "adrFix"];

export const ACTO_LABEL: Record<Acto, string> = {
  compra: "ACTO 1 · QUÉ COMPRAS",
  finanza: "ACTO 2 · CÓMO LO FINANCIAS",
  informe: "ÚLTIMA PREGUNTA",
  renta: "ACTO 3 · CÓMO LO RENTABILIZAS",
  resumen: "RESUMEN",
};

export const ACTO_BY_NODE: Record<NodeId, Acto> = {
  dir: "compra",
  tipo: "compra",
  ent: "compra",
  ant: "compra",
  tam: "compra",
  precio: "finanza",
  pie: "finanza",
  tasa: "finanza",
  tasaFix: "finanza",
  plazo: "finanza",
  mod: "informe",
  gate: "renta",
  gateNo: "renta",
  arr: "renta",
  arrFix: "renta",
  adr: "renta",
  adrFix: "renta",
  resumen: "resumen",
};

/**
 * Títulos de trabajo por pantalla. En Fase 1 sirven de placeholder legible; el
 * copy final (voz Franco) se afina al construir cada pantalla en Fases 2-3.
 */
export const NODE_TITLE: Record<NodeId, string> = {
  dir: "¿Dónde queda el departamento?",
  tipo: "¿Es usado o nuevo?",
  ent: "¿Cuándo lo entregan?",
  ant: "¿Qué antigüedad tiene?",
  tam: "¿De qué tamaño es?",
  precio: "¿Cuánto piden por él?",
  pie: "¿Cuánto pie pones?",
  tasa: "Tu tasa hipotecaria",
  tasaFix: "Ingresa tu tasa pre-aprobada",
  plazo: "¿A cuántos años el crédito?",
  mod: "¿A quién le vas a arrendar?",
  gate: "¿El edificio permite arriendo por noche?",
  gateNo: "El edificio no permite arriendo por noche",
  arr: "¿En cuánto lo arriendas al mes?",
  arrFix: "Corrige el arriendo mensual",
  adr: "Tarifa por noche y ocupación",
  adrFix: "Corrige tarifa y ocupación",
  resumen: "Revisa antes de generar",
};

/**
 * Siguiente pantalla en el flujo lineal, dado el nodo actual + respuestas.
 * Las pantallas de corrección (tasaFix/arrFix/adrFix) se entran con `goDetour`,
 * no por acá; su computeNext replica el de su pantalla padre.
 * Devuelve null solo en pantallas terminales o de salida explícita (gateNo).
 */
export function computeNext(node: NodeId, a: WizardV4Answers): NodeId | null {
  switch (node) {
    case "mod":
      // Acto 3 agrupado por modalidad: ltr y both empiezan por arr (renta larga
      // primero); str va directo al gate (ahí el permiso mata todo el análisis).
      return a.modalidad === "str" ? "gate" : "arr";
    case "dir":
      return "tipo";
    case "tipo":
      return a.tipoPropiedad === "nuevo" ? "ent" : "ant";
    case "ent":
      return "tam";
    case "ant":
      return "tam";
    case "tam":
      return "precio";
    case "precio":
      return "pie";
    case "pie":
      return "tasa";
    case "tasa":
      return "plazo"; // ruta "usar estimación"; el detour tasaFix se entra con botón
    case "tasaFix":
      return "plazo";
    case "plazo":
      return "mod"; // última pregunta: recién acá la modalidad bifurca algo
    case "gate":
      if (a.edificioPermiteAirbnb === "no") return "gateNo";
      // sí | no_seguro → str y both van a adr (en both, arr ya se respondió antes)
      return "adr";
    case "gateNo":
      return null; // salida por botones explícitos (seguir LTR / volver)
    case "arr":
      return a.modalidad === "both" ? "gate" : "resumen";
    case "arrFix":
      return a.modalidad === "both" ? "gate" : "resumen";
    case "adr":
      return "resumen";
    case "adrFix":
      return "resumen";
    case "resumen":
      return null;
  }
}

/**
 * Camino planificado dir → resumen dadas las respuestas actuales, para la barra
 * de progreso. Usa las decisiones ya tomadas; donde falta una rama, asume el
 * default más corto (usado / ltr) para tener un denominador estable. Excluye
 * detours de corrección y gateNo (no son progreso). El denominador crece al
 * elegir STR/BOTH — señal legítima de "el comparativo es más trabajo".
 */
export function computePlannedPath(a: WizardV4Answers): NodeId[] {
  const path: NodeId[] = [];
  const guard = new Set<NodeId>();
  let n: NodeId | null = "dir";
  while (n && !guard.has(n)) {
    guard.add(n);
    path.push(n);
    n = plannedNext(n, a);
  }
  return path;
}

/** Transición "feliz" para la planificación de progreso (nunca a fix/gateNo). */
function plannedNext(node: NodeId, a: WizardV4Answers): NodeId | null {
  switch (node) {
    case "mod":
      return a.modalidad === "str" ? "gate" : "arr";
    case "dir":
      return "tipo";
    case "tipo":
      return a.tipoPropiedad === "nuevo" ? "ent" : "ant";
    case "ent":
    case "ant":
      return "tam";
    case "tam":
      return "precio";
    case "precio":
      return "pie";
    case "pie":
      return "tasa";
    case "tasa":
      return "plazo";
    case "plazo":
      return "mod";
    case "gate":
      return "adr";
    case "arr":
      return a.modalidad === "both" ? "gate" : "resumen";
    case "adr":
      return "resumen";
    default:
      return null;
  }
}

/** Mapea un detour/salida a su pantalla "de progreso" equivalente. */
function progressAnchor(node: NodeId): NodeId {
  switch (node) {
    case "tasaFix":
      return "tasa";
    case "arrFix":
      return "arr";
    case "adrFix":
      return "adr";
    case "gateNo":
      return "gate";
    default:
      return node;
  }
}

/**
 * Progreso 0..1 del nodo actual dentro del camino planificado. Los detours
 * heredan el progreso de su pantalla padre (no retroceden ni saltan la barra).
 */
export function progressFor(current: NodeId, a: WizardV4Answers): number {
  if (current === "resumen") return 1;
  const path = computePlannedPath(a);
  const anchor = progressAnchor(current);
  const idx = path.indexOf(anchor);
  if (idx < 0 || path.length <= 1) return 0;
  return idx / (path.length - 1);
}

/** "PASO X DE Y" — X y Y en base al camino planificado (detours no cuentan). */
export function stepCounter(current: NodeId, a: WizardV4Answers): { step: number; total: number } {
  const path = computePlannedPath(a);
  const anchor = progressAnchor(current);
  const idx = path.indexOf(anchor);
  return { step: idx < 0 ? 1 : idx + 1, total: path.length };
}

/** ¿Editar este nodo puede cambiar la estructura de ramas aguas abajo? */
export function isBranchNode(node: NodeId): boolean {
  return node === "mod" || node === "tipo" || node === "gate";
}

// ── Reacciones de Franco ─────────────────────────────────────────────────────
// Una línea de contexto que aparece SOBRE la pregunta siguiente tras ciertas
// respuestas. Dura una pantalla, no se acumula. Los valores reales (N comparables,
// UF del día, cuota) se inyectan vía `live` en Fases 2-3; en Fase 1 caen a
// placeholders legibles. La reacción de `gate` depende de la respuesta.

export interface ReactionLive {
  /** N comparables reales del RPC (reacción de `dir`). */
  comparables?: number | string;
  /** Precio en CLP al UF del día (reacción de `precio`). */
  precioCLP?: string;
  /** Cuota mensual calculada (reacción de `plazo`). */
  cuota?: string;
  /** ¿Aplica el aviso anticipado de subsidio? (reacción de `tam`). */
  subsidioAviso?: boolean;
}

/**
 * ¿El nodo puede disparar una reacción de Franco? Lo usa el hook para setear
 * `reactionSource` sin conocer los datos en vivo. El texto final (que puede ser
 * null aun así — ej. aviso de subsidio no elegible) lo resuelve `reactionText`
 * con `live` en el componente.
 */
export function nodeReacts(node: NodeId, a: WizardV4Answers): boolean {
  switch (node) {
    case "dir":
    case "precio":
    case "plazo":
      return true;
    case "gate":
      return a.edificioPermiteAirbnb === "no_seguro";
    case "tam":
      return a.tipoPropiedad === "nuevo"; // aviso de subsidio (se filtra por `live`)
    default:
      return false;
  }
}

/**
 * Texto de la reacción de Franco tras responder `node`, o null si ese nodo no
 * dispara reacción con las respuestas dadas. Pura: sirve tanto para decidir si
 * hay reacción (hook, sin `live`) como para renderizarla (componente, con `live`).
 */
export function reactionText(node: NodeId, a: WizardV4Answers, live?: ReactionLive): string | null {
  switch (node) {
    case "dir":
      // Mismo número y mismo rótulo que el badge del mapa ("propiedades en el
      // sector") — es cobertura geográfica del sector, NO los comparables
      // filtrados. "Comparables" se reserva para `arr` (mediana con su propio N,
      // filtrado por superficie/dorm) para que ningún número cambie de nombre.
      return `Zona cubierta. ${live?.comparables ?? "N"} propiedades en el sector.`;
    case "precio":
      return `≈ ${live?.precioCLP ?? "$X"} al valor UF de hoy. Ahora, la plata.`;
    case "plazo":
      return `Tu cuota queda en ${live?.cuota ?? "$X"} al mes. Ahora, lo que puede rendir.`;
    case "gate":
      return a.edificioPermiteAirbnb === "no_seguro"
        ? "Ok — el informe lo marcará como riesgo por confirmar antes de firmar."
        : null;
    case "tam":
      // Aviso anticipado de subsidio: solo programa + rango, JAMÁS el valor
      // estimado del depto (regla de copy dura).
      return a.tipoPropiedad === "nuevo" && live?.subsidioAviso
        ? "Ojo: los departamentos nuevos hasta UF 4.000 pueden entrar al Subsidio a la Tasa (Ley 21.748) si es tu primera vivienda. Si el tuyo entra en rango, te lo ofrezco cuando pongas el precio."
        : null;
    default:
      return null;
  }
}
