// ─────────────────────────────────────────────────────────────────────────────
// COMPARTIR UN DEPTO DESDE EXPLORAR (02-nov-2026, goal de Fabrizio: «el bucle de referidos con inventario»). La parte pura,
// sin servidor ni navegador: la usan la tarjeta y la lista (el botón «Compartir»), la página que abre el enlace, la vista
// previa del servidor y el tier COMPARTIR-DEPTO. La forma del enlace vive en enlace-compartido.ts (la lee el middleware).
//   · EL BOTÓN «COMPARTIR», en la tarjeta del pin y en cada fila de la lista, con y sin cuenta. En el teléfono abre la hoja
//     de compartir del sistema (sin ella, WhatsApp); en el PC copia el enlace y lo dice.
//   · EL TEXTO QUE VIAJA: «Providencia · 2D2B · 79 m² · UF 4.591 · ✓ Comprar 84 al precio publicado, según Franco» y el
//     enlace. La línea del depto es la de siempre (linea-depto.ts: con « · Usado» o « · Nuevo» si el aviso lo dice).
//   · LO COMPARTIDO ES LO QUE VE QUIEN LO RECIBE: el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy), el mismo
//     de quien entra sin cuenta y de la vista previa. Si quien comparte miraba con otro pie, otro plazo u otra tasa, el
//     veredicto y el puntaje del texto son los de por defecto (los trae `GET /api/explorar/compartido`), nunca los suyos: el
//     texto no puede prometer un «Comprar» que quien abre el enlace no va a ver.
//   · LA VISTA PREVIA (lo que muestran WhatsApp y las redes): la imagen de la calle o el mapa chico, la línea, el precio y el
//     chip ✓ Comprar. Nada más: ni el puntaje, ni el flujo, ni el cap rate (`contenidoVistaPrevia`). El chip, solo si el
//     servidor comprueba que el depto da Comprar hoy con esos supuestos.
//   · SI YA NO ESTÁ PUBLICADO cuando se abre el enlace, la tarjeta lo dice y ofrece los parecidos que sí dan
//     (`parecidosQueDan`); si sigue publicado pero ya no está entre los que convienen, lo mismo con su frase.
//   · CON LA CAPA «SI NEGOCIAS» (capa-negociar.ts, el mismo 02-nov-2026): un negociado da Ajustar al precio publicado —su
//     Comprar es al precio negociado—, así que se comparte sin veredicto (`veredictoDelPin`), y quien abre su enlace lee que no
//     está entre los que convienen hoy al precio publicado (nunca «ya no»: no lo estuvo), con sus parecidos.
// ─────────────────────────────────────────────────────────────────────────────
import { lineaDepto, type CondicionDepto } from "@/lib/guia/linea-depto";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { AL_PRECIO_PUBLICADO } from "@/lib/precio-publicado";
import type { FiltrosPortal, ModalidadPortal, PinMapa } from "./portal";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** ¿Mira con el financiamiento por defecto? Solo entonces el veredicto y el puntaje de su pin son los que se comparten. */
export const esVistaEstandar = (f: Pick<FiltrosPortal, "pie" | "plazo" | "tasa">): boolean => f.pie === PIE_POR_DEFECTO && f.plazo === PLAZO_POR_DEFECTO && f.tasa == null;

/** EL VEREDICTO DEL PIN en la vista de por defecto: Comprar con su puntaje solo si el pin da Comprar. Un negociado de la capa
 *  «Si negocias» da Ajustar al precio publicado y se comparte sin veredicto, como el que no da con otro pie. */
export const veredictoDelPin = (p: Pick<PinMapa, "veredicto" | "score">): { comprar: boolean; score: number | null } =>
  p.veredicto === "COMPRAR" ? { comprar: true, score: p.score } : { comprar: false, score: null };

/** Lo que se sabe del depto para el texto, la vista previa y la tarjeta de «ya no está». */
export interface DeptoCompartido {
  comuna: string;
  tipologia: string | null;
  m2: number;
  condicion?: CondicionDepto;
  precioUF: number;
  dormitorios: number;
  lat: number | null;
  lng: number | null;
}

/** El depto de un pin del mapa (lo que el navegador ya tiene). */
export const deptoDePin = (p: PinMapa): DeptoCompartido => ({
  comuna: p.comuna, tipologia: p.tipologia, m2: p.m2, ...(p.condicion ? { condicion: p.condicion } : {}), precioUF: p.precioUF, dormitorios: p.dormitorios, lat: p.lat, lng: p.lng,
});

