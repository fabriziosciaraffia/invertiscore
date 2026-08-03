"use client";

import { useMemo } from "react";
import {
  Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, ReferenceLine,
} from "recharts";
import { useSimulation } from "@/contexts/SimulationContext";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";
import { buildPatrimonioSeries } from "@/lib/patrimonio-series";
import { fmtAxisMoney, fmtMoney } from "./utils";

/**
 * Sub-sección 09 · PATRIMONIO (Patrón 7.B.3 Chart Block). Visualiza el
 * crecimiento del patrimonio.
 *
 * DOS COLUMNAS SEPARADAS por año (NO se apilan entre sí):
 *   · Aporte acumulado — barra entera, Signal Red (uso #8 del sistema cromático:
 *     dinero que pones). No se desglosa: el flujo cambia de naturaleza según su
 *     signo y no hay partición limpia cuando el flujo es positivo.
 *   · Valor del depto — barra desglosada en dos segmentos apilados ENTRE SÍ:
 *     "Precio que pactaste" (Ink tenue) + "Plusvalía acumulada" (Ink con trama
 *     diagonal, el tratamiento del sistema para valor proyectado/estimado).
 * Más la línea de Patrimonio neto en Ink sólido.
 *
 * Por qué NO se apilan las dos columnas: el aporte ya está CONTENIDO en el valor
 * del depto (lo que pusiste es parte de lo que vale). Apilarlas sumaba dos veces
 * la misma plata y dibujaba una barra que ningún número del tooltip explicaba —
 * el año de entrega mostraba ~$130M cuando el valor era ~$105M.
 *
 * Pre-entrega la columna de valor queda VACÍA a propósito: el activo todavía no
 * es del comprador, sólo lo es el pie que va poniendo.
 */
