"use client";

// Fetch de comparables de venta cercanos para el mapa de portada (FASE 3).
// EXTRAÍDO del HeroLTR (mismo endpoint y forma que el wizard) para que la
// portada lo use en LTR y STR sin duplicar; el hero pierde el mapa (decisión 7:
// el mapa vive en la portada, solo desktop).
//
// 28-sep-2026: el mapa dibujaba y contaba `nearbyProperties` —toda la venta del radio, sin
// filtro de tipología ni superficie— y no la muestra detrás del precio de referencia. Ahora
// entrega `comparables` (las filas de la muestra del radio, las que cuentan `sampleSize`),
// `contexto` (el resto del radio) y el radio; la leyenda del mapa cuenta la lista que dibuja.
// La consulta va en el universo del depto (`condicion`), como en el wizard.

import { useEffect, useState } from "react";
import type { Comparable } from "@/components/formulario-v3/MapaThumbnail";

export type CondicionVenta = "nuevo" | "usado" | null;

/** El universo de venta de una fila del informe: LTR guarda `esNuevo`, STR `tipoPropiedad`. */
export function condicionDeInput(inputData: Record<string, unknown> | null | undefined): CondicionVenta {
  if (!inputData) return null;
  if (inputData.esNuevo === true || inputData.tipoPropiedad === "nuevo") return "nuevo";
  if (inputData.esNuevo === false || inputData.tipoPropiedad === "usado") return "usado";
  return null;
}

export interface ComparablesCercanos {
  /** La muestra de venta del radio (misma tipología, superficie ±30%, sin extremos), con coordenadas. */
  comparables: Comparable[];
  /** El resto de la oferta del radio, sin esas filas: contexto en gris tenue. */
  contexto: Comparable[];
  /** El radio (m) al que se juntó la muestra, o null si no hubo muestra de radio. */
  radioM: number | null;
}

const aPunto = (x: unknown): Comparable => {
  const p = (x ?? {}) as { lat?: unknown; lng?: unknown };
  return { lat: typeof p.lat === "number" ? p.lat : null, lng: typeof p.lng === "number" ? p.lng : null };
};

export function useComparablesCercanos(p: {
  comuna: string;
  superficie: number;
  dormitorios: number | null | undefined;
  lat: number | null;
  lng: number | null;
  condicion?: CondicionVenta;
}): ComparablesCercanos {
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [contexto, setContexto] = useState<Comparable[]>([]);
  const [radioM, setRadioM] = useState<number | null>(null);
  const { comuna, superficie, dormitorios, lat, lng, condicion } = p;

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
      ...(condicion ? { condicion } : {}),
    });
    fetch(`/api/data/suggestions?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const radio = d.source === "radio";
        setComparables(radio && Array.isArray(d.comparables) ? d.comparables.map(aPunto) : []);
        setContexto(radio && Array.isArray(d.restoRadio) ? d.restoRadio.map(aPunto) : []);
        setRadioM(radio && typeof d.radiusUsed === "number" ? d.radiusUsed : null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [comuna, superficie, dormitorios, lat, lng, condicion]);

  return { comparables, contexto, radioM };
}