/** Cómo está el depto hoy, con el financiamiento por defecto: da Comprar, ya no da, o ya no está publicado. */
export type EstadoCompartido = "comprar" | "no-da" | "despublicado";

/** Lo que el servidor sabe de un depto compartido (compartir-servidor.ts › fichaCompartida). */
export interface FichaCompartida {
  avisoId: string;
  modalidad: ModalidadPortal;
  estado: EstadoCompartido;
  depto: DeptoCompartido;
  /** El puntaje con el financiamiento por defecto; solo con «comprar». */
  score: number | null;
}

/** «Providencia · 2D2B · 79 m² · UF 4.591»: la línea del depto y su precio. */
export const lineaConPrecio = (d: Pick<DeptoCompartido, "comuna" | "tipologia" | "m2" | "condicion" | "precioUF">): string => `${lineaDepto(d)} · UF ${miles(d.precioUF)}`;

/**
 * EL TEXTO QUE VIAJA (sin el enlace, que va aparte). Con el veredicto de por defecto: «… · ✓ Comprar 84 al precio
 * publicado, según Franco». Si con el financiamiento por defecto el depto no da Comprar (quien comparte miraba con otro pie),
 * sin veredicto: el enlace va igual, y quien lo abra ve lo que Franco dice con esos supuestos.
 */
export function textoCompartir(d: Pick<DeptoCompartido, "comuna" | "tipologia" | "m2" | "condicion" | "precioUF">, veredicto: { comprar: boolean; score: number | null }): string {
  if (!veredicto.comprar) return `${lineaConPrecio(d)} · ${COMPARTIR_COPY.sinVeredicto}`;
  return `${lineaConPrecio(d)} · ✓ Comprar${veredicto.score != null ? ` ${veredicto.score}` : ""} ${COMPARTIR_COPY.alPrecio}`;
}

/** El mensaje entero, como lo arma WhatsApp con la hoja del sistema: el texto y el enlace. */
export const mensajeCompartir = (texto: string, url: string): string => `${texto} ${url}`;

/**
 * LA VISTA PREVIA DEL ENLACE: el título y la descripción que leen WhatsApp y las redes, y lo que dibuja la imagen. La línea
 * del depto, el precio y el chip ✓ Comprar (solo si da Comprar hoy); NUNCA el puntaje, el flujo, el cap rate ni el arriendo:
 * el tier COMPARTIR-DEPTO lo exige campo por campo.
 */
export function contenidoVistaPrevia(f: Pick<FichaCompartida, "estado" | "depto">): { titulo: string; descripcion: string; linea: string; precio: string; chip: "COMPRAR" | null } {
  const comprar = f.estado === "comprar";
  return {
    titulo: lineaConPrecio(f.depto),
    descripcion: comprar ? COMPARTIR_COPY.vistaPrevia.comprar : f.estado === "despublicado" ? COMPARTIR_COPY.vistaPrevia.despublicado : COMPARTIR_COPY.vistaPrevia.noDa,
    linea: lineaDepto(f.depto),
    precio: `UF ${miles(f.depto.precioUF)}`,
    chip: comprar ? "COMPRAR" : null,
  };
}

/** La imagen de la vista previa (la ruta la genera y la deja en la caché del CDN). */
export const rutaVistaPrevia = (avisoId: string, modalidad: ModalidadPortal): string => `/api/og/depto/${encodeURIComponent(avisoId)}${modalidad === "str" ? "?m=str" : ""}`;

/**
 * LOS PARECIDOS QUE SÍ DAN, cuando el depto compartido ya no está: de los que convienen hoy (el universo a la vista), los de
 * su comuna con sus dormitorios y un precio parecido (±25 %), del más cercano al más lejano; si no alcanzan, los de su comuna
 * con un precio parecido; y si tampoco, los más cercanos. Nunca el mismo aviso.
 */
