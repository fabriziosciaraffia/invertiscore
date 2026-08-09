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

import type { HallazgoFlujoMensual, YearProjection, AnalysisMetrics } from "./types";
import { contarAniosPreEntrega } from "./pre-entrega-serie";

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

/**
 * Señal de HORIZONTE para la frase favorable (rama flujo-copy-preentrega): la afirmación
 * "se sostiene sola desde el día uno" miraba SOLO el snapshot de hoy, y la proyección
 * año a año puede contradecirla (cruces de banda de mantención) o el "día uno" puede
 * estar a años (entrega futura). Se computa UNA vez en runAnalysis (cuando la serie ya
 * existe) y se persiste en valor.horizonte para que la card reproduzca la MISMA rama.
 */
export interface HorizonteFlujo {
  /** Años de espera pre-entrega leídos de la serie (0 = entrega inmediata). */
  aniosPre: number;
  /** Primer tramo de años con flujo anual negativo POST-entrega (anio calendario de la
   *  serie), o null si todos los años operativos son positivos. */
  negDesde: number | null;
  negHasta: number | null;
}

/**
 * Lee la serie y devuelve el horizonte del flujo. El tramo negativo reportado es el
 * PRIMERO (contiguo): para la frase basta saber dónde se abre el hoyo; si hay más de
 * uno, el primero es el que desmiente el "para siempre".
 */
export function analizarHorizonteFlujo(
  projections: YearProjection[],
  metrics: Pick<AnalysisMetrics, "precioCLP" | "pieCLP">,
): HorizonteFlujo {
  const aniosPre = contarAniosPreEntrega(projections, metrics);
  let negDesde: number | null = null;
  let negHasta: number | null = null;
  for (const p of projections.slice(aniosPre)) {
    if (p.flujoAnual < 0) {
      if (negDesde === null) { negDesde = p.anio; negHasta = p.anio; }
      else if (negHasta === p.anio - 1) { negHasta = p.anio; }
      else break; // segundo tramo: la frase solo carga el primero
    }
  }
  return { aniosPre, negDesde, negHasta };
}

export function buildFraseFlujo(
  montoFmt: string,
  direccion: "favorable" | "adverso",
  ratio: number,
  consuelo: ConsueloFlujo = "plusvalia",
  horizonte?: HorizonteFlujo,
): { titular: string; fraseCanonica: string } {
  if (direccion === "favorable") {
    const titular = "El arriendo cubre la cuota y no pones nada.";
    const pre = (horizonte?.aniosPre ?? 0) > 0;
    const neg = horizonte?.negDesde != null;
    // Tramo negativo en palabras: "el año A" o "entre el año A y el B". Causa real de los
    // cruces observados: la banda de mantención proyectada sube con la antigüedad.
    const tramo =
      horizonte?.negDesde != null
        ? horizonte.negHasta != null && horizonte.negHasta !== horizonte.negDesde
          ? `entre el año ${horizonte.negDesde} y el ${horizonte.negHasta}`
          : `el año ${horizonte.negDesde}`
        : "";
    if (pre && neg) {
      return {
        titular,
        fraseCanonica:
          `Cuando el depto se entregue (año ${horizonte!.aniosPre + 1} de la proyección), el arriendo cubre ` +
          `todos los costos y te deja ${montoFmt} al mes. Dos cosas a la vista: hasta escriturar no hay ` +
          `arriendo, y ${tramo} la mantención proyectada sube y esos años pones tú la diferencia.`,
      };
    }
    if (pre) {
      return {
        titular,
        fraseCanonica:
          `El arriendo cubre todos los costos y te deja ${montoFmt} al mes — desde la entrega ` +
          `(año ${horizonte!.aniosPre + 1} de la proyección), que es cuando este depto empieza a operar. ` +
          `Hasta escriturar no hay arriendo.`,
      };
    }
    if (neg) {
      return {
        titular,
        fraseCanonica:
          `Tu arriendo cubre todos los costos y te deja ${montoFmt} al mes en el bolsillo. ` +
          `Ojo más adelante: ${tramo} la mantención proyectada sube y esos años pones tú la diferencia.`,
      };
    }
    return {
      titular,
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
/**
 * Parche post-proyección (rama flujo-copy-preentrega): el hallazgo se emite en calcMetrics,
 * ANTES de que exista la serie — por eso el horizonte no puede decidirse en el builder.
 * runAnalysis llama esto DESPUÉS de calcProjections: solo toca la rama FAVORABLE (las
 * adversas no prometen sostenibilidad), re-emite la frase con la señal y la persiste en
 * valor.horizonte para que la card reproduzca la misma variante. Si el horizonte es el
 * caso base (inmediata, sin años negativos), devuelve el hallazgo intacto — cero churn.
 */
export function aplicarHorizonteAFlujo(
  h: HallazgoFlujoMensual,
  projections: YearProjection[],
  metrics: Pick<AnalysisMetrics, "precioCLP" | "pieCLP">,
): HallazgoFlujoMensual {
  if (h.direccion !== "favorable") return h;
  const horizonte = analizarHorizonteFlujo(projections, metrics);
  if (horizonte.aniosPre === 0 && horizonte.negDesde === null) return h;
  const { titular, fraseCanonica } = buildFraseFlujo(
    fmtCLP(h.valor.flujoNetoMensualCLP),
    h.direccion,
    h.valor.ratioSobreDividendo,
    h.valor.consuelo,
    horizonte,
  );
  return { ...h, titular, fraseCanonica, valor: { ...h.valor, horizonte } };
}

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
