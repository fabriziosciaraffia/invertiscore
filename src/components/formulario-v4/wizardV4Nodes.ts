// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Grafo de navegación (lógica pura, sin React)
//
// Doctrina: una pregunta por pantalla (GOV.UK one-thing-per-page). Cada nodo es
// una pantalla. Los "actos" son solo rótulo de contexto + barra de progreso; NO
// son páginas. El grafo con ramas:
//
//   dir → tipo ─(usado)→ ant → tam → precio → pie → tasa → plazo → mod → [rama]
//              └(nuevo)→ ent → tam
//
//   mod ─(ltr)→ arr → resumen
//       ├(str)→ adr → resumen
//       └(both)→ arr → adr → resumen      (agrupado por modalidad)
//
// EL GATE DEL REGLAMENTO SE RETIRÓ (11-sep-2026, decisión V1). `gate` y `gateNo` vivían
// entre `mod`/`arr` y `adr`: el reglamento del edificio ya no se pregunta, no se muestra
// ni pesa en el score. Un draft parado en esos nodos no valida contra `ALL_NODES` y se
// descarta al retomar (medido: 0 abandonos ahí en 30 días).
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
//
// dirMapa = «¿Dónde queda exactamente?» (26-sep-2026). Desvío de `dir`, como los de
// corrección: la entrada del wizard pasó a ser el hero de la landing (una puerta, dos
// accesos) y el mapa es donde caen sus tres caminos sin número exacto —la calle sin
// número, «Estoy en el depto» y «Marcarlo en el mapa»—. `dir` conserva su nombre (las
// series de `wizard4_step_left` no se cortan) y el mapa no cuenta como progreso.
// ─────────────────────────────────────────────────────────────────────────────

import type { Decimales } from "@/lib/numero-cl";
import type { UbicacionPrecision } from "@/lib/geocoding-precision";
import { rotuloComparables } from "./comparablesRotulo";

export type NodeId =
  | "dir"
  | "dirMapa"
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
  | "arr"
  | "arrFix"
  | "adr"
  | "adrFix"
  | "resumen";

export type Acto = "compra" | "finanza" | "informe" | "renta" | "resumen";

export type TipoPropiedad = "usado" | "nuevo";
export type TasaModo = "estimada" | "preaprobada";
export type Modalidad = "ltr" | "str" | "both";
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
  cuotaCreditoPie: 0,
  huespedes: 0,
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
//
// «Otra fuente» dejó de decir «ahorro» (27-sep-2026, mockup aprobado del wizard): un ahorro ES pie
// —se escribe en el campo del pie—; lo que cubre «otra fuente» es plata que no sale del bolsillo
// del comprador: un crédito, un familiar, la venta de otra propiedad.
export const PIE_RAZON_OPCIONES: ReadonlyArray<{ value: PieRazon; label: string; sub?: string }> = [
  { value: "bono_pie", label: "Bono pie de la inmobiliaria", sub: "La inmobiliaria lo cubre como promoción." },
  { value: "otra_fuente", label: "Lo cubro con otra fuente", sub: "Un crédito, un familiar, la venta de otra propiedad." },
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
  /** Pie, tasa, plazo y modalidad vinieron del informe anterior (después de pagar el pack,
   *  30-sep-2026): el wizard salta de `precio` a la renta. Editables en el resumen. */
  financiamientoPrecargado?: boolean;
  arrModo?: EstimModo;
  adrModo?: EstimModo;

  // ── Acto 1 · qué compras ──
  direccion?: string;
  /** Última dirección confirmada vía Places (gate compara contra `direccion`). */
  direccionConfirmada?: string;
  lat?: number | null;
  lng?: number | null;
  /** Por qué camino se llegó al mapa (`dirMapa`): define el aviso y dónde parte el pin. */
  mapaOrigen?: "numero" | "sin_numero" | "ubicacion" | "mapa";
  /** «Estoy en el depto» sin ubicación (permiso negado o error): el mapa abre sin pin y lo dice. */
  mapaAviso?: "sin_ubicacion";
  /** "numero" · "calle" (sin número: el punto es aproximado) · "pin" (el usuario lo movió). */
  ubicacionPrecision?: UbicacionPrecision;
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
  /** «Otra fuente» (27-sep-2026): cuánto cubre, en la misma unidad del pie (`pieUnidad`). Para el
   *  banco ESO ES PIE: el submit lo manda en `piePct` y el hipotecario sale sobre precio − monto. */
  otraFuenteMonto?: string;
  /** ¿Esa otra fuente es un crédito? Si lo es, su cuota entra al flujo del mes. */
  otraFuenteCredito?: boolean;
  /** Cuota mensual (CLP) del crédito con que se cubre el pie → `cuotaCreditoPie` del payload. */
  otraFuenteCuota?: string;
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
  /** LTR (30-sep-2026): «Amoblado: No» por defecto. Con "si", los comparables del arriendo son los
   *  amoblados; sin él, los arriendos corrientes (sin amoblados, temporada, corporativos ni piezas). */
  amoblado?: "no" | "si";
  comisionAdminPct?: string; // % administración LTR
  // STR:
  modoGestion?: "auto" | "administrador";
  comisionStrPct?: string; // % operador STR
  /** «Costos operativos» del resumen: el TOTAL de luz + agua + wifi + insumos. El submit lo
   *  reparte entre los cuatro (`repartirCostosOperativos`). */
  costosOperativos?: string;
  /** @deprecated Hasta el 26-sep-2026 el resumen guardaba acá el TOTAL de costos operativos y
   *  el submit le sumaba luz, agua y wifi encima. Solo se lee para un borrador de antes. */
  costoInsumos?: string;
  mantencionStr?: string;
  estaAmoblado?: boolean;
  costoAmoblamiento?: string;
  /** Huéspedes que recibe (27-sep-2026, se pregunta en la tarifa). Vacío ⇒ la regla por
   *  dormitorios (`capacidadHuespedesDe`), que es lo que el motor supuso siempre. */
  capacidadHuespedes?: string;
}

