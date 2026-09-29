// ─────────────────────────────────────────────────────────────────────────────
// Contribuciones (impuesto territorial) trimestrales, estimadas con la regla del SII.
//
// LA EXENCIÓN DFL2 (29-sep-2026). Hasta hoy el DFL2 era un monto fijo de $50M que competía con la
// exención general de $57M en un `Math.max`: como 50M < 57M, nunca aplicaba. La regla del SII es
// otra:
//  · El DFL2 exime el 50% del AVALÚO (no del impuesto), y compite con la exención general: se
//    aplica una sola, la más beneficiosa (guías SII de reavalúo 2018 y 2022). Por eso solo mueve la
//    contribución cuando el avalúo supera dos veces la exención general.
//  · Dura 20 años hasta 70 m², 15 hasta 100 m² y 10 hasta 140 m² (art. 14 DFL2; SII Ord.
//    3303/2012), contados desde el certificado de recepción del edificio. Un usado conserva los
//    años que le quedan. Más de 140 m² no califica.
//  · Solo personas naturales, hasta dos viviendas DFL2 por titular (Ley 20.455, Ley 21.420). El
//    motor no sabe cuántas tiene el comprador y ASUME que califica: es un supuesto declarado.
//  · No hay tope de avalúo propio del DFL2 en las fuentes oficiales: la cifra de «$33 millones del
//    reavalúo 2018» que circula es la exención general de ese año, no un tope.
// ─────────────────────────────────────────────────────────────────────────────

// Valores del cálculo, vigentes desde el 1-jul-2026 (SII, reajuste semestral por IPC; tasas del
// reavalúo habitacional 2022). Hasta el 29-sep-2026 el código traía las tasas y el tramo del
// reavalúo 2018 (0,933% / 1,088%, cambio en $118,6M) y una exención general atrasada ($57M).
// Se reajustan cada 1 de enero y 1 de julio: al actualizar, cambiar los dos montos juntos.
// El avalúo fiscal se aproxima como 70% del valor comercial (supuesto de Franco, no del SII).
const RATIO_AVALUO_COMERCIAL = 0.70;
const EXENCION_GENERAL = 61_711_570;  // exención habitacional, 2º semestre 2026
const CAMBIO_TASA = 220_398_431;      // avalúo donde cambia de tasa, 2º semestre 2026
const TASA_1 = 0.00893;               // 0,893% anual hasta el monto de cambio de tasa
const TASA_2 = 0.01042;               // 1,042% anual sobre ese monto
const SOBRETASA_TRAMO_2 = 0.00025;    // 0,025% sobre el tramo de la tasa mayor

/** Los parámetros vigentes, para que el golden recalcule el caso a mano. */
export const PARAMETROS_CONTRIBUCIONES = { RATIO_AVALUO_COMERCIAL, EXENCION_GENERAL, CAMBIO_TASA, TASA_1, TASA_2, SOBRETASA_TRAMO_2 } as const;

/** Parte del avalúo que exime el DFL2 mientras está vigente. */
export const DFL2_EXENCION_AVALUO = 0.5;

/** Años de beneficio DFL2 según la superficie edificada; null si no califica (> 140 m²). */
export function duracionDfl2(superficieM2: number | null | undefined): number | null {
  if (!(typeof superficieM2 === "number" && superficieM2 > 0)) return null;
  if (superficieM2 <= 70) return 20;
  if (superficieM2 <= 100) return 15;
  if (superficieM2 <= 140) return 10;
  return null;
}

export interface DatosDfl2 {
  /** Superficie edificada de la unidad. Sin ella no se puede saber el plazo: no aplica. */
  superficieM2?: number | null;
  /** Años desde la recepción del edificio a la fecha del análisis (0 para obra nueva). */
  aniosDesdeRecepcion?: number | null;
}

/** Años de beneficio que le quedan (0 si no califica o ya venció). */
export function aniosRestantesDfl2(d: DatosDfl2 | null | undefined): number {
  const dur = duracionDfl2(d?.superficieM2);
  if (dur == null) return 0;
  const edad = Math.max(0, Number(d?.aniosDesdeRecepcion) || 0);
  return Math.max(0, dur - edad);
}

/**
 * Contribución trimestral estimada en CLP.
 * @param precioCLP valor comercial en CLP
 * @param dfl2 datos para el beneficio DFL2; sin ellos (o vencido) se calcula sin DFL2
 */
export function estimarContribuciones(precioCLP: number, dfl2?: DatosDfl2 | null): number {
  if (precioCLP <= 0) return 0;
  const avaluoFiscal = precioCLP * RATIO_AVALUO_COMERCIAL;
  const exentoDfl2 = aniosRestantesDfl2(dfl2) > 0 ? avaluoFiscal * DFL2_EXENCION_AVALUO : 0;
  // Una sola exención, la más beneficiosa (SII).
  const exencion = Math.max(EXENCION_GENERAL, exentoDfl2);
  const avaluoAfecto = Math.max(0, avaluoFiscal - exencion);
  if (avaluoAfecto <= 0) return 0;
  const tramoTasa1 = Math.max(0, Math.min(avaluoAfecto, CAMBIO_TASA - exencion));
  const tramoTasa2 = Math.max(0, avaluoAfecto - tramoTasa1);
  let contribAnual = tramoTasa1 * TASA_1 + tramoTasa2 * TASA_2;
  if (tramoTasa2 > 0) contribAnual += tramoTasa2 * SOBRETASA_TRAMO_2;
  return Math.round(contribAnual / 4);
}

