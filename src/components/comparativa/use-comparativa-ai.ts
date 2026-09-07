"use client";

import { useCallback, useEffect, useState } from "react";
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
): {
  ai: AIAnalysisComparativa | null;
  loading: boolean;
  error: string | null;
  /** Goal F3-c: re-disparo manual tras agotar los reintentos automáticos. */
  reintentar: () => void;
} {
  const [ai, setAi] = useState<AIAnalysisComparativa | null>(cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bump manual: cambia la identidad del effect y relanza la cadena de intentos.
  const [intentoManual, setIntentoManual] = useState(0);

  const reintentar = useCallback(() => {
    setError(null);
    setIntentoManual((n) => n + 1);
  }, []);

  useEffect(() => {
    if (ai) return; // ya hay prosa (cache fresca server-side)
    if (!canGenerate) return; // share/print: no regenera
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Goal F (adelanto autorizado, independiente del ciclo del hero AMBAS): el
    // error dejó de ser terminal — reintento AUTOMÁTICO dentro del hook (hasta
    // 2, con backoff), sin cambios en ningún consumidor. La generación es corta
    // (P50 11,1s medido en pipeline_timing), así que un fallo suele ser red
    // transitoria y el reintento la cubre; recién el tercer fallo declara error
    // — y ahí el hero ofrece Reintentar (Goal F3-c), que relanza la cadena.
    const MAX_INTENTOS = 3;
    const BACKOFF_MS = [0, 4000, 8000];
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Goal #3: 409 { generando: true } = otro proceso tiene el candado del par. No
    // consume intentos de error: se vuelve a pedir cada 8 s, hasta ~4 min.
    let esperas409 = 0;

    const intentar = (intento: number) => {
      fetch("/api/analisis/comparativa/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ltrId, strId }),
      })
        .then(async (res) => {
          if (res.status === 409) {
            if (cancelled) return null;
            if (esperas409 < 30) {
              esperas409 += 1;
              timer = setTimeout(() => intentar(intento), 8000);
              return null;
            }
            throw new Error("La narrativa se está generando; vuelve a intentar en un momento.");
          }
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || `HTTP ${res.status}`);
          }
          return res.json() as Promise<AIAnalysisComparativa>;
        })
        .then((data) => {
          if (!data) return; // 409: ya quedó reagendado
          if (!cancelled) {
            setAi(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (intento + 1 < MAX_INTENTOS) {
            timer = setTimeout(() => intentar(intento + 1), BACKOFF_MS[intento + 1]);
            return;
          }
          setError(err.message || "Error generando análisis");
          setLoading(false);
        });
    };

    intentar(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ai, ltrId, strId, canGenerate, intentoManual]);

  return { ai, loading, error, reintentar };
}
