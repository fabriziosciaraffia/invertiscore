// ─────────────────────────────────────────────────────────────────────────────
// Los correos de Franco, como funciones puras (29-sep-2026): cada una devuelve { subject, html } en
// la plantilla clara. `email.ts` solo los manda (con sus tags para el webhook de Resend); la página
// de previews (/dev/correos) y el tier CORREOS los renderizan sin red. Todo lo que viene de la
// persona (nombre, correo, motivo) pasa por escaparHtml.
// Copy en tuteo, voz de Franco. Lo que cambió respecto del correo oscuro va marcado «[REVISAR]» en
// el comentario de cada uno, para que Fabrizio lo revise.
// ─────────────────────────────────────────────────────────────────────────────
import { escaparHtml, LEGAL, plantillaClara, TINTA } from "./plantilla-clara";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { COMPARABLES_TEXTO } from "@/lib/stats";

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
      preencabezado: "Tu compra quedó a medio camino. Sin apuro: sigue ahí cuando quieras.",
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
      preencabezado: "Qué va a pasar con tu cuenta y tus datos.",
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
      preencabezado: `${p.email} pidió eliminar su cuenta.`,
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
      preencabezado: `${p.producto} · ${clp(p.monto)}`,
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
      preencabezado: `${p.estado} · ${p.producto} · ${clp(p.monto)}`,
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

/**
 * Alerta interna de un cron (29-sep-2026): a hola@ cuando una corrida falla en todo o en parte, o
 * cuando la vigilancia ve que un cron dejó de correr o de escribir lo que escribía.
 */
export function correoAlertaCron(p: { cron: string; problema: string; detalle: string[] }): Correo {
  const filas = [
    { etiqueta: "Cron", valor: escaparHtml(p.cron) },
    { etiqueta: "Qué pasó", valor: escaparHtml(p.problema) },
    ...p.detalle.map((d, i) => ({ etiqueta: i === 0 ? "Detalle" : "", valor: escaparHtml(d) })),
  ];
  return {
    subject: `🚨 Cron con problemas: ${p.cron}`,
    html: plantillaClara({
      titulo: "Cron con problemas",
      preencabezado: `${p.cron} · ${p.problema}`,
      titular: `El cron ${escaparHtml(p.cron)} necesita revisión`,
      parrafos: [],
      detalle: { filas },
      legal: "Aviso interno de Franco.",
    }),
  };
}

// ── «Quiero verlo» · el aviso a la persona (01-oct-2026) ──────────────────────
// Copy fijado por Fabrizio. Sale al tocar «Quiero verlo», después de chequear que el aviso siga
// publicado (src/lib/guia/quiero-verlo.ts). Sin titular: el saludo abre. Sin ofrecer ayuda con la
// visita ni con la negociación.
export function correoAvisoPedido(p: { nombre: string | null; comuna: string; url: string; veredicto: string | null; flujo: number | null }): Correo {
  const primero = (p.nombre ?? "").trim().split(/\s+/)[0] ?? "";
  const saludo = primero ? `Hola, ${escaparHtml(primero)}:` : "Hola:";
  const v = p.veredicto ? etiquetaVeredicto(p.veredicto, "frase") : null;
  const flujo = p.flujo != null ? `${p.flujo < 0 ? "−" : "+"}${clp(Math.abs(p.flujo))} al mes` : null;
  const analisis = v ? `Franco lo analizó con tu pie y tu plazo: ${[v, flujo].filter(Boolean).join(", ")}.` : null;
  return {
    subject: `El depto de ${p.comuna} que analizaste`,
    html: plantillaClara({
      titulo: `El depto de ${p.comuna} que analizaste`,
      preencabezado: "Acá está el aviso del depto que pediste.",
      parrafos: [saludo, "Acá está el aviso del depto que pediste."],
      boton: { texto: "Ver el aviso", url: escaparHtml(p.url) },
      despues: [
        ...(analisis ? [analisis] : []),
        "Antes de visitarlo, confirma con quien lo publica que sigue disponible y que el precio es el publicado.",
        "Franco",
      ],
    }),
  };
}

