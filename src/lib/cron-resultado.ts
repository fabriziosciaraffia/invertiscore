/**
 * Resumen, status HTTP, resultado en el panel y alerta de un cron.
 *
 * EL PROBLEMA QUE RESUELVE: los crons procesan fila por fila con un catch
 * propio —correcto, un error en una fila no debe abortar el resto— pero el
 * resumen que devolvían contaba SOLO los éxitos. Un cron que recorría 50 filas y
 * fallaba en 49 respondía `{ processed: 50, granted: 1 }` con 200, y Vercel lo
 * anotaba como corrida exitosa. El único rastro de las 49 quedaba en un
 * `console.error` que nadie lee.
 *
 * Y EL QUE SE NOS PASÓ IGUAL (29-sep-2026): scrape-unidades-nuevas no escribió
 * una sola unidad del 03-ago al 29-sep. Cada proyecto fallaba (la fuente le
 * respondía el desafío del WAF), los errores iban a un arreglo dentro del JSON,
 * el route respondía 200 y el latido salía verde todos los días. De ahí la regla
 * de hoy, fijada por Fabrizio: **si un cron falla en todo o en parte, responde
 * con error y el panel lo pinta en rojo**, y a hola@ le llega un correo.
 *
 * El criterio es uno solo para todos los crons a propósito: tenerlo repetido en
 * trece archivos garantiza que en el catorce sea distinto.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarMetrica } from "@/lib/metrics-daily";

export interface ConteoCron {
  /** Filas (o unidades de trabajo) que el cron tomó para procesar. */
  procesados: number;
  /** Las que completaron su trabajo. */
  exitosos: number;
  /** Las que no lo completaron, por la razón que sea. */
  fallidos: number;
}

export type ResultadoCron = "ok" | "parcial" | "fallo";

/** Para los crons de una sola unidad de trabajo (una consulta, una escritura). */
export const CORRIDA_OK: ConteoCron = { procesados: 1, exitosos: 1, fallidos: 0 };
export const CORRIDA_FALLIDA: ConteoCron = { procesados: 1, exitosos: 0, fallidos: 1 };

/** Fuente de `metrics_daily` donde queda el resultado de cada corrida (el latido vive en «cron»). */
export const FUENTE_RESULTADO = "cron-resultado";
/** Fuente donde se anota que ya salió la alerta del día, para no mandar una por corrida. */
export const FUENTE_ALERTA = "cron-alerta";
/** `valor` del resultado en metrics_daily. */
export const VALOR_RESULTADO: Record<ResultadoCron, number> = { ok: 0, parcial: 1, fallo: 2 };

export function resultadoCron({ exitosos, fallidos }: ConteoCron): ResultadoCron {
  // Sin mirar `procesados`: un cron que revienta leyendo (0 procesados, 1 fallido) FALLÓ. Antes el
  // «sin trabajo no hay fracaso posible» lo dejaba en 200 (recordatorio-pack, evaluar-avisos).
  if (fallidos === 0) return "ok";
  return exitosos === 0 ? "fallo" : "parcial";
}

/**
 * Status HTTP: 200 si salió todo (o no había trabajo), 500 si algo falló.
 *
 * Hasta el 29-sep-2026 el parcial respondía 207 —2xx, para no pintar rojo una
 * corrida que había hecho trabajo real—. Ese matiz es justo el que dejó pasar dos
 * meses de un scraper muerto: todo 2xx se lee como sano. Ahora el parcial es
 * error; lo que distingue «parcial» de «fallo» viaja en el body (`resultado`),
 * que es lo que lee el botón del admin.
 *
 * 200 CON `procesados === 0` Y SIN FALLOS: una corrida sin trabajo es lo normal en casi todos
 * estos crons (la mayoría de los días no hay lote vencido). Que un cron que
 * SIEMPRE tenía trabajo deje de tenerlo lo caza la vigilancia de frescura
 * (vigilar-crons), no el status.
 */
export function statusCron(conteo: ConteoCron): 200 | 500 {
  return resultadoCron(conteo) === "ok" ? 200 : 500;
}

/** La respuesta del cron: conteo explícito de fracasos, resultado y status coherente. */
export function respuestaCron(conteo: ConteoCron, extra: Record<string, unknown> = {}): NextResponse {
  const resultado = resultadoCron(conteo);
  return NextResponse.json(
    { ok: resultado === "ok", resultado, ...conteo, ...extra },
    { status: statusCron(conteo) },
  );
}

/**
 * Cierra la corrida: deja el resultado para el panel (verde/rojo), manda la
 * alerta a hola@ si algo falló (una por cron por día) y devuelve la respuesta.
 * TODO cron termina por acá, también cuando revienta antes de contar (pasale
 * `{ procesados: 1, exitosos: 0, fallidos: 1 }` y el error en `extra.error`).
 *
 * Nunca lanza: si no puede escribir el resultado o mandar el correo, el cron
 * responde igual (lo que ya hizo no se deshace por un fallo de la vigilancia).
 */
export async function cerrarCron(
  sb: SupabaseClient,
  nombre: string,
  conteo: ConteoCron,
  extra: Record<string, unknown> = {},
  opts: { registrar?: boolean } = {},
): Promise<NextResponse> {
  // Un ensayo (?dry=1) responde igual pero no deja resultado ni alerta: no es una corrida.
  if (opts.registrar === false) return respuestaCron(conteo, extra);
  const resultado = resultadoCron(conteo);
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    await guardarMetrica(sb, {
      fecha: hoy,
      fuente: FUENTE_RESULTADO,
      metrica: nombre,
      valor: VALOR_RESULTADO[resultado],
      meta: { ...conteo, ...resumenError(extra) },
    });
    if (resultado !== "ok") {
      await alertarUnaVezAlDia(sb, nombre, hoy, `La corrida terminó con ${resultado === "fallo" ? "falla total" : "falla parcial"}: ${conteo.fallidos} de ${conteo.procesados} fallaron.`, extra);
    }
  } catch (e) {
    console.error("[cron-resultado] no se pudo cerrar", nombre, e);
  }
  return respuestaCron(conteo, extra);
}

/**
 * La alerta a hola@, a lo más una por cron y por motivo al día (la anota en
 * metrics_daily antes de mandarla). La usan cerrarCron y vigilar-crons.
 */
export async function alertarUnaVezAlDia(
  sb: SupabaseClient,
  nombre: string,
  hoy: string,
  problema: string,
  extra: Record<string, unknown> = {},
  motivo = "falla",
): Promise<boolean> {
  const metrica = `${nombre}:${motivo}`;
  const { data } = await sb.from("metrics_daily").select("valor").eq("fecha", hoy).eq("fuente", FUENTE_ALERTA).eq("metrica", metrica).maybeSingle();
  if (data) return false;
  await guardarMetrica(sb, { fecha: hoy, fuente: FUENTE_ALERTA, metrica, valor: 1 });
  const { sendAlertaCronInterna } = await import("@/lib/email");
  await sendAlertaCronInterna({ cron: nombre, problema, detalle: detalleDe(extra) });
  return true;
}

function resumenError(extra: Record<string, unknown>): Record<string, unknown> {
  const e = extra.error ?? extra.errors ?? extra.errores;
  return e === undefined ? {} : { error: JSON.stringify(e).slice(0, 500) };
}

function detalleDe(extra: Record<string, unknown>): string[] {
  const e = extra.error ?? extra.errors ?? extra.errores;
  if (e === undefined) return [];
  const lista = Array.isArray(e) ? e : [e];
  return lista.slice(0, 5).map((x) => (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 200));
}