// ─── Las filas guardadas ─────────────────────────────────────────────────────
// Hasta el 29-sep-2026 el wizard mandaba en `contribuciones` la estimación de esta misma función
// sin DFL2 (el `Math.max` lo anulaba) y no guardaba si el número era estimado o escrito por el
// usuario. Para que el arreglo alcance a esas filas, una contribución que calza con la estimación
// vieja se trata como estimada y se vuelve a estimar; una que no calza la escribió el usuario y
// manda (ya trae su beneficio, si lo tiene). La función vieja queda congelada acá solo para esa
// comparación: no se actualiza nunca.
function estimarContribucionesAnterior(precioCLP: number): number {
  if (precioCLP <= 0) return 0;
  const avaluoFiscal = precioCLP * 0.70;
  const exencion = 57_000_000;
  const avaluoAfecto = Math.max(0, avaluoFiscal - exencion);
  if (avaluoAfecto <= 0) return 0;
  const tramoTasa1 = Math.max(0, Math.min(avaluoAfecto, 118_571_000 - exencion));
  const tramoTasa2 = Math.max(0, avaluoAfecto - tramoTasa1);
  let contribAnual = tramoTasa1 * 0.00933 + tramoTasa2 * 0.01088;
  if (tramoTasa2 > 0) contribAnual += tramoTasa2 * 0.00025;
  return Math.round(contribAnual / 4);
}

/** ¿La contribución guardada es la estimación de antes del 29-sep-2026? (tolerancia 1% o $2). */
export function esEstimacionAnterior(contribucion: number, precioCLP: number): boolean {
  const vieja = estimarContribucionesAnterior(precioCLP);
  return Math.abs(contribucion - vieja) <= Math.max(2, vieja * 0.01);
}

export interface ContribucionesResueltas {
  /** Trimestral vigente hoy. */
  trimestral: number;
  /** true si es estimación de Franco (se re-estima y lleva escalón DFL2); false si la declaró el usuario. */
  estimada: boolean;
  /** Si hay beneficio DFL2 vigente: trimestral sin él y años que le quedan desde la recepción. */
  dfl2: { aniosRestantes: number; trimestralSinDfl2: number } | null;
}

/**
 * La contribución que usa el motor. Declarada por el usuario: manda tal cual. Estimada (origen
 * «estimada», vacía o igual a la estimación anterior): se estima con la regla vigente, DFL2
 * incluido, y se informa cuánto sería sin el beneficio para el escalón de la proyección.
 */
export function resolverContribuciones(p: {
  declarada: number | null | undefined;
  origen?: "estimada" | "declarada" | null;
  precioCLP: number;
  superficieM2?: number | null;
  aniosDesdeRecepcion?: number | null;
}): ContribucionesResueltas {
  const declarada = Number(p.declarada) || 0;
  const estimada =
    p.origen === "estimada" ? true
    : p.origen === "declarada" ? false
    : declarada <= 0 || esEstimacionAnterior(declarada, p.precioCLP);
  if (!estimada) return { trimestral: declarada, estimada: false, dfl2: null };
  const datos: DatosDfl2 = { superficieM2: p.superficieM2, aniosDesdeRecepcion: p.aniosDesdeRecepcion };
  const trimestral = estimarContribuciones(p.precioCLP, datos);
  const sinDfl2 = estimarContribuciones(p.precioCLP, null);
  const restantes = aniosRestantesDfl2(datos);
  return {
    trimestral,
    estimada: true,
    dfl2: restantes > 0 && sinDfl2 > trimestral ? { aniosRestantes: restantes, trimestralSinDfl2: sinDfl2 } : null,
  };
}

/** La contribución trimestral de una entrada de renta corta (input_data o body del wizard). */
export function contribucionesDeEntradaStr(src: Record<string, unknown> | null | undefined): number {
  const declarada = Number(src?.contribuciones) || 0;
  const origen = src?.contribucionesOrigen === "estimada" || src?.contribucionesOrigen === "declarada" ? src.contribucionesOrigen : null;
  // Renta corta usó siempre la contribución guardada tal cual, cero incluido (a diferencia de
  // renta larga, que estimaba el cero). Un cero sin origen se respeta: no es una estimación.
  if (declarada <= 0 && origen !== "estimada") return 0;
  return resolverContribuciones({
    declarada,
    origen,
    precioCLP: Number(src?.precioCompra) || 0,
    superficieM2: Number(src?.superficieUtil) || null,
    aniosDesdeRecepcion: src?.tipoPropiedad === "nuevo" ? 0 : Number(src?.antiguedad) || 0,
  }).trimestral;
}
