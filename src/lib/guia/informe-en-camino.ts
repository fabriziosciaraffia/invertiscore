// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME EN CAMINO (03-nov-2026, decisión de Fabrizio tras el caso de fsm@ en /explorar). Lo que pasa entre tocar «Analizar»
// y ver el informe, igual en Explorar, la selección, el dashboard, la guía de búsqueda y la vuelta del pago:
//   · el pop-up NO SE CIERRA: cambia a «Generando el informe de [depto]…» con una barra de avance y, cuando el informe está
//     listo, lo abre solo;
//   · pasados 10 segundos desde «Analizar», con el informe listo, aparece «Abrir informe» (un enlace de verdad) por si la apertura
//     automática falla, y nunca se vuelve al mapa en silencio;
//   · si el análisis falla, el pop-up lo dice con palabras y dice qué hacer; si el aviso se dio de baja en el momento (el caso de
//     fsm@: la ficha dio 404 al analizar, la ruta respondió 410 sin cobrar y el pop-up desaparecía sin decir nada), también;
//   · si con los datos de hoy el veredicto salió distinto al de la tarjeta, lo dice ANTES de abrir el informe;
//   · si el informe se creó pero no se abrió y la persona vuelve al mapa, la tarjeta dice «Ya lo analizaste · Ver informe» y
//     arriba queda un aviso que no se cierra solo: «Tu informe de [depto] está listo · Abrirlo».
// EN LA VUELTA DEL PAGO (03-nov-2026), comprado desde un depto, no hay pop-up: la misma regla debajo de «Pago confirmado.», y si
// no salió lo dice ahí mismo, sin mandar al dashboard a intentarlo de nuevo.
// LA MEDICIÓN: `analisis_informe_abierto` con el tiempo entre «Analizar» y el informe en pantalla (se lee en el informe, por
// sessionStorage), y `analisis_apertura_fallida` cuando el informe estaba listo y la página seguía acá 10 s después.
// Puro: sin React ni Next, para que el tier INFORME-EN-CAMINO lo pruebe entero.
// ─────────────────────────────────────────────────────────────────────────────
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";

/** Desde «Analizar», cuánto hasta que aparece «Abrir informe» (con el informe listo). */
export const ABRIR_INFORME_TRAS_MS = 10_000;
/** Con el informe listo y la apertura pedida, cuánto se espera antes de contarla como fallida. */
export const APERTURA_FALLIDA_TRAS_MS = 10_000;
/** La barra de avance llega al 90 % en este tiempo (lo que tarda un informe, medido: 15,6 s de promedio hasta verlo). */
export const BARRA_AVANCE_MS = 12_000;

export type DesdeInforme = "explorar" | "seleccion" | "dashboard" | "semanal" | "guia" | "pago";
/** El veredicto y el puntaje que la persona vio antes de tocar «Analizar» (la tarjeta, o lo recalculado en el pop-up). */
export interface VeredictoVisto { veredicto: string; score: number | null }

interface Base { depto: string; t0: number; esperado: VeredictoVisto | null }
export type PasoInforme =
  | (Base & { paso: "generando" })
  | (Base & { paso: "listo"; id: string; ruta: string; listoEn: number })
  | (Base & { paso: "distinto"; id: string; ruta: string; listoEn: number; hoy: VeredictoVisto; esperado: VeredictoVisto })
  | (Base & { paso: "fallo"; motivo: MotivoFallo });
/** Dónde se analizó, para decir de dónde se saca el que se dio de baja: el mapa de Explorar, la selección (el dashboard, «Estás
 *  dentro», el semanal y la vuelta del pago de un depto) o la lista de la guía. */
export type LugarInforme = "mapa" | "seleccion" | "lista";
/** El lugar, por el «desde» de la medición. */
export const lugarDeDesde = (d: DesdeInforme): LugarInforme => (d === "explorar" ? "mapa" : d === "guia" ? "lista" : "seleccion");
/** Por qué no salió: un error, el aviso se dio de baja recién, la selección se rearmó sin él, o la guía es de la cuenta que pagó
 *  y se entró con otra (ninguno cobra). */
export type MotivoFallo = "error" | "despublicado" | "fuera" | "otra-cuenta";

