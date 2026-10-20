// ─────────────────────────────────────────────────────────────────────────────
// El correo semanal (02-oct-2026, decisiones de Fabrizio): cada lunes, a quien tiene cuenta, los deptos
// PUBLICADOS que mejor resultan con su perfil de búsqueda (lib/perfil-busqueda.ts), revisados con SU pie
// y SU plazo. La selección se arma el domingo; el correo sale el lunes. Reglas (puras, las prueba el
// tier SEMANAL):
//   · CANDIDATOS: avisos evaluados de sus comunas, sus dormitorios y su rango de precio, vistos en la
//     última semana, sin arriendo sospechoso y sin despublicados (RPC `semanal_candidatos`).
//   · SOLO LOS QUE CONVIENEN con sus números (Comprar), por puntaje.
//   · SOLO PUBLICADOS: de a uno, en ese orden, se chequea la ficha (con la memoria de 24 horas y el tope
//     por hora COMPARTIDOS con la guía) hasta juntar CINCO. Con menos de TRES publicados no hay correo.
//     Si faltó cupo para chequear, la selección queda pendiente y la toma la corrida siguiente.
//   · EL RESPALDO (05-oct-2026): si en sus comunas no hay TRES Comprar publicados, completa hasta tres
//     con Comprar de las comunas VECINAS (comunas-vecinas.ts), y después con Ajustar que llegan a Comprar
//     con hasta 10% de descuento, marcados «Conviene si lo negocias». Si ni así hay tres, no sale.
//   · A QUIÉN (05-oct-2026): a toda persona con un informe de renta larga (y a quien tenga perfil), con el
//     perfil armado desde sus informes. El primer correo de cada una se presenta.
//   · EL REGALO DE REACTIVACIÓN (16-oct-2026, decisión de Fabrizio; antes, el regalo de los 14 días): a quien pasa
//     4 semanas sin analizar, el correo de esa semana suma un análisis de regalo con el crédito cargado; como mucho
//     uno cada 90 días, sin plan y sin otro regalo vivo. El regalo al REGISTRARSE es otro: regalo-alta.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { TRES_COPY } from "@/lib/tres-analisis";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { EstadoPublicacion } from "./publicacion";
import type { Evaluado } from "./seleccion";

export const MINIMO_SEMANAL = 3;
export const TOPE_SEMANAL = 5;
/** Cuántos candidatos (los de mejor puntaje en la evaluación del cron) se recalculan con sus números. */
export const MAX_CANDIDATOS_SEMANAL = 40;
export const VENTANA_SEMANAL_DIAS = 7;
/** La reactivación (16-oct-2026): 4 semanas sin analizar, y como mucho una cada 90 días. */
export const DIAS_SIN_ANALIZAR_REACTIVACION = 28;
export const DIAS_ENTRE_REACTIVACIONES = 90;
/** GETs a fichas que una corrida del domingo se permite (dentro del tope por hora compartido, 30). */
export const LECTURAS_POR_CORRIDA_SEMANAL = 24;
/**
 * Cuánto vale, para ARMAR la selección, un publicado ya chequeado (05-oct-2026, decisión de Fabrizio): la
 * semana. Los chequeos de las noches sirven para descartar lo que ya no está publicado, no para darlo por
 * vigente: el domingo, con el tope disponible, se vuelven a chequear los avisos que quedaron en las
 * selecciones, los chequeados hace más tiempo primero (`rechequearAvisos`). Y la página /semanal está viva:
 * si uno ya no está publicado lo dice y muestra el siguiente mejor, chequeado (`siguienteReemplazo`).
 */
export const MEMORIA_SEMANAL_MS = VENTANA_SEMANAL_DIAS * 864e5;
/** El crédito regalado vence a los 60 días: así se gasta primero (el FIFO va por vencimiento). */
export const DIAS_VIGENCIA_REGALO = 60;
/** La holgura del rango de precio: el piso baja 10% bajo lo más barato que analizó; el tope no se pasa. */
export const HOLGURA_PISO = 0.1;
/** El descuento con que un Ajustar puede entrar al correo: si a este precio da Comprar, conviene negociarlo. */
export const DESCUENTO_NEGOCIABLE = 0.1;
/** La marca de un depto que entra por el respaldo de Ajustar. */
export const MARCA_NEGOCIAR = "Conviene si lo negocias";

/** De dónde sale un depto de la selección: sus comunas (sin marca), una vecina o un Ajustar negociable. */
export type TramoSemanal = "propia" | "vecina" | "negociar";

/**
 * LO YA VISTO NO OCUPA LUGAR (19-oct-2026, decisión de Fabrizio): en el correo y en /semanal, los cinco son primero los que
 * la persona no ha visto. Visto = lo analizó (alguna vez, desde un aviso) o se lo mandamos en las últimas `DIAS_VISTO`
 * días (el semanal o el correo del día). Solo si no alcanzan cinco nuevos se completa con vistos, marcados y siempre al
 * final. Lo avisado al momento (30 días) y lo del correo del día de la semana siguen fuera del todo, como antes; lo que
 * la medición fina descartó, también.
 */
export type Visto = "mandado" | "analizado";
export const DIAS_VISTO = 28;
export const MARCA_VISTO: Record<Visto, string> = { mandado: "Ya te lo mandamos", analizado: "Ya lo analizaste" };

