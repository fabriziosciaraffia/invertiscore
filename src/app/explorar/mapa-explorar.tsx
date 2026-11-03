"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE EXPLORAR (23-oct-2026; como portal desde el 28-oct-2026, 5b-explorar-portal.html): Google Maps con el estilo de
// Franco (map-styles.ts), cargado DESPUÉS del primer pintado (lo monta explorar-cliente.tsx por next/dynamic, con la página
// quieta). LEJOS, GRUPOS CON NÚMERO (explorar.ts › agruparPines, por celdas de la proyección a cada zoom); CON ZOOM, cada pin
// dice su flujo mensual («+$142 mil»), los ya analizados por la cuenta dicen «✓ Analizado» y los aparecidos en las últimas 24
// horas, «Nuevo hoy» (portal.ts › textoPin). Tocar un grupo acerca; tocar un pin abre su tarjeta; tocar el mapa la cierra.
// Cuando LA PERSONA mueve el mapa (no el encuadre automático), avisa la caja para «Buscar en esta zona». Usa
// `google.maps.Marker` como el resto del sitio (AdvancedMarkerElement exige un Map ID).
// LOS COLORES (03-nov-2026, la pasada real de Fabrizio; colores-pin.ts, uno solo para todos los mapas): ✓ Comprar en el azul del
// chip Comprar, − Ajustar en la ciruela del chip Ajustar, los ya analizados en tinta con un ✓ blanco; el elegido, el mismo color
// más grande y con el anillo blanco más grueso; los grupos, del color de su clase. ROJO EN NINGÚN PIN (hasta el 03-nov los que
// convienen iban en rojo, los analizados en azul y el elegido en tinta).
// LOS − AJUSTAR (02-nov-2026, capa-negociar.ts; de entrada desde el 03-nov): se agrupan y se dibujan APARTE; con zoom, el pin
// dice el descuento («−4,2 % dcto.»). Debajo de los ✓ Comprar; lejos, el grupo que uno de ellos tapa se corre a su borde
// (satélite).
// EL ENLACE DE UN DEPTO COMPARTIDO (02-nov-2026): con `foco`, el primer encuadre no abarca los pines sino que se centra en el
// depto, de cerca (ZOOM_FOCO, con su etiqueta), una vez; después los filtros encuadran como siempre.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { francoMapStyleForTheme } from "@/lib/map-styles";
import { agruparPines, proyectar } from "@/lib/explorar/explorar";
import { textoPin, type Caja, type PinMapa } from "@/lib/explorar/portal";
import { NEGOCIAR_COPY, satelite, type Circulo, type PinNegociado } from "@/lib/explorar/capa-negociar";
import type { ClasePin, TemaPin } from "@/lib/explorar/colores-pin";
import { iconoPin } from "@/lib/explorar/iconos-pin";
const ZOOM_MAX_ENCUADRE = 15;
/** El zoom con que se abre un depto compartido: de cuadra, con las etiquetas de los pines (ZOOM_ETIQUETAS). */
export const ZOOM_FOCO = 16;
/** Desde este zoom cada pin dice su flujo (antes, grupos y puntos). */
export const ZOOM_ETIQUETAS = 15;
const TOPE_CARGA_MS = 12000;
const CENTRO_SANTIAGO = { lat: -33.4489, lng: -70.6393 };

const esClaro = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
/** EL MAPA EN OSCURO (30-oct-2026): el estilo oscuro de Franco (map-styles.ts: fondo oscuro, calles en gris medio, nombres
 *  legibles, agua y parques apagados) y el fondo mientras cargan las teselas. Sigue al tema del sitio y cambia al momento. */
const opcionesDeTema = () => (esClaro() ? { styles: francoMapStyleForTheme("light"), backgroundColor: "#F6F6F7" } : { styles: francoMapStyleForTheme("dark"), backgroundColor: "#1a1a1a" });
const temaPin = (): TemaPin => (esClaro() ? "claro" : "oscuro");

export interface MapaExplorarProps {
  pines: PinMapa[];
  /** La capa «Si negocias» (vacía si está apagada): aparte, en el color de Ajustar. */
  negociados?: PinNegociado[];
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
  /** El punto donde centrarse en el próximo encuadre (el depto de un enlace compartido); `onFoco` avisa que se usó. */
  foco?: { lat: number; lng: number } | null;
  onFoco?: () => void;
}

