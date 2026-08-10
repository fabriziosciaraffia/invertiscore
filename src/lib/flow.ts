import crypto from "crypto";

const FLOW_ENV = process.env.FLOW_ENV ?? "production"; // 'sandbox' | 'production'
const FLOW_API_URL = FLOW_ENV === "sandbox"
  ? "https://sandbox.flow.cl/api"
  : "https://www.flow.cl/api";
const FLOW_API_KEY = process.env.FLOW_API_KEY!;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY!;

// Timeout duro para toda llamada a Flow. Por debajo del ceiling histórico de
// Vercel (~10s en Hobby) → lanzamos un error capturable antes del corte abrupto
// de la plataforma. Protege endpoints de usuario (cancel, checkout, alta) de un
// cuelgue indefinido de Flow.
const FLOW_TIMEOUT_MS = 8000;

function signParams(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((key) => `${key}${params[key]}`).join("");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

// fetch con timeout vía AbortController. Al vencer ms, aborta y re-lanza como un
// Error con mensaje legible que incluye el service (los catch de los callers ya
// loguean error.message). Otros errores de red se propagan tal cual.
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  service: string,
  ms = FLOW_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw new Error(`Flow API timeout after ${ms}ms: ${service}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reintentos OPT-IN para llamadas donde perder la respuesta cuesta plata (hoy:
 * el getStatus del cobro recurrente). NO es el default: los endpoints de usuario
 * (checkout, alta, cancel) prefieren fallar rápido antes que colgar la pantalla
 * hasta tres timeouts de 8s.
 *
 * Qué se reintenta: timeouts, errores de red y respuestas 5xx — fallas donde el
 * mismo request puede andar en el intento siguiente. Los 4xx NO se reintentan
 * con UNA excepción declarada abajo.
 *
 * HIPÓTESIS, no hecho verificado: el 400 con `{"code":105,"message":"No services
 * available"}` que tumbó el callback del 9-ago-2026 parece transitorio (Flow sin
 * backend disponible en ese instante), no un rechazo del request. Lo incluimos en
 * los reintentables a propósito. Si resulta ser permanente, el costo es 3 intentos
 * inútiles y ~1,2s extra antes del mismo error; el backstop real sigue siendo el
 * cron reconcile-subscriptions.
 */
export type FlowRetryOpts = {
  /** Cantidad total de intentos (1 = sin reintento). Default 1. */
  intentos?: number;
};

const RETRY_BASE_MS = 300;
const FLOW_CODE_RETRIABLE = 105; // ver nota de arriba: transitorio POR HIPÓTESIS

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Backoff exponencial (300ms, 900ms, …) + log del intento fallido. Se loguea
// SIEMPRE: un reintento que salvó el cobro es exactamente lo que queremos ver en
// los logs cuando Flow se pone inestable.
async function pausaEntreIntentos(
  service: string,
  intento: number,
  intentos: number,
  err: unknown
): Promise<void> {
  console.error(
    `[flow] ${service} intento ${intento}/${intentos} falló, reintentando:`,
    err instanceof Error ? err.message : String(err)
  );
  await esperar(RETRY_BASE_MS * Math.pow(3, intento - 1));
}

/**
 * Decide si vale la pena reintentar una respuesta no-ok de Flow. El `code` viaja
 * en el body JSON de Flow, así que hay que mirar el texto ya leído.
 */
function respuestaReintentable(status: number, body: string): boolean {
  if (status >= 500) return true;
  if (status === 400) {
    try {
      return Number((JSON.parse(body) as { code?: unknown })?.code) === FLOW_CODE_RETRIABLE;
    } catch {
      return false;
    }
  }
  return false;
}

export async function flowPost(
  service: string,
  params: Record<string, string | number>,
  opts: FlowRetryOpts = {}
) {
  const allParams = { ...params, apiKey: FLOW_API_KEY };
  const signature = signParams(allParams);

  const formData = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append("s", signature);

  const intentos = Math.max(1, opts.intentos ?? 1);
  let ultimoError: unknown;

  for (let intento = 1; intento <= intentos; intento++) {
    const esUltimo = intento === intentos;
    let response: Response;

    // (1) Transporte. Timeout y errores de red son siempre reintentables.
    try {
      response = await fetchWithTimeout(
        `${FLOW_API_URL}/${service}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        },
        service
      );
    } catch (err) {
      if (esUltimo) throw err;
      ultimoError = err;
      await pausaEntreIntentos(service, intento, intentos, err);
      continue;
    }

    if (response.ok) return response.json();

    // (2) Respuesta no-ok. Solo algunas ameritan otro intento (ver
    // respuestaReintentable); el resto es un rechazo real y se lanza ya.
    const text = await response.text();
    const err = new Error(`Flow API error ${response.status}: ${text}`);
    if (esUltimo || !respuestaReintentable(response.status, text)) throw err;
    ultimoError = err;
    await pausaEntreIntentos(service, intento, intentos, err);
  }

  // Inalcanzable: el último intento siempre retorna o lanza. Queda por
  // exhaustividad del tipo de retorno.
  throw ultimoError ?? new Error(`Flow API: ${service} agotó reintentos`);
}

export async function flowGet(service: string, params: Record<string, string | number>) {
  const allParams = { ...params, apiKey: FLOW_API_KEY };
  const signature = signParams(allParams);

  const queryParams = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  queryParams.append("s", signature);

  const response = await fetchWithTimeout(
    `${FLOW_API_URL}/${service}?${queryParams.toString()}`,
    { method: "GET" },
    service
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
}
