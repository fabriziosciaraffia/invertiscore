// Hallazgo tipado de RENTABILIDAD_STR (rentabilidad operativa del corto) — motor
// determinístico STR. DECISIVO: 1:1 con la dim `rentabilidad` del score de 4 dimensiones
// (decisividad_dim = |dimScore−50|/50, inyectada por el assembler). Envuelve
// escenarios.base.capRate (short-term-engine.ts:136, = noiAnual/precioCompra) SIN
// recalcular, contra el umbral STR nacional. Diseño congelado en of-e1a-piramide-str.md.
//
// REGLA A4/D4 (aprobación Fabrizio): la frase ANCLA al umbral, NUNCA compara el CAP pelado
// con un instrumento (depósito UF, fondo). Esa comparación rica vive en el drawer/largoPlazo,
// idéntico a la anti-colisión del TIR (tir-hallazgo.ts:12-14).

import type { HallazgoRentabilidadStr } from "./types";

// Umbral STR nacional (⛔#1, aprobado Fabrizio). Es la línea COMPRAR de la dim
// (ESCALA_CAP_RATE: 5%→70) y el piso real que el corto debe superar dado el esfuerzo
// operativo. Provisional hasta comparables por comuna. Banda de magnitud 3 pts.
export const CAP_STR_UMBRAL_PCT = 5.0;
export const CAP_STR_BANDA_PTS = 3.0;
const EN_LINEA_PTS = 0.2; // |gap| ≤ 0,2 ⇒ la frase dice "en línea"; señal-máquina binaria en 0

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Construye el proto-hallazgo de RENTABILIDAD_STR. `decisividad` la inyecta el assembler
 * (dim rentabilidad); el builder computa dirección, magnitud y texto. Devuelve null si el
 * CAP no es finito. Voz: tuteo neutro chileno. La IA lo narra aguas abajo.
 */
export function buildHallazgoRentabilidadStr(p: {
  /** CAP rate STR del sujeto, en % (base.capRate × 100). */
  capRatePct: number;
  /** Decisividad de la dim rentabilidad (0..1), inyectada por el assembler STR. */
  decisividad: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoRentabilidadStr | null {
  if (!Number.isFinite(p.capRatePct)) return null;

  const cap = p.capRatePct;
  const gap = cap - CAP_STR_UMBRAL_PCT;
  const gapAbs = Math.abs(gap);
  const direccion: "favorable" | "adverso" = cap >= CAP_STR_UMBRAL_PCT ? "favorable" : "adverso";
  const magnitudContinua = clamp01(gapAbs / CAP_STR_BANDA_PTS);

  const capFmt = pct1(cap);
  let titular: string;
  let fraseCanonica: string;
  if (gapAbs <= EN_LINEA_PTS) {
    titular = "La rentabilidad operativa está justo en el umbral.";
    fraseCanonica =
      `Tu CAP rate en corto es ${capFmt}%, justo en el umbral de 5% que le pedimos a una renta ` +
      `corta en Santiago. El precio de entrada se justifica por rentabilidad al filo, sin holgura.`;
  } else if (direccion === "favorable") {
    titular = "El metro cuadrado rinde de sobra en corto.";
    fraseCanonica =
      `Tu CAP rate en corto es ${capFmt}%, sobre el umbral de 5% que le pedimos a una renta corta ` +
      `en Santiago. El precio de entrada se justifica por lo que la operación rinde, sin depender de la plusvalía.`;
  } else {
    titular = "La rentabilidad operativa se queda corta.";
    fraseCanonica =
      `Tu CAP rate en corto es ${capFmt}%, bajo el umbral de 5% que le pedimos a una renta corta ` +
      `en Santiago. Genera caja, pero por debajo del piso que hace que el precio de entrada se justifique por rentabilidad.`;
  }

  return {
    id: "rentabilidad_str",
    tipo: "rentabilidad_operativa_str",
    valor: {
      capRatePct: Math.round(cap * 10) / 10,
      umbralPct: CAP_STR_UMBRAL_PCT,
      gapPts: Math.round(gap * 10) / 10,
      banda: CAP_STR_BANDA_PTS,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base: "CAP neto (NOI) sobre tu precio y los ingresos del escenario base; umbral STR nacional 5%, aún sin comparables de la comuna",
      confianza: "baja",
    },
    titular,
    fraseCanonica,
  };
}
