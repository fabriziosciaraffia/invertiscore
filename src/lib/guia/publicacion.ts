// ─────────────────────────────────────────────────────────────────────────────
// La guía solo muestra avisos PUBLICADOS (01-oct-2026, decisión de Fabrizio). Un aviso visto por el
// scraping esta semana puede haberse dado de baja ayer. Es la única puerta a la ficha HTML de la fuente,
// que bloquea la IP a los ~36 GETs (CLAUDE.md).
//
//   · LA FICHA SE MUDÓ (medido el 01-oct-2026): TODA ficha vieja (`/propiedades/…/<id>`) responde 307 a
//     la nueva (`/venta/departamento/<comuna>/<letra>_<id>`: `r_` obra nueva, `o_` particular, `b_`
//     corredor). La nueva responde 200 con el aviso o 404 «Propiedad no disponible» —la baja—. La
//     redirección sola no dice nada: un chequeo son DOS GETs, la vieja y la nueva, sin seguir
//     redirecciones solas y sin reintentos. 200 = publicado; 404/410, o una redirección a una búsqueda
//     sin id = despublicado; 403/429 o un desafío = bloqueo; otro código o destino = error; sin
//     respuesta a tiempo = tiempo. El primer salto queda anotado como «redirige».
//   · UN AVISO CHEQUEADO SE RECUERDA 24 HORAS (`MEMORIA_PUBLICACION_MS`). Un despublicado queda
//     marcado para siempre: sale de la guía y de `avisos_evaluados`, y el cron no lo vuelve a evaluar.
//   · TOPE GLOBAL POR HORA (`TOPE_FICHAS_POR_HORA`) por GET, compartido por la guía y «Analizar este»;
//     sin cupo no se lee y el aviso queda sin chequear —y lo que no está chequeado, la guía no lo muestra—.
//   · CADA GET QUEDA ANOTADO con su código y su motivo (`lecturas_ficha`, panel de operación). Un
//     bloqueo alerta, una vez al día; un despublicado no.
//   · EL AÑO sale del 200 de la ficha nueva, sin GET extra.
// Puro: el almacén y la bajada se inyectan (el tier GUIA-BUSQUEDA §3 y §9 lo prueba con dobles).
// ─────────────────────────────────────────────────────────────────────────────
import { parsearAnioFicha } from "./ficha-anio";

/**
 * GETs a la ficha por hora, entre todas las personas (01-oct-2026). El volumen real: un chequeo son dos
 * GETs; un pack vendido arma UNA guía, que chequea de a uno hasta juntar tres publicados (3 a 4
 * chequeos, 6 a 8 GETs; hasta 16 si muchos se dieron de baja), y cada «Analizar este» rechequea (2 GETs).
 * Un pack completo son de 14 a 22 GETs. Hoy se vende menos de un pack al día: 30 por hora cubre un pack
 * en la peor hora con margen, y queda bajo los ~36 GETs con que la fuente bloquea la IP.
 */
export const TOPE_FICHAS_POR_HORA = 30;
/** Cuántos GETs gasta una guía como mucho (ocho chequeos): si no junta tres publicados, muestra los que tenga.
 *  Medido el 01-oct-2026 sobre una guía real de Las Condes: de seis Comprar chequeados, cuatro ya no
 *  estaban publicados (los baratos se venden); con seis chequeos salían dos. */
export const MAX_LECTURAS_GUIA = 16;
export const MEMORIA_PUBLICACION_MS = 24 * 60 * 60 * 1000;
export const TIMEOUT_FICHA_MS = 8000;

export type MotivoFinal = "publicado" | "despublicado" | "bloqueo" | "error" | "tiempo";
/** «redirige»: el primer salto, de la ficha vieja a la nueva. No decide nada. */
export type MotivoFicha = MotivoFinal | "redirige";
export type TipoLectura = "guia" | "clic";
export type EstadoPublicacion = "publicado" | "despublicado" | "sin-chequeo";

/** Lo que vuelve de UN GET a la ficha, sin seguir redirecciones. */
export type RespuestaFicha =
  | { status: number; location: string | null; html: string | null }
  | { falla: "tiempo" | "red" };

const esFichaVieja = (path: string) => /^\/propiedades\//.test(path);
const esFichaNueva = (path: string) => /\/[a-z]_\d+\/?$/.test(path);
const esDesafio = (s: string) => /captcha|challenge|cf-chl|blocked|login/i.test(s);

/** Un GET, clasificado. `destinoUrl` solo cuando redirige a una ficha (el salto que hay que dar). */
export function clasificarFicha(url: string, r: RespuestaFicha): { motivo: MotivoFicha; codigo: number | null; destino: string | null; destinoUrl?: string } {
  if ("falla" in r) return { motivo: r.falla === "tiempo" ? "tiempo" : "error", codigo: null, destino: null };
  const codigo = r.status;
  if (codigo === 200) return { motivo: r.html && r.html.trim() ? "publicado" : "error", codigo, destino: null };
  if (codigo === 404 || codigo === 410) return { motivo: "despublicado", codigo, destino: null };
  if (codigo === 403 || codigo === 429) return { motivo: "bloqueo", codigo, destino: null };
  if (codigo >= 300 && codigo < 400) {
    if (!r.location) return { motivo: "error", codigo, destino: null };
    let destino: URL;
    try {
      destino = new URL(r.location, url);
    } catch {
      return { motivo: "error", codigo, destino: r.location.slice(0, 300) };
    }
    const d = `${destino.host}${destino.pathname}`.slice(0, 300);
    if (esDesafio(destino.href)) return { motivo: "bloqueo", codigo, destino: d };
    if (destino.host !== new URL(url).host) return { motivo: "error", codigo, destino: d };
    destino.protocol = "https:";
    if (esFichaNueva(destino.pathname) || esFichaVieja(destino.pathname)) return { motivo: "redirige", codigo, destino: d, destinoUrl: destino.href };
    // Una búsqueda (sin id): el aviso ya no está.
    return { motivo: "despublicado", codigo, destino: d };
  }
  return { motivo: "error", codigo, destino: null };
}

