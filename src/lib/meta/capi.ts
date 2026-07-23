/**
 * Helper aislado de la Meta Conversions API (CAPI) — eventos server-side de
 * conversión (Purchase, Subscribe, CompleteRegistration) que Meta deduplica
 * contra el Pixel del browser vía `event_id` compartido.
 *
 * Reglas duras (ver rama meta-pixel-capi):
 *  - Kill-switch: META_TRACKING_ENABLED debe ser exactamente "true" para enviar
 *    (patrón OPENFACTURA_ENABLED). Cualquier otro valor = no-op silencioso.
 *  - Flag on pero falta META_CAPI_TOKEN o NEXT_PUBLIC_META_PIXEL_ID → error
 *    VISIBLE en el log del server (nunca fallo silencioso), y no se envía.
 *  - El email va SIEMPRE hasheado en SHA-256 (lowercase + trim), nunca en claro.
 *  - `sendMetaCapiEvent` NUNCA lanza: envuelve todo en try/catch y devuelve
 *    { ok }. Los callers (webhooks de Flow, auth/callback) lo invocan en su
 *    propio try/catch aislado, así una falla de Meta jamás rompe el flujo del
 *    pago, los créditos o la boleta.
 */
import crypto from "crypto";

const GRAPH_VERSION = "v21.0";
// Timeout duro: Meta no puede colgar el handler del webhook. Por debajo del
// ceiling de Vercel; al vencer, abortamos y el catch del helper lo traga.
const CAPI_TIMEOUT_MS = 5000;

/**
 * ¿Está el envío a CAPI habilitado Y bien configurado? Devuelve el pixelId +
 * token cuando sí; null cuando no (con log visible si el flag está on pero
 * falta config — el caso que queremos que NO pase en silencio).
 */
function capiConfig(): { pixelId: string; token: string } | null {
  if (process.env.META_TRACKING_ENABLED !== "true") return null;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;

  if (!pixelId || !token) {
    console.error(
      "[meta-capi] META_TRACKING_ENABLED='true' pero falta " +
        (!pixelId ? "NEXT_PUBLIC_META_PIXEL_ID" : "") +
        (!pixelId && !token ? " y " : "") +
        (!token ? "META_CAPI_TOKEN" : "") +
        " — evento NO enviado."
    );
    return null;
  }

  return { pixelId, token };
}

/** SHA-256 (hex) de email normalizado (trim + lowercase). Spec de Meta. */
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export type MetaCapiEventInput = {
  /** Nombre estándar de Meta: 'Purchase' | 'Subscribe' | 'CompleteRegistration' | ... */
  eventName: string;
  /** ID de dedup compartido con el Pixel del browser (mismo evento). */
  eventId: string;
  /** Email en claro — se hashea acá; NUNCA se envía ni loguea sin hashear. */
  email?: string | null;
  /** Monto de la conversión (custom_data.value). */
  value?: number | null;
  /** Moneda (default CLP). */
  currency?: string;
  /** URL donde ocurrió la conversión (event_source_url). */
  eventSourceUrl?: string | null;
  /** IP del cliente — solo disponible en requests del navegador (no webhooks). */
  clientIp?: string | null;
  /** User-Agent del cliente — idem. */
  userAgent?: string | null;
  /** Cookie _fbp del navegador (mejora match) — solo en requests del browser. */
  fbp?: string | null;
  /** Cookie _fbc del navegador (mejora match) — solo en requests del browser. */
  fbc?: string | null;
};

export type MetaCapiResult = { ok: boolean; skipped?: boolean; reason?: string };

/**
 * Envía UN evento a la Conversions API. No-op seguro si el tracking está off o
 * mal configurado. NUNCA lanza.
 */
export async function sendMetaCapiEvent(
  input: MetaCapiEventInput
): Promise<MetaCapiResult> {
  const cfg = capiConfig();
  if (!cfg) return { ok: false, skipped: true, reason: "disabled_or_misconfigured" };

  try {
    const userData: Record<string, unknown> = {};
    if (input.email) userData.em = [hashEmail(input.email)];
    if (input.clientIp) userData.client_ip_address = input.clientIp;
    if (input.userAgent) userData.client_user_agent = input.userAgent;
    if (input.fbp) userData.fbp = input.fbp;
    if (input.fbc) userData.fbc = input.fbc;

    const customData: Record<string, unknown> = {};
    if (typeof input.value === "number" && Number.isFinite(input.value)) {
      customData.value = input.value;
      customData.currency = input.currency ?? "CLP";
    }

    const event: Record<string, unknown> = {
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: "website",
      user_data: userData,
    };
    if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;
    if (Object.keys(customData).length > 0) event.custom_data = customData;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pixelId}/events?access_token=${encodeURIComponent(
      cfg.token
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Body de error de Meta (sin secretos) para diagnóstico.
      const bodyText = await res.text().catch(() => "");
      console.error(
        `[meta-capi] ${input.eventName} (${input.eventId}) → HTTP ${res.status}: ${bodyText.slice(0, 500)}`
      );
      return { ok: false, reason: `http_${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error(
      `[meta-capi] ${input.eventName} (${input.eventId}) excepción:`,
      err instanceof Error ? err.message : String(err)
    );
    return { ok: false, reason: "exception" };
  }
}
