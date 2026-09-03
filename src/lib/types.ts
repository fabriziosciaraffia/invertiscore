// Type-only (erased en compilación → sin ciclo en runtime). El nivel canónico de
// salud de financiamiento lo define financing-health.ts; el Hallazgo de estructura
// lo reusa tal cual.
import type { FinancingHealthLevel } from "./financing-health";
// Universo de la mediana comunal (nuevo|usado). Canónico en comuna-stats.ts —
// también type-only, así que no hay ciclo en runtime.
import type { CondicionMercado } from "./comuna-stats";

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
  /** LEGACY: número sin procedencia. El motor ya NO lo lee (ver valorMercadoRef /
   *  valor-mercado.ts); se sigue escribiendo para los lectores viejos. */
  valorMercadoFranco?: number;
  /** Valor estimado de mercado CON procedencia (Tramo A, 03-sep-2026): nivel de la
   *  sugerencia de venta, universo de la muestra y n. Ausente = no hay valor de
   *  mercado y el motor trabaja como si no lo hubiera. Ver valor-mercado.ts. */
  valorMercadoRef?: ValorMercadoRef | null;
  piePct: number;
  plazoCredito: number;
  tasaInteres: number;
  // Tasa hipotecaria de mercado vigente (%, ej. 4,72). OPCIONAL: solo la envía el
  // wizard v4 (data.tasaMercado). Alimenta subsidioTasa (tasa con subsidio =
  // mercado − 0,6pp y el gate `aplicado`). Ausente (v3, análisis históricos,
  // fixtures golden) ⇒ el motor cae a TASA_MERCADO_FALLBACK → comportamiento
  // byte-idéntico al previo. NO afecta la cuota (esa usa tasaInteres).
  tasaMercado?: number;
  // ¿Vivienda nueva? (respuesta explícita nuevo/usado del wizard). OPCIONAL: solo
  // la envía el wizard v4. Fuente de verdad del gate de subsidio LTR (Ley 21.748
  // exige primera venta → NUNCA derivar de antiguedad===0: un usado recién estrenado
  // daría falso positivo legal). Ausente (v3, históricos, fixtures) ⇒ el motor cae
  // al chequeo legacy sobre `tipo` (siempre false para LTR, bug v3 documentado que
  // muere en el cutover) → comportamiento byte-idéntico al previo.
  esNuevo?: boolean;
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
  // Versión de metodología del análisis — espejo de `analisis.methodology_version`
  // llevado DENTRO de input_data para que el motor lo lea sin plomería en los
  // callers de render. La estampa el borde (API routes) al CREAR, antes de correr
  // el motor y de persistir el body. Gatea el modelo de costos (mantención y
  // curva de CapEx): ≥ v3 ⇒ tablas nuevas; ausente / v1 / v2 ⇒ legacy, así que
  // ningún informe previo cambia en pantalla al recomputar. Ver modelo-costos.ts.
  methodologyVersion?: string;
  // Gate anti-drift del corretaje inicial (2% del precio, solo usados). Se setea
  // en el payload al CREAR (true iff tipoPropiedad==="usado"); persistido en
  // input_data. El motor lo lee una vez en calcMetrics → metrics.corretajeInicialCLP.
  // Ausente ⇒ false ⇒ comportamiento viejo (análisis previos recomputan idéntico).
  incluyeCorretajeInicial?: boolean;
  // Origen del pie 0 declarado en el wizard (fase 5b, "¿Por qué no pones pie?").
  // Solo tiene sentido con piePct === 0; el motor lo propaga a la razón de las
  // métricas sobre capital. Ausente ⇒ 'sin_pie' (no se preguntó): análisis
  // previos, editor inline del resumen y API directa recomputan idéntico.
  razonSinPie?: RazonSinCapital;
}

// ─── Métricas sobre capital propio (pie cero · fase 1-2) ─────────────────────
//
// Con pie 0 (100% financiamiento, típico bono pie) las métricas que dividen por
// el capital propio pierden significado: no hay pie que rente ni payback que
// medir. Estado tipado "no aplica" EN VEZ de un número inventado (0%, Infinity,
// 999). Enforcement por construcción: el consumidor que asume number no compila.
//
// Criterio de activación (decisión cerrada): pieCLP === 0. Los gastos de cierre
// (y el amoblamiento/CapEx en STR) NO cuentan como capital propio para estas
// métricas aunque sí integren capitalInvertido.
//
// La razón es un enum extensible. Fase 5b la puebla desde el wizard ("¿Por qué
// no pones pie?"); antes solo existía el genérico.
//
// 'sin_pie' vs 'no_declarada' son estados de CONOCIMIENTO distintos y por eso
// conviven: el primero es "no se preguntó" (análisis previos a fase 5b, editor
// inline del resumen, API directa) y el segundo es "se preguntó y el usuario
// declinó". La prosa los trata IGUAL (Franco no afirma el origen en ninguno de
// los dos, ver ## 5.bis.a), así que separarlos no arriesga invención; lo que
// preserva es el dato de producto — cuántos declinan — que colapsarlos borraría.
export type RazonSinCapital =
  /** No se preguntó (compat: análisis previos, editor inline, API). */
  | "sin_pie"
  /** Bono pie de la inmobiliaria — origen conocido, activa la dureza de precio. */
  | "bono_pie"
  /** Lo cubre el usuario con ahorro/familia/otra propiedad. */
  | "otra_fuente"
  /** El usuario eligió no decirlo. */
  | "no_declarada";

export type MetricaSobreCapital =
  | { tipo: "valor"; valor: number }
  | { tipo: "no_aplica"; razon: RazonSinCapital };

export const metricaValor = (valor: number): MetricaSobreCapital => ({ tipo: "valor", valor });

export const metricaNoAplica = (razon: RazonSinCapital = "sin_pie"): MetricaSobreCapital => ({
  tipo: "no_aplica",
  razon,
});

// ─── TIR: "no aplica" y "no se pudo calcular" son estados DISTINTOS ──────────
//
// `no_aplica` es una decisión del análisis (pie 0 ⇒ no hay capital propio que
// rente). `no_calculable` es una propiedad del flujo: el VPN no cruza cero en
// [−99%, 1000%], así que no existe raíz que reportar. Colapsarlos mentiría en
// las dos direcciones, y colapsar cualquiera de los dos a un número es lo que
// producía el "100%" fantasma (ver src/lib/finance/irr.ts).
//
// El estado viaja TIPADO hasta el borde a propósito: `metricaODefault(tir, 0)`
// a mitad de camino volvería a inventar un número, solo que ahora sería 0 en
// vez de 100. Los consumidores leen con metricaValorONull y deciden explícitamente.
export type RazonTIRNoCalculable = "sin-bracket" | "flujos-invalidos";

export type MetricaTIR =
  | MetricaSobreCapital
  | { tipo: "no_calculable"; razon: RazonTIRNoCalculable };

export const metricaNoCalculable = (razon: RazonTIRNoCalculable): MetricaTIR => ({
  tipo: "no_calculable",
  razon,
});

/**
 * Discriminante del estado 'no_calculable'. Espejo de `esMetricaNoAplica`: el
 * render que quiera distinguir "no aplica" (pie 0) de "no hay TIR" (flujo sin
 * raíz) tiene los dos predicados; el que solo quiera saber "¿hay número?" usa
 * metricaValorONull, que devuelve null en ambos.
 */
export function esMetricaNoCalculable(
  m: MetricaTIRSimulador | number | null | undefined,
): m is { tipo: "no_calculable"; razon: RazonTIRNoCalculable } {
  return typeof m === "object" && m !== null && m.tipo === "no_calculable";
}

