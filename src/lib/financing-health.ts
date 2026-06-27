import { calcDividendo } from "./analysis";

// Doctrina: ver C:/Users/fabri/.claude/skills/analysis-voice-franco/SKILL.md §1.5.
// El motor produce señales numéricas (4 niveles); la presentación al usuario las
// agrupa en 3 escalones (validación silenciosa / observación táctica /
// reestructuración). Plazo y relación cuota/perfil quedan para v2.

// TODO(financingHealth/v2): hidratar MARKET_AVG_TASA_UF desde fuente real
// (BCCh, CMF, o tabla `market_data`/`config`). Hardcoded por ahora.
export const MARKET_AVG_TASA_UF = 4.1;

// Si pie >= 25% el impacto que se reporta es "subir 5pp más".
// Si está bajo, se reporta el impacto de subirlo a 25% (el óptimo).
const PIE_RECOMMENDED_PCT = 25;
const PIE_IMPROVEMENT_STEP_PCT = 5;

// Si la tasa está bajo el promedio, se reporta el impacto de bajarla 30 bps.
// Si está sobre, el impacto de bajarla al promedio.
const TASA_IMPROVEMENT_STEP_PCT = 0.3;

export type FinancingHealthLevel = "optimo" | "aceptable" | "mejorable" | "problematico";

export interface FinancingHealthDimension {
  level: FinancingHealthLevel;
  actual_pct: number;
  recommended_pct: number;
  impact_message?: string;
}

export interface FinancingHealth {
  pie: FinancingHealthDimension;
  tasa: FinancingHealthDimension & { market_avg_pct: number; spread_bps: number };
  overall: FinancingHealthLevel;
}

export interface ClassifyFinancingHealthInput {
  pie_pct: number;
  tasa_pct: number;
  precio_uf: number;
  plazo_anios: number;
}

function classifyPieLevel(pie_pct: number): FinancingHealthLevel {
  if (pie_pct >= 25) return "optimo";
  if (pie_pct >= 20) return "aceptable";
  if (pie_pct >= 15) return "mejorable";
  return "problematico";
}

function classifyTasaLevel(spread_bps: number): FinancingHealthLevel {
  if (spread_bps <= 20) return "optimo";
  if (spread_bps <= 50) return "aceptable";
  if (spread_bps <= 80) return "mejorable";
  return "problematico";
}

// Orden canónico de severidad de los niveles (optimo=mejor … problematico=peor).
// Exportado para que el Hallazgo de estructura (estructura-financiamiento-hallazgo.ts)
// derive el DRIVER (cuál dimensión define el overall) sin replicar el orden ni
// arriesgar drift. Es la ÚNICA fuente del ranking.
export const LEVEL_RANK: Record<FinancingHealthLevel, number> = {
  optimo: 0,
  aceptable: 1,
  mejorable: 2,
  problematico: 3,
};

function worstLevel(a: FinancingHealthLevel, b: FinancingHealthLevel): FinancingHealthLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}

export function classifyFinancingHealth(input: ClassifyFinancingHealthInput, ufClp: number): FinancingHealth {
  const { pie_pct, tasa_pct, precio_uf, plazo_anios } = input;

  const precioCLP = precio_uf * ufClp;
  const creditoActualCLP = precioCLP * (1 - pie_pct / 100);
  const dividendoActual = calcDividendo(creditoActualCLP, tasa_pct, plazo_anios);

  // ── PIE ─────────────────────────────────────────────────────────────────
  const pieLevel = classifyPieLevel(pie_pct);
  let piePctImprovement: number;
  if (pieLevel === "optimo") {
    piePctImprovement = pie_pct + PIE_IMPROVEMENT_STEP_PCT;
  } else {
    piePctImprovement = PIE_RECOMMENDED_PCT;
  }

  let pieImpactMessage: string | undefined;
  if (pieLevel !== "optimo") {
    const creditoMejorCLP = precioCLP * (1 - piePctImprovement / 100);
    const dividendoMejor = calcDividendo(creditoMejorCLP, tasa_pct, plazo_anios);
    const ahorroMensual = dividendoActual - dividendoMejor;
    if (ahorroMensual > 0) {
      pieImpactMessage = `subir el pie a ${piePctImprovement}% baja la cuota en ${fmtCLP(ahorroMensual)} al mes`;
    }
  }

  const pie: FinancingHealthDimension = {
    level: pieLevel,
    actual_pct: pie_pct,
    recommended_pct: PIE_RECOMMENDED_PCT,
    impact_message: pieImpactMessage,
  };

  // ── TASA ────────────────────────────────────────────────────────────────
  const spreadBps = Math.round((tasa_pct - MARKET_AVG_TASA_UF) * 100);
  const tasaLevel = classifyTasaLevel(spreadBps);

  let tasaImpactMessage: string | undefined;
  if (tasaLevel !== "optimo") {
    // Bajar al promedio del mercado (caso común cuando hay spread sustantivo)
    const tasaMejor = Math.max(MARKET_AVG_TASA_UF, tasa_pct - TASA_IMPROVEMENT_STEP_PCT);
    const dividendoMejor = calcDividendo(creditoActualCLP, tasaMejor, plazo_anios);
    const ahorroMensual = dividendoActual - dividendoMejor;
    if (ahorroMensual > 0) {
      const tasaFmt = tasaMejor.toFixed(2).replace(".", ",");
      tasaImpactMessage = `bajar la tasa a ${tasaFmt}% reduce la cuota en ${fmtCLP(ahorroMensual)} al mes`;
    }
  }

  const tasa: FinancingHealth["tasa"] = {
    level: tasaLevel,
    actual_pct: tasa_pct,
    recommended_pct: MARKET_AVG_TASA_UF,
    market_avg_pct: MARKET_AVG_TASA_UF,
    spread_bps: spreadBps,
    impact_message: tasaImpactMessage,
  };

  return {
    pie,
    tasa,
    overall: worstLevel(pieLevel, tasaLevel),
  };
}

