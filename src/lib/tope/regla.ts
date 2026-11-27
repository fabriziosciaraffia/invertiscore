// ─────────────────────────────────────────────────────────────────────────────
// LA REGLA DEL TOPE, UNA SOLA (decisión de Fabrizio, 27-nov-2026): la asesoría en el mapa e Invierte con Franco calculan hasta cuánto
// puede comprar una persona con ESTA cuenta, y ninguna otra. Sin dependencias: la usan capacidad.ts (asesoría) y perfil.ts (Invierte).
//   · El crédito que cabe en la renta: dividendo ≤ 25 % de la renta computable y dividendo + otras cuotas ≤ la carga máxima (40 %, o
//     35 % si hay boletas), al plazo que la edad permite (edad + plazo ≤ 75, tope 30), con la tasa del motor y sin seguros.
//   · LOS GASTOS DE LA COMPRA salen del bolsillo además del pie (camino «usado»: 4,4 % del precio). Por eso:
//       tope por pie   = pie ÷ (pie % + gastos %)            → UF 600 ÷ 24,4 % = UF 2.459
//       tope por renta = (pie + crédito) ÷ (1 + gastos %)    → lo que hay (pie + crédito) paga el precio y los gastos
//       sin pie (menos de UF 300 o «Todavía no sé»): crédito ÷ 80 %, y el pie que hace falta es ese precio × 24,4 %.
//   · Gana el menor. Cada camino tiene su regla de pie y sus gastos; hoy existe uno solo.
// Lo fijan los tiers ASESORIA e INVIERTE-V2-E2.
// ─────────────────────────────────────────────────────────────────────────────

/** LOS CAMINOS DEL PIE. Usado: 20 % de pie al contado y 4,4 % de gastos —
 *    · ~2 % en trámites del crédito: impuesto de timbres y estampillas (0,8 % del crédito), notaría, conservador de bienes raíces,
 *      tasación y estudio de títulos;
 *    · 2,38 % de comisión de Franco (2 % + IVA). Se incluye aunque solo se pague si compra con Franco: es lo conservador.
 *  Un camino «nuevo» (pie en cuotas, bono pie) tendrá su propia regla de pie y sus propios gastos, sin comisión. */
export const CAMINOS = {
  usado: { piePct: 20, gastosPct: 4.4, forma: "contado" },
} as const;
export type Camino = keyof typeof CAMINOS;
export const CAMINO_DE_HOY: Camino = "usado";

export const DIVIDENDO_MAX_PCT = 25;
export const RENTA_COMPUTABLE_PCT = { contrato: 100, boletas: 70, ambas: 85 } as const;
export const CARGA_MAX_PCT = { contrato: 40, boletas: 35, ambas: 35 } as const;
export type TipoRenta = keyof typeof RENTA_COMPUTABLE_PCT;
export const PLAZO_MAX = 30;
export const EDAD_MAS_PLAZO_MAX = 75;
export const VERSION_REGLA = 2;

/** Lo que el pie tiene que cubrir, en % del precio: el pie del camino más sus gastos. */
export const pieMasGastosPct = (camino: Camino = CAMINO_DE_HOY): number => CAMINOS[camino].piePct + CAMINOS[camino].gastosPct;

/** La cuota de un crédito (sistema francés, sin seguros): la misma fórmula que calcDividendo. */
export function cuota(creditoCLP: number, tasaPct: number, plazoAnios: number): number {
  if (creditoCLP <= 0) return 0;
  const i = tasaPct / 100 / 12, n = plazoAnios * 12;
  return i === 0 ? creditoCLP / n : (creditoCLP * i) / (1 - Math.pow(1 + i, -n));
}
/** El crédito que paga una cuota (la inversa). */
export function creditoDeCuota(cuotaCLP: number, tasaPct: number, plazoAnios: number): number {
  if (cuotaCLP <= 0) return 0;
  const i = tasaPct / 100 / 12, n = plazoAnios * 12;
  return i === 0 ? cuotaCLP * n : (cuotaCLP * (1 - Math.pow(1 + i, -n))) / i;
}

export interface CreditoPorRenta { creditoUF: number; cuotaMaxCLP: number; rentaComputableCLP: number; cargaMaxPct: number; limitanDeudas: boolean }

/** El crédito que cabe en la renta. */
export function creditoPorRentaRegla(p: { rentaCLP: number; tipoRenta?: TipoRenta; otrasCuotasCLP?: number; plazoAnios?: number; tasaPct: number; uf: number }): CreditoPorRenta {
  const tipo = p.tipoRenta ?? "contrato";
  const rentaComp = (p.rentaCLP * RENTA_COMPUTABLE_PCT[tipo]) / 100;
  const cargaMax = CARGA_MAX_PCT[tipo];
  const porDividendo = (rentaComp * DIVIDENDO_MAX_PCT) / 100;
  const cuotaMax = Math.max(0, Math.min(porDividendo, (rentaComp * cargaMax) / 100 - Math.max(0, p.otrasCuotasCLP ?? 0)));
  const creditoUF = p.uf > 0 ? creditoDeCuota(cuotaMax, p.tasaPct, p.plazoAnios ?? PLAZO_MAX) / p.uf : 0;
  return { creditoUF, cuotaMaxCLP: cuotaMax, rentaComputableCLP: rentaComp, cargaMaxPct: cargaMax, limitanDeudas: cuotaMax < porDividendo };
}

export interface TopesDeCompra {
  /** Por la renta: (pie + crédito) ÷ (1 + gastos), o crédito ÷ 80 % sin pie. null sin crédito conocido. Sin redondear. */
  topeRentaUF: number | null;
  /** Por el pie: pie ÷ (pie % + gastos %). null sin pie. Sin redondear. */
  topePieUF: number | null;
  /** El menor (sin redondear); 0 si no hay con qué comprar. */
  topeUF: number;
  limita: "pie" | "renta" | null;
}

/** LOS DOS TOPES Y EL MENOR. `creditoUF` null = no se conoce la renta (solo pie). */
export function topesDeCompra(p: { pieUF: number | null; creditoUF: number | null; camino?: Camino }): TopesDeCompra {
  const c = CAMINOS[p.camino ?? CAMINO_DE_HOY];
  const g = c.gastosPct / 100, f = c.piePct / 100;
  const pie = p.pieUF == null ? null : Math.max(0, p.pieUF);
  const topePie = pie == null ? null : pie / (f + g);
  const topeRenta = p.creditoUF == null ? null : pie == null ? p.creditoUF / (1 - f) : (pie + p.creditoUF) / (1 + g);
  if (topePie == null && topeRenta == null) return { topeRentaUF: null, topePieUF: null, topeUF: 0, limita: null };
  if (topeRenta == null) return { topeRentaUF: null, topePieUF: topePie, topeUF: topePie!, limita: "pie" };
  if (topePie == null) return { topeRentaUF: topeRenta, topePieUF: null, topeUF: topeRenta, limita: "renta" };
  return { topeRentaUF: topeRenta, topePieUF: topePie, topeUF: Math.min(topePie, topeRenta), limita: topePie <= topeRenta ? "pie" : "renta" };
}

/** El pie (con los gastos) que hace falta para comprar a un precio. */
export const pieNecesarioUF = (precioUF: number, camino: Camino = CAMINO_DE_HOY): number => (precioUF * pieMasGastosPct(camino)) / 100;