// ── Bienvenida ───────────────────────────────────────────────────────────────
// [REVISAR] sin la imagen del informe viejo (oscura, con prosa de IA y un gráfico de capital en
// pesos futuros). Sin «tu primer análisis es gratis»: este correo sale cuando la persona crea su
// primer análisis con sesión, y ese análisis ya usó el crédito de bienvenida. Los tres pasos van
// como frases, sin numerales en mono. Asunto nuevo: «Bienvenido a Franco».
export function correoBienvenida(p: { nombre: string | null; sitio?: string }): Correo {
  const sitio = p.sitio ?? SITIO;
  return {
    subject: "Bienvenido a Franco",
    html: plantillaClara({
      titulo: "Bienvenido a Franco",
      preencabezado: "Un veredicto claro para cada depto, con los números que tu cotización no muestra.",
      titular: "Bienvenido a Franco",
      parrafos: [
        `${saludoDe(p.nombre)} ingresas un depto y recibes un veredicto claro —Comprar, Ajustar o Buscar otro— con los números que tu cotización no muestra.`,
        `<b>Cómo funciona.</b> Pones la dirección, el precio y la superficie. Franco cruza tu depto con ${COMPARABLES_TEXTO} propiedades reales de la zona. Recibes el veredicto con su explicación: cuánto renta, cuánto pones cada mes y tu resultado a 10 años, en pesos de hoy.`,
      ],
      boton: { texto: "Analizar un depto", url: `${sitio}/analisis/nuevo-v4` },
    }),
  };
}

