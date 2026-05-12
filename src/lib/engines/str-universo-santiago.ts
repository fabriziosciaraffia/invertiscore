// Universo de comunas Santiago para benchmark STR — calibración V1
// (Commit 4 · 2026-05-12).
//
// CAVEAT: estos valores son una aproximación HEURÍSTICA basada en data
// agregada de AirROI conocida + experiencia de mercado. NO son el resultado
// de un cálculo dinámico sobre la base de análisis ya creados en la
// plataforma. Sirven para emitir un veredicto honesto sobre la fortaleza
// STR de la zona — alta/media/baja — sin invocar datos externos en runtime.
//
// V2 (futura) debería:
//   1. Calcular medianas reales por comuna desde la tabla `analisis` de
//      todos los STR ya creados (al menos N=20 por comuna para evitar
//      sesgo de muestra chica).
//   2. Refrescar cada trimestre.
//   3. Ponderar por superficie/dormitorios para que el percentil refleje
//      tipologías comparables.
//
// La función de scoring `calcZonaSTR` consume estos valores + airbnbData.p50
// de la propiedad analizada y devuelve percentiles + tier zona + score 0-100.
//
// Comuna no listada → fallback a percentil 50 (no penaliza ni premia — la
// zona se considera "media" hasta tener data).

// ADR p50 estabilizado (CLP/noche, departamento 1-2D promedio).
// Fuente: experiencia mercado AirROI + listings públicos Airbnb 2024-2025.
export const STR_UNIVERSO_ADR: Record<string, number> = {
  // Sector alta — turismo premium + corporativo + clínicas
  "Las Condes": 65000,
  "Vitacura": 70000,
  "Lo Barnechea": 62000,
  "Providencia": 55000,

  // Sector medio-alto — turismo + university + business
  "Santiago": 45000,
  "Ñuñoa": 42000,
  "La Reina": 42000,
  "Recoleta": 40000,

  // Sector medio — residencial conectado / turismo segundario
  "San Miguel": 36000,
  "Independencia": 35000,
  "Macul": 35000,

  // Sector bajo — residencial periferia / poca demanda turística
  "Estación Central": 32000,
  "Quinta Normal": 30000,
  "Maipú": 28000,
  "La Florida": 28000,
  "Puente Alto": 26000,
  "Quilicura": 26000,
  "San Bernardo": 25000,
};

// Ocupación estabilizada anual (decimal 0-1). Las zonas con más turismo +
// business mantienen ocupación más alta todo el año; periferia residencial
// cae en valles fuertes.
export const STR_UNIVERSO_OCC: Record<string, number> = {
  "Las Condes": 0.65,
  "Vitacura": 0.62,
  "Lo Barnechea": 0.55,
  "Providencia": 0.62,
  "Santiago": 0.58,
  "Ñuñoa": 0.52,
  "La Reina": 0.50,
  "Recoleta": 0.58,
  "San Miguel": 0.48,
  "Independencia": 0.50,
  "Macul": 0.47,
  "Estación Central": 0.45,
  "Quinta Normal": 0.42,
  "Maipú": 0.40,
  "La Florida": 0.42,
  "Puente Alto": 0.38,
  "Quilicura": 0.38,
  "San Bernardo": 0.36,
};

// Revenue mensual estabilizado por defecto (CLP), derivado de ADR × Occ ×
// 30. Es redundante con ADR + Occ, pero precalcularlo evita que UI/IA
// inviente cálculos al vuelo.
export const STR_UNIVERSO_REVENUE: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const c of Object.keys(STR_UNIVERSO_ADR)) {
    const adr = STR_UNIVERSO_ADR[c];
    const occ = STR_UNIVERSO_OCC[c] ?? 0.5;
    out[c] = Math.round(adr * occ * 30);
  }
  return out;
})();

// ─── Helpers ──────────────────────────────────────────────

/** Percentil de un valor dentro de una distribución (array de números).
 * Devuelve 0-100. Implementación clásica (rank-based). */
function percentileRank(values: number[], v: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  // Fórmula percentil rank (continua) — bien-comportada en empates.
  return Math.round(((below + 0.5 * equal) / sorted.length) * 100);
}

export interface ZonaSTRScore {
  /** Comuna evaluada. Si no está en el universo, percentiles = 50. */
  comuna: string;
  /** ADR de la zona (p50 de AirROI para esta dirección). */
  adrZona: number;
  /** Ocupación de la zona (p50 de AirROI). */
  occZona: number;
  /** Revenue mensual estabilizado = adr × occ × 30. */
  revenueZonaMensual: number;
  /** Percentil de ADR vs universo Santiago (0-100). */
  percentilADR: number;
  /** Percentil de ocupación vs universo. */
  percentilOcupacion: number;
  /** Percentil de revenue mensual vs universo. */
  percentilRevenue: number;
  /** Tier agregado: alta (>=70 avg), media (40-70), baja (<40). */
  tierZona: "alta" | "media" | "baja";
  /** Score zona 0-100 (promedio simple de los 3 percentiles). */
  score: number;
  /** True si la comuna NO está en el universo — el score cae al fallback 50. */
  comunaNoListada: boolean;
}

