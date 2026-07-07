// Hallazgo tipado de SENSIBILIDAD (robustez del veredicto) para LTR — motor
// determinístico. 8º hallazgo y el segundo SOLO-LECTURA (tras TIR). Espejo estructural
// de `tir-hallazgo.ts`, pero en vez de envolver un número que el motor ya calcula, mide
// una propiedad NUEVA: ¿cuánto puede caer el arriendo declarado antes de que el veredicto
// cambie? Es un stress-test del dato más fácil de sobrestimar al simular (el arriendo).
//
// MÉTODO (bisección veredicto-only). El builder NO recalcula hallazgos ni corre el
// pipeline completo: recibe de runAnalysis un closure `veredictoAt(factor)` que reevalúa
// el veredicto sobre un clon del input con `arriendo * factor`, usando la MISMA ruta que
// runAnalysis usa para el veredicto (calcMetrics → score → breakEven → deriveVeredicto).
// Como el hallazgo se siembra en runAnalysis (no dentro de calcMetrics), esa ruta NO
// reconstruye este hallazgo → sin recursión. Bisección en [−50%, 0] a 0,5 punto: el mismo
// procedimiento que calibró el sweep de Fase 0 (of-sensibilidad-sweep.ts), ahora productivo.
//
// SOLO-LECTURA: decisividad 0 fija. La robustez del veredicto es un meta-dato del conjunto
// (integra precio+arriendo+tasa+pie+venta vía el veredicto mismo) sin un driver único que
// calcDecisividades pueda neutralizar; por eso NO entra al ranking. magnitudContinua
// (|margin−corteAdverso|/banda) solo desempata el sort entre pares de igual decisividad (E4).
//
// TRES CASOS ESPECIALES (Fase 0, aprobados):
//   1. veredicto base BUSCAR OTRA → hallazgo OMITIDO (return null): no tiene sentido
//      preguntar "cuánto aguanta antes de empeorar" cuando ya es el peor veredicto.
//   2. no cambia ni a −50% (firme) → "Aguanta −50% o más", dirección FAVORABLE.
//   3. arriendo no computable (≤0 o no finito) → OMITIDO: no se puede escalar una caída.

import type { HallazgoSensibilidad, Veredicto } from "./types";

// Cortes de clasificación (Fase 0). Bajo el corte adverso el veredicto cuelga de un
// arriendo justo (dirección adversa); sobre el favorable la conclusión es firme; entre
// medio hay colchón acotado (borde). La dirección-máquina es binaria: adversa solo en la
// banda frágil (< corteAdverso), favorable en borde y firme.
export const SENS_CORTE_ADVERSO = 7;    // < 7% de caída aguantada ⇒ frágil / adverso
export const SENS_CORTE_FAVORABLE = 15; // ≥ 15% ⇒ firme / favorable

// Banda de normalización de magnitudContinua (|margin−corteAdverso|/banda saturado a 1).
// 25 pts: mantiene discriminable el rango 0–50% del margen sin clipping temprano. Solo
// desempate secundario del sort entre pares de igual decisividad (E4).
export const SENS_BANDA_MAGNITUD = 25;

// Barrido de la bisección: caída máxima explorada (−50%) y precisión (0,5 punto). Idénticos
// al sweep de Fase 0 — la ground truth calibrada. −50% es el piso: bajo eso el arriendo
// dejaría de ser un error de estimación para ser otra propiedad.
const SENS_FACTOR_MIN = 0.5;  // −50%
const SENS_PREC_PTS = 0.5;    // precisión en puntos porcentuales
const SENS_PREC_FACTOR = SENS_PREC_PTS / 100;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// Margen sin decimal si es entero (−7%), coma chilena si no (−7,5%).
const fmtMargin = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/**
 * Construye el proto-hallazgo de SENSIBILIDAD por bisección veredicto-only.
 * SOLO-LECTURA: decisividad 0 fija; magnitudContinua = |margin−7|/25 (desempate del sort).
 * Devuelve null en dos de los tres casos especiales (BUSCAR OTRA base · arriendo no computable).
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la reescribe aguas
 * abajo. Voz: tuteo neutro chileno. Traduce a consecuencia vivida (skill A11): nunca narra
 * "el veredicto cruza / el margen de sensibilidad", siempre "si el arriendo real cae X%, el
 * veredicto pasa de A a B".
 */
