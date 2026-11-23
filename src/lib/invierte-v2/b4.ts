// ─────────────────────────────────────────────────────────────────────────────
// B4 · PRESENTAR Y RESPONDER (etapa 3, 23-nov-2026; láminas 4.2-estados-despues-de-firmar, 5.2-responder-la-contraoferta y
// 4.2-cuando-no-hay-acuerdo, y las decisiones de Fabrizio del LEEME y de su respuesta a la FASE 0). Lo puro: las fechas de la vigencia,
// lo que sugiere Franco en una contraoferta, qué oferta cuenta como viva y los textos. Sin base ni red: lo lee también el navegador.
//   · Vigencia: días de calendario, hora de Santiago. Vence al terminar el día de la presentación más 5 (presentada el lunes 23, vence
//     al terminar el sábado 28, sin importar la hora). En pantalla: «Vence el sábado 28» y «quedan 4 días»; el último día, «Vence hoy».
//   · La tarea de insistir sale al empezar el tercer día después de la presentación.
//   · Franco sugiere (decisión 3): si la contraoferta cae dentro o bajo el borde alto del rango recomendado, aceptar; si queda encima, el
//     punto medio entre la oferta de la persona y la contraoferta, con tope en el borde alto (en un Ajusta supuestos, el precio al que
//     vuelve a Comprar). Nunca menos que la oferta anterior de la persona. Es un cálculo que se muestra: el admin lo puede corregir.
//   · Una a la vez (decisión de Fabrizio, punto 8): firmada, en cola, presentada, contraoferta y aceptada cuentan como vivas.
// La IA no presenta, no acepta ni firma nada: cada paso de la oferta lo hace una persona.
// ─────────────────────────────────────────────────────────────────────────────

export const TZ_CHILE = "America/Santiago";
export const VIGENCIA_DIAS = 5;
/** La tarea de insistir: al empezar este día contado desde la presentación (el día de la presentación es el 0). */
export const DIA_INSISTIR = 3;
export const REGLA_SUGERENCIA = "s1";

/** Las que cuentan como vivas para «una a la vez»: con cualquiera de estas en otro depto, la nueva queda en cola. */
export const OFERTAS_VIVAS = ["firmada", "en_cola", "presentada", "contraoferta", "aceptada_sujeta"] as const;
/** Desde dónde se puede retirar (decisión 9 y punto 12): hasta antes de «Oferta en firme». */
export const RETIRABLES = ["firmada", "en_cola", "presentada", "contraoferta", "aceptada_sujeta"] as const;
export const esRetirable = (estado: string) => (RETIRABLES as readonly string[]).includes(estado);

/** La fecha de un instante en Santiago: año, mes (1-12) y día. */
export function fechaChile(d: Date): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CHILE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: v("year"), m: v("month"), d: v("day") };
}

/** Los minutos que Santiago va adelante de UTC en ese instante (−180 en verano, −240 en invierno). */
function desfaseChile(instante: number): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ_CHILE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(instante));
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return (Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - instante) / 60000;
}

/** La medianoche de Santiago que abre ese día (y, m 1-12, d; un d fuera de rango se corre al mes que corresponde). */
export function medianocheChile(y: number, m: number, d: number): Date {
  const ingenuo = Date.UTC(y, m - 1, d, 0, 0);
  let t = ingenuo - desfaseChile(ingenuo) * 60000;
  t = ingenuo - desfaseChile(t) * 60000;
  return new Date(t);
}

/** EL VENCIMIENTO: al terminar el día de la presentación más VIGENCIA_DIAS (la medianoche siguiente, en Santiago). */
export function venceAlTerminar(presentadaAt: Date, dias = VIGENCIA_DIAS): Date {
  const f = fechaChile(presentadaAt);
  return medianocheChile(f.y, f.m, f.d + dias + 1);
}

/** La tarea de insistir: al empezar el tercer día después de la presentación. */
export function insistirDesde(presentadaAt: Date): Date {
  const f = fechaChile(presentadaAt);
  return medianocheChile(f.y, f.m, f.d + DIA_INSISTIR);
}

