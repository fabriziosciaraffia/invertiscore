// ─── Unidades de obra nueva: los deptos disponibles de cada proyecto ────────
//
// HASTA EL 02-OCT-2026 este módulo leía un GraphQL público de la ficha que traía cada unidad con su
// precio, y las expandía a filas de `scraped_properties`. La fuente lo retiró (desde la IP local
// devuelve la app; por el proxy, 403) y movió la ficha de obra nueva a una app nueva, cuyo backend
// público es `api-ficha`:
//   · /property/<id>               el proyecto: rango «desde/hasta» en UF y la fecha de entrega.
//   · /property/<id>/floors-units  los deptos DISPONIBLES: número, dormitorios, baños, piso y m².
//                                  Sin precio (verificado en 6 proyectos y con parámetros: el precio
//                                  por unidad solo aparece tras la precotización, que pide lead).
//
// Lo que hace ahora: lee los disponibles y los cruza con las unidades que ya tenemos (mismo número:
// verificado 96 de 96 en el proyecto 3976789). La que sigue disponible queda vista; la que dejó de
// aparecer se marca vendida (is_active = false). NO escribe precios ni filas nuevas: una unidad sin
// precio no entra a la base hasta que Fabrizio decida entre precio real, de tipología o estimado.
//
// Sin JWT, pero con headers de navegador y por el proxy, como todo fetch a la fuente.
import { proxyDispatcher } from "./toctoc";

const API_FICHA = "https://www.toctoc.com/propiedades/1.0/api-ficha";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CL,es;q=0.9",
  Referer: "https://www.toctoc.com/",
};

/** Proyecto a consultar: la fila-proyecto ya persistida aporta la identidad
 *  (id de la URL compranuevo) y los datos que la fuente no trae confiable
 *  (comuna, coordenadas). */
export interface ProyectoBase {
  idProyecto: number;
  url: string;
  comuna: string;
  lat: number | null;
  lng: number | null;
  direccion: string | null;
}

/** Un depto disponible según la ficha nueva. */
export interface UnidadDisponible {
  numero: string;
  dormitorios: number | null;
  banos: number | null;
  piso: number | null;
  m2Utiles: number | null;
  m2Totales: number | null;
}

export interface UnidadesProyecto {
  idProyecto: number;
  url: string;
  disponibles: UnidadDisponible[];
  /** El rango del proyecto en UF («desde/hasta»), o null si la ficha no lo trae. */
  rango: { desdeUF: number; hastaUF: number } | null;
  /** Cruda, como la publica la fuente («Inmediata», «2° Semestre 2026»…). */
  fechaEntrega: string | null;
  error?: string;
}

type Caracteristica = { name?: string | null; value?: unknown };

