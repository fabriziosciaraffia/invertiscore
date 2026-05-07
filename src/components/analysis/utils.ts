// Helpers compartidos extraídos de results-client.tsx LTR para reuso entre LTR
// y los próximos componentes de results STR (Ronda 4c). No cambian comportamiento
// — son moves verbatim.

import type { AnalysisMetrics } from "@/lib/types";

/**
 * Compatibilidad con análisis guardados con nombres viejos (yieldBruto, yieldNeto).
 * Sin esto, métricas legacy disparan NaN en cliente. Ver audit/sesionB-bug-nan/.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMetrics(metrics: any): AnalysisMetrics | null {
  if (!metrics) return null;
  return {
    ...metrics,
    rentabilidadBruta: metrics.rentabilidadBruta ?? metrics.yieldBruto ?? 0,
    rentabilidadNeta: metrics.rentabilidadNeta ?? metrics.yieldNeto ?? 0,
    capRate: metrics.capRate ?? 0,
    cashOnCash: metrics.cashOnCash ?? 0,
    precioM2: metrics.precioM2 ?? 0,
    mesesPaybackPie: metrics.mesesPaybackPie ?? 999,
    dividendo: metrics.dividendo ?? 0,
    flujoNetoMensual: metrics.flujoNetoMensual ?? 0,
    noi: metrics.noi ?? 0,
    pieCLP: metrics.pieCLP ?? 0,
    precioCLP: metrics.precioCLP ?? 0,
    ingresoMensual: metrics.ingresoMensual ?? 0,
    egresosMensuales: metrics.egresosMensuales ?? 0,
    valorMercadoFrancoUF: metrics.valorMercadoFrancoUF ?? metrics.valorMercadoUF ?? 0,
    valorMercadoUsuarioUF: metrics.valorMercadoUsuarioUF ?? metrics.valorMercadoUF ?? 0,
    plusvaliaInmediataFranco: metrics.plusvaliaInmediataFranco ?? metrics.plusvaliaInmediata ?? 0,
    plusvaliaInmediataFrancoPct: metrics.plusvaliaInmediataFrancoPct ?? metrics.plusvaliaInmediataPct ?? 0,
    plusvaliaInmediataUsuario: metrics.plusvaliaInmediataUsuario ?? metrics.plusvaliaInmediata ?? 0,
    plusvaliaInmediataUsuarioPct: metrics.plusvaliaInmediataUsuarioPct ?? metrics.plusvaliaInmediataPct ?? 0,
    precioFlujoNeutroCLP: metrics.precioFlujoNeutroCLP ?? 0,
    precioFlujoNeutroUF: metrics.precioFlujoNeutroUF ?? 0,
    precioFlujoPositivoCLP: metrics.precioFlujoPositivoCLP ?? 0,
    precioFlujoPositivoUF: metrics.precioFlujoPositivoUF ?? 0,
    descuentoParaNeutro: metrics.descuentoParaNeutro ?? 0,
  };
}

export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fmtUF(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) {
    return "UF " + Math.round(rounded).toLocaleString("es-CL");
  }
  const [int, dec] = rounded.toFixed(1).split(".");
  return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
}

export function fmtMoney(n: number, currency: "CLP" | "UF", ufClp: number): string {
  if (currency === "UF") return fmtUF(n / ufClp);
  return fmtCLP(n);
}

export function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000).toLocaleString("es-CL") + "K";
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fmtAxisMoney(n: number, currency: "CLP" | "UF", ufClp: number): string {
  if (currency === "UF") {
    const uf = n / ufClp;
    if (Math.abs(uf) >= 1_000) return "UF " + (uf / 1_000).toFixed(0) + "K";
    if (Math.abs(uf) >= 100) return "UF " + Math.round(uf);
    if (Math.abs(uf) >= 1) return "UF " + uf.toFixed(1).replace(".", ",");
    return "UF " + uf.toFixed(2).replace(".", ",");
  }
  return fmtM(n);
}

export function fmtPct(n: number, decimals: number = 1): string {
  return n.toFixed(decimals).replace(".", ",") + "%";
}

/** Parse UF string ("UF 4.664" / "UF 3,200") → numeric value in UF. */
export function parseUFString(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.match(/[\d.,]+/);
  if (!m) return 0;
  const clean = m[0].replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}
