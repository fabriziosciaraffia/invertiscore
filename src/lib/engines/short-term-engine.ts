// =========================================
// Motor de Cálculo — Renta Corta (STR)
// =========================================
// P&L completo, comparativa STR vs LTR, escenarios por percentil,
// estacionalidad, ramp-up y veredicto.

import {
  calcTasaConSubsidio,
  calificaSubsidio,
  aplicaSubsidio,
  TASA_MERCADO_FALLBACK,
} from "../constants/subsidio";
import {
  calcZonaSTR,
  calcVeredictoComparativo,
  sobreRentaPctEsConfiable,
  type ZonaSTRScore,
  type RecomendacionModalidadSTR,
  type VeredictoComparativo,
  type ModoGestionAmbas,
} from "./str-universo-santiago";
import { mesesHastaEntregaDesdeFecha } from "@/lib/pre-entrega-serie";
import { calcInversionInicialCLP } from "../inversion-inicial";
import { PLUSVALIA_PROYECCION_ANUAL } from "../plusvalia-proyeccion";
import { calcCapexPuestaAPunto, buildHallazgoPuestaAPunto } from "../capex-puesta-a-punto";
import { resolverModeloCostos } from "../modelo-costos";
import type { Hallazgo, MetricaSobreCapital, MetricaTIR, RazonSinCapital } from "../types";
import { metricaNoAplica, metricaNoCalculable, metricaValor, metricaValorONull } from "../types";
import { calcIRRPct } from "../finance/irr";

// =========================================
// Types
// =========================================

export interface AirbnbData {
  estimated_adr: number;
  estimated_occupancy: number;
  estimated_annual_revenue: number;
  percentiles: {
    revenue: { p25: number; p50: number; p75: number; p90: number; avg: number };
    occupancy: { p25: number; p50: number; p75: number; p90: number; avg: number };
    average_daily_rate: { p25: number; p50: number; p75: number; p90: number; avg: number };
  };
  monthly_revenue: number[];
  currency: string;
}

// 'mixto' se mantiene en el union para no romper análisis legacy persistidos
// con ese valor. El wizard v3 (formulario-v3/BloqueOperacionSTR) ya no lo
// expone — nuevos análisis solo serán 'residencial_puro' o 'dedicado'.
//
// Auditoría 2026-05-12 (Commit 3b cleanup): 3 análisis STR aún tienen
// tipoEdificio='mixto' en DB (input_data + results.ejesAplicados). El formulario
// legacy `src/app/analisis/renta-corta/page.tsx` (no linkeado desde el flujo
// principal) sigue exponiendo 'mixto' como opción; mantener back-compat tanto
// del union como del factor ADR (1.05) hasta que ese formulario se desmantele
// o los 3 análisis legacy se reanalicen.
export type TipoEdificioSTR = 'residencial_puro' | 'mixto' | 'dedicado';
export type HabilitacionSTR = 'basico' | 'estandar' | 'premium';

export interface ShortTermInputs {
  // Propiedad
  precioCompra: number;
  superficie: number;
  dormitorios: number;
  banos: number;
  /** Tipo de propiedad: "Nuevo" / "Usado" (forma canónica) o lowercase del
   * form ("nuevo"/"usado"). Necesario para evaluar subsidio Ley 21.748
   * (Commit 3a · 2026-05-12). Opcional para back-compat con análisis legacy. */
  tipoPropiedad?: string;

  /** Antigüedad en años. Necesaria para el CapEx de puesta a punto (usados).
   * Opcional para back-compat con análisis legacy — si falta, se trata como 0
   * (sin CapEx). El pipeline STR la deriva de tipoPropiedad (nuevo=0, usado=5). */
  antiguedad?: number;
  /** true cuando `antiguedad` NO vino del usuario sino de un fallback del borde
   * (ej. body STR sin el campo → el pipeline deriva usado=5). Degrada la
   * confianza del hallazgo de puesta a punto a 'baja'. Default false (real). */
  antiguedadEsFallback?: boolean;
  /** Override opt-in del CapEx de puesta a punto (CLP). Sin UI esta sesión. */
  costoPuestaAPuntoCLP?: number;

  /** Comuna del depto. Usado para Commit 4 (zonaSTR + benchmark universo
   * Santiago). Opcional para back-compat — si falta, zonaSTR score cae a
   * fallback 50 (zona "media" sin información). */
  comuna?: string;

  // Financiamiento
  piePercent: number;       // decimal: 0.20 = 20%
  tasaCredito: number;      // decimal: 0.045 = 4.5%
  // Tasa hipotecaria de mercado vigente (decimal, ej. 0.0472). OPCIONAL: solo la
  // envía el wizard v4. Alimenta subsidioTasa (tasa con subsidio = mercado − 0,6pp
  // y el gate `aplicado`). Ausente (renta-corta legacy, análisis históricos,
  // fixtures) ⇒ TASA_MERCADO_FALLBACK → comportamiento idéntico al previo. NO
  // afecta la cuota (esa usa tasaCredito).
  tasaMercado?: number;
  plazoCredito: number;     // años

  // AirROI
  airbnbData: AirbnbData;

  // Gestión
  modoGestion: 'auto' | 'administrador';
  comisionAdministrador: number; // decimal: 0.20 = 20%

  // Calibración v1 (mayo 2026) — 3 ejes operacionales. Opcionales para
  // backward-compat con análisis existentes; defaults dan baseline residencial.
  tipoEdificio?: TipoEdificioSTR;
  habilitacion?: HabilitacionSTR;
  // adminPro: si el usuario contrata administrador profesional (Andes-style).
  // Distinto de modoGestion='administrador' que captura "alguien gestiona"
  // (puede ser un familiar). adminPro implica empresa formal con 15-25% fee.
  adminPro?: boolean;

  // Overrides manuales (2026-05-10). Cuando != null, el motor usa el valor
  // manual en lugar del derivado de los ejes operacionales. Los ejes siguen
  // poblando ejesAplicados como referencia para la UI pedagógica.
  // - adrOverride: CLP/noche.
  // - occOverride: decimal 0-1.
  adrOverride?: number | null;
  occOverride?: number | null;

  // Costos operativos mensuales CLP
  costoElectricidad: number;
  costoAgua: number;
  costoWifi: number;
  costoInsumos: number;
  gastosComunes: number;
  mantencion: number;
  contribuciones: number; // CLP trimestrales

  // Amoblamiento
  costoAmoblamiento: number;

  // Comparativa LTR
  arriendoLargoMensual: number;

  // UF
  valorUF: number;

  /** Versión de metodología (espejo de input_data.methodologyVersion). Gatea la
   *  curva de CapEx de puesta a punto: ≥ v3 ⇒ rango nuevo; ausente ⇒ legacy, así
   *  que los análisis STR previos recomputan idéntico. Ver modelo-costos.ts. */
  methodologyVersion?: string;

  /** Fase 5b · origen del pie 0 declarado en el wizard. Solo aplica con
   *  piePercent === 0; se propaga a la razón de las métricas sobre capital.
   *  Ausente ⇒ 'sin_pie' (no se preguntó) — análisis previos idénticos. */
  razonSinPie?: RazonSinCapital;

  // ── Entrega futura · DECLARADA, TODAVÍA NO MODELADA ────────────────────────
  //
  // El wizard pregunta "¿cuándo lo entregan?" en el Acto 1, antes de bifurcar
  // por modalidad, así que también se lo pregunta al STR puro. Hasta el paso 2
  // de esta serie `buildStrPayload` descartaba la respuesta y estos campos no
  // existían: el motor no es que los ignorara, es que el dato nunca llegaba
  // (0 de 96 análisis STR del parque traían `fechaEntrega`). En AMBAS eso dejaba
  // a los dos análisis del mismo depto partiendo de supuestos distintos, y es lo
  // que obligó a la comparativa a declarar que el patrimonio no compara.
  //
  // EL MOTOR NO LOS LEE TODAVÍA. `buildProjections` mantiene su `void asOf` y
  // compone desde el mes 1. Modelar la espera en renta corta (paso 3) exige
  // decidir antes tres cosas que no tienen análogo en el arriendo largo: cuándo
  // se compra el amoblamiento, desde cuándo corre el ramp-up de ocupación, y en
  // qué punto del año calendario cae la entrega (la estacionalidad no es plana).
  //
  // Están acá para que el dato viaje DECLARADO y no colado por el spread del
  // body, y para que el paso 3 no tenga que tocar el borde.

  /** "inmediata" | "futura". Ausente ⇒ inmediata (análisis previos idénticos). */
  estadoVenta?: "inmediata" | "futura";
  /** `AAAA-MM` de la entrega. Fecha ABSOLUTA, no meses relativos: se congela
   *  contra el `asOf` del análisis igual que en LTR. El wizard legacy de renta
   *  corta manda `mesesEntrega`, que driftea con la fecha de creación. */
  fechaEntrega?: string;
}

export interface EscenarioSTR {
  label: string;
  ingresoAnual: number;
  ingresoBrutoMensual: number;
  comisionMensual: number;
  costosOperativos: number;
  noiMensual: number;
  flujoCajaMensual: number;
  capRate: number;
  // Sobre capital propio (decimal): 'no_aplica' cuando pie === 0 (pie cero · fase 1-2).
  // Filas persistidas pre-migración traen number crudo → leer con metricaValorONull.
  cashOnCash: MetricaSobreCapital;
  rentabilidadBruta: number;
  adrReferencia: number;
  ocupacionReferencia: number;
}

export interface FlujoEstacionalMes {
  mes: string;
  ingresoBruto: number;
  ingresoNeto: number;
  flujo: number;
  factor: number;
}

export interface SensibilidadRow {
  label: string;
  ingresoAnual: number;
  noiMensual: number;
  sobreRenta: number;
  sobreRentaPct: number;
  sobreRentaPctConfiable: boolean;   // P3: false ⇒ mostrar "N/D" + sobreRenta absoluto (CLP)
}

