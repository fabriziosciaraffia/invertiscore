// ─────────────────────────────────────────────────────────────────────────────
// UN AJUSTAR SIN CAMINO REALISTA A COMPRAR ES UN BUSCAR OTRO (25-sep-2026)
//
// Decisión de Fabrizio. Un Ajustar promete que hay algo posible que ajustar. Cuando hasta el
// camino más fácil a Comprar pide más de 20% de descuento, esa promesa no se sostiene, y el caso
// pasa a Buscar otro.
//
// LA REGLA. Si el veredicto es AJUSTA SUPUESTOS y la combinación que pide MENOS descuento para
// llegar a Comprar —la grilla del mix del hallazgo de distancia: pie hasta el nivel de 30%
// (`DIST_PIE_TOPE_PCT`), plazo hasta 30 años (`MIX_PLAZOS_WIZARD`), descuento hasta el tope de la
// palanca (30% LTR · 25% STR)— pide más de 20%, o NINGUNA celda llega, el veredicto pasa a
// BUSCAR OTRA.
//
// POR QUÉ 20%. Es más del doble del peor promedio de negociación medido: 9,3% en la venta nueva
// de Santiago en plena sobreoferta (TOCTOC, 2023) y entre 5% y 9% en Buenos Aires con operaciones
// cerradas. Un descuento sobre 20% no es una negociación difícil: es otro precio.
//
// POR QUÉ NO SE TOCA LA ZONA GRIS (10%-20%). Ahí la respuesta depende de un dato que no está: cuánto
// se negocia de verdad en el usado de Santiago hoy. El 9,3% es de venta nueva en 2023, no de usados
// ahora, y no alcanza para decidir por el usuario. Esos casos siguen en Ajustar con su descuento a
// la vista y su banda de dificultad (`banda-esfuerzo.ts`). Medido el 25-sep-2026 sobre el parque:
// 142 filas LTR (129 deptos) y 14 STR en la zona gris, intactas.
//
// DÓNDE VIVE. DESPUÉS del hallazgo de distancia, nunca dentro de `deriveVeredicto` /
// `evalVeredicto` / `calcFrancoScoreSTR`: todas las sondas del motor —la grilla, las palancas, la
// sensibilidad, las decisividades— pasan por esas funciones, y con el filtro adentro cada sonda
// necesitaría su propia grilla: el filtro se llamaría a sí mismo. Consecuencia aceptada y escrita:
// las sondas siguen viendo el veredicto sin filtrar, que es lo correcto para la pregunta que hacen
// («¿llega a Comprar?»).
//
// LO QUE DEJA EN EL HALLAZGO. Con base Ajustar, el objetivo del hallazgo YA es Comprar, así que las
// palancas y el mínimo fuera de tope que calculó son exactamente los campos «hacia Comprar» que un
// Buscar otro lee. El filtro los copia —sin ellos la card diría «más de un 70% menos de precio»
// en las 52 filas del parque— y marca `porDescuento` con la celda más fácil, que es lo que la card,
// el titular y el capítulo «A qué precio cerrar» citan. `veredictoBase` no se toca: es el veredicto
// del puntaje, y de él cuelga qué grilla es cuál.
//
// Medido el 25-sep-2026 (FASE 0): 34 filas LTR (33 deptos) y 18 STR (18 deptos) cambian; de ellas
// 3 y 8 sin ningún camino. Ninguna seed del golden.
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto, MixPalancas, Veredicto } from "./types";
import { MIX_PLAZOS_WIZARD } from "./mix-palancas";

/** Sobre este descuento, el camino más fácil a Comprar deja de ser un ajuste. */
export const AJUSTAR_DESCUENTO_MAX_PCT = 20;

/** Pie máximo que explora la grilla (el mismo `DIST_PIE_TOPE_PCT`, sin import para no cerrar un ciclo). */
const PIE_TOPE_GRILLA_PCT = 30;

export type CaminoMasFacil = {
  /** Descuento de la celda que pide menos, en %. `null` = ninguna celda llega dentro del tope. */
  descuentoPct: number | null;
  /** Pie y plazo de esa celda; sin camino, los máximos que la grilla probó. */
  piePct: number;
  plazoAnios: number;
  /** El tope de descuento que se exploró (30 LTR · 25 STR): «más de un X%» cuando no hay camino. */
  topePct: number;
};

/**
 * La celda de la grilla que pide menos descuento para llegar a Comprar. Entre iguales, la que pide
 * menos capital extra. Sin celdas que lleguen, `descuentoPct: null` con los máximos probados.
 */
