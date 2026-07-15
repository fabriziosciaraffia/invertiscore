"use client";

import { useMemo } from "react";
import {
  Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart,
} from "recharts";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney, fmtMoney } from "../utils";

/**
 * Sub-sección 09 · PATRIMONIO — variante STR (Patrón 7.B.3 Chart Block).
 *
 * str-paridad2: armonizado al canon LTR (`PatrimonioChart.tsx`, post-8c08517)
 * en las 13 divergencias render-only — altura 320, headroom top:28, grid "3 3",
 * XAxis `a${v}`, YAxis por margin (no width), tooltip rico (Valor depto · −Deuda
 * en color muted propio · Aporte acum · =Patrimonio neto), Valor depto Ink 50%,
 * barSize dinámico, línea 2.5 con dot fill-card, leyenda canon (Patrimonio como
 * línea, labels normal case), checkpoint "Patrimonio teórico al año N" + delta ±%.
 *
 * Divergencia intrínseca conservada: NO hay ReferenceLine "📦 Entrega" — el motor
 * STR no modela entrega futura (compoundéa desde año 1). Los datos empiezan en el
 * año 1 (sin fila a0 "día de cierre" del canon LTR).
 *
 * Capa Cromática:
 *   • Aporte acumulado (barra inferior) — Signal Red (uso permitido #8)
 *   • Valor depto (barra superior apilada) — Ink 100 opacity 50%
 *   • Línea Patrimonio neto — Ink sólido (resultado neto = valor − deuda + flujo)
 */
export function PatrimonioChartSTR({
  results,
  currency,
  valorUF,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const rawProjections = results.projections;
  const capitalInicial = results.capitalInvertido;

  const chartData = useMemo(() => {
    const projections = rawProjections ?? [];
    if (projections.length === 0) return [];

    return projections.map((p) => {
      // Aporte acumulado: capital inicial + |suma de flujos negativos hasta el año|.
      const aportesNegativos = projections
        .slice(0, p.year)
        .filter((q) => q.flujoOperacionalAnual < 0)
        .reduce((sum, q) => sum + Math.abs(q.flujoOperacionalAnual), 0);
      const aporteAcum = capitalInicial + aportesNegativos;

      return {
        anio: p.year,
        aporteAcum,
        valorDepto: p.valorDepto,
        deudaPendiente: p.saldoCredito,
        patrimonioNeto: p.patrimonioNeto,
      };
    });
  }, [rawProjections, capitalInicial]);

  const last = chartData[chartData.length - 1];
  const tickFormatter = (v: number) => fmtAxisMoney(v, currency, valorUF);
  const barSize = Math.max(8, Math.floor(280 / Math.max(chartData.length, 1)));

  if (chartData.length === 0) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Sin proyecciones disponibles para este análisis.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
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
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }} />
                      Valor depto: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.valorDepto)}</span>
                    </div>
                    {/* −Deuda: color propio (muted) — NO es serie graficada (fuera de
                        la leyenda de 3), pero necesita identidad distinta del rojo de
                        "Aporte acum" para no leerse como lo mismo. */}
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--franco-text-muted)" }} />
                      − Deuda: <span className="ml-auto font-mono" style={{ color: "var(--franco-text-muted)" }}>−{fmt(row.deudaPendiente)}</span>
                    </div>
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
            {/* Aporte acumulado en Signal Red — uso #8 (dinero que pones) */}
            <Bar
              dataKey="aporteAcum"
              stackId="composicion"
              fill="var(--signal-red)"
              name="Aporte acumulado"
              barSize={barSize}
            />
            {/* Valor depto en Ink primary opacity 50% — proyección de valor */}
            <Bar
              dataKey="valorDepto"
              stackId="composicion"
              fill="var(--franco-text)"
              fillOpacity={0.5}
              name="Valor depto"
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

      {/* Leyenda — molde canon: dots rounded-sm, Patrimonio como línea, normal case */}
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

      {/* Checkpoint final — molde canon: label + "vs X aportados" + valor + delta ±% */}
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
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
            >
              Patrimonio teórico al año {last.anio}
            </span>
            <span className="font-body" style={{ fontSize: 12, color: "var(--franco-text-secondary)" }}>
              vs {fmtMoney(last.aporteAcum, currency, valorUF)} aportados
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {/* str-paridad2: SIN delta ±% (a diferencia del canon LTR). El delta
                del canon es patrimonioNeto − aporteAcum; en STR patrimonioNeto YA
                incluye flujoAcumulado (motor) y aporteAcum también suma los
                subsidios → el delta doble-contaría los flujos y choca de signo con
                la "Ganancia neta" de SaleBlockSTR (base capital). Se muestra solo el
                valor. Backlog: "coherencia de base para delta chart STR" (modelo). */}
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{ fontSize: 22, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmtMoney(last.patrimonioNeto, currency, valorUF)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
