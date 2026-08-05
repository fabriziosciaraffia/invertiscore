/**
 * Resumen y status HTTP de un cron que procesa por lotes.
 *
 * EL PROBLEMA QUE RESUELVE: los crons procesan fila por fila con un catch
 * propio —correcto, un error en una fila no debe abortar el resto— pero el
 * resumen que devolvían contaba SOLO los éxitos. Un cron que recorría 50 filas y
 * fallaba en 49 respondía `{ processed: 50, granted: 1 }` con 200, y Vercel lo
 * anotaba como corrida exitosa. El único rastro de las 49 quedaba en un
 * `console.error` que nadie lee.
 *
 * Acá viven las dos mitades del arreglo: el conteo de fracasos en el body y el
 * criterio de status. El criterio es uno solo para todos los crons a propósito —
 * tenerlo repetido en cinco archivos garantiza que en el sexto sea distinto.
 */

import { NextResponse } from "next/server";

export interface ConteoCron {
  /** Filas que el cron tomó para procesar. */
  procesados: number;
  /** Filas que completaron su trabajo. */
  exitosos: number;
  /** Filas que no lo completaron, por la razón que sea. */
  fallidos: number;
}

/**
 * Status HTTP según el resultado. La escala tiene tres peldaños:
 *
 *   sin fallos (o sin trabajo)  → 200
 *   fallos parciales            → 207 Multi-Status
 *   ninguna fila salió bien     → 500
 *
 * POR QUÉ NO 500 APENAS HAY UN FALLO. Vercel marca la corrida en rojo con
 * cualquier status >= 400. Un cron de 50 filas que falla en una se pintaría rojo
 * todos los días, y una alarma que suena siempre deja de ser una alarma: es el
 * mismo argumento por el que `observabilidad.ts` separa `warning` de `error`. El
 * fallo individual ya viaja a Sentry con su user_id y su operación; el status
 * HTTP responde una pregunta más gruesa —¿esta corrida sirvió de algo?— y para
 * eso el umbral correcto es "no hizo nada".
 *
 * POR QUÉ 207 Y NO 200 EN EL PARCIAL. 207 es 2xx, así que Vercel no la marca
 * fallida —la corrida hizo trabajo real y despertarse por eso sería ruido—, pero
 * deja el caso distinguible para quien mire el historial o arme una alerta
 * propia sobre el body. Es la diferencia entre "salió todo" y "salió parte".
 *
 * POR QUÉ 200 CON `procesados === 0`. Una corrida sin trabajo es lo normal en
 * casi todos estos crons: la mayoría de los días no hay ninguna suscripción
 * anual con lote vencido. Sin este caso, el 500 de "cero exitosos" se dispararía
 * a diario sobre corridas perfectamente sanas.
 */
export function statusCron({ procesados, exitosos, fallidos }: ConteoCron): 200 | 207 | 500 {
  if (fallidos === 0) return 200;
  if (procesados === 0) return 200; // defensivo: sin trabajo no hay fracaso posible
  if (exitosos === 0) return 500;
  return 207;
}

/**
 * Arma la respuesta del cron: conteo explícito de fracasos + status coherente.
 *
 * `extra` son los contadores propios de cada cron (granted, cancelled, sent…).
 * Se conservan con sus nombres actuales para no romper a quien los lea; lo que
 * se agrega es el lado que faltaba.
 */
export function respuestaCron(
  conteo: ConteoCron,
  extra: Record<string, unknown> = {},
): NextResponse {
  const status = statusCron(conteo);
  return NextResponse.json(
    {
      ok: status === 200,
      ...conteo,
      ...extra,
    },
    { status },
  );
}
