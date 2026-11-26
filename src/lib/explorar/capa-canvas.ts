// ─────────────────────────────────────────────────────────────────────────────
// LA CAPA DE PINES EN CANVAS (25-nov-2026, aprobada por Fabrizio: «capa propia en canvas sobre el Google Maps de hoy»). Con los
// usados con veredicto (~19 mil) no caben marcadores de Google: en zoom 15 una pantalla de PC tiene más de 3 mil pines (medido el
// 25-nov). Esta es la parte pura —qué se dibuja, dónde y qué se tocó—, sin canvas ni Google (la prueba el tier EXPLORAR-TODOS):
//   · LEJOS (zoom < 15): celdas de 56 px; una celda con varios es un GRUPO con su número, en tinta; con uno solo, un PUNTO del color
//     de su clase.
//   · CERCA (zoom ≥ 15): cada depto con su cifra («UF 2.800»). Si dos chocan, uno queda como punto y la cifra la conserva el de MEJOR
//     PUNTAJE (decisión 6). El elegido va primero; los No conviene (sin puntaje) ceden ante Comprar y Ajustar.
//   · El elegido, si quedó dentro de un grupo, igual se ve: con su cifra, encima de todo.
// «Ver lista» sigue para teclado y lector de pantalla: el canvas no se recorre con el teclado.
// ─────────────────────────────────────────────────────────────────────────────
import { proyectar } from "./explorar";
import type { ClaseMapa } from "./mapa-todos";

// TRES DISTANCIAS (26-nov-2026, revisión de Claude y Fabrizio del preview): LEJOS (zoom ≤ 12) grupos negros con número; A MEDIA
// DISTANCIA (13 a 15) puntos de color sin precio, para que se vea dónde hay azules entre los rojos; CERCA (16 o más) el precio. Antes
// pasaba de grupos negros a la alfombra de etiquetas sin paso intermedio.
/** El número de un grupo, con un formateador compartido (26-nov-2026, entrega 2 › A1: no uno nuevo por grupo). */
const FMT_GRUPO = new Intl.NumberFormat("es-CL");
export const ZOOM_PUNTOS = 13;
export const ZOOM_CIFRAS = 16;
export const CELDA_LEJOS_PX = 56;
export const RADIO_PUNTO = 6;
/** A media distancia los puntos son más chicos: hay miles en la pantalla y tienen que leerse como manchas de color. */
export const RADIO_PUNTO_MEDIO = 4;
export const RADIO_GRUPO = 17;
export const ALTO_ETIQUETA = 24;
export const PADDING_ETIQUETA = 9;
/** Cuánto más allá del dibujo se acepta un toque (dedo). */
export const HOLGURA_TOQUE = 6;

/** Un depto para la capa. `puntaje`: el que decide quién conserva la cifra (null = el último). */
export interface ItemCapa { id: string; lat: number; lng: number; clase: ClaseMapa; texto: string; puntaje: number | null }

export type Dibujo =
  | { tipo: "grupo"; x: number; y: number; n: number; ids: string[]; lat: number; lng: number; texto: string; r: number }
  | { tipo: "punto"; x: number; y: number; id: string; clase: ClaseMapa; elegido: boolean; r?: number }
  | { tipo: "etiqueta"; x: number; y: number; w: number; h: number; id: string; clase: ClaseMapa; texto: string; elegido: boolean };

