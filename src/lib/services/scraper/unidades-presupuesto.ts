// ─── El pase de unidades con presupuesto (13-oct-2026) ──────────────────────
//
// EL INCIDENTE. La corrida del 13-oct de `scrape-unidades-nuevas` (14:00 UTC) murió con «Task timed out
// after 800 seconds» sin dejar resultado. No fue memoria ni el corte de 300 s: desde Vercel, 235 de los 334
// pedidos al portal no tuvieron respuesta (fetch failed, ~0,2 s cada uno) y 17 dieron 403. De los 135
// proyectos del tercio, 31 se leyeron; 104 fallaron, y el reintento —de a uno, con 4 s de pausa, dos
// vueltas, sin reloj— se comió el resto del techo. Como las escrituras iban recién después de leer TODO,
// tampoco se guardaron los 31: el tercio entero quedó sin actualizar (su última lectura era del 10-oct).
// Hasta el 12-oct ninguna corrida tuvo un pedido sin respuesta, pero ya duraban de 4 a 10 minutos.
//
// EL ESQUEMA, el mismo del prechequeo semanal (09 y 12-oct-2026):
//   · PRESUPUESTO de 240 s para la corrida entera: ninguna lectura empieza después de los 210 s
//     (`PRESUPUESTO_UNIDADES_MS` − `RESERVA_ESCRITURA_MS`), y los 30 s que quedan son para escribir lo leído
//     (medido: ~25 consultas, 15 s desde Vercel). Un lote empieza solo si además caben los reintentos de los
//     que ya fallaron, así que un portal caído corta las lecturas antes, no los reintentos.
//   · CIERRE LIMPIO registrando hasta dónde llegó: cada proyecto lleva cuándo se leyó por última vez
//     (`metrics_daily`, fuente `cron-avance`), y la corrida siguiente sigue por los que hace más tiempo que
//     no se leen. Un proyecto que falló sigue primero en la cola: lo toma la corrida siguiente, no la vuelta
//     siguiente. Por eso no es un cursor de una posición: un cursor olvida a los que fallaron.
//   · TECHO de 280 s pase lo que pase (`conTope`), y cada pedido al portal con su tiempo máximo.
//   · NINGÚN PROYECTO MÁS DE 4 DÍAS SIN LEER: con cuatro corridas al día caben 50 proyectos por corrida
//     (800 en 4 días; hoy son 434), y la corrida que encuentra uno pasado de plazo cierra en rojo y lo dice.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConteoCron } from "@/lib/cron-resultado";
import { guardarMetrica } from "@/lib/metrics-daily";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { fallidosTolerados, idProyectoDeUrl, type ProyectoBase } from "./toctoc-unidades";

/** Lo que dura una corrida, como mucho, si nada se cuelga. */
export const PRESUPUESTO_UNIDADES_MS = 240_000;
/** Lo que se guarda del presupuesto para escribir lo leído: ninguna lectura empieza después de
 *  `PRESUPUESTO_UNIDADES_MS − RESERVA_ESCRITURA_MS`. Medido el 11 y 12-oct: ~25 consultas, 15 s desde Vercel. */
export const RESERVA_ESCRITURA_MS = 30_000;
/** El TECHO, pase lo que pase: a los 280 s la corrida cierra igual y le quedan 20 s para responder. */
export const TOPE_DURO_UNIDADES_MS = 280_000;
/** Ningún proyecto puede pasar más que esto sin leerse (decisión de Fabrizio, 13-oct-2026). */
export const MAX_DIAS_SIN_LEER = 4;
/** Corridas por día: tiene que coincidir con el schedule de `vercel.json` (lo exige el tier UNIDADES-PRESUPUESTO). */
export const CORRIDAS_POR_DIA = 4;
/** Lo que cuesta un proyecto, medido en las corridas del 10 al 12-oct: ~2,2 s en la primera pasada (dos GETs,
 *  dos en vuelo, 1,5 s entre lotes) más un 30% que se reintenta a ~5,5 s. */
export const MS_POR_PROYECTO = 4_000;
/** Lo que tarda la corrida en empezar a leer el portal: los proyectos, el avance y las ~9.400 unidades. */
export const ARRANQUE_MS = 10_000;
/** Una lectura de un proyecto (dos GETs) en su p95, para reservarle tiempo a su reintento: un GET tardó hasta
 *  2,5 s en las corridas del 10 al 12-oct, con mediana de 0,4 s. */
export const MS_LECTURA_PROYECTO = 2_500;

