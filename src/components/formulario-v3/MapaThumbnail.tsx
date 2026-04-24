"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { francoMapStaticStyleParams, type FrancoMapTheme } from "@/lib/map-styles";

/**
 * Input "crudo" — lat/lng pueden venir null cuando el backend no geolocalizó
 * la propiedad (pasa en ~85% de las filas de market_stats). Se filtran adentro
 * del componente antes de construir la URL de Static Maps.
 */
export interface Comparable {
  lat: number | null;
  lng: number | null;
}

/**
 * Validación estricta antes de coercionar con Number():
 *  - rechaza null/undefined
 *  - rechaza strings no numéricos
 *  - rechaza NaN
 *  - rechaza el sentinela (0, 0) que se generaba por el bug Number(null) === 0
 *  - acota a rangos geográficos válidos (lat ±90, lng ±180)
 *
 * El chequeo contra 0 es el más importante: Number(null) devuelve 0 (no NaN)
 * y Number.isFinite(0) es true, así que un filter basado solo en isFinite
 * deja pasar las coords nulas como punto en el Golfo de Guinea.
 */
function validCoord(rawLat: unknown, rawLng: unknown): { lat: number; lng: number } | null {
  if (rawLat === null || rawLat === undefined) return null;
  if (rawLng === null || rawLng === undefined) return null;
  const lat = typeof rawLat === "number" ? rawLat : Number(rawLat);
  const lng = typeof rawLng === "number" ? rawLng : Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Rechaza sentinelas 0,0 — no existen propiedades inmobiliarias chilenas allí.
  if (lat === 0 || lng === 0) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Static-image map thumbnail via Google Static Maps API.
 *
 * Mismo sistema de styles que el Drawer Zona (`ZoneMap`) — ambos consumen
 * `src/lib/map-styles.ts` como fuente única de verdad.
 *
 * Renderiza:
 *  - Pin rojo en el centro (la dirección del usuario).
 *  - Puntos verdes pequeños por cada comparable (tope 200 por límite de URL).
 *  - Label abajo-derecha con "N comparables cerca".
 *
 * Si la imagen falla (API key faltante, Static Maps no habilitada, referrer
 * bloqueado, quota excedida) cae a placeholder con pin + nombre de ubicación.
 */
export function MapaThumbnail({
  lat,
  lng,
  comparables,
  comparablesCount,
  locationLabel,
  height = 120,
}: {
  lat: number | null;
  lng: number | null;
  comparables?: Comparable[];
  comparablesCount: number;
  locationLabel?: string;
  height?: number;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [imgFailed, setImgFailed] = useState(false);
  const [theme, setTheme] = useState<FrancoMapTheme>("dark");
  const [origin, setOrigin] = useState<string>("");
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Detectar theme actual + observar cambios en data-theme del <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setTheme(t === "light" ? "light" : "dark");
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Detectar host para decidir si usar icon custom (prod) o marker nativo (localhost).
  // Se lee después de mount para no romper SSR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    const host = window.location.hostname;
    setIsLocalhost(host === "localhost" || host === "127.0.0.1");
  }, []);

  // Log explícito si falta la API key (una vez por montaje con coords)
  useEffect(() => {
    if (!apiKey && lat && lng) {
      console.warn(
        "[MapaThumbnail] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está definida. Mostrando placeholder.",
      );
    }
  }, [apiKey, lat, lng]);

  // Reset error state al cambiar coordenadas
  useEffect(() => { setImgFailed(false); }, [lat, lng]);

  // Filtro estricto: descarta coords nulas, NaN, (0,0), fuera de rango.
  const validComparables = useMemo(() => {
    if (!comparables || comparables.length === 0) return [];
    const out: Array<{ lat: number; lng: number }> = [];
    for (const c of comparables) {
      const v = validCoord(c.lat, c.lng);
      if (v) out.push(v);
    }
    return out;
  }, [comparables]);

  // Log de diagnóstico: visibilidad de cuántos comparables vienen geolocalizados.
  useEffect(() => {
    if (!comparables || comparables.length === 0) return;
    const raw = comparables.length;
    const valid = validComparables.length;
    const pct = raw > 0 ? Math.round((valid / raw) * 100) : 0;
    console.info(
      `[MapaThumbnail] Comparables: ${raw} total, ${valid} con coords válidas (${pct}%)`,
    );
  }, [comparables, validComparables.length]);

  const url = useMemo(() => {
    if (!lat || !lng || !apiKey) return null;
    // Esperar al mount (origin se setea después) — evita mismatch con SSR.
    if (!origin) return null;

    const center = `${lat},${lng}`;
    const hasComparables = validComparables.length > 0;

    const parts: string[] = [
      "size=640x240",
      "scale=2",
      "maptype=roadmap",
    ];

    // Auto-zoom: sin `zoom=` ni `center=` cuando hay markers. Static Maps
    // deriva el viewport del bounding box de todos los markers. Sin comparables
    // (solo el pin central) cae a zoom fijo con center explícito para no dar
    // un zoom absurdamente cercano.
    if (!hasComparables) {
      parts.push(`center=${center}`, "zoom=15");
    }

    // Franco styles (mismo set que Drawer Zona, según theme)
    parts.push(...francoMapStaticStyleParams(theme));

    // Marcador central (ubicación del usuario) — Signal Red, tamaño medio
    parts.push(`markers=color:0xC8323C|size:mid|${center}`);

    // Marcadores de comparables: tope 200 para no exceder ~8KB de URL.
    if (hasComparables) {
      const MAX_MARKERS = 200;
      const coords = validComparables
        .slice(0, MAX_MARKERS)
        .map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`)
        .join("|");
      if (isLocalhost) {
        // Dev: native colored dot (Google no puede alcanzar /map-dot-green.png
        // desde localhost). El círculo verde se ve solo en prod.
        parts.push(`markers=color:0x5DCAA5|size:tiny|${coords}`);
      } else {
        // Prod: custom PNG circle hospedado en /public (accesible públicamente).
        const iconUrl = `${origin}/map-dot-green.png`;
        parts.push(`markers=icon:${encodeURIComponent(iconUrl)}|${coords}`);
      }
    }

    parts.push(`key=${apiKey}`);
    return `https://maps.googleapis.com/maps/api/staticmap?${parts.join("&")}`;
  }, [lat, lng, apiKey, theme, validComparables, origin, isLocalhost]);

  if (!lat || !lng) return null;

  const showFallback = !url || imgFailed;

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-[var(--franco-border)] bg-[var(--franco-card)]"
      style={{ height }}
    >
      {showFallback ? (
        <Placeholder locationLabel={locationLabel} keyMissing={!apiKey} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt="Ubicación de la propiedad"
          className="w-full h-full object-cover"
          onError={() => {
            console.warn("[MapaThumbnail] Static Maps image failed to load. Swapping to placeholder.");
            setImgFailed(true);
          }}
        />
      )}

      {comparablesCount > 0 && (
        <div
          className="absolute bottom-2 right-2 px-2 py-1 rounded-md"
          style={{ background: "rgba(15,15,15,0.72)" }}
        >
          <span className="font-mono text-[10px] tracking-wide text-white">
            {comparablesCount} comparables cerca
          </span>
        </div>
      )}
    </div>
  );
}

function Placeholder({
  locationLabel,
  keyMissing,
}: { locationLabel?: string; keyMissing: boolean }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1.5"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--franco-text) 3%, transparent) 0%, color-mix(in srgb, var(--franco-text) 6%, transparent) 100%)",
      }}
    >
      <MapPin className="w-5 h-5 text-[var(--franco-text-muted)]" />
      {locationLabel && (
        <span className="font-body text-[12px] text-[var(--franco-text-secondary)]">
          {locationLabel}
        </span>
      )}
      <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)]">
        {keyMissing ? "Mapa no configurado" : "Mapa no disponible"}
      </span>
    </div>
  );
}
