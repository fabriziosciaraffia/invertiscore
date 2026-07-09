// ============================================================================
// GOLDEN SET — INVARIANTES (clase a exactos + clase b estructurales)
// ============================================================================
// Puros. checkClassA compara los HECHOS recomputados contra el baseline congelado
// (baseline.json) con tolerancia ±1 último decimal para cifras y 0 para
// veredicto/N/corona. checkClassB no necesita baseline: son invariantes que NUNCA
// deben romperse, independientes de la versión del motor (priorizados en el diseño).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FullAnalysisResult, Hallazgo } from "../../../src/lib/types";
import { gatherHallazgos, displayUnit, type GoldenFacts } from "./extract";

export interface Check {
  rule: string;
  pass: boolean;
  detail: string;
  /** class a con drift de cifra → candidato a re-baseline (no bug estructural). */
  rebaseline?: boolean;
}

export interface Baseline {
  veredicto: string;
  score: number;
  N: number;
  corona: string | null;
  hallazgoIds: string[]; // set ordenado (para comparación estable)
  capRatePct: number | null;
  sobreprecioPct: number | null;
  flujoNetoMensual: number;
  tirPct: number | null;
  patrimonioMult: number | null;
}

export function factsToBaseline(f: GoldenFacts): Baseline {
  return {
    veredicto: f.veredicto,
    score: f.score,
    N: f.N,
    corona: f.corona,
    hallazgoIds: [...f.hallazgoIds].sort(),
    capRatePct: f.capRatePct,
    sobreprecioPct: f.sobreprecioPct,
    flujoNetoMensual: f.flujoNetoMensual,
    tirPct: f.tirPct,
    patrimonioMult: f.patrimonioMult,
  };
}

// ── Clase (a): exactos vs baseline congelado ────────────────────────────────

function near(a: number | null, b: number | null, tol: number): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol + 1e-9;
}

export function checkClassA(f: GoldenFacts, base: Baseline): Check[] {
  const out: Check[] = [];
  // Duros (tolerancia 0): veredicto, N, corona, set de ids.
  out.push({ rule: "a.veredicto", pass: f.veredicto === base.veredicto, detail: `${f.veredicto} vs ${base.veredicto}` });
  out.push({ rule: "a.N", pass: f.N === base.N, detail: `N=${f.N} vs ${base.N}` });
  out.push({ rule: "a.corona", pass: f.corona === base.corona, detail: `${f.corona} vs ${base.corona}` });
  const idsNow = [...f.hallazgoIds].sort().join(",");
  const idsBase = [...base.hallazgoIds].sort().join(",");
  out.push({ rule: "a.hallazgoIds", pass: idsNow === idsBase, detail: `[${idsNow}] vs [${idsBase}]` });
  // Cifras (tolerancia ±1 último decimal → candidatas a re-baseline si driftan).
  const num = (rule: string, a: number | null, b: number | null, tol: number) => {
    const pass = near(a, b, tol);
    out.push({ rule, pass, detail: `${a} vs ${b}`, rebaseline: !pass });
  };
  num("a.score", f.score, base.score, 0);
  num("a.capRatePct", f.capRatePct, base.capRatePct, 0.1);
  num("a.sobreprecioPct", f.sobreprecioPct, base.sobreprecioPct, 1);
  num("a.flujoNetoMensual", f.flujoNetoMensual, base.flujoNetoMensual, 1500);
  num("a.tirPct", f.tirPct, base.tirPct, 0.1);
  num("a.patrimonioMult", f.patrimonioMult, base.patrimonioMult, 0.02);
  return out;
}

// ── Clase (b): estructurales intrínsecos (sin baseline) ─────────────────────

export interface ClassBContext {
  arriendo: number;
  totalAportado: number | null;
  medianaConfiable: boolean; // mediana != null
}

