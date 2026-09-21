// Hallazgo tipado de RENTABILIDAD_STR (rentabilidad operativa del corto) — motor
// determinístico STR. DECISIVO: 1:1 con la dim `rentabilidad` del score de 4 dimensiones
// (decisividad_dim = |dimScore−50|/50, inyectada por el assembler). Envuelve
// escenarios.base.capRate (short-term-engine.ts:136, = noiAnual/precioCompra) SIN
// recalcular, contra el UMBRAL de la comuna. Diseño congelado en of-e1a-piramide-str.md.
//
// EL UMBRAL (21-sep-2026, decisión de Fabrizio): UN PUNTO sobre la rentabilidad bruta de la
// comuna (el benchmark de avisos de capref-comuna.ts, el mismo de LTR), no el 5% fijo. La
// razón, para el acta: el cap rate STR ya es DESPUÉS de operar, así que la prima cubre solo
// riesgo, y ese riesgo el score ya lo cobra por sensibilidad y break-even; dos puntos sería
// cobrarlo dos veces. Es un supuesto nuestro, revisable cuando HOM publique su informe.
// Cuando la comuna no tiene referencia (peldaño nacional: 4% neto), el umbral es el 5% de
// siempre (4 + 1), así que ninguna fila queda peor que hoy por falta de dato.
// Medido (21-sep, 254 filas STR): bajo el umbral 190 con el 5% fijo → 204 con comuna + 1;
// cambian 24 (19 sobre→bajo, 14 de ellas COMPRAR; 5 bajo→sobre). Umbral p50 5,2; Santiago 4,4,
// Ñuñoa 4,6, Las Condes 5,5, Providencia 5,7. El umbral NO entra al score ni a las puertas.
//
// REGLA A4/D4 (aprobación Fabrizio): la frase ANCLA al umbral, NUNCA compara el CAP pelado
// con un instrumento (depósito UF, fondo). Esa comparación rica vive en el drawer/largoPlazo,
// idéntico a la anti-colisión del TIR (tir-hallazgo.ts:12-14).

import type { HallazgoRentabilidadStr } from "./types";
import type { CapRef } from "./cap-rate-hallazgo";
import type { NivelCapRef } from "./capref-comuna";

/** Umbral STR NACIONAL: el último peldaño (4% neto nacional + 1 punto). Es la línea COMPRAR de
 *  la dim (ESCALA_CAP_RATE: 5%→70) y el que regía para todos hasta el 21-sep-2026. */
export const CAP_STR_UMBRAL_PCT = 5.0;
/** La prima del corto sobre la rentabilidad bruta de la comuna, en puntos. Supuesto nuestro. */
export const PRIMA_STR_PTS = 1.0;
export const CAP_STR_BANDA_PTS = 3.0;
const EN_LINEA_PTS = 0.2; // |gap| ≤ 0,2 ⇒ la frase dice "en línea"; señal-máquina binaria en 0

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const r1 = (n: number) => Math.round(n * 10) / 10;

/** El umbral STR resuelto: la referencia de la comuna más la prima, con su procedencia. */
export interface UmbralStr {
  /** El umbral, en % (referencia + prima; 5,0 en el peldaño nacional). */
  pct: number;
  /** La rentabilidad bruta de referencia sobre la que se suma la prima. */
  refPct: number;
  primaPts: number;
  nivel: NivelCapRef;
  comuna: string;
  celdaDormitorios: number | null;
  ventanaDias: number | null;
  nArriendo: number;
  nVenta: number;
}

/** Deriva el umbral STR de la referencia de cap rate de la comuna (getCapRefComuna). */
export function umbralStrDesde(ref: CapRef): UmbralStr {
  const nacional = ref.nivel === "nacional";
  return {
    pct: nacional ? CAP_STR_UMBRAL_PCT : r1(ref.pct + PRIMA_STR_PTS),
    refPct: nacional ? CAP_STR_UMBRAL_PCT - PRIMA_STR_PTS : r1(ref.pct),
    primaPts: PRIMA_STR_PTS,
    nivel: ref.nivel,
    comuna: ref.comuna,
    celdaDormitorios: ref.celdaDormitorios,
    ventanaDias: ref.ventanaDias,
    nArriendo: ref.nArriendo,
    nVenta: ref.nVenta,
  };
}