const DIA_MS = 24 * 3600e3;

/** Cuántos proyectos caben en una corrida, con lo medido. */
export function proyectosPorCorrida(): number {
  return Math.floor((PRESUPUESTO_UNIDADES_MS - RESERVA_ESCRITURA_MS - ARRANQUE_MS) / MS_POR_PROYECTO);
}

/** Cuántos proyectos se alcanzan a leer en el plazo de `MAX_DIAS_SIN_LEER` días. Con más que esto, alguno
 *  queda más de cuatro días sin leer. */
export function capacidadEnPlazo(): number {
  return proyectosPorCorrida() * CORRIDAS_POR_DIA * MAX_DIAS_SIN_LEER;
}

// ── Dónde quedó: cuándo se leyó cada proyecto ─────────────────────────────────

/** Lo que se sabe de un proyecto entre corridas: cuándo se leyó por última vez (null: nunca, desde que se lleva
 *  la cuenta) y desde cuándo está en la lista (el plazo de un proyecto nuevo corre desde ahí). */
export interface EstadoLectura { leido: string | null; alta: string }
/** Por id de proyecto. */
export type AvanceUnidades = Record<string, EstadoLectura>;

/**
 * El avance de esta corrida: el de la anterior, con los proyectos de hoy. El que no estaba entra con su alta
 * (ahora) y, si sus unidades ya tienen marca de vista, con esa fecha como última lectura: la primera corrida
 * no sabe más que eso, y con eso los más atrasados van primero. Los que ya no están en la lista salen.
 */
export function completarAvance(anterior: AvanceUnidades | null, ids: number[], ultimaMarca: Map<number, string>, ahora: Date): AvanceUnidades {
  const out: AvanceUnidades = {};
  for (const id of ids) {
    const prev = anterior?.[String(id)];
    out[String(id)] = prev && typeof prev.alta === "string"
      ? { leido: typeof prev.leido === "string" ? prev.leido : null, alta: prev.alta }
      : { leido: ultimaMarca.get(id) ?? null, alta: ahora.toISOString() };
  }
  return out;
}

const instante = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/** El orden de lectura: primero los que hace más tiempo que no se leen (los nunca leídos, antes que todos), y
 *  entre iguales por id. La corrida siguiente sigue por donde esta no llegó, y un proyecto que falló sigue
 *  adelante en la cola. */
export function ordenDeLectura<P extends { idProyecto: number }>(proyectos: P[], avance: AvanceUnidades): P[] {
  return [...proyectos].sort((a, b) => {
    const ta = instante(avance[String(a.idProyecto)]?.leido), tb = instante(avance[String(b.idProyecto)]?.leido);
    return ta !== tb ? ta - tb : a.idProyecto - b.idProyecto;
  });
}

/** Los leídos de esta corrida (con todo escrito) pasan a leídos ahora. */
export function marcarLeidos(avance: AvanceUnidades, ids: number[], ahora: Date): AvanceUnidades {
  const out: AvanceUnidades = { ...avance };
  for (const id of ids) {
    const prev = out[String(id)];
    out[String(id)] = { leido: ahora.toISOString(), alta: prev?.alta ?? ahora.toISOString() };
  }
  return out;
}

/** Los proyectos pasados de plazo: más de `MAX_DIAS_SIN_LEER` días desde su última lectura o, si nunca se leyó,
 *  desde que entró a la lista. Y cuántas horas lleva sin leerse el más atrasado. */
export function sinLeerHace(avance: AvanceUnidades, ahora: Date): { vencidos: number[]; horasMax: number } {
  const vencidos: number[] = [];
  let horasMax = 0;
  for (const [id, e] of Object.entries(avance)) {
    const desde = Math.max(instante(e.leido), instante(e.alta));
    if (!Number.isFinite(desde)) continue;
    const ms = ahora.getTime() - desde;
    horasMax = Math.max(horasMax, ms / 3600e3);
    if (ms > MAX_DIAS_SIN_LEER * DIA_MS) vencidos.push(Number(id));
  }
  return { vencidos: vencidos.sort((a, b) => a - b), horasMax: Math.round(horasMax * 10) / 10 };
}

// En `metrics_daily` (RLS sin políticas: solo el servidor), como el avance del prechequeo.
const FUENTE_AVANCE = "cron-avance";
const METRICA_AVANCE = "scrape-unidades-nuevas";

/** El avance de la corrida anterior. Un error de lectura NO es «no hay avance»: con eso la corrida pisaría el
 *  historial entero, así que vuelve como error y la corrida no sigue. */