/** «119.65 m2», 8, "3" → número; lo demás, null. */
function numero(v: unknown): number | null {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function caracteristica(cs: Caracteristica[] | null | undefined, nombre: string): unknown {
  return (cs ?? []).find((c) => String(c.name ?? "").trim().replace(/:$/, "").toLowerCase() === nombre.toLowerCase())?.value;
}

/** Los deptos disponibles de la respuesta de floors-units. */
export function parsearDisponibles(json: unknown): UnidadDisponible[] {
  const floors = (json as { data?: { floors?: Array<{ model?: Array<{ units?: Array<{ number?: unknown; characteristics?: Caracteristica[] }> }> }> } })?.data?.floors ?? [];
  const out: UnidadDisponible[] = [];
  for (const f of floors) {
    for (const m of f.model ?? []) {
      for (const u of m.units ?? []) {
        const n = String(u.number ?? "").trim();
        if (!n) continue;
        const cs = u.characteristics;
        out.push({
          numero: n,
          dormitorios: numero(caracteristica(cs, "Dormitorios")),
          banos: numero(caracteristica(cs, "Baños")),
          piso: numero(caracteristica(cs, "Piso")),
          m2Utiles: numero(caracteristica(cs, "M2 útiles")),
          m2Totales: numero(caracteristica(cs, "M2 totales")),
        });
      }
    }
  }
  return out;
}

/** El rango y la entrega de la respuesta de /property/<id>. */
export function parsearProyecto(json: unknown): { rango: UnidadesProyecto["rango"]; fechaEntrega: string | null } {
  const d = (json as { data?: { minimunPricesUF?: unknown; maximunPricesUF?: unknown; characteristics?: Caracteristica[] } })?.data;
  const desde = numero(d?.minimunPricesUF);
  const hasta = numero(d?.maximunPricesUF);
  const fecha = String(caracteristica(d?.characteristics, "Fecha de entrega") ?? "").trim();
  const estado = String(caracteristica(d?.characteristics, "Estado del proyecto") ?? "");
  return {
    rango: desde && desde > 0 ? { desdeUF: desde, hastaUF: hasta && hasta >= desde ? hasta : desde } : null,
    fechaEntrega: fecha || (/inmediata/i.test(estado) ? "Inmediata" : null),
  };
}

/** GET a la fuente por el proxy. Un 202 es el desafío del WAF; un cuerpo que no es JSON es la app
 *  (la dirección cambió): los dos salen como error explícito, nunca como «sin unidades». */
async function leerJson(url: string): Promise<{ status: number; json: unknown; error?: string }> {
  const r = await fetch(url, { headers: HEADERS, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown });
  if (r.status === 404) return { status: 404, json: null };
  if (r.status !== 200) return { status: r.status, json: null, error: `http ${r.status}${r.status === 202 ? " (desafío del WAF: sin proxy)" : ""}` };
  const texto = await r.text();
  if (!texto.trim()) return { status: 200, json: null, error: "http 200 sin cuerpo" };
  try {
    return { status: 200, json: JSON.parse(texto) };
  } catch {
    return { status: 200, json: null, error: "respuesta no JSON: la fuente cambió la dirección" };
  }
}

/**
 * Los deptos disponibles de UN proyecto, con su rango y su entrega. Nunca lanza: los errores vuelven
 * en `error` para que el route los cuente sin abortar el lote. Un proyecto que la ficha ya no tiene
 * (404) no es falla: vuelve sin disponibles y el route no marca nada.
 */
export async function fetchUnidadesProyecto(base: ProyectoBase): Promise<UnidadesProyecto> {
  const vacio = (error?: string): UnidadesProyecto =>
    ({ idProyecto: base.idProyecto, url: base.url, disponibles: [], rango: null, fechaEntrega: null, ...(error ? { error } : {}) });
  try {
    const p = await leerJson(`${API_FICHA}/property/${base.idProyecto}`);
    if (p.error) return vacio(p.error);
    if (p.status === 404 || !(p.json as { data?: unknown })?.data) return vacio();
    const { rango, fechaEntrega } = parsearProyecto(p.json);
    const u = await leerJson(`${API_FICHA}/property/${base.idProyecto}/floors-units`);
    if (u.error) return vacio(u.error);
    return { idProyecto: base.idProyecto, url: base.url, disponibles: u.status === 404 ? [] : parsearDisponibles(u.json), rango, fechaEntrega };
  } catch (e) {
    return vacio(String(e).slice(0, 120));
  }
}

// ─── Disponibilidad: qué unidad sigue, cuál se vendió ───────────────────────

/** Marca de «vista por el pase de unidades» en `seen_pass_id`. El pase de usados (backfill-toctoc)
 *  usa la misma columna, pero solo en su universo (condicion usado o null): no se pisan. */
export const PREFIJO_VISTA_UNIDADES = "unidades@";
export function marcaVistaUnidades(ahora: Date): string {
  return `${PREFIJO_VISTA_UNIDADES}${ahora.toISOString()}`;
}

/** La etiqueta de la unidad en su source_id (`url#801 B`). El `~` final era el desempate del scraper
 *  viejo cuando la fuente repetía un número dentro del proyecto. */
export function etiquetaDeUnidad(sourceId: string): string {
  const i = sourceId.indexOf("#");
  return i < 0 ? "" : sourceId.slice(i + 1).replace(/~+$/, "").trim();
}

export interface FilaUnidad { id: string; source_id: string; is_active: boolean | null; seen_pass_id?: string | null }

/**
 * El cruce de un proyecto: las filas que siguen disponibles (vistas), las ACTIVAS que dejaron de
 * aparecer (vendidas) y cuántos disponibles no tenemos (nuevos, sin precio: no se escriben).
 *
 * SOLO SE VENDE LO QUE LA FICHA NUEVA YA VIO. La lista nueva es un subconjunto de lo que publicaba el
 * GraphQL viejo: en el ensayo del 02-oct, 78 de 233 unidades de 3 proyectos, vistas publicadas el
 * 30-sep o el 01-oct, no estaban (entre 24% y 46% por proyecto: no son ventas de 48 horas). Una fila
 * que nunca apareció en la ficha nueva queda como está (`fuera`), con su precio y su fecha; la vendida
 * es la que la ficha nueva listó alguna vez (seen_pass_id con PREFIJO_VISTA_UNIDADES) y ya no lista.
 *
 * Dos resguardos antes de marcar una venta:
 *   · una lista vacía no vende nada (un proyecto agotado y una respuesta incompleta se ven igual);
 *   · si ninguna de nuestras unidades activas aparece en la lista, el cruce no es confiable
 *     (numeración cambiada, otro proyecto): no se marca nada y se reporta.
 */
export function planDisponibilidad(filas: FilaUnidad[], disponibles: UnidadDisponible[]): {
  vistas: string[]; vendidas: string[]; nuevas: number; fuera: number; sinCruce: boolean;
} {
  if (disponibles.length === 0) return { vistas: [], vendidas: [], nuevas: 0, fuera: 0, sinCruce: false };
  const enLista = new Set(disponibles.map((d) => d.numero.trim()));
  const nuestras = new Set(filas.map((f) => etiquetaDeUnidad(f.source_id)));
  const vistas = filas.filter((f) => enLista.has(etiquetaDeUnidad(f.source_id))).map((f) => f.id);
  const nuevas = Array.from(enLista).filter((n) => !nuestras.has(n)).length;
  const activas = filas.filter((f) => f.is_active !== false);
  if (activas.length > 0 && !activas.some((f) => enLista.has(etiquetaDeUnidad(f.source_id)))) {
    return { vistas: [], vendidas: [], nuevas, fuera: 0, sinCruce: true };
  }
  const faltan = activas.filter((f) => !enLista.has(etiquetaDeUnidad(f.source_id)));
  const vendidas = faltan.filter((f) => (f.seen_pass_id ?? "").startsWith(PREFIJO_VISTA_UNIDADES)).map((f) => f.id);
  return { vistas, vendidas, nuevas, fuera: faltan.length - vendidas.length, sinCruce: false };
}

/** Id numérico de proyecto desde una URL compranuevo (el número final del path).
 *  Sirve igual para la fila-proyecto (url o url__max) y para una unidad. */
export function idProyectoDeUrl(url: string | null | undefined): number | null {
  const m = String(url ?? "").match(/compranuevo\/departamento\/[^/]+\/[^/]+\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * CONVIVENCIA fila-proyecto vs unidades: cuando un proyecto tiene unidades
 * FRESCAS, TODAS sus filas-proyecto se desactivan. Si conviven activas, la
 * mediana cuenta el proyecto dos veces (la fila-proyecto ES la unidad de
 * entrada, que además está entre las unidades) y la tipología más barata queda
 * sobre-representada — sesgo a la baja sistemático.
 *
 * POR ID DE PROYECTO, NO POR URL. Medido en la base: 463 de 515 proyectos
 * tienen MÁS DE UNA fila-proyecto con variantes de URL (misma ficha, distinto
 * source_id — p.ej. `.../{id}` y `.../{id}__max`). Una primera versión de este
 * invariante que casaba por URL exacta desactivó 47 de 85 bases y dejó el doble
 * conteo vivo en 80 proyectos. El emparejamiento correcto es por el número final
 * de la URL, que identifica el proyecto a través de todas sus variantes.
 *
 * GLOBAL E IDEMPOTENTE, sin candidatos: relee el estado completo del universo
 * nuevo (997 bases + unidades, 2-3 páginas de una columna) y re-aplica el
 * invariante entero. Así las DOS rutas que lo llaman no necesitan acordar qué
 * tocó cada una:
 *   · scrape-nuevos (diario) RESUCITA bases con su upsert (is_active: true) y
 *     las re-desactiva acá mismo.
 *   · scrape-unidades-nuevas (diario, por tercios) lo llama tras cruzar los disponibles.
 *
 * "Fresca" = scraped_at dentro de 365 días — la ventana MÁS ANCHA que usa la
 * mediana del universo nuevo (VENTANAS_DIAS). Ese corte hace el sistema
 * auto-sanador: si el pase de unidades muriera y sus filas envejecieran más allá
 * de toda ventana, la fila-proyecto resucita al día siguiente y el proyecto
 * vuelve a estar representado (grueso, pero presente).
 */
export async function desactivarProyectosConUnidades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ desactivadas: number; errores: string[] }> {
  const errores: string[] = [];
  const desde = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Paginado explícito: PostgREST capa las respuestas, y este conjunto crece
  // con cada batch de unidades.
  async function paginar(filtro: (q: unknown) => unknown): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    for (let off = 0; ; off += 1000) {
      // Orden total por id: sin él las páginas no son estables y una fila puede
      // repetirse o saltarse entre dos lecturas. El filtro se aplica después del
      // rango sin problema: el builder acumula todo hasta el await.
      const q = filtro(
        supabase.from("scraped_properties").select("source_id,url,is_active").eq("condicion", "nuevo")
          .order("id", { ascending: true }).range(off, off + 999),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
      const { data, error } = await q;
      if (error) { errores.push(`select: ${error.message}`); break; }
      out.push(...((data ?? []) as Array<Record<string, unknown>>));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  // 1. Proyectos con unidades frescas (las unidades llevan '#' en el source_id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unidades = await paginar((q) => (q as any).like("source_id", "%#%").gte("scraped_at", desde));
  const idsConUnidades = new Set<number>();
  for (const u of unidades) {
    const id = idProyectoDeUrl(String(u.url ?? u.source_id));
    if (id != null) idsConUnidades.add(id);
  }
  if (idsConUnidades.size === 0) return { desactivadas: 0, errores };

  // 2. Filas-proyecto ACTIVAS de esos proyectos — todas las variantes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bases = await paginar((q) => (q as any).not("source_id", "like", "%#%").eq("is_active", true));
  const objetivo: string[] = [];
  for (const b of bases) {
    const id = idProyectoDeUrl(String(b.url ?? b.source_id));
    if (id != null && idsConUnidades.has(id)) objetivo.push(String(b.source_id));
  }

  // 3. Desactivar por source_id exacto, en lotes.
  let desactivadas = 0;
  for (let i = 0; i < objetivo.length; i += 100) {
    const chunk = objetivo.slice(i, i + 100);
    const { data, error } = await supabase
      .from("scraped_properties")
      .update({ is_active: false })
      .eq("condicion", "nuevo")
      .in("source_id", chunk)
      .select("id");
    if (error) { errores.push(`update bases: ${error.message}`); continue; }
    desactivadas += ((data ?? []) as unknown[]).length;
  }
  return { desactivadas, errores };
}

/**
 * Fracción de proyectos que puede seguir fallando DESPUÉS del reintento sin que la corrida cuente como
 * falla (30-sep-2026, decisión de Fabrizio). El proxy suelta algún `fetch failed` suelto (4 de 140 en la
 * primera corrida del 29-sep): cada proyecto fallido se reintenta una vez, y solo si pasa del 5% la
 * corrida es falla y alerta. Los que fallan igual quedan en `errors` y se leen en la respuesta.
 */
export const TOLERANCIA_FALLA_PROYECTOS = 0.05;

/** Qué cuenta como fallido tras el reintento: nada si no pasa de la tolerancia (ver arriba). */
export function fallidosTolerados(fallidos: number, delBatch: number): number {
  return delBatch > 0 && fallidos / delBatch > TOLERANCIA_FALLA_PROYECTOS ? fallidos : 0;
}
