// Type-only (erased en compilación → sin ciclo en runtime). El nivel canónico de
// salud de financiamiento lo define financing-health.ts; el Hallazgo de estructura
// lo reusa tal cual.
import type { FinancingHealthLevel } from "./financing-health";

export interface Desglose {
  rentabilidad: number;
  plusvalia: number;
  eficiencia: number;
  flujoCaja: number;
  riesgo?: number; // legacy: kept for backward compatibility with old saved analyses
}

export interface AnalisisInput {
  nombre: string;
  comuna: string;
  ciudad: string;
  direccion?: string;
  tipo: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  superficieTotal: number;
  antiguedad: number;
  enConstruccion: boolean;
  piso: number;
  estacionamiento: string;
  precioEstacionamiento: number;
  bodega: boolean;
  estadoVenta: "inmediata" | "futura";
  fechaEntrega?: string;
  cuotasPie: number;
  montoCuota: number;
  precio: number;
  valorMercadoUsuario?: number;  // Lo que el usuario estima (referencial)
  valorMercadoFranco?: number;   // Sugerencia de Franco basada en datos reales (para cálculos)
  piePct: number;
  plazoCredito: number;
  tasaInteres: number;
  gastos: number;
  contribuciones: number;
  provisionMantencion: number;
  tipoRenta: "larga";
  arriendo: number;
  arriendoEstacionamiento: number;
  arriendoBodega: number;
  vacanciaMeses: number;
  // Administración de arriendo (property management)
  usaAdministrador?: boolean;
  comisionAdministrador?: number;
  // Override opt-in del CapEx de puesta a punto (CLP). Si viene, el motor lo usa
  // tal cual (origen='override') en lugar de la curva por antigüedad. Sin UI esta
  // sesión — el motor solo lo lee si el caller lo setea.
  costoPuestaAPuntoCLP?: number;
}

export interface MonthlyCashflow {
  mes: number;
  ingreso: number;
  dividendo: number;
  gastos: number;
  contribuciones: number;
  mantencion: number;
  vacancia: number;
  corretaje: number;
  administracion: number;
  egresoTotal: number;
  flujoNeto: number;
  acumulado: number;
}

export interface YearProjection {
  anio: number;
  arriendoMensual: number;
  flujoAnual: number;
  flujoAcumulado: number;
  valorPropiedad: number;
  saldoCredito: number;
  patrimonioNeto: number;
}

export interface ExitScenario {
  anios: number;
  valorVenta: number;
  saldoCredito: number;
  comisionVenta: number;
  gananciaNeta: number;
  flujoAcumulado: number;
  retornoTotal: number;
  multiplicadorCapital: number;
  tir: number;
  // Concepto "plata que realmente pusiste" a lo largo del plazo
  inversionInicial: number;              // pie + gastos cierre (día 1)
  flujoMensualAcumuladoNegativo: number; // suma absoluta de años con flujo neto negativo
  totalAportado: number;                 // inversionInicial + flujoMensualAcumuladoNegativo
  gananciaSobreTotal: number;            // gananciaNeta - totalAportado
  porcentajeGananciaSobreTotal: number;  // (gananciaSobreTotal / totalAportado) * 100
}

export interface RefinanceScenario {
  nuevoAvaluo: number;
  nuevoCredito: number;
  capitalLiberado: number;
  nuevoDividendo: number;
  nuevoFlujoNeto: number;
}

export interface SensitivityRow {
  variable: string;
  variacion: string;
  nuevoScore: number;
  nuevoFlujo: number;
  delta: number;
}