/** Lo visto de una persona, por aviso, desde sus correos enviados y sus informes: lo analizado pesa más que lo mandado. El
 *  informe de renta larga, si lo hay, para «Ya lo analizaste · Ver informe». */
export function vistosDeFilas(p: {
  enviadas: Array<{ items?: Array<{ avisoId: string }> | null; items_str?: Array<{ avisoId: string }> | null }>;
  informes: Array<{ id: string; avisoId: string; largo: boolean }>;
}): Map<string, { visto: Visto; informeLargo?: string }> {
  const m = new Map<string, { visto: Visto; informeLargo?: string }>();
  for (const f of p.enviadas) for (const it of [...(f.items ?? []), ...(f.items_str ?? [])]) if (it?.avisoId) m.set(it.avisoId, { visto: "mandado" });
  for (const a of p.informes) {
    const ya = m.get(a.avisoId);
    m.set(a.avisoId, { visto: "analizado", informeLargo: (ya?.visto === "analizado" ? ya.informeLargo : undefined) ?? (a.largo ? a.id : undefined) });
  }
  return m;
}

export type Variante = "banda" | "tarjetas";

export interface CandidatoSemanal {
  avisoId: string;
  /** El puntaje del cron (con pie 20%): ordena qué se recalcula primero. */
  scoreCron: number | null;
}

/** El lunes del envío (YYYY-MM-DD, hora de Chile). El domingo arma la del día siguiente; el lunes, la de hoy. */
export function semanaDelEnvio(ahora: Date = new Date()): string {
  const chile = new Date(ahora.getTime() - 3 * 3600_000);
  const dia = chile.getUTCDay(); // 0 domingo, 1 lunes
  const adelante = dia === 0 ? 1 : dia === 1 ? 0 : (8 - dia) % 7;
  const lunes = new Date(Date.UTC(chile.getUTCFullYear(), chile.getUTCMonth(), chile.getUTCDate() + adelante));
  return lunes.toISOString().slice(0, 10);
}

/** El rango de precio con que se busca: del piso (con holgura, si se infirió de sus informes; tal cual, si lo eligió
 *  a mano: /deptos dice «entre UF 3.000 y 4.000») al tope. */
export function rangoSemanal(p: { precioMinUf: number | null; precioMaxUf: number | null; editado?: readonly string[] }): { ufMin: number; ufMax: number } | null {
  if (p.precioMaxUf == null || p.precioMaxUf <= 0) return null;
  const aMano = !!p.editado?.includes("precioMin");
  const piso = p.precioMinUf != null && p.precioMinUf < p.precioMaxUf ? p.precioMinUf * (aMano ? 1 : 1 - HOLGURA_PISO) : 0;
  return { ufMin: Math.max(0, Math.floor(piso)), ufMax: p.precioMaxUf };
}

export type ElegidoSemanal<T> = { c: T; ev: Evaluado; tramo: TramoSemanal; visto?: Visto };

/**
 * `relleno` (20-oct-2026): con menos de tres confirmados, los Comprar de anoche que no se alcanzaron a confirmar, en el
 * orden en que la regla los habría chequeado (sus comunas, después las vecinas; solo lo nuevo), hasta completar tres.
 * El envío los suma al final, marcados «Visto anoche, sin confirmar», si al mandar siguen faltando confirmados.
 */
export type ResultadoSemanal<T> =
  | { estado: "armada"; items: Array<ElegidoSemanal<T>>; relleno?: Array<ElegidoSemanal<T>> }
  | { estado: "sin_match"; items: []; relleno?: Array<ElegidoSemanal<T>> }
  | { estado: "pendiente"; items: Array<ElegidoSemanal<T>>; relleno?: Array<ElegidoSemanal<T>> };

/** El respaldo: los candidatos de las comunas vecinas y la evaluación con el descuento negociable (sin ella, no hay
   *  tramo «negociar»: el bloque de renta corta). */
export interface RespaldoSemanal<T> {
  vecinas: () => Promise<T[]>;
  evaluarConDescuento?: (c: T) => Promise<Evaluado | null>;
}

/**
 * La regla de cada bloque. Renta larga, la de siempre: con menos de tres, el respaldo completa con vecinas y con
 * negociables, y si aun así no llega a tres, no hay selección. RENTA CORTA (14-oct-2026, decisión de Fabrizio): solo
 * Comprar —las vecinas sí, porque dan Comprar; los negociables no— y, con menos de tres, se mandan los que haya.
 */
export interface ReglaSemanal {
  conNegociables: boolean;
  aceptarMenos: boolean;
  /** Con menos de tres confirmados, el relleno con lo visto anoche sin confirmar (20-oct-2026; solo renta larga). */
  completarSinConfirmar?: boolean;
}
/**
 * SIN MÍNIMO DE TRES EN RENTA LARGA (20-oct-2026, decisión de Fabrizio): con 1 o 2 confirmados sale la selección. Y con
 * menos de tres confirmados se completa hasta tres con deptos que la evaluación de anoche vio publicados en los
 * resultados del portal aunque la ficha no se haya leído (`relleno`, marcados «Visto anoche, sin confirmar», al final;
 * nunca más de TOPE_SIN_CONFIRMAR). El 19-oct, de 17 correos cortos, 8 tenían deptos que convenían descartados por el
 * mínimo, y una persona se dio de baja 17 minutos después del correo vacío.
 */
