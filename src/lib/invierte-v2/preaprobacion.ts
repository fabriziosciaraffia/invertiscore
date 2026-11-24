// ─────────────────────────────────────────────────────────────────────────────
// LA PREAPROBACIÓN, SUS TEXTOS Y SUS REGLAS PURAS (Invierte con Franco, entrega 3, 19-nov-2026). Láminas 3.4-preaprobacion,
// 3.4-preaprobacion-estados y el bloque de subida de 3.1-perfil-paso2-con-preaprobacion. Los textos van tal como la lámina.
//   · Es de la persona, no del depto: se sube una vez y vale para todos sus deptos. Sin ella no se oferta ni se pide visita.
//   · Una IA la lee y PROPONE banco, monto, vigencia y si el nombre coincide; una persona de Franco aprueba o pide corregir.
//   · El monto aprobado reemplaza la estimación de hasta cuánto puede comprar (perfil.ts › hastaCuanto con `aprobadaUF`).
//   · «Compro sin crédito» pasa directo (por ahora no se pide respaldo). «Todavía no la tengo» crea una tarea para explicarle.
// Módulo puro (sin DB): lo usan las páginas, las rutas, el correo y el tier INVIERTE-V2-E2 §10.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtUF } from "./opciones";

export const URL_PREAPROBACION = "/invierte/preaprobacion";
export const URL_API_PREAPROBACION = "/api/invierte-v2/preaprobacion";
/** El tope del bucket `invierte` (15 MB) y sus tipos. HEIC/HEIF se aceptan (fotos del iPhone) aunque la IA no los lea. */
export const MAX_BYTES_PREAPROBACION = 15 * 1024 * 1024;
export const MIMES_PREAPROBACION: Readonly<Record<string, string>> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};
/** Los que la IA puede leer (PDF e imágenes comunes). Los demás quedan para la revisión a mano. */
export const MIMES_QUE_LEE_LA_IA: ReadonlySet<string> = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const ACCEPT_PREAPROBACION = Object.keys(MIMES_PREAPROBACION).join(",");

export type EstadoDocumento = "subiendo" | "en_revision" | "aprobada" | "por_corregir" | "sin_credito";
/** Lo que ve la persona: «subir» (no hay nada vigente), uno de los tres estados de la lámina, sin crédito o «explicando»
 *  (dijo que todavía no la tiene y una persona le va a explicar). */
export type EstadoVisible = "subir" | "en_revision" | "aprobada" | "por_corregir" | "sin_credito" | "explicando";

export function estadoVisible(doc: { estado: EstadoDocumento } | null, explicando: boolean): EstadoVisible {
  if (doc?.estado === "en_revision" || doc?.estado === "aprobada" || doc?.estado === "por_corregir" || doc?.estado === "sin_credito") return doc.estado;
  return explicando ? "explicando" : "subir";
}

/** ¿Sigue vigente? Sin fecha, sí (la vigencia la pone la persona de Franco al aprobar). `hoy` en AAAA-MM-DD, hora de Chile. */
export const vigente = (vigenteHasta: string | null, hoy: string) => !vigenteHasta || vigenteHasta >= hoy;
/** Hoy en Chile, AAAA-MM-DD. */
export const hoyChile = (ahora: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);

/** Sin preaprobación no se oferta ni se pide visita: solo una aprobada o «compro sin crédito» dejan avanzar. */
export const puedeOfertar = (e: EstadoVisible) => e === "aprobada" || e === "sin_credito";

