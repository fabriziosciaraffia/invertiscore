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
  // Comparación UF/m² del sujeto (SIN estacionamiento) vs mediana comunal de
  // VENTA. Fuente ÚNICA de la cifra UF/m² del sujeto para narración/anomalías/
  // hero; se computa una vez vía buildPrecioVsComuna. desviacionPct null si no
  // hay mediana confiable. (FASE A: solo el cómputo; FASE B construye el hallazgo.)
  precioVsComuna?: PrecioVsComuna | null;
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
  };
  // Nunca 'favorable': una puesta a punto siempre resta de tu plata día 1.
  direccion: "adverso" | "neutral";
  decisividad: number; // 0..1 — fracción de la inversión inicial que se va a CapEx
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
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
  decisividad: number; // 0..1 — |gap| / banda, saturado
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
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
  decisividad: number; // 0..1 — |aporte| / dividendo, saturado
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  fraseCanonica: string;
}

// Proto-hallazgo tipado — SOBREPRECIO vs comuna (precio/m² del sujeto vs mediana
// comunal de venta). 4º hallazgo, pero ASIMÉTRICO respecto a los otros tres: NO
// lo siembra el motor en results.hallazgos. Su desviación depende de la mediana
// comunal, que se resuelve ASYNC (getComunaMedianaVentaUF) y NO existe en el motor
// en runtime — el recompute sync del render (recompute-results-for-legacy) la deja
// en null, así que un hallazgo motor-seeded saldría null en TODO render. Por eso lo
// construye AI-GENERATION (donde la mediana ya está resuelta) y se persiste en
// ai_analysis (AIAnalysisV2.hallazgoSobreprecio), NO en la union `Hallazgo`. Reusa
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
  decisividad: number; // 0..1 — |desviacionPct| / banda, saturado
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  fraseCanonica: string;
}

// Unión de proto-hallazgos que el motor puede sembrar en results.hallazgos.
// NOTA: HallazgoSobreprecio queda DELIBERADAMENTE fuera — no es motor-seeded
// (vive en ai_analysis, ver su doc). El render futuro que quiera tratar las dos
// fuentes de forma uniforme (3 de results.hallazgos + sobreprecio de ai_analysis)
// necesitará un tipo paraguas que las junte; NO se crea acá.
export type Hallazgo = HallazgoPuestaAPunto | HallazgoCapRate | HallazgoFlujoMensual;

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
  veredictoFrase_clp: string;
  veredictoFrase_uf: string;
  datosClave: DatoClave[];
  reencuadre_clp: string;
  reencuadre_uf: string;
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
  siendoFrancoHeadline_clp: string;
  siendoFrancoHeadline_uf: string;
  conviene: AIConvieneSection;
  costoMensual: AISection;
  negociacion: AINegociacionSection;
  // Opcional: solo presente cuando Franco recomienda Nivel 3 (skill §1.5).
  reestructuracion?: AIReestructuracionSection;
  largoPlazo: AISection;
  riesgos: AISection;
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
