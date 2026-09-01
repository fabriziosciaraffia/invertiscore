import { calcDividendo } from "./analysis";

// Doctrina: ver C:/Users/fabri/.claude/skills/analysis-voice-franco/SKILL.md §1.5.
// El motor produce señales numéricas (4 niveles); la presentación al usuario las
// agrupa en 3 escalones (validación silenciosa / observación táctica /
// reestructuración). Plazo y relación cuota/perfil quedan para v2.

// TODO(financingHealth/v2): hidratar MARKET_AVG_TASA_UF desde fuente real
// (BCCh, CMF, o tabla `market_data`/`config`). Hardcoded por ahora.
export const MARKET_AVG_TASA_UF = 4.1;

// EL ÓPTIMO FIJO DEL PIE MURIÓ (31-ago-2026). Era una constante convencional sin
// cálculo detrás —FASE 4.2 ya lo había retirado como referencia DIBUJADA, pero
// sobrevivió acá, que es la capa que alimenta a las de arriba— y contradecía a
// `simularPie`, cuya escalera casi nunca contiene el 25.
//
// Con él muere lo que derivaba: el pie sugerido de la reestructuración, su
// impacto en la cuota, y el `impact_message` del pie, que era la constante
// entregada al modelo YA REDACTADA ("subir el pie a 25% baja la cuota en $X al
// mes") — la forma más pura del problema, porque el modelo no la componía: la
// copiaba, y el prompt le mandaba usarla.
//
// La banda de `classifyPieLevel` NO cambia: clasificar no es sugerir, y su
// calibración es una pregunta aparte con su propia medición pendiente.

// Si la tasa está bajo el promedio, se reporta el impacto de bajarla 30 bps.
// Si está sobre, el impacto de bajarla al promedio.
const TASA_IMPROVEMENT_STEP_PCT = 0.3;

export type FinancingHealthLevel = "optimo" | "aceptable" | "mejorable" | "problematico";

export interface FinancingHealthDimension {
  level: FinancingHealthLevel;
  actual_pct: number;
  /** Referencia EXTERNA de la dimensión. Solo la tasa tiene una real (el promedio
   *  de mercado); el pie ya no tiene "recomendado" porque no existe tal cosa. */
  recommended_pct?: number;
  /** Cuánto baja la cuota al llevar esta dimensión a su referencia. Es un DATO,
   *  no una oración: antes acá viajaba `impact_message` con la frase ya escrita y
   *  el prompt mandaba usarla tal cual, que es cómo un número del motor terminaba
   *  copiado literal en secciones que lo tenían prohibido. */
  ahorro_mensual_clp?: number;
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

/**
 * Nivel del pie contra el estándar. FUENTE ÚNICA de la clasificación — exportada
 * para que el hallazgo de distancia al veredicto decida si el pie es una palanca
 * ofrecible sin re-declarar las bandas (y sin poder desalinearse de lo que el
 * hallazgo de estructura le dice al usuario en el mismo informe).
 */
export function classifyPieLevel(pie_pct: number): FinancingHealthLevel {
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


export function classifyFinancingHealth(input: ClassifyFinancingHealthInput, ufClp: number): FinancingHealth {
  const { pie_pct, tasa_pct, precio_uf, plazo_anios } = input;

  const precioCLP = precio_uf * ufClp;
  const creditoActualCLP = precioCLP * (1 - pie_pct / 100);
  const dividendoActual = calcDividendo(creditoActualCLP, tasa_pct, plazo_anios);

  // ── PIE ─────────────────────────────────────────────────────────────────
  // El pie solo se CLASIFICA. Ni recomendación ni impacto: el trade-off del pie lo
  // muestra la escalera de `simularPie`, con escalones reales y sin declarar un
  // óptimo, y esa escalera es lo que ve el lector.
  const pieLevel = classifyPieLevel(pie_pct);
  const pie: FinancingHealthDimension = {
    level: pieLevel,
    actual_pct: pie_pct,
  };

  // ── TASA ────────────────────────────────────────────────────────────────
  const spreadBps = Math.round((tasa_pct - MARKET_AVG_TASA_UF) * 100);
  const tasaLevel = classifyTasaLevel(spreadBps);

  let tasaAhorroMensual: number | undefined;
  if (tasaLevel !== "optimo") {
    // Bajar al promedio del mercado (caso común cuando hay spread sustantivo)
    const tasaMejor = Math.max(MARKET_AVG_TASA_UF, tasa_pct - TASA_IMPROVEMENT_STEP_PCT);
    const dividendoMejor = calcDividendo(creditoActualCLP, tasaMejor, plazo_anios);
    const ahorroMensual = dividendoActual - dividendoMejor;
    // DATO, no oración: el prompt recibe el ahorro y la referencia como campos y
    // el modelo redacta. La referencia de la tasa (MARKET_AVG_TASA_UF) es real y
    // se queda; lo que muere es entregar la frase hecha.
    if (ahorroMensual > 0) tasaAhorroMensual = Math.round(ahorroMensual);
  }

  const tasa: FinancingHealth["tasa"] = {
    level: tasaLevel,
    actual_pct: tasa_pct,
    recommended_pct: MARKET_AVG_TASA_UF,
    market_avg_pct: MARKET_AVG_TASA_UF,
    spread_bps: spreadBps,
    ahorro_mensual_clp: tasaAhorroMensual,
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
  plazoSugerido_anios: number;
  tasaObjetivo_pct: number;
}

/**
 * Calcula los 4 números deterministas de la reestructuración sugerida reusando
 * Puro y síncrono. Desde v14 devuelve SOLO plazo y tasa objetivo: el pie sugerido
 * y su impacto en la cuota murieron con la constante que los producía.
 */
export function buildReestructuracionFinanciera(
  input: ClassifyFinancingHealthInput,
): ReestructuracionFinanciera {
  const { tasa_pct, plazo_anios } = input;

  // SIN PIE SUGERIDO. Era `pie < 25 ? 25 : pie`, o sea la constante convencional,
  // y arrastraba consigo `impactoCuotaMensual_clp` — que medido sobre 343 filas
  // del parque resultó ser **97% efecto del pie**, en 92% de los casos lo único
  // que se movía. Sin un pie que sugerir ese impacto no tiene causa, así que
  // muere con él; el trade-off del pie lo muestra la escalera con escalones
  // reales.
  //
  // Tasa: bajar al promedio de mercado si está por encima. Fuente única: MARKET_AVG_TASA_UF.
  const tasaObjetivo = tasa_pct > MARKET_AVG_TASA_UF ? MARKET_AVG_TASA_UF : tasa_pct;

  // Plazo neutral: passthrough del valor del usuario (ver doctrina arriba).
  const plazoSugerido = plazo_anios;

  return {
    plazoSugerido_anios: plazoSugerido,
    tasaObjetivo_pct: tasaObjetivo,
  };
}
