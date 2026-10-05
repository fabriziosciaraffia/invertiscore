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
//   · EL REGALO: a los 14 días de registrarse sin haber comprado, el correo de esa semana suma «El
//     próximo que analices va por cuenta de Franco.» con el crédito cargado. Una vez por persona.
//     Registrarse no regala nada.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import type { EstadoPublicacion } from "./publicacion";
import type { Evaluado } from "./seleccion";

export const MINIMO_SEMANAL = 3;
export const TOPE_SEMANAL = 5;
/** Cuántos candidatos (los de mejor puntaje en la evaluación del cron) se recalculan con sus números. */
export const MAX_CANDIDATOS_SEMANAL = 40;
export const VENTANA_SEMANAL_DIAS = 7;
export const DIAS_REGALO = 14;
/** GETs a fichas que una corrida del domingo se permite (dentro del tope por hora compartido, 30). */
export const LECTURAS_POR_CORRIDA_SEMANAL = 24;
/**
 * Cuánto vale, para el correo, un publicado ya chequeado (05-oct-2026, decisión de Fabrizio): la semana.
 * Los chequeos se reparten en las noches de lunes a sábado (cron semanal-prechequeo) y el domingo solo
 * completa lo que falte; el clic del correo vuelve a chequear igual.
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

/** El rango de precio con que se busca: del piso (con holgura) al tope. */
export function rangoSemanal(p: { precioMinUf: number | null; precioMaxUf: number | null }): { ufMin: number; ufMax: number } | null {
  if (p.precioMaxUf == null || p.precioMaxUf <= 0) return null;
  const piso = p.precioMinUf != null && p.precioMinUf < p.precioMaxUf ? p.precioMinUf * (1 - HOLGURA_PISO) : 0;
  return { ufMin: Math.max(0, Math.floor(piso)), ufMax: p.precioMaxUf };
}

export type ElegidoSemanal<T> = { c: T; ev: Evaluado; tramo: TramoSemanal };

export type ResultadoSemanal<T> =
  | { estado: "armada"; items: Array<ElegidoSemanal<T>> }
  | { estado: "sin_match"; items: [] }
  | { estado: "pendiente"; items: Array<ElegidoSemanal<T>> };

/** El respaldo: los candidatos de las comunas vecinas y la evaluación con el descuento negociable. */
export interface RespaldoSemanal<T> {
  vecinas: () => Promise<T[]>;
  evaluarConDescuento: (c: T) => Promise<Evaluado | null>;
}

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
 * y de las vecinas, por puntaje) que con `DESCUENTO_NEGOCIABLE` dan Comprar.
 */
export async function elegirSemanal<T extends CandidatoSemanal>(
  candidatos: T[],
  evaluar: (c: T) => Promise<Evaluado | null>,
  publicado: (c: T) => Promise<EstadoPublicacion>,
  respaldo?: RespaldoSemanal<T>,
): Promise<ResultadoSemanal<T>> {
  const items: Array<ElegidoSemanal<T>> = [];
  let sinChequeo = 0;
  const tomar = async (lista: Evaluados<T>, tramo: TramoSemanal, hasta: number) => {
    for (const it of lista) {
      if (items.length >= hasta) return;
      if (items.some((x) => x.c.avisoId === it.c.avisoId)) continue;
      const e = await publicado(it.c).catch((): EstadoPublicacion => "sin-chequeo");
      if (e === "publicado") items.push({ ...it, tramo });
      else if (e === "sin-chequeo") sinChequeo++;
    }
  };

  const propios = await evaluarPool(candidatos, evaluar);
  await tomar(porPuntaje(propios, "COMPRAR"), "propia", TOPE_SEMANAL);

  if (items.length < MINIMO_SEMANAL && respaldo) {
    const vecinos = await evaluarPool(await respaldo.vecinas().catch(() => [] as T[]), evaluar);
    await tomar(porPuntaje(vecinos, "COMPRAR"), "vecina", MINIMO_SEMANAL);
    if (items.length < MINIMO_SEMANAL) {
      const ajustar = porPuntaje([...propios, ...vecinos], "AJUSTA SUPUESTOS");
      const conDescuento = await Promise.all(ajustar.map((x) => respaldo.evaluarConDescuento(x.c).catch(() => null)));
      await tomar(ajustar.filter((_, i) => conDescuento[i]?.veredicto === "COMPRAR"), "negociar", MINIMO_SEMANAL);
    }
  }

  if (items.length >= MINIMO_SEMANAL) return { estado: "armada", items };
  // Faltó cupo para chequear: puede que sí haya; lo toma la corrida siguiente.
  if (sinChequeo > 0) return { estado: "pendiente", items };
  return { estado: "sin_match", items: [] };
}