export const REGLA_LARGA: ReglaSemanal = { conNegociables: true, aceptarMenos: true, completarSinConfirmar: true };
export const REGLA_CORTA: ReglaSemanal = { conNegociables: false, aceptarMenos: true };
export const TOPE_SIN_CONFIRMAR = 3;
export const MARCA_SIN_CONFIRMAR = "Visto anoche, sin confirmar";

type Evaluados<T> = Array<{ c: T; ev: Evaluado }>;

/** Los de mejor puntaje del cron, recalculados con los números de la persona. */
async function evaluarPool<T extends CandidatoSemanal>(candidatos: T[], evaluar: (c: T) => Promise<Evaluado | null>): Promise<Evaluados<T>> {
  const pool = [...candidatos].sort((a, b) => (b.scoreCron ?? -1) - (a.scoreCron ?? -1)).slice(0, MAX_CANDIDATOS_SEMANAL);
  const evs = await Promise.all(pool.map((c) => evaluar(c).catch(() => null)));
  return pool.map((c, i) => ({ c, ev: evs[i] })).filter((x): x is { c: T; ev: Evaluado } => x.ev != null);
}

const porPuntaje = <T>(xs: Evaluados<T>, veredicto: string) =>
  xs.filter((x) => x.ev.veredicto === veredicto).sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1));

/**
 * Elige los deptos de la semana. `candidatos` viene de la RPC, ya filtrado por el perfil. Se recalculan
 * los de mejor puntaje del cron con los números de la persona; se quedan los Comprar, por puntaje; y se
 * chequea la ficha de a uno hasta juntar `TOPE_SEMANAL` publicados. Con menos de `MINIMO_SEMANAL`, el
 * respaldo completa HASTA TRES: primero Comprar de las comunas vecinas; después Ajustar (de sus comunas
 * y de las vecinas, por puntaje) que con `DESCUENTO_NEGOCIABLE` dan Comprar. Con `REGLA_CORTA`, sin negociables y,
 * con menos de tres y nada más por chequear, los que haya.
 * LO YA VISTO NO OCUPA LUGAR (19-oct-2026): esa regla corre primero solo con lo que la persona no ha visto (`visto` null);
 * si no alcanzan cinco, la misma regla completa con lo visto, que queda marcado y al final. Lo visto ni se chequea
 * mientras haya nuevos que alcancen.
 */
export async function elegirSemanal<T extends CandidatoSemanal>(
  candidatos: T[],
  evaluar: (c: T) => Promise<Evaluado | null>,
  publicado: (c: T) => Promise<EstadoPublicacion>,
  respaldo?: RespaldoSemanal<T>,
  regla: ReglaSemanal = REGLA_LARGA,
  visto: (c: T) => Visto | null = () => null,
): Promise<ResultadoSemanal<T>> {
  const items: Array<ElegidoSemanal<T>> = [];
  let sinChequeo = 0;
  // Lo visto anoche sin confirmar (20-oct-2026): los Comprar nuevos que quedaron sin chequeo, en el orden de la regla.
  const sinConfirmar: Array<ElegidoSemanal<T>> = [];
  const tomar = async (lista: Evaluados<T>, tramo: TramoSemanal, hasta: number, vistos: boolean) => {
    for (const it of lista) {
      if (items.length >= hasta) return;
      const v = visto(it.c);
      if (!!v !== vistos) continue;
      if (items.some((x) => x.c.avisoId === it.c.avisoId)) continue;
      const e = await publicado(it.c).catch((): EstadoPublicacion => "sin-chequeo");
      if (e === "publicado") items.push({ ...it, tramo, ...(v ? { visto: v } : {}) });
      else if (e === "sin-chequeo") {
        sinChequeo++;
        if (!v && tramo !== "negociar" && !sinConfirmar.some((x) => x.c.avisoId === it.c.avisoId)) sinConfirmar.push({ ...it, tramo });
      }
    }
  };

  const propios = await evaluarPool(candidatos, evaluar);
  let vecinos: Evaluados<T> | null = null;
  const leerVecinos = async () => (vecinos ??= respaldo ? await evaluarPool(await respaldo.vecinas().catch(() => [] as T[]), evaluar) : []);
  // La regla de siempre —sus comunas hasta cinco; con menos de tres, vecinas y negociables hasta tres—, sobre lo nuevo
  // primero y, si no alcanza para cinco, sobre lo visto.
  for (const vistos of [false, true]) {
    if (items.length >= TOPE_SEMANAL) break;
    await tomar(porPuntaje(propios, "COMPRAR"), "propia", TOPE_SEMANAL, vistos);
    if (items.length < MINIMO_SEMANAL && respaldo) {
      const vs = await leerVecinos();
      await tomar(porPuntaje(vs, "COMPRAR"), "vecina", MINIMO_SEMANAL, vistos);
      const conDescuento = respaldo.evaluarConDescuento;
      if (items.length < MINIMO_SEMANAL && regla.conNegociables && conDescuento) {
        const ajustar = porPuntaje([...propios, ...vs], "AJUSTA SUPUESTOS").filter((x) => !!visto(x.c) === vistos);
        const descontados = await Promise.all(ajustar.map((x) => conDescuento(x.c).catch(() => null)));
        await tomar(ajustar.filter((_, i) => descontados[i]?.veredicto === "COMPRAR"), "negociar", MINIMO_SEMANAL, vistos);
      }
    }
  }

  if (items.length >= MINIMO_SEMANAL) return { estado: "armada", items };
  // Con menos de tres confirmados, el relleno hasta tres con lo visto anoche sin confirmar (solo renta larga).
  const relleno = regla.completarSinConfirmar ? sinConfirmar.slice(0, Math.min(TOPE_SIN_CONFIRMAR, MINIMO_SEMANAL - items.length)) : undefined;
  // Faltó cupo para chequear: puede que sí haya; lo toma la corrida siguiente (y si al mandar siguen sin chequeo, el relleno).
  if (sinChequeo > 0) return { estado: "pendiente", items, ...(relleno?.length ? { relleno } : {}) };
  // Con menos de tres y nada más por chequear, los que haya (renta corta desde el 14-oct-2026; renta larga desde el 20-oct).
  if (regla.aceptarMenos && items.length > 0) return { estado: "armada", items };
  return { estado: "sin_match", items: [] };
}

