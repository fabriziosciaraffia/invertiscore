// Matemática del reel de líneas. Réplica del prototipo congelado
// `ref/lineas-top5-FINAL.html`: las constantes, las curvas y el amortiguado son los
// mismos, con los mismos nombres, para que el diff contra el HTML sea legible.
//
// El SVG conserva el viewBox del prototipo (353×458) y sus coordenadas internas sin
// tocar: el lienzo de 1080×1920 escala el contenedor y el viewBox hace el resto. Así
// la réplica no depende de que yo reescale bien 40 números a mano.

export type FilaLinea = {
  nombre: string;
  ufM2: number[];
  valores: number[];
  referencia: boolean;
};

export type DatasetLineas = {
  meta: {
    titulo: string;
    subtitulo: string;
    anioEstimado: number;
    cierreGranSantiago: { ufM2: number; trimestres: number[]; nota: string };
    fuente: string;
    generadoPor: string;
  };
  anios: number[];
  filas: FilaLinea[];
};

// ─── Constantes del prototipo, textuales ─────────────────────────────────────
export const W = 353;
export const H = 458;
export const PADL = 34;
export const PADR = 92;
export const PADB = 26;
export const YFLOOR = 16;
export const XMIN = 2.2;

/** Segundos del gráfico, pausa inicial y hold final. */
export const DUR = 20;
/** Segundos del acto CTA, después del gráfico. Total del reel: DUR + CTA. */
export const CTA = 4.0;
/** Duración de las transiciones del CTA y sus dos retardos escalonados. */
export const CTA_FADE = 0.7;
export const CTA_DELAY_L1 = 0.5;
export const CTA_DELAY_L2 = 1.05;
export const CTA_DELAY_L3 = 1.6;
/** Desplazamiento vertical de entrada, en escala del prototipo. */
export const CTA_SUBIDA = 26;
export const PAUSE = 1.4;
export const HOLD = 1.5;

/** El prototipo se diseñó a 405×720; el reel sale a 1080×1920. */
export const S = 1080 / 405;
/** Convierte una medida del prototipo al lienzo final. */
export const px = (n: number) => n * S;

/** Inercia del eje Y. El eje persigue su objetivo, no salta. */
export const INERCIA = 0.06;

/**
 * Un tema es TODA la decisión de color del reel; el layout, el timing y los textos no
 * saben de temas. Los dos que existen replican los prototipos `ref/color-A-neon.html`
 * y `ref/color-C-light.html` valor por valor — la dirección final se decide viendo los
 * dos MP4 en un celular, y la ganadora quedará como default.
 */
export type Tema = {
  /** Degradado de fondo. Lo comparten el video y la portada. */
  fondo: string;
  /** Texto principal: hook, CTA, wordmark, etiquetas fuera de barra. */
  ink: string;
  /** Texto secundario del CSS: antetítulo y "re" del wordmark. */
  tx3: string;
  /**
   * Gris del GRÁFICO: rótulos del eje, años y la referencia punteada. En neón el
   * prototipo usa un gris distinto dentro del SVG que fuera de él (#8E8FA3 vs
   * #9C9DB2); en light coinciden. Lo cazó el gate de valores, no el ojo.
   */
  tx3Grafico: string;
  grid: string;
  eje: string;
  /** Highlight: palabra resaltada, "Franco", "gratis", ".ai". */
  rojo: string;
  /** La línea de fuente del pie. */
  fondoSrc: string;
  /** Series por posición, en el orden fijo del prototipo. */
  series: string[];
  /** El año gigante detrás de las series (opacidad 0,15). */
  marcaAgua: string;
};

export const TEMAS = {
  neon: {
    fondo: "linear-gradient(178deg,#16161E 0%,#0C0C12 52%,#050508 100%)",
    ink: "#FFFFFF",
    tx3: "#9C9DB2",
    tx3Grafico: "#8E8FA3",
    grid: "#20212C",
    eje: "#4A4C5E",
    rojo: "#FF3D50",
    fondoSrc: "#8E8FA3",
    series: ["#FF3D50", "#FFFFFF", "#4D9FFF", "#FFC42E", "#00E5C3"],
    marcaAgua: "#FFFFFF",
  },
  // Ojo: el antetítulo/eje del prototipo light usa #6E685C pero su .src usa #7E7869 —
  // son DOS grises distintos, no un typo.
  light: {
    fondo: "linear-gradient(178deg,#FFFFFF 0%,#F6F2EA 52%,#EDE6D8 100%)",
    ink: "#0F0F0F",
    tx3: "#6E685C",
    tx3Grafico: "#6E685C",
    grid: "#E0DACC",
    eje: "#A39C8C",
    rojo: "#E01B2C",
    fondoSrc: "#7E7869",
    series: ["#E01B2C", "#0F0F0F", "#0D5BD9", "#E88A00", "#00A88A"],
    // El HTML dejó INK='#FFFFFF' (resto stale del tema oscuro): blanco al 15% sobre
    // crema es invisible. La marca de agua pasa a tinta, que es la intención declarada
    // del tema — desviación deliberada del literal del prototipo.
    marcaAgua: "#0F0F0F",
  },
} as const satisfies Record<string, Tema>;

