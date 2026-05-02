import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL = 'Franco <hola@refranco.ai>';

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

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

  try {
    await getResend()?.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenido a Franco — tu primer análisis es gratis',
      html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 16px 0;">${greeting}</h1>
        <p style="color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
          Analiza cualquier depto en Santiago. En 30 segundos sabes si la inversión vale la pena.
        </p>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 20px 24px; margin: 0 0 24px 0;">
          <div style="padding: 8px 0; color: #FAFAF8; font-size: 14px; line-height: 1.6;">
            <div style="margin-bottom: 12px;">
              <span style="color: #C8323C; margin-right: 8px;">&#10022;</span>
              <span style="color: #A1A1AA;">Franco Score de 1 a 100 con veredicto claro</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: #C8323C; margin-right: 8px;">&#10022;</span>
              <span style="color: #A1A1AA;">Comparación con el mercado de tu zona</span>
            </div>
            <div>
              <span style="color: #C8323C; margin-right: 8px;">&#10022;</span>
              <span style="color: #A1A1AA;">Análisis con IA que te dice la verdad</span>
            </div>
          </div>
        </div>

        ${ctaButton('Analizar mi primer departamento →', 'https://refranco.ai/analisis/nuevo-v2')}
      `),
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

export async function sendPaymentConfirmationEmail(to: string, name: string, product: string, amount: number, analysisId?: string) {
  const productName = product === 'pro' ? 'Franco Pro' : product === 'pack3' ? 'Franco Pack 3×' : 'Franco Suscripción';
  const amountFormatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  const ctaUrl = analysisId
    ? `https://refranco.ai/analisis/${analysisId}`
    : 'https://refranco.ai/analisis/nuevo-v2';
  const ctaText = analysisId ? 'Ver mi análisis →' : 'Analizar un depto →';
  const bodyCopy = analysisId
    ? 'Tu análisis Pro está listo.'
    : 'Tus créditos están disponibles. Úsalos cuando quieras analizar un depto.';
  const firstName = name.split(' ')[0] || '';
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

  try {
    await getResend()?.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Pago confirmado — ${productName}`,
      html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 20px 0;">
          Pago confirmado <span style="color: #B4B2A9;">&#10003;</span>
        </h1>

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

        <p style="color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 8px 0;">
          ${greeting} ${bodyCopy}${analysisId ? ' Incluye análisis IA personalizado, proyecciones a 20 años y escenarios de salida.' : ''}
        </p>

        ${ctaButton(ctaText, ctaUrl)}
      `, `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #222;">
  <p style="color: #52525B; font-size: 12px; line-height: 1.6; margin: 0;">
    Pagos procesados de forma segura por Flow.cl
  </p>
  <p style="color: #3F3F46; font-size: 11px; margin-top: 8px;">
    <a href="https://refranco.ai" style="color: #52525B; text-decoration: none;">refranco.ai</a>
  </p>
</div>`),
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

export async function sendAnalysisReadyEmail(to: string, name: string, analysisTitle: string, score: number, veredicto: string, analysisId: string) {
  const firstName = name.split(' ')[0] || '';
  const verdictColor = veredicto === 'COMPRAR' ? '#B4B2A9' : veredicto === 'BUSCAR OTRA' ? '#C8323C' : '#888780';
  const verdictBg = veredicto === 'COMPRAR' ? 'rgba(180,178,169,0.12)' : veredicto === 'BUSCAR OTRA' ? 'rgba(200,50,60,0.12)' : 'rgba(136,135,128,0.12)';
  const verdictBorder = veredicto === 'COMPRAR' ? 'rgba(180,178,169,0.3)' : veredicto === 'BUSCAR OTRA' ? 'rgba(200,50,60,0.3)' : 'rgba(136,135,128,0.3)';

  try {
    await getResend()?.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Tu análisis está listo — ${analysisTitle} (Score: ${score})`,
      html: emailWrapper(`
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #FAFAF8; margin: 0 0 20px 0;">${firstName ? `${firstName}, tu` : 'Tu'} análisis está listo</h1>

        <div style="background: #1A1A1A; border-radius: 12px; padding: 32px 24px; margin: 0 0 24px 0; text-align: center;">
          <div style="color: #71717A; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px; font-family: 'Courier New', monospace;">Franco Score</div>
          <div style="font-size: 52px; font-weight: 700; color: #FAFAF8; font-family: 'Courier New', monospace; line-height: 1;">${score}</div>
          <div style="display: inline-block; padding: 8px 24px; border-radius: 6px; margin-top: 16px; font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 2px; font-size: 13px; color: ${verdictColor}; background: ${verdictBg}; border: 1px solid ${verdictBorder};">
            ${veredicto}
          </div>
          <div style="color: #71717A; font-size: 14px; margin-top: 16px;">${analysisTitle}</div>
        </div>

        <p style="color: #A1A1AA; line-height: 1.7; font-size: 15px; margin: 0 0 8px 0;">
          Score, veredicto y métricas listos. El análisis completo con IA, proyecciones a 20 años y escenarios de salida está disponible en tu cuenta.
        </p>

        ${ctaButton('Ver análisis completo →', `https://refranco.ai/analisis/${analysisId}`)}
      `),
    });
  } catch (error) {
    console.error('Error sending analysis ready email:', error);
  }
}
