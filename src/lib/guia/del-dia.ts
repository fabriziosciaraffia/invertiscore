// ─────────────────────────────────────────────────────────────────────────────
// EL CORREO DEL DÍA (16-oct-2026, decisiones de Fabrizio): quien se registra por /deptos recibe, dentro de la hora y
// cualquiera sea su «cuándo», sus primeros deptos con la ficha chequeada. Va EN COLA para no romper el cupo de lecturas
// de ficha (30 GETs por hora entre todos, publicacion.ts): cada vuelta lee lo que el cupo deja y, si se copa, la vuelta
// siguiente sigue. Pasados MINUTOS_CUPO_DEL_DIA sin poder chequear, sale con lo que el prechequeo de la noche (o otra
// lectura de la semana) vio publicado y lo dice con la hora: «publicados al [hora]». Ese correo ES el semanal de esa
// semana: el lunes siguiente va solo si hay nuevos (semanal.ts › queEnviarSemanal).
// Vive en `semanal_selecciones` con `tipo` = 'del_dia': mismo token, misma página /semanal, mismo clic. Puro: lo prueba el
// tier PUERTA-B; la escritura y el envío, del-dia-servidor.ts y el cron correo-del-dia.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReglaSemanal } from "./semanal";

/** Pasado esto sin cupo, sale con lo que ya se sabe publicado (la promesa es «dentro de la hora»). */
export const MINUTOS_CUPO_DEL_DIA = 45;
/** GETs que una vuelta se permite (tres chequeos), dentro del tope por hora compartido. */
export const LECTURAS_POR_VUELTA_DEL_DIA = 6;
/** Cuántas vueltas de la cola, como mucho: con la vuelta cada 10 minutos, una hora y algo. */
export const VUELTAS_MAX_DEL_DIA = 8;
/** El correo del día acepta menos de tres: son sus primeros deptos, y con uno ya hay valor. Con negociables, como el
 *  semanal de renta larga. */
export const REGLA_DEL_DIA: ReglaSemanal = { conNegociables: true, aceptarMenos: true };

export type PasoDelDia = "enviar" | "esperar" | "enviar_lo_visto";

/**
 * Qué hace una vuelta con la selección del día. Armada o sin coincidencias → sale. Pendiente (faltó cupo para chequear):
 * espera la vuelta siguiente, salvo que ya pasó la hora (o las vueltas): entonces sale con lo visto publicado.
 */
export function pasoDelDia(p: { estado: "armada" | "pendiente" | "sin_match"; minutos: number; vueltas: number }): PasoDelDia {
  if (p.estado !== "pendiente") return "enviar";
  return p.minutos >= MINUTOS_CUPO_DEL_DIA || p.vueltas >= VUELTAS_MAX_DEL_DIA ? "enviar_lo_visto" : "esperar";
}

const horaChile = (d: Date) => d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago" });
const diaChile = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

/** «hoy a las 03:12», «ayer a las 23:40», «el 14 de octubre a las 09:05»: cuándo se vio, en hora de Chile. */
export function cuandoSeVio(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const hoy = diaChile(ahora), ese = diaChile(d), ayer = diaChile(new Date(ahora.getTime() - 864e5));
  if (ese === hoy) return `hoy a las ${horaChile(d)}`;
  if (ese === ayer) return `ayer a las ${horaChile(d)}`;
  return `el ${d.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" })} a las ${horaChile(d)}`;
}

/** La marca de cada depto en «Estás dentro» y en el dashboard: «Visto publicado hoy a las 03:12». */
export function marcaVisto(iso: string, ahora: Date = new Date()): string {
  return `Visto publicado ${cuandoSeVio(iso, ahora)}`;
}

export const DEL_DIA = {
  asunto: "Tus primeros deptos, revisados hoy",
  titular: "Tus primeros deptos, revisados hoy",
  preencabezado: (n: number) => (n === 1 ? "El depto publicado que mejor resulta con lo que buscas." : `Los ${n} deptos publicados que mejor resultan con lo que buscas.`),
  introN: (n: number, busca: string, pie: string, plazo: number, negociar = 0) =>
    `Hoy, ${n === 1 ? "1 depto publicado" : `${n} deptos publicados`} como los que buscas —${busca}— ${n === 1 ? "resulta" : "resultan"} con un pie de ${pie}% y un plazo de ${plazo} años${
      negociar === 0 ? "" : negociar === 1 ? ", uno de ellos si lo negocias" : `, ${negociar} de ellos si los negocias`}.`,
  /** Desde ahora, el semanal (la presentación del primer correo). */
  semanal: "Desde ahora, cada lunes te mandamos los nuevos que convengan.",
  /** «Publicados al [hora]»: el chequeo más antiguo de lo que va en el correo. */
  publicadosAl: (cuando: string) => `Franco los vio publicados ${cuando}. Antes de visitar uno, confirma con quien lo publica que sigue disponible.`,
  regalo: "Te cargamos un análisis de regalo: úsalo en el depto que quieras.",
  vacioAsunto: "Te aviso cuando aparezca uno",
  vacio: "Hoy no encontré uno publicado que convenga con lo que buscas. Sigo buscando y te aviso cuando aparezca uno.",
  vacioPerfil: "Si quieres buscar en otras comunas o con otro pie, cámbialo en tu perfil:",
} as const;
