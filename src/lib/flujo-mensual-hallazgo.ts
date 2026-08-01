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
 * Plantilla determinística de titular + fraseCanonica de flujo, parametrizada por el monto
 * YA formateado. Fuente ÚNICA del texto — la llaman DOS consumidores con la MISMA plantilla:
 *   (a) el builder (abajo) con `fmtCLP(aporte)` → la fraseCanonica SEEDED en CLP, que la
 *       apertura Plan C consume bit-idéntica (contrato de la prosa persistida).
 *   (b) el render de la card (GenericFindingCard.fraseCanonicaCard) con el monto en la moneda
 *       ACTIVA → body dual, sin $ en modo UF.
 * `montoFmt` ya trae signo/símbolo; la rama (favorable / acotado / fuerte) NO depende de la
 * moneda, solo de dirección y ratio → el texto es idéntico salvo el monto formateado.
 */
/**
 * Rama del CIERRE de la frase "acotada" (paquete A, familia 1 del censo editorial): el
 * consuelo "la plusvalía puede compensarlo" solo se emite cuando es verdad.
 *   "plusvalia" — veredicto no-BUSCAR y plusvalía histórica ≥ umbral real (texto original).
 *   "estable"   — plusvalía débil/negativa: el cierre nombra por qué NO invoca la plusvalía.
 *   "ninguno"   — veredicto BUSCAR OTRA: cero consuelo; el aporte se narra como constante.
 * Default "plusvalia" = comportamiento legacy (filas persistidas sin valor.consuelo).
 */
export type ConsueloFlujo = "plusvalia" | "estable" | "ninguno";

export function buildFraseFlujo(
  montoFmt: string,
  direccion: "favorable" | "adverso",
  ratio: number,
  consuelo: ConsueloFlujo = "plusvalia",
): { titular: string; fraseCanonica: string } {
  if (direccion === "favorable") {
    return {
      titular: "El arriendo cubre la cuota y no pones nada.",
      fraseCanonica:
        `Tu arriendo cubre todos los costos y te deja ${montoFmt} al mes en el bolsillo. ` +
        `La propiedad se sostiene sola desde el día uno.`,
    };
  }
  if (ratio < UMBRAL_DECISIVO) {
    const titular = "Pones algo de tu bolsillo cada mes.";
    if (consuelo === "ninguno") {
      return {
        titular,
        fraseCanonica:
          `Tienes que poner ${montoFmt} al mes de tu bolsillo — acotado frente al dividendo, ` +
          `y constante: sale de tu bolsillo mes a mes mientras tengas el depto, y el resto ` +
          `del caso no lo compensa.`,
      };
    }
    if (consuelo === "estable") {
      return {
        titular,
        fraseCanonica:
          `Tienes que poner ${montoFmt} al mes de tu bolsillo — un aporte acotado frente al dividendo. ` +
          `Sostenible si tu flujo es estable; eso sí, la plusvalía histórica de la comuna no está ` +
          `para compensarlo.`,
      };
    }
    return {
      titular,
      fraseCanonica:
        `Tienes que poner ${montoFmt} al mes de tu bolsillo — un aporte acotado frente al dividendo. ` +
        `Sostenible si tu flujo es estable; la plusvalía puede compensarlo.`,
    };
  }
  return {
    titular: "Pones plata de tu bolsillo todos los meses.",
    fraseCanonica:
      `Tienes que poner ${montoFmt} al mes de tu bolsillo — un aporte fuerte respecto al dividendo. ` +
      `Antes de avanzar, confirma que puedes sostenerlo de forma estable mes a mes: es plata ` +
      `que sale de tu bolsillo todos los meses, no del arriendo.`,
  };
}

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
  /** Rama del cierre "acotado" (familia 1). El caller la deriva del contexto que el
   *  builder no tiene: plusvalía de la comuna en calcMetrics ("plusvalia"/"estable")
   *  y veredicto en runAnalysis ("ninguno" vía aplicarVeredictoAFlujo, post-derive).
   *  Ausente ⇒ "plusvalia" (comportamiento legacy). */
  consuelo?: ConsueloFlujo;
}): HallazgoFlujoMensual | null {
  if (!Number.isFinite(p.flujoNetoMensualCLP)) return null;
  if (!Number.isFinite(p.dividendoMensualCLP) || p.dividendoMensualCLP <= 0) return null;

  const aporte = p.flujoNetoMensualCLP;
  // ratio |aporte|/dividendo: ya NO es la decisividad, pero SIGUE definiendo la
  // frase ("acotado" vs "fuerte") y el campo valor.ratioSobreDividendo.
  const ratio = Math.abs(aporte) / p.dividendoMensualCLP;
  const direccion: "favorable" | "adverso" = aporte >= 0 ? "favorable" : "adverso";
  const consuelo = p.consuelo ?? "plusvalia";

  // Frase SEEDED en CLP (contrato Plan C bit-idéntico): el monto va en CLP vía fmtCLP. El
  // render de la card reusa la MISMA plantilla (buildFraseFlujo) con el monto en la moneda
  // activa — misma rama, mismo texto, solo cambia el formato del monto.
  const { titular, fraseCanonica } = buildFraseFlujo(fmtCLP(aporte), direccion, ratio, consuelo);

  // valor.consuelo solo se persiste en la rama que lo usa (adverso + acotado): ahí el
  // render necesita reproducir la MISMA variante. En favorable/fuerte no aplica.
  const consueloPersistido =
    direccion === "adverso" && ratio < UMBRAL_DECISIVO ? consuelo : undefined;

  return {
    id: "flujo_mensual",
    tipo: "aporte_mensual",
    valor: {
      flujoNetoMensualCLP: Math.round(aporte),
      dividendoMensualCLP: Math.round(p.dividendoMensualCLP),
      ratioSobreDividendo: Math.round(ratio * 100) / 100,
      modalidad: p.modalidad,
      ...(consueloPersistido ? { consuelo: consueloPersistido } : {}),
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

/**
 * Parche post-veredicto (familia 1): el hallazgo se emite en calcMetrics, ANTES de que
 * runAnalysis derive el veredicto — por eso el "ninguno" (BUSCAR OTRA) no puede decidirse
 * en el builder. runAnalysis llama esto DESPUÉS de deriveVeredicto y reemplaza el carrier:
 * si el veredicto es BUSCAR OTRA y la frase quedó en rama acotada-con-consuelo, se re-emite
 * con consuelo "ninguno" (misma plantilla, mismos números). En cualquier otro caso devuelve
 * el hallazgo intacto (referencia idéntica — cero churn en COMPRAR/AJUSTA).
 */
export function aplicarVeredictoAFlujo(
  h: HallazgoFlujoMensual,
  veredicto: string,
): HallazgoFlujoMensual {
  if (veredicto !== "BUSCAR OTRA") return h;
  if (h.direccion !== "adverso") return h;
  const ratio = h.valor.ratioSobreDividendo;
  if (!(ratio < UMBRAL_DECISIVO)) return h;
  if (h.valor.consuelo === "ninguno") return h;

  const { titular, fraseCanonica } = buildFraseFlujo(
    fmtCLP(h.valor.flujoNetoMensualCLP),
    h.direccion,
    ratio,
    "ninguno",
  );
  return { ...h, titular, fraseCanonica, valor: { ...h.valor, consuelo: "ninguno" } };
}
