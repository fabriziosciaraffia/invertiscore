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

// D1 (Rama superficie AMBAS) — banda tipada refinada del veredicto comparativo.
// Añade STR_FRAGIL sobre los 3 valores de RecomendacionModalidadSTR: es el estado
// honesto cuando el flujo STR supera a LTR (sobre-renta ≥15%) PERO el break-even está
// en zona frágil (>90% del revenue de mercado). La `recomendacion` que consume el resto
// del sistema colapsa STR_FRAGIL → INDIFERENTE (backward-compat); la banda preserva el
// "por qué" para que la superficie muestre la advertencia sin inventar copy.
export type BandaComparativa =
  | "LTR_PREFERIDO"
  | "STR_VENTAJA_CLARA"
  | "STR_FRAGIL"
  | "INDIFERENTE";

export type ModoGestionAmbas = "auto" | "admin";

// D2 (Rama superficie AMBAS) — señal tipada del flip de gestión. El veredicto se emite
// en el modo elegido (base), pero el motor evalúa AMBOS modos (str_auto y str_admin ya
// se calculan para la comparativa). `cambiaVeredicto` marca cuando el toggle auto↔admin
// cruza una frontera de banda → hallazgo diferencial de primera línea para la Fase B.
export interface FlipGestionSignal {
  cambiaVeredicto: boolean;
  modoActual: ModoGestionAmbas;
  recomendacionAuto: RecomendacionModalidadSTR;
  recomendacionAdmin: RecomendacionModalidadSTR;
}

// D1 — veredicto comparativo tipado completo. `recomendacion` es el valor de 3 estados
// backward-compatible (== recomendacionModalidad persistido); `banda` es el refinamiento
// con STR_FRAGIL; `porAbsoluto` integra al tipo la ruta N/D de P3 (sobre-renta % no
// confiable → clasificada por CLP absoluto).
export interface VeredictoComparativo {
  recomendacion: RecomendacionModalidadSTR;
  banda: BandaComparativa;
  fragil: boolean;                      // ⟺ banda === "STR_FRAGIL"
  porAbsoluto: boolean;                 // ⟺ sobre-renta % no confiable (clasificado por CLP)
  breakEvenPctDelMercado: number;       // driver de la fragilidad (1.00 = break-even al mercado)
  sobreRentaPct: number;
  sobreRenta: number;                   // CLP (canónico cuando porAbsoluto)
  flipGestion: FlipGestionSignal;
}

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
// P3 (Rama 0b): umbral sobre el cual el % de sobre-renta deja de ser confiable. El pct es
// `sobreRenta / ltr_noiMensual`; cuando el NOI-LTR (denominador) es ≤0 o ínfimo, el ratio
// explota (+321%, +632%, −3483% en el corpus de calibración) y deja de ordenar bien. Por
// encima de este techo, o con NOI-LTR ≤0, la superficie muestra "N/D" + la sobre-renta
// ABSOLUTA (CLP) y la banda clasifica por signo/magnitud absolutos, no por el ratio.
// Doctrina Franco: número honesto o ninguno — nunca un % absurdo ni un clamp inventado.
export const SOBRE_RENTA_PCT_MAX_CONFIABLE = 3.0; // ±300%

// D1 (Rama superficie AMBAS) — cortes de break-even de la SEGUNDA condición. ≤90% del
// revenue de mercado = margen holgado (ventaja clara sostenible); (90%,110%] = frágil
// (degrada a INDIFERENTE con advertencia); >110% = data conflictiva (flujo alto sobre LTR
// pero STR no cubre costos ni al precio de mercado → INDIFERENTE, sin sello frágil). El
// corte 110% alinea con `corteFragil` de HallazgoSensibilidadStr (Gate-2 STR).
export const BREAK_EVEN_VENTAJA_MAX = 0.90;
export const BREAK_EVEN_FRAGIL_MAX = 1.10;

export function sobreRentaPctEsConfiable(
  ltrNoiMensual: number,
  sobreRentaPct: number,
): boolean {
  return ltrNoiMensual > 0 && Math.abs(sobreRentaPct) <= SOBRE_RENTA_PCT_MAX_CONFIABLE;
}

