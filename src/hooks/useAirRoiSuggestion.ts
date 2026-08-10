"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AirbnbEstimateResponse } from "@/lib/airbnb/types";

export interface AirRoiSuggestion {
  /** Ingreso bruto mensual estimado en CLP (annual / 12). */
  ingresoBrutoMensual: number;
  /** Ocupación de referencia 0-1 (0.42 = 42%). De `median_occupancy` o `estimated_occupancy`. */
  ocupacionReferencia: number;
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
  ocupacionReferencia: 0,
  sampleSize: 0,
  source: null,
  isLoading: false,
  error: null,
};

/**
 * Lo que llega de AirROI SIN convertir a CLP. Se guarda crudo a propósito: la
 * conversión depende de la UF, y la UF no puede costar una llamada nueva.
 */
interface RespuestaCruda {
  annualRevenue: number;
  currency: string;
  ocupacionReferencia: number;
  sampleSize: number;
  source: "comparables" | "calculator_direct";
}

/**
 * Ventana de espera antes de consultar AirROI, en ms.
 *
 * El hook hermano (comparables de arriendo, useWizardV4Data) usa 400 ms, pero
 * ahí cada disparo cuesta una query a nuestra propia base. Acá cada disparo que
 * no pegue en cache es una llamada facturada a un tercero, así que la ventana se
 * dimensiona por el GESTO del usuario y no por la latencia percibida:
 *
 *   · subir dormitorios de 1 a 4 con el stepper son ~3 clicks en menos de un
 *     segundo. Con 400 ms eso se parte en dos o tres llamadas; con 1.200 ms
 *     queda una sola;
 *   · escribir "Providencia 1500" y corregir el número al final entra en la
 *     misma ventana;
 *   · 1.200 ms sigue siendo imperceptible para un dato que se muestra como
 *     estimación de apoyo y no bloquea el avance del wizard.
 *
 * Medido antes del cambio: 1.000 llamadas en 30 días para 52 análisis STR
 * (19,2 por informe). El objetivo de esta ventana es el tramo de exploración,
 * que es donde estaba el 95% del gasto.
 */
const DEBOUNCE_MS = 1200;

/**
 * Prefetch de estimación AirROI para el wizard cuando modalidad ∈ {str, both}.
 *
 * El endpoint `/api/airbnb/estimate` tiene cache server-side de 90 días en
 * `airbnb_estimates` (key: address|comuna|bedrooms|baths|guests). No replicamos
 * cache cliente — el endpoint maneja la dedupe + el costo AirROI (USD 0,30/call).
 *
 * AirROI puede devolver dos shapes:
 *   - "comparables" (median_annual_revenue + sampleSize real)
 *   - "calculator_direct" (estimated_annual_revenue, sampleSize=0)
 */
