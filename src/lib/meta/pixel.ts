/**
 * El Meta Pixel en el navegador, con COLA (15-oct-2026, medición para la campaña).
 *
 * El pixel carga cuando la página está quieta (MetaPixel.tsx, 28-sep-2026). Hasta el 15-oct un evento disparado
 * antes se perdía —`fbq` no existía y la llamada no hacía nada—: así se perdía siempre el `Subscribe` del retorno
 * del alta y podían perderse el `Purchase` y `StartFreeAnalysis`. Ahora todo evento entra a una cola guardada en
 * sessionStorage y sale cuando fbevents.js terminó de cargar (`metaPixelOperativo`); si la página navega antes, la
 * cola sobrevive y sale en la página siguiente. Nada se pierde.
 *
 * Cada evento sale con un `eventID` (el que trae, o uno nuevo): si una entrega se repite, Meta la junta. Y la cola
 * no acepta dos veces el mismo id.
 *
 * Las CUENTAS DE PRUEBA quedan fuera: con la marca `franco_cuenta_prueba` (la pone useAttributionSync con la misma
 * fuente del panel, `test_accounts`) el pixel no carga y la cola no recibe nada.
 *
 * `eventId` = clave de dedup compartida con la API de conversiones: el servidor manda el evento y le pasa al
 * navegador el mismo id (espejo.ts). Lo prueba el tier MEDICION-META.
 */
import { conPermiso, leerConsentimiento, type Consentimiento } from "@/lib/consentimiento";

type Fbq = ((comando: string, evento: string, datos?: Record<string, unknown>, opciones?: { eventID?: string }) => void) & {
  callMethod?: unknown;
};

/** Un evento esperando al pixel. */
export interface EventoEnCola {
  comando: "track" | "trackCustom";
  evento: string;
  datos?: Record<string, unknown>;
  eventId: string;
  /** Cuándo entró (ms). */
  t: number;
}

export const CLAVE_COLA = "franco_meta_cola";
/** Los ids que ya salieron en esta pestaña: el mismo evento no sale dos veces. */
export const CLAVE_ENVIADOS = "franco_meta_enviados";
/** La marca de cuenta de prueba (localStorage, por navegador). */
export const CLAVE_CUENTA_PRUEBA = "franco_cuenta_prueba";
/** Un evento que espera más que esto ya no describe lo que pasó: se descarta. */
export const VIDA_COLA_MS = 6 * 60 * 60 * 1000;
/** Tope de la cola y de la memoria de enviados. */
export const TOPE_COLA = 40;
const TOPE_ENVIADOS = 100;

function ventana(): (Window & { fbq?: Fbq }) | null {
  return typeof window === "undefined" ? null : (window as unknown as Window & { fbq?: Fbq });
}

