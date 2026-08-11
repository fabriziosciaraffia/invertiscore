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

/** Tope de largo de cualquier texto derivado de un error no-`Error`. */
const MAX_LARGO_MENSAJE = 500;

/** Qué forma tenía lo que llegó. Tag de baja cardinalidad (4 valores). */
type FormaError = "error" | "postgrest" | "objeto" | "primitivo";

function recortar(texto: string): string {
  return texto.length > MAX_LARGO_MENSAJE
    ? `${texto.slice(0, MAX_LARGO_MENSAJE)}…`
    : texto;
}

/** ¿Tiene la forma de un PostgrestError? (objeto plano con `message` y `code`) */
function esPostgrestError(x: object): x is { message: string; code: string; hint?: string | null } {
  const o = x as Record<string, unknown>;
  return typeof o.message === "string" && typeof o.code === "string";
}

/**
 * Convierte cualquier cosa en un `Error` legible, sin perder el original.
 *
 * EL BUG QUE ARREGLA: acá vivía `new Error(String(error))`. Un `PostgrestError`
 * de Supabase NO es un `Error` —es un objeto plano `{code, details, hint,
 * message}`— así que `String()` lo aplastaba a la cadena literal
 * "[object Object]". Tres issues de Sentry (suggestions, POST /api/analisis y la
 * comparativa) llegaron a producción diciendo exactamente eso: sin mensaje, sin
 * código, indiagnosticables. El de /api/analisis era además la ÚNICA evidencia
 * de que un usuario real intentó crear un análisis y no quedó fila.
 *
 * Se normaliza acá, en el embudo, y no en cada call site: los 19
 * `reportarFalloQuery` y los 69 `captureApi*` pasan todos por `reportar()`, así
 * que esto es enforcement por construcción y no disciplina de quien escribe el
 * próximo catch.
 *
 * SOBRE `details` — EXCLUIDO A PROPÓSITO. PostgrestError trae un cuarto campo,
 * `details`, que NO se manda a Sentry: es justo donde Postgres escribe valores
 * de fila ante una violación de constraint ("Key (email)=(x@y.com) already
 * exists"), o sea PII. Con `code` + `message` + `hint` se diagnostica igual de
 * bien, y si alguna vez hace falta el detalle exacto, se reproduce la query
 * contra Supabase con el `code` en la mano. No metemos datos de usuarios en
 * Sentry para ahorrarnos ese salto.
 */
export function normalizarError(error: unknown): {
  error: Error;
  forma: FormaError;
  original?: Record<string, unknown>;
} {
  // 1 · Ya es un Error: se pasa intacto. Tocarlo perdería stack y `name`.
  if (error instanceof Error) return { error, forma: "error" };

  if (error !== null && typeof error === "object") {
    // 2 · PostgrestError. El `name` se setea para que Sentry titule el evento
    // "PostgrestError: PGRST205: …" en vez de un "Error" genérico.
    if (esPostgrestError(error)) {
      const { message, code, hint } = error;
      const err = new Error(recortar(`${code}: ${message}`));
      err.name = "PostgrestError";
      return {
        error: err,
        forma: "postgrest",
        original: { code, message: recortar(message), hint: hint ?? null },
      };
    }

    // 3 · Cualquier objeto con `message` legible (errores de librerías, fetch).
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") {
      return { error: new Error(recortar(o.message)), forma: "objeto", original: serializar(o) };
    }

    // 4 · Objeto sin `message`: lo mejor disponible es su contenido.
    const texto = serializarATexto(o);
    return { error: new Error(recortar(texto)), forma: "objeto", original: serializar(o) };
  }

  // 5 · string, number, boolean, null, undefined: acá String() SÍ es correcto.
  return { error: new Error(String(error)), forma: "primitivo" };
}

/**
 * Copia acotada y SEGURA DE SERIALIZAR para mandar como contexto.
 *
 * Los valores anidados se aplanan a texto en vez de pasarse por referencia. Una
 * copia superficial parece suficiente y no lo es: si el objeto tiene un ciclo
 * (`o.self = o`), la copia se lo lleva puesto y el contexto queda imposible de
 * serializar. Como `reportar()` traga sus propias excepciones, eso no se vería
 * como un error: se vería como un evento que nunca llegó a Sentry — el mismo
 * silencio que este módulo existe para romper.
 */
function serializar(o: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o).slice(0, 20)) {
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
      salida[k] = typeof v === "string" ? recortar(v) : v;
      continue;
    }
    try {
      salida[k] = recortar(JSON.stringify(v) ?? String(v));
    } catch {
      salida[k] = "[no serializable]";
    }
  }
  return salida;
}

/** JSON del objeto, o su lista de claves si no se puede serializar (ciclos). */
function serializarATexto(o: Record<string, unknown>): string {
  try {
    return JSON.stringify(o) ?? String(o);
  } catch {
    return `objeto sin mensaje (claves: ${Object.keys(o).join(", ")})`;
  }
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
    const { error: normalizado, forma, original } = normalizarError(error);

    Sentry.withScope((scope) => {
      scope.setLevel(nivel);
      scope.setTag("ruta", ctx.ruta);
      scope.setTag("operacion", ctx.operacion);
      // Qué forma tenía lo capturado. Cuatro valores posibles → sirve para
      // encontrar cualquier camino que todavía llegue sin normalizar.
      scope.setTag("error_forma", forma);
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

      // Contexto APARTE del de `franco`: los campos del error no pueden pisarle
      // claves al caller (ni al revés).
      if (original) scope.setContext("error_original", original);

      for (const [k, v] of Object.entries(ctx.tags ?? {})) scope.setTag(k, v);

      Sentry.captureException(normalizado);
    });
  } catch {
    /* el reporte nunca puede romper el flujo que lo llamó */
  }
}

/**
 * Reporta el error de una query de Supabase que el caller IGNORA a propósito.
 *
 * EL CASO: media docena de lecturas de la cadena de datos de mercado
 * destructuran solo `data` y tiran el `error` al piso. Un fallo de query queda
 * indistinguible de "no hay filas": las dos cosas producen un array vacío y el
 * código cae al siguiente nivel sin decir nada. Es la misma forma que mantuvo
 * invisible a `market_data` durante meses — la tabla no existía, cada consulta
 * fallaba, y el sistema respondía con un seed inventado.
 *
 * El comportamiento NO cambia: quien llama a esto ya decidió degradar y sigue
 * degradando. Lo único que cambia es que el fallo deja rastro.
 *
 * CERO FILAS NO ES UN ERROR. `.single()` y `.maybeSingle()` devuelven PGRST116
 * cuando no hay resultado, que es una respuesta legítima —la clave no existe, la
 * comuna no tiene avisos— y no una falla. Reportarlo llenaría Sentry de ruido
 * hasta tapar lo que importa, que es exactamente lo que este módulo intenta
 * evitar. Por eso se filtra acá, en un solo lugar, y no en cada call-site: el
 * criterio no se vuelve a decidir siete veces.
 */
export function reportarFalloQuery(error: unknown, ctx: ContextoError): void {
  if (!error) return;
  const codigo = (error as { code?: string } | null)?.code;
  if (codigo === "PGRST116") return; // cero filas: respuesta válida, no falla
  captureApiWarning(error, {
    ...ctx,
    tags: { ...ctx.tags, degradado: "true" },
  });
}
