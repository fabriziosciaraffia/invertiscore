// ─────────────────────────────────────────────────────────────────────────────
// LA VISITA A /i/CÓDIGO SE MIDE EN EL SERVIDOR (20-oct-2026, Fabrizio). Hasta ese día `invitacion_vista` salía del
// navegador, por la fachada de PostHog: el SDK carga recién con la página quieta (tras `load` y un rato ocioso, hasta 4 s),
// así que quien abre el enlace y se va antes no deja nada. Desde el lanzamiento hubo UNA en PostHog (un código de una cuenta
// de prueba). Ahora la emite la página al pintarse, con el código, con o sin consentimiento, como las otras páginas de
// entrada (vista-entrada.ts, donde viven las reglas comunes: el id, los UTM y el `fbclid`, los robots, el refresco de Next):
//   · sin «si» (sin elección o «no»): un id de esa visita y sin perfil de persona; con «si», el id de su cookie de PostHog;
//     con sesión, su cuenta. Sin IP ni geografía;
//   · `invitador_prueba` marca los enlaces de cuentas de prueba (el panel los saca).
// El id de la visita lo genera el middleware (cabecera `x-franco-visita`) y el navegador arranca PostHog con el mismo.
// Puro: lo prueban PUERTA-C §5 y VISTA-ENTRADA; la página lo emite con `capturarServidor`.
// ─────────────────────────────────────────────────────────────────────────────
import type { Consentimiento } from "@/lib/consentimiento";
import type { EventoServidor } from "@/lib/posthog-captura";
import { EVENTO_VISTA, eventoVistaEntrada } from "@/lib/vista-entrada";

export { esCargaDePagina, esRobot, idPostHogDeCookies } from "@/lib/vista-entrada";

export const EVENTO_INVITACION_VISTA = EVENTO_VISTA.invitacion;

export type ModoVisitaInvitacion = "invitado" | "propio" | "con_cuenta";

/** El evento de la visita, o null si no es una visita (un robot, un refresco de Next). */
export function eventoInvitacionVista(p: {
  codigo: string | null;
  /** La ruta tal como llegó: /i/LO-QUE-SEA, aunque el código no sea válido. */
  ruta: string;
  modo: ModoVisitaInvitacion;
  conNombre: boolean;
  invitadorPrueba: boolean;
  userId: string | null;
  consentimiento: Consentimiento | null;
  idPostHog: string | null;
  /** Un uuid por visita: su id cuando no se sabe quién es, y el del evento. */
  visita: string;
  esCarga: boolean;
  agente: string | null;
  /** La consulta de la URL (los UTM y el `fbclid`) y quién la refirió. */
  search?: string;
  referer?: string | null;
  /** Una visita de QA (modo prueba de la medición). */
  prueba?: boolean;
}): EventoServidor | null {
  return eventoVistaEntrada({
    pagina: "invitacion",
    ruta: p.ruta,
    search: p.search ?? "",
    referer: p.referer ?? null,
    userId: p.userId,
    consentimiento: p.consentimiento,
    idPostHog: p.idPostHog,
    visita: p.visita,
    esCarga: p.esCarga,
    agente: p.agente,
    prueba: p.prueba,
    extra: { codigo: p.codigo, valida: !!p.codigo, modo: p.modo, con_nombre: p.conNombre, invitador_prueba: p.invitadorPrueba },
  });
}
