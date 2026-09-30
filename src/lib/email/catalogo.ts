// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de TODOS los correos de Franco (29-sep-2026), con datos de muestra: lo leen la página
// de previews (/dev/correos), el tier CORREOS y el script de envío real a la casilla de prueba, así
// los tres miran la misma lista. Un correo nuevo entra acá o el tier falla.
// `pendiente`: todavía no pasó a la plantilla clara porque espera una decisión de Fabrizio.
// ─────────────────────────────────────────────────────────────────────────────
import type { TipoCorreo } from "@/lib/medicion-correo";
import { correoAlertaCron, correoAlertaPago, correoAlertaPagoFallido, correoBienvenida, correoBoleta, correoCheckoutAbandonado, correoEliminacionInterna, correoEliminacionUsuario, correoInformeListo, correoInteresAviso, correoPagoConfirmado, correoPagoFallido, type Correo } from "./correos";
import { PLANTILLAS_SUPABASE } from "./supabase-plantillas";
import { correoRecordatorioPack } from "@/lib/lo-que-sigue/recordatorio";

export interface EntradaCatalogo {
  id: string;
  /** El tag `tipo` con que sale por Resend; «supabase» si lo manda Supabase Auth. */
  tipo: TipoCorreo | "supabase";
  nombre: string;
  cuando: string;
  /** El correo con datos de muestra, o null si todavía espera una decisión. */
  render: (() => Correo) | null;
  pendiente?: string;
}

const SITIO = "https://refranco.ai";
const ID_MUESTRA = "91736841-0dfe-45d5-ad10-6c710be7fb8f";
const EN_SIETE_DIAS = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

