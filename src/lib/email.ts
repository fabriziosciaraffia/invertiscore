import { Resend } from 'resend';
import { FLOW_PRODUCTS, type FlowProductKey } from './flow-products';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL = 'Franco <hola@refranco.ai>';
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

function ctaButton(text: string, url: string): string {
  return `<div style="margin: 32px 0; text-align: center;">
  <a href="${url}" style="display: inline-block; background: #C8323C; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; font-family: Arial, sans-serif;">
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

export async function sendWelcomeEmail(to: string, name: string) {
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
                Así se ve un análisis de Franco. Ingresas un depto y recibes un veredicto claro — COMPRAR, AJUSTA SUPUESTOS o BUSCAR OTRA — con los números que tu cotización no muestra.
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
              <a href="https://refranco.ai/analisis/nuevo-v2" style="display: inline-block; background: #C8323C; color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">
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
                  ${welcomeStep('02', 'Franco cruza tu depto con +20.000 propiedades reales + datos Airbnb en línea.')}
                  ${welcomeStep('03', 'Recibes un veredicto —comprar, ajustar el precio o buscar otra— con su explicación.')}
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
    await getResend()?.emails.send({
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
  'Análisis IA personalizado de tu inversión',
  'Proyección de patrimonio a 20 años',
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

export async function sendPaymentConfirmationEmail(to: string, name: string, product: string, amount: number, analysisId?: string) {
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

  // CTA: si el pago desbloqueó un análisis puntual (pro + analysisId), lo
  // llevamos directo a ese análisis; si compró créditos/suscripción, al form.
  const ctaUrl = analysisId
    ? `${SITE_URL}/analisis/${analysisId}`
    : `${SITE_URL}/analisis/nuevo-v2`;
  const ctaText = analysisId ? 'Ver mi análisis →' : 'Empezar a analizar →';

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
    await getResend()?.emails.send({
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

/**
 * Aviso de cargo recurrente fallido (política past_due). Tono Franco: honesto y
 * directo, sin alarmismo ni features inventadas. Mantiene acceso hasta la fecha
 * de gracia y lo invita a reactivar antes de esa fecha.
 */
export async function sendPaymentFailedEmail(
  to: string,
  name: string | null,
  graceEndsAt: Date | string,
) {
  const firstName = (name ?? '').split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';
  const graceDate = new Date(graceEndsAt).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const ctaUrl = `${SITE_URL}/pricing`;

  try {
    await getResend()?.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Tu pago no se procesó — tienes unos días para actualizarlo',
      html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 20px 0;">
          Tu pago no se procesó
        </h1>

        <p style="color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 16px 0;">
          ${greeting} no pudimos procesar el cobro de tu suscripción. Puede ser
          algo simple: una tarjeta vencida, sin cupo o un rechazo del banco.
        </p>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 16px 24px; margin: 0 0 24px 0; border-left: 3px solid #C8323C;">
          <p style="color: #FAFAF8; line-height: 1.6; font-size: 15px; margin: 0;">
            Mantienes tu acceso hasta el <span style="font-weight: 600;">${graceDate}</span>.
            Reactiva tu suscripción antes de esa fecha para no perderlo.
          </p>
        </div>

        <p style="color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 8px 0;">
          Si no haces nada, tu cuenta vuelve al plan gratis y conservas los
          créditos que te queden.
        </p>

        ${ctaButton('Reactivar mi suscripción →', ctaUrl)}
      `),
    });
  } catch (error) {
    console.error('Error sending payment failed email:', error);
  }
}

