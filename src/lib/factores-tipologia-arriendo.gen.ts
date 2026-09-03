// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/derivar-factores-tipologia-arriendo.ts
// Verificar vigencia (falla si un factor se movió > TOLERANCIA_FACTOR_PTS):
//   node --env-file=.env.local --import tsx scripts/data/derivar-factores-tipologia-arriendo.ts --check
//
// Factores por tipología del estimador comunal de arriendo (ver
// `referencia-arriendo.ts`, fuente 'comunalPorM2'). El UF/m²/mes comunal lo
// domina el 1D, que renta más por metro; sin factor, el estimado de un 3D o
// un 4D sale inflado de forma sistemática. `factor` centra el estimado y
// `errorResidualPct` es el ancho del rango que se publica con él.

export type DormsTipologia = 1 | 2 | 3 | 4;

export interface FactorTipologiaArriendo {
  /** Multiplica al estimado crudo (UF/m² comunal × sup. mediana de venta × UF). */
  factor: number;
  /** Percentil 75 de |estimado corregido / real − 1| entre las tipologías con muestra, %. */
  errorResidualPct: number;
  /** Tipologías (comuna × dorms) con muestra que respaldan el factor. */
  n: number;
  /** Si no hubo filas suficientes para calibrar sola, de qué tipología heredó el factor. */
  heredadoDe: DormsTipologia | null;
}

export const FACTORES_TIPOLOGIA_ARRIENDO: Record<DormsTipologia, FactorTipologiaArriendo> = {
  1: { factor: 1.046, errorResidualPct: 6.3, n: 16, heredadoDe: null },
  2: { factor: 0.935, errorResidualPct: 11.7, n: 17, heredadoDe: null },
  3: { factor: 0.878, errorResidualPct: 16.1, n: 16, heredadoDe: null },
  4: { factor: 0.878, errorResidualPct: 16.1, n: 2, heredadoDe: 3 },
};

/** De dónde salen los factores. Cambia en cada re-derivación. */
export const PROCEDENCIA_FACTORES_TIPOLOGIA = {
  fecha: "2026-09-03",
  metodo: "mediana entre comunas del roster de (mediana real de arriendo de la tipología) / (UF/m²/mes comunal × sup. mediana de venta × UF)",
  filas: 51,
  comunas: 20,
  minArriendosTipologia: 20,
  minVentasTipologia: 20,
  percentilError: 75,
} as const;
