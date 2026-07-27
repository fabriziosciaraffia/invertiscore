// ─────────────────────────────────────────────────────────────────────────
// PatrimonioChartSVG — Chart de Patrimonio (Patrón 7.B.3) como SVG PURO
// server-side. Sin "use client", sin Recharts, sin canvas, sin librerías.
//
// Consume la MISMA serie que el chart web (buildPatrimonioSeries, fuente única)
// — cero recálculo. Barras apiladas: aporte acumulado (Signal Red, uso #8) +
// valor depto (Ink 50%); línea patrimonio neto (Ink sólido). Colores por token.
//
// viewBox fijo 320×200 (aspect del slot del goal 1). Escala normalizada al
// máximo de la serie → nada desborda. Clamps documentados abajo.
// ─────────────────────────────────────────────────────────────────────────

import type { PatrimonioRow } from "@/lib/patrimonio-series";
import { fmtAxisMoney } from "@/components/analysis/utils";

// Geometría del viewBox (unidades = px del viewBox).
const VB_W = 320;
const VB_H = 200;
const PAD_L = 34;   // eje Y + labels
const PAD_R = 6;
const PLOT_X0 = PAD_L + 6;      // 40
const PLOT_X1 = VB_W - PAD_R;   // 314
const PLOT_TOP = 12;
const BASELINE = 168;           // eje X
const LABEL_Y = 182;            // labels de año
const PLOT_W = PLOT_X1 - PLOT_X0;
const PLOT_H = BASELINE - PLOT_TOP;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function PatrimonioChartSVG({
  rows,
  valorUF,
}: {
  rows: PatrimonioRow[];
  valorUF: number;
}) {
  const n = rows.length;
  if (n === 0) return null;

  // Escala Y: incluye el tope apilado (aporte + valor) y el patrimonio neto.
  // yMin permite que la línea baje si el patrimonio quedara negativo (underwater);
  // yMax normaliza todo al máximo → ninguna barra excede PLOT_H.
  const stackedTop = (r: PatrimonioRow) => r.aporteAcum + (r.valorDepto ?? 0);
  const rawMax = Math.max(...rows.map((r) => Math.max(stackedTop(r), r.patrimonioNeto)), 0);
  const yMax = rawMax > 0 ? rawMax * 1.08 : 1; // headroom 8%; fallback evita ÷0 (serie ~0)
  const yMin = Math.min(0, ...rows.map((r) => r.patrimonioNeto));
  const span = yMax - yMin || 1;

  // valor → y (px). Clamp al área de plot: el patrimonio negativo extremo
  // (deuda > valor, evento raro) se apoya en el piso; la cifra real vive en el
  // waterfall de venta, no acá.
  const yFor = (v: number) => clamp(BASELINE - ((v - yMin) / span) * PLOT_H, PLOT_TOP, BASELINE);
  const zeroY = yFor(0); // base de las barras (= BASELINE cuando yMin = 0)

  const slot = PLOT_W / n;
  const barW = Math.max(2, Math.min(18, slot * 0.55));
  const xCenter = (i: number) => PLOT_X0 + slot * (i + 0.5);

  // Labels de año: mostrar ~≤7 para no superponer (siempre primero y último).
  const step = Math.max(1, Math.ceil(n / 7));

  // Gridlines Y en 0 · yMax/2 · yMax (valor).
  const gridVals = [0, yMax / 2, yMax];

  // Línea de patrimonio neto (necesita ≥2 puntos).
  const linePts = rows
    .map((r, i) => `${xCenter(i).toFixed(1)},${yFor(r.patrimonioNeto).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="Patrimonio proyectado por año" preserveAspectRatio="xMidYMid meet">
      {/* Gridlines + labels Y */}
      {gridVals.map((v, k) => {
        const y = yFor(v);
        return (
          <g key={`g${k}`}>
            <line x1={PLOT_X0} y1={y} x2={PLOT_X1} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray={v === 0 ? undefined : "3 3"} />
            <text x={PAD_L - 4} y={y + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">
              {fmtAxisMoney(v, "CLP", valorUF)}
            </text>
          </g>
        );
      })}

      {/* Barras apiladas: aporte (rojo, base) + valor depto (Ink 50%, encima) */}
      {rows.map((r, i) => {
        const x = xCenter(i) - barW / 2;
        const yAporte = yFor(r.aporteAcum);
        const hAporte = Math.max(0, zeroY - yAporte);
        const segs = [
          <rect key={`a${i}`} x={x} y={yAporte} width={barW} height={hAporte} fill="var(--signal-red)" />,
        ];
        if (r.valorDepto != null) {
          const yTop = yFor(r.aporteAcum + r.valorDepto);
          const hValor = Math.max(0, yAporte - yTop);
          segs.push(
            <rect key={`v${i}`} x={x} y={yTop} width={barW} height={hValor} fill="var(--text)" fillOpacity={0.5} />,
          );
        }
        return <g key={`bar${i}`}>{segs}</g>;
      })}

      {/* Línea patrimonio neto (Ink sólido) + dots */}
      {n >= 2 && <polyline points={linePts} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
      {rows.map((r, i) => (
        <circle key={`d${i}`} cx={xCenter(i)} cy={yFor(r.patrimonioNeto)} r={i === n - 1 ? 2.5 : 1.8} fill="var(--text)" />
      ))}

      {/* Eje X + labels de año */}
      <line x1={PLOT_X0 - 2} y1={BASELINE} x2={PLOT_X1} y2={BASELINE} stroke="var(--border)" strokeWidth={0.5} />
      {rows.map((r, i) =>
        i % step === 0 || i === n - 1 ? (
          <text key={`x${i}`} x={xCenter(i)} y={LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">
            {r.anio}
          </text>
        ) : null,
      )}
    </svg>
  );
}
