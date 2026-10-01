// ─────────────────────────────────────────────────────────────────────────────
// Qué muestra «Por dónde seguir buscando» (30-sep-2026, decisiones de Fabrizio). Funciones puras: las
// prueba el tier GUIA-BUSQUEDA sin red ni base.
//
//   · PARECIDOS: mismo número de dormitorios, m² ±20%, precio ±20%, vistos en los últimos 7 días, sin
//     arriendo sospechoso (no entran, sin nota). Lo filtra la RPC `guia_candidatos`.
//   · SOLO LOS QUE CONVIENEN: Comprar con los números de la persona —su pie, su plazo, su tasa—.
//   · EL RADIO MÁS CHICO que junte tres: 1 km, después 2 y 3. Si en el último hay menos de tres, van
//     los que haya.
//   · SI NINGUNO CONVIENE con su combinación, Franco prueba PRIMERO MÁS PLAZO —30 años, de una— y
//     DESPUÉS MÁS PIE —hasta tres escalones de 5, dentro del tope de la grilla (30% y a lo más 15
//     puntos sobre el suyo)— (pocas combinaciones: 30-sep-2026, la guía no puede tardar). La primera
//     combinación con alguno que convenga es la que se muestra, con los chips.
//   · Si ni así: ninguno, sin lista.
//   · Orden: veredicto (todos Comprar), puntaje, y a igual puntaje el más cercano.
// ─────────────────────────────────────────────────────────────────────────────
import { MIX_COSTO_TOPE_PTS_PRECIO, MIX_PIE_PASO_PCT, MIX_PLAZOS_WIZARD } from "@/lib/mix-palancas";
import { PIE_TOPE_GRILLA_PCT, pieSeMueveEnLaGrilla } from "@/lib/pie-se-mueve";
import type { RazonSinCapital } from "@/lib/types";

export const RADIOS_GUIA_M = [1000, 2000, 3000] as const;
export const TOPE_GUIA = 3;
export const MARGEN_PARECIDO = 0.2;
export const VENTANA_GUIA_DIAS = 7;
/** Cuántos candidatos (los más cercanos) se recalculan como máximo: acota el tiempo de la guía. */
export const MAX_CANDIDATOS_GUIA = 60;
/** Cuántos escalones de pie se prueban, a lo más, después del plazo largo. */
export const ESCALONES_PIE_GUIA = 3;
const CONCURRENCIA_GUIA = 8;

export type Combinacion = { piePct: number; plazoAnios: number };

export interface Evaluado {
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
}

export interface CandidatoBase {
  avisoId: string;
  distanciaM: number;
}

/** El rango de los parecidos: m² y precio ±20%. */
export function rangoParecido(o: { m2: number; precioUF: number }) {
  return {
    m2Min: o.m2 * (1 - MARGEN_PARECIDO),
    m2Max: o.m2 * (1 + MARGEN_PARECIDO),
    ufMin: o.precioUF * (1 - MARGEN_PARECIDO),
    ufMax: o.precioUF * (1 + MARGEN_PARECIDO),
  };
}

/**
 * Las combinaciones en el orden en que se prueban: la de la persona; después MÁS PLAZO con su pie,
 * hasta 30 años; después, con el plazo más largo, MÁS PIE en pasos de 5 dentro del tope. Nunca menos
 * plazo ni menos pie que los suyos.
 */
export function combinacionesGuia(p: { piePct: number; plazoAnios: number; razonSinPie?: RazonSinCapital | null }): Combinacion[] {
  const out: Combinacion[] = [{ piePct: p.piePct, plazoAnios: p.plazoAnios }];
  const plazoMax = Math.max(...MIX_PLAZOS_WIZARD);
  if (p.plazoAnios < plazoMax) out.push({ piePct: p.piePct, plazoAnios: plazoMax });
  const plazoFinal = out[out.length - 1].plazoAnios;
  if (pieSeMueveEnLaGrilla(p.piePct, p.razonSinPie)) {
    const techo = Math.min(PIE_TOPE_GRILLA_PCT, p.piePct + MIX_COSTO_TOPE_PTS_PRECIO);
    for (let k = 1; k <= ESCALONES_PIE_GUIA; k++) {
      const pie = p.piePct + k * MIX_PIE_PASO_PCT;
      if (pie > techo + 1e-9) break;
      out.push({ piePct: pie, plazoAnios: plazoFinal });
    }
  }
  return out;
}

export const conviene = (e: Evaluado | null | undefined) => e?.veredicto === "COMPRAR";

/** Veredicto, puntaje, cercanía. */
export function ordenarGuia<T extends CandidatoBase>(xs: Array<{ c: T; ev: Evaluado }>): Array<{ c: T; ev: Evaluado }> {
  const rango = (v: string | null) => (v === "COMPRAR" ? 0 : v === "AJUSTA SUPUESTOS" ? 1 : 2);
  return [...xs].sort((a, b) => rango(a.ev.veredicto) - rango(b.ev.veredicto) || (b.ev.score ?? -1) - (a.ev.score ?? -1) || a.c.distanciaM - b.c.distanciaM);
}

export type ResultadoGuia<T extends CandidatoBase> =
  | { estado: "normal" | "ajustada"; combinacion: Combinacion; radioM: number; items: Array<{ c: T; ev: Evaluado }> }
  | { estado: "ninguno"; combinacion: null; radioM: null; items: [] };

/**
 * Elige la guía. `candidatos` viene ordenado por distancia y ya filtrado (parecidos, 7 días, sin
 * sospechosos, a lo más el radio mayor). `evaluar` corre el motor para un candidato y una combinación;
 * se llama perezoso —radio por radio— y nunca dos veces para el mismo par.
 */
export async function elegirGuia<T extends CandidatoBase>(
  candidatos: T[],
  combinaciones: Combinacion[],
  evaluar: (c: T, combo: Combinacion) => Promise<Evaluado | null>,
): Promise<ResultadoGuia<T>> {
  for (let i = 0; i < combinaciones.length; i++) {
    const combo = combinaciones[i];
    const hechos = new Map<string, Evaluado | null>();
    let mejor: { radioM: number; items: Array<{ c: T; ev: Evaluado }> } | null = null;
    for (const radioM of RADIOS_GUIA_M) {
      const pool = candidatos.filter((c) => c.distanciaM <= radioM);
      const faltan = pool.filter((c) => !hechos.has(c.avisoId));
      for (let k = 0; k < faltan.length; k += CONCURRENCIA_GUIA) {
        const tanda = faltan.slice(k, k + CONCURRENCIA_GUIA);
        const evs = await Promise.all(tanda.map((c) => evaluar(c, combo).catch(() => null)));
        tanda.forEach((c, j) => hechos.set(c.avisoId, evs[j]));
      }
      const buenos = pool.filter((c) => conviene(hechos.get(c.avisoId))).map((c) => ({ c, ev: hechos.get(c.avisoId)! }));
      if (buenos.length > 0) mejor = { radioM, items: buenos };
      if (buenos.length >= TOPE_GUIA) break;
    }
    if (mejor) return { estado: i === 0 ? "normal" : "ajustada", combinacion: combo, radioM: mejor.radioM, items: ordenarGuia(mejor.items).slice(0, TOPE_GUIA) };
  }
  return { estado: "ninguno", combinacion: null, radioM: null, items: [] };
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** «420 m», «1,3 km». */
export function textoDistancia(m: number): string {
  if (m < 1000) return `${Math.max(50, Math.round(m / 10) * 10)} m`;
  return `${(Math.round(m / 100) / 10).toLocaleString("es-CL")} km`;
}
