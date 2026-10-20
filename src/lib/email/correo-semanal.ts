// ─────────────────────────────────────────────────────────────────────────────
// El correo semanal (02-oct-2026, decisiones de Fabrizio): «Deptos publicados que Franco revisó para ti».
// Más comercial que el resto, en DOS variantes que se miden una contra otra (la variante es fija por
// persona, semanal.ts › varianteDe):
//   · «banda»    — arriba, la banda con el material del hero de la landing como imagen (con el titular
//                  dentro y el mismo texto en el alt); debajo, las tarjetas.
//   · «tarjetas» — el titular en serif, sin banda; las mismas tarjetas.
// Las dos: cada depto es una tarjeta con el precio grande y el veredicto en su color (la tríada), y el
// botón principal en rojo, «Analizar uno», que lleva a la selección. Sin análisis disponibles, debajo, UNA línea con
// el pack de tres por $19.990 (13-oct-2026, decisión de Fabrizio; lib/tres-analisis.ts): «Para analizarlos: 3 análisis
// por $19.990, sin caducidad.», con el enlace en el pack. Hasta el 13-oct el botón sin saldo era «Analizar uno ·
// $9.990» y compraba el suelto. Nunca «oportunidades», «portafolio» ni «exclusivo».
// El respaldo (05-oct-2026): un depto de una comuna vecina lo dice la frase de arriba; uno que entra
// como Ajustar negociable lleva «Conviene si lo negocias» bajo el precio. El PRIMER correo de cada
// persona se presenta, con el enlace para dejar de recibirlos a la vista (no solo en el pie).
// HTML de correo de verdad: tablas, estilos en línea, ancho 600, botón con fondo en la celda (Gmail e
// iPhone Mail), sin CSS de fondo ni SVG, esquema de color claro.
// EL CORREO DEL DÍA (16-oct-2026, del-dia.ts): la misma plantilla, en tarjetas, con su titular, el regalo al registrarse y
// la hora en que Franco los vio publicados («publicados al [hora]»).
// ─────────────────────────────────────────────────────────────────────────────
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { asuntoSemanal, COMO_ENTRAR, MARCA_NEGOCIAR, MARCA_SIN_CONFIRMAR, MARCA_VISTO, SEMANAL_VACIO, textoVence, type Visto } from "@/lib/guia/semanal";
import { MARCA_ZONA, SEMANAL_STR } from "@/lib/guia/semanal-str";
import { TRES_COPY } from "@/lib/tres-analisis";
import { DEL_DIA } from "@/lib/guia/del-dia";
import { REFERIDO_COPY } from "@/lib/referido";
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
  /** El relleno (20-oct-2026): cuántos van sin confirmar, y qué significa. */
  sinConfirmar: (n: number) => (n === 1
    ? "Uno lo vio anoche publicado en los resultados del portal, pero no alcanzó a revisar su ficha: va al final, marcado."
    : `${n} los vio anoche publicados en los resultados del portal, pero no alcanzó a revisar sus fichas: van al final, marcados.`),
  revisadosSinConfirmar: "Los confirmados, Franco los revisó hace unas horas y seguían publicados; los marcados «sin confirmar» los vio anoche en el portal. Antes de visitar uno, confirma con quien lo publica que sigue disponible.",
  presentacion: "Desde ahora, cada semana te mandamos los deptos publicados que mejor resultan con lo que buscas.",
  presentacionBaja: "Si no los quieres,",
  presentacionBajaEnlace: "deja de recibirlos",
  negociar: MARCA_NEGOCIAR,
  regalo: "El próximo que analices va por cuenta de Franco.",
  regaloBajada: "Ya está cargado en tu cuenta.",
  saldo: (n: number) => (n === 1 ? "Te queda 1 análisis." : `Te quedan ${n} análisis.`),
  boton: "Analizar uno",
  /** Sin análisis, bajo el botón: el pack de tres (13-oct-2026). */
  lineaTres: TRES_COPY.lineaCorreo,
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
  /** Del bloque de renta corta (14-oct-2026): lleva la marca «Estimado por zona». */
  zona?: boolean;
  /** Lo ya visto (19-oct-2026): va al final, con «Ya te lo mandamos» o «Ya lo analizaste». */
  visto?: Visto;
  /** El relleno (20-oct-2026): lo vio anoche publicado en el portal, sin ficha leída. Lleva «Visto anoche, sin confirmar». */
  sinConfirmar?: boolean;
}

