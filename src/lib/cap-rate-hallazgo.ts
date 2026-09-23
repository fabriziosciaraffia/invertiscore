// Hallazgo tipado de CAP rate (rentabilidad operativa) para LTR — motor
// determinístico. Espejo de `capex-puesta-a-punto.ts`: el motor envuelve el
// número que YA calcula (analysis.ts) en un hallazgo tipado; NO recalcula el
// cap rate base. La IA lo narra aguas abajo (skill analysis-voice-franco).
//
// La CIFRA del sujeto es el cap rate NETO: `rentabilidadNeta`, el NOI de mercado —descuenta la
// vacancia, el corretaje, el recambio y la administración— sobre el precio (23-sep-2026: antes
// era `capRate`, que no descontaba la vacancia y no tiene nombre de mercado).
// La COMPARACIÓN es SIEMPRE BRUTO CONTRA BRUTO (decisión de Fabrizio, 23-sep-2026): el benchmark
// de avisos no conoce los costos del depto, BDO se lleva a bruto con su propio factor, y el
// promedio nacional también, con el mismo factor. Así el capítulo no depende de cómo definen el
// neto Houm y Assetplan. No hay rama neta.

import type { HallazgoCapRate } from "./types";
import { AVISOS_CAPREF_CONFIANZA_ALTA, brutoImplicitoBdo, rotuloCeldaCapRef, type CapRefComunaSnapshot, type NivelCapRef } from "./capref-comuna";

// ─── Referencia de mercado ────────────────────────────────────────────────
//
// La referencia NO se hardcodea dentro del builder ni la busca el motor por su
// cuenta: `getCapRefComuna` es el ÚNICO punto de resolución. La referencia de la comuna llega
// INYECTADA (un snapshot resuelto async en el pipeline ANTES de calcMetrics, igual que entra la
// mediana comunal) y el motor sigue síncrono y puro: recibe un dato ya resuelto, no hace queries.
// Sin snapshot cae al ancla nacional, y lo dice.

/**
 * Ancla nacional de cap rate NETO, en %. No es un número a dedo: refleja el promedio neto
 * residencial de Santiago (~3–4,5%), referenciado a estimaciones públicas de Houm/Assetplan
 * (may-2026). Es el ÚLTIMO peldaño de la cascada (nivel «nacional»): se usa solo cuando la
 * comuna no tiene ni avisos suficientes ni cobertura de BDO. El capítulo NO lo compara como
 * neto: lo lleva a bruto con el factor de BDO (`capRefNacional`), porque no sabemos con qué
 * definición de neto lo calculan esas fuentes.
 */
export const CAP_RATE_REF_NACIONAL = 4.0;

/**
 * Banda (en puntos porcentuales) que satura la decisividad: |gap| ≥ banda ⇒ 1.0.
 * Candidato a localizar per-comuna (la dispersión normal del cap rate varía por
 * comuna; una comuna premium de baja rotación tiene banda más angosta).
 */
export const CAP_RATE_BANDA_DEFAULT = 2.0;

export interface CapRef {
  /** Cap rate BRUTO de referencia, en %. */
  pct: number;
  /** Base de la comparación: siempre bruta (23-sep-2026). El campo queda porque viaja en el
   *  hallazgo; ya no tiene otro valor. */
  base: "bruta";
  /** Peldaño de la cascada que la produjo. Declarado, no inferido. */
  nivel: NivelCapRef;
  /** Banda de saturación de la decisividad, en puntos porcentuales. */
  banda: number;
  /** Procedencia legible de la referencia (para auditoría de la brecha). */
  fuente: string;
  /** Confianza de la referencia: nacional ⇒ baja; BDO o celda con n < 30 ⇒ media; celda con
   *  n ≥ 30 por lado ⇒ alta. */
  confianza: "alta" | "media" | "baja";
  /** Alcance de la referencia usada. */
  scope: "nacional" | "comuna";
  /** Cruce citable: el neto de BDO para la comuna, cuando la cubre. */
  bdoNeto: number | null;
  nArriendo: number;
  nVenta: number;
  /** Obra nueva comparada con arriendos de usado. */
  arriendoProxyUsado: boolean;
  /** Rótulo corto de la celda («Ñuñoa · usado · 2D · 45–68 m²»). */
  celda: string;
  /** Comuna canónica de la referencia. */
  comuna: string;
  /** Dormitorios de la celda (null en los peldaños sin tipología). */
  celdaDormitorios: number | null;
  /** Ventana de frescura de la muestra, en días (null sin avisos). */
  ventanaDias: number | null;
}

/** La referencia nacional, como último peldaño: el 4% neto llevado a bruto con el factor de BDO
 *  (4,0 ÷ 0,8 = 5,0). Exportada para que el gate la compare. */
