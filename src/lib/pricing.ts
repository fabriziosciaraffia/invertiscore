/**
 * Fuente única de precios (F.11 Phase 2.38) · landing s09 + /pricing leen de
 * acá. Bundle pricing: el precio individual ($9.990) es la referencia; los
 * planes muestran ahorro por análisis. NOTA: estos números son solo UI — los
 * IDs/montos reales hacia Flow.cl viven aparte y NO se tocan en esta fase.
 */

export type Billing = "monthly" | "annual";

/** Precio del análisis individual (referencia base para el ahorro). */
export const SINGLE_PRICE = 9990;

export type PricingPlan = {
  id: string;
  label: string;
  title: string;
  /** Plan "1 análisis": precio fijo, no reacciona al toggle. */
  fixed?: number;
  fixedUnit?: string;
  fixedSubtext?: string;
  /** Suscripciones (planes 2-4). */
  monthly?: number;
  annualPerMonth?: number;
  annualTotal?: number;
  perAnalysisMonthly?: number;
  perAnalysisAnnual?: number;
  /** Precio individual tachado (referencia de ahorro · planes 2-3). */
  struck?: number;
  /**
   * Comparativa textual (plan ilimitado): reemplaza el bloque tachado +
   * $/análisis para alinear la altura del precio con los demás planes.
   * compareTopText va en la posición del tachado (Signal Red, sin strike);
   * compareMainText en la posición del $/análisis (bold).
   */
  compareTopText?: string;
  compareMainText?: string;
  /** Badge de descuento esquina sup. der. */
  discountBadge?: string;
  /** Subtexto de volumen (plan ilimitado). */
  volumeSubtext?: string;
  highlight?: boolean;
  popularBadge?: string;
  /** Capacidad mensual incluida para la calculadora (null = ilimitado). */
  capacity: number | null;
  /**
   * Features diferenciales de la card. El plan base lista las 6 completas;
   * las suscripciones solo lo único que las diferencia (el banner superior
   * comunica que las capacidades son iguales en todos los planes).
   */
  features: string[];
  ctaBase: string;
  ctaToggle: boolean;
  ctaHref: string;
};

export const BASE_FEATURES = [
  "Veredicto de inversión: claro y sin rodeos",
  "Arriendo largo, Airbnb o ambos en cada análisis",
  "Análisis con IA + atractores de zona",
  "Comparables reales de venta, arriendo y Airbnb por zona",
  "Comparativa entre análisis",
  "24 comunas del Gran Santiago",
];

/**
 * Mapea el id de plan UI (single|plan10|plan50|unlimited) + el toggle de
 * facturación a la product key real de FLOW_PRODUCTS / backend.
 *   single → "single" (pago único, ignora billing)
 *   resto  → `${id}_mensual` | `${id}_annual`  (mensual ES, annual EN — así está el catálogo)
 */
export function productKeyFor(planId: string, billing: Billing): string {
  if (planId === "single") return "single";
  // OJO: las keys de FLOW_PRODUCTS son mixtas — mensual en español (`_mensual`)
  // pero anual en inglés (`_annual`). Debe coincidir EXACTO con esas keys.
  return `${planId}_${billing === "annual" ? "annual" : "mensual"}`;
}

export const PRICING_PLANS: ReadonlyArray<PricingPlan> = [
  {
    id: "single",
    label: "1 análisis",
    title: "Cuando lo necesites.",
    fixed: SINGLE_PRICE,
    fixedUnit: "por análisis",
    fixedSubtext: "1 análisis gratis al empezar · análisis sin caducidad",
    capacity: 1,
    features: BASE_FEATURES,
    ctaBase: "Empezar gratis",
    ctaToggle: false,
    ctaHref: "/register",
  },
  {
    id: "plan10",
    label: "10 análisis / mes",
    title: "Para evaluar varios deptos.",
    monthly: 39990,
    annualPerMonth: 32990,
    annualTotal: 395880,
    perAnalysisMonthly: 3999,
    perAnalysisAnnual: 3299,
    struck: SINGLE_PRICE,
    discountBadge: "60% DCTO",
    highlight: true,
    popularBadge: "Más popular",
    capacity: 10,
    features: ["Análisis acumulables hasta 1 año"],
    ctaBase: "Contratar plan",
    ctaToggle: true,
    ctaHref: "/register",
  },
  {
    id: "plan50",
    label: "50 análisis / mes",
    title: "Para corredores activos.",
    monthly: 149990,
    annualPerMonth: 124990,
    annualTotal: 1499880,
    perAnalysisMonthly: 2999,
    perAnalysisAnnual: 2499,
    struck: SINGLE_PRICE,
    discountBadge: "70% DCTO",
    capacity: 50,
    features: ["Análisis acumulables hasta 1 año"],
    ctaBase: "Contratar plan",
    ctaToggle: true,
    ctaHref: "/register",
  },
  {
    id: "unlimited",
    label: "Ilimitado",
    title: "Sin límite de análisis.",
    monthly: 399990,
    annualPerMonth: 329990,
    annualTotal: 3959880,
    compareTopText: "Sin tope de uso",
    compareMainText: "Análisis ilimitados",
    volumeSubtext: "Desde $2.000/análisis si haces 200/mes",
    discountBadge: "Mejor precio por volumen",
    capacity: null,
    features: [],
    ctaBase: "Contratar plan",
    ctaToggle: true,
    ctaHref: "/register",
  },
];

/** "$1.234.567" */
export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export type CalcOption = {
  id: string;
  label: string;
  cost: number;        // costo mensual efectivo para `n` análisis
  savings: number;     // ahorro vs comprar sueltos (≥0)
  recommended: boolean;
};

/**
 * Costos mensuales por opción para un volumen `n` (análisis/mes) +
 * recomendación por rango (doctrina F.4):
 *   <10 → 1 análisis · 10-30 → plan 10 · 31-50 → plan 50 · >50 → ilimitado.
 * El costo de una suscripción incluye overage a precio individual si `n`
 * supera la capacidad incluida.
 */
export function calcOptions(n: number): CalcOption[] {
  const loose = n * SINGLE_PRICE;
  const subCost = (planMonthly: number, capacity: number | null) =>
    capacity === null
      ? planMonthly
      : planMonthly + Math.max(0, n - capacity) * SINGLE_PRICE;

  const plan10 = subCost(39990, 10);
  const plan50 = subCost(149990, 50);
  const unlimited = subCost(399990, null);

  // Recomendación = el plan MÁS BARATO real para ese volumen (breakeven real).
  // Empates: gana el de menor compromiso (orden single → plan10 → plan50 → ilimitado).
  const entries: Array<[string, number]> = [
    ["single", loose],
    ["plan10", plan10],
    ["plan50", plan50],
    ["unlimited", unlimited],
  ];
  const rec = entries.reduce((min, e) => (e[1] < min[1] ? e : min))[0];

  return [
    { id: "single", label: "Sueltos (1 análisis)", cost: loose, savings: 0, recommended: rec === "single" },
    { id: "plan10", label: "Plan 10 análisis", cost: plan10, savings: Math.max(0, loose - plan10), recommended: rec === "plan10" },
    { id: "plan50", label: "Plan 50 análisis", cost: plan50, savings: Math.max(0, loose - plan50), recommended: rec === "plan50" },
    { id: "unlimited", label: "Ilimitado", cost: unlimited, savings: Math.max(0, loose - unlimited), recommended: rec === "unlimited" },
  ];
}