/** El bloque de renta corta del correo (14-oct-2026): sus deptos, lo que busca y su pie y su plazo. */
export interface BloqueCortoCorreo {
  deptos: DeptoCorreo[];
  busca: string;
  piePct: number;
  plazoAnios: number;
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
  /**
   * LOS DOS BLOQUES (14-oct-2026): `largo` (por defecto, sí) es el de arriendo tradicional —`deptos`, `busca`, `piePct`
   * y `plazoAnios`—; `corto`, el de renta corta, estimado por zona. Con los dos, cada uno lleva su título; quien solo
   * tiene renta corta recibe solo ese. La línea provisoria del 13-oct («Estos convienen para arriendo tradicional…»)
   * salió.
   */
  largo?: boolean;
  corto?: BloqueCortoCorreo | null;
  /** El correo del día (16-oct-2026): cuándo se vieron publicados (`cuandoSeVio` del chequeo más antiguo). */
  delDia?: { publicadosAl: string } | null;
  /** El regalo al registrarse, vivo (16-oct-2026): cuándo vence. */
  regaloAltaVence?: string | null;
  urlBoton: string;
  /** El pack de tres (13-oct-2026), por el clic: `ir=tres`. */
  urlTres: string;
  urlBaja: string;
  urlBanda?: string;
  /** Invita a alguien (16-oct-2026, la puerta C): el enlace propio de la persona, en el pie. */
  invitar?: EnlaceInvitarCorreo | null;
}

export interface EnlaceInvitarCorreo {
  url: string;
  /** «refranco.ai/i/CÓDIGO». */
  texto: string;
}

