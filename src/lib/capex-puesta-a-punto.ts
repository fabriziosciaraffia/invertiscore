// CapEx de "puesta a punto" para deptos usados — motor determinístico.
//
// Comprar un usado y captar arriendo DE MERCADO suele exigir una puesta a punto
// (pintura, grifería, calefont, filtraciones, terminaciones) que escala con la
// antigüedad. El motor lo modela como CapEx upfront 100% equity (no financiado)
// que suma a la inversión inicial.
//
// NO es flipping ni reno integral: es dejar el depto en estándar de arriendo.
// Recalibración sep-2026: la curva previa (1,5 → 9,0 UF/m²) caía en zona de
// remodelación media, no de habilitación para arriendo. Bottom-up chileno
// 2025-26 para 16-25 años: 0,6-1,3 UF/m². La curva v3 es un RANGO [min, max]
// por tramo; el PUNTO (medio) es lo único que entra a inversión inicial,
// cash-on-cash y TIR. Los extremos son display (hallazgo, card, drawer, PDF) y
// no entran a ninguna suma.
//
// La curva legacy se conserva para que los análisis previos recomputen
// byte-idéntico (gate por versión: ver modelo-costos.ts).

import type { HallazgoPuestaAPunto } from "./types";
import type { ModeloCostos } from "./modelo-costos";

/** Rango de puesta a punto en UF/m² útil por tramo de antigüedad (v3). */
export const PUESTA_A_PUNTO_UF_M2: ReadonlyArray<{ hasta: number; min: number; max: number }> = [
  { hasta: 2, min: 0, max: 0 }, // nuevo / casi nuevo — sin puesta a punto
  { hasta: 7, min: 0.2, max: 0.4 },
  { hasta: 15, min: 0.5, max: 0.9 },
  { hasta: 25, min: 1.0, max: 1.6 },
  // 26+: defensivo. El wizard captura antigüedad máxima 25 → hoy inalcanzable
  // en producción; documentado para no dejar el dominio abierto.
  { hasta: Infinity, min: 1.8, max: 2.6 },
];

/**
 * Curva LEGACY (valor único). SOLO para análisis previos al gate por versión.
 * No usar en código nuevo.
 */
export function getPuestaAPuntoUfM2Legacy(antiguedad: number): number {
  if (antiguedad <= 2) return 0;
  if (antiguedad <= 7) return 1.5;
  if (antiguedad <= 15) return 3.5;
  if (antiguedad <= 25) return 6.0;
  return 9.0;
}

