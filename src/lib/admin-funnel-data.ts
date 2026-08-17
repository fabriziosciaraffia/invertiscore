// ─────────────────────────────────────────────────────────────────────────────
// Funnel de 7 pasos del panel admin — mundo post-cap (Fase B, estructura
// ratificada por Fabrizio):
//
//   1 Visitas (PostHog) · 2 Iniciaron análisis (PostHog) · 3 Análisis gratis
//   creado (Supabase: anon_cap + welcome) · 4 Cuenta creada (orgánico + claim)
//   · 5 Iniciaron pago · 6 Pagaron · 7 Recompraron (2+ pagos)
//
// Más el número grande: visitas por compra (paso 1 ÷ paso 6).
//
// PERÍODO obligatorio con corte en el deploy del cap (16-ago-2026): mezclar
// mundo-muro con mundo-cap ensucia toda tasa. Default "post". El corte es
// medianoche UTC del 16-ago — el deploy fue esa tarde (Chile), así que "post"
// incluye unas horas de mundo viejo; se prefiere un corte limpio y documentado
// a uno exacto e inauditable.
//
// UNIDADES: los pasos 3-7 cuentan IDENTIDADES, no filas. En el paso 3 el par
// AMBAS son dos filas de `analisis` con el mismo cobro — se deduplica por
// ambas_group_id (un gratis = una unidad). En 5-7 se cuenta user_id distinto.
//
// Este módulo NO conoce React: recibe el client service-role del gate admin y
// devuelve números. La página arma las etapas; el harness de capturas puede
// llamarlo igual.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCTO_CONSUMO } from "@/lib/admin-rpc";

/** Corte del deploy del cap anónimo (F2, merge 88468a9). Medianoche UTC. */
export const CAP_CUTOVER_ISO = "2026-08-16T00:00:00.000Z";

export type PeriodoFunnel = "post" | "pre" | "todo";

export function leerPeriodo(v: string | string[] | undefined): PeriodoFunnel {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "pre" || s === "todo" ? s : "post";
}

export function rangoPeriodo(p: PeriodoFunnel): { desde: string | null; hasta: string | null } {
  if (p === "post") return { desde: CAP_CUTOVER_ISO, hasta: null };
  if (p === "pre") return { desde: null, hasta: CAP_CUTOVER_ISO };
  return { desde: null, hasta: null };
}

export interface FunnelSupabase {
  /** Paso 3 — unidades de análisis gratis (par AMBAS = 1). */
  gratisTotal: number;
  gratisAnonCap: number;
  gratisWelcome: number;
  /** Paso 4 — cuentas creadas en el período. */
  cuentasTotal: number;
  cuentasClaim: number;
  cuentasOrganico: number;
  /** Pasos 5-7 — usuarios distintos. */
  iniciaronPago: number;
  pagaron: number;
  recompraron: number;
}

/**
 * Pagina una query PostgREST más allá del tope de 1000 filas por request.
 * `hacerQuery` recibe el rango y debe aplicar SIEMPRE el mismo orden implícito
 * (PostgREST es estable por PK con filtros idénticos). Tope duro de páginas
 * como backstop — hoy los volúmenes son cientos, no cientos de miles.
 */
async function paginar<T>(
  hacerQuery: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxPaginas = 30,
): Promise<T[]> {
  const todas: T[] = [];
  for (let p = 0; p < maxPaginas; p++) {
    const { data, error } = await hacerQuery(p * pageSize, (p + 1) * pageSize - 1);
    if (error) {
      console.error("[admin-funnel-data] query paginada falló:", error.message);
      break;
    }
    const filas = data ?? [];
    todas.push(...filas);
    if (filas.length < pageSize) break;
  }
  return todas;
}

/** Aplica el rango del período a una query por `created_at`. */
function conPeriodo<Q extends { gte: (c: string, v: string) => Q; lt: (c: string, v: string) => Q }>(
  q: Q,
  rango: { desde: string | null; hasta: string | null },
): Q {
  let out = q;
  if (rango.desde) out = out.gte("created_at", rango.desde);
  if (rango.hasta) out = out.lt("created_at", rango.hasta);
  return out;
}

