"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { francoMapStaticStyleParams, type FrancoMapTheme } from "@/lib/map-styles";
import { rotuloComparables } from "@/components/formulario-v4/comparablesRotulo";

/**
 * Input "crudo" — lat/lng pueden venir null cuando el backend no geolocalizó
 * la propiedad (una parte de las filas de scraped_properties puede venir sin coords).
 * Se filtran adentro del componente antes de construir la URL de Static Maps.
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
 *  - Pin Signal Red en el centro (la dirección del usuario).
 *  - Los comparables (`comparables`: la muestra detrás del precio de referencia) en gris
 *    oscuro y, debajo, el resto del radio (`contexto`) en un gris más tenue. Tope 200 puntos
 *    en total por el largo de la URL; los comparables van completos, el contexto se recorta.
 *  - Leyenda abajo-derecha: «N comparables a R · otros M en gris». N es el largo de la lista
 *    oscura que se dibuja (28-sep-2026: antes dibujaba y contaba todo el radio).
 *
 * Si la imagen falla (API key faltante, Static Maps no habilitada, referrer
 * bloqueado, quota excedida) cae a placeholder con pin + nombre de ubicación.
 */
export function MapaThumbnail({
  lat,
  lng,
  comparables,
  contexto,
  radioM = null,
  locationLabel,
  height = 120,
}: {
  lat: number | null;
  lng: number | null;
  /** La muestra detrás del precio de referencia: la lista que la leyenda cuenta. */
  comparables?: Comparable[];
  /** El resto de la oferta del radio, en gris más tenue; la leyenda lo distingue. */
  contexto?: Comparable[];
  /** El radio (m) al que se juntó la muestra, para la leyenda. */
  radioM?: number | null;
  locationLabel?: string;
  height?: number;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [imgFailed, setImgFailed] = useState(false);
  const [theme, setTheme] = useState<FrancoMapTheme>("light");
  const [origin, setOrigin] = useState<string>("");

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

  // origin se lee después de mount (evita mismatch con SSR); gatea la construcción
  // de la URL de Static Maps hasta tener window.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
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
  const validComparables = useMemo(() => coordsValidas(comparables), [comparables]);
  const validContexto = useMemo(() => coordsValidas(contexto), [contexto]);

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

    // Dos capas de puntos, tope 200 en total para no exceder ~8KB de URL: el contexto va
    // primero (queda debajo) y recortado; los comparables, completos y en el gris oscuro.
    // Marcadores de color nativo (mismo render en dev y prod, sin depender de un PNG).
    const MAX_MARKERS = 200;
    const aCoords = (ps: Array<{ lat: number; lng: number }>) => ps.map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join("|");
    const contextoRecortado = validContexto.slice(0, Math.max(0, MAX_MARKERS - Math.min(validComparables.length, MAX_MARKERS)));
    if (contextoRecortado.length > 0) parts.push(`markers=color:${COLOR_CONTEXTO[theme]}|size:tiny|${aCoords(contextoRecortado)}`);
    if (hasComparables) parts.push(`markers=color:${COLOR_COMPARABLES[theme]}|size:tiny|${aCoords(validComparables.slice(0, MAX_MARKERS))}`);

    parts.push(`key=${apiKey}`);
    return `https://maps.googleapis.com/maps/api/staticmap?${parts.join("&")}`;
  }, [lat, lng, apiKey, theme, validComparables, validContexto, origin]);

  // Sin coords ya NO devolvemos null (dejaba una columna en blanco en el hero).
  // Cae al Placeholder digno (pin + ubicación): url es null cuando faltan coords
  // (ver arriba), así que showFallback ya lo cubre. El wizard monta este componente
  // solo con coords presentes (Paso1Propiedad lo envuelve en `state.lat && state.lng`),
  // así que este cambio afecta únicamente al hero.
  const showFallback = !url || imgFailed;

  // La leyenda cuenta los puntos oscuros que se dibujan (validComparables): número, radio y,
  // aparte, cuántos quedan en gris. Sin comparables dibujados no hay leyenda.
  const nComparables = validComparables.length;
  const nContexto = validContexto.length;

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

      {nComparables > 0 && (
        <div
          className="absolute bottom-2 right-2 px-2 py-1 rounded-md"
          style={{ background: "rgba(15,15,15,0.72)" }}
        >
          <span className="font-mono text-[10px] tracking-wide text-white">
            {rotuloComparables(nComparables, radioM)}
            {nContexto > 0 && <span style={{ color: "rgba(255,255,255,.62)" }}> · otros {nContexto} en gris</span>}
          </span>
        </div>
      )}
    </div>
  );
}

/** Colores de los puntos por tema: comparables en gris oscuro, contexto en gris tenue. */
const COLOR_COMPARABLES: Record<FrancoMapTheme, string> = { light: "0x71717A", dark: "0xB4B2A9" };
const COLOR_CONTEXTO: Record<FrancoMapTheme, string> = { light: "0xC4C2BB", dark: "0x55544F" };

function coordsValidas(lista: Comparable[] | undefined): Array<{ lat: number; lng: number }> {
  if (!lista || lista.length === 0) return [];
  const out: Array<{ lat: number; lng: number }> = [];
  for (const c of lista) {
    const v = validCoord(c.lat, c.lng);
    if (v) out.push(v);
  }
  return out;
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
      <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
        {keyMissing ? "Mapa no configurado" : "Mapa no disponible"}
      </span>
    </div>
  );
}
