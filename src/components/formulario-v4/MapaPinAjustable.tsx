"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Mapa con el pin que se puede mover — para la dirección SIN NÚMERO
//
// Cuando la dirección confirmada es una calle sin número (o una intersección), el punto que
// devuelve Google es UN punto de la calle, y en una avenida larga eso puede quedar a kilómetros
// del depto. En 26-sep-2026 era el 14% de los análisis. Acá el usuario lo corrige: toca el mapa
// o arrastra el pin hasta el edificio, y los comparables se miden desde ahí.
//
// El pin se mueve DENTRO de la comuna de la dirección (`pinDentroDeComuna`): corrige dónde en la
// calle, no la comuna. Si el depto está en otra comuna, lo que hay que cambiar es la dirección.
//
// Usa `google.maps.Marker`: el `AdvancedMarkerElement` exige un Map ID que el proyecto no tiene.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { pinDentroDeComuna } from "@/lib/geocoding-precision";

export function MapaPinAjustable({
  lat,
  lng,
  comuna,
  onMover,
  height = 220,
}: {
  lat: number;
  lng: number;
  comuna: string;
  onMover: (lat: number, lng: number) => void;
  height?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const ultimo = useRef({ lat, lng });
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
      const centro = { lat: ultimo.current.lat, lng: ultimo.current.lng };
      const map = new google.maps.Map(divRef.current, {
        center: centro,
        zoom: 17,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "cooperative",
      });
      const marker = new google.maps.Marker({ position: centro, map, draggable: true });
      markerRef.current = marker;

      const intentar = (la: number, ln: number) => {
        if (!pinDentroDeComuna(comuna, la, ln)) {
          // Fuera de la comuna: el pin vuelve a donde estaba.
          marker.setPosition(ultimo.current);
          setFuera(true);
          return;
        }
        setFuera(false);
        ultimo.current = { lat: la, lng: ln };
        marker.setPosition(ultimo.current);
        onMoverRef.current(la, ln);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marker.addListener("dragend", (e: any) => intentar(e.latLng.lat(), e.latLng.lng()));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addListener("click", (e: any) => intentar(e.latLng.lat(), e.latLng.lng()));
    }).catch(() => setSinMapa(true));
    return () => { cancelado = true; };
    // El mapa se crea una vez por comuna; mover el pin no lo re-crea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comuna]);

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
          Ese punto queda fuera de {comuna}. Si el depto está en otra comuna, cambia la dirección.
        </p>
      )}
    </div>
  );
}

/** El aviso que acompaña al mapa: qué pasó con la ubicación y qué puedes hacer. */
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
