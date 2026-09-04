// ============================================================================
// DECISIVIDAD REAL STR — espejo de calcDecisividades (LTR, analysis.ts).
// ============================================================================
// Hasta el 03-sep-2026 la decisividad de los 4 hallazgos "decisivos" del corto se
// INYECTABA desde el desglose del score (|dimScore − 50| / 50) y los demás iban en 0.
// Eso no medía nada: `ocupacion_vs_estimacion` heredaba la dimensión factibilidad, que no
// lee la ocupación en ningún término, y `estructura_financiamiento` valía 0 fijo
// aunque el pie mueva el dividendo, el flujo y los gates. Medido sobre el parque
// (243 filas): el top-4 era siempre el mismo cuarteto y solo el 49% de los informes
// tenía algún hallazgo sobre el piso 0,85 (LTR: 89%).
//
// CONTRATO (idéntico a LTR, mismas constantes importadas de analysis.ts):
//   · se recomputa la base, se aplica UN parche que lleva el hallazgo a su neutro y se
//     vuelve a puntuar: decisividad = clamp01(|Δscore| / 25);
//   · elevada a 0,85 si la neutralización FLIPEA el veredicto o DESARMA un gate activo
//     (gate1 / gate2 que disparaba en base y deja de disparar);
//   · `magnitud` conserva el Δscore crudo como desempate del orden único.
//
// Siete tienen neutralización con knob real en el motor; los seis informativos
// (`INFORMATIVOS_STR`) quedan en 0 DECLARADO en su builder, no por omisión.
// Ausente en el resultado ⇒ hallazgo no aplicable (sin CapEx, sin mediana, sin
// comparativa), igual que en LTR.
//
// Costo medido: 0,04 a 0,14 ms por recompute completo; ~47 por análisis (la bisección
// del cap rate domina) ⇒ del orden de 5 ms.

import type { ShortTermResult } from "./engines/short-term-engine";
import { COMISION_LTR } from "./engines/short-term-engine";
import type { FrancoScoreSTR } from "./engines/short-term-score";
import {
  francoScoreStrDeResultado,
  recomputeStrConPatch,
  type VeredictoStrCtx,
} from "./analysis/veredicto-str-con-patch";
import {
  DECISIVIDAD_DIVISOR,
  DECISIVIDAD_FLOOR,
  NEUTRAL_PIE_PCT,
  type DecisividadFactor,
} from "./analysis";
import { CAP_STR_UMBRAL_PCT } from "./rentabilidad-str-hallazgo";
import { MARKET_AVG_TASA_UF } from "./financing-health";
import { calcCapexPuestaAPunto } from "./capex-puesta-a-punto";
import { resolverModeloCostos } from "./modelo-costos";
import { metricaValor } from "./types";

/** Decisividad calibrada por hallazgo STR. Ausente ⇒ hallazgo no aplicable. */
export interface DecisividadesSTR {
  rentabilidad_str?: DecisividadFactor;
  flujo_str?: DecisividadFactor;
  ocupacion_vs_estimacion?: DecisividadFactor;
  ventaja_vs_ltr?: DecisividadFactor;
  sobreprecio?: DecisividadFactor;
  estructura_financiamiento?: DecisividadFactor;
  capex_puesta_a_punto?: DecisividadFactor;
}

/** Informativos puros del corto: sin input propio que llevar al neutro. 0 declarado.
 *  `plusvalia` es informativo SOLO en STR: el motor del corto proyecta con la tasa global
 *  y nunca lee la histórica comunal, así que neutralizarla no mueve nada (en LTR sí es
 *  una dimensión del score). */
export const INFORMATIVOS_STR = [
  "plusvalia",
  "tir",
  "patrimonio",
  "sensibilidad_str",
  "estructura_costos_str",
  "distancia_veredicto",
] as const;

