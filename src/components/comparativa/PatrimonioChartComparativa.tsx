"use client";

import { useMemo } from "react";
import {
  Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, LineChart,
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

// ─── Gráfica 1 · Patrimonio neto LTR vs STR (10 años) ────────────────────
// Líneas superpuestas. Capa Cromática (decisión aprobada Commit 3b):
//   • LTR — Ink 600 sólido (var(--franco-text))
//   • STR — Ink 300 dashed (var(--franco-border) más oscuro / Ink 300)
//   • Signal Red reservado para aporte acumulado (no usado en este chart;
//     ver PatrimonioChartSTR para chart con aporte stacked).
export function PatrimonioChartComparativa(p: Props) {
  const chartData = useMemo(() => {
    const ltrProj = p.ltrResults.projections ?? [];
    const strProj = p.strResults.projections ?? [];

    // Capar a la intersección de ambas projections + max 10 años (spec 3b).
    // Si capamos al min(LTR.length, STR.length) hasta 10, comparamos manzanas
    // con manzanas. Antes el chart extendía a 20 años con STR=null y la
    // leyenda decía "STR llega a $0" falsamente.
    const overlap = Math.min(ltrProj.length, strProj.length, 10);
    const data: Array<{ year: number; ltr: number | null; str: number | null }> = [];

    // Año 0 — patrimonio negativo igual al capital inicial aportado.
    const ltrCapitalInicial = p.ltrResults.metrics?.pieCLP ?? 0;
    const strCapitalInicial = p.strResults.capitalInvertido ?? 0;
    data.push({
      year: 0,
      ltr: -ltrCapitalInicial,
      str: -strCapitalInicial,
    });

    for (let i = 0; i < overlap; i++) {
      const ltrRow = ltrProj[i];
      const strRow = strProj[i];
      const year = ltrRow?.anio ?? strRow?.year ?? (i + 1);
      data.push({
        year,
        ltr: ltrRow?.patrimonioNeto ?? null,
        str: strRow?.patrimonioNeto ?? null,
      });
    }
    return data;
  }, [p.ltrResults, p.strResults]);

  if (chartData.length <= 1) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Sin proyecciones disponibles para una de las modalidades.
      </p>
    );
  }

  const lastLTR = chartData[chartData.length - 1].ltr ?? 0;
  const lastSTR = chartData[chartData.length - 1].str ?? 0;
  const lastYear = chartData[chartData.length - 1].year;
  const delta = lastSTR - lastLTR;
  const ganadora = delta >= 0 ? "STR" : "LTR";

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 mb-6">
      <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1">
        PATRIMONIO NETO · 10 AÑOS
      </p>
      <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] mb-4">
        Cómo se construye tu patrimonio en cada modalidad
      </h3>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--franco-border)" strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
              label={{
                value: "Años",
                position: "insideBottom",
                offset: -4,
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fill: "var(--franco-text-muted)",
                letterSpacing: "0.06em",
              }}
            />
            <YAxis
              tickFormatter={(v) => fmtAxisMoney(Number(v), p.currency, p.ufValue)}
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
                  ltr: "Renta larga",
                  str: "Renta corta",
                };
                const v = typeof value === "number" ? value : Number(value) || 0;
                const n = typeof name === "string" ? name : String(name);
                return [fmtMoney(v, p.currency, p.ufValue), labels[n] ?? n];
              }}
              labelFormatter={(year) => `Año ${year}`}
            />
            <Line
              type="monotone"
              dataKey="ltr"
              stroke="var(--franco-text)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--franco-text)" }}
              name="ltr"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="str"
              stroke="var(--franco-text-tertiary)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "var(--franco-text-tertiary)" }}
              name="str"
              connectNulls
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
        <p
          className="font-mono uppercase mb-1"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
        >
          PATRIMONIO AL AÑO {lastYear} · {ganadora} GANA POR {fmtMoney(Math.abs(delta), p.currency, p.ufValue)}
        </p>
        <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-snug">
          LTR llega a {fmtMoney(lastLTR, p.currency, p.ufValue)} · STR llega a {fmtMoney(lastSTR, p.currency, p.ufValue)}.
          La diferencia es el costo de oportunidad de elegir la modalidad menos eficiente para esta propiedad.
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
