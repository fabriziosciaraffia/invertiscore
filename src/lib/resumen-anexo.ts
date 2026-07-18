/**
 * Fase D — datos del RESUMEN (Variante A) que renderizan los hijos de un par
 * AMBAS mientras el grupo no esté desbloqueado. Deriva desde lo PERSISTIDO
 * (recomputado on-load), sin regenerar nada. Un builder por modalidad porque los
 * shapes difieren (FullAnalysisResult vs ShortTermResult); ambos normalizan al
 * mismo `ResumenAnexoData` para que el componente sea presentacional puro.
 *
 * Fuente de las rutas: heros existentes (HeroLTR / HeroSTR) + el mapper compartido
 * findingDisplay — mismos números que ya muestra el hero del hijo, aquí condensados.
 * Contrato visual: mockup Variante A (chips Superficie/Precio/$m²/Pie, 4 KPIs).
 */

import type { FullAnalysisResult, AnalisisInput, Hallazgo, Veredicto } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import { readVeredicto } from "@/lib/results-helpers";
import { findingDisplay } from "@/components/analysis/GenericFindingCard";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";

export type ResumenKPI = { label: string; value: string; sub?: string; red?: boolean };
// Top-3 como LÍNEAS con cifra: titular + KPI (destacado) + sub + dirección. La
// cifra sale del MISMO mapper del hero del hijo (findingDisplay) → sin drift.
export type ResumenFinding = { text: string; kpi: string; kpiSub: string; adverso: boolean; kpiRed: boolean };

