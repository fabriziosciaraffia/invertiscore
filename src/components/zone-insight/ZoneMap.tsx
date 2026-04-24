"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import type { ZoneInsightData, ZonePOI } from "@/hooks/useZoneInsight";
import { francoMapStyleForTheme } from "@/lib/map-styles";

type CategoryKey = keyof ZoneInsightData["pois"];

interface IconSpec {
  bg: string;
  stroke: string;
  pathSvg: string;
}

const CATEGORY_ICONS: Record<CategoryKey, IconSpec> = {
  metro: {
    bg: "#EF4444",
    stroke: "#FAFAF8",
    // Vagón simplificado
    pathSvg:
      '<rect x="1" y="1" width="14" height="12" rx="1.5" fill="none"/>' +
      '<line x1="1" y1="7" x2="15" y2="7"/>' +
      '<circle cx="5" cy="10.5" r="1" fill="#FAFAF8" stroke="none"/>' +
      '<circle cx="11" cy="10.5" r="1" fill="#FAFAF8" stroke="none"/>',
  },
  trenes: {
    bg: "#F59E0B",
    stroke: "#FAFAF8",
    // Locomotora + rieles
    pathSvg:
      '<rect x="1" y="2" width="14" height="8" rx="1" fill="none"/>' +
      '<line x1="1" y1="6" x2="15" y2="6"/>' +
      '<line x1="3" y1="13" x2="1" y2="15"/>' +
      '<line x1="13" y1="13" x2="15" y2="15"/>',
  },
  clinicas: {
    // Excepción: fondo blanco, cruz roja
    bg: "#FAFAF8",
    stroke: "#DC2626",
    pathSvg:
      '<line x1="8" y1="2" x2="8" y2="14" stroke-width="3"/>' +
      '<line x1="2" y1="8" x2="14" y2="8" stroke-width="3"/>',
  },
  universidades: {
    bg: "#3B82F6",
    stroke: "#FAFAF8",
    // Birrete
    pathSvg:
      '<path d="M0 5 L8 1 L16 5 L8 9 Z"/>' +
      '<path d="M3 7 V11 C3 13 13 13 13 11 V7"/>',
  },
  institutos: {
    bg: "#8B5CF6",
    stroke: "#FAFAF8",
    // Diploma
    pathSvg:
      '<rect x="1" y="3" width="14" height="10" rx="1" fill="none"/>' +
      '<line x1="4" y1="6" x2="12" y2="6"/>' +
      '<line x1="4" y1="9" x2="9" y2="9"/>',
  },
  colegios: {
    bg: "#6366F1",
    stroke: "#FAFAF8",
    // Escuela con bandera
    pathSvg:
      '<rect x="2" y="5" width="12" height="11" fill="none"/>' +
      '<line x1="8" y1="5" x2="8" y2="0"/>' +
      '<path d="M8 0 L14 1 L8 3 Z" fill="#FAFAF8" stroke="none"/>' +
      '<line x1="5" y1="10" x2="6" y2="10"/>' +
      '<line x1="10" y1="10" x2="11" y2="10"/>',
  },
  parques: {
    bg: "#84CC16",
    stroke: "#FAFAF8",
    // Árbol
    pathSvg:
      '<path d="M8 0 L3 7 L6 7 L2 13 L14 13 L10 7 L13 7 Z"/>' +
      '<line x1="8" y1="13" x2="8" y2="16"/>',
  },
  malls: {
    bg: "#EC4899",
    stroke: "#FAFAF8",
    // Bolsa de compras
    pathSvg:
      '<path d="M2 0 L1 4 L15 4 L14 0 Z"/>' +
      '<path d="M1 4 V15 H15 V4"/>' +
      '<path d="M5 4 V7 C5 9 11 9 11 7 V4"/>',
  },
  negocios: {
    bg: "#A855F7",
    stroke: "#FAFAF8",
    // Maletín
    pathSvg:
      '<rect x="0" y="4" width="16" height="11" rx="1" fill="none"/>' +
      '<path d="M5 4 V1 C5 0 7 0 8 0 L11 0 V4"/>',
  },
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  metro: "Metro",
  trenes: "Tren",
  parques: "Parques",
  clinicas: "Clínicas",
  universidades: "Universidades",
  institutos: "Institutos",
  colegios: "Colegios",
  malls: "Malls",
  negocios: "Negocios",
};

function isLightMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-theme") === "light";
}

function getMapStyle(): google.maps.MapTypeStyle[] {
  return francoMapStyleForTheme(isLightMode() ? "light" : "dark") as google.maps.MapTypeStyle[];
}

function buildMarkerIcon(spec: IconSpec, size = 32): google.maps.Icon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="14" fill="${spec.bg}" stroke="#0F0F0F" stroke-width="2"/>` +
    `<g transform="translate(8, 8)" stroke="${spec.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    spec.pathSvg +
    `</g></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function buildDeptoMarkerIcon(size = 42): google.maps.Icon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 42 42">` +
    `<circle cx="21" cy="21" r="18" fill="#C8323C" stroke="#FAFAF8" stroke-width="3"/>` +
    `<g transform="translate(11, 11)" stroke="#FAFAF8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    `<path d="M0 10 L10 0 L20 10"/>` +
    `<path d="M2 8 V18 H18 V8"/>` +
    `<rect x="8" y="12" width="4" height="6"/>` +
    `</g></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

