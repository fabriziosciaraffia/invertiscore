import { Resend } from 'resend';
import { FLOW_PRODUCTS, type FlowProductKey } from './flow-products';
import { COMPARABLES_TEXTO } from './stats';
import { etiquetaVeredicto } from "./veredicto-etiqueta";
import { capturarServidor } from "./posthog-servidor";
import { eventoCorreoEnviado, identidadCorreo, tagsCorreo, type TipoCorreo } from "./medicion-correo";
import { correoRecordatorioPack } from "./lo-que-sigue/recordatorio";
import { correoAlertaPago, correoAlertaPagoFallido, correoCheckoutAbandonado, correoEliminacionInterna, correoEliminacionUsuario, correoPagoFallido } from "./email/correos";

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

// Shared email components.
// Tagline en mono websafe (Courier New) ya que JetBrains Mono no carga
// confiable en clientes email. Mantiene la regla cromática (muted) y
// tipográfica (uppercase tracking) del landing.
const WORDMARK = `<div style="margin-bottom: 32px;">
  <div style="font-size: 24px; color: #FAFAF8; line-height: 1;">
    <span style="font-family: Georgia, 'Times New Roman', serif; opacity: 0.28; font-style: italic;">re</span><span style="font-family: Georgia, 'Times New Roman', serif; font-weight: 700;">franco</span><span style="color: #C8323C; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600;">.ai</span>
  </div>
  <div style="margin-top: 8px; font-family: 'Courier New', Courier, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; color: #71717A;">
    Real estate en su estado más franco
  </div>
</div>`;

const FOOTER_DISCLAIMER = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="color: #52525B; font-size: 12px; line-height: 1.6; margin: 0;">
    Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
  </p>
  <p style="color: #3F3F46; font-size: 11px; margin-top: 8px;">
    <a href="https://refranco.ai" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`;

function emailWrapper(content: string, customFooter?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #0F0F0F; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: #151515; border-radius: 16px; border: 1px solid #222; padding: 40px 32px;">
      ${WORDMARK}
      ${content}
      ${customFooter ?? FOOTER_DISCLAIMER}
    </div>
  </div>
</body>
</html>`;
}

// widthPx opcional: fija el ancho del botón (botones apilados parejos). Sin él,
// el comportamiento por defecto es el de siempre (ancho según el texto) — no
// rompe a los demás correos que llaman ctaButton sin ancho.
function ctaButton(text: string, url: string, widthPx?: number): string {
  const widthStyle = widthPx
    ? `width: ${widthPx}px; box-sizing: border-box; text-align: center;`
    : '';
  return `<div style="margin: 32px 0; text-align: center;">
  <a href="${url}" style="display: inline-block; background: #C8323C; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; font-family: Arial, sans-serif; ${widthStyle}">
    ${text}
  </a>
</div>`;
}

const WELCOME_HERO_URL = 'https://refranco.ai/email/welcome-hero-compra.png';

// Un paso del bloque "Cómo funciona". Numeral mono en Signal Red + texto.
function welcomeStep(num: string, text: string): string {
  return `<tr>
    <td valign="top" width="40" style="padding: 0 0 14px 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #C8323C;">${num}</td>
    <td valign="top" style="padding: 0 0 14px 0; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #A1A1AA;">${text}</td>
  </tr>`;
}

