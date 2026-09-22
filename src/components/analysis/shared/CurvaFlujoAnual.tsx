"use client";

import { useAncho } from "./useAncho";

/**
 * «Lo que deja o cuesta cada mes, según la temporada» — la curva del año del capítulo «Ocupación
 * en renta corta» (III STR), mockup capitulo-iii-noches-str.html aprobado el 22-sep-2026.
 *
 * UNA SOLA SERIE: el flujo de cada mes en pesos (`flujoEstacional[].flujo`, lo que queda después
 * de comisión, costos y cuota). La curva anterior (`CurvaAnual`, retirada) dibujaba el ingreso
 * bruto y pintaba por el signo del flujo: dos series en un gráfico. La forma es la de la
 * distribución mensual de ingreso de la zona (que mezcla tarifa y ocupación por mes: NO es la
 * ocupación mensual) desplazada por los costos fijos, así que la estacionalidad se ve igual.
 *
 * Eje Y en pesos con divisiones, la línea del cero en tinta tenue, el promedio punteado (su valor
 * va en la leyenda: dentro del gráfico chocaba con la curva), y los meses bajo cero en rojo.
 * SVG al ancho medido (`useAncho`): el texto no se estira.
 */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function CurvaFlujoAnual({ flujos, fmt }: { flujos: number[]; fmt: (n: number) => string }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  if (flujos.length !== 12) return null;
  const W = Math.max(280, Math.round(ancho ?? 600)), H = 170, L = 64, R = 14, T = 14, B = 36;
  const prom = flujos.reduce((a, b) => a + b, 0) / flujos.length;
  let mn = Math.min(...flujos, 0), mx = Math.max(...flujos, 0);
  const pad = (mx - mn) * 0.08 || 1;
  mn -= pad;
  mx += pad;
  const span = mx - mn;
  const y = (v: number) => T + (1 - (v - mn) / span) * (H - T - B);
  const x = (i: number) => L + (i / 11) * (W - L - R);
  const paso = (() => {
    const b = span / 5;
    const e = Math.pow(10, Math.floor(Math.log10(b)));
    return [1, 2, 2.5, 5, 10].map((k) => k * e).find((k) => k >= b) ?? b;
  })();
  const ticks: number[] = [];
  for (let v = Math.ceil(mn / paso) * paso; v <= mx; v += paso) ticks.push(v);
  const k = (n: number) => (n === 0 ? "0" : `${n < 0 ? "−" : ""}$${Math.abs(n) >= 1e6 ? `${(Math.abs(n) / 1e6).toFixed(1).replace(".", ",")} MM` : `${Math.round(Math.abs(n) / 1000)} mil`}`);
  const pts = flujos.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="cf" ref={ref}>
      <svg className="cf-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Lo que deja o cuesta cada mes, en pesos">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} y1={y(t)} x2={W - R} y2={y(t)} className="cf-grid" />
            <text x={L - 6} y={y(t) + 3} className="cf-tick" textAnchor="end">{k(t)}</text>
          </g>
        ))}
        <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} className="cf-cero" />
        <line x1={L} y1={y(prom)} x2={W - R} y2={y(prom)} className="cf-prom" />
        <polyline fill="none" className="cf-linea" points={pts} />
        {flujos.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.6} className={v < 0 ? "cf-pt neg" : "cf-pt"} />
        ))}
        {MESES.map((m, i) => (
          <text key={m} x={x(i)} y={H - 10} className="cf-mes" textAnchor="middle">{m}</text>
        ))}
      </svg>
      <div className="cf-leg">
        <span><i className="cf-sw neg" />mes en que pones plata</span>
        <span><i className="cf-sw" />mes que deja</span>
        <span><i className="cf-sw cero" />cero</span>
        <span><i className="cf-sw prom" />promedio <b>{fmt(prom)}/mes</b></span>
      </div>
    </div>
  );
}
