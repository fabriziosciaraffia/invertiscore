// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de TODOS los correos de Franco (29-sep-2026), con datos de muestra: lo leen la página
// de previews (/dev/correos), el tier CORREOS y el script de envío real a la casilla de prueba, así
// los tres miran la misma lista. Un correo nuevo entra acá o el tier falla.
// `pendiente`: todavía no pasó a la plantilla clara porque espera una decisión de Fabrizio.
// ─────────────────────────────────────────────────────────────────────────────
import type { TipoCorreo } from "@/lib/medicion-correo";
import { correoAlertaCron, correoResumenCrons, correoAlertaPago, correoAlertaPagoFallido, correoBienvenida, correoBoleta, correoCheckoutAbandonado, correoEliminacionInterna, correoEliminacionUsuario, correoInformeListo, correoAvisoPedido, correoPagoConfirmado, correoPagoFallido, correoPlanAumento, correoPremioReferido, type Correo } from "./correos";
import { PLANTILLAS_SUPABASE } from "./supabase-plantillas";
import { correoRecordatorioPack } from "@/lib/lo-que-sigue/recordatorio";
import { correoSemanal, correoSemanalVacio, type DatosCorreoSemanal } from "./correo-semanal";
import { correoInmediato, correoPreguntaYa } from "./correo-inmediato";
import { PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";

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
/** Invita a alguien, en el pie del semanal (16-oct-2026, la puerta C). */
const INVITAR_MUESTRA = { url: `${SITIO}/i/K7M2QX`, texto: "refranco.ai/i/K7M2QX" };
// El correo semanal con datos de muestra: cuatro deptos, sin saldo (el botón compra el suelto).
const SEMANAL_MUESTRA = (variante: DatosCorreoSemanal["variante"], o: { saldo: number | null; conRegalo: boolean }): DatosCorreoSemanal => ({
  variante,
  nombre: "Camila",
  busca: "2 dormitorios, Ñuñoa y Macul, hasta UF 4.500",
  piePct: 20,
  plazoAnios: 30,
  deptos: [
    { comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 4290, veredicto: "COMPRAR", score: 82, flujo: 64000, url: `${SITIO}/semanal` },
    { comuna: "Ñuñoa", tipologia: "2D1B", m2: 52, precioUF: 3980, veredicto: "COMPRAR", score: 79, flujo: 21000, url: `${SITIO}/semanal` },
    { comuna: "Macul", tipologia: "2D2B", m2: 55, precioUF: 3650, veredicto: "COMPRAR", score: 77, flujo: -18000, url: `${SITIO}/semanal` },
    { comuna: "Macul", tipologia: "2D1B", m2: 50, precioUF: 3420, veredicto: "COMPRAR", score: 76, flujo: 9000, url: `${SITIO}/semanal` },
  ],
  saldo: o.saldo,
  conRegalo: o.conRegalo,
  urlBoton: `${SITIO}/semanal`,
  urlTres: `${SITIO}/checkout?product=tres_analisis&origen=semanal`,
  urlBaja: `${SITIO}/semanal/baja`,
});
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
  { id: "alerta_cron", tipo: "alerta_cron", nombre: "Cron con problemas (aviso interno)", cuando: "Solo cuando hace falta una persona (15-oct-2026): una acción (token vencido, variable que falta) en el acto y una vez; dos corridas seguidas fallidas, dos saltadas o un día sin una buena en un cron de una corrida al día; sin escribir su dato. A hola@, una vez por episodio", render: () => correoAlertaCron({ cron: "meta-ads", problema: "Meta rechazó el token de Meta Ads (code 190): hay que regenerar META_ADS_TOKEN.", detalle: [] }) },
  { id: "resumen_crons", tipo: "alerta_cron", nombre: "Crons sin resolver al cierre (resumen interno)", cuando: "Los crons de varias corridas al día: a lo más uno por día, en la primera vigilancia del día siguiente, con lo que quedó sin resolver al cierre. A hola@", render: () => correoResumenCrons({ fecha: "2026-10-14", items: [{ cron: "scrape-unidades-nuevas", texto: "2 corridas seguidas fallaron. La última: falla total: 26 de 26 proyectos con http 403." }] }) },
  { id: "alerta_pago_fallido", tipo: "alerta_pago_fallido", nombre: "Pago fallido (aviso interno)", cuando: "Flow rechaza o anula un pago, a hola@", render: () => correoAlertaPagoFallido({ estado: "Rechazado", producto: "1 análisis", monto: 9990, email: "persona@correo.cl", fecha: "29 de septiembre de 2026, 14:05", orden: "FR-SG-0002" }) },
  { id: "semanal_banda", tipo: "semanal", nombre: "Correo semanal · variante banda", cuando: "Los lunes, a quien tiene cuenta, con 3 a 5 deptos publicados que resultan con su perfil (sin saldo: compra el suelto)", render: () => correoSemanal({ ...SEMANAL_MUESTRA("banda", { saldo: 0, conRegalo: false }), invitar: INVITAR_MUESTRA }) },
  { id: "semanal_tarjetas", tipo: "semanal", nombre: "Correo semanal · variante tarjetas", cuando: "Los lunes, la otra mitad: sin banda, el titular en serif (con el regalo del día 14)", render: () => correoSemanal({ ...SEMANAL_MUESTRA("tarjetas", { saldo: 1, conRegalo: true }), regaloVence: "2026-12-01T15:00:00Z", invitar: INVITAR_MUESTRA }) },
  // Lo ya visto no ocupa lugar (19-oct-2026): cuando no alcanzan cinco nuevos, lo ya mandado o analizado completa al final, marcado.
  { id: "semanal_vistos", tipo: "semanal", nombre: "Correo semanal · con deptos ya vistos al final", cuando: "Cuando no alcanzan cinco nuevos: lo que ya se le mandó en las últimas 4 semanas o ya analizó completa al final, marcado", render: () => {
    const m = SEMANAL_MUESTRA("tarjetas", { saldo: 1, conRegalo: false });
    return correoSemanal({ ...m, invitar: INVITAR_MUESTRA, deptos: [
      ...m.deptos.slice(0, 3),
      { ...m.deptos[3], visto: "mandado" },
      { comuna: "Ñuñoa", tipologia: "2D2B", m2: 61, precioUF: 4450, veredicto: "COMPRAR", score: 75, flujo: 5000, url: `${SITIO}/semanal`, visto: "analizado" },
    ] });
  } },
  { id: "semanal_vacio", tipo: "semanal", nombre: "Correo semanal · sin deptos esta semana", cuando: "Los lunes, a quien no le quedó ningún depto confirmado (13-oct-2026): el correo corto con el enlace a su perfil (el primero se presenta)", render: () => correoSemanalVacio({ nombre: "Camila", presentacion: true, urlPerfil: `${SITIO}/dashboard#perfil`, urlBaja: `${SITIO}/semanal/baja`, invitar: INVITAR_MUESTRA,
    // Las salidas del 27-oct-2026 (casa/sin-oferta.ts), de mayor a menor, cada una con su ajuste en un toque.
    salidas: { linea: "Hasta UF 3.000, 810 sí. Con pie 30 %, 7. En Providencia, 4.", botones: [
      { boton: "Buscar hasta UF 3.000", url: `${SITIO}/api/semanal/clic?t=muestra&ir=ajustar&que=rango:hasta-3000` },
      { boton: "Buscar con pie 30 %", url: `${SITIO}/api/semanal/clic?t=muestra&ir=ajustar&que=pie30` },
      { boton: "Sumar Providencia a mi búsqueda", url: `${SITIO}/api/semanal/clic?t=muestra&ir=ajustar&que=comuna:Providencia` },
    ] } }) },
  // El correo del día (16-oct-2026, la puerta B): a la cuenta nueva de /deptos, dentro de la hora; es el semanal de esa semana.
  { id: "del_dia", tipo: "semanal", nombre: "Correo del día · los primeros deptos", cuando: "Dentro de la hora del registro por /deptos, a toda cuenta nueva: sus primeros deptos con la ficha chequeada, la hora en que Franco los vio publicados y el regalo (es el semanal de esa semana)", render: () => correoSemanal({ ...SEMANAL_MUESTRA("tarjetas", { saldo: 1, conRegalo: false }), plazoAnios: PLAZO_POR_DEFECTO, presentacion: true, delDia: { publicadosAl: "hoy a las 14:32" }, regaloAltaVence: "2026-11-15T15:00:00Z" }) },
  { id: "del_dia_vacio", tipo: "semanal", nombre: "Correo del día · sin deptos todavía", cuando: "Dentro de la hora del registro por /deptos, cuando ningún depto publicado convenía: «Te aviso cuando aparezca uno», con el regalo", render: () => correoSemanalVacio({ nombre: "Camila", presentacion: true, urlPerfil: `${SITIO}/dashboard#perfil`, urlBaja: `${SITIO}/semanal/baja`, delDia: true, regaloAltaVence: "2026-11-15T15:00:00Z" }) },
  { id: "aviso_inmediato", tipo: "aviso_inmediato", nombre: "Aviso inmediato", cuando: "El día que aparece un aviso nuevo que da Comprar con el perfil de quien dijo «Quiero comprar ya» y sigue publicado (uno por día; sin saldo: compra el suelto)", render: () => correoInmediato({ nombre: "Camila", busca: "2 dormitorios, Ñuñoa, hasta UF 4.500", piePct: 20, plazoAnios: 30, deptos: [SEMANAL_MUESTRA("tarjetas", { saldo: 0, conRegalo: false }).deptos[0]], saldo: 0, urlBoton: `${SITIO}/semanal`, urlComprar: `${SITIO}/checkout?product=single&origen=inmediato`, urlBaja: `${SITIO}/semanal/baja?tipo=inmediato` }) },
  { id: "pregunta_horizonte", tipo: "pregunta_horizonte", nombre: "¿Cuándo piensas comprar? (a los 60 días del «Quiero comprar ya»)", cuando: "A los 60 días de responder «Quiero comprar ya» sin comprar; sin respuesta, quedan solo el semanal", render: () => correoPreguntaYa({ nombre: "Camila", urlRespuesta: (h) => `${SITIO}/api/inmediato/horizonte?t=muestra&h=${h}` }) },
  { id: "premio_referido", tipo: "premio_referido", nombre: "Tu invitado entró: tienes un análisis más", cuando: "A quien invitó, cuando su invitado (cuenta nueva, otro dispositivo) contesta el «cuándo»: un análisis más vigente 60 días, hasta cinco por persona", render: () => correoPremioReferido({ nombre: "Camila", vence: "2026-12-15T15:00:00Z", pagados: 2, codigo: "K7M2QX" }) },
  { id: "plan_aumento", tipo: "plan_aumento", nombre: "Tu plan ahora trae 20 análisis al mes", cuando: "Una vez, a quien tenía el plan de 10: en el cobro de su renovación que le entrega el primer lote de 20, al mismo precio", render: () => correoPlanAumento({ nombre: "Camila", precio: "$39.990" }) },
  { id: "aviso_pedido", tipo: "aviso_pedido", nombre: "Quiero verlo: el aviso", cuando: "Alguien toca «Quiero verlo» en un informe que salió de la guía de búsqueda y el aviso sigue publicado", render: () => correoAvisoPedido({ nombre: "Camila Rojas", comuna: "Ñuñoa", url: "https://ejemplo.cl/aviso", veredicto: "COMPRAR", flujo: 12000 }) },
  ...PLANTILLAS_SUPABASE.map((p) => ({
    id: p.archivo.replace(/\.html$/, ""),
    tipo: "supabase" as const,
    nombre: `Supabase · ${p.donde}`,
    cuando: "Lo manda Supabase Auth con esta plantilla pegada en el panel",
    render: () => ({ subject: p.asunto.replace("{{ .Token }}", "482913"), html: p.html().replace(/\{\{ \.Token \}\}/g, "482913").replace(/\{\{ \.ConfirmationURL \}\}/g, `${SITIO}/auth/callback`).replace(/\{\{ \.Email \}\}/g, "antes@correo.cl").replace(/\{\{ \.NewEmail \}\}/g, "nuevo@correo.cl") }),
  })),
];