/** El umbral de siempre, cuando no hay referencia resuelta (callers viejos, fixtures). */
export function umbralStrNacional(comuna = ""): UmbralStr {
  return { pct: CAP_STR_UMBRAL_PCT, refPct: CAP_STR_UMBRAL_PCT - PRIMA_STR_PTS, primaPts: PRIMA_STR_PTS, nivel: "nacional", comuna, celdaDormitorios: null, ventanaDias: null, nArriendo: 0, nVenta: 0 };
}

/** Cómo nombra la frase a la referencia, por peldaño. */
function queUmbral(u: UmbralStr): string {
  const pct = pct1(u.pct);
  if (u.nivel === "celda" || u.nivel === "comuna") return `lo que se le pide a una renta corta en ${u.comuna} (${pct}%: un punto sobre lo que rinden los avisos de la comuna)`;
  if (u.nivel === "bdo") return `lo que se le pide a una renta corta en ${u.comuna} (${pct}%: un punto sobre lo que rinden los edificios de renta de la comuna)`;
  return `el umbral de ${pct}% que le pedimos a una renta corta en Santiago`;
}

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
  /** El umbral resuelto (umbralStrDesde). Ausente ⇒ el nacional de siempre. */
  umbral?: UmbralStr;
}): HallazgoRentabilidadStr | null {
  if (!Number.isFinite(p.capRatePct)) return null;
  const u = p.umbral ?? umbralStrNacional();

  // Redondeo de display (1 decimal) ANTES de decidir dirección: el KPI y el body usan el
  // MISMO número (evita el bug KPI-vs-body del cap_rate LTR: 9,4 KPI vs 9,5 body en el borde).
  const cap = r1(p.capRatePct);
  const gap = cap - u.pct;
  const gapAbs = Math.abs(gap);
  const direccion: "favorable" | "adverso" = cap >= u.pct ? "favorable" : "adverso";
  const magnitudContinua = clamp01(gapAbs / CAP_STR_BANDA_PTS);

  const capFmt = pct1(cap);
  const ref = queUmbral(u);
  let titular: string;
  let fraseCanonica: string;
  if (gapAbs <= EN_LINEA_PTS) {
    titular = "La rentabilidad operativa está justo en el umbral.";
    fraseCanonica =
      `Tu rentabilidad en corto es ${capFmt}%, justo en ${ref}. ` +
      `El precio de entrada se justifica por rentabilidad al filo, sin holgura.`;
  } else if (direccion === "favorable") {
    titular = "El metro cuadrado rinde de sobra en corto.";
    fraseCanonica =
      `Tu rentabilidad en corto es ${capFmt}%, sobre ${ref}. ` +
      `El precio de entrada se justifica por lo que la operación rinde, sin depender de la plusvalía.`;
  } else {
    titular = "La rentabilidad operativa se queda corta.";
    fraseCanonica =
      `Tu rentabilidad en corto es ${capFmt}%, bajo ${ref}. ` +
      `Genera caja, pero por debajo del piso que hace que el precio de entrada se justifique por rentabilidad.`;
  }

  return {
    id: "rentabilidad_str",
    tipo: "rentabilidad_operativa_str",
    valor: {
      capRatePct: cap,
      umbralPct: u.pct,
      gapPts: r1(gap),
      banda: CAP_STR_BANDA_PTS,
      modalidad: p.modalidad,
      refPct: u.refPct,
      primaPts: u.primaPts,
      nivel: u.nivel,
      comuna: u.comuna,
      celdaDormitorios: u.celdaDormitorios,
      ventanaDias: u.ventanaDias,
      nArriendo: u.nArriendo,
      nVenta: u.nVenta,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base:
        u.nivel === "nacional"
          ? "CAP neto (NOI) sobre tu precio y los ingresos del escenario base; umbral STR nacional 5%, sin referencia de la comuna"
          : `CAP neto (NOI) sobre tu precio y los ingresos del escenario base; umbral = rentabilidad bruta de ${u.comuna} (avisos) + ${pct1(u.primaPts)} pt de prima`,
      confianza: u.nivel === "nacional" ? "baja" : "media",
    },
    titular,
    fraseCanonica,
  };
}