/**
 * El siguiente aviso que la selección de una persona necesita chequear (05-oct-2026): se elige con la regla
 * del domingo, pero sin salir a la fuente —`enMemoria` dice lo ya chequeado en la semana y «sin-chequeo» lo
 * demás—. `aviso` es null si la selección ya se puede armar o si no queda nada que chequear; `armada` dice
 * cuál de las dos, y con eso el prechequeo cuenta al cierre sin volver a recorrer a nadie (09-oct-2026).
 */
export async function siguienteYEstado<T extends CandidatoSemanal>(
  candidatos: T[],
  evaluar: (c: T) => Promise<Evaluado | null>,
  enMemoria: (c: T) => Promise<EstadoPublicacion>,
  respaldo?: RespaldoSemanal<T>,
  regla: ReglaSemanal = REGLA_LARGA,
  visto: (c: T) => Visto | null = () => null,
): Promise<{ aviso: T | null; armada: boolean }> {
  const faltan: T[] = [];
  const g = await elegirSemanal(candidatos, evaluar, async (c) => {
    const e = await enMemoria(c);
    if (e === "sin-chequeo") faltan.push(c);
    return e;
  }, respaldo, regla, visto);
  // Armada con lo visto pero con nuevos sin chequear (19-oct-2026): se sigue chequeando lo nuevo, que le gana el lugar.
  const faltaNuevo = faltan.find((c) => !visto(c));
  if (g.estado === "armada" && !(faltaNuevo && g.items.some((x) => x.visto))) return { aviso: null, armada: true };
  return { aviso: faltaNuevo ?? faltan[0] ?? null, armada: false };
}

/** Cuánto trabaja una corrida del prechequeo, como mucho: cierra antes del corte de 300 s de la función
 *  (09-oct-2026). Un paso que empieza antes de esto termina igual —el más largo, un chequeo de ficha, tiene su
 *  tope—; ninguno empieza después. */
export const PRESUPUESTO_PRECHEQUEO_MS = 240_000;

/** El TECHO de una corrida, pase lo que pase (12-oct-2026). El presupuesto decide si EMPIEZA el paso siguiente,
 *  pero no le pone límite a uno que ya empezó: una consulta que no vuelve llevaría la corrida al corte de 300 s.
 *  A los 280 s cierra igual, guardando por quién seguir (la persona después de la trabada), y le quedan 20 s para
 *  guardar y responder. */
export const TOPE_DURO_PRECHEQUEO_MS = 280_000;

/** Lo que se sabe de una corrida MIENTRAS corre: si la corta el techo, de acá sale por quién seguir. */
export interface ProgresoPrechequeo<P> {
  /** La persona después de la que se está mirando: si el paso de esta se cuelga, la siguiente corrida no
   *  vuelve a trabarse en ella (le toca en la vuelta siguiente). */
  siguiente: P | null;
  chequeos: number;
  revisadas: number;
}

/** El techo vive en `lib/con-tope.ts` desde el 13-oct-2026: lo comparte el pase de unidades. */
export { conTope } from "@/lib/con-tope";

export interface AvancePrechequeo<P> {
  chequeos: number;
  /** Las personas que terminaron en esta corrida: su selección ya no necesita chequeos. */
  revisadas: number;
  /** Por quién empieza la corrida siguiente: la primera a la que esta no llegó; si llegó a todas, la primera
   *  que todavía necesita. null: dio la vuelta y nadie necesita. */
  siguiente: P | null;
  porTiempo: boolean;
  porCupo: boolean;
  /** Cuánto tardó cada chequeo (ms, reloj real): lo que cuesta un aviso medido donde corre el cron. */
  msChequeos: number[];
  /** El paso de preparar/elegir más largo (ms, reloj real): lo que se puede pasar del presupuesto. */
  msPasoMax: number;
}

/** Por quién empieza la corrida: la persona donde quedó la anterior o, si esa ya no está en la lista, la que
 *  le sigue en el orden estable (por `userId`). null: desde el principio (no hay dónde quedó, o quedó después
 *  de la última). */
