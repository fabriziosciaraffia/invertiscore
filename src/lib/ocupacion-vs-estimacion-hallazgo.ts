// Hallazgo tipado de OCUPACION_VS_ESTIMACION — motor determinístico STR (Goal 4 · 04-sep-2026).
// Compara la ocupación del CASO (el supuesto del usuario cuando hay override; si no, la
// estimación misma) contra la ESTIMACIÓN de mercado para ese depto (el valor central que
// los datos de mercado devuelven para la dirección; 45% conservador cuando no hay dato).
//
// Sin override no hay nada que comparar: caso y estimación son el mismo número ⇒ dirección
// neutral, gap 0, y la decisividad real da 0 por neutralización (el knob lleva la ocupación
// a la estimación y el score no se mueve). No corona nunca. Con override, la diferencia con
// su signo y su fuente: "tú supusiste X, la estimación de mercado para tu depto es Y".
//
// La comparación con la comuna YA NO vive acá: va a La zona como contexto (zonaSTR V2,
// `ocupacionVsComuna`). Reemplaza a ocupacion_vs_banda (V1: banda comunal escrita a mano,
// arriba del parque en 14 de 14 comunas, coronaba 236 de 238 informes por construcción).
//
// REGLA (aprobación Fabrizio) — la superficie no puede tener más confianza que el dato.
// Fallback (sin dato de la dirección): procedencia sin eufemismo, confianza baja, KPI 45%.
// Voz: tuteo chileno neutro; nunca "banda", nunca "llenar", nunca "ramp-up".

import type { HallazgoOcupacionVsEstimacion } from "./types";

// Saturación de magnitudContinua, en puntos de ocupación (solo con override).
export const OCC_SATURACION_PTS = 15;
const EN_LINEA_PTS = 1; // |gap| ≤ 1pt ⇒ neutral
export const OCC_FALLBACK_PCT = 45;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct0 = (n: number) => Math.round(n).toString();

export function buildHallazgoOcupacionVsEstimacion(p: {
  /** Ocupación del escenario base, en %. Con override = el supuesto del usuario. */
  ocupacionPct: number;
  /** Estimación de mercado para este depto, en % (p50 de la dirección; 45 si es fallback). */
  estimacionPct: number;
  /** true si el usuario definió la ocupación a mano. */
  esOverride: boolean;
  /** true si la estimación es el fallback conservador (no hay dato para la dirección). */
  esFallback: boolean;
  comuna: string;
  /** Decisividad real (Δscore al llevar la ocupación a la estimación), inyectada por el assembler. */
  decisividad: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoOcupacionVsEstimacion | null {
  if (!Number.isFinite(p.ocupacionPct)) return null;

  // Redondeo de display ANTES de decidir dirección: los enteros que muestra el ksub son los
  // que deciden (coherencia KPI-dirección).
  const occ = Math.round(p.ocupacionPct);
  const est = Math.round(Number.isFinite(p.estimacionPct) ? p.estimacionPct : p.ocupacionPct);
  const gap = p.esOverride ? occ - est : 0;
  const gapAbs = Math.abs(gap);
  // Supuesto por sobre la estimación = el veredicto descansa en un número más optimista que
  // el mercado (adverso). Por debajo = conservador (favorable). Sin override = neutral.
  const direccion: "favorable" | "adverso" | "neutral" =
    !p.esOverride || gapAbs <= EN_LINEA_PTS ? "neutral" : gap > 0 ? "adverso" : "favorable";
  const magnitudContinua = direccion === "neutral" ? 0 : clamp01(gapAbs / OCC_SATURACION_PTS);

  let titular: string;
  let fraseCanonica: string;
  if (p.esOverride && p.esFallback) {
    titular = "Supusiste una ocupación sin una estimación de mercado que la contraste.";
    fraseCanonica =
      `Tú supusiste ${pct0(occ)}% y no hay datos de ocupación para esta dirección que lo contrasten; ` +
      `la referencia conservadora es ${OCC_FALLBACK_PCT}%. El veredicto descansa en tu supuesto: ` +
      `trátalo como una meta a validar operando, no como el caso base.`;
  } else if (p.esOverride && direccion === "neutral") {
    titular = "Tu supuesto coincide con la estimación de mercado.";
    fraseCanonica =
      `Tú supusiste ${pct0(occ)}% y la estimación de mercado para tu depto es ${pct0(est)}%: el mismo número. ` +
      `El caso base no depende de un supuesto tuyo distinto del mercado.`;
  } else if (p.esOverride && direccion === "adverso") {
    titular = "Supusiste más ocupación que la que estima el mercado.";
    fraseCanonica =
      `Tú supusiste ${pct0(occ)}% y la estimación de mercado para tu depto es ${pct0(est)}%: ${pct0(gapAbs)} puntos más. ` +
      `El veredicto descansa en ese supuesto; trátalo como una meta a validar, no como el caso base.`;
  } else if (p.esOverride) {
    titular = "Supusiste menos ocupación que la que estima el mercado.";
    fraseCanonica =
      `Tú supusiste ${pct0(occ)}% y la estimación de mercado para tu depto es ${pct0(est)}%: ${pct0(gapAbs)} puntos menos. ` +
      `Vas conservador: si la estimación se cumple, los números mejoran.`;
  } else if (p.esFallback) {
    titular = `Sin dato de ocupación para este depto: el cálculo asume un ${OCC_FALLBACK_PCT}% conservador.`;
    fraseCanonica =
      `No hay datos de ocupación para esta dirección, así que la operación asume un ${pct0(occ)}% conservador. ` +
      `El número real recién lo conoces tras los primeros meses de operación.`;
  } else {
    titular = "Tu ocupación es la que estima el mercado para este depto.";
    fraseCanonica =
      `El cálculo usa la ocupación que los datos de mercado estiman para un depto como el tuyo en esta zona: ${pct0(occ)}%. ` +
      `No pusiste un supuesto propio, así que el caso base y la estimación son el mismo número.`;
  }

  return {
    id: "ocupacion_vs_estimacion",
    tipo: "ocupacion_vs_estimacion",
    valor: {
      ocupacionPct: occ,
      estimacionPct: est,
      gapPts: gap,
      esOverride: p.esOverride,
      esFallback: p.esFallback,
      comuna: p.comuna,
      saturacionPts: OCC_SATURACION_PTS,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base: p.esOverride
        ? `ocupación definida por ti (${pct0(occ)}%); ${p.esFallback ? `sin dato para esta dirección, referencia conservadora ${OCC_FALLBACK_PCT}%` : `la estimación de mercado para este depto es ${pct0(est)}%`}. El cálculo usa tu supuesto`
        : p.esFallback
        ? `sin datos de ocupación para esta dirección; supuesto conservador ${OCC_FALLBACK_PCT}%. Se confirma recién operando`
        : "estimación de mercado para este depto (valor central de la zona)",
      confianza: p.esOverride || p.esFallback ? "baja" : "media",
    },
    titular,
    fraseCanonica,
  };
}
