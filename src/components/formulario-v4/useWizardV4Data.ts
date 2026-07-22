"use client";

// Capa de datos del wizard v4: UF del día, tasa hipotecaria de mercado y
// comparables de la zona (para el conteo real de la reacción de `dir` y el mapa).
// Reusa los endpoints existentes de v3. NO consume crédito ni persiste nada.

import { useEffect, useRef, useState } from "react";
import type { Comparable } from "@/components/formulario-v3/MapaThumbnail";
import type { WizardV4Answers } from "./wizardV4Nodes";

const UF_FALLBACK = 38800;
const TASA_FALLBACK = 4.72;

export interface WizardV4Data {
  ufCLP: number;
  tasaMercado: number;
  comparablesCount: number;
  comparables: Comparable[];
  suggestionsLoading: boolean;
}

export function useWizardV4Data(answers: WizardV4Answers): WizardV4Data {
  const [ufCLP, setUfCLP] = useState(UF_FALLBACK);
  const [tasaMercado, setTasaMercado] = useState(TASA_FALLBACK);
  const [comparablesCount, setComparablesCount] = useState(0);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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
        })
        .catch(() => {
          if (seq !== reqSeq.current) return;
          setComparablesCount(0);
          setComparables([]);
        })
        .finally(() => {
          if (seq === reqSeq.current) setSuggestionsLoading(false);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [lat, lng, comuna, superficie, dormitorios]);

  return { ufCLP, tasaMercado, comparablesCount, comparables, suggestionsLoading };
}
