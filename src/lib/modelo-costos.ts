// Modelo de costos del inmueble — mantención mensual y el gate por versión que
// decide qué tabla corre para cada análisis.
//
// ═══ GATE POR VERSIÓN (un solo punto de decisión) ══════════════════════════════
// El motor recomputa `results` desde `input_data` en cada render (ver
// recomputeResultsForLegacy), así que cualquier cambio de tabla se vería en los
// informes ya generados mientras su prosa sigue citando las cifras viejas. Para
// que ningún informe antiguo cambie en pantalla, las tablas viejas se conservan
// como `legacy` y la selección sale de `input.methodologyVersion`:
//
//   · Análisis creados desde este cambio: el borde (API routes) estampa
//     `methodologyVersion = METHODOLOGY_VERSION_ACTUAL` en el body ANTES de
//     correr el motor, y el body se persiste como input_data → el recompute lo
//     lee sin plomería extra en los callers de render.
//   · Análisis previos: input_data no trae el campo → `legacy` → byte-idéntico.
//
// El campo espeja la columna `analisis.methodology_version` (poblada al 100%:
// v1 hasta el 12-may-2026, v2 desde el 13-may). La columna misma NO se sube a
// v3 en este cambio: tiene CHECK (methodology_version IN ('v1','v2')) y la
// migración es SQL (goal aparte). Por eso la verdad que lee el motor vive en
// input_data, no en la columna.
//
// ═══ MANTENCIÓN (v3) ═════════════════════════════════════════════════════════
// Antes: % anual del PRECIO por antigüedad (0,3% → 1,5%). Sobreestimaba 6-10×
// (estudio sep-2026 sobre 991 análisis LTR de 90 días; mediana 16-25 años:
// $266K/mes = 32% del arriendo). Causas de diseño: en Santiago el precio es
// suelo, y la mantención física escala con m² y antigüedad; ascensores, bombas y
// fachada van en GGCC ordinarios (arrendatario), al dueño le queda el interior.
//
// Ahora: UF/m² útil/año por tramo de antigüedad, con TECHO del 6% del arriendo
// del depto (guardrail anti-comunas-caras). NO hay piso.
//
//   mensual CLP = min( ufM2(antigüedad) × superficieUtil × UF / 12 , arriendo × 0,06 )
//
// ═══ RESET POST-CAPEX ════════════════════════════════════════════════════════
// Un usado de 20 años pagaba CapEx de puesta a punto el día 1 Y seguía pagando
// el tramo 20+ de mantención para siempre (doble conteo). Con CapEx > 0, la
// antigüedad EFECTIVA para mantención parte en 0 el año 1 y envejece desde ahí.
// Ver `antiguedadEfectiva`.

/** Versión de metodología que se estampa en los análisis nuevos. */
export const METHODOLOGY_VERSION_ACTUAL = "v3";

export type ModeloCostos = "legacy" | "v3";

/**
 * Único punto de decisión legacy/v3. Acepta el string de la columna/input
 * ("v1" | "v2" | "v3" | …). Ausente o no parseable ⇒ legacy (análisis previos).
 * Versiones futuras (v4+) heredan la tabla v3 salvo que introduzcan la suya.
 */
export function resolverModeloCostos(methodologyVersion: string | null | undefined): ModeloCostos {
  if (typeof methodologyVersion !== "string") return "legacy";
  const n = parseInt(methodologyVersion.replace(/^v/i, ""), 10);
  return Number.isFinite(n) && n >= 3 ? "v3" : "legacy";
}

// ── Tablas ───────────────────────────────────────────────────────────────────

/** Mantención física en UF/m² útil/año por tramo de antigüedad (v3). */
export const MANTENCION_UF_M2_ANIO: ReadonlyArray<{ hasta: number; ufM2: number }> = [
  { hasta: 2, ufM2: 0.02 },
  { hasta: 7, ufM2: 0.05 },
  { hasta: 15, ufM2: 0.09 },
  { hasta: 25, ufM2: 0.14 },
  // 26+: defensivo. El wizard captura antigüedad máxima 25, así que hoy este
  // tramo es inalcanzable en producción; queda documentado para no dejar el
  // dominio abierto.
  { hasta: Infinity, ufM2: 0.18 },
];

