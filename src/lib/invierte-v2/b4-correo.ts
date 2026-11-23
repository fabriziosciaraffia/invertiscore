// LOS AVISOS DE LA OFERTA A LA PERSONA (B4, 23-nov-2026; decisión 10 del LEEME): correo cuando se presenta, cuando responden y cuando
// vence, y cuando el precio publicado baja de su oferta (decisión 11). El botón lleva a /invierte si a la persona no le toca hacer nada
// (regla del 18-nov-2026: un correo sin acción puntual enlaza a /invierte); a responder la contraoferta o a su depto si le toca.
// Sin nombrar al corredor ni hablar de lo que gana Franco (decisión 12). Mientras el modo sea «lista», solo a las cuentas de la lista.
import { URL_INVIERTE } from "./destino";
import { urlContraoferta, urlDepto } from "./depto-flujo";

export const EVENTOS_OFERTA = ["presentada", "aceptada", "contraoferta", "rechazada", "tardia_aceptada", "tardia_contraoferta", "vencida", "contra_vencida", "precio_bajo"] as const;
export type EventoOferta = (typeof EVENTOS_OFERTA)[number];

const uf = (n: number | null | undefined) => (n == null ? "" : `UF ${Math.round(n).toLocaleString("es-CL")}`);
type Datos = { depto: string; montoUF: number; otroUF: number | null; vence: string | null };

export { urlContraoferta };

/** ¿Le toca hacer algo a la persona con este aviso? Si no, el botón va a /invierte. */
export const EVENTOS_CON_ACCION: readonly EventoOferta[] = ["contraoferta", "tardia_contraoferta", "rechazada", "tardia_aceptada", "vencida", "contra_vencida"];

export function urlCorreoOferta(evento: EventoOferta, avisoId: string): string {
  if (evento === "contraoferta" || evento === "tardia_contraoferta") return urlContraoferta(avisoId);
  if (EVENTOS_CON_ACCION.includes(evento)) return urlDepto(avisoId);
  return URL_INVIERTE;
}

export const CORREO_OFERTA: Record<EventoOferta, { asunto: string; boton: string; parrafo: (d: Datos) => string }> = {
  presentada: { asunto: "Franco presentó tu oferta", boton: "Ver mi inversión", parrafo: (d) => `Presentamos a quien vende tu oferta de ${uf(d.montoUF)} por ${d.depto}.${d.vence ? ` ${d.vence}.` : ""} Te avisamos apenas respondan.` },
  aceptada: { asunto: "Aceptaron tu oferta", boton: "Ver mi inversión", parrafo: (d) => `Quien vende aceptó tu oferta de ${uf(d.montoUF)} por ${d.depto}. Sigue sujeta a tu visita: Franco te escribe para coordinarla.` },
  contraoferta: { asunto: "Te hicieron una contraoferta", boton: "Responder", parrafo: (d) => `Quien vende respondió tu oferta de ${uf(d.montoUF)} por ${d.depto} con ${uf(d.otroUF)}.${d.vence ? ` ${d.vence}.` : ""}` },
  rechazada: { asunto: "No aceptaron tu oferta", boton: "Ver el depto", parrafo: (d) => `Quien vende no aceptó tu oferta de ${uf(d.montoUF)} por ${d.depto} y no hizo contraoferta. Puedes hacer otra o dejar este depto.` },
  tardia_aceptada: { asunto: "Aceptaron tu oferta, fuera de plazo", boton: "Ver el depto", parrafo: (d) => `Quien vende aceptó tu oferta de ${uf(d.montoUF)} por ${d.depto} después de que venció, así que no te obliga. Si sigues interesado, puedes reactivarla.` },
  tardia_contraoferta: { asunto: "Te hicieron una contraoferta, fuera de plazo", boton: "Responder", parrafo: (d) => `Quien vende respondió con ${uf(d.otroUF)} a tu oferta de ${uf(d.montoUF)} por ${d.depto} después de que venció, así que tu oferta no te obliga.${d.vence ? ` ${d.vence}.` : ""}` },
  vencida: { asunto: "Tu oferta venció", boton: "Ver el depto", parrafo: (d) => `Tu oferta de ${uf(d.montoUF)} por ${d.depto} venció sin respuesta. Quedaste libre para ofertar por otro depto o volver a presentarla.` },
  contra_vencida: { asunto: "La contraoferta venció", boton: "Ver el depto", parrafo: (d) => `La contraoferta de ${uf(d.otroUF)} por ${d.depto} venció sin respuesta. Quedaste libre para ofertar por otro depto o hacer otra oferta.` },
  precio_bajo: { asunto: "Bajó el precio de un depto con tu oferta", boton: "Ver mi inversión", parrafo: (d) => `El precio publicado de ${d.depto} bajó a ${uf(d.otroUF)}, por debajo de tu oferta de ${uf(d.montoUF)}. Franco te escribe para ver cómo seguir.` },
};

/** El texto del WhatsApp que Franco le manda a la persona cuando le toca actuar (decisión 10). */
export const WHATSAPP_OFERTA: Partial<Record<EventoOferta, (d: Datos) => string>> = {
  contraoferta: (d) => `Hola, soy Franco. Quien vende ${d.depto} respondió tu oferta de ${uf(d.montoUF)} con ${uf(d.otroUF)}. Puedes responder en tu inversión.`,
  aceptada: (d) => `Hola, soy Franco. Quien vende ${d.depto} aceptó tu oferta de ${uf(d.montoUF)}. Te escribo para coordinar la visita.`,
  tardia_aceptada: (d) => `Hola, soy Franco. Quien vende ${d.depto} aceptó tu oferta de ${uf(d.montoUF)} después de que venció, así que no te obliga. Si sigues interesado, puedes reactivarla en tu inversión.`,
  tardia_contraoferta: (d) => `Hola, soy Franco. Quien vende ${d.depto} respondió con ${uf(d.otroUF)} después de que venció tu oferta, así que no te obliga. Puedes responder en tu inversión.`,
};