export const INFORME_COPY = {
  /** La cabecera del pop-up (el depto va en el título, una sola vez). */
  cabecera: "Tu informe",
  generando: (depto: string) => `Generando el informe de ${depto}…`,
  /** Listo, mientras se abre. */
  abriendo: (depto: string) => `Abriendo el informe de ${depto}…`,
  abrir: "Abrir informe",
  verCompleto: "Ver el informe",
  falloTitulo: "No pudimos generar el informe. No se usó ningún análisis.",
  falloQue: "Prueba de nuevo en unos minutos. Si vuelve a pasar, escríbenos a hola@refranco.ai.",
  reintentar: "Reintentar",
  cerrar: "Cerrar",
  /** EL QUE SE DIO DE BAJA, CON EL PORQUÉ (04-nov-2026, decisión de Fabrizio: que no se sienta como una falla). Lo que sigue al
   *  título dice cuándo lo revisó Franco y de dónde lo saca, según dónde se analizó (despublicadoQue). */
  despublicadoTitulo: "Este depto ya no está publicado.",
  despublicadoQue: (lugar: LugarInforme) =>
    `Franco lo revisó ${lugar === "lista" ? "al armar tu guía" : "anoche"} y hoy el vendedor lo sacó: los que convienen se van rápido. No se usó ningún análisis. Lo quitamos ${lugar === "mapa" ? "del mapa" : lugar === "lista" ? "de la lista" : "de tu selección"}; elige otro.`,
  fueraTitulo: "Este depto salió de tu selección. No se usó ningún análisis.",
  fueraQue: "La armamos de nuevo con lo de hoy. Elige otro.",
  otraCuentaQue: "Esa cuenta no es la del pago. Entra con el correo con que pagaste.",
  /** «Con los datos de hoy dio Ajustar 68, no Comprar 82. Igual puedes verlo completo.» */
  distinto: (hoy: VeredictoVisto, antes: VeredictoVisto) =>
    `Con los datos de hoy dio ${conPuntaje(hoy)}, no ${conPuntaje(antes)}. Igual puedes verlo completo.`,
  listo: (depto: string) => `Tu informe de ${depto} está listo`,
  abrirlo: "Abrirlo",
} as const;

const conPuntaje = (v: VeredictoVisto) => `${etiquetaVeredicto(v.veredicto as Veredicto, "frase")}${v.score != null ? ` ${Math.round(v.score)}` : ""}`;

/** Al tocar «Analizar». */
export function informeGenerando(depto: string, esperado: VeredictoVisto | null, t0: number = Date.now()): PasoInforme {
  return { paso: "generando", depto, t0, esperado };
}

/** ¿El veredicto de hoy es otro que el que vio? Solo el veredicto: el mismo con otro puntaje no frena la apertura. */
export function veredictoDistinto(esperado: VeredictoVisto | null, hoy: VeredictoVisto | null): boolean {
  return !!esperado && !!hoy && !!hoy.veredicto && hoy.veredicto !== esperado.veredicto;
}

/** El informe está: se abre solo, salvo que el veredicto haya salido distinto (entonces se dice primero). */
export function informeListo(p: PasoInforme, r: { id: string; ruta: string; veredicto?: string | null; score?: number | null }, ahora: number = Date.now()): PasoInforme {
  const hoy = r.veredicto ? { veredicto: r.veredicto, score: r.score ?? null } : null;
  const base = { depto: p.depto, t0: p.t0, esperado: p.esperado, id: r.id, ruta: r.ruta, listoEn: ahora };
  return hoy && p.esperado && veredictoDistinto(p.esperado, hoy) ? { ...base, paso: "distinto", hoy, esperado: p.esperado } : { ...base, paso: "listo" };
}

/** El análisis no salió (no se cobró): con el motivo, para decirlo con palabras. */
export function informeFallo(p: PasoInforme, motivo: MotivoFallo): PasoInforme {
  return { paso: "fallo", depto: p.depto, t0: p.t0, esperado: p.esperado, motivo };
}

/** ¿Ya va «Abrir informe»? Con el informe listo y 10 s desde «Analizar»; en «distinto», siempre (es el botón que abre). */
export function muestraAbrir(p: PasoInforme, ahora: number = Date.now()): boolean {
  if (p.paso === "distinto") return true;
  return p.paso === "listo" && ahora - p.t0 >= ABRIR_INFORME_TRAS_MS;
}

