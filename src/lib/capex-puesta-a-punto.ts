// CapEx de "puesta a punto" para deptos usados — motor determinístico.
//
// Comprar un usado y captar arriendo DE MERCADO suele exigir una puesta a punto
// (pintura, pisos, cocina/baño) que escala con la antigüedad. El motor lo modela
// como CapEx upfront 100% equity (no financiado) que suma a la inversión inicial.
//
// NO es flipping ni reno integral: es dejar el depto en estándar de arriendo.
// Por eso el techo de la curva (9 UF/m²) queda MUY por debajo de la banda de
// reno integral (15–25 UF/m²). Anclas de calibración: usado típico ~5 UF/m²
// (referencias de mercado Santiago); integral 15–25 UF/m² = techo que NO se cruza.

import type { HallazgoPuestaAPunto } from "./types";

/**
 * Costo de puesta a punto en UF/m² (sobre superficie útil) según antigüedad.
 * Misma forma escalonada que getMantencionRate. Valores = punto medio de las
 * bandas calibradas; son un PISO estimado, no un presupuesto cerrado.
 */
export function getPuestaAPuntoUfM2(antiguedad: number): number {
  if (antiguedad <= 2) return 0; // depto nuevo / casi nuevo — sin puesta a punto
  if (antiguedad <= 7) return 1.5;
  if (antiguedad <= 15) return 3.5;
  if (antiguedad <= 25) return 6.0;
  return 9.0; // techo: estándar de arriendo, NUNCA reno integral (15–25 UF/m²)
}

export interface CapexPuestaAPunto {
  montoCLP: number;
  montoUF: number;
  ufM2: number;
  origen: "derivado" | "override";
}

/**
 * Calcula el CapEx de puesta a punto. Determinístico desde la antigüedad
 * (curva) o desde un override explícito del usuario. Usa el MISMO valorUF que
 * el motor — no introduce otra fuente de UF.
 */
export function calcCapexPuestaAPunto(p: {
  antiguedad: number;
  superficieUtilM2: number;
  valorUF: number;
  overrideCLP?: number | null;
}): CapexPuestaAPunto {
  if (p.overrideCLP != null && p.overrideCLP > 0) {
    const montoCLP = Math.round(p.overrideCLP);
    const montoUF = p.valorUF > 0 ? Math.round((montoCLP / p.valorUF) * 10) / 10 : 0;
    const ufM2 = p.superficieUtilM2 > 0 ? Math.round((montoUF / p.superficieUtilM2) * 100) / 100 : 0;
    return { montoCLP, montoUF, ufM2, origen: "override" };
  }
  const ufM2 = getPuestaAPuntoUfM2(p.antiguedad);
  const montoUF = ufM2 * p.superficieUtilM2;
  const montoCLP = Math.round(montoUF * p.valorUF);
  return { montoCLP, montoUF: Math.round(montoUF * 10) / 10, ufM2, origen: "derivado" };
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
  // true cuando la antigüedad de entrada NO es dato real del usuario sino un
  // fallback (hoy: STR, donde el form no captura antigüedad y el pipeline la
  // hardcodea usado=5). Degrada la confianza de la procedencia.
  antiguedadEsFallback?: boolean;
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

  const fraseCanonica =
    `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
    `considera unos UF ${ufFmt} (${clpFmt}) de puesta a punto — cerca del ${pct}% ` +
    `de tu inversión inicial. No es flipping: es dejarlo en estándar de arriendo.`;

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
    },
    direccion: p.capex.montoUF > 0 ? "adverso" : "neutral",
    decisividad: p.decisividad,
    procedencia: { base, confianza },
    fraseCanonica,
  };
}
