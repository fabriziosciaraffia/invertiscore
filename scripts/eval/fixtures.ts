// ============================================================================
// AUDIT FIXTURES — muestra versionada para el instrumento de auditoría semántica
// ============================================================================
// Fase 2a. Tabla REPRODUCIBLE de 55 casos que cubren la matriz factorial de
// bordes (veredicto × tipo × datos-zona × precio × tier × anomalías × trampa-
// ubicación). NO genera prosa IA ni persiste en DB — solo define inputs +
// el veredicto/condición ESPERADA. La validación contra el motor y la
// generación/juicio corren en los runners untracked (scripts/of-audit-*).
//
// Levers de veredicto:
//   LTR  → runAnalysis(input, UF, mediana). Gates en analysis.ts:1290-1317.
//   STR  → calcShortTerm(strInput) + calcFrancoScoreSTR(scoreInput).
//          Gates en short-term-score.ts:362-395. AirbnbData se SINTETIZA acá
//          (determinístico) en vez de getAirbnbEstimate (AirROI, externo) —
//          el veredicto lo decide el motor de scoring, no la fuente del dato.
//   AMBAS→ corre ambos sobre la misma propiedad.
//
// UF fija = 38800 (UF_FALLBACK de src/lib/uf.ts) para determinismo.
// ============================================================================

import type { AnalisisInput } from "../../src/lib/types";
import type { AirbnbData, ShortTermInputs } from "../../src/lib/engines/short-term-engine";
import { SEED_MARKET_DATA } from "../../src/lib/market-seed";

export const AUDIT_UF = 38800;

export type Modalidad = "LTR" | "STR" | "AMBAS";
export type Veredicto = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

// Coords de control. Las "active" alimentan el score de metro (LTR plusvalía,
// STR atractores). Las "future" (L7/L8/L9) son la TRAMPA: el motor las ignora
// (findNearestStation filtra "active"), pero la prosa IA podría alucinarlas
// (caso "Pedro de Valdivia L7 a 400m"). Acá solo posicionan el caso.
export const COORDS = {
  // Providencia, ~120m de Metro Pedro de Valdivia L1 (ACTIVA)
  pedroValdiviaL1: { lat: -33.4255, lng: -70.6138 },
  // Ñuñoa, cerca de Metro Inés de Suárez L6 (ACTIVA) y traza L7 futura
  inesDeSuarez: { lat: -33.4445, lng: -70.6005 },
  // Las Condes, cerca de traza L7 futura (Isidora Goyenechea / Vitacura L7)
  trazaL7LasCondes: { lat: -33.4150, lng: -70.6030 },
  // Providencia, sobre la traza L8 futura (Pocuro L8)
  trazaL8Providencia: { lat: -33.4340, lng: -70.6230 },
  // Quinta Normal, sobre la traza L7 futura (Matucana L7)
  matucanaL7: { lat: -33.4330, lng: -70.6670 },
  // San Miguel / Santiago sur, sobre la traza L9 futura (Bío Bío L9)
  bioBioL9: { lat: -33.4583, lng: -70.6460 },
  // Macul, sobre la traza L8 futura (Macul L8)
  maculL8: { lat: -33.4800, lng: -70.5980 },
  // Santiago Centro, lejos de metro activo cercano (zona con peor score metro)
  santiagoPeriferia: { lat: -33.4690, lng: -70.6900 },
};

