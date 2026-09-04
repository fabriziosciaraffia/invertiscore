"use client";

/**
 * "Cómo se reparte el año" (CONGELADO · III, `.curva`): doce puntos unidos por una
 * línea contra la línea punteada del mes promedio. Cada punto lleva el color de su
 * signo (verde = mes con flujo positivo, Signal Red = mes en que pones plata). SVG
 * puro: nada anima, el shot captura lo mismo que ve el usuario.
 */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function CurvaAnual({
  puntos,
  promedio,
  ariaLabel = "Ingreso de cada mes frente al mes promedio",
}: {
  /** Doce valores en el orden ene → dic. `positivo` decide el color del punto. */
  puntos: { v: number; positivo: boolean }[];
  promedio: number;
  ariaLabel?: string;
}) {
  const W = 600;
  const H = 150;
  const x0 = 34;
  const x1 = 594;
  const yTop = 20;
  const yBot = 120;
  const vals = puntos.map((p) => p.v);
  const min = Math.min(...vals, promedio);
  const max = Math.max(...vals, promedio);
  const span = max - min || 1;
  const y = (v: number) => yBot - ((v - min) / span) * (yBot - yTop);
  const x = (i: number) => x0 + (i * (x1 - x0)) / Math.max(1, puntos.length - 1);
  const pts = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const yProm = y(promedio);
  return (
    <svg className="curva" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label={ariaLabel} role="img">
      <line x1={x0} y1={yProm.toFixed(1)} x2={x1} y2={yProm.toFixed(1)} stroke="var(--doc-line2)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={x1 + 2} y={(yProm + 4).toFixed(1)} fontFamily="var(--font-mono, ui-monospace)" fontSize="10" fill="var(--doc-tx4)">
        promedio
      </text>
      <polyline fill="none" stroke="var(--doc-tx)" strokeWidth="2.5" points={pts} />
      {puntos.map((p, i) => (
        <circle key={i} cx={x(i).toFixed(1)} cy={y(p.v).toFixed(1)} r="3.5" fill={p.positivo ? "var(--doc-good)" : "var(--signal-red)"} />
      ))}
      {puntos.map((_, i) => (
        <text key={`m${i}`} x={x(i).toFixed(1)} y="142" fontFamily="var(--font-mono, ui-monospace)" fontSize="11" fill="var(--doc-tx4)" textAnchor="middle">
          {MESES[i] ?? ""}
        </text>
      ))}
    </svg>
  );
}
