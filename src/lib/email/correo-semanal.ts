// ─────────────────────────────────────────────────────────────────────────────
// El correo semanal (02-oct-2026, decisiones de Fabrizio): «Deptos publicados que Franco revisó para ti».
// Más comercial que el resto, en DOS variantes que se miden una contra otra (la variante es fija por
// persona, semanal.ts › varianteDe):
//   · «banda»    — arriba, la banda con el material del hero de la landing como imagen (con el titular
//                  dentro y el mismo texto en el alt); debajo, las tarjetas.
//   · «tarjetas» — el titular en serif, sin banda; las mismas tarjetas.
// Las dos: cada depto es una tarjeta con el precio grande y el veredicto en su color (la tríada), y el
// botón principal en rojo. Con análisis disponibles el botón dice «Analizar uno»; sin, «Analizar uno ·
// $9.990» y lleva a comprar el SUELTO (el pack vive solo en el ticket). Nunca «oportunidades»,
// «portafolio» ni «exclusivo».
// El respaldo (05-oct-2026): un depto de una comuna vecina lo dice la frase de arriba; uno que entra
// como Ajustar negociable lleva «Conviene si lo negocias» bajo el precio. El PRIMER correo de cada
// persona se presenta, con el enlace para dejar de recibirlos a la vista (no solo en el pie).
// HTML de correo de verdad: tablas, estilos en línea, ancho 600, botón con fondo en la celda (Gmail e
// iPhone Mail), sin CSS de fondo ni SVG, esquema de color claro.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { MARCA_NEGOCIAR, textoVence } from "@/lib/guia/semanal";
import { FUENTE_TITULO, FUENTE_UI, LEGAL, LINEA, PAPEL, ROJO, TINTA, TINTA_2, TINTA_3, escaparHtml, wordmarkClaro } from "./plantilla-clara";

export const URL_BANDA_SEMANAL = "https://refranco.ai/email/semanal-banda-2x.jpg";
export const ANCHO_BANDA = 600;
export const ALTO_BANDA = 200;

/** Los colores de la tríada (globals.css › [data-verdict]). */
export const COLOR_VEREDICTO: Record<string, string> = {
  COMPRAR: "#2B558F",
  "AJUSTA SUPUESTOS": "#6E4560",
  "BUSCAR OTRA": ROJO,
};