export interface LecturaFicha {
  avisoId: string;
  edificio: string;
  tipo: TipoLectura;
  codigo: number | null;
  motivo: MotivoFicha;
  destino: string | null;
  anio: number | null;
}

export interface AlmacenPublicacion {
  publicacion(avisoId: string): Promise<{ estado: "publicado" | "despublicado"; chequeadoAt: Date } | null>;
  lecturasUltimaHora(): Promise<number>;
  /** Anota UN GET en la bitácora. */
  anotar(l: LecturaFicha): Promise<void>;
  /** El resultado del chequeo en `fichas_leidas` y, si dio año, lo comparte con el edificio. */
  cerrar(l: LecturaFicha & { motivo: MotivoFinal }): Promise<void>;
  guardarPublicacion(avisoId: string, estado: "publicado" | "despublicado", codigo: number | null, destino: string | null): Promise<void>;
  /** Saca el aviso de `avisos_evaluados` (y con eso de la guía). */
  despublicar(avisoId: string): Promise<void>;
  alertarBloqueo(l: LecturaFicha): Promise<void>;
}

export interface AvisoFicha {
  id: string;
  url: string | null;
  edificio: string;
}

export type ResultadoLectura =
  | { leida: false; razon: "sin-url" | "tope"; gets: number }
  | { leida: true; motivo: MotivoFinal; codigo: number | null; anio: number | null; gets: number };

/** UN chequeo: la ficha vieja y, si redirige a la nueva, la nueva. Cada GET con su cupo y anotado. */
export async function leerFicha(
  aviso: AvisoFicha,
  tipo: TipoLectura,
  almacen: AlmacenPublicacion,
  bajar: (url: string) => Promise<RespuestaFicha>,
  ahora: Date = new Date(),
): Promise<ResultadoLectura> {
  if (!aviso.url) return { leida: false, razon: "sin-url", gets: 0 };
  let url = aviso.url;
  let gets = 0;
  for (let salto = 0; salto < 2; salto++) {
    if ((await almacen.lecturasUltimaHora()) >= TOPE_FICHAS_POR_HORA) return { leida: false, razon: "tope", gets };
    let r: RespuestaFicha;
    try {
      r = await bajar(url);
    } catch {
      r = { falla: "red" };
    }
    gets++;
    const c = clasificarFicha(url, r);
    const base = { avisoId: aviso.id, edificio: aviso.edificio, tipo, codigo: c.codigo, destino: c.destino };
    if (c.motivo === "redirige" && salto === 0 && c.destinoUrl) {
      await almacen.anotar({ ...base, motivo: "redirige", anio: null });
      url = c.destinoUrl;
      continue;
    }
    // Una segunda redirección no se sigue: no se sabe qué es.
    const motivo: MotivoFinal = c.motivo === "redirige" ? "error" : c.motivo;
    const anio = motivo === "publicado" && "status" in r && r.html ? parsearAnioFicha(r.html, ahora) : null;
    const final: LecturaFicha & { motivo: MotivoFinal } = { ...base, motivo, anio };
    await almacen.anotar(final);
    await almacen.cerrar(final);
    if (motivo === "publicado" || motivo === "despublicado") await almacen.guardarPublicacion(aviso.id, motivo, c.codigo, c.destino);
    if (motivo === "despublicado") await almacen.despublicar(aviso.id);
    if (motivo === "bloqueo") await almacen.alertarBloqueo(final);
    return { leida: true, motivo, codigo: c.codigo, anio, gets };
  }
  return { leida: false, razon: "tope", gets };
}

/**
 * ¿Está publicado? Un despublicado ya marcado no se vuelve a leer. Un publicado chequeado hace menos
 * de 24 horas tampoco, salvo `forzar` (la red de «Analizar este»); con `sinLeer` no se sale a la fuente.
 * Sin lectura posible —sin cupo, error, bloqueo, tiempo— queda «sin-chequeo», salvo que el clic tenga un
 * publicado fresco en memoria.
 */
export async function chequearPublicacion(
  aviso: AvisoFicha,
  tipo: TipoLectura,
  almacen: AlmacenPublicacion,
  bajar: (url: string) => Promise<RespuestaFicha>,
  opts: { forzar?: boolean; sinLeer?: boolean; ahora?: Date } = {},
): Promise<{ estado: EstadoPublicacion; lectura: ResultadoLectura | null }> {
  const ahora = opts.ahora ?? new Date();
  const mem = await almacen.publicacion(aviso.id);
  if (mem?.estado === "despublicado") return { estado: "despublicado", lectura: null };
  const fresco = mem?.estado === "publicado" && ahora.getTime() - mem.chequeadoAt.getTime() < MEMORIA_PUBLICACION_MS;
  if (fresco && !opts.forzar) return { estado: "publicado", lectura: null };
  // Sin presupuesto de lecturas (la guía ya leyó las suyas, o la fuente bloqueó): queda lo que se sabe.
  if (opts.sinLeer) return { estado: fresco ? "publicado" : "sin-chequeo", lectura: null };
  const l = await leerFicha(aviso, tipo, almacen, bajar, ahora);
  if (l.leida && (l.motivo === "publicado" || l.motivo === "despublicado")) return { estado: l.motivo, lectura: l };
  return { estado: fresco ? "publicado" : "sin-chequeo", lectura: l };
}