export function desdeDondeQuedo(personas: Array<{ userId: string }>, siguiente: string | null): string | null {
  if (!siguiente) return null;
  return personas.find((p) => p.userId >= siguiente)?.userId ?? null;
}

/**
 * Los chequeos de una corrida, CON RELOJ Y SIGUIENDO DONDE QUEDÓ LA ANTERIOR (09-oct-2026). Hasta acá la
 * corrida empezaba en un punto que rotaba por hora y, al llegar al presupuesto, recorría de nuevo a todas las
 * personas preparadas sin reloj: llegó al corte de 300 s en 22 de 24 corridas. Ahora empieza por `desde`; en
 * cada vuelta cada persona que todavía necesita chequea UN aviso (por turnos, como desde el 05-oct); el
 * reloj y el cupo se miran antes de CADA paso —preparar a una persona es lo caro—; y devuelve por quién seguir.
 */
export async function prechequearConPresupuesto<P, T>(
  personas: P[],
  desde: P | null,
  siguiente: (p: P) => Promise<T | null>,
  chequear: (aviso: T) => Promise<unknown>,
  quedaCupo: () => boolean,
  quedaTiempo: () => boolean,
  progreso?: ProgresoPrechequeo<P>,
): Promise<AvancePrechequeo<P>> {
  const i0 = desde != null ? Math.max(0, personas.indexOf(desde)) : 0;
  const orden = [...personas.slice(i0), ...personas.slice(0, i0)];
  const lugar = new Map(orden.map((p, i) => [p, i]));
  const terminadas = new Set<P>();
  const visitadas = new Set<P>();
  let enFila = [...orden];
  let chequeos = 0, porTiempo = false, porCupo = false, msPasoMax = 0;
  const msChequeos: number[] = [];
  vueltas: while (enFila.length > 0) {
    const siguen: P[] = [];
    for (const p of enFila) {
      if (!quedaTiempo()) { porTiempo = true; break vueltas; }
      if (!quedaCupo()) { porCupo = true; break vueltas; }
      visitadas.add(p);
      if (progreso) progreso.siguiente = orden[((lugar.get(p) ?? 0) + 1) % orden.length] ?? null;
      const tp = Date.now();
      const aviso = await siguiente(p);
      msPasoMax = Math.max(msPasoMax, Date.now() - tp);
      if (aviso == null) {
        terminadas.add(p);
        if (progreso) progreso.revisadas = terminadas.size;
        continue;
      }
      siguen.push(p);
      if (!quedaTiempo()) { porTiempo = true; break vueltas; }
      const tc = Date.now();
      await chequear(aviso);
      msChequeos.push(Date.now() - tc);
      chequeos++;
      if (progreso) progreso.chequeos = chequeos;
    }
    enFila = siguen;
  }
  // Por quién seguir: la primera a la que esta corrida NO LLEGÓ; si llegó a todas, la primera que todavía
  // necesita. Volver a la primera «no terminada» —una que ya chequeó su aviso pero no alcanzó a confirmarse—
  // haría que cada corrida re-preparara a las mismas y nunca avanzara.
  const siguientePersona = orden.find((p) => !visitadas.has(p)) ?? orden.find((p) => !terminadas.has(p)) ?? null;
  return { chequeos, revisadas: terminadas.size, siguiente: siguientePersona, porTiempo, porCupo, msChequeos, msPasoMax };
}

/** Un aviso chequeado hace menos que esto no se vuelve a leer el domingo: se chequeó hoy. */
export const FRESCO_DOMINGO_MS = 24 * 3600_000;

/**
 * El domingo (05-oct-2026): vuelve a chequear los avisos de las selecciones armadas, los chequeados hace
 * más tiempo primero (sin fecha, primero que todos), mientras quede presupuesto. Los de hoy no se leen.
 * Devuelve los que resultaron despublicados: sus selecciones se vuelven a armar.
 */
export async function rechequearAvisos(
  avisos: Array<{ avisoId: string; chequeadoAt: number | null }>,
  rechequear: (avisoId: string) => Promise<EstadoPublicacion>,
  quedaPresupuesto: () => boolean,
  ahora: number = Date.now(),
): Promise<{ chequeados: number; caidos: Set<string> }> {
  const vistos = new Set<string>();
  const cola = avisos
    .filter((a) => (vistos.has(a.avisoId) ? false : (vistos.add(a.avisoId), true)))
    .filter((a) => a.chequeadoAt == null || ahora - a.chequeadoAt >= FRESCO_DOMINGO_MS)
    .sort((a, b) => (a.chequeadoAt ?? -Infinity) - (b.chequeadoAt ?? -Infinity));
  const caidos = new Set<string>();
  let chequeados = 0;
  for (const a of cola) {
    if (!quedaPresupuesto()) break;
    const e = await rechequear(a.avisoId).catch((): EstadoPublicacion => "sin-chequeo");
    chequeados++;
    if (e === "despublicado") caidos.add(a.avisoId);
  }
  return { chequeados, caidos };
}

/** Cuántos avisos chequea, como mucho, una visita a /semanal para encontrar el reemplazo de uno caído. */
export const MAX_CHEQUEOS_REEMPLAZO = 3;

/**
 * El siguiente mejor del perfil para el lugar de un depto que ya no está publicado (05-oct-2026): los Comprar
 * por puntaje, sin los que ya están en la selección, chequeando la ficha de a uno —como mucho
 * `MAX_CHEQUEOS_REEMPLAZO` sin publicado conocido—. null si no hay.
 */