/** Un día de la serie de tasas, lado Supabase. */
export interface DiaSupabase {
  /** YYYY-MM-DD en UTC, para casar con el `toStartOfDay` de HogQL. */
  dia: string;
  /** Unidades de análisis gratis creadas ese día (par AMBAS = 1). */
  gratis: number;
  /** Cuentas creadas ese día. */
  cuentas: number;
}

/**
 * Serie diaria de los tramos que salen de Supabase, desde `desdeIso`.
 *
 * El día se corta en UTC a propósito: HogQL agrupa con `toStartOfDay` sobre
 * timestamps UTC, y si un lado cortara en hora de Chile las tasas mezclarían
 * numerador y denominador de días distintos — un desfase de 4 h basta para
 * inventar picos que no existen.
 */
export async function serieSupabase(
  sb: SupabaseClient,
  opts: { desdeIso: string; testUserIds: string[]; includeTest: boolean },
): Promise<DiaSupabase[]> {
  const testSet = new Set(opts.includeTest ? [] : opts.testUserIds);

  const gratisRows = await paginar<{
    id: string;
    ambas_group_id: string | null;
    user_id: string | null;
    created_at: string;
  }>((d, h) =>
    sb
      .from("analisis")
      .select("id, ambas_group_id, user_id, created_at")
      .in("charge_mode", ["anon_cap", "welcome"])
      .gte("created_at", opts.desdeIso)
      .range(d, h),
  );

  // Set por día: el par AMBAS son dos filas que valen una unidad, igual que en
  // el funnel. Se deduplica DENTRO del día — un par que cruzara medianoche
  // contaría dos veces, pero las dos filas de un par nacen en la misma request.
  const gratisPorDia = new Map<string, Set<string>>();
  for (const r of gratisRows) {
    if (r.user_id && testSet.has(r.user_id)) continue;
    const dia = r.created_at.slice(0, 10);
    if (!gratisPorDia.has(dia)) gratisPorDia.set(dia, new Set());
    gratisPorDia.get(dia)!.add(r.ambas_group_id ?? r.id);
  }

  const usuarios: Array<{ id: string; created_at: string }> = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[admin-funnel-data] listUsers falló (serie):", error.message);
      break;
    }
    for (const u of data.users) usuarios.push({ id: u.id, created_at: u.created_at });
    if (data.users.length < 1000) break;
  }
  const cuentasPorDia = new Map<string, number>();
  for (const u of usuarios) {
    if (testSet.has(u.id)) continue;
    if (u.created_at < opts.desdeIso) continue;
    const dia = u.created_at.slice(0, 10);
    cuentasPorDia.set(dia, (cuentasPorDia.get(dia) ?? 0) + 1);
  }

  const dias = new Set(Array.from(gratisPorDia.keys()).concat(Array.from(cuentasPorDia.keys())));
  return Array.from(dias)
    .sort()
    .map((dia) => ({
      dia,
      gratis: gratisPorDia.get(dia)?.size ?? 0,
      cuentas: cuentasPorDia.get(dia) ?? 0,
    }));
}

