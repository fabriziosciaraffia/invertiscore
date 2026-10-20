// ─────────────────────────────────────────────────────────────────────────────
// EL CORREO DEL DÍA (16-oct-2026, decisiones de Fabrizio): quien se registra por /deptos recibe, dentro de la hora y
// cualquiera sea su «cuándo», sus primeros deptos con la ficha chequeada. DESDE EL 20-oct-2026 ES PARA TODA CUENTA NUEVA,
// POR CUALQUIER PUERTA (el banner del informe, el ticket, la guía, /deptos, la página del invitado, Google, el enlace del
// correo): la misma cola, las mismas reglas (encolarPrimeraSeleccion, del-dia-servidor.ts). Va EN COLA para no romper el cupo de lecturas
// de ficha (30 GETs por hora entre todos, publicacion.ts): cada vuelta lee lo que el cupo deja y, si se copa, la vuelta
// siguiente sigue. Pasados MINUTOS_CUPO_DEL_DIA sin poder chequear, sale con lo que el prechequeo de la noche (o otra
// lectura de la semana) vio publicado y lo dice con la hora: «publicados al [hora]». Ese correo ES el semanal de esa
// semana: el lunes siguiente va solo si hay nuevos (semanal.ts › queEnviarSemanal).
// Vive en `semanal_selecciones` con `tipo` = 'del_dia': mismo token, misma página /semanal, mismo clic. Puro: lo prueba el
// tier PUERTA-B; la escritura y el envío, del-dia-servidor.ts y el cron correo-del-dia.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReglaSemanal } from "./semanal";

/** Pasado esto sin cupo, sale con lo que ya se sabe publicado (la promesa es «dentro de la hora»). */
export const MINUTOS_CUPO_DEL_DIA = 45;
/** GETs que una vuelta se permite (tres chequeos), dentro del tope por hora compartido. */
export const LECTURAS_POR_VUELTA_DEL_DIA = 6;
/** Cuántas vueltas de la cola, como mucho: con la vuelta cada 10 minutos, una hora y algo. */
export const VUELTAS_MAX_DEL_DIA = 8;
/** El correo del día acepta menos de tres: son sus primeros deptos, y con uno ya hay valor. Con negociables, como el
 *  semanal de renta larga. */
export const REGLA_DEL_DIA: ReglaSemanal = { conNegociables: true, aceptarMenos: true };

export type PasoDelDia = "enviar" | "esperar" | "enviar_lo_visto";

/**
 * Qué hace una vuelta con la selección del día. Armada o sin coincidencias → sale. Pendiente (faltó cupo para chequear):
 * espera la vuelta siguiente, salvo que ya pasó la hora (o las vueltas): entonces sale con lo visto publicado.
 */
export function pasoDelDia(p: { estado: "armada" | "pendiente" | "sin_match"; minutos: number; vueltas: number }): PasoDelDia {
  if (p.estado !== "pendiente") return "enviar";
  return p.minutos >= MINUTOS_CUPO_DEL_DIA || p.vueltas >= VUELTAS_MAX_DEL_DIA ? "enviar_lo_visto" : "esperar";
}

const horaChile = (d: Date) => d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago" });
const diaChile = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

/** «hoy a las 03:12», «ayer a las 23:40», «el 14 de octubre a las 09:05»: cuándo se vio, en hora de Chile. */
export function cuandoSeVio(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const hoy = diaChile(ahora), ese = diaChile(d), ayer = diaChile(new Date(ahora.getTime() - 864e5));
  if (ese === hoy) return `hoy a las ${horaChile(d)}`;
  if (ese === ayer) return `ayer a las ${horaChile(d)}`;
  return `el ${d.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" })} a las ${horaChile(d)}`;
}

/** La marca de cada depto en «Estás dentro» y en el dashboard: «Visto publicado hoy a las 03:12». */
export function marcaVisto(iso: string, ahora: Date = new Date()): string {
  return `Visto publicado ${cuandoSeVio(iso, ahora)}`;
}

