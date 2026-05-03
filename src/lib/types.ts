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
}

export interface NegociacionScenario {
  precioSugeridoUF: number;
  precioSugeridoCLP: number;
  tirAlSugerido: number;
  precioLimiteUF: number | null;
  precioLimiteCLP: number | null;
  tirAlLimite: number | null;
  tirAlVmFranco: number;
}

// El motor produce solo 3 señales matemáticas. Solo Franco puede emitir el
// 4to veredicto RECONSIDERA LA ESTRUCTURA (cuando el problema es financiero,
// no del depto). Ver analysis-voice-franco/SKILL.md §1.5 + §1.7.
export type EngineSignal = "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";
export type FrancoVerdict =
  | "COMPRAR"
  | "AJUSTA EL PRECIO"
  | "BUSCAR OTRA"
  | "RECONSIDERA LA ESTRUCTURA";

export interface FullAnalysisResult {
  score: number;
  clasificacion: string;
  clasificacionColor: string;
  // Señal del motor (matemática pura del depto). Antes era `veredicto`.
  // Ver analysis-voice-franco/SKILL.md §1.7.
  engineSignal: EngineSignal;
  // Veredicto Franco que muestra la UI. En esta fase es idéntico a engineSignal;
  // diverge en Fase 3 cuando el refactor de prompts incorpora perfil de usuario.
  francoVerdict: FrancoVerdict;
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
    decision: "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";
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
}

// Sección opcional que aparece solo cuando Franco activa el Nivel 3 del
// escalonado de financingHealth (skill §1.5). Va entre `negociacion` y
// `largoPlazo` en el render. Si está presente, el francoVerdict suele ser
// "RECONSIDERA LA ESTRUCTURA".
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
  // Veredicto que Franco emite. Puede coincidir o no con engineSignal del motor.
  // Opcional para backward-compat con análisis IA generados antes del refactor.
  francoVerdict?: FrancoVerdict;
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