export const CATALOGO_CORREOS: EntradaCatalogo[] = [
  { id: "bienvenida", tipo: "bienvenida", nombre: "Bienvenida", cuando: "Primer análisis con sesión o primera visita al dashboard (una vez por persona)", render: () => correoBienvenida({ nombre: "Fabrizio Sciaraffia", sitio: SITIO }) },
  { id: "informe_listo", tipo: "informe_listo", nombre: "Tu análisis está listo", cuando: "Al crear un informe LTR con sesión", render: () => correoInformeListo({ nombre: "Fabrizio", titulo: "Depto 2D1B San Miguel", score: 79, veredicto: "COMPRAR", analysisId: ID_MUESTRA, sitio: SITIO }) },
  { id: "pago_confirmado", tipo: "pago_confirmado", nombre: "Pago confirmado", cuando: "Flow confirma un pago o se da de alta una suscripción", render: () => correoPagoConfirmado({ nombre: "Fabrizio", producto: "3 análisis", desbloquea: "tienes 3 análisis disponibles, sin caducidad, para usar cuando quieras.", incluye: ["El veredicto con su explicación", "Cuánto renta y cuánto pones cada mes", "Tu resultado a 10 años, en pesos de hoy"], monto: 14990, fecha: "29 de septiembre de 2026", boton: { texto: "Analizar un depto", url: `${SITIO}/analisis/nuevo-v4` } }) },
  { id: "boleta", tipo: "boleta", nombre: "Boleta electrónica", cuando: "Se emite la boleta en OpenFactura (single y pack)", render: () => correoBoleta({ para: "persona@correo.cl", folio: 22, monto: 9990, fechaEmision: "2026-09-29", autoservicioUrl: `${SITIO}/boleta-demo`, concepto: { label: "Análisis en San Miguel", frase: "tu análisis en San Miguel" }, sitio: SITIO }) },
  { id: "pago_fallido", tipo: "pago_fallido", nombre: "Cobro de suscripción rechazado", cuando: "Flow rechaza o anula el cobro de una suscripción", render: () => correoPagoFallido({ nombre: "Fabrizio Sciaraffia", graciaHasta: EN_SIETE_DIAS(), sitio: SITIO }) },
  { id: "checkout_abandonado", tipo: "checkout_abandonado", nombre: "Carrito abandonado", cuando: "Cron diario: un pago single o de plan quedó pendiente (el pack no)", render: () => correoCheckoutAbandonado({ nombre: "Fabrizio", producto: "Franco — 1 análisis", tipo: "single", sitio: SITIO }) },
  { id: "recordatorio_pack", tipo: "recordatorio_pack", nombre: "Recordatorio del pack", cuando: "Cron diario: pack pagado hace 3 días o más, sin usar", render: () => correoRecordatorioPack(SITIO, ID_MUESTRA) },
  { id: "eliminacion_usuario", tipo: "eliminacion_usuario", nombre: "Eliminación de cuenta (a la persona)", cuando: "La persona pide eliminar su cuenta", render: () => correoEliminacionUsuario({ nombre: "Fabrizio" }) },
  { id: "eliminacion_interna", tipo: "eliminacion_interna", nombre: "Eliminación de cuenta (aviso interno)", cuando: "Misma solicitud, a hola@", render: () => correoEliminacionInterna({ email: "persona@correo.cl", userId: "00000000-0000-0000-0000-000000000000", solicitadaEl: "29 de septiembre de 2026", analisis: 4, creditos: 2, motivo: "Ya compré" }) },
  { id: "alerta_pago", tipo: "alerta_pago", nombre: "Nuevo pago (aviso interno)", cuando: "Flow confirma un pago, a hola@", render: () => correoAlertaPago({ producto: "3 análisis", monto: 14990, email: "persona@correo.cl", fecha: "29 de septiembre de 2026, 14:05", orden: "FR-PK-0001", analysisId: ID_MUESTRA, sitio: SITIO }) },
  { id: "alerta_cron", tipo: "alerta_cron", nombre: "Cron con problemas (aviso interno)", cuando: "Un cron falla en todo o en parte, o deja de correr o de escribir, a hola@", render: () => correoAlertaCron({ cron: "scrape-unidades-nuevas", problema: "La corrida terminó con falla total: 155 de 155 fallaron.", detalle: ["proyecto 4347128: http 202 (desafío del WAF: sin proxy)"] }) },
  { id: "alerta_pago_fallido", tipo: "alerta_pago_fallido", nombre: "Pago fallido (aviso interno)", cuando: "Flow rechaza o anula un pago, a hola@", render: () => correoAlertaPagoFallido({ estado: "Rechazado", producto: "1 análisis", monto: 9990, email: "persona@correo.cl", fecha: "29 de septiembre de 2026, 14:05", orden: "FR-SG-0002" }) },
  { id: "interes_aviso", tipo: "interes_aviso", nombre: "Quiero verlo (aviso interno)", cuando: "Alguien toca «Quiero verlo» en un informe que salió de la guía de búsqueda, a hola@", render: () => correoInteresAviso({ persona: { nombre: "Camila Rojas", email: "persona@correo.cl", userId: "00000000-0000-0000-0000-000000000000" }, perfil: { piePct: 20, plazo: 25, tasa: 4.2, amoblado: false }, aviso: { comuna: "Ñuñoa", tipologia: "2D2B", m2: 57, precioUF: 3980, antiguedad: "2014 (ficha)", url: "https://ejemplo.cl/aviso", avisoId: "00000000-0000-0000-0000-000000000001" }, veredicto: { veredicto: "COMPRAR", score: 76, flujo: 12000 }, analysisId: ID_MUESTRA, origenAnalysisId: ID_MUESTRA, sitio: SITIO }) },
  ...PLANTILLAS_SUPABASE.map((p) => ({
    id: p.archivo.replace(/\.html$/, ""),
    tipo: "supabase" as const,
    nombre: `Supabase · ${p.donde}`,
    cuando: "Lo manda Supabase Auth con esta plantilla pegada en el panel",
    render: () => ({ subject: p.asunto.replace("{{ .Token }}", "482913"), html: p.html().replace(/\{\{ \.Token \}\}/g, "482913").replace(/\{\{ \.ConfirmationURL \}\}/g, `${SITIO}/auth/callback`).replace(/\{\{ \.Email \}\}/g, "antes@correo.cl").replace(/\{\{ \.NewEmail \}\}/g, "nuevo@correo.cl") }),
  })),
];