/** El último día en que vale (el día que vence), como fecha de Santiago. */
export function ultimoDia(venceAt: Date): Date {
  return new Date(venceAt.getTime() - 60 * 60 * 1000);
}

const DIA_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const diaSemana = (d: Date) => { const f = fechaChile(d); return DIA_SEMANA[new Date(Date.UTC(f.y, f.m - 1, f.d)).getUTCDay()]; };

/** Días de calendario (Santiago) de `desde` a `hasta`. */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = fechaChile(desde), b = fechaChile(hasta);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 864e5);
}

/** «Vence el sábado 28» · «quedan 4 días» · el último día, «Vence hoy». `vencida` si ya pasó. */
export function lineaVence(venceAt: Date, ahora: Date = new Date()): { vence: string; quedan: string | null; vencida: boolean } {
  if (ahora.getTime() >= venceAt.getTime()) return { vence: "Venció", quedan: null, vencida: true };
  const ultimo = ultimoDia(venceAt);
  const n = diasEntre(ahora, ultimo);
  if (n <= 0) return { vence: "Vence hoy", quedan: null, vencida: false };
  return { vence: `Vence el ${diaSemana(ultimo)} ${fechaChile(ultimo).d}`, quedan: n === 1 ? "queda 1 día" : `quedan ${n} días`, vencida: false };
}

/** «vence al terminar el sábado 28» (el panel del admin, 24-nov-2026: no «29 nov 12:00 a. m.»). */
export function venceAlTerminarTexto(venceAt: Date): string {
  const ultimo = ultimoDia(venceAt);
  return `vence al terminar el ${diaSemana(ultimo)} ${fechaChile(ultimo).d}`;
}

/** EL MOTIVO DE UN ERROR DEL PANEL DE LA OFERTA, EN UNA LÍNEA (24-nov-2026): nunca «No se guardó» a secas. */
export const MOTIVOS_ADMIN_OFERTA: Record<string, string> = {
  datos: "Falta la oferta o un dato del pedido.",
  accion: "Esa acción no existe para la oferta.",
  oferta: "No se encontró la oferta.",
  estado: "La oferta ya no está en el estado que permite esto (recarga la página).",
  monto: "Revisa el monto: una contraoferta va sobre la oferta de la persona; Franco sugiere entre su oferta y lo que piden.",
  fecha: "Revisa la fecha de vencimiento: de hoy en adelante, o vacía para 5 días.",
  guardar: "La base no guardó el cambio (quedó en Sentry).",
  vencida: "Lo que se responde ya venció.",
  produccion: "Esto solo se puede en el preview, no en producción.",
  no_es_prueba: "Esto solo se puede con ofertas de prueba.",
  excepcion: "Falló algo inesperado en el servidor (quedó en Sentry).",
  red: "No hubo respuesta del servidor: revisa la conexión y vuelve a intentar.",
  // Los de la persona (no llegan al panel, pero ningún código queda sin texto).
  depto: "No se encontró el depto de la persona.",
  casilla: "Falta la casilla de la firma.",
  etapa: "El depto no está listo para ofertar.",
  preaprobacion: "La preaprobación no deja ofertar.",
  orden: "La persona no tiene la orden firmada.",
  otra_viva: "La persona tiene otra oferta viva: tiene que elegir con cuál se queda.",
};
export const motivoAdminOferta = (codigo: string | null | undefined) => MOTIVOS_ADMIN_OFERTA[codigo ?? ""] ?? `No se guardó: ${codigo ?? "motivo desconocido"} (quedó en Sentry).`;

