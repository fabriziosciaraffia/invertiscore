// Hallazgo tipado de ESTRUCTURA_COSTOS_STR (cost-stack como % del bruto) — motor
// determinístico STR. SOLO-LECTURA: decisividad 0 fija. Es una DESCOMPOSICIÓN de lo que
// rentabilidad_str (CAP) y flujo_str ya reportan como resultado — no un eje propio del
// score, por eso no compite en el ranking. Envuelve (base.costosOperativos +
// base.comisionMensual) / base.ingresoBrutoMensual (short-term-engine.ts:882-884, :664) SIN
// recalcular. Cortes 30/40 fundados en el sweep (of-e1a-piramide-str.md §Fase 2).

import type { HallazgoEstructuraCostosStr } from "./types";

export const COSTOS_STR_BANDA_FAV_PCT = 30; // < 30% ⇒ cost-stack sano
export const COSTOS_STR_BANDA_ADV_PCT = 40; // > 40% ⇒ se come más de 4 de cada 10 pesos brutos
export const COSTOS_STR_BANDA_PTS = 15;     // normalización de magnitudContinua

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct0 = (n: number) => Math.round(n).toString();

/**
 * Construye el proto-hallazgo de ESTRUCTURA_COSTOS_STR. SOLO-LECTURA (decisividad 0).
 * Devuelve null si el cost-stack no es computable. Voz: tuteo neutro chileno.
 */
export function buildHallazgoEstructuraCostosStr(p: {
  /** Cost-stack como fracción del bruto: (costosOperativos+comisión)/ingresoBrutoMensual. */
  costStackPct: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoEstructuraCostosStr | null {
  if (!Number.isFinite(p.costStackPct)) return null;

  const cs = p.costStackPct * 100;
  const alto = cs > COSTOS_STR_BANDA_ADV_PCT;
  const sano = cs < COSTOS_STR_BANDA_FAV_PCT;
  const direccion: "favorable" | "adverso" = alto ? "adverso" : "favorable";
  const magnitudContinua = clamp01(Math.abs(cs - COSTOS_STR_BANDA_ADV_PCT) / COSTOS_STR_BANDA_PTS);
  const csFmt = pct0(cs);

  let titular: string;
  let fraseCanonica: string;
  if (alto) {
    titular = "Los costos se comen buena parte del bruto.";
    fraseCanonica =
      `Entre comisión, gastos comunes, servicios y mantención, esta operación se lleva ${csFmt} de cada 100 pesos ` +
      `que factura. Está sobre el borde alto de lo típico en corto; cada punto que bajes de comisión o servicios va directo a tu flujo.`;
  } else if (sano) {
    titular = "La estructura de costos es eficiente.";
    fraseCanonica =
      `Los costos se llevan solo ${csFmt} de cada 100 pesos brutos — bajo lo típico en corto. La estructura ` +
      `operativa deja buena parte del bruto para cubrir la cuota y tu flujo.`;
  } else {
    titular = "Los costos están dentro de lo típico.";
    fraseCanonica =
      `Los costos se llevan ${csFmt} de cada 100 pesos brutos — dentro de la banda típica en corto. Cada punto ` +
      `que bajes de comisión o servicios va directo a tu flujo.`;
  }

  return {
    id: "estructura_costos_str",
    tipo: "cost_stack",
    valor: {
      costStackPct: Math.round(cs),
      bandaFavPct: COSTOS_STR_BANDA_FAV_PCT,
      bandaAdvPct: COSTOS_STR_BANDA_ADV_PCT,
      banda: COSTOS_STR_BANDA_PTS,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: 0, // SOLO-LECTURA
    magnitudContinua,
    procedencia: {
      base: "costos operativos + comisión sobre los ingresos brutos del escenario base; banda típica de mercado, no medida por comuna",
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