// D1 — segunda condición. La sobre-renta ya calificó ventaja clara (≥15% o degenerado con
// STR>LTR); el break-even decide si esa ventaja es holgada (CLARA), frágil (FRÁGIL) o
// insostenible (INDIFERENTE). Break-even ausente/no-finito ⇒ CLARA: no se puede evaluar
// fragilidad, se preserva el comportamiento pre-D1 (single condition) para callers legacy.
function refinarPorBreakEven(breakEvenPct: number | undefined): BandaComparativa {
  if (breakEvenPct == null || !Number.isFinite(breakEvenPct)) return "STR_VENTAJA_CLARA";
  if (breakEvenPct <= BREAK_EVEN_VENTAJA_MAX) return "STR_VENTAJA_CLARA";
  if (breakEvenPct <= BREAK_EVEN_FRAGIL_MAX) return "STR_FRAGIL";
  return "INDIFERENTE";
}

// Núcleo de clasificación de banda. La ruta break-even solo aplica cuando la sobre-renta
// ya calificaría como ventaja clara (≥15% o degenerado con STR>LTR).
function clasificarBanda(
  sobreRentaPct: number,
  tierZona: ZonaSTRScore["tierZona"] | undefined,
  breakEvenPct: number | undefined,
  degen?: { confiable: boolean; sobreRenta: number; strNoiMensual: number },
): BandaComparativa {
  // Zona baja → casi siempre LTR_PREFERIDO. La operación STR no se sostiene con poca
  // demanda; el riesgo operativo + ramp-up no se compensa.
  if (tierZona === "baja") return "LTR_PREFERIDO";

  // P3: ratio degenerado (NOI-LTR ≤0 o pct explotado). El % no ordena: −3483% caía en
  // LTR_PREFERIDO (< 0.05) aunque STR generaba MÁS NOI que LTR (bug 4ea0b582). Clasificamos
  // por la sobre-renta ABSOLUTA: si STR no supera a LTR → LTR_PREFERIDO; si supera y su NOI
  // propio es positivo → STR_VENTAJA_CLARA. D1: la segunda condición (break-even) NO toca esta
  // ruta — D1 ratificó "degenerado → comparación por absoluto"; la fragilidad solo refina la
  // ruta confiable ≥15%, donde el % ordena y el break-even es interpretable.
  if (degen && !degen.confiable) {
    if (degen.sobreRenta <= 0) return "LTR_PREFERIDO";
    return degen.strNoiMensual > 0 ? "STR_VENTAJA_CLARA" : "INDIFERENTE";
  }

  if (sobreRentaPct < 0.05) return "LTR_PREFERIDO";
  if (sobreRentaPct >= 0.15) return refinarPorBreakEven(breakEvenPct);
  return "INDIFERENTE";
}

// STR_FRAGIL e INDIFERENTE colapsan al valor de 3 estados que consume el resto del sistema.
function bandaAReco(banda: BandaComparativa): RecomendacionModalidadSTR {
  if (banda === "STR_VENTAJA_CLARA") return "STR_VENTAJA_CLARA";
  if (banda === "LTR_PREFERIDO") return "LTR_PREFERIDO";
  return "INDIFERENTE";
}

export function calcRecomendacionModalidad(
  sobreRentaPct: number,         // decimal (0.15 = +15% sobre LTR)
  tierZona: ZonaSTRScore["tierZona"] | undefined,
  // P3: contexto para clasificar por ABSOLUTO cuando el ratio degenera. Ausente ⇒ ruta clásica.
  degen?: { confiable: boolean; sobreRenta: number; strNoiMensual: number },
  // D1: break-even del modo evaluado (segunda condición). Ausente ⇒ sin degradación por
  // fragilidad (comportamiento pre-D1). El motor SIEMPRE lo aporta vía calcVeredictoComparativo.
  breakEvenPct?: number,
): RecomendacionModalidadSTR {
  return bandaAReco(clasificarBanda(sobreRentaPct, tierZona, breakEvenPct, degen));
}

