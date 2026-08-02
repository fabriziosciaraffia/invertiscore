/**
 * Capa de acceso a las RPCs de agregación del panel admin.
 *
 * Las funciones `admin_list_users` y `admin_metrics` viven en Supabase (creadas a
 * mano, sin migración en este repo). Son SECURITY DEFINER con grant solo a
 * `service_role`: llamarlas SIEMPRE con el client que devuelve `requireAdminPage()`
 * / `requireAdmin()` (src/lib/admin-auth.ts), nunca antes del gate de allowlist.
 *
 * Por qué existen: la lista de usuarios se armaba paginando `auth.admin.listUsers`
 * y cruzando con tres `.in("user_id", userIds)` que metían TODOS los ids en la URL
 * del GET de PostgREST. Andaba con decenas de usuarios; con miles revienta el
 * largo de URL. Las RPCs hacen el join y la paginación del lado del servidor.
 *
 * Este módulo NO decide reglas de negocio nuevas: solo tipa el contrato de las
 * RPCs y centraliza dos criterios que ya existían en el código.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Segmentos que devuelve la RPC. Orden = jerarquía de valor, de mayor a menor. */
export const SEGMENTOS = [
  "admin_ilimitado",
  "suscriptor_activo",
  "suscriptor_churn",
  "comprador",
  "uso_gratis",
  "registrado",
] as const;

export type AdminSegmento = (typeof SEGMENTOS)[number];

export function esSegmentoValido(v: string | null | undefined): v is AdminSegmento {
  return !!v && (SEGMENTOS as readonly string[]).includes(v);
}

/** Etiqueta en español para un segmento. */
export function fmtSegmento(s: string): string {
  switch (s) {
    case "admin_ilimitado":
      return "Admin ilimitado";
    case "suscriptor_activo":
      return "Suscriptor activo";
    case "suscriptor_churn":
      return "Suscriptor churn";
    case "comprador":
      return "Comprador";
    case "uso_gratis":
      return "Uso gratis";
    case "registrado":
      return "Registrado";
    default:
      return s;
  }
}

/** Una fila de `admin_list_users`. `total_rows` viene repetido en cada fila. */
export interface AdminUserRow {
  user_id: string;
  email: string | null;
  created_at: string | null;
  is_test_user: boolean | null;
  is_unlimited: boolean | null;
  subscription_status: string | null;
  active_plan: string | null;
  welcome_credit_used: boolean | null;
  legacy_credits: number | null;
  ledger_remaining: number | null;
  pagos_pagados: number | null;
  analisis_total: number | null;
  ultimo_analisis: string | null;
  segmento: string | null;
  total_rows: number | null;
}

