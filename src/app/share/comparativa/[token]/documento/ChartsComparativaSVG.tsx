// ─────────────────────────────────────────────────────────────────────────
// Charts del documento comparativo — SVG PURO server-side (patrón
// PatrimonioChartSVG). Sin "use client", sin Recharts.
//
// Por qué NO reusa PatrimonioChartSVG: ese componente dibuja barras apiladas
// (aporte + valor) + UNA línea de patrimonio, para una sola modalidad. Acá la
// tesis del documento es la CONVERGENCIA de dos series, así que se necesita un
// chart de dos líneas superpuestas — variante comparativa mínima (dos polilíneas
// sobre la misma escala), no una extensión del genérico.
//
// Ambos charts consumen series ya emitidas por el motor (projections de cada
// lado · flujoEstacional del STR); cero recálculo.
// ─────────────────────────────────────────────────────────────────────────

import type { FlujoEstacionalMes } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney } from "@/components/analysis/utils";

// ── Patrimonio comparado (LTR vs STR · dos líneas) ───────────────────────
const P_W = 320, P_H = 200;
const P_X0 = 44, P_X1 = 314, P_TOP = 12, P_BASE = 168, P_LABEL_Y = 182;

export function PatrimonioComparativoSVG({
  ltr,
  str,
  valorUF,
}: {
  ltr: { anio: number; patrimonioNeto: number }[];
  str: { anio: number; patrimonioNeto: number }[];
  valorUF: number;
}) {
  const n = Math.max(ltr.length, str.length);
  if (n === 0) return null;

  const all = [...ltr.map((r) => r.patrimonioNeto), ...str.map((r) => r.patrimonioNeto), 0];
  const rawMax = Math.max(...all);
  const yMax = rawMax > 0 ? rawMax * 1.08 : 1;
  const yMin = Math.min(0, ...all);
  const span = yMax - yMin || 1;

  const yFor = (v: number) => P_BASE - ((v - yMin) / span) * (P_BASE - P_TOP);
  const xFor = (i: number) => (n === 1 ? P_X0 : P_X0 + ((P_X1 - P_X0) * i) / (n - 1));

  const pts = (rows: { patrimonioNeto: number }[]) =>
    rows.map((r, i) => `${xFor(i).toFixed(1)},${yFor(r.patrimonioNeto).toFixed(1)}`).join(" ");

  const gridVals = [0, yMax / 2, yMax];
  const step = Math.max(1, Math.ceil(n / 6));

  return (
    <svg viewBox={`0 0 ${P_W} ${P_H}`} width="100%" role="img" aria-label="Patrimonio neto a 10 años en ambas modalidades" preserveAspectRatio="xMidYMid meet">
      {gridVals.map((v, k) => {
        const y = yFor(v);
        return (
          <g key={`g${k}`}>
            <line x1={P_X0} y1={y} x2={P_X1} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray={v === 0 ? undefined : "3 3"} />
            <text x={P_X0 - 6} y={y + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">
              {fmtAxisMoney(v, "CLP", valorUF)}
            </text>
          </g>
        );
      })}

      {/* LTR: Ink 400 punteado · STR: Ink sólido — la convergencia es el mensaje */}
      {ltr.length >= 2 && <polyline points={pts(ltr)} fill="none" stroke="var(--ink-400)" strokeWidth={1.5} strokeDasharray="4 3" />}
      {str.length >= 2 && <polyline points={pts(str)} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
      {ltr.length > 0 && <circle cx={xFor(ltr.length - 1)} cy={yFor(ltr[ltr.length - 1].patrimonioNeto)} r={2.5} fill="var(--ink-400)" />}
      {str.length > 0 && <circle cx={xFor(str.length - 1)} cy={yFor(str[str.length - 1].patrimonioNeto)} r={2.5} fill="var(--text)" />}

      <line x1={P_X0 - 2} y1={P_BASE} x2={P_X1} y2={P_BASE} stroke="var(--border)" strokeWidth={0.5} />
      {Array.from({ length: n }).map((_, i) =>
        i % step === 0 || i === n - 1 ? (
          <text key={`x${i}`} x={xFor(i)} y={P_LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">
            {(str[i]?.anio ?? ltr[i]?.anio ?? i + 1)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ── Flujo comparado (LTR plano vs STR estacional) ────────────────────────
const F_W = 320, F_H = 200;
const F_X0 = 46, F_X1 = 314, F_TOP = 14, F_BOT = 168, F_LABEL_Y = 182;

const MES_ABREV: Record<string, string> = {
  Enero: "E", Febrero: "F", Marzo: "M", Abril: "A", Mayo: "M", Junio: "J",
  Julio: "J", Agosto: "A", Septiembre: "S", Octubre: "O", Noviembre: "N", Diciembre: "D",
};

export function FlujoComparadoSVG({
  meses,
  flujoLtrMensual,
  valorUF,
}: {
  meses: FlujoEstacionalMes[];
  flujoLtrMensual: number;
  valorUF: number;
}) {
  const n = meses.length;
  if (n === 0) return null;

  const vals = [...meses.map((m) => m.flujo), flujoLtrMensual, 0];
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const span = maxV - minV || 1;

  const yFor = (v: number) => F_BOT - ((v - minV) / span) * (F_BOT - F_TOP);
  const zeroY = yFor(0);
  const slot = (F_X1 - F_X0) / n;
  const barW = Math.max(4, Math.min(18, slot * 0.6));
  const xCenter = (i: number) => F_X0 + slot * (i + 0.5);

  return (
    <svg viewBox={`0 0 ${F_W} ${F_H}`} width="100%" role="img" aria-label="Flujo mensual: renta larga plana vs renta corta estacional" preserveAspectRatio="xMidYMid meet">
      {/* Línea $0 */}
      <line x1={F_X0} y1={zeroY} x2={F_X1} y2={zeroY} stroke="var(--border-strong)" strokeWidth={1} />
      <text x={F_X0 - 6} y={zeroY + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">$0</text>
      <text x={F_X0 - 6} y={yFor(maxV) + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">{fmtAxisMoney(maxV, "CLP", valorUF)}</text>
      <text x={F_X0 - 6} y={yFor(minV) - 1} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">{fmtAxisMoney(minV, "CLP", valorUF)}</text>

      {/* STR: barras estacionales (Ink positivo · Signal Red cuando aportas) */}
      {meses.map((m, i) => {
        const x = xCenter(i) - barW / 2;
        const y = m.flujo >= 0 ? yFor(m.flujo) : zeroY;
        const h = Math.abs(yFor(m.flujo) - zeroY);
        return <rect key={`b${i}`} x={x} y={y} width={barW} height={h} fill={m.flujo >= 0 ? "var(--text)" : "var(--signal-red)"} />;
      })}

      {/* LTR: línea plana — el mismo número todos los meses */}
      <line x1={F_X0} y1={yFor(flujoLtrMensual)} x2={F_X1} y2={yFor(flujoLtrMensual)} stroke="var(--ink-400)" strokeWidth={1.5} strokeDasharray="4 3" />

      {meses.map((m, i) => (
        <text key={`x${i}`} x={xCenter(i)} y={F_LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={6.5} fill="var(--text-muted)">
          {MES_ABREV[m.mes] ?? m.mes.slice(0, 1).toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
