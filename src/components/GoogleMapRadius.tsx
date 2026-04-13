'use client';

import { useEffect, useRef, useState } from 'react';

export interface NearbyPoint {
  lat: number;
  lng: number;
}

interface GoogleMapRadiusProps {
  lat: number;
  lng: number;
  radiusMeters: number;
  comuna: string;
  nearbyProperties?: NearbyPoint[];
}

export default function GoogleMapRadius({
  lat, lng, radiusMeters, nearbyProperties,
}: GoogleMapRadiusProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const mainMarkerRef = useRef<google.maps.Marker | null>(null);
  const nearbyMarkersRef = useRef<google.maps.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Cargar Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // Verificar si ya hay un script cargando
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          setMapLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f5f5f3' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#71717A' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E6E6E2' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E6E6E2' }] },
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
    }
  }, [mapLoaded, lat, lng]);

  // Actualizar centro y radio
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.setCenter({ lat, lng });

    if (radiusMeters <= 400) map.setZoom(16);
    else if (radiusMeters <= 800) map.setZoom(15);
    else if (radiusMeters <= 1200) map.setZoom(14);
    else map.setZoom(13);

    // Marker principal
    if (mainMarkerRef.current) {
      mainMarkerRef.current.setPosition({ lat, lng });
    } else {
      mainMarkerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#C8323C',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
        zIndex: 10,
        title: 'Tu propiedad',
      });
    }

    // Círculo de radio
    if (circleRef.current) {
      circleRef.current.setCenter({ lat, lng });
      circleRef.current.setRadius(radiusMeters);
    } else {
      circleRef.current = new google.maps.Circle({
        map,
        center: { lat, lng },
        radius: radiusMeters,
        fillColor: '#0F0F0F',
        fillOpacity: 0.04,
        strokeColor: '#0F0F0F',
        strokeOpacity: 0.2,
        strokeWeight: 1.5,
      });
    }
  }, [lat, lng, radiusMeters, mapLoaded]);

  // Renderizar puntos de propiedades cercanas
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Limpiar marcadores anteriores
    nearbyMarkersRef.current.forEach(m => m.setMap(null));
    nearbyMarkersRef.current = [];

    if (!nearbyProperties || nearbyProperties.length === 0) return;

    const validProps = nearbyProperties.filter(p => p.lat && p.lng);
    for (const prop of validProps) {
      const marker = new google.maps.Marker({
        position: { lat: prop.lat, lng: prop.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#71717A',
          fillOpacity: 0.6,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
        },
        zIndex: 1,
        clickable: false,
      });
      nearbyMarkersRef.current.push(marker);
    }
  }, [nearbyProperties, mapLoaded]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#E6E6E2]">
      <div ref={mapRef} className="w-full" style={{ height: 220 }} />

      {/* Leyenda */}
      <div className="absolute top-2.5 right-2.5 flex flex-col gap-0.5 rounded-md bg-white/95 backdrop-blur-sm px-2 py-1 shadow-sm">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C8323C]" />
          <span className="font-body text-[9px] text-[var(--franco-text-muted)]">Tu propiedad</span>
        </div>
        {nearbyProperties && nearbyProperties.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--franco-text-muted)] opacity-60" />
            <span className="font-body text-[9px] text-[var(--franco-text-muted)]">Arriendos cercanos</span>
          </div>
        )}
      </div>
    </div>
  );
}
