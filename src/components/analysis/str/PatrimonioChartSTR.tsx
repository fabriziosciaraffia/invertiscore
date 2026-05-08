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
 * Mismo lenguaje visual que el LTR pero consume `YearProjectionSTR[]`
 * directamente — no requiere mocking de shape.
 *
 * Capa Cromática:
 *   • Aporte acumulado (barra inferior) — Signal Red (uso permitido #8)
 *   • Valor depto (barra superior apilada) — Ink 100 con opacity 50%
 *   • Línea Patrimonio neto — Ink sólido (resultado neto)
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
  const projections = results.projections ?? [];
  const capitalInicial = results.capitalInvertido;

  const chartData = useMemo(() => {
    if (projections.length === 0) return [];

    return projections.map((p) => {
      // Aporte acumulado: capital inicial + |suma de flujos negativos hasta el año|.
      // Para STR usamos aporteMensualPromedio*12 = abs(flujoOperacionalAnual<0)
      // ya está en projections. Aquí calculamos acumulado.
      const aportesNegativos = projections
        .slice(0, p.year)
        .filter((q) => q.flujoOperacionalAnual < 0)
        .reduce((sum, q) => sum + Math.abs(q.flujoOperacionalAnual), 0);
      const aporteAcum = capitalInicial + aportesNegativos;

      return {
        year: p.year,
        aporteAcum,
        valorDepto: p.valorDepto,
        saldoCredito: p.saldoCredito,
        patrimonioNeto: p.patrimonioNeto,
      };
    });
  }, [projections, capitalInicial]);

  if (chartData.length === 0) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Sin proyecciones disponibles para este análisis.
      </p>
    );
  }

  const ultimo = chartData[chartData.length - 1];

  return (
    <div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--franco-border)" strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => fmtAxisMoney(Number(v), currency, valorUF)}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
              width={70}
            />
            <RechartsTooltip
              contentStyle={{
                background: "var(--franco-card)",
                border: "0.5px solid var(--franco-border)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  aporteAcum: "Aporte acumulado",
                  valorDepto: "Valor depto",
                  patrimonioNeto: "Patrimonio neto",
                };
                const v = typeof value === "number" ? value : Number(value) || 0;
                const n = typeof name === "string" ? name : String(name);
                return [fmtMoney(v, currency, valorUF), labels[n] ?? n];
              }}
              labelFormatter={(year) => `Año ${year}`}
            />
            <Bar dataKey="aporteAcum" stackId="a" fill="var(--signal-red)" name="aporteAcum" />
            <Bar
              dataKey="valorDepto"
              stackId="a"
              fill="color-mix(in srgb, var(--franco-text) 30%, transparent)"
              name="valorDepto"
            />
            <Line
              type="monotone"
              dataKey="patrimonioNeto"
              stroke="var(--franco-text)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--franco-text)" }}
              name="patrimonioNeto"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
        <LegendDot color="var(--signal-red)" label="Aporte acumulado" />
        <LegendDot color="color-mix(in srgb, var(--franco-text) 30%, transparent)" label="Valor depto" />
        <LegendDot color="var(--franco-text)" label="Patrimonio neto" />
      </div>

      {/* Bloque conclusivo */}
      <div
        className="mt-5 p-4"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p
              className="font-mono uppercase mb-1"
              style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
            >
              PATRIMONIO AL AÑO {ultimo.year}
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0">
              Valor del activo menos deuda, más flujos acumulados.
            </p>
          </div>
          <p className="font-mono text-[28px] font-bold m-0 text-[var(--franco-text)]">
            {fmtMoney(ultimo.patrimonioNeto, currency, valorUF)}
          </p>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
      <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}>
        {label}
      </span>
    </span>
  );
}
