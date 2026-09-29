import { Resend } from 'resend';
import { FLOW_PRODUCTS, type FlowProductKey } from './flow-products';
import { capturarServidor } from "./posthog-servidor";
import { eventoCorreoEnviado, identidadCorreo, tagsCorreo, type TipoCorreo } from "./medicion-correo";
import { correoRecordatorioPack } from "./lo-que-sigue/recordatorio";
import { correoAlertaPago, correoAlertaPagoFallido, correoBienvenida, correoBoleta, correoCheckoutAbandonado, correoEliminacionInterna, correoEliminacionUsuario, correoInformeListo, correoPagoConfirmado, correoPagoFallido } from "./email/correos";

/** Quién recibe el correo, para atar el evento a su persona de PostHog. Sin id, se deriva del correo. */
export interface CorreoOpts {
  userId?: string | null;
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL = 'Franco <hola@refranco.ai>';

type MensajeResend = Parameters<Resend["emails"]["send"]>[0];

/**
 * TODO CORREO SALE POR ACÁ (28-sep-2026, auditoría de la medición): manda con Resend, con los
 * tags `tipo` y `pid`, y si salió emite `correo_enviado` a PostHog. Devuelve lo mismo que
 * `resend.emails.send` (`{ data, error }`); sin RESEND_API_KEY devuelve `{ data: null, error: null }`
 * como hacía el `getResend()?.` de antes.
 */
async function enviarCorreo(
  tipo: TipoCorreo,
  userId: string | null | undefined,
  mensaje: MensajeResend,
): Promise<{ data: { id: string } | null; error: { message?: string } | null }> {
  const resend = getResend();
  if (!resend) return { data: null, error: null };
  const to = Array.isArray(mensaje.to) ? mensaje.to[0] : mensaje.to;
  const distinctId = identidadCorreo(String(to ?? ""), userId);
  const res = await resend.emails.send({ ...mensaje, tags: [...(mensaje.tags ?? []), ...tagsCorreo(tipo, distinctId)] } as MensajeResend);
  if (!res.error) {
    void capturarServidor(eventoCorreoEnviado({ tipo, distinctId, resendId: res.data?.id ?? null })).catch(() => {});
  }
  return { data: res.data ?? null, error: res.error ?? null };
}
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://refranco.ai';

export async function sendWelcomeEmail(to: string, name: string, opts: CorreoOpts = {}) {
  const { subject, html } = correoBienvenida({ nombre: name, sitio: SITE_URL });
  try {
    await enviarCorreo("bienvenida", opts.userId, { from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Lo que incluye CADA análisis (igual para todos los productos). El plan solo
// cambia el volumen; el reporte por análisis es el mismo.
const ANALYSIS_FEATURES = [
  'El veredicto con su explicación',
  'Cuánto renta y cuánto pones cada mes',
  'Tu resultado a 10 años, en pesos de hoy',
];

// Copy por plan comprado. `product` es la key real de FLOW_PRODUCTS
// (single | plan10_mensual/annual | plan50_mensual/annual |
// unlimited_mensual/annual). Deriva nombre, capacidad (créditos/ciclo) y ciclo
// (mensual/anual) del catálogo, sin hardcodear. Tolera keys legacy
// (pro/pack3/subscription) de registros viejos y cualquier key desconocida con
// un fallback razonable que no rompe.
function paymentPlanCopy(product: string, analysisId?: string): {
  productName: string;
  unlocks: string;       // qué tiene disponible ahora (frase corta, va en el intro)
  includes: string[];    // bullets de "Qué incluye", reflejan el producto real
} {
  // Fase D — desbloqueo del informe íntegro comparativo (product 'unlock').
  // Antes del fp genérico: aunque 'unlock' vive en FLOW_PRODUCTS como one_time,
  // no es "1 análisis" sino la apertura del íntegro de un par ya analizado.
  if (product === "unlock") {
    return {
      productName: "Informe completo",
      unlocks: "desbloqueaste el informe íntegro de tu comparativa: ambas modalidades con el análisis completo.",
      includes: ANALYSIS_FEATURES,
    };
  }

  const fp = FLOW_PRODUCTS[product as FlowProductKey];

  if (fp) {
    // Compra única → los análisis que trae el producto (1 el single, 3 el pack).
    if (fp.kind === 'one_time') {
      const n = fp.capacity ?? 1;
      return {
        productName: n === 1 ? '1 análisis' : `${n} análisis`,
        unlocks: n > 1
          ? `tienes ${n} análisis disponibles, sin caducidad, para usar cuando quieras.`
          : analysisId
            ? 'tu análisis está listo, con el informe completo desbloqueado.'
            : 'tienes 1 análisis disponible para usar cuando quieras.',
        includes: ANALYSIS_FEATURES,
      };
    }

    // Recurrente → plan10 / plan50 / ilimitado, mensual o anual.
    const ciclo = fp.billing === 'annual' ? 'anual' : 'mensual';

    if (fp.isUnlimited) {
      return {
        productName: `Ilimitado ${ciclo}`,
        unlocks: `tu plan Ilimitado quedó activo: análisis sin límite mientras esté vigente (facturación ${ciclo}).`,
        includes: ['Análisis sin límite cada mes', ...ANALYSIS_FEATURES],
      };
    }

    const cap = fp.capacity ?? 0;
    const planNum = fp.plan === 'plan50' ? '50' : '10';
    return {
      productName: `Plan ${planNum} ${ciclo}`,
      unlocks: `tu Plan ${planNum} quedó activo: ${cap} análisis al mes (facturación ${ciclo}).`,
      includes: [`${cap} análisis cada mes`, ...ANALYSIS_FEATURES],
    };
  }

  // ── Legacy / desconocido (registros viejos) ──
  if (product === 'pack3') {
    return {
      productName: 'Pack 3×',
      unlocks: 'tienes 3 análisis disponibles para usar cuando quieras.',
      includes: ANALYSIS_FEATURES,
    };
  }
  if (product === 'subscription') {
    return {
      productName: 'Suscripción',
      unlocks: 'tu suscripción quedó activa: análisis ilimitados mientras esté vigente.',
      includes: ANALYSIS_FEATURES,
    };
  }
  // "pro" u otra key desconocida → 1 análisis (comportamiento histórico).
  return {
    productName: '1 análisis',
    unlocks: analysisId
      ? 'tu análisis está listo, con el reporte completo desbloqueado.'
      : 'tienes 1 análisis disponible para usar cuando quieras.',
    includes: ANALYSIS_FEATURES,
  };
}

export async function sendPaymentConfirmationEmail(to: string, name: string, product: string, amount: number, analysisId?: string, ambasIds?: { ltrId: string; strId: string }, opts: CorreoOpts = {}) {
  const { productName, unlocks, includes } = paymentPlanCopy(product, analysisId);

  const dateFormatted = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });

  // CTA: unlock de AMBAS → a la comparativa (los DOS informes, que es lo que se
  // desbloqueó); si el pago desbloqueó un análisis puntual (+ analysisId), a ese
  // análisis; si compró créditos/suscripción, al form.
  const ctaUrl =
    product === "unlock" && ambasIds
      ? `${SITE_URL}/analisis/comparativa?ltr=${ambasIds.ltrId}&str=${ambasIds.strId}`
      : analysisId
        ? `${SITE_URL}/analisis/${analysisId}`
        : `${SITE_URL}/analisis/nuevo-v4`;
  const ctaText =
    product === "unlock" && ambasIds
      ? 'Ver mi comparativa completa'
      : analysisId
        ? 'Ver mi análisis'
        : 'Analizar un depto';

  const { subject, html } = correoPagoConfirmado({
    nombre: name,
    producto: productName,
    desbloquea: unlocks,
    incluye: includes,
    monto: amount,
    fecha: dateFormatted,
    boton: { texto: ctaText, url: ctaUrl },
  });
  try {
    await enviarCorreo("pago_confirmado", opts.userId, { from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

/**
 * Construye el HTML del correo de boleta (sin adjuntos). Exportado para poder
 * medir su tamaño en pruebas sin enviar (Gmail recorta el cuerpo sobre ~102KB).
 */
export function buildBoletaHtml(p: {
  to: string;
  folio: number | string;
  monto: number;
  fechaEmision: string; // YYYY-MM-DD
  autoservicioUrl: string;
  /** Concepto del caso: label (fila "Concepto") + frase (párrafo intro). */
  concepto?: { label: string; frase: string };
}): string {
  return correoBoleta({ para: p.to, folio: p.folio, monto: p.monto, fechaEmision: p.fechaEmision, autoservicioUrl: p.autoservicioUrl, concepto: p.concepto, sitio: SITE_URL }).html;
}

/**
 * Correo de boleta electrónica (DTE 39) con el PDF y el XML adjuntos. Tono sobrio,
 * transaccional. Un botón al autoservicio («Ver boleta»); la factura, como enlace en el texto. Traga el error como el resto de
 * envíos (un fallo de correo no debe romper nada).
 */
export async function sendBoletaEmail(params: {
  to: string;
  folio: number | string;
  monto: number;
  fechaEmision: string; // YYYY-MM-DD
  autoservicioUrl: string;
  concepto?: { label: string; frase: string };
  pdfBase64?: string | null;
  xmlBase64?: string | null;
  userId?: string | null;
}): Promise<void> {
  const { to, folio, monto, fechaEmision, autoservicioUrl, concepto, pdfBase64, xmlBase64, userId } = params;

  // Adjuntos: el PDF/XML vienen en base64 desde OpenFactura → Buffer para Resend.
  const attachments: Array<{ filename: string; content: Buffer }> = [];
  if (pdfBase64) attachments.push({ filename: `boleta-39-folio-${folio}.pdf`, content: Buffer.from(pdfBase64, 'base64') });
  if (xmlBase64) attachments.push({ filename: `boleta-39-folio-${folio}.xml`, content: Buffer.from(xmlBase64, 'base64') });

  const html = buildBoletaHtml({ to, folio, monto, fechaEmision, autoservicioUrl, concepto });

  const resend = getResend();
  if (!resend) {
    console.error('Boleta email skipped: RESEND_API_KEY not set');
    return;
  }
  try {
    // Resend devuelve { data, error } — un error de API NO se lanza, viene in-band.
    const { data: sent, error: sendError } = await enviarCorreo("boleta", userId, {
      from: FROM_EMAIL,
      to,
      subject: `Tu boleta electrónica N° ${folio} — refranco.ai`,
      attachments: attachments.length ? attachments : undefined,
      html,
    });
    if (sendError) {
      console.error('Error sending boleta email (Resend):', sendError);
    } else {
      console.log('Boleta email enviado · Resend id:', sent?.id);
    }
  } catch (error) {
    console.error('Error sending boleta email:', error);
  }
}

/**
 * Aviso de cargo recurrente fallido (política past_due). Tono Franco: honesto y
 * directo, sin alarmismo ni features inventadas. Mantiene acceso hasta la fecha
 * de gracia y lo invita a reactivar antes de esa fecha.
 */
export async function sendPaymentFailedEmail(
  to: string,
  name: string | null,
  graceEndsAt: Date | string,
  opts: CorreoOpts = {},
) {
  const { subject, html } = correoPagoFallido({ nombre: name, graciaHasta: graceEndsAt, sitio: SITE_URL });
  try {
    await enviarCorreo("pago_fallido", opts.userId, { from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error('Error sending payment failed email:', error);
  }
}

/**
 * Recuperación de carrito abandonado (ruta A · compra única). Tono Franco:
 * honesto y sin presión — nota que empezó la compra y no la terminó, le recuerda
 * que el análisis lo espera y lo invita a retomar. SIN descuentos ni urgencia
 * falsa. productLabel = subject legible del catálogo (ej. "Franco — 1 análisis").
 *
 * Devuelve true SOLO si el envío a Resend tuvo éxito; false si Resend no está
 * configurado o si la llamada falló. El cron usa esto para marcar
 * recovery_email_sent_at solo en éxito (y reintentar en la próxima corrida si no).
 */
export async function sendCheckoutRecoveryEmail(
  to: string,
  name: string | null,
  productLabel: string,
  // Tipo de checkout abandonado. 'single' = análisis suelto (ruta A, default por
  // compat). 'plan' = suscripción (ruta B) → copy de plan. El cron lo deriva del
  // kind del catálogo.
  kind: 'single' | 'plan' = 'single',
  opts: CorreoOpts = {},
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.error('Checkout recovery email skipped: RESEND_API_KEY not set');
    return false;
  }

  const { subject, html } = correoCheckoutAbandonado({ nombre: name, producto: productLabel, tipo: kind, sitio: SITE_URL });
  try {
    const res = await enviarCorreo("checkout_abandonado", opts.userId, { from: FROM_EMAIL, to, subject, html });
    return !res.error;
  } catch (error) {
    console.error('Error sending checkout recovery email:', error);
    return false;
  }
}

/**
 * Variante que PROPAGA el error, para callers que necesitan saber si el correo
 * salió de verdad (el reenvío manual desde /admin: su fila de auditoría diría
 * result='ok' sobre un envío fallido). Devuelve el id de Resend.
 *
 * Tres fallos que la variante que traga el error hacía invisibles:
 *   1. RESEND_API_KEY sin setear → getResend() null → el envío era un no-op mudo.
 *   2. Resend devuelve { data, error } IN-BAND: un rechazo de la API (dominio,
 *      destinatario inválido) no lanza y quedaba ignorado. Mismo criterio que
 *      sendBoletaEmail, que ya documenta esta trampa.
 *   3. Excepción de red: se logueaba y se seguía.
 *
 * sendAnalysisReadyEmail() envuelve a esta y mantiene el comportamiento
 * histórico (traga y loguea) para el caller de /api/analisis.
 */
export async function sendAnalysisReadyEmailOrThrow(to: string, name: string, analysisTitle: string, score: number, veredicto: string, analysisId: string, ambas?: { ltrId: string; strId: string }, opts: CorreoOpts = {}): Promise<string | null> {
  const { subject, html } = correoInformeListo({ nombre: name, titulo: analysisTitle, score, veredicto, analysisId, ambas, sitio: SITE_URL });

  const resend = getResend();
  if (!resend) {
    throw new Error('RESEND_API_KEY no está configurada: no se puede enviar el correo');
  }

  // Resend devuelve { data, error } — un error de API NO se lanza, viene in-band.
  const { data: sent, error: sendError } = await enviarCorreo("informe_listo", opts.userId, {
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (sendError) {
    throw new Error(`Resend rechazó el envío: ${sendError.message || JSON.stringify(sendError)}`);
  }
  return sent?.id ?? null;
}

/**
 * Envío del "tu análisis está listo". Traga el error y solo loguea — el caller
 * histórico (/api/analisis, dentro de waitUntil) no debe fallar la creación del
 * análisis porque el correo no salió; la vista ya está creada y el usuario la ve
 * igual. Para el reenvío manual usar sendAnalysisReadyEmailOrThrow.
 */
export async function sendAnalysisReadyEmail(to: string, name: string, analysisTitle: string, score: number, veredicto: string, analysisId: string, ambas?: { ltrId: string; strId: string }, opts: CorreoOpts = {}) {
  try {
    await sendAnalysisReadyEmailOrThrow(to, name, analysisTitle, score, veredicto, analysisId, ambas, opts);
  } catch (error) {
    console.error('Error sending analysis ready email:', error);
  }
}

// ── Eliminación de cuenta ──────────────────────────────────────────────────
// Dos correos disparados desde api/account/request-deletion: (1) interno a
// hola@ con los datos para procesar la baja, (2) confirmación al usuario.
// Ambos reusan emailWrapper (wordmark + tagline + card) — sin markup propio.
// A diferencia de los demás envíos de este módulo, NO tragan el error: lo
// propagan para que el route devuelva 500 si falla (la solicitud de baja es
// crítica y no debe perderse en silencio).

export async function sendAccountDeletionInternalEmail(params: {
  email: string;
  userId: string;
  requestedAt: string;
  analysisCount: number;
  credits: number;
  reason?: string;
}): Promise<void> {
  const { email, userId, requestedAt, analysisCount, credits, reason } = params;
  const { subject, html } = correoEliminacionInterna({ email, userId, solicitadaEl: requestedAt, analisis: analysisCount, creditos: credits, motivo: reason });
  await enviarCorreo("eliminacion_interna", userId, { from: FROM_EMAIL, to: 'hola@refranco.ai', subject, html });
}

export async function sendAccountDeletionUserEmail(to: string, name: string, opts: CorreoOpts = {}): Promise<void> {
  const { subject, html } = correoEliminacionUsuario({ nombre: name });
  await enviarCorreo("eliminacion_usuario", opts.userId, { from: FROM_EMAIL, to, subject, html });
}

/**
 * Avisos internos de pago a hola@ (29-sep-2026): antes salían directo con `new Resend` desde
 * payments/confirm, sin tags ni evento; ahora pasan por enviarCorreo como todos.
 */
export async function sendAlertaPagoInterna(p: Parameters<typeof correoAlertaPago>[0], userId: string | null): Promise<void> {
  const { subject, html } = correoAlertaPago({ ...p, sitio: SITE_URL });
  await enviarCorreo("alerta_pago", userId, { from: FROM_EMAIL, to: 'hola@refranco.ai', subject, html });
}

export async function sendAlertaPagoFallidoInterna(p: Parameters<typeof correoAlertaPagoFallido>[0], userId: string | null): Promise<void> {
  const { subject, html } = correoAlertaPagoFallido(p);
  await enviarCorreo("alerta_pago_fallido", userId, { from: FROM_EMAIL, to: 'hola@refranco.ai', subject, html });
}

/**
 * «Lo que sigue» · el recordatorio del pack (30-sep-2026): «Te quedan 3 análisis, con tus números ya
 * cargados.», en la plantilla clara. Devuelve si salió de verdad (el cron ya reclamó la fila antes).
 */
export async function sendRecordatorioPackEmail(to: string, analysisId: string | null, opts: CorreoOpts = {}): Promise<boolean> {
  const { subject, html } = correoRecordatorioPack(SITE_URL, analysisId);
  try {
    const res = await enviarCorreo("recordatorio_pack", opts.userId, { from: FROM_EMAIL, to, subject, html });
    return !res.error && !!res.data;
  } catch (error) {
    console.error("Error sending pack reminder email:", error);
    return false;
  }
}
