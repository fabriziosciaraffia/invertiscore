"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE EXPLORAR (23-oct-2026; como portal desde el 28-oct-2026, 5b-explorar-portal.html): Google Maps con el estilo de
// Franco (map-styles.ts), cargado DESPUÉS del primer pintado (lo monta explorar-cliente.tsx por next/dynamic, con la página
// quieta). LEJOS, GRUPOS CON NÚMERO (explorar.ts › agruparPines, por celdas de la proyección a cada zoom); CON ZOOM, cada pin
// dice su flujo mensual («+$142 mil»), los ya analizados por la cuenta van en azul con «✓ Analizado» y los aparecidos en
// las últimas 24 horas dicen «Nuevo hoy» (portal.ts › textoPin); el elegido, en tinta. Tocar un grupo acerca; tocar un pin
// abre su tarjeta; tocar el mapa la cierra. Cuando LA PERSONA mueve el mapa (no el encuadre automático), avisa la caja para
// «Buscar en esta zona». Usa `google.maps.Marker` como el resto del sitio (AdvancedMarkerElement exige un Map ID).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { francoMapStyleForTheme } from "@/lib/map-styles";
import { agruparPines } from "@/lib/explorar/explorar";
import { textoPin, type Caja, type PinMapa } from "@/lib/explorar/portal";

const ROJO = "#C8323C";
const AZUL_CLARO = "#2B558F";
const AZUL_OSCURO = "#8DB0E3";
const TINTA = "#0F0F0F";
const PAPEL = "#FFFFFF";
const ZOOM_MAX_ENCUADRE = 15;
/** Desde este zoom cada pin dice su flujo (antes, grupos y puntos). */
export const ZOOM_ETIQUETAS = 15;
const TOPE_CARGA_MS = 12000;
const CENTRO_SANTIAGO = { lat: -33.4489, lng: -70.6393 };

const esClaro = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
/** EL MAPA EN OSCURO (30-oct-2026): el estilo oscuro de Franco (map-styles.ts: fondo oscuro, calles en gris medio, nombres
 *  legibles, agua y parques apagados) y el fondo mientras cargan las teselas. Sigue al tema del sitio y cambia al momento. */
const opcionesDeTema = () => (esClaro() ? { styles: francoMapStyleForTheme("light"), backgroundColor: "#F6F6F7" } : { styles: francoMapStyleForTheme("dark"), backgroundColor: "#1a1a1a" });
/** El elegido: en tinta sobre el mapa claro; sobre el oscuro la tinta se pierde, así que va en papel con el texto en tinta.
 *  Los rojos y el azul de los analizados se mantienen (el azul ya es el aclarado en oscuro), con su borde claro. */
const elegidoDeTema = () => (esClaro() ? { fondo: TINTA, texto: PAPEL } : { fondo: "#F2F2F0", texto: TINTA });
const svgUrl = (w: number, h: number, inner: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`)}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const iconoPunto = (color: string) => ({ url: svgUrl(18, 18, `<circle cx="9" cy="9" r="7" fill="${color}" stroke="${PAPEL}" stroke-width="2"/>`), w: 18, h: 18 });
/** El elegido sin cuenta (29-oct-2026, mockup 6-puerta-e, estado C): un punto más grande, sin texto (en tinta; en oscuro, papel). */
const iconoElegido = () => ({ url: svgUrl(26, 26, `<circle cx="13" cy="13" r="11" fill="${elegidoDeTema().fondo}" stroke="${esClaro() ? PAPEL : TINTA}" stroke-width="3"/>`), w: 26, h: 26 });
function iconoGrupo(n: number, color: string, tinta: string = PAPEL) {
  const w = n < 10 ? 34 : n < 100 ? 40 : n < 1000 ? 48 : 56;
  const t = n.toLocaleString("es-CL");
  return { url: svgUrl(w, w, `<circle cx="${w / 2}" cy="${w / 2}" r="${w / 2 - 1.5}" fill="${color}" stroke="${PAPEL}" stroke-width="2"/><text x="50%" y="50%" dy=".36em" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${tinta}">${t}</text>`), w, h: w };
}
/** La píldora de un pin con zoom: el texto (flujo, «✓ Analizado», «Nuevo hoy») sobre su color; el elegido, en tinta. */
function iconoEtiqueta(texto: string, fondo: string, elegido: boolean, tinta: string = PAPEL) {
  const w = Math.round(18 + texto.length * 6.9), h = elegido ? 30 : 26;
  const borde = elegido ? `stroke="${PAPEL}" stroke-width="2"` : `stroke="${PAPEL}" stroke-width="1"`;
  return { url: svgUrl(w + 4, h + 4, `<rect x="2" y="2" width="${w}" height="${h}" rx="${h / 2}" fill="${fondo}" ${borde}/><text x="${(w + 4) / 2}" y="${(h + 4) / 2}" dy=".36em" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${tinta}">${esc(texto)}</text>`), w: w + 4, h: h + 4 };
}