/** La primera línea del pie: «Invita a alguien: si entra con tu enlace, los dos reciben un análisis.» y el enlace. */
function pieInvitar(inv: EnlaceInvitarCorreo | null | undefined): string {
  if (!inv) return "";
  return `<span style="color: ${TINTA_2};">${escaparHtml(REFERIDO_COPY.pieSemanal)} <a href="${inv.url}" style="color: ${TINTA_2}; text-decoration: underline;" data-invitar="pie">${escaparHtml(inv.texto)}</a></span><br><br>`;
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
    ${d.zona ? `<tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 13px; font-weight: 600; color: ${TINTA_2};" data-marca="zona">${escaparHtml(MARCA_ZONA)}</td></tr>` : ""}
    ${d.tramo === "negociar" ? `<tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 14px; font-weight: 600; color: ${TINTA};">${escaparHtml(SEMANAL.negociar)}</td></tr>` : ""}
    ${d.visto ? `<tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 13px; font-weight: 600; color: ${TINTA_2};" data-marca="visto">${escaparHtml(MARCA_VISTO[d.visto])}</td></tr>` : ""}
    ${d.sinConfirmar ? `<tr><td style="padding: 0 18px 10px 18px; font-family: ${FUENTE_UI}; font-size: 13px; font-weight: 600; color: ${TINTA_2};" data-marca="sin-confirmar">${escaparHtml(MARCA_SIN_CONFIRMAR)}</td></tr>` : ""}
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

/** El título de un bloque, cuando el correo trae los dos (14-oct-2026). */
const tituloBloque = (texto: string) =>
  `<tr><td style="padding: 10px 0 12px 0; font-family: ${FUENTE_TITULO}; font-size: 20px; line-height: 1.25; font-weight: 700; color: ${TINTA};" data-bloque="titulo">${escaparHtml(texto)}</td></tr>`;

export function correoSemanal(d: DatosCorreoSemanal): { subject: string; html: string } {
  const conLargo = d.largo !== false;
  const corto = d.corto ?? null;
  const dosBloques = conLargo && corto != null;
  // El preencabezado cuenta todos los deptos, con el pie y el plazo del primer bloque que tenga.
  const total = (conLargo ? d.deptos.length : 0) + (corto?.deptos.length ?? 0);
  const piePre = conLargo || !corto ? d.piePct : corto.piePct, plazoPre = conLargo || !corto ? d.plazoAnios : corto.plazoAnios;
  const pie = pct(d.piePct);
  const filas: string[] = [];
  const delDia = d.delDia ?? null;
  // El asunto y el titular dicen cuántos (20-oct-2026): «Encontré 2 que te convienen».
  const titular = delDia ? DEL_DIA.titular : asuntoSemanal(total);
  const sinConfirmar = conLargo ? d.deptos.filter((x) => x.sinConfirmar).length : 0;
  if (d.variante === "banda" && !delDia) {
    filas.push(`<tr><td style="padding: 0 0 24px 0;"><a href="${d.urlBoton}" style="text-decoration: none;"><img src="${d.urlBanda ?? URL_BANDA_SEMANAL}" width="${ANCHO_BANDA}" height="${ALTO_BANDA}" alt="${escaparHtml(SEMANAL.titular)}" style="display: block; width: 100%; max-width: ${ANCHO_BANDA}px; height: auto; border: 0; border-radius: 16px; background: #2B558F; font-family: ${FUENTE_TITULO}; font-size: 24px; font-weight: 700; line-height: 1.3; color: #FFFFFF;"></a></td></tr>`);
  } else {
    filas.push(`<tr><td style="padding: 0 0 22px 0; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.2; font-weight: 700; color: ${TINTA};">${escaparHtml(titular)}</td></tr>`);
  }
  filas.push(parrafo(escaparHtml(SEMANAL.saludo(d.nombre))));
  if (d.regaloAltaVence) {
    filas.push(`<tr><td style="padding: 2px 0 18px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding: 14px 18px; border-left: 3px solid ${TINTA}; background: #FFFFFF; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.55; color: ${TINTA};" data-regalo="alta"><b>${escaparHtml(DEL_DIA.regalo)}</b> ${escaparHtml(textoVence(d.regaloAltaVence))}</td>
  </tr></table>
</td></tr>`);
  }
  if (d.presentacion) {
    filas.push(parrafo(`${escaparHtml(delDia ? DEL_DIA.semanal : SEMANAL.presentacion)} ${escaparHtml(SEMANAL.presentacionBaja)} <a href="${d.urlBaja}" style="color: ${TINTA_2}; text-decoration: underline;">${SEMANAL.presentacionBajaEnlace}</a>.`));
    // Cómo se entra (13-oct-2026): el primer correo lo dice, para quien abra un enlace en otro aparato.
    filas.push(parrafo(escaparHtml(COMO_ENTRAR)));
  }
  if (d.conRegalo) {
    filas.push(`<tr><td style="padding: 2px 0 18px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding: 14px 18px; border-left: 3px solid ${TINTA}; background: #FFFFFF; font-family: ${FUENTE_UI}; font-size: 15px; line-height: 1.55; color: ${TINTA};"><b>${SEMANAL.regalo}</b> ${SEMANAL.regaloBajada}${d.regaloVence ? ` ${textoVence(d.regaloVence)}` : ""}</td>
  </tr></table>
</td></tr>`);
  }
  // El bloque de arriendo tradicional (el de siempre).
  if (conLargo) {
    if (dosBloques) filas.push(tituloBloque(SEMANAL_STR.bloqueLargo));
    if (d.deptos.length > 0) {
      const negociar = d.deptos.filter((x) => x.tramo === "negociar").length;
      filas.push(parrafo(escaparHtml(delDia ? DEL_DIA.introN(d.deptos.length, d.busca, pie, d.plazoAnios, negociar) : SEMANAL.intro(d.deptos.length, d.busca, pie, d.plazoAnios, negociar))));
      if (d.deptos.some((x) => x.tramo === "vecina")) filas.push(parrafo(escaparHtml(SEMANAL.vecinas)));
      if (sinConfirmar > 0) filas.push(parrafo(escaparHtml(SEMANAL.sinConfirmar(sinConfirmar))));
      for (const dep of d.deptos) filas.push(tarjeta(dep));
    } else {
      filas.push(parrafo(escaparHtml(SEMANAL_STR.sinLargo)));
    }
  }
  // El bloque de renta corta (14-oct-2026), estimado por zona: cada depto con su marca.
  if (corto) {
    if (dosBloques) filas.push(tituloBloque(SEMANAL_STR.bloqueCorto));
    if (corto.deptos.length > 0) {
      filas.push(parrafo(escaparHtml(SEMANAL_STR.intro(corto.deptos.length, corto.busca, pct(corto.piePct), corto.plazoAnios))));
      filas.push(parrafo(escaparHtml(SEMANAL_STR.zona), ` font-size: 14px;`));
      if (corto.deptos.some((x) => x.tramo === "vecina")) filas.push(parrafo(escaparHtml(SEMANAL.vecinas)));
      for (const dep of corto.deptos) filas.push(tarjeta({ ...dep, zona: true }));
    } else {
      filas.push(parrafo(escaparHtml(SEMANAL_STR.sinCorto)));
    }
  }
  const conSaldo = d.saldo == null || d.saldo > 0;
  if (d.saldo != null && d.saldo > 0 && !d.conRegalo) filas.push(parrafo(escaparHtml(SEMANAL.saldo(d.saldo)), " padding-top: 6px;"));
  filas.push(botonRojo(SEMANAL.boton, d.urlBoton));
  if (!conSaldo) {
    const l = SEMANAL.lineaTres;
    filas.push(parrafo(`${escaparHtml(l.antes)}<a href="${d.urlTres}" style="color: ${TINTA}; font-weight: 600; text-decoration: underline;">${escaparHtml(l.enlace)}</a>${escaparHtml(l.despues)}`));
  }
  filas.push(parrafo(escaparHtml(delDia ? DEL_DIA.publicadosAl(delDia.publicadosAl) : sinConfirmar > 0 ? SEMANAL.revisadosSinConfirmar : SEMANAL.revisados), ` font-size: 13px; color: ${TINTA_3};`));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escaparHtml(delDia ? DEL_DIA.asunto : asuntoSemanal(total))}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPEL};">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escaparHtml(delDia ? DEL_DIA.preencabezado(total) : SEMANAL.preencabezado(total, pct(piePre), plazoPre))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPEL}" style="background: ${PAPEL};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
          <tr><td style="padding: 0 0 24px 0;">${wordmarkClaro()}</td></tr>
          ${filas.join("\n          ")}
          <tr><td style="padding: 22px 0 0 0; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 12px; line-height: 1.6; color: ${TINTA_3};">${pieInvitar(d.invitar)}${SEMANAL.porQue} <a href="${d.urlBaja}" style="color: ${TINTA_3}; text-decoration: underline;">${SEMANAL.baja}</a><br>${LEGAL}<br><a href="https://refranco.ai" style="color: ${TINTA_3}; text-decoration: none;">refranco.ai</a></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: delDia ? DEL_DIA.asunto : asuntoSemanal(total), html };
}

