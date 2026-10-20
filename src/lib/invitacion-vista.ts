// ─────────────────────────────────────────────────────────────────────────────
// LA VISITA A /i/CÓDIGO SE MIDE EN EL SERVIDOR (20-oct-2026, Fabrizio). Hasta hoy `invitacion_vista` salía del navegador,
// por la fachada de PostHog: el SDK carga recién con la página quieta (tras `load` y un rato ocioso, hasta 4 s), así que
// quien abre el enlace y se va antes no deja nada, y un navegador que no carga el SDK tampoco. Desde el lanzamiento hubo
// UNA en PostHog (un código de una cuenta de prueba). Ahora cada visita la emite la página al pintarse en el servidor,
// con el código, con o sin consentimiento, como los eventos propios de la landing:
//   · sin «si» (sin elección o «no»): un id de UNA visita y sin perfil de persona (`$process_person_profile: false`), como
//     PostHog en memoria en el navegador; nada que quede en el dispositivo;
//   · con «si»: el id de PostHog de su cookie, para que caiga en la misma persona que el resto de su navegación;
//   · con sesión: su cuenta.
// Sin IP ni geografía (la del servidor no dice nada). No cuentan los robots de las vistas previas (WhatsApp, Telegram, el
// rastreador de Meta…) ni lo que Next pide sin ser una carga de la página: el `router.refresh()` al registrarse vuelve a
// pedir /i/ y no es otra visita. `invitador_prueba` marca los enlaces de cuentas de prueba (el panel los saca).
// Puro: lo prueba el tier PUERTA-C §5; la página lo emite con `capturarServidor`.
// ─────────────────────────────────────────────────────────────────────────────
import { conPermiso, type Consentimiento } from "@/lib/consentimiento";
import type { EventoServidor } from "@/lib/posthog-servidor";

export const EVENTO_INVITACION_VISTA = "invitacion_vista";

export type ModoVisitaInvitacion = "invitado" | "propio" | "con_cuenta";

/** Robots de vistas previas, buscadores y clientes sin navegador. Sin agente, también. «…bot/», «…bot;» o «bot» suelto,
 *  no «bot» dentro de un modelo de teléfono (CUBOT). */
const ROBOT = /[a-z]bot[/;]|\bbot\b|adsbot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|slack|linkedin|skype|embedly|pinterest|vkshare|quora link preview|bitly|headless|lighthouse|pagespeed|inspectiontool|curl\/|wget|python|go-http-client|node-fetch|axios|okhttp|java\//i;

export function esRobot(agente: string | null | undefined): boolean {
  return !agente || ROBOT.test(agente);
}

/** ¿Es la carga de la página? No el refresco ni la navegación de Next (cabecera RSC), ni un prefetch. */
export function esCargaDePagina(h: { get(nombre: string): string | null }): boolean {
  if (h.get("rsc") !== null || h.get("next-router-prefetch") !== null) return false;
  if (h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) return false;
  const destino = h.get("sec-fetch-dest");
  return destino === null || destino === "document";
}

/** El id de PostHog que guarda su cookie (`ph_<key>_posthog`), si la hay. */
export function idPostHogDeCookies(cookies: ReadonlyArray<{ name: string; value: string }>, key: string | null | undefined): string | null {
  if (!key) return null;
  const c = cookies.find((x) => x.name === `ph_${key}_posthog`);
  if (!c) return null;
  try {
    const id = (JSON.parse(decodeURIComponent(c.value)) as { distinct_id?: unknown }).distinct_id;
    return typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null;
  } catch {
    return null;
  }
}

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
}): EventoServidor | null {
  if (!p.esCarga || esRobot(p.agente)) return null;
  const permiso = conPermiso(p.consentimiento);
  const conocida = p.userId ?? (permiso ? p.idPostHog : null);
  return {
    event: EVENTO_INVITACION_VISTA,
    distinctId: conocida ?? `visita:${p.visita}`,
    uuid: p.visita,
    properties: {
      codigo: p.codigo,
      valida: !!p.codigo,
      modo: p.modo,
      con_nombre: p.conNombre,
      invitador_prueba: p.invitadorPrueba,
      consentimiento: permiso ? "si" : "no",
      origen: "servidor",
      $pathname: p.ruta,
      $process_person_profile: !!conocida,
      $geoip_disable: true,
    },
  };
}
