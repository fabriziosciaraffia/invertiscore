// ─────────────────────────────────────────────────────────────────────────────
// Los correos de Franco, como funciones puras (29-sep-2026): cada una devuelve { subject, html } en
// la plantilla clara. `email.ts` solo los manda (con sus tags para el webhook de Resend); la página
// de previews (/dev/correos) y el tier CORREOS los renderizan sin red. Todo lo que viene de la
// persona (nombre, correo, motivo) pasa por escaparHtml.
// Copy en tuteo, voz de Franco. Lo que cambió respecto del correo oscuro va marcado «[REVISAR]» en
// el comentario de cada uno, para que Fabrizio lo revise.
// ─────────────────────────────────────────────────────────────────────────────
import { escaparHtml, plantillaClara, TINTA } from "./plantilla-clara";

export interface Correo {
  subject: string;
  html: string;
}

const SITIO = "https://refranco.ai";

export function saludoDe(nombre: string | null | undefined): string {
  const primero = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return primero ? `Hola ${escaparHtml(primero)},` : "Hola,";
}

const enlace = (url: string, texto: string) => `<a href="${url}" style="color: ${TINTA}; text-decoration: underline;">${texto}</a>`;

export const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

const fechaLarga = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });

// ── Cobro de suscripción rechazado ───────────────────────────────────────────
// [REVISAR] mismo contenido; «no pudimos procesar el cobro» → «no pudimos cobrar»; el aviso de
// la gracia va en la nota de tinta (antes, caja con filete rojo); el botón sin flecha.
export function correoPagoFallido(p: { nombre: string | null; graciaHasta: Date | string; sitio?: string }): Correo {
  const sitio = p.sitio ?? SITIO;
  return {
    subject: "Tu pago no se procesó — tienes unos días para actualizarlo",
    html: plantillaClara({
      titulo: "Tu pago no se procesó",
      preencabezado: `Mantienes tu acceso hasta el ${fechaLarga(p.graciaHasta)}.`,
      titular: "Tu pago no se procesó",
      parrafos: [`${saludoDe(p.nombre)} no pudimos cobrar tu suscripción. Suele ser algo simple: una tarjeta vencida, sin cupo o un rechazo del banco.`],
      nota: `Mantienes tu acceso hasta el <b>${fechaLarga(p.graciaHasta)}</b>. Reactiva tu suscripción antes de esa fecha para no perderlo.`,
      boton: { texto: "Reactivar mi suscripción", url: `${sitio}/pricing` },
      despues: ["Si no haces nada, tu cuenta vuelve al plan gratis y conservas los análisis que te queden."],
    }),
  };
}

// ── Carrito abandonado (single o plan; el pack no: vence y no vuelve) ────────
// [REVISAR] mismo copy; el botón sin flecha.
export function correoCheckoutAbandonado(p: { nombre: string | null; producto: string; tipo: "single" | "plan"; sitio?: string }): Correo {
  const sitio = p.sitio ?? SITIO;
  const producto = `<b>${escaparHtml(p.producto)}</b>`;
  const intro =
    p.tipo === "plan"
      ? `${saludoDe(p.nombre)} empezaste a suscribirte a ${producto} y no alcanzaste a terminar el pago. Sin apuro: tu plan sigue ahí cuando quieras retomarlo.`
      : `${saludoDe(p.nombre)} empezaste a comprar ${producto} y no alcanzaste a terminar el pago. Sin apuro: tu análisis sigue ahí cuando quieras retomarlo.`;
  return {
    subject: "¿Quedó algo pendiente?",
    html: plantillaClara({
      titulo: "¿Quedó algo pendiente?",
      titular: "¿Quedó algo pendiente?",
      parrafos: [intro, "Si tuviste algún problema con el pago o quieres preguntarnos algo antes de decidir, responde este correo. Franco es directo: no hay letra chica."],
      boton: { texto: "Retomar mi compra", url: `${sitio}/pricing` },
    }),
  };
}

// ── Eliminación de cuenta, a la persona ──────────────────────────────────────
// [REVISAR] el titular deja de ser el saludo («Hola X,») y pasa a «Recibimos tu solicitud»; el
// saludo abre el primer párrafo. Los dos rótulos en mono («QUÉ PASA AHORA», «¿FUE UN ERROR?») se
// vuelven frases en negrita. Sin botón: no hay una acción principal.
export function correoEliminacionUsuario(p: { nombre: string | null }): Correo {
  return {
    subject: "Recibimos tu solicitud de eliminación de cuenta",
    html: plantillaClara({
      titulo: "Recibimos tu solicitud de eliminación de cuenta",
      titular: "Recibimos tu solicitud",
      parrafos: [
        `${saludoDe(p.nombre)} recibimos tu solicitud para eliminar tu cuenta de Franco. Queremos que sepas exactamente qué va a pasar.`,
        "<b>Qué pasa ahora.</b> Vamos a eliminar de forma permanente tu cuenta y todos tus datos asociados: tus análisis, tu saldo disponible y tu información de perfil. Te confirmamos a este mismo correo cuando el proceso esté completo.",
        `<b>¿Fue un error?</b> Si no hiciste esta solicitud o cambiaste de opinión, escríbenos a ${enlace("mailto:hola@refranco.ai", "hola@refranco.ai")} lo antes posible. Una vez eliminada, la información no se puede recuperar.`,
      ],
      legal: "Este es un correo sobre la seguridad de tu cuenta en Franco.",
    }),
  };
}

