// La matemática de la carrera. Todo acá es función pura del frame: Remotion renderiza
// cada cuadro por separado, así que ninguna animación puede depender de transiciones CSS
// ni de estado acumulado — si dependiera, el MP4 saldría congelado o a tirones.

import { GUION, PISTA } from "./canon";

export type FilaDataset = {
  nombre: string;
  valores: number[];
  nivelInicial: number;
  grupo: "protagonista" | "cara" | "resto";
}

export type Evento = {
  nombre: string;
  anio: number;
  tipo: "entra" | "sale" | "podio";
}

export type Dataset = {
  meta: {
    titulo: string;
    subtitulo: string;
    metrica: string;
    anioEstimado: number;
    nCaras: number;
    fuente: string;
    generadoPor: string;
  };
  anios: number[];
  filas: FilaDataset[];
  eventos: Evento[];
}

/** Año continuo (con decimales) que corresponde a un frame. */
export function anioEnFrame(frame: number, anios: number[]): number {
  const a0 = anios[0];
  const aFin = anios[anios.length - 1];
  if (frame <= GUION.hook) return a0;
  // Arranque lento: el primer salto de año se toma dos segundos enteros para que el
  // ojo entienda qué mide la barra antes de que empiece a correr.
  if (frame <= GUION.arranque) return a0 + (frame - GUION.hook) / (GUION.arranque - GUION.hook);
  if (frame <= GUION.carrera) {
    const p = (frame - GUION.arranque) / (GUION.carrera - GUION.arranque);
    return a0 + 1 + p * (aFin - a0 - 1);
  }
  return aFin;
}

/** El frame en que la carrera pisa un año dado. Inversa de anioEnFrame. */
export function frameDeAnio(anio: number, anios: number[]): number {
  const a0 = anios[0];
  const aFin = anios[anios.length - 1];
  if (anio <= a0) return GUION.hook;
  if (anio <= a0 + 1) return GUION.hook + (anio - a0) * (GUION.arranque - GUION.hook);
  return GUION.arranque + ((anio - a0 - 1) / (aFin - a0 - 1)) * (GUION.carrera - GUION.arranque);
}

/** Valor interpolado linealmente entre los puntos anuales. */
export function valorEn(valores: number[], anio: number, anio0: number): number {
  const x = anio - anio0;
  const i = Math.floor(x);
  if (i >= valores.length - 1) return valores[valores.length - 1];
  if (i < 0) return valores[0];
  return valores[i] + (valores[i + 1] - valores[i]) * (x - i);
}

/**
 * Tabla de rangos ENTEROS por año: `tabla[i][k]` es la posición (0 = primero) de la
 * fila k en el año i. Se calcula una vez por dataset.
 *
 * El año base es degenerado —todas las comunas valen 0%— así que su orden se toma del
 * año siguiente, que es la convención aprobada para el arranque. Los empates se rompen
 * por nombre: un orden inestable haría vibrar filas entre cuadro y cuadro.
 */
const cacheRangos = new WeakMap<Dataset, number[][]>();

function rangosPorAnio(dataset: Dataset): number[][] {
  const guardado = cacheRangos.get(dataset);
  if (guardado) return guardado;
  const tabla: number[][] = [];
  for (let i = 0; i < dataset.anios.length; i++) {
    const orden = dataset.filas
      .map((f, k) => ({ k, v: i === 0 ? f.valores[1] : f.valores[i], nombre: f.nombre }))
      .sort((a, b) => b.v - a.v || a.nombre.localeCompare(b.nombre, "es"));
    const rangos = new Array<number>(dataset.filas.length);
    orden.forEach((o, pos) => {
      rangos[o.k] = pos;
    });
    tabla.push(rangos);
  }
  cacheRangos.set(dataset, tabla);
  return tabla;
}