/**
 * El siguiente aviso que la selección de una persona necesita chequear (05-oct-2026): se elige con la regla
 * del domingo, pero sin salir a la fuente —`enMemoria` dice lo ya chequeado en la semana y «sin-chequeo» lo
 * demás—. null si la selección ya se puede armar o no queda nada que chequear.
 */
export async function siguienteAChequear<T extends CandidatoSemanal>(
  candidatos: T[],
  evaluar: (c: T) => Promise<Evaluado | null>,
  enMemoria: (c: T) => Promise<EstadoPublicacion>,
  respaldo?: RespaldoSemanal<T>,
): Promise<T | null> {
  const faltan: T[] = [];
  const g = await elegirSemanal(candidatos, evaluar, async (c) => {
    const e = await enMemoria(c);
    if (e === "sin-chequeo") faltan.push(c);
    return e;
  }, respaldo);
  return g.estado === "armada" ? null : faltan[0] ?? null;
}

/**
 * Los chequeos de una noche, POR TURNOS (05-oct-2026): en cada vuelta, cada persona que todavía necesita
 * chequea UN aviso; la que ya no necesita sale de la fila. Se para sin presupuesto o cuando nadie necesita.
 * Devuelve cuántos chequeos se hicieron.
 */
export async function repartirChequeos<P, T>(
  personas: P[],
  siguiente: (p: P) => Promise<T | null>,
  chequear: (aviso: T) => Promise<unknown>,
  quedaPresupuesto: () => boolean,
): Promise<number> {
  const enFila = [...personas];
  let chequeos = 0;
  while (enFila.length > 0 && quedaPresupuesto()) {
    for (let i = 0; i < enFila.length && quedaPresupuesto(); ) {
      const aviso = await siguiente(enFila[i]);
      if (aviso == null) { enFila.splice(i, 1); continue; }
      await chequear(aviso);
      chequeos++;
      i++;
    }
  }
  return chequeos;
}

/** ¿Es el primer correo semanal de la persona? Entonces se presenta. */
export function esPrimerSemanal(enviadasAntes: number | null | undefined): boolean {
  return (enviadasAntes ?? 0) === 0;
}

/** ¿Le toca el regalo esta semana? 14 días desde el registro, sin compras, nunca antes. */
export function correspondeRegalo(p: { registradoAt: Date; compras: number; regaloOtorgadoAt: string | null; plan: boolean; ahora?: Date }): boolean {
  const ahora = p.ahora ?? new Date();
  if (p.regaloOtorgadoAt || p.compras > 0 || p.plan) return false;
  return ahora.getTime() - p.registradoAt.getTime() >= DIAS_REGALO * 864e5;
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
  usaRegalo: "va por cuenta de Franco",
  sinCreditos: "Ya usaste tus análisis.",
  comprar: `Analizar uno · ${fmtCLP(SINGLE_PRICE)}`,
  comprarBajada: "O con un plan, si vas a analizar varios.",
  vacia: "Los deptos de este correo ya no están publicados. El próximo correo trae los de la semana.",
  otraCuenta: "Este correo es de otra cuenta. Entra con el correo donde lo recibiste.",
  pie: "Franco los revisó con tus números y seguían publicados. Antes de visitar uno, confirma con quien lo publica que sigue disponible.",
  bajaLista: "Listo. Ya no te enviamos los deptos de la semana.",
  bajaVolver: "Si cambias de idea, escríbenos a hola@refranco.ai.",
  bajaError: "No pudimos darte de baja con ese enlace. Escríbenos a hola@refranco.ai y lo hacemos.",
} as const;
