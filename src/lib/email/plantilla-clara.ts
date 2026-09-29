// ─────────────────────────────────────────────────────────────────────────────
// LA PLANTILLA CLARA DE LOS CORREOS (29-sep-2026): papel, tinta, Inter con su fallback, el wordmark
// fiel, el botón en tinta y el pie con el legal. Nació para el correo del código de «Lo que sigue» y
// desde el 29-sep-2026 es la ÚNICA plantilla de los correos de Franco (app y Supabase Auth; el tier
// CORREOS lo vigila). Solo tablas y estilos inline: Gmail ignora <style> y <link> y el Mail de
// iPhone respeta el ancho de 600 con `max-width`. Sin oscuro, sin mono. El wordmark va como PNG a
// doble resolución: las fuentes web no cargan en correo y escrito con texto se deforma.
// ─────────────────────────────────────────────────────────────────────────────

export const PAPEL = "#FAFAF8";
export const TINTA = "#0F0F0F";
export const TINTA_2 = "#3B3A36";
export const TINTA_3 = "#6B6B72";
export const LINEA = "#DDDDE1";
export const ROJO = "#C8323C";
export const FUENTE_UI = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
/** El wordmark va como PNG a doble resolución (public/email/wordmark-claro@2x.png, generado por
 *  scripts/emails/generar-wordmark.ts): en correo las fuentes web no cargan. Ancho fijo en px CSS. */
export const ANCHO_WORDMARK = 132;
export const ALTO_WORDMARK = 43;
export const URL_WORDMARK = "https://refranco.ai/email/wordmark-claro-2x.png";
export const FUENTE_TITULO = "'Source Serif 4', Georgia, 'Times New Roman', serif";

export interface BotonCorreo {
  texto: string;
  url: string;
}

export interface CorreoClaro {
  /** El <title> del HTML (los clientes lo ignoran; sirve al render). */
  titulo: string;
  /** El titular, en serif. */
  titular: string;
  /** Párrafos del cuerpo, en orden. HTML permitido (ya escapado por quien llama). */
  parrafos: string[];
  /** Un código grande y limpio (el de entrada). Va entre el primer párrafo y el resto. */
  codigo?: string;
  /** El botón, en tinta. */
  boton?: BotonCorreo;
  /** Párrafos después del botón (la alternativa, el aviso de seguridad). */
  despues?: string[];
  /** Una línea destacada (lo que la persona tiene que saber), con filete de tinta a la izquierda. */
  nota?: string;
  /** Un detalle en filas etiqueta/valor (el comprobante, la boleta, los datos de una solicitud). */
  detalle?: { titulo?: string; filas: Array<{ etiqueta: string; valor: string }> };
  /** Texto de vista previa en la bandeja (oculto en el cuerpo). */
  preencabezado?: string;
  /** Línea legal del pie. Por defecto, la de Franco. */
  legal?: string;
}

const LEGAL = "Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.";

export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** El wordmark fiel, como imagen: el PNG del wordmark del sitio a doble resolución, ancho fijo y
 *  alt «refranco.ai» (con las imágenes bloqueadas se lee el alt, en la serif y en tinta). */
export function wordmarkClaro(): string {
  return `<a href="https://refranco.ai" style="text-decoration: none;"><img src="${URL_WORDMARK}" width="${ANCHO_WORDMARK}" height="${ALTO_WORDMARK}" alt="refranco.ai" style="display: block; width: ${ANCHO_WORDMARK}px; height: ${ALTO_WORDMARK}px; border: 0; outline: none; font-family: ${FUENTE_TITULO}; font-size: 20px; font-weight: 700; line-height: 1.2; color: ${TINTA};"></a>`;
}

export function notaTinta(html: string): string {
  return `<tr><td style="padding: 4px 0 18px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding: 14px 18px; border-left: 3px solid ${TINTA}; background: #FFFFFF; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.55; color: ${TINTA};">${html}</td>
  </tr></table>
</td></tr>`;
}