export async function leerAvanceUnidades(sb: SupabaseClient): Promise<{ ok: true; avance: AvanceUnidades | null } | { ok: false; error: string }> {
  const { data, error } = await sb.from("metrics_daily").select("meta").eq("fuente", FUENTE_AVANCE).eq("metrica", METRICA_AVANCE)
    .order("fecha", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, error: error.message };
  const p = ((data?.meta ?? null) as { proyectos?: unknown } | null)?.proyectos;
  return { ok: true, avance: p && typeof p === "object" && !Array.isArray(p) ? (p as AvanceUnidades) : null };
}

/** Guarda el avance de esta corrida (con su resumen). false si no pudo: la corrida queda en rojo. */
export async function guardarAvanceUnidades(sb: SupabaseClient, avance: AvanceUnidades, resumen: { leidos: number } & Record<string, unknown>): Promise<boolean> {
  return guardarMetrica(sb, {
    fecha: new Date().toISOString().slice(0, 10), fuente: FUENTE_AVANCE, metrica: METRICA_AVANCE, valor: resumen.leidos,
    meta: { ...resumen, at: new Date().toISOString(), proyectos: avance },
  });
}

// ── Los proyectos ────────────────────────────────────────────────────────────

/**
 * Los proyectos a leer: las filas-proyecto de obra nueva vistas en los últimos 30 días, uno por id (el número
 * final de la URL compranuevo; un proyecto puede tener variantes de URL históricas y gana la más fresca),
 * ordenados por id.
 *
 * SIN filtrar is_active: este pase las desactiva cuando tienen unidades, y si las filtrara, un proyecto dejaría
 * de refrescarse justo después de su primera pasada. El corte de 30 días descarta los que scrape-nuevos —diario—
 * ya no ve publicados. Paginado con orden fijo: PostgREST corta cada respuesta en 1.000 filas sin avisar.
 */
export async function leerProyectosDelCiclo(sb: SupabaseClient): Promise<{ proyectos: ProyectoBase[]; error: string | null }> {
  const desde30d = new Date(Date.now() - 30 * DIA_MS).toISOString();
  const porId = new Map<number, ProyectoBase & { scrapedAt: string }>();
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await sb
      .from("scraped_properties")
      .select("source_id, url, comuna, lat, lng, direccion, scraped_at")
      .eq("type", "venta")
      .eq("condicion", "nuevo")
      .not("source_id", "like", "%#%")
      .gte("scraped_at", desde30d)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) return { proyectos: [], error: `select proyectos: ${error.message}` };
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = idProyectoDeUrl(String(r.url ?? ""));
      if (id == null) continue;
      const prev = porId.get(id);
      if (prev && prev.scrapedAt >= String(r.scraped_at)) continue;
      porId.set(id, {
        idProyecto: id,
        url: String(r.url),
        comuna: String(r.comuna),
        lat: typeof r.lat === "number" ? r.lat : null,
        lng: typeof r.lng === "number" ? r.lng : null,
        direccion: r.direccion ? String(r.direccion) : null,
        scrapedAt: String(r.scraped_at),
      });
    }
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  const proyectos = Array.from(porId.values())
    .map((p): ProyectoBase => ({ idProyecto: p.idProyecto, url: p.url, comuna: p.comuna, lat: p.lat, lng: p.lng, direccion: p.direccion }))
    .sort((a, b) => a.idProyecto - b.idProyecto);
  return { proyectos, error: null };
}

// ── La lectura con reloj ──────────────────────────────────────────────────────

/** El ritmo que tolera la ficha nueva (02-oct-2026): lotes chicos, pausa entre lotes, reintento con pausa. */
export interface RitmoLectura { concurrencia: number; pausaLoteMs: number; pausaReintentoMs: number; reintentos: number }
/** El reloj de la corrida (inyectable: el tier lo reemplaza por uno de mentira). Ninguna lectura empieza en o
 *  después de `hastaMs`. */
export interface RelojLectura { ahora: () => number; dormir: (ms: number) => Promise<void>; hastaMs: number }
/** Lo que se sabe MIENTRAS corre: si la corta el techo, el log dice hasta dónde llegó. */
export interface ProgresoUnidades { intentados: number; leidos: number }

