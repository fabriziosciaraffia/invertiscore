// ─────────────────────────────────────────────────────────────────────────────
// Referencia de arriendo por tipología — FUENTE ÚNICA de la jerarquía.
//
// Principio: un informe (y una página de comuna) nunca dice "sin datos" cuando
// hay una referencia honesta calculable. Pero la referencia degradada SIEMPRE
// se nombra como tal: el tipo es discriminado por `fuente` y ningún consumidor
// puede leer el número sin leer de dónde salió. El motor emite el dato con su
// procedencia; el copy lo redacta en cada superficie.
//
// Jerarquía (constantes con nombre, abajo):
//   1. porTipologia  — mediana de arriendos de ESA tipología en la comuna, con
//                      al menos MIN_ARRIENDOS_TIPOLOGIA avisos.
//   2. comunalPorM2  — la tipología no junta muestra pero la comuna sí:
//                      UF/m²/mes comunal (todas las tipologías juntas) ×
//                      superficie mediana de VENTA de la tipología × factor por
//                      tipología. Sale como RANGO, no como punto.
//   3. insuficiente  — ni la comuna junta muestra. Acá sí se dice "sin dato".
//
// POR QUÉ HAY FACTOR. El UF/m² comunal lo domina la tipología con más avisos
// (casi siempre el 1D), que renta más por metro que un 3D o un 4D. Medido el
// 03-sep-2026 sobre las 51 tipologías del roster que sí tienen muestra, el
// estimador sin corregir daba error mediano −4% en 1D, +7% en 2D, +14% en 3D
// y +20% en 4D: sesgo sistemático, no ruido, y justo sobre las tipologías que
// el fallback rescata (15 de las 28 filas rescatables son 3D o 4D). El factor
// lo centra; el error residual que queda es el ancho del rango. Los dos viven
// en `factores-tipologia-arriendo.gen.ts` con su procedencia (fecha, n, método)
// y se re-derivan con `scripts/data/derivar-factores-tipologia-arriendo.ts`,
// cuyo `--check` falla si un factor se movió más de TOLERANCIA_FACTOR_PTS.
//
// HISTÉRESIS (solo página de comuna). Peñalolén junta exactamente 15 arriendos:
// con un umbral seco, un aviso menos la saca de la tabla y la semana siguiente
// la vuelve a meter, y la prosa persistida queda narrando filas que ya no
// están. La página ENTRA con MIN_ARRIENDOS_COMUNAL_ENTRA y se MANTIENE con
// MIN_ARRIENDOS_COMUNAL_MANTIENE, leyendo "publicaba" del snapshot de la prosa.
// El informe LTR no tiene snapshot: usa el umbral de entrada, seco.
// ─────────────────────────────────────────────────────────────────────────────

import { median } from "@/lib/comuna-stats";
import {
  FACTORES_TIPOLOGIA_ARRIENDO,
  type DormsTipologia,
  type FactorTipologiaArriendo,
} from "@/lib/factores-tipologia-arriendo.gen";

/** Arriendos publicados de la tipología para que su mediana sea la referencia. */
export const MIN_ARRIENDOS_TIPOLOGIA = 20;
/** Arriendos de la comuna (todas las tipologías) para ENTRAR al estimado por m². */
export const MIN_ARRIENDOS_COMUNAL_ENTRA = 15;
/** Arriendos de la comuna para MANTENER un estimado que ya se publicaba (histéresis). */
export const MIN_ARRIENDOS_COMUNAL_MANTIENE = 10;
/** Puntos (×100) que puede moverse un factor re-derivado antes de que `--check` falle. */
export const TOLERANCIA_FACTOR_PTS = 5;
/** Filas mínimas para que una tipología calibre su propio factor; bajo eso hereda. */
export const MIN_FILAS_FACTOR = 5;
/** El estimado y su rango se publican redondeados a miles: más precisión sería falsa. */
const REDONDEO_CLP = 1000;

export type MotivoInsuficiente =
  /** La comuna no junta arriendos para el estimado (bajo el umbral que aplique). */
  | "comunal-bajo-umbral"
  /** No hay superficie mediana de venta de la tipología con que escalar el m². */
  | "sin-superficie-de-referencia"
  /** La comuna tiene avisos pero ninguno con superficie: no hay UF/m² comunal. */
  | "sin-uf-m2-comunal";

export type ReferenciaArriendo =
  | {
      fuente: "porTipologia";
      /** Arriendos publicados de la tipología. */
      n: number;
      /** Mediana de arriendo mensual, CLP. */
      medianaCLP: number;
    }
  | {
      fuente: "comunalPorM2";
      /** Arriendos de la comuna (todas las tipologías) detrás del UF/m². */
      nComunal: number;
      /** UF/m²/mes comunal, todas las tipologías juntas. */
      ufM2Mes: number;
      /** Superficie mediana de VENTA de la tipología, m². */
      superficieRefM2: number;
      /** Factor por tipología aplicado (ver `.gen.ts`). */
      factorTipologia: number;
      /** Ancho del rango: percentil 75 del error residual de la tipología, %. */
      errorResidualPct: number;
      /** Punto central, CLP redondeado a miles. Úsalo para calcular; publica el rango. */
      estimadoCLP: number;
      /** estimado ∓ error residual, CLP redondeados a miles. */
      rangoCLP: { min: number; max: number };
    }
  | {
      fuente: "insuficiente";
      nComunal: number;
      motivo: MotivoInsuficiente;
    };

