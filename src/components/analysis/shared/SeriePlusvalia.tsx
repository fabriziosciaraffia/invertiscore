"use client";

import { useState } from "react";
import { useAncho } from "./useAncho";

/**
 * «Cuánto subió la comuna, contra el 3% del informe» — el gráfico del capítulo «Plusvalía»
 * (IV LTR; STR monta el mismo capítulo), mockup capitulo-iv-plusvalia.html aprobado el
 * 22-sep-2026. SVG al ancho medido, sin dependencias, tokens por clase (`.sp-*`).
 *
 *   · la serie de la comuna (UF/m² de deptos nuevos, precio de oferta, promedio anual; en UF,
 *     o sea real), ENTERA y unida hasta su último año: el estimado del cierre es un dato más;
 *   · la referencia compuesta al `refPct` anual desde el primer punto, en tinta tenue continua;
 *   · rótulos: el primer y el último año llevan su valor SIEMPRE visible; los intermedios lo
 *     muestran al tocar o al pasar el cursor (en mobile el tap no dispara hover: es la cola de
 *     los ⓘ, y por eso los extremos van fijos y el resto responde a click, que sí llega tras el
 *     tap, y NO alterna: el tap emula mouseenter antes del click, y un toggle lo apagaría en el
 *     mismo gesto). Al final, el acumulado de cada línea.
 */
export interface PuntoSerie {
  anio: number;
  valor: number;
}

export function SeriePlusvalia({
  puntos,
  refPct,
  rotuloSerie,
  rotuloRef,
  fmtValor,
}: {
  puntos: PuntoSerie[];
  /** La tasa anual de la referencia, en % (la proyección del informe). */
  refPct: number;
  rotuloSerie: string;
  rotuloRef: string;
  fmtValor: (v: number) => string;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);
  if (puntos.length < 2) return null;
  const W = Math.max(280, Math.round(ancho ?? 600)), H = 210, L = 46, R = 78, T = 16, B = 24;
  const base = puntos[0].valor, a0 = puntos[0].anio;
  const refDe = (anio: number) => base * Math.pow(1 + refPct / 100, anio - a0);
  const refPuntos = puntos.map((p) => refDe(p.anio));
  const all = [...puntos.map((p) => p.valor), ...refPuntos];
  const mn = Math.min(...all) * 0.97, mx = Math.max(...all) * 1.03;
  const rango = mx - mn || 1;
  const span = puntos[puntos.length - 1].anio - a0 || 1;
  const x = (anio: number) => L + ((anio - a0) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - mn) / rango) * (H - T - B);
  const d = (vals: number[]) => puntos.map((p, i) => `${i ? "L" : "M"}${x(p.anio).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(" ");
  const ticks = [mn, (mn + mx) / 2, mx].map((v) => Math.round(v));
  const ultimo = puntos.length - 1;
  const acumSerie = Math.round((puntos[ultimo].valor / base - 1) * 100);
  const acumRef = Math.round((refPuntos[ultimo] / base - 1) * 100);
  const ys = y(puntos[ultimo].valor), yr = y(refPuntos[ultimo]);
  const cerca = Math.abs(ys - yr) < 12;
  const yFin = cerca ? Math.min(ys, yr) - 3 : ys + 3, yRef = cerca ? Math.min(ys, yr) + 10 : yr + 3;
  const conRotulo = (i: number) => i === 0 || i === ultimo || activo === i;
  // El rótulo del primer año va arriba-derecha del punto, y la serie sale de ahí subiendo: en 390 la
  // línea cruzaba el texto. Se sube lo que la línea trepa a lo ancho del rótulo (~44 px), con tope.
  const subida0 = Math.min(18, Math.max(0, y(puntos[0].valor) - y(puntos[1].valor)) * Math.min(1, 44 / Math.max(1, x(puntos[1].anio) - x(puntos[0].anio))));
  const yRotulo = (i: number) => y(puntos[i].valor) - 8 - (i === 0 ? subida0 : 0);
  return (
    <div className="sp" ref={ref}>
      <svg className="sp-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${rotuloSerie}, ${a0} a ${puntos[ultimo].anio}, contra ${rotuloRef}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} y1={y(t)} x2={W - R} y2={y(t)} className="sp-grid" />
            <text x={L - 5} y={y(t) + 3} className="sp-tick" textAnchor="end">{t}</text>
          </g>
        ))}
        {puntos.map((p, i) => (i % 2 === 0 || i === ultimo) && (
          <text key={p.anio} x={x(p.anio)} y={H - 8} className="sp-anio" textAnchor="middle">{p.anio}</text>
        ))}
        <path d={d(refPuntos)} className="sp-ref" />
        <path d={d(puntos.map((p) => p.valor))} className="sp-serie" />
        {puntos.map((p, i) => (
          <g key={p.anio}>
            {conRotulo(i) && (
              <text x={x(p.anio)} y={yRotulo(i)} className={`sp-valor${i === 0 || i === ultimo ? " fijo" : ""}`} textAnchor={i === 0 ? "start" : i === ultimo ? "end" : "middle"}>
                {fmtValor(p.valor)}
              </text>
            )}
            <circle cx={x(p.anio)} cy={y(p.valor)} r={activo === i ? 3.6 : 2.6} className="sp-pt" />
            {/* área de toque generosa: 14 px de radio, invisible, y ÚLTIMA en el orden de pintado: el tap
                cae sobre el punto visible si este queda encima (medido en 390 con touchscreen.tap: el
                evento llegaba a `.sp-pt`, que no tiene handler, y el valor no aparecía). */}
            <circle
              cx={x(p.anio)}
              cy={y(p.valor)}
              r={14}
              className="sp-toque"
              role="button"
              tabIndex={0}
              aria-label={`${p.anio}: ${fmtValor(p.valor)}`}
              onClick={() => setActivo(i)}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivo(activo === i ? null : i); } }}
            />
          </g>
        ))}
        <text x={x(puntos[ultimo].anio) + 8} y={yFin} className="sp-acum">{acumSerie >= 0 ? "+" : ""}{acumSerie}%</text>
        <text x={x(puntos[ultimo].anio) + 8} y={yRef} className="sp-acum-ref">{acumRef >= 0 ? "+" : ""}{acumRef}% al {refPct}%</text>
      </svg>
      <div className="sp-leg">
        <span><i className="sp-sw sp-sw-serie" />{rotuloSerie}</span>
        <span><i className="sp-sw sp-sw-ref" />{rotuloRef}</span>
      </div>
    </div>
  );
}
