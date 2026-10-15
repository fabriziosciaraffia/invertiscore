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
import { alCerrar, esperaResumen, type Accion, type Aviso } from "@/lib/cron-alertas";
import { guardarEstadoCron, leerEstadoCron } from "@/lib/cron-estado";

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
 * Cierra la corrida: deja el resultado para el panel (verde/rojo) y el estado del cron, avisa a hola@ SOLO si hace
 * falta una persona (cron-alertas.ts: una acción declarada en `extra.accion`, o la segunda falla seguida de un cron de
 * una corrida al día; los de varias esperan el resumen del día) y devuelve la respuesta.
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
    // Las reglas de las alertas (15-oct-2026): una falla sola queda en el registro y el panel.
    const { estado, avisos } = alCerrar(
      await leerEstadoCron(sb, nombre),
      { ok: resultado === "ok", causa: resultado === "ok" ? null : `${resultado === "fallo" ? "falla total" : "falla parcial"}: ${motivoDeFalla(conteo, extra)}`, accion: accionDe(extra) },
      new Date(),
      esperaResumen(nombre),
    );
    await guardarEstadoCron(sb, nombre, estado);
    for (const a of avisos) await avisar(sb, nombre, a, extra);
  } catch (e) {
    console.error("[cron-resultado] no se pudo cerrar", nombre, e);
  }
  return respuestaCron(conteo, extra);
}

/** Lo que necesita a una persona, declarado por el cron al cerrar (`extra.accion`: { codigo, texto }). */
export function accionDe(extra: Record<string, unknown>): Accion | null {
  const a = extra.accion as Partial<Accion> | undefined;
  return a && typeof a.codigo === "string" && a.codigo && typeof a.texto === "string" ? { codigo: a.codigo, texto: a.texto } : null;
}

/**
 * Un aviso a hola@ (15-oct-2026: solo cuando las reglas de cron-alertas.ts lo piden; ya no uno por día). Queda anotado
 * en metrics_daily (`cron-alerta`, «cron:condición» del día) antes de mandarlo: así se cuentan los correos.
 */
export async function avisar(sb: SupabaseClient, nombre: string, a: Aviso, extra: Record<string, unknown> = {}): Promise<void> {
  const hoy = new Date().toISOString().slice(0, 10);
  await guardarMetrica(sb, { fecha: hoy, fuente: FUENTE_ALERTA, metrica: `${nombre}:${a.clave}`, valor: 1 });
  await correoDeAlertas.enviar({ cron: nombre, problema: a.texto, detalle: detalleDe(extra) });
}

/** Quién manda el correo de una alerta. Un objeto y no una función suelta: los tiers lo reemplazan por un contador
 *  (asignarle a un export no hace nada en este repo) y así ninguna prueba le escribe a hola@. */
export const correoDeAlertas = {
  async enviar(p: { cron: string; problema: string; detalle: string[] }): Promise<void> {
    const { sendAlertaCronInterna } = await import("@/lib/email");
    await sendAlertaCronInterna(p);
  },
};

/**
 * El motivo concreto de una falla, para el correo (02-oct-2026): cuántos de cuántos y con qué error, por
 * ejemplo «137 de 137 proyectos con http 403». El cron dice qué cuenta (`unidad`, por defecto
 * «elementos») y, si puede, el desglose completo (`erroresPorTipo`); si no, se agrupa la lista de errores
 * que trae, quitando el prefijo propio de cada uno («proyecto 723905: »), y se dice que es una muestra.
 */
export function motivoDeFalla(conteo: ConteoCron, extra: Record<string, unknown> = {}): string {
  const unidad = typeof extra.unidad === "string" && extra.unidad ? extra.unidad : "elementos";
  const base = `${conteo.fallidos} de ${conteo.procesados} ${unidad}`;
  let tipos: Array<[string, number]> = [];
  let muestra = false;
  if (extra.erroresPorTipo && typeof extra.erroresPorTipo === "object") {
    tipos = Object.entries(extra.erroresPorTipo as Record<string, number>).filter(([, n]) => Number(n) > 0).map(([k, n]) => [k, Number(n)]);
  } else {
    const e = extra.error ?? extra.errors ?? extra.errores;
    const lista = (Array.isArray(e) ? e : e === undefined ? [] : [e]).map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
    const porTipo = new Map<string, number>();
    for (const s of lista) {
      const tipo = s.replace(/^[^:]{1,40}?\s[\w-]+:\s*/, "").slice(0, 80) || s.slice(0, 80);
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    }
    tipos = Array.from(porTipo.entries());
    muestra = lista.length > 0 && lista.length < conteo.fallidos;
  }
  if (tipos.length === 0) return `${base} fallaron`;
  tipos.sort((a, b) => b[1] - a[1]);
  if (!muestra && tipos.length === 1 && tipos[0][1] === conteo.fallidos) return `${base} con ${tipos[0][0]}`;
  const detalle = tipos.slice(0, 3).map(([k, n]) => `${n} con ${k}`).join(" · ");
  return `${base} fallaron (${muestra ? `en los primeros ${tipos.reduce((a, [, n]) => a + n, 0)}: ` : ""}${detalle})`;
}

function resumenError(extra: Record<string, unknown>): Record<string, unknown> {
  const e = extra.error ?? extra.errors ?? extra.errores;
  const pausa = typeof extra.pausa === "string" && extra.pausa ? { pausa: extra.pausa.slice(0, 120) } : {};
  return e === undefined ? pausa : { error: JSON.stringify(e).slice(0, 500), ...pausa };
}

/**
 * EN PAUSA (13-oct-2026): el cron corrió y salió bien, pero no tiene qué medir por una condición externa conocida
 * —meta-ads sin un token válido: «sin campaña activa»—. Se pasa en `extra.pausa` con la frase; queda en el
 * resultado de la corrida, y mientras la última corrida esté en pausa la vigilancia no le cuenta la frescura
 * (`leerLatidos`): no escribir es lo esperado. Cuando la condición se va, la corrida siguiente sale sin pausa y
 * todo vuelve a contar.
 */
export const CLAVE_PAUSA = "pausa";

function detalleDe(extra: Record<string, unknown>): string[] {
  const e = extra.error ?? extra.errors ?? extra.errores;
  if (e === undefined) return [];
  const lista = Array.isArray(e) ? e : [e];
  return lista.slice(0, 5).map((x) => (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 200));
}