export async function siguienteReemplazo<T extends CandidatoSemanal>(
  candidatos: T[],
  excluir: ReadonlySet<string>,
  evaluar: (c: T) => Promise<Evaluado | null>,
  publicado: (c: T) => Promise<EstadoPublicacion>,
): Promise<{ c: T; ev: Evaluado } | null> {
  const pool = candidatos.filter((c) => !excluir.has(c.avisoId))
    .sort((a, b) => (b.scoreCron ?? -1) - (a.scoreCron ?? -1)).slice(0, MAX_CANDIDATOS_SEMANAL);
  const evs = await Promise.all(pool.map((c) => evaluar(c).catch(() => null)));
  const comprar = pool.map((c, i) => ({ c, ev: evs[i] }))
    .filter((x): x is { c: T; ev: Evaluado } => x.ev?.veredicto === "COMPRAR")
    .sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1));
  let intentos = 0;
  for (const it of comprar) {
    if (intentos >= MAX_CHEQUEOS_REEMPLAZO) break;
    const e = await publicado(it.c).catch((): EstadoPublicacion => "sin-chequeo");
    if (e === "publicado") return it;
    intentos++;
  }
  return null;
}

/** El bloque de un depto del correo: el de renta larga o el de renta corta (14-oct-2026). */
export type BloqueSemanal = "largo" | "corto";

const UUID_AVISO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El depto de un clic del correo (19-oct-2026): el aviso del enlace, si está en la selección, y en qué bloque. Hasta
 * hoy solo se buscaba en el de renta larga, así que un clic en un depto de renta corta quedaba como clic «general», sin
 * depto, y la página no lo ponía primero (el 19-oct, 4 de los 5 clics «generales» eran de renta corta).
 */
export function deptoDelClic(
  sel: { items: Array<{ avisoId: string }>; corto: { items: Array<{ avisoId: string }> } | null },
  a: string | null,
): { avisoId: string | null; bloque: BloqueSemanal | null } {
  if (!a || !UUID_AVISO.test(a)) return { avisoId: null, bloque: null };
  if (sel.items.some((i) => i.avisoId === a)) return { avisoId: a, bloque: "largo" };
  if (sel.corto?.items.some((i) => i.avisoId === a)) return { avisoId: a, bloque: "corto" };
  return { avisoId: null, bloque: null };
}

/** En qué bloque está el depto destacado (`?a=`) de /semanal: ese bloque va primero, con el depto arriba (19-oct-2026). */
export function bloqueDelDestacado<I extends { avisoId: string }>(
  a: string | null,
  largo: Array<{ item: I; reemplazo: I | null }>,
  corto: Array<{ item: I; reemplazo: I | null }>,
): BloqueSemanal | null {
  if (!a) return null;
  const esta = (fs: Array<{ item: I; reemplazo: I | null }>) => fs.some((f) => f.item.avisoId === a || f.reemplazo?.avisoId === a);
  return esta(largo) ? "largo" : esta(corto) ? "corto" : null;
}

/** Lo que muestra la página: cada depto del correo, si ya no está publicado, y el que va en su lugar. */
export interface FilaPaginaSemanal<I> {
  item: I;
  caido: boolean;
  reemplazo: I | null;
}

/**
 * Las filas de /semanal a partir de los items guardados (los del correo y los reemplazos, que llevan
 * `reemplazaA`) y de los avisos que ya no están publicados. El reemplazo vigente de un depto caído es el
 * último que lo reemplaza y no se cayó.
 */
export function filasDePagina<I extends { avisoId: string; reemplazaA?: string }>(items: I[], caidos: ReadonlySet<string>): Array<FilaPaginaSemanal<I>> {
  return items.filter((i) => !i.reemplazaA).map((item) => {
    const caido = caidos.has(item.avisoId);
    const reemplazos = caido ? items.filter((r) => r.reemplazaA === item.avisoId && !caidos.has(r.avisoId)) : [];
    return { item, caido, reemplazo: reemplazos[reemplazos.length - 1] ?? null };
  });
}

/**
 * ¿Es la última corrida del armado (05-oct-2026)? El domingo corre cada hora de 11 a 23 UTC (vercel.json):
 * una persona cuya selección falla en una corrida intermedia se reintenta en la siguiente y no cuenta como
 * falla —no alerta—; solo en la de las 23 UTC, que ya no tiene reintento, la falla queda como tal.
 */
export function esUltimaCorridaArmar(ahora: Date = new Date()): boolean {
  return ahora.getUTCHours() >= 23;
}

/**
 * QUÉ SE LE MANDA EL LUNES (13-oct-2026, decisión de Fabrizio: que nadie reciba silencio por un error nuestro).
 *   · con al menos UN depto confirmado publicado → la selección, aunque sean menos de tres (la armada que perdió
 *     uno desde el domingo, o la pendiente a la que no le alcanzaron los chequeos);
 *   · sin ninguno (sin coincidencias, pendiente vacía, o todos se despublicaron) → el correo corto «Esta semana no
 *     apareció ninguno…», con el enlace a su perfil.
 * Hasta hoy, con menos de tres no había correo, y la pendiente del domingo nunca salía.
 */