// D1+D2 — veredicto comparativo tipado completo. Emite la banda refinada (con STR_FRAGIL),
// la señal N/D por absoluto (P3) y el flip de gestión (D2), todo desde datos que el motor
// STR ya calcula (str_auto/str_admin, break-even, sobre-renta del modo elegido). El
// break-even por modo se recomputa aquí con la misma fórmula del motor (costos+dividendo
// sobre 1−comisión), invariante al modo salvo la comisión.
export function calcVeredictoComparativo(input: {
  modoActual: ModoGestionAmbas;
  tierZona: ZonaSTRScore["tierZona"] | undefined;
  ltrNoiMensual: number;
  // modo elegido (escenario base)
  strNoiMensual: number;
  sobreRenta: number;
  sobreRentaPct: number;
  sobreRentaPctConfiable: boolean;
  breakEvenPctDelMercado: number;
  // flip: ambos modos
  strAutoNoiMensual: number;
  strAdminNoiMensual: number;
  breakEvenAutoPct: number;
  breakEvenAdminPct: number;
}): VeredictoComparativo {
  const banda = clasificarBanda(
    input.sobreRentaPct,
    input.tierZona,
    input.breakEvenPctDelMercado,
    { confiable: input.sobreRentaPctConfiable, sobreRenta: input.sobreRenta, strNoiMensual: input.strNoiMensual },
  );

  // Recomendación bajo cada modo de gestión, con su propia sobre-renta y break-even.
  const recoModo = (strNoi: number, bePct: number): RecomendacionModalidadSTR => {
    const sr = strNoi - input.ltrNoiMensual;
    const srPct = input.ltrNoiMensual !== 0 ? sr / input.ltrNoiMensual : 0;
    const conf = sobreRentaPctEsConfiable(input.ltrNoiMensual, srPct);
    return bandaAReco(clasificarBanda(srPct, input.tierZona, bePct, { confiable: conf, sobreRenta: sr, strNoiMensual: strNoi }));
  };
  const recomendacionAuto = recoModo(input.strAutoNoiMensual, input.breakEvenAutoPct);
  const recomendacionAdmin = recoModo(input.strAdminNoiMensual, input.breakEvenAdminPct);

  return {
    recomendacion: bandaAReco(banda),
    banda,
    fragil: banda === "STR_FRAGIL",
    porAbsoluto: !input.sobreRentaPctConfiable,
    breakEvenPctDelMercado: input.breakEvenPctDelMercado,
    sobreRentaPct: input.sobreRentaPct,
    sobreRenta: input.sobreRenta,
    flipGestion: {
      cambiaVeredicto: recomendacionAuto !== recomendacionAdmin,
      modoActual: input.modoActual,
      recomendacionAuto,
      recomendacionAdmin,
    },
  };
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
  // P3: contexto opcional para clasificar por absoluto cuando el ratio degenera. Ausente ⇒
  // se asume confiable (comportamiento previo).
  ltrNoiMensual?: number;
  sobreRenta?: number;
  strNoiMensual?: number;
  // D1: break-even del modo evaluado (segunda condición). Ausente ⇒ sin degradación por
  // fragilidad. En la práctica el motor persiste `recomendacionModalidad` (ya con D1
  // aplicado), así que el shortcut de arriba corta antes de este cálculo; el break-even
  // solo importa para filas legacy sin recomendacion persistida.
  breakEvenPctDelMercado?: number;
}): RecomendacionModalidadSTR {
  if (input.recomendacionModalidad) return input.recomendacionModalidad;
  const sobre = input.sobreRentaPct ?? 0;
  const tier = input.zonaSTR?.tierZona;
  const confiable =
    typeof input.ltrNoiMensual === "number"
      ? sobreRentaPctEsConfiable(input.ltrNoiMensual, sobre)
      : true;
  return calcRecomendacionModalidad(sobre, tier, {
    confiable,
    sobreRenta: input.sobreRenta ?? 0,
    strNoiMensual: input.strNoiMensual ?? 0,
  }, input.breakEvenPctDelMercado);
}