export type EstadoFila = {
  fila: FilaDataset;
  valor: number;
  /** Rango continuo: 0 es primero. Cruza suave cuando dos barras se pasan. */
  rango: number;
  ancho: number;
  opacidad: number;
  y: number;
  dentro: boolean;
}

export type EstadoCarrera = {
  anio: number;
  xMax: number;
  filas: EstadoFila[];
}

/**
 * Estado completo del gráfico en un instante.
 *
 * El rango es CONTINUO pero se interpola entre los rangos enteros de cada año: en cada
 * año la posición es exacta y entre año y año la fila se desliza. Se probó antes un
 * rango "blando" —contar cuántas barras superan a esta con una sigmoide— y colapsaba en
 * los casi-empates: comunas con valores casi idénticos quedaban en la misma posición y
 * las etiquetas se montaban unas sobre otras.
 *
 * No hay transiciones CSS en ninguna parte: Remotion renderiza cada cuadro por separado
 * y una transición temporal saldría congelada en el MP4.
 */
export function estadoEn(anio: number, dataset: Dataset): EstadoCarrera {
  const a0 = dataset.anios[0];
  const tabla = rangosPorAnio(dataset);

  const x = anio - a0;
  const i = Math.min(Math.max(Math.floor(x), 0), dataset.anios.length - 2);
  const fr = Math.min(1, Math.max(0, x - i));

  const valores = dataset.filas.map((f) => valorEn(f.valores, anio, a0));
  const xMax = Math.max(PISTA.pisoEje, Math.max(...valores) * 1.06);

  const filas = dataset.filas.map((fila, k) => {
    const rango = tabla[i][k] + (tabla[i + 1][k] - tabla[i][k]) * fr;
    // Las que se caen del top-8 bajan un escalón extra y se apagan ahí.
    const y = Math.min(rango, PISTA.n) * PISTA.altoFila;
    const opacidad = Math.max(0, Math.min(1, PISTA.n - rango));
    const ancho = Math.max(4, (Math.max(0, valores[k]) / xMax) * PISTA.ancho);
    return {
      fila,
      valor: valores[k],
      rango,
      ancho,
      opacidad,
      y,
      dentro: ancho > PISTA.minEtiquetaDentro,
    };
  });

  return { anio, xMax, filas };
}

const suave = (x: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Marcas del eje. El paso salta 10 → 25 → 50 a medida que la escala crece; el salto se
 * cruza con opacidad en vez de golpe seco, que en video se lee como un parpadeo.
 */
export function marcasEje(xMax: number): { v: number; op: number }[] {
  const p50 = suave(xMax, 85, 100);
  const p10 = 1 - suave(xMax, 42, 50);
  const p25 = Math.max(0, 1 - p10 - p50);
  const pesos: [number, number][] = [
    [10, p10],
    [25, p25],
    [50, p50],
  ];
  const mapa = new Map<number, number>();
  for (const [paso, op] of pesos) {
    if (op < 0.01) continue;
    for (let v = paso; v <= xMax; v += paso) {
      mapa.set(v, Math.max(mapa.get(v) ?? 0, op));
    }
  }
  return [...mapa.entries()]
    .map(([v, op]) => ({ v, op }))
    .sort((a, b) => a.v - b.v);
}

/**
 * Intensidad del pulso de un beat en este frame, 0 a 1.
 *
 * Una salida del top-8 se marca ANTES de que la fila se apague (si no, el pulso se
 * vería sobre algo que ya está en opacidad 0); una entrada o un podio, apenas después
 * de que el año aterriza.
 */
export function pulsoDeBeat(
  nombre: string,
  frame: number,
  beats: Evento[],
  anios: number[],
): number {
  let p = 0;
  for (const b of beats) {
    if (b.nombre !== nombre) continue;
    const f0 = frameDeAnio(b.anio, anios) + (b.tipo === "sale" ? -12 : 6);
    const x = (frame - f0) / 22;
    if (x < 0 || x > 1) continue;
    p = Math.max(p, Math.sin(Math.PI * x));
  }
  return p;
}
