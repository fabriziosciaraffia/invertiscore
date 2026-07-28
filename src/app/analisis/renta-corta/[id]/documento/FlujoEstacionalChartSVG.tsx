// ─────────────────────────────────────────────────────────────────────────
// FlujoEstacionalChartSVG — chart de flujo neto mes a mes (12 meses) como SVG
// PURO server-side. Sin "use client", sin Recharts. Patrón PatrimonioChartSVG.
//
// Consume results.flujoEstacional (FlujoEstacionalMes[], fuente única del motor;
// cero recálculo). Barras de flujo neto: Ink (mes con caja positiva) / Signal Red
// (mes que aportas de tu bolsillo, uso #2). Línea $0. Escala normalizada a los
// extremos de la serie → nada desborda.
//
// GUARDA DEL PATH PLANO (afirmabilidad): flujoEstacional es real solo en el path
// calculator_direct (AirROI trae monthly_revenue con distribución mensual). En el
// path comparables/fallback el motor usa FLAT_MONTHLY = Array(12).fill(1/12) → 12
// factores idénticos, cero estacionalidad. `tieneEstacionalidad` detecta ese caso
// por el rango de los factores (flat → max−min ≈ 0); el documento degrada a una
// nota honesta en vez de dibujar 12 barras iguales que fingen una curva que no existe.
// ─────────────────────────────────────────────────────────────────────────

import type { FlujoEstacionalMes } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney } from "@/components/analysis/utils";

// Umbral documentado: el fallback plano da factor = 1/12 = 0,0833 en los 12 meses
// (rango 0). Cualquier distribución mensual real de AirROI varía muy por encima
// de esto (un swing de ±15% sobre 1/12 ya es un rango de ~0,025). 0,01 separa
// limpio "curva observada" de "plano fabricado".
const RANGO_FACTOR_MIN = 0.01;

export function tieneEstacionalidad(rows: FlujoEstacionalMes[] | undefined): boolean {
  if (!rows || rows.length < 12) return false;
  const factores = rows.map((r) => r.factor);
  const rango = Math.max(...factores) - Math.min(...factores);
  return rango > RANGO_FACTOR_MIN;
}

// Geometría del viewBox (unidades = px del viewBox).
const VB_W = 700;
const VB_H = 230;
const PLOT_X0 = 52;
const PLOT_X1 = 690;
const PLOT_TOP = 16;
const PLOT_BOT = 198; // piso del área de barras; labels de mes debajo
const LABEL_Y = 216;

const MES_ABREV: Record<string, string> = {
  Enero: "ENE", Febrero: "FEB", Marzo: "MAR", Abril: "ABR",
  Mayo: "MAY", Junio: "JUN", Julio: "JUL", Agosto: "AGO",
  Septiembre: "SEP", Octubre: "OCT", Noviembre: "NOV", Diciembre: "DIC",
};

export function FlujoEstacionalChartSVG({
  rows,
  valorUF,
}: {
  rows: FlujoEstacionalMes[];
  valorUF: number;
}) {
  const n = rows.length;
  if (n === 0) return null;

  const flujos = rows.map((r) => r.flujo);
  const maxV = Math.max(0, ...flujos);
  const minV = Math.min(0, ...flujos);
  const span = maxV - minV || 1;

  const scale = (PLOT_BOT - PLOT_TOP) / span;
  const yFor = (v: number) => PLOT_BOT - (v - minV) * scale;
  const zeroY = yFor(0);

  const slot = (PLOT_X1 - PLOT_X0) / n;
  const barW = Math.max(6, Math.min(34, slot * 0.58));
  const xCenter = (i: number) => PLOT_X0 + slot * (i + 0.5);

  // Gridlines Y en maxV · 0 · minV (evita duplicar 0 si algún extremo es 0).
  const gridVals = Array.from(new Set([maxV, 0, minV]));

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="Flujo de caja neto mensual a lo largo de 12 meses" preserveAspectRatio="xMidYMid meet">
      {/* Gridlines + labels Y */}
      {gridVals.map((v, k) => {
        const y = yFor(v);
        return (
          <g key={`g${k}`}>
            <line x1={PLOT_X0} y1={y} x2={PLOT_X1} y2={y} stroke={v === 0 ? "var(--border-strong)" : "var(--border)"} strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? undefined : "3 3"} />
            <text x={PLOT_X0 - 6} y={y + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={8} fill="var(--text-muted)">
              {v === 0 ? "$0" : fmtAxisMoney(v, "CLP", valorUF)}
            </text>
          </g>
        );
      })}

      {/* Barras de flujo neto: Ink positivo · Signal Red negativo (uso #2) */}
      {rows.map((r, i) => {
        const x = xCenter(i) - barW / 2;
        const y = r.flujo >= 0 ? yFor(r.flujo) : zeroY;
        const h = Math.abs(yFor(r.flujo) - zeroY);
        return <rect key={`b${i}`} x={x} y={y} width={barW} height={h} fill={r.flujo >= 0 ? "var(--text)" : "var(--signal-red)"} />;
      })}

      {/* X labels (meses) */}
      {rows.map((r, i) => (
        <text key={`x${i}`} x={xCenter(i)} y={LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={8} fill="var(--text-muted)">
          {MES_ABREV[r.mes] ?? r.mes.slice(0, 3).toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