/** Techo de la mantención mensual como fracción del arriendo del depto (v3). */
export const MANTENCION_TECHO_ARRIENDO_PCT = 0.06;

export function getMantencionUfM2Anio(antiguedad: number): number {
  const tramo = MANTENCION_UF_M2_ANIO.find((t) => antiguedad <= t.hasta);
  return tramo ? tramo.ufM2 : MANTENCION_UF_M2_ANIO[MANTENCION_UF_M2_ANIO.length - 1].ufM2;
}

/**
 * Tabla LEGACY: % anual del precio por antigüedad. Se conserva SOLO para que los
 * análisis previos (input sin methodologyVersion ≥ v3) recomputen byte-idéntico.
 * No usar en código nuevo: la fuente única es `calcMantencionMensual`.
 */
export function getMantencionRateLegacy(antiguedad: number): number {
  if (antiguedad <= 2) return 0.003;
  if (antiguedad <= 5) return 0.005;
  if (antiguedad <= 10) return 0.008;
  if (antiguedad <= 15) return 0.01;
  if (antiguedad <= 20) return 0.013;
  return 0.015;
}

// ── Antigüedad efectiva ──────────────────────────────────────────────────────

/**
 * Antigüedad que gobierna la mantención en el año `t` de la proyección
 * (t = 0 es el primer año operativo).
 *
 *   · con CapEx de puesta a punto (derivado u override > 0): el depto arranca
 *     como recién puesto a punto → parte en 0 y envejece desde ahí;
 *   · sin CapEx (antigüedad ≤ 2 o monto 0): antigüedad real + t, como siempre.
 *
 * Pura. La convención de `t` la fija el caller (proyección del motor y simulador
 * cliente pasan la misma).
 */
export function antiguedadEfectiva(antiguedadReal: number, t: number, tieneCapex: boolean): number {
  const tt = Math.max(0, t);
  return tieneCapex ? tt : antiguedadReal + tt;
}

// ── Mantención mensual — fuente única ────────────────────────────────────────

export interface MantencionMensualParams {
  modelo: ModeloCostos;
  /** Antigüedad (real o efectiva) del año que se está calculando. */
  antiguedad: number;
  superficieUtilM2: number;
  /** Precio total en CLP (legacy: la mantención era % del precio). */
  precioCLP: number;
  /** Arriendo mensual del depto SIN estacionamiento ni bodega (techo v3). En
   *  proyección, el arriendo ya reajustado del año. */
  arriendoCLP: number;
  ufClp: number;
  /** Factor de inflación del año (1 = año 1). Legacy lo aplica al monto entero
   *  (misma aritmética que antes, redondeo incluido); v3 solo al término físico,
   *  porque el techo ya se compara contra el arriendo reajustado. */
  factorInflacion?: number;
}

/**
 * Mantención mensual en CLP. ÚNICA fórmula del repo: wizard (provisión auto),
 * motor (fallback año 1), proyección multi-año, simulador cliente, precio de
 * flujo neutro y legacy-enrich pasan por acá.
 */
export function calcMantencionMensual(p: MantencionMensualParams): number {
  const factor = p.factorInflacion ?? 1;
  if (p.modelo === "legacy") {
    // Byte-idéntico al motor previo: round(precio × tasa / 12), y si hay
    // inflación, round(base × factor) sobre el entero ya redondeado.
    const base = Math.round((p.precioCLP * getMantencionRateLegacy(p.antiguedad)) / 12);
    return factor === 1 ? base : Math.round(base * factor);
  }
  const fisicaBase = Math.round((getMantencionUfM2Anio(p.antiguedad) * p.superficieUtilM2 * p.ufClp) / 12);
  const fisica = factor === 1 ? fisicaBase : Math.round(fisicaBase * factor);
  const techo = Math.round(Math.max(0, p.arriendoCLP) * MANTENCION_TECHO_ARRIENDO_PCT);
  return Math.max(0, Math.min(fisica, techo));
}