export default function MapaExplorar({ pines, negociados = [], analizados, seleccionado, encuadre, conZona, onSeleccionar, onTocarMapa, onMovido, onEstado, sinCifras = false, foco = null, onFoco }: MapaExplorarProps) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresRef = useRef<any[]>([]);
  const pinesRef = useRef(pines);
  const negociadosRef = useRef(negociados);
  const analizadosRef = useRef(analizados);
  const selRef = useRef(seleccionado);
  const cb = useRef({ onSeleccionar, onTocarMapa, onMovido, onEstado, onFoco });
  const sinCifrasRef = useRef(sinCifras);
  const focoRef = useRef(foco);
  pinesRef.current = pines; negociadosRef.current = negociados; analizadosRef.current = analizados; selRef.current = seleccionado; sinCifrasRef.current = sinCifras; focoRef.current = foco;
  cb.current = { onSeleccionar, onTocarMapa, onMovido, onEstado, onFoco };
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
      // `corrido`: el ícono se dibuja corrido de su punto, en píxeles (el satélite de la capa «Si negocias»).
      const marcador = (pos: { lat: number; lng: number }, icono: { url: string; w: number; h: number }, zIndex: number, alTocar: () => void, titulo?: string, corrido = { dx: 0, dy: 0 }) => {
        const m = new g.maps.Marker({ position: pos, map, zIndex, title: titulo, icon: { url: icono.url, scaledSize: new g.maps.Size(icono.w, icono.h), anchor: new g.maps.Point(icono.w / 2 - corrido.dx, icono.h / 2 - corrido.dy) } });
        m.addListener("click", alTocar);
        marcadoresRef.current.push(m);
      };
      dibujarRef.current = () => {
        const zoom = map.getZoom();
        const caja = map.getBounds();
        if (zoom == null) return;
        limpiar();
        // Todo ícono sale de iconoPin, con el color de su clase y del tema (colores-pin.ts): ni un color escrito acá.
        const tema = temaPin();
        const punto = (c: ClasePin, elegido = false) => iconoPin(c, tema, { forma: "punto" }, elegido);
        const etiqueta = (c: ClasePin, texto: string, elegido = false) => iconoPin(c, tema, { forma: "etiqueta", texto }, elegido);
        const grupo = (c: ClasePin, n: number) => iconoPin(c, tema, { forma: "grupo", n });
        const an = analizadosRef.current;
        // Solo lo que está a la vista: a Gran Santiago entero no hace falta dibujarle miles de marcadores.
        const visibles = caja ? pinesRef.current.filter((p) => caja.contains({ lat: p.lat, lng: p.lng })) : pinesRef.current;
        const sel = selRef.current;
        const porId = new Map(visibles.map((p) => [p.avisoId, p]));
        const ahora = new Date();
        // Los círculos de los ✓ Comprar de este dibujo (grupos y puntos), para correr los − Ajustar que tapan.
        const arriba: Circulo[] = [];
        const circulo = (lat: number, lng: number, r: number) => ({ ...proyectar(lat, lng, zoom), r });
        const agrupaEn = zoom >= ZOOM_ETIQUETAS ? 44 : 56;
        for (const gr of agruparPines(visibles, zoom, an, agrupaEn)) {
          if (gr.n === 1) {
            const id = gr.ids[0];
            const p = porId.get(id);
            if (!p) continue;
            const elegido = id === sel;
            if (sinCifrasRef.current) {
              // Sin cuenta: puntos sin número (el flujo no viaja); el elegido, el mismo azul más grande.
              marcador({ lat: p.lat, lng: p.lng }, punto("comprar", elegido), elegido ? 20 : 2, () => cb.current.onSeleccionar(id));
              if (!elegido) arriba.push(circulo(p.lat, p.lng, 9));
            } else if (zoom >= ZOOM_ETIQUETAS || elegido) {
              const t = textoPin(p, { analizado: an.has(id), ahora });
              marcador({ lat: p.lat, lng: p.lng }, etiqueta(t.tipo === "analizado" ? "analizado" : "comprar", t.texto, elegido), elegido ? 20 : t.tipo === "analizado" ? 4 : 3, () => cb.current.onSeleccionar(id), t.texto);
            } else {
              arriba.push(circulo(p.lat, p.lng, 9));
              marcador({ lat: p.lat, lng: p.lng }, punto(an.has(id) ? "analizado" : "comprar"), an.has(id) ? 3 : 2, () => cb.current.onSeleccionar(id));
            }
          } else {
            const pos = { lat: gr.lat, lng: gr.lng };
            const icono = grupo(gr.analizados === gr.n ? "analizado" : "comprar", gr.n);
            arriba.push(circulo(gr.lat, gr.lng, icono.w / 2));
            marcador(pos, icono, 1, () => { propio.current = true; map.setZoom(Math.min(zoom + 2, 18)); map.panTo(pos); });
          }
        }
        // LOS − AJUSTAR (02-nov-2026; de entrada desde el 03-nov): sus propios grupos y pines, en la ciruela del chip, debajo de los
        // ✓ Comprar. Con zoom, el descuento («−4,2 % dcto.»); el elegido, la misma ciruela más grande. Sin cuenta, puntos.
        const negs = caja ? negociadosRef.current.filter((p) => caja.contains({ lat: p.lat, lng: p.lng })) : negociadosRef.current;
        const negPorId = new Map(negs.map((p) => [p.avisoId, p]));
        const gruposNeg = agruparPines(negs, zoom, new Set<string>(), agrupaEn);
        for (const gr of gruposNeg) {
          if (gr.n === 1) {
            const id = gr.ids[0];
            const p = negPorId.get(id);
            if (!p) continue;
            const elegido = id === sel;
            // Sin cuenta, como el resto: puntos sin número (el descuento no viaja).
            if (sinCifrasRef.current) marcador({ lat: p.lat, lng: p.lng }, punto("ajustar", elegido), elegido ? 20 : 1, () => cb.current.onSeleccionar(id), undefined, elegido ? undefined : satelite(circulo(p.lat, p.lng, 9), arriba));
            else if (zoom >= ZOOM_ETIQUETAS || elegido) {
              const texto = NEGOCIAR_COPY.pin(p.neg.d);
              marcador({ lat: p.lat, lng: p.lng }, etiqueta("ajustar", texto, elegido), elegido ? 20 : 1, () => cb.current.onSeleccionar(id), texto);
            } else marcador({ lat: p.lat, lng: p.lng }, punto("ajustar"), 1, () => cb.current.onSeleccionar(id), undefined, satelite(circulo(p.lat, p.lng, 9), arriba));
          } else {
            const pos = { lat: gr.lat, lng: gr.lng };
            const icono = grupo("ajustar", gr.n);
            marcador(pos, icono, 0, () => { propio.current = true; map.setZoom(Math.min(zoom + 2, 18)); map.panTo(pos); }, undefined, satelite(circulo(gr.lat, gr.lng, icono.w / 2), arriba));
          }
        }
        // El elegido, si quedó dentro de un grupo, igual se ve: del color de su clase, más grande.
        const e = sel ? pinesRef.current.find((p) => p.avisoId === sel) : null;
        if (e && !(zoom >= ZOOM_ETIQUETAS) && !agruparPines(visibles, zoom, an, agrupaEn).some((gr) => gr.n === 1 && gr.ids[0] === sel)) {
          const t = textoPin(e, { analizado: an.has(e.avisoId), ahora });
          const clase: ClasePin = an.has(e.avisoId) ? "analizado" : "comprar";
          marcador({ lat: e.lat, lng: e.lng }, sinCifrasRef.current ? punto(clase, true) : etiqueta(clase, t.texto, true), 20, () => cb.current.onSeleccionar(e.avisoId));
        }
        const en = sel && !e ? negociadosRef.current.find((p) => p.avisoId === sel) : null;
        if (en && !(zoom >= ZOOM_ETIQUETAS) && !gruposNeg.some((gr) => gr.n === 1 && gr.ids[0] === sel)) {
          marcador({ lat: en.lat, lng: en.lng }, sinCifrasRef.current ? punto("ajustar", true) : etiqueta("ajustar", NEGOCIAR_COPY.pin(en.neg.d), true), 20, () => cb.current.onSeleccionar(en.avisoId));
        }
      };
      encuadrarRef.current = () => {
        const ps = pinesRef.current;
        propio.current = true;
        // El depto de un enlace compartido: centrado y de cerca, una vez.
        const f = focoRef.current;
        if (f) { map.setCenter(f); map.setZoom(ZOOM_FOCO); focoRef.current = null; cb.current.onFoco?.(); return; }
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

  // Cambiaron los filtros (o llegó el universo): se encuadra de nuevo, salvo con una zona elegida. Llegó un foco (el depto
  // compartido, cuando el universo dice dónde está): se centra en él.
  useEffect(() => { if (mapRef.current) { if (!conZona) encuadrarRef.current(); dibujarRef.current(); } }, [encuadre, conZona]);
  useEffect(() => { if (mapRef.current && focoRef.current) { encuadrarRef.current(); dibujarRef.current(); } }, [foco]);
  // Cambiaron los pines a la vista o el elegido: se redibuja; el elegido, si está fuera, se trae a la vista.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dibujarRef.current();
    const p = seleccionado ? pines.find((x) => x.avisoId === seleccionado) ?? negociados.find((x) => x.avisoId === seleccionado) : null;
    const c = map.getBounds();
    if (p && c && !c.contains({ lat: p.lat, lng: p.lng })) { propio.current = true; map.panTo({ lat: p.lat, lng: p.lng }); }
  }, [seleccionado, pines, negociados, analizados]);

  return <div ref={divRef} className="ex-mapa" data-explorar="mapa" aria-label="Mapa de los deptos que convienen" role="application" />;
}
