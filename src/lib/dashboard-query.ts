/**
 * Capa de consulta del Dashboard v2 (1/3 · solo datos, cero UI).
 *
 * Reemplaza el `select("*")` de `/dashboard`, que traía los jsonb `results` +
 * `input_data` de TODAS las filas del usuario (215 y subiendo) para pintar nueve
 * columnas. Acá se consulta la vista `analisis_dashboard`
 * (migración 20260728_analisis_dashboard_view.sql), que ya trae flujo, cap rate,
 * multiplicador y veredicto aplanados desde el jsonb → búsqueda, filtros, orden
 * y paginación viajan al servidor.
 *
 * Módulo puro: no importa `next/headers` ni crea clientes. Recibe el
 * SupabaseClient por parámetro para servir igual al Server Component
 * (cliente con cookies) y a los scripts de QA (service role).
 *
 * UNIDAD DE LISTA. Un par AMBAS son DOS filas `analisis` que la UI muestra como
 * UNA card comparativa (`buildDisplayItems` en dashboard-client.tsx). Para que
 * la paginación y los conteos no mientan, `queryDashboardRows` devuelve UNA fila
 * por unidad: la del lado `ltr` del par. El hermano `str` se pide aparte con
 * `fetchAmbasSiblings` solo para las unidades de la página visible.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Veredicto } from "./types";

/** Fila de la vista `analisis_dashboard`. Espejo 1:1 de sus columnas. */
export interface AnalisisDashboardRow {
  id: string;
  user_id: string;
  nombre: string;
  /** `formatted_address` crudo de Google Places. NULL en filas viejas. */
  direccion: string | null;
  comuna: string;
  tipo_analisis: "long-term" | "short-term";
  ambas_group_id: string | null;
  ambas_role: "ltr" | "str" | null;
  dormitorios: number;
  banos: number;
  superficie: number;
  /** Precio en UF (columna `precio` de `analisis`). */
  precio: number;
  /** Columna `score` cruda. Para mostrar/ordenar usar `score_efectivo`. */
  score: number;
  created_at: string;
  is_premium: boolean;
  pending_payment: boolean;
  /** Score de la modalidad: STR lo guarda en `results.francoScore.score`. */
  score_efectivo: number;
  /** Flujo mensual en CLP. Nunca null (la vista aplica los fallbacks legacy). */
  flujo: number;
  /** Cap rate en PORCENTAJE para ambas modalidades. NULL en filas sin `results`. */
  cap_rate: number | null;
  /** Multiplicador de capital (×). NULL en filas sin `exitScenario`. */
  multiplicador: number | null;
  /** Veredicto crudo de la DB. Puede ser legacy — normalizar antes de mostrar. */
  veredicto: string | null;
  /** Veredicto ya normalizado por la vista (solo para filtrar/contar). */
  veredicto_norm: Veredicto;
  /** ¿Es la fila representante de su unidad? (suelto, o lado `ltr` de un par). */
  es_unidad: boolean;
  /** ¿Algún lado de la unidad dice COMPRAR? (un suelto = su propio veredicto). */
  u_comprar: boolean;
  u_ajusta: boolean;
  u_buscar: boolean;
}

export type ModalidadFilter = "todas" | "long-term" | "short-term" | "ambas";
export type VeredictoFilter = "todos" | Veredicto;
export type DashboardSortKey = "fecha" | "score" | "flujo" | "cap" | "multiplicador";
export type SortDir = "asc" | "desc";

export interface DashboardQueryParams {
  userId: string;
  /** Texto libre: matchea dirección, comuna o nombre. */
  q?: string;
  modalidad?: ModalidadFilter;
  veredicto?: VeredictoFilter;
  sort?: DashboardSortKey;
  dir?: SortDir;
  /** Página 0-indexed. */
  page?: number;
  pageSize?: number;
}