/** ¿Se puede cerrar? Generando, nunca (no se vuelve al mapa en silencio); listo, recién con «Abrir informe» a la vista. */
export function cerrable(p: PasoInforme, ahora: number = Date.now()): boolean {
  if (p.paso === "generando") return false;
  if (p.paso === "listo") return muestraAbrir(p, ahora);
  return true;
}

/** Al cerrarlo sin abrir el informe: si el informe existe, queda el aviso de arriba y la tarjeta «Ya lo analizaste». */
export function alCerrarQueda(p: PasoInforme): { id: string; ruta: string; depto: string } | null {
  return p.paso === "listo" || p.paso === "distinto" ? { id: p.id, ruta: p.ruta, depto: p.depto } : null;
}

/** El avance de la barra, de 0 a 1: hasta el 90 % mientras genera; lleno con el informe listo. */
export function avance(p: PasoInforme, ahora: number = Date.now()): number {
  if (p.paso !== "generando") return 1;
  return Math.min(0.9, Math.max(0.05, ((ahora - p.t0) / BARRA_AVANCE_MS) * 0.9));
}

// ── LA MEDICIÓN ──────────────────────────────────────────────────────────────
export const EVENTO_INFORME_ABIERTO = "analisis_informe_abierto";
export const EVENTO_APERTURA_FALLIDA = "analisis_apertura_fallida";
export const CLAVE_EN_CAMINO = "franco_informe_en_camino";
/** Un viaje más viejo que esto no es «la espera de Analizar» (una pestaña olvidada). */
const VIAJE_MAX_MS = 30 * 60 * 1000;
export type ViaInforme = "auto" | "boton" | "aviso";
interface Viaje { id: string; t0: number; desde: DesdeInforme; via: ViaInforme }
type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** De dónde se analizó, por la página: el dashboard, «Estás dentro» (/deptos), el semanal, la guía o Explorar. La vuelta del pago
 *  lo dice ella («pago»): en su misma página vive la guía. */
export function desdeDeRuta(pathname: string): DesdeInforme {
  if (pathname.startsWith("/explorar")) return "explorar";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/semanal")) return "semanal";
  if (pathname.startsWith("/deptos")) return "seleccion";
  return "guia";
}

/** Antes de abrir el informe: quién, cuándo se tocó «Analizar», desde dónde y cómo se abrió. */
export function anotarViaje(almacen: Almacen | null, v: Viaje): void {
  try { almacen?.setItem(CLAVE_EN_CAMINO, JSON.stringify(v)); } catch { /* sin almacenamiento, sin medición */ }
}

/** En el informe: el viaje de ESTE informe (y lo consume). null si no se llegó desde «Analizar» o si venció. */
export function leerViaje(almacen: Almacen | null, id: string, ahora: number = Date.now()): { ms: number; desde: DesdeInforme; via: ViaInforme } | null {
  try {
    const raw = almacen?.getItem(CLAVE_EN_CAMINO);
    if (!raw) return null;
    const v = JSON.parse(raw) as Viaje;
    if (v.id !== id) return null;
    almacen?.removeItem(CLAVE_EN_CAMINO);
    const ms = ahora - v.t0;
    return ms >= 0 && ms <= VIAJE_MAX_MS ? { ms, desde: v.desde, via: v.via } : null;
  } catch {
    return null;
  }
}

/** Lo que dice el pop-up cuando no salió: el título y qué hacer. */
export function textoFallo(motivo: MotivoFallo, lugar: LugarInforme = "mapa"): { titulo: string; que: string } {
  if (motivo === "despublicado") return { titulo: INFORME_COPY.despublicadoTitulo, que: INFORME_COPY.despublicadoQue(lugar) };
  if (motivo === "fuera") return { titulo: INFORME_COPY.fueraTitulo, que: INFORME_COPY.fueraQue };
  if (motivo === "otra-cuenta") return { titulo: INFORME_COPY.falloTitulo, que: INFORME_COPY.otraCuentaQue };
  return { titulo: INFORME_COPY.falloTitulo, que: INFORME_COPY.falloQue };
}