// ── Eliminación de cuenta, aviso interno a hola@ ─────────────────────────────
// [REVISAR] el titular pierde el rojo; los ids y montos pierden el mono.
export function correoEliminacionInterna(p: { email: string; userId: string; solicitadaEl: string; analisis: number; creditos: number; motivo?: string }): Correo {
  return {
    subject: "Solicitud de eliminación de cuenta",
    html: plantillaClara({
      titulo: "Solicitud de eliminación de cuenta",
      titular: "Solicitud de eliminación de cuenta",
      parrafos: ["Un usuario pidió eliminar su cuenta. Procesa la baja y la eliminación de sus datos."],
      detalle: {
        titulo: "Datos del usuario",
        filas: [
          { etiqueta: "Correo", valor: escaparHtml(p.email) },
          { etiqueta: "User ID", valor: escaparHtml(p.userId) },
          { etiqueta: "Fecha de la solicitud", valor: escaparHtml(p.solicitadaEl) },
          { etiqueta: "Motivo", valor: p.motivo && p.motivo.trim() ? escaparHtml(p.motivo.trim()) : "No especificado" },
          { etiqueta: "Análisis creados", valor: String(p.analisis) },
          { etiqueta: "Créditos restantes", valor: String(p.creditos) },
        ],
      },
      legal: "Correo interno de Franco. Procesar la baja y la eliminación de datos según la política de retención.",
    }),
  };
}

// ── Avisos internos de pago (a hola@) ────────────────────────────────────────
// [REVISAR] antes salían directo con `new Resend` (sin tags ni evento) y en oscuro; ahora pasan por
// enviarCorreo. El estado del pago fallido pierde el rojo; los montos y la orden, el mono.
export function correoAlertaPago(p: { producto: string; monto: number; email: string; fecha: string; orden: string; analysisId?: string | null; sitio?: string }): Correo {
  const sitio = p.sitio ?? SITIO;
  const filas = [
    { etiqueta: "Producto", valor: escaparHtml(p.producto) },
    { etiqueta: "Monto", valor: clp(p.monto) },
    { etiqueta: "Correo", valor: escaparHtml(p.email) },
    { etiqueta: "Fecha", valor: escaparHtml(p.fecha) },
    { etiqueta: "Orden", valor: escaparHtml(p.orden) },
  ];
  if (p.analysisId) filas.push({ etiqueta: "Análisis", valor: enlace(`${sitio}/analisis/${encodeURIComponent(p.analysisId)}`, "Ver") });
  return {
    subject: `💰 Nuevo pago: ${p.producto} — ${clp(p.monto)}`,
    html: plantillaClara({
      titulo: "Nuevo pago confirmado",
      titular: "Nuevo pago confirmado",
      parrafos: [],
      detalle: { filas },
      legal: "Aviso interno de Franco.",
    }),
  };
}

export function correoAlertaPagoFallido(p: { estado: "Rechazado" | "Anulado"; producto: string; monto: number; email: string; fecha: string; orden: string }): Correo {
  return {
    subject: `⚠️ Pago fallido: ${p.producto} — ${clp(p.monto)}`,
    html: plantillaClara({
      titulo: "Pago fallido",
      titular: "Pago fallido",
      parrafos: [],
      detalle: {
        filas: [
          { etiqueta: "Estado", valor: p.estado },
          { etiqueta: "Producto", valor: escaparHtml(p.producto) },
          { etiqueta: "Monto", valor: clp(p.monto) },
          { etiqueta: "Correo", valor: escaparHtml(p.email) },
          { etiqueta: "Fecha", valor: escaparHtml(p.fecha) },
          { etiqueta: "Orden", valor: escaparHtml(p.orden) },
        ],
      },
      legal: "Aviso interno de Franco.",
    }),
  };
}

// ── Supabase Auth: restablecer contraseña y cambio de correo ─────────────────
// Se generan a docs/emails/ con scripts/emails/generar-supabase-codigo.ts y se pegan en el panel de
// Supabase. Llevan los marcadores de Supabase tal cual.
// [REVISAR] copy nuevo (hoy esas plantillas no se ven en el repo).
export function correoRestablecerSupabase(): string {
  return plantillaClara({
    titulo: "Restablece tu contraseña de Franco",
    titular: "Restablece tu contraseña",
    parrafos: ["Pediste cambiar la contraseña de tu cuenta en Franco. El enlace vale una hora."],
    boton: { texto: "Elegir una contraseña nueva", url: "{{ .ConfirmationURL }}" },
    despues: ["Si no lo pediste, no hagas nada: tu contraseña sigue igual."],
    legal: "Este es un correo sobre la seguridad de tu cuenta en Franco.",
  });
}

export function correoCambioCorreoSupabase(): string {
  return plantillaClara({
    titulo: "Confirma tu correo nuevo en Franco",
    titular: "Confirma tu correo nuevo",
    parrafos: ["Pediste cambiar el correo de tu cuenta en Franco de {{ .Email }} a {{ .NewEmail }}. Confírmalo con el botón."],
    boton: { texto: "Confirmar el cambio", url: "{{ .ConfirmationURL }}" },
    despues: [`Si no lo pediste, no hagas nada y escríbenos a ${enlace("mailto:hola@refranco.ai", "hola@refranco.ai")}.`],
    legal: "Este es un correo sobre la seguridad de tu cuenta en Franco.",
  });
}