// ── Reestructuración financiera (números deterministas del Nivel 3) ─────────
//
// FASE A (espejo de sobreprecio): el motor calcula los números de la estructura
// sugerida que ANTES inventaba la IA (ai-generation.ts §5 Nivel 3). La IA pasa a
// LEERLOS; deja de estimarlos. NO emite Hallazgo tipado todavía (eso es FASE B).
//
// Doctrina de las 3 palancas:
//   - PIE: dirección clara para todo perfil (más alto = menos crédito = menor
//     cuota). Se sugiere subir al óptimo (PIE_RECOMMENDED_PCT) si está por debajo.
//   - TASA: dirección clara para todo perfil (más baja = menor cuota). Se sugiere
//     bajar al promedio de mercado (MARKET_AVG_TASA_UF) si está por encima.
//   - PLAZO: NEUTRAL. La dirección correcta depende del perfil del inversor (corto
//     = menos interés total; largo = libera flujo) y Franco hoy no tiene perfil.
//     El motor NO recomienda cambiar el plazo: se mantiene el del usuario y el
//     impacto se calcula SOLO sobre pie+tasa.

export interface ReestructuracionFinanciera {
  pieSugerido_pct: number;
  plazoSugerido_anios: number;
  tasaObjetivo_pct: number;
  impactoCuotaMensual_clp: number;
}

/**
 * Calcula los 4 números deterministas de la reestructuración sugerida reusando
 * `calcDividendo` del motor. Puro y síncrono. Cuando pie y tasa ya están en o
 * mejor que el óptimo, no hay palanca: impactoCuotaMensual_clp = 0 y los
 * sugeridos quedan iguales a los actuales.
 */
export function buildReestructuracionFinanciera(
  input: ClassifyFinancingHealthInput,
  ufClp: number,
): ReestructuracionFinanciera {
  const { pie_pct, tasa_pct, precio_uf, plazo_anios } = input;
  const precioCLP = precio_uf * ufClp;

  // Pie: subir al óptimo si está por debajo; si ya está en o sobre el óptimo, no
  // se sugiere cambio (el pie no es la palanca en ese caso).
  const pieSugerido = pie_pct < PIE_RECOMMENDED_PCT ? PIE_RECOMMENDED_PCT : pie_pct;

  // Tasa: bajar al promedio de mercado si está por encima; si ya está en o bajo
  // el mercado, no se sugiere cambio. Fuente única del 4.1: MARKET_AVG_TASA_UF.
  const tasaObjetivo = tasa_pct > MARKET_AVG_TASA_UF ? MARKET_AVG_TASA_UF : tasa_pct;

  // Plazo neutral: passthrough del valor del usuario (ver doctrina arriba).
  const plazoSugerido = plazo_anios;

  // Impacto = baja de cuota al pasar a la estructura sugerida (pie+tasa), con el
  // plazo fijo. Resta de dividendos; clamp a 0 por si no hay palanca.
  const creditoActualCLP = precioCLP * (1 - pie_pct / 100);
  const creditoSugeridoCLP = precioCLP * (1 - pieSugerido / 100);
  const dividendoActual = calcDividendo(creditoActualCLP, tasa_pct, plazo_anios);
  const dividendoSugerido = calcDividendo(creditoSugeridoCLP, tasaObjetivo, plazo_anios);
  const impacto = Math.max(0, dividendoActual - dividendoSugerido);

  return {
    pieSugerido_pct: pieSugerido,
    plazoSugerido_anios: plazoSugerido,
    tasaObjetivo_pct: tasaObjetivo,
    impactoCuotaMensual_clp: Math.round(impacto),
  };
}
