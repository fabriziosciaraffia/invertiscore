"use client";

import { useEffect, useState } from "react";
import type { GuestInsightResponse } from "@/app/api/analisis/short-term/[id]/guest-insight/route";

/**
 * Hook lazy para Guest Insight STR. Paridad con useZoneInsight LTR.
 *
 * Dispara GET `/api/analisis/short-term/[id]/guest-insight` cuando el drawer
 * se abre por primera vez. Cache hit en backend (column `guest_insight`) hace
 * que llamadas subsecuentes sean instantáneas.
 */
export function useGuestInsight(analysisId: string | undefined | null, enabled = true) {
  const [data, setData] = useState<GuestInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !analysisId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analisis/short-term/${analysisId}/guest-insight`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: GuestInsightResponse | { error: string }) => {
        if (cancelled) return;
        if ("error" in json) {
          setError(json.error);
        } else {
          setData(json);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error de conexión");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisId, enabled]);

  return { data, loading, error };
}
