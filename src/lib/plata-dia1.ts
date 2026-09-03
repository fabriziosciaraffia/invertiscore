// Barra "Lo que pusiste · el día 1" del capítulo V — geometría pura.
//
// La barra de arriba (plata del día 1: pie + gastos de compra + puesta a punto)
// se dibuja A LA MISMA ESCALA que la barra de abajo (tu parte al vender): su
// ancho es inversionInicial / patrimonio. Con multiplicador ≥ 1 queda más corta;
// si alguna vez llegara un caso con multiplicador < 1 (hoy cae al fallback
// "Pusiste / Te queda" antes de llegar acá), el ancho se acota al 100% para que
// el layout no se rompa: la barra llena el contenedor y los segmentos siguen
// sumando 100% de ella.
//
// Los montos vienen tal cual de metrics (pieCLP, gastosCompraCLP, capexPuestaAPuntoCLP)
// y de exit.inversionInicial. Acá no se recalcula nada: solo proporciones.
//
// INVARIANTE DEL MÓDULO (03-sep-2026): los tres montos tienen que sumar la inversión
// inicial. La comprobación vivía en el componente con igualdad estricta y avisaba en
// 190 de 1.192 filas del parque por diferencias de centavos: `pieCLP` es
// `precio × pie%` (float) y el exit guarda `Math.round(inversionInicial)`. Ninguna fila
// del parque descuadra por $1 o más — no falta ningún sumando. La tolerancia es un peso
// porque el peso chileno no tiene decimales: bajo eso es redondeo, sobre eso es un
// sumando perdido y hay que mirarlo.

export type TonoDia1 = "pie" | "gastos" | "capex";

/** Bajo un peso es redondeo (el peso chileno no tiene decimales); de ahí para arriba,
 *  falta un sumando del día 1. */
export const TOLERANCIA_DIA1_CLP = 1;

export interface MontosDia1 {
  pieCLP: number;
  gastosCompraCLP: number;
  capexCLP: number;
  inversionInicial: number;
}

/** Diferencia (con signo) entre lo que suman los tres montos y la inversión inicial. */
export function descuadreDia1(p: MontosDia1): number {
  return p.pieCLP + p.gastosCompraCLP + p.capexCLP - p.inversionInicial;
}

/**
 * Mensaje del invariante, o null cuando cierra dentro de la tolerancia. Puro: el aviso
 * lo emite `barraDia1` en desarrollo, y los tests leen esta función.
 */
export function avisoDia1(p: MontosDia1): string | null {
  const d = descuadreDia1(p);
  if (Math.abs(d) < TOLERANCIA_DIA1_CLP) return null;
  return `[plata-dia1] el día 1 no cierra por $${Math.round(Math.abs(d)).toLocaleString("es-CL")}: ${Math.round(p.pieCLP)} + ${Math.round(p.gastosCompraCLP)} + ${Math.round(p.capexCLP)} ≠ ${Math.round(p.inversionInicial)}`;
}

export interface SegmentoDia1 {
  tono: TonoDia1;
  /** Porcentaje del ancho de la barra del día 1 (suman 100). */
  pct: number;
  montoCLP: number;
}

export interface BarraDia1 {
  /** Ancho de la barra respecto del contenedor (la barra de abajo mide 100). 0..100. */
  anchoPct: number;
  /** true cuando inversionInicial > patrimonio: la barra "querría" ser más ancha que la de abajo. */
  desborda: boolean;
  segmentos: SegmentoDia1[];
}

export function barraDia1(p: {
  pieCLP: number;
  gastosCompraCLP: number;
  capexCLP: number;
  inversionInicial: number;
  patrimonio: number;
}): BarraDia1 {
  // Invariante del módulo: en desarrollo avisa si los tres montos no suman el día 1.
  if (process.env.NODE_ENV !== "production") {
    const aviso = avisoDia1(p);
    if (aviso) console.warn(aviso);
  }
  const total = Math.max(0, p.inversionInicial);
  const ratio = p.patrimonio > 0 && total > 0 ? total / p.patrimonio : 0;
  const partes: [TonoDia1, number][] = [
    ["pie", Math.max(0, p.pieCLP)],
    ["gastos", Math.max(0, p.gastosCompraCLP)],
    ["capex", Math.max(0, p.capexCLP)],
  ];
  // Sin CapEx (antigüedad ≤ 2) o sin pie (pie cero) el segmento no existe: dos barras, no tres.
  const suma = partes.reduce((a, [, v]) => a + v, 0);
  const segmentos: SegmentoDia1[] = partes
    .filter(([, v]) => v > 0)
    .map(([tono, v]) => ({ tono, pct: suma > 0 ? (v / suma) * 100 : 0, montoCLP: v }));
  return {
    anchoPct: Math.max(0, Math.min(100, ratio * 100)),
    desborda: ratio > 1,
    segmentos,
  };
}
