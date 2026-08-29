// Matemática y canon del Reel 2 ("el efecto amplificador del crédito"). Réplica del
// prototipo congelado `ref/reel2-prototipo-v8.html` con los cambios de alcance
// decididos: Fondo A y depósito salen del cuadro (quedan en el JSON para el Reel 3),
// hook nuevo con la ganancia neta, título sobrio y eje X con años seleccionados.
//
// El prototipo dibuja DIRECTO en 1080×1920 (no en 405 como los reels anteriores), así
// que acá no hay factor de escala: las coordenadas son las del lienzo final.

import type { Tema } from "./lineas";

/** Tema propio del reel 2 — paleta de la v8, fondo PLANO (doctrina post-banding). */
export const TEMA_REEL2: Tema = {
  fondo: "#0C0C12",
  ink: "#EDEDF2",
  tx3: "#8A8AA4",
  tx3Grafico: "#8A8AA4",
  grid: "#20202B",
  eje: "#3E3E52",
  rojo: "#FF3D50",
  fondoSrc: "#4A4A5A",
  // [depto con crédito, depto sin crédito, plata aportada]
  series: ["#FF3D50", "#FF9AA6", "#6A6A78"],
  marcaAgua: "#FFFFFF",
};

// ─── Timing (segundos). Base v8, reformado por decisión editorial: el hook ocupa la
// pantalla completa 3,5 s (0,0–3,5) y sube en 0,5 s — más seco que el 1,1 s de la v8,
// para que en el segundo 4 ya esté arriba y chico, que es el criterio de verificación.
// El total sigue en 24 s: se recorta de la carrera (15,8 → 14,3 s), del freeze
// (2,0 → 1,8 s) y del acto CTA (3,8 → 3,6 s), que es donde menos duele.
export const T_HOOK_VISIBLE = 0.3;
export const T_HOOK_SUBE = 3.5;
export const DUR_SUBIDA = 0.5;
export const T_CARRERA_INI = 4.3;
export const T_FIN = 18.6;
export const T_CTA = 20.4;
export const T_TOTAL = 24.0;

/**
 * Área de ploteo. x de la v8; y0 baja de 430 a 550 porque el bloque editorial superior
 * adopta el patrón del reel 1 (antetítulo + titular en la safe zone, top px(100)) y a
 * ese tamaño el titular de dos líneas termina ~480 — el gráfico parte debajo.
 */
export const PLOT = { x0: 155, x1: 775, y0: 550, y1: 1545 } as const;

export const NM = 132;
/**
 * Ventana inicial del eje X móvil: la MISMA mecánica del reel 1 (xmax = max(t, XMIN),
 * sin amortiguación — la inercia del reel 1 es solo del eje Y), adaptada de años a
 * meses: 2,2 años × 12 = 26,4 meses (~primeros 2-3 años en pantalla al partir).
 */
export const XMIN_MESES = 26.4;
export const INERCIA = 0.06;
export const GRID_PASO = 250;
export const GRID_MAX = 2500;
/** Años del eje X pedidos por Fabrizio (subset legible a 1080×1920, fuente 28). */
export const ANIOS_EJE_X = [2015, 2016, 2018, 2020, 2022, 2024, 2025];

export const fmtUF = (v: number) => Math.round(v).toLocaleString("es-CL");
export const fmtPct = (p: number) =>
  (p >= 0 ? "+" : "−") + Math.abs(p).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%/año";

/**
 * Interpolación cúbica monótona de la v8 (Fritsch-Carlson), textual: los nudos son los
 * cierres anuales y la curva no inventa sobreimpulsos entre ellos.
 */
export function monotona(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  const m = new Array<number>(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    if (a > 3) m[i] = 3 * d[i];
    if (b > 3) m[i + 1] = 3 * d[i];
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const s = (x - xs[i]) / h;
    const h00 = (1 + 2 * s) * (1 - s) * (1 - s);
    const h10 = s * (1 - s) * (1 - s);
    const h01 = s * s * (3 - 2 * s);
    const h11 = s * s * (s - 1);
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

/** La plata aportada interpola LINEAL dentro de cada año, como la v8. */
export function escalonLineal(knotX: number[], knotY: number[]): (t: number) => number {
  return (t: number) => {
    if (t <= 0) return knotY[0];
    const i = Math.min(Math.floor(t / 12), knotY.length - 2);
    const f = Math.min((t - knotX[i]) / 12, 1);
    return knotY[i] + (knotY[i + 1] - knotY[i]) * f;
  };
}

/** Posición temporal de la carrera (meses 0..132) en un instante dado. */
export function tCarrera(el: number): number {
  if (el <= T_CARRERA_INI) return 0;
  return Math.min(NM, ((el - T_CARRERA_INI) / (T_FIN - T_CARRERA_INI)) * NM);
}

/**
 * Serie del techo del eje Y amortiguado, un valor por paso de 60 Hz (la v8 corre la
 * recurrencia sobre requestAnimationFrame — el mismo truco del reel 1). Precalculada
 * una vez: es una recurrencia con estado y por-frame sería cuadrática.
 */
export function ejeYAmortiguado(
  yTarget: (t: number) => number,
  yInicial: number,
  totalSeg: number,
): number[] {
  const pasos = Math.ceil(totalSeg * 60) + 2;
  const ys: number[] = [yInicial];
  let y = yInicial;
  for (let k = 1; k <= pasos; k++) {
    y += (yTarget(tCarrera(k / 60)) - y) * INERCIA;
    ys.push(y);
  }
  return ys;
}

/** Path de una curva muestreada cada medio mes, como la v8. */
export function pathCurva(
  fn: (t: number) => number,
  t: number,
  X: (t: number) => number,
  Y: (v: number) => number,
): string {
  const fin = Math.min(t, NM);
  let d = `M ${X(0)} ${Y(fn(0))}`;
  for (let x = 0.5; x <= fin; x += 0.5) d += ` L ${X(x)} ${Y(fn(x))}`;
  if (fin % 0.5 !== 0) d += ` L ${X(fin)} ${Y(fn(fin))}`;
  return d;
}

/** Área cerrada entre las dos líneas rojas (la palanca), como la v8. */
export function pathArea(
  arriba: (t: number) => number,
  abajo: (t: number) => number,
  t: number,
  X: (t: number) => number,
  Y: (v: number) => number,
): string {
  const fin = Math.min(t, NM);
  if (fin <= 0) return "";
  let d = `M ${X(0)} ${Y(abajo(0))}`;
  for (let x = 0.5; x <= fin; x += 0.5) d += ` L ${X(x)} ${Y(abajo(x))}`;
  d += ` L ${X(fin)} ${Y(arriba(fin))}`;
  for (let x = Math.floor(fin / 0.5) * 0.5; x >= 0; x -= 0.5) d += ` L ${X(x)} ${Y(arriba(x))}`;
  return d + " Z";
}