// ── Tu análisis está listo ───────────────────────────────────────────────────
// [REVISAR] sin la imagen /api/og/veredicto (oscura, del informe viejo, imprimía el resumen del
// motor «Es una buena oportunidad de inversión»): el veredicto y el score van en texto, que se lee
// con las imágenes bloqueadas. Sin «escenarios de salida» ni el rótulo en mono.
export function correoInformeListo(p: {
  nombre: string | null;
  titulo: string;
  score: number;
  veredicto: string;
  analysisId: string;
  ambas?: { ltrId: string; strId: string };
  sitio?: string;
}): Correo {
  const sitio = p.sitio ?? SITIO;
  const primero = (p.nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (p.ambas) {
    return {
      subject: "Tu comparativa está lista",
      html: plantillaClara({
        titulo: "Tu comparativa está lista",
        preencabezado: "Renta larga o renta corta: Franco ya tiene una posición.",
        titular: primero ? `${escaparHtml(primero)}, tu comparativa está lista` : "Tu comparativa está lista",
        parrafos: ["Franco corrió los dos escenarios sobre tu propiedad, arriendo tradicional y renta corta, y tiene una posición sobre cuál conviene."],
        boton: { texto: "Ver mi comparativa", url: `${sitio}/analisis/comparativa?ltr=${encodeURIComponent(p.ambas.ltrId)}&str=${encodeURIComponent(p.ambas.strId)}` },
      }),
    };
  }
  return {
    subject: `Tu análisis está listo — ${p.titulo}`,
    html: plantillaClara({
      titulo: "Tu análisis está listo",
      preencabezado: `${etiquetaVeredicto(p.veredicto, "frase", p.veredicto)} · Franco Score ${p.score}`,
      titular: primero ? `${escaparHtml(primero)}, tu análisis está listo` : "Tu análisis está listo",
      parrafos: ["Franco cruzó tu depto con datos reales de mercado. Este es el veredicto; el informe completo te espera en tu cuenta."],
      detalle: {
        filas: [
          { etiqueta: "Depto", valor: escaparHtml(p.titulo) },
          { etiqueta: "Veredicto", valor: etiquetaVeredicto(p.veredicto, "frase", p.veredicto) },
          { etiqueta: "Franco Score", valor: String(Math.round(p.score)) },
        ],
      },
      boton: { texto: "Ver mi análisis", url: `${sitio}/analisis/${encodeURIComponent(p.analysisId)}` },
    }),
  };
}

// ── Pago confirmado ──────────────────────────────────────────────────────────
// [REVISAR] el pack decía «1 análisis» (caía en la compra única): ahora dice la capacidad del
// producto (3). «Qué incluye» ya no promete «escenarios de salida (venta y refinanciamiento)»:
// dice lo que trae el informe de hoy. El detalle sin mono; el botón sin flecha.
export function correoPagoConfirmado(p: {
  nombre: string | null;
  producto: string;
  desbloquea: string;
  incluye: string[];
  monto: number;
  fecha: string;
  boton: { texto: string; url: string };
}): Correo {
  return {
    subject: `Pago confirmado — ${p.producto}`,
    html: plantillaClara({
      titulo: "Pago confirmado",
      preencabezado: `${p.producto} · ${clp(p.monto)}`,
      titular: "Pago confirmado",
      parrafos: [`${saludoDe(p.nombre)} ${p.desbloquea}`, `<b>Qué incluye.</b> ${p.incluye.map(escaparHtml).join(". ")}.`],
      detalle: {
        filas: [
          { etiqueta: "Producto", valor: escaparHtml(p.producto) },
          { etiqueta: "Monto", valor: clp(p.monto) },
          { etiqueta: "Fecha", valor: escaparHtml(p.fecha) },
        ],
      },
      boton: p.boton,
      legal: `Pago procesado de forma segura por Flow.cl. Este es un comprobante de tu compra.<br>${LEGAL}`,
    }),
  };
}

// ── Boleta electrónica ───────────────────────────────────────────────────────
// [REVISAR] un solo botón («Ver boleta»): la regla nueva es un botón por correo. Antes eran dos
// botones rojos iguales (excepción aprobada para replicar OpenFactura) que llevaban a la MISMA URL;
// la factura queda como frase con su enlace, a esa misma página.
export function correoBoleta(p: { para: string; folio: number | string; monto: number; fechaEmision: string; autoservicioUrl: string; concepto?: { label: string; frase: string }; sitio?: string }): Correo {
  const url = p.autoservicioUrl || (p.sitio ?? SITIO);
  const [y, m, d] = p.fechaEmision.split("-").map(Number);
  const fecha = !Number.isNaN(y) ? new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : p.fechaEmision;
  return {
    subject: `Tu boleta electrónica N° ${p.folio} — refranco.ai`,
    html: plantillaClara({
      titulo: "Tu boleta electrónica",
      preencabezado: `Boleta N° ${p.folio} por ${clp(p.monto)}, en PDF y XML.`,
      titular: "Tu boleta electrónica",
      parrafos: [`Acá está tu boleta por ${escaparHtml(p.concepto?.frase || "tu compra en Franco")}. La tienes adjunta en PDF y XML, y también puedes verla en línea.`],
      detalle: {
        filas: [
          { etiqueta: "Documento", valor: `Boleta electrónica N° ${escaparHtml(String(p.folio))}` },
          { etiqueta: "Concepto", valor: escaparHtml(p.concepto?.label || "Análisis") },
          { etiqueta: "Emitida", valor: escaparHtml(fecha) },
          { etiqueta: "Para", valor: escaparHtml(p.para) },
          { etiqueta: "Total", valor: clp(p.monto) },
        ],
      },
      boton: { texto: "Ver boleta", url },
      despues: [`¿Necesitas factura? ${enlace(url, "Ingresa tus datos de facturación")} y la generas en línea; eso deja sin efecto esta boleta.`],
      legal: `Documento tributario electrónico emitido ante el SII. Adjuntamos el PDF y el XML de tu boleta.<br>${LEGAL}`,
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
    preencabezado: "El enlace para elegir una contraseña nueva. Vale una hora.",
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
    preencabezado: "Confirma el cambio de correo de tu cuenta en Franco.",
    titular: "Confirma tu correo nuevo",
    parrafos: ["Pediste cambiar el correo de tu cuenta en Franco de {{ .Email }} a {{ .NewEmail }}. Confírmalo con el botón."],
    boton: { texto: "Confirmar el cambio", url: "{{ .ConfirmationURL }}" },
    despues: [`Si no lo pediste, no hagas nada y escríbenos a ${enlace("mailto:hola@refranco.ai", "hola@refranco.ai")}.`],
    legal: "Este es un correo sobre la seguridad de tu cuenta en Franco.",
  });
}
