// Universo de comunas del Gran Santiago para el benchmark STR — V2 (Goal 4 · 04-sep-2026).
//
// V1 (12-may-2026) era una tabla escrita a mano ("aproximación heurística"): quedaba ARRIBA
// del parque en 14 de 14 comunas con datos (mediana +8,3 pts de ocupación, máx +20,6) y con
// la decisividad real coronaba 236 de 238 informes por construcción. V2 se CALCULA desde las
// respuestas de mercado guardadas por dirección (mediana del p50 de ocupación y de tarifa por
// comuna, n ≥ 3 direcciones, cada valor con {valor, n, fecha}) y vive en el archivo generado
// `str-universo-santiago.gen.ts`. Regenerar:
//   node --env-file=.env.local --import tsx scripts/data/generar-str-universo.ts
//
// Quién lee qué:
//   · `calcZonaSTR` → percentiles del p50 de la dirección contra la distribución V2 (una
//     entrada por comuna con datos) + tier alta/media/baja + el CONTEXTO comunal de la
//     ocupación (`ocupacionVsComuna`) que La zona muestra como "tu zona ocupa más/menos
//     que lo típico de la comuna". La comparación con la comuna ya no es un hallazgo.
//   · `datosComunaSTR(comuna)` → {ocupacion, adr} con n y fecha, o null = "sin datos
//     suficientes" (menos de 3 direcciones o comuna fuera del Gran Santiago).
//   · `STR_UNIVERSO_ADR/OCC/REVENUE` se derivan de V2 para los consumidores que siguen
//     leyendo un Record<comuna, number> (guards, scripts). Mismo dato, otra forma.
//
// El copy visible dice "datos de mercado"; el proveedor no se nombra al usuario.

import { STR_UNIVERSO_V2, type DatoComunaSTR, type UniversoComunaSTR } from "./str-universo-santiago.gen";
export { STR_UNIVERSO_V2, STR_UNIVERSO_V2_META } from "./str-universo-santiago.gen";
export type { DatoComunaSTR, UniversoComunaSTR } from "./str-universo-santiago.gen";

const ALIAS_COMUNA: Record<string, string> = { "Santiago Centro": "Santiago" };

/** Datos V2 de una comuna, o null = sin datos suficientes. Acepta el alias "Santiago Centro". */
export function datosComunaSTR(comuna: string | null | undefined): UniversoComunaSTR | null {
  if (!comuna) return null;
  return STR_UNIVERSO_V2[ALIAS_COMUNA[comuna] ?? comuna] ?? null;
}

// Tarifa por noche mediana por comuna (CLP), derivada de V2.
export const STR_UNIVERSO_ADR: Record<string, number> = Object.fromEntries(
  Object.entries(STR_UNIVERSO_V2).map(([c, d]) => [c, d.adr.valor]),
);

// Ocupación mediana por comuna (decimal 0-1), derivada de V2.
export const STR_UNIVERSO_OCC: Record<string, number> = Object.fromEntries(
  Object.entries(STR_UNIVERSO_V2).map(([c, d]) => [c, d.ocupacion.valor]),
);

// Ingreso bruto mensual por comuna (CLP) = ADR × ocupación × 30. Redundante con los dos
// de arriba, pero precalcularlo evita que UI/IA inventen cálculos al vuelo.
export const STR_UNIVERSO_INGRESO: Record<string, number> = Object.fromEntries(
  Object.entries(STR_UNIVERSO_V2).map(([c, d]) => [c, Math.round(d.adr.valor * d.ocupacion.valor * 30)]),
);

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

/** Umbral de "similar" para la lectura ocupación de la dirección vs mediana comunal, en puntos. */
export const OCC_VS_COMUNA_SIMILAR_PTS = 2;

export type OcupacionVsComuna = "mas" | "menos" | "similar" | "sin_datos";

export interface ZonaSTRScore {
  /** Comuna evaluada. Sin datos V2 ⇒ `comunaNoListada` y contexto comunal "sin_datos". */
  comuna: string;
  /** Tarifa por noche de la dirección (p50 de la estimación de mercado). */
  adrZona: number;
  /** Ocupación de la dirección (p50 de la estimación de mercado). */
  occZona: number;
  /** Ingreso bruto mensual estabilizado = adr × occ × 30. */
  ingresoZonaMensual: number;
  /** Percentil de ADR vs las comunas con datos (0-100). */
  percentilADR: number;
  /** Percentil de ocupación vs las comunas con datos. */
  percentilOcupacion: number;
  /** Percentil de ingreso mensual vs las comunas con datos. */
  percentilIngreso: number;
  /** Tier agregado: alta (>=70 avg), media (40-70), baja (<40). */
  tierZona: "alta" | "media" | "baja";
  /** Score zona 0-100 (promedio simple de los 3 percentiles). */
  score: number;
  /** True si la comuna no tiene datos suficientes en V2 (n < 3): los percentiles se calculan igual, el contexto comunal no. */
  comunaNoListada: boolean;
  // ── Contexto comunal V2 (Goal 4) — lo que La zona muestra. Opcionales porque `zonaSTR` se
  //    persiste en `results` y las filas anteriores a V2 no los traen. ──
  /** Ocupación mediana de la comuna con n y fecha, si hay datos suficientes. */
  comunaOcupacion?: DatoComunaSTR;
  /** Tarifa por noche mediana de la comuna con n y fecha, si hay datos suficientes. */
  comunaAdr?: DatoComunaSTR;
  /** "tu zona ocupa más/menos/parecido que lo típico de la comuna", o sin datos. */
  ocupacionVsComuna?: OcupacionVsComuna;
  /** occZona − comuna, en puntos (redondeado); null sin datos. */
  ocupacionVsComunaPts?: number | null;
}

