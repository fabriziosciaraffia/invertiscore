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
  // v3: los tres montos UF se redondean a múltiplos de 5 ACÁ (piso 5 UF si hay
  // CapEx) y los CLP se derivan de esos UF, con la misma UF del motor. Así el
  // punto que declara la frase ("Franco corre el caso con UF 30") es exactamente
  // el que entra a la inversión inicial, al cash-on-cash y a la TIR. Antes el
  // redondeo vivía solo en el hallazgo y el motor sumaba el exacto (31,5 UF →
  // 1.287.657 vs UF 30 declarados; prod 9feffbcc). Legacy conserva el exacto a
  // 0,1 UF para no mover informes previos.
  const aUF = (exacto: number) =>
    p.modelo === "v3"
      ? (exacto > 0 ? Math.max(5, Math.round(exacto / 5) * 5) : 0)
      : Math.round(exacto * 10) / 10;
  const montoUF = aUF(rango.punto * p.superficieUtilM2);
  const montoMinUF = aUF(rango.min * p.superficieUtilM2);
  const montoMaxUF = aUF(rango.max * p.superficieUtilM2);
  const aCLP = (uf: number, exacto: number) => Math.round((p.modelo === "v3" ? uf : exacto) * p.valorUF);
  return {
    montoCLP: aCLP(montoUF, rango.punto * p.superficieUtilM2),
    montoUF,
    ufM2: rango.punto,
    montoMinUF,
    montoMaxUF,
    montoMinCLP: aCLP(montoMinUF, rango.min * p.superficieUtilM2),
    montoMaxCLP: aCLP(montoMaxUF, rango.max * p.superficieUtilM2),
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
  /** UF del análisis. Solo para que los extremos CLP del rango salgan de los UF
   *  ya redondeados (UF 10 ⇒ $400.010, no $480.012). Ausente ⇒ extremos exactos. */
  valorUF?: number;
}): HallazgoPuestaAPunto | null {
  if (p.capex.montoCLP <= 0) return null;

  // Fracción del capital que va a puesta a punto — SOLO para la frase (pct). La
  // decisividad ya NO sale de acá (viene calibrada a "Δdecisión" en p.decisividad).
  const fraccionInversion = clamp01(
    p.inversionInicialCLP > 0 ? p.capex.montoCLP / p.inversionInicialCLP : 0,
  );
  const pct = Math.round(fraccionInversion * 100);

  // Rango (v3, derivado): los tres montos UF van a múltiplos de 5 — es una
  // estimación, no una cotización. Override (cotización real) y legacy colapsan
  // min = max y NO se redondean: un rango sobre una cifra exacta es mentira, y
  // los análisis previos deben seguir mostrando su cifra tal cual. Si el
  // redondeo degenera el rango (deptos minúsculos) cae a la frase de valor único.
  const round5 = (v: number) => Math.round(v / 5) * 5;
  const minUF5 = round5(p.capex.montoMinUF);
  const maxUF5 = round5(p.capex.montoMaxUF);
  const esRango = p.capex.origen === "derivado" && p.capex.montoMaxUF > p.capex.montoMinUF && minUF5 > 0 && maxUF5 > minUF5;
  const montoUFDisplay = esRango ? Math.max(minUF5, Math.min(maxUF5, round5(p.capex.montoUF))) : p.capex.montoUF;
  const montoMinUF = esRango ? minUF5 : p.capex.montoUF;
  const montoMaxUF = esRango ? maxUF5 : p.capex.montoUF;
  // Extremos CLP coherentes con los UF redondeados que se muestran (misma UF del
  // motor). Sin valorUF caen a los extremos exactos del cálculo.
  const conUF = esRango && p.valorUF != null && p.valorUF > 0;
  const montoMinCLP = esRango ? (conUF ? Math.round(montoMinUF * p.valorUF!) : p.capex.montoMinCLP) : p.capex.montoCLP;
  const montoMaxCLP = esRango ? (conUF ? Math.round(montoMaxUF * p.valorUF!) : p.capex.montoMaxCLP) : p.capex.montoCLP;

  const ufFmt = Math.round(montoUFDisplay).toLocaleString("es-CL");
  const clpFmt = "$" + p.capex.montoCLP.toLocaleString("es-CL");
  const fmtUF0 = (v: number) => Math.round(v).toLocaleString("es-CL");
  const fmtCLP0 = (v: number) => "$" + Math.round(v).toLocaleString("es-CL");
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
  //
  // Rango (v3): la frase declara el rango Y el punto que corre el caso, sin el
  // porcentaje (el punto ya lo lleva el KPI/ksub). Con pie 0 conserva la oración
  // propia del caso. La IA copia la fuente aguas abajo; el prompt no cambia.
  const cierre = `No es remodelar para revender: es dejarlo en estándar de arriendo.`;
  const fraseCanonica = esRango
    ? `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
      `considera entre UF ${fmtUF0(montoMinUF)} y UF ${fmtUF0(montoMaxUF)} ` +
      `(${fmtCLP0(montoMinCLP)}–${fmtCLP0(montoMaxCLP)}) de puesta a punto; ` +
      `Franco corre el caso con UF ${ufFmt}.` +
      (p.sinCapitalPropio
        ? ` Sin pie, es la única plata tuya que entra el día uno además de los gastos de cierre.`
        : "") +
      ` ${cierre}`
    : p.sinCapitalPropio
      ? `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
        `considera unos UF ${ufFmt} (${clpFmt}) de puesta a punto. Sin pie, es la única ` +
        `plata tuya que entra el día uno además de los gastos de cierre. ${cierre}`
      : `Departamento de ${p.antiguedad} años: para captar arriendo de mercado, ` +
        `considera unos UF ${ufFmt} (${clpFmt}) de puesta a punto — cerca del ${pct}% ` +
        `de tu inversión inicial. ${cierre}`;

  const titular =
    p.capex.montoUF > 0
      ? "Necesita puesta a punto antes de arrendar a mercado."
      : "No necesita puesta a punto para arrendar a mercado.";

  return {
    id: "capex_puesta_a_punto",
    tipo: "capex_habilitacion",
    valor: {
      montoCLP: p.capex.montoCLP,
      montoUF: montoUFDisplay,
      ufM2: p.capex.ufM2,
      antiguedadAnios: p.antiguedad,
      superficieUtilM2: p.superficieUtilM2,
      modalidad: p.modalidad,
      origen: p.capex.origen,
      fraccionInversion,
      ...(p.sinCapitalPropio ? { sinCapitalPropio: true } : {}),
      montoMinUF,
      montoMaxUF,
      montoMinCLP,
      montoMaxCLP,
      ufM2Min: esRango ? p.capex.ufM2Min : p.capex.ufM2,
      ufM2Max: esRango ? p.capex.ufM2Max : p.capex.ufM2,
    },
    direccion: p.capex.montoUF > 0 ? "adverso" : "neutral",
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: { base, confianza },
    titular,
    fraseCanonica,
  };
}