export interface RangoUfM2 {
  min: number;
  max: number;
  /** Punto que corre el caso: medio del rango (legacy: el valor único). */
  punto: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Rango UF/m² por antigüedad según el modelo. Legacy colapsa min = max = punto. */
export function getPuestaAPuntoRango(antiguedad: number, modelo: ModeloCostos): RangoUfM2 {
  if (modelo === "legacy") {
    const v = getPuestaAPuntoUfM2Legacy(antiguedad);
    return { min: v, max: v, punto: v };
  }
  const tramo = PUESTA_A_PUNTO_UF_M2.find((t) => antiguedad <= t.hasta) ?? PUESTA_A_PUNTO_UF_M2[PUESTA_A_PUNTO_UF_M2.length - 1];
  return { min: tramo.min, max: tramo.max, punto: round2((tramo.min + tramo.max) / 2) };
}

export interface CapexPuestaAPunto {
  /** PUNTO — lo único que entra a inversión inicial / cash-on-cash / TIR. */
  montoCLP: number;
  montoUF: number;
  ufM2: number;
  /** Extremos del rango — display, NO entran a ninguna suma. Con override o
   *  legacy colapsan al punto. */
  montoMinUF: number;
  montoMaxUF: number;
  montoMinCLP: number;
  montoMaxCLP: number;
  ufM2Min: number;
  ufM2Max: number;
  origen: "derivado" | "override";
}

/**
 * Calcula el CapEx de puesta a punto. Determinístico desde la antigüedad
 * (curva del modelo) o desde un override explícito del usuario. Usa el MISMO
 * valorUF que el motor — no introduce otra fuente de UF.
 */
export function calcCapexPuestaAPunto(p: {
  antiguedad: number;
  superficieUtilM2: number;
  valorUF: number;
  overrideCLP?: number | null;
  modelo: ModeloCostos;
}): CapexPuestaAPunto {
  if (p.overrideCLP != null && p.overrideCLP > 0) {
    const montoCLP = Math.round(p.overrideCLP);
    const montoUF = p.valorUF > 0 ? Math.round((montoCLP / p.valorUF) * 10) / 10 : 0;
    const ufM2 = p.superficieUtilM2 > 0 ? Math.round((montoUF / p.superficieUtilM2) * 100) / 100 : 0;
    // Una cotización real no admite rango: min = max = monto.
    return {
      montoCLP, montoUF, ufM2,
      montoMinUF: montoUF, montoMaxUF: montoUF, montoMinCLP: montoCLP, montoMaxCLP: montoCLP,
      ufM2Min: ufM2, ufM2Max: ufM2,
      origen: "override",
    };
  }
  const rango = getPuestaAPuntoRango(p.antiguedad, p.modelo);
  const montoUFExacto = rango.punto * p.superficieUtilM2;
  const montoCLP = Math.round(montoUFExacto * p.valorUF);
  const minUFExacto = rango.min * p.superficieUtilM2;
  const maxUFExacto = rango.max * p.superficieUtilM2;
  return {
    montoCLP,
    montoUF: Math.round(montoUFExacto * 10) / 10,
    ufM2: rango.punto,
    montoMinUF: Math.round(minUFExacto * 10) / 10,
    montoMaxUF: Math.round(maxUFExacto * 10) / 10,
    montoMinCLP: Math.round(minUFExacto * p.valorUF),
    montoMaxCLP: Math.round(maxUFExacto * p.valorUF),
    ufM2Min: rango.min,
    ufM2Max: rango.max,
    origen: "derivado",
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Construye el proto-hallazgo. Devuelve null cuando no hay CapEx (Nuevo o
 * antigüedad ≤ 2 → montoCLP 0): no se siembra hallazgo.
 *
 * `inversionInicialCLP` debe ser la inversión inicial COMPLETA (pie + cierre +
 * amoblado + este CapEx) — la "plata día 1" — para que la decisividad sea la
 * fracción real que se va a puesta a punto.
 *
 * La fraseCanonica es la línea determinística del motor; la IA la reescribe
 * aguas abajo (skill analysis-voice-franco). Voz: tuteo neutro chileno (§2.1).
 */
export function buildHallazgoPuestaAPunto(p: {
  capex: CapexPuestaAPunto;
  antiguedad: number;
  superficieUtilM2: number;
  modalidad: "ltr" | "str" | "ambas";
  inversionInicialCLP: number;
  // Decisividad calibrada (0..1) inyectada por calcDecisividades (LTR) o por el
  // caller (STR). El builder ya NO la calcula: escala común "Δdecisión" (E2).
  decisividad: number;
  // Magnitud continua pre-floor — desempate secundario del sort (E4).
  magnitudContinua: number;
  // true cuando la antigüedad de entrada NO es dato real del usuario sino un
  // fallback (hoy: STR, donde el form no captura antigüedad y el pipeline la
  // hardcodea usado=5). Degrada la confianza de la procedencia.
  antiguedadEsFallback?: boolean;
  /** Fase 5b · D4: con pie 0 el % sobre la inversión inicial miente (la base se
   *  desploma). true ⇒ la frase y el ksub muestran solo el monto. */
  sinCapitalPropio?: boolean;
}): HallazgoPuestaAPunto | null {
  if (p.capex.montoCLP <= 0) return null;

  // Fracción del capital que va a puesta a punto — SOLO para la frase (pct). La
  // decisividad ya NO sale de acá (viene calibrada a "Δdecisión" en p.decisividad).
  const fraccionInversion = clamp01(
    p.inversionInicialCLP > 0 ? p.capex.montoCLP / p.inversionInicialCLP : 0,
  );
  const pct = Math.round(fraccionInversion * 100);
  const ufFmt = Math.round(p.capex.montoUF).toLocaleString("es-CL");
  const clpFmt = "$" + p.capex.montoCLP.toLocaleString("es-CL");
  // Procedencia honesta: override > antigüedad real (LTR) > fallback gruesa (STR).
  let confianza: "alta" | "media" | "baja";
  let base: string;
  if (p.capex.origen === "override") {
    confianza = "alta";
    base = "override del usuario";
  } else if (p.antiguedadEsFallback) {
    confianza = "baja";
    base = "antigüedad no capturada (STR) — estimación gruesa";
  } else {
    confianza = "media";
    base = "curva por antigüedad";
  }

  // Fase 5b · D4 (mockup 5f7c4f9): con pie 0 el porcentaje MIENTE — la base
  // (inversión inicial) se desploma a gastos de cierre + este mismo CapEx, y el
  // mismo depto salta de 18% (pie 20%) a 71%. El % mide el denominador, no el
  // gasto: se suprime y en su lugar va lo que sí es verdad y propio del caso.
  const fraseCanonica = p.sinCapitalPropio
    ? `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
      `considera unos UF ${ufFmt} (${clpFmt}) de puesta a punto. Sin pie, es la única ` +
      `plata tuya que entra el día uno además de los gastos de cierre. No es remodelar ` +
      `para revender: es dejarlo en estándar de arriendo.`
    : `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
      `considera unos UF ${ufFmt} (${clpFmt}) de puesta a punto — cerca del ${pct}% ` +
      `de tu inversión inicial. No es remodelar para revender: es dejarlo en estándar de arriendo.`;

  const titular =
    p.capex.montoUF > 0
      ? "Necesita puesta a punto antes de arrendar a mercado."
      : "No necesita puesta a punto para arrendar a mercado.";

  return {
    id: "capex_puesta_a_punto",
    tipo: "capex_habilitacion",
    valor: {
      montoCLP: p.capex.montoCLP,
      montoUF: p.capex.montoUF,
      ufM2: p.capex.ufM2,
      antiguedadAnios: p.antiguedad,
      superficieUtilM2: p.superficieUtilM2,
      modalidad: p.modalidad,
      origen: p.capex.origen,
      fraccionInversion,
      ...(p.sinCapitalPropio ? { sinCapitalPropio: true } : {}),
    },
    direccion: p.capex.montoUF > 0 ? "adverso" : "neutral",
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: { base, confianza },
    titular,
    fraseCanonica,
  };
}
