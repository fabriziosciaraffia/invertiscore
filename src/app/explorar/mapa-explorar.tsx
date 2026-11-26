"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE EXPLORAR (23-oct-2026; como portal desde el 28-oct-2026; CON TODOS LOS DEPTOS desde el 25-nov-2026, láminas 5 y 8 del
// canvas «La asesoría en el mapa»): Google Maps con el estilo de Franco (map-styles.ts), cargado DESPUÉS del primer pintado (lo monta
// explorar-cliente.tsx por next/dynamic, con la página quieta).
// LOS PINES VAN EN UN CANVAS PROPIO sobre el mapa (25-nov-2026, aprobado por Fabrizio): ~19 mil usados con veredicto no caben en
// marcadores de Google (en zoom 15, más de 3 mil por pantalla). Qué se dibuja y qué se tocó vive en lib/explorar/capa-canvas.ts:
// lejos, grupos con número en tinta y puntos de color; cerca, la cifra de cada depto, y si dos chocan, la conserva el de mejor puntaje.
// Los colores salen de colores-pin.ts (Comprar azul, Ajustar ciruela, No conviene rojo). Tocar un grupo acerca; tocar un pin abre su
// tarjeta; tocar el mapa la cierra. Cuando LA PERSONA mueve el mapa (no el encuadre automático), avisa la caja para «Buscar en esta zona».
// EL CRÉDITO DE OPENSTREETMAP (25-nov-2026): el barrio o sector de la tarjeta sale de sus datos, y su licencia pide el crédito visible.
// EL ENLACE DE UN DEPTO COMPARTIDO (02-nov-2026): con `foco`, el primer encuadre se centra en el depto, de cerca (ZOOM_FOCO), una vez.
// LA VISTA SATELITAL (04-nov-2026; regla en lib/explorar/capa-mapa.ts): «Mapa | Satélite» junto al zoom.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { CAPA_MAPA_COPY, CAPAS_MAPA, guardarCapaMapa, leerCapaMapa, opcionesDeCapa, type CapaMapa } from "@/lib/explorar/capa-mapa";
import type { Caja } from "@/lib/explorar/portal";
import { cajaRecortada, componerCapa, RADIO_PUNTO, tocado, type Dibujo, type ItemCapa } from "@/lib/explorar/capa-canvas";
import { ANILLO_ELEGIDO_PX, ANILLO_PIN, ANILLO_PIN_PX, colorPin, type TemaPin } from "@/lib/explorar/colores-pin";
import { CREDITO_OSM } from "@/lib/explorar/lugar";

const ZOOM_MAX_ENCUADRE = 15;
/** El zoom con que se abre un depto compartido: de cuadra, con las cifras de los pines. */
export const ZOOM_FOCO = 16;
/** Desde este zoom cada pin dice su cifra (antes, grupos y puntos). */
export { ZOOM_CIFRAS as ZOOM_ETIQUETAS } from "@/lib/explorar/capa-canvas";
const TOPE_CARGA_MS = 12000;
const CENTRO_SANTIAGO = { lat: -33.4489, lng: -70.6393 };
/** Gran Santiago (las 25 comunas del mapa), para encuadrar antes de que lleguen los deptos. */
const CAJA_GRAN_SANTIAGO = { s: -33.62, w: -70.8, n: -33.34, e: -70.5 };
/** La letra de las cifras de los pines (la del sitio, Inter). */
const FUENTE_PIN = "700 12px Inter, system-ui, sans-serif";
const FUENTE_GRUPO = "700 12px Inter, system-ui, sans-serif";
/** Los grupos van en tinta, con su anillo blanco (lámina 5). */
const GRUPO = { fondo: "#141414", texto: "#FFFFFF" } as const;

/** El teléfono, para los controles del mapa: el mismo corte que explorar.css. */
const MEDIA_TELEFONO = "(max-width: 767px)";
const esTelefono = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MEDIA_TELEFONO).matches;
const esClaro = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
const opcionesDe = (capa: CapaMapa) => opcionesDeCapa(capa, esClaro());
const temaPin = (): TemaPin => (esClaro() ? "claro" : "oscuro");