export interface ResumenAnexoData {
  modalidad: "LTR" | "STR";
  score: number | null;
  veredicto: Veredicto;
  specsSub: string; // físico: "50 m² · 2D/1B · 5 años"
  specsFin: string; // financiero compacto: "UF 4.000 · UF 80,0/m² · pie 20%"
  kpis: ResumenKPI[]; // 4 KPIs (mockup, 2×2)
  findings: ResumenFinding[];
}

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const fmtCLP = (n: number) => CLP.format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const fmtM2 = (n: number) => `${Math.round(n)} m²`;
const fmtUF = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
const fmtUF1 = (n: number) =>
  `UF ${(Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

// Prop-sub físico bajo el título (dorms/baños ya no van en los chips → viven acá).
function buildSpecsSub(superficie: number, dorms: number, banos: number, antiguedad?: number): string {
  const parts: string[] = [];
  if (superficie > 0) parts.push(fmtM2(superficie));
  if (dorms > 0 || banos > 0) parts.push(`${dorms}D/${banos}B`);
  if (typeof antiguedad === "number" && antiguedad > 0) parts.push(`${antiguedad} año${antiguedad === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

// Specs financieros compactos {Precio · $/m² · Pie} en una línea (reemplaza la
// tabla de chips 2×2 → menos alto vertical, sin scroll en laptops; el dato se
// conserva). Superficie/dorms/baños viven en specsSub.
function buildSpecsFin(superficie: number, precioUF: number, piePct?: number): string {
  const parts: string[] = [];
  if (precioUF > 0) parts.push(fmtUF(precioUF));
  if (superficie > 0 && precioUF > 0) parts.push(`${fmtUF1(precioUF / superficie)}/m²`);
  if (typeof piePct === "number" && piePct > 0) parts.push(`pie ${Math.round(piePct)}%`);
  return parts.join(" · ");
}

// KPI desde un hallazgo persistido, vía el mapper del hero (findingDisplay) → cifra
// idéntica a la pirámide/hero. Devuelve null si el hallazgo no está (legacy).
function kpiFromHallazgo(
  hallazgos: Hallazgo[] | undefined,
  id: string,
  label: string,
  ufValue: number,
): ResumenKPI | null {
  const h = hallazgos?.find((x) => x?.id === id);
  if (!h) return null;
  try {
    const d = findingDisplay(h, "CLP", ufValue);
    return { label, value: d.kpi, sub: d.ksub, red: d.kpiRed };
  } catch {
    return null;
  }
}

// Top-3 hallazgos: mismo comparador que gatherTop de los heros (decisividad DESC,
// magnitud DESC). Cada línea trae titular + cifra (KPI + sub) del MISMO mapper que
// usa el hero del hijo (findingDisplay) → bit-consistente. CLP fijo (sin toggle).
function topFindings(hallazgos: Hallazgo[] | undefined, ufValue: number): ResumenFinding[] {
  if (!Array.isArray(hallazgos) || hallazgos.length === 0) return [];
  const seen = new Set<string>();
  const deduped: Hallazgo[] = [];
  for (const h of hallazgos) {
    if (!h || seen.has(h.id)) continue;
    seen.add(h.id);
    deduped.push(h);
  }
  return deduped
    .slice()
    .sort(
      (a, b) =>
        (b.decisividad ?? 0) - (a.decisividad ?? 0) ||
        (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0),
    )
    .slice(0, 3)
    .map((h) => {
      let kpi = "";
      let kpiSub = "";
      let kpiRed = false;
      try {
        const d = findingDisplay(h, "CLP", ufValue);
        kpi = d.kpi;
        kpiSub = d.ksub;
        kpiRed = d.kpiRed;
      } catch {
        /* finding sin display mapeado → línea con titular pero sin cifra */
      }
      return {
        text: (h.titular || h.fraseCanonica || "").trim(),
        kpi,
        kpiSub,
        adverso: h.direccion === "adverso",
        kpiRed,
      };
    })
    .filter((f) => f.text.length > 0);
}

/** LTR (renta larga) — FullAnalysisResult + columnas del análisis. */
export function buildResumenLTR(args: {
  score: number;
  results: FullAnalysisResult | null | undefined;
  inputData: AnalisisInput | undefined;
  ufValue: number;
}): ResumenAnexoData {
  const { score, results, inputData, ufValue } = args;
  const m = results?.metrics;
  const hall = results?.hallazgos;

  const dorms = Number(inputData?.dormitorios) || 0;
  const banos = Number(inputData?.banos) || 0;
  const superficie = Number(inputData?.superficie) || 0;
  const precioUF = Number(inputData?.precio) || 0;
  const piePct = inputData?.piePct != null ? Number(inputData.piePct) : undefined;
  const antiguedad = inputData?.antiguedad != null ? Number(inputData.antiguedad) : undefined;

  // 4 KPIs del mockup: Aporte mensual · CAP rate · TIR 10a · Patrimonio 10a.
  // TIR y Patrimonio viven como hallazgos persistidos (tir/patrimonio); Aporte y
  // CAP rate vía hallazgo con fallback a metrics para robustez legacy.
  const kpis: ResumenKPI[] = [];
  const aporte =
    kpiFromHallazgo(hall, "flujo_mensual", "Aporte mensual", ufValue) ??
    (typeof m?.flujoNetoMensual === "number"
      ? { label: "Aporte mensual", value: fmtCLP(m.flujoNetoMensual), sub: "De tu bolsillo", red: m.flujoNetoMensual < 0 }
      : null);
  if (aporte) kpis.push(aporte);
  const cap =
    kpiFromHallazgo(hall, "cap_rate", "CAP rate", ufValue) ??
    (typeof m?.capRate === "number" ? { label: "CAP rate", value: fmtPct(m.capRate), sub: "Anual sobre precio" } : null);
  if (cap) kpis.push(cap);
  const tir = kpiFromHallazgo(hall, "tir", "TIR a 10 años", ufValue);
  if (tir) kpis.push(tir);
  // Patrimonio: el mockup pone el MULTIPLICADOR como valor (×2,5), no el CLP.
  const patH = hall?.find((x) => x?.id === "patrimonio");
  if (patH && patH.id === "patrimonio" && typeof patH.valor.multiplicador === "number") {
    kpis.push({
      label: "Patrimonio a 10 años",
      value: "×" + (Math.round(patH.valor.multiplicador * 10) / 10).toFixed(1).replace(".", ","),
      sub: "Sobre lo aportado",
    });
  }

  const veredicto: Veredicto =
    readVeredicto(results) ||
    (score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");

  return {
    modalidad: "LTR",
    score,
    veredicto,
    specsSub: buildSpecsSub(superficie, dorms, banos, antiguedad),
    specsFin: buildSpecsFin(superficie, precioUF, piePct),
    kpis,
    findings: topFindings(hall, ufValue),
  };
}

/** STR (renta corta) — ShortTermResult + input_data crudo. */
export function buildResumenSTR(args: {
  results: (ShortTermResult & { francoScore?: { score?: number; veredicto?: string } }) | null | undefined;
  inputData: Record<string, unknown> | null | undefined;
  ufValue: number;
}): ResumenAnexoData {
  const { results, inputData, ufValue } = args;

  const dorms = Number(inputData?.dormitorios) || 0;
  const banos = Number(inputData?.banos) || 0;
  const superficie = Number(inputData?.superficieUtil) || 0;
  const precioUF = Number(inputData?.precioCompraUF) || (ufValue > 0 ? (Number(inputData?.precioCompra) || 0) / ufValue : 0);
  const piePct = inputData?.piePct != null ? Number(inputData.piePct) : undefined;
  const antiguedad = inputData?.antiguedad != null ? Number(inputData.antiguedad) : undefined;

  // 4 KPIs STR (paralelo al set LTR del mockup, que solo define LTR): Ingreso bruto ·
  // Ocupación · Flujo mensual · CAP rate — del escenario base persistido.
  const base = results?.escenarios?.base;
  const kpis: ResumenKPI[] = [];
  if (base && typeof base.ingresoBrutoMensual === "number") {
    kpis.push({ label: "Ingreso bruto", value: fmtCLP(base.ingresoBrutoMensual), sub: "Mensual, escenario base" });
  }
  if (base && typeof base.ocupacionReferencia === "number") {
    const occ = base.ocupacionReferencia <= 1 ? base.ocupacionReferencia * 100 : base.ocupacionReferencia;
    kpis.push({ label: "Ocupación", value: fmtPct(occ), sub: "Referencia de zona" });
  }
  if (base && typeof base.flujoCajaMensual === "number") {
    kpis.push({
      label: "Flujo mensual",
      value: fmtCLP(base.flujoCajaMensual),
      sub: "Neto, escenario base",
      red: base.flujoCajaMensual < 0,
    });
  }
  if (base && typeof base.capRate === "number") {
    kpis.push({ label: "CAP rate", value: fmtPct(base.capRate), sub: "Anual sobre precio" });
  }

  const score = results?.francoScore?.score ?? null;
  const veredicto: Veredicto =
    (normalizeLegacyVerdict(results?.francoScore?.veredicto) ??
      normalizeLegacyVerdict(results?.veredicto) ??
      "BUSCAR OTRA") as Veredicto;

  return {
    modalidad: "STR",
    score,
    veredicto,
    specsSub: buildSpecsSub(superficie, dorms, banos, antiguedad),
    specsFin: buildSpecsFin(superficie, precioUF, piePct),
    kpis,
    findings: topFindings(results?.hallazgos, ufValue),
  };
}