export interface AuditFixture {
  id: string;
  modalidad: Modalidad;
  /** Ejes de borde que el caso pretende cubrir (para el agregado del reporte). */
  ejes: string[];
  /** Tier de usuario que activará la prosa en 2c (no afecta el veredicto del motor). */
  tier: "esencial" | "estandar" | "experto";
  /** Veredicto esperado por modalidad. AMBAS lleva ambos. */
  expected: { ltr?: Veredicto; str?: Veredicto };
  /** Input LTR completo (para LTR y AMBAS). */
  ltrInput?: AnalisisInput & { lat?: number; lng?: number };
  /** Mediana comunal de venta UF/m². null/omitido = datos-zona null. */
  ltrMediana?: { mediana: number | null; n: number } | null;
  /** Input STR completo con AirbnbData sintético (para STR y AMBAS). */
  strInput?: ShortTermInputs;
  /** Contexto extra para calcFrancoScoreSTR (regulación + coords). */
  strScore?: { regulacionEdificio: string; lat: number; lng: number };
  /** Nota libre (por qué este caso es interesante para el juez). */
  nota?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tipoFromDorm(dormitorios: number): string {
  if (dormitorios <= 1) return "1D";
  if (dormitorios === 2) return "2D";
  return "3D";
}

/** Mediana UF/m² del seed para comuna+tipo (datos-zona "con datos"). */
export function medianaSeed(comuna: string, dormitorios: number): { mediana: number | null; n: number } {
  const tipo = tipoFromDorm(dormitorios);
  const row = SEED_MARKET_DATA.find((r) => r.comuna === comuna && r.tipo === tipo);
  if (!row) return { mediana: null, n: 0 };
  return { mediana: row.precio_m2_venta_promedio, n: row.numero_publicaciones };
}

/** AnalisisInput LTR completo con defaults razonables + overrides. */
export function ltr(
  over: Partial<AnalisisInput & { lat?: number; lng?: number }>,
): AnalisisInput & { lat?: number; lng?: number } {
  const dormitorios = over.dormitorios ?? 2;
  const superficie = over.superficie ?? 50;
  return {
    nombre: over.nombre ?? "Fixture LTR",
    comuna: over.comuna ?? "Providencia",
    ciudad: over.ciudad ?? "Santiago",
    direccion: over.direccion,
    tipo: over.tipo ?? "Departamento",
    dormitorios,
    banos: over.banos ?? 1,
    superficie,
    superficieTotal: over.superficieTotal ?? superficie,
    antiguedad: over.antiguedad ?? 5,
    enConstruccion: over.enConstruccion ?? false,
    piso: over.piso ?? 5,
    estacionamiento: over.estacionamiento ?? "no",
    precioEstacionamiento: over.precioEstacionamiento ?? 0,
    bodega: over.bodega ?? false,
    estadoVenta: over.estadoVenta ?? "inmediata",
    fechaEntrega: over.fechaEntrega,
    cuotasPie: over.cuotasPie ?? 0,
    montoCuota: over.montoCuota ?? 0,
    precio: over.precio ?? 3500,
    valorMercadoUsuario: over.valorMercadoUsuario,
    valorMercadoFranco: over.valorMercadoFranco,
    piePct: over.piePct ?? 20,
    plazoCredito: over.plazoCredito ?? 25,
    tasaInteres: over.tasaInteres ?? 4.5,
    gastos: over.gastos ?? 120000,
    contribuciones: over.contribuciones ?? 0,
    provisionMantencion: over.provisionMantencion ?? 0,
    tipoRenta: "larga",
    arriendo: over.arriendo ?? 700000,
    arriendoEstacionamiento: over.arriendoEstacionamiento ?? 0,
    arriendoBodega: over.arriendoBodega ?? 0,
    vacanciaMeses: over.vacanciaMeses ?? 1,
    usaAdministrador: over.usaAdministrador,
    comisionAdministrador: over.comisionAdministrador,
    costoPuestaAPuntoCLP: over.costoPuestaAPuntoCLP,
    lat: over.lat,
    lng: over.lng,
  };
}

/** AirbnbData sintético determinístico a partir de ADR p50 + ocupación p50. */
export function airbnb(adrP50: number, occP50: number): AirbnbData {
  const rev = (adr: number, occ: number) => Math.round(adr * occ * 365);
  const clampOcc = (o: number) => Math.max(0.05, Math.min(0.95, o));
  // Distribución mensual ~estacional que suma 1.0 (min/max ≈ 0.74 → estabilidad media-alta).
  const monthly = [0.075, 0.07, 0.08, 0.085, 0.09, 0.095, 0.092, 0.088, 0.08, 0.082, 0.083, 0.08];
  return {
    estimated_adr: adrP50,
    estimated_occupancy: occP50,
    estimated_annual_revenue: rev(adrP50, occP50),
    percentiles: {
      revenue: {
        p25: rev(adrP50 * 0.85, occP50 * 0.8),
        p50: rev(adrP50, occP50),
        p75: rev(adrP50 * 1.15, occP50 * 1.1),
        p90: rev(adrP50 * 1.3, occP50 * 1.15),
        avg: rev(adrP50, occP50),
      },
      occupancy: {
        p25: clampOcc(occP50 * 0.8),
        p50: clampOcc(occP50),
        p75: clampOcc(occP50 * 1.1),
        p90: clampOcc(occP50 * 1.2),
        avg: clampOcc(occP50),
      },
      average_daily_rate: {
        p25: Math.round(adrP50 * 0.85),
        p50: adrP50,
        p75: Math.round(adrP50 * 1.15),
        p90: Math.round(adrP50 * 1.3),
        avg: adrP50,
      },
    },
    monthly_revenue: monthly,
    currency: "CLP",
  };
}

/** ShortTermInputs completo con defaults + overrides. precioCompra en CLP. */
export function str(over: Partial<ShortTermInputs> & { adrP50?: number; occP50?: number }): ShortTermInputs {
  const dormitorios = over.dormitorios ?? 2;
  const precioCompra = over.precioCompra ?? 3500 * AUDIT_UF; // 3500 UF
  return {
    precioCompra,
    superficie: over.superficie ?? 50,
    dormitorios,
    banos: over.banos ?? 1,
    tipoPropiedad: over.tipoPropiedad ?? "usado",
    antiguedad: over.antiguedad ?? 5,
    antiguedadEsFallback: over.antiguedadEsFallback ?? false,
    comuna: over.comuna ?? "Providencia",
    piePercent: over.piePercent ?? 0.2,
    tasaCredito: over.tasaCredito ?? 0.045,
    plazoCredito: over.plazoCredito ?? 25,
    airbnbData: over.airbnbData ?? airbnb(over.adrP50 ?? 60000, over.occP50 ?? 0.55),
    modoGestion: over.modoGestion ?? "auto",
    comisionAdministrador: over.comisionAdministrador ?? 0.2,
    tipoEdificio: over.tipoEdificio,
    habilitacion: over.habilitacion,
    adminPro: over.adminPro,
    adrOverride: over.adrOverride ?? null,
    occOverride: over.occOverride ?? null,
    costoElectricidad: over.costoElectricidad ?? 55000,
    costoAgua: over.costoAgua ?? 12000,
    costoWifi: over.costoWifi ?? 22000,
    costoInsumos: over.costoInsumos ?? 22000,
    gastosComunes: over.gastosComunes ?? 120000,
    mantencion: over.mantencion ?? 20000,
    contribuciones: over.contribuciones ?? 0,
    costoAmoblamiento: over.costoAmoblamiento ?? 3500000,
    arriendoLargoMensual: over.arriendoLargoMensual ?? 600000,
    valorUF: AUDIT_UF,
  };
}

// ============================================================================
// TABLA DE FIXTURES
// ============================================================================

export const AUDIT_FIXTURES: AuditFixture[] = [
  // ───────────────────────── LTR · COMPRAR (8) ─────────────────────────
  {
    id: "ltr-comprar-providencia-01",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:COMPRAR", "datos-zona:con", "precio:medio"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Providencia", precio: 3000, arriendo: 850000, antiguedad: 3, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
  },
  {
    id: "ltr-comprar-nunoa-02",
    modalidad: "LTR", tier: "esencial", ejes: ["veredicto:COMPRAR", "datos-zona:con", "tier:esencial", "precio:bajo"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Ñuñoa", precio: 2600, arriendo: 780000, antiguedad: 2, ...COORDS.inesDeSuarez }),
    ltrMediana: medianaSeed("Ñuñoa", 2),
  },
  {
    id: "ltr-comprar-sanmiguel-03",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:COMPRAR", "datos-zona:con", "precio:bajo"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "San Miguel", precio: 2200, arriendo: 720000, antiguedad: 4, dormitorios: 2, superficie: 48 }),
    ltrMediana: medianaSeed("San Miguel", 2),
  },
  {
    id: "ltr-comprar-estacioncentral-04",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:COMPRAR", "datos-zona:con", "precio:bajo", "tipologia:1D"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Estación Central", precio: 1800, arriendo: 560000, dormitorios: 1, banos: 1, superficie: 35, antiguedad: 2 }),
    ltrMediana: medianaSeed("Estación Central", 1),
  },
  {
    id: "ltr-buscar-macul-09",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:BUSCAR", "datos-zona:con", "tier:experto", "break-even-imposible"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Macul", precio: 5500, arriendo: 480000, antiguedad: 14, piePct: 20 }),
    ltrMediana: medianaSeed("Macul", 2),
  },
  {
    id: "ltr-comprar-lascondes-06",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:COMPRAR", "datos-zona:con", "precio:alto", "pie:alto"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 5000, arriendo: 1500000, antiguedad: 1, superficie: 70, dormitorios: 2, piePct: 35 }),
    ltrMediana: medianaSeed("Las Condes", 2),
  },
  {
    id: "ltr-buscar-laflorida-10",
    modalidad: "LTR", tier: "esencial", ejes: ["veredicto:BUSCAR", "datos-zona:con", "tier:esencial"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "La Florida", precio: 4200, arriendo: 430000, antiguedad: 16, dormitorios: 2, superficie: 50 }),
    ltrMediana: medianaSeed("La Florida", 2),
  },
  {
    id: "ltr-comprar-independencia-08",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:COMPRAR", "datos-zona:con", "precio:bajo", "anomalia:no"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Independencia", precio: 1900, arriendo: 600000, antiguedad: 2, dormitorios: 1, superficie: 38 }),
    ltrMediana: medianaSeed("Independencia", 1),
  },

  // ───────────────────────── LTR · AJUSTA SUPUESTOS (8) ─────────────────
  {
    id: "ltr-ajusta-providencia-01",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:AJUSTA", "datos-zona:con", "precio:medio"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Providencia", precio: 4000, arriendo: 820000, antiguedad: 8, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
  },
  {
    id: "ltr-ajusta-lascondes-02",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:AJUSTA", "datos-zona:con", "precio:alto", "tier:experto"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 5500, arriendo: 1200000, antiguedad: 10, superficie: 70, dormitorios: 2 }),
    ltrMediana: medianaSeed("Las Condes", 2),
  },
  {
    id: "ltr-ajusta-nunoa-03",
    modalidad: "LTR", tier: "esencial", ejes: ["veredicto:AJUSTA", "datos-zona:con", "tier:esencial", "pie:bajo"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Ñuñoa", precio: 3800, arriendo: 820000, antiguedad: 7, piePct: 15, ...COORDS.inesDeSuarez }),
    ltrMediana: medianaSeed("Ñuñoa", 2),
  },
  {
    id: "ltr-ajusta-santiago-04",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:AJUSTA", "datos-zona:con", "plusvalia:negativa"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Santiago Centro", precio: 3200, arriendo: 560000, antiguedad: 9, dormitorios: 1, superficie: 40 }),
    ltrMediana: medianaSeed("Santiago Centro", 1),
    nota: "Santiago tiene plusvalía histórica negativa (-1.1%) en el dataset.",
  },
  {
    id: "ltr-buscar-vitacura-11",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:BUSCAR", "datos-zona:con", "precio:alto", "tier:experto"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Vitacura", precio: 9500, arriendo: 800000, antiguedad: 18, superficie: 80, dormitorios: 2 }),
    ltrMediana: medianaSeed("Vitacura", 2),
  },
  {
    id: "ltr-ajusta-recoleta-06",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:AJUSTA", "datos-zona:con", "tasa:alta", "anomalia:tasa"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Recoleta", precio: 2600, arriendo: 560000, antiguedad: 6, tasaInteres: 6.2, dormitorios: 1, superficie: 38 }),
    ltrMediana: medianaSeed("Recoleta", 1),
    nota: "Tasa 6.2% (~+170bps sobre mercado) → anomalía de financiamiento.",
  },
  {
    id: "ltr-buscar-laflorida-12",
    modalidad: "LTR", tier: "esencial", ejes: ["veredicto:BUSCAR", "datos-zona:con", "tier:esencial", "antiguedad:alta"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "La Florida", precio: 4000, arriendo: 420000, antiguedad: 18, dormitorios: 2, superficie: 52 }),
    ltrMediana: medianaSeed("La Florida", 2),
  },
  {
    id: "ltr-ajusta-quintanormal-08",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:AJUSTA", "datos-zona:con", "ggcc:altos", "anomalia:ggcc"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Quinta Normal", precio: 2400, arriendo: 480000, antiguedad: 5, gastos: 280000, dormitorios: 2, superficie: 50 }),
    ltrMediana: medianaSeed("Quinta Normal", 2),
    nota: "GGCC $280k para 50m² (~$5.600/m²) muy sobre rango → anomalía.",
  },

  // ───────────────────────── LTR · BUSCAR OTRA (8) ─────────────────────
  {
    id: "ltr-buscar-providencia-01",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:BUSCAR", "datos-zona:con", "precio:alto"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Providencia", precio: 6000, arriendo: 600000, antiguedad: 15, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
  },
  {
    id: "ltr-buscar-lascondes-02",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:BUSCAR", "datos-zona:con", "precio:alto", "tier:experto"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 8000, arriendo: 900000, antiguedad: 18, superficie: 70, dormitorios: 2 }),
    ltrMediana: medianaSeed("Las Condes", 2),
  },
  {
    id: "ltr-buscar-vitacura-03",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:BUSCAR", "datos-zona:con", "precio:alto"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Vitacura", precio: 9000, arriendo: 950000, antiguedad: 20, superficie: 80, dormitorios: 2 }),
    ltrMediana: medianaSeed("Vitacura", 2),
  },
  {
    id: "ltr-buscar-santiago-04",
    modalidad: "LTR", tier: "esencial", ejes: ["veredicto:BUSCAR", "datos-zona:con", "plusvalia:negativa", "tier:esencial"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Santiago Centro", precio: 5000, arriendo: 480000, antiguedad: 16, dormitorios: 1, superficie: 40 }),
    ltrMediana: medianaSeed("Santiago Centro", 1),
  },
  {
    id: "ltr-buscar-nunoa-05",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:BUSCAR", "datos-zona:con", "pie:bajo", "anomalia:pie"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Ñuñoa", precio: 5500, arriendo: 620000, antiguedad: 12, piePct: 10, ...COORDS.inesDeSuarez }),
    ltrMediana: medianaSeed("Ñuñoa", 2),
    nota: "Pie 10% muy bajo + precio alto → flujo fuertemente negativo.",
  },
  {
    id: "ltr-buscar-macul-06",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:BUSCAR", "datos-zona:con", "valorMercado:bajo", "plusvalia:inmediata-negativa"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Macul", precio: 4000, valorMercadoFranco: 3300, arriendo: 450000, antiguedad: 14 }),
    ltrMediana: medianaSeed("Macul", 2),
    nota: "valorMercadoFranco 3300 < precio 4000 → plusvalía inmediata -21% (gate).",
  },
  {
    id: "ltr-buscar-lascondes-07",
    modalidad: "LTR", tier: "experto", ejes: ["veredicto:BUSCAR", "datos-zona:con", "break-even-imposible"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 7000, arriendo: 400000, antiguedad: 20, superficie: 70, dormitorios: 2, piePct: 15 }),
    ltrMediana: medianaSeed("Las Condes", 2),
    nota: "Arriendo no cubre la cuota ni con tasa 0% → breakEvenTasa -1 (gate).",
  },
  {
    id: "ltr-buscar-providencia-08",
    modalidad: "LTR", tier: "estandar", ejes: ["veredicto:BUSCAR", "datos-zona:con", "antiguedad:alta"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Providencia", precio: 6500, arriendo: 700000, antiguedad: 25, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
  },

  // ───────────────────────── STR (12) ─────────────────────────────────
  // COMPRAR (4)
  {
    id: "str-comprar-providencia-01",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:COMPRAR", "regulacion:si", "revenue:alto"],
    expected: { str: "COMPRAR" },
    strInput: str({ comuna: "Providencia", adrP50: 75000, occP50: 0.65, arriendoLargoMensual: 600000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.pedroValdiviaL1 },
  },
  {
    id: "str-comprar-lastarria-02",
    modalidad: "STR", tier: "experto", ejes: ["veredicto:COMPRAR", "regulacion:si", "tier:experto", "tipologia:1D"],
    expected: { str: "COMPRAR" },
    strInput: str({ comuna: "Santiago Centro", adrP50: 70000, occP50: 0.68, dormitorios: 1, superficie: 38, precioCompra: 2600 * AUDIT_UF, arriendoLargoMensual: 480000 }),
    strScore: { regulacionEdificio: "si", lat: -33.4372, lng: -70.6386 },
  },
  {
    id: "str-comprar-lascondes-03",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:COMPRAR", "regulacion:si", "adminPro"],
    expected: { str: "COMPRAR" },
    strInput: str({ comuna: "Las Condes", adrP50: 90000, occP50: 0.62, adminPro: true, tipoEdificio: "dedicado", modoGestion: "administrador", precioCompra: 4500 * AUDIT_UF, arriendoLargoMensual: 850000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.trazaL7LasCondes },
  },
  {
    id: "str-comprar-nunoa-04",
    modalidad: "STR", tier: "esencial", ejes: ["veredicto:COMPRAR", "regulacion:si", "tier:esencial"],
    expected: { str: "COMPRAR" },
    strInput: str({ comuna: "Ñuñoa", adrP50: 68000, occP50: 0.64, precioCompra: 2800 * AUDIT_UF, arriendoLargoMensual: 520000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.inesDeSuarez },
  },
  // AJUSTA (4)
  {
    id: "str-ajusta-providencia-05",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:AJUSTA", "regulacion:si", "break-even:apretado"],
    expected: { str: "AJUSTA SUPUESTOS" },
    strInput: str({ comuna: "Providencia", adrP50: 60000, occP50: 0.50, precioCompra: 4500 * AUDIT_UF, arriendoLargoMensual: 600000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.pedroValdiviaL1 },
  },
  {
    id: "str-ajusta-santiago-06",
    modalidad: "STR", tier: "esencial", ejes: ["veredicto:AJUSTA", "regulacion:no_seguro", "tier:esencial"],
    expected: { str: "AJUSTA SUPUESTOS" },
    strInput: str({ comuna: "Santiago Centro", adrP50: 55000, occP50: 0.46, dormitorios: 1, superficie: 40, precioCompra: 3800 * AUDIT_UF, arriendoLargoMensual: 420000 }),
    strScore: { regulacionEdificio: "no_seguro", lat: -33.4372, lng: -70.6386 },
  },
  {
    id: "str-ajusta-lascondes-07",
    modalidad: "STR", tier: "experto", ejes: ["veredicto:AJUSTA", "regulacion:si", "ltr-gana-poco"],
    expected: { str: "AJUSTA SUPUESTOS" },
    strInput: str({ comuna: "Las Condes", adrP50: 65000, occP50: 0.52, precioCompra: 5000 * AUDIT_UF, arriendoLargoMensual: 900000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.trazaL7LasCondes },
  },
  {
    id: "str-ajusta-nunoa-08",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:AJUSTA", "regulacion:si", "flujo:levemente-negativo"],
    expected: { str: "AJUSTA SUPUESTOS" },
    strInput: str({ comuna: "Ñuñoa", adrP50: 56000, occP50: 0.50, precioCompra: 4200 * AUDIT_UF, arriendoLargoMensual: 550000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.inesDeSuarez },
  },
  // BUSCAR (4)
  {
    id: "str-buscar-regulacion-09",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:BUSCAR", "regulacion:no", "gate:regulacion"],
    expected: { str: "BUSCAR OTRA" },
    strInput: str({ comuna: "Providencia", adrP50: 75000, occP50: 0.65, arriendoLargoMensual: 600000 }),
    strScore: { regulacionEdificio: "no", ...COORDS.pedroValdiviaL1 },
    nota: "Mismo caso económico que str-comprar-01 pero regulación 'no' → gate fuerza BUSCAR.",
  },
  {
    id: "str-buscar-economico-10",
    modalidad: "STR", tier: "estandar", ejes: ["veredicto:BUSCAR", "regulacion:si", "cap-rate:bajo", "precio:alto"],
    expected: { str: "BUSCAR OTRA" },
    strInput: str({ comuna: "Las Condes", adrP50: 45000, occP50: 0.40, precioCompra: 6000 * AUDIT_UF, arriendoLargoMensual: 600000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.trazaL7LasCondes },
    nota: "ADR/occ bajos + precio alto → CAP rate <2% y flujo muy negativo.",
  },
  {
    id: "str-buscar-flujo-11",
    modalidad: "STR", tier: "experto", ejes: ["veredicto:BUSCAR", "regulacion:si", "flujo:muy-negativo", "tier:experto"],
    expected: { str: "BUSCAR OTRA" },
    strInput: str({ comuna: "Vitacura", adrP50: 55000, occP50: 0.42, precioCompra: 7000 * AUDIT_UF, arriendoLargoMensual: 700000 }),
    strScore: { regulacionEdificio: "si", lat: -33.3950, lng: -70.5750 },
  },
  {
    id: "str-buscar-3d-12",
    modalidad: "STR", tier: "esencial", ejes: ["veredicto:BUSCAR", "regulacion:no_seguro", "tipologia:3D", "tier:esencial"],
    expected: { str: "BUSCAR OTRA" },
    strInput: str({ comuna: "La Florida", adrP50: 50000, occP50: 0.45, dormitorios: 3, superficie: 95, precioCompra: 4500 * AUDIT_UF, arriendoLargoMensual: 650000 }),
    strScore: { regulacionEdificio: "no_seguro", lat: -33.5220, lng: -70.5980 },
  },

  // ───────────────────────── AMBAS (6) ─────────────────────────────────
  {
    id: "ambas-providencia-01",
    modalidad: "AMBAS", tier: "estandar", ejes: ["modalidad:AMBAS", "datos-zona:con", "str-mejor-que-ltr"],
    expected: { ltr: "AJUSTA SUPUESTOS", str: "COMPRAR" },
    ltrInput: ltr({ comuna: "Providencia", precio: 4000, arriendo: 700000, antiguedad: 5, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
    strInput: str({ comuna: "Providencia", adrP50: 78000, occP50: 0.66, precioCompra: 4000 * AUDIT_UF, arriendoLargoMensual: 700000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.pedroValdiviaL1 },
  },
  {
    id: "ambas-nunoa-02",
    modalidad: "AMBAS", tier: "experto", ejes: ["modalidad:AMBAS", "datos-zona:con", "tier:experto"],
    expected: { ltr: "COMPRAR", str: "COMPRAR" },
    ltrInput: ltr({ comuna: "Ñuñoa", precio: 2600, arriendo: 780000, antiguedad: 2, ...COORDS.inesDeSuarez }),
    ltrMediana: medianaSeed("Ñuñoa", 2),
    strInput: str({ comuna: "Ñuñoa", adrP50: 70000, occP50: 0.66, precioCompra: 2600 * AUDIT_UF, arriendoLargoMensual: 520000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.inesDeSuarez },
  },
  {
    id: "ambas-lascondes-03",
    modalidad: "AMBAS", tier: "estandar", ejes: ["modalidad:AMBAS", "datos-zona:con", "precio:alto", "ambos-ajusta"],
    expected: { ltr: "AJUSTA SUPUESTOS", str: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 5500, arriendo: 1200000, antiguedad: 10, superficie: 70, dormitorios: 2 }),
    ltrMediana: medianaSeed("Las Condes", 2),
    strInput: str({ comuna: "Las Condes", adrP50: 68000, occP50: 0.55, precioCompra: 5500 * AUDIT_UF, superficie: 70, arriendoLargoMensual: 1200000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.trazaL7LasCondes },
  },
  {
    id: "ambas-santiago-04",
    modalidad: "AMBAS", tier: "esencial", ejes: ["modalidad:AMBAS", "datos-zona:con", "tier:esencial", "ltr-buscar"],
    expected: { ltr: "BUSCAR OTRA", str: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Santiago Centro", precio: 5000, arriendo: 480000, antiguedad: 16, dormitorios: 1, superficie: 40 }),
    ltrMediana: medianaSeed("Santiago Centro", 1),
    strInput: str({ comuna: "Santiago Centro", adrP50: 60000, occP50: 0.55, dormitorios: 1, superficie: 40, precioCompra: 5000 * AUDIT_UF, arriendoLargoMensual: 480000 }),
    strScore: { regulacionEdificio: "si", lat: -33.4372, lng: -70.6386 },
  },
  {
    id: "ambas-sanmiguel-05",
    modalidad: "AMBAS", tier: "estandar", ejes: ["modalidad:AMBAS", "datos-zona:con", "ltr-mejor-que-str"],
    expected: { ltr: "COMPRAR", str: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "San Miguel", precio: 2200, arriendo: 720000, antiguedad: 4, superficie: 48 }),
    ltrMediana: medianaSeed("San Miguel", 2),
    strInput: str({ comuna: "San Miguel", adrP50: 52000, occP50: 0.50, precioCompra: 2200 * AUDIT_UF, superficie: 48, arriendoLargoMensual: 720000 }),
    strScore: { regulacionEdificio: "no_seguro", lat: -33.4970, lng: -70.6510 },
  },
  {
    id: "ambas-vitacura-06",
    modalidad: "AMBAS", tier: "experto", ejes: ["modalidad:AMBAS", "datos-zona:con", "precio:alto", "ambos-buscar"],
    expected: { ltr: "BUSCAR OTRA", str: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Vitacura", precio: 9000, arriendo: 950000, antiguedad: 20, superficie: 80, dormitorios: 2 }),
    ltrMediana: medianaSeed("Vitacura", 2),
    strInput: str({ comuna: "Vitacura", adrP50: 55000, occP50: 0.42, precioCompra: 9000 * AUDIT_UF, superficie: 80, arriendoLargoMensual: 950000 }),
    strScore: { regulacionEdificio: "si", lat: -33.3950, lng: -70.5750 },
  },

  // ───────────────────── TRAMPAS / BORDES (10) ─────────────────────────
  // Trampa-ubicación: coords sobre traza L7/L8 futura → el motor las ignora,
  // pero la prosa IA (2c) podría alucinar "metro futuro a X metros".
  {
    id: "trampa-l7-lascondes-01",
    modalidad: "LTR", tier: "estandar", ejes: ["trampa:L7-futura", "datos-zona:con"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Las Condes", precio: 5500, arriendo: 1000000, antiguedad: 6, superficie: 65, dormitorios: 2, ...COORDS.trazaL7LasCondes }),
    ltrMediana: medianaSeed("Las Condes", 2),
    nota: "Coords sobre traza L7 futura (Isidora/Vitacura L7). El juez debe flaggear si la prosa afirma cercanía a estación L7.",
  },
  {
    id: "trampa-l7-pedrodevaldivia-02",
    modalidad: "STR", tier: "estandar", ejes: ["trampa:L7-futura", "regulacion:si"],
    expected: { str: "COMPRAR" },
    strInput: str({ comuna: "Providencia", adrP50: 78000, occP50: 0.66, arriendoLargoMensual: 600000 }),
    strScore: { regulacionEdificio: "si", lat: -33.4253, lng: -70.6135 },
    nota: "Coords exactas de 'Pedro de Valdivia L7' (future, ficticia en metro-stations.ts). Caso canónico de alucinación.",
  },
  {
    id: "trampa-l8-providencia-03",
    modalidad: "LTR", tier: "experto", ejes: ["trampa:L8-futura", "datos-zona:con", "tier:experto"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Providencia", precio: 4000, arriendo: 820000, antiguedad: 7, ...COORDS.trazaL8Providencia }),
    ltrMediana: medianaSeed("Providencia", 2),
    nota: "Coords sobre traza L8 futura (Pocuro L8).",
  },
  {
    id: "trampa-l7-matucana-04",
    modalidad: "LTR", tier: "estandar", ejes: ["trampa:L7-futura", "datos-zona:con", "veredicto:BUSCAR"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Quinta Normal", precio: 4500, arriendo: 430000, antiguedad: 15, dormitorios: 2, superficie: 50, ...COORDS.matucanaL7 }),
    ltrMediana: medianaSeed("Quinta Normal", 2),
    nota: "Coords sobre traza L7 futura (Matucana L7). El juez debe flaggear si la prosa afirma cercanía a estación L7.",
  },
  {
    id: "trampa-l9-biobio-05",
    modalidad: "LTR", tier: "esencial", ejes: ["trampa:L9-futura", "datos-zona:con", "veredicto:BUSCAR", "tier:esencial"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "San Miguel", precio: 4200, arriendo: 420000, antiguedad: 16, dormitorios: 2, superficie: 50, ...COORDS.bioBioL9 }),
    ltrMediana: medianaSeed("San Miguel", 2),
    nota: "Coords sobre traza L9 futura (Bío Bío L9), distinta línea y distancia que los casos L7/L8.",
  },
  {
    id: "trampa-l8-macul-06",
    modalidad: "STR", tier: "estandar", ejes: ["trampa:L8-futura", "regulacion:si", "veredicto:AJUSTA"],
    expected: { str: "AJUSTA SUPUESTOS" },
    strInput: str({ comuna: "Macul", adrP50: 56000, occP50: 0.50, precioCompra: 4200 * AUDIT_UF, arriendoLargoMensual: 550000 }),
    strScore: { regulacionEdificio: "si", ...COORDS.maculL8 },
    nota: "STR con coords sobre traza L8 futura (Macul L8). El motor ignora la futura; el juez debe cazar alucinación L8 en prosa STR.",
  },
  // Datos-zona null: mediana null + comuna fuera de PLUSVALIA_HISTORICA.
  {
    id: "borde-zonanull-penalolen-04",
    modalidad: "LTR", tier: "estandar", ejes: ["datos-zona:null", "comuna:sin-plusvalia"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Peñalolén", precio: 3000, arriendo: 520000, antiguedad: 8, dormitorios: 2, superficie: 55 }),
    ltrMediana: null,
    nota: "Peñalolén no está en PLUSVALIA_HISTORICA ni en market-seed → mediana null + plusvalía default. Caso del null.",
  },
  {
    id: "borde-zonanull-lagranja-05",
    modalidad: "LTR", tier: "esencial", ejes: ["datos-zona:null", "comuna:sin-plusvalia", "tier:esencial"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "La Granja", precio: 1800, arriendo: 560000, antiguedad: 3, dormitorios: 2, superficie: 48 }),
    ltrMediana: null,
    nota: "Comuna sin datos de zona; precio bajo + arriendo sólido debería dar COMPRAR aún sin mediana.",
  },
  {
    id: "borde-zonanull-str-renca-06",
    modalidad: "STR", tier: "estandar", ejes: ["datos-zona:null", "comuna:sin-plusvalia", "str-zona-debil"],
    expected: { str: "BUSCAR OTRA" },
    strInput: str({ comuna: "Renca", adrP50: 45000, occP50: 0.42, precioCompra: 3000 * AUDIT_UF, arriendoLargoMensual: 480000 }),
    strScore: { regulacionEdificio: "no_seguro", lat: -33.4040, lng: -70.7280 },
    nota: "Comuna periférica fuera del universo STR fuerte; lejos de metro activo → factibilidad baja.",
  },
  // Sobreprecio fuerte (mediana presente, precio muy sobre mediana).
  {
    id: "borde-sobreprecio-nunoa-07",
    modalidad: "LTR", tier: "estandar", ejes: ["precio:sobreprecio-fuerte", "datos-zona:con", "anomalia:sobreprecio"],
    expected: { ltr: "BUSCAR OTRA" },
    ltrInput: ltr({ comuna: "Ñuñoa", precio: 5800, arriendo: 650000, antiguedad: 6, superficie: 50, ...COORDS.inesDeSuarez }),
    ltrMediana: medianaSeed("Ñuñoa", 2),
    nota: "116 UF/m² vs mediana ~58 → ~100% sobreprecio. Debe gatillar hallazgo sobreprecio + flujo negativo.",
  },
  // Anomalía arriendo +30% sobre mercado.
  {
    id: "borde-arriendo-alto-providencia-08",
    modalidad: "LTR", tier: "estandar", ejes: ["anomalia:arriendo-alto", "datos-zona:con"],
    expected: { ltr: "COMPRAR" },
    ltrInput: ltr({ comuna: "Providencia", precio: 3500, arriendo: 1100000, antiguedad: 4, ...COORDS.pedroValdiviaL1 }),
    ltrMediana: medianaSeed("Providencia", 2),
    nota: "Arriendo $1.1M ~+40% sobre mediana 2D Providencia ($580k). Anomalía optimista que infla el veredicto — el juez debe verificar que la prosa la mencione (§1.9).",
  },
  // Operación consumada (tiempos verbales) — borde de prosa, no de veredicto.
  {
    id: "borde-operacion-consumada-09",
    modalidad: "LTR", tier: "estandar", ejes: ["operacion:consumada", "datos-zona:con"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Macul", precio: 3600, arriendo: 600000, antiguedad: 9, estadoVenta: "inmediata" }),
    ltrMediana: medianaSeed("Macul", 2),
    nota: "Marca de operación consumada para el eje §1.6 (tiempos verbales). El estado de etapa se inyecta en 2c; acá solo posiciona el caso.",
  },
  // Entrega futura (en construcción) — penaliza score, prosa condicional.
  {
    id: "borde-enconstruccion-estacioncentral-10",
    modalidad: "LTR", tier: "esencial", ejes: ["operacion:futura", "construccion:si", "tier:esencial"],
    expected: { ltr: "AJUSTA SUPUESTOS" },
    ltrInput: ltr({ comuna: "Estación Central", precio: 2400, arriendo: 480000, antiguedad: 0, enConstruccion: true, estadoVenta: "futura", fechaEntrega: "2027-12-01", dormitorios: 1, superficie: 36 }),
    ltrMediana: medianaSeed("Estación Central", 1),
    nota: "En construcción con entrega futura → penalización de score + prosa condicional (§1.6).",
  },
];