export interface DashboardPage {
  rows: AnalisisDashboardRow[];
  /** Total de unidades que matchean el filtro (no filas). */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DashboardStats {
  total: number;
  flujo_positivo: number;
  score_promedio: number;
  por_modalidad: { long_term: number; short_term: number; ambas: number };
  por_veredicto: Record<Veredicto, number>;
}

export const DEFAULT_PAGE_SIZE = 25;

const VIEW = "analisis_dashboard";

/** Columna real de la vista para cada clave de orden expuesta en la URL. */
const SORT_COLUMN: Record<DashboardSortKey, string> = {
  fecha: "created_at",
  score: "score_efectivo",
  flujo: "flujo",
  cap: "cap_rate",
  multiplicador: "multiplicador",
};

/** Columna booleana de la vista que responde «esta unidad tiene tal veredicto». */
const VERDICT_COLUMN: Record<Veredicto, string> = {
  COMPRAR: "u_comprar",
  "AJUSTA SUPUESTOS": "u_ajusta",
  "BUSCAR OTRA": "u_buscar",
};

/**
 * Sanitiza el término de búsqueda para el filtro `or()` de PostgREST, cuya
 * gramática es una lista separada por comas con paréntesis de agrupación: una
 * coma o un paréntesis sin escapar rompe la query entera (400, no "sin
 * resultados"). Se quitan además las comillas y el backslash.
 */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()"\\]/g, " ").trim().slice(0, 80);
}

/**
 * Filtros compartidos por la consulta paginada y la consulta completa (modo
 * agrupado). Están acá y no duplicados para que «buscar» y «filtrar» signifiquen
 * exactamente lo mismo con y sin agrupación.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(query: any, p: {
  userId: string; q?: string; modalidad: ModalidadFilter; veredicto: VeredictoFilter;
}) {
  let out = query
    .eq("user_id", p.userId)
    // Regla existente: las filas bloqueadas pre-pago no son del usuario todavía.
    .eq("pending_payment", false)
    // Una fila por unidad. El lado `str` de un par se pide con fetchAmbasSiblings.
    .eq("es_unidad", true);

  // Modalidad. Espejo del dashboard actual: un AMBAS no pertenece a una
  // modalidad única, así que solo aparece bajo "todas" o bajo su propio filtro.
  if (p.modalidad === "ambas") {
    out = out.not("ambas_group_id", "is", null);
  } else if (p.modalidad === "long-term" || p.modalidad === "short-term") {
    out = out.is("ambas_group_id", null).eq("tipo_analisis", p.modalidad);
  }

  // Veredicto: un par matchea si CUALQUIERA de sus dos lados lo tiene.
  if (p.veredicto !== "todos") {
    out = out.eq(VERDICT_COLUMN[p.veredicto], true);
  }

  if (p.q) {
    const term = sanitizeSearch(p.q);
    if (term) {
      const like = `%${term}%`;
      out = out.or(`direccion.ilike.${like},comuna.ilike.${like},nombre.ilike.${like}`);
    }
  }
  return out;
}

/**
 * Todas las unidades que matchean el filtro, sin paginar. Solo la usa el modo
 * «Agrupar por propiedad»: agrupar bien exige ver el conjunto completo, porque
 * dos análisis de la misma dirección pueden caer en páginas distintas.
 *
 * El costo es asumible y está medido: una fila aplanada pesa ~0,7 KB, así que
 * 215 unidades son ~150 KB contra los ~5 MB que traía el dashboard viejo. Si
 * la agrupación pasa a ser el modo por defecto, esto se muda a SQL (vista
 * agregada + endpoint de hijos); hoy, con el modo opt-in, no lo justifica.
 */
export async function fetchAllUnits(
  supabase: SupabaseClient,
  params: Omit<DashboardQueryParams, "page" | "pageSize" | "sort" | "dir">,
  limite = 2000,
): Promise<AnalisisDashboardRow[]> {
  const { userId, q, modalidad = "todas", veredicto = "todos" } = params;
  const { data, error } = await aplicarFiltros(supabase.from(VIEW).select("*"), {
    userId, q, modalidad, veredicto,
  })
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`dashboard-query (todas): ${error.message}`);
  return (data ?? []) as AnalisisDashboardRow[];
}