/** Por qué no salió un correo de B4, en palabras para el panel. */
export function motivoCorreoOferta(m: string | null | undefined): string {
  if (!m) return "salió";
  if (m === "sin-llave") return "no salió: este entorno no tiene la llave de Resend";
  if (m === "bloqueo:cuenta-de-prueba") return "no salió: es una cuenta de prueba sin «recibe correos»";
  if (m === "bloqueo:dominio-propio") return "no salió: es una dirección de @refranco.ai que no es un buzón";
  if (m === "fuera-de-la-lista") return "no salió: la cuenta no está en la lista";
  if (m === "baja") return "no salió: la persona se dio de baja";
  if (m === "eliminacion") return "no salió: la cuenta pidió eliminarse";
  if (m === "sin-correo") return "no salió: la cuenta no tiene correo";
  return `no salió: ${m}`;
}

/** «sáb 28 nov» (la fecha corta de la lámina). */
export function fechaCorta(d: Date): string {
  const f = fechaChile(d);
  return `${diaSemana(d).slice(0, 3)} ${f.d} ${MES[f.m - 1]}`;
}

/** La barra de la vigencia: cuánto del plazo pasó, entre 0 y 1. */
export function fraccionVigencia(presentadaAt: Date, venceAt: Date, ahora: Date = new Date()): number {
  const total = venceAt.getTime() - presentadaAt.getTime();
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, (ahora.getTime() - presentadaAt.getTime()) / total));
}

/** LO QUE SUGIERE FRANCO en una contraoferta (decisión 3). `altoUF`: el borde alto del rango recomendado; `comprarUF`: en un Ajusta
 *  supuestos, el precio al que vuelve a Comprar (es el tope). Devuelve el monto y si es aceptar su precio o proponer otro. */
export function sugerenciaFranco(p: { ofertaUF: number; contraofertaUF: number; altoUF: number; comprarUF?: number | null }): { montoUF: number; accion: "aceptar" | "proponer" } {
  if (p.contraofertaUF <= p.altoUF) return { montoUF: Math.round(p.contraofertaUF), accion: "aceptar" };
  const tope = p.comprarUF != null && p.comprarUF > 0 ? p.comprarUF : p.altoUF;
  const medio = Math.round((p.ofertaUF + p.contraofertaUF) / 2);
  const monto = Math.max(Math.round(p.ofertaUF), Math.min(medio, Math.round(tope)));
  return monto >= p.contraofertaUF ? { montoUF: Math.round(p.contraofertaUF), accion: "aceptar" } : { montoUF: monto, accion: "proponer" };
}

/** ¿Un monto corregido por el admin cabe? Entre la oferta de la persona y lo que piden (lo exige también la base). */
export const sugerenciaValida = (montoUF: number, ofertaUF: number, contraofertaUF: number) => Number.isFinite(montoUF) && montoUF >= ofertaUF && montoUF <= contraofertaUF;

/** Cómo terminó una oferta sin acuerdo, para la tarjeta (lámina 4.2-cuando-no-hay-acuerdo). */
export type Cierre = "rechazada" | "vencida" | "tardia" | "retirada" | "no_gracias";
export function cierreDe(o: { estado: string; sinAcuerdoMotivo?: string | null; respuestaTardia?: string | null; tardiaDecision?: string | null }): Cierre | null {
  if (o.estado === "retirada") return "retirada";
  if (o.estado !== "sin_acuerdo") return null;
  if (o.sinAcuerdoMotivo === "rechazada") return "rechazada";
  if (o.sinAcuerdoMotivo === "vencida") {
    if (o.respuestaTardia && o.tardiaDecision === "no_gracias") return "no_gracias";
    if (o.respuestaTardia && !o.tardiaDecision) return "tardia";
    return "vencida";
  }
  return null;
}

