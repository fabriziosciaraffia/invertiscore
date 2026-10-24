// ─────────────────────────────────────────────────────────────────────────────
// EL REGALO AL REGISTRARSE (16-oct-2026, decisión de Fabrizio): toda cuenta nueva, por cualquier puerta, nace con un
// análisis de regalo cargado, vigente 30 días. Reemplaza al «primer análisis gratis» (welcome_credit_used): una cuenta
// creada desde REGALO_ALTA_DESDE ya no tiene bienvenida —tiene el regalo—, así no son dos. Las cuentas de antes quedan
// como estaban.
//
// TOPES, contra las cuentas repetidas (los de Fabrizio: por dispositivo y por día): uno por DISPOSITIVO cada 30 días (la
// cookie `franco_disp`, src/lib/dispositivo.ts) y CIEN en el día en total. La IP queda anotada en hash, pero NO topa: en
// Chile los celulares salen a internet por IPs compartidas (CGNAT), y un tope por IP les quitaría el regalo a personas
// distintas en plena campaña. Una cuenta que topa no recibe regalo y tampoco la bienvenida: lo que queda es pagar.
//
// LAS CUENTAS DE LA CASA NO TOPAN POR DISPOSITIVO (24-oct-2026, recorrido de Fabrizio por /deptos): el teléfono de
// Fabrizio ya le había regalado un análisis a +franco el 22-oct, y sus dos cuentas +qadeptos del 24-oct nacieron sin
// regalo y sin la tarjeta de «Estás dentro». El tope existe contra las cuentas repetidas de afuera; las de la casa —un
// alias del correo de admin, una cuenta @refranco.ai, o una cuenta nueva en un dispositivo que ya le regaló a una cuenta
// de prueba— lo reciben igual. El tope del día sigue para todas.
//
// El regalo de REACTIVACIÓN —4 semanas sin analizar, uno cada 90 días, con su semanal— es otro: semanal.ts ›
// correspondeReactivacion. Puro: lo prueba el tier PUERTA-B. La escritura vive en regalo-alta-servidor.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { FUENTE_PREMIO_REFERIDO } from "./referido";

export const FUENTE_REGALO_ALTA = "regalo_alta";
export const FUENTE_REGALO_REACTIVACION = "regalo_reactivacion";
/** El regalo de los 14 días que hubo hasta el 16-oct-2026 (los lotes vivos siguen con este nombre). */
export const FUENTE_REGALO_SEMANAL_LEGADO = "regalo_semanal";
/** Todo lo que es regalo: el saldo y el aviso antes de gastar lo distinguen («usa tu análisis de regalo»). El premio por
 *  invitar (16-oct-2026, referido.ts) también: es un análisis que Franco regala, con su vencimiento. */
export const FUENTES_REGALO: ReadonlySet<string> = new Set([FUENTE_REGALO_ALTA, FUENTE_REGALO_REACTIVACION, FUENTE_REGALO_SEMANAL_LEGADO, FUENTE_PREMIO_REFERIDO]);

export const DIAS_VIGENCIA_REGALO_ALTA = 30;
/** Desde cuándo una cuenta nace con el regalo (y sin la bienvenida). */
export const REGALO_ALTA_DESDE = "2026-10-16T00:00:00Z";
export const TOPE_REGALOS_DISPOSITIVO = 1;
export const DIAS_TOPE_DISPOSITIVO = 30;
export const TOPE_REGALOS_DIA = 100;

/** ¿Es una cuenta del regalo (creada desde el corte)? Entonces no tiene bienvenida. */
export function esCuentaDelRegalo(creadaAt: string | Date | null | undefined): boolean {
  if (!creadaAt) return false;
  const t = typeof creadaAt === "string" ? Date.parse(creadaAt) : creadaAt.getTime();
  return Number.isFinite(t) && t >= Date.parse(REGALO_ALTA_DESDE);
}

/** La bienvenida («el primer análisis va por cuenta de Franco») vale solo para las cuentas de antes del regalo. */
export function bienvenidaVigente(creadaAt: string | Date | null | undefined): boolean {
  return !esCuentaDelRegalo(creadaAt);
}

export type DecisionRegalo = "otorgar" | "vieja" | "tope_dispositivo" | "tope_dia";

/** El dominio de las cuentas de prueba de Franco (qa-…@refranco.ai). */
export const DOMINIO_DE_LA_CASA = "refranco.ai";

/**
 * ¿El correo es de la casa? Un alias de un correo de admin (fabriziosciaraffia+lo-que-sea@gmail.com cuando el admin es
 * fabriziosciaraffia@gmail.com), el admin mismo, o una cuenta @refranco.ai. `admins`: la lista de ADMIN_EMAIL.
 */
export function esCorreoDeLaCasa(correo: string | null | undefined, admins: readonly string[]): boolean {
  const c = (correo ?? "").trim().toLowerCase();
  const arroba = c.lastIndexOf("@");
  if (arroba <= 0) return false;
  const dominio = c.slice(arroba + 1);
  if (dominio === DOMINIO_DE_LA_CASA) return true;
  const base = c.slice(0, arroba).split("+")[0];
  return admins.some((a) => a.trim().toLowerCase() === `${base}@${dominio}`);
}

/**
 * Qué se hace con el regalo de una cuenta. Los conteos son de regalos YA OTORGADOS: del dispositivo en los últimos
 * DIAS_TOPE_DISPOSITIVO días y de todo hoy (hora de Chile). `null` = no se sabe (sin cookie): no frena. `deLaCasa`: la
 * cuenta es de la casa (esCorreoDeLaCasa o un dispositivo de prueba): el dispositivo no la topa.
 */
export function decidirRegaloAlta(p: {
  creadaAt: string | Date | null | undefined;
  porDispositivo: number | null;
  totalHoy: number;
  deLaCasa?: boolean;
}): DecisionRegalo {
  if (!esCuentaDelRegalo(p.creadaAt)) return "vieja";
  if (p.totalHoy >= TOPE_REGALOS_DIA) return "tope_dia";
  if (p.porDispositivo != null && p.porDispositivo >= TOPE_REGALOS_DISPOSITIVO && !p.deLaCasa) return "tope_dispositivo";
  return "otorgar";
}

/** ¿El dispositivo ya topa? (Solo entonces se pregunta si la cuenta es de la casa.) */
export function dispositivoTopa(porDispositivo: number | null): boolean {
  return porDispositivo != null && porDispositivo >= TOPE_REGALOS_DISPOSITIVO;
}

/** El día en Chile (YYYY-MM-DD), el mismo con que la tabla cuenta el tope del día. */
export function diaChile(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

/** El aviso antes de gastar y el saldo (16-oct-2026): con un regalo, se dice que se usa el regalo. */
export const REGALO_COPY = {
  usaRegalo: "Usa tu análisis de regalo.",
  usaUnoDe: (n: number) => (n === 1 ? "Usa tu último análisis." : `Usa 1 de tus ${n} análisis.`),
  tienes: "Tienes un análisis de regalo.",
  cargado: "Te cargamos un análisis de regalo.",
} as const;