/** Todos los nodos válidos (para validar drafts al cargar). */
export const ALL_NODES: ReadonlySet<NodeId> = new Set<NodeId>([
  "dir", "dirMapa", "tipo", "ent", "ant", "tam", "precio", "pie", "tasa", "tasaFix", "plazo",
  "mod", "arr", "arrFix", "adr", "adrFix", "resumen",
]);

/** Pantallas de corrección inline (detours, no cuentan progreso). */
export const FIX_NODES: ReadonlySet<NodeId> = new Set<NodeId>(["dirMapa", "tasaFix", "arrFix", "adrFix"]);

/** Nodos de la rama del Acto 3 (renta) — se invalidan al cambiar modalidad. */
export const BRANCH_ACTO3: readonly NodeId[] = ["arr", "arrFix", "adr", "adrFix"];

/** Rótulo del acto en la cabecera del paso. En minúscula de oración desde el 27-sep-2026 (el
 *  formato del informe no lleva mayúsculas corridas); a 390 px parte en dos líneas, no se corta. */
export const ACTO_LABEL: Record<Acto, string> = {
  compra: "Acto 1 · Qué compras",
  finanza: "Acto 2 · Cómo lo financias",
  informe: "Última pregunta",
  renta: "Acto 3 · Cómo lo rentabilizas",
  resumen: "Resumen",
};

export const ACTO_BY_NODE: Record<NodeId, Acto> = {
  dir: "compra",
  dirMapa: "compra",
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
  dir: "¿Dónde está el depto?", // un paso del formulario desde el 01-oct-2026 (antes, el hero dibujaba su título)
  dirMapa: "¿Dónde queda exactamente?",
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
  arr: "¿En cuánto lo arriendas al mes?",
  arrFix: "Corrige el arriendo mensual",
  adr: "¿Cuánto rinde por noche?",
  adrFix: "Corrige tarifa y ocupación",
  resumen: "Revisa antes de generar",
};

/**
 * Siguiente pantalla en el flujo lineal, dado el nodo actual + respuestas.
 * Las pantallas de corrección (tasaFix/arrFix/adrFix) se entran con `goDetour`,
 * no por acá; su computeNext replica el de su pantalla padre.
 * Devuelve null solo en pantallas terminales.
 */
/** El financiamiento vino precargado y completo: pie, tasa, plazo y modalidad (sin «ambas»). */
export function financiamientoListo(a: WizardV4Answers): boolean {
  return a.financiamientoPrecargado === true && !!a.pieMonto && !!a.tasaInteres && !!a.plazoCredito && (a.modalidad === "ltr" || a.modalidad === "str");
}

