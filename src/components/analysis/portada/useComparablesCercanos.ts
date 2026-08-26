"use client";

// Fetch de comparables de venta cercanos para el mapa de portada (FASE 3).
// EXTRAÍDO del HeroLTR (mismo endpoint y forma que el wizard) para que la
// portada lo use en LTR y STR sin duplicar; el hero pierde el mapa (decisión 7:
// el mapa vive en la portada, solo desktop).

import { useEffect, useState } from "react";
import type { Comparable } from "@/components/formulario-v3/MapaThumbnail";

export function useComparablesCercanos(p: {
  comuna: string;
  superficie: number;
  dormitorios: number | null | undefined;
  lat: number | null;
  lng: number | null;
}): { comparables: Comparable[]; count: number } {
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [count, setCount] = useState(0);
  const { comuna, superficie, dormitorios, lat, lng } = p;

  useEffect(() => {
    if (!comuna || lat === null || lng === null) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      comuna,
      superficie: String(superficie > 0 ? superficie : 50),
      dormitorios: String(dormitorios ?? 2),
      lat: String(lat),
      lng: String(lng),
      type: "venta",
    });
    fetch(`/api/data/suggestions?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const np: unknown = d.nearbyProperties;
        const list = Array.isArray(np) ? np : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setComparables(list.map((x: any) => ({ lat: x?.lat ?? null, lng: x?.lng ?? null })));
        setCount(
          typeof d.totalInRadius === "number"
            ? d.totalInRadius
            : typeof d.filteredInRadius === "number"
              ? d.filteredInRadius
              : list.length,
        );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [comuna, superficie, dormitorios, lat, lng]);

  return { comparables, count };
}