export interface MapaExplorarProps {
  pines: PinMapa[];
  analizados: ReadonlySet<string>;
  seleccionado: string | null;
  /** Cambia cuando cambian los filtros (no la zona): el mapa se vuelve a encuadrar sobre los pines. */
  encuadre: string;
  /** Hay una zona aplicada: el mapa no se reencuadra (la persona eligió dónde mirar). */
  conZona: boolean;
  onSeleccionar: (avisoId: string) => void;
  /** Tocar el mapa (fuera de un pin): cierra la tarjeta. */
  onTocarMapa?: () => void;
  /** La persona movió el mapa: la caja a la vista, para «Buscar en esta zona». */
  onMovido: (caja: Caja) => void;
  /** «listo»: el mapa existe; «teselas»: ya dibujó sus teselas (el mapa quieto se puede ir); «fallo»: no cargó. */
  onEstado: (estado: "listo" | "teselas" | "fallo") => void;
  /** Sin cuenta (29-oct-2026, la puerta E): con zoom, cada pin es solo el punto —el flujo no viaja al navegador—. */
  sinCifras?: boolean;
}

export default function MapaExplorar({ pines, analizados, seleccionado, encuadre, conZona, onSeleccionar, onTocarMapa, onMovido, onEstado, sinCifras = false }: MapaExplorarProps) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresRef = useRef<any[]>([]);
  const pinesRef = useRef(pines);
  const analizadosRef = useRef(analizados);
  const selRef = useRef(seleccionado);
  const cb = useRef({ onSeleccionar, onTocarMapa, onMovido, onEstado });
  const sinCifrasRef = useRef(sinCifras);
  pinesRef.current = pines; analizadosRef.current = analizados; selRef.current = seleccionado; sinCifrasRef.current = sinCifras;
  cb.current = { onSeleccionar, onTocarMapa, onMovido, onEstado };
  const dibujarRef = useRef<() => void>(() => {});
  const encuadrarRef = useRef<() => void>(() => {});
  // Los movimientos que hace el propio mapa (encuadrar, acercar a un grupo) no son «la persona movió el mapa».
  const propio = useRef(false);
  const tocado = useRef(false);

  useEffect(() => {
    let cancelado = false;
    const tope = window.setTimeout(() => { if (!mapRef.current) cb.current.onEstado("fallo"); }, TOPE_CARGA_MS);
    loadGoogleMaps().then(() => {
      if (cancelado || !divRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.Map) { cb.current.onEstado("fallo"); return; }
      window.clearTimeout(tope);
      const map = new g.maps.Map(divRef.current, {
        // El zoom al centro derecho: abajo lo tapaban la hoja y la tarjeta (QA en WebKit 390, 28-oct-2026).
        center: CENTRO_SANTIAGO, zoom: 11, disableDefaultUI: true, zoomControl: true, zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER }, clickableIcons: false,
        gestureHandling: "greedy", ...opcionesDeTema(),
      });
      mapRef.current = map;

      const limpiar = () => { for (const m of marcadoresRef.current) m.setMap(null); marcadoresRef.current = []; };
      const marcador = (pos: { lat: number; lng: number }, icono: { url: string; w: number; h: number }, zIndex: number, alTocar: () => void, titulo?: string) => {
        const m = new g.maps.Marker({ position: pos, map, zIndex, title: titulo, icon: { url: icono.url, scaledSize: new g.maps.Size(icono.w, icono.h), anchor: new g.maps.Point(icono.w / 2, icono.h / 2) } });
        m.addListener("click", alTocar);
        marcadoresRef.current.push(m);
      };
      dibujarRef.current = () => {
        const zoom = map.getZoom();
        const caja = map.getBounds();
        if (zoom == null) return;
        limpiar();
        const azul = esClaro() ? AZUL_CLARO : AZUL_OSCURO;
        const an = analizadosRef.current;
        // Solo lo que está a la vista: a Gran Santiago entero no hace falta dibujarle miles de marcadores.
        const visibles = caja ? pinesRef.current.filter((p) => caja.contains({ lat: p.lat, lng: p.lng })) : pinesRef.current;
        const sel = selRef.current;
        const porId = new Map(visibles.map((p) => [p.avisoId, p]));
        const ahora = new Date();
        for (const gr of agruparPines(visibles, zoom, an, zoom >= ZOOM_ETIQUETAS ? 44 : 56)) {
          if (gr.n === 1) {
            const id = gr.ids[0];
            const p = porId.get(id);
            if (!p) continue;
            const elegido = id === sel;
            if (sinCifrasRef.current) {
              marcador({ lat: p.lat, lng: p.lng }, elegido ? iconoElegido() : iconoPunto(ROJO), elegido ? 20 : 2, () => cb.current.onSeleccionar(id));
            } else if (zoom >= ZOOM_ETIQUETAS || elegido) {
              const t = textoPin(p, { analizado: an.has(id), ahora });
              const fondo = elegido ? elegidoDeTema().fondo : t.tipo === "analizado" ? azul : ROJO;
              marcador({ lat: p.lat, lng: p.lng }, iconoEtiqueta(t.texto, fondo, elegido, elegido ? elegidoDeTema().texto : t.tipo === "analizado" && !esClaro() ? TINTA : PAPEL), elegido ? 20 : t.tipo === "analizado" ? 4 : 3, () => cb.current.onSeleccionar(id), t.texto);
            } else {
              marcador({ lat: p.lat, lng: p.lng }, iconoPunto(an.has(id) ? azul : ROJO), an.has(id) ? 3 : 2, () => cb.current.onSeleccionar(id));
            }
          } else {
            const pos = { lat: gr.lat, lng: gr.lng };
            marcador(pos, iconoGrupo(gr.n, gr.analizados === gr.n ? azul : ROJO, gr.analizados === gr.n && !esClaro() ? TINTA : PAPEL), 1, () => { propio.current = true; map.setZoom(Math.min(zoom + 2, 18)); map.panTo(pos); });
          }
        }
        // El elegido, si quedó dentro de un grupo, igual se ve.
        const e = sel ? pinesRef.current.find((p) => p.avisoId === sel) : null;
        if (e && !(zoom >= ZOOM_ETIQUETAS) && !agruparPines(visibles, zoom, an, 56).some((gr) => gr.n === 1 && gr.ids[0] === sel)) {
          const t = textoPin(e, { analizado: an.has(e.avisoId), ahora });
          marcador({ lat: e.lat, lng: e.lng }, sinCifrasRef.current ? iconoElegido() : iconoEtiqueta(t.texto, elegidoDeTema().fondo, true, elegidoDeTema().texto), 20, () => cb.current.onSeleccionar(e.avisoId));
        }
      };
      encuadrarRef.current = () => {
        const ps = pinesRef.current;
        propio.current = true;
        if (ps.length === 0) { map.setCenter(CENTRO_SANTIAGO); map.setZoom(11); return; }
        const b = new g.maps.LatLngBounds();
        for (const p of ps) b.extend({ lat: p.lat, lng: p.lng });
        map.fitBounds(b, 40);
        g.maps.event.addListenerOnce(map, "idle", () => { if ((map.getZoom() ?? 0) > ZOOM_MAX_ENCUADRE) { propio.current = true; map.setZoom(ZOOM_MAX_ENCUADRE); } });
      };
      map.addListener("dragstart", () => { tocado.current = true; });
      map.addListener("zoom_changed", () => { if (!propio.current) tocado.current = true; });
      map.addListener("click", () => cb.current.onTocarMapa?.());
      map.addListener("idle", () => {
        dibujarRef.current();
        if (tocado.current && !propio.current) {
          const c = map.getBounds();
          if (c) { const s = c.getSouthWest(), n = c.getNorthEast(); cb.current.onMovido([s.lat(), s.lng(), n.lat(), n.lng()]); }
        }
        propio.current = false;
        tocado.current = false;
      });
      g.maps.event.addListenerOnce(map, "tilesloaded", () => cb.current.onEstado("teselas"));
      encuadrarRef.current();
      cb.current.onEstado("listo");
    }).catch(() => { if (!cancelado) cb.current.onEstado("fallo"); });
    return () => { cancelado = true; window.clearTimeout(tope); };
  }, []);

  // Cambió el tema del sitio (30-oct-2026): el estilo del mapa y los pines, al momento, sin volver a cargar el mapa.
  useEffect(() => {
    const o = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.setOptions(opcionesDeTema());
      dibujarRef.current();
    });
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);

  // Cambiaron los filtros (o llegó el universo): se encuadra de nuevo, salvo con una zona elegida.
  useEffect(() => { if (mapRef.current) { if (!conZona) encuadrarRef.current(); dibujarRef.current(); } }, [encuadre, conZona]);
  // Cambiaron los pines a la vista o el elegido: se redibuja; el elegido, si está fuera, se trae a la vista.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dibujarRef.current();
    const p = seleccionado ? pines.find((x) => x.avisoId === seleccionado) : null;
    const c = map.getBounds();
    if (p && c && !c.contains({ lat: p.lat, lng: p.lng })) { propio.current = true; map.panTo({ lat: p.lat, lng: p.lng }); }
  }, [seleccionado, pines, analizados]);

  return <div ref={divRef} className="ex-mapa" data-explorar="mapa" aria-label="Mapa de los deptos que convienen" role="application" />;
}