export async function sendWelcomeEmail(to: string, name: string, opts: CorreoOpts = {}) {
  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

  // Estructura email-safe: tablas + estilos inline, ancho 600, fondo #0F0F0F.
  // El hero va como PNG (renderizado del Hero Verdict Block, fuentes reales);
  // el CTA es HTML real (no imagen) para mantener accesibilidad y trackeo.
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #0F0F0F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #0F0F0F;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">

          <!-- Saludo + intro -->
          <tr>
            <td style="padding: 8px 4px 20px 4px;">
              <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 12px 0;">${greeting}</h1>
              <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0;">
                Así se ve un análisis de Franco. Ingresas un depto y recibes un veredicto claro — ${etiquetaVeredicto("COMPRAR", "banda")}, ${etiquetaVeredicto("AJUSTA SUPUESTOS", "banda")} o ${etiquetaVeredicto("BUSCAR OTRA", "banda")} — con los números que tu cotización no muestra.
              </p>
            </td>
          </tr>

          <!-- Hero PNG (ejemplo de veredicto COMPRAR) -->
          <tr>
            <td style="padding: 0 0 8px 0;">
              <img src="${WELCOME_HERO_URL}" width="600" alt="refranco.ai — ejemplo de veredicto COMPRAR" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-radius: 12px;" />
            </td>
          </tr>

          <!-- CTA (HTML real, no imagen) + microcopy -->
          <tr>
            <td align="center" style="padding: 28px 4px 6px 4px;">
              <a href="https://refranco.ai/analisis/nuevo-v4" style="display: inline-block; background: #C8323C; color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                Analizar mi primer depto &rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 4px 28px 4px;">
              <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1px; color: #71717A; margin: 0; text-transform: uppercase;">
                Gratis. Resultado en 30 segundos.
              </p>
            </td>
          </tr>

          <!-- Cómo funciona -->
          <tr>
            <td style="padding: 4px 4px 8px 4px;">
              <div style="border-top: 1px solid #222; padding-top: 24px;">
                <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 2px; color: #888780; text-transform: uppercase; margin: 0 0 16px 0;">Cómo funciona</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${welcomeStep('01', 'Ingresas los datos del depto: dirección, precio, superficie.')}
                  ${welcomeStep('02', `Franco cruza tu depto con ${COMPARABLES_TEXTO} propiedades reales + datos Airbnb en línea.`)}
                  ${welcomeStep('03', `Recibes un veredicto —${etiquetaVeredicto("COMPRAR").toLowerCase()}, ${etiquetaVeredicto("AJUSTA SUPUESTOS").toLowerCase()} o ${etiquetaVeredicto("BUSCAR OTRA").toLowerCase()}— con su explicación.`)}
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 8px 4px;">
              <div style="border-top: 1px solid #222; padding-top: 20px;">
                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0;">
                  Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
                </p>
                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #52525B; margin: 0;">
                  <a href="https://refranco.ai/cuenta" style="color: #71717A; text-decoration: underline;">Preferencias de correo</a>
                  &nbsp;·&nbsp;
                  <a href="https://refranco.ai/cuenta" style="color: #71717A; text-decoration: underline;">Cancelar suscripción</a>
                  &nbsp;·&nbsp;
                  <a href="https://refranco.ai" style="color: #52525B; text-decoration: none;">refranco.ai</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await enviarCorreo("bienvenida", opts.userId, {
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenido a Franco — tu primer análisis es gratis',
      html,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Lo que incluye CADA análisis (igual para todos los productos). El plan solo
// cambia el volumen; el reporte por análisis es el mismo.
const ANALYSIS_FEATURES = [
  'Análisis personalizado de tu inversión',
  'Proyección de patrimonio a 10 años',
  'Escenarios de salida (venta y refinanciamiento)',
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
    // Compra única → 1 análisis.
    if (fp.kind === 'one_time') {
      return {
        productName: '1 análisis',
        unlocks: analysisId
          ? 'tu análisis está listo, con el reporte completo desbloqueado.'
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

  // Bullets de "Qué incluye" derivados del producto. Última fila sin padding
  // inferior (mismo patrón que el markup original).
  const includeRows = includes.map((item, i) => {
    const pad = i === includes.length - 1 ? '0' : '0 0 10px 0';
    return `<tr>
            <td valign="top" width="20" style="padding: ${pad}; font-family: 'Courier New', monospace; font-size: 13px; color: #C8323C;">&#8226;</td>
            <td valign="top" style="padding: ${pad}; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #A1A1AA;">${item}</td>
          </tr>`;
  }).join('');
  const amountFormatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

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
      ? 'Ver mi comparativa completa →'
      : analysisId
        ? 'Ver mi análisis →'
        : 'Empezar a analizar →';

  // Footer transaccional: disclaimer de pago (Flow) + preferencias de correo.
  // Sin unsubscribe (correo transaccional, no marketing).
  const footer = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0 0 10px 0;">
    Pago procesado de forma segura por Flow.cl. Este es un comprobante de tu compra.
  </p>
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #52525B; margin: 0;">
    <a href="${SITE_URL}/cuenta" style="color: #71717A; text-decoration: underline;">Preferencias de correo</a>
    &nbsp;·&nbsp;
    <a href="${SITE_URL}" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`;

  try {
    await enviarCorreo("pago_confirmado", opts.userId, {
      from: FROM_EMAIL,
      to,
      subject: `Pago confirmado — ${productName}`,
      html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 12px 0;">
          Pago confirmado <span style="color: #B4B2A9;">&#10003;</span>
        </h1>

        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          ${greeting} ${unlocks}
        </p>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 20px 24px; margin: 0 0 24px 0;">
          <div style="color: #71717A; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-family: 'Courier New', monospace;">Detalle de compra</div>

          <div style="padding: 8px 0; border-bottom: 1px solid #2A2A2A;">
            <span style="color: #71717A; font-size: 13px;">Producto</span>
            <span style="color: #FAFAF8; font-weight: 600; font-size: 14px; float: right;">${productName}</span>
          </div>
          <div style="padding: 8px 0; border-bottom: 1px solid #2A2A2A;">
            <span style="color: #71717A; font-size: 13px;">Monto</span>
            <span style="color: #FAFAF8; font-weight: 600; font-size: 14px; float: right;">${amountFormatted}</span>
          </div>
          <div style="padding: 8px 0;">
            <span style="color: #71717A; font-size: 13px;">Fecha</span>
            <span style="color: #FAFAF8; font-size: 14px; float: right;">${dateFormatted}</span>
          </div>
        </div>

        <!-- Qué incluye (bullets según producto real) -->
        <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1.5px; color: #71717A; text-transform: uppercase; margin: 0 0 12px 0;">
          Qué incluye
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 8px 0;">
          ${includeRows}
        </table>

        ${ctaButton(ctaText, ctaUrl)}
      `, footer),
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

// Fila label/valor de la card de documento (label izq + valor der, mono opcional).
function docRow(label: string, value: string, mono = false, last = false): string {
  const border = last ? '' : 'border-bottom: 1px solid #2A2A2A;';
  const monoStyle = mono ? "font-family: 'Courier New', monospace;" : '';
  return `<div style="padding: 8px 0; ${border}">
            <span style="color: #71717A; font-size: 13px;">${label}</span>
            <span style="color: #FAFAF8; font-size: 14px; font-weight: 600; float: right; ${monoStyle}">${value}</span>
          </div>`;
}

// Ancho fijo de los CTAs de la boleta → los dos botones quedan parejos.
const BOLETA_CTA_WIDTH = 280;

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
  /** Concepto del caso: label (fila "Concepto") + frase (párrafo intro). Fallback
   * razonable si no llega (no debería). */
  concepto?: { label: string; frase: string };
}): string {
  const frase = p.concepto?.frase || "tu compra en Franco";
  const conceptoLabel = p.concepto?.label || "Análisis";
  const montoFormatted = new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(p.monto);
  // fechaEmision viene como YYYY-MM-DD → fecha legible es-CL (sin desfase de TZ).
  const [y, m, d] = p.fechaEmision.split('-').map(Number);
  const fechaLegible = !Number.isNaN(y)
    ? new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : p.fechaEmision;

  const url = p.autoservicioUrl || `${SITE_URL}`;

  const footer = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0 0 10px 0;">
    Documento tributario electrónico emitido ante el SII. Adjuntamos el PDF y el XML de tu boleta.
  </p>
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #52525B; margin: 0;">
    <a href="${SITE_URL}" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`;

  // EXCEPCIÓN DE PRODUCTO (aprobada): los dos CTAs van IGUALES en Signal Red, no
  // uno primario + uno secundario. Rompe a propósito la regla "Signal Red = CTA
  // único" del design-system (Capa 1) para REPLICAR la UX de OpenFactura, que
  // presenta "ver boleta" y "convertir a factura" con el mismo peso. Ambos con el
  // mismo ancho fijo (BOLETA_CTA_WIDTH). NO revertir a un botón secundario.
  const botones = `${ctaButton('Ver boleta →', url, BOLETA_CTA_WIDTH)}${ctaButton('Convertir a factura →', url, BOLETA_CTA_WIDTH)}`;

  return emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 12px 0;">
          Tu boleta electrónica
        </h1>

        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 16px 0;">
          Acá está tu boleta por ${frase}. La tienes adjunta en PDF y XML, y también puedes verla en línea.
        </p>

        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #FAFAF8; font-weight: 600; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          ¿Necesitas factura? Puedes ingresar tus datos de facturación y generarla en línea — eso deja sin efecto esta boleta.
        </p>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 20px 24px; margin: 0 0 24px 0;">
          <div style="color: #71717A; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-family: 'Courier New', monospace;">Información del documento</div>
          ${docRow('Documento', `Boleta electrónica N° ${p.folio}`)}
          ${docRow('Concepto', conceptoLabel)}
          ${docRow('Emitida', fechaLegible)}
          ${docRow('Para', p.to)}
          ${docRow('Total', montoFormatted, true, true)}
        </div>

        ${botones}
      `, footer);
}

/**
 * Correo de boleta electrónica (DTE 39) con el PDF y el XML adjuntos. Tono sobrio,
 * transaccional. Dos acciones al autoservicio (ver boleta / convertir a factura),
 * ambas en Signal Red por decisión de producto. Traga el error como el resto de
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
  const firstName = name.split(' ')[0] || '';
  // Variante AMBAS: cuando el análisis pertenece a un par (ambas_group_id), el
  // correo anuncia la COMPARATIVA (no el análisis suelto) y su CTA lleva a la
  // vista comparativa con ambos hijos. El hero se mantiene (veredicto del LTR).
  const isAmbas = !!ambas;
  const greeting = isAmbas
    ? (firstName ? `${firstName}, tu comparativa está lista` : 'Tu comparativa está lista')
    : (firstName ? `${firstName}, tu análisis está listo` : 'Tu análisis está listo');
  const intro = isAmbas
    ? 'Franco ya corrió los dos escenarios sobre tu propiedad — arriendo de largo plazo y Airbnb — y tiene una posición sobre cuál conviene. Tu comparativa está lista.'
    : 'Franco cruzó tu depto con datos reales de mercado. Acá está el veredicto. El análisis completo —proyección de patrimonio y escenarios de salida— te espera en tu cuenta.';
  const ctaText = isAmbas ? 'Ver mi comparativa &rarr;' : 'Ver análisis completo &rarr;';
  const subject = isAmbas ? 'Tu comparativa está lista' : `Tu análisis está listo — ${analysisTitle} (Score: ${score})`;
  const analysisUrl = isAmbas
    ? `${SITE_URL}/analisis/comparativa?ltr=${ambas.ltrId}&str=${ambas.strId}`
    : `${SITE_URL}/analisis/${analysisId}`;
  // Hero dinámico: imagen generada por @vercel/og con el veredicto REAL del
  // análisis (no un caso fijo). Lee de DB por analisisId. Cache-friendly.
  const heroUrl = `${SITE_URL}/api/og/veredicto?analisisId=${encodeURIComponent(analysisId)}`;
  const heroAlt = `${analysisTitle} — Franco Score ${score}, veredicto ${etiquetaVeredicto(veredicto, "banda", veredicto)}`;

  // Estructura email-safe (tablas + inline, 600px, fondo #0F0F0F). El hero
  // va como PNG dinámico (Hero Verdict Block real); el CTA es HTML real.
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #0F0F0F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #0F0F0F;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">

          <!-- Saludo + intro -->
          <tr>
            <td style="padding: 8px 4px 20px 4px;">
              <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 12px 0;">${greeting}</h1>
              <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0;">
                ${intro}
              </p>
            </td>
          </tr>

          <!-- Hero dinámico (veredicto real del análisis) -->
          <tr>
            <td style="padding: 0 0 8px 0;">
              <img src="${heroUrl}" width="600" alt="${heroAlt}" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-radius: 12px;" />
            </td>
          </tr>

          <!-- CTA (HTML real, no imagen) -->
          <tr>
            <td align="center" style="padding: 28px 4px 6px 4px;">
              <a href="${analysisUrl}" style="display: inline-block; background: #C8323C; color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                ${ctaText}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 4px 28px 4px;">
              <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1px; color: #71717A; margin: 0; text-transform: uppercase;">
                Análisis personalizado · Proyección a 10 años · Escenarios de salida
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 4px 8px 4px;">
              <div style="border-top: 1px solid #222; padding-top: 20px;">
                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0;">
                  Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
                </p>
                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #52525B; margin: 0;">
                  <a href="${SITE_URL}/cuenta" style="color: #71717A; text-decoration: underline;">Preferencias de correo</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}/cuenta" style="color: #71717A; text-decoration: underline;">Cancelar suscripción</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}" style="color: #52525B; text-decoration: none;">refranco.ai</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
