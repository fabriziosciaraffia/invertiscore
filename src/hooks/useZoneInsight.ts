"use client";

import { useEffect, useState } from "react";

export interface ZonePOI {
  nombre: string;
  distancia: number;
  lat: number;
  lng: number;
  linea?: string;
  comuna?: string;
}

export interface ZoneInsightData {
  stats: {
    plusvaliaHistorica: { valor: number; anualizada: number; promedioSantiago: number };
    precioM2: { tuDepto: number; medianaComuna: number; diffPct: number } | null;
    ofertaComparable: {
      totalDeptos: number;
      rangoArriendoMin: number;
      rangoArriendoMax: number;
      percentilTuDepto: number;
      precision: "exacta" | "superficie_amplia" | "dormitorios_flexibles" | "comuna_general";
    } | null;
  };
  pois: {
    metro: ZonePOI[];
    clinicas: ZonePOI[];
    universidades: ZonePOI[];
    institutos: ZonePOI[];
    colegios: ZonePOI[];
    parques: ZonePOI[];
    malls: ZonePOI[];
    negocios: ZonePOI[];
    trenes: ZonePOI[];
  };
  insight: {
    headline_clp: string;
    headline_uf: string;
    preview_clp: string;
    preview_uf: string;
    narrative_clp: string;
    narrative_uf: string;
    // Fase 5 backend: persistido en cache. Caches v1 lo reciben backfilled como "".
    accion?: string;
  };
  valorUF?: number;
}

export function useZoneInsight(analysisId: string | undefined | null, enabled = true) {
  const [data, setData] = useState<ZoneInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !analysisId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analisis/${analysisId}/zone-insight`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ZoneInsightData | { error: string }) => {
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