export function caminoMasFacil(
  mix: MixPalancas | null | undefined,
  borde: { piePct: number; plazoAnios: number; pieSeExploro: boolean; topePct: number },
): CaminoMasFacil {
  const celdas = (mix?.celdas ?? []).filter((c) => typeof c.descuentoPct === "number");
  if (celdas.length > 0) {
    const min = celdas.reduce((a, b) =>
      b.descuentoPct! < a.descuentoPct! || (b.descuentoPct === a.descuentoPct && b.costoPtsPrecio < a.costoPtsPrecio) ? b : a,
    );
    return { descuentoPct: min.descuentoPct!, piePct: min.piePct, plazoAnios: min.plazoAnios, topePct: borde.topePct };
  }
  // Sin celdas que lleguen: los máximos que la grilla probó (el pie, si se exploró, hasta el
  // tope; el plazo, hasta el máximo del wizard o el declarado si ya era mayor).
  const piePct = borde.pieSeExploro ? Math.max(borde.piePct, PIE_TOPE_GRILLA_PCT) : borde.piePct;
  const plazoAnios = Math.max(borde.plazoAnios, ...MIX_PLAZOS_WIZARD);
  return { descuentoPct: null, piePct, plazoAnios, topePct: borde.topePct };
}

/**
 * ¿La grilla movió el pie? Se lee de la vía «pie» —se exploró si existe y no está en «noAplica»—,
 * no de `pieEsPalanca`: en STR ese campo es la banda de prioridad del pie, no su exploración, y
 * un pie de 20% que la grilla sí llevó a 30% se leía como «no se movió».
 */
export function pieSeExploro(v: HallazgoDistanciaVeredicto["valor"]): boolean {
  const via = v.vias?.find((x) => x.palanca === "pie");
  return via ? via.estado !== "noAplica" : v.pieEsPalanca === true;
}

/** ¿El camino más fácil deja de ser un ajuste? Sobre 20%, o sin camino. */
export function sinCaminoRealista(c: CaminoMasFacil): boolean {
  return c.descuentoPct == null || c.descuentoPct > AJUSTAR_DESCUENTO_MAX_PCT;
}

/**
 * EL FILTRO. Recibe el veredicto del puntaje y el hallazgo de distancia ya armado; devuelve el
 * veredicto final y el hallazgo con los campos hacia Comprar llenos cuando el filtro actuó. Fuera
 * de Ajustar, o sin hallazgo, no toca nada.
 */
export function filtroAjustarSinCamino(
  veredicto: Veredicto,
  hallazgo: HallazgoDistanciaVeredicto | null,
  borde: { piePct: number; plazoAnios: number },
): { veredicto: Veredicto; hallazgo: HallazgoDistanciaVeredicto | null; cambio: boolean } {
  if (veredicto !== "AJUSTA SUPUESTOS" || !hallazgo) return { veredicto, hallazgo, cambio: false };
  const v = hallazgo.valor;
  if (v.veredictoObjetivo !== "COMPRAR") return { veredicto, hallazgo, cambio: false };
  const camino = caminoMasFacil(v.mixPalancas, {
    piePct: borde.piePct,
    plazoAnios: borde.plazoAnios,
    pieSeExploro: pieSeExploro(v),
    topePct: v.topePct,
  });
  if (!sinCaminoRealista(camino)) return { veredicto, hallazgo, cambio: false };
  return {
    veredicto: "BUSCAR OTRA",
    cambio: true,
    hallazgo: {
      ...hallazgo,
      valor: {
        ...v,
        // Con base Ajustar el objetivo ya era Comprar: sus palancas y su mínimo fuera de tope SON
        // los de «hacia Comprar» que lee un Buscar otro.
        palancasHastaComprar: v.palancas,
        viasHastaComprar: v.vias ?? null,
        palancaHastaComprar: v.palancas[0] ?? null,
        deltaMinimoComprarFueraDeTope: v.palancas.length === 0 ? v.deltaMinimoFueraDeTope : null,
        porDescuento: camino,
      },
    },
  };
}

const pctTexto = (n: number) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")}%`;

/**
 * «Aun con pie de 30% y crédito a 30 años» — «Aun pagando al contado» con pie de 100%, y «Aun sin
 * pie y con crédito a 30 años» con pie 0% (25-sep-2026: «pie de 0%» se leía raro). Con pie 0% no
 * nombra el bono pie: dice el porcentaje, sin asumir de dónde sale.
 */
function aunCon(c: CaminoMasFacil): string {
  if (c.piePct >= 100) return "Aun pagando al contado";
  if (c.piePct === 0) return `Aun sin pie y con crédito a ${c.plazoAnios} años`;
  return `Aun con pie de ${Math.round(c.piePct)}% y crédito a ${c.plazoAnios} años`;
}

/** La distancia de la card de Buscar otro cuando la decidió este filtro (decisión 1 del 25-sep). */
export function distanciaPorDescuento(c: CaminoMasFacil): string {
  const cuanto = c.descuentoPct == null ? `más de un ${Math.round(c.topePct)}%` : `un ${pctTexto(c.descuentoPct)}`;
  return `${aunCon(c)}, llegar a Comprar pediría ${cuanto} menos de precio, y eso es muy difícil.`;
}

/** Pie y plazo de la combinación, para el capítulo «A qué precio cerrar». */
export function combinacionTexto(c: CaminoMasFacil): string {
  if (c.piePct >= 100) return "pagando al contado";
  if (c.piePct === 0) return `sin pie y con crédito a ${c.plazoAnios} años`;
  return `pie de ${Math.round(c.piePct)}% y crédito a ${c.plazoAnios} años`;
}

export const pctCamino = pctTexto;
