"use client";

import { useMemo } from "react";
import {
  calculateKPIs,
  tonoTIR,
  tonoCashOnCash,
  tonoPayback,
  tonoMultiplo,
  type Tone,
} from "@/lib/analysis/kpi-calculations";
import { InfoTooltip } from "@/components/ui/tooltip";
import { fmtPct as fmtPctCL, fmtMult } from "@/components/analysis/utils";
import {
  NO_APLICA_VALOR,
  NO_APLICA_SUBLABEL,
  NO_APLICA_TOOLTIP,
  noAplicaSublabelPreEntrega,
  noAplicaTooltipPreEntrega,
  NO_CALCULABLE_SUBLABEL,
  NO_CALCULABLE_TOOLTIP,
} from "@/lib/no-aplica-copy";
import { useSimulation } from "@/contexts/SimulationContext";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";
import { metricaValorONull, esMetricaNoCalculable } from "@/lib/types";

/**
 * Strip de indicadores simulados (rediseño extras · D3/D4). Resumen técnico
 * SUBORDINADO que va DEBAJO de las dos columnas protagonistas (patrimonio +
 * venta/refi). Muestra los 4 KPIs que reaccionan a los sliders — TIR,
 * Cash-on-Cash, Payback, Múltiplo — en un strip horizontal recesivo.
 *
 * El Cap Rate queda en una fila FIJA aparte (D4): no varía con los sliders y
 * ya vive como hallazgo en la pirámide, así que no compite con los que sí
 * simulan. Numeración 08 eliminada (D5).
 *
 * Lee plazo y plusvalía del SimulationContext — el componente padre debe
 * envolverse en <SimulationProvider>.
 */