export interface LecturaUnidades<R> {
  /** Uno por proyecto intentado, con su resultado final (después de los reintentos). */
  resultados: R[];
  /** Los de la cola que no alcanzaron a intentarse: los toma la corrida siguiente. */
  noAlcanzados: number;
  /** Cortó por el reloj: quedaron proyectos o reintentos sin hacer. */
  porTiempo: boolean;
  fallidosPrimera: number;
  reintentos: number;
  /** El paso más largo (un lote o un reintento), en ms de reloj. */
  msPasoMax: number;
  msLectura: number;
}

/**
 * Lee la cola en orden, con el ritmo de la ficha nueva y CON RELOJ (13-oct-2026). Primero los lotes: uno empieza
 * solo si, además de él, caben los reintentos de los que ya fallaron (sin esto, con el portal caído las
 * lecturas se comen el tiempo y nadie se reintenta). Después, los reintentos de a uno con su pausa, mientras
 * la pausa quepa. Nunca empieza nada en o después de `reloj.hastaMs`.
 */
export async function leerConPresupuesto<P extends { idProyecto: number }, R extends { error?: string }>(
  cola: P[],
  leer: (p: P) => Promise<R>,
  ritmo: RitmoLectura,
  reloj: RelojLectura,
  progreso?: ProgresoUnidades,
): Promise<LecturaUnidades<R>> {
  const inicio = reloj.ahora();
  const queda = (ms: number) => reloj.ahora() + ms < reloj.hastaMs;
  const costoReintento = ritmo.pausaReintentoMs + MS_LECTURA_PROYECTO;
  const resultados: R[] = [];
  const bases: P[] = [];
  let i = 0;
  let porTiempo = false;
  let msPasoMax = 0;
  let reintentos = 0;
  while (i < cola.length) {
    const fallidos = resultados.filter((r) => r.error).length;
    if (!queda(fallidos * costoReintento)) { porTiempo = true; break; }
    const lote = cola.slice(i, i + ritmo.concurrencia);
    i += lote.length;
    const t = reloj.ahora();
    const rs = await Promise.all(lote.map((p) => leer(p)));
    msPasoMax = Math.max(msPasoMax, reloj.ahora() - t);
    resultados.push(...rs);
    bases.push(...lote);
    if (progreso) { progreso.intentados += rs.length; progreso.leidos += rs.filter((r) => !r.error).length; }
    if (i < cola.length && ritmo.pausaLoteMs > 0) await reloj.dormir(ritmo.pausaLoteMs);
  }
  const fallidosPrimera = resultados.filter((r) => r.error).length;
  // El reintento pegado al 403 vuelve a dar 403: cada uno, después de su pausa (02-oct-2026).
  reintentar: for (let intento = 0; intento < ritmo.reintentos; intento++) {
    for (let k = 0; k < resultados.length; k++) {
      if (!resultados[k].error) continue;
      if (!queda(ritmo.pausaReintentoMs)) { porTiempo = true; break reintentar; }
      await reloj.dormir(ritmo.pausaReintentoMs);
      const t = reloj.ahora();
      resultados[k] = await leer(bases[k]);
      msPasoMax = Math.max(msPasoMax, reloj.ahora() - t);
      reintentos++;
      if (progreso && !resultados[k].error) progreso.leidos++;
    }
  }
  return { resultados, noAlcanzados: cola.length - i, porTiempo, fallidosPrimera, reintentos, msPasoMax, msLectura: reloj.ahora() - inicio };
}

// ── El resultado de la corrida ────────────────────────────────────────────────

/**
 * El conteo para cerrarCron. Como antes (29/30-sep-2026): una escritura caída o una corrida que leyó proyectos y
 * no trajo UN solo disponible es falla total, y los fallidos tras el reintento cuentan solo sobre el 5%. Y desde
 * el 13-oct-2026, cada proyecto pasado de plazo es un fallido: la corrida que lo encuentra cierra en rojo.
 */
export function conteoUnidades(o: {
  intentados: number[];
  conError: number[];
  conDisponibles: number;
  escrituraFallo: boolean;
  reconFallo: boolean;
  vencidos: number[];
}): ConteoCron {
  const responsables = new Set([...o.intentados, ...o.vencidos]);
  const sinNinguna = o.intentados.length > 0 && o.conDisponibles === 0;
  if (o.escrituraFallo || sinNinguna) return { procesados: responsables.size, exitosos: 0, fallidos: responsables.size };
  const fallidos = new Set([...(fallidosTolerados(o.conError.length, o.intentados.length) > 0 ? o.conError : []), ...o.vencidos]);
  return {
    procesados: responsables.size,
    exitosos: o.intentados.length - o.conError.length,
    fallidos: fallidos.size + (o.reconFallo ? 1 : 0),
  };
}