/** «Mapa | Satélite» (04-nov-2026): dos posiciones, con el estilo de las opciones de la casa (la elegida, rellena en tinta). En el PC,
 *  así. EN EL TELÉFONO (26-nov-2026, pedido de Fabrizio: ocupaba mucho), un botón redondo de 40 px con el ícono de capas, «Tipo de mapa»,
 *  que abre las dos opciones; se cierran al elegir una, al tocar fuera o con Escape (el foco vuelve al botón). Los dos van dibujados y el
 *  CSS muestra el que corresponde (explorar.css, bajo 768 px). */
export function ConmutadorCapa({ capa, alCambiar }: { capa: CapaMapa; alCambiar: (c: CapaMapa) => void }) {
  return (
    <>
      <div className="ex-capa" role="radiogroup" aria-label={CAPA_MAPA_COPY.grupo} data-explorar="capa-mapa">
        {CAPAS_MAPA.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={capa === c} className="ex-capa-op" data-capa={c} onClick={() => alCambiar(c)}>{CAPA_MAPA_COPY[c]}</button>
        ))}
      </div>
      <CapaMovil capa={capa} alCambiar={alCambiar} />
    </>
  );
}

function CapaMovil({ capa, alCambiar }: { capa: CapaMapa; alCambiar: (c: CapaMapa) => void }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cerrar = (devolverFoco: boolean) => { setAbierto(false); if (devolverFoco) boton.current?.focus(); };
  useEffect(() => {
    if (!abierto) return;
    // Al abrir, el foco va a la opción elegida (el teclado sigue con las flechas).
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); cerrar(true); } };
    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("pointerdown", fuera, true); document.removeEventListener("keydown", tecla, true); };
  }, [abierto]);
  const flechas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const ops = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = ops.indexOf(document.activeElement as HTMLButtonElement);
    ops[(i + (e.key === "ArrowDown" ? 1 : ops.length - 1)) % ops.length]?.focus();
  };
  return (
    <div className="ex-capa-movil" ref={raiz} data-explorar="capa-movil">
      <button ref={boton} type="button" className="ex-capa-boton" aria-label={CAPA_MAPA_COPY.boton} aria-haspopup="true" aria-expanded={abierto} aria-controls="ex-capa-menu" data-explorar="capa-boton" onClick={() => setAbierto((x) => !x)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="m2 13 10 5 10-5" /><path d="m2 17.5 10 5 10-5" /></svg>
      </button>
      {abierto && (
        <div ref={menu} id="ex-capa-menu" className="ex-capa-menu" role="radiogroup" aria-label={CAPA_MAPA_COPY.grupo} data-explorar="capa-menu" onKeyDown={flechas}>
          {CAPAS_MAPA.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={capa === c} className="ex-capa-op" data-capa={c} onClick={() => { alCambiar(c); cerrar(true); }}>{CAPA_MAPA_COPY[c]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface MapaExplorarProps {
  /** Los deptos que se ven (ya filtrados, sin las clases apagadas), cada uno con su cifra. */
  items: ItemCapa[];
  seleccionado: string | null;
  /** Cambia cuando cambian los filtros (no la zona): el mapa se vuelve a encuadrar sobre los pines. */
  encuadre: string;
  /** Hay una zona aplicada: el mapa no se reencuadra (la persona eligió dónde mirar). */
  conZona: boolean;
  onSeleccionar: (avisoId: string) => void;
  /** Tocar el mapa (fuera de un pin): cierra la tarjeta. */
  onTocarMapa?: () => void;
  /** La persona movió el mapa: la caja a la vista. Desde el 26-nov-2026 nadie la usa («Buscar en esta zona» se fue: el mapa ya trae
   *  todos los deptos); queda opcional. */
  onMovido?: (caja: Caja) => void;
  /** «listo»: el mapa existe; «teselas»: ya dibujó sus teselas (el mapa quieto se puede ir); «fallo»: no cargó. */
  onEstado: (estado: "listo" | "teselas" | "fallo") => void;
  /** El punto donde centrarse en el próximo encuadre (el depto de un enlace compartido); `onFoco` avisa que se usó. */
  foco?: { lat: number; lng: number } | null;
  onFoco?: () => void;
  /** Los píxeles de abajo que tapa la hoja de la tarjeta en el teléfono (26-nov-2026): el pin elegido se corre arriba de ella. */
  tapaAbajo?: number;
}

/** Dibuja la capa en el canvas: puntos, grupos y cifras, con los colores de su clase y del tema. */
function pintar(ctx: CanvasRenderingContext2D, dibujos: readonly Dibujo[], tema: TemaPin) {
  const circulo = (x: number, y: number, r: number, fondo: string, anillo: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r + anillo, 0, Math.PI * 2);
    ctx.fillStyle = ANILLO_PIN;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fondo;
    ctx.fill();
  };
  for (const d of dibujos) {
    if (d.tipo === "punto") {
      circulo(d.x, d.y, d.r ?? RADIO_PUNTO, colorPin(d.clase, tema).fondo, d.r ? 1.5 : ANILLO_PIN_PX);
    } else if (d.tipo === "grupo") {
      ctx.shadowColor = "rgba(20,20,20,0.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      circulo(d.x, d.y, d.r - ANILLO_PIN_PX, GRUPO.fondo, ANILLO_PIN_PX);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = GRUPO.texto;
      ctx.font = FUENTE_GRUPO;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.texto, d.x, d.y + 0.5);
    } else {
      const c = colorPin(d.clase, tema);
      const anillo = d.elegido ? ANILLO_ELEGIDO_PX : 0;
      const w = d.w + anillo * 2, h = d.h + anillo * 2, x = d.x - w / 2, y = d.y - h / 2, r = h / 2;
      ctx.shadowColor = "rgba(20,20,20,0.25)"; ctx.shadowBlur = d.elegido ? 10 : 6; ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = d.elegido ? ANILLO_PIN : c.fondo;
      ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (d.elegido) {
        ctx.beginPath();
        ctx.roundRect(x + anillo, y + anillo, d.w, d.h, d.h / 2);
        ctx.fillStyle = c.fondo;
        ctx.fill();
      }
      ctx.fillStyle = c.texto;
      ctx.font = FUENTE_PIN;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.texto, d.x, d.y + 0.5);
    }
  }
}

/** Lo de arriba que tapa el contador plegado, en el teléfono: el pin elegido no se corre debajo de él. */
const TAPA_ARRIBA_PX = 72;
/** El aire entre el pin elegido y el borde de la hoja. */
const AIRE_PIN_PX = 28;
/** Cuántos movimientos del mapa se revisa que el pin elegido quede a la vista. */
const INTENTOS_VISIBLE = 3;

export default function MapaExplorar({ items, seleccionado, encuadre, conZona, onSeleccionar, onTocarMapa, onMovido, onEstado, foco = null, onFoco, tapaAbajo = 0 }: MapaExplorarProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proyRef = useRef<any>(null);
  const itemsRef = useRef(items);
  const selRef = useRef(seleccionado);
  const dibujosRef = useRef<Dibujo[]>([]);
  const cb = useRef({ onSeleccionar, onTocarMapa, onMovido, onEstado, onFoco });
  const focoRef = useRef(foco);
  itemsRef.current = items; selRef.current = seleccionado; focoRef.current = foco;
  cb.current = { onSeleccionar, onTocarMapa, onMovido, onEstado, onFoco };
  const dibujarRef = useRef<() => void>(() => {});
  const revisionRef = useRef<HTMLSpanElement>(null);
  // EL PIN ELEGIDO, ARRIBA DE LA HOJA (26-nov-2026): en el teléfono la tarjeta es una hoja abajo; si el pin queda debajo de ella (o debajo
  // del contador), el mapa se corre solo hasta dejarlo en el medio de lo que se ve. «ok»: ya se ve; «corrido»: se movió; «espera»: el
  // mapa todavía no tiene proyección.
  const tapaRef = useRef(tapaAbajo);
  tapaRef.current = tapaAbajo;
  const pendienteVisible = useRef(0);
  const asegurarVisible = (): "ok" | "corrido" | "espera" => {
    const map = mapRef.current, proy = proyRef.current?.getProjection?.(), div = divRef.current;
    const p = selRef.current ? itemsRef.current.find((x) => x.id === selRef.current) : null;
    if (!p || !tapaRef.current) return "ok";
    if (!map || !proy || !div) return "espera";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    const px = proy.fromLatLngToContainerPixel(new g.maps.LatLng(p.lat, p.lng));
    const arriba = TAPA_ARRIBA_PX, abajo = div.clientHeight - tapaRef.current - AIRE_PIN_PX;
    if (!px || abajo <= arriba || (px.y <= abajo && px.y >= arriba)) return "ok";
    propio.current = true;
    map.panBy(0, Math.round(px.y - (arriba + abajo) / 2));
    return "corrido";
  };
  const encuadrarRef = useRef<() => void>(() => {});
  // Los movimientos que hace el propio mapa (encuadrar, acercar a un grupo) no son «la persona movió el mapa».
  const propio = useRef(false);
  const tocadoRef = useRef(false);
  const [capa, setCapa] = useState<CapaMapa>("mapa");
  const capaRef = useRef(capa);
  capaRef.current = capa;
  const [control, setControl] = useState<HTMLDivElement | null>(null);
  const almacenLocal = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
  useEffect(() => { const c = leerCapaMapa(almacenLocal()); if (c !== "mapa") setCapa(c); }, []);
  const cambiarCapa = (c: CapaMapa) => { setCapa(c); guardarCapaMapa(almacenLocal(), c); };

  useEffect(() => {
    let cancelado = false;
    let cuadro = 0;
    let quitarAncho = () => {};
    const tope = window.setTimeout(() => { if (!mapRef.current) cb.current.onEstado("fallo"); }, TOPE_CARGA_MS);
    loadGoogleMaps().then(() => {
      if (cancelado || !divRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.Map) { cb.current.onEstado("fallo"); return; }
      window.clearTimeout(tope);
      const map = new g.maps.Map(divRef.current, {
        center: CENTRO_SANTIAGO, zoom: 11, disableDefaultUI: true, zoomControl: !esTelefono(), zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER }, clickableIcons: false,
        // SIN STREET VIEW NI PANTALLA COMPLETA (26-nov-2026), en el teléfono y en el PC: apagados de forma explícita, en el mapa y en la
        // vista de calle que Google le monta adentro (su botón de pantalla completa vivía escondido en el DOM).
        streetViewControl: false, fullscreenControl: false, mapTypeControl: false,
        gestureHandling: "greedy", ...opcionesDe(capaRef.current),
      });
      map.getStreetView()?.setOptions({ fullscreenControl: false, addressControl: false, enableCloseButton: false });
      // SIN ZOOM EN EL TELÉFONO (26-nov-2026): bajo 768 px se acerca con dos dedos; en el PC quedan el más y el menos. Sigue al ancho.
      const telefono = window.matchMedia(MEDIA_TELEFONO);
      const alCambiarAncho = () => map.setOptions({ zoomControl: !telefono.matches });
      telefono.addEventListener("change", alCambiarAncho);
      quitarAncho = () => telefono.removeEventListener("change", alCambiarAncho);
      mapRef.current = map;
      const ctl = document.createElement("div");
      ctl.className = "ex-capa-ctl";
      map.controls[g.maps.ControlPosition.RIGHT_CENTER].push(ctl);
      setControl(ctl);
      // EL CANVAS VIVE EN UNA CAPA DEL MAPA (overlayLayer), debajo de los controles de Google: un pin nunca tapa el zoom ni «Mapa |
      // Satélite». Cada dibujo lo pone sobre lo que se ve; al arrastrar se mueve con el mapa sin redibujar.
      const lienzo = document.createElement("canvas");
      lienzo.className = "ex-lienzo";
      lienzo.setAttribute("data-explorar", "lienzo");
      lienzo.setAttribute("aria-hidden", "true");
      lienzoRef.current = lienzo;
      const ov = new g.maps.OverlayView();
      ov.onAdd = () => { ov.getPanes()?.overlayLayer.appendChild(lienzo); };
      ov.draw = () => { dibujarRef.current(); };
      ov.onRemove = () => { lienzo.remove(); };
      ov.setMap(map);
      proyRef.current = ov;

      // EL DIBUJO: un cuadro por vez (el mapa avisa muchas veces por segundo mientras se arrastra).
      const pintarYa = () => {
        const lienzo = lienzoRef.current, div = divRef.current, proy = ov.getProjection?.();
        const zoom = map.getZoom();
        if (!lienzo || !div || !proy || zoom == null) return;
        const w = div.clientWidth, h = div.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
          lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
          lienzo.style.width = `${w}px`; lienzo.style.height = `${h}px`;
        }
        // La esquina de arriba a la izquierda de lo que se ve, en píxeles de la capa: ahí va el canvas.
        const esquina = proy.fromLatLngToDivPixel(proy.fromContainerPixelToLatLng(new g.maps.Point(0, 0)));
        lienzo.style.left = `${esquina.x}px`; lienzo.style.top = `${esquina.y}px`;
        const ctx = lienzo.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.font = FUENTE_PIN;
        const anchos = new Map<string, number>();
        const ancho = (t: string) => { let a = anchos.get(t); if (a == null) { a = ctx.measureText(t).width; anchos.set(t, a); } return a; };
        const dibujos = componerCapa(itemsRef.current, {
          zoom, elegido: selRef.current, ancho, vista: { w, h },
          aPixel: (lat, lng) => { const p = proy.fromLatLngToContainerPixel(new g.maps.LatLng(lat, lng)); return { x: p.x, y: p.y }; },
        });
        dibujosRef.current = dibujos;
        // Para la revisión sin mirar el canvas: dónde quedó el pin elegido (alto en píxeles del contenedor del mapa).
        const elegido = dibujos.find((d) => d.tipo !== "grupo" && d.elegido);
        revisionRef.current?.setAttribute("data-elegido-y", elegido ? String(Math.round(elegido.y)) : "");
        pintar(ctx, dibujos, temaPin());
      };
      dibujarRef.current = () => { if (cuadro) return; cuadro = window.requestAnimationFrame(() => { cuadro = 0; pintarYa(); }); };

      encuadrarRef.current = () => {
        const ps = itemsRef.current;
        propio.current = true;
        const f = focoRef.current;
        // Encuadrar mueve el mapa: si hay una tarjeta abierta en el teléfono, al terminar se vuelve a revisar que su pin quede arriba de la
        // hoja (el centro del foco de un enlace caía justo debajo de ella).
        pendienteVisible.current = INTENTOS_VISIBLE;
        if (f) { map.setCenter(f); map.setZoom(ZOOM_FOCO); focoRef.current = null; cb.current.onFoco?.(); return; }
        // ENCUADRADO EN GRAN SANTIAGO (26-nov-2026): la caja de los deptos sin el 2 % más extremo de cada lado (unos pocos avisos sueltos
        // abrían el mapa en Melipilla y la cordillera); sin deptos todavía, la caja fija de Gran Santiago.
        const caja = cajaRecortada(ps) ?? CAJA_GRAN_SANTIAGO;
        map.fitBounds(new g.maps.LatLngBounds({ lat: caja.s, lng: caja.w }, { lat: caja.n, lng: caja.e }), 24);
        g.maps.event.addListenerOnce(map, "idle", () => { if ((map.getZoom() ?? 0) > ZOOM_MAX_ENCUADRE) { propio.current = true; map.setZoom(ZOOM_MAX_ENCUADRE); } });
      };
      // EL TOQUE: el mapa recibe el clic (el canvas no captura nada) y la capa dice qué se tocó.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queHay = (e: any): Dibujo | null => {
        const proy = ov.getProjection?.();
        if (!proy || !e?.latLng) return null;
        const p = proy.fromLatLngToContainerPixel(e.latLng);
        return tocado(dibujosRef.current, p.x, p.y);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addListener("click", (e: any) => {
        const d = queHay(e);
        if (!d) { cb.current.onTocarMapa?.(); return; }
        if (d.tipo === "grupo") { propio.current = true; map.setZoom(Math.min((map.getZoom() ?? 11) + 2, 18)); map.panTo({ lat: d.lat, lng: d.lng }); return; }
        cb.current.onSeleccionar(d.id);
      });
      // La mano sobre un pin o un grupo (en el PC).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addListener("mousemove", (e: any) => { map.setOptions({ draggableCursor: queHay(e) ? "pointer" : null }); });
      map.addListener("bounds_changed", () => dibujarRef.current());
      map.addListener("dragstart", () => { tocadoRef.current = true; });
      map.addListener("zoom_changed", () => { if (!propio.current) tocadoRef.current = true; });
      map.addListener("idle", () => {
        dibujarRef.current();
        // Pendiente de dejar el pin elegido arriba de la hoja: se revisa al terminar cada movimiento, hasta que se vea (o se agoten los
        // intentos, para no pelear con nada).
        if (pendienteVisible.current > 0) { pendienteVisible.current -= 1; if (asegurarVisible() === "ok") pendienteVisible.current = 0; }
        if (tocadoRef.current && !propio.current) {
          const c = map.getBounds();
          if (c) { const s = c.getSouthWest(), n = c.getNorthEast(); cb.current.onMovido?.([s.lat(), s.lng(), n.lat(), n.lng()]); }
        }
        propio.current = false;
        tocadoRef.current = false;
      });
      g.maps.event.addListenerOnce(map, "tilesloaded", () => cb.current.onEstado("teselas"));
      encuadrarRef.current();
      cb.current.onEstado("listo");
    }).catch(() => { if (!cancelado) cb.current.onEstado("fallo"); });
    return () => { cancelado = true; quitarAncho(); window.clearTimeout(tope); if (cuadro) window.cancelAnimationFrame(cuadro); };
  }, []);

  // Cambió el tema del sitio (30-oct-2026): el estilo del mapa y los pines, al momento, sin volver a cargar el mapa.
  useEffect(() => {
    const o = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.setOptions(opcionesDe(capaRef.current));
      dibujarRef.current();
    });
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);
  // Redibuja al cambiar el tamaño del contenedor (rotar el teléfono, abrir la lista en el PC).
  useEffect(() => {
    const div = divRef.current;
    if (!div || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => dibujarRef.current());
    o.observe(div);
    return () => o.disconnect();
  }, []);

  useEffect(() => { const map = mapRef.current; if (map) { map.setOptions(opcionesDe(capa)); dibujarRef.current(); } }, [capa]);
  useEffect(() => { if (mapRef.current) { if (!conZona) encuadrarRef.current(); dibujarRef.current(); } }, [encuadre, conZona]);
  useEffect(() => { if (mapRef.current && focoRef.current) { encuadrarRef.current(); dibujarRef.current(); } }, [foco]);
  // Cambiaron los pines o el elegido: se redibuja; el elegido, si está fuera, se trae a la vista.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dibujarRef.current();
    const p = seleccionado ? items.find((x) => x.id === seleccionado) : null;
    const c = map.getBounds();
    if (p && c && !c.contains({ lat: p.lat, lng: p.lng })) { propio.current = true; map.panTo({ lat: p.lat, lng: p.lng }); }
    // EL PIN ELEGIDO, ARRIBA DE LA HOJA (26-nov-2026): se revisa ahora y, mientras quede pendiente, al terminar cada movimiento del mapa
    // (el encuadre de entrada o el panTo de recién pueden moverlo después): así el pin no se pierde debajo de la hoja.
    if (!p || !tapaAbajo) { pendienteVisible.current = 0; return; }
    pendienteVisible.current = INTENTOS_VISIBLE;
    if (asegurarVisible() === "ok") pendienteVisible.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado, items, tapaAbajo]);

  return (
    <>
      <div ref={divRef} className="ex-mapa" data-explorar="mapa" data-vista={capa} aria-label="Mapa de los deptos con su veredicto" role="application" />
      <p className="ex-credito-osm" data-explorar="credito-osm">{CREDITO_OSM}</p>
      {control && createPortal(<ConmutadorCapa capa={capa} alCambiar={cambiarCapa} />, control)}
      {/* Para revisar sin mirar el canvas: cuántos dibujos hay y de qué clase (lo lee la revisión con Playwright). */}
      <span hidden ref={revisionRef} data-explorar="pines-dibujados" data-n={items.length} />

    </>
  );
}
