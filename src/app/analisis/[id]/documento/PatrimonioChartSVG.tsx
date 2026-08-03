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

  // Escala Y: el tope es la barra MÁS ALTA de cada año, no la suma de las dos.
  // Aporte y valor son columnas SEPARADAS (el aporte ya está contenido en el valor;
  // apilarlas contaba dos veces la misma plata y disparaba la escala).
  // yMin permite que la línea baje si el patrimonio quedara negativo (underwater);
  // yMax normaliza todo al máximo → ninguna barra excede PLOT_H.
  const topDeAnio = (r: PatrimonioRow) => Math.max(r.aporteAcum, r.valorDepto ?? 0);
  const rawMax = Math.max(...rows.map((r) => Math.max(topDeAnio(r), r.patrimonioNeto)), 0);
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
      <defs>
        <pattern id="doc-plusvalia-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={4} height={4} fill="var(--text)" fillOpacity={0.06} />
          <line x1={0} y1={0} x2={0} y2={4} stroke="var(--text)" strokeOpacity={0.42} strokeWidth={1.3} />
        </pattern>
      </defs>
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

      {/* Dos columnas por año, lado a lado (NO apiladas entre sí):
          · aporte acumulado (Signal Red, entero)
          · valor del depto, desglosado en precio pactado (Ink tenue) + plusvalía
            acumulada (Ink con trama diagonal — tratamiento de "proyectado" del
            sistema; sin colores fuera de Ink + Signal Red).
          Pre-entrega la columna de valor no se dibuja (el activo aún no es suyo). */}
      {rows.map((r, i) => {
        const half = barW / 2;
        const xAporte = xCenter(i) - barW / 2;
        const xValor = xCenter(i) + 0.5;
        const yAporte = yFor(r.aporteAcum);
        const segs = [
          <rect key={`a${i}`} x={xAporte} y={yAporte} width={Math.max(1, half - 0.5)} height={Math.max(0, zeroY - yAporte)} fill="var(--signal-red)" />,
        ];
        if (r.valorDepto != null) {
          // Clamp espejo del chart web: la suma de los dos segmentos es siempre
          // exactamente valorDepto, incluso con plusvalía negativa.
          const precioSeg = Math.min(r.precioPactadoCLP, r.valorDepto);
          const yPrecio = yFor(precioSeg);
          const yTop = yFor(r.valorDepto);
          const w = Math.max(1, half - 0.5);
          segs.push(
            <rect key={`p${i}`} x={xValor} y={yPrecio} width={w} height={Math.max(0, zeroY - yPrecio)} fill="var(--text)" fillOpacity={0.16} />,
          );
          if (r.valorDepto > precioSeg) {
            segs.push(
              <rect key={`v${i}`} x={xValor} y={yTop} width={w} height={Math.max(0, yPrecio - yTop)} fill="url(#doc-plusvalia-hatch)" />,
            );
          }
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
