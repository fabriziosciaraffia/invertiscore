// ─────────────────────────────────────────────────────────────────────────────
// EL APORTE AL MES (27-nov-2026, lámina P5): el slider se detiene en valores fijos de `cortes_flujo` (los cortes de los tramos del
// mapa: explorar_mapa_todos), así que el servidor nunca recibe una cifra libre y su respuesta no dice más de lo que el tramo ya
// dice. Al servidor viaja SOLO uno de estos valores; él devuelve los id de los Comprar que piden como mucho eso al mes, con una
// MÁSCARA de los cuatro plazos (30, 25, 20, 15): la edad no sale del navegador, que elige el bit de su plazo.
// La fila es la de asesoria_candidatos (migración 20261127_asesoria_plazos_cortos_1_columnas y _2_funcion): el flujo y el veredicto de cada plazo salen
// de la evaluación de la noche (la sonda del motor), no de un ajuste. Lo fija el tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────

/** Los altos del slider, en pesos al mes. Todos son cortes de `cortes_flujo` (con signo menos). */
export const APORTES = [0, 25_000, 50_000, 75_000, 100_000, 150_000, 200_000, 300_000] as const;
export type Aporte = (typeof APORTES)[number];
export const esAporte = (x: unknown): x is Aporte => typeof x === "number" && (APORTES as readonly number[]).includes(x);

/** Los plazos de la máscara, en el orden de sus bits. */
export const PLAZOS_MASCARA = [30, 25, 20, 15] as const;
export type PlazoMascara = (typeof PLAZOS_MASCARA)[number];
export const esPlazoMascara = (x: unknown): x is PlazoMascara => typeof x === "number" && (PLAZOS_MASCARA as readonly number[]).includes(x);

/** Una fila de asesoria_candidatos: id, comuna, lat, lng, dormitorios, precio UF, puntaje a 30, arriendo, flujo a 30 / 25 / 20 /
 *  15, Comprar a 25 / 20 / 15. (Comprar a 30 lo es por construcción: la función solo trae los Comprar a 30.) */
// Las posiciones 15 (los m²) y 16 (los comparables del arriendo) no las trae la función: las completa el servidor (servidor.ts ›
// leerUniverso) para las reglas de confianza del perfil (tres.ts).
export type FilaCandidato = [string, string, number, number, number, number, number | null, number | null, number | null, number | null, number | null, number | null, boolean, boolean, boolean, (number | null)?, (number | null)?];

export interface Candidato {
  id: string;
  comuna: string;
  lat: number;
  lng: number;
  dormitorios: number;
  precioUF: number;
  /** La superficie (las reglas de los 3D chicos y del arriendo por m², tres.ts); null si no se sabe. */
  m2: number | null;
  /** Cuántos comparables tiene la estimación del arriendo (arriendo->'n'); null si no se sabe. */
  n: number | null;
  score: number | null;
  arriendo: number | null;
  /** Flujo y Comprar por plazo. */
  flujo: Record<PlazoMascara, number | null>;
  comprar: Record<PlazoMascara, boolean>;
}

export function candidatoDeFila(f: FilaCandidato): Candidato {
  return {
    id: f[0], comuna: f[1], lat: Number(f[2]), lng: Number(f[3]), dormitorios: Number(f[4]), precioUF: Number(f[5]), m2: f[15] == null ? null : Number(f[15]), n: f[16] == null ? null : Number(f[16]),
    score: f[6], arriendo: f[7],
    flujo: { 30: f[8], 25: f[9], 20: f[10], 15: f[11] },
    comprar: { 30: true, 25: f[12] === true, 20: f[13] === true, 15: f[14] === true },
  };
}

/** ¿Calza con este plazo y este aporte? Comprar a ese plazo y un flujo que pide como mucho el aporte. Sin flujo, no. */
export function calzaCon(c: Candidato, plazo: PlazoMascara, aporte: number): boolean {
  const f = c.flujo[plazo];
  return c.comprar[plazo] && f != null && f >= -aporte;
}

/** La máscara de un candidato con un aporte: un bit por plazo (bit 0 = 30 años). */
export function mascara(c: Candidato, aporte: number): number {
  let m = 0;
  PLAZOS_MASCARA.forEach((p, i) => { if (calzaCon(c, p, aporte)) m |= 1 << i; });
  return m;
}

/** Lo que devuelve la ruta al anónimo: solo id y máscara, de los que calzan con algún plazo. Nunca cifras. */
export interface RespuestaAporte { i: string[]; m: number[] }

export function respuestaAporte(cs: readonly Candidato[], aporte: number): RespuestaAporte {
  const i: string[] = [], m: number[] = [];
  for (const c of cs) { const b = mascara(c, aporte); if (b) { i.push(c.id); m.push(b); } }
  return { i, m };
}

/** En el navegador: los id que calzan con SU plazo. */
export function idsDelPlazo(r: RespuestaAporte, plazo: PlazoMascara): Set<string> {
  const bit = 1 << PLAZOS_MASCARA.indexOf(plazo);
  const s = new Set<string>();
  r.i.forEach((id, k) => { if (r.m[k] & bit) s.add(id); });
  return s;
}

// ── LA DISTRIBUCIÓN DEL SLIDER (agregada: cuántos, nunca cuáles) ────────────
/** Las barras del slider: cuántos Comprar piden cada tramo de 25 mil al mes, desde «me sobra» (flujo ≥ 0) hasta 400 mil y más. */
export const BARRAS_PASO = 25_000;
export const BARRAS_N = 17;

/** Una barra por tramo y por plazo: barra 0 = flujo ≥ 0; barra k = pide entre (k−1)·25 mil y k·25 mil; la última, más. */
export function distribucion(cs: readonly Candidato[]): Record<PlazoMascara, number[]> {
  const out = {} as Record<PlazoMascara, number[]>;
  for (const p of PLAZOS_MASCARA) {
    const b = new Array<number>(BARRAS_N).fill(0);
    for (const c of cs) {
      const f = c.flujo[p];
      if (!c.comprar[p] || f == null) continue;
      const pide = Math.max(0, -f);
      b[Math.min(BARRAS_N - 1, pide === 0 ? 0 : Math.ceil(pide / BARRAS_PASO))] += 1;
    }
    out[p] = b;
  }
  return out;
}

/** «X DE CADA 10 SE PAGAN SOLOS» (C7 y lámina 4, decisión de Fabrizio del 27-nov-2026): si con 0 al mes calzan al menos el 80 % de
 *  los que le alcanzan (a su plazo), el paso del aporte NO abre el slider: muestra la buena noticia con «Seguir» y, aparte, «Puedo
 *  poner algo al mes». La fracción va HACIA ABAJO (8,9 de cada 10 se dice 8): nunca promete de más. `solos` son los que calzan con
 *  aporte 0; `alcanzan`, los que calzan con el alto máximo (los mismos de «te alcanzan» de la fórmula). */
export const UMBRAL_SOLOS = 0.8;
export function sePaganSolos(alcanzan: number, solos: number): { mostrar: boolean; k: number } {
  if (alcanzan <= 0) return { mostrar: false, k: 0 };
  const r = Math.min(1, solos / alcanzan);
  return { mostrar: r >= UMBRAL_SOLOS, k: Math.floor(r * 10) };
}
