"use client";

import { useEffect, useState } from "react";
import type { AirbnbEstimateResponse } from "@/lib/airbnb/types";

export interface AirRoiSuggestion {
  /** Ingreso bruto mensual estimado en CLP (annual / 12). */
  ingresoBrutoMensual: number;
  /** N comparables Airbnb usados en la estimación (0 si AirROI usó calculator_direct). */
  sampleSize: number;
  /** "comparables" → sample real; "calculator_direct" → estimación directa AirROI sin comparables. */
  source: "comparables" | "calculator_direct" | null;
  isLoading: boolean;
  /** Mensaje de error human-friendly cuando el fetch falla. */
  error: string | null;
}

const EMPTY: AirRoiSuggestion = {
  ingresoBrutoMensual: 0,
  sampleSize: 0,
  source: null,
  isLoading: false,
  error: null,
};

/**
 * Prefetch de estimación AirROI para el wizard v3 cuando modalidad ∈ {str, both}.
 *
 * El endpoint `/api/airbnb/estimate` ya tiene cache server-side de 90 días en
 * tabla `airbnb_estimates` (key: address|bedrooms|baths|guests). No replicamos
 * cache cliente — el endpoint maneja la dedupe + costo AirROI ($0.30/call).
 *
 * AirROI puede devolver dos shapes:
 *   - "comparables" (median_annual_revenue + sampleSize real)
 *   - "calculator_direct" (estimated_annual_revenue, sampleSize=0)
 *
 * Conversión a CLP: AirROI típicamente devuelve USD; usamos `ufClp` solo
 * cuando `currency !== "CLP"` (calculator_direct trae el campo currency).
 * Para comparables asumimos USD por convención.
 */
export function useAirRoiSuggestion(params: {
  enabled: boolean;
  direccion: string;
  dormitorios: number;
  banos: number;
  capacidadHuespedes: number;
  ufClp: number;
}): AirRoiSuggestion {
  const { enabled, direccion, dormitorios, banos, capacidadHuespedes, ufClp } = params;

  const [state, setState] = useState<AirRoiSuggestion>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    // Validación mínima: necesita address con texto, dormitorios/baños/huéspedes
    // numéricos válidos. AirROI rechaza con 400 si no.
    if (!direccion || direccion.trim().length === 0) {
      setState(EMPTY);
      return;
    }
    if (!Number.isFinite(banos) || banos < 1) return;
    if (!Number.isFinite(capacidadHuespedes) || capacidadHuespedes < 1) return;
    if (!Number.isFinite(ufClp) || ufClp <= 0) return;

    const ctrl = new AbortController();
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetch("/api/airbnb/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: direccion.trim(),
        bedrooms: dormitorios,
        baths: banos,
        guests: capacidadHuespedes,
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as AirbnbEstimateResponse;
        if (!json.success) {
          setState({ ...EMPTY, error: json.message || "Error al consultar AirROI" });
          return;
        }
        const isDirect = json.source === "calculator_direct";
        const data = json.data;

        // Currency: calculator_direct trae `currency` explícito. Comparables
        // asume USD por convención (mismo handling que short-term/route.ts:119).
        const currency = isDirect && "currency" in data
          ? (data.currency || "USD")
          : "USD";
        const annualRevRaw = isDirect && "estimated_annual_revenue" in data
          ? data.estimated_annual_revenue
          : "median_annual_revenue" in data
            ? data.median_annual_revenue
            : 0;
        const annualRevCLP = currency === "CLP"
          ? annualRevRaw
          : Math.round(annualRevRaw * ufClp);
        const ingresoBrutoMensual = Math.round(annualRevCLP / 12);

        const sampleSize = isDirect ? 0 : ("comparables_count" in data ? data.comparables_count : 0);

        setState({
          ingresoBrutoMensual,
          sampleSize,
          source: isDirect ? "calculator_direct" : "comparables",
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({
          ...EMPTY,
          error: err instanceof Error ? err.message : "Error al consultar AirROI",
        });
      });

    return () => ctrl.abort();
    // ufClp incluido: si cambia mid-flight, recomponer con la nueva tasa
  }, [enabled, direccion, dormitorios, banos, capacidadHuespedes, ufClp]);

  return state;
}