export function capRefNacional(comuna: string, fuente?: string): CapRef {
  return {
    pct: brutoImplicitoBdo(CAP_RATE_REF_NACIONAL),
    base: "bruta",
    nivel: "nacional",
    banda: CAP_RATE_BANDA_DEFAULT,
    fuente: fuente ?? `sin referencia de ${comuna}: promedio neto residencial Santiago 3–4,5% (Houm/Assetplan, may-2026), ${CAP_RATE_REF_NACIONAL}% neto llevado a bruto con el factor de BDO`,
    confianza: "baja",
    scope: "nacional",
    bdoNeto: null,
    nArriendo: 0,
    nVenta: 0,
    arriendoProxyUsado: false,
    celda: `${comuna} · sin referencia de la comuna`,
    comuna,
    celdaDormitorios: null,
    ventanaDias: null,
  };
}

/** Traduce el snapshot persistido (o resuelto vivo) a la referencia que consume el builder. */
export function capRefDesdeSnapshot(s: CapRefComunaSnapshot): CapRef {
  const comun = {
    banda: CAP_RATE_BANDA_DEFAULT,
    fuente: s.fuente,
    bdoNeto: s.bdoNeto,
    nArriendo: s.nArriendo,
    nVenta: s.nVenta,
    arriendoProxyUsado: s.arriendoProxyUsado,
    celda: rotuloCeldaCapRef(s),
    comuna: s.celda.comuna,
    celdaDormitorios: s.celda.dormitorios,
    ventanaDias: s.ventana,
  };
  if ((s.nivel === "celda" || s.nivel === "comuna") && typeof s.bruto === "number" && s.bruto > 0) {
    const alta = s.nArriendo >= AVISOS_CAPREF_CONFIANZA_ALTA && s.nVenta >= AVISOS_CAPREF_CONFIANZA_ALTA;
    return { ...comun, pct: s.bruto, base: "bruta", nivel: s.nivel, confianza: alta ? "alta" : "media", scope: "comuna" };
  }
  // Peldaño bdo: el BRUTO IMPLÍCITO (neto ÷ 0,8, la conversión que BDO declara), para que el
  // capítulo hable de una sola base. El neto publicado sigue en `bdoNeto`.
  if (s.nivel === "bdo" && typeof s.bdoNeto === "number" && s.bdoNeto > 0) {
    return { ...comun, pct: brutoImplicitoBdo(s.bdoNeto), base: "bruta", nivel: "bdo", confianza: "media", scope: "comuna" };
  }
  return capRefNacional(s.celda.comuna, s.nivel === "nacional" ? s.fuente : undefined);
}

/**
 * ÚNICO punto de resolución de la referencia de cap rate. Síncrono y puro.
 * Con snapshot inyectado, la comuna; sin él, el ancla nacional (y `nivel` lo dice).
 */
export function getCapRefComuna(comuna: string, injected?: CapRefComunaSnapshot | null): CapRef {
  if (injected) return capRefDesdeSnapshot(injected);
  return capRefNacional(comuna);
}

// ─── Builder del hallazgo ─────────────────────────────────────────────────

/**
 * EL CAP RATE COMO SE MUESTRA: redondeado UNA vez, a un decimal, DESDE EL CRUDO. La trampa no
 * era toFixed contra Math.round sino redondear dos veces: `metrics.capRate` sale redondeado a
 * dos decimales y el hero lo volvía a redondear a uno (2,848 → 2,85 → «2,9»), mientras el
 * hallazgo redondea el crudo una vez (2,848 → 2,8). 55 filas del parque (4,5%) mostraban dos
 * cap rates en la misma página (21-sep-2026). La cifra que se muestra es `valor.capRatePct`
 * del hallazgo; esta función es cómo se obtiene y la única forma de redondearlo.
 */
export function capRateDisplayPct(capRatePct: number): number {
  return Math.round(capRatePct * 10) / 10;
}

/**
 * «CAP RATE NETO» LTR, COMO SE MUESTRA — una sola cifra (decisión de Fabrizio, 23-sep-2026).
 * Es `rentabilidadNeta` (el NOI de mercado: descuenta vacancia, corretaje, recambio y
 * administración) redondeada UNA vez desde el crudo (`capRateNetoDisplayPct`, que emite el motor).
 * La leen el hero, los dos lados del pop-up, el anexo, los KPI y /comparar. `capRate` ya no se
 * muestra en ninguna parte. Filas persistidas sin el campo: la neta de dos decimales, redondeada
 * a uno. `null` sin la métrica.
 */
export function capRateNetoLtrPct(m: { rentabilidadNeta?: number | null; capRateNetoDisplayPct?: number | null } | null | undefined): number | null {
  if (typeof m?.capRateNetoDisplayPct === "number" && Number.isFinite(m.capRateNetoDisplayPct)) return m.capRateNetoDisplayPct;
  const v = m?.rentabilidadNeta;
  return typeof v === "number" && Number.isFinite(v) ? capRateDisplayPct(v) : null;
}

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Construye el proto-hallazgo de cap rate reusando los números del motor.
 * Recibe la referencia ya resuelta como PARÁMETRO (default vía getCapRefComuna);
 * nunca la busca por su cuenta. Devuelve null si los números no son finitos.
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la
 * reescribe aguas abajo. Voz: tuteo neutro chileno.
 */