export interface AnalysisMetrics {
  rentabilidadBruta: number;
  rentabilidadNeta: number;
  capRate: number;
  cashOnCash: number;
  precioM2: number;
  mesesPaybackPie: number;
  dividendo: number;
  flujoNetoMensual: number;
  noi: number;
  pieCLP: number;
  precioCLP: number;
  ingresoMensual: number;
  egresosMensuales: number;
  // Snapshots año-1 expuestos por calcMetrics. Antes calcMetrics MUTABA input
  // con valores derivados cuando el usuario no declaraba; hoy esos valores
  // viven sólo en metrics y el input queda intacto (ver Sesión B1 +
  // audit/sesionA-diagnostico/diagnostico.md hallazgo colateral #5).
  // Si el usuario declaró el valor, manda lo declarado; si no, se infiere.
  provisionMantencionAjustada: number;
  contribuciones: number;     // trimestral (mismo formato que input.contribuciones)
  gastos: number;             // mensual (mismo formato que input.gastos / GGCC)
  // Plusvalía inmediata
  valorMercadoFrancoUF?: number;       // para cálculos (datos reales)
  valorMercadoUsuarioUF?: number;      // referencial (estimación usuario)
  plusvaliaInmediataFranco?: number;    // CLP vs datos reales
  plusvaliaInmediataFrancoPct?: number;
  plusvaliaInmediataUsuario?: number;   // CLP vs estimación usuario
  plusvaliaInmediataUsuarioPct?: number;
  // Precios de equilibrio
  precioFlujoNeutroCLP?: number;
  precioFlujoNeutroUF?: number;
  precioFlujoPositivoCLP?: number;
  precioFlujoPositivoUF?: number;
  descuentoParaNeutro?: number;     // %
  // Subsidio a la tasa (Ley 21.748)
  subsidioTasa?: {
    califica: boolean;        // tipo Nuevo && precio <= 4000 UF
    tasaConSubsidio: number;  // tasa mercado - 0.6
    aplicado: boolean;        // si la tasa ingresada <= tasaConSubsidio + 0.2
  };
  // CapEx de puesta a punto (usados) — ya incorporado a capitalInvertido.
  // Opcional para back-compat con metrics construidos fuera de calcMetrics
  // (enrich-legacy, mocks). Consumidores leen con `?? 0`.
  capexPuestaAPuntoCLP?: number;
  // Proto-hallazgo tipado emitido por el motor (null si Nuevo / CapEx 0).
  hallazgoPuestaAPunto?: HallazgoPuestaAPunto | null;
  // Proto-hallazgo de cap rate (LTR). null si el cap rate no es computable
  // (precio o arriendo ≤ 0). Carrier interno; se empuja a results.hallazgos.
  hallazgoCapRate?: HallazgoCapRate | null;
  // Proto-hallazgo de flujo mensual (LTR). null si no hay dividendo computable
  // (>0). Carrier interno; se empuja a results.hallazgos.
  hallazgoFlujoMensual?: HallazgoFlujoMensual | null;
  // Proto-hallazgo de plusvalía (LTR). Reusa la tasa histórica per-comuna que usa
  // el scoring (:823-824); cae al promedio Gran Santiago sin dato propio. null
  // solo si la tasa no es finita. Carrier interno; se empuja a results.hallazgos.
  hallazgoPlusvalia?: HallazgoPlusvalia | null;
  // Comparación UF/m² del sujeto (SIN estacionamiento) vs mediana comunal de
  // VENTA. Fuente ÚNICA de la cifra UF/m² del sujeto para narración/anomalías/
  // hero; se computa una vez vía buildPrecioVsComuna. desviacionPct null si no
  // hay mediana confiable. (FASE A: solo el cómputo; FASE B construye el hallazgo.)
  precioVsComuna?: PrecioVsComuna | null;
  // Proto-hallazgo de sobreprecio (LTR). Lo construye buildHallazgoSobreprecio
  // sobre precioVsComuna; null si la mediana comunal no es confiable (sin dato de
  // zona, o recompute sin mediana inyectada). Carrier interno; se empuja a
  // results.hallazgos cuando la mediana está disponible (sobreprecio-sync).
  hallazgoSobreprecio?: HallazgoSobreprecio | null;
}

// Comparación determinística de precio/m² del sujeto vs mediana comunal de VENTA
// (UF/m²). NO es un hallazgo (FASE A): la empaqueta el builder puro
// buildPrecioVsComuna (precio-vs-comuna.ts). FASE B construirá el hallazgo encima.
export interface PrecioVsComuna {
  /** Precio depto / superficie, SIN estacionamiento (base comparable a la mediana comunal). NO es metrics.precioM2. */
  sujetoUfM2: number;
  /** Mediana de venta UF/m² de la comuna, ya resuelta por el caller. null si no hay dato confiable. */
  medianaComunaUfM2: number | null;
  /** (sujeto − mediana) / mediana × 100, entero. null si !confiable. */
  desviacionPct: number | null;
  /** sujeto − mediana, en UF/m² a 1 decimal. null si !confiable. */
  sobreprecioUfM2: number | null;
  /** true cuando hay mediana comunal de venta confiable (>0). */
  confiable: boolean;
  /** N de ventas válidas usadas para la mediana (0 si no hay). */
  n: number;
}

