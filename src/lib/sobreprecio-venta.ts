// El sobreprecio de hoy, descontado PLANO en la venta al año de salida — decisión de Fabrizio
// (22-sep-2026, variante B medida sobre el parque). Hasta hoy la venta se proyectaba desde tu
// precio al 3% anual: si pagaste 15% sobre la mediana de la comuna, el modelo asumía que al año
// diez el mercado también paga ese 15%. Ahora el exit (LTR: calcExitScenario; STR:
// buildExitScenario) resta el sobreprecio nominal de hoy al valor proyectado, como línea visible
// de la venta en el capítulo «Tu resultado». Solo con mediana confiable y sobre ella; bajo la
// mediana no se suma nada (entrar barato ya se refleja en el precio que pagaste).
//
// Advertencia medida: la mediana es de avisos parecidos, no de tu depto. Con muestra chica la
// corrección es más dudosa; la regla se aplica igual y la fuente lo dice (12 filas LTR con
// sobreprecio ≥ 10% y n < 30 el 22-sep; ninguna STR).

export const SOBREPRECIO_VENTA_MUESTRA_CHICA_N = 30;

export interface SobreprecioVenta {
  /** Lo que pagaste sobre la mediana, en CLP de hoy: precio − precio ÷ (1 + desviación). */
  clp: number;
  /** (sujeto − mediana) / mediana × 100, entero, la misma FUENTE ÚNICA del hallazgo de sobreprecio. */
  desviacionPct: number;
  /** N de avisos de la mediana. */
  n: number;
  /** n < SOBREPRECIO_VENTA_MUESTRA_CHICA_N: la fuente del capítulo lo dice. */
  muestraChica: boolean;
}

/** null cuando no hay mediana confiable o el precio está en o bajo la mediana. */
export function sobreprecioDeHoy(p: { precioCLP: number; desviacionPct: number | null | undefined; confiable: boolean; n: number }): SobreprecioVenta | null {
  if (!p.confiable || typeof p.desviacionPct !== "number" || !Number.isFinite(p.desviacionPct) || !(p.desviacionPct > 0) || !(p.precioCLP > 0)) return null;
  const k = 1 + p.desviacionPct / 100;
  return {
    clp: Math.round(p.precioCLP - p.precioCLP / k),
    desviacionPct: p.desviacionPct,
    n: p.n,
    muestraChica: p.n < SOBREPRECIO_VENTA_MUESTRA_CHICA_N,
  };
}