export interface InsumosReferenciaArriendo {
  /** Dormitorios de la tipología (fuera de 1..4 se acota al borde). */
  dorms: number;
  /** Arriendos de la tipología en la comuna: n y mediana (0 si no hay). */
  tipologia: { n: number; medianaCLP: number };
  /** Arriendos de la comuna completa: n y UF/m²/mes pooled (0 si no hay). */
  comunal: { n: number; ufM2Mes: number };
  /** Superficie mediana de venta de la tipología, m². null si no hay ventas. */
  superficieRefM2: number | null;
  ufCLP: number;
  /**
   * Histéresis: la tipología ya se publicaba con estimado comunal (leído del
   * snapshot de la prosa). Solo la página de comuna lo pasa; el informe no.
   */
  publicabaAntes?: boolean;
}

/** Umbral comunal vigente: entrada seca o mantención con histéresis. */
export function umbralComunal(publicabaAntes: boolean): number {
  return publicabaAntes ? MIN_ARRIENDOS_COMUNAL_MANTIENE : MIN_ARRIENDOS_COMUNAL_ENTRA;
}

/** Factor de la tipología. Dorms fuera de 1..4 se acotan al borde (5D usa el 4D). */
export function factorParaDorms(dorms: number): FactorTipologiaArriendo {
  const d = Math.min(4, Math.max(1, Math.round(dorms))) as DormsTipologia;
  return FACTORES_TIPOLOGIA_ARRIENDO[d];
}

function aMiles(x: number): number {
  return Math.round(x / REDONDEO_CLP) * REDONDEO_CLP;
}

/**
 * UF/m²/mes mediano de un conjunto de arriendos (todas las tipologías juntas).
 * Misma fórmula que el UF/m² por segmento de comunas-seo; acá sin segmentar.
 * Ignora filas sin superficie. Devuelve 0 si no queda ninguna.
 */
export function medianaArriendoUFm2Mes(
  rows: ReadonlyArray<{ precio: number; superficie_m2: number | null }>,
  ufCLP: number,
): number {
  if (!(ufCLP > 0)) return 0;
  const vals: number[] = [];
  for (const r of rows) {
    const sup = Number(r.superficie_m2);
    const precio = Number(r.precio);
    if (sup > 0 && precio > 0) vals.push(precio / sup / ufCLP);
  }
  return vals.length ? median(vals) : 0;
}

/**
 * Resuelve la referencia de arriendo de una tipología. Pura: todo lo que
 * necesita viene en `ins`. Devuelve SIEMPRE una variante; el "sin dato" es
 * `insuficiente` con motivo, nunca null.
 */
export function resolverReferenciaArriendo(ins: InsumosReferenciaArriendo): ReferenciaArriendo {
  if (ins.tipologia.n >= MIN_ARRIENDOS_TIPOLOGIA && ins.tipologia.medianaCLP > 0) {
    return { fuente: "porTipologia", n: ins.tipologia.n, medianaCLP: Math.round(ins.tipologia.medianaCLP) };
  }

  const nComunal = ins.comunal.n;
  if (nComunal < umbralComunal(ins.publicabaAntes === true)) {
    return { fuente: "insuficiente", nComunal, motivo: "comunal-bajo-umbral" };
  }
  if (!(ins.comunal.ufM2Mes > 0)) {
    return { fuente: "insuficiente", nComunal, motivo: "sin-uf-m2-comunal" };
  }
  const sup = ins.superficieRefM2;
  if (sup === null || !(sup > 0) || !(ins.ufCLP > 0)) {
    return { fuente: "insuficiente", nComunal, motivo: "sin-superficie-de-referencia" };
  }

  const f = factorParaDorms(ins.dorms);
  const crudo = ins.comunal.ufM2Mes * sup * ins.ufCLP;
  const estimado = crudo * f.factor;
  const err = f.errorResidualPct / 100;
  return {
    fuente: "comunalPorM2",
    nComunal,
    ufM2Mes: ins.comunal.ufM2Mes,
    superficieRefM2: sup,
    factorTipologia: f.factor,
    errorResidualPct: f.errorResidualPct,
    estimadoCLP: aMiles(estimado),
    rangoCLP: { min: aMiles(estimado * (1 - err)), max: aMiles(estimado * (1 + err)) },
  };
}

/** Arriendo mensual con que CALCULAR (mediana o punto central), o null si no hay. */
export function arriendoDeReferencia(ref: ReferenciaArriendo): number | null {
  switch (ref.fuente) {
    case "porTipologia":
      return ref.medianaCLP;
    case "comunalPorM2":
      return ref.estimadoCLP;
    case "insuficiente":
      return null;
  }
}