// ─── La tercera razón: el horizonte del simulador ────────────────────────────
//
// `no_aplica` (pie 0) y `no_calculable` (VPN sin raíz) son propiedades del
// ANÁLISIS, y por eso las emite el motor. Que el horizonte del slider termine
// antes de la escritura es una propiedad de LO QUE EL USUARIO ESTÁ MIRANDO: el
// mismo análisis tiene TIR a 10 años y no la tiene a 2. Por eso vive acá, en la
// unión que consume el simulador, y el motor nunca la emite.
//
// Existe porque `KPIResults.tir` aplanaba a `number | null` y tiraba la razón:
// al render le llegaban las tres ausencias indistinguibles y no podía hacer más
// que un "—" pelado. El aplanado era el que mentía, no el cálculo.
export type MetricaTIRSimulador =
  | MetricaTIR
  | { tipo: "no_aplica_horizonte"; aniosPreEntrega: number };

export const metricaNoAplicaHorizonte = (aniosPreEntrega: number): MetricaTIRSimulador => ({
  tipo: "no_aplica_horizonte",
  aniosPreEntrega,
});

/**
 * Discriminante del estado 'no_aplica_horizonte'. Tercer hermano de
 * `esMetricaNoAplica` y `esMetricaNoCalculable`: juntos cubren las tres razones
 * de ausencia, y `metricaValorONull` sigue devolviendo null en las tres para
 * quien solo necesite saber si hay número.
 */
export function esMetricaNoAplicaHorizonte(
  m: MetricaTIRSimulador | number | null | undefined,
): m is { tipo: "no_aplica_horizonte"; aniosPreEntrega: number } {
  return typeof m === "object" && m !== null && m.tipo === "no_aplica_horizonte";
}

/**
 * Lectura numérica tolerante a filas persistidas pre-migración: los results
 * jsonb guardados antes del tipo traen number crudo donde hoy va la unión.
 * Devuelve el número cuando existe (unión 'valor' o number legacy finito) y
 * null cuando la métrica no aplica o falta. Los gates del motor leen por acá
 * para que un brazo sobre capital se OMITA (ni true ni false) con 'no_aplica'.
 */
export function metricaValorONull(
  m: MetricaTIRSimulador | number | null | undefined,
): number | null {
  if (typeof m === "number") return Number.isFinite(m) ? m : null;
  if (m == null) return null;
  return m.tipo === "valor" ? m.valor : null;
}

/**
 * Discriminante runtime-seguro del estado 'no_aplica' (fase 3): distingue la
 * decisión tipada del motor de un dato simplemente ausente/corrupto (legacy
 * number NaN, undefined). Solo lo que ES no_aplica recibe el tratamiento D1.
 */
export function esMetricaNoAplica(
  m: MetricaTIRSimulador | number | null | undefined,
): m is { tipo: "no_aplica"; razon: RazonSinCapital } {
  return typeof m === "object" && m !== null && m.tipo === "no_aplica";
}

/**
 * Lectura numérica con fallback. Post-fase-3b su rol es doble: (a) plumbing
 * numérico donde el consumidor NO usa el valor con pie 0 (tirForPrice,
 * negociación — ver comentarios en sitio), y (b) adaptador temporal de los
 * prompts IA, marcados TODO(pie-cero-fase-4). El render ya trata 'no_aplica'
 * con el D1 del mockup 98e2319 (esMetricaNoAplica + no-aplica-copy.ts).
 */
export function metricaODefault(
  m: MetricaTIRSimulador | number | null | undefined,
  fallback: number = 0,
): number {
  const v = metricaValorONull(m);
  return v ?? fallback;
}

/**
 * Formato display mínimo (fases 3-4): formatea el valor con `fmt` o devuelve
 * "—" cuando la métrica no aplica. Cero rediseño visual: para análisis con pie
 * > 0 el output es byte-idéntico al previo.
 */
export function metricaDisplay(
  m: MetricaTIRSimulador | number | null | undefined,
  fmt: (n: number) => string,
): string {
  const v = metricaValorONull(m);
  return v === null ? "—" : fmt(v);
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
  // ── Desglose anual (T1 del rediseño de la página, contrato CONGELADO 02-sep-2026) ──
  // Alimenta la tabla "Flujo por año" del modal de cálculo. Son los MISMOS términos
  // con los que el loop arma `flujoAnual`, solo que emitidos por separado; la
  // identidad `noiAnual − vacanciaRotacionAnual − dividendoAnual === flujoAnual` se
  // cumple exacta (la verifica scripts/eval/golden/simulacion-catch-test.ts).
  // OPCIONALES solo porque la demo de la landing (app/demo/page.tsx) trae una
  // serie escrita a mano y hay `results` legacy persistidos sin ellos; el motor los
  // emite SIEMPRE. El render que los necesite (modal de cálculo) se esconde si
  // faltan — nunca los inventa.
  /** Meses con arriendo en el año (0 en pre-entrega, 12 en régimen). */
  mesesOperativos?: number;
  arriendoAnual?: number;
  /** Gastos comunes en vacancia + contribuciones + mantención — lo que el motor resta para el NOI. */
  gastosOperativosAnual?: number;
  noiAnual?: number;
  /** Vacancia del arriendo + corretaje + recambio + administración — entran al flujo, no al NOI. */
  vacanciaRotacionAnual?: number;
  dividendoAnual?: number;
}