export function Indicators({
  projections,
  metrics,
  inputData,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData?: AnalisisInput;
}) {
  const { plazoAnios, plusvaliaAnual } = useSimulation();
  const kpis = useMemo(
    () => calculateKPIs({ projections, metrics, plazoAnios, plusvaliaAnual }),
    [projections, metrics, plazoAnios, plusvaliaAnual]
  );
  const plazoLabel = `${plazoAnios} ${plazoAnios === 1 ? "AÑO" : "AÑOS"}`;
  const paybackValue = kpis.paybackAnios ? `Año ${kpis.paybackAnios}` : ">30";

  // Caveat de construcción. Predicado ÚNICO: `kpis.aniosPreEntrega`, el mismo
  // que gatea el payback (prefijo de la serie con deuda 0). Antes era
  // `estadoVenta === "futura"`, que dejaba sin caveat a "blanco" y "verde" — 15
  // de los 47 pre-entrega del parque.
  //
  // El texto también cambia: decía que la plusvalía "cuenta solo desde la
  // entrega" (Modelo B3), y ese modelo quedó superado — hoy el valor de mercado
  // corre continuo desde el año 0 (analysis.ts:722-735), que es justamente la
  // ventaja del que compra en construcción. Lo que sí se detiene hasta la
  // escritura es el flujo operativo (analysis.ts:713-717), y eso es lo que le
  // da forma a la TIR de un depto en verde.
  const hayPreEntrega = kpis.aniosPreEntrega > 0;
  const tirTooltipBase =
    "Tasa Interna de Retorno: rentabilidad anual proyectada de toda la inversión incluyendo flujo, plusvalía y venta al cierre del horizonte.";
  const tirTooltip = hayPreEntrega
    ? `${tirTooltipBase} En depto en construcción no hay arriendo hasta la entrega; la plusvalía sí corre desde la compra.`
    : tirTooltipBase;

  // P1 Fase 24 — guard NaN/Infinity en KPIs derivados de cálculos iterativos.
  const fmtPct = (v: number) => (Number.isFinite(v) ? fmtPctCL(v, 1) : "—");
  const fmtMultiplo = (v: number) => (Number.isFinite(v) ? fmtMult(v, 2) : "—");

  // Pie cero (fase 3b · D1): con pie 0 las 4 métricas sobre capital muestran
  // "No aplica" + sublabel — decisión del análisis, no dato faltante. Cero
  // Signal Red (no es criticidad). Tooltip compartido del mockup 98e2319.
  // Pre-entrega (hermano del anterior, MISMO tratamiento D1): el horizonte del
  // slider termina antes de la escritura, así que las CUATRO se apagan — la TIR
  // y el múltiplo liquidan una venta que no puedes hacer, el payback la busca y
  // el Cash-on-Cash promedia un arriendo que no empezó. Emitirlas ahí no era
  // "incompleto": la TIR marcaba 345% de mediana contra 6,5% en cuanto el
  // horizonte cruza la entrega, y el CoC un 0,0% que se lee como dato.
  const naPie = kpis.sinCapitalPropio;
  const naPreEntrega = kpis.horizonteAntesDeEntrega;
  const na = naPie || naPreEntrega;

  // Un solo par sublabel/tooltip para las 4: el pie cero manda si coinciden.
  const sublabelD1 = naPie
    ? NO_APLICA_SUBLABEL
    : naPreEntrega
      ? noAplicaSublabelPreEntrega(inputData?.fechaEntrega)
      : null;
  const tooltipD1 = naPie ? NO_APLICA_TOOLTIP : noAplicaTooltipPreEntrega(inputData?.fechaEntrega);

  // La TIR es el único KPI del strip con TRES razones de ausencia, así que lee
  // su estado tipado en vez de los booleanos: `no_calculable` no tiene bandera
  // propia porque no es una decisión del análisis (ver types.ts). Las otras tres
  // celdas siguen con `na` — sus dos razones ya viven en los booleanos.
  const tirValorNum = metricaValorONull(kpis.tir);
  const tirNoCalculable = esMetricaNoCalculable(kpis.tir);

  // Los 4 que reaccionan a los sliders. tono === "bad" → Signal Red (uso #2
  // valores críticos): Cash-on-Cash negativo, TIR/Múltiplo bajo umbral.
  const cells: Array<{
    label: string;
    value: string;
    tone: Tone;
    tooltip: string;
    na: boolean;
    sublabel: string | null;
  }> = [
    {
      label: `TIR a ${plazoLabel}`,
      // La TIR lee su propio estado (kpis.tir es MetricaTIRSimulador, no un
      // number aplanado): las TRES ausencias se distinguen acá y cada una trae
      // su sublabel. Antes las tres llegaban como `null` y la celda solo podía
      // decir "—", que no explica nada. `no_calculable` hereda el D1 visual —
      // misma escala de grises, CERO Signal Red — con su copy provisorio.
      value: tirValorNum !== null ? fmtPct(tirValorNum) : NO_APLICA_VALOR,
      tone: tirValorNum !== null ? tonoTIR(tirValorNum) : "neutral",
      tooltip:
        tirValorNum !== null
          ? tirTooltip
          : tirNoCalculable
            ? NO_CALCULABLE_TOOLTIP
            : tooltipD1,
      na: tirValorNum === null,
      sublabel: tirNoCalculable ? NO_CALCULABLE_SUBLABEL : sublabelD1,
    },
    {
      label: `Cash-on-Cash a ${plazoLabel}`,
      value: na ? NO_APLICA_VALOR : fmtPct(kpis.cashOnCash ?? NaN),
      tone: na ? "neutral" : tonoCashOnCash(kpis.cashOnCash ?? 0),
      tooltip: na
        ? tooltipD1
        : "Flujo anual promedio sobre tu inversión inicial del día uno (pie + gastos de cierre + corretaje).",
      na,
      sublabel: sublabelD1,
    },
    {
      label: "Payback (con venta)",
      value: na ? NO_APLICA_VALOR : paybackValue,
      // Cero Signal Red en los dos estados "no aplica": son decisiones del
      // análisis, no criticidad.
      tone: na ? "neutral" : tonoPayback(kpis.paybackAnios),
      tooltip: na
        ? tooltipD1
        : "Año desde la compra en que el patrimonio neto acumulado iguala tu inversión inicial del día uno (pie + gastos de cierre + corretaje), contando la venta del depto.",
      na,
      sublabel: sublabelD1,
    },
    {
      label: `Múltiplo a ${plazoLabel}`,
      value: na ? NO_APLICA_VALOR : fmtMultiplo(kpis.multiplo ?? NaN),
      tone: na ? "neutral" : tonoMultiplo(kpis.multiplo ?? 0),
      tooltip: na
        ? tooltipD1
        : "Cuánto recibes al final por cada peso que pusiste en total — el pie más los aportes que fuiste haciendo por el camino. Múltiplo 2x = recibes el doble.",
      na,
      sublabel: sublabelD1,
    },
  ];

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      {/* Rótulo del strip: dot "vivo" + leyenda de que reaccionan a los sliders */}
      <div className="flex items-center gap-2 mb-3.5">
        <span
          aria-hidden
          className="inline-block rounded-full shrink-0"
          style={{
            width: 6,
            height: 6,
            background: "var(--franco-text)",
            boxShadow: "0 0 0 3px color-mix(in srgb, var(--franco-text) 12%, transparent)",
          }}
        />
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--franco-text-tertiary)" }}
        >
          Escenario simulado · reaccionan a los sliders
        </span>
      </div>

      {/* Los 4 que simulan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col min-w-0">
            <span
              className="inline-flex items-center gap-1 font-mono uppercase"
              style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--franco-text-tertiary)" }}
            >
              <span>{c.label}</span>
              <InfoTooltip content={c.tooltip} />
            </span>
            <span
              className={c.na ? "font-mono whitespace-nowrap" : "font-mono font-bold whitespace-nowrap"}
              style={
                c.na
                  ? {
                      // D1: presencia tipográfica de decisión, no de dato faltante —
                      // Mono 15px peso 500 color secundario, nunca Signal Red.
                      fontSize: 15,
                      fontWeight: 500,
                      lineHeight: 1,
                      marginTop: 10,
                      color: "var(--franco-text-secondary)",
                    }
                  : {
                      fontSize: 24,
                      lineHeight: 1,
                      marginTop: 7,
                      color: c.tone === "bad" ? "var(--signal-red)" : "var(--franco-text)",
                    }
              }
            >
              {c.value}
            </span>
            {c.sublabel && (
              <span
                className="font-mono uppercase"
                style={{ fontSize: 8.5, letterSpacing: "0.05em", color: "var(--franco-text-muted)", marginTop: 5 }}
              >
                {c.sublabel}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Cap Rate: fila FIJA (D4) — no varía con los sliders */}
      <div
        className="flex items-center flex-wrap gap-x-3 gap-y-1.5"
        style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px dashed var(--franco-border)" }}
      >
        <span
          className="inline-flex items-center gap-1 font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--franco-text-tertiary)" }}
        >
          <span>Cap Rate</span>
          <InfoTooltip content="Rendimiento neto de operación: lo que deja el arriendo tras los gastos de operarlo (NOI), sobre el precio, sin contar el crédito." />
        </span>
        <span className="font-mono font-bold" style={{ fontSize: 18, color: "var(--franco-text)" }}>
          {fmtPct(kpis.capRate)}
        </span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--franco-text-muted)",
            border: "0.5px solid var(--franco-border-hover)",
            borderRadius: 4,
            padding: "2px 7px",
          }}
        >
          Fijo
        </span>
        <span
          className="font-body"
          style={{ fontSize: 11, color: "var(--franco-text-muted)", marginLeft: "auto" }}
        >
          No cambia con los sliders — ya vive como hallazgo del análisis.
        </span>
      </div>
    </div>
  );
}
