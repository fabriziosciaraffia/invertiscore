"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Mapa con el pin que se puede mover
//
// Dos usos:
//   · La pantalla «¿Dónde queda exactamente?» del wizard (26-sep-2026), que desde el 27-sep es
//     SIEMPRE la segunda, para todos los caminos: con número (el pin parte en la dirección), sin
//     número (parte en la calle), «Estoy en el depto» (en la ubicación del teléfono) y «Marcarlo en
//     el mapa» (parte SIN pin: el primer toque lo pone y acerca el mapa). Ahí el límite es toda la
//     cobertura —la comuna la deduce el punto— y el mapa lleva los comparables alrededor (`puntos`)
//     y el conteo encima (`etiqueta`), como la miniatura del wizard viejo, pero con el pin movible.
//   · El editor de dirección del resumen, sin número: el pin se mueve dentro de la comuna de la
//     dirección, porque ahí corrige DÓNDE en la calle, no la comuna.
//
// El pin va en tinta (opción `icon` del Marker), no en el rojo por defecto de Google; los
// comparables, en puntos grises chicos debajo del pin. Usa `google.maps.Marker`: el
// `AdvancedMarkerElement` exige un Map ID que el proyecto no tiene.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { pinDentroDeComuna } from "@/lib/geocoding-precision";
import { cajaParaComuna } from "@/lib/comuna-bounds";

/** Centro de Santiago, para abrir el mapa cuando no hay punto ni comuna. */
const CENTRO_SANTIAGO = { lat: -33.4378, lng: -70.6205 };

/** Un comparable del radio (`/api/data/suggestions` · nearbyProperties). Puede venir sin coordenadas. */
export interface PuntoCercano {
  lat: number | null;
  lng: number | null;
}