export const TOLERANCIA_PRECIO_PARECIDOS = 0.25;
export const MAX_PARECIDOS = 3;
export function parecidosQueDan(d: DeptoCompartido, pines: readonly PinMapa[], avisoId: string, max: number = MAX_PARECIDOS): PinMapa[] {
  const otros = pines.filter((p) => p.avisoId !== avisoId);
  const cos = Math.cos(((d.lat ?? -33.45) * Math.PI) / 180);
  const dist = (p: PinMapa) => (d.lat == null || d.lng == null ? Math.abs(p.precioUF - d.precioUF) : (p.lat - d.lat) ** 2 + ((p.lng - d.lng) * cos) ** 2);
  const precioParecido = (p: PinMapa) => Math.abs(p.precioUF - d.precioUF) <= d.precioUF * TOLERANCIA_PRECIO_PARECIDOS;
  const orden = (a: PinMapa, b: PinMapa) => dist(a) - dist(b) || a.avisoId.localeCompare(b.avisoId);
  const tandas = [
    otros.filter((p) => p.comuna === d.comuna && p.dormitorios === d.dormitorios && precioParecido(p)),
    otros.filter((p) => p.comuna === d.comuna && precioParecido(p)),
    otros,
  ];
  const out: PinMapa[] = [];
  const ya = new Set<string>();
  for (const t of tandas) {
    for (const p of [...t].sort(orden)) {
      if (out.length >= max) return out;
      if (ya.has(p.avisoId)) continue;
      ya.add(p.avisoId);
      out.push(p);
    }
  }
  return out;
}

/**
 * QUÉ ABRE EL ENLACE cuando llega el universo: la tarjeta de ese pin si está entre los que convienen (con los cercanos), o la
 * tarjeta de «ya no está» con los parecidos. `estado` es lo que dijo el servidor del aviso (publicado o no); si el servidor
 * no lo supo, un aviso que no está en el mapa se lee como «ya no está entre los que convienen».
 */
export function aperturaCompartida(p: { avisoId: string; estado: EstadoCompartido | null; depto: DeptoCompartido | null; visibles: readonly PinMapa[] }):
  | { tipo: "pin"; avisoId: string }
  | { tipo: "caido"; estado: Exclude<EstadoCompartido, "comprar">; depto: DeptoCompartido | null; parecidos: PinMapa[] } {
  if (p.visibles.some((x) => x.avisoId === p.avisoId)) return { tipo: "pin", avisoId: p.avisoId };
  const estado = p.estado === "despublicado" ? "despublicado" : "no-da";
  return { tipo: "caido", estado, depto: p.depto, parecidos: p.depto ? parecidosQueDan(p.depto, p.visibles, p.avisoId) : [] };
}

export const COMPARTIR_COPY = {
  boton: "Compartir",
  copiado: "Enlace copiado",
  noCopiado: "No pudimos copiar el enlace.",
  alPrecio: "al precio publicado, según Franco",
  sinVeredicto: "míralo en el mapa de Franco",
  /** El título del mensaje en la hoja del sistema (algunas apps lo muestran sobre el texto). */
  tituloHoja: "Un depto que conviene, según Franco",
  /** El de un depto que se comparte sin veredicto (un negociado, o uno que no da con el financiamiento por defecto). */
  tituloHojaSinVeredicto: "Un depto en el mapa de Franco",
  vistaPrevia: {
    comprar: "✓ Comprar al precio publicado, según Franco.",
    noDa: "Míralo en el mapa de Franco, con los que convienen hoy.",
    despublicado: "Este depto ya no está publicado. Mira los parecidos que sí convienen.",
    /** La línea de abajo de la imagen, con el chip. */
    pie: "Al precio publicado, según Franco.",
  },
  /** La tarjeta del depto que ya no está, cuando se abre el enlace. */
  caido: {
    despublicado: "Este depto ya no está publicado.",
    noDa: `Este depto no está entre los que convienen hoy ${AL_PRECIO_PUBLICADO}.`,
    parecidos: "Estos parecidos sí convienen:",
    sinParecidos: "Hoy no hay parecidos que convengan. Mira los demás en el mapa.",
    verMapa: "Ver el mapa",
    cerrar: "Cerrar",
  },
} as const;

/** Los eventos de compartir (PostHog). La vista del enlace sale del servidor, `explorar_compartido_vista` (vista-entrada.ts ›
 *  EVENTO_VISTA.compartido, eventoVistaCompartido). */
export const EVENTOS_COMPARTIR = {
  /** Tocó «Compartir»: `origen` (tarjeta · lista), `sin_cuenta`, `metodo` (hoja · whatsapp · copiar), `con_codigo`. */
  compartir: "explorar_compartir",
  /** El enlace abrió la tarjeta de «ya no está» (el navegador), con los parecidos que ofreció. */
  caido: "explorar_compartido_caido",
} as const;
export type OrigenCompartir = "tarjeta" | "lista";
export type MetodoCompartir = "hoja" | "whatsapp" | "copiar";
