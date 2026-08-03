// ─────────────────────────────────────────────────────────────────────────
// Serie del Chart de Patrimonio (Patrón 7.B.3) — builder PURO, fuente única.
//
// Extraído verbatim del useMemo de src/components/analysis/PatrimonioChart.tsx
// (Ronda 4a.2) para que la vista web (Recharts) y la vista documento (SVG
// estático server-side) consuman EXACTAMENTE la misma serie — cero recálculo
// divergente.
//
// Semántica:
//  - aporteAcum: plata TUYA puesta hasta el año i = gastos de cierre + corretaje
//    + pie (prorrateado por cuotas si el pie se paga en cuotas) + |flujo negativo
//    acumulado|. NO es capitalInvertido del motor.
//  - valorDepto: valor de MERCADO del activo; null pre-entrega (el comprador aún
//    no lo recibe, así que no es suyo para graficar).
//  - precioPactadoCLP: el precio de la promesa. Fijo todos los años — esa es la
//    ventaja del comprador. La diferencia contra valorDepto es plusvalía.
//  - patrimonioNeto: valor − deuda post-entrega; = aporteAcum pre-entrega.
// ─────────────────────────────────────────────────────────────────────────

import type { YearProjection, AnalysisMetrics, AnalisisInput } from "./types";

export interface PatrimonioRow {
  anio: number;
  aporteAcum: number;
  valorDepto: number | null;
  /**
   * Precio pactado en la promesa (CLP), constante en toda la serie. El chart
   * desglosa la barra de valor en `precioPactadoCLP` + (valorDepto − precioPactadoCLP)
   * = plusvalía acumulada. Con entrega inmediata la plusvalía del año 0 es 0 y el
   * desglose sigue siendo válido (todo el bloque es precio pactado).
   */
  precioPactadoCLP: number;
  patrimonioNeto: number;
  flujoAcumulado: number;
  deudaPendiente: number;
  isPreEntrega: boolean;
}

export function buildPatrimonioSeries(
  projections: YearProjection[],
  metrics: AnalysisMetrics,
  inputData: AnalisisInput,
  valorUF: number,
  plazoAnios: number,
): PatrimonioRow[] {
  const pieCLP = metrics.pieCLP ?? 0;
  const precioCLP = metrics.precioCLP ?? 0;
  const creditoInicial = Math.max(precioCLP - pieCLP, 0);
  const gastosCierre = Math.round(precioCLP * 0.02);
  const corretaje = metrics.corretajeInicialCLP ?? 0;

  const totalCuotas = inputData.cuotasPie > 0 ? inputData.cuotasPie : 0;
  const montoCuota = inputData.montoCuota > 0 ? inputData.montoCuota : 0;
  const enCuotasPie = totalCuotas > 0 && montoCuota > 0;

  const rows: PatrimonioRow[] = [];

  // Años de espera hasta la entrega. Se leen de `metrics.preEntrega`, que el motor
  // congela contra el `asOf` del análisis (created_at). Antes se recalculaban acá
  // con `new Date()` vivo: el mismo análisis movía su año de entrega con el paso del
  // tiempo y divergía de calcProjections, que sí usa asOf. Ausente ⇒ 0 (sin espera).
  const aniosEntregaInternal = metrics.preEntrega?.aniosEspera ?? 0;

  /**
   * Pie efectivamente pagado hasta el año i. El pie entra UNA sola vez: si se paga
   * en cuotas durante la obra, entra prorrateado por las cuotas pagadas; si no,
   * entra completo desde el año 0.
   *
   * Antes `aporteAcum` sumaba `inversionInicial` (que YA incluye el pie completo)
   * MÁS las cuotas de pie — contando el pie dos veces e inflando el aporte
   * pre-entrega a ~2x. Ese doble conteo hacía que la línea de patrimonio CAYERA en
   * el año de entrega (venía inflada) en vez de saltar, y desalineaba el chart de
   * `exitScenario.totalAportado`, que nunca tuvo el doble conteo. Es el mismo
   * error que analysis.ts ya había corregido para capitalInvertido (Modelo A,
   * Item 9 auditoría) y que este builder reintroducía.
   */
  const pieAcumHastaAnio = (i: number) =>
    enCuotasPie ? Math.min(totalCuotas, i * 12) * montoCuota : pieCLP;

  const a0PreEntrega = 0 < aniosEntregaInternal;
  // El banco no cursa hasta la escritura: pre-entrega la deuda es 0 (espejo exacto
  // de calcProjections). Antes se decidía por `estadoVenta === "futura"`, que dejaba
  // fuera "blanco" y "verde" — también pre-entrega cuando traen fechaEntrega.
  const deudaA0 = a0PreEntrega ? 0 : creditoInicial;
  const aporteA0 = gastosCierre + corretaje + pieAcumHastaAnio(0);
  rows.push({
    anio: 0,
    aporteAcum: aporteA0,
    // Año 0 ancla en el PRECIO PACTADO, igual que toda la curva de calcProjections.
    // Antes anclaba en vmFranco (la estimación de mercado de Franco), lo que
    // producía un salto discontinuo entre el año 0 y el año 1 cuando vmFranco
    // difería del precio — que es justo el caso de los deptos con sobreprecio.
    valorDepto: a0PreEntrega ? null : precioCLP,
    precioPactadoCLP: precioCLP,
    patrimonioNeto: a0PreEntrega ? aporteA0 : precioCLP - deudaA0,
    flujoAcumulado: 0,
    deudaPendiente: deudaA0,
    isPreEntrega: a0PreEntrega,
  });

  for (let i = 1; i <= plazoAnios; i++) {
    const p = projections[i - 1];
    if (!p) break;
    const aporteAcum =
      gastosCierre + corretaje + pieAcumHastaAnio(i) + Math.abs(Math.min(0, p.flujoAcumulado));
    const isPreEntrega = i < aniosEntregaInternal;
    rows.push({
      anio: i,
      aporteAcum,
      valorDepto: isPreEntrega ? null : p.valorPropiedad,
      precioPactadoCLP: precioCLP,
      patrimonioNeto: isPreEntrega ? aporteAcum : p.valorPropiedad - p.saldoCredito,
      flujoAcumulado: p.flujoAcumulado,
      deudaPendiente: p.saldoCredito,
      isPreEntrega,
    });
  }
  return rows;
}
