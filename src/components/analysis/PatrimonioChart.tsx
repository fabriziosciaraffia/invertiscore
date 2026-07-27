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
 * crecimiento del patrimonio: barras apiladas (Aporte acumulado en Signal Red,
 * Valor depto en Ink 50% opacity) + Línea Patrimonio neto en Ink sólido.
 *
 * Modelo B3 liquidable (sesión B3-fix H3): pre-entrega valor = vmFranco fijo
 * y deuda = 0. Plusvalía compoundéa sólo desde a_entrega.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.2).
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
    () => buildPatrimonioSeries(projections, metrics, inputData, valorUF, plazoAnios),
    [projections, metrics, plazoAnios, valorUF, inputData],
  );

  // Año de entrega si es venta en blanco
  const entregaAnio = useMemo(() => {
    if (!inputData.fechaEntrega || inputData.estadoVenta === "inmediata") return null;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const ent = new Date(a, (me || 1) - 1);
    const meses = Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (meses <= 0) return null;
    return Math.ceil(meses / 12);
  }, [inputData.fechaEntrega, inputData.estadoVenta]);

  const last = chartData[chartData.length - 1];
  const ganancia = last ? last.patrimonioNeto - last.aporteAcum : 0;
  const gananciaPct = last && last.aporteAcum > 0 ? (ganancia / last.aporteAcum) * 100 : 0;

  const tickFormatter = (v: number) => fmtAxisMoney(v, currency, valorUF);

  return (
    <div className="flex flex-col gap-4">
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          {/* top: 28 da headroom al label "📦 Entrega" (position:"top" de la
              ReferenceLine); con top:10 el label se dibujaba en la banda del
              margen y quedaba clipeado arriba del chart. */}
          <ComposedChart data={chartData} margin={{ top: 28, right: 16, left: currency === "UF" ? 20 : 10, bottom: 8 }}>
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
                    {/* Pre-entrega: el activo aún no existe en tu patrimonio →
                        se omiten Valor depto y −Deuda (paridad con el bar oculto);
                        el tooltip muestra solo lo aportado = patrimonio. Post-entrega
                        aparece la ecuación Valor − Deuda = Patrimonio. */}
                    {!row.isPreEntrega && row.valorDepto !== null && (
                      <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }} />
                        Valor depto: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.valorDepto)}</span>
                      </div>
                    )}
                    {!row.isPreEntrega && (
                      // −Deuda: color propio (muted) — NO es una serie graficada
                      // (por eso queda fuera de la leyenda de 3), pero necesita
                      // identidad distinta del rojo de "Aporte acum" para no leerse
                      // como lo mismo.
                      <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--franco-text-muted)" }} />
                        − Deuda: <span className="ml-auto font-mono" style={{ color: "var(--franco-text-muted)" }}>−{fmt(row.deudaPendiente)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--signal-red)" }} />
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
                visualizados en gráficos / dinero que pones) */}
            <Bar
              dataKey="aporteAcum"
              stackId="composicion"
              fill="var(--signal-red)"
              name="Aporte acumulado"
              barSize={Math.max(8, Math.floor(280 / Math.max(plazoAnios, 1)))}
            />
            {/* Valor depto en Ink primary opacity 50% — proyección de valor */}
            <Bar
              dataKey="valorDepto"
              stackId="composicion"
              fill="var(--franco-text)"
              fillOpacity={0.5}
              name="Valor depto"
              barSize={Math.max(8, Math.floor(280 / Math.max(plazoAnios, 1)))}
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

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center font-mono" style={{ fontSize: 10, color: "var(--franco-text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--signal-red)" }} />
          Aporte acumulado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.5 }} />
          Valor depto
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