export interface DecisividadesStrExtras {
  comuna: string;
  /** Mediana comunal de venta UF/m² ya resuelta (sobreprecio); null ⇒ no aplicable. */
  medianaUfM2: number | null;
  medianaN: number;
  superficieM2: number;
  valorUF: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Mismo contrato que `decisividadDesde` (LTR): Δscore normalizado, piso si flipea o
 *  desarma un gate. STR no tiene gate 3, así que solo se miran gate1 y gate2. */
function decisividadDesdeStr(base: FrancoScoreSTR, neu: FrancoScoreSTR): DecisividadFactor {
  const magnitud = clamp01(Math.abs(base.score - neu.score) / DECISIVIDAD_DIVISOR);
  const flip = neu.veredicto !== base.veredicto;
  const gateDesarmado =
    (base.gates.gate1 && !neu.gates.gate1) || (base.gates.gate2 && !neu.gates.gate2);
  const decisividad = flip || gateDesarmado ? Math.max(DECISIVIDAD_FLOOR, magnitud) : magnitud;
  return { decisividad, magnitud };
}

/**
 * Busca la tarifa (ADR) que lleva el cap rate del escenario base al umbral STR
 * (neutralización de rentabilidad_str). El cap es monótono creciente en el ADR
 * (ingreso = ADR × occ × 365; NOI = ingreso × (1 − comisión) − costos) → bisección.
 */
function solveAdrForCapRate(ctx: VeredictoStrCtx, adrRef: number, targetCapDec: number): number {
  let lo = 1;
  let hi = Math.max(adrRef * 10, 1_000_000);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const { result } = recomputeStrConPatch(ctx, { adrOverride: Math.round(mid) });
    if (result.escenarios.base.capRate < targetCapDec) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Calcula la decisividad calibrada de los (hasta) 7 hallazgos STR con knob. Recibe el
 * mismo `ctx` que produjo el veredicto (una sola ruta, sin divergencia) y, opcionalmente,
 * la base ya computada por el caller con ese mismo ctx — si no viene, la recomputa.
 */
export function calcDecisividadesSTR(
  ctx: VeredictoStrCtx,
  extras: DecisividadesStrExtras,
  precomputada?: { result: ShortTermResult; francoScore: FrancoScoreSTR },
): DecisividadesSTR {
  const base = precomputada ?? recomputeStrConPatch(ctx, {});
  const r = base.result;
  const fsBase = base.francoScore;
  const b = r.escenarios?.base;
  const out: DecisividadesSTR = {};
  if (!b) return out;
  const fin = (fsNeu: FrancoScoreSTR) => decisividadDesdeStr(fsBase, fsNeu);
  const inp = ctx.inputs;

  // ── rentabilidad_str: la tarifa que deja el cap rate en el umbral (5,0%). Mueve
  //    también flujo, ventaja y gates: es el mismo driver, igual que en LTR el arriendo
  //    neutralizado del cap rate arrastra el flujo. ──
  const adrRef = r.ejesAplicados?.adrFinal;
  if (inp.precioCompra > 0 && Number.isFinite(b.capRate) && typeof adrRef === "number" && adrRef > 0) {
    const adrNeu = solveAdrForCapRate(ctx, adrRef, CAP_STR_UMBRAL_PCT / 100);
    out.rentabilidad_str = fin(recomputeStrConPatch(ctx, { adrOverride: adrNeu }).francoScore);
  }

  // ── flujo_str: flujo mensual → 0 y cash-on-cash → 0 a nivel RESULTADO (opción A de
  //    LTR: no le roba el driver a otro hallazgo). Sin motor: solo se vuelve a puntuar
  //    y a evaluar gates sobre el resultado parchado. Con pie cero el CoC 'no_aplica'
  //    se preserva. Igual que LTR, solo con dividendo > 0. ──
  if (r.dividendoMensual > 0 && Number.isFinite(b.flujoCajaMensual)) {
    const baseNeu = {
      ...b,
      flujoCajaMensual: 0,
      cashOnCash: b.cashOnCash.tipo === "no_aplica" ? b.cashOnCash : metricaValor(0),
    };
    const rNeu: ShortTermResult = { ...r, escenarios: { ...r.escenarios, base: baseNeu } };
    out.flujo_str = fin(francoScoreStrDeResultado(ctx, rNeu));
  }

  // ── ocupacion_vs_estimacion (Goal 4): la ocupación del base a la ESTIMACIÓN de mercado
  //    para este depto (occObservada: p50 de la dirección, o el 45% conservador si es
  //    fallback). Sin override el base YA es la estimación ⇒ Δscore 0 ⇒ decisividad 0 por
  //    neutralización: el hallazgo no corona. Con override mide cuánto del veredicto
  //    descansa en el supuesto del usuario. ──
  if (Number.isFinite(b.ocupacionReferencia)) {
    const estimacion = typeof r.occObservada === "number" && r.occObservada > 0 && r.occObservada <= 1 ? r.occObservada : b.ocupacionReferencia;
    out.ocupacion_vs_estimacion = fin(recomputeStrConPatch(ctx, { occOverride: estimacion }).francoScore);
  }

  // ── ventaja_vs_ltr: sobre-renta → 0. El NOI del largo es lineal en el arriendo
  //    (comisión fija, GGCC, mantención y contribuciones/3 fijos), así que el arriendo
  //    neutro sale en forma cerrada: el que iguala el NOI del corto. ──
  if (r.comparativa && Number.isFinite(b.noiMensual)) {
    const fijos = (inp.gastosComunes || 0) + (inp.mantencion || 0) + Math.round((inp.contribuciones || 0) / 3);
    const arriendoNeu = Math.max(0, Math.round((b.noiMensual + fijos) / (1 - COMISION_LTR)));
    out.ventaja_vs_ltr = fin(recomputeStrConPatch(ctx, { arriendoLargoMensual: arriendoNeu }).francoScore);
  }

  // ── sobreprecio: precio = mediana comunal × superficie (en CLP, unidad del motor).
  //    Solo con mediana confiable, igual que LTR. ──
  if (extras.medianaUfM2 != null && extras.medianaUfM2 > 0 && extras.medianaN > 0 && extras.superficieM2 > 0 && extras.valorUF > 0) {
    const precioNeu = Math.round(extras.medianaUfM2 * extras.superficieM2 * extras.valorUF);
    out.sobreprecio = fin(recomputeStrConPatch(ctx, { precioCompra: precioNeu }).francoScore);
  }

  // ── estructura_financiamiento: pie → 25% y tasa → min(actual, mercado). El motor STR
  //    lleva la tasa en decimal; MARKET_AVG_TASA_UF está en %. ──
  {
    const tasaNeu = Math.min(inp.tasaCredito, MARKET_AVG_TASA_UF / 100);
    out.estructura_financiamiento = fin(
      recomputeStrConPatch(ctx, { piePercent: NEUTRAL_PIE_PCT / 100, tasaCredito: tasaNeu }).francoScore,
    );
  }

  // ── capex_puesta_a_punto: CapEx → 0. No hay knob directo (override 0 se ignora y cae
  //    a la curva, la misma trampa que LTR resolvió con `neutralize`); en el corto la
  //    antigüedad no alimenta nada más que el CapEx, así que antigüedad 0 sin override
  //    ES el neutro. Δscore siempre 0 (no está en las 4 dims): solo puede desarmar un
  //    gate de cash-on-cash. Solo si hay CapEx. ──
  {
    const capexBase = calcCapexPuestaAPunto({
      antiguedad: inp.antiguedad ?? 0,
      superficieUtilM2: inp.superficie,
      valorUF: inp.valorUF,
      overrideCLP: inp.costoPuestaAPuntoCLP,
      modelo: resolverModeloCostos(inp.methodologyVersion),
    });
    if (capexBase.montoCLP > 0) {
      out.capex_puesta_a_punto = fin(
        recomputeStrConPatch(ctx, { antiguedad: 0, costoPuestaAPuntoCLP: null }).francoScore,
      );
    }
  }

  return out;
}