/** Coordenada usable: número finito, sin el (0, 0) que deja un null convertido. */
function coordValida(p: PuntoCercano): { lat: number; lng: number } | null {
  const lat = typeof p.lat === "number" ? p.lat : Number(p.lat);
  const lng = typeof p.lng === "number" ? p.lng : Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

export function MapaPinAjustable({
  lat,
  lng,
  comuna,
  onMover,
  height = 220,
  limite = "comuna",
  puntos,
  etiqueta,
}: {
  lat?: number | null;
  lng?: number | null;
  comuna: string | null;
  onMover: (lat: number, lng: number) => void;
  height?: number;
  /** "comuna" = el pin no sale de la caja de `comuna` · "cobertura" = de toda la cobertura. */
  limite?: "comuna" | "cobertura";
  /** Los comparables alrededor del pin, en puntos grises. */
  puntos?: PuntoCercano[];
  /** Sobre el mapa, arriba a la izquierda: el conteo de propiedades en el sector. */
  etiqueta?: ReactNode;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puntosRef = useRef<any[]>([]);
  const tienePunto = typeof lat === "number" && typeof lng === "number";
  const ultimo = useRef<{ lat: number; lng: number } | null>(tienePunto ? { lat: lat as number, lng: lng as number } : null);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  /** El usuario arrastró o hizo zoom: desde ahí el mapa no se re-encuadra solo. */
  const tocado = useRef(false);
  const encuadrado = useRef(false);
  const [listo, setListo] = useState(false);
  const [fuera, setFuera] = useState(false);
  const [sinMapa, setSinMapa] = useState(false);

  useEffect(() => {
    let cancelado = false;
    loadGoogleMaps().then(() => {
      if (cancelado || !divRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.maps?.Map) { setSinMapa(true); return; }
      const comunaLimite = limite === "comuna" ? comuna : null;
      let centro = ultimo.current;
      let zoom = 17;
      if (!centro) {
        // Sin punto: el centro de la comuna si se sabe, si no Santiago; más lejos, para elegir.
        if (comuna) {
          const [s, w, n, e] = cajaParaComuna(comuna);
          centro = { lat: (s + n) / 2, lng: (w + e) / 2 };
          zoom = 14;
        } else {
          centro = CENTRO_SANTIAGO;
          zoom = 12;
        }
      }
      const map = new google.maps.Map(divRef.current, {
        center: centro,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "cooperative",
      });
      mapRef.current = map;
      map.addListener("dragstart", () => { tocado.current = true; });
      const icono = {
        path: "M12 33C12 33 22 20 22 12A10 10 0 1 0 2 12C2 20 12 33 12 33Z",
        fillColor: "#18181B",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 1.5,
        anchor: new google.maps.Point(12, 33),
        scale: 1.15,
      };
      const ponerMarcador = (pos: { lat: number; lng: number }) => {
        if (markerRef.current) { markerRef.current.setPosition(pos); return; }
        const marker = new google.maps.Marker({ position: pos, map, draggable: true, icon: icono, zIndex: 10 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marker.addListener("dragend", (e: any) => intentar(e.latLng.lat(), e.latLng.lng()));
        markerRef.current = marker;
      };
      const intentar = (la: number, ln: number) => {
        if (!pinDentroDeComuna(comunaLimite, la, ln)) {
          // Fuera del límite: el pin vuelve a donde estaba (o no aparece, si no había).
          if (ultimo.current && markerRef.current) markerRef.current.setPosition(ultimo.current);
          setFuera(true);
          return;
        }
        setFuera(false);
        const primero = !ultimo.current;
        ultimo.current = { lat: la, lng: ln };
        ponerMarcador(ultimo.current);
        onMoverRef.current(la, ln);
        tocado.current = true;
        // El primer toque sobre un mapa lejano (Santiago entero) acerca al punto, para afinarlo.
        if (primero && map.getZoom() < 15) { map.setZoom(16); map.panTo(ultimo.current); }
      };
      if (ultimo.current) ponerMarcador(ultimo.current);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addListener("click", (e: any) => intentar(e.latLng.lat(), e.latLng.lng()));
      setListo(true);
    }).catch(() => setSinMapa(true));
    return () => { cancelado = true; };
    // El mapa se crea una vez por comuna/límite; mover el pin no lo re-crea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comuna, limite]);

  // Los comparables: puntos grises bajo el pin. Cuando llegan por primera vez y nadie tocó el mapa,
  // se encuadran junto al pin (entre zoom 14 y 17), así se ven alrededor sin perder el edificio.
  useEffect(() => {
    const map = mapRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!listo || !map || !google?.maps) return;
    for (const m of puntosRef.current) m.setMap(null);
    puntosRef.current = [];
    const validos = (puntos ?? []).map(coordValida).filter((p): p is { lat: number; lng: number } => !!p);
    for (const p of validos) {
      puntosRef.current.push(new google.maps.Marker({
        position: p,
        map,
        clickable: false,
        zIndex: 1,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: "#71717A", fillOpacity: 0.85, strokeColor: "#FFFFFF", strokeWeight: 1 },
      }));
    }
    if (validos.length && ultimo.current && !tocado.current && !encuadrado.current) {
      encuadrado.current = true;
      const caja = new google.maps.LatLngBounds();
      caja.extend(ultimo.current);
      for (const p of validos) caja.extend(p);
      map.fitBounds(caja, 28);
      google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (z > 17) map.setZoom(17);
        else if (z < 14) { map.setZoom(14); map.setCenter(ultimo.current); }
      });
    }
  }, [puntos, listo]);

  if (sinMapa) return null;

  return (
    <div>
      <div className="relative">
        <div
          ref={divRef}
          role="application"
          aria-label="Mapa: toca o arrastra el pin hasta el edificio"
          className="w-full rounded-xl overflow-hidden border border-[var(--franco-border)] bg-[var(--franco-card)]"
          style={{ height }}
        />
        {etiqueta && (
          <div
            className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-white/95 px-3 py-1 font-body text-[12.5px] font-medium text-[#18181B]"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.18)" }}
            aria-live="polite"
          >
            {etiqueta}
          </div>
        )}
      </div>
      {fuera && (
        <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-1.5 mb-0 leading-snug">
          {limite === "comuna"
            ? `Ese punto queda fuera de ${comuna}. Si el depto está en otra comuna, cambia la dirección.`
            : "Ese punto queda fuera de la zona que Franco cubre."}
        </p>
      )}
    </div>
  );
}

/** El aviso que acompaña al mapa del resumen: qué pasó con la ubicación y qué puedes hacer. */
export function AvisoSinNumero({ ajustada }: { ajustada: boolean }) {
  return (
    <div
      className="rounded-r-lg border-l-2 border-[var(--franco-text-secondary)] pl-4 pr-4 py-3"
      style={{ background: "color-mix(in srgb, var(--franco-text) 3.5%, transparent)" }}
    >
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--franco-text-tertiary)] m-0 mb-1">
        {ajustada ? "Ubicación ajustada" : "Dirección sin número"}
      </p>
      <p className="font-body text-[13px] leading-[1.55] text-[var(--franco-text)] m-0">
        {ajustada
          ? "Los comparables se miden desde el punto que marcaste."
          : "Sin número, el depto quedó en un punto cualquiera de la calle. Toca el mapa o arrastra el pin hasta el edificio: los comparables se miden desde ahí."}
      </p>
    </div>
  );
}
