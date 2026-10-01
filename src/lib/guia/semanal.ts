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
/** El crédito regalado vence a los 60 días: así se gasta primero (el FIFO va por vencimiento). */
export const DIAS_VIGENCIA_REGALO = 60;
/** La holgura del rango de precio: el piso baja 10% bajo lo más barato que analizó; el tope no se pasa. */
export const HOLGURA_PISO = 0.1;

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

export type ResultadoSemanal<T> =
  | { estado: "armada"; items: Array<{ c: T; ev: Evaluado }> }
  | { estado: "sin_match"; items: [] }
  | { estado: "pendiente"; items: Array<{ c: T; ev: Evaluado }> };

/**
 * Elige los deptos de la semana. `candidatos` viene de la RPC, ya filtrado por el perfil. Se recalculan
 * los de mejor puntaje del cron con los números de la persona; se quedan los Comprar, por puntaje; y se
 * chequea la ficha de a uno hasta juntar `TOPE_SEMANAL` publicados.
 */
export async function elegirSemanal<T extends CandidatoSemanal>(
  candidatos: T[],
  evaluar: (c: T) => Promise<Evaluado | null>,
  publicado: (c: T) => Promise<EstadoPublicacion>,
): Promise<ResultadoSemanal<T>> {
  const pool = [...candidatos].sort((a, b) => (b.scoreCron ?? -1) - (a.scoreCron ?? -1)).slice(0, MAX_CANDIDATOS_SEMANAL);
  const evs = await Promise.all(pool.map((c) => evaluar(c).catch(() => null)));
  const buenos = pool
    .map((c, i) => ({ c, ev: evs[i] }))
    .filter((x): x is { c: T; ev: Evaluado } => x.ev?.veredicto === "COMPRAR")
    .sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1));
  const items: Array<{ c: T; ev: Evaluado }> = [];
  let sinChequeo = 0;
  for (const it of buenos) {
    if (items.length >= TOPE_SEMANAL) break;
    const e = await publicado(it.c).catch((): EstadoPublicacion => "sin-chequeo");
    if (e === "publicado") items.push(it);
    else if (e === "sin-chequeo") sinChequeo++;
  }
  if (items.length >= MINIMO_SEMANAL) return { estado: "armada", items };
  // Faltó cupo para chequear: puede que sí haya; lo toma la corrida siguiente.
  if (sinChequeo > 0) return { estado: "pendiente", items };
  return { estado: "sin_match", items: [] };
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
