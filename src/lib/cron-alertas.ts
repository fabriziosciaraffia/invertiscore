/**
 * CUÁNDO AVISA UN CRON (15-oct-2026, reglas de Fabrizio). Las alertas avisan solo cuando hace falta una persona:
 *
 *   1. Una corrida fallida NO avisa si la siguiente se pone al día. Avisa si fallan DOS SEGUIDAS (una corrida que latió
 *      y no cerró cuenta como fallida), si se saltó dos corridas (atrasado) o si pasa más de un día sin ninguna corrida
 *      buena (en un cron diario, dos intervalos: la corrida siguiente tiene que alcanzar a ponerse al día).
 *   2. Lo que necesita una ACCIÓN —un token vencido, una variable que falta, una cuenta desactivada— avisa en el acto y
 *      UNA SOLA VEZ; el cron lo declara con `extra.accion` al cerrar.
 *   3. Lo que el sistema resolvió solo queda en el registro (`cron-resultado`, `cron_estado`) y en el panel, sin correo.
 *   4. Los crons que corren VARIAS VECES AL DÍA mandan a lo más un correo por día —el resumen de lo que quedó sin
 *      resolver al cierre, en la primera vigilancia del día siguiente—; los de una corrida al día, cuando pasa.
 *   5. Ninguna alerta se repite mientras dure el mismo episodio: lo ya avisado queda en `alertas` y sale de ahí solo
 *      cuando se resuelve; si vuelve a pasar después, vuelve a avisar.
 *
 * Puro: el estado vive en la tabla `cron_estado` (cron-estado.ts) y lo mueven `latirCron`, `cerrarCron` y la
 * vigilancia. Lo prueba el tier ALERTAS-CRONS.
 */

/** Lo que se sabe de un cron entre corridas. */
export interface EstadoCron {
  /** La última corrida que salió bien (ISO). null: ninguna desde que se lleva la cuenta. */
  ultimaBuena: string | null;
  /** Corridas fallidas seguidas, contando las que latieron y no cerraron. */
  fallasSeguidas: number;
  /** Latió y todavía no cierra (ISO): si sigue así pasado el margen, se colgó. */
  abiertaAt: string | null;
  /** La causa de la última falla, para el texto del aviso. */
  causa: string | null;
  /** Lo ya avisado en el episodio vigente: no se repite hasta que se resuelva. */
  alertas: string[];
}

export const ESTADO_INICIAL: EstadoCron = { ultimaBuena: null, fallasSeguidas: 0, abiertaAt: null, causa: null, alertas: [] };

/** Algo que necesita a una persona: un código estable (la causa) y lo que hay que hacer. */
export interface Accion {
  codigo: string;
  texto: string;
}

/** Un aviso: la condición (la clave con que no se repite) y la frase. */
export interface Aviso {
  clave: string;
  texto: string;
}

/** La marca del resumen del día de la vigilancia (metrics_daily, `cron-alerta`, con la fecha del día resumido). */
export const METRICA_RESUMEN = "resumen-diario";

/** Margen para dar por colgada una corrida que latió y no cerró: el maxDuration más largo es 800 s. */
export const MARGEN_CIERRE_MS = 20 * 60 * 1000;

/**
 * LOS CRONS DE VARIAS CORRIDAS AL DÍA (regla 4), según vercel.json: sus fallas esperan el resumen del día. El tier
 * ALERTAS-CRONS exige que esta lista sea exactamente la de los crons con más de una corrida en su día.
 */
export const CRONS_VARIAS_AL_DIA: ReadonlySet<string> = new Set([
  "scrape-unidades-nuevas", // 02, 08, 14 y 20 UTC
  "reconcile-subscriptions", // cada hora
  "evaluar-avisos", // 04:20 y 08:20
  "vigilar-crons", // cada 6 horas
  "semanal-prechequeo", // 03:35 a 08:35, de lunes a sábado
  "semanal-armar", // el domingo, de 11 a 23
  "semanal-reintento", // el lunes, de 08 a 11
  "semanal-enviar", // el lunes, 12:00 y 12:30
  "correo-del-dia", // cada 10 minutos (la cola de /deptos, 16-oct-2026)
]);

/** El cron que arma el resumen del día. */
export const VIGILANTE = "vigilar-crons";

/**
 * Si las fallas de un cron esperan el resumen del día (regla 4). El vigilante corre varias veces al día pero NO espera:
 * el resumen lo arma él, y si es él el que falla, ese resumen no llega nunca. Sus dos fallas seguidas avisan en el
 * acto, una vez por episodio.
 */
export function esperaResumen(nombre: string): boolean {
  return CRONS_VARIAS_AL_DIA.has(nombre) && nombre !== VIGILANTE;
}

/** Sin una corrida buena por más de esto, avisa (regla 1): un día, o dos intervalos si el cron corre cada día o menos. */
export function umbralSinBuenaHoras(intervaloHoras: number): number {
  return Math.max(24, 2 * intervaloHoras) + 1;
}

const horasEntre = (desde: string, ahora: Date) => (ahora.getTime() - new Date(desde).getTime()) / 3600e3;
const colgada = (e: EstadoCron, ahora: Date) => !!e.abiertaAt && ahora.getTime() - new Date(e.abiertaAt).getTime() > MARGEN_CIERRE_MS;

/** Al latir: si la corrida anterior quedó abierta pasado el margen, se colgó y cuenta como fallida. */
export function alLatir(e: EstadoCron, ahora: Date): EstadoCron {
  const anteriorColgada = colgada(e, ahora);
  return {
    ...e,
    fallasSeguidas: anteriorColgada ? e.fallasSeguidas + 1 : e.fallasSeguidas,
    causa: anteriorColgada ? "una corrida latió y no cerró (se colgó o se cortó por tiempo)" : e.causa,
    abiertaAt: ahora.toISOString(),
  };
}