// Proto-hallazgo tipado — CapEx de puesta a punto para usados. NO es un type
// global `Hallazgo<T>`: es la primera (y única) instancia bien formada de la
// futura capa de hallazgos. Sin emisor-ordenado ni rendering acá: el motor lo
// siembra y la IA lo narra aguas abajo. Ver skill analysis-voice-franco.
export interface HallazgoPuestaAPunto {
  id: "capex_puesta_a_punto";
  tipo: "capex_habilitacion";
  valor: {
    montoCLP: number;
    montoUF: number;
    ufM2: number;
    antiguedadAnios: number;
    superficieUtilM2: number;
    modalidad: "ltr" | "str" | "ambas";
    origen: "derivado" | "override";
    // Fracción de la inversión inicial que se va a CapEx (0..1). Cantidad DISPLAY
    // ("X% de tu plata día 1", card/drawer). Antes vivía en `decisividad`; con la
    // calibración E2 esa pasó a ser "Δdecisión", así que la fracción vive acá.
    fraccionInversion: number;
  };
  // Nunca 'favorable': una puesta a punto siempre resta de tu plata día 1.
  direccion: "adverso" | "neutral";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25, 0..1) — SOLO para desempatar el sort
  // de la pirámide/hero entre factores con la misma decisividad (E4). NO es el peso.
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — CAP rate (rentabilidad operativa) para LTR. Misma
// forma que HallazgoPuestaAPunto: el motor envuelve el número que YA calcula
// (analysis.ts:250) sin recalcularlo, lo compara contra una referencia de
// mercado (getCapRefComuna) y emite decisividad + dirección determinísticas.
// La IA lo narra aguas abajo. Ver cap-rate-hallazgo.ts.
export interface HallazgoCapRate {
  id: "cap_rate";
  tipo: "rentabilidad_operativa";
  valor: {
    capRatePct: number;   // cap rate del sujeto, % NETO (NOI) — reusado de :250
    capRefPct: number;    // referencia de mercado contra la que se compara
    gapPts: number;       // capRatePct − capRefPct, en puntos (signed)
    banda: number;        // banda de saturación de la decisividad, en puntos
    fuente: string;       // procedencia de la referencia (auditoría de la brecha)
    scope: "nacional" | "comuna";
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable si capRate ≥ referencia; adverso si <. (La frase puede decir "en
  // línea" cuando |gap| es mínimo, pero la señal-máquina es binaria.)
  direccion: "favorable" | "adverso";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25) — SOLO desempate secundario del sort (E4).
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — flujo mensual (aporte de bolsillo) para LTR. Misma
// forma que los anteriores: el motor envuelve el aporte que YA calcula
// (analysis.ts:242) sin recalcularlo. A diferencia de cap_rate NO hay referencia
// externa — el número sale de inputs del usuario vía motor (confianza "alta").
// La decisividad es |aporte| / dividendo saturado a 1 (espejo del Gate 1 del
// veredicto, :1225). La IA lo narra aguas abajo. Ver flujo-mensual-hallazgo.ts.
export interface HallazgoFlujoMensual {
  id: "flujo_mensual";
  tipo: "aporte_mensual";
  valor: {
    flujoNetoMensualCLP: number;   // aporte mensual neto, CLP signed — reusado de :242
    dividendoMensualCLP: number;   // divisor de la decisividad (:224)
    ratioSobreDividendo: number;   // |aporte| / dividendo, pre-saturación (≥0)
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable si el aporte ≥ 0 (el arriendo cubre todo); adverso si < 0 (pones
  // plata de tu bolsillo). El signo NO determina decisividad — la magnitud sí.
  direccion: "favorable" | "adverso";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25) — SOLO desempate secundario del sort (E4).
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — SOBREPRECIO vs comuna (precio/m² del sujeto vs mediana
// comunal de venta). Su desviación depende de la mediana comunal, que se resuelve
// ASYNC (getComunaMedianaVentaUF). El motor lo siembra sync en results.hallazgos
// cuando recibe la mediana INYECTADA (prefetchMedianaComunaVenta en creación,
// recalculate y el recompute del render — sobreprecio-sync); si la mediana no está
// disponible, queda null y no se siembra. Sigue construyéndose también en
// AI-GENERATION y persistiéndose en ai_analysis (AIAnalysisV2.hallazgoSobreprecio)
// por ahora — la limpieza del path viejo es un paso aparte. Reusa
// metrics.precioVsComuna (FASE A, buildPrecioVsComuna) — no recalcula nada.
// Ver sobreprecio-hallazgo.ts.
export interface HallazgoSobreprecio {
  id: "sobreprecio";
  tipo: "precio_vs_comuna";
  valor: {
    sujetoUfM2: number;          // precio/superficie SIN estac — reusado de precioVsComuna
    medianaComunaUfM2: number;   // mediana comunal de venta UF/m² (ya resuelta async)
    desviacionPct: number;       // (sujeto − mediana)/mediana × 100, entero — FUENTE ÚNICA
    sobreprecioUfM2: number;     // sujeto − mediana, en UF/m² a 1 decimal
    banda: number;               // banda de saturación de la decisividad, en %
    n: number;                   // N de ventas usadas para la mediana
  };
  // DIRECCIÓN INVERTIDA respecto a cap_rate/flujo: en o BAJO la mediana =
  // favorable (entras barato); SOBRE la mediana = adverso (pagas caro). Más caro
  // = peor. (La frase puede decir "en línea" cuando |desv| ≤ 2; la señal-máquina
  // es binaria: favorable si desv ≤ 0.)
  direccion: "favorable" | "adverso";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25) — SOLO desempate secundario del sort (E4).
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — PLUSVALÍA (apreciación histórica de la comuna) para
// LTR. Misma forma que HallazgoCapRate: el motor envuelve la tasa histórica
// anualizada que YA usa el scoring (analysis.ts:823-824) sin recalcularla, la
// compara contra un UMBRAL ABSOLUTO de apreciación real (getPlusvaliaRef) y emite
// decisividad + dirección determinísticas. Es el CONTRAPESO de la tesis: rara vez
// tumba/salva sola, aporta al patrimonio. HISTÓRICA (2014-2024), NO garantía
// futura — por eso la confianza nunca es "alta". La IA lo narra aguas abajo.
// Ver plusvalia-hallazgo.ts.
export interface HallazgoPlusvalia {
  id: "plusvalia";
  tipo: "apreciacion_historica";
  valor: {
    anualizadaPct: number;  // tasa histórica anual de la comuna, % — reusada de :823-824
    refPct: number;         // umbral de apreciación real contra el que se compara
    gapPts: number;         // anualizadaPct − refPct, en puntos (signed)
    banda: number;          // banda de saturación de la decisividad, en puntos
    fuente: string;         // procedencia del umbral (auditoría de la brecha)
    scope: "absoluta" | "comuna";
    tieneData: boolean;     // true si la comuna tiene dato propio; false ⇒ default
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable si la comuna apreció ≥ umbral real (ganó valor real); adverso si <
  // (perdió valor real aunque el nominal suba). La frase puede decir "en línea"
  // cuando |gap| es mínimo; la señal-máquina es binaria.
  direccion: "favorable" | "adverso";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25) — SOLO desempate secundario del sort (E4).
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — ESTRUCTURA de financiamiento (pie + tasa) para LTR. 6º y
// último hallazgo, y el PRIMERO categórico: el motor envuelve el `overall` que YA
// emite classifyFinancingHealth (financing-health.ts:133) sin recalcular nada. A
// diferencia de cap_rate/plusvalia la decisividad NO es un gap continuo saturado —
// es un mapa por NIVEL (4 escalones), porque el overall es el PEOR de dos
// clasificaciones discretas (pie vs tasa), no una brecha. El `driver` (cuál
// dimensión define el overall) se deriva comparando LEVEL_RANK de cada nivel.
// Motor-seeded (sync, sin async) → va en results.hallazgos como cap_rate/plusvalia,
// NO en ai_analysis. La IA lo narra aguas abajo. Ver estructura-financiamiento-hallazgo.ts.
export interface HallazgoEstructuraFinanciamiento {
  id: "estructura_financiamiento";
  tipo: "salud_financiamiento";
  valor: {
    overall: FinancingHealthLevel;     // peor de pie+tasa — reusado de financingHealth.overall
    driver: "pie" | "tasa" | "ambos";  // dimensión que define el overall (derivada de LEVEL_RANK)
    pieLevel: FinancingHealthLevel;
    piePct: number;                    // pie.actual_pct (umbral fijo 25% óptimo)
    tasaLevel: FinancingHealthLevel;
    tasaPct: number;                   // tasa.actual_pct
    tasaMarketPct: number;             // tasa.market_avg_pct (MARKET_AVG_TASA_UF — referencia, no live)
    spreadBps: number;                 // tasa.spread_bps (signed, vs mercado de referencia)
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable si overall es optimo|aceptable; adverso si mejorable|problematico.
  // El corte cae entre aceptable y mejorable (donde el financiamiento pasa de
  // "bien" a "con problema"). NO hay 'neutral': la clasificación es binaria.
  direccion: "favorable" | "adverso";
  decisividad: number; // 0..1 — Δdecisión calibrada (calcDecisividades, E2)
  // Magnitud continua pre-floor (|Δscore|/25) — SOLO desempate secundario del sort (E4).
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número (el número vive en el KPI de la fila). fraseCanonica es la línea larga
  // (2 oraciones) que narra la pirámide; titular es el resumen de una línea. Ambos
  // los emite el motor por rama, direction-aware. Ver *-hallazgo.ts.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — TIR (retorno total del deal) para LTR. 7º hallazgo y el
// primero SOLO-LECTURA: NO compite en el ranking de decisividad (decisividad 0 fija)
// porque la TIR es el integrador de precio+arriendo+tasa+pie+plazo+venta y no tiene
// un driver único que calcDecisividades pueda neutralizar sin doble conteo. El motor
// envuelve exitScenario.tir (10 años, precio pedido — la misma que cita la prosa y
// tabula el drawer negociación) sin recalcularla, y la compara contra el UMBRAL de 6%
// que el motor YA usa (precio límite, bisección) y la UI ya narra ("mínimo que un deal
// apalancado debe rendir"). magnitudContinua = |tir−6|/banda ordena entre pares de
// igual decisividad (E4). Anti-colisión (A4): ancla al umbral, NUNCA compara pelado
// con depósito/fondo — esa comparación rica vive en "Vs. otro instrumento" de
// largoPlazo. Motor-seeded en runAnalysis (necesita exitScenario, post-calcMetrics) →
// va en results.hallazgos como estructura. La IA lo narra aguas abajo. Ver tir-hallazgo.ts.
export interface HallazgoTIR {
  id: "tir";
  tipo: "retorno_total";
  valor: {
    tirPct: number;      // exitScenario.tir — retorno anual del deal a 10 años, %
    umbralPct: number;   // umbral fijo 6% (mínimo que un deal apalancado debe rendir)
    gapPts: number;      // tirPct − umbralPct, en puntos (signed)
    banda: number;       // banda de normalización de magnitudContinua, en puntos
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable si tir ≥ 6%; adverso si < 6%. La frase puede decir "justo en el filo"
  // cuando |gap| < 0,3; la señal-máquina es binaria (favorable si tir ≥ 6).
  direccion: "favorable" | "adverso";
  // SOLO-LECTURA: 0 fija — la TIR NO pasa por calcDecisividades (integrador sin driver
  // único). El kicker honesto de la corona garantiza que si el orden Filosofía 1 la
  // corona, lleva "OJO ANTES DE FIRMAR", nunca "LO MÁS DECISIVO".
  decisividad: number;
  // |tir−6|/banda saturado a 1 — desempate secundario del sort entre pares de igual
  // decisividad (E4). Único orden que la TIR aporta al ranking.
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN
  // número. fraseCanonica es la línea larga (2 oraciones) que narra la pirámide.
  titular: string;
  fraseCanonica: string;
}

// Unión de proto-hallazgos que el motor puede sembrar en results.hallazgos.
// HallazgoSobreprecio se incorporó (sobreprecio-sync): el motor lo siembra sync
// cuando recibe la mediana comunal inyectada (prefetchMedianaComunaVenta). Sigue
// persistiéndose en ai_analysis por ahora (limpieza del viejo = paso aparte).
export type Hallazgo =
  | HallazgoPuestaAPunto
  | HallazgoCapRate
  | HallazgoFlujoMensual
  | HallazgoPlusvalia
  | HallazgoSobreprecio
  | HallazgoEstructuraFinanciamiento
  | HallazgoTIR;

export interface NegociacionScenario {
  precioSugeridoUF: number;
  precioSugeridoCLP: number;
  tirAlSugerido: number;
  precioLimiteUF: number | null;
  precioLimiteCLP: number | null;
  tirAlLimite: number | null;
  tirAlVmFranco: number;
  // Fase 3.7 v10 — modo del sugerido. Define qué argumento usar en la glosa IA
  // y si la card "Sugerido" muestra un descuento o señala "cerrar al actual".
  modo?: "cerrar_actual" | "optimizar_flujo" | "alinear_mercado";
  // Razón canónica del motor (sin LLM). La IA puede glosar con este texto como
  // base — no inventa la razón.
  razon?: string;
}

// Vocabulario unificado de veredictos. 3 valores canónicos compartidos por
// LTR y STR (audit-commit-e §4 + skill analysis-voice-franco §1.7).
//
// Commit E.2 · 2026-05-13 — colapso `engineSignal` ↔ `francoVerdict` a un solo
// concepto. El motor emite el veredicto; la IA narra el matiz, no contradice.
//
// Commit E.3 · 2026-05-13 — fusión "RECONSIDERA LA ESTRUCTURA" en "AJUSTA
// SUPUESTOS". RECONSIDERA era un 4to veredicto activado cuando la palanca
// de ajuste era la estructura de financiamiento (no el precio del depto).
// La doctrina actualizada lo trata como sub-tipo de AJUSTA: el veredicto
// sigue siendo AJUSTA SUPUESTOS, y la sección `reestructuracion` aparece
// como CONTENIDO dentro del veredicto, no como veredicto propio.
//
// Migración legacy (read path, no destructivo en DB):
//   LTR antiguo:
//     "COMPRAR"             → "COMPRAR"                    (sin cambio)
//     "AJUSTA EL PRECIO"    → "AJUSTA SUPUESTOS"
//     "BUSCAR OTRA"         → "BUSCAR OTRA"                (sin cambio)
//     "RECONSIDERA LA ESTRUCTURA" → "AJUSTA SUPUESTOS"     (E.3 coerce)
//   STR antiguo:
//     "VIABLE"              → "COMPRAR"
//     "AJUSTA ESTRATEGIA"   → "AJUSTA SUPUESTOS"
//     "NO RECOMENDADO"      → "BUSCAR OTRA"
//
// Usar `normalizeLegacyVerdict()` para coercer strings legacy de DB al
// vocabulario canónico antes de pasarlos a la UI.
export type Veredicto =
  | "COMPRAR"
  | "AJUSTA SUPUESTOS"
  | "BUSCAR OTRA";

/**
 * Mapea cualquier string de veredicto (legacy o canónico, LTR o STR) al
 * vocabulario canónico unificado. Devuelve null si el string no es
 * reconocible — los consumers deben proteger con fallback ("—", placeholder).
 *
 * Ejemplos:
 *   normalizeLegacyVerdict("AJUSTA EL PRECIO")        → "AJUSTA SUPUESTOS"
 *   normalizeLegacyVerdict("VIABLE")                  → "COMPRAR"
 *   normalizeLegacyVerdict("AJUSTA ESTRATEGIA")       → "AJUSTA SUPUESTOS"
 *   normalizeLegacyVerdict("NO RECOMENDADO")          → "BUSCAR OTRA"
 *   normalizeLegacyVerdict("RECONSIDERA LA ESTRUCTURA") → "AJUSTA SUPUESTOS"  (E.3)
 *   normalizeLegacyVerdict("COMPRAR")                 → "COMPRAR"
 *   normalizeLegacyVerdict("garbage")                 → null
 */
export function normalizeLegacyVerdict(raw: string | null | undefined): Veredicto | null {
  if (!raw || typeof raw !== "string") return null;
  switch (raw.trim().toUpperCase()) {
    case "COMPRAR":
    case "VIABLE":
      return "COMPRAR";
    case "AJUSTA SUPUESTOS":
    case "AJUSTA EL PRECIO":
    case "AJUSTA ESTRATEGIA":
    // Commit E.3 · 2026-05-13 — RECONSIDERA legacy se coerce a AJUSTA
    // SUPUESTOS. La sub-card reestructuración persiste por presencia
    // del campo `aiAnalysis.reestructuracion`, independiente del veredicto.
    case "RECONSIDERA LA ESTRUCTURA":
      return "AJUSTA SUPUESTOS";
    case "BUSCAR OTRA":
    case "NO RECOMENDADO":
      return "BUSCAR OTRA";
    default:
      return null;
  }
}

export interface FullAnalysisResult {
  score: number;
  clasificacion: string;
  clasificacionColor: string;
  // Veredicto canónico unificado (Commit E.2 · 2026-05-13). Antes coexistían
  // `engineSignal` (motor) y `francoVerdict` (UI), idénticos en producción pero
  // habilitados a diverger por prompt. La divergencia generaba disonancia
  // visual (badge motor + frase IA contradictoria). Ahora una sola señal:
  // el motor emite, la IA narra, no contradice.
  veredicto: Veredicto;
  resumenEjecutivo: string;
  desglose: Desglose;
  metrics: AnalysisMetrics;
  cashflowYear1: MonthlyCashflow[];
  projections: YearProjection[];
  exitScenario: ExitScenario;
  refinanceScenario: RefinanceScenario;
  sensitivity: SensitivityRow[];
  breakEvenTasa: number;
  valorMaximoCompra: number;
  negociacion?: NegociacionScenario;
  financingHealth?: import("./financing-health").FinancingHealth;
  resumen: string;
  pros: string[];
  contras: string[];
  // Proto-hallazgos del motor (CapEx puesta a punto + cap rate). Vacío/omitido
  // si no aplica. Sin lógica de ordenamiento — es la semilla de la capa.
  hallazgos?: Hallazgo[];
}

export interface AIAnalysis {
  resumenEjecutivo_clp: string;
  resumenEjecutivo_uf: string;
  tuBolsillo: {
    titulo: string;
    contenido_clp: string;
    contenido_uf: string;
    alerta_clp: string;
    alerta_uf: string;
  };
  vsAlternativas: {
    titulo: string;
    contenido_clp: string;
    contenido_uf: string;
  };
  negociacion: {
    titulo: string;
    contenido_clp: string;
    contenido_uf: string;
    precioSugerido: string;
  };
  proyeccion: {
    titulo: string;
    contenido_clp: string;
    contenido_uf: string;
  };
  riesgos: {
    titulo: string;
    items_clp: string[];
    items_uf: string[];
  };
  veredicto: {
    titulo: string;
    decision: "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
    explicacion_clp: string;
    explicacion_uf: string;
  };
  aFavor: string[];
  puntosAtencion: string[];
  // Legacy fields for backward compatibility with old saved analyses
  resumenEjecutivo?: string;
}

export interface DatoClave {
  label: string;
  valor_clp: string;
  valor_uf: string;
  subtexto?: string;
  // isLabel = true → render mono uppercase (etiqueta cuantitativa, sin verbo
  // conjugado, e.g. "BAJO MERCADO"). false/undefined → render Sans regular
  // (frase narrativa, e.g. "Sale de tu bolsillo"). Skill Capa 2.
  isLabel?: boolean;
  color: "red" | "green" | "neutral" | "accent";
}

export interface AISection {
  pregunta: string;
  contenido_clp: string;
  contenido_uf: string;
  cajaAccionable_clp: string;
  cajaAccionable_uf: string;
  cajaLabel: string;
}

export interface AIConvieneSection {
  pregunta: string;
  respuestaDirecta_clp: string;
  respuestaDirecta_uf: string;
  // Opcionales (Entrega 2 · prosa fundida): el prompt LTR ya no los emite —
  // respuestaDirecta absorbió lo decisivo del reencuadre y el hero no renderiza
  // ninguno. Se conservan en el tipo para análisis viejos persistidos que sí los
  // traen (la OG image los usa con cadena de fallback; ver /api/og/veredicto).
  veredictoFrase_clp?: string;
  veredictoFrase_uf?: string;
  datosClave?: DatoClave[];
  reencuadre_clp?: string;
  reencuadre_uf?: string;
  cajaAccionable_clp: string;
  cajaAccionable_uf: string;
  cajaLabel: string;
}

export interface AINegociacionSection extends AISection {
  precioSugerido: string;
  estrategiaSugerida_clp?: string;
  estrategiaSugerida_uf?: string;
  // Fase 3.6 v9 — anclas discretas calculadas por el motor. La IA glosa, no
  // recalcula. Opcional para backward-compat con cache pre-v9 (fallback al
  // bloque de estrategiaSugerida).
  precios?: AINegociacionPrecios;
}

export interface AINegociacionPrecios {
  primeraOferta_uf: number;
  primeraOferta_clp: number;
  techo_uf: number;
  techo_clp: number;
  walkAway: AINegociacionWalkAway | null;
  // Glosas IA por slot — 1-2 frases que explican POR QUÉ ese precio.
  // _clp/_uf son idénticos cuando no contienen montos.
  glosaPrimeraOferta_clp?: string;
  glosaPrimeraOferta_uf?: string;
  glosaTecho_clp?: string;
  glosaTecho_uf?: string;
  glosaWalkAway_clp?: string;
  glosaWalkAway_uf?: string;
}

export interface AINegociacionWalkAway {
  // null cuando el walk-away NO es un precio sino una decisión binaria
  // ("buscar otra propiedad"). En ese caso `razon` lleva la explicación.
  precio_uf: number | null;
  precio_clp: number | null;
  razon: string;
}

// Sección opcional que aparece solo cuando Franco activa el Nivel 3 del
// escalonado de financingHealth (skill §1.5). Va entre `negociacion` y
// `largoPlazo` en el render. Commit E.3 · 2026-05-13: la presencia de esta
// sección NO altera el veredicto (que sigue siendo AJUSTA SUPUESTOS); es
// contenido adicional que explica que la palanca de ajuste es financiera.
export interface AIReestructuracionSection {
  contenido_clp: string;
  contenido_uf: string;
  estructuraSugerida: {
    pieSugerido_pct: number;
    plazoSugerido_anios: number;
    tasaObjetivo_pct: number;
    impactoCuotaMensual_clp: number;
  };
}

export interface AIAnalysisV2 {
  // Opcionales: el prompt LTR dejó de emitirlos (campos huérfanos, sin consumidor
  // de render — el hero usa chips de inputData y conviene.respuestaDirecta). Se
  // conservan en el tipo para análisis viejos persistidos que sí los traen.
  siendoFrancoHeadline_clp?: string;
  siendoFrancoHeadline_uf?: string;
  conviene: AIConvieneSection;
  costoMensual: AISection;
  negociacion: AINegociacionSection;
  // Opcional: solo presente cuando Franco recomienda Nivel 3 (skill §1.5).
  reestructuracion?: AIReestructuracionSection;
  largoPlazo: AISection;
  // Opcional (Entrega B · Fase 2): el prompt LTR dejó de emitir `riesgos` (el
  // drawer se retiró en Entrega A; su única función viva era alimentar el
  // detector de fabricación, reapuntado a largoPlazo.contenido). Se conserva en
  // el tipo para análisis viejos persistidos que sí lo traen (forward-only) y
  // porque extractRiesgos/STR lo siguen usando en su propio flujo.
  riesgos?: AISection;
  // Commit E.2 · 2026-05-13 — campo audit-only NO renderizado al usuario.
  // Si la IA cree que el veredicto del motor está mal calibrado, lo reporta
  // acá para revisión humana. La regla operativa post-E.2: la IA NUNCA
  // contradice el motor en el render; este campo es la válvula de escape.
  francoCaveat?: string;
  // FASE B sobreprecio — hallazgo determinístico inyectado post-LLM (NO lo
  // devuelve el modelo). FUENTE ÚNICA de la desviación precio/m² vs mediana
  // comunal: lo lee el chip del hero y se narra en el párrafo (mata el bug
  // gemelo). Vive acá y NO en results.hallazgos porque su mediana es async
  // (ver HallazgoSobreprecio en este archivo). null si no hay dato de zona.
  hallazgoSobreprecio?: HallazgoSobreprecio | null;
}

// ─── STR — IA Análisis v2 (Ronda 4d) ──────────────────────────────
// Schema canónico STR alineado con doctrina analysis-voice-franco. La duplicación
// CLP/UF (§2.7) solo aplica a `siendoFrancoHeadline` que típicamente lleva la
// cifra dominante. El resto de campos son strings únicos: la IA formatea cifras
// inline ("aporte de $262K mensuales" / "ventaja de UF 880") sin necesidad de
// toggle CLP↔UF en el render.
export interface AISectionSTRv2 {
  pregunta: string;
  contenido: string;
  cajaAccionable: string;
}

export interface AIConvieneSTRv2 {
  pregunta: string;
  respuestaDirecta: string;
  veredictoFrase: string;
  reencuadre: string;
  cajaAccionable: string;
}

export interface AIVsLtrSTRv2 {
  pregunta: string;
  contenido: string;
  estrategiaSugerida: string;   // recomendación con número
  cajaAccionable: string;
}

// STRVerdict canónico vive en `lib/engines/short-term-engine.ts` — esto es alias
// para evitar acoplamiento del consumer del schema IA al motor. Si los tipos
// divergen, re-export desde aquí.
import type { STRVerdict as STRVerdictEngine } from "./engines/short-term-engine";
export type STRVerdict = STRVerdictEngine;

export interface AIAnalysisSTRv2 {
  siendoFrancoHeadline_clp: string;
  siendoFrancoHeadline_uf: string;
  conviene: AIConvieneSTRv2;
  rentabilidad: AISectionSTRv2;
  vsLTR: AIVsLtrSTRv2;
  operacion: AISectionSTRv2;
  largoPlazo: AISectionSTRv2;
  riesgos: AISectionSTRv2;
  // Commit E.2 · 2026-05-13 — campo único de veredicto. Antes coexistían
  // `engineSignal` y `francoVerdict` con divergencia opcional + rationale
  // que la UI renderizaba como caja "Franco diverge del motor". La doctrina
  // post-E.2 colapsa a un solo veredicto del motor; la IA narra, no contradice.
  veredicto: STRVerdict;
  // Audit-only NO renderizado. Si la IA cree que el motor está mal calibrado,
  // lo reporta acá para revisión humana sin contradecir al usuario.
  francoCaveat?: string;
}

// ─── Comparativa Ambas — IA narrativa "Cuál te conviene" (Commit 3b · 2026-05-12) ──
// Schema canónico para la narrativa del landing unificado de modalidad=Ambas.
// 4 ángulos doctrinales (analysis-voice-franco):
//   1. quienDeberiasSer  — perfil inversor + tolerancia operativa requerida para STR
//   2. balance           — qué cambia en tu balance si eliges una vs otra
//   3. switchPath        — viabilidad y costo de migrar LTR↔STR a futuro
//   4. cierre            — posición personal de Franco (skill §1.10)
// Persistencia: cacheada permanente en `ltr.results.comparativaAI` (jsonb).
export type RecomendacionModalidadAmbas =
  | "LTR_PREFERIDO"
  | "STR_VENTAJA_CLARA"
  | "INDIFERENTE";

export interface AIAnalysisComparativa {
  // Headline — 1 frase máx 25 palabras, refleja recomendacion del motor.
  headline: string;
  conviene: {
    quienDeberiasSer: string;
    balance: string;
    switchPath: string;
    cierre: string;
  };
  // Commit E.2 · 2026-05-13 — campo único de recomendación. Antes coexistían
  // `engineRecommendation`, `recomendacionFranco` y `recomendacionRationale`
  // con divergencia opcional. La doctrina post-E.2 colapsa a un solo valor:
  // el motor recomienda, la IA narra el matiz, no contradice.
  recomendacion: RecomendacionModalidadAmbas;
  // Audit-only NO renderizado. Si la IA cree que la recomendación del motor
  // es incorrecta, lo reporta acá para revisión humana.
  francoCaveat?: string;
}

export interface Analisis {
  id: string;
  user_id: string;
  nombre: string;
  comuna: string;
  ciudad: string;
  direccion: string | null;
  tipo: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  antiguedad: number;
  precio: number;
  arriendo: number;
  gastos: number;
  contribuciones: number;
  score: number;
  desglose: Desglose;
  resumen: string;
  results?: FullAnalysisResult;
  input_data?: AnalisisInput;
  is_premium?: boolean;
  created_at: string;
}
