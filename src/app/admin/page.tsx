import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { conceptoBoleta, type PaymentForDTE } from "@/lib/openfactura/client";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { fmtCLP, fmtNumber, fmtRelative, fmtDateShort } from "@/lib/admin-format";
import {
  adminListUsers,
  adminMetrics,
  filtroNoTest,
  getTestAccountIds,
  leerIncludeTest,
  PRODUCTO_CONSUMO,
} from "@/lib/admin-rpc";
import { AdminActions } from "./admin-actions";
import { RetryButton } from "./retry-button";
import { AdminFunnel, type CheckoutAbandonado } from "./admin-funnel";
import { AdminSegmentos } from "./admin-segmentos";
import { ContextoBar } from "./test-toggle";

export const dynamic = "force-dynamic";

function isStale(date: string | null | undefined, hoursThreshold: number): boolean {
  if (!date) return true;
  const ms = Date.now() - new Date(date).getTime();
  return ms > hoursThreshold * 60 * 60 * 1000;
}

function fmtToday(): string {
  return new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Tope de usuarios que se traen para derivar el funnel y el mapa de correos.
 *
 * TODO(admin-metrics): mientras la base quepa acá esto es una sola query y sirve.
 * Pasado ese punto hay que mover el funnel a una RPC de agregación (las etapas son
 * COUNT/COUNT DISTINCT: se resuelven en SQL sin traer filas) en vez de subir el tope.
 */
const TOPE_USUARIOS = 1000;

/** `product <> 'analysis_charge'` sin comerse los NULL (en SQL `<>` sobre NULL da NULL). */
const SIN_CONSUMOS = `product.is.null,product.neq.${PRODUCTO_CONSUMO}`;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Auth check — gate compartido (src/lib/admin-auth.ts): anon client primero,
  // service role solo después de validar la allowlist. Mismos redirects.
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ─── Cuentas internas ───
  // Se leen SIEMPRE (aunque el toggle esté encendido) porque el conteo se muestra
  // en la barra de contexto y porque el badge "Interna" del listado los necesita.
  const testUserIds = await getTestAccountIds(sb);
  const noTest = includeTest ? null : filtroNoTest(testUserIds);
  const testIdSet = new Set(testUserIds);

  /** Aplica la exclusión de cuentas internas a un query, si corresponde. */
  const sinTest = <T extends { or: (f: string) => T }>(q: T): T => (noTest ? q.or(noTest) : q);

  // ─── HEALTH CHECK QUERIES ───
  const [
    analisisCount,
    propsActiveCount,
    propsLastScraped,
    ufConfig,
    lastPaidPayment,
    userCreditsCount,
    marketDataLatest,
    geocodeLatest,
  ] = await Promise.all([
    sb.from("analisis").select("*", { count: "exact", head: true }),
    sb.from("scraped_properties").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("scraped_properties").select("scraped_at").order("scraped_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("config").select("value, updated_at").eq("key", "uf_value").maybeSingle(),
    // Criterio de pago real: sin esto, cada consumo de crédito (analysis_charge,
    // $0) contaba como "último pago" y la pastilla nunca se ponía en rojo.
    sb
      .from("payments")
      .select("created_at")
      .eq("status", "paid")
      .gt("amount", 0)
      .or(SIN_CONSUMOS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("user_credits").select("*", { count: "exact", head: true }),
    sb.from("market_data").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("scraped_properties").select("scraped_at").not("lat", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const uf_value = ufConfig.data ? parseFloat(ufConfig.data.value as string) : 0;
  const ufUpdatedAt = ufConfig.data?.updated_at as string | undefined;
  const ufHealthy = uf_value > 30000 && !isStale(ufUpdatedAt, 48);

  const lastScrapedAt = propsLastScraped.data?.scraped_at as string | undefined;
  const scrapingHealthy = !isStale(lastScrapedAt, 48);

  const marketUpdatedAt = marketDataLatest.data?.updated_at as string | undefined;
  const marketHealthy = !isStale(marketUpdatedAt, 48);

  const geocodeAt = geocodeLatest.data?.scraped_at as string | undefined;
  const geocodeHealthy: "ok" | "warn" = geocodeAt ? "ok" : "warn";

  // ─── USUARIOS (una sola query) ───
  // De acá salen: el mapa de correos, el conteo de altas de los últimos 30 días y
  // tres de las cuatro etapas del funnel. Reemplaza el auth.admin.listUsers que
  // había antes (que además cortaba en 200 y dejaba correos en "—").
  const { rows: usuarios, total: usuariosTotal } = await adminListUsers(sb, {
    includeTest,
    limit: TOPE_USUARIOS,
    offset: 0,
  });
  const emailById = new Map<string, string>();
  for (const u of usuarios) {
    if (u.email) emailById.set(u.user_id, u.email);
  }
  const nuevos30d = usuarios.filter((u) => (u.created_at ?? "") >= thirtyDaysAgo).length;
  const usaronGratis = usuarios.filter((u) => u.welcome_credit_used === true).length;
  const pagaron = usuarios.filter((u) => (u.pagos_pagados ?? 0) > 0).length;

  // ─── KPIs 30 DÍAS ───
  const [newAnalisisRow, newPremiumRow, paidPaymentsRow, checkoutsRow, metrics] = await Promise.all([
    sinTest(sb.from("analisis").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo)),
    sinTest(
      sb
        .from("analisis")
        .select("*", { count: "exact", head: true })
        .eq("is_premium", true)
        .gte("created_at", thirtyDaysAgo)
    ),
    // Ingresos: antes sumaba TODAS las filas paid, incluidos los analysis_charge de
    // $0 (que no son transacciones) y las cuentas internas. Ahora aplica el
    // criterio de pago real. La suma sigue en JS porque PostgREST no expone SUM
    // sin una RPC, pero ya solo trae las filas que cuentan.
    sinTest(
      sb
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gt("amount", 0)
        .or(SIN_CONSUMOS)
        .gte("created_at", thirtyDaysAgo)
    ),
    // Etapa 3 del funnel: checkout iniciado y nunca confirmado. Se traen las filas
    // (no solo el conteo) porque con este volumen cada caso abandonado es
    // información: quién, qué producto y cuándo.
    sinTest(
      sb
        .from("payments")
        .select("id, user_id, product, amount, created_at")
        .eq("status", "pending")
        .gt("amount", 0)
        .order("created_at", { ascending: false })
        .limit(20)
    ),
    adminMetrics(sb, includeTest),
  ]);

  const newAnalisis = newAnalisisRow.count ?? 0;
  const newPremium = newPremiumRow.count ?? 0;
  const ingresos = (paidPaymentsRow.data ?? []).reduce(
    (s: number, p: { amount: number | null }) => s + (p.amount ?? 0),
    0
  );
  const aiCount = newPremium;
  const aiCost = aiCount * 150;

  const checkoutRows = (checkoutsRow.data ?? []) as Array<{
    id: string; user_id: string; product: string | null; amount: number | null; created_at: string;
  }>;
  const abandonados: CheckoutAbandonado[] = checkoutRows.map((p) => ({
    paymentId: p.id,
    email: emailById.get(p.user_id) ?? "—",
    producto: p.product ?? "—",
    monto: p.amount ?? 0,
    fecha: p.created_at,
    esTest: testIdSet.has(p.user_id),
  }));
  const iniciaronCheckout = new Set(checkoutRows.map((p) => p.user_id)).size;

  // ─── ÚLTIMOS PAGOS ───
  // Transacciones, en cualquier estado (pagado, rechazado, pendiente). Lo que se
  // excluye son los consumos de crédito: no son plata, son uso del análisis gratis.
  const { data: paymentsData } = await sinTest(
    sb
      .from("payments")
      .select("id, user_id, product, amount, status, created_at, commerce_order")
      .gt("amount", 0)
      .or(SIN_CONSUMOS)
      .order("created_at", { ascending: false })
      .limit(10)
  );

  // ─── DOCUMENTOS TRIBUTARIOS ───
  const { data: docsData } = await sinTest(
    sb
      .from("documentos_tributarios")
      .select(
        "id, payment_id, user_id, folio, monto_total, estado, ambiente, autoservicio_url, error_mensaje, created_at, payments(product, analysis_id, quantity, flow_order, commerce_order)"
      )
      .order("created_at", { ascending: false })
      .limit(50)
  );

  // Comuna del análisis atado (single con analysisId) → concepto "Análisis en {comuna}"
  // + link. Segunda query (mismo patrón que emailById): NO hay FK payments.analysis_id
  // → analisis, así que no se puede embeber anidado.
  const payOf = (d: { payments?: unknown }) =>
    (Array.isArray(d.payments) ? d.payments[0] : d.payments) as
      | { product?: string; analysis_id?: string | null; quantity?: number | null; flow_order?: number | null; commerce_order?: string | null }
      | null
      | undefined;
  const docAnalysisIds = Array.from(
    new Set(
      (docsData ?? [])
        .map((d) => payOf(d)?.analysis_id ?? null)
        .filter((x): x is string => !!x)
    )
  );
  const comunaByAnalysisId = new Map<string, string>();
  if (docAnalysisIds.length) {
    const { data: anRows } = await sb.from("analisis").select("id, comuna").in("id", docAnalysisIds);
    for (const a of (anRows ?? []) as Array<{ id: string; comuna: string | null }>) {
      if (a.comuna) comunaByAnalysisId.set(a.id, a.comuna);
    }
  }

  // ─── ANÁLISIS COMPARTIDOS ───
  const { count: sharedCount } = await sinTest(
    sb.from("analisis").select("*", { count: "exact", head: true }).not("user_id", "is", null)
  );

  const { data: lastPro } = await sinTest(
    sb
      .from("analisis")
      .select("id, comuna, score, created_at")
      .eq("is_premium", true)
      .order("created_at", { ascending: false })
      .limit(5)
  );

  // ─── COBERTURA DE DATOS ───
  const { data: coverage } = await sb
    .from("scraped_properties")
    .select("comuna, type, scraped_at")
    .eq("is_active", true);

  type CovRow = { arriendo: number; venta: number; ultimo: string };
  const covMap = new Map<string, CovRow>();
  for (const r of (coverage ?? []) as Array<{ comuna: string; type: string; scraped_at: string }>) {
    if (!r.comuna) continue;
    if (!covMap.has(r.comuna)) covMap.set(r.comuna, { arriendo: 0, venta: 0, ultimo: "" });
    const row = covMap.get(r.comuna)!;
    if (r.type === "arriendo") row.arriendo++;
    else if (r.type === "venta") row.venta++;
    if (!row.ultimo || r.scraped_at > row.ultimo) row.ultimo = r.scraped_at;
  }
  const covRows = Array.from(covMap.entries())
    .map(([comuna, v]) => ({ comuna, ...v }))
    .sort((a, b) => a.comuna.localeCompare(b.comuna));
  const covTotal = covRows.reduce(
    (acc, r) => ({ arriendo: acc.arriendo + r.arriendo, venta: acc.venta + r.venta }),
    { arriendo: 0, venta: 0 }
  );

  // Health pills config
  const pills = [
    {
      label: "Base de datos",
      value: `${fmtNumber(analisisCount.count ?? 0)} análisis`,
      ok: analisisCount.error == null,
    },
    {
      label: "Propiedades",
      value: `${fmtNumber(propsActiveCount.count ?? 0)} activas · ${fmtRelative(lastScrapedAt)}`,
      ok: (propsActiveCount.count ?? 0) > 0,
    },
    {
      label: "UF",
      value: uf_value > 0 ? `$${fmtNumber(Math.round(uf_value))}` : "—",
      ok: ufHealthy,
    },
    {
      label: "Pagos",
      value: lastPaidPayment.data ? `Último: ${fmtRelative(lastPaidPayment.data.created_at as string)}` : "sin pagos",
      ok: lastPaidPayment.data != null,
    },
    {
      label: "Usuarios",
      value: `${fmtNumber(userCreditsCount.count ?? 0)}`,
      ok: (userCreditsCount.count ?? 0) > 0,
    },
    {
      label: "Cron: Scraping",
      value: fmtRelative(lastScrapedAt),
      ok: scrapingHealthy,
    },
    {
      label: "Cron: UF/Tasa",
      value: fmtRelative(marketUpdatedAt),
      ok: marketHealthy,
    },
    {
      label: "Cron: Geocode",
      value: geocodeAt ? fmtRelative(geocodeAt) : "sin datos",
      status: geocodeHealthy,
    },
  ];

  const sufijoTest = includeTest ? " · con cuentas de prueba" : " · sin cuentas de prueba";

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Resumen</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">{fmtToday()}</p>
        </div>
      </div>

      <ContextoBar
        includeTest={includeTest}
        href={includeTest ? "/admin" : "/admin?test=1"}
        usuarios={usuariosTotal}
        testCount={testUserIds.length}
      />

      {/* ─── SECCIÓN 1: FUNNEL ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Funnel</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Todo el histórico{sufijoTest}
          </span>
        </div>
        <AdminFunnel
          includeTest={includeTest}
          abandonados={abandonados}
          etapas={[
            { valor: usuariosTotal, nombre: "Registrados", detalle: "Cuentas creadas" },
            { valor: usaronGratis, nombre: "Usaron el análisis gratis", detalle: "welcome_credit_used" },
            { valor: iniciaronCheckout, nombre: "Iniciaron checkout", detalle: "Pago pendiente sobre $0" },
            { valor: pagaron, nombre: "Pagaron", detalle: "Pago confirmado sobre $0" },
          ]}
        />
      </section>

      {/* ─── SECCIÓN 2: KPIs ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Últimos 30 días</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            {sufijoTest.replace(" · ", "")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Usuarios nuevos", value: fmtNumber(nuevos30d), sub: "alta de cuenta" },
            { label: "Análisis totales", value: fmtNumber(newAnalisis) },
            { label: "Análisis desbloqueados", value: fmtNumber(newPremium), sub: "is_premium" },
            { label: "Ingresos", value: fmtCLP(ingresos), sub: "pagos confirmados sobre $0" },
            { label: "Costo IA estimado", value: `~${fmtCLP(aiCost)}`, sub: `${fmtNumber(aiCount)} × $150 · sin medición real` },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4"
            >
              <div className="truncate font-mono text-xl font-bold text-[var(--franco-text)]" title={kpi.value}>
                {kpi.value}
              </div>
              <div className="mt-1 font-body text-xs text-[var(--franco-text-muted)]">{kpi.label}</div>
              {kpi.sub && (
                <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-tertiary)]">{kpi.sub}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECCIÓN 3: SEGMENTOS ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Segmentos</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            {fmtNumber(usuariosTotal)} usuarios
          </span>
        </div>
        <AdminSegmentos metrics={metrics} includeTest={includeTest} />
      </section>

      {/* ─── SECCIÓN 4: HEALTH CHECK ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Estado del sistema</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pills.map((p) => {
            const dotColor =
              "status" in p && p.status === "warn"
                ? "var(--ink-600)"
                : p.ok
                ? "var(--ink-400)"
                : "#C8323C";
            return (
              <div
                key={p.label}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2"
              >
                <span style={{ color: dotColor }}>●</span>
                <div className="flex flex-col">
                  <span className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">
                    {p.label}
                  </span>
                  <span className="font-mono text-xs text-[var(--franco-text)]">{p.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SECCIÓN 5: ACCIONES RÁPIDAS ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Acciones rápidas</h2>
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <AdminActions />
          <p className="mt-3 font-body text-[11px] text-[var(--franco-text-muted)]">
            Ejecutan los endpoints CRON con el secret server-side. Los resultados se aplican inmediatamente a la base de datos.
          </p>
        </div>
      </section>

      {/* ─── SECCIÓN 6: ÚLTIMOS PAGOS ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Últimos pagos</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Transacciones · sin consumos de crédito
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Fecha</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Correo</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Producto</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Monto</th>
                <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(paymentsData ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 font-body text-sm text-[var(--franco-text-muted)]">
                    Sin transacciones{includeTest ? "." : " de usuarios reales. Activá el toggle para ver las de cuentas internas."}
                  </td>
                </tr>
              )}
              {(paymentsData ?? []).map((p) => {
                const productLabel =
                  p.product === "pro" ? "Pro" : p.product === "pack3" ? "Pack x3" : p.product === "subscription" ? "Suscripción" : p.product;
                const statusLabel =
                  p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : p.status === "pending" ? "Pendiente" : p.status;
                const statusColor =
                  p.status === "paid" ? "var(--ink-400)" : p.status === "rejected" ? "#C8323C" : "var(--ink-600)";
                return (
                  <tr key={p.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtDateShort(p.created_at as string)}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {emailById.get(p.user_id) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text)]">{productLabel}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtCLP(p.amount as number)}
                    </td>
                    <td className="py-2">
                      <span
                        className="inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase"
                        style={{ color: statusColor, borderColor: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── SECCIÓN 7: ANÁLISIS COMPARTIDOS ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Análisis compartidos</h2>
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <div className="mb-3">
            <div className="font-mono text-2xl font-bold text-[var(--franco-text)]">{fmtNumber(sharedCount ?? 0)}</div>
            <div className="font-body text-xs text-[var(--franco-text-muted)]">análisis con dueño (URL pública accesible)</div>
          </div>
          <div className="border-t border-[var(--franco-border)] pt-3">
            <div className="mb-2 font-body text-xs text-[var(--franco-text-muted)]">Últimos análisis Pro generados</div>
            <ul className="space-y-1.5">
              {(lastPro ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/analisis/${a.id}`}
                    className="truncate font-body text-sm text-[var(--franco-text)] hover:text-[#C8323C]"
                  >
                    {a.comuna ?? "—"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-[var(--franco-text)]">Score {a.score}</span>
                    <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">{fmtRelative(a.created_at as string)}</span>
                  </div>
                </li>
              ))}
              {(lastPro ?? []).length === 0 && (
                <li className="font-body text-xs text-[var(--franco-text-muted)]">Sin análisis Pro aún.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── SECCIÓN 8: COBERTURA ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Cobertura de datos</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Comuna</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Arriendos</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Ventas</th>
                <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Último scraping</th>
              </tr>
            </thead>
            <tbody>
              {covRows.map((r) => {
                const stale = isStale(r.ultimo, 7 * 24);
                return (
                  <tr key={r.comuna} className="border-b border-[var(--franco-border)] last:border-b-0">
                    <td className="py-1.5 pr-4 font-body text-xs text-[var(--franco-text)]">{r.comuna}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-[var(--franco-text)]">{fmtNumber(r.arriendo)}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-[var(--franco-text)]">{fmtNumber(r.venta)}</td>
                    <td
                      className="py-1.5 font-mono text-xs"
                      style={{ color: stale ? "#C8323C" : "var(--franco-text)" }}
                    >
                      {fmtRelative(r.ultimo)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-[var(--franco-border)]">
                <td className="py-2 pr-4 font-body text-xs font-bold text-[var(--franco-text)]">TOTAL</td>
                <td className="py-2 pr-4 font-mono text-xs font-bold text-[var(--franco-text)]">{fmtNumber(covTotal.arriendo)}</td>
                <td className="py-2 pr-4 font-mono text-xs font-bold text-[var(--franco-text)]">{fmtNumber(covTotal.venta)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── SECCIÓN 9: DOCUMENTOS TRIBUTARIOS ─── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Documentos tributarios</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Fecha</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Correo</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Folio</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Concepto</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Monto</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Estado</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Ambiente</th>
                <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(docsData ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 font-body text-sm text-[var(--franco-text-muted)]">
                    Sin documentos tributarios{includeTest ? "." : " de usuarios reales."}
                  </td>
                </tr>
              )}
              {(docsData ?? []).map((d) => {
                const estado = d.estado as string;
                const tone: StatusBadgeTone =
                  estado === "emitido"
                    ? "ink-400"
                    : estado === "error"
                    ? "signal-red"
                    : estado === "anulado"
                    ? "ink-500"
                    : "muted";
                const estadoLabel =
                  estado === "emitido"
                    ? "Emitido"
                    : estado === "error"
                    ? "Error"
                    : estado === "anulado"
                    ? "Anulado"
                    : "Pendiente";
                const pay = payOf(d);
                const analysisId = pay?.analysis_id ?? null;
                const flowOrder = pay?.flow_order ?? null;
                const autoservicioUrl = (d.autoservicio_url as string | null) ?? null;
                // Concepto del caso (reusa conceptoBoleta del helper de facturación):
                // single+comuna → "Análisis en {comuna}"; single sin comuna → "{N} análisis";
                // plan* → glosa del plan. Si la comuna no resuelve (análisis borrado),
                // cae al fallback "{N} análisis" sin romper.
                const conceptoPayment = {
                  id: d.payment_id,
                  user_id: d.user_id,
                  product: pay?.product ?? "single",
                  amount: d.monto_total,
                  commerce_order: pay?.commerce_order ?? "",
                  quantity: pay?.quantity ?? 1,
                } as PaymentForDTE;
                const concepto = conceptoBoleta(
                  conceptoPayment,
                  analysisId ? { comuna: comunaByAnalysisId.get(analysisId) } : undefined
                );
                const ambiente = d.ambiente as string;
                return (
                  <tr key={d.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtDateShort(d.created_at as string)}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {emailById.get(d.user_id as string) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {d.folio ?? "—"}
                      {flowOrder != null && (
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-muted)]">
                          Flow {flowOrder}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text)]">
                      {concepto.label}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtCLP(d.monto_total as number)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge label={estadoLabel} tone={tone} className="text-[10px]" />
                      {estado === "error" && d.error_mensaje && (
                        <div
                          className="mt-1 max-w-[220px] truncate font-body text-xs text-[var(--franco-text-muted)]"
                          title={d.error_mensaje as string}
                        >
                          {d.error_mensaje as string}
                        </div>
                      )}
                    </td>
                    <td
                      className="py-2 pr-4 font-mono text-[10px] uppercase"
                      style={{ color: ambiente === "dev" ? "var(--ink-700)" : "var(--franco-text-muted)" }}
                    >
                      {ambiente}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col items-start gap-1">
                        {estado === "emitido" && autoservicioUrl && (
                          <a
                            href={autoservicioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-body text-xs text-[var(--franco-text-muted)] transition-colors hover:text-[#C8323C]"
                          >
                            Ver boleta →
                          </a>
                        )}
                        {analysisId && (
                          <Link
                            href={`/analisis/${analysisId}`}
                            className="font-body text-xs text-[var(--franco-text-muted)] transition-colors hover:text-[#C8323C]"
                          >
                            Ver análisis →
                          </Link>
                        )}
                        {estado === "error" && <RetryButton documentoId={d.id as string} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