export function computeNext(node: NodeId, a: WizardV4Answers): NodeId | null {
  switch (node) {
    case "mod":
      // Acto 3 agrupado por modalidad: ltr y both empiezan por arr (renta larga
      // primero); str va directo a la tarifa.
      return a.modalidad === "str" ? "adr" : "arr";
    case "dir":
      return "tipo";
    case "dirMapa":
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
      // Con el financiamiento precargado (pack), salta pie, tasa, plazo y modalidad.
      return financiamientoListo(a) ? (a.modalidad === "str" ? "adr" : "arr") : "pie";
    case "pie":
      return "tasa";
    case "tasa":
      return "plazo"; // ruta "usar estimación"; el detour tasaFix se entra con botón
    case "tasaFix":
      return "plazo";
    case "plazo":
      return "mod"; // última pregunta: recién acá la modalidad bifurca algo
    case "arr":
      // En both, arr ya se respondió: sigue la tarifa.
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
 * detours de corrección (no son progreso). El denominador crece al
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

/** Transición "feliz" para la planificación de progreso (nunca a fix). */
function plannedNext(node: NodeId, a: WizardV4Answers): NodeId | null {
  switch (node) {
    case "mod":
      return a.modalidad === "str" ? "adr" : "arr";
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
      return financiamientoListo(a) ? (a.modalidad === "str" ? "adr" : "arr") : "pie";
    case "pie":
      return "tasa";
    case "tasa":
      return "plazo";
    case "plazo":
      return "mod";
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
    case "dirMapa":
      return "dir";
    case "tasaFix":
      return "tasa";
    case "arrFix":
      return "arr";
    case "adrFix":
      return "adr";
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
  return node === "mod" || node === "tipo";
}

// ── Reacciones de Franco ─────────────────────────────────────────────────────
// Una línea de contexto que aparece SOBRE la pregunta siguiente tras ciertas
// respuestas. Dura una pantalla, no se acumula. Los valores reales (N comparables,
// UF del día, cuota) se inyectan vía `live` en Fases 2-3; en Fase 1 caen a
// placeholders legibles.

export interface ReactionLive {
  /** N comparables reales: el largo de la lista que el mapa dibuja (reacción de `dir`). */
  comparables?: number | string;
  /** El radio al que se juntaron (m), para el mismo rótulo que la leyenda del mapa. */
  radioM?: number | null;
  /** Precio en CLP al UF del día (reacción de `precio`). */
  precioCLP?: string;
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
    case "dirMapa":
    case "precio":
      return true;
    // `plazo` ya no reacciona (27-sep-2026): la cuota se ve en vivo en su propia pantalla, al
    // mover el plazo. Llegaba una pantalla tarde, en la de modalidad.
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
    case "dirMapa": {
      // Mismo número y mismo rótulo que la leyenda del mapa («22 comparables a 1,5 km»):
      // los comparables detrás del arriendo de referencia, al radio que alcanzó la muestra.
      // Hasta el 28-sep-2026 decía «N propiedades en el sector» con el n de la muestra.
      //
      // Desde el 26-sep-2026 la reacción nombra la dirección que quedó confirmada en el
      // mapa (siempre la segunda pantalla desde el 27-sep).
      //
      // El conteo puede llegar después (dos consultas al radio) y, hasta que llega, la
      // frase va sin número: antes se leía «N propiedades» literal.
      const corta = (a.direccionConfirmada ?? a.direccion ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(", ");
      const n = Number(live?.comparables) || 0;
      const rotulo = n ? rotuloComparables(n, live?.radioM ?? null) : null;
      const zona = rotulo ? `zona cubierta, ${rotulo}.` : "zona cubierta.";
      return corta ? `${corta} · ${zona}` : rotulo ? `Zona cubierta. ${rotulo}.` : "Zona cubierta.";
    }
    case "precio":
      return `≈ ${live?.precioCLP ?? "$X"} al valor UF de hoy. Ahora, la plata.`;
    case "tam":
      // Aviso anticipado de subsidio: solo programa + rango, JAMÁS el valor
      // estimado del depto (regla de copy dura).
      return a.tipoPropiedad === "nuevo" && live?.subsidioAviso
        ? "Ojo: los departamentos nuevos hasta UF 6.000 pueden entrar al Subsidio a la Tasa (Ley 21.748). Si el tuyo entra en rango, te lo ofrezco cuando pongas el precio."
        : null;
    default:
      return null;
  }
}
