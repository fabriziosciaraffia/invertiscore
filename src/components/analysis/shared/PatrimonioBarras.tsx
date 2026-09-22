"use client";

import { useAncho } from "./useAncho";

/**
 * «Lo que pusiste, lo que vale y tu parte · año a año» — el gráfico de barras del patrimonio
 * del capítulo «Tu resultado» (V LTR / VI STR), SVG sin dependencias, uno para las dos
 * modalidades (mockup capitulo-v-resultado.html, aprobado 22-sep-2026).
 *
 * Dos columnas por año, que NO se apilan entre sí (el aporte ya está contenido en el valor):
 *   · aporte acumulado — Signal Red: es la plata que pusiste (regla del informe: rojo para
 *     plata que sale, tinta para todo lo demás);
 *   · valor del depto — precio pactado en tinta tenue + plusvalía acumulada en trama de tinta
 *     (proyectado);
 *   · tu parte SI VENDES ESE AÑO — línea en tinta plena: `parteAlVender` del motor (valor −
 *     deuda − gastos de venta − sobreprecio de hoy), el MISMO número del encabezado en el año
 *     de venta. No se rotula la cifra final: la dice el encabezado.
 * Colores por clase (`.pb-*`, TokensShared): acá no hay ningún hex.
 */
export interface FilaPatrimonio {
  anio: number;
  aporte: number;
  precio: number;
  valor: number;
  parte: number;
}

export function PatrimonioBarras({ filas, fmtEje }: { filas: FilaPatrimonio[]; fmtEje: (n: number) => string }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  if (filas.length === 0) return null;
  // El SVG se dibuja al ancho medido del contenedor (600 de referencia antes de medir): con
  // `preserveAspectRatio="none"` sobre un viewBox fijo el texto de los ejes se estiraba en mobile.
  const W = Math.max(280, Math.round(ancho ?? 600)), H = 190, L = 46, R = 8, T = 12, B = 22;
  const mx = Math.max(...filas.map((r) => Math.max(r.valor, r.aporte, r.parte)));
  const mn = Math.min(0, ...filas.map((r) => r.parte));
  const rango = mx - mn || 1;
  const y = (v: number) => T + (1 - (v - mn) / rango) * (H - T - B);
  const n = filas.length, slot = (W - L - R) / n, bw = Math.max(5, Math.min(14, slot * 0.28));
  const xs = filas.map((_, i) => L + slot * i + slot / 2);
  const ticks = [0, 0.5, 1].map((k) => mn + rango * k);
  const linea = filas.map((r, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)},${y(r.parte).toFixed(1)}`).join(" ");
  return (
    <div className="pb" ref={ref}>
      <svg className="pb-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Aporte acumulado, valor del depto y tu parte si vendes ese año, año a año">
        <defs>
          <pattern id="pb-trama" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={5} height={5} className="pb-trama-base" />
            <line x1={0} y1={0} x2={0} y2={5} className="pb-trama-linea" strokeWidth={1.6} />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} y1={y(t)} x2={W - R} y2={y(t)} className="pb-grid" />
            <text x={L - 5} y={y(t) + 3} className="pb-tick" textAnchor="end">{fmtEje(t)}</text>
          </g>
        ))}
        {filas.map((r, i) => {
          const x = xs[i];
          const precio = Math.min(r.precio, r.valor);
          return (
            <g key={r.anio}>
              <rect x={x - bw - 1} y={y(Math.max(r.aporte, 0))} width={bw} height={Math.abs(y(0) - y(r.aporte))} className="pb-aporte" />
              {r.valor > 0 && <rect x={x + 1} y={y(precio)} width={bw} height={y(0) - y(precio)} className="pb-precio" />}
              {r.valor > precio && <rect x={x + 1} y={y(r.valor)} width={bw} height={y(precio) - y(r.valor)} fill="url(#pb-trama)" />}
              <text x={x} y={H - 7} className="pb-anio" textAnchor="middle">a{r.anio}</text>
            </g>
          );
        })}
        <path d={linea} className="pb-parte" />
        {filas.map((r, i) => (
          <circle key={r.anio} cx={xs[i]} cy={y(r.parte)} r={2.6} className="pb-parte-pt" />
        ))}
      </svg>
      <div className="pb-leg">
        <span><i className="pb-sw pb-sw-aporte" />Aporte acumulado</span>
        <span><i className="pb-sw pb-sw-precio" />Precio que pactaste</span>
        <span><i className="pb-sw pb-sw-plus" />Plusvalía acumulada</span>
        <span><i className="pb-sw pb-sw-parte" />Tu parte si vendes ese año</span>
      </div>
    </div>
  );
}
