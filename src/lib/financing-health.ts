import { calcDividendo, getUFCLP } from "./analysis";

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

const LEVEL_RANK: Record<FinancingHealthLevel, number> = {
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

export function classifyFinancingHealth(input: ClassifyFinancingHealthInput): FinancingHealth {
  const { pie_pct, tasa_pct, precio_uf, plazo_anios } = input;

  const ufClp = getUFCLP();
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