function leer<T>(almacen: Storage | undefined, clave: string): T | null {
  try {
    const crudo = almacen?.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribir(almacen: Storage | undefined, clave: string, valor: unknown): void {
  try {
    almacen?.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin storage la cola vive solo en esta llamada */
  }
}

/** ¿Este navegador es de una cuenta de prueba? Entonces nada va a Meta. */
export function esCuentaDePruebaNavegador(): boolean {
  try {
    return ventana()?.localStorage?.getItem(CLAVE_CUENTA_PRUEBA) === "1";
  } catch {
    return false;
  }
}

/** La marca de cuenta de prueba; con `true` además vacía lo que esperaba. */
export function marcarCuentaDePrueba(esPrueba: boolean): void {
  const w = ventana();
  if (!w) return;
  try {
    w.localStorage?.setItem(CLAVE_CUENTA_PRUEBA, esPrueba ? "1" : "0");
    if (esPrueba) w.sessionStorage?.removeItem(CLAVE_COLA);
  } catch {
    /* sin storage no hay marca */
  }
}

/**
 * ¿`fbq` está OPERATIVO, o es todavía el stub que solo encola? El snippet de Meta define `window.fbq` como un stub
 * que hace `queue.push(arguments)`; `callMethod` recién aparece cuando fbevents.js terminó de cargar.
 */
export function metaPixelOperativo(): boolean {
  const fbq = ventana()?.fbq;
  return typeof fbq === "function" && typeof fbq.callMethod === "function";
}

function nuevoId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Los eventos que esperan (sin los vencidos). */
export function colaMeta(): EventoEnCola[] {
  const w = ventana();
  const ahora = Date.now();
  return (leer<EventoEnCola[]>(w?.sessionStorage, CLAVE_COLA) ?? []).filter((e) => e && typeof e.t === "number" && ahora - e.t < VIDA_COLA_MS);
}

/**
 * ¿Puede operar el pixel en este navegador? Solo con el «si» del aviso de cookies (19-oct-2026, lib/consentimiento.ts)
 * y fuera de las cuentas de prueba. Sin elección todavía, no: nada se guarda ni sale hasta que la persona acepta.
 */
export function pixelPermitido(c: Consentimiento | null, esPrueba: boolean): boolean {
  return conPermiso(c) && !esPrueba;
}

/** Encola un evento. Devuelve `false` si no entra: sin consentimiento, cuenta de prueba, sin navegador o id ya visto. */
export function encolarMeta(e: Omit<EventoEnCola, "t" | "eventId"> & { eventId?: string }): boolean {
  const w = ventana();
  if (!w || !pixelPermitido(leerConsentimiento(), esCuentaDePruebaNavegador())) return false;
  const eventId = e.eventId ?? nuevoId();
  const enviados = leer<string[]>(w.sessionStorage, CLAVE_ENVIADOS) ?? [];
  const cola = colaMeta();
  if (enviados.includes(eventId) || cola.some((x) => x.eventId === eventId)) return false;
  cola.push({ comando: e.comando, evento: e.evento, ...(e.datos ? { datos: e.datos } : {}), eventId, t: Date.now() });
  escribir(w.sessionStorage, CLAVE_COLA, cola.slice(-TOPE_COLA));
  return true;
}

/**
 * Entrega la cola al pixel, solo si ya está operativo: hasta entonces la cola espera guardada. Devuelve cuántos
 * salieron. La llama MetaPixel cuando el pixel carga, en cada navegación y cada poco rato.
 */
export function vaciarColaMeta(): number {
  const w = ventana();
  if (!w) return 0;
  if (!pixelPermitido(leerConsentimiento(), esCuentaDePruebaNavegador())) {
    try { w.sessionStorage?.removeItem(CLAVE_COLA); } catch { /* nada */ }
    return 0;
  }
  if (!metaPixelOperativo()) return 0;
  const cola = colaMeta();
  if (cola.length === 0) return 0;
  const enviados = leer<string[]>(w.sessionStorage, CLAVE_ENVIADOS) ?? [];
  let n = 0;
  for (const e of cola) {
    try {
      w.fbq!(e.comando, e.evento, e.datos, { eventID: e.eventId });
      enviados.push(e.eventId);
      n++;
    } catch {
      /* un evento roto no frena los demás */
    }
  }
  escribir(w.sessionStorage, CLAVE_ENVIADOS, enviados.slice(-TOPE_ENVIADOS));
  try { w.sessionStorage?.removeItem(CLAVE_COLA); } catch { /* nada */ }
  return n;
}

/**
 * Un evento estándar del pixel. Entra a la cola y sale apenas el pixel esté operativo. `PageView` no se guarda:
 * describe la página de ahora y MetaPixel lo dispara recién con el snippet listo.
 */
export function metaTrack(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  const w = ventana();
  if (!w || !pixelPermitido(leerConsentimiento(), esCuentaDePruebaNavegador())) return;
  if (eventName === "PageView") {
    if (typeof w.fbq === "function") w.fbq("track", "PageView");
    return;
  }
  if (encolarMeta({ comando: "track", evento: eventName, datos: params, eventId })) vaciarColaMeta();
}

/**
 * Un evento PROPIO (fuera del catálogo de Meta): sale con `trackCustom` —con `track` Meta lo descarta—. Devuelve si
 * quedó en camino (en la cola o entregado); `false` si no entra (cuenta de prueba, id repetido).
 */
export function metaTrackCustom(eventName: string, params?: Record<string, unknown>, eventId?: string): boolean {
  if (!encolarMeta({ comando: "trackCustom", evento: eventName, datos: params, eventId })) return false;
  vaciarColaMeta();
  return true;
}