/** Las piezas de la plantilla, para el aviso inmediato (correo-inmediato.ts): la misma tarjeta y el mismo botón. */
export const tarjetaSemanal = tarjeta;
export const botonRojoSemanal = botonRojo;
export const parrafoSemanal = parrafo;

/** «2 dormitorios, Ñuñoa y Macul, hasta UF 4.500»: lo que busca, en una frase. Con el piso elegido a mano (/deptos,
 *  16-oct-2026), el rango: «entre UF 3.000 y 4.000». */
export function textoBusca(p: { dormitorios: number[]; comunas: string[]; precioMaxUf: number | null; precioMinUf?: number | null; editado?: readonly string[] }): string {
  const dorm = p.dormitorios.map((x) => (x === 0 ? "studio" : String(x)));
  const dTexto = dorm.length === 0 ? null
    : dorm.length === 1 ? (dorm[0] === "studio" ? "studio" : `${dorm[0]} ${dorm[0] === "1" ? "dormitorio" : "dormitorios"}`)
    : `${dorm.slice(0, -1).join(", ")} o ${dorm[dorm.length - 1]} dormitorios`;
  const cs = p.comunas;
  const cTexto = cs.length === 0 ? null : cs.length === 1 ? cs[0] : `${cs.slice(0, -1).join(", ")} y ${cs[cs.length - 1]}`;
  const conPiso = p.precioMinUf != null && p.precioMinUf > 0 && !!p.editado?.includes("precioMin");
  const uf = p.precioMaxUf == null ? null
    : conPiso ? `entre UF ${miles(p.precioMinUf!)} y ${miles(p.precioMaxUf)}`
    : `hasta UF ${miles(p.precioMaxUf)}`;
  return [dTexto, cTexto, uf].filter(Boolean).join(", ");
}

/**
 * El correo corto de la semana sin deptos (13-oct-2026, decisión de Fabrizio): «Esta semana no apareció ninguno que
 * te convenga con tu pie y tu plazo. Seguimos buscando.», con el enlace a su perfil por si quiere cambiar comunas.
 * Sin regalo, sin tarjetas y sin botón de compra. El primero de la persona se presenta igual que el otro.
 */
// EL DEL DÍA VACÍO (16-oct-2026): con `delDia`, «Te aviso cuando aparezca uno», con el regalo si lo tiene.
export interface CasiCorreo {
  comuna: string;
  tipologia: string | null;
  m2: number;
  precioUF: number;
  score: number | null;
  flujo: number | null;
}