// ── LA PRIMERA SELECCIÓN EN PANTALLA (20-oct-2026, regla de producto de Fabrizio): quien se registra ve sus deptos ahí
// mismo y es llevado a analizar uno. No espera. Al terminar «Estás dentro», por cualquier puerta, la pantalla muestra sus
// primeros deptos de la evaluación de anoche con el perfil que tenga —el derivado del informe en la puerta A, el de los
// chips en B y C—, cada uno con «Analizar este», y arriba «Tienes un análisis de regalo: elige uno». En la puerta A esa
// pantalla aparece SOBRE el informe (una hoja), sin sacar a la persona de ahí. Si el perfil no alcanza, se le piden los
// chips que falten en un toque y se arma. Las reglas puras viven acá; las prueba el tier PRIMERA-SELECCION. ──

/** Una cuenta cuenta como NUEVA —se encola su correo del día y se le abre la primera selección— si nació hace menos de
 *  esto. Quien entra con una cuenta de antes por el mismo camino (el código del banner) no vuelve a nacer. */
export const MINUTOS_CUENTA_NUEVA = 60;

export function esCuentaNueva(creadaAt: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!creadaAt) return false;
  const t = Date.parse(creadaAt);
  if (!Number.isFinite(t)) return false;
  const edad = ahora.getTime() - t;
  return edad >= -60_000 && edad <= MINUTOS_CUENTA_NUEVA * 60_000;
}

/** El parámetro con que el callback le dice al informe que la persona acaba de entrar (Google, el enlace del correo). */
export const PARAM_RECIEN_DENTRO = "dentro";

