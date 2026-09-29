// ─────────────────────────────────────────────────────────────────────────────
// LA PLANTILLA CLARA DE LOS CORREOS (29-sep-2026): papel, tinta, Inter con su fallback, el wordmark
// fiel, el botón en tinta y el pie con el legal. Nace para el correo del código de «Lo que sigue» y
// es la base para pasar después TODOS los correos de Franco al mismo formato (hoy email.ts va en
// oscuro y con fuentes distintas). Solo tablas y estilos inline: Gmail ignora <style> y <link> y
// el Mail de iPhone respeta el ancho de 600 con `max-width`. Sin oscuro, sin mono.
// ─────────────────────────────────────────────────────────────────────────────

export const PAPEL = "#FAFAF8";
export const TINTA = "#0F0F0F";
export const TINTA_2 = "#3B3A36";
export const TINTA_3 = "#6B6B72";
export const LINEA = "#DDDDE1";
export const ROJO = "#C8323C";
export const FUENTE_UI = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
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
  /** Línea legal del pie. Por defecto, la de Franco. */
  legal?: string;
}

const LEGAL = "Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.";

export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** El wordmark fiel: «re» ghost en serif, «franco» bold en serif, «.ai» en rojo. */
export function wordmarkClaro(): string {
  return `<span style="font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1; color: ${TINTA};"><span style="color: #B4B2A9;">re</span><span style="font-weight: 700;">franco</span><span style="font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 600; color: ${ROJO};">.ai</span></span>`;
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