export function validarArchivo(f: { mime: unknown; bytes: unknown }): { ok: true; mime: string; ext: string; bytes: number } | { ok: false; error: "tipo" | "tamano" } {
  const mime = typeof f.mime === "string" ? f.mime.toLowerCase() : "";
  const ext = MIMES_PREAPROBACION[mime];
  if (!ext) return { ok: false, error: "tipo" };
  const bytes = typeof f.bytes === "number" ? f.bytes : NaN;
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES_PREAPROBACION) return { ok: false, error: "tamano" };
  return { ok: true, mime, ext, bytes };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «15 de febrero» de una fecha «2027-02-15». */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]}`;
}

export const PREAPROB_COPY = {
  cabecera: "Tu preaprobación",
  titulo: "Para ofertar o visitar, sube tu preaprobación",
  linea: "Es el documento de tu banco que dice hasta cuánto te prestaría. Se sube una vez y vale para todos tus deptos.",
  porQueT: "Por qué te la pedimos",
  porQue: "Quien vende la exige para recibir una oferta o agendar una visita. Con ella llegas con respaldo.",
  cajaT: "Foto o PDF de tu preaprobación",
  cajaS: "O el certificado de tu banco.",
  elegido: (nombre: string) => `Elegiste: ${nombre}`,
  subir: "Subir mi preaprobación",
  subiendo: "Subiendo…",
  todaviaNo: "Todavía no la tengo",
  sinCredito: "Compro sin crédito",
  volver: "Volver a mis deptos",
  errores: {
    tipo: "Sube un PDF o una foto (JPG, PNG, WEBP o HEIC).",
    tamano: "El archivo pesa más de 15 MB. Prueba con una foto o un PDF más liviano.",
    falta: "Elige el archivo de tu preaprobación.",
    red: "No pudimos subirla. Revisa tu conexión e inténtalo de nuevo.",
  },
  // El bloque del perfil (lámina 3.1-perfil-paso2-con-preaprobacion).
  perfilT: "Sube tu preaprobación",
  perfilS: "Foto o PDF. Puedes subirla ahora o después.",
  perfilListo: "Recibimos tu preaprobación. La revisamos hoy.",
  perfilPorQue: "Por qué te la pedimos.",
} as const;

/** Los estados de la tarjeta (lámina 3.4-preaprobacion-estados; la persona ve uno solo). */
export const ESTADOS_COPY = {
  en_revision: { chip: "En revisión", titulo: "Recibimos tu preaprobación", texto: "La revisamos hoy. Mientras, puedes seguir viendo tus deptos.", ver: "Ver lo que subí" },
  aprobada: { chip: "✓ Aprobada", titulo: "Ya puedes ofertar o pedir visita", ver: "Ver mi preaprobación" },
  // Con la aprobada vigente, la que subió después (20-nov-2026): aparte, con su motivo; la aprobada sigue mandando.
  otraRechazada: "La que subiste después no la pudimos usar",
  otraEnRevision: "Estamos revisando la que subiste después",
  por_corregir: { chip: "Te toca a ti", titulo: "Necesitamos que la subas de nuevo", boton: "Subir otra" },
  // Sin lámina: los proponemos con la misma forma (esperan el OK de Fabrizio).
  sin_credito: { chip: "✓ Listo", titulo: "Compras sin crédito", texto: "Ya puedes ofertar o pedir visita. Si después pides un crédito, súbela aquí." },
  explicando: { chip: "Franco está en eso", titulo: "Te explicamos cómo pedirla", texto: "Una persona de Franco te va a escribir por WhatsApp para contarte cómo pedirla a tu banco. Cuando la tengas, súbela aquí." },
} as const;

/** «Banco Estado · crédito hasta UF 2.600 · vigente hasta el 15 de febrero.» */
export function lineaAprobada(d: { banco: string | null; montoUF: number | null; vigenteHasta: string | null }): string {
  const partes = [d.banco ? `Banco ${d.banco.replace(/^banco\s+/i, "")}` : null, d.montoUF ? `crédito hasta UF ${fmtUF(d.montoUF)}` : null, d.vigenteHasta ? `vigente hasta el ${diaMes(d.vigenteHasta)}` : null].filter(Boolean);
  return partes.length ? `${partes.join(" · ")}.` : "";
}

/** «Lo que te toca hoy» en la base (20-nov-2026, Fabrizio):
 *  · sin nada vigente: «Sube tu preaprobación…» y el botón rojo;
 *  · CADA VEZ que sube una (también la primera, y aunque tenga una aprobada vigente): «Tu preaprobación está en revisión», el chip
 *    «Franco está en eso», «Te avisamos apenas la revisemos» y «Ver lo que subí», sin botón rojo, hasta que se apruebe o se corrija;
 *  · por corregir: el chip «Por corregir», el motivo que escribió la persona de Franco (como mensaje de Franco) y «Subir otra». */
export type TeTocaHoy =
  | { tipo: "subir"; titulo: string; boton: string }
  | { tipo: "revision"; titulo: string; chip: string; linea: string; ver: string }
  | { tipo: "corregir"; titulo: string; chip: string; motivo: string | null; boton: string };
export const TE_TOCA_COPY = {
  revision: { titulo: "Tu preaprobación está en revisión", chip: "Franco está en eso", linea: "Te avisamos apenas la revisemos", ver: "Ver lo que subí" },
  corregir: { titulo: "Sube de nuevo tu preaprobación para ofertar o visitar", chip: "Por corregir" },
  mensajeDeFranco: "Franco",
} as const;
export function teTocaHoy(e: EstadoVisible, otra: { estado: string } | null = null, motivo: string | null = null): TeTocaHoy | null {
  if (e === "en_revision" || otra?.estado === "en_revision") return { tipo: "revision", ...TE_TOCA_COPY.revision };
  if (e === "subir") return { tipo: "subir", titulo: "Sube tu preaprobación para ofertar o visitar", boton: PREAPROB_COPY.subir };
  if (e === "por_corregir") return { tipo: "corregir", ...TE_TOCA_COPY.corregir, motivo: motivo?.trim() || null, boton: ESTADOS_COPY.por_corregir.boton };
  return null;
}

/** Bajo el título de la base (20-nov-2026, Fabrizio): hasta cuánto puede comprar, porque después de elegir ya no vuelve al resultado.
 *  Con la preaprobación aprobada, según esa preaprobación (con «Ver»); si no, la estimación, «Sujeto a evaluación del banco». */
export function lineaCapacidad(p: { topeUF: number | null; aprobada: { banco: string | null; vigenteHasta: string | null } | null }): string | null {
  if (!p.topeUF) return null;
  if (p.aprobada) {
    const banco = p.aprobada.banco ? ` de Banco ${p.aprobada.banco.replace(/^banco\s+/i, "")}` : "";
    const hasta = p.aprobada.vigenteHasta ? `, vigente hasta el ${diaMes(p.aprobada.vigenteHasta)}` : "";
    return `Puedes comprar hasta UF ${fmtUF(p.topeUF)}, según tu preaprobación${banco}${hasta}.`;
  }
  return `Estimamos que puedes comprar hasta UF ${fmtUF(p.topeUF)}. Sujeto a evaluación del banco.`;
}
export const TE_TOCA_ROTULO = "Lo que te toca hoy";

// ── EL NOMBRE ────────────────────────────────────────────────────────────────
/** Palabras del nombre, sin tildes ni mayúsculas. */
const palabras = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-zñ\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);

/** ¿El nombre del documento es el de la orden? Coincide si comparten el primer nombre y al menos un apellido (los bancos a veces
 *  ponen solo un apellido o el orden distinto). Lo decide el servidor, no la IA: la IA solo transcribe el nombre. */
export function nombreCoincide(delDocumento: string | null | undefined, deLaOrden: string): boolean | null {
  if (!delDocumento?.trim()) return null;
  const a = palabras(delDocumento), b = palabras(deLaOrden);
  if (!a.length || !b.length) return null;
  const comunes = a.filter((w) => b.includes(w));
  return comunes.includes(b[0]) && comunes.length >= 2;
}

// ── LA REVISIÓN (admin) ──────────────────────────────────────────────────────
export interface Aprobacion { banco: string; montoUF: number; vigenteHasta: string }
export function validarAprobacion(x: Record<string, unknown> | null): { ok: true; a: Aprobacion } | { ok: false; error: "banco" | "monto" | "vigencia" } {
  const banco = typeof x?.banco === "string" ? x.banco.trim() : "";
  if (banco.length < 2 || banco.length > 80) return { ok: false, error: "banco" };
  const montoUF = typeof x?.montoUF === "number" ? x.montoUF : Number(x?.montoUF);
  if (!Number.isFinite(montoUF) || montoUF < 100 || montoUF > 100000) return { ok: false, error: "monto" };
  const v = typeof x?.vigenteHasta === "string" ? x.vigenteHasta : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return { ok: false, error: "vigencia" };
  return { ok: true, a: { banco, montoUF: Math.round(montoUF), vigenteHasta: v } };
}
export const validarMotivo = (x: unknown): string | null => (typeof x === "string" && x.trim().length >= 10 && x.trim().length <= 300 ? x.trim() : null);

// ── LOS CORREOS (cuando se aprueba o hay que corregir) ───────────────────────
export const CORREO_PREAPROB = {
  aprobada: {
    asunto: "Tu preaprobación está aprobada",
    parrafo: (d: Parameters<typeof lineaAprobada>[0]) => `${lineaAprobada(d).replace(/\.$/, "")}. Ya puedes ofertar o pedir visita en tus deptos.`,
    boton: "Ver mi inversión",
  },
  por_corregir: {
    asunto: "Necesitamos que subas de nuevo tu preaprobación",
    parrafo: (motivo: string) => motivo.replace(/([^.!?])$/, "$1."),
    boton: "Subir otra",
  },
} as const;