export function buildHallazgoCapRate(p: {
  /** Cap rate NETO del sujeto, en %: `metrics.rentabilidadNeta`. Viaja como la cifra del hero;
   *  no es lo que se compara. */
  capRatePct: number;
  /** Rentabilidad BRUTA del sujeto, en % (arriendo × 12 / precio). Es lo que se compara. */
  brutoPct: number;
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
  if (!Number.isFinite(p.capRatePct) || !Number.isFinite(p.ref.pct) || !Number.isFinite(p.brutoPct)) return null;

  // Redondeo a 1 decimal UNA vez (precisión de display): body (fmt1), gap, dirección y
  // valor leen de acá; el KPI/ksub reformatean el valor → mismo string.
  const capRatePct = capRateDisplayPct(p.capRatePct);
  // Lo que se compara: el bruto del sujeto contra el bruto de la referencia.
  const sujetoPct = capRateDisplayPct(p.brutoPct);
  const refPct = capRateDisplayPct(p.ref.pct);

  const gap = sujetoPct - refPct; // signed
  const gapRounded = Math.round(gap * 10) / 10;
  const gapAbs = Math.abs(gapRounded);
  // "neutral" en la banda "en línea" (|gap| < 0,2 — familia 6 del censo): rendir lo
  // esperable no es ventaja ni advertencia, y la etiqueta de la card ya no desdice a
  // la frase. Fuera de la banda, binaria como siempre.
  const direccion: "favorable" | "adverso" | "neutral" =
    gapAbs < 0.2 ? "neutral" : sujetoPct >= refPct ? "favorable" : "adverso";

  const crFmt = fmt1(sujetoPct);
  const refFmt = fmt1(refPct);
  const gapFmt = fmt1(gapAbs);

  // Glosa inline (familia 4 del censo): la card es standalone — no hay orden de "primer uso"
  // que garantice la glosa de la prosa. Lo que se compara es el bruto.
  const glosaCap = `Tu cap rate bruto —el arriendo de un año sobre el precio, antes de gastos—`;
  // Qué es la referencia, dicho en la frase: avisos de la comuna, BDO o el promedio nacional.
  const queRef =
    p.ref.nivel === "celda" || p.ref.nivel === "comuna"
      ? `lo que rinden los avisos de ${p.ref.celda} (${refFmt}%)`
      : p.ref.nivel === "bdo"
        ? `lo que rinden los edificios de renta de ${p.ref.comuna} (${refFmt}%)`
        : `el promedio de Santiago (${refFmt}%)`;

  let fraseCanonica: string;
  let titular: string;
  if (direccion === "neutral") {
    titular = "Rinde en línea con lo que pide el mercado.";
    fraseCanonica = `${glosaCap} es ${crFmt}% — en línea con ${queRef}. Rinde lo esperable para este precio.`;
  } else if (direccion === "favorable") {
    titular = "Rinde por sobre lo que el mercado paga.";
    fraseCanonica = `${glosaCap} es ${crFmt}% — +${gapFmt} pts sobre ${queRef}. Rinde por sobre lo que el mercado paga para este precio.`;
  } else {
    titular = "Rinde bajo lo que el mercado exige acá.";
    fraseCanonica =
      `${glosaCap} es ${crFmt}% — ${gapFmt} pts bajo ${queRef}. ` +
      `Rinde bajo el promedio; el precio pide ajuste o conviene comparar con opciones más rentables en la zona.`;
  }

  return {
    id: "cap_rate",
    tipo: "rentabilidad_operativa",
    valor: {
      capRatePct, // el NETO, ya redondeado a 1 decimal — el mismo valor del hero y del pop-up
      sujetoPct,
      capRefPct: refPct,
      base: p.ref.base,
      nivel: p.ref.nivel,
      gapPts: gapRounded,
      banda: p.ref.banda,
      fuente: p.ref.fuente,
      scope: p.ref.scope,
      modalidad: p.modalidad,
      bdoNeto: p.ref.bdoNeto,
      nArriendo: p.ref.nArriendo,
      nVenta: p.ref.nVenta,
      arriendoProxyUsado: p.ref.arriendoProxyUsado,
      celda: p.ref.celda,
      comuna: p.ref.comuna,
      celdaDormitorios: p.ref.celdaDormitorios,
      ventanaDias: p.ref.ventanaDias,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: {
      base: "Rentabilidad bruta sobre tu arriendo y precio declarados, contra la bruta de la referencia; el cap rate neto descuenta gastos, vacancia y gestión",
      confianza: p.ref.confianza,
    },
    titular,
    fraseCanonica,
  };
}