export function PatrimonioChart({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { plazoAnios } = useSimulation();

  // Serie extraída a builder puro (src/lib/patrimonio-series.ts) — fuente única
  // compartida con la vista documento (SVG estático). Comportamiento idéntico.
  const chartData = useMemo(
    () =>
      buildPatrimonioSeries(projections, metrics, inputData, valorUF, plazoAnios).map((r) => {
        // Desglose de la barra de valor en dos segmentos apilados. Se clampean para
        // que la suma sea SIEMPRE exactamente `valorDepto`: con el slider de plusvalía
        // en negativo el valor cae bajo el precio pactado, y ahí el segmento de
        // plusvalía es 0 y el de precio absorbe todo (la caída se lee en el tooltip,
        // que muestra los números reales, no en un segmento dibujado hacia abajo).
        const v = r.valorDepto;
        const oculto = r.isPreEntrega || v === null;
        return {
          ...r,
          precioSeg: oculto ? null : Math.min(r.precioPactadoCLP, v),
          plusvaliaSeg: oculto ? null : Math.max(0, v - r.precioPactadoCLP),
        };
      }),
    [projections, metrics, plazoAnios, valorUF, inputData],
  );

  // Año de entrega. Sale de `metrics.preEntrega`, congelado por el motor contra el
  // asOf del análisis. Antes se recalculaba acá con `new Date()` vivo: la línea
  // "📦 Entrega" se corría sola con el paso del tiempo y podía caer en un año
  // distinto del que usa la serie (que sí venía de asOf).
  const entregaAnio = metrics.preEntrega?.aniosEspera ?? null;

  const last = chartData[chartData.length - 1];
  const ganancia = last ? last.patrimonioNeto - last.aporteAcum : 0;
  const gananciaPct = last && last.aporteAcum > 0 ? (ganancia / last.aporteAcum) * 100 : 0;

  const tickFormatter = (v: number) => fmtAxisMoney(v, currency, valorUF);
  // Dos columnas por año (aporte | valor) ⇒ cada barra ocupa la mitad del ancho
  // que ocupaba la única barra apilada anterior.
  const barSize = Math.max(5, Math.floor(150 / Math.max(plazoAnios, 1)));

  return (
    <div className="flex flex-col gap-4">
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          {/* top: 28 da headroom al label "📦 Entrega" (position:"top" de la
              ReferenceLine); con top:10 el label se dibujaba en la banda del
              margen y quedaba clipeado arriba del chart. */}
          <ComposedChart data={chartData} margin={{ top: 28, right: 16, left: currency === "UF" ? 20 : 10, bottom: 8 }}>
            {/* Trama diagonal para "Plusvalía acumulada". El sistema cromático
                resuelve "proyectado / estimado / futuro" con pattern o stroke en
                Ink — nunca con un color extra (no hay verde en la paleta). */}
            <defs>
              <pattern id="franco-plusvalia-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={5} height={5} fill="var(--franco-text)" fillOpacity={0.06} />
                <line x1={0} y1={0} x2={0} y2={5} stroke="var(--franco-text)" strokeOpacity={0.42} strokeWidth={1.6} />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" vertical={false} />
            <XAxis
              dataKey="anio"
              tick={{ fontSize: 11, fill: "var(--franco-text-secondary)" }}
              tickFormatter={(v) => `a${v}`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }}
              tickFormatter={tickFormatter}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return null;
                const fmt = (n: number) => fmtMoney(n, currency, valorUF);
                return (
                  <div
                    className="rounded-lg px-3 py-2.5 shadow-lg"
                    style={{
                      border: "0.5px solid var(--franco-border-hover)",
                      background: "var(--franco-card)",
                      fontSize: 12,
                      color: "var(--franco-text)",
                    }}
                  >
                    <div className="mb-1.5 font-medium">Año {row.anio}</div>
                    {/* Cada fila con swatch corresponde a UNA serie dibujada; las
                        filas sin swatch (Valor depto, − Deuda) son derivadas y van
                        marcadas como tales — por eso no están en la leyenda.
                        Pre-entrega el activo todavía no es del comprador: se omite
                        todo el bloque de valor, igual que la columna del chart. */}
                    {!row.isPreEntrega && row.valorDepto !== null && (
                      <>
                        <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "color-mix(in srgb, var(--franco-text) 16%, transparent)" }} />
                          Precio que pactaste: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.precioPactadoCLP)}</span>
                        </div>
                        <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.42 }} />
                          + Plusvalía acumulada: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.valorDepto - row.precioPactadoCLP)}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4" style={{ color: "var(--franco-text-secondary)" }}>
                          = Valor depto: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.valorDepto)}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4" style={{ color: "var(--franco-text-secondary)" }}>
                          − Deuda: <span className="ml-auto font-mono" style={{ color: "var(--franco-text-muted)" }}>−{fmt(row.deudaPendiente)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--signal-red)" }} />
                      Aporte acum: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.aporteAcum)}</span>
                    </div>
                    <div className="mt-1.5 pt-1.5 flex items-center gap-2" style={{ borderTop: "0.5px dashed var(--franco-border)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--franco-text)" }} />
                      <span className="font-medium" style={{ color: "var(--franco-text)" }}>= Patrimonio neto</span>
                      <span className="ml-auto font-mono font-bold" style={{ color: "var(--franco-text)" }}>{fmt(row.patrimonioNeto)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {entregaAnio !== null && entregaAnio <= plazoAnios && (
              <ReferenceLine
                x={entregaAnio}
                stroke="var(--franco-text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: "📦 Entrega", position: "top", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              />
            )}
            {/* Aporte acumulado en Signal Red — uso #8 explícito skill (egresos
                visualizados en gráficos / dinero que pones). Columna PROPIA:
                stackId distinto del de valor, porque el aporte ya está contenido
                en el valor y apilarlos sumaba dos veces la misma plata. */}
            <Bar
              dataKey="aporteAcum"
              stackId="aporte"
              fill="var(--signal-red)"
              name="Aporte acumulado"
              barSize={barSize}
            />
            {/* Columna de valor, desglosada. Tratamiento LIVIANO a propósito: es el
                contexto, no el protagonista — el número que importa es la línea de
                patrimonio neto, que antes quedaba aplastada por un bloque sólido. */}
            <Bar
              dataKey="precioSeg"
              stackId="valor"
              fill="var(--franco-text)"
              fillOpacity={0.16}
              name="Precio que pactaste"
              barSize={barSize}
            />
            <Bar
              dataKey="plusvaliaSeg"
              stackId="valor"
              fill="url(#franco-plusvalia-hatch)"
              name="Plusvalía acumulada"
              barSize={barSize}
            />
            {/* Patrimonio neto en Ink primary sólido — el resultado neto */}
            <Line
              type="monotone"
              dataKey="patrimonioNeto"
              stroke="var(--franco-text)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--franco-card)", stroke: "var(--franco-text)", strokeWidth: 1.5 }}
              name="Patrimonio neto"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda — declara EXACTAMENTE las 4 series dibujadas, ni una más.
          "Valor depto" y "− Deuda" no aparecen acá porque no son series: la
          primera es la suma de los dos segmentos de la columna de valor y la
          segunda es un derivado que sólo vive en el tooltip. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center font-mono" style={{ fontSize: 10, color: "var(--franco-text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--signal-red)" }} />
          Aporte acumulado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "color-mix(in srgb, var(--franco-text) 16%, transparent)" }} />
          Precio que pactaste
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{
              background:
                "repeating-linear-gradient(45deg, color-mix(in srgb, var(--franco-text) 42%, transparent) 0 1.6px, color-mix(in srgb, var(--franco-text) 6%, transparent) 1.6px 5px)",
            }}
          />
          Plusvalía acumulada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 rounded" style={{ background: "var(--franco-text)", height: 2 }} />
          Patrimonio neto
        </span>
      </div>

      {/* Checkpoint final — chart conclusive box (skill 7.B.3) */}
      {last && (
        <div
          className="flex justify-between items-start gap-3"
          style={{
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            borderLeft: "3px solid var(--franco-text-secondary)",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
            marginTop: "1.25rem",
          }}
        >
          {/* Izq: label uppercase + context Sans */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
            >
              Patrimonio teórico al año {plazoAnios}
            </span>
            <span className="font-body" style={{ fontSize: 12, color: "var(--franco-text-secondary)" }}>
              vs {fmtMoney(last.aporteAcum, currency, valorUF)} aportados
            </span>
          </div>
          {/* Der: valor mono bold + delta mono pequeño */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{ fontSize: 22, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmtMoney(last.patrimonioNeto, currency, valorUF)}
            </span>
            <span
              className="font-mono whitespace-nowrap"
              style={{ fontSize: 11, color: ganancia >= 0 ? "var(--franco-text-secondary)" : "var(--signal-red)" }}
            >
              {ganancia >= 0 ? "+" : "−"}{fmtMoney(Math.abs(ganancia), currency, valorUF)} ({ganancia >= 0 ? "+" : "−"}{Math.round(Math.abs(gananciaPct))}%)
            </span>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <span style={{ display: "none" }} aria-hidden>{valorUF}</span>
    </div>
  );
}