export type NombreTema = keyof typeof TEMAS;

/** Grosor de trazo: las series y la referencia punteada. */
export const TRAZO_SERIE = 2.8;
export const TRAZO_REFERENCIA = 1.7;

export const EMOJI_POR_DEFECTO: Record<string, string> = {
  Providencia: "🌳",
  Santiago: "🏛️",
  "Ñuñoa": "🍻",
  "Las Condes": "💼",
  "La Florida": "🌺",
};

/**
 * El prototipo corre sobre requestAnimationFrame, o sea ~60 pasos por segundo. El
 * amortiguado del eje es una recurrencia, así que su velocidad depende del tamaño del
 * paso: si se actualizara una vez por cuadro a 30fps, la inercia se sentiría el doble
 * de lenta con el mismo 0,06. Se simula a 60 Hz y se lee un paso de por medio.
 */
export const HZ_PROTOTIPO = 60;

/** Interpolación entre puntos anuales con smoothstep, como el prototipo. */
export function valAt(v: number[], tt: number, n: number): number {
  const i = Math.floor(tt);
  const f = tt - i;
  if (i >= n - 1) return v[n - 1];
  const e = f * f * (3 - 2 * f);
  return v[i] + (v[i + 1] - v[i]) * e;
}

/** Posición temporal (0 … N-1) en un instante dado, con pausa y hold. */
export function tEnSegundo(el: number, n: number): number {
  if (el >= DUR) return n - 1;
  if (el < PAUSE) return 0;
  const body = DUR - PAUSE - HOLD;
  const u = Math.min((el - PAUSE) / body, 1);
  const eased = u < 0.12 ? (u / 0.12) * (u / 0.12) * 0.12 : u;
  return eased * (n - 1);
}

/** Objetivo del eje Y: el máximo recorrido hasta ahora, con 12% de aire. */
function objetivoY(series: number[][], tt: number, n: number): number {
  let target = YFLOOR;
  for (const s of series) {
    for (let x = 0; x <= tt; x += 0.25) target = Math.max(target, valAt(s, x, n));
    target = Math.max(target, valAt(s, tt, n));
  }
  return Math.max(target * 1.12, YFLOOR);
}

/**
 * Serie completa del eje amortiguado, un valor por paso de 60 Hz. Se calcula una sola
 * vez por dataset: la recurrencia obliga a recorrerla desde el arranque, y hacerlo en
 * cada cuadro sería cuadrático.
 */
const cacheY = new WeakMap<DatasetLineas, number[]>();

export function ejeAmortiguado(dataset: DatasetLineas, fps: number, frames: number): number[] {
  const guardado = cacheY.get(dataset);
  if (guardado) return guardado;
  const n = dataset.anios.length;
  const series = dataset.filas.map((f) => f.valores);
  const pasos = Math.ceil((frames / fps) * HZ_PROTOTIPO) + 2;
  const ys: number[] = [YFLOOR];
  let y = YFLOOR;
  for (let k = 1; k <= pasos; k++) {
    const tt = tEnSegundo(k / HZ_PROTOTIPO, n);
    y += (objetivoY(series, tt, n) - y) * INERCIA;
    ys.push(y);
  }
  cacheY.set(dataset, ys);
  return ys;
}

/** Trazo recto hasta `tt`, con el último tramo cortado a mitad de año. */
export function pathRecto(
  v: number[],
  tt: number,
  n: number,
  X: (i: number) => number,
  Y: (v: number) => number,
): string {
  let d = "";
  const last = Math.max(0, Math.min(tt, n - 1));
  for (let i = 0; i <= Math.ceil(last); i++) {
    const w = Math.min(i, last);
    d += (i ? "L" : "M") + X(w).toFixed(1) + "," + Y(valAt(v, w, n)).toFixed(1);
  }
  return d;
}

export type Punta = {
  nombre: string;
  v: number;
  color: string;
  referencia: boolean;
  /** Y real del dato. */
  yDato: number;
  /** Y de la etiqueta, ya separada de la anterior. */
  yTexto: number;
};

/** Etiquetas de punta, ordenadas y separadas para que no se pisen. */
export function puntas(
  filas: FilaLinea[],
  colores: string[],
  colorReferencia: string,
  tt: number,
  n: number,
  Y: (v: number) => number,
): Punta[] {
  const lista = filas.map((f, i) => ({
    nombre: f.referencia ? "Prom. GS" : f.nombre,
    v: valAt(f.valores, tt, n),
    color: f.referencia ? colorReferencia : colores[i % colores.length],
    referencia: f.referencia,
  }));
  lista.sort((a, b) => b.v - a.v);
  let lastY = -99;
  return lista.map((o) => {
    const yDato = Y(o.v);
    let y = yDato;
    if (y - lastY < 14 && lastY > -90) y = lastY + 14;
    lastY = y;
    return { ...o, yDato, yTexto: y };
  });
}
