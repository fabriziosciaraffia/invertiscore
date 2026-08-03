/**
 * Reporte de errores de rutas de API a Sentry.
 *
 * EL PROBLEMA QUE RESUELVE: Sentry captura las excepciones NO capturadas. Un
 * `try/catch` que atrapa el error y hace `console.error` lo deja ciego — el
 * error va a los logs de Vercel y muere ahí. En este repo había 194
 * `console.error` y UN solo `captureException`, y ese estaba en un componente de
 * cliente (global-error.tsx). Todas las rutas de análisis, pagos y
 * suscripciones reportaban a un lugar que nadie mira.
 *
 * El caso que lo hizo evidente: si POST /api/analisis explota ANTES del INSERT,
 * no queda fila en `analisis`, el usuario ve "Error interno del servidor", y no
 * había ningún registro de que ese intento existió. Un usuario que crasheó era
 * indistinguible de uno que nunca lo intentó.
 *
 * Este módulo NO reemplaza los `console.error`: se llama al lado. Los logs de
 * Vercel siguen sirviendo para leer una traza completa en el momento; Sentry
 * sirve para enterarse de que pasó y agrupar por frecuencia.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Contexto de una falla. Todo opcional: se manda lo que haya a mano en el punto
 * del catch, sin obligar al caller a construir nada.
 *
 * NO PONER ACÁ: tokens, secrets, `payment_data` completo, headers de auth ni
 * cuerpos de request. Sentry retiene estos eventos y son legibles por cualquiera
 * con acceso al proyecto. Identificadores sí (user_id, analysis_id,
 * commerce_order); contenido no.
 */
export interface ContextoError {
  /** Ruta lógica, ej. "POST /api/analisis". Es el agrupador principal. */
  ruta: string;
  /** Qué se estaba haciendo, ej. "crear-analisis-ltr", "emitir-boleta". */
  operacion: string;
  userId?: string | null;
  analysisId?: string | null;
  /** Identificador de la orden. Es un id, no un dato de pago. */
  commerceOrder?: string | null;
  /**
   * Tags extra para filtrar en Sentry. Valores CORTOS y de baja cardinalidad
   * (banderas, enums) — un tag por id único hace inusable el buscador.
   */
  tags?: Record<string, string>;
  /**
   * Datos sueltos para leer en el evento (no filtrables). Mismo criterio de
   * privacidad que arriba.
   */
  extra?: Record<string, unknown>;
}

/**
 * Reporta una falla que ROMPIÓ la operación — el usuario se llevó un error o la
 * request terminó mal. Nivel `error`: son las que deberían disparar alertas.
 */
export function captureApiError(error: unknown, ctx: ContextoError): void {
  reportar(error, ctx, "error");
}

/**
 * Reporta una falla de un bloque BEST-EFFORT: algo que por diseño no rompe el
 * flujo (un correo que no salió, una boleta que no se emitió, un evento de
 * analytics que se perdió).
 *
 * Va como `warning` a propósito, para que se pueda separar en Sentry de lo que
 * de verdad rompió. Estos casos igual importan —una boleta que no se emite es
 * plata sin documentar— pero mezclarlos con los errores duros haría que las
 * alertas dejen de significar algo.
 */
export function captureApiWarning(error: unknown, ctx: ContextoError): void {
  reportar(error, ctx, "warning");
}

function reportar(error: unknown, ctx: ContextoError, nivel: "error" | "warning"): void {
  // NUNCA propaga: si el reporte falla, el caller no se entera. Un catch que se
  // rompe reportando su propio error sería peor que el error original.
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(nivel);
      scope.setTag("ruta", ctx.ruta);
      scope.setTag("operacion", ctx.operacion);
      // Agrupa por ruta + operación en vez de por el mensaje del error: dos
      // fallas distintas del mismo punto quedan juntas, que es como se leen.
      scope.setFingerprint([ctx.ruta, ctx.operacion]);

      if (ctx.userId) scope.setUser({ id: ctx.userId });

      // Ids como contexto, no como tag: son de cardinalidad alta y un tag por id
      // único vuelve inservible el filtro de Sentry.
      const datos: Record<string, unknown> = { ...ctx.extra };
      if (ctx.analysisId) datos.analysis_id = ctx.analysisId;
      if (ctx.commerceOrder) datos.commerce_order = ctx.commerceOrder;
      if (Object.keys(datos).length > 0) scope.setContext("franco", datos);

      for (const [k, v] of Object.entries(ctx.tags ?? {})) scope.setTag(k, v);

      // Un throw de un string o de un objeto plano llegaría a Sentry sin stack y
      // sin agrupar. Se envuelve en Error para que siempre haya algo legible.
      scope.setLevel(nivel);
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch {
    /* el reporte nunca puede romper el flujo que lo llamó */
  }
}