export function detalleFilas(d: NonNullable<CorreoClaro["detalle"]>): string {
  const filas = d.filas
    .map((f, i) => `<tr>
      <td style="padding: 10px 0; ${i < d.filas.length - 1 ? `border-bottom: 1px solid ${LINEA};` : ""} font-family: ${FUENTE_UI}; font-size: 14px; color: ${TINTA_3};">${f.etiqueta}</td>
      <td align="right" style="padding: 10px 0; ${i < d.filas.length - 1 ? `border-bottom: 1px solid ${LINEA};` : ""} font-family: ${FUENTE_UI}; font-size: 14px; font-weight: 600; color: ${TINTA};">${f.valor}</td>
    </tr>`)
    .join("");
  const titulo = d.titulo
    ? `<tr><td colspan="2" style="padding: 0 0 6px 0; font-family: ${FUENTE_UI}; font-size: 13px; font-weight: 600; color: ${TINTA_3};">${d.titulo}</td></tr>`
    : "";
  return `<tr><td style="padding: 4px 0 22px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid ${LINEA}; border-bottom: 1px solid ${LINEA};">${titulo}${filas}</table>
</td></tr>`;
}

function parrafo(html: string): string {
  return `<tr><td style="padding: 0 0 14px 0; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.6; color: ${TINTA_2};">${html}</td></tr>`;
}

export function botonTinta(b: BotonCorreo): string {
  return `<tr><td style="padding: 8px 0 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius: 999px; background: ${TINTA};">
      <a href="${b.url}" style="display: inline-block; padding: 14px 26px; font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 600; color: ${PAPEL}; text-decoration: none; border-radius: 999px;">${b.texto}</a>
    </td>
  </tr></table>
</td></tr>`;
}

export function codigoGrande(codigo: string): string {
  return `<tr><td style="padding: 6px 0 22px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="center" style="padding: 22px 16px; border: 1px solid ${LINEA}; border-radius: 16px; background: #FFFFFF; font-family: ${FUENTE_UI}; font-size: 40px; font-weight: 700; letter-spacing: 8px; color: ${TINTA};">${codigo}</td>
  </tr></table>
</td></tr>`;
}

/** El correo entero. Lo que devuelve va tal cual al cliente de correo (o a la plantilla de Supabase). */
export function plantillaClara(c: CorreoClaro): string {
  const filas: string[] = [];
  filas.push(`<tr><td style="padding: 0 0 26px 0; font-family: ${FUENTE_TITULO}; font-size: 24px; line-height: 1.2; font-weight: 700; color: ${TINTA};">${c.titular}</td></tr>`);
  const [primero, ...resto] = c.parrafos;
  if (primero) filas.push(parrafo(primero));
  if (c.codigo) filas.push(codigoGrande(c.codigo));
  for (const p of resto) filas.push(parrafo(p));
  if (c.nota) filas.push(notaTinta(c.nota));
  if (c.detalle && c.detalle.filas.length > 0) filas.push(detalleFilas(c.detalle));
  if (c.boton) filas.push(botonTinta(c.boton));
  for (const p of c.despues ?? []) filas.push(parrafo(p));
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(c.titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPEL};">
  ${c.preencabezado ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escaparHtml(c.preencabezado)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${PAPEL};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
          <tr><td style="padding: 0 0 28px 0;">${wordmarkClaro()}</td></tr>
          ${filas.join("\n          ")}
          <tr><td style="padding: 22px 0 0 0; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 12px; line-height: 1.6; color: ${TINTA_3};">${c.legal ?? LEGAL}<br><a href="https://refranco.ai" style="color: ${TINTA_3}; text-decoration: none;">refranco.ai</a></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * El correo del código de entrada, para las plantillas de Supabase Auth «Confirm signup» (correo
 * nuevo) y «Magic Link» (correo conocido): el mismo HTML, con los marcadores de Supabase.
 * Asunto sugerido: «Tu código para entrar a Franco: {{ .Token }}».
 */
export function correoCodigoSupabase(): string {
  return plantillaClara({
    titulo: "Tu código para entrar a Franco",
    titular: "Tu código para entrar",
    parrafos: ["Escríbelo en el informe, donde lo pediste. Vale una hora."],
    codigo: "{{ .Token }}",
    boton: { texto: "Entrar con el enlace", url: "{{ .ConfirmationURL }}" },
    despues: [
      "El enlace hace lo mismo que el código: te deja en el mismo informe, ya con tu cuenta.",
      "Si no pediste este código, no hagas nada: sin él nadie entra a tu cuenta.",
    ],
  });
}