/**
 * Al cerrar la corrida. Lo que necesita a una persona avisa en el acto, una vez por causa (regla 2). Una corrida buena
 * resuelve las fallas sin correo (regla 3). Un cron de UNA corrida al día avisa al fallar la segunda seguida; uno de
 * varias espera el resumen del día (regla 4).
 */
export function alCerrar(e: EstadoCron, c: { ok: boolean; causa: string | null; accion: Accion | null }, ahora: Date, variasAlDia: boolean): { estado: EstadoCron; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const claveAccion = c.accion ? `accion:${c.accion.codigo}` : null;
  // Una acción que esta corrida ya no declara se resolvió; la que declara avisa una sola vez.
  let alertas = e.alertas.filter((a) => !a.startsWith("accion:") || a === claveAccion);
  if (claveAccion && c.accion && !alertas.includes(claveAccion)) {
    alertas = [...alertas, claveAccion];
    avisos.push({ clave: claveAccion, texto: c.accion.texto });
  }
  if (c.ok) {
    alertas = alertas.filter((a) => a !== "fallas" && a !== "sin-buena" && a !== "atrasado");
    return { estado: { ...e, ultimaBuena: ahora.toISOString(), fallasSeguidas: 0, abiertaAt: null, causa: null, alertas }, avisos };
  }
  const fallas = e.fallasSeguidas + 1;
  const estado: EstadoCron = { ...e, fallasSeguidas: fallas, abiertaAt: null, causa: c.causa, alertas };
  // Con una acción declarada, el aviso de la acción ya cubre la falla: misma causa (regla 5).
  if (!claveAccion && !variasAlDia && fallas >= 2 && !alertas.includes("fallas")) {
    estado.alertas = [...alertas, "fallas"];
    avisos.push({ clave: "fallas", texto: textoFallas(fallas, c.causa) });
  }
  return { estado, avisos };
}

function textoFallas(n: number, causa: string | null): string {
  return `${n} corridas seguidas fallaron${causa ? `. La última: ${causa}` : ""}.`;
}

/** Lo que la vigilancia ve de un cron además de su estado (cron-heartbeat.ts › leerLatidos). */
export interface VistaCron {
  atrasado: boolean;
  textoAtrasado?: string | null;
  sinEscribir: boolean;
  textoSinEscribir?: string | null;
}

/** Las condiciones que hoy piden a una persona, con su frase (regla 1 y la frescura). */
export function condicionesDelCron(intervaloHoras: number, e: EstadoCron, v: VistaCron, ahora: Date): Aviso[] {
  const out: Aviso[] = [];
  const fallas = e.fallasSeguidas + (colgada(e, ahora) ? 1 : 0);
  if (fallas >= 2) out.push({ clave: "fallas", texto: textoFallas(fallas, colgada(e, ahora) ? "una corrida latió y no cerró (se colgó o se cortó por tiempo)" : e.causa) });
  if (v.atrasado) out.push({ clave: "atrasado", texto: v.textoAtrasado ?? "se saltó dos corridas seguidas" });
  // Un día sin una corrida buena, cuando no lo explica ya lo anterior (mismo episodio).
  if (fallas < 2 && !v.atrasado && e.ultimaBuena && horasEntre(e.ultimaBuena, ahora) > umbralSinBuenaHoras(intervaloHoras)) {
    out.push({ clave: "sin-buena", texto: `sin una corrida buena desde ${e.ultimaBuena.slice(0, 16).replace("T", " ")} UTC${e.causa ? `. La última falla: ${e.causa}` : ""}.` });
  }
  if (v.sinEscribir) out.push({ clave: "sin-escribir", texto: v.textoSinEscribir ?? "dejó de escribir su dato" });
  return out;
}

/**
 * La vigilancia: lo resuelto sale de `alertas` (vuelve a avisar si vuelve a pasar); lo nuevo avisa en el acto en un
 * cron de una corrida al día, o entra al resumen del día en uno de varias (solo en la vigilancia que lo arma). Las
 * acciones las maneja el cierre.
 */
export function alVigilar(e: EstadoCron, condiciones: Aviso[], variasAlDia: boolean, esResumen: boolean): { estado: EstadoCron; inmediatos: Aviso[]; resumen: Aviso[] } {
  const vigentes = new Set(condiciones.map((c) => c.clave));
  let alertas = e.alertas.filter((a) => a.startsWith("accion:") || vigentes.has(a));
  const nuevas = condiciones.filter((c) => !alertas.includes(c.clave));
  let inmediatos: Aviso[] = [];
  let resumen: Aviso[] = [];
  if (!variasAlDia) inmediatos = nuevas;
  else if (esResumen) resumen = nuevas;
  if (inmediatos.length || resumen.length) alertas = [...alertas, ...nuevas.map((c) => c.clave)];
  return { estado: { ...e, alertas }, inmediatos, resumen };
}

/** El bloqueo de la ficha (regla 1): solo si pasa un día sin una lectura buena mientras hay bloqueos. */
export function condicionBloqueo(p: { bloqueos24h: number; ultimaBuena: string | null }, ahora: Date): Aviso | null {
  if (p.bloqueos24h === 0) return null;
  if (p.ultimaBuena && horasEntre(p.ultimaBuena, ahora) <= 24) return null;
  return { clave: "bloqueo", texto: `La fuente bloquea la lectura de fichas y no hubo una lectura buena ${p.ultimaBuena ? `desde ${p.ultimaBuena.slice(0, 16).replace("T", " ")} UTC` : "en el registro"} (${p.bloqueos24h} bloqueos en 24 h). La guía muestra solo lo ya chequeado.` };
}