/** Los textos de B4 (las láminas, tal como están escritas). */
export const B4_COPY = {
  // Títulos de «Lo que sigue» en frase completa: qué está pasando y quién lo hace (LEEME del 23-nov, visita antes del precio).
  presentadaT: "Franco presentó tu oferta. Esperamos la respuesta",
  presentadaTxt: "te avisamos apenas respondan",
  firmadaT: "Franco va a presentar tu oferta a quien vende",
  firmadaTxt: "Va por escrito. Te avisamos apenas esté presentada.",
  rondaNuevaT: "Franco va a presentar tu nueva oferta a quien vende",
  enColaT: "Tu oferta quedó preparada",
  enColaTxt: "Franco la presenta cuando termine la oferta que tienes vigente. Nunca se presenta sola.",
  comunicarT: "Franco le está avisando a quien vende que aceptaste",
  comunicarTxt: "Le avisamos a quien vende que aceptas su precio. Sigue sujeta a tu visita.",
  tardiaContraT: (uf: string) => `Contraofertaron ${uf}, fuera de plazo`,
  aceptadaT: (uf: string) => `Aceptaron tu oferta: ${uf}`,
  aceptadaTxt: "Franco coordina la visita contigo. Tu oferta queda en firme después de la visita.",
  verMiOferta: "Ver mi oferta",
  retirarla: "Retirarla",
  responder: "Responder",
  retirarConfirmaT: "¿Retiras tu oferta?",
  retirarConfirma: "Franco le avisa a quien vende. Puedes hacer otra cuando quieras.",
  retirarSi: "Sí, retirarla",
  retirarNo: "No, mantenerla",
  // Cierres (lámina 4.2-cuando-no-hay-acuerdo).
  rechazadaT: "No aceptaron tu oferta",
  rechazadaTxt: "No hicieron contraoferta. Puedes hacer otra o dejar este depto.",
  vencidaT: "Tu oferta venció sin respuesta",
  vencidaTxt: "Quedaste libre para ofertar por otro depto.",
  contraVencidaT: "La contraoferta venció",
  contraVencidaTxt: "No alcanzaste a responderla. Quedaste libre para ofertar por otro depto.",
  tardiaT: (uf: string) => `Aceptaron ${uf}, fuera de plazo`,
  tardiaTxt: "Tu oferta ya había vencido, así que no te obliga. ¿Sigues interesado?",
  tardiaOtra: (depto: string) => `Ya tienes otra oferta viva por ${depto}. Si reactivas esta, esa se retira: sigue valiendo una a la vez.`,
  noGraciasT: "No seguiste con su respuesta",
  noGraciasTxt: "Respondieron fuera de plazo y les dijiste que no. Puedes hacer otra oferta cuando quieras.",
  retiradaT: "Retiraste tu oferta",
  retiradaTxt: "Franco le avisa a quien vende. Puedes hacer otra cuando quieras.",
  hacerOtra: "Hacer otra oferta",
  volverAPresentar: "Volver a presentarla",
  cambiarMonto: "Cambiar el monto",
  reactivar: "Sí, reactivar mi oferta",
  noGracias: "No, gracias",
  // Responder la contraoferta (lámina 5.2).
  piden: (uf: string) => `Piden ${uf}`,
  francoSugiere: "Franco sugiere",
  tu: "Tú",
  ellos: "Ellos",
  tuOferta: "Tu oferta",
  proponer: (uf: string) => `Proponer ${uf}`,
  aceptar: (uf: string) => `Aceptar ${uf}`,
  proponerOtro: "Proponer otro monto",
  noAceptar: "No aceptar la contraoferta",
  noAceptarConfirmaT: "¿No aceptas la contraoferta?",
  noAceptarConfirma: "Tu oferta se cierra y Franco le avisa a quien vende. El depto vuelve a «Haz tu oferta».",
  noAceptarSi: "Sí, no la acepto",
  firmaNota: "Un monto distinto al que firmaste se firma de nuevo. Sigue sujeta a tu visita.",
  fueraDePlazo: "Llegó fuera de plazo, tu oferta ya no te obliga.",
  porqueTope: (uf: string) => `Es el tope de lo que recomendamos para este depto. Su precio queda ${uf} arriba.`,
  porqueDentro: (uf: string) => `Está dentro de lo que recomendamos: ${uf} sobre tu oferta.`,
  porqueComprar: (uf: string) => `Sobre este precio el depto deja de convenir. Su precio queda ${uf} arriba.`,
  precio: "Precio",
} as const;