export async function sendAnalysisReadyEmail(to: string, name: string, analysisTitle: string, score: number, veredicto: string, analysisId: string) {
  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `${firstName}, tu análisis está listo` : 'Tu análisis está listo';
  const analysisUrl = `${SITE_URL}/analisis/${analysisId}`;
  // Hero dinámico: imagen generada por @vercel/og con el veredicto REAL del
  // análisis (no un caso fijo). Lee de DB por analisisId. Cache-friendly.
  const heroUrl = `${SITE_URL}/api/og/veredicto?analisisId=${encodeURIComponent(analysisId)}`;
  const heroAlt = `${analysisTitle} — Franco Score ${score}, veredicto ${veredicto}`;

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
                Franco cruzó tu depto con datos reales de mercado. Acá está el veredicto. El análisis completo —con IA, proyección de patrimonio y escenarios de salida— te espera en tu cuenta.
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
                Ver análisis completo &rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 4px 28px 4px;">
              <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1px; color: #71717A; margin: 0; text-transform: uppercase;">
                Análisis IA · Proyección 20 años · Escenarios de salida
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

  try {
    await getResend()?.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Tu análisis está listo — ${analysisTitle} (Score: ${score})`,
      html,
    });
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

// Fila de la card de datos (label izq + valor der). `mono` para ids/números.
function deletionRow(label: string, value: string, mono = false, last = false): string {
  const border = last ? '' : 'border-bottom: 1px solid #2A2A2A;';
  const monoStyle = mono ? "font-family: 'Courier New', monospace;" : '';
  return `<div style="padding: 8px 0; ${border}">
            <span style="color: #71717A; font-size: 13px;">${label}</span>
            <span style="color: #FAFAF8; font-size: 14px; float: right; ${monoStyle}">${value}</span>
          </div>`;
}

export async function sendAccountDeletionInternalEmail(params: {
  email: string;
  userId: string;
  requestedAt: string;
  analysisCount: number;
  credits: number;
  reason?: string;
}): Promise<void> {
  const { email, userId, requestedAt, analysisCount, credits, reason } = params;

  const internalFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0;">
    Correo interno de Franco. Procesar la baja y la eliminación de datos según la política de retención.
  </p>
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #3F3F46; margin-top: 8px;">
    <a href="${SITE_URL}" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`;

  await getResend()?.emails.send({
    from: FROM_EMAIL,
    to: 'hola@refranco.ai',
    subject: 'Solicitud de eliminación de cuenta',
    html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #C8323C; margin: 0 0 16px 0;">
          Solicitud de eliminación de cuenta
        </h1>
        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          Un usuario solicitó eliminar su cuenta. Procesa la baja y la eliminación de sus datos.
        </p>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 20px 24px; margin: 0;">
          <div style="color: #71717A; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-family: 'Courier New', monospace;">Datos del usuario</div>
          ${deletionRow('Email', email)}
          ${deletionRow('User ID', userId, true)}
          ${deletionRow('Fecha solicitud', requestedAt)}
          ${deletionRow('Motivo', reason && reason.trim() ? reason.trim() : 'No especificado')}
          ${deletionRow('Análisis creados', String(analysisCount), true)}
          ${deletionRow('Créditos restantes', String(credits), true, true)}
        </div>
      `, internalFooter),
  });
}

export async function sendAccountDeletionUserEmail(to: string, name: string): Promise<void> {
  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

  const userFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #52525B; font-size: 12px; line-height: 1.6; margin: 0;">
    Este es un correo sobre la seguridad de tu cuenta en Franco.
  </p>
  <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #3F3F46; margin-top: 8px;">
    <a href="${SITE_URL}" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`;

  await getResend()?.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Recibimos tu solicitud de eliminación de cuenta',
    html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 16px 0;">
          ${greeting}
        </h1>
        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          Recibimos tu solicitud para eliminar tu cuenta de Franco. Queremos que sepas exactamente qué va a pasar.
        </p>

        <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1.5px; color: #71717A; text-transform: uppercase; margin: 0 0 10px 0;">
          Qué pasa ahora
        </p>
        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          Vamos a eliminar de forma permanente tu cuenta y todos tus datos asociados: análisis, créditos e información de perfil. Te confirmaremos a este mismo correo cuando el proceso esté completo.
        </p>

        <p style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 1.5px; color: #71717A; text-transform: uppercase; margin: 0 0 10px 0;">
          ¿Fue un error?
        </p>
        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0;">
          Si no hiciste esta solicitud o cambiaste de opinión, escríbenos a <a href="mailto:hola@refranco.ai" style="color: #C8323C; text-decoration: none;">hola@refranco.ai</a> lo antes posible. Una vez eliminada, la información no se puede recuperar.
        </p>
      `, userFooter),
  });
}
