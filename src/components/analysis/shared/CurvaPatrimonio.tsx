"use client";

/**
 * "Lo que pusiste, lo que vale y tu parte · año a año" (CONGELADO · VI, `.chart`):
 * por año, la barra del valor del depto (neutro), la del aporte acumulado (Signal
 * Red) y la línea de tu parte (valor − deuda) con la cifra final. SVG puro.
 */
export function CurvaPatrimonio({
  anios,
  etiquetaFinal,
  fmtLeyenda,
}: {
  anios: { year: number; valor: number; aporte: number; patrimonio: number }[];
  /** "$85,3 MM": tu parte el último año, ya formateada. */
  etiquetaFinal: string;
  fmtLeyenda?: { aporte: string; valor: string; parte: string };
}) {
  const W = 600;
  const H = 170;
  const base = 150;
  const top = 20;
  const n = anios.length;
  if (n === 0) return null;
  const max = Math.max(...anios.map((a) => Math.max(a.valor, a.aporte, a.patrimonio)), 1);
  const yv = (v: number) => base - (Math.max(0, v) / max) * (base - top);
  const slot = (590 - 30) / n;
  const bw = Math.min(20, slot * 0.36);
  const xValor = (i: number) => 30 + i * slot + slot * 0.14;
  const xAporte = (i: number) => xValor(i) + bw + 2;
  const xParte = (i: number) => xAporte(i) + (bw - 2) / 2;
  const pts = anios.map((a, i) => `${xParte(i).toFixed(0)},${yv(a.patrimonio).toFixed(1)}`).join(" ");
  const last = anios[n - 1];
  const leg = fmtLeyenda ?? { aporte: "Aporte acumulado", valor: "Valor del depto · 3% al año", parte: "Tu parte (valor − deuda)" };
  const ticks = n >= 10 ? [0, Math.floor(n / 2) - 1, n - 1] : anios.map((_, i) => i);
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Aporte acumulado, valor del depto y patrimonio neto por año" role="img">
        <line x1="30" y1={base} x2="590" y2={base} stroke="var(--doc-line2)" strokeWidth="1" />
        {anios.map((a, i) => (
          <g key={a.year}>
            <rect x={xValor(i).toFixed(1)} y={yv(a.valor).toFixed(1)} width={bw.toFixed(1)} height={(base - yv(a.valor)).toFixed(1)} fill="var(--doc-neutral)" opacity=".45" />
            <rect x={xAporte(i).toFixed(1)} y={yv(a.aporte).toFixed(1)} width={(bw - 2).toFixed(1)} height={(base - yv(a.aporte)).toFixed(1)} fill="var(--signal-red)" />
          </g>
        ))}
        <polyline fill="none" stroke="var(--doc-tx)" strokeWidth="3" points={pts} />
        <circle cx={xParte(n - 1).toFixed(0)} cy={yv(last.patrimonio).toFixed(1)} r="4" fill="var(--doc-tx)" />
        <text x={(xParte(n - 1) - 6).toFixed(0)} y={(yv(last.patrimonio) - 6).toFixed(1)} fontFamily="var(--font-mono, ui-monospace)" fontSize="14" fontWeight="700" fill="var(--doc-tx)" textAnchor="end">
          {etiquetaFinal}
        </text>
        {ticks.map((i) => (
          <text key={i} x={(xValor(i) + bw).toFixed(0)} y="164" fontFamily="var(--font-mono, ui-monospace)" fontSize="13" fill="var(--doc-tx4)" textAnchor="middle">
            {anios[i].year}
          </text>
        ))}
      </svg>
      <div className="chart-leg">
        <span style={{ ["--c" as string]: "var(--signal-red)" }}>{leg.aporte}</span>
        <span style={{ ["--c" as string]: "var(--doc-neutral)" }}>{leg.valor}</span>
        <span className="ln" style={{ ["--c" as string]: "var(--doc-tx)" }}>
          {leg.parte}
        </span>
      </div>
    </div>
  );
}