export function buildHallazgoSensibilidad(p: {
  /** Veredicto al arriendo declarado — el canónico ya computado por runAnalysis. */
  veredictoBase: Veredicto;
  /** Arriendo mensual declarado (CLP). Se escala por el factor de la bisección. */
  arriendo: number;
  /** Reevalúa el veredicto con `arriendo * factor` por la ruta veredicto-only de runAnalysis. */
  veredictoAt: (factor: number) => Veredicto;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoSensibilidad | null {
  // Caso especial 1: BUSCAR OTRA base ⇒ omitido.
  if (p.veredictoBase === "BUSCAR OTRA") return null;
  // Caso especial 3: arriendo no computable ⇒ omitido (no se puede escalar una caída).
  if (!Number.isFinite(p.arriendo) || p.arriendo <= 0) return null;

  // ¿Cambia siquiera con una caída de −50%? Si no, el veredicto es firme.
  const vMin = p.veredictoAt(SENS_FACTOR_MIN);

  let marginPct: number;
  let firme = false;
  let veredictoNuevo: Veredicto | null = null;

  if (vMin === p.veredictoBase) {
    // Caso especial 2: no cambia ni al piso ⇒ firme. Aguanta −50% o más.
    firme = true;
    marginPct = 50;
  } else {
    // Bisección. Invariante: veredictoAt(hi) == base, veredictoAt(lo) != base.
    // hi converge al factor más bajo que MANTIENE el veredicto; (1−hi) = caída que aguanta.
    let lo = SENS_FACTOR_MIN;
    let hi = 1.0;
    veredictoNuevo = vMin;
    while (hi - lo > SENS_PREC_FACTOR) {
      const mid = (lo + hi) / 2;
      const v = p.veredictoAt(mid);
      if (v === p.veredictoBase) {
        hi = mid;
      } else {
        lo = mid;
        veredictoNuevo = v;
      }
    }
    marginPct = Math.round(((1 - hi) * 100) / SENS_PREC_PTS) * SENS_PREC_PTS;
  }

  // Clasificación en 3 bandas (cortes 7/15). La dirección-máquina es binaria: solo la
  // banda frágil es adversa; borde y firme son favorables (llevan colchón).
  const fragil = !firme && marginPct < SENS_CORTE_ADVERSO;
  const firmeFinito = !firme && marginPct >= SENS_CORTE_FAVORABLE;
  const direccion: "favorable" | "adverso" = fragil ? "adverso" : "favorable";
  const magnitudContinua = clamp01(Math.abs(marginPct - SENS_CORTE_ADVERSO) / SENS_BANDA_MAGNITUD);

  const x = fmtMargin(marginPct);
  const base = p.veredictoBase;
  const nuevo = veredictoNuevo; // no null salvo firme

  let titular: string;
  let fraseCanonica: string;
  if (firme) {
    // Caso 2 — no cambia ni a −50%.
    titular = "El veredicto se sostiene aunque el arriendo caiga fuerte.";
    fraseCanonica =
      `Tu veredicto ${base} no se mueve aunque el arriendo real venga −50% o más por debajo del ` +
      `que declaraste. Es una conclusión firme: no depende de que hayas achuntado el arriendo al peso.`;
  } else if (firmeFinito) {
    titular = "El veredicto se sostiene aunque el arriendo caiga fuerte.";
    fraseCanonica =
      `Tu veredicto ${base} aguanta que el arriendo real caiga hasta un ${x}% frente al que declaraste ` +
      `antes de cambiar a ${nuevo}. Es un colchón amplio: la conclusión no cuelga de que el arriendo ` +
      `declarado sea exacto.`;
  } else if (fragil) {
    // Frágil (adverso) — el fix A11 de Fase 1: "validación en terreno" era jerga; se
    // reemplaza por la acción llana "confirma ese arriendo contra publicaciones reales".
    titular = "El veredicto se sostiene solo si el arriendo se cumple.";
    fraseCanonica =
      `Tu veredicto ${base} se apoya en el arriendo que declaraste: si el real resultara apenas un ${x}% ` +
      `más bajo, pasaría a ${nuevo}. Antes de firmar, confirma ese arriendo contra publicaciones reales de la zona.`;
  } else {
    // Borde (favorable, colchón acotado).
    titular = "El veredicto aguanta un arriendo algo más bajo.";
    fraseCanonica =
      `Tu veredicto ${base} aguanta que el arriendo real venga hasta un ${x}% por debajo del que declaraste ` +
      `antes de pasar a ${nuevo} — un colchón acotado. Si cargaste un arriendo optimista, confírmalo contra ` +
      `publicaciones reales de la zona antes de decidir.`;
  }

  return {
    id: "sensibilidad",
    tipo: "robustez_veredicto",
    valor: {
      marginPct,
      firme,
      veredictoBase: base,
      veredictoNuevo,
      corteAdverso: SENS_CORTE_ADVERSO,
      corteFavorable: SENS_CORTE_FAVORABLE,
      banda: SENS_BANDA_MAGNITUD,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad
    magnitudContinua,
    procedencia: {
      base: "Reevaluación del veredicto bajando el arriendo declarado paso a paso",
      // alta: es un recálculo determinístico sobre tus propios datos, no una estimación
      // externa con supuestos blandos.
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