export interface AdminListUsersParams {
  search?: string | null;
  segment?: AdminSegmento | null;
  includeTest?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdminListUsersResult {
  rows: AdminUserRow[];
  /** Total de filas que matchean el filtro (no las de esta página). */
  total: number;
}

/**
 * Lista paginada de usuarios con sus agregados. Reemplaza el combo
 * listUsers-paginado + tres `.in()`.
 *
 * Ante error de la RPC devuelve vacío y loguea: el panel degrada a "sin usuarios"
 * en vez de tirar la página entera (mismo criterio que getAvailableCredits).
 */
export async function adminListUsers(
  sb: SupabaseClient,
  { search = null, segment = null, includeTest = false, limit = 50, offset = 0 }: AdminListUsersParams = {}
): Promise<AdminListUsersResult> {
  const { data, error } = await sb.rpc("admin_list_users", {
    p_search: search && search.trim() ? search.trim() : null,
    p_segment: segment ?? null,
    p_include_test: includeTest,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("[adminListUsers] rpc error:", error);
    return { rows: [], total: 0 };
  }

  const rows = (data ?? []) as AdminUserRow[];
  return { rows, total: rows[0]?.total_rows ?? 0 };
}

/** Una fila de `admin_metrics`. */
export interface AdminMetricRow {
  segmento: string;
  usuarios: number;
}

/**
 * Conteo de usuarios por segmento. La RPC solo devuelve los segmentos con al
 * menos un usuario; acá se completan los seis en el orden de SEGMENTOS, porque
 * un segmento en cero también es información (y evita que la lista salte de
 * posición cuando alguien entra o sale de un segmento).
 */
export async function adminMetrics(
  sb: SupabaseClient,
  includeTest = false
): Promise<Array<{ segmento: AdminSegmento; usuarios: number }>> {
  const { data, error } = await sb.rpc("admin_metrics", { p_include_test: includeTest });

  if (error) {
    console.error("[adminMetrics] rpc error:", error);
    return SEGMENTOS.map((s) => ({ segmento: s, usuarios: 0 }));
  }

  const porSegmento = new Map<string, number>();
  for (const r of (data ?? []) as AdminMetricRow[]) {
    porSegmento.set(r.segmento, r.usuarios ?? 0);
  }
  return SEGMENTOS.map((s) => ({ segmento: s, usuarios: porSegmento.get(s) ?? 0 }));
}

/**
 * Funnel y KPIs del resumen, en una fila. Ver docs/sql/admin-panel-rpcs.sql.
 *
 * `activaron` = usuarios con al menos un análisis. Es la MISMA definición que
 * usa la serie semanal: una sola idea de "activación" en toda la pantalla.
 * welcome_credit_used quedó descartado como criterio de etapa — es un flag de
 * cobro, no una acción del usuario.
 */
export interface AdminOverview {
  registrados: number;
  activaron: number;
  iniciaron_checkout: number;
  pagaron: number;
  nuevos_30d: number;
  ingresos_30d: number;
  analisis_30d: number;
}

const OVERVIEW_VACIO: AdminOverview = {
  registrados: 0,
  activaron: 0,
  iniciaron_checkout: 0,
  pagaron: 0,
  nuevos_30d: 0,
  ingresos_30d: 0,
  analisis_30d: 0,
};

/**
 * Agregados del resumen. Reemplaza el TOPE_USUARIOS=1000 que traía hasta mil
 * filas de usuarios a JS solo para contar tres cosas.
 *
 * Si la función todavía no existe en la base (el SQL se corre a mano), loguea y
 * devuelve ceros: el panel se ve vacío pero no se cae.
 */
export async function adminOverview(
  sb: SupabaseClient,
  includeTest = false
): Promise<AdminOverview> {
  const { data, error } = await sb.rpc("admin_overview", { p_include_test: includeTest });

  if (error) {
    console.error("[adminOverview] rpc error:", error);
    return OVERVIEW_VACIO;
  }
  // La RPC devuelve una sola fila; PostgREST la entrega como array.
  const row = (Array.isArray(data) ? data[0] : data) as Partial<AdminOverview> | undefined;
  if (!row) return OVERVIEW_VACIO;

  return {
    registrados: row.registrados ?? 0,
    activaron: row.activaron ?? 0,
    iniciaron_checkout: row.iniciaron_checkout ?? 0,
    pagaron: row.pagaron ?? 0,
    nuevos_30d: row.nuevos_30d ?? 0,
    ingresos_30d: Number(row.ingresos_30d ?? 0),
    analisis_30d: row.analisis_30d ?? 0,
  };
}

/** Una semana de la serie. `semana` es el lunes, en formato YYYY-MM-DD. */
export interface AdminSemana {
  semana: string;
  registros: number;
  activaciones: number;
  /** Usuarios registrados ESA semana que activaron alguna vez (la cohorte). */
  cohorte_activados: number;
}

/**
 * Serie semanal de registros y activaciones, más la cohorte por semana de alta.
 * La RPC devuelve siempre las N semanas completas (las vacías en cero), así que
 * el gráfico no inventa continuidad donde hubo un hueco.
 */
export async function adminWeeklyStats(
  sb: SupabaseClient,
  { weeks = 12, includeTest = false }: { weeks?: number; includeTest?: boolean } = {}
): Promise<AdminSemana[]> {
  const { data, error } = await sb.rpc("admin_weekly_stats", {
    p_weeks: weeks,
    p_include_test: includeTest,
  });

  if (error) {
    console.error("[adminWeeklyStats] rpc error:", error);
    return [];
  }

  return ((data ?? []) as Array<Partial<AdminSemana>>).map((r) => ({
    semana: String(r.semana ?? ""),
    registros: r.registros ?? 0,
    activaciones: r.activaciones ?? 0,
    cohorte_activados: r.cohorte_activados ?? 0,
  }));
}

/**
 * Saldo a MOSTRAR de una fila de la RPC.
 *
 * Misma suma que `getAvailableCredits` (src/lib/credits-grant.ts): lotes vivos del
 * ledger + contador legacy de user_credits. La RPC devuelve las dos partes por
 * separado justamente para que el criterio se aplique acá y no se duplique en SQL.
 *
 * Verificado contra la base el 2026-08-02: `ledger_remaining` coincide fila por
 * fila con el criterio de lote vivo de getAvailableCredits
 * (remaining > 0 AND (expires_at IS NULL OR expires_at > now())) en los 82
 * usuarios. Salvedad honesta: hoy no hay ningún lote con saldo ya expirado, así
 * que la parte de la expiración no está probada por los datos. Si algún día el
 * saldo del panel no cuadra con el que ve el usuario en /cuenta, este es el primer
 * lugar a revisar.
 */
export function saldoDeFila(row: AdminUserRow): number {
  return (row.ledger_remaining ?? 0) + (row.legacy_credits ?? 0);
}

/**
 * ── CRITERIO DE PAGO REAL ──
 *
 * `payments` no guarda solo transacciones: las filas con product='analysis_charge'
 * y amount=0 son el registro de consumo del análisis gratis. Contarlas como pagos
 * infla cualquier métrica de ingresos o conversión.
 *
 * Un pago real es: status='paid' AND amount > 0 AND product <> 'analysis_charge'.
 */
export const PRODUCTO_CONSUMO = "analysis_charge";

export interface PagoParcial {
  status?: string | null;
  amount?: number | null;
  product?: string | null;
}

export function esPagoReal(p: PagoParcial): boolean {
  return p.status === "paid" && (p.amount ?? 0) > 0 && p.product !== PRODUCTO_CONSUMO;
}

/**
 * Filtro PostgREST "no es una cuenta de prueba", para queries sobre tablas que
 * tienen user_id (analisis, payments, user_credits).
 *
 * Devuelve el string para `.or(...)`, o null cuando no hay que filtrar (lista
 * vacía o includeTest). El `user_id.is.null` NO es decorativo: en SQL
 * `user_id NOT IN (...)` da NULL —no true— cuando la columna es NULL, así que un
 * `.not("user_id","in",...)` pelado se comería también las filas sin dueño.
 */
export function filtroNoTest(testUserIds: string[]): string | null {
  if (testUserIds.length === 0) return null;
  return `user_id.is.null,user_id.not.in.(${testUserIds.join(",")})`;
}

/**
 * IDs de las cuentas internas (public.test_accounts). Tabla chica y de crecimiento
 * manual: se lee entera y se usa como lista de exclusión en las queries que las
 * RPCs no cubren (KPIs de ventana móvil, listados de pagos y boletas).
 */
export async function getTestAccountIds(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb.from("test_accounts").select("user_id");
  if (error) {
    console.error("[getTestAccountIds] query error:", error);
    return [];
  }
  return (data ?? []).map((r) => r.user_id as string);
}

/** Lee `?test=1` de los searchParams. Apagado por defecto. */
export function leerIncludeTest(v: string | string[] | undefined): boolean {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "1" || s === "true";
}
