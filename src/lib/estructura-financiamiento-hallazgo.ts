// Hallazgo tipado de ESTRUCTURA de financiamiento (pie + tasa) para LTR — motor
// determinístico. 6º y último hallazgo, y el PRIMERO categórico. Espejo de
// `cap-rate-hallazgo.ts`: el motor ENVUELVE el `overall` que YA emite
// classifyFinancingHealth (financing-health.ts:133) en un hallazgo tipado; NO
// recalcula pie/tasa/overall ni toca la reestructuración de FASE A. La IA lo narra
// aguas abajo (skill analysis-voice-franco).
//
// Por qué categórico y no continuo: el `overall` es el PEOR de dos clasificaciones
// discretas (pie vs tasa), no una brecha. La decisividad se mapea por NIVEL, no con
// clamp(|gap|/banda) como cap_rate/plusvalia.
//
// Procedencia honesta sobre la TASA DE REFERENCIA: el pie se evalúa contra un umbral
// fijo (25% óptimo, sólido); la tasa se compara contra MARKET_AVG_TASA_UF, un
// promedio de mercado de referencia NO en tiempo real (pull manual, puede estar
// desactualizado). Por eso la confianza es "media", no "alta".

import { LEVEL_RANK, type FinancingHealth, type FinancingHealthLevel } from "./financing-health";
import type { HallazgoEstructuraFinanciamiento } from "./types";

// ─── Derivación del driver ────────────────────────────────────────────────────
//
// El `overall` NO guarda cuál dimensión lo definió (es worstLevel). Se deriva
// comparando el rango canónico (LEVEL_RANK, fuente única en financing-health.ts):
// la dimensión de mayor rango es la que fija el overall. Empate ⇒ "ambos".
function deriveDriver(
  pieLevel: FinancingHealthLevel,
  tasaLevel: FinancingHealthLevel,
): "pie" | "tasa" | "ambos" {
  const rp = LEVEL_RANK[pieLevel];
  const rt = LEVEL_RANK[tasaLevel];
  if (rp > rt) return "pie";
  if (rt > rp) return "tasa";
  return "ambos";
}

const PIE_OPTIMO_PCT = 25;

// ─── Formato (tuteo neutro chileno, coma decimal) ─────────────────────────────
const fmtTasa = (n: number) => n.toFixed(1).replace(".", ",");
const fmtPie = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");

// ─── Frase canónica: nombra el DRIVER, no "es mejorable" a secas ──────────────
//
// La línea determinística del motor (sin LLM); la IA la reescribe aguas abajo.
function buildFrase(p: {
  overall: FinancingHealthLevel;
  driver: "pie" | "tasa" | "ambos";
  piePct: number;
  tasaPct: number;
  marketPct: number;
  spreadBps: number;
}): string {
  const pie = fmtPie(p.piePct);
  const tasa = fmtTasa(p.tasaPct);
  const market = fmtTasa(p.marketPct);
  const spread = `${Math.abs(p.spreadBps)} pts`;

  switch (p.overall) {
    case "optimo":
      // optimo ⇒ ambos optimo (worst de dos = optimo solo si los dos lo son).
      return (
        `Tu estructura de financiamiento está sólida: pie de ${pie}% y tasa de ${tasa}% ` +
        `(en línea con la referencia de mercado, ${market}%). No hay palanca evidente que mover.`
      );

    case "aceptable":
      if (p.driver === "pie")
        return (
          `Tu estructura de financiamiento está bien, con un margen menor por el pie: ` +
          `${pie}% queda algo bajo el óptimo de ${PIE_OPTIMO_PCT}%. La tasa (${tasa}%) está en buen nivel.`
        );
      if (p.driver === "tasa")
        return (
          `Tu estructura de financiamiento está bien, con un margen menor por la tasa: ` +
          `${tasa}% deja ${spread} sobre la referencia de mercado (${market}%). El pie (${pie}%) está en nivel adecuado.`
        );
      return (
        `Tu estructura de financiamiento está bien: el pie (${pie}%) y la tasa (${tasa}%) ` +
        `dejan un margen menor, sin un punto débil claro.`
      );

    case "mejorable":
      if (p.driver === "pie")
        return (
          `Tu estructura de financiamiento tiene margen de mejora, principalmente por el pie: ` +
          `${pie}% queda bajo el óptimo de ${PIE_OPTIMO_PCT}% y te deja con más crédito. La tasa (${tasa}%) acompaña en buen nivel.`
        );
      if (p.driver === "tasa")
        return (
          `Tu estructura de financiamiento tiene margen de mejora, principalmente por la tasa: ` +
          `${tasa}% queda ${spread} sobre la referencia de mercado (${market}%). El pie (${pie}%) acompaña en nivel adecuado.`
        );
      return (
        `Tu estructura de financiamiento tiene margen de mejora, tanto por el pie (${pie}%) ` +
        `como por la tasa (${tasa}%).`
      );

    case "problematico":
      if (p.driver === "pie")
        return (
          `Tu estructura de financiamiento tiene un problema de fondo, principalmente por el pie: ` +
          `${pie}% está muy bajo el óptimo de ${PIE_OPTIMO_PCT}% y dispara el crédito y la cuota. La tasa (${tasa}%) está en mejor nivel.`
        );
      if (p.driver === "tasa")
        return (
          `Tu estructura de financiamiento tiene un problema de fondo, principalmente por la tasa: ` +
          `${tasa}% queda ${spread} sobre la referencia de mercado (${market}%). El pie (${pie}%) está en mejor nivel.`
        );
      return (
        `Tu estructura de financiamiento tiene un problema de fondo: el pie (${pie}%) y la tasa (${tasa}%) ` +
        `están ambos fuera de rango.`
      );
  }
}

