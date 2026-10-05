// ─────────────────────────────────────────────────────────────────────────────
// El aviso inmediato y la pregunta de los 60 días (05-oct-2026), en la plantilla del semanal: el mismo
// titular en serif, las mismas tarjetas (precio grande, veredicto en su color, flujo) y el mismo botón
// rojo —«Analizar uno · $9.990» sin análisis, al suelto marcado como venido del aviso—. El pie lleva
// su PROPIA baja: dejar de recibir los avisos no toca el semanal.
// ─────────────────────────────────────────────────────────────────────────────
import { INMEDIATO } from "@/lib/guia/inmediato";
import { FUENTE_TITULO, FUENTE_UI, LEGAL, LINEA, PAPEL, TINTA, TINTA_2, TINTA_3, escaparHtml, wordmarkClaro } from "./plantilla-clara";
import { botonRojoSemanal, parrafoSemanal, tarjetaSemanal, type DeptoCorreo } from "./correo-semanal";

export interface DatosCorreoInmediato {
  nombre: string | null;
  busca: string;
  piePct: number;
  plazoAnios: number;
  deptos: DeptoCorreo[];
  /** Análisis disponibles; null con plan. */
  saldo: number | null;
  urlBoton: string;
  urlComprar: string;
  urlBaja: string;
}

const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function documento(titulo: string, preencabezado: string, filas: string[], pie: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPEL};">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escaparHtml(preencabezado)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPEL}" style="background: ${PAPEL};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
          <tr><td style="padding: 0 0 24px 0;">${wordmarkClaro()}</td></tr>
          ${filas.join("\n          ")}
          <tr><td style="padding: 22px 0 0 0; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 12px; line-height: 1.6; color: ${TINTA_3};">${pie}<br>${LEGAL}<br><a href="https://refranco.ai" style="color: ${TINTA_3}; text-decoration: none;">refranco.ai</a></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const titular = (t: string) => `<tr><td style="padding: 0 0 22px 0; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.2; font-weight: 700; color: ${TINTA};">${escaparHtml(t)}</td></tr>`;

export function correoInmediato(d: DatosCorreoInmediato): { subject: string; html: string } {
  const n = d.deptos.length;
  const pie = pct(d.piePct);
  const filas: string[] = [titular(n === 1 ? INMEDIATO.titular : INMEDIATO.titularVarios(n))];
  filas.push(parrafoSemanal(escaparHtml(d.nombre ? `Hola, ${d.nombre}:` : "Hola:")));
  filas.push(parrafoSemanal(escaparHtml(INMEDIATO.intro(n, d.busca, pie, d.plazoAnios))));
  for (const dep of d.deptos) filas.push(tarjetaSemanal(dep));
  const conSaldo = d.saldo == null || d.saldo > 0;
  filas.push(botonRojoSemanal(conSaldo ? INMEDIATO.botonConSaldo : INMEDIATO.botonSinSaldo, conSaldo ? d.urlBoton : d.urlComprar));
  const pieHtml = `${INMEDIATO.porQue} <a href="${d.urlBaja}" style="color: ${TINTA_3}; text-decoration: underline;">${INMEDIATO.baja}</a>. ${INMEDIATO.bajaSigue}`;
  return { subject: INMEDIATO.asunto, html: documento(INMEDIATO.asunto, INMEDIATO.intro(n, d.busca, pie, d.plazoAnios), filas, pieHtml) };
}

/** La pregunta de los 60 días: tres respuestas de un clic. */
export function correoPreguntaYa(d: { nombre: string | null; urlRespuesta: (h: "ya" | "meses" | "mirando") => string }): { subject: string; html: string } {
  const P = INMEDIATO.pregunta;
  const filas: string[] = [titular(P.titular)];
  filas.push(parrafoSemanal(escaparHtml(d.nombre ? `Hola, ${d.nombre}:` : "Hola:")));
  filas.push(parrafoSemanal(escaparHtml(P.cuerpo)));
  // Las tres respuestas con el mismo peso: el correo no empuja ninguna.
  const botones = P.opciones.map((o) => `<tr><td style="padding: 0 0 10px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius: 999px; border: 1px solid ${TINTA}; background: #FFFFFF;">
      <a href="${d.urlRespuesta(o.id)}" style="display: inline-block; padding: 13px 26px; font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 600; color: ${TINTA}; text-decoration: none; border-radius: 999px;">${escaparHtml(o.texto)}</a>
    </td>
  </tr></table>
</td></tr>`);
  filas.push(...botones);
  filas.push(parrafoSemanal(escaparHtml(P.sinRespuesta), ` padding-top: 10px; font-size: 13px; color: ${TINTA_2};`));
  return { subject: P.asunto, html: documento(P.asunto, P.cuerpo, filas, "Te llega porque tienes cuenta en Franco.") };
}
