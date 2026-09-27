"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Mapa con el pin que se puede mover
//
// Dos usos:
//   · La pantalla «¿Dónde queda exactamente?» del wizard (26-sep-2026), para los tres caminos de la
//     entrada: sin número (el pin parte en la calle), «Estoy en el depto» (parte en la ubicación del
//     teléfono) y «Marcarlo en el mapa» (parte SIN pin: el primer toque lo pone). Ahí el límite es
//     toda la cobertura: la comuna la deduce el punto.
//   · El editor de dirección del resumen, sin número: el pin se mueve dentro de la comuna de la
//     dirección, porque ahí corrige DÓNDE en la calle, no la comuna.
//
// El pin va en tinta (opción `icon` del Marker), no en el rojo por defecto de Google. Usa
// `google.maps.Marker`: el `AdvancedMarkerElement` exige un Map ID que el proyecto no tiene.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { pinDentroDeComuna } from "@/lib/geocoding-precision";
import { cajaParaComuna } from "@/lib/comuna-bounds";

/** Centro de Santiago, para abrir el mapa cuando no hay punto ni comuna. */
const CENTRO_SANTIAGO = { lat: -33.4378, lng: -70.6205 };

export function MapaPinAjustable({
  lat,
  lng,
  comuna,
  onMover,
  height = 220,
  limite = "comuna",
}: {
  lat?: number | null;
  lng?: number | null;
  comuna: string | null;
  onMover: (lat: number, lng: number) => void;
  height?: number;
  /** "comuna" = el pin no sale de la caja de `comuna` · "cobertura" = de toda la cobertura. */
  limite?: "comuna" | "cobertura";
}) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const tienePunto = typeof lat === "number" && typeof lng === "number";
  const ultimo = useRef<{ lat: number; lng: number } | null>(tienePunto ? { lat: lat as number, lng: lng as number } : null);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
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
        const marker = new google.maps.Marker({ position: pos, map, draggable: true, icon: icono });
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
        ultimo.current = { lat: la, lng: ln };
        ponerMarcador(ultimo.current);
        onMoverRef.current(la, ln);
      };
      if (ultimo.current) ponerMarcador(ultimo.current);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addListener("click", (e: any) => intentar(e.latLng.lat(), e.latLng.lng()));
    }).catch(() => setSinMapa(true));
    return () => { cancelado = true; };
    // El mapa se crea una vez por comuna/límite; mover el pin no lo re-crea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comuna, limite]);

  if (sinMapa) return null;

  return (
    <div>
      <div
        ref={divRef}
        role="application"
        aria-label="Mapa: toca o arrastra el pin hasta el edificio"
        className="w-full rounded-xl overflow-hidden border border-[var(--franco-border)] bg-[var(--franco-card)]"
        style={{ height }}
      />
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