/** El relleno de verdad del vacío (20-oct-2026): los que casi (Ajustar, con sus números) y con qué sí, con el ajuste en un toque. */
export function correoSemanalVacio(d: {
  nombre: string | null; presentacion?: boolean; urlPerfil: string; urlBaja: string; delDia?: boolean; regaloAltaVence?: string | null; invitar?: EnlaceInvitarCorreo | null;
  casi?: CasiCorreo[];
  alternativa?: { texto: string; boton: string; url: string } | null;
  /** Cuántos había publicados como los que busca: sin casi ni alternativa, el cuerpo lo dice en vez de «no apareció ninguno». */
  revisados?: number | null;
}): { subject: string; html: string } {
  const filas: string[] = [];
  const asunto = d.delDia ? DEL_DIA.vacioAsunto : SEMANAL_VACIO.asunto;
  filas.push(`<tr><td style="padding: 0 0 22px 0; font-family: ${FUENTE_TITULO}; font-size: 24px; line-height: 1.2; font-weight: 700; color: ${TINTA};">${escaparHtml(asunto)}</td></tr>`);
  filas.push(parrafo(escaparHtml(SEMANAL.saludo(d.nombre))));
  if (d.regaloAltaVence) filas.push(parrafo(`<b>${escaparHtml(DEL_DIA.regalo)}</b> ${escaparHtml(textoVence(d.regaloAltaVence))}`, ` color: ${TINTA};`));
  if (d.presentacion) {
    filas.push(parrafo(`${escaparHtml(d.delDia ? DEL_DIA.semanal : SEMANAL.presentacion)} ${escaparHtml(SEMANAL.presentacionBaja)} <a href="${d.urlBaja}" style="color: ${TINTA_2}; text-decoration: underline;">${SEMANAL.presentacionBajaEnlace}</a>.`));
    filas.push(parrafo(escaparHtml(COMO_ENTRAR)));
  }
  // La verdad (20-oct-2026): los que casi, nombrados; con qué sí, con el ajuste en un toque; y si no hay nada de eso, cuántos
  // había y que ninguno da ni con pie 30 % ni en vecinas. Nunca «no apareció ninguno» a secas.
  const casi = d.casi ?? [];
  const aSecas = !d.delDia && casi.length === 0 && !d.alternativa && d.revisados != null;
  const cuerpoVacio = d.delDia ? DEL_DIA.vacio : aSecas ? SEMANAL_VACIO.revisados(d.revisados!) : SEMANAL_VACIO.cuerpo;
  filas.push(parrafo(escaparHtml(cuerpoVacio)));
  if (casi.length > 0) {
    filas.push(parrafo(escaparHtml(SEMANAL_VACIO.casi(casi.length))));
    for (const c of casi) {
      const ojo = [c.comuna, c.tipologia, `${miles(c.m2)} m²`].filter(Boolean).join(" · ");
      filas.push(`<tr><td style="padding: 0 0 8px 0; font-family: ${FUENTE_UI}; font-size: 14px; line-height: 1.5; color: ${TINTA};" data-casi="1"><b>UF ${miles(c.precioUF)}</b> · ${escaparHtml(ojo)}${c.score != null ? ` · <span style="color: ${TINTA_3};">${escaparHtml(etiquetaVeredicto("AJUSTA SUPUESTOS", "frase"))} ${c.score}</span>` : ""}</td></tr>`);
    }
  }
  if (d.alternativa) {
    filas.push(parrafo(escaparHtml(d.alternativa.texto), ` color: ${TINTA}; padding-top: 6px;`));
    filas.push(`<tr><td style="padding: 0 0 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border: 1.5px solid ${TINTA}; border-radius: 999px;">
      <a href="${d.alternativa.url}" style="display: inline-block; padding: 12px 22px; font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 600; color: ${TINTA}; text-decoration: none; border-radius: 999px;" data-ajuste="1">${escaparHtml(d.alternativa.boton)}</a>
    </td>
  </tr></table>
</td></tr>`);
  }
  filas.push(parrafo(escaparHtml(d.delDia ? DEL_DIA.vacioPerfil : SEMANAL_VACIO.perfil)));
  filas.push(`<tr><td style="padding: 4px 0 24px 0; font-family: ${FUENTE_UI}; font-size: 15px; font-weight: 600;"><a href="${d.urlPerfil}" style="color: ${TINTA}; text-decoration: underline;">${escaparHtml(SEMANAL_VACIO.boton)}</a></td></tr>`);
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escaparHtml(asunto)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPEL};">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escaparHtml(cuerpoVacio)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPEL}" style="background: ${PAPEL};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
          <tr><td style="padding: 0 0 24px 0;">${wordmarkClaro()}</td></tr>
          ${filas.join("\n          ")}
          <tr><td style="padding: 22px 0 0 0; border-top: 1px solid ${LINEA}; font-family: ${FUENTE_UI}; font-size: 12px; line-height: 1.6; color: ${TINTA_3};">${pieInvitar(d.invitar)}${SEMANAL.porQue} <a href="${d.urlBaja}" style="color: ${TINTA_3}; text-decoration: underline;">${SEMANAL.baja}</a><br>${LEGAL}<br><a href="https://refranco.ai" style="color: ${TINTA_3}; text-decoration: none;">refranco.ai</a></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: asunto, html };
}