interface Props {
  centerLat: number;
  centerLng: number;
  pois: ZoneInsightData["pois"];
}

export function ZoneMap({ centerLat, centerLng, pois }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        if (typeof window !== "undefined" && window.google?.maps) {
          setReady(true);
        } else {
          setError(true);
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Watch theme changes and update map style + legend
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setThemeVersion((v) => v + 1);
      if (mapInstance.current) {
        mapInstance.current.setOptions({ styles: getMapStyle() });
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = window.google;
    if (!google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 15,
      styles: getMapStyle(),
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstance.current = map;

    // Marker central — ícono casa
    new google.maps.Marker({
      position: { lat: centerLat, lng: centerLng },
      map,
      title: "Tu depto",
      icon: buildDeptoMarkerIcon(),
      zIndex: 1000,
    });

    // Markers por categoría con íconos SVG
    const infoWindows: google.maps.InfoWindow[] = [];
    (Object.keys(pois) as CategoryKey[]).forEach((category) => {
      const spec = CATEGORY_ICONS[category];
      if (!spec) return;
      const label = CATEGORY_LABELS[category];
      pois[category].forEach((poi: ZonePOI) => {
        const marker = new google.maps.Marker({
          position: { lat: poi.lat, lng: poi.lng },
          map,
          title: poi.nombre,
          icon: buildMarkerIcon(spec),
        });
        const distTxt = poi.distancia < 1000 ? `${poi.distancia} m` : `${(poi.distancia / 1000).toFixed(1)} km`;
        const extra = poi.linea ? ` · ${poi.linea}` : poi.comuna ? ` · ${poi.comuna}` : "";
        const infoWindow = new google.maps.InfoWindow({
          content:
            `<div style="font-family:'IBM Plex Sans',system-ui,sans-serif;padding:4px 6px;max-width:220px;">` +
            `<div style="font-weight:600;font-size:13px;color:#0F0F0F;">${poi.nombre}</div>` +
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#71717A;margin-top:2px;">${label} · ${distTxt}${extra}</div>` +
            `</div>`,
        });
        marker.addListener("click", () => {
          infoWindows.forEach((iw) => iw.close());
          infoWindow.open(map, marker);
        });
        infoWindows.push(infoWindow);
      });
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: centerLat, lng: centerLng });
    (Object.values(pois) as ZonePOI[][]).forEach((list) => {
      list.forEach((poi) => bounds.extend({ lat: poi.lat, lng: poi.lng }));
    });
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 60, left: 40 });
    const listener = google.maps.event.addListener(map, "idle", () => {
      if ((map.getZoom() ?? 15) > 16) map.setZoom(16);
      google.maps.event.removeListener(listener);
    });
  }, [ready, centerLat, centerLng, pois]);

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--franco-bar-track)",
          border: "0.5px solid var(--franco-border)",
        }}
      >
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
          No se pudo cargar el mapa. Revisa la lista de lugares abajo.
        </p>
      </div>
    );
  }

  const presentCategories = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).filter(
    (k) => pois[k].length > 0
  );
  const light = isLightMode();
  // themeVersion included so legend re-renders on theme change
  void themeVersion;
  const legendBg = light ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.75)";
  const legendBorder = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const legendText = light ? "#2a2a2a" : "rgba(250,250,248,0.85)";

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-[280px] md:h-[340px] rounded-xl"
        style={{ border: "0.5px solid var(--franco-border)" }}
      />
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
          style={{ background: "var(--franco-bar-track)", border: "0.5px solid var(--franco-border)" }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[2px]"
            style={{ color: "var(--franco-text-secondary)" }}
          >
            Cargando mapa…
          </span>
        </div>
      )}
      <div
        className="absolute left-2 right-2 bottom-2 px-2.5 py-2 rounded-[6px] flex flex-wrap gap-x-3 gap-y-1 overflow-x-auto"
        style={{
          background: legendBg,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: `0.5px solid ${legendBorder}`,
        }}
      >
        {presentCategories.map((k) => {
          const spec = CATEGORY_ICONS[k];
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: spec.bg,
                  border: k === "clinicas" ? `1.5px solid ${spec.stroke}` : "1px solid rgba(0,0,0,0.3)",
                }}
              />
              <span
                className="font-mono uppercase whitespace-nowrap"
                style={{ fontSize: 9, letterSpacing: "1px", color: legendText }}
              >
                {CATEGORY_LABELS[k]}
              </span>
            </div>
          );
        })}
        {/* Tu depto — siempre visible al final */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: "#C8323C", border: "1.5px solid #FAFAF8" }}
          />
          <span
            className="font-mono uppercase whitespace-nowrap"
            style={{ fontSize: 9, letterSpacing: "1px", color: legendText, fontWeight: 600 }}
          >
            Tu depto
          </span>
        </div>
      </div>
    </div>
  );
}
