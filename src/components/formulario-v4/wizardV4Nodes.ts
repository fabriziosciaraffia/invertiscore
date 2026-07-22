// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Grafo de navegación (lógica pura, sin React)
//
// Doctrina: una pregunta por pantalla (GOV.UK one-thing-per-page). Cada nodo es
// una pantalla. Los "actos" son solo rótulo de contexto + barra de progreso; NO
// son páginas. La modalidad (EL INFORME) es la PRIMERA pantalla (selección de
// producto). El gate del edificio sigue en el Acto 3. El grafo con ramas:
//
//   mod → dir → tipo ─(usado)→ ant → tam → precio → pie → tasa → plazo → [rama]
//                    └(nuevo)→ ent → tam
//
//   plazo ─(ltr)→ arr → resumen
//         ├(str)→ gate ─(sí/no-seguro)→ adr → resumen
//         │        └(no)→ gateNo ─(cambiar a ltr)→ arr → resumen
//         └(both)→ gate ─(sí/no-seguro)→ arr → adr → resumen
//                  └(no)→ gateNo (ofrece seguir solo ltr)
//
// tasaFix / arrFix / adrFix = detours de corrección inline (se entran con botón,
// no por computeNext; su "siguiente" es el mismo que el de su pantalla padre).
// ─────────────────────────────────────────────────────────────────────────────

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
  plazoCredito?: string; // "20" | "25" | "30"
  tasaInteres?: string; // % anual, coma decimal
}

/** Pantallas de corrección inline (detours, no cuentan progreso). */
export const FIX_NODES: ReadonlySet<NodeId> = new Set<NodeId>(["tasaFix", "arrFix", "adrFix"]);

/** Nodos de la rama del Acto 3 (renta) — se invalidan al cambiar modalidad. */
export const BRANCH_ACTO3: readonly NodeId[] = ["gate", "gateNo", "arr", "arrFix", "adr", "adrFix"];

export const ACTO_LABEL: Record<Acto, string> = {
  compra: "ACTO 1 · QUÉ COMPRAS",
  finanza: "ACTO 2 · CÓMO LO FINANCIAS",
  informe: "EL INFORME",
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
  mod: "¿Qué informe quieres?",
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
      return "dir"; // modalidad es la primera pantalla; el flujo sigue con la propiedad
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
      // tras el financiamiento entra la rama del Acto 3 según la modalidad ya elegida
      return a.modalidad === "str" || a.modalidad === "both" ? "gate" : "arr";
    case "gate":
      if (a.edificioPermiteAirbnb === "no") return "gateNo";
      // sí | no_seguro → both pide arr primero, str va directo a adr
      return a.modalidad === "both" ? "arr" : "adr";
    case "gateNo":
      return null; // salida por botones explícitos (seguir LTR / volver)
    case "arr":
      return a.modalidad === "both" ? "adr" : "resumen";
    case "arrFix":
      return a.modalidad === "both" ? "adr" : "resumen";
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
  let n: NodeId | null = "mod";
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
      return "dir";
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
      // undecided → asume la rama más corta (ltr)
      if (a.modalidad === "str" || a.modalidad === "both") return "gate";
      return "arr";
    case "gate":
      return a.modalidad === "both" ? "arr" : "adr";
    case "arr":
      return a.modalidad === "both" ? "adr" : "resumen";
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
}

/**
 * Texto de la reacción de Franco tras responder `node`, o null si ese nodo no
 * dispara reacción con las respuestas dadas. Pura: sirve tanto para decidir si
 * hay reacción (hook, sin `live`) como para renderizarla (componente, con `live`).
 */
export function reactionText(node: NodeId, a: WizardV4Answers, live?: ReactionLive): string | null {
  switch (node) {
    case "dir":
      return `Zona cubierta. ${live?.comparables ?? "N"} comparables detectados cerca.`;
    case "precio":
      return `≈ ${live?.precioCLP ?? "$X"} al valor UF de hoy. Ahora, la plata.`;
    case "plazo":
      return `Tu cuota queda en ${live?.cuota ?? "$X"} al mes. Ahora, lo que puede rendir.`;
    case "gate":
      return a.edificioPermiteAirbnb === "no_seguro"
        ? "Ok — el informe lo marcará como riesgo por confirmar antes de firmar."
        : null;
    default:
      return null;
  }
}
