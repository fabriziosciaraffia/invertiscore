"use client";

import { useEffect, useState } from "react";
import type { AIAnalysisComparativa } from "@/lib/types";

// ─── Datos de la prosa comparativa (Fase C) ──────────────────────────────────
// Extraído de NarrativaIAComparativa (que murió al integrarse la prosa al hero).
// La prosa ahora se renderiza DENTRO del hero; este hook le da { ai, loading }.
//
// `canGenerate`: true en la página del owner (si el cache está vacío/viejo, hace
// fetch → el endpoint regenera y persiste = lazy-on-open). false en el share/print
// (público, sin auth): usa lo persistido tal cual y NUNCA dispara el fetch.
export function useComparativaAI(
  ltrId: string,
  strId: string,
  cached: AIAnalysisComparativa | null,
  canGenerate: boolean,
): { ai: AIAnalysisComparativa | null; loading: boolean; error: string | null } {
  const [ai, setAi] = useState<AIAnalysisComparativa | null>(cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ai) return; // ya hay prosa (cache fresca server-side)
    if (!canGenerate) return; // share/print: no regenera
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/analisis/comparativa/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ltrId, strId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<AIAnalysisComparativa>;
      })
      .then((data) => {
        if (!cancelled) {
          setAi(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Error generando análisis");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ai, ltrId, strId, canGenerate]);

  return { ai, loading, error };
}