export function checkClassB(results: FullAnalysisResult, f: GoldenFacts, ctx: ClassBContext): Check[] {
  const out: Check[] = [];
  const gathered = gatherHallazgos(results);
  const byId = (id: string) => gathered.find((h) => h.id === id) as any;

  // B1 — KPI(body) refleja el valor del motor dentro de la precisión de display.
  for (const fact of f.facts) {
    if (fact.bodyKpi == null || fact.engineKpi == null) continue;
    const unit = displayUnit(fact.id);
    const pass = Math.abs(fact.bodyKpi - fact.engineKpi) <= unit + 1e-9;
    out.push({ rule: `B1.kpi==body[${fact.id}]`, pass, detail: `body=${fact.bodyKpi} engine=${fact.engineKpi} (±${unit})` });
  }

  // B2 — dirección coherente con el valor y su corte.
  const dirCheck = (id: string, expectAdverso: boolean | null, why: string) => {
    const h = byId(id);
    if (!h || expectAdverso == null) return;
    const isAdverso = h.direccion !== "favorable";
    out.push({ rule: `B2.dir[${id}]`, pass: isAdverso === expectAdverso, detail: `${h.direccion} — ${why}` });
  };
  const sob = byId("sobreprecio");
  if (sob) dirCheck("sobreprecio", sob.valor.desviacionPct > 0, `desv=${sob.valor.desviacionPct}%`);
  const cr = byId("cap_rate");
  if (cr) dirCheck("cap_rate", cr.valor.gapPts < 0, `gap=${cr.valor.gapPts}pts`);
  const fl = byId("flujo_mensual");
  if (fl) dirCheck("flujo_mensual", fl.valor.flujoNetoMensualCLP < 0, `flujo=${fl.valor.flujoNetoMensualCLP}`);
  const pv = byId("plusvalia");
  if (pv) dirCheck("plusvalia", pv.valor.anualizadaPct < pv.valor.refPct, `anual=${pv.valor.anualizadaPct} ref=${pv.valor.refPct}`);
  const patr = byId("patrimonio");
  if (patr) dirCheck("patrimonio", patr.valor.multiplicador < patr.valor.corteAdverso, `mult=${patr.valor.multiplicador} corte=${patr.valor.corteAdverso}`);
  const sens = byId("sensibilidad");
  if (sens) dirCheck("sensibilidad", sens.valor.marginPct < sens.valor.corteAdverso, `margin=${sens.valor.marginPct} corte=${sens.valor.corteAdverso}`);

  // B4 — dedup + corona. Sin ids duplicados; corona == #1 adverso por decisividad.
  const ids = gathered.map((h: Hallazgo) => h.id);
  const dup = ids.length !== new Set(ids).size;
  out.push({ rule: "B4.dedup", pass: !dup, detail: dup ? `ids duplicados: [${ids}]` : `${ids.length} ids únicos` });
  // corona esperada = primer adverso por decisividad; si no hay adverso, el favorable más decisivo.
  const adversos = gathered.filter((h) => h.direccion !== "favorable").sort((a, b) => b.decisividad - a.decisividad || (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0));
  const favorables = gathered.filter((h) => h.direccion === "favorable").sort((a, b) => b.decisividad - a.decisividad || (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0));
  const coronaEsperada = (adversos[0] ?? favorables[0])?.id ?? null;
  out.push({ rule: "B4.corona", pass: f.corona === coronaEsperada, detail: `${f.corona} vs esperada ${coronaEsperada}` });

  // B5 — N de la pirámide en [5,9].
  out.push({ rule: "B5.N∈[5,9]", pass: f.N >= 5 && f.N <= 9, detail: `N=${f.N}` });

  // B6 — omisiones donde corresponde.
  const sensDebe = f.veredicto !== "BUSCAR OTRA" && ctx.arriendo > 0;
  out.push({ rule: "B6.sensibilidad", pass: f.sensibilidadPresent === sensDebe, detail: `present=${f.sensibilidadPresent} debe=${sensDebe} (ver=${f.veredicto})` });
  const patrDebe = (ctx.totalAportado ?? 0) > 0;
  out.push({ rule: "B6.patrimonio", pass: f.patrimonioPresent === patrDebe, detail: `present=${f.patrimonioPresent} debe=${patrDebe} (aportado=${ctx.totalAportado})` });
  out.push({ rule: "B6.sobreprecio", pass: f.sobreprecioPresent === ctx.medianaConfiable, detail: `present=${f.sobreprecioPresent} confiable=${ctx.medianaConfiable}` });

  return out;
}