export function useAirRoiSuggestion(params: {
  enabled: boolean;
  direccion: string;
  comuna: string;
  dormitorios: number;
  banos: number;
  capacidadHuespedes: number;
  ufClp: number;
}): AirRoiSuggestion {
  const { enabled, direccion, comuna, dormitorios, banos, capacidadHuespedes, ufClp } = params;

  const [cruda, setCruda] = useState<RespuestaCruda | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La CLAVE de cache del servidor, replicada acá como string. El efecto depende
  // de esto y no de los seis campos sueltos, y esa es la mitad del arreglo:
  //
  // `capacidadHuespedes` se deriva de `dormitorios` (max(2, dorm*2)) en el
  // caller, así que tocar dormitorios movía DOS dependencias. Con la clave
  // serializada, ese cambio produce una clave nueva —una— en vez de disparar por
  // cada dependencia que se movió.
  //
  // `ufClp` NO entra: no viaja al servidor ni forma parte del hash, solo
  // convierte moneda al leer. Estaba en las dependencias del efecto viejo, así
  // que un refresco de la UF re-pagaba la estimación entera para hacer una
  // multiplicación. Ahora la conversión vive en el useMemo de abajo.
  const claveCache = `${direccion.trim()}|${comuna.trim()}|${dormitorios}|${banos}|${capacidadHuespedes}`;

  // Evita re-consultar la misma clave si el efecto se vuelve a montar (StrictMode,
  // navegación entre pasos del wizard). El cache del servidor lo cubriría igual,
  // pero un HIT también cuesta un round-trip.
  const ultimaClave = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCruda(null);
      setCargando(false);
      setError(null);
      return;
    }
    // Validación mínima: necesita address con texto, dormitorios/baños/huéspedes
    // numéricos válidos. AirROI rechaza con 400 si no.
    if (!direccion || direccion.trim().length === 0) {
      setCruda(null);
      setCargando(false);
      setError(null);
      return;
    }
    if (!Number.isFinite(banos) || banos < 1) return;
    if (!Number.isFinite(capacidadHuespedes) || capacidadHuespedes < 1) return;
    if (claveCache === ultimaClave.current) return;

    const ctrl = new AbortController();
    setCargando(true);
    setError(null);

    // El debounce es lo que de verdad ahorra. El AbortController de abajo cancela
    // la respuesta en el browser, pero si la request ya salió el servidor YA llamó
    // a AirROI y el cobro ya ocurrió: abortar no devuelve la plata. Por eso la
    // llamada tiene que no haber salido todavía.
    const timer = setTimeout(() => {
      ultimaClave.current = claveCache;
      fetch("/api/airbnb/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: direccion.trim(),
          // La comuna entra a NUESTRA cache key (desambiguación F1 de homónimos),
          // NO se envía a AirROI. Mandarla aquí alinea la key del prefetch con la
          // de la creación (short-term/route.ts manda body.comuna) → mismo hash →
          // la creación es cache HIT y no se paga AirROI dos veces por el análisis.
          comuna: comuna.trim(),
          bedrooms: dormitorios,
          baths: banos,
          guests: capacidadHuespedes,
          origen: "wizard",
        }),
        signal: ctrl.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as AirbnbEstimateResponse;
          if (!json.success) {
            setCruda(null);
            setCargando(false);
            setError(json.message || "Error al consultar AirROI");
            return;
          }
          const isDirect = json.source === "calculator_direct";
          const data = json.data;

          // Currency: calculator_direct trae `currency` explícito. Comparables
          // asume USD por convención (mismo handling que short-term/route.ts:119).
          const currency = isDirect && "currency" in data
            ? (data.currency || "USD")
            : "USD";
          const annualRevenue = isDirect && "estimated_annual_revenue" in data
            ? data.estimated_annual_revenue
            : "median_annual_revenue" in data
              ? data.median_annual_revenue
              : 0;

          // Ocupación de referencia (0-1). Endpoint la devuelve en
          // `estimated_occupancy` (calculator_direct) o `median_occupancy`
          // (comparables). El motor STR usa este número en escenario base.
          const ocupacionReferencia = isDirect && "estimated_occupancy" in data
            ? data.estimated_occupancy
            : "median_occupancy" in data
              ? data.median_occupancy
              : 0;

          setCruda({
            annualRevenue,
            currency,
            ocupacionReferencia,
            sampleSize: isDirect ? 0 : ("comparables_count" in data ? data.comparables_count : 0),
            source: isDirect ? "calculator_direct" : "comparables",
          });
          setCargando(false);
          setError(null);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          // La clave no quedó resuelta: que un reintento pueda volver a pedirla.
          ultimaClave.current = null;
          setCruda(null);
          setCargando(false);
          setError(err instanceof Error ? err.message : "Error al consultar AirROI");
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [enabled, direccion, comuna, dormitorios, banos, capacidadHuespedes, claveCache]);

  // Conversión a CLP fuera del fetch: cambiar la UF recalcula sin volver a pagar.
  return useMemo(() => {
    if (!cruda) return { ...EMPTY, isLoading: cargando, error };
    const annualCLP = cruda.currency === "CLP"
      ? cruda.annualRevenue
      : Math.round(cruda.annualRevenue * ufClp);
    return {
      ingresoBrutoMensual: Math.round(annualCLP / 12),
      ocupacionReferencia: cruda.ocupacionReferencia,
      sampleSize: cruda.sampleSize,
      source: cruda.source,
      isLoading: cargando,
      error,
    };
  }, [cruda, ufClp, cargando, error]);
}