export function queEnviarSemanal(deptosVigentes: number, opts: { delDiaReciente?: boolean; nuevos?: number } = {}): "seleccion" | "vacio" | "nada" {
  // EL CORREO DEL DÍA ES EL SEMANAL DE ESA SEMANA (16-oct-2026): el lunes siguiente va solo si hay nuevos. Lo ya visto
  // (19-oct-2026: «Ya te lo mandamos», «Ya lo analizaste») no cuenta como nuevo.
  if (opts.delDiaReciente && (opts.nuevos ?? deptosVigentes) === 0) return "nada";
  return deptosVigentes >= 1 ? "seleccion" : "vacio";
}

/** El reintento del lunes temprano (13-oct-2026): las selecciones que el domingo quedaron pendientes se vuelven a
 *  armar a las 08, 09, 10 y 11 UTC, antes del envío de las 12. */
export const HORAS_REINTENTO_LUNES = [8, 9, 10, 11] as const;

/**
 * EL ENLACE DEL CORREO ENTRA SOLO (13-oct-2026, decisión de Fabrizio): quien abre un enlace del semanal o del aviso
 * inmediato en un aparato SIN sesión queda adentro como el dueño de esa selección, hasta 7 días después de que salió el
 * correo. Con una sesión abierta —la suya o la de otra persona— no se toca nada. Después de los 7 días, «Entrar».
 * Ojo: dentro de esa ventana el enlace vale como credencial; quien reciba el correo reenviado entra.
 */
export const DIAS_ENTRADA_POR_CORREO = 7;
export function puedeEntrarPorCorreo(p: { conSesion: boolean; enviadaAt: string | null; ahora?: Date }): boolean {
  if (p.conSesion || !p.enviadaAt) return false;
  const t = Date.parse(p.enviadaAt);
  if (!Number.isFinite(t)) return false;
  const desde = (p.ahora ?? new Date()).getTime() - t;
  return desde >= -5 * 60_000 && desde <= DIAS_ENTRADA_POR_CORREO * 864e5;
}

// La línea provisoria de renta corta del 13-oct-2026 («Estos convienen para arriendo tradicional. Para renta corta,
// analízalos con tu pack.») salió el 14-oct-2026: quien tiene perfil de renta corta recibe su propio bloque, estimado por
// zona (semanal-str.ts).

/** Cómo se entra (13-oct-2026): en «Estás dentro», en la bienvenida y en la presentación del primer semanal. */
export const COMO_ENTRAR = "Para entrar: tu correo y un código. Sin contraseña.";

/** El correo corto de la semana sin deptos (13-oct-2026). */
/**
 * El asunto y el titular dicen cuántos (20-oct-2026): «Encontré 1 que te conviene», «Encontré 3 que te convienen».
 * Los negociables aparte (ajuste de Fabrizio, 20-oct-2026): si lo encontrado son SOLO negociables, «Encontré 1 que
 * conviene si negocias»; si mezcla, cuenta solo los que convienen sin negociar y el cuerpo marca los demás.
 */
export function asuntoSemanal(n: number, negociables = 0): string {
  const neg = Math.min(Math.max(0, negociables), n);
  if (n > 0 && neg >= n) return n === 1 ? "Encontré 1 que conviene si negocias" : `Encontré ${n} que convienen si negocias`;
  const sin = n - neg;
  return sin === 1 ? "Encontré 1 que te conviene" : `Encontré ${sin} que te convienen`;
}

/**
 * EL CORREO VACÍO DICE LA VERDAD (20-oct-2026, decisión de Fabrizio): solo sale cuando de verdad no hay nada, y si hubo
 * deptos que casi, los nombra; si en su combinación no hay, dice con qué sí (pie 30 % o una comuna vecina, igual que
 * /deptos) y ofrece ajustar el perfil en un toque. Nunca «no apareció ninguno» a secas.
 */
export const SEMANAL_VACIO = {
  asunto: "Esta semana no apareció ninguno que te convenga",
  cuerpo: "Esta semana no apareció ninguno que te convenga con tu pie y tu plazo. Seguimos buscando.",
  /** Sin casi y sin alternativa: cuántos había como los que busca, y que ninguno da ni con pie 30 % ni en vecinas. */
  revisados: (n: number) => (n === 0
    ? "Anoche no había ninguno publicado como los que buscas. Seguimos buscando."
    : `Anoche había ${n} ${n === 1 ? "publicado como los que buscas, y no conviene" : "publicados como los que buscas, y ninguno conviene"} con tu pie y tu plazo, ni con pie 30 % ni en comunas vecinas. Seguimos buscando.`),
  /** Hubo deptos que casi: Ajustar que con sus números no llegan a Comprar. La etiqueta, la de las filas del mismo
   *  correo (veredicto-etiqueta.ts): hasta el 20-oct decía «Ajusta supuestos» escrito a mano y las filas, «Ajustar». */
  casi: (n: number) => `Hubo ${n} que casi: con tus números ${n === 1 ? "queda" : "quedan"} en ${etiquetaVeredicto("AJUSTA SUPUESTOS", "frase")}.`,
  ajustarPie: (pie: number) => `Buscar con pie ${pie} %`,
  ajustarComuna: (comuna: string) => `Sumar ${comuna} a mi búsqueda`,
  ajusteListo: (que: string) => `Listo: ${que}. La próxima selección sale con eso.`,
  perfil: "Si quieres buscar en otras comunas, cámbialas en tu perfil:",
  boton: "Ver mi perfil de búsqueda",
} as const;