// Vocabulario unificado de veredictos (Commit 1 · 2026-05-11). STR comparte
// los 3 valores con LTR. Mapping desde vocabulario antiguo (read path):
//   "VIABLE"            → "COMPRAR"
//   "AJUSTA ESTRATEGIA" → "AJUSTA SUPUESTOS"
//   "NO RECOMENDADO"    → "BUSCAR OTRA"
// Usar `normalizeLegacyVerdict()` de `lib/types.ts` para coercer DB legacy.
export type STRVerdict = 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA';

// Proyección año-a-año para Patrón 7 (Advanced Section). Ronda 4b.
/** Cifras con nombre del informe STR (T0 CONGELADO). Todas en CLP salvo lo indicado. */
export interface MetricsSTR {
  /** Ingreso bruto de un mes típico con la ocupación del caso (antes de comisión y costos). */
  ingresoEstabilizadoMensual: number;
  ingresoEstabilizadoAnual: number;
  /** Lo que queda (o sale de tu bolsillo) cada mes después de comisión, costos y cuota. */
  flujoMensual: number;
  /** Ingreso neto anual ÷ precio, en %. */
  capRatePct: number;
  /** TIR a 10 años en %, null sin escenario de salida. */
  tirPct: number | null;
  /** Tarifa por noche del caso (CLP). */
  tarifaNoche: number;
  /** Ocupación del caso (0-1): el supuesto del usuario o la estimación de mercado. */
  ocupacion: number;
  /** Desglose del Fall del capítulo II: cada línea con su nombre, negativas las que salen. */
  desgloseFall: {
    ingreso: number;
    /** Comisión de la plataforma (3%) en autogestión; 0 con administrador (el operador la reemplaza en el motor). */
    comisionPlataforma: number;
    /** Comisión del administrador cuando el modo es administrador; 0 en autogestión. */
    administrador: number;
    /** Luz, agua, internet e insumos. */
    costosDirectos: number;
    gastosComunesMantencion: number;
    /** Contribuciones trimestrales mensualizadas (÷3). */
    contribucionesMensuales: number;
    cuota: number;
    /** = flujoMensual (negativo cuando sale de tu bolsillo). */
    saleDeTuBolsillo: number;
  };
  /** Tramos de la barra del Fall: el largo es el ingreso; sobre él, costos de operar y cuota;
   *  si suman más que el ingreso, el exceso es lo que sale de tu bolsillo; si menos, el
   *  tramo libre es lo que te queda. */
  tramosBarra: { ingreso: number; costosOperar: number; cuota: number; exceso: number; libre: number };
  /** La plata del día 1, con los cuatro sumandos de `plata-dia1` (el amoblamiento es el cuarto tono STR). */
  dia1: { pieCLP: number; gastosCompraCLP: number; amoblamientoCLP: number; capexCLP: number; inversionInicial: number };
}

export interface YearProjectionSTR {
  year: number;
  valorDepto: number;
  saldoCredito: number;
  flujoOperacionalAnual: number;     // NOI*12 - dividendo*12 (con ramp-up año 1)
  flujoAcumulado: number;
  aporteMensualPromedio: number;     // si flujo<0, lo que aporta el dueño /12
  patrimonioNeto: number;            // valorDepto - saldoCredito (SIN flujo — homologación LTR)
  // ── Desglose anual (T0 CONGELADO STR · 04-sep-2026) — alimenta la planilla "Flujo por
  //    año" del modal. Son los MISMOS términos con los que el loop arma
  //    `flujoOperacionalAnual`; la identidad ingresoNeto − cuota − estabilización −
  //    amoblamiento === flujoOperacionalAnual se cumple exacta. Opcionales solo por las
  //    filas persistidas sin ellos; el motor los emite siempre. ──
  mesesOperativos?: number;
  ingresoAnual?: number;
  comisionAnual?: number;
  costosAnual?: number;
  ingresoNetoAnual?: number;
  cuotaAnual?: number;
  /** Pérdida por estabilización inicial (primeros meses al 50…90%), solo el primer año operativo. */
  estabilizacionAnual?: number;
  /** Amoblamiento comprado al recibir el depto (solo con pre-entrega; con entrega inmediata va en el día 1). */
  amoblamientoAnual?: number;
}

// Escenario "si vendes en año N". Ronda 4b.
export interface ExitScenarioSTR {
  yearVenta: number;
  valorVenta: number;
  saldoCreditoAlVender: number;
  gastosCierre: number;              // 2% del precio venta
  flujoAcumuladoAlVender: number;
  // EQUITY al vender: valorVenta - saldo - cierre, SIN flujo acumulado — homologación EXACTA
  // con LTR (analysis.ts:682). "Lo que te queda en la mano al liquidar el activo", neto de
  // deuda y comisión; el flujo operativo ya lo embolsaste durante los años y vive aparte
  // (`flujoAcumuladoAlVender` + SaleBlock). Renombrado de `gananciaNeta` (F2) a `equityCLP`
  // (F6); lectores pre-regen usan fallback `equityCLP ?? gananciaNeta` (ver SaleBlockSTR).
  equityCLP: number;                 // = EQUITY: valorVenta - saldo - cierre (sin flujo)
  retornoTotal: number;              // = flujoAcumulado + equityCLP (con flujo; espejo analysis.ts:683)
  totalAportado: number;             // = capitalInicial + Σ aportes mensuales negativos (espejo analysis.ts:704)
  // EQUITY(sin flujo) / totalAportado → ×1 = break-even (espejo LTR). Sobre capital
  // propio: 'no_aplica' cuando pie === 0 (pie cero · fase 1-2); legacy trae number.
  multiplicadorCapital: MetricaSobreCapital;
  /** Capital del día 1 (pie + gastos de compra + amoblamiento + puesta a punto). Paridad con
   *  `ExitScenario.inversionInicial` de LTR; alimenta `plata-dia1`. Opcional por filas viejas. */
  inversionInicial?: number;
  // TIR % del cashflow año 0 → año N. Sobre capital propio: 'no_aplica' cuando
  // pie === 0 (rama A pie-cero-str-tir); legacy trae number crudo. Suma
  // 'no_calculable' (MetricaTIR) cuando el VPN del flujo no cruza cero.
  tirAnual: MetricaTIR;
}

export type BandaOcupacionSTR =
  | 'edificio_dedicado_admin_pro'
  | 'edificio_dedicado_auto'
  | 'admin_pro_residencial'
  | 'auto_gestion_residencial';

// Calibración v1 — registro de ejes aplicados al cálculo, para mostrar al
// usuario cómo se llegó al número.
export interface EjesAplicadosSTR {
  tipoEdificio: TipoEdificioSTR;
  habilitacion: HabilitacionSTR;
  adminPro: boolean;
  factorEdificio: number;        // ej. 1.10
  factorHabilitacion: number;    // ej. 1.10
  factorADRTotal: number;        // factorEdificio × factorHabilitacion
  banda: BandaOcupacionSTR;
  ocupacionTarget: number;       // ej. 0.74
  adrBaselineP50: number;        // ADR p50 de AirROI antes del ajuste
  adrAjustado: number;           // adrBaselineP50 × factorADRTotal
  ocupacionBaselineP50: number;  // occ p50 de AirROI sin ajuste

  // Overrides manuales (2026-05-10). Cuando flag=true, el ADR/Occ usado
  // efectivamente por el motor difiere de adrAjustado / ocupacionTarget;
  // estos campos guardan el valor que prevaleció + de dónde vino.
  adrOverride: number | null;       // null si no hubo override
  occOverride: number | null;       // null si no hubo override
  adrFinal: number;                 // ADR efectivamente usado por el motor
  ocupacionFinal: number;           // Occupancy efectivamente usada
}

export interface ShortTermResult {
  /** Veredicto canónico del análisis. Post-Commit E.1: el motor lo emite como
   * placeholder = legacyEngineVeredicto, pero el api route lo sobrescribe con
   * `francoScore.veredicto` al persistir. UI lee francoScore.veredicto directo. */
  veredicto: STRVerdict;
  /** Veredicto del heurístico antiguo del motor (sobreRentaPct >= 0.10).
   * Audit-only desde Commit E.1 — NO leer en UI. Permite comparar pre/post
   * recalibración de thresholds. */
  legacyEngineVeredicto?: STRVerdict;

  // Calibración v1 — qué ejes se aplicaron. Opcional para compat retroactiva.
  ejesAplicados?: EjesAplicadosSTR;

  // Financiamiento
  pie: number;
  montoCredito: number;
  dividendoMensual: number;
  capitalInvertido: number;

  // ── Cifras con nombre (T0 CONGELADO STR · 04-sep-2026). Las seis cifras del informe,
  //    el desglose del Fall del capítulo II con los tramos de su barra y la plata del
  //    día 1: el render las lee de acá, no las arma desde input_data. Opcional solo por
  //    las filas persistidas antes de T0; el motor lo emite siempre. ──
  metrics?: MetricsSTR;

  // Proto-hallazgos. calcShortTerm siembra solo el CapEx puesta a punto; el pipeline
  // (buildStrHallazgos) reemplaza este array con la pirámide STR completa antes de persistir.
  // Tipado Hallazgo[] para reflejar el shape persistido que lee el render. Sin orden/rendering acá.
  hallazgos?: Hallazgo[];

  // Escenarios
  escenarios: {
    conservador: EscenarioSTR;
    base: EscenarioSTR;
    agresivo: EscenarioSTR;
  };

  // Comparativa STR vs LTR
  comparativa: {
    ltr: {
      ingresoBruto: number;
      noiMensual: number;
      flujoCaja: number;
    };
    str_auto: EscenarioSTR;
    str_admin: EscenarioSTR;
    sobreRenta: number;
    sobreRentaPct: number;
    sobreRentaPctConfiable: boolean;   // P3: false ⇒ mostrar "N/D" + sobreRenta absoluto (CLP)
    paybackMeses: number;
  };

