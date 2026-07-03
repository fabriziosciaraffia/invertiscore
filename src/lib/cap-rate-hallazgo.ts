// Hallazgo tipado de CAP rate (rentabilidad operativa) para LTR — motor
// determinístico. Espejo de `capex-puesta-a-punto.ts`: el motor envuelve el
// número que YA calcula (analysis.ts:250) en un hallazgo tipado; NO recalcula el
// cap rate base. La IA lo narra aguas abajo (skill analysis-voice-franco).
//
// El cap rate del sujeto sale del arriendo y precio DECLARADOS por el usuario,
// neto de gastos operativos (base NETA / NOI). Lo comparamos contra una
// REFERENCIA de mercado para producir decisividad y dirección.

import type { HallazgoCapRate } from "./types";

// ─── Referencia de mercado (base NETA / NOI) ──────────────────────────────
//
// La referencia NO se hardcodea dentro del builder ni la busca el motor por su
// cuenta: `getCapRefComuna` es el ÚNICO punto de resolución. Hoy devuelve el
// ancla nacional; mañana puede alimentarse SIN tocar el builder por dos vías:
//   (a) una entrada en CAP_RATE_REF_COMUNA (tabla estática síncrona), o
//   (b) `injected`: un valor pre-fetcheado async desde la DB, calculado en el
//       pipeline ANTES de calcMetrics (igual que ya entra ufClp) e inyectado.
// El motor sigue síncrono y puro: recibe un número ya resuelto, no hace queries.

/**
 * Ancla nacional de cap rate NETO (NOI), en %. No es un número a dedo: refleja
 * el promedio neto residencial de Santiago (~3–4,5%), referenciado a estimaciones
 * públicas de Houm/Assetplan (may-2026). Candidato a localizar per-comuna en el
 * futuro (la rentabilidad operativa normal varía por comuna).
 */
export const CAP_RATE_REF_NACIONAL = 4.0;

/**
 * Banda (en puntos porcentuales) que satura la decisividad: |gap| ≥ banda ⇒ 1.0.
 * Candidato a localizar per-comuna (la dispersión normal del cap rate varía por
 * comuna; una comuna premium de baja rotación tiene banda más angosta).
 */
export const CAP_RATE_BANDA_DEFAULT = 2.0;

/**
 * Slot per-comuna (vía «a»): hoy vacío. Cuando se llene con cap rates netos
 * curados por comuna, `getCapRefComuna` los usa sin tocar el builder ni el motor.
 */
export const CAP_RATE_REF_COMUNA: Record<string, number> = {};

export interface CapRef {
  /** Cap rate de referencia, en % NETO (NOI). */
  pct: number;
  /** Banda de saturación de la decisividad, en puntos porcentuales. */
  banda: number;
  /** Procedencia legible de la referencia (para auditoría de la brecha). */
  fuente: string;
  /** Confianza de la referencia: nacional ⇒ baja; tabla curada ⇒ media; live ⇒ alta. */
  confianza: "alta" | "media" | "baja";
  /** Alcance de la referencia usada. */
  scope: "nacional" | "comuna";
}

/**
 * ÚNICO punto de resolución de la referencia de cap rate. Síncrono y puro.
 *
 * Prioridad: inyectado (vía «b», pipeline async) > tabla per-comuna (vía «a») >
 * ancla nacional. Hoy ambas vías locales están vacías ⇒ siempre cae al nacional.
 */
export function getCapRefComuna(comuna: string, injected?: CapRef | null): CapRef {
  if (injected) return injected;

  const comunaPct = CAP_RATE_REF_COMUNA[comuna];
  if (typeof comunaPct === "number" && comunaPct > 0) {
    return {
      pct: comunaPct,
      banda: CAP_RATE_BANDA_DEFAULT,
      fuente: `referencia neta curada de ${comuna}`,
      confianza: "media", // tabla curada, todavía no comparables live
      scope: "comuna",
    };
  }

  return {
    pct: CAP_RATE_REF_NACIONAL,
    banda: CAP_RATE_BANDA_DEFAULT,
    fuente: "promedio neto residencial Santiago 3–4,5% (Houm/Assetplan, may-2026)",
    confianza: "baja", // referencia nacional, aún sin comparables de la comuna
    scope: "nacional",
  };
}

// ─── Builder del hallazgo ─────────────────────────────────────────────────

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Construye el proto-hallazgo de cap rate reusando el número del motor (:250).
 * Recibe la referencia ya resuelta como PARÁMETRO (default vía getCapRefComuna);
 * nunca la busca por su cuenta. Devuelve null si los números no son finitos.
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la
 * reescribe aguas abajo. Voz: tuteo neutro chileno.
 */
export function buildHallazgoCapRate(p: {
  /** Cap rate del sujeto, en % NETO (NOI). Reusado de analysis.ts:250. */
  capRatePct: number;
  /** Referencia ya resuelta (getCapRefComuna). */
  ref: CapRef;
  comuna: string;
  modalidad: "ltr" | "str" | "ambas";
  /** Decisividad calibrada (0..1) inyectada por calcDecisividades — escala común
   *  "Δdecisión" (E2). El builder ya NO la calcula con |gap|/banda. */
  decisividad: number;
  /** Magnitud continua pre-floor — desempate secundario del sort (E4). */
  magnitudContinua: number;
}): HallazgoCapRate | null {
  if (!Number.isFinite(p.capRatePct) || !Number.isFinite(p.ref.pct)) return null;

  const gap = p.capRatePct - p.ref.pct; // signed
  const gapRounded = Math.round(gap * 10) / 10;
  const direccion: "favorable" | "adverso" =
    p.capRatePct >= p.ref.pct ? "favorable" : "adverso";

  const crFmt = fmt1(p.capRatePct);
  const refFmt = fmt1(p.ref.pct);
  const gapAbs = Math.abs(gapRounded);
  const gapFmt = fmt1(gapAbs);

  let fraseCanonica: string;
  if (gapAbs < 0.2) {
    fraseCanonica =
      `Tu CAP rate es ${crFmt}% — en línea con la referencia de mercado (${refFmt}%). ` +
      `Rinde lo esperable para este precio.`;
  } else if (direccion === "favorable") {
    fraseCanonica =
      `Tu CAP rate es ${crFmt}% — +${gapFmt} pts sobre la referencia de mercado (${refFmt}%). ` +
      `Rinde por sobre lo que el mercado paga para este precio.`;
  } else {
    fraseCanonica =
      `Tu CAP rate es ${crFmt}% — ${gapFmt} pts bajo la referencia de mercado (${refFmt}%). ` +
      `Rinde bajo el promedio; el precio pide ajuste o conviene comparar con opciones más rentables en la zona.`;
  }

  return {
    id: "cap_rate",
    tipo: "rentabilidad_operativa",
    valor: {
      capRatePct: Math.round(p.capRatePct * 100) / 100,
      capRefPct: p.ref.pct,
      gapPts: gapRounded,
      banda: p.ref.banda,
      fuente: p.ref.fuente,
      scope: p.ref.scope,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: {
      base: "CAP rate neto (NOI) sobre tu arriendo y precio declarados, neto de gastos operativos",
      confianza: p.ref.confianza,
    },
    fraseCanonica,
  };
}