export async function funnelSupabase(
  sb: SupabaseClient,
  opts: { periodo: PeriodoFunnel; testUserIds: string[]; includeTest: boolean },
): Promise<FunnelSupabase> {
  const rango = rangoPeriodo(opts.periodo);
  const testSet = new Set(opts.includeTest ? [] : opts.testUserIds);

  // ── Paso 3 · análisis gratis (filas → unidades) ──
  // El filtro de test va sobre user_id, y las filas anon_cap sin reclamar
  // tienen user_id NULL — esas son de usuarios reales por definición (las
  // cuentas internas están logueadas). Se filtra en JS para no pelear con el
  // NULL-en-.neq de PostgREST (regla de la casa).
  const gratisRows = await paginar<{ id: string; charge_mode: string; ambas_group_id: string | null; user_id: string | null }>(
    (d, h) =>
      conPeriodo(
        sb
          .from("analisis")
          .select("id, charge_mode, ambas_group_id, user_id")
          .in("charge_mode", ["anon_cap", "welcome"]),
        rango,
      ).range(d, h),
  );
  const unidadesAnon = new Set<string>();
  const unidadesWelcome = new Set<string>();
  for (const r of gratisRows) {
    if (r.user_id && testSet.has(r.user_id)) continue;
    const unidad = r.ambas_group_id ?? r.id;
    (r.charge_mode === "anon_cap" ? unidadesAnon : unidadesWelcome).add(unidad);
  }

  // ── Paso 4 · cuentas creadas (auth.users vía admin API, paginado) ──
  // No hay RPC con filtro de fecha y auth.users no es queryable por PostgREST;
  // con la base actual (cientos de usuarios) la paginación de listUsers es
  // barata. Si esto crece a decenas de miles, mover a RPC.
  const usuarios: Array<{ id: string; created_at: string }> = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[admin-funnel-data] listUsers falló:", error.message);
      break;
    }
    for (const u of data.users) usuarios.push({ id: u.id, created_at: u.created_at });
    if (data.users.length < 1000) break;
  }
  const enPeriodo = usuarios.filter((u) => {
    if (testSet.has(u.id)) return false;
    if (rango.desde && u.created_at < rango.desde) return false;
    if (rango.hasta && u.created_at >= rango.hasta) return false;
    return true;
  });

  // Desglose claim: dueños actuales de filas nacidas anónimas (charge_mode
  // 'anon_cap' con user_id ≠ NULL = fueron adoptadas por claim). La marca de
  // origen es permanente, así que esto no depende del hash ni de la ventana.
  const claimRows = await paginar<{ user_id: string | null }>((d, h) =>
    sb
      .from("analisis")
      .select("user_id")
      .eq("charge_mode", "anon_cap")
      .not("user_id", "is", null)
      .range(d, h),
  );
  const claimantes = new Set(claimRows.map((r) => r.user_id as string));
  const cuentasClaim = enPeriodo.filter((u) => claimantes.has(u.id)).length;

  // ── Pasos 5-7 · payments (filas → usuarios) ──
  // Pago REAL = amount > 0 y product ≠ analysis_charge (las filas de consumo
  // del gratis no son transacciones — criterio esPagoReal de admin-rpc).
  // "Iniciaron" = cualquier status (pending que quedó, paid, rejected):
  // la fila existe porque el usuario llegó al checkout.
  const pagoRows = await paginar<{ user_id: string | null; status: string | null; product: string | null; amount: number | null }>(
    (d, h) =>
      conPeriodo(
        sb
          .from("payments")
          .select("user_id, status, product, amount")
          .gt("amount", 0)
          .or(`product.is.null,product.neq.${PRODUCTO_CONSUMO}`),
        rango,
      ).range(d, h),
  );
  const iniciaron = new Set<string>();
  const pagosPorUser = new Map<string, number>();
  for (const p of pagoRows) {
    if (!p.user_id || testSet.has(p.user_id)) continue;
    iniciaron.add(p.user_id);
    if (p.status === "paid") pagosPorUser.set(p.user_id, (pagosPorUser.get(p.user_id) ?? 0) + 1);
  }
  const pagaron = pagosPorUser.size;
  let recompraron = 0;
  pagosPorUser.forEach((n) => {
    if (n >= 2) recompraron++;
  });

  return {
    gratisTotal: unidadesAnon.size + unidadesWelcome.size,
    gratisAnonCap: unidadesAnon.size,
    gratisWelcome: unidadesWelcome.size,
    cuentasTotal: enPeriodo.length,
    cuentasClaim,
    cuentasOrganico: enPeriodo.length - cuentasClaim,
    iniciaronPago: iniciaron.size,
    pagaron,
    recompraron,
  };
}