/**
 * Una página de la lista del archivo. Devuelve UNA fila por unidad:
 * los análisis sueltos y, de cada par AMBAS, el lado `ltr`.
 *
 * Caveat conocido: un par incompleto que perdió su lado `ltr` (huérfano por
 * fallo parcial de creación) no aparece. La UI actual sí lo degrada a card
 * suelta. El script de humo reporta si existen grupos con != 2 miembros; si
 * aparecen en producción hay que resolverlo en la vista, no acá.
 */
export async function queryDashboardRows(
  supabase: SupabaseClient,
  params: DashboardQueryParams,
): Promise<DashboardPage> {
  const {
    userId,
    q,
    modalidad = "todas",
    veredicto = "todos",
    sort = "fecha",
    dir = "desc",
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params;

  let query = aplicarFiltros(
    supabase.from(VIEW).select("*", { count: "exact" }),
    { userId, q, modalidad, veredicto },
  );

  const column = SORT_COLUMN[sort] ?? SORT_COLUMN.fecha;
  const ascending = dir === "asc";
  // nullsFirst:false en ambas direcciones — las filas legacy sin cap rate ni
  // multiplicador van siempre al final, nunca encabezando el ranking.
  query = query.order(column, { ascending, nullsFirst: false });
  // Desempate estable: sin esto, dos filas con el mismo score pueden cambiar de
  // orden entre páginas y duplicarse o desaparecer al paginar.
  if (column !== "created_at") query = query.order("created_at", { ascending: false });
  query = query.order("id", { ascending: true });

  const from = page * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(`dashboard-query: ${error.message}`);

  const rows = (data ?? []) as AnalisisDashboardRow[];
  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: from + rows.length < total,
  };
}

/**
 * Filas `str` de los pares AMBAS presentes en una página. Se llama con los
 * `ambas_group_id` que trae `queryDashboardRows`, no con todos los del usuario.
 *
 * `userId` no es decorativo: la vista lleva una window function particionada por
 * (user_id, grupo), y Postgres solo puede bajar el WHERE por debajo de esa
 * window si el predicado toca las columnas del PARTITION BY. Sin el filtro de
 * usuario la consulta escanea la tabla entera — medido: 512 ms contra ~90 ms.
 */
export async function fetchAmbasSiblings(
  supabase: SupabaseClient,
  userId: string,
  groupIds: string[],
): Promise<Map<string, AnalisisDashboardRow>> {
  const ids = Array.from(new Set(groupIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from(VIEW)
    .select("*")
    .eq("user_id", userId)
    .in("ambas_group_id", ids)
    .eq("ambas_role", "str");
  if (error) throw new Error(`dashboard-query (ambas): ${error.message}`);

  const map = new Map<string, AnalisisDashboardRow>();
  for (const row of (data ?? []) as AnalisisDashboardRow[]) {
    if (row.ambas_group_id) map.set(row.ambas_group_id, row);
  }
  return map;
}

/**
 * Stats de la franja en una sola llamada (RPC `dashboard_stats`).
 * Cuenta unidades como la UI: un par AMBAS = 1.
 */
export async function fetchDashboardStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("dashboard_stats", { p_user_id: userId });
  if (error) throw new Error(`dashboard-stats: ${error.message}`);

  const raw = (data ?? {}) as Partial<DashboardStats>;
  return {
    total: raw.total ?? 0,
    flujo_positivo: raw.flujo_positivo ?? 0,
    score_promedio: raw.score_promedio ?? 0,
    por_modalidad: raw.por_modalidad ?? { long_term: 0, short_term: 0, ambas: 0 },
    por_veredicto: raw.por_veredicto ?? {
      COMPRAR: 0,
      "AJUSTA SUPUESTOS": 0,
      "BUSCAR OTRA": 0,
    },
  };
}

/**
 * Dirección para mostrar en la lista. `direccion` es nullable: las filas viejas
 * (y las que el wizard no geocodificó) caen al `nombre` autogenerado
 * ("Depto 2D1B Providencia"). No limpia el `formatted_address` — de eso se
 * encarga `formatDireccionDisplay` en el render.
 */
export function displayLabel(row: Pick<AnalisisDashboardRow, "direccion" | "nombre">): string {
  const dir = row.direccion?.trim();
  return dir && dir.length > 0 ? dir : row.nombre;
}