/** El destino del callback: si la cuenta acaba de nacer y vuelve a un informe, con `?dentro=1`; si no, tal cual. */
export function destinoRecienDentro(dest: string, cuentaNueva: boolean): string {
  if (!cuentaNueva || !/^\/analisis\/[0-9a-f-]{36}(?:[/?#]|$)/i.test(dest)) return dest;
  const [ruta, hash = ""] = dest.split("#");
  const [camino, consulta = ""] = ruta.split("?");
  const q = new URLSearchParams(consulta);
  q.set(PARAM_RECIEN_DENTRO, "1");
  return `${camino}?${q.toString()}${hash ? `#${hash}` : ""}`;
}

/** La hoja sin deptos (20-oct-2026, Fabrizio): ni chips por pedir, ni revisando, ni un depto. Ahí la bajada —«Franco eligió
 *  estos deptos…»— no va encima de «no hay uno»: queda solo el texto de «ninguno». */
export function hojaSinDeptos(d: { faltan: readonly unknown[]; items: readonly unknown[]; revisando: boolean } | null): boolean {
  return !!d && d.faltan.length === 0 && d.items.length === 0 && !d.revisando;
}

export type FaltaDelPerfil = "comuna" | "tipologia" | "rango";

/** Qué chips faltan para armar una selección: al menos una comuna, un dormitorio y un tope de precio. */
export function faltanDelPerfil(p: { comunas: string[]; dormitorios: number[]; precioMaxUf: number | null }): FaltaDelPerfil[] {
  const f: FaltaDelPerfil[] = [];
  if (p.comunas.length === 0) f.push("comuna");
  if (p.dormitorios.length === 0) f.push("tipologia");
  if (p.precioMaxUf == null || p.precioMaxUf <= 0) f.push("rango");
  return f;
}

export const PRIMERA_SELECCION = {
  /** Arriba de todo, con el regalo vivo. */
  tituloRegalo: "Tienes un análisis de regalo: elige uno",
  /** Con el regalo vivo y sin deptos («ninguno», 20-oct-2026, Fabrizio): no hay qué elegir; el regalo queda guardado. */
  tituloRegaloGuardado: "Tienes un análisis de regalo guardado",
  /** Sin regalo (topó, o lo gastó): se elige igual. */
  titulo: "Tus primeros deptos: elige uno",
  /** Sin regalo y sin deptos («ninguno», 20-oct-2026, Fabrizio): no hay qué elegir. */
  tituloSinDeptos: "Tus primeros deptos",
  /** Bajo el título (20-oct-2026, texto de Fabrizio): sin «anoche» ni «el correo de esta hora». */
  bajada: "Franco eligió estos deptos para tu búsqueda, con tu pie y tu plazo. En unos minutos te llega al correo la selección confirmada.",
  /** Los otros estados de la hoja (20-oct-2026, Fabrizio), con el criterio de la bajada: su búsqueda, y la confirmación
   *  al correo en unos minutos —dicha UNA vez: con deptos la dice la bajada, así que la tarjeta no la repite—. El depto
   *  todavía sin ficha leída: */
  porConfirmar: "Elegido para tu búsqueda.",
  faltan: "Para armar tu selección falta un dato. Un toque y listo:",
  faltaComuna: "¿En qué comuna?",
  faltaTipologia: "¿Cuántos dormitorios?",
  faltaRango: "¿Hasta cuánto?",
  armar: "Ver mis deptos",
  /** Ninguno conviene (sin la bajada, `hojaSinDeptos`: lo del correo lo dice este texto): */
  ninguno: "Para tu búsqueda no hay uno publicado que convenga por ahora. En unos minutos te llega al correo la confirmación, y Franco te avisa en cuanto aparezca uno.",
  vecinas: "En tus comunas no hay uno hoy: estos son de comunas vecinas.",
  revisando: "Revisando uno por uno si siguen publicados…",
  cargando: "Buscando tus primeros deptos…",
  error: "No pudimos traer tus deptos. Intenta de nuevo.",
  reintentar: "Reintentar",
  /** La hoja sobre el informe (la puerta A). */
  seguirLeyendo: "Seguir leyendo el informe",
  verDeNuevo: "Ver mis primeros deptos",
  cerrar: "Cerrar",
} as const;

/** El título de la hoja (20-oct-2026): «elige uno» solo cuando hay qué elegir. Sin deptos, con el regalo vivo, el regalo
 *  queda guardado; sin regalo, «Tus primeros deptos» a secas. */
export function tituloHoja(p: { regalo: boolean; sinDeptos: boolean }): string {
  if (!p.regalo) return p.sinDeptos ? PRIMERA_SELECCION.tituloSinDeptos : PRIMERA_SELECCION.titulo;
  return p.sinDeptos ? PRIMERA_SELECCION.tituloRegaloGuardado : PRIMERA_SELECCION.tituloRegalo;
}

export const DEL_DIA = {
  asunto: "Tus primeros deptos, revisados hoy",
  titular: "Tus primeros deptos, revisados hoy",
  preencabezado: (n: number) => (n === 1 ? "El depto publicado que mejor resulta con lo que buscas." : `Los ${n} deptos publicados que mejor resultan con lo que buscas.`),
  introN: (n: number, busca: string, pie: string, plazo: number, negociar = 0) =>
    `Hoy, ${n === 1 ? "1 depto publicado" : `${n} deptos publicados`} como los que buscas —${busca}— ${n === 1 ? "resulta" : "resultan"} con un pie de ${pie}% y un plazo de ${plazo} años${
      negociar === 0 ? "" : negociar === 1 ? ", uno de ellos si lo negocias" : `, ${negociar} de ellos si los negocias`}.`,
  /** Desde ahora, el semanal (la presentación del primer correo). */
  semanal: "Desde ahora, cada lunes te mandamos los nuevos que convengan.",
  /** «Publicados al [hora]»: el chequeo más antiguo de lo que va en el correo. */
  publicadosAl: (cuando: string) => `Franco los vio publicados ${cuando}. Antes de visitar uno, confirma con quien lo publica que sigue disponible.`,
  regalo: "Te cargamos un análisis de regalo: úsalo en el depto que quieras.",
  vacioAsunto: "Te aviso cuando aparezca uno",
  vacio: "Hoy no encontré uno publicado que convenga con lo que buscas. Sigo buscando y te aviso cuando aparezca uno.",
  vacioPerfil: "Si quieres buscar en otras comunas o con otro pie, cámbialo en tu perfil:",
} as const;
