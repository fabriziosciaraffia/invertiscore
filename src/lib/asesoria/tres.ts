// ─────────────────────────────────────────────────────────────────────────────
// LOS 3 DEPTOS DE LA ASESORÍA (27-nov-2026, criterio aprobado por Fabrizio). Sin depto de entrada: del universo de la persona
// —los Comprar a SU plazo que le alcanzan (precio ≤ tope), que piden como mucho su aporte y que están en sus zonas— salen:
//   1 · EL QUE MEJOR RINDE: el de mayor cap rate (arriendo × 12 ÷ precio en pesos). Empate: mayor puntaje, después id.
//   2 · EL QUE PIDE MENOS AL MES: el de mayor flujo a su plazo. Empate: mayor puntaje, después id.
//   3 · EL DISTINTO: el de mayor puntaje con una comuna o una tipología que no tenga ninguno de los otros dos. La variedad es una
//       PREFERENCIA, no un requisito (Fabrizio, 27-nov-2026): si no hay uno distinto, el tercero es el de mejor puntaje («otro»).
//       Nunca se dice «encontré 2» si hay más.
// Nunca dos del mismo edificio (misma comuna y a menos de 40 m: cada corredor pone el pin un poco distinto). Si un depto gana dos
// lugares se queda con el primero y el otro pasa al siguiente. Si hay menos de 3, los que hay (y la pantalla lo dice).
// Lo fija el tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import type { Candidato, PlazoMascara } from "./aporte";
import { calzaCon } from "./aporte";

export const RADIO_EDIFICIO_M = 40;

/** EL CAP RATE FUERA DE RANGO (decisión de Fabrizio, 27-nov-2026): un depto con cap rate bruto sobre 12 % no entra a «tus deptos».
 *  Medido por Claude: son 26 de 4.553 y el percentil 99 es 11,1 %; casi siempre es un arriendo que no corresponde al depto (en el
 *  paseo, «El que mejor rinde» era un 3D de 45 m² con 24,9 %). Solo la elección del perfil: el mapa y el contador no cambian. */
export const CAP_RATE_MAX_PERFIL = 0.12;

export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const mismoEdificio = (a: Candidato, b: Candidato): boolean => a.comuna === b.comuna && distanciaM(a, b) < RADIO_EDIFICIO_M;

export const capRate = (c: Pick<Candidato, "arriendo" | "precioUF">, uf: number): number | null =>
  c.arriendo != null && c.precioUF > 0 && uf > 0 ? (c.arriendo * 12) / (c.precioUF * uf) : null;

export type PorQue = "rinde" | "pide_menos" | "distinto" | "otro";
export interface Elegido { c: Candidato; porQue: PorQue }

export interface PerfilTres {
  plazo: PlazoMascara;
  aporte: number;
  topeUF: number;
  /** Las comunas de sus zonas (vacío = todas: «Donde más rinde» las elige antes). */
  comunas: readonly string[];
  /** «Cerca de mi pega» o «Cerca del metro»: otro filtro de lugar, ya resuelto en una función. */
  enLugar?: (c: Candidato) => boolean;
  uf: number;
}

/** El universo de la persona: Comprar a su plazo, le alcanza, pide como mucho su aporte y está en sus zonas. */
export function universoDe(cs: readonly Candidato[], p: PerfilTres): Candidato[] {
  return cs.filter((c) => c.precioUF <= p.topeUF && calzaCon(c, p.plazo, p.aporte)
    && (p.comunas.length === 0 || p.comunas.includes(c.comuna)) && (!p.enLugar || p.enLugar(c))
    && !((capRate(c, p.uf) ?? 0) > CAP_RATE_MAX_PERFIL));
}

const porScore = (a: Candidato, b: Candidato) => (b.score ?? -1) - (a.score ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function elegirTres(cs: readonly Candidato[], p: PerfilTres): Elegido[] {
  const u = universoDe(cs, p);
  const out: Elegido[] = [];
  const libre = (c: Candidato) => !out.some((e) => e.c.id === c.id || mismoEdificio(e.c, c));
  // 1 · el que mejor rinde
  const rinde = [...u].filter((c) => capRate(c, p.uf) != null).sort((a, b) => (capRate(b, p.uf)! - capRate(a, p.uf)!) || porScore(a, b));
  const a = rinde.find(libre);
  if (a) out.push({ c: a, porQue: "rinde" });
  // 2 · el que pide menos al mes (mayor flujo a su plazo)
  const menos = [...u].sort((x, y) => ((y.flujo[p.plazo] ?? -Infinity) - (x.flujo[p.plazo] ?? -Infinity)) || porScore(x, y));
  const b = menos.find(libre);
  if (b) out.push({ c: b, porQue: "pide_menos" });
  // 3 · el distinto: otra comuna u otra tipología que los dos de arriba
  const comunas = new Set(out.map((e) => e.c.comuna)), tipos = new Set(out.map((e) => e.c.dormitorios));
  const porPuntaje = [...u].sort(porScore);
  const c = porPuntaje.find((x) => libre(x) && (!comunas.has(x.comuna) || !tipos.has(x.dormitorios)));
  if (c) out.push({ c, porQue: "distinto" });
  else { const otro = porPuntaje.find(libre); if (otro) out.push({ c: otro, porQue: "otro" }); }
  return out;
}

/** LO QUE RINDE CADA COMUNA (decisión de Fabrizio, 27-nov-2026): la MEDIANA del cap rate de sus Comprar, sin los que pasan de
 *  CAP_RATE_MAX_PERFIL (un arriendo mal estimado inflaba el promedio: Peñalolén daba 9,0 % de promedio y 7,5 % de mediana) y solo
 *  comunas con al menos MIN_DEPTOS_COMUNA_RINDE. Y la de todo Santiago, para la fila de referencia («Todo Santiago · 5,9 %»). */
export const MIN_DEPTOS_COMUNA_RINDE = 15;
const mediana = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function rindePorComuna(cs: readonly Candidato[], uf: number): { rinde: Array<{ comuna: string; cap: number; n: number }>; santiago: number | null } {
  const porComuna = new Map<string, number[]>();
  const todos: number[] = [];
  for (const c of cs) {
    const cap = capRate(c, uf);
    if (cap == null || cap > CAP_RATE_MAX_PERFIL) continue;
    todos.push(cap);
    const xs = porComuna.get(c.comuna) ?? [];
    xs.push(cap); porComuna.set(c.comuna, xs);
  }
  const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
  const rinde = Array.from(porComuna.entries()).filter(([, xs]) => xs.length >= MIN_DEPTOS_COMUNA_RINDE)
    .map(([comuna, xs]) => ({ comuna, cap: r4(mediana(xs)), n: xs.length }))
    .sort((a, b) => b.cap - a.cap || (a.comuna < b.comuna ? -1 : 1));
  return { rinde, santiago: todos.length ? r4(mediana(todos)) : null };
}