export const SEMANAL = {
  asunto: "Deptos publicados que Franco revisó para ti",
  titular: "Deptos publicados que Franco revisó para ti",
  preencabezado: (n: number, pie: string, plazo: number) => `${n} deptos publicados esta semana que resultan con tu pie de ${pie}% y ${plazo} años.`,
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}:` : "Hola:"),
  intro: (n: number, busca: string, pie: string, plazo: number, negociar = 0) =>
    `Esta semana, ${n} deptos publicados como los que buscas —${busca}— resultan con tu pie de ${pie}% y tu plazo de ${plazo} años${
      negociar === 0 ? "" : negociar === 1 ? ", uno de ellos si lo negocias" : `, ${negociar} de ellos si los negocias`}.`,
  vecinas: "En tus comunas había menos de tres, así que sumamos de comunas vecinas.",
  presentacion: "Desde ahora, cada semana te mandamos los deptos publicados que mejor resultan con lo que buscas.",
  presentacionBaja: "Si no los quieres,",
  presentacionBajaEnlace: "deja de recibirlos",
  negociar: MARCA_NEGOCIAR,
  regalo: "El próximo que analices va por cuenta de Franco.",
  regaloBajada: "Ya está cargado en tu cuenta.",
  saldo: (n: number) => (n === 1 ? "Te queda 1 análisis." : `Te quedan ${n} análisis.`),
  botonConSaldo: "Analizar uno",
  botonSinSaldo: `Analizar uno · ${fmtCLP(SINGLE_PRICE)}`,
  verDepto: "Ver este depto",
  alMes: "al mes",
  revisados: "Franco los revisó hace unas horas y seguían publicados. Antes de visitar uno, confirma con quien lo publica que sigue disponible.",
  porQue: "Los recibes porque tienes cuenta en Franco.",
  baja: "Dejar de recibirlos",
} as const;

export interface DeptoCorreo {
  comuna: string;
  tipologia: string | null;
  m2: number;
  precioUF: number;
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
  url: string;
  /** De dónde salió: ausente = sus comunas; «vecina»; «negociar» (lleva la marca). */
  tramo?: "vecina" | "negociar";
}

export interface DatosCorreoSemanal {
  variante: "banda" | "tarjetas";
  nombre: string | null;
  /** «2 dormitorios, Ñuñoa y Macul, hasta UF 4.500». */
  busca: string;
  piePct: number;
  plazoAnios: number;
  deptos: DeptoCorreo[];
  /** Análisis disponibles; null con plan (analizar no descuenta). */
  saldo: number | null;
  conRegalo: boolean;
  /** Cuándo vence el regalo (ISO); el correo dice «Vence el [fecha].». */
  regaloVence?: string | null;
  /** El primer correo de la persona: se presenta y deja la baja a la vista. */
  presentacion?: boolean;
  urlBoton: string;
  urlComprar: string;
  urlBaja: string;
  urlBanda?: string;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const flujoTexto = (f: number) => `${f < 0 ? "−" : "+"}$${miles(Math.abs(f))}`;

function tarjeta(d: DeptoCorreo): string {
  const color = (d.veredicto && COLOR_VEREDICTO[d.veredicto]) || TINTA;
  const v = d.veredicto ? etiquetaVeredicto(d.veredicto, "frase") : "—";
  const ojo = escaparHtml([d.comuna, d.tipologia, `${miles(d.m2)} m²`].filter(Boolean).join(" · "));
  const flujo = d.flujo != null
    ? `<span style="font-weight: 600; color: ${d.flujo < 0 ? ROJO : TINTA};">${flujoTexto(d.flujo)}</span> <span style="color: ${TINTA_3};">${SEMANAL.alMes}</span>`
    : "";
  return `<tr><td style="padding: 0 0 12px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #FFFFFF; border: 1px solid ${LINEA}; border-radius: 14px;">
    <tr><td style="padding: 16px 18px 6px 18px; font-family: ${FUENTE_UI}; font-size: 13px; color: ${TINTA_3};">${ojo}</td></tr>
    <tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 28px; line-height: 1.1; font-weight: 700; color: ${TINTA};"><a href="${d.url}" style="color: ${TINTA}; text-decoration: none;">UF ${miles(d.precioUF)}</a></td></tr>
    ${d.tramo === "negociar" ? `<tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 14px; font-weight: 600; color: ${TINTA};">${escaparHtml(SEMANAL.negociar)}</td></tr>` : ""}
    <tr><td style="padding: 0 18px 14px 18px; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.5;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding: 0 8px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="10" height="10" bgcolor="${color}" style="width: 10px; height: 10px; background: ${color}; border-radius: 3px; font-size: 0; line-height: 0;">&nbsp;</td></tr></table></td>
        <td valign="middle" style="font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 700; color: ${color};">${escaparHtml(v)}${d.score != null ? ` <span style="font-weight: 500; color: ${TINTA_3};">${d.score}</span>` : ""}</td>
        ${flujo ? `<td valign="middle" style="padding: 0 0 0 14px; font-family: ${FUENTE_UI}; font-size: 15px;">${flujo}</td>` : ""}
      </tr></table>
    </td></tr>
    <tr><td style="padding: 12px 18px 14px 18px; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 14px; font-weight: 600;"><a href="${d.url}" style="color: ${TINTA}; text-decoration: underline;">${SEMANAL.verDepto}</a></td></tr>
  </table>
</td></tr>`;
}

function botonRojo(texto: string, url: string): string {
  return `<tr><td style="padding: 10px 0 24px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${ROJO}" style="border-radius: 999px; background: ${ROJO};">
      <a href="${url}" style="display: inline-block; padding: 15px 30px; font-family: ${FUENTE_UI}; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 999px;">${escaparHtml(texto)}</a>
    </td>
  </tr></table>
