"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE EXPLORAR (23-oct-2026): Google Maps con el estilo de Franco (map-styles.ts), cargado DESPUÉS del primer
// pintado (lo monta explorar-cliente.tsx por next/dynamic, con la página quieta). Pines rojos para los que convienen,
// azules los que esta cuenta ya analizó, agrupados con el número donde hay muchos (explorar.ts › agruparPines, por celdas
// de la proyección a cada zoom); el elegido, en tinta. Tocar un grupo acerca; tocar un pin lo abre en la hoja. Usa
// `google.maps.Marker` como el resto del sitio (AdvancedMarkerElement exige un Map ID que el proyecto no tiene).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { francoMapStyleForTheme } from "@/lib/map-styles";
import { cajaParaComuna } from "@/lib/comuna-bounds";
import { agruparPines, type PinExplorar } from "@/lib/explorar/explorar";

const ROJO = "#C8323C";
const AZUL_CLARO = "#2B558F";
const AZUL_OSCURO = "#8DB0E3";
const TINTA = "#0F0F0F";
const PAPEL = "#FFFFFF";
const ZOOM_MAX_ENCUADRE = 15;
const TOPE_CARGA_MS = 12000;

const esClaro = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
const svg = (w: number, inner: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">${inner}</svg>`)}`;
const iconoPin = (color: string) => ({ url: svg(18, `<circle cx="9" cy="9" r="7" fill="${color}" stroke="${PAPEL}" stroke-width="2"/>`), w: 18 });
const iconoElegido = () => ({ url: svg(34, `<circle cx="17" cy="17" r="13" fill="${TINTA}" stroke="${PAPEL}" stroke-width="3"/>`), w: 34 });
function iconoGrupo(n: number, color: string) {
  const w = n < 10 ? 34 : n < 100 ? 40 : 46;
  return { url: svg(w, `<circle cx="${w / 2}" cy="${w / 2}" r="${w / 2 - 1.5}" fill="${color}" stroke="${PAPEL}" stroke-width="2"/><text x="50%" y="50%" dy=".36em" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${PAPEL}">${n}</text>`), w };
}

export interface MapaExplorarProps {
  pines: PinExplorar[];
  analizados: ReadonlySet<string>;
  seleccionado: string | null;
  /** Para encuadrar sin pines: la primera comuna del filtro. */
  comuna: string | null;
  onSeleccionar: (avisoId: string) => void;
  /** «listo»: el mapa existe; «teselas»: ya dibujó sus teselas (el mapa quieto se puede ir); «fallo»: no cargó. */
  onEstado: (estado: "listo" | "teselas" | "fallo") => void;
}

export default function MapaExplorar({ pines, analizados, seleccionado, comuna, onSeleccionar, onEstado }: MapaExplorarProps) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresRef = useRef<any[]>([]);
  const pinesRef = useRef(pines);
  const analizadosRef = useRef(analizados);
  const selRef = useRef(seleccionado);
  const comunaRef = useRef(comuna);
  const onSeleccionarRef = useRef(onSeleccionar);
  const onEstadoRef = useRef(onEstado);
  pinesRef.current = pines; analizadosRef.current = analizados; selRef.current = seleccionado; comunaRef.current = comuna;
  onSeleccionarRef.current = onSeleccionar; onEstadoRef.current = onEstado;
  const dibujarRef = useRef<() => void>(() => {});
  const encuadrarRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelado = false;
    const tope = window.setTimeout(() => { if (!mapRef.current) onEstadoRef.current("fallo"); }, TOPE_CARGA_MS);
    loadGoogleMaps().then(() => {
      if (cancelado || !divRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.Map) { onEstadoRef.current("fallo"); return; }
      window.clearTimeout(tope);
      const claro = esClaro();
      const map = new g.maps.Map(divRef.current, {
        center: { lat: -33.4378, lng: -70.6205 }, zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        gestureHandling: "greedy", styles: francoMapStyleForTheme(claro ? "light" : "dark"), backgroundColor: claro ? "#F6F6F7" : "#1a1a1a",
      });
      mapRef.current = map;

      const limpiar = () => { for (const m of marcadoresRef.current) m.setMap(null); marcadoresRef.current = []; };
      const marcador = (pos: { lat: number; lng: number }, icono: { url: string; w: number }, zIndex: number, alTocar: () => void) => {
        const m = new g.maps.Marker({ position: pos, map, zIndex, icon: { url: icono.url, scaledSize: new g.maps.Size(icono.w, icono.w), anchor: new g.maps.Point(icono.w / 2, icono.w / 2) } });
        m.addListener("click", alTocar);
        marcadoresRef.current.push(m);
      };
      dibujarRef.current = () => {
        const zoom = map.getZoom();
        const caja = map.getBounds();
        if (zoom == null) return;
        limpiar();
        const azul = esClaro() ? AZUL_CLARO : AZUL_OSCURO;
        // Solo lo que está a la vista (con margen): a Santiago entero no hace falta dibujarle miles de marcadores.
        const visibles = caja ? pinesRef.current.filter((p) => caja.contains({ lat: p.lat, lng: p.lng })) : pinesRef.current;
        const sel = selRef.current;
        for (const gr of agruparPines(visibles.filter((p) => p.avisoId !== sel), zoom, analizadosRef.current)) {
          if (gr.n === 1) {
            const id = gr.ids[0];
            marcador({ lat: gr.lat, lng: gr.lng }, iconoPin(analizadosRef.current.has(id) ? azul : ROJO), analizadosRef.current.has(id) ? 3 : 2, () => onSeleccionarRef.current(id));
          } else {
            const pos = { lat: gr.lat, lng: gr.lng };
            marcador(pos, iconoGrupo(gr.n, gr.analizados === gr.n ? azul : ROJO), 1, () => { map.setZoom(Math.min(zoom + 2, 18)); map.panTo(pos); });
          }
        }
        const elegido = sel ? pinesRef.current.find((p) => p.avisoId === sel) : null;
        if (elegido) marcador({ lat: elegido.lat, lng: elegido.lng }, iconoElegido(), 10, () => onSeleccionarRef.current(elegido.avisoId));
      };
      encuadrarRef.current = () => {
        const ps = pinesRef.current;
        if (ps.length === 0) {
          const [s, w, n, e] = cajaParaComuna(comunaRef.current);
          map.setCenter({ lat: (s + n) / 2, lng: (w + e) / 2 });
          map.setZoom(13);
          return;
        }
        const b = new g.maps.LatLngBounds();
        for (const p of ps) b.extend({ lat: p.lat, lng: p.lng });
        map.fitBounds(b, 48);
        g.maps.event.addListenerOnce(map, "idle", () => { if ((map.getZoom() ?? 0) > ZOOM_MAX_ENCUADRE) map.setZoom(ZOOM_MAX_ENCUADRE); });
      };
      map.addListener("idle", () => dibujarRef.current());
      g.maps.event.addListenerOnce(map, "tilesloaded", () => onEstadoRef.current("teselas"));
      encuadrarRef.current();
      onEstadoRef.current("listo");
    }).catch(() => { if (!cancelado) onEstadoRef.current("fallo"); });
    return () => { cancelado = true; window.clearTimeout(tope); };
  }, []);

  // Cambió la búsqueda: se encuadra de nuevo y se redibuja.
  useEffect(() => { if (mapRef.current) { encuadrarRef.current(); dibujarRef.current(); } }, [pines]);
  // Cambió el elegido: se redibuja y se acerca a él.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dibujarRef.current();
    const p = seleccionado ? pines.find((x) => x.avisoId === seleccionado) : null;
    if (p) map.panTo({ lat: p.lat, lng: p.lng });
  }, [seleccionado, pines]);

  return <div ref={divRef} className="ex-mapa" data-explorar="mapa" aria-label="Mapa de los deptos que convienen" role="application" />;
}