  // Estacionalidad (12 meses, escenario base)
  flujoEstacional: FlujoEstacionalMes[];

  // Ramp-up
  perdidaRampUp: number;

  // Break-even
  breakEvenIngresoAnual: number;
  breakEvenPctDelMercado: number;

  // Sensibilidad
  sensibilidad: SensibilidadRow[];

  // Ronda 4b — Paridad estructural con LTR para Patrón 7 (Advanced Section).
  // Opcionales para no romper análisis STR persistidos pre-4b.
  projections?: YearProjectionSTR[];
  exitScenario?: ExitScenarioSTR;
  // Commit E.2 · 2026-05-13 — campos `engineSignal` y `francoVerdict` removidos.
  // El veredicto único vive en `veredicto` (arriba). Read-path tolera análisis
  // legacy con cualquiera de las tres llaves via `readVeredicto()`.

  // Commit 3a · 2026-05-12 — Subsidio Ley 21.748 (paridad con LTR).
  // Aplica a viviendas nuevas en primera venta dentro del techo vigente
  // (NO se exige primera vivienda del comprador). Rebaja la tasa
  // hipotecaria en ~0,6 pp respecto al mercado. Estructura espejo de LTR
  // (analysis.ts:307-311 metrics.subsidioTasa).
  // Opcional para back-compat con análisis legacy pre-3a.
  subsidioTasa?: {
    califica: boolean;
    tasaConSubsidio: number;
    aplicado: boolean;
  };

  // Commit 3a · 2026-05-12 — Sensibilidad al PRECIO (paridad con LTR
  // calcNegociacionScenario). Distinto de `sensibilidad[]` que mide
  // sensibilidad al ingreso del mercado. Acá variamos el precio del depto y
  // recalculamos CAP/CoC/payback — útil para drawer 04 "Plan negociación".
  sensibilidadPrecio?: SensibilidadPrecioRow[];

  // Commit 4 · 2026-05-12 — Viabilidad STR honesta por zona.
  // `zonaSTR` clasifica la zona vs universo Santiago (alta/media/baja) en
  // base a ADR + ocupación + ingreso p50. Sirve para emitir advertencias
  // en UI cuando la zona no tracciona STR.
  // `recomendacionModalidad` cruza tier de zona + sobre-renta para decir
  // honestamente cuándo LTR es mejor opción que STR.
  // V2 (Goal 4 · 2026-09-04): universo generado desde datos de mercado por comuna, con el
  // contexto comunal de la ocupación (`ocupacionVsComuna`) que La zona muestra.
  zonaSTR?: ZonaSTRScore;
  recomendacionModalidad?: RecomendacionModalidadSTR;

  // D1+D2 (Rama superficie AMBAS) — veredicto comparativo tipado: banda refinada con
  // STR_FRAGIL (break-even 90-110%), N/D por absoluto integrado al tipo, y señal de flip
  // de gestión (D2) para que la Fase B la consuma como hallazgo. `recomendacion` == el
  // campo `recomendacionModalidad` de arriba (backward-compat). Opcional para back-compat
  // con análisis STR persistidos pre-D1 (el recompute-on-load lo repuebla en la superficie).
  veredictoComparativo?: VeredictoComparativo;

  // Remediación 2026-06 — fuente de la ocupación del escenario BASE.
  // 'observada'        = percentiles.occupancy.p50 (o estimated_occupancy) de AirROI.
  // 'fallback_mercado' = no había occ observada; se usó la mediana pooled Santiago
  //                      (OCC_FALLBACK_MERCADO). UI/IA deben mostrar caveat en este caso.
  // 'override'         = fix-occfuente-override 2026-07: el usuario definió la ocupación
  //                      a mano (occOverride). NUNCA se presenta como dato observado.
  // Opcional para back-compat con análisis persistidos pre-remediación.
  occFuente?: OccFuenteSTR;

  // fix-occfuente-override 2026-07 — el DATO OBSERVADO real de la zona, siempre presente
  // aunque el usuario haya puesto un override. Permite mostrar AMBOS valores (su supuesto +
  // el dato de mercado) sin esconder la evidencia. `occObservadaFuente` dice si ese dato
  // observado vino de AirROI ('observada') o del fallback pooled Santiago ('fallback_mercado').
  occObservada?: number;
  occObservadaFuente?: OccFuenteObservadaSTR;

  // fix-occfuente-override 2026-07 — fuente del ADR que factura el base y el ADR del modelo
  // (p50 ajustado por ejes) para poder mostrar ambos cuando hay override de tarifa.
  adrFuente?: AdrFuenteSTR;
  adrModelo?: number;

  // Transparencia 2026-06 — DISPLAY-ONLY. Mediana de la ocupación REALIZADA de
  // la pool de comparables AirROI (ttm_occupancy). `calcShortTerm` NUNCA lo
  // setea: lo adjunta el api route al persistir, fuera del scoring. Sirve para
  // mostrar al lado de la ocupación estimada sin tocar el veredicto. Ausente en
  // análisis históricos (la UI no renderiza la fila si falta).
  ocupacionRealizadaComparables?: {
    p50: number;
    p50Superhost: number;
    n: number;
    nSuperhost: number;
  };
}

export interface SensibilidadPrecioRow {
  /** "-5%" / "-10%" / "actual" */
  label: string;
  /** Precio resultante en CLP. */
  precioCLP: number;
  /** Δ del precio en CLP (negativo si bajó). */
  delta: number;
  /** CAP rate resultante (decimal). */
  capRate: number;
  /** Cash-on-Cash resultante anual (decimal). 'no_aplica' cuando pie === 0. */
  cashOnCash: MetricaSobreCapital;
  /** Flujo de caja mensual con precio reducido. */
  flujoCajaMensual: number;
  /** Payback amoblamiento en meses (negativo = no recupera, 0 = sin amobl). */
  paybackMeses: number;
}

// =========================================
// Constantes
// =========================================

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

const GASTOS_CIERRE_PCT = 0.02;
export const COMISION_AIRBNB = 0.03;
export const COMISION_LTR = 0.05;
// Ramp-up consolidado: ver `STR_RAMP_UP` exportado más abajo. Esta variable
// queda como alias interno para no tocar callsites legacy.
// Curva 6 meses: ocupación llega al 100% del target estabilizado en el mes 6.

// =========================================
// Calibración v1 — Mayo 2026
// =========================================
// Fuentes:
//  - Proforma Andes STR Alameda 107 Providencia (sept 2025)
//  - Experimento AirROI 149 listings Lastarria/Providencia/LasCondes
//    (mayo 2026, ver docs/str-benchmarks-from-airroi-2026-05.md)
//  - Airbtics público: Andes STR vs market Santiago

// Comisiones (re-exportadas para uso fuera del motor, ej. UI pedagógica)
export const STR_COMISION_ADMIN_PRO = 0.20;     // Andes STR full-service estándar
export const STR_COMISION_AUTO_GESTION = 0.03;  // overhead operacional Airbnb auto
export const LTR_COMISION_ESTANDAR = 0.05;      // industria

// Curva 6 meses post-listing — ocupación alcanza el 100% del target
// estabilizado recién en el mes 6. Antes era 4 meses [0.70, 0.80, 0.90, 1.00];
// se extendió tras observar que operadores reales (Andes proforma) reportan
// ramp-up más largo en mercados saturados como Santiago centro.
export const STR_RAMP_UP = [0.50, 0.60, 0.70, 0.80, 0.90, 1.00] as const;

// Costos directos mensuales por tipología (CLP). Andes proforma.
// Estos valores son MÁS DETALLADOS que COSTOS_DEFAULT (que usa string '0'..'3').
// Coexisten: COSTOS_DEFAULT sigue siendo el path por defecto del form,
// STR_COSTOS_DIRECTOS_MENSUAL queda disponible para uso pedagógico/debug.
export const STR_COSTOS_DIRECTOS_MENSUAL: Record<string, number> = {
  '1D1B_chico': 85000,
  '1D1B_grande': 94000,
  '2D1B': 111000,
  '2D2B': 118000,
  '2D3B': 127000,
  '3D2B': 141000,
  '3D3B': 148000,
};

export const STR_MANTENCION_MENSUAL: Record<string, number> = {
  '1D1B_chico': 11000,
  '1D1B_grande': 17000,
  '2D1B': 20000,
  '2D2B': 21000,
  '2D3B': 24000,
  '3D2B': 25000,
  '3D3B': 28000,
};

// Ocupación target por banda operacional. La gestión profesional drives
// OCUPACIÓN, no ADR (ver experimento AirROI: ADR similar entre pro/no-pro,
// ocupación significativamente mayor en operadores pro como Andes).
export const STR_OCUPACION_TARGET: Record<BandaOcupacionSTR, number> = {
  edificio_dedicado_admin_pro: 0.74,    // Andes-style (Alameda 107 proforma)
  edificio_dedicado_auto: 0.65,         // dedicado pero sin admin pro (raro)
  admin_pro_residencial: 0.65,          // admin pro en edificio residencial
  auto_gestion_residencial: 0.55,       // baseline: hosts independientes
};

// ADR factors. Ejes 1 (edificio) y 3 (habilitación). Eje 2 (gestión) NO afecta ADR.
//
// NEUTRALIZADOS 2026-06 → todos 1.00. Los uplifts anteriores (hasta ×1.21 con
// edificio dedicado × habilitación premium) no tenían respaldo en data dura:
//   1. El p50 de AirROI ya ubica al inmueble dentro de la distribución observada
//      del mercado — multiplicar encima era doble conteo de la misma señal.
//   2. El único dato self-reportado de edificios dedicados NO muestra prima;
//      observado ~0.81× (los dedicados compiten en precio, no cobran más caro).
//   3. Un operador profesional (estilo Andes) tampoco proyecta prima de ADR: su
//      valor agregado está en OCUPACIÓN estable, no en tarifa (ver
//      STR_OCUPACION_TARGET, que sí se mantiene calibrado).
// El spread de ADR entre edificios/habilitaciones es heterogeneidad del mercado,
// no una palanca que la gestión controle. Estructura intacta para re-anclar con
// data si aparece evidencia dura. NO toca la lógica de ocupación.
export const STR_ADR_FACTOR = {
  edificio: {
    residencial_puro: 1.00,
    mixto: 1.00,       // neutralizado (legacy union — ver back-compat arriba)
    dedicado: 1.00,    // neutralizado — observado ~0.81×, sin prima
  },
  habilitacion: {
    basico: 1.00,
    estandar: 1.00,    // neutralizado — sin data dura de prima por habilitación
    premium: 1.00,     // neutralizado — sin data dura de prima por habilitación
  },
} as const;

