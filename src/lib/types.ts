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
  estadoVenta: "blanco" | "verde" | "inmediata";
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
}

export interface FullAnalysisResult {
  score: number;
  clasificacion: string;
  clasificacionColor: string;
  veredicto: "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";
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