/** El ajuste en un toque del correo vacío (20-oct-2026): el pie a 30 %, o una comuna vecina sumada al perfil. */
export type AjustePerfil = { tipo: "pie"; pie: 30 } | { tipo: "comuna"; comuna: string };

export function ajusteDeParametro(v: string | null | undefined, comunasValidas: ReadonlySet<string>): AjustePerfil | null {
  if (!v) return null;
  if (v === "pie30") return { tipo: "pie", pie: 30 };
  const m = v.match(/^comuna:(.{1,40})$/);
  if (m && comunasValidas.has(m[1])) return { tipo: "comuna", comuna: m[1] };
  return null;
}

export function parametroDeAjuste(a: AjustePerfil): string {
  return a.tipo === "pie" ? "pie30" : `comuna:${a.comuna}`;
}

/** Cómo queda el perfil con el ajuste: el pie, o las comunas con la vecina sumada (hasta ocho, sin repetir). */
export function perfilConAjuste(a: AjustePerfil, actual: { comunas: string[] }): Record<string, unknown> {
  if (a.tipo === "pie") return { pie_pct: a.pie };
  return { comunas: Array.from(new Set([...actual.comunas, a.comuna])).slice(0, 8) };
}

/** ¿Es el primer correo semanal de la persona? Entonces se presenta. */
export function esPrimerSemanal(enviadasAntes: number | null | undefined): boolean {
  return (enviadasAntes ?? 0) === 0;
}

/**
 * ¿Le toca el regalo de reactivación esta semana? (16-oct-2026) 4 semanas sin analizar —desde su último informe o, si
 * nunca analizó, desde que se registró—, la última reactivación hace 90 días o más (o nunca), sin plan y sin otro regalo
 * vivo (el de registrarse dura 30 días: no se suman).
 */
export function correspondeReactivacion(p: {
  registradoAt: Date; ultimoAnalisisAt: Date | null; ultimaReactivacionAt: string | null; plan: boolean; regaloVivo: boolean; ahora?: Date;
}): boolean {
  const ahora = (p.ahora ?? new Date()).getTime();
  if (p.plan || p.regaloVivo) return false;
  if (p.ultimaReactivacionAt && ahora - Date.parse(p.ultimaReactivacionAt) < DIAS_ENTRE_REACTIVACIONES * 864e5) return false;
  const desde = (p.ultimoAnalisisAt ?? p.registradoAt).getTime();
  return ahora - desde >= DIAS_SIN_ANALIZAR_REACTIVACION * 864e5;
}

/** La variante del correo, fija por persona (mitad y mitad). */
export function varianteDe(userId: string): Variante {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "banda" : "tarjetas";
}


/** Sin saldo, «Analizar uno · $9.990» compra el SUELTO, marcado como venido del correo (el pack no). */
export const RUTA_SUELTO_SEMANAL = "/checkout?product=single&origen=semanal";

/** La compra del suelto con la variante del correo (la prueba A/B se lee hasta la compra). */
export function rutaSueltoSemanal(variante: Variante | null | undefined): string {
  return variante === "banda" || variante === "tarjetas" ? `${RUTA_SUELTO_SEMANAL}&variante=${variante}` : RUTA_SUELTO_SEMANAL;
}

/** «Vence el 1 de diciembre.»: la fecha del regalo, en hora de Chile (02-oct-2026, decisión de Fabrizio). */
export function textoVence(iso: string): string {
  const fecha = new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
  return `Vence el ${fecha}.`;
}

/** La página adonde lleva el correo (/semanal). */
export const SEMANAL_PAGINA = {
  titulo: "Deptos publicados que Franco revisó para ti",
  bajada: (pie: string, plazo: number) => `Revisados con tu pie de ${pie}% y tu plazo de ${plazo} años. Analiza el que quieras.`,
  regalo: "El próximo que analices va por cuenta de Franco.",
  usaUno: (n: number) => (n === 1 ? "usa tu último análisis" : `usa 1 de tus ${n}`),
  usaRegalo: "usa tu análisis de regalo",
  /** Sin análisis, abajo (13-oct-2026): el pack de tres en lugar de «Analizar uno · $9.990». */
  comprar: TRES_COPY.boton,
  comprarBajada: "Sin caducidad: para estos o para cualquier otro depto.",
  vacia: "Los deptos de este correo ya no están publicados. El próximo correo trae los de la semana.",
  caido: "Este ya no está publicado",
  enSuLugar: "En su lugar, el siguiente que mejor resulta con tus números:",
  otraCuenta: "Este correo es de otra cuenta. Entra con el correo donde lo recibiste.",
  pie: "Franco los revisó con tus números y seguían publicados. Antes de visitar uno, confirma con quien lo publica que sigue disponible.",
  bajaLista: "Listo. Ya no te enviamos los deptos de la semana.",
  bajaVolver: "Si cambias de idea, escríbenos a hola@refranco.ai.",
  bajaError: "No pudimos darte de baja con ese enlace. Escríbenos a hola@refranco.ai y lo hacemos.",
} as const;
