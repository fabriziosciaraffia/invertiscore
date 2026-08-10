// Template del correo de remediación — bug pie 0% silencioso (ago-2026).
//
// Base OSCURA a propósito: es la base de TODA la suite de correos vigente
// (emailWrapper de src/lib/email.ts) y la que el wordmark PNG alojado soporta
// (texto blanco). La migración de emails a base light es un backlog aparte con
// su propio gate y QA de render real — este correo no la adelanta.
//
// Restricciones de cliente de correo (mandan sobre la elegancia):
//   · layout con TABLAS, cero flexbox/grid;
//   · CSS 100% inline;
//   · fuentes con fallback websafe (Georgia por Source Serif 4, Helvetica/Arial
//     por IBM Plex Sans, Courier New por JetBrains Mono);
//   · wordmark como PNG alojado (los SVG no renderizan en muchos clientes);
//   · botón como tabla con bgcolor (no <button>, no padding que Outlook ignore);
//   · ancho máximo 600px, fluido en móvil.

export type TipoAnalisis = "LTR" | "STR" | "AMBAS";

export interface DatosRemediacion {
  email: string;
  /** Nombre de pila para el saludo (ya resuelto, ej. "Jose Ignacio"). */
  saludo: string;
  /** Dirección corta de display (sin código postal ni región). */
  direccion: string;
  comuna: string;
  tipo: TipoAnalisis;
}

const SITE = "https://refranco.ai";
const WORDMARK_URL = `${SITE}/email/wordmark-refranco.png`;
const CTA_URL = `${SITE}/analisis/nuevo-v4`;

const SERIF = `Georgia, 'Times New Roman', serif`;
const SANS = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
const MONO = `'Courier New', Courier, monospace`;

/** "Tu análisis [comparativo|de renta corta] de <dirección>" según el tipo. */
function fraseAnalisis(tipo: TipoAnalisis, direccion: string): string {
  if (tipo === "AMBAS") return `Tu análisis comparativo de ${direccion}`;
  if (tipo === "STR") return `Tu análisis de renta corta de ${direccion}`;
  return `Tu análisis de ${direccion}`;
}

export function buildEmailRemediacion(d: DatosRemediacion): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Un error en tu análisis de ${d.comuna} — y cómo lo arreglamos`;
  const frase = fraseAnalisis(d.tipo, d.direccion);

  const text = [
    `Hola ${d.saludo},`,
    ``,
    `Encontramos un error en el formulario que hacía que el pie no quedara`,
    `registrado. ${frase} salió calculado como si financiaras`,
    `el 100% con crédito, lo que distorsiona el dividendo y el flujo mensual.`,
    ``,
    `Ya está corregido. Y como el error fue nuestro, te dejamos un análisis`,
    `gratis en tu cuenta. Rehaz este mismo o analiza otro depto, como`,
    `prefieras. Está disponible ahora y no vence.`,
    ``,
    `Usar mi análisis: ${CTA_URL}`,
    ``,
    `Saludos.`,
    `Equipo Franco · refranco.ai`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0F0F0F;" bgcolor="#0F0F0F">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0F0F0F" style="background-color:#0F0F0F;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">
          <tr>
            <td bgcolor="#151515" style="background-color:#151515; border:1px solid #222222; border-radius:16px; padding:40px 32px;">

              <!-- wordmark (PNG alojado, texto blanco sobre base oscura) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="${WORDMARK_URL}" width="180" alt="refranco.ai" style="display:block; width:180px; height:auto; border:0;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px; font-family:${MONO}; font-size:9px; text-transform:uppercase; letter-spacing:0.2em; color:#71717A;">
                    Real estate en su estado más franco
                  </td>
                </tr>
              </table>

              <!-- saludo (serif editorial) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:36px; font-family:${SERIF}; font-size:22px; font-weight:bold; color:#FAFAF8; line-height:1.3;">
                    Hola ${d.saludo},
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px; font-family:${SANS}; font-size:15px; color:#D4D4D8; line-height:1.65;">
                    Encontramos un error en el formulario que hacía que el pie no quedara registrado. ${frase} salió calculado como si financiaras el 100% con crédito, lo que distorsiona el dividendo y el flujo mensual.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px; font-family:${SANS}; font-size:15px; color:#D4D4D8; line-height:1.65;">
                    Ya está corregido. Y como el error fue nuestro, te dejamos un análisis gratis en tu cuenta. Rehaz este mismo o analiza otro depto, como prefieras. Está disponible ahora y no vence.
                  </td>
                </tr>
              </table>

              <!-- CTA: tabla con fondo (sobrevive a Outlook) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:32px 0 8px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#C8323C" style="background-color:#C8323C; border-radius:8px;">
                          <a href="${CTA_URL}" style="display:inline-block; padding:14px 32px; font-family:${SANS}; font-size:15px; font-weight:bold; color:#FFFFFF; text-decoration:none;">
                            Usar mi análisis →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- cierre -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:20px; font-family:${SANS}; font-size:15px; color:#D4D4D8; line-height:1.65;">
                    Saludos.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px; font-family:${SANS}; font-size:14px; color:#A1A1AA;">
                    Equipo Franco · <a href="${SITE}" style="color:#A1A1AA; text-decoration:none;">refranco.ai</a>
                  </td>
                </tr>
              </table>

              <!-- footer legal (chrome estándar de la suite) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:36px; border-top:1px solid #222222; font-family:${SANS}; font-size:12px; color:#52525B; line-height:1.6;">
                    <span style="display:block; padding-top:16px;">Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.</span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/** Los 6 destinatarios, con los datos aprobados en el STOP GATE 1 (F0). */
export const DESTINATARIOS: DatosRemediacion[] = [
  { email: "joseignaciodavanzo@gmail.com", saludo: "Jose Ignacio", direccion: "Sebastián Elcano, Las Condes", comuna: "Las Condes", tipo: "AMBAS" },
  { email: "m.sepulvedaporzio@gmail.com", saludo: "Martin", direccion: "El Dante 4200, Las Condes", comuna: "Las Condes", tipo: "STR" },
  { email: "gerardozamoral@gmail.com", saludo: "Gerardo", direccion: "Morandé 776, Santiago", comuna: "Santiago", tipo: "STR" },
  { email: "adriancarreno.d@gmail.com", saludo: "Adrián", direccion: "El Estero 303, La Florida", comuna: "La Florida", tipo: "AMBAS" },
  { email: "rb@ifomenta.cl", saludo: "Rafael", direccion: "Francisco Noguera 88, Providencia", comuna: "Providencia", tipo: "AMBAS" },
  { email: "erojeda@gmail.com", saludo: "Erick", direccion: "Av. José Pedro Alessandri 1498, Ñuñoa", comuna: "Ñuñoa", tipo: "LTR" },
];
