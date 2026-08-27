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
// Procedencia honesta sobre la TASA DE REFERENCIA: se compara contra MARKET_AVG_TASA_UF,
// un promedio de mercado NO en tiempo real (pull manual, puede estar desactualizado).
// Por eso la confianza es "media", no "alta".
//
// EL PIE NO SE COMPARA CONTRA UN ÓPTIMO (FASE 4.2). Hasta acá las frases y la
// procedencia citaban "el óptimo de 25%". Ese 25 se rastreó y no tiene fundamento: no
// marca umbral de mejora de tasa, ni el punto donde el flujo cruza a neutro, ni un
// requisito bancario — es una convención de may-2026 nunca cuestionada. Las frases
// describen ahora el EFECTO real del pie (más crédito, más cuota) y el detalle lo
// muestra calculado nivel por nivel (escalera del pie, `simularPie`).
// OJO: la clasificación en bandas (classifyPieLevel, 25/20/15) sigue viva en
// financing-health.ts y sigue decidiendo el `overall` — lo que se retiró es la
// AFIRMACIÓN de que 25 es un óptimo, no el clasificador.

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
  // Spread de DISPLAY derivado de las tasas YA redondeadas a 1 decimal — el lector debe
  // poder verificar la resta con los números que ve en la misma frase (antes: "62 pts"
  // junto a 4,7% vs 4,1%, que dan 60). El spread interno del motor (fh.tasa.spread_bps,
  // sobre tasas sin redondear) NO cambia: sigue en valor.spreadBps para gates/auditoría.
  const spreadDisplayPts = Math.abs(
    Math.round((Math.round(p.tasaPct * 10) / 10 - Math.round(p.marketPct * 10) / 10) * 100),
  );
  const spread = `${spreadDisplayPts} pts`;

  // Pie cero (fase 1-2): con pie 0 el diagnóstico honesto es "financiamiento
  // 100%", no "pie bajo el óptimo" (no hay pie que subir gradualmente: la
  // estructura es otra). classifyPieLevel(0) = problematico ⇒ el driver acá
  // solo puede ser "pie" o "ambos"; el guard driver!=="tasa" es defensivo.
  if (p.piePct === 0 && p.driver !== "tasa") {
    if (p.driver === "ambos")
      return (
        `Estás financiando el 100% de la propiedad y con la tasa sobre el mercado: sin pie, ` +
        `el crédito y la cuota quedan en su punto más alto, y la tasa (${tasa}%) suma ` +
        `${spread} sobre la referencia (${market}%).`
      );
    return (
      `Estás financiando el 100% de la propiedad: sin pie, el crédito y la cuota quedan ` +
      `en su punto más alto y todo el resultado descansa en el flujo mensual. ` +
      `La tasa (${tasa}%) está en mejor nivel.`
    );
  }

  switch (p.overall) {
    case "optimo":
      // optimo ⇒ ambos optimo (worst de dos = optimo solo si los dos lo son).
      return (
        `Tu estructura de financiamiento está sólida: pie de ${pie}% y tasa de ${tasa}% ` +
        `(en línea con la referencia de mercado, ${market}%). No hay palanca evidente que mover.`
      );

    // "aceptable" es un factor NETO POSITIVO (etiqueta "A favor") con una optimización
    // disponible — la frase abre por la fortaleza y cierra con la mejora como palanca,
    // no como advertencia (familia 6 del censo: la etiqueta ya no desdice al texto).
    case "aceptable":
      if (p.driver === "pie")
        return (
          `Tu estructura de financiamiento está bien: la tasa (${tasa}%) está en buen nivel y el ` +
          `pie de ${pie}% cumple. Subirlo baja crédito y cuota; cuánto, lo ves nivel por nivel en el detalle.`
        );
      if (p.driver === "tasa")
        return (
          `Tu estructura de financiamiento está bien: el pie (${pie}%) está en nivel adecuado y la ` +
          `tasa (${tasa}%) queda apenas ${spread} sobre la referencia de mercado (${market}%). ` +
          `Cotizar en otro banco puede cerrar ese margen.`
        );
      return (
        `Tu estructura de financiamiento está bien: el pie (${pie}%) y la tasa (${tasa}%) cumplen, ` +
        `con espacio menor de optimización en ambos.`
      );

    case "mejorable":
      if (p.driver === "pie")
        return (
          `Tu estructura de financiamiento tiene margen de mejora, principalmente por el pie: ` +
          `${pie}% te deja con más crédito y una cuota más alta. La tasa (${tasa}%) acompaña en buen nivel.`
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
          `${pie}% dispara el crédito y con él la cuota. La tasa (${tasa}%) está en mejor nivel.`
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
function buildTitular(p: {
  overall: FinancingHealthLevel;
  driver: "pie" | "tasa" | "ambos";
  piePct: number;
}): string {
  // Pie cero (fase 3b, decisión cerrada): el titular honesto es el del
  // financiamiento 100%, no "problema de fondo por el pie" (espejo del guard
  // de buildFrase). Direction-aware (adverso), sin montos.
  if (p.piePct === 0 && p.driver !== "tasa") {
    return p.driver === "ambos"
      ? "Tu financiamiento es 100% crédito y con tasa sobre el mercado."
      : "Tu financiamiento es 100% crédito: todo descansa en el flujo.";
  }
  switch (p.overall) {
    case "optimo":
      return "Tu financiamiento está sólido: pie y tasa bien puestos.";
    case "aceptable":
      if (p.driver === "pie") return "Tu financiamiento está bien; el pie puede afinarse.";
      if (p.driver === "tasa") return "Tu financiamiento está bien; la tasa puede afinarse.";
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

  const titular = buildTitular({ overall, driver, piePct: fh.pie.actual_pct });

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
      // FASE 4.2 — antes esta línea decía que el pie se evalúa "contra un umbral fijo
      // (25% óptimo, sólido)". Ese 25 se rastreó hasta el fondo y no tiene fundamento:
      // no marca umbral de mejora de tasa, ni el punto donde el flujo cruza a neutro,
      // ni un requisito bancario. Declararlo como óptimo le daba autoridad de dato a
      // una convención — y quedaba contradiciendo, en la misma pantalla, a la escalera
      // que muestra el efecto calculado sin declarar ningún óptimo.
      // La tasa SÍ conserva su referencia porque tiene fuente (promedio de mercado),
      // con su caveat de actualización intacto.
      base:
        `Estructura de financiamiento (pie + tasa) sobre tus datos declarados. La tasa se compara contra ` +
        `un promedio de mercado de referencia (UF ${fmtTasa(fh.tasa.market_avg_pct)}%), no en tiempo real — ` +
        `pull manual, puede estar desactualizado. El pie no se mide contra un óptimo: su efecto se muestra ` +
        `calculado, nivel por nivel.`,
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
