// Hallazgo tipado de RENTABILIDAD_STR (rentabilidad operativa del corto) — motor
// determinístico STR. DECISIVO: 1:1 con la dim `rentabilidad` del score de 4 dimensiones
// (decisividad_dim = |dimScore−50|/50, inyectada por el assembler). Envuelve
// escenarios.base.capRate (short-term-engine.ts:136, = noiAnual/precioCompra) SIN
// recalcular, contra el UMBRAL de la zona. Diseño congelado en of-e1a-piramide-str.md.
//
// EL UMBRAL (21-sep-2026, decisión de Fabrizio): lo que rinde, DESPUÉS DE OPERAR, un Airbnb
// típico de la misma comuna y tipología —la referencia STR contra STR de strref-zona.ts, con la
// misma base del estimador que usa el motor para el usuario y el mismo modelo de costos—, SIN
// punto extra: cuando la referencia es el mismo negocio no se compensa; el riesgo de la renta
// corta ya lo cobra el score por sensibilidad y break-even. Cascada corta: celda → comuna →
// sin referencia. Sin BDO, sin LTR. Sin referencia, el motor conserva el 5% de siempre para sus
// mecánicas (dirección, neutralización) y el capítulo lo dice y no compara.
// Historia: hasta el 21-sep el umbral fue 5% fijo; ese mismo día pasó un rato por «LTR de la
// comuna + 1 punto», que castigaba a las comunas con arriendo largo fuerte sin decir nada del
// Airbnb (memoria cola-umbral-str-anclado-al-ltr-comunal).
//
// REGLA A4/D4 (aprobación Fabrizio): la frase ANCLA al umbral, NUNCA compara el CAP pelado
// con un instrumento (depósito UF, fondo). Esa comparación rica vive en el drawer/largoPlazo,
// idéntico a la anti-colisión del TIR (tir-hallazgo.ts:12-14).

import type { HallazgoRentabilidadStr } from "./types";
import type { NivelStrRef, StrRefZonaSnapshot } from "./strref-zona";

/** Umbral STR de respaldo (sin referencia de la zona): la línea COMPRAR de la dim
 *  (ESCALA_CAP_RATE: 5%→70), el que regía para todos hasta el 21-sep-2026. */
export const CAP_STR_UMBRAL_PCT = 5.0;
export const CAP_STR_BANDA_PTS = 3.0;
const EN_LINEA_PTS = 0.2; // |gap| ≤ 0,2 ⇒ la frase dice "en línea"; señal-máquina binaria en 0

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const r1 = (n: number) => Math.round(n * 10) / 10;

/** El umbral STR resuelto, con su procedencia. */
export interface UmbralStr {
  /** El umbral, en %: el yield neto de la zona; 5,0 solo sin referencia. */
  pct: number;
  nivel: NivelStrRef;
  comuna: string;
  /** Dormitorios de la celda (null en «comuna» y sin referencia). */
  dormitorios: number | null;
  nDirecciones: number;
  nVenta: number;
}

/** Deriva el umbral STR del snapshot de la zona. Sin snapshot ⇒ sin referencia. */
export function umbralStrDesdeZona(s: StrRefZonaSnapshot | null | undefined, comuna = ""): UmbralStr {
  if (s && (s.nivel === "celda" || s.nivel === "comuna") && typeof s.neto === "number" && Number.isFinite(s.neto)) {
    return { pct: r1(s.neto), nivel: s.nivel, comuna: s.celda.comuna, dormitorios: s.celda.dormitorios, nDirecciones: s.nDirecciones, nVenta: s.nVenta };
  }
  return { pct: CAP_STR_UMBRAL_PCT, nivel: "sin_referencia", comuna: s?.celda.comuna ?? comuna, dormitorios: null, nDirecciones: s?.nDirecciones ?? 0, nVenta: s?.nVenta ?? 0 };
}

/** La referencia del cap rate STR COMO LA LEE EL INFORME: la del hallazgo (lo que proyectan los
 *  Airbnb de la zona), con su nivel. Una sola lectura para el hero y el capítulo I
 *  (23-sep-2026): el hero decía «la referencia para renta corta es 5,0%» —la constante de
 *  respaldo— y el capítulo, en la misma página, «referencia 2,2%». Sin hallazgo o sin
 *  referencia de la zona: `hayRef` false, y nadie compara ni pinta en rojo contra el 5%. */
export interface ReferenciaCapRateStr {
  pct: number;
  hayRef: boolean;
  nivel: NivelStrRef;
  comuna: string;
  celdaDormitorios: number | null;
}

export function referenciaCapRateStr(hallazgos: ReadonlyArray<{ id: string }> | null | undefined, comuna = ""): ReferenciaCapRateStr {
  const h = (hallazgos ?? []).find((x): x is HallazgoRentabilidadStr => x.id === "rentabilidad_str");
  const nivel = h?.valor.nivel ?? "sin_referencia";
  return {
    pct: h?.valor.umbralPct ?? CAP_STR_UMBRAL_PCT,
    hayRef: nivel !== "sin_referencia",
    nivel,
    comuna: h?.valor.comuna ?? comuna,
    celdaDormitorios: h?.valor.celdaDormitorios ?? null,
  };
}

const rotuloDorms = (d: number | null) => (d === null ? "" : d === 0 ? " studio" : ` de ${d} dormitorio${d === 1 ? "" : "s"}`);

/** Cómo nombra la frase a la referencia, por peldaño. */
function queUmbral(u: UmbralStr): string {
  const pct = pct1(u.pct);
  if (u.nivel === "celda") return `lo que proyectan los Airbnb${rotuloDorms(u.dormitorios)} en ${u.comuna} (${pct}%)`;
  if (u.nivel === "comuna") return `lo que proyectan los Airbnb de ${u.comuna} (${pct}%)`;
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
  /** El umbral resuelto (umbralStrDesdeZona). Ausente ⇒ sin referencia (5%). */
  umbral?: UmbralStr;
}): HallazgoRentabilidadStr | null {
  if (!Number.isFinite(p.capRatePct)) return null;
  const u = p.umbral ?? umbralStrDesdeZona(null);

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
  if (u.nivel === "sin_referencia") {
    titular = direccion === "favorable" ? "El metro cuadrado rinde de sobra en corto." : "La rentabilidad operativa se queda corta.";
    fraseCanonica =
      `Tu rentabilidad en corto es ${capFmt}%. No hay Airbnb suficientes de esta zona para compararla; ` +
      `${direccion === "favorable" ? "queda sobre" : "queda bajo"} ${ref}.`;
  } else if (gapAbs <= EN_LINEA_PTS) {
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
      `Genera caja, pero por debajo de lo que rinde un Airbnb típico de la zona.`;
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
      refPct: u.pct,
      nivel: u.nivel,
      comuna: u.comuna,
      celdaDormitorios: u.dormitorios,
      nDirecciones: u.nDirecciones,
      nVenta: u.nVenta,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base:
        u.nivel === "sin_referencia"
          ? "CAP neto (NOI) sobre tu precio y los ingresos del escenario base; sin referencia de Airbnb de la zona, umbral de respaldo 5%"
          : `CAP neto (NOI) sobre tu precio y los ingresos del escenario base; umbral = yield neto de los Airbnb de ${u.comuna} con el estimador y los costos del motor, sin prima`,
      confianza: u.nivel === "celda" ? "media" : "baja",
    },
    titular,
    fraseCanonica,
  };
}
