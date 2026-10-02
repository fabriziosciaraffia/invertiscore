// ─────────────────────────────────────────────────────────────────────────────
// El arriendo de un aviso, del mismo segmento (30-sep-2026). Los comparables de arriendo por radio no
// distinguen calidad ni antigüedad: un bloque barato recibe el arriendo de los edificios mejores del
// barrio. Esto se queda con los arriendos del radio que están en el mismo tramo que el aviso: si el
// precio por m² del aviso está en el percentil p de las ventas cercanas, se toman los arriendos cuyo
// arriendo por m² está en [p − banda, p + banda] de la muestra. Sin ventas o arriendos suficientes
// devuelve null y se usa el arriendo de siempre. Puro: lo prueba el tier AVISOS.
// ─────────────────────────────────────────────────────────────────────────────
import { escalarPorTamano } from "../services/comparables-radio";

export interface PuntoPrecio {
  precio: number;
  superficie_m2: number | null;
}

export const BANDA_SEGMENTO = 0.25;
export const MIN_VENTAS_SEGMENTO = 10;
export const MIN_ARRIENDOS_SEGMENTO = 6;

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** El percentil (0–1) del aviso entre las ventas cercanas, por UF/m². Las ventas en pesos se pasan a UF. */
export function percentilVenta(ventas: PuntoPrecio[], sujetoUFm2: number, uf: number): number | null {
  const ufm2 = ventas
    .map((v) => ({ p: Number(v.precio), m2: Number(v.superficie_m2) }))
    .filter((v) => v.p > 0 && v.m2 >= 15)
    .map((v) => (v.p > 50000 ? v.p / uf : v.p) / v.m2);
  if (ufm2.length < MIN_VENTAS_SEGMENTO) return null;
  const debajo = ufm2.filter((x) => x < sujetoUFm2).length;
  const iguales = ufm2.filter((x) => x === sujetoUFm2).length;
  return (debajo + iguales / 2) / ufm2.length;
}

export function arriendoSegmentado(
  arriendos: PuntoPrecio[],
  ventas: PuntoPrecio[],
  sujetoUFm2: number,
  uf: number,
  /** Los m² del depto: la mediana del tramo se lleva a su tamaño (escalarPorTamano, 03-oct-2026). */
  sujetoM2?: number,
): { monto: number; n: number; percentil: number } | null {
  const p = percentilVenta(ventas, sujetoUFm2, uf);
  if (p == null) return null;
  const conM2 = arriendos
    .map((a) => ({ precio: Number(a.precio), m2: Number(a.superficie_m2) }))
    .filter((a) => a.precio > 0 && a.m2 >= 15)
    .map((a) => ({ ...a, pm2: a.precio / a.m2 }))
    .sort((x, y) => x.pm2 - y.pm2);
  if (conM2.length < MIN_ARRIENDOS_SEGMENTO) return null;
  const tramo = conM2.filter((_, i) => {
    const q = (i + 0.5) / conM2.length;
    return q >= p - BANDA_SEGMENTO && q <= p + BANDA_SEGMENTO;
  });
  if (tramo.length < MIN_ARRIENDOS_SEGMENTO) return null;
  const monto = mediana(tramo.map((a) => a.precio));
  return { monto: Math.round(sujetoM2 ? escalarPorTamano(monto, sujetoM2, tramo.map((a) => a.m2)) : monto), n: tramo.length, percentil: Math.round(p * 100) / 100 };
}