</td></tr>`;
}

const parrafo = (html: string, extra = "") =>
  `<tr><td style="padding: 0 0 14px 0; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.6; color: ${TINTA_2};${extra}">${html}</td></tr>`;

export function correoSemanal(d: DatosCorreoSemanal): { subject: string; html: string } {
  const pie = pct(d.piePct);
  const filas: string[] = [];
  if (d.variante === "banda") {
    filas.push(`<tr><td style="padding: 0 0 24px 0;"><a href="${d.urlBoton}" style="text-decoration: none;"><img src="${d.urlBanda ?? URL_BANDA_SEMANAL}" width="${ANCHO_BANDA}" height="${ALTO_BANDA}" alt="${escaparHtml(SEMANAL.titular)}" style="display: block; width: 100%; max-width: ${ANCHO_BANDA}px; height: auto; border: 0; border-radius: 16px; background: #2B558F; font-family: ${FUENTE_TITULO}; font-size: 24px; font-weight: 700; line-height: 1.3; color: #FFFFFF;"></a></td></tr>`);
  } else {
    filas.push(`<tr><td style="padding: 0 0 22px 0; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.2; font-weight: 700; color: ${TINTA};">${escaparHtml(SEMANAL.titular)}</td></tr>`);
  }
  filas.push(parrafo(escaparHtml(SEMANAL.saludo(d.nombre))));
  if (d.presentacion) {
    filas.push(parrafo(`${escaparHtml(SEMANAL.presentacion)} ${escaparHtml(SEMANAL.presentacionBaja)} <a href="${d.urlBaja}" style="color: ${TINTA_2}; text-decoration: underline;">${SEMANAL.presentacionBajaEnlace}</a>.`));
  }
  const negociar = d.deptos.filter((x) => x.tramo === "negociar").length;
  filas.push(parrafo(escaparHtml(SEMANAL.intro(d.deptos.length, d.busca, pie, d.plazoAnios, negociar))));
  if (d.deptos.some((x) => x.tramo === "vecina")) filas.push(parrafo(escaparHtml(SEMANAL.vecinas)));
  if (d.conRegalo) {
    filas.push(`<tr><td style="padding: 2px 0 18px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding: 14px 18px; border-left: 3px solid ${TINTA}; background: #FFFFFF; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.55; color: ${TINTA};"><b>${SEMANAL.regalo}</b> ${SEMANAL.regaloBajada}${d.regaloVence ? ` ${textoVence(d.regaloVence)}` : ""}</td>
  </tr></table>
</td></tr>`);
  }
  for (const dep of d.deptos) filas.push(tarjeta(dep));
  const conSaldo = d.saldo == null || d.saldo > 0;
  if (d.saldo != null && d.saldo > 0 && !d.conRegalo) filas.push(parrafo(escaparHtml(SEMANAL.saldo(d.saldo)), " padding-top: 6px;"));
  filas.push(botonRojo(conSaldo ? SEMANAL.botonConSaldo : SEMANAL.botonSinSaldo, conSaldo ? d.urlBoton : d.urlComprar));
  filas.push(parrafo(escaparHtml(SEMANAL.revisados), ` font-size: 13px; color: ${TINTA_3};`));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escaparHtml(SEMANAL.asunto)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPEL};">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escaparHtml(SEMANAL.preencabezado(d.deptos.length, pie, d.plazoAnios))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPEL}" style="background: ${PAPEL};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
          <tr><td style="padding: 0 0 24px 0;">${wordmarkClaro()}</td></tr>
          ${filas.join("\n          ")}
          <tr><td style="padding: 22px 0 0 0; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 12px; line-height: 1.6; color: ${TINTA_3};">${SEMANAL.porQue} <a href="${d.urlBaja}" style="color: ${TINTA_3}; text-decoration: underline;">${SEMANAL.baja}</a><br>${LEGAL}<br><a href="https://refranco.ai" style="color: ${TINTA_3}; text-decoration: none;">refranco.ai</a></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: SEMANAL.asunto, html };
}

/** Las piezas de la plantilla, para el aviso inmediato (correo-inmediato.ts): la misma tarjeta y el mismo botón. */
export const tarjetaSemanal = tarjeta;
export const botonRojoSemanal = botonRojo;
export const parrafoSemanal = parrafo;

/** «2 dormitorios, Ñuñoa y Macul, hasta UF 4.500»: lo que busca, en una frase. */
export function textoBusca(p: { dormitorios: number[]; comunas: string[]; precioMaxUf: number | null }): string {
  const dorm = p.dormitorios.map((x) => (x === 0 ? "studio" : String(x)));
  const dTexto = dorm.length === 0 ? null
    : dorm.length === 1 ? (dorm[0] === "studio" ? "studio" : `${dorm[0]} ${dorm[0] === "1" ? "dormitorio" : "dormitorios"}`)
    : `${dorm.slice(0, -1).join(", ")} o ${dorm[dorm.length - 1]} dormitorios`;
  const cs = p.comunas;
  const cTexto = cs.length === 0 ? null : cs.length === 1 ? cs[0] : `${cs.slice(0, -1).join(", ")} y ${cs[cs.length - 1]}`;
  const uf = p.precioMaxUf != null ? `hasta UF ${miles(p.precioMaxUf)}` : null;
  return [dTexto, cTexto, uf].filter(Boolean).join(", ");
}
