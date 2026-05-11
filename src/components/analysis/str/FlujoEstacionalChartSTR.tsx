"use client";

import { useMemo } from "react";
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, ReferenceLine, Cell,
} from "recharts";
import type { FlujoEstacionalMes } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney, fmtMoney } from "../utils";

/**
 * Flujo Estacional STR — 12 meses (Commit 2b · 2026-05-11).
 *
 * Visualiza el flujo neto mensual (NOI − dividendo) por mes calendario.
 * Expone la variación estacional que el motor ya calcula (`flujoEstacional[]`)
 * pero que la UI no mostraba antes.
 *
 * Capa Cromática:
 *   • Barras negativas (aporte) → Signal Red (uso permitido #2)
 *   • Barras positivas (queda en el bolsillo) → Ink primary
 *   • Línea de cero → Ink secondary (referencia visual)
 */
export function FlujoEstacionalChartSTR({
  data,
  currency,
  valorUF,
}: {
  data: FlujoEstacionalMes[];
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  // Identificar pico y valle para narrativa visual mínima.
  const { peakMes, valleMes, anyNeg } = useMemo(() => {
    if (data.length === 0) return { peakMes: null, valleMes: null, anyNeg: false };
    let peak = data[0];
    let valle = data[0];
    let neg = false;
    for (const d of data) {
      if (d.flujo > peak.flujo) peak = d;
      if (d.flujo < valle.flujo) valle = d;
      if (d.flujo < 0) neg = true;
    }
    return { peakMes: peak, valleMes: valle, anyNeg: neg };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
        Sin datos de estacionalidad disponibles.
      </p>
    );
  }

  return (
    <div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--franco-border)" strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="mes"
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
            <ReferenceLine y={0} stroke="var(--franco-text-secondary)" strokeWidth={1} />
            <RechartsTooltip
              cursor={{ fill: "color-mix(in srgb, var(--franco-text) 4%, transparent)" }}
              contentStyle={{
                background: "var(--franco-card)",
                border: "0.5px solid var(--franco-border)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(value, name, item) => {
                const v = typeof value === "number" ? value : Number(value) || 0;
                if (name === "flujo") return [fmtMoney(v, currency, valorUF), "Flujo neto"];
                if (name === "ingresoBruto") return [fmtMoney(v, currency, valorUF), "Ingreso bruto"];
                if (name === "factor") return [`×${Number(item?.payload?.factor ?? 1).toFixed(2)}`, "Factor"];
                return [fmtMoney(v, currency, valorUF), String(name)];
              }}
              labelFormatter={(mes) => String(mes)}
            />
            <Bar dataKey="flujo" name="flujo">
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.flujo < 0 ? "var(--signal-red)" : "var(--franco-text)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
        <LegendDot color="var(--franco-text)" label="Mes con flujo positivo" />
        {anyNeg && <LegendDot color="var(--signal-red)" label="Mes con aporte" />}
      </div>

      {/* Mini-tira de hallazgos peak/valle */}
      {peakMes && valleMes && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <PeakValleCard
            label="MES PEAK"
            mes={peakMes.mes}
            flujo={peakMes.flujo}
            factor={peakMes.factor}
            isPositive
            currency={currency}
            valorUF={valorUF}
          />
          <PeakValleCard
            label="MES VALLE"
            mes={valleMes.mes}
            flujo={valleMes.flujo}
            factor={valleMes.factor}
            isPositive={false}
            currency={currency}
            valorUF={valorUF}
          />
        </div>
      )}
    </div>
  );
}

function PeakValleCard({
  label, mes, flujo, factor, isPositive, currency, valorUF,
}: {
  label: string;
  mes: string;
  flujo: number;
  factor: number;
  isPositive: boolean;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const isFlujoNegativo = flujo < 0;
  const kpiColor = isFlujoNegativo ? "var(--signal-red)" : "var(--franco-text)";
  return (
    <div
      className="p-3"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: `3px solid ${isPositive ? "var(--franco-text-secondary)" : "var(--franco-text-secondary)"}`,
        borderRadius: "0 8px 8px 0",
      }}
    >
      <p
        className="font-mono uppercase mb-1 m-0"
        style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
      >
        {label} · {mes.toUpperCase()}
      </p>
      <p className="font-mono text-[18px] font-bold m-0" style={{ color: kpiColor }}>
        {isFlujoNegativo ? "−" : "+"}{fmtMoney(Math.abs(flujo), currency, valorUF)}
      </p>
      <p className="font-mono text-[10px] text-[var(--franco-text-secondary)] m-0 mt-0.5">
        factor ×{factor.toFixed(2)}
      </p>
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