// Ronda 4b — paridad estructural con LTR.
// Tasa de proyección de plusvalía a futuro — fuente única en plusvalia-proyeccion.ts (3%).
const PLUSVALIA_ANUAL_DEFAULT = PLUSVALIA_PROYECCION_ANUAL;   // 3% nominal anual (unificado LTR+STR).
const HORIZONTE_DEFAULT = 10;           // años proyectados.
const GASTOS_CIERRE_VENTA = 0.02;       // 2% comisión + costos al vender.
// Inflación de flujos — homologación EXACTA con LTR (rama comparabilidad-motores). Antes STR
// proyectaba flat nominal; ahora espeja analysis.ts: ingreso 3,5% (ARRIENDO_INFLACION),
// costos 3% (GGCC_INFLACION), dividendo CLP 3% (INFLACION_UF, la UF ≈ inflación).
const REVENUE_INFLACION = 0.035;        // ingreso Airbnb — espejo arriendo LTR.
const COSTOS_INFLACION = 0.03;          // costos operativos — espejo ggcc/contribuciones/mantención LTR.
const DIVIDENDO_INFLACION = 0.03;       // dividendo en CLP — espejo INFLACION_UF LTR.

/** Costos mensuales por tipología: [electricidad, agua, wifi, insumos, mantencion] */
export const COSTOS_DEFAULT: Record<string, [number, number, number, number, number]> = {
  '0': [30000, 6000, 22000, 18000, 8000],
  '1': [35000, 8000, 22000, 20000, 11000],
  '2': [55000, 12000, 22000, 22000, 20000],
  '3': [72000, 20000, 22000, 27000, 25000],
};

// Amoblamiento base por dormitorios (CLP). Iter 2026-05-10: re-calibración
// según Andes proforma + Habilitación STR Santiago. Valores BASE — se
// multiplican por factor de habilitación (ver getCostoAmoblamientoEscalado).
export const AMOBLAMIENTO_DEFAULT: Record<string, number> = {
  '0': 2500000,   // studio = 1D para amoblamiento
  '1': 2500000,
  '2': 3500000,
  '3': 5000000,
};

// Factor de habilitación sobre el costo base de amoblamiento.
//   básico:   funcional, fotos amateur → ×1.0
//   estándar: decente + fotos pro     → ×1.3
//   premium:  curado + amenidades     → ×2.1
export const AMOBLAMIENTO_FACTOR_HABILITACION: Record<HabilitacionSTR, number> = {
  basico: 1.0,
  estandar: 1.3,
  premium: 2.1,
};

/**
 * Costo de amoblamiento escalado por dormitorios + habilitación.
 * 1D=$2.5M, 2D=$3.5M, 3D+=$5M × factor habilitación.
 */
export function getCostoAmoblamientoEscalado(
  dormitorios: number,
  habilitacion: HabilitacionSTR = 'basico',
): number {
  const key = String(Math.min(dormitorios, 3));
  const base = AMOBLAMIENTO_DEFAULT[key] ?? AMOBLAMIENTO_DEFAULT['1'];
  const factor = AMOBLAMIENTO_FACTOR_HABILITACION[habilitacion] ?? 1.0;
  return Math.round(base * factor);
}

/**
 * Retorna costos operativos por defecto para una tipología.
 * El formulario puede llamar esto para pre-llenar los campos.
 *
 * Nota iter 2026-05-10: costoAmoblamiento ahora también acepta habilitación
 * para escalarlo. Backward-compat: si no se pasa, se usa basico (×1.0).
 */
export function getCostosDefault(dormitorios: number, habilitacion: HabilitacionSTR = 'basico') {
  const key = String(Math.min(dormitorios, 3));
  const [electricidad, agua, wifi, insumos, mantencion] = COSTOS_DEFAULT[key] ?? COSTOS_DEFAULT['1'];
  return {
    costoElectricidad: electricidad,
    costoAgua: agua,
    costoWifi: wifi,
    costoInsumos: insumos,
    mantencion,
    costoAmoblamiento: getCostoAmoblamientoEscalado(dormitorios, habilitacion),
  };
}

// =========================================
// Calibración v1 — aplicación de ejes
// =========================================

/**
 * Determina banda de ocupación según los 3 ejes del input.
 * Ver STR_OCUPACION_TARGET para los valores asociados a cada banda.
 */
export function determinarBandaOcupacion(input: {
  tipoEdificio?: TipoEdificioSTR;
  adminPro?: boolean;
}): BandaOcupacionSTR {
  const dedicado = input.tipoEdificio === 'dedicado';
  const adminPro = input.adminPro === true;

  if (dedicado && adminPro) return 'edificio_dedicado_admin_pro';
  if (dedicado && !adminPro) return 'edificio_dedicado_auto';
  if (!dedicado && adminPro) return 'admin_pro_residencial';
  return 'auto_gestion_residencial';
}

// Remediación 2026-06 — fuente de la ocupación que factura el escenario base.
// Fuente del DATO OBSERVADO (nunca es override): p50/estimated o fallback de mercado.
export type OccFuenteObservadaSTR = 'observada' | 'fallback_mercado';
// fix-occfuente-override 2026-07 — fuente de la ocupación que EFECTIVAMENTE factura
// el base. 'override' cuando el usuario definió el valor a mano: la procedencia se
// declara sin eufemismo, nunca se disfraza de dato observado.
export type OccFuenteSTR = 'override' | OccFuenteObservadaSTR;
// Fuente del ADR que factura el base. 'modelo' = p50 de AirROI ajustado por los ejes
// (edificio × habilitación); nunca es raw observado. 'override' = tarifa definida por el usuario.
export type AdrFuenteSTR = 'override' | 'modelo';

// Mediana pooled de ocupación STR Santiago (Lastarria/Providencia/Las Condes,
// n=149). Ver docs/str-benchmarks-from-airroi-2026-05.md §1. Fallback honesto
// cuando AirROI no entrega ocupación observada — nunca el occ_target.
const OCC_FALLBACK_MERCADO = 0.45;

/**
 * Resuelve la ocupación OBSERVADA a usar en el escenario base, con fallback
 * escalonado y clamp a [0.05, 0.95]:
 *   a) percentiles.occupancy.p50 si > 0            → 'observada'
 *   b) si no, estimated_occupancy si > 0           → 'observada'
 *   c) si no, OCC_FALLBACK_MERCADO (0.45)          → 'fallback_mercado'
 */
function resolveOccObservada(airbnbData: AirbnbData): { occObs: number; occFuente: OccFuenteObservadaSTR } {
  const p50 = airbnbData.percentiles?.occupancy?.p50;
  const est = airbnbData.estimated_occupancy;
  let occRaw: number;
  let occFuente: OccFuenteObservadaSTR;
  if (typeof p50 === 'number' && p50 > 0) {
    occRaw = p50;
    occFuente = 'observada';
  } else if (typeof est === 'number' && est > 0) {
    occRaw = est;
    occFuente = 'observada';
  } else {
    occRaw = OCC_FALLBACK_MERCADO;
    occFuente = 'fallback_mercado';
  }
  const occObs = Math.max(0.05, Math.min(0.95, occRaw));
  return { occObs, occFuente };
}

/**
 * Aplica los 3 ejes operacionales al baseline de AirROI:
 *   - Eje 1 (edificio) y eje 3 (habilitación) → ADR factor.
 *   - Eje 2 (admin pro) + eje 1 → banda de ocupación target.
 *
 * Si se pasan overrides manuales, prevalecen sobre los valores derivados.
 * Los ejes siguen calculándose como referencia (UI pedagógica).
 */
export function aplicarEjesSTR(
  airbnbData: AirbnbData,
  input: {
    tipoEdificio?: TipoEdificioSTR;
    habilitacion?: HabilitacionSTR;
    adminPro?: boolean;
    adrOverride?: number | null;
    occOverride?: number | null;
  },
): EjesAplicadosSTR {
  const tipoEdificio = input.tipoEdificio ?? 'residencial_puro';
  const habilitacion = input.habilitacion ?? 'basico';
  const adminPro = input.adminPro === true;

  const factorEdificio = STR_ADR_FACTOR.edificio[tipoEdificio];
  const factorHabilitacion = STR_ADR_FACTOR.habilitacion[habilitacion];
  const factorADRTotal = factorEdificio * factorHabilitacion;

  const banda = determinarBandaOcupacion({ tipoEdificio, adminPro });
  const ocupacionTarget = STR_OCUPACION_TARGET[banda];

  const adrBaselineP50 = airbnbData.percentiles.average_daily_rate.p50;
  const adrAjustado = Math.round(adrBaselineP50 * factorADRTotal);

  // Resolver overrides. null/undefined → usar derivado; número válido → override.
  const adrOverrideValido = typeof input.adrOverride === 'number'
    && Number.isFinite(input.adrOverride)
    && input.adrOverride > 0;
  const occOverrideValido = typeof input.occOverride === 'number'
    && Number.isFinite(input.occOverride)
    && input.occOverride > 0
    && input.occOverride <= 1;

  // Remediación 2026-06: el base factura la ocupación OBSERVADA (occObs), no el
  // occ_target. ocupacionTarget queda como referencia del escenario upside.
  const { occObs } = resolveOccObservada(airbnbData);
  const adrFinal = adrOverrideValido ? Math.round(input.adrOverride as number) : adrAjustado;
  const ocupacionFinal = occOverrideValido ? (input.occOverride as number) : occObs;

  return {
    tipoEdificio,
    habilitacion,
    adminPro,
    factorEdificio,
    factorHabilitacion,
    factorADRTotal,
    banda,
    ocupacionTarget,
    adrBaselineP50,
    adrAjustado,
    ocupacionBaselineP50: airbnbData.percentiles.occupancy.p50,
    adrOverride: adrOverrideValido ? Math.round(input.adrOverride as number) : null,
    occOverride: occOverrideValido ? (input.occOverride as number) : null,
    adrFinal,
    ocupacionFinal,
  };
}

