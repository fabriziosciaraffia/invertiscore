// Hallazgo tipado de flujo mensual (aporte de bolsillo) para LTR — motor
// determinístico. Espejo de `cap-rate-hallazgo.ts`: el motor envuelve el número
// que YA calcula (analysis.ts:242, `flujoNetoMensual`) en un hallazgo tipado;
// NO lo recalcula. La IA lo narra aguas abajo (skill analysis-voice-franco).
//
// DOCTRINA: un aporte mensual NEGATIVO no es malo por sí solo. El flujo se juzga
// por MAGNITUD relativa a la capacidad de sostenerlo (el dividendo), no por
// signo. Aporte chico o positivo → no decisivo. Aporte grande → decisivo.
//
// A diferencia de cap_rate, este hallazgo NO compara contra una referencia de
// mercado externa: el número sale 100% de inputs del usuario vía motor
// determinístico (de ahí confianza "alta"). El divisor de la decisividad es el
// dividendo mensual, otro número que ya vive en el motor, pasado como PARÁMETRO.

import type { HallazgoFlujoMensual } from "./types";

const fmtCLP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");

/**
 * Fracción del dividendo a partir de la cual el aporte negativo se considera
 * decisivo (frase "fuerte"). Espejo del Gate 1 del veredicto (analysis.ts:1225):
 * `|flujoNeto| / dividendo > 0.5` ya tumba el veredicto a BUSCAR OTRA. El mismo
 * 0.5 separa el aporte "acotado" del "fuerte" en la narración determinística.
 */
const UMBRAL_DECISIVO = 0.5;

/**
 * Construye el proto-hallazgo de flujo mensual reusando el aporte del motor
 * (:242) y el dividendo (:224). La decisividad es `|aporte| / dividendo`
 * saturada a 1; el divisor es PARÁMETRO, nunca lo busca por su cuenta. Devuelve
 * null si los números no son finitos o si no hay dividendo computable (>0).
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la
 * reescribe aguas abajo. Voz: tuteo neutro chileno.
 */
export function buildHallazgoFlujoMensual(p: {
  /** Aporte mensual neto, en CLP. Signed. Reusado de analysis.ts:242. */
  flujoNetoMensualCLP: number;
  /** Dividendo mensual, en CLP. Base de la frase "acotado/fuerte" (analysis.ts:224). */
  dividendoMensualCLP: number;
  modalidad: "ltr" | "str" | "ambas";
  /** Decisividad calibrada (0..1) inyectada por calcDecisividades — escala común
   *  "Δdecisión" (E2). El builder ya NO la calcula con |aporte|/dividendo. */
  decisividad: number;
  /** Magnitud continua pre-floor — desempate secundario del sort (E4). */
  magnitudContinua: number;
}): HallazgoFlujoMensual | null {
  if (!Number.isFinite(p.flujoNetoMensualCLP)) return null;
  if (!Number.isFinite(p.dividendoMensualCLP) || p.dividendoMensualCLP <= 0) return null;

  const aporte = p.flujoNetoMensualCLP;
  // ratio |aporte|/dividendo: ya NO es la decisividad, pero SIGUE definiendo la
  // frase ("acotado" vs "fuerte") y el campo valor.ratioSobreDividendo.
  const ratio = Math.abs(aporte) / p.dividendoMensualCLP;
  const direccion: "favorable" | "adverso" = aporte >= 0 ? "favorable" : "adverso";

  const montoFmt = fmtCLP(aporte);

  let fraseCanonica: string;
  let titular: string;
  if (direccion === "favorable") {
    titular = "El arriendo cubre la cuota y no pones nada.";
    fraseCanonica =
      `Tu arriendo cubre todos los costos y te deja ${montoFmt} al mes en el bolsillo. ` +
      `La propiedad se sostiene sola desde el día uno.`;
  } else if (ratio < UMBRAL_DECISIVO) {
    titular = "Pones algo de tu bolsillo cada mes.";
    fraseCanonica =
      `Tienes que poner ${montoFmt} al mes de tu bolsillo — un aporte acotado frente al dividendo. ` +
      `Sostenible si tu flujo es estable; la plusvalía puede compensarlo.`;
  } else {
    titular = "Pones plata de tu bolsillo todos los meses.";
    fraseCanonica =
      `Tienes que poner ${montoFmt} al mes de tu bolsillo — un aporte fuerte respecto al dividendo. ` +
      `Antes de avanzar, confirma que puedes sostenerlo de forma estable mes a mes: es plata ` +
      `que sale de tu bolsillo todos los meses, no del arriendo.`;
  }

  return {
    id: "flujo_mensual",
    tipo: "aporte_mensual",
    valor: {
      flujoNetoMensualCLP: Math.round(aporte),
      dividendoMensualCLP: Math.round(p.dividendoMensualCLP),
      ratioSobreDividendo: Math.round(ratio * 100) / 100,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: {
      base: "aporte mensual neto sobre tus datos declarados, tras dividendo y todos los gastos operativos",
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