/**
 * Calcula el score zona STR de una propiedad vs universo Santiago.
 *
 * Inputs:
 *  - comuna: usado para fallback narrativo + flag de "no listada".
 *  - adrZona / occZona: vienen de airbnbData.percentiles.*.p50 del motor
 *    (representan el mid-point del micro-cluster que devuelve AirROI).
 *
 * Output: percentiles + tier + score agregado. Si la comuna no está en el
 * universo, el percentil se calcula igual (los valores absolutos sí están
 * en la distribución), pero `comunaNoListada=true` para que la UI/IA
 * pueda atenuar el caveat.
 */
export function calcZonaSTR(
  comuna: string,
  adrZona: number,
  occZona: number,
): ZonaSTRScore {
  const adrUniverso = Object.values(STR_UNIVERSO_ADR);
  const occUniverso = Object.values(STR_UNIVERSO_OCC);
  const revenueUniverso = Object.values(STR_UNIVERSO_REVENUE);
  const revenueZona = Math.round(adrZona * occZona * 30);

  const percentilADR = percentileRank(adrUniverso, adrZona);
  const percentilOcupacion = percentileRank(occUniverso, occZona);
  const percentilRevenue = percentileRank(revenueUniverso, revenueZona);

  // Score agregado: media simple. El revenue ya combina ADR+occ pero los
  // 3 percentiles capturan dimensiones ligeramente distintas (zona puede
  // tener ADR alto pero baja ocupación, o viceversa).
  const score = Math.round((percentilADR + percentilOcupacion + percentilRevenue) / 3);

  let tierZona: ZonaSTRScore["tierZona"];
  if (score >= 70) tierZona = "alta";
  else if (score >= 40) tierZona = "media";
  else tierZona = "baja";

  return {
    comuna,
    adrZona: Math.round(adrZona),
    occZona: Math.round(occZona * 1000) / 1000,
    revenueZonaMensual: revenueZona,
    percentilADR,
    percentilOcupacion,
    percentilRevenue,
    tierZona,
    score,
    comunaNoListada: !(comuna in STR_UNIVERSO_ADR),
  };
}

// ─── Recomendación modalidad STR vs LTR ────────────────────────

export type RecomendacionModalidadSTR =
  | "LTR_PREFERIDO"
  | "STR_VENTAJA_CLARA"
  | "INDIFERENTE";

/**
 * Compara el flujo NETO STR vs LTR + el tier de zona para emitir una
 * recomendación honesta de modalidad. El STR exige gestión activa (~8-12
 * hrs/semana auto o 20% admin), así que el upside debe justificar el
 * esfuerzo: usamos margen de 15% sobre LTR como umbral mínimo.
 *
 * Reglas:
 *  - LTR_PREFERIDO: sobre-renta STR vs LTR < +5% NETO, O tier zona = "baja".
 *    Honesto: si la zona no tracciona STR, mejor LTR.
 *  - STR_VENTAJA_CLARA: sobre-renta >= +15% NETO Y tier != "baja".
 *  - INDIFERENTE: sobre-renta entre +5% y +15%, o STR > +15% pero tier "baja"
 *    (data conflictiva).
 */
export function calcRecomendacionModalidad(
  sobreRentaPct: number,         // decimal (0.15 = +15% sobre LTR)
  tierZona: ZonaSTRScore["tierZona"],
): RecomendacionModalidadSTR {
  // Zona baja → casi siempre LTR_PREFERIDO. La operación STR no se sostiene
  // con poca demanda; el riesgo operativo + ramp-up no se compensa.
  if (tierZona === "baja") return "LTR_PREFERIDO";

  if (sobreRentaPct < 0.05) return "LTR_PREFERIDO";
  if (sobreRentaPct >= 0.15) return "STR_VENTAJA_CLARA";
  return "INDIFERENTE";
}

/**
 * Fallback para análisis legacy pre-Commit 4 que no tienen
 * `recomendacionModalidad` ni `zonaSTR` en results. Reusa la misma lógica
 * de umbral pero asume tier "media" cuando la zona no está clasificada.
 *
 * Pasos:
 *  1) Si el STR result ya tiene `recomendacionModalidad`, devolverla.
 *  2) Si tiene `zonaSTR.tierZona`, aplicar regla completa.
 *  3) Si no, asumir tier "media" y decidir solo por sobreRentaPct.
 *
 * Único lugar canónico para esta lógica — usar acá tanto en server
 * (endpoint comparativa/ai) como en cliente (comparativa-client) para
 * evitar divergencias entre lo que ve el Hero y lo que recibe la IA.
 */
export function deriveRecomendacionModalidad(input: {
  recomendacionModalidad?: RecomendacionModalidadSTR;
  zonaSTR?: { tierZona?: ZonaSTRScore["tierZona"] };
  sobreRentaPct?: number;
}): RecomendacionModalidadSTR {
  if (input.recomendacionModalidad) return input.recomendacionModalidad;
  const sobre = input.sobreRentaPct ?? 0;
  const tier = input.zonaSTR?.tierZona;
  if (tier === "baja") return "LTR_PREFERIDO";
  if (sobre < 0.05) return "LTR_PREFERIDO";
  if (sobre >= 0.15) return "STR_VENTAJA_CLARA";
  return "INDIFERENTE";
}
