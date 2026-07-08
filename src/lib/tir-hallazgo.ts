// Hallazgo tipado de TIR (retorno total del deal) para LTR — motor determinístico.
// 7º hallazgo, el primero SOLO-LECTURA. Espejo de `cap-rate-hallazgo.ts`: el motor
// envuelve el número que YA calcula (exitScenario.tir) en un hallazgo tipado; NO
// recalcula la TIR. La IA lo narra aguas abajo (skill analysis-voice-franco).
//
// La TIR sale del exit scenario a 10 años al precio pedido — la misma que la prosa
// cita y el drawer negociación tabula. Se compara contra el UMBRAL fijo de 6% que el
// motor ya usa para bisectar el precio límite (analysis.ts) y que el drawer negociación
// ya narra ("mínimo que un deal apalancado debe rendir para ser más atractiva que
// instrumentos de bajo riesgo").
//
// Anti-colisión (analysis-voice-franco A4): ancla al UMBRAL, nunca compara pelado con
// depósito/fondo — esa comparación rica (esfuerzo, iliquidez, riesgo) vive en el bloque
// "Vs. otro instrumento" de largoPlazo, que este hallazgo NO duplica.
//
// SOLO-LECTURA: decisividad 0 fija. La TIR es el integrador de precio+arriendo+tasa+
// pie+plazo+venta y no tiene un driver único que calcDecisividades pueda neutralizar
// sin doble conteo; por eso NO entra al ranking de decisividad. magnitudContinua
// (|tir−6|/banda) solo desempata el sort entre pares de igual decisividad (E4).

import type { HallazgoTIR } from "./types";

// Umbral fijo: 6% — el mínimo bajo el cual un deal apalancado rinde menos de lo que
// justifica su riesgo e iliquidez. Es el MISMO umbral que calcNegociacionScenario usa
// para bisectar el precio límite y que el drawer negociación narra. No es un número
// nuevo: es el que el sistema ya usaba, ahora tipado como referencia del hallazgo.
export const TIR_UMBRAL_MINIMO = 6;

// Banda de normalización de magnitudContinua (|tir−6|/banda saturado a 1). 10 pts:
// mantiene discriminable el rango sano 6–16% (p25–p90 del corpus del sweep) sin clipping
// temprano. Solo desempate secundario del sort entre pares de igual decisividad (E4).
export const TIR_BANDA_MAGNITUD = 10;

// Umbral de la rama "borde": |tir−6| < 0,3 ⇒ la frase dice "justo en el filo" en vez de
// sobre/bajo el mínimo (espejo del "en línea" de cap-rate, |gap|<0,2). La dirección-
// máquina sigue binaria (favorable si tir ≥ 6).
const TIR_BORDE = 0.3;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Construye el proto-hallazgo de TIR reusando exitScenario.tir (:702, no lo recalcula).
 * SOLO-LECTURA: decisividad 0 fija; magnitudContinua = |tir−6|/10 (desempate del sort).
 * Devuelve null si la TIR no es finita (guard defensivo por si calcTIR diverge).
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la reescribe
 * aguas abajo. Voz: tuteo neutro chileno. Glosa TIR inline porque la card de la pirámide
 * es standalone (no hay orden de "primer uso" que garantice la glosa de la prosa).
 */
export function buildHallazgoTIR(p: {
  /** exitScenario.tir — retorno anual del deal a 10 años, %. Reusado de analysis.ts:702. */
  tirPct: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoTIR | null {
  if (!Number.isFinite(p.tirPct)) return null;

  // Redondeo a 1 decimal UNA vez (precisión de display): body (fmt1), gap, dirección y
  // valor.tirPct leen de acá; el KPI/ksub reformatean valor.tirPct → mismo string. Sin
  // esto, body (fmt1 sobre el crudo) y KPI (pct1 sobre valor 2-dec) podían divergir en el
  // borde .x5 (mismo linaje que el bug cap_rate). Patrón round-una-vez de patrimonio.
  const tirPct = Math.round(p.tirPct * 10) / 10;

  const gap = tirPct - TIR_UMBRAL_MINIMO; // signed
  const gapRounded = Math.round(gap * 10) / 10;
  const gapAbs = Math.abs(gapRounded);
  const direccion: "favorable" | "adverso" =
    tirPct >= TIR_UMBRAL_MINIMO ? "favorable" : "adverso";
  const magnitudContinua = clamp01(gapAbs / TIR_BANDA_MAGNITUD);

  const tirFmt = fmt1(tirPct);

  let fraseCanonica: string;
  let titular: string;
  if (gapAbs < TIR_BORDE) {
    titular = "Puesto todo junto, el retorno queda justo en el filo.";
    fraseCanonica =
      `Tu TIR —la rentabilidad anual de toda tu inversión— es ${tirFmt}%, justo en el mínimo ` +
      `de ${TIR_UMBRAL_MINIMO}% que un deal apalancado debería rendir. Está al filo: cualquier ` +
      `supuesto que se mueva (arriendo, tasa, precio de salida) lo define.`;
  } else if (direccion === "favorable") {
    titular = "Puesto todo junto, el retorno anual rinde lo suficiente.";
    fraseCanonica =
      `Tu TIR —la rentabilidad anual de toda tu inversión— es ${tirFmt}%, sobre el mínimo de ` +
      `${TIR_UMBRAL_MINIMO}% que un deal apalancado debería rendir para valer el esfuerzo y la ` +
      `iliquidez. Ese número ya integra el arriendo, tus aportes mensuales y la venta proyectada ` +
      `a 10 años, no solo la renta del mes.`;
  } else {
    titular = "Puesto todo junto, el retorno anual se queda corto.";
    fraseCanonica =
      `Tu TIR —la rentabilidad anual de toda tu inversión— es ${tirFmt}%, bajo el mínimo de ` +
      `${TIR_UMBRAL_MINIMO}% que un deal apalancado debería rendir para justificar el capital y ` +
      `el riesgo. Ese número ya integra el arriendo, tus aportes y la venta a 10 años: no lo ` +
      `levanta la plusvalía.`;
  }

  return {
    id: "tir",
    tipo: "retorno_total",
    valor: {
      tirPct, // ya redondeado a 1 decimal — mismo valor que body/gap/dirección y KPI
      umbralPct: TIR_UMBRAL_MINIMO,
      gapPts: gapRounded,
      banda: TIR_BANDA_MAGNITUD,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad
    magnitudContinua,
    procedencia: {
      base: "TIR del exit scenario a 10 años sobre tu inversión inicial, tus aportes mensuales y la venta proyectada",
      // media: integra una proyección de venta a 10 años (no es dato firme como el flujo
      // declarado, pero tampoco tan especulativo como para ser baja).
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
