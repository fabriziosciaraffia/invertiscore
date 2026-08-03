/**
 * Acumulador de consumo de tokens de la API de Anthropic.
 *
 * Antes, el objeto que devuelve `messages.create` se leía solo para sacar
 * `content[0].text` y se descartaba — el campo `usage` se perdía en cada
 * llamada. Sin él, "cuánto cuesta un análisis" no se puede responder: el KPI de
 * costo IA del panel era análisis × $150, un número inventado.
 *
 * Se guardan TOKENS Y MODELO, nunca pesos. El precio por token cambia y el
 * modelo también; convertir a plata al escribir congelaría una tarifa vieja en
 * la fila. La conversión va donde se lee.
 */

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Contadores de una generación completa (la llamada principal más sus retries).
 *
 * OJO con `inputTokens`: NO es el prompt completo. La API devuelve el prompt
 * partido en tres, y `input_tokens` es solo el pedazo que NO salió de caché:
 *
 *     prompt total = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
 *
 * Sumar solo `inputTokens` subestima. Hoy el repo no usa prompt caching (no hay
 * un solo `cache_control` en src/), así que los dos campos de caché vuelven en
 * cero y la diferencia no se nota — por eso se guardan igual: el día que se
 * active el caching, la fórmula ya está completa y las filas viejas no mienten.
 *
 * La distinción además importa para el costo, no solo para el total: una lectura
 * de caché cuesta ~0,1× el input normal, pero una ESCRITURA cuesta 1,25× (o 2×
 * con TTL de una hora). Sin `cacheCreationTokens` el costo queda subestimado
 * justo cuando el caching esté encendido.
 */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Llamadas a la API, incluidas las que no aportan tokens (ver acumularLlamada). */
  calls: number;
}

export function nuevoAcumuladorUsage(): AiUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    calls: 0,
  };
}

/** Lo mínimo que necesita el acumulador de una respuesta de la API. */
type RespuestaConUsage = Pick<Anthropic.Message, "usage">;

/**
 * Suma el consumo de UNA respuesta al acumulador.
 *
 * Los dos campos de caché son opcionales en la respuesta —vienen `undefined`
 * cuando el request no usó `cache_control`, que es todo el repo hoy—, así que
 * van con `?? 0`. Sin eso el acumulador se vuelve NaN en la primera llamada y
 * se lleva puesto el UPDATE entero.
 */
export function acumularUsage(acc: AiUsage, respuesta: RespuestaConUsage | null | undefined): void {
  acc.calls += 1;
  const u = respuesta?.usage;
  if (!u) return;
  acc.inputTokens += u.input_tokens ?? 0;
  acc.outputTokens += u.output_tokens ?? 0;
  acc.cacheReadTokens += u.cache_read_input_tokens ?? 0;
  acc.cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
}

/**
 * Cuenta una llamada SIN sumar sus tokens.
 *
 * Único caso: el micro-check anti-fabricación (CATCH-ROOT-A), que corre contra
 * Haiku 4.5 y no contra el modelo del análisis. Sus tokens no pueden ir a las
 * mismas columnas: son dos modelos con tarifas distintas, y mezclarlos deja un
 * total que no se puede convertir a plata con ningún precio. Son ~300 tokens
 * contra los 8.000 de una generación, así que excluirlos no mueve la aguja.
 *
 * Sí suma en `calls`, porque la llamada ocurrió y el conteo de llamadas sirve
 * para ver cuántos retries gastó un análisis — que es su propósito.
 */
export function acumularLlamadaSinTokens(acc: AiUsage): void {
  acc.calls += 1;
}

/** Suma un acumulador dentro de otro (para flujos con varias etapas). */
export function fusionarUsage(destino: AiUsage, origen: AiUsage): void {
  destino.inputTokens += origen.inputTokens;
  destino.outputTokens += origen.outputTokens;
  destino.cacheReadTokens += origen.cacheReadTokens;
  destino.cacheCreationTokens += origen.cacheCreationTokens;
  destino.calls += origen.calls;
}

/** Columnas de `analisis` que guardan el consumo. */
export interface UsagePersistido {
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_cache_read_tokens: number | null;
  ai_cache_creation_tokens: number | null;
  ai_calls: number | null;
  ai_model: string | null;
}

/**
 * Campos de UPDATE que SUMAN el consumo nuevo sobre lo que ya tenía la fila.
 *
 * Suma y no reemplazo: regenerar la prosa de un análisis (`/api/analisis/ai`)
 * vuelve a llamar a la misma función sobre la MISMA fila. Con un UPDATE plano,
 * cada regeneración borraría el consumo de la generación anterior y el costo
 * acumulado del análisis quedaría siempre en "la última vez que se generó".
 *
 * La suma se hace en TS, no en SQL. PostgREST no acepta expresiones del estilo
 * `columna = columna + n` en un UPDATE —solo valores literales—, así que las
 * alternativas eran una RPC nueva o sumar acá sobre la fila que la función YA
 * leyó al empezar. Se eligió lo segundo: cero SQL nuevo que mantener, cero
 * queries extra, y sirve aunque nadie corra un `ALTER`/`CREATE FUNCTION`.
 *
 * El riesgo conocido de sumar en TS es la carrera entre dos escrituras
 * simultáneas sobre la misma fila (una podría pisar a la otra). Acá no aplica:
 * una regeneración es una acción manual sobre un análisis concreto, no hay dos
 * corriendo a la vez sobre la misma fila. Si algún día se paraleliza, esto pasa
 * a ser una RPC con `COALESCE(col,0) + n` del lado del servidor.
 */
export function camposUpdateUsage(
  acc: AiUsage,
  filaActual: Partial<UsagePersistido> | null | undefined,
  modelo: string
): UsagePersistido {
  const previo = filaActual ?? {};
  return {
    ai_input_tokens: (previo.ai_input_tokens ?? 0) + acc.inputTokens,
    ai_output_tokens: (previo.ai_output_tokens ?? 0) + acc.outputTokens,
    ai_cache_read_tokens: (previo.ai_cache_read_tokens ?? 0) + acc.cacheReadTokens,
    ai_cache_creation_tokens: (previo.ai_cache_creation_tokens ?? 0) + acc.cacheCreationTokens,
    ai_calls: (previo.ai_calls ?? 0) + acc.calls,
    // El modelo de la ÚLTIMA generación, no el histórico. Si un análisis se
    // regeneró con un modelo distinto al original, los tokens acumulados mezclan
    // dos tarifas — no se puede resolver con una sola columna, y desglosarlo por
    // modelo pedía un jsonb que hoy nadie necesita. Queda anotado.
    ai_model: modelo,
  };
}