/** Lo que dibuja la capa, en orden (de abajo hacia arriba). `aPixel` lleva lat/lng a píxeles del contenedor; `ancho` mide un texto. */
export function componerCapa(items: readonly ItemCapa[], o: { zoom: number; elegido: string | null; aPixel: (lat: number, lng: number) => { x: number; y: number }; ancho: (texto: string) => number; vista: { w: number; h: number } }): Dibujo[] {
  const dentro = (x: number, y: number) => x > -60 && y > -30 && x < o.vista.w + 60 && y < o.vista.h + 30;
  const etiqueta = (it: ItemCapa, x: number, y: number, elegido: boolean): Dibujo & { tipo: "etiqueta" } => {
    const w = Math.ceil(o.ancho(it.texto)) + PADDING_ETIQUETA * 2;
    return { tipo: "etiqueta", x, y, w, h: ALTO_ETIQUETA, id: it.id, clase: it.clase, texto: it.texto, elegido };
  };
  const sel = o.elegido ? items.find((it) => it.id === o.elegido) ?? null : null;
  const out: Dibujo[] = [];

  if (o.zoom >= ZOOM_PUNTOS && o.zoom < ZOOM_CIFRAS) {
    // A MEDIA DISTANCIA: cada depto, un punto de su color, sin precio. Los rojos abajo y los azules arriba: se ve dónde hay Comprar.
    const puntos = items
      .filter((it) => it.id !== o.elegido)
      .map((it) => ({ it, p: o.aPixel(it.lat, it.lng) }))
      .filter(({ p }) => dentro(p.x, p.y))
      .sort((a, b) => rangoClase(b.it.clase) - rangoClase(a.it.clase) || a.it.id.localeCompare(b.it.id));
    out.push(...puntos.map(({ it, p }): Dibujo => ({ tipo: "punto", x: p.x, y: p.y, id: it.id, clase: it.clase, elegido: false, r: RADIO_PUNTO_MEDIO })));
  } else if (o.zoom < ZOOM_PUNTOS) {
    // LEJOS: celdas en la proyección del mapa (fijas al mundo, no a la pantalla: un grupo no salta al mover el mapa).
    const celdas = new Map<string, { sLat: number; sLng: number; ids: string[]; uno: ItemCapa }>();
    for (const it of items) {
      if (it.id === o.elegido) continue;
      const w = proyectar(it.lat, it.lng, o.zoom);
      const k = `${Math.floor(w.x / CELDA_LEJOS_PX)}:${Math.floor(w.y / CELDA_LEJOS_PX)}`;
      const c = celdas.get(k);
      if (c) { c.sLat += it.lat; c.sLng += it.lng; c.ids.push(it.id); } else celdas.set(k, { sLat: it.lat, sLng: it.lng, ids: [it.id], uno: it });
    }
    const puntos: Dibujo[] = [], grupos: Dibujo[] = [];
    for (const c of Array.from(celdas.values())) {
      const lat = c.sLat / c.ids.length, lng = c.sLng / c.ids.length;
      const p = o.aPixel(lat, lng);
      if (!dentro(p.x, p.y)) continue;
      if (c.ids.length === 1) puntos.push({ tipo: "punto", x: p.x, y: p.y, id: c.uno.id, clase: c.uno.clase, elegido: false });
      else {
        // El número entero («2.612»), y el círculo crece con él: nunca se sale.
        const texto = FMT_GRUPO.format(c.ids.length);
        grupos.push({ tipo: "grupo", x: p.x, y: p.y, n: c.ids.length, ids: c.ids, lat, lng, texto, r: Math.max(RADIO_GRUPO, Math.ceil(o.ancho(texto) / 2) + 7) });
      }
    }
    out.push(...puntos, ...grupos);
  } else {
    // CERCA: cifras. LA ETIQUETA VA PRIMERO PARA COMPRAR, DESPUÉS PARA AJUSTAR (26-nov-2026), y dentro de cada clase para el de mejor
    // puntaje; los No conviene llevan su precio solo si queda espacio. Si chocan, el otro queda como punto (todos siguen apareciendo).
    const orden = items
      .filter((it) => it.id !== o.elegido)
      .map((it) => ({ it, p: o.aPixel(it.lat, it.lng) }))
      .filter(({ p }) => dentro(p.x, p.y))
      .sort((a, b) => rangoClase(a.it.clase) - rangoClase(b.it.clase) || (b.it.puntaje ?? -1) - (a.it.puntaje ?? -1) || a.it.id.localeCompare(b.it.id));
    const puestas: Array<Dibujo & { tipo: "etiqueta" }> = [];
    const choca = (e: { x: number; y: number; w: number; h: number }) => puestas.some((q) => Math.abs(q.x - e.x) * 2 < q.w + e.w && Math.abs(q.y - e.y) * 2 < q.h + e.h);
    // El elegido reserva su lugar primero (se dibuja al final, encima).
    const eSel = sel ? etiqueta(sel, o.aPixel(sel.lat, sel.lng).x, o.aPixel(sel.lat, sel.lng).y, true) : null;
    if (eSel) puestas.push(eSel);
    const puntos: Dibujo[] = [];
    for (const { it, p } of orden) {
      const e = etiqueta(it, p.x, p.y, false);
      if (choca(e)) puntos.push({ tipo: "punto", x: p.x, y: p.y, id: it.id, clase: it.clase, elegido: false });
      else puestas.push(e);
    }
    // Los puntos, con los rojos abajo; las etiquetas encima.
    puntos.sort((a, b) => rangoClase((b as { clase: ClaseMapa }).clase) - rangoClase((a as { clase: ClaseMapa }).clase));
    out.push(...puntos, ...puestas.filter((e) => !e.elegido));
  }
  if (sel) {
    const p = o.aPixel(sel.lat, sel.lng);
    out.push(etiqueta(sel, p.x, p.y, true));
  }
  return out;
}

/** EL ENCUADRE AL ABRIR (26-nov-2026): la caja de los deptos sin el 2 % más extremo de cada lado, así el mapa abre en Gran Santiago y
 *  no en Melipilla y la cordillera por unos pocos avisos sueltos. null sin deptos. */
export function cajaRecortada(items: ReadonlyArray<{ lat: number; lng: number }>, recorte = 0.02): { s: number; w: number; n: number; e: number } | null {
  if (!items.length) return null;
  const lats = items.map((i) => i.lat).sort((a, b) => a - b), lngs = items.map((i) => i.lng).sort((a, b) => a - b);
  const k = Math.min(Math.floor(items.length * recorte), Math.floor((items.length - 1) / 2));
  return { s: lats[k], n: lats[items.length - 1 - k], w: lngs[k], e: lngs[items.length - 1 - k] };
}

/** El orden de las clases: Comprar, Ajustar, No conviene. */
const rangoClase = (c: ClaseMapa) => (c === "comprar" ? 0 : c === "ajustar" ? 1 : 2);

/** Qué se tocó en (x, y): lo de más arriba primero. null si nada. */
export function tocado(dibujos: readonly Dibujo[], x: number, y: number): Dibujo | null {
  for (let i = dibujos.length - 1; i >= 0; i--) {
    const d = dibujos[i];
    if (d.tipo === "etiqueta") {
      if (Math.abs(d.x - x) <= d.w / 2 + HOLGURA_TOQUE && Math.abs(d.y - y) <= d.h / 2 + HOLGURA_TOQUE) return d;
    } else {
      const r = (d.tipo === "grupo" ? d.r : d.r ?? RADIO_PUNTO) + HOLGURA_TOQUE;
      if ((d.x - x) ** 2 + (d.y - y) ** 2 <= r * r) return d;
    }
  }
  return null;
}
