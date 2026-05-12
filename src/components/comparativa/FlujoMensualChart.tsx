"use client";

import { useMemo } from "react";
import {
  Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, ReferenceLine,
} from "recharts";
import type { FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney, fmtMoney } from "@/components/analysis/utils";

interface Props {
  ltrResults: FullAnalysisResult;
  strResults: ShortTermResult;
  currency: "CLP" | "UF";
  ufValue: number;
}

// ─── Gráfica 2 · Flujo mensual LTR vs STR (12 meses año estabilizado) ────
// Pedagógica sobre volatilidad vs estabilidad. LTR es plano. STR varía con
// estacionalidad (peak julio invierno + ski / valle febrero verano).
// Colores: LTR Ink 600 sólido, STR Ink 300 dashed (consistente con Gráfica 1).
const MESES_ABBR = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function FlujoMensualChart(p: Props) {
  const chartData = useMemo(() => {
    const ltrFlujo = p.ltrResults.metrics?.flujoNetoMensual ?? 0;
    const flujoEst = p.strResults.flujoEstacional ?? [];

    if (flujoEst.length === 0) return [];

    return flujoEst.map((m, i) => ({
      mes: MESES_ABBR[i] ?? m.mes.slice(0, 1),
      mesFull: m.mes,
      ltr: ltrFlujo,
      str: m.flujo,
    }));
  }, [p.ltrResults, p.strResults]);

  if (chartData.length === 0) {
    return null;
  }

  const minSTR = Math.min(...chartData.map((d) => d.str));
  const maxSTR = Math.max(...chartData.map((d) => d.str));
  const rangoSTR = maxSTR - minSTR;
  const ltrFlujo = chartData[0].ltr;
  const promedioSTR = chartData.reduce((s, d) => s + d.str, 0) / chartData.length;

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 mb-6">
      <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1">
        FLUJO MENSUAL · 12 MESES ESTABILIZADOS
      </p>
      <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] mb-4">
        Volatilidad vs estabilidad del flujo de caja
      </h3>

      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--franco-border)" strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => fmtAxisMoney(Number(v), p.currency, p.ufValue)}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
              width={70}
            />
            <ReferenceLine y={0} stroke="var(--franco-border)" strokeDasharray="3 3" />
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
                  ltr: "Renta larga",
                  str: "Renta corta",
                };
                const v = typeof value === "number" ? value : Number(value) || 0;
                const n = typeof name === "string" ? name : String(name);
                return [fmtMoney(v, p.currency, p.ufValue), labels[n] ?? n];
              }}
              labelFormatter={(_, payload) => {
                const m = payload?.[0]?.payload?.mesFull;
                return m ? m.charAt(0).toUpperCase() + m.slice(1) : "";
              }}
            />
            <Line
              type="monotone"
              dataKey="ltr"
              stroke="var(--franco-text)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--franco-text)" }}
              name="ltr"
            />
            <Line
              type="monotone"
              dataKey="str"
              stroke="var(--franco-text-tertiary)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "var(--franco-text-tertiary)" }}
              name="str"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-5 mt-4">
        <LegendItem dashed={false} color="var(--franco-text)" label="Renta larga" />
        <LegendItem dashed={true} color="var(--franco-text-tertiary)" label="Renta corta" />
      </div>

      <div
        className="mt-5 p-4"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-snug">
          LTR mantiene <span className="font-mono">{fmtMoney(ltrFlujo, p.currency, p.ufValue)}</span> casi constante mes a mes.
          STR fluctúa entre <span className="font-mono">{fmtMoney(minSTR, p.currency, p.ufValue)}</span> y <span className="font-mono">{fmtMoney(maxSTR, p.currency, p.ufValue)}</span> ({fmtMoney(rangoSTR, p.currency, p.ufValue)} de rango)
          con promedio <span className="font-mono">{fmtMoney(promedioSTR, p.currency, p.ufValue)}</span>. La estacionalidad de Santiago
          (peak julio · valle febrero) exige fondo de reserva 3-4 meses si vas por STR.
        </p>
      </div>
    </div>
  );
}

function LegendItem({ dashed, color, label }: { dashed: boolean; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        style={{
          display: "inline-block",
          width: 22,
          height: 0,
          borderTop: dashed ? `2px dashed ${color}` : `2px solid ${color}`,
        }}
      />
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
      >
        {label}
      </span>
    </span>
  );
}
