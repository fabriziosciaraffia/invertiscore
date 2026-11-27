// ─────────────────────────────────────────────────────────────────────────────
// DÓNDE, EN LA ASESORÍA (27-nov-2026, lámina P6): las comunas que se tocan en el mapa (los límites de capa-comunas.v1.json), cerca
// del metro (la misma estación a menos de 1 km de la tarjeta: explorar/lugar.ts), donde más rinde (las tres comunas con mayor cap
// rate medio entre los que calzan) y cerca de la pega (un punto que se toca, 3 km a la redonda). En el navegador. Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import type { DatosComunas } from "@/lib/explorar/capas-referencia";
import { metroCercano } from "@/lib/explorar/lugar";
import { distanciaM } from "./tres";

export const RADIO_PEGA_M = 3_000;
export const COMUNAS_RINDE = 3;

/** ¿El punto cae dentro del anillo? (anillo plano: lat, lng, lat, lng…) */
export function dentroDeAnillo(lat: number, lng: number, a: readonly number[]): boolean {
  let dentro = false;
  for (let i = 0, j = a.length - 2; i + 1 < a.length; j = i, i += 2) {
    const yi = a[i], xi = a[i + 1], yj = a[j], xj = a[j + 1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** La comuna que contiene el punto, o null. */
export function comunaEn(lat: number, lng: number, d: DatosComunas | null): string | null {
  if (!d) return null;
  for (const c of d.comunas) if (c.a.some((anillo) => dentroDeAnillo(lat, lng, anillo))) return c.n;
  return null;
}

export const cercaDelMetro = (p: { lat: number; lng: number }): boolean => metroCercano(p.lat, p.lng) != null;
export const cercaDe = (centro: { lat: number; lng: number }) => (p: { lat: number; lng: number }): boolean => distanciaM(centro, p) <= RADIO_PEGA_M;

/** Las comunas que más rinden entre las que tienen deptos que calzan (al menos 3): el cap rate medio por comuna de los Comprar
 *  (un número por comuna, del servidor: al anónimo no le viaja el cap rate de cada depto). */
export function comunasQueMasRinden(rinde: ReadonlyArray<{ comuna: string; cap: number }>, calzanPorComuna: ReadonlyMap<string, number>, n = COMUNAS_RINDE): string[] {
  return rinde.filter((r) => (calzanPorComuna.get(r.comuna) ?? 0) >= 3).sort((a, b) => b.cap - a.cap || (a.comuna < b.comuna ? -1 : 1)).slice(0, n).map((r) => r.comuna);
}