export interface ExitScenario {
  anios: number;
  valorVenta: number;
  saldoCredito: number;
  comisionVenta: number;
  // Rename honesto (paridad STR · b931831): EQUITY = lo que te queda al vender
  // (valorVenta − saldoCrédito − comisión), NO "ganancia neta". Lectores de filas
  // persistidas pre-rename usan fallback `equityCLP ?? gananciaNeta`.
  equityCLP: number;
  flujoAcumulado: number;
  retornoTotal: number;
  // Sobre capital propio: 'no_aplica' cuando pieCLP === 0 (pie cero · fase 1-2).
  // Filas persistidas pre-migración traen number crudo → leer con metricaValorONull.
  multiplicadorCapital: MetricaSobreCapital;
  // MetricaTIR (no MetricaSobreCapital): suma el estado 'no_calculable' para el
  // flujo cuyo VPN no cruza cero. Filas persistidas traen number crudo o la unión
  // vieja — ambas siguen siendo legibles con metricaValorONull.
  tir: MetricaTIR;
  // Concepto "plata que realmente pusiste" a lo largo del plazo
  inversionInicial: number;              // pie + gastos cierre + CapEx puesta a punto + corretaje (usados, día 1)
  flujoMensualAcumuladoNegativo: number; // suma absoluta de años con flujo neto negativo
  totalAportado: number;                 // inversionInicial + flujoMensualAcumuladoNegativo
  gananciaSobreTotal: number;            // equityCLP - totalAportado
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

/**
 * Ganancia de plusvalía acumulada durante la espera de una entrega futura.
 *
 * Doctrina (supersede el "Modelo B3 liquidable" en lo que toca al VALOR):
 * el comprador fija el precio hoy y recibe el activo en `fechaEntrega`. El precio
 * pactado no se mueve — esa es su ventaja. El mercado sí se mueve: al escriturar
 * recibe un activo que vale `valorEntregaCLP`, no `precioCompraCLP`. La diferencia
 * es ganancia real, aunque no liquidable hasta la escritura.
 *
 * Todos los montos en CLP a la UF congelada del análisis.
 */
export interface PreEntregaGanancia {
  /** Meses entre la fecha de análisis (asOf) y la entrega. Siempre > 0. */
  mesesEspera: number;
  /** Años enteros que usa la proyección como reloj de plusvalía (ceil de meses/12). */
  aniosEspera: number;
  /** Precio pactado en la promesa — no se mueve durante la espera. */
  precioCompraCLP: number;
  /** Valor de mercado estimado al momento de escriturar. */
  valorEntregaCLP: number;
  /** valorEntregaCLP − precioCompraCLP. Positivo con plusvalía proyectada > 0. */
  gananciaCLP: number;
  /** Ganancia como % sobre el precio pactado. */
  gananciaPct: number;
  /** Tasa anual de plusvalía usada (decimal, ej. 0.03). */
  tasaAnual: number;
}

export interface AnalysisMetrics {
  rentabilidadBruta: number;
  rentabilidadNeta: number;
  capRate: number;
  // Sobre capital propio: 'no_aplica' cuando pieCLP === 0 (pie cero · fase 1-2).
  // Filas persistidas pre-migración traen number crudo → leer con metricaValorONull.
  cashOnCash: MetricaSobreCapital;
  precioM2: number;
  mesesPaybackPie: MetricaSobreCapital;
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
  valorMercadoFrancoUF?: number;       // vm resuelto (= precio cuando no hay valor de mercado con procedencia)
  /** Procedencia del valor de mercado que el motor aceptó; null = trabajó sin valor de mercado. */
  valorMercadoRef?: ValorMercadoRef | null;
  /** Universo de mercado del depto CON procedencia: `declarado` (esNuevo del wizard),
   *  `inferidoDeSnapshot` (filas sin esNuevo: el universo de la mediana que se consultó al
   *  crear) o `default` (sin esNuevo y sin snapshot ⇒ usado). El gate de sobreprecio
   *  comunal y el valor de mercado exigen su mismo universo. */
  universoDepto?: UniversoDepto;
  valorMercadoUsuarioUF?: number;      // referencial (estimación usuario)
  plusvaliaInmediataFranco?: number;    // CLP vs datos reales
  plusvaliaInmediataFrancoPct?: number;
  plusvaliaInmediataUsuario?: number;   // CLP vs estimación usuario
  plusvaliaInmediataUsuarioPct?: number;
  // Plusvalía ganada ANTES de escriturar (solo entrega futura / venta en blanco).
  // El precio de compra queda FIJO en lo pactado; el valor de mercado se aprecia
  // durante la espera a la tasa de plusvalía del análisis. La diferencia es
  // ganancia del comprador por haber comprado anticipado, y se realiza recién al
  // escriturar. Ausente (undefined) cuando no hay pre-entrega — NO cero, para que
  // el consumidor distinga "no aplica" de "aplica y da 0".
  // NO alimenta score ni gates: es un valor citable para la narrativa.
  preEntrega?: PreEntregaGanancia;
  // Precios de equilibrio
  precioFlujoNeutroCLP?: number;
  precioFlujoNeutroUF?: number;
  descuentoParaNeutro?: number;     // %
  // Subsidio a la tasa (Ley 21.748)
  subsidioTasa?: {
    califica: boolean;        // nuevo en primera venta && precio <= TECHO_UF_SUBSIDIO
    tasaConSubsidio: number;  // tasa mercado − REBAJA_SUBSIDIO (piso: el banco puede dar más)
    aplicado: boolean;        // si la tasa ingresada <= tasaConSubsidio + 0.2
  };
  // CapEx de puesta a punto (usados) — ya incorporado a capitalInvertido.
  // Opcional para back-compat con metrics construidos fuera de calcMetrics
  // (enrich-legacy, mocks). Consumidores leen con `?? 0`.
  capexPuestaAPuntoCLP?: number;
  // Corretaje inicial del comprador (2% del precio) — SOLO usados y SOLO
  // análisis creados con el flag input.incluyeCorretajeInicial (gate anti-drift).
  // Arch A: entra a inversionInicial del exit (TIR/retorno/día-1/patrimonio),
  // NO a capitalInvertido (cashOnCash/gates/veredicto/score quedan intactos).
  // Ausente/0 en análisis viejos → recomputan byte-idéntico. Consumidores `?? 0`.
  corretajeInicialCLP?: number;
  // Gastos de compra del día 1 = gastos de cierre (notaría, CBR, timbres,
  // tasación) + corretaje inicial del comprador. Campo ADITIVO de display: el
  // render descompone la plata del día 1 (pie + gastos de compra + puesta a
  // punto === exit.inversionInicial) sin recomputar el 2% por su cuenta. Se
  // calcula en calcMetrics con los mismos sumandos que calcInversionInicialCLP.
  // Ausente en filas previas → el render cae a inversionInicial − pie − capex.
  gastosCompraCLP?: number;
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
/** Universo de una muestra de venta: "mixto" = radio consultado sin condición. */
export type UniversoVenta = "nuevo" | "usado" | "mixto";
/** Universo del depto con procedencia (ver valor-mercado.ts · resolverUniversoDepto). */
export interface UniversoDepto {
  valor: "nuevo" | "usado";
  origen: "declarado" | "inferidoDeSnapshot" | "default";
}
/** Procedencia del valor estimado de mercado del wizard. */
export interface ValorMercadoRef {
  valorUF: number;
  /** "radio" = comparables publicados dentro de radioMetros · "comuna" = mediana comunal. */
  nivel: "radio" | "comuna";
  universo: UniversoVenta;
  n: number;
  radioMetros?: number | null;
}

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
  /** Universo de la muestra: la mediana sale SOLO de publicaciones de ese tipo.
   *  OPCIONAL — ausente en análisis con snapshot anterior al fix de segmentación,
   *  cuya mediana es de universo mixto y por eso no se rotula. */
  universo?: CondicionMercado;
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
    /** Fase 5b · D4: pie 0 ⇒ la fracción no se muestra (base desplomada). */
    sinCapitalPropio?: boolean;
    // Rango de la puesta a punto (modelo de costos v3). DISPLAY: los extremos no
    // entran a ninguna suma; `montoUF`/`montoCLP` (el punto) siguen siendo lo que
    // corre el caso. En UF van redondeados a múltiplos de 5 (también el punto).
    // Con override del usuario o curva legacy colapsan al punto (min = max).
    // OPCIONALES: filas persistidas antes de este cambio no los traen.
    montoMinUF?: number;
    montoMaxUF?: number;
    montoMinCLP?: number;
    montoMaxCLP?: number;
    ufM2Min?: number;
    ufM2Max?: number;
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
  // favorable si capRate ≥ referencia; adverso si <. "neutral" cuando |gap| < 0,2
  // (paquete A, familia 6 del censo): "rinde en línea con el mercado" no es ni
  // ventaja ni advertencia — la etiqueta ya no desdice a la frase.
  direccion: "favorable" | "adverso" | "neutral";
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
    // Rama del cierre de la frase "acotada" (paquete A, familia 1 del censo): el consuelo
    // ("la plusvalía puede compensarlo") solo se emite cuando es verdad. "plusvalia" =
    // veredicto no-BUSCAR y plusvalía histórica ≥ umbral real; "estable" = plusvalía débil o
    // negativa (el cierre no la invoca); "ninguno" = veredicto BUSCAR OTRA (sin consuelo).
    // Persistido para que el render de la card reproduzca la MISMA rama (bit-consistencia).
    // Ausente (filas legacy) ⇒ el render cae a "plusvalia" (texto pre-fix, byte-idéntico).
    consuelo?: "plusvalia" | "estable" | "ninguno";
    // Horizonte de la rama FAVORABLE (rama flujo-copy-preentrega): pre-entrega + primer
    // tramo de años operativos con flujo anual negativo. Se persiste para que la card
    // reproduzca la MISMA variante de frase. Ausente (legacy / caso base) ⇒ frase fuerte.
    horizonte?: { aniosPre: number; negDesde: number | null; negHasta: number | null };
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
    comuna: string;              // nombre de la comuna de la mediana — nombra el nivel en el ksub (R2). "" si no disponible
    // Universo de la muestra. Ausente ⇒ mediana de universo mixto (snapshot
    // pre-segmentación): la frase NO declara universo. Ver sobreprecio-hallazgo.ts.
    universo?: CondicionMercado;
  };
  // DIRECCIÓN INVERTIDA respecto a cap_rate/flujo: BAJO la mediana = favorable
  // (entras barato); SOBRE la mediana = adverso (pagas caro). Más caro = peor.
  // "neutral" cuando |desv| ≤ 2 (paquete A, familia 6 del censo): "pagas lo justo"
  // no es ni ventaja ni advertencia — la etiqueta ya no desdice a la frase.
  direccion: "favorable" | "adverso" | "neutral";
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
/**
 * Cobertura de plusvalía de la comuna (F2). Tres estados, deliberadamente
 * distintos de `tieneData` (bool) al que acompañan sin reemplazar:
 *  · trayectoria_propia — la comuna tiene su propia historia de precios.
 *  · solo_nivel — hay precio actual pero NINGUNA trayectoria propia; el % que
 *    se muestra es referencia regional y NO se le puede atribuir a la comuna.
 *  · fallback_gs — ni trayectoria ni nivel propios: promedio Gran Santiago.
 */
export type CoberturaHallazgo = "trayectoria_propia" | "solo_nivel" | "fallback_gs";

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
    // ── F2: cobertura y nivel ───────────────────────────────────────────────
    // Campos NUEVOS junto a `tieneData`, que se mantiene y sigue siendo la
    // señal derivable de siempre: hay filas jsonb persistidas que solo traen el
    // bool, así que todo consumidor tolera `undefined` acá.
    // La cobertura distingue lo que el bool no podía: tener NIVEL fresco no es
    // tener TRAYECTORIA. Son dos mediciones distintas y la prosa no las mezcla.
    cobertura?: CoberturaHallazgo;
    // Nivel de precio actual de la comuna (UF/m² de deptos nuevos) y su período,
    // SEPARADOS de la trayectoria a propósito (guarda anti-mezcla del audit).
    nivelUfM2?: number;
    nivelPeriodo?: string;
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

// Proto-hallazgo tipado — SENSIBILIDAD (robustez del veredicto) para LTR. 8º hallazgo y
// el segundo SOLO-LECTURA (tras TIR): NO compite en el ranking de decisividad (decisividad
// 0 fija) porque la robustez es un meta-dato del conjunto (integra precio+arriendo+tasa+
// pie+venta vía el veredicto mismo) sin un driver único que calcDecisividades pueda
// neutralizar. El motor estresa el arriendo declarado hacia abajo por bisección [−50%,0] a
// 0,5 punto y reporta `marginPct` = la caída máxima que el veredicto aguanta antes de
// cambiar. Cortes 7/15: < 7% frágil (adverso) · [7,15) borde · ≥ 15% firme (ambos
// favorables). Tres casos especiales: BUSCAR OTRA base y arriendo no computable ⇒ hallazgo
// ausente (null); "firme" (no cambia ni a −50%) ⇒ marginPct 50, dirección favorable.
// magnitudContinua = |margin−corteAdverso|/banda ordena entre pares de igual decisividad
// (E4). Motor-seeded en runAnalysis (necesita el veredicto base + closure veredicto-only,
// post-deriveVeredicto) → va en results.hallazgos como estructura. La IA lo narra aguas
// abajo. Ver sensibilidad-hallazgo.ts.
export interface HallazgoSensibilidad {
  id: "sensibilidad";
  tipo: "robustez_veredicto";
  valor: {
    marginPct: number;                // caída de arriendo (%) que el veredicto aguanta antes de cambiar
    firme: boolean;                   // true si no cambia ni a −50% (aguanta ≥50%)
    veredictoBase: Veredicto;         // veredicto al arriendo declarado
    veredictoNuevo: Veredicto | null; // veredicto al cruzar el margen; null si firme
    corteAdverso: number;             // 7 — bajo este margen la dirección es adversa
    corteFavorable: number;           // 15 — sobre este margen el veredicto es firme
    banda: number;                    // 25 — normalización de magnitudContinua
    modalidad: "ltr" | "str" | "ambas";
  };
  // favorable salvo la banda frágil (margin < corteAdverso), que es adversa. La señal-
  // máquina es binaria; la frase distingue frágil / borde / firme.
  direccion: "favorable" | "adverso";
  // SOLO-LECTURA: 0 fija — la robustez NO pasa por calcDecisividades (meta-dato sin driver
  // único). El kicker honesto de la corona garantiza que si el orden Filosofía 1 la corona,
  // lleva "OJO ANTES DE FIRMAR", nunca "LO MÁS DECISIVO".
  decisividad: number;
  // |margin−corteAdverso|/banda saturado a 1 — desempate secundario del sort entre pares de
  // igual decisividad (E4). Único orden que la sensibilidad aporta al ranking.
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN número.
  // fraseCanonica es la línea larga (2 oraciones) que narra la pirámide.
  titular: string;
  fraseCanonica: string;
}

// Proto-hallazgo tipado — PATRIMONIO (a 10 años) para LTR. 9º hallazgo y el tercero
// SOLO-LECTURA (tras TIR y sensibilidad): NO compite en el ranking de decisividad
// (decisividad 0 fija) porque el patrimonio es el resultado-stock integrador (plusvalía +
// amortización + flujo aportado + venta) sin un driver único que calcDecisividades pueda
// neutralizar. Envuelve exitScenario.equityCLP (= valorVenta − saldoCrédito − comisión,
// lo que el drawer largoPlazo narra como "recibes al vender" y el waterfall totaliza) y
// exitScenario.totalAportado (lo que pusiste: pie + cierre + corretaje + aportes mensuales
// negativos), SIN recomputar — misma fuente que el drawer (D1). El multiplicador
// (equityCLP/totalAportado = 1 + porcentajeGananciaSobreTotal/100) da la dirección:
// < 1 adverso inapelable (terminas con menos de lo que pusiste), [1,2) borde, ≥ 2 favorable.
// Anti-colisión (D5): NO ancla a instrumentos (esa comparación es del drawer y la dirección
// del TIR) ni recita la ganancia-neta verbatim del veredicto del drawer — dice magnitud +
// multiplicador, el drawer explica de dónde sale. Guard null si totalAportado ≤ 0 o
// equityCLP no finita (pirámide N−1 — típico de filas legacy sin el campo). Motor-seeded
// en runAnalysis (post-exitScenario). Ver patrimonio-hallazgo.ts.
export interface HallazgoPatrimonio {
  id: "patrimonio";
  tipo: "patrimonio_neto";
  valor: {
    patrimonioCLP: number;    // exitScenario.equityCLP — lo que te queda al vender a 10 años
    aportadoCLP: number;      // exitScenario.totalAportado — todo lo que pusiste (día 1 + aportes)
    multiplicador: number;    // patrimonioCLP / aportadoCLP (= 1 + pctSobreTotal/100)
    corteAdverso: number;     // 1 — bajo este multiplicador terminas con menos de lo aportado
    corteFavorable: number;   // 2 — sobre este el patrimonio supera con holgura lo aportado
    banda: number;            // 2 — normalización de magnitudContinua
    incluyeCorretaje: boolean;// el aportado incluye corretaje de compra (usado, análisis nuevo)
    modalidad: "ltr" | "str" | "ambas";
    // Pie cero (fase 3b · D3): true ⇔ el análisis se hizo sin pie — el card y
    // la narración muestran el equity ABSOLUTO y suprimen el multiplicador
    // (que sigue calculado adentro para dirección/banda, no para display).
    // Ausente en filas persistidas pre-fase-3 ⇒ comportamiento actual.
    sinCapitalPropio?: boolean;
  };
  // favorable salvo la banda adversa (multiplicador < corteAdverso). La señal-máquina es
  // binaria; la frase distingue adverso / borde / favorable.
  direccion: "favorable" | "adverso";
  // SOLO-LECTURA: 0 fija — el patrimonio NO pasa por calcDecisividades (resultado-stock sin
  // driver único). El kicker honesto de la corona garantiza "OJO ANTES DE FIRMAR" si el orden
  // Filosofía 1 lo coronara, nunca "LO MÁS DECISIVO".
  decisividad: number;
  // |multiplicador−corteAdverso|/banda saturado a 1 — desempate secundario del sort entre
  // pares de igual decisividad (E4). Único orden que el patrimonio aporta al ranking.
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  // Titular corto para el hero TOP-3: 6-12 palabras, diagnóstico + dirección, SIN número.
  // fraseCanonica es la línea larga (2 oraciones) que narra la pirámide.
  titular: string;
  fraseCanonica: string;
}

/** Una palanca del hallazgo de distancia: el valor que llevaría al veredicto objetivo. */
export interface PalancaDistancia {
  /**
   * arriendo (CLP/mes, LTR) · precio (UF) · plazo (años del crédito) · pie (% del precio)
   * · adr (tarifa por noche CLP, STR) · gestion (modo de gestión STR, discreta).
   *
   * `arriendo` y `adr` son las dos caras de la misma pregunta —"¿y si el ingreso fuera
   * mayor?"— pero no son intercambiables: el arriendo lo fija un contrato y el ADR lo fija
   * el mercado noche a noche, por eso el ADR lleva su propio tope, más estricto.
   */
  palanca: "arriendo" | "precio" | "plazo" | "pie" | "adr" | "gestion";
  /**
   * Solo `palanca: "gestion"`: a qué modo hay que moverse. Los campos numéricos de esta
   * palanca expresan la COMISIÓN (puntos porcentuales del ingreso), que es lo que
   * efectivamente cambia; el modo es lo que el usuario decide.
   */
  modoGestionObjetivo?: "auto" | "administrador";
  /** Valor que hay que alcanzar para cruzar al veredicto objetivo. */
  objetivo: number;
  /** Valor declarado hoy (misma unidad que `objetivo`). */
  actual: number;
  /**
   * Cambio con signo: +4,2 = subir 4,2% (arriendo/plazo) · −4,7 = bajar 4,7% (precio).
   *
   * EXCEPCIÓN `pie`: acá el número está en PUNTOS PORCENTUALES, no en cambio relativo
   * (0% → 26% de pie no tiene cambio relativo: sería división por cero). Es seguro
   * porque la palanca `pie`, cuando se emite, va SIEMPRE primera por prioridad y nunca
   * entra al sort por |deltaPct| que ordena a las otras tres. Los consumidores que
   * comparan magnitudes entre palancas deben excluirla o tratarla aparte.
   */
  deltaPct: number;
  /** Cambio absoluto con signo, en la unidad de la palanca (CLP · UF · años · puntos de pie). */
  deltaAbs: number;
}

/**
 * VÍA al veredicto superior con su ESTADO (goal "cuatro palancas siempre", 02-sep-2026).
 * El motor emite las cuatro palancas LTR (precio · arriendo · plazo · pie) SIEMPRE, y
 * cada una dice por construcción qué pasó con ella:
 *   · `cruza`    — alcanza el veredicto objetivo dentro del tope; trae el objetivo.
 *   · `noCruza`  — se exploró hasta `topeExplorado` (en la unidad de la palanca: % de
 *                  cambio para arriendo/precio, años para plazo, nivel % para pie) y no
 *                  cambia el veredicto. `razon` es de catálogo, determinista. En el caso
 *                  estructural, la palanca del delta mínimo lleva además `deltaMinimoPct`
 *                  (bisección en rango extendido: dato del motor, no invento).
 *   · `noAplica` — no hay nada que mover: plazo ya en 30 años o sin crédito, pie con
 *                  bono o ya en 30% o más.
 * `palancas` es DERIVADO: `vias.filter(cruza)`. Ausente en filas persistidas anteriores.
 */
export type ViaDistancia =
  | ({ estado: "cruza" } & PalancaDistancia)
  | {
      estado: "noCruza";
      palanca: PalancaDistancia["palanca"];
      actual: number;
      topeExplorado: number;
      razon: string;
      deltaMinimoPct?: number;
    }
  | { estado: "noAplica"; palanca: PalancaDistancia["palanca"]; actual: number; razon: string };

// Proto-hallazgo tipado — DISTANCIA AL VEREDICTO SUPERIOR para LTR. 10º hallazgo y el
// cuarto SOLO-LECTURA (tras TIR, sensibilidad y patrimonio): decisividad 0 fija, NO
// compite en el ranking ni pasa por calcDecisividades — es una propiedad de la distancia
// al UMBRAL de decisión, no del deal, y no tiene driver único que neutralizar.
//
// Espejo exacto de `sensibilidad`, con el signo invertido: mientras aquella mide cuánto
// puede EMPEORAR el arriendo antes de que el veredicto baje, esta mide cuánto tiene que
// MEJORAR alguna palanca para que el veredicto suba. Se emite solo cuando hay un veredicto
// superior al que llegar: AJUSTA SUPUESTOS → COMPRAR y BUSCAR OTRA → AJUSTA SUPUESTOS
// (reportando además la distancia a COMPRAR cuando cae en rango). En COMPRAR ⇒ ausente
// (null): no hay veredicto superior.
//
// TRES PALANCAS, bisección independiente por cada una vía veredictoConPatch (la MISMA
// ruta score → breakEven → gates del veredicto canónico, sin duplicar la lógica): arriendo
// hacia arriba, precio hacia abajo, plazo del crédito hacia arriba con tope duro de 30
// años. Pie y tasa NO se emiten aunque el patch los soporte (decisión de producto: son
// condiciones del banco y del bolsillo, no del deal).
//
// esEstructural: true cuando NINGUNA palanca cruza dentro del tope de honestidad
// calibrado — ahí la frase deja de prometer un ajuste y dice que no lo hay. Ver
// distancia-veredicto-hallazgo.ts.
export interface HallazgoDistanciaVeredicto {
  id: "distancia_veredicto";
  tipo: "distancia_umbral";
  valor: {
    veredictoBase: Veredicto;                 // veredicto al input declarado
    veredictoObjetivo: Veredicto;             // el inmediatamente superior
    /** Palancas que cruzan dentro de rango, de la más barata a la más cara. Vacío ⇒ estructural.
     *  DERIVADO de `vias` desde el goal "cuatro palancas siempre" (02-sep-2026). */
    palancas: PalancaDistancia[];
    /** Las cuatro palancas con su estado, en orden canónico precio · arriendo · plazo · pie
     *  (LTR). Ausente en filas persistidas anteriores al goal y en STR. */
    vias?: ViaDistancia[];
    /** La más barata de `palancas` (índice 0), o null si ninguna cruza. */
    palancaMasBarata: PalancaDistancia | null;
    /** Solo para BUSCAR OTRA: distancia a COMPRAR si cae en rango (salto de dos bandas). */
    palancaHastaComprar: PalancaDistancia | null;
    /** Ninguna palanca cruza dentro del tope ⇒ no hay ajuste realista que lo salve. */
    esEstructural: boolean;
    /** Solo cuando `esEstructural`: el delta mínimo REAL buscado en rango extendido
     *  (arriendo +150% · precio −70%), para que la frase dura cite el hecho y no el umbral
     *  ("ni bajando el precio un 34%…" en vez de "más de un 15%"). NO es accionable — por eso
     *  no entra a `palancas`. null si ni el rango extendido cruza, o si no es estructural. */
    deltaMinimoFueraDeTope: { palanca: "arriendo" | "precio" | "adr"; deltaPct: number } | null;
    /** Tope de honestidad aplicado a arriendo y precio (%), calibrado sobre el corpus.
     *  30 para AJUSTA SUPUESTOS · 15 para BUSCAR OTRA (el plazo tiene su propio tope: 30 años). */
    topePct: number;
    /** Cercanía normalizada al umbral: 1 − |deltaPct de la palanca más barata| / tope,
     *  saturado a [0,1]. 1 = pegado al veredicto de arriba · 0 = en el tope o estructural.
     *  Vive DENTRO de `valor` a propósito: es un dato de lectura, no un peso de ranking.
     *  Nunca debe alimentar un sort junto a magnitudContinua (miden cosas distintas). */
    cercaniaUmbral: number;
    /** Cuáles brazos del GATE 1 están activos (solo informativo; vacío si no dispara). */
    brazosGate1Activos: string[];
    /**
     * ¿El pie SE EXPLORÓ como palanca? Desde el goal "cuatro palancas siempre"
     * (02-sep-2026) el pie se prueba hasta 30% siempre que no sea bono pie ni esté ya en
     * 30% o más: la banda de `classifyPieLevel` dejó de decidir la exploración. Antes
     * (filas persistidas previas) era true solo con pie < 20%. Independiente de que haya
     * cruzado: sirve para que el render y la prosa sepan si el pie se probó.
     *
     * Ausente ⇒ false (filas persistidas antes de la 4ª palanca).
     */
    pieEsPalanca?: boolean;
    /**
     * El pie está en 0 PORQUE lo cubre un bono de la inmobiliaria, así que la palanca se
     * suprimió a propósito. Habilita el copy que nombra por qué la vía es otra, en vez de
     * dejar un silencio que se lee como olvido.
     */
    pieExcluidoPorBono?: boolean;
    /** Pie declarado (%). Contexto para el copy del drawer; ausente en filas previas. */
    piePctActual?: number;
    /**
     * LTR/STR — caso precio-justo (§1.12.4): precio e ingresos a mercado con
     * veredicto degradado. Detección dura Y-ada de fuente única (LTR:
     * esCasoPrecioJusto — mediana confiable + vm alineado + arriendo en banda;
     * STR: esCasoPrecioJustoStr — mediana confiable + cero overrides). Cambia
     * el cierre del caso estructural y activa el reencuadre canónico en el prompt.
     */
    casoPrecioJusto?: boolean;
    /**
     * STR — tope propio de la palanca ADR (%), más estricto que `topePct`. Superar la
     * mediana de tarifa de la zona es una apuesta sobre el mercado, no un ajuste de
     * supuestos, así que se ofrece solo cuando el salto es chico. Ausente en LTR.
     */
    topeAdrPct?: number;
    /**
     * STR — todos los motivos de gate que sostienen el veredicto (`gates.motivos`),
     * incluidos los del GATE 2. `brazosGate1Activos` solo cubre los severos; en STR el
     * copy necesita también los que degradan un COMPRAR. Ausente en LTR.
     */
    motivosGate?: string[];
    /**
     * PURO-GATE: la banda del score, por sí sola, YA alcanza el veredicto objetivo — lo que
     * lo retiene es un gate, no el puntaje. Cambia el copy de raíz: decir "estás cerca por
     * el lado del precio" sería falso sobre el diagnóstico (no falta puntaje), y decir "no
     * hay nada que hacer" sería falso sobre el remedio (11 de 14 del parque cruzan con menos
     * de 15% de ajuste). Se nombra el gate que hay que apagar, no la distancia al umbral.
     */
    esPuroGate?: boolean;
    modalidad: "ltr" | "str" | "ambas";
  };
  // SIEMPRE "neutral". Este hallazgo NO es una señal sobre el deal — es un mapa de la
  // distancia al umbral. Marcarlo "adverso" lo metía al bloque de adversos del orden
  // Filosofía 1 y, con su magnitud alta, empujaba hallazgos genuinamente decisivos fuera
  // del top-3 (medido: 3 filas con un dec≥0,85 degradado a chip). Su posición en la
  // pirámide es FIJA, no competida — ver ordenarHallazgosPiramide.
  direccion: "neutral";
  // SOLO-LECTURA: 0 fija. No entra a calcDecisividades ni compite en ningún ranking.
  decisividad: number;
  // `?: undefined` a propósito, no ausente: el campo sigue siendo LEGIBLE en la unión
  // (los comparadores hacen `h.magnitudContinua ?? 0` y compilan), pero es IMPOSIBLE
  // asignarle un valor. El número de cercanía al umbral vive en `valor.cercaniaUmbral`.
  // Tenerlo acá lo hacía competir contra magnitudes que miden otra cosa (|Δscore|/25):
  // dos escalas distintas desempatando en el mismo comparador. El tipo ahora impide
  // reintroducir esa mezcla por olvido.
  magnitudContinua?: undefined;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// ============================================================================
// PIRÁMIDE STR (E.1b) — 6 proto-hallazgos PROPIOS del corto. Diseño congelado en
// of-e1a-piramide-str.md. Los 6 heredados (capex/sobreprecio/financiamiento/
// plusvalia/tir/patrimonio) REUSAN los tipos LTR de arriba con modalidad:"str".
// DECISIVIDAD STR: decisividad>0 solo en los 4 que son 1:1 con una dim del score
// de 4 dimensiones (decisividad_dim = |dimScore−50|/50). Los demás = 0 (solo-lectura).
// ============================================================================

// 1 · RENTABILIDAD_STR (DECISIVO — dim rentabilidad). Envuelve escenarios.base.capRate
// contra el umbral STR nacional (5%). Ancla al umbral (regla A4/D4): la frase NUNCA
// compara el CAP con un instrumento. Ver rentabilidad-str-hallazgo.ts.
export interface HallazgoRentabilidadStr {
  id: "rentabilidad_str";
  tipo: "rentabilidad_operativa_str";
  valor: {
    capRatePct: number;   // CAP rate STR del sujeto, % NETO (NOI) — reusado de base.capRate
    umbralPct: number;    // umbral STR nacional (5,0%)
    gapPts: number;       // capRatePct − umbralPct, en puntos (signed)
    banda: number;        // banda de saturación de magnitudContinua, en puntos
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // favorable si capRate ≥ umbral
  decisividad: number;                // dim rentabilidad: |dimScore−50|/50
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// 2 · FLUJO_STR (DECISIVO — dim sostenibilidad). Envuelve escenarios.base.flujoCajaMensual
// (estabilizado, ocupación observada). Corte 0. Molde de flujo_mensual LTR con texto STR.
// Ver flujo-str-hallazgo.ts.
export interface HallazgoFlujoStr {
  id: "flujo_str";
  tipo: "flujo_estabilizado";
  valor: {
    flujoMensualCLP: number;  // flujo de caja mensual estabilizado, CLP signed — base.flujoCajaMensual
    banda: number;            // banda de magnitud, CLP (250k = umbral Gate-1 STR)
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // favorable si flujo ≥ 0
  decisividad: number;                // dim sostenibilidad: |dimScore−50|/50
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// 3 · OCUPACION_VS_BANDA (DECISIVO — dim factibilidad). Compara base.ocupacionReferencia
// contra la banda comunal (STR_UNIVERSO_OCC). Rama fallback (occ no observada, dominante)
// declara SIN eufemismo el supuesto conservador 45%. Ver ocupacion-vs-banda-hallazgo.ts.
export interface HallazgoOcupacionVsBanda {
  id: "ocupacion_vs_banda";
  tipo: "ocupacion_vs_banda";
  valor: {
    ocupacionPct: number;      // ocupación del escenario base, % (base.ocupacionReferencia×100)
    bandaComunalPct: number;   // ocupación estabilizada de la comuna, % (STR_UNIVERSO_OCC)
    gapPts: number;            // ocupacionPct − bandaComunalPct, en puntos (signed)
    esFallback: boolean;       // true si occ no observada (fallback 0,45) → confianza baja
    // fix-occfuente-override 2026-07 — el usuario definió la ocupación a mano.
    // `ocupacionPct` es entonces su supuesto; `occObservadaPct` es el dato de mercado real.
    esOverride?: boolean;
    occObservadaPct?: number;  // ocupación observada real de la zona, % (para mostrar ambos)
    comuna: string;            // nombra el nivel en el ksub; "" si no disponible
    banda: number;             // banda de saturación de magnitudContinua, en puntos
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // favorable si occ ≥ banda comunal
  decisividad: number;                // dim factibilidad: |dimScore−50|/50
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// 4 · VENTAJA_VS_LTR (DECISIVO — dim ventaja) · el hallazgo estrella. Envuelve
// comparativa.sobreRentaPct/sobreRenta (sobre NOI). Corte 0, borde [0,+15%). Rama
// LTR-negativo (ltr_noiMensual ≤ 0): KPI en CLP, cero %. La favorable lleva la cláusula
// estabilizado-vs-contractual. Ver ventaja-vs-ltr-hallazgo.ts.
export interface HallazgoVentajaVsLtr {
  id: "ventaja_vs_ltr";
  tipo: "ventaja_vs_ltr";
  valor: {
    sobreRentaPct: number;    // (NOI_str − NOI_ltr)/NOI_ltr — reusado de comparativa.sobreRentaPct
    sobreRentaCLP: number;    // NOI_str − NOI_ltr, CLP/mes — comparativa.sobreRenta
    ltrNoiMensual: number;    // NOI LTR mensual (para detectar el denominador ≤ 0)
    ltrNegativo: boolean;     // true si ltr_noiMensual ≤ 0 → % ilegible, usar CLP
    pctConfiable: boolean;    // P3 (Rama 0b): false si NOI-LTR ≤0 o ratio explotado → KPI en CLP, no %
    bordePct: number;         // umbral de borde (+15%): bajo esto la ventaja no paga el esfuerzo
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // favorable si sobreRenta ≥ 0
  decisividad: number;                // dim ventaja: |dimScore−50|/50
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// 5 · SENSIBILIDAD_STR (SOLO-LECTURA, decisividad 0). Robustez del veredicto vía
// breakEvenPctDelMercado (atajo determinístico). Cortes 1,00/1,10 (alineados a Gate-2 STR).
// Ver sensibilidad-str-hallazgo.ts.
export interface HallazgoSensibilidadStr {
  id: "sensibilidad_str";
  tipo: "robustez_veredicto_str";
  valor: {
    beRatioPct: number;      // break-even como % del revenue de mercado (breakEvenPctDelMercado×100)
    corteFavorable: number;  // 100 — al o bajo el mercado (holgado)
    corteFragil: number;     // 110 — sobre esto el margen operativo es frágil (Gate-2)
    /** 130 — sobre esto NO es margen apretado: Gate-1 fuerza BUSCAR OTRA.
     *  Opcional: los hallazgos persistidos antes de la tercera banda no lo traen. */
    corteInviable?: number;
    banda: number;           // normalización de magnitudContinua, en puntos
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // adverso solo en la banda frágil (>110%)
  decisividad: number;                // 0 fija (solo-lectura)
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// 6 · ESTRUCTURA_COSTOS_STR (SOLO-LECTURA, decisividad 0). Cost-stack como % del bruto
// (costosOperativos+comisión)/ingresoBruto, contra la banda típica 30/40%. Descomposición
// de rentabilidad/sostenibilidad, no un eje propio. Ver estructura-costos-str-hallazgo.ts.
export interface HallazgoEstructuraCostosStr {
  id: "estructura_costos_str";
  tipo: "cost_stack";
  valor: {
    costStackPct: number;    // (costosOperativos+comisión)/ingresoBrutoMensual, %
    bandaFavPct: number;     // 30 — bajo esto, cost-stack sano
    bandaAdvPct: number;     // 40 — sobre esto, se come más de 4 de cada 10 pesos brutos
    banda: number;           // normalización de magnitudContinua, en puntos
    modalidad: "ltr" | "str" | "ambas";
  };
  direccion: "favorable" | "adverso"; // adverso solo sobre la banda alta (>40%)
  decisividad: number;                // 0 fija (solo-lectura)
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
  titular: string;
  fraseCanonica: string;
}

// Unión de proto-hallazgos que el motor puede sembrar en results.hallazgos.
// HallazgoSobreprecio se incorporó (sobreprecio-sync): el motor lo siembra sync
// cuando recibe la mediana comunal inyectada (prefetchMedianaComunaVenta). Sigue
// persistiéndose en ai_analysis por ahora (limpieza del viejo = paso aparte).
// Los 6 STR PROPIOS (E.1b) se suman al final; los 6 heredados reusan los tipos LTR.
/**
 * Hallazgo de la CAUSA del veredicto (gate). Se emite solo cuando un gate decide
 * y ninguna otra card es adversa — ver gate-veredicto-hallazgo.ts. Sin drawer
 * asociado a proposito: la card cuenta el hecho completa y no abre detalle.
 */
export interface HallazgoGateVeredicto {
  id: "gate_veredicto";
  tipo: "gate_veredicto";
  titular: string;
  fraseCanonica: string;
  valor: {
    motivos: string[];
    veredictoDeBanda: string;
    veredictoFinal: string;
  };
  direccion: "adverso";
  decisividad: number;
  magnitudContinua?: number;
  procedencia: { base: string; confianza: "alta" | "media" | "baja" };
}

export type Hallazgo =
  | HallazgoPuestaAPunto
  | HallazgoCapRate
  | HallazgoFlujoMensual
  | HallazgoPlusvalia
  | HallazgoSobreprecio
  | HallazgoEstructuraFinanciamiento
  | HallazgoTIR
  | HallazgoSensibilidad
  | HallazgoPatrimonio
  | HallazgoDistanciaVeredicto
  | HallazgoGateVeredicto
  | HallazgoRentabilidadStr
  | HallazgoFlujoStr
  | HallazgoOcupacionVsBanda
  | HallazgoVentajaVsLtr
  | HallazgoSensibilidadStr
  | HallazgoEstructuraCostosStr;

export interface NegociacionScenario {
  precioSugeridoUF: number;
  precioSugeridoCLP: number;
  // null ⇒ ese precio no tiene TIR reportable (pie 0, o VPN sin raíz). Filas
  // persistidas traen number; los lectores usan `?? null` y renderizan "—".
  tirAlSugerido: number | null;
  precioLimiteUF: number | null;
  precioLimiteCLP: number | null;
  tirAlLimite: number | null;
  tirAlVmFranco: number | null;
  // Fase 3.7 v10 — modo del sugerido. Define qué argumento usar en la glosa IA
  // y si la card "Sugerido" muestra un descuento o señala "cerrar al actual".
  modo?: "cerrar_actual" | "optimizar_flujo" | "alinear_mercado";
  // Razón canónica del motor (sin LLM). La IA puede glosar con este texto como
  // base — no inventa la razón.
  razon?: string;
  // ── Umbral de veredicto (jerarquía de precios) ──────────────────────────────
  // Precio al que el VEREDICTO sube de banda, tomado tal cual de la palanca precio de
  // `distancia_veredicto` (nunca recalculado acá). Es una semántica DISTINTA de
  // `precioLimiteUF`, que es el techo donde la TIR cae al 6%: uno responde "hasta dónde
  // pagar sin que el retorno deje de valer la pena", el otro "a qué precio esto cambia
  // de conclusión". Cuando existe y es más exigente que el sugerido, MANDA sobre él
  // (ver calcNegociacionScenario) — antes convivían tres números sin ninguna regla que
  // los ordenara, y el drawer podía decir "no hay caso para pedir descuento" mientras la
  // pirámide mostraba a cuánto estaba el cambio de veredicto. null si no aplica.
  precioUmbralVeredictoUF?: number | null;
  /** Veredicto al que se llega cerrando en `precioUmbralVeredictoUF`. */
  veredictoAlUmbral?: Veredicto | null;
  /** DEPRECADO (goal "un nombre por precio", 02-sep-2026): el sugerido ya NO se colapsa
   *  al umbral — son dos precios con nombre propio. Siempre false en filas nuevas; true
   *  solo en filas persistidas anteriores. */
  sugeridoMandadoPorVeredicto?: boolean;
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
  /** Goal "un nombre por precio" (02-sep-2026): el OBJETIVO del plan es el umbral de
   *  veredicto cuando existe dentro del tope ("donde cambia el veredicto"); sin umbral
   *  (base COMPRAR) es el precio sostenible. Ausente en prosas anteriores, que traen
   *  `techo_*` con el mismo rol. */
  objetivo_uf?: number;
  objetivo_clp?: number;
  /** "Donde el aporte se vuelve sostenible": el sugerido del motor por modo (flujo ≥ −20%
   *  del arriendo con tope −25%, o alinear con mercado). Dato de caja, no objetivo. */
  sostenible_uf?: number;
  sostenible_clp?: number;
  /** LEGACY (prosas anteriores al goal): el "techo" del plan, que era el sugerido colapsado
   *  al umbral. Ya no se escribe; se lee solo como fallback de `objetivo_*`. */
  techo_uf?: number;
  techo_clp?: number;
  walkAway: AINegociacionWalkAway | null;
  // Glosas IA por slot — 1-2 frases que explican POR QUÉ ese precio.
  // _clp/_uf son idénticos cuando no contienen montos.
  glosaPrimeraOferta_clp?: string;
  glosaPrimeraOferta_uf?: string;
  /** LEGACY: la glosa del "techo" murió con el goal (el objetivo lleva su sub determinista). */
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
  /** Los números DETERMINISTAS de la reestructuración. Perdió `pieSugerido_pct` e
   *  `impactoCuotaMensual_clp` (v14): el primero era una constante convencional
   *  disfrazada de óptimo y el segundo su efecto, 97% atribuible a ese pie. Las
   *  filas persistidas conservan los campos viejos y conviven — el render y la
   *  reinyección usan solo estos dos. */
  estructuraSugerida: {
    plazoSugerido_anios: number;
    tasaObjetivo_pct: number;
  };
}

export interface AIAnalysisV2 {
  // FASE 2 rediseño Dictamen (v10): titular de portada — [veredicto en palabras
  // del usuario] + [LA razón más fuerte], ≤15 palabras, exactamente un par
  // `**…**` (núcleo ≤7 palabras, el render lo pinta con plumón), SIN montos en
  // moneda (la cifra vive en cifraClave, que emite el motor — cifra-clave.ts).
  // Campo ÚNICO sin _clp/_uf por construcción. Opcional: prosa ≤v9 no lo trae
  // (el render cae a portada sin titular); null cuando la generación lo emitió
  // inválido y el guard lo descartó ([TITULAR-INVALIDO]).
  titular?: string | null;
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
  // F6 — versión del prompt con que se generó la prosa. Driver de la invalidación
  // lazy-on-open: si `promptVersion` < PROMPT_VERSION_LTR, el análisis del owner la
  // regenera al abrir. Ausente ⇒ prosa pre-F6 (siempre stale). Espejo comparativa.
  promptVersion?: number;
}

// ─── STR — IA Análisis v2/v3 ──────────────────────────────────────
// Schema canónico STR alineado con doctrina analysis-voice-franco.
// E.3 (v3): el prompt podó los campos que la página post-E.2 NO renderiza
// (`siendoFrancoHeadline_*` — nadie lo mostraba — y los `pregunta` de sección —
// títulos de drawer hardcodeados). Esos campos quedan OPCIONALES para leer prosa
// v2 persistida sin romper (back-compat de lectura); la generación v3 los omite.
// El resto son strings únicos: la IA formatea cifras inline sin toggle CLP↔UF.
export interface AISectionSTRv2 {
  pregunta?: string;        // v2 legacy · v3 no lo emite (título de drawer hardcodeado)
  contenido: string;
  cajaAccionable: string;
}

export interface AIConvieneSTRv2 {
  pregunta?: string;            // opcional · fallback del título del hero
  respuestaDirecta: string;
  // v4 (FASE 2 dictamen) la PODÓ del schema: se generaba (≤22 palabras) y no se
  // renderizaba desde E.5 — tokens pagados en vano. El `titular` top-level la
  // reemplaza. Opcional para leer prosa ≤v3 persistida sin romper.
  veredictoFrase?: string;
  reencuadre: string;
  cajaAccionable: string;
}

export interface AIVsLtrSTRv2 {
  pregunta?: string;            // v2 legacy · v3 no lo emite (título de drawer hardcodeado)
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
  // FASE 2 rediseño Dictamen (v4): titular de portada — mismo contrato que el
  // LTR (types AIAnalysisV2.titular). Regla propia STR: NUNCA lidera con la
  // comparación contra arriendo largo (§1.ter, decisión B-extendida 25-ago).
  titular?: string | null;
  // v2 legacy · v3 NO lo emite (nunca se renderizó — solo mock en /demo). Opcional
  // para leer prosa v2 persistida sin romper.
  siendoFrancoHeadline_clp?: string;
  siendoFrancoHeadline_uf?: string;
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
  // F6 — versión del prompt con que se generó la prosa. Driver de la invalidación
  // lazy-on-open: si `promptVersion` < PROMPT_VERSION_STR, el análisis del owner la
  // regenera al abrir. Ausente ⇒ prosa pre-F6 (siempre stale). Espejo comparativa.
  promptVersion?: number;
}

// ─── Comparativa Ambas — IA narrativa "Cuál te conviene" (Fase C · Plan C) ──
// Schema canónico para la prosa del landing unificado de modalidad=Ambas. Fase C
// reduce la prosa a APERTURA (motor) + 3 MOVIMIENTOS (IA): la pirámide diferencial
// (comparativa-findings.ts) ya argumenta las cifras, así que la prosa narra solo lo
// que las cards no pueden — el perfil, la migración y la condición.
//   apertura (motor)  — fraseCanonica del #1 diferencial, coherente con los 4 estados
//   1. quienDeberiasSer — para quién es cada modalidad (perfil, sin recitar cards)
//   2. switchPath        — viabilidad y costo de migrar LTR↔STR a futuro
//   3. cierre            — la CONDICIÓN ("esto se sostiene si…") + costo emocional; la
//                          POSICIÓN de Franco vive como caja en el hero, la prosa NO la duplica
// Persistencia: cacheada en `ltr.results.comparativaAI` (jsonb) con `promptVersion`;
// invalidación lazy-on-open (la página del owner regenera al abrir si quedó vieja).
export type RecomendacionModalidadAmbas =
  | "LTR_PREFERIDO"
  | "STR_VENTAJA_CLARA"
  | "INDIFERENTE";

export interface AIAnalysisComparativa {
  // Apertura DETERMINÍSTICA (motor, Plan C · Fase C): fraseCanonica del #1
  // diferencial, coherente con los 4 estados. La escribe buildAperturaComparativa,
  // no la IA. Legacy v0: `headline` (AI) — el renderer cae a `headline` cuando
  // `apertura` falta (prosa vieja sin regenerar).
  apertura?: string;
  headline?: string;                 // legacy v0 (AI) — fallback de render
  conviene: {
    quienDeberiasSer: string;
    switchPath: string;
    cierre: string;                  // condición + costo emocional (la posición vive en el hero)
    balance?: string;                // DEPRECADO (prosa v0) — ya no se genera ni renderiza
  };
  // Commit E.2 · 2026-05-13 — campo único de recomendación. Antes coexistían
  // `engineRecommendation`, `recomendacionFranco` y `recomendacionRationale`
  // con divergencia opcional. La doctrina post-E.2 colapsa a un solo valor:
  // el motor recomienda, la IA narra el matiz, no contradice.
  recomendacion: RecomendacionModalidadAmbas;
  // Fase C — versión del prompt con que se generó la prosa. Driver de la
  // invalidación lazy-on-open: si `promptVersion` < PROMPT_VERSION_AMBAS, la
  // página del owner la regenera al abrir. Ausente ⇒ prosa v0 (siempre stale).
  promptVersion?: number;
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
  // Discriminador LTR/STR (columna SQL, migración 20260510). Presente en las
  // filas reales; opcional en el tipo por back-compat con lecturas legacy.
  tipo_analisis?: "long-term" | "short-term" | null;
  // Enlace de subordinación AMBAS (migración 20260715). Ambas filas del par
  // comparten `ambas_group_id`; `ambas_role` marca el lado. NULL = suelto.
  ambas_group_id?: string | null;
  ambas_role?: "ltr" | "str" | null;
  // Fase D (migración 20260717). Desbloqueo del informe íntegro de los hijos del
  // par: NULL = hijos en resumen (owner sin unlock); timestamptz = grupo
  // desbloqueado (hijos íntegros). Flipeada por payments/confirm (product
  // 'unlock') sobre ambas filas del grupo. No aplica a análisis sueltos.
  ambas_unlocked_at?: string | null;
  // Vía de cobro del análisis (migración charge_mode, espejo de ChargeMode del
  // pipeline). Escrita al crear por /api/analisis y /api/analisis/short-term;
  // NULL = histórico pre-migración (o fila locked pre-pago). Gatea el CTA
  // post-análisis welcome ('welcome' + dueño).
  charge_mode?: "welcome" | "paid" | "subscription" | "admin" | null;
}