// =========================================
// Helpers
// =========================================

/**
 * Dividendo mensual (cuota fija francesa).
 * Misma fórmula que analysis.ts — duplicada aquí para no modificar ese archivo.
 * tasaAnual en decimal (0.045 = 4.5%).
 */
function calcDividendo(creditoCLP: number, tasaAnualDecimal: number, plazoAnos: number): number {
  if (creditoCLP <= 0) return 0;
  const tasaMensual = tasaAnualDecimal / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(creditoCLP / n);
  return Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function calcEscenario(
  label: string,
  ingresoAnual: number,
  adrReferencia: number,
  ocupacionReferencia: number,
  comisionRate: number,
  costosOperativosTotales: number,
  dividendoMensual: number,
  precioCompra: number,
  capitalInvertido: number,
  pieCLP: number,
  razonSinPie: RazonSinCapital,
): EscenarioSTR {
  const ingresoBrutoMensual = Math.round(ingresoAnual / 12);
  const comisionMensual = Math.round(ingresoBrutoMensual * comisionRate);
  const ingresoNetoComision = ingresoBrutoMensual - comisionMensual;
  const noiMensual = ingresoNetoComision - costosOperativosTotales;
  const flujoCajaMensual = noiMensual - dividendoMensual;

  const noiAnual = noiMensual * 12;
  const capRate = precioCompra > 0 ? noiAnual / precioCompra : 0;
  // Pie cero (fase 1-2): sin pie no hay capital propio que rente — CoC 'no_aplica'
  // aunque capitalInvertido > 0 por amoblamiento/CapEx (no son capital propio).
  const cashOnCash: MetricaSobreCapital =
    pieCLP === 0
      ? metricaNoAplica(razonSinPie)
      : metricaValor(capitalInvertido > 0 ? (flujoCajaMensual * 12) / capitalInvertido : 0);
  const rentabilidadBruta = precioCompra > 0 ? (ingresoBrutoMensual * 12) / precioCompra : 0;

  return {
    label,
    ingresoAnual,
    ingresoBrutoMensual,
    comisionMensual,
    costosOperativos: costosOperativosTotales,
    noiMensual,
    flujoCajaMensual,
    capRate,
    cashOnCash,
    rentabilidadBruta,
    adrReferencia,
    ocupacionReferencia,
  };
}

/**
 * Saldo de crédito al mes M (cuota fija francesa).
 * tasaAnualDecimal en decimal (0.045 = 4.5%) — convención STR.
 */
function saldoCreditoSTR(creditoInicial: number, tasaAnualDecimal: number, plazoAnos: number, mesActual: number): number {
  if (creditoInicial <= 0) return 0;
  const tasaMensual = tasaAnualDecimal / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return creditoInicial * (1 - mesActual / n);
  const dividendo = (creditoInicial * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  return creditoInicial * Math.pow(1 + tasaMensual, mesActual) -
    dividendo * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual);
}

/**
 * Proyecciones año-a-año para Patrón 7 (Advanced Section). Ronda 4b.
 *
 * Año 1 aplica perdidaRampUp (5 primeros meses operan al 50/60/70/80/90%).
 * Año 2+ flujo a NOI base sin ramp-up.
 * Plusvalía: compoundéa desde año 1 (a diferencia del LTR pre-entrega).
 */
function buildProjections(
  input: ShortTermInputs,
  capitalInvertido: number,
  dividendoMensual: number,
  ingresoBaseAnual: number,
  comisionRate: number,
  costosOperativosMensual: number,
  perdidaRampUp: number,
  asOf: Date,
  horizonte: number = HORIZONTE_DEFAULT,
  plusvaliaAnual: number = PLUSVALIA_ANUAL_DEFAULT,
): YearProjectionSTR[] {
  void capitalInvertido;
  // ── Pre-entrega (paso 3) ────────────────────────────────────────────────────
  // Hasta acá el motor hacía `void asOf` y componía desde el mes 1 aunque el
  // depto se entregara en 2029. Ahora la espera se modela, homologada con LTR
  // (calcProjections):
  //
  //   · DEUDA — el banco no cursa hasta la escritura, así que el saldo es 0
  //     mientras el año termine antes de la entrega, y desde ahí amortiza por
  //     los meses efectivamente transcurridos, no por el calendario.
  //   · FLUJO — no hay operación sin depto. El año que CRUZA la escritura opera
  //     solo sus meses posteriores, prorrateados.
  //   · RAMP-UP — la curva de estabilización arranca EN LA ENTREGA, no en el
  //     año 1: el reloj de reputación empieza cuando publicas, no cuando
  //     prometes. Antes castigaba un año en que el depto ni existía.
  //
  // El VALOR del activo sí corre continuo desde el año 0 (ya lo hacía): el
  // precio queda pactado y el mercado se mueve mientras esperas — misma
  // doctrina que superó al Modelo B3 en LTR.
  const mesesPreEntrega = mesesHastaEntregaDesdeFecha(input.estadoVenta, input.fechaEntrega, asOf);
  const precioCompra = input.precioCompra;
  const pie = Math.round(precioCompra * input.piePercent);
  const montoCredito = precioCompra - pie;
  const dividendoAnualBase = dividendoMensual * 12;
  const costosOperativosAnualBase = costosOperativosMensual * 12;

  const projections: YearProjectionSTR[] = [];
  let flujoAcumulado = 0;

  for (let year = 1; year <= horizonte; year++) {
    const valorDepto = precioCompra * Math.pow(1 + plusvaliaAnual, year);

    // Meses de crédito EFECTIVAMENTE corridos: el reloj parte en la escritura.
    const mesFin = year * 12;
    const mesesCredito = Math.max(0, mesFin - mesesPreEntrega);
    const saldo = mesFin < mesesPreEntrega
      ? 0
      : Math.max(0, saldoCreditoSTR(montoCredito, input.tasaCredito, input.plazoCredito, Math.min(mesesCredito, input.plazoCredito * 12)));

    // Inflación homologada a LTR (antes flat). El NOI se recompone año a año: ingreso 3,5%,
    // costos 3%, dividendo 3%. La comisión escala con el ingreso inflado. En año 1 el NOI
    // recompuesto == noiAnualBase (ingresoBase - comisiónBase - costosBase), sin regresión.
    const ingresoAnual = ingresoBaseAnual * Math.pow(1 + REVENUE_INFLACION, year - 1);
    const comisionAnual = ingresoAnual * comisionRate;
    const costosAnual = costosOperativosAnualBase * Math.pow(1 + COSTOS_INFLACION, year - 1);
    const noiAnual = ingresoAnual - comisionAnual - costosAnual;
    const dividendoAnual = dividendoAnualBase * Math.pow(1 + DIVIDENDO_INFLACION, year - 1);

    // Meses operativos del año: 12 salvo el que cruza la escritura, que opera
    // solo su cola. Antes de la entrega no hay ni ingreso ni dividendo.
    const mesesOperativos = Math.min(12, Math.max(0, mesFin - mesesPreEntrega));
    const proporcion = mesesOperativos / 12;

    // El ramp-up se aplica en el PRIMER año con operación, no en el year 1 del
    // calendario. Con entrega inmediata (mesesPreEntrega 0) ese año ES el 1 y
    // el término queda idéntico al previo — sin regresión.
    const primerAnioOperativo = Math.floor(mesesPreEntrega / 12) + 1;
    const rampUpDelAnio = year === primerAnioOperativo ? perdidaRampUp : 0;

    // (a) El amoblamiento se compra al recibir el depto: sale del bolsillo en el
    // primer año operativo, no al firmar la promesa. Con entrega inmediata ya
    // está en `capitalInvertido` del día 1 y acá vale 0 — sin doble conteo.
    const amoblamientoDelAnio =
      mesesPreEntrega > 0 && year === primerAnioOperativo ? (input.costoAmoblamiento || 0) : 0;

    const flujoOperacionalAnual =
      (noiAnual - dividendoAnual) * proporcion - rampUpDelAnio - amoblamientoDelAnio;

    flujoAcumulado += flujoOperacionalAnual;

    const aporteMensualPromedio = flujoOperacionalAnual < 0
      ? Math.round(Math.abs(flujoOperacionalAnual) / 12)
      : 0;

    // Patrimonio neto = valor activo − deuda, SIN flujo acumulado (homologación LTR,
    // analysis.ts:640). El flujo acumulado se preserva como campo propio (proyección +
    // SaleBlock) pero NO entra al patrimonio: eso lo hacía incomparable con LTR.
    const patrimonioNeto = valorDepto - saldo;

    projections.push({
      year,
      valorDepto: Math.round(valorDepto),
      saldoCredito: Math.round(saldo),
      flujoOperacionalAnual: Math.round(flujoOperacionalAnual),
      flujoAcumulado: Math.round(flujoAcumulado),
      aporteMensualPromedio,
      patrimonioNeto: Math.round(patrimonioNeto),
      mesesOperativos,
      ingresoAnual: Math.round(ingresoAnual * proporcion),
      comisionAnual: Math.round(comisionAnual * proporcion),
      costosAnual: Math.round(costosAnual * proporcion),
      ingresoNetoAnual: Math.round(noiAnual * proporcion),
      cuotaAnual: Math.round(dividendoAnual * proporcion),
      estabilizacionAnual: Math.round(rampUpDelAnio),
      amoblamientoAnual: Math.round(amoblamientoDelAnio),
    });
  }

  return projections;
}

/**
 * Escenario de salida en año N. Ronda 4b.
 * Replica la firma de `calcExitScenario` del LTR adaptada a STR.
 */
function buildExitScenario(
  projections: YearProjectionSTR[],
  capitalInicial: number,
  pieCLP: number,
  razonSinPie: RazonSinCapital,
  yearVenta: number = HORIZONTE_DEFAULT,
): ExitScenarioSTR {
  // Pie cero (fase 1-2): sin capital propio el multiplicador no aplica, aunque
  // capitalInicial > 0 por amoblamiento/CapEx (no son capital propio).
  const sinPie = pieCLP === 0;
  const idx = Math.min(yearVenta - 1, projections.length - 1);
  const proy = projections[idx];
  if (!proy) {
    return {
      yearVenta, valorVenta: 0, saldoCreditoAlVender: 0, gastosCierre: 0,
      flujoAcumuladoAlVender: 0, equityCLP: 0, retornoTotal: 0, totalAportado: 0, inversionInicial: Math.round(capitalInicial),
      multiplicadorCapital: sinPie ? metricaNoAplica(razonSinPie) : metricaValor(0),
      tirAnual: sinPie ? metricaNoAplica(razonSinPie) : metricaValor(0),
    };
  }

  const valorVenta = proy.valorDepto;
  const saldoCreditoAlVender = proy.saldoCredito;
  const gastosCierre = Math.round(valorVenta * GASTOS_CIERRE_VENTA);
  const flujoAcumuladoAlVender = proy.flujoAcumulado;
  // EQUITY al vender = valor − deuda − cierre, SIN flujo acumulado. Homologación EXACTA con
  // LTR (analysis.ts:682): "lo que te queda en la mano al liquidar el activo". El flujo
  // operativo ya lo recibiste durante los años → vive aparte en `retornoTotal` (espejo
  // analysis.ts:683), no dentro del equity/patrimonio.
  const equityCLP = valorVenta - saldoCreditoAlVender - gastosCierre;
  const retornoTotal = flujoAcumuladoAlVender + equityCLP;
  // Multiplicador = EQUITY(sin flujo) / total aportado, con totalAportado = capital inicial
  // + Σ aportes mensuales negativos. Espejo EXACTO de analysis.ts:704,727-729: mata el
  // doble-conteo latente (antes equity-con-flujo/capitalInicial subestimaba el múltiplo en
  // deals de flujo negativo — el flujo negativo se restaba en el numerador sin compensarse
  // en el denominador). CRUDO: el render/hallazgo redondea.
  const aportesNegativos = projections
    .slice(0, yearVenta)
    .filter((p) => p.flujoOperacionalAnual < 0)
    .reduce((sum, p) => sum + Math.abs(p.flujoOperacionalAnual), 0);
  const totalAportado = capitalInicial + aportesNegativos;
  const multiplicadorCapital = totalAportado > 0
    ? equityCLP / totalAportado
    : 0;

  // TIR: T0 = -capitalInicial; T1..T_{n-1} = flujoOperacional anual;
  // T_n = flujoOperacional + (valorVenta - saldo - cierre).
  const flujos: number[] = [-capitalInicial];
  for (let i = 0; i < yearVenta && i < projections.length; i++) {
    let flujo = projections[i].flujoOperacionalAnual;
    if (i === yearVenta - 1) {
      flujo += valorVenta - saldoCreditoAlVender - gastosCierre;
    }
    flujos.push(flujo);
  }
  // El solver puede no encontrar raíz (flujo cuyo VPN nunca cruza cero). Ese
  // estado viaja tipado hasta el borde: NO se colapsa a 0 acá. Ver finance/irr.ts.
  const tirIRR = calcIRRPct(flujos);
  const tirMetrica: MetricaTIR = sinPie
    ? metricaNoAplica(razonSinPie)
    : tirIRR.ok
      ? metricaValor(tirIRR.rate)
      : metricaNoCalculable(tirIRR.reason);

  return {
    yearVenta,
    valorVenta: Math.round(valorVenta),
    saldoCreditoAlVender: Math.round(saldoCreditoAlVender),
    gastosCierre,
    flujoAcumuladoAlVender: Math.round(flujoAcumuladoAlVender),
    equityCLP: Math.round(equityCLP),
    retornoTotal: Math.round(retornoTotal),
    totalAportado: Math.round(totalAportado),
    inversionInicial: Math.round(capitalInicial),
    multiplicadorCapital: sinPie ? metricaNoAplica(razonSinPie) : metricaValor(multiplicadorCapital),
    // Espejo exacto del multiplicador de arriba: sin capital propio no hay retorno
    // sobre lo invertido que medir, aunque capitalInicial > 0 por amoblamiento/CapEx.
    tirAnual: tirMetrica,
  };
}

// =========================================
// Motor principal
// =========================================

export function calcShortTerm(input: ShortTermInputs, asOf: Date = new Date()): ShortTermResult {
  const { precioCompra, airbnbData, modoGestion, comisionAdministrador } = input;

  // --- 1. Cálculos base ---
  const pie = Math.round(precioCompra * input.piePercent);
  // Fase 5b: origen del pie 0 declarado en el wizard; ausente ⇒ no se preguntó.
  const razonSinPie: RazonSinCapital = input.razonSinPie ?? "sin_pie";
  const montoCredito = precioCompra - pie;
  const dividendoMensual = calcDividendo(montoCredito, input.tasaCredito, input.plazoCredito);
  const gastosCierre = Math.round(precioCompra * GASTOS_CIERRE_PCT);
  // CapEx puesta a punto (usados): ADICIONAL al amoblado, no lo reemplaza.
  const capexPuestaAPunto = calcCapexPuestaAPunto({
    antiguedad: input.antiguedad ?? 0,
    superficieUtilM2: input.superficie,
    valorUF: input.valorUF,
    overrideCLP: input.costoPuestaAPuntoCLP,
    modelo: resolverModeloCostos(input.methodologyVersion),
  });
  // (a) AMOBLAMIENTO EN LA ENTREGA, no al firmar. Nadie compra sofás para un
  // edificio que se entrega en 2029. Con pre-entrega el amoblamiento sale del
  // capital del DÍA 1 y entra como egreso en el año de la escritura (ver
  // buildProjections). El capital total comprometido es el mismo; lo que cambia
  // es CUÁNDO. Con entrega inmediata el término queda idéntico al previo.
  const mesesPreEntregaCap = mesesHastaEntregaDesdeFecha(input.estadoVenta, input.fechaEntrega, asOf);
  const amoblamientoDia1 = mesesPreEntregaCap > 0 ? 0 : input.costoAmoblamiento;
  const capitalInvertido = calcInversionInicialCLP({
    pieCLP: pie,
    gastosCierreCLP: gastosCierre,
    costoAmoblamientoCLP: amoblamientoDia1,
    capexPuestaAPuntoCLP: capexPuestaAPunto.montoCLP,
  });
  const hallazgoPuestaAPunto = buildHallazgoPuestaAPunto({
    capex: capexPuestaAPunto,
    antiguedad: input.antiguedad ?? 0,
    superficieUtilM2: input.superficie,
    modalidad: "str",
    inversionInicialCLP: capitalInvertido,
    // FORWARD-ONLY E.1b: en STR el capex NO mueve las 4 dims del score (capitalInvertido no
    // entra a rentabilidad/sostenibilidad/ventaja/factibilidad) → SOLO-LECTURA, decisividad 0.
    // La fracción capex/inversión pasa a magnitudContinua (desempate del sort de la pirámide).
    decisividad: 0,
    magnitudContinua: Math.max(0, Math.min(1, capitalInvertido > 0 ? capexPuestaAPunto.montoCLP / capitalInvertido : 0)),
    // Honestidad de la procedencia: 'baja' solo si la antigüedad nació de un
    // fallback del borde (el caller lo marca). Si vino real del payload, 'media'.
    antiguedadEsFallback: input.antiguedadEsFallback ?? false,
    // Fase 5b · D4: sin pie el % sobre la inversión inicial miente.
    sinCapitalPropio: pie === 0,
    valorUF: input.valorUF,
  });

  // Comisión según modo de gestión
  const comisionRate = modoGestion === 'auto' ? COMISION_AIRBNB : comisionAdministrador;

  // Costos operativos fijos mensuales (contribuciones trimestrales → mensualizadas)
  const contribucionesMensuales = Math.round((input.contribuciones || 0) / 3);
  const costosDirectos = input.costoElectricidad + input.costoAgua + input.costoWifi + input.costoInsumos;
  const costosOperativosTotales = costosDirectos + input.gastosComunes + input.mantencion + contribucionesMensuales;

  // Helper parcial
  const buildEscenario = (label: string, ingresoAnual: number, adr: number, ocu: number) =>
    calcEscenario(label, ingresoAnual, adr, ocu, comisionRate, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido, pie, razonSinPie);

  // --- 2. Escenarios ---
  // Calibración v1: el escenario `base` se construye con los 3 ejes
  // operacionales (tipo de edificio, habilitación, admin pro). Ramps el ADR
  // p50 de AirROI por factores de edificio y habilitación, y reemplaza la
  // occupancy p50 por la ocupación target de la banda operacional.
  // Conservador y agresivo conservan la dispersión relativa observada en
  // AirROI (p25/p50, p75/p50) para mantener el ancho del intervalo.
  const p = airbnbData.percentiles;
  const ejes = aplicarEjesSTR(airbnbData, {
    tipoEdificio: input.tipoEdificio,
    habilitacion: input.habilitacion,
    adminPro: input.adminPro,
    adrOverride: input.adrOverride,
    occOverride: input.occOverride,
  });

  // Remediación 2026-06 — el escenario BASE factura la ocupación OBSERVADA de
  // AirROI (occObs, vía ejes.ocupacionFinal) o el override manual; ya NO el
  // occ_target. El occ_target se mueve al escenario upside (`agresivo`). El ADR
  // y sus uplifts no se tocan.
  // fix-occfuente-override 2026-07 — la fuente se deriva de DÓNDE salió el valor, no de
  // un flag paralelo. Si el usuario puso override, `occFuente='override'`; si no, la fuente
  // real del dato observado. `occObservada` guarda el dato de mercado SIEMPRE (aunque haya
  // override) para poder declarar ambos valores sin esconder la evidencia.
  const { occObs, occFuente: occObservadaFuente } = resolveOccObservada(airbnbData);
  const occFuente: OccFuenteSTR = ejes.occOverride != null ? 'override' : occObservadaFuente;
  const adrFuente: AdrFuenteSTR = ejes.adrOverride != null ? 'override' : 'modelo';
  const adrBase = ejes.adrFinal;
  const occBase = ejes.ocupacionFinal;  // override manual, o la ocupación OBSERVADA
  const ingresoBase = Math.round(adrBase * occBase * 365);

  // Conservador: anclado en la ocupación OBSERVADA absoluta (p25), no en
  // occBase × shift. El ADR baja por el shift p25/p50 de AirROI (sin tocar uplifts).
  const adrShiftP25 = p.average_daily_rate.p50 > 0 ? p.average_daily_rate.p25 / p.average_daily_rate.p50 : 0.85;
  const adrConservador = Math.round(adrBase * adrShiftP25);
  const occConservador = Math.max(0.05, Math.min(0.95, p.occupancy.p25));
  const ingresoConservador = Math.round(adrConservador * occConservador * 365);

  // Agresivo repurposed → UPSIDE: "potencial con gestión profesional"
  // (estabilizado mes 7+). occ = occ_target de la banda; ADR = adrBase (mismo
  // ADR uplifted del p50 — el upside es puramente de ocupación). El label/copy
  // se ajusta en la capa UI.
  const occAgresivo = ejes.ocupacionTarget;
  const adrAgresivo = adrBase;
  const ingresoAgresivo = Math.round(adrBase * occAgresivo * 365);

  const conservador = buildEscenario('Conservador', ingresoConservador, adrConservador, occConservador);
  const base = buildEscenario('Base', ingresoBase, adrBase, occBase);
  const agresivo = buildEscenario('Agresivo', ingresoAgresivo, adrAgresivo, occAgresivo);

  // --- 3. Break-even ---
  const breakEvenIngresoMensual = (1 - comisionRate) > 0
    ? (costosOperativosTotales + dividendoMensual) / (1 - comisionRate)
    : Infinity;
  const breakEvenIngresoAnual = Math.round(breakEvenIngresoMensual * 12);
  // El break-even se compara contra el ingreso del escenario base CALIBRADO
  // (no contra el p50 raw de AirROI), para mantener consistencia con el resto
  // de los KPIs que el usuario ve.
  const breakEvenPctDelMercado = ingresoBase > 0
    ? breakEvenIngresoAnual / ingresoBase
    : Infinity;

  // --- 4. Comparativa STR vs LTR ---
  const ltr_ingresoBruto = input.arriendoLargoMensual;
  const ltr_comisionAdmin = Math.round(ltr_ingresoBruto * COMISION_LTR);
  const ltr_ingresoNeto = ltr_ingresoBruto - ltr_comisionAdmin;
  const ltr_noiMensual = ltr_ingresoNeto - input.gastosComunes - input.mantencion - contribucionesMensuales;
  const ltr_flujoCaja = ltr_noiMensual - dividendoMensual;

  // STR auto y admin para la comparativa: ambos sobre el ingresoBase calibrado
  // (mismo ADR ajustado y misma ocupación target). Lo único que cambia entre
  // los dos es la comisión que se paga.
  const str_auto = calcEscenario('Auto', ingresoBase, adrBase, occBase, COMISION_AIRBNB, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido, pie, razonSinPie);
  const str_admin = calcEscenario('Administrador', ingresoBase, adrBase, occBase, comisionAdministrador, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido, pie, razonSinPie);

  // Sobre-renta del modo actualmente seleccionado (escenario base)
  const sobreRenta = base.noiMensual - ltr_noiMensual;
  const sobreRentaPct = ltr_noiMensual !== 0 ? sobreRenta / ltr_noiMensual : 0;
  // P3 (Rama 0b): el pct solo es confiable con NOI-LTR materialmente positivo. Con NOI-LTR
  // ≤0 o ratio explotado, la superficie muestra "N/D" + `sobreRenta` absoluto y la banda
  // clasifica por absoluto. No mutamos `sobreRentaPct` (audit/legibilidad); la señal viaja
  // en el flag.
  const sobreRentaPctConfiable = sobreRentaPctEsConfiable(ltr_noiMensual, sobreRentaPct);

  // Payback amoblamiento
  let paybackMeses: number;
  if (input.costoAmoblamiento <= 0) {
    paybackMeses = 0;
  } else if (sobreRenta <= 0) {
    paybackMeses = -1;
  } else {
    paybackMeses = Math.round(input.costoAmoblamiento / sobreRenta);
  }

  // --- 5. Estacionalidad (escenario base) ---
  const flujoEstacional: FlujoEstacionalMes[] = airbnbData.monthly_revenue.map((factor, i) => {
    const ingresoBruto = Math.round(base.ingresoAnual * factor);
    const comision = Math.round(ingresoBruto * comisionRate);
    const ingresoNeto = ingresoBruto - comision - costosOperativosTotales;
    const flujo = ingresoNeto - dividendoMensual;
    return {
      mes: MESES[i] ?? `Mes ${i + 1}`,
      ingresoBruto,
      ingresoNeto,
      flujo,
      factor,
    };
  });

  // --- 6. Ramp-up ---
  // Suma la pérdida mensual por cada mes parcial (todos los factores salvo
  // el último, que es 1.00 → mes ya estabilizado). Curva actual: 6 meses.
  const ingresoBrutoMensualBase = base.ingresoBrutoMensual;
  const mesesParciales = STR_RAMP_UP.slice(0, -1);
  const perdidaRampUp = Math.round(
    mesesParciales.reduce((acum, factor) => acum + ingresoBrutoMensualBase * (1 - factor), 0),
  );

  // --- Sensibilidad ---
  const sensibilidadKeys: Array<{ label: string; ingreso: number }> = [
    { label: 'P25', ingreso: p.revenue.p25 },
    { label: 'P50', ingreso: p.revenue.p50 },
    { label: 'P75', ingreso: p.revenue.p75 },
    { label: 'P90', ingreso: p.revenue.p90 },
    { label: 'Promedio', ingreso: p.revenue.avg },
  ];

  const sensibilidad: SensibilidadRow[] = sensibilidadKeys.map(({ label, ingreso }) => {
    const mensual = Math.round(ingreso / 12);
    const comision = Math.round(mensual * comisionRate);
    const noi = mensual - comision - costosOperativosTotales;
    const sr = noi - ltr_noiMensual;
    const srPct = ltr_noiMensual !== 0 ? sr / ltr_noiMensual : 0;
    return {
      label,
      ingresoAnual: ingreso,
      noiMensual: noi,
      sobreRenta: sr,
      sobreRentaPct: srPct,
      sobreRentaPctConfiable: sobreRentaPctEsConfiable(ltr_noiMensual, srPct),
    };
  });

  // --- 7. Veredicto (legacy audit-only) ---
  // Commit E.1 · 2026-05-13: el motor STR YA NO emite el veredicto canónico.
  // FrancoScoreSTR (short-term-score.ts) es la única fuente de verdad. Esta
  // heurística se preserva como `legacyEngineVeredicto` para auditoría de
  // análisis legacy y comparación pre/post recalibración. El api route
  // sobrescribe `result.veredicto` con `francoScore.veredicto` al persistir,
  // por lo que la UI nunca lee este valor.
  //
  // La heurística antigua decía "STR conviene si renta +10% más que LTR"
  // ignorando CoC / break-even / flujo — caso degenerado: depto que rinde
  // +42% sobre LTR pero pierde plata cada mes recibía COMPRAR.
  let legacyEngineVeredicto: STRVerdict;
  if (sobreRentaPct >= 0.10) {
    legacyEngineVeredicto = 'COMPRAR';
  } else if (sobreRentaPct >= 0 && base.noiMensual > 0) {
    legacyEngineVeredicto = 'AJUSTA SUPUESTOS';
  } else {
    legacyEngineVeredicto = 'BUSCAR OTRA';
  }

  // --- 8. Projections + Exit (Ronda 4b) ---
  const projections = buildProjections(
    input,
    capitalInvertido,
    dividendoMensual,
    base.ingresoAnual,
    comisionRate,
    costosOperativosTotales,
    perdidaRampUp,
    asOf,
  );
  const exitScenario = buildExitScenario(projections, capitalInvertido, pie, razonSinPie);

  // --- 9. Subsidio Ley 21.748 (Commit 3a · 2026-05-12) ---
  // Paridad con LTR analysis.ts:307-311. La rebaja NO se aplica al cálculo
  // del motor — se reporta como metadata para que UI/IA sugieran al usuario
  // pedir tasa subsidiada al banco si califica.
  const precioUF = input.valorUF > 0 ? input.precioCompra / input.valorUF : 0;
  const tasaIngresadaPct = input.tasaCredito * 100;
  const subsidioTasa = (() => {
    // POR QUÉ ACÁ ES `tipoPropiedad` Y EN LTR ES `esNuevo` (revisado 20-ago-2026)
    // Parece una asimetría y no lo es: los dos salen del MISMO campo del wizard.
    // `buildLtrPayload` deriva `esNuevo: a.tipoPropiedad === "nuevo"` porque el
    // input LTR tiene además un `tipo` que siempre vale "Departamento" y no
    // sirve para decidir; el input STR no tiene ese campo ambiguo y lleva el
    // `tipoPropiedad` crudo, así que acá no hace falta el rodeo.
    //
    // Unificar hacia `esNuevo` exigiría agregar el campo al tipo del input STR,
    // al payload y al pipeline, para llegar exactamente al mismo booleano. Se
    // evaluó y se descartó: cero ganancia de conducta, y tocar el borde del
    // motor STR por prolijidad es como se rompen las cosas.
    const califica = calificaSubsidio(input.tipoPropiedad ?? "", precioUF);
    // Tasa de mercado real (wizard v4, decimal → %) o fallback (legacy → idéntico al previo).
    const tasaMercadoPct = input.tasaMercado && input.tasaMercado > 0 ? input.tasaMercado * 100 : TASA_MERCADO_FALLBACK;
    const tasaConSubsidio = calcTasaConSubsidio(tasaMercadoPct);
    return {
      califica,
      tasaConSubsidio,
      aplicado: califica && aplicaSubsidio(tasaIngresadaPct, tasaConSubsidio),
    };
  })();

  // --- 10. Sensibilidad de precio (Commit 3a · 2026-05-12) ---
  // Recalcula CAP / CoC / payback con precio reducido (-5%, -10%). El ingreso
  // (ADR × occ × 365) y los costos operativos NO cambian con el precio — sólo
  // cambian el crédito, el dividendo, el capital invertido y los ratios.
  const sensibilidadPrecio = calcSensibilidadPrecio(
    input,
    base,
    costosOperativosTotales,
    comisionRate,
    capexPuestaAPunto.montoCLP,
    razonSinPie,
  );

  // --- 11. Viabilidad STR honesta por zona (Commit 4 · 2026-05-12; V2 Goal 4 · 2026-09-04) ---
  // Universo V2 calculado desde las respuestas de mercado guardadas (str-universo-santiago.gen.ts):
  // percentiles contra las comunas con datos + contexto comunal de la ocupación para La zona.
  const zonaSTR = calcZonaSTR(
    input.comuna ?? "",
    airbnbData.percentiles.average_daily_rate.p50,
    airbnbData.percentiles.occupancy.p50,
  );
  // D1+D2 (Rama superficie AMBAS): veredicto comparativo tipado. Break-even por modo con
  // la misma fórmula del motor ((costos+dividendo)/(1−comisión), anualizado / ingresoBase),
  // invariante al modo salvo la comisión. `str_auto`/`str_admin` ya calculados arriba dan la
  // sobre-renta de cada modo para el flip de gestión.
  const breakEvenAutoPct = ingresoBase > 0 && (1 - COMISION_AIRBNB) > 0
    ? Math.round(((costosOperativosTotales + dividendoMensual) / (1 - COMISION_AIRBNB)) * 12) / ingresoBase
    : Infinity;
  const breakEvenAdminPct = ingresoBase > 0 && (1 - comisionAdministrador) > 0
    ? Math.round(((costosOperativosTotales + dividendoMensual) / (1 - comisionAdministrador)) * 12) / ingresoBase
    : Infinity;
  const veredictoComparativo = calcVeredictoComparativo({
    modoActual: (modoGestion === "auto" ? "auto" : "admin") as ModoGestionAmbas,
    tierZona: zonaSTR.tierZona,
    ltrNoiMensual: ltr_noiMensual,
    strNoiMensual: base.noiMensual,
    sobreRenta,
    sobreRentaPct,
    sobreRentaPctConfiable,
    breakEvenPctDelMercado,
    strAutoNoiMensual: str_auto.noiMensual,
    strAdminNoiMensual: str_admin.noiMensual,
    breakEvenAutoPct,
    breakEvenAdminPct,
  });
  const recomendacionModalidad = veredictoComparativo.recomendacion;

  return {
    // `veredicto` se preserva como placeholder de tipo. El api route
    // sobrescribe con `francoScore.veredicto` al persistir, por lo que UI
    // nunca lee este valor. Ver `legacyEngineVeredicto` para el audit value.
    veredicto: legacyEngineVeredicto,
    legacyEngineVeredicto,
    ejesAplicados: ejes,
    pie,
    montoCredito,
    dividendoMensual,
    capitalInvertido,
    metrics: (() => {
      const ingreso = base.ingresoBrutoMensual;
      const comisionPlataforma = modoGestion === 'auto' ? base.comisionMensual : 0;
      const administrador = modoGestion === 'auto' ? 0 : base.comisionMensual;
      const costosOperar = base.comisionMensual + costosOperativosTotales;
      const exceso = Math.max(0, costosOperar + dividendoMensual - ingreso);
      const libre = Math.max(0, ingreso - costosOperar - dividendoMensual);
      return {
        ingresoEstabilizadoMensual: ingreso,
        ingresoEstabilizadoAnual: base.ingresoAnual,
        flujoMensual: base.flujoCajaMensual,
        capRatePct: base.capRate * 100,
        tirPct: exitScenario ? metricaValorONull(exitScenario.tirAnual) : null,
        tarifaNoche: adrBase,
        ocupacion: occBase,
        desgloseFall: {
          ingreso,
          comisionPlataforma,
          administrador,
          costosDirectos,
          gastosComunesMantencion: input.gastosComunes + input.mantencion,
          contribucionesMensuales,
          cuota: dividendoMensual,
          saleDeTuBolsillo: base.flujoCajaMensual,
        },
        tramosBarra: { ingreso, costosOperar, cuota: dividendoMensual, exceso, libre },
        dia1: { pieCLP: pie, gastosCompraCLP: gastosCierre, amoblamientoCLP: amoblamientoDia1, capexCLP: capexPuestaAPunto.montoCLP, inversionInicial: capitalInvertido },
      };
    })(),
    hallazgos: hallazgoPuestaAPunto ? [hallazgoPuestaAPunto] : [],
    escenarios: { conservador, base, agresivo },
    comparativa: {
      ltr: { ingresoBruto: ltr_ingresoBruto, noiMensual: ltr_noiMensual, flujoCaja: ltr_flujoCaja },
      str_auto,
      str_admin,
      sobreRenta,
      sobreRentaPct,
      sobreRentaPctConfiable,
      paybackMeses,
    },
    flujoEstacional,
    perdidaRampUp,
    breakEvenIngresoAnual,
    breakEvenPctDelMercado,
    sensibilidad,
    sensibilidadPrecio,
    projections,
    exitScenario,
    // Commit E.2 · 2026-05-13 — el motor STR ya no emite `engineSignal` ni
    // `francoVerdict`. FrancoScoreSTR es la única fuente del veredicto canónico
    // y se persiste como `veredicto` directo. Análisis legacy con esas llaves
    // se siguen leyendo via `readVeredicto()` (results-helpers.ts).
    subsidioTasa,
    zonaSTR,
    recomendacionModalidad,
    veredictoComparativo,
    occFuente,
    occObservada: occObs,
    occObservadaFuente,
    adrFuente,
    adrModelo: ejes.adrAjustado,
  };
}

// =========================================
// Sensibilidad al precio (Commit 3a · 2026-05-12)
// =========================================
function calcSensibilidadPrecio(
  input: ShortTermInputs,
  base: EscenarioSTR,
  costosOperativosTotales: number,
  comisionRate: number,
  capexPuestaAPuntoCLP: number = 0,
  razonSinPie: RazonSinCapital = "sin_pie",
): SensibilidadPrecioRow[] {
  const ingresoAnual = base.ingresoAnual;
  const ingresoMensual = ingresoAnual / 12;
  const comisionMensual = ingresoMensual * comisionRate;
  const noiMensualConst = ingresoMensual - comisionMensual - costosOperativosTotales;
  const noiAnual = noiMensualConst * 12;
  const variantes = [
    { label: "actual", factor: 1.0 },
    { label: "-5%", factor: 0.95 },
    { label: "-10%", factor: 0.9 },
  ];
  return variantes.map(({ label, factor }) => {
    const precioCLP = input.precioCompra * factor;
    const delta = precioCLP - input.precioCompra;
    const pieMonto = precioCLP * input.piePercent;
    const creditoMonto = precioCLP - pieMonto;
    const dividendoMensual = calcDividendo(creditoMonto, input.tasaCredito, input.plazoCredito);
    // Respeta la fórmula vigente de este companion (sin gastos de cierre); el
    // CapEx puesta a punto es el único delta nuevo (decisión sesión capex).
    const capitalInvertido = pieMonto + (input.costoAmoblamiento || 0) + capexPuestaAPuntoCLP;
    const flujoCajaMensual = noiMensualConst - dividendoMensual;
    const capRate = precioCLP > 0 ? noiAnual / precioCLP : 0;
    // Pie cero (fase 1-2): este companion no suma gastos de cierre, así que con
    // pie 0 (y sin amoblamiento/CapEx) capitalInvertido daba exactamente 0 y el
    // guard devolvía un CoC 0% FALSO. Ahora: sin pie ⇒ 'no_aplica', nunca número.
    const cashOnCash: MetricaSobreCapital =
      pieMonto === 0
        ? metricaNoAplica(razonSinPie)
        : metricaValor(capitalInvertido > 0 ? (flujoCajaMensual * 12) / capitalInvertido : 0);
    const sobreRenta = base.flujoCajaMensual; // placeholder — usamos NOI vs LTR igual
    let paybackMeses = -1;
    if ((input.costoAmoblamiento || 0) <= 0) paybackMeses = 0;
    else if (sobreRenta > 0) paybackMeses = Math.round(input.costoAmoblamiento / sobreRenta);
    return {
      label,
      precioCLP: Math.round(precioCLP),
      delta: Math.round(delta),
      capRate: Math.round(capRate * 10000) / 10000,
      cashOnCash:
        cashOnCash.tipo === "valor"
          ? metricaValor(Math.round(cashOnCash.valor * 10000) / 10000)
          : cashOnCash,
      flujoCajaMensual: Math.round(flujoCajaMensual),
      paybackMeses,
    };
  });
}
