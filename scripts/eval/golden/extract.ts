// ============================================================================
// GOLDEN SET — extracción de HECHOS estructurales desde un FullAnalysisResult
// ============================================================================
// Pura y determinística. La usan accept.ts (congelar baseline) y recompute.ts
// (chequear invariantes). Replica el gather + dedup + orden de
// PiramideHallazgos.tsx para calcular N y la corona igual que el render.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FullAnalysisResult, Hallazgo } from "../../../src/lib/types";

// ── Gather + dedup + orden — espejo de PiramideHallazgos.tsx ─────────────────

const cmpDecisividad = (a: Hallazgo, b: Hallazgo) =>
  b.decisividad - a.decisividad || ((b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0));
const esAdverso = (h: Hallazgo) => h.direccion !== "favorable";

export function gatherHallazgos(results: FullAnalysisResult): Hallazgo[] {
  const out: Hallazgo[] = [];
  const push = (h: Hallazgo | null | undefined) => {
    if (h && typeof (h as any).decisividad === "number") out.push(h);
  };
  const m = results.metrics as unknown as Record<string, Hallazgo | null | undefined>;
  push(m?.hallazgoSobreprecio);
  push(m?.hallazgoCapRate);
  push(m?.hallazgoFlujoMensual);
  push(m?.hallazgoPlusvalia);
  push(m?.hallazgoPuestaAPunto);
  if (Array.isArray(results.hallazgos)) results.hallazgos.forEach(push);

  // Dedup por id: el que tiene titular gana; entre iguales, mayor decisividad.
  const byId = new Map<string, Hallazgo>();
  for (const h of out) {
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

/** Orden Filosofía 1: adversos primero (decisividad DESC), favorables después.
 *  Es el orden de la PIRÁMIDE (render) → define la CORONA (top-adverso). */
export function ordenarHallazgos(hs: Hallazgo[]): Hallazgo[] {
  const adversos = hs.filter(esAdverso).sort(cmpDecisividad);
  const favorables = hs.filter((h) => !esAdverso(h)).sort(cmpDecisividad);
  return [...adversos, ...favorables];
}

// Los 6 builders que alimentan el prompt (NO los solo-lectura TIR/sensibilidad/
// patrimonio). Espejo de ai-generation.ts:1238-1257.
const BUILDERS_PROMPT = new Set([
  "capex_puesta_a_punto", "cap_rate", "flujo_mensual", "sobreprecio", "plusvalia", "estructura_financiamiento",
]);

/** Fuente de la APERTURA (respuestaDirecta): #1 por decisividad PURA entre los 6
 *  builders (sin adverso-first, sin read-only). Espejo de ai-generation.ts:1257,1279.
 *  Puede DIFERIR de la corona de la pirámide (top-adverso) cuando un favorable tiene
 *  la mayor decisividad — ej. cap_rate favorable dec 0.85 vs sobreprecio adverso 0.4. */
export function aperturaSource(hs: Hallazgo[]): Hallazgo | null {
  const cands = hs.filter((h) => BUILDERS_PROMPT.has(h.id)).sort(cmpDecisividad);
  return cands[0] ?? null;
}

// ── Parsing de cifras del body (fraseCanonica) por tipo de hallazgo ──────────
// Devuelve el número que el KPI representa, parseado del texto. null si no aplica.

const parseComaNum = (s: string): number => parseFloat(s.replace(/\./g, "").replace(",", "."));

/** Número del KPI que la fraseCanonica debe reflejar, por tipo. null = sin cifra única. */
export function bodyKpiValue(h: Hallazgo): number | null {
  const f = h.fraseCanonica || "";
  switch (h.id) {
    case "cap_rate": {
      const mm = f.match(/cap rate es\s+(-?\d+(?:,\d+)?)\s*%/i) || f.match(/(-?\d+(?:,\d+)?)\s*%/);
      return mm ? parseComaNum(mm[1]) : null;
    }
    case "sobreprecio": {
      const mm = f.match(/(\d+(?:,\d+)?)\s*%\s+(sobre|bajo)/i);
      return mm ? parseComaNum(mm[1]) : null;
    }
    case "flujo_mensual": {
      const mm = f.match(/\$\s*(-?[\d.]+)/);
      return mm ? parseComaNum(mm[1]) : null;
    }
    case "plusvalia": {
      const mm = f.match(/(-?\d+(?:,\d+)?)\s*%\s+anual/i);
      return mm ? parseComaNum(mm[1]) : null;
    }
    case "patrimonio": {
      const mm = f.match(/×\s*(\d+(?:,\d+)?)/);
      return mm ? parseComaNum(mm[1]) : null;
    }
    case "sensibilidad": {
      const mm = f.match(/(\d+(?:,\d+)?)\s*%/);
      return mm ? parseComaNum(mm[1]) : null;
    }
    default:
      return null;
  }
}

/** Valor canónico del motor (el que el KPI debería mostrar) por tipo. */
export function engineKpiValue(h: Hallazgo): number | null {
  const v = (h as any).valor || {};
  switch (h.id) {
    // abs() donde el body narra magnitud y la dirección va en h.direccion (flujo de
    // bolsillo "$X", plusvalía negativa "perdió X%"): B1 compara magnitudes.
    case "cap_rate": return typeof v.capRatePct === "number" ? v.capRatePct : null;
    case "sobreprecio": return typeof v.desviacionPct === "number" ? Math.abs(v.desviacionPct) : null;
    case "flujo_mensual": return typeof v.flujoNetoMensualCLP === "number" ? Math.abs(v.flujoNetoMensualCLP) : null;
    case "plusvalia": return typeof v.anualizadaPct === "number" ? Math.abs(v.anualizadaPct) : null;
    case "patrimonio": return typeof v.multiplicador === "number" ? v.multiplicador : null;
    case "sensibilidad": return typeof v.marginPct === "number" ? v.marginPct : null;
    default: return null;
  }
}

/** Precisión de display por tipo (unidad del último dígito visible). */
export function displayUnit(id: string): number {
  switch (id) {
    case "cap_rate": case "plusvalia": case "patrimonio": return 0.1; // 1 decimal
    case "sensibilidad": case "sobreprecio": return 1;                // entero (%)
    case "flujo_mensual": return 1000;                                // CLP, redondeo grueso
    default: return 0.1;
  }
}

// ── Hechos estructurales del análisis ───────────────────────────────────────

export interface HallazgoFact {
  id: string;
  direccion: string;
  decisividad: number;
  hasTitular: boolean;
  bodyKpi: number | null;    // cifra parseada del body
  engineKpi: number | null;  // cifra del motor (valor)
}

export interface GoldenFacts {
  veredicto: string;
  score: number;
  scoreBand: string;
  gateFired: boolean;         // veredicto !== band(score) → un gate sobreescribió
  N: number;                  // hallazgos en la pirámide (deduped)
  hallazgoIds: string[];      // ordenados adverso-first
  corona: string | null;      // id del #1
  capRatePct: number | null;
  sobreprecioPct: number | null;
  flujoNetoMensual: number;
  tirPct: number | null;
  patrimonioMult: number | null;
  sensibilidadPresent: boolean;
  patrimonioPresent: boolean;
  sobreprecioPresent: boolean;
  confiable: boolean;
  vmSolido: boolean;
  facts: HallazgoFact[];
}

function band(score: number): string {
  return score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
}

export function extractFacts(results: FullAnalysisResult, precioUF: number): GoldenFacts {
  const gathered = gatherHallazgos(results);
  const ordered = ordenarHallazgos(gathered);
  const m = results.metrics as any;
  const exit = results.exitScenario as any;
  const byId = (id: string) => gathered.find((h) => h.id === id) as any;

  const patr = byId("patrimonio");
  const sens = byId("sensibilidad");
  const sob = byId("sobreprecio");
  const pvc = m?.precioVsComuna;
  const vmFrancoUF = typeof m?.valorMercadoFrancoUF === "number" ? m.valorMercadoFrancoUF : precioUF;

  return {
    veredicto: results.veredicto,
    score: results.score,
    scoreBand: band(results.score),
    gateFired: results.veredicto !== band(results.score),
    N: gathered.length,
    hallazgoIds: ordered.map((h) => h.id),
    corona: ordered[0]?.id ?? null,
    capRatePct: typeof m?.capRate === "number" ? m.capRate : null,
    sobreprecioPct: sob ? sob.valor.desviacionPct : (pvc?.desviacionPct ?? null),
    flujoNetoMensual: m?.flujoNetoMensual ?? 0,
    tirPct: typeof exit?.tir === "number" ? exit.tir : null,
    patrimonioMult: patr ? patr.valor.multiplicador : null,
    sensibilidadPresent: !!sens,
    patrimonioPresent: !!patr,
    sobreprecioPresent: !!sob,
    confiable: !!pvc?.confiable,
    vmSolido: Math.abs((vmFrancoUF - precioUF) * (m?.precioCLP / precioUF || 0)) > 1_000_000,
    facts: ordered.map((h: any) => ({
      id: h.id,
      direccion: h.direccion,
      decisividad: h.decisividad,
      hasTitular: !!h.titular,
      bodyKpi: bodyKpiValue(h),
      engineKpi: engineKpiValue(h),
    })),
  };
}