/**
 * Score zona STR de una dirección contra las comunas con datos (V2).
 *
 * Inputs:
 *  - comuna: para el contexto comunal + flag "sin datos suficientes".
 *  - adrZona / occZona: p50 de la estimación de mercado para la dirección (el motor los
 *    saca de airbnbData.percentiles.*.p50).
 *
 * Los percentiles se calculan siempre (los valores absolutos sí están en la distribución);
 * el contexto comunal solo cuando la comuna tiene n ≥ 3 direcciones.
 */
export function calcZonaSTR(
  comuna: string,
  adrZona: number,
  occZona: number,
): ZonaSTRScore {
  const adrUniverso = Object.values(STR_UNIVERSO_ADR);
  const occUniverso = Object.values(STR_UNIVERSO_OCC);
  const ingresoUniverso = Object.values(STR_UNIVERSO_INGRESO);
  const ingresoZona = Math.round(adrZona * occZona * 30);

  const percentilADR = percentileRank(adrUniverso, adrZona);
  const percentilOcupacion = percentileRank(occUniverso, occZona);
  const percentilIngreso = percentileRank(ingresoUniverso, ingresoZona);

  // Score agregado: media simple. El ingreso ya combina ADR+occ pero los 3 percentiles
  // capturan dimensiones distintas (ADR alto con baja ocupación, o viceversa).
  const score = Math.round((percentilADR + percentilOcupacion + percentilIngreso) / 3);

  let tierZona: ZonaSTRScore["tierZona"];
  if (score >= 70) tierZona = "alta";
  else if (score >= 40) tierZona = "media";
  else tierZona = "baja";

  const datos = datosComunaSTR(comuna);
  const pts = datos ? Math.round((occZona - datos.ocupacion.valor) * 100) : null;
  const ocupacionVsComuna: OcupacionVsComuna =
    pts === null ? "sin_datos" : Math.abs(pts) <= OCC_VS_COMUNA_SIMILAR_PTS ? "similar" : pts > 0 ? "mas" : "menos";

  return {
    comuna,
    adrZona: Math.round(adrZona),
    occZona: Math.round(occZona * 1000) / 1000,
    ingresoZonaMensual: ingresoZona,
    percentilADR,
    percentilOcupacion,
    percentilIngreso,
    tierZona,
    score,
    comunaNoListada: datos === null,
    comunaOcupacion: datos?.ocupacion,
    comunaAdr: datos?.adr,
    ocupacionVsComuna,
    ocupacionVsComunaPts: pts,
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
// en zona frágil (>90% del ingreso de mercado). La `recomendacion` que consume el resto
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
// ingreso de mercado = margen holgado (ventaja clara sostenible); (90%,110%] = frágil
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

// Núcleo de clasificación de banda — UNA fuente: la sobre-renta medida (el mismo dato del
// hallazgo `ventaja_vs_ltr`). El SIGNO dice qué modalidad rinde más neto; la MAGNITUD, cuánto.
//   • ≤ −5%      → LTR_PREFERIDO   (el largo rinde más neto por un margen que se nota)
//   • (−5%, 15%) → INDIFERENTE     (parejo: la decisión es operativa, no de rentabilidad)
//   • ≥ 15%      → STR_VENTAJA_CLARA, refinada por el break-even medido (FRÁGIL / INDIFERENTE)
// El tier de zona NO veta ni ordena: es contexto de La zona (`zonaSTR.tierZona`). Antes
// (`tierZona === "baja" → LTR_PREFERIDO`) 51 de 245 filas del parque recomendaban LTR con
// STR rindiendo MÁS que LTR, y la prosa lo copiaba ("el largo rinde más neto" con signo
// contrario al hallazgo). El parámetro se conserva por firma (callers AMBAS) y no se lee.
// La ruta break-even solo aplica cuando la sobre-renta ya califica ventaja clara
// (≥15% o degenerado con STR>LTR).
export const SOBRE_RENTA_LTR_PREFERIDO_MAX = -0.05;
export const SOBRE_RENTA_STR_CLARA_MIN = 0.15;

function clasificarBanda(
  sobreRentaPct: number,
  _tierZonaContexto: ZonaSTRScore["tierZona"] | undefined,
  breakEvenPct: number | undefined,
  degen?: { confiable: boolean; sobreRenta: number; strNoiMensual: number },
): BandaComparativa {
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

  if (sobreRentaPct <= SOBRE_RENTA_LTR_PREFERIDO_MAX) return "LTR_PREFERIDO";
  if (sobreRentaPct >= SOBRE_RENTA_STR_CLARA_MIN) return refinarPorBreakEven(breakEvenPct);
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
  // Contexto de zona. Desde 04-sep-2026 NO decide la recomendación (ver clasificarBanda);
  // se conserva en la firma para no tocar a los callers AMBAS/comparativa.
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
 * `recomendacionModalidad` ni `zonaSTR` en results. Reusa la misma regla:
 * la recomendación sale del signo y la magnitud de la sobre-renta medida.
 *
 * Pasos:
 *  1) Si el STR result ya tiene `recomendacionModalidad`, devolverla.
 *  2) Si no, decidir por sobreRentaPct (y por absoluto si el ratio degenera).
 *     El tier de zona se pasa como contexto y no altera el resultado.
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
