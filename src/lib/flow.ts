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

export async function flowPost(service: string, params: Record<string, string | number>) {
  const allParams = { ...params, apiKey: FLOW_API_KEY };
  const signature = signParams(allParams);

  const formData = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append("s", signature);

  const response = await fetchWithTimeout(
    `${FLOW_API_URL}/${service}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    },
    service
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
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