// ─── Titular corto (hero TOP-3) ───────────────────────────────────────────────
//
// Espejo de buildFrase pero de UNA línea, diagnóstico + dirección, SIN número (el
// número vive en el KPI de la fila). favorable = optimo|aceptable; adverso = resto.
function buildTitular(p: { overall: FinancingHealthLevel; driver: "pie" | "tasa" | "ambos" }): string {
  switch (p.overall) {
    case "optimo":
      return "Tu financiamiento está sólido: pie y tasa bien puestos.";
    case "aceptable":
      if (p.driver === "pie") return "Tu financiamiento está bien; el pie deja un margen menor.";
      if (p.driver === "tasa") return "Tu financiamiento está bien; la tasa deja un margen menor.";
      return "Tu financiamiento está bien, sin un punto débil claro.";
    case "mejorable":
      if (p.driver === "pie") return "Tu financiamiento tiene margen: el pie te deja corto.";
      if (p.driver === "tasa") return "Tu financiamiento tiene margen: la tasa está sobre el mercado.";
      return "Tu financiamiento tiene margen de mejora en pie y tasa.";
    case "problematico":
      if (p.driver === "pie") return "Tu financiamiento tiene un problema de fondo por el pie.";
      if (p.driver === "tasa") return "Tu financiamiento tiene un problema de fondo por la tasa.";
      return "Tu financiamiento tiene un problema de fondo en pie y tasa.";
  }
}

// ─── Builder del hallazgo ─────────────────────────────────────────────────────

/**
 * Construye el proto-hallazgo de estructura reusando el `financingHealth` ya
 * calculado por el motor (classifyFinancingHealth). Puro y síncrono. NO recalcula
 * pie/tasa/overall. Devuelve null si los porcentajes no son finitos.
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la
 * reescribe aguas abajo. Voz: tuteo neutro chileno, sin voseo.
 */
export function buildHallazgoEstructuraFinanciamiento(p: {
  /** financingHealth ya resuelto por el motor (financing-health.ts:133). */
  financingHealth: FinancingHealth;
  modalidad: "ltr" | "str" | "ambas";
  /** Decisividad calibrada (0..1) inyectada por calcDecisividades — escala común
   *  "Δdecisión" (E2). El builder ya NO la mapea por nivel (DECISIVIDAD_POR_NIVEL). */
  decisividad: number;
  /** Magnitud continua pre-floor — desempate secundario del sort (E4). */
  magnitudContinua: number;
}): HallazgoEstructuraFinanciamiento | null {
  const fh = p.financingHealth;
  if (!Number.isFinite(fh.pie.actual_pct) || !Number.isFinite(fh.tasa.actual_pct)) return null;

  const overall = fh.overall;
  const driver = deriveDriver(fh.pie.level, fh.tasa.level);
  const direccion: "favorable" | "adverso" =
    overall === "optimo" || overall === "aceptable" ? "favorable" : "adverso";

  const fraseCanonica = buildFrase({
    overall,
    driver,
    piePct: fh.pie.actual_pct,
    tasaPct: fh.tasa.actual_pct,
    marketPct: fh.tasa.market_avg_pct,
    spreadBps: fh.tasa.spread_bps,
  });

  const titular = buildTitular({ overall, driver });

  return {
    id: "estructura_financiamiento",
    tipo: "salud_financiamiento",
    valor: {
      overall,
      driver,
      pieLevel: fh.pie.level,
      piePct: fh.pie.actual_pct,
      tasaLevel: fh.tasa.level,
      tasaPct: fh.tasa.actual_pct,
      tasaMarketPct: fh.tasa.market_avg_pct,
      spreadBps: fh.tasa.spread_bps,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: {
      base:
        `Estructura de financiamiento (pie + tasa) sobre tus datos declarados. El pie se evalúa ` +
        `contra un umbral fijo (${PIE_OPTIMO_PCT}% óptimo, sólido); la tasa se compara contra un promedio de ` +
        `mercado de referencia (UF ${fmtTasa(fh.tasa.market_avg_pct)}%), no en tiempo real — pull manual, puede estar desactualizado.`,
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
