"use client";

// Capa de datos del wizard v4: UF del día, tasa hipotecaria de mercado y
// comparables de la zona (para el conteo real de la reacción de `dir` y el mapa).
// Reusa los endpoints existentes de v3. NO consume crédito ni persiste nada.

import { useEffect, useRef, useState } from "react";
import type { Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { useAirRoiSuggestion, type AirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";
import type { WizardV4Answers } from "./wizardV4Nodes";

const UF_FALLBACK = 38800;
const TASA_FALLBACK = 4.72;

export interface WizardV4Data {
  ufCLP: number;
  tasaMercado: number;
  comparablesCount: number;
  comparables: Comparable[];
  suggestionsLoading: boolean;
  /** Arriendo mediana estimado (CLP/mes) de la zona, o null. */
  arriendoSugerido: number | null;
  /** N de arriendos comparables usados en la mediana. */
  arriendoN: number;
  /** GGCC típico estimado (CLP/mes) de la zona, o null. */
  ggccSugerido: number | null;
  /** UF/m² de venta de la zona (para valorMercadoFranco y aviso de subsidio). */
  precioM2UF: number | null;
  /** Radio (m) usado por el RPC de sugerencias. */
  radiusUsed: number | null;
  /** Baseline AirROI (tarifa/ocupación) — solo activo en str/both. */
  airRoi: AirRoiSuggestion;
}

export function useWizardV4Data(answers: WizardV4Answers): WizardV4Data {
  const [ufCLP, setUfCLP] = useState(UF_FALLBACK);
  const [tasaMercado, setTasaMercado] = useState(TASA_FALLBACK);
  const [comparablesCount, setComparablesCount] = useState(0);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [arriendoSugerido, setArriendoSugerido] = useState<number | null>(null);
  const [arriendoN, setArriendoN] = useState(0);
  const [ggccSugerido, setGgccSugerido] = useState<number | null>(null);
  const [precioM2UF, setPrecioM2UF] = useState<number | null>(null);
  const [radiusUsed, setRadiusUsed] = useState<number | null>(null);

  // UF del día + tasa de mercado (una vez).
  useEffect(() => {
    // Fix respecto a v3: /api/uf devuelve { uf } (v3 leía d.value → no-op).
    fetch("/api/uf")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const uf = Number(d?.uf);
        if (Number.isFinite(uf) && uf > 0) setUfCLP(uf);
      })
      .catch(() => { /* fallback */ });
    fetch("/api/config?key=tasa_hipotecaria")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = Number(d?.value);
        if (Number.isFinite(t) && t > 0) setTasaMercado(t);
      })
      .catch(() => { /* fallback */ });
  }, []);

  // Comparables de la zona: se disparan al confirmar dirección (lat/lng + comuna).
  // Debounced para no pegarle al endpoint en cada tecla de superficie.
  const lat = answers.lat ?? null;
  const lng = answers.lng ?? null;
  const comuna = answers.comuna ?? "";
  const superficie = answers.superficieUtil ?? "";
  const dormitorios = answers.dormitorios ?? "";
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!lat || !lng || !comuna) {
      setComparablesCount(0);
      setComparables([]);
      return;
    }
    const seq = ++reqSeq.current;
    setSuggestionsLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        comuna,
        superficie: String(parseFloat(superficie.replace(",", ".")) || 50),
        dormitorios: String(parseInt(dormitorios, 10) || 2),
        lat: String(lat),
        lng: String(lng),
        type: "arriendo",
      });
      fetch(`/api/data/suggestions?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (seq !== reqSeq.current) return; // respuesta obsoleta
          const count = d?.sampleSize ?? d?.totalInRadius ?? 0;
          setComparablesCount(Number(count) || 0);
          setComparables(Array.isArray(d?.nearbyProperties) ? d.nearbyProperties : []);
          setArriendoSugerido(typeof d?.arriendo === "number" ? d.arriendo : null);
          setArriendoN(Number(d?.sampleSize) || 0);
          setGgccSugerido(typeof d?.ggcc === "number" ? d.ggcc : null);
          setPrecioM2UF(typeof d?.precioM2UF === "number" ? d.precioM2UF : null);
          setRadiusUsed(typeof d?.radiusUsed === "number" ? d.radiusUsed : null);
        })
        .catch(() => {
          if (seq !== reqSeq.current) return;
          setComparablesCount(0);
          setComparables([]);
          setArriendoSugerido(null);
          setArriendoN(0);
          setGgccSugerido(null);
          setPrecioM2UF(null);
          setRadiusUsed(null);
        })
        .finally(() => {
          if (seq === reqSeq.current) setSuggestionsLoading(false);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [lat, lng, comuna, superficie, dormitorios]);

  // Baseline AirROI — no-op salvo modalidad str/both (evita el costo del fetch
  // en LTR puro). capacidadHuespedes se aproxima desde dormitorios cuando no se
  // pide explícito (2 por dorm, mínimo 2).
  const dorm = Number(answers.dormitorios) || 2;
  const airRoi = useAirRoiSuggestion({
    enabled: answers.modalidad === "str" || answers.modalidad === "both",
    direccion: answers.direccion ?? "",
    comuna: answers.comuna ?? "",
    dormitorios: dorm,
    banos: Number(answers.banos) || 1,
    capacidadHuespedes: Math.max(2, dorm * 2),
    ufClp: ufCLP,
  });

  return {
    ufCLP,
    tasaMercado,
    comparablesCount,
    comparables,
    suggestionsLoading,
    arriendoSugerido,
    arriendoN,
    ggccSugerido,
    precioM2UF,
    radiusUsed,
    airRoi,
  };
}
