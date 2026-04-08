import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";
import { AdminActions } from "./admin-actions";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

function fmtRelative(date: string | null | undefined): string {
  if (!date) return "—";
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function isStale(date: string | null | undefined, hoursThreshold: number): boolean {
  if (!date) return true;
  const ms = Date.now() - new Date(date).getTime();
  return ms > hoursThreshold * 60 * 60 * 1000;
}

function fmtDateShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtToday(): string {
  return new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

export default async function AdminPage() {
  // Auth check
  const supabaseAuth = createServerSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminUser(user.email)) redirect("/dashboard");

  const sb = admin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
    sb.from("payments").select("created_at").eq("status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle(),
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

  // ─── KPIs ───
  const [
    newUsersRow,
    newAnalisisRow,
    newPremiumRow,
    paidPaymentsRow,
    aiAnalisisRow,
  ] = await Promise.all([
    sb.from("user_credits").select("*", { count: "exact", head: true }).gte("updated_at", thirtyDaysAgo),
    sb.from("analisis").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    sb.from("analisis").select("*", { count: "exact", head: true }).eq("is_premium", true).gte("created_at", thirtyDaysAgo),
    sb.from("payments").select("amount").eq("status", "paid").gte("created_at", thirtyDaysAgo),
    sb.from("analisis").select("*", { count: "exact", head: true }).not("ai_analysis", "is", null).gte("created_at", thirtyDaysAgo),
  ]);

  const newUsers = newUsersRow.count ?? 0;
  const newAnalisis = newAnalisisRow.count ?? 0;
  const newPremium = newPremiumRow.count ?? 0;
  const ingresos = (paidPaymentsRow.data ?? []).reduce(
    (s: number, p: { amount: number | null }) => s + (p.amount ?? 0),
    0
  );
  const aiCount = aiAnalisisRow.count ?? 0;
  const aiCost = aiCount * 150;

  // ─── ÚLTIMOS PAGOS ───
  const { data: paymentsData } = await sb
    .from("payments")
    .select("id, user_id, product, amount, status, created_at, commerce_order")
    .order("created_at", { ascending: false })
    .limit(10);

  // Get emails for the payment users (single listUsers call)
  const { data: usersList } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map<string, string>();
  for (const u of usersList?.users ?? []) {
    if (u.id && u.email) emailById.set(u.id, u.email);
  }

  // ─── ÚLTIMOS USUARIOS ───
  const { data: recentUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 10 });

  const recentUserIds = (recentUsers?.users ?? []).map((u) => u.id);
  const { data: creditsForUsers } = recentUserIds.length
    ? await sb.from("user_credits").select("user_id, credits, subscription_status").in("user_id", recentUserIds)
    : { data: [] };
  const creditsMap = new Map<string, { credits: number; subscription_status: string }>();
  for (const c of (creditsForUsers ?? []) as Array<{ user_id: string; credits: number; subscription_status: string }>) {
    creditsMap.set(c.user_id, { credits: c.credits, subscription_status: c.subscription_status });
  }

  const { data: lastAnalisisPerUser } = recentUserIds.length
    ? await sb.from("analisis").select("user_id, created_at").in("user_id", recentUserIds).order("created_at", { ascending: false })
    : { data: [] };
  const lastAnalisisMap = new Map<string, string>();
  for (const a of (lastAnalisisPerUser ?? []) as Array<{ user_id: string; created_at: string }>) {
    if (!lastAnalisisMap.has(a.user_id)) lastAnalisisMap.set(a.user_id, a.created_at);
  }

  // ─── ANÁLISIS COMPARTIDOS ───
  const { count: sharedCount } = await sb
    .from("analisis")
    .select("*", { count: "exact", head: true })
    .not("user_id", "is", null);

  const { data: lastPro } = await sb
    .from("analisis")
    .select("id, comuna, score, created_at")
    .eq("is_premium", true)
    .order("created_at", { ascending: false })
    .limit(5);

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
      value: lastPaidPayment.data ? fmtRelative(lastPaidPayment.data.created_at as string) : "sin pagos",
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

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#FAFAF8]">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#FAFAF8]">Panel de Administración</h1>
            <p className="font-mono text-sm text-[#71717A] mt-1">{fmtToday()}</p>
          </div>
          <Link href="/dashboard" className="text-sm text-[#71717A] hover:text-[#FAFAF8] font-body">
            ← Volver al sitio
          </Link>
        </div>

        {/* ─── SECCIÓN 1: HEALTH CHECK ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Health Check</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pills.map((p) => {
              const dotColor =
                "status" in p && p.status === "warn"
                  ? "#D97706"
                  : p.ok
                  ? "#16A34A"
                  : "#C8323C";
              return (
                <div
                  key={p.label}
                  className="shrink-0 flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#141414] px-3 py-2"
                >
                  <span style={{ color: dotColor }}>●</span>
                  <div className="flex flex-col">
                    <span className="font-body text-[10px] uppercase tracking-wide text-[#71717A]">
                      {p.label}
                    </span>
                    <span className="font-mono text-xs text-[#FAFAF8]">{p.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── SECCIÓN 2: KPIs ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">KPIs · Últimos 30 días</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Usuarios nuevos", value: fmtNumber(newUsers) },
              { label: "Análisis totales", value: fmtNumber(newAnalisis) },
              { label: "Análisis Pro", value: fmtNumber(newPremium) },
              { label: "Ingresos", value: fmtCLP(ingresos) },
              { label: "Costo IA estimado", value: `~${fmtCLP(aiCost)}`, sub: `${fmtNumber(aiCount)} análisis IA` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4"
              >
                <div className="font-mono text-xl font-bold text-[#FAFAF8] truncate" title={kpi.value}>
                  {kpi.value}
                </div>
                <div className="font-body text-xs text-[#71717A] mt-1">{kpi.label}</div>
                {kpi.sub && (
                  <div className="font-mono text-[10px] text-[#71717A]/70 mt-0.5">{kpi.sub}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── SECCIÓN 3: ACCIONES RÁPIDAS ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Acciones rápidas</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4">
            <AdminActions />
            <p className="font-body text-[11px] text-[#71717A] mt-3">
              Ejecutan los endpoints CRON con el secret server-side. Los resultados se aplican inmediatamente a la base de datos.
            </p>
          </div>
        </section>

        {/* ─── SECCIÓN 4: ÚLTIMOS PAGOS ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Últimos pagos</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Fecha</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Email</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Producto</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Monto</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(paymentsData ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="font-body text-sm text-[#71717A] py-3">
                      Sin pagos registrados.
                    </td>
                  </tr>
                )}
                {(paymentsData ?? []).map((p) => {
                  const productLabel =
                    p.product === "pro" ? "Pro" : p.product === "pack3" ? "Pack x3" : p.product === "subscription" ? "Suscripción" : p.product;
                  const isCredit = p.amount === 0 || (p.commerce_order && p.commerce_order.startsWith("credit-"));
                  const statusLabel =
                    p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : p.status === "pending" ? "Pendiente" : p.status;
                  const statusColor =
                    p.status === "paid" ? "#16A34A" : p.status === "rejected" ? "#C8323C" : "#D97706";
                  return (
                    <tr key={p.id} className="border-b border-[#1A1A1A] last:border-b-0">
                      <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">
                        {fmtDateShort(p.created_at as string)}
                      </td>
                      <td className="font-mono text-xs text-[#FAFAF8]/80 py-2 pr-4 truncate max-w-[200px]">
                        {emailById.get(p.user_id) ?? "—"}
                      </td>
                      <td className="font-body text-xs text-[#FAFAF8] py-2 pr-4">{productLabel}</td>
                      <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">
                        {isCredit ? "Crédito" : fmtCLP(p.amount as number)}
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

        {/* ─── SECCIÓN 5: ÚLTIMOS USUARIOS ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Últimos usuarios</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Fecha</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Email</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Créditos</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Plan</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2">Último análisis</th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers?.users ?? []).map((u) => {
                  const c = creditsMap.get(u.id);
                  const credits = c?.credits ?? 0;
                  const isSubscriber = c?.subscription_status === "active";
                  const planLabel = isSubscriber ? "Suscriptor" : credits > 0 ? "Pro" : "Free";
                  const planColor = isSubscriber ? "#16A34A" : credits > 0 ? "#C8323C" : "#71717A";
                  const lastAnalysis = lastAnalisisMap.get(u.id);
                  return (
                    <tr key={u.id} className="border-b border-[#1A1A1A] last:border-b-0">
                      <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">
                        {fmtDateShort(u.created_at)}
                      </td>
                      <td className="font-mono text-xs text-[#FAFAF8]/80 py-2 pr-4 truncate max-w-[200px]">
                        {u.email ?? "—"}
                      </td>
                      <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">{credits}</td>
                      <td className="py-2 pr-4">
                        <span
                          className="inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase"
                          style={{ color: planColor, borderColor: planColor }}
                        >
                          {planLabel}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-[#FAFAF8]/70 py-2">
                        {lastAnalysis ? fmtRelative(lastAnalysis) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── SECCIÓN 6: ANÁLISIS COMPARTIDOS ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Análisis compartidos</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4">
            <div className="mb-3">
              <div className="font-mono text-2xl font-bold text-[#FAFAF8]">{fmtNumber(sharedCount ?? 0)}</div>
              <div className="font-body text-xs text-[#71717A]">análisis con dueño (URL pública accesible)</div>
            </div>
            <div className="border-t border-[#1A1A1A] pt-3">
              <div className="font-body text-xs text-[#71717A] mb-2">Últimos análisis Pro generados</div>
              <ul className="space-y-1.5">
                {(lastPro ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/analisis/${a.id}`}
                      className="font-body text-sm text-[#FAFAF8] hover:text-[#C8323C] truncate"
                    >
                      {a.comuna ?? "—"}
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-[#FAFAF8]/70">Score {a.score}</span>
                      <span className="font-mono text-[10px] text-[#71717A]">{fmtRelative(a.created_at as string)}</span>
                    </div>
                  </li>
                ))}
                {(lastPro ?? []).length === 0 && (
                  <li className="font-body text-xs text-[#71717A]">Sin análisis Pro aún.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── SECCIÓN 7: COBERTURA ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Cobertura de datos</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Comuna</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Arriendos</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Ventas</th>
                  <th className="font-body text-xs font-medium text-[#71717A] pb-2">Último scraping</th>
                </tr>
              </thead>
              <tbody>
                {covRows.map((r) => {
                  const stale = isStale(r.ultimo, 7 * 24);
                  return (
                    <tr key={r.comuna} className="border-b border-[#1A1A1A] last:border-b-0">
                      <td className="font-body text-xs text-[#FAFAF8] py-1.5 pr-4">{r.comuna}</td>
                      <td className="font-mono text-xs text-[#FAFAF8] py-1.5 pr-4">{fmtNumber(r.arriendo)}</td>
                      <td className="font-mono text-xs text-[#FAFAF8] py-1.5 pr-4">{fmtNumber(r.venta)}</td>
                      <td
                        className="font-mono text-xs py-1.5"
                        style={{ color: stale ? "#C8323C" : "#FAFAF8" }}
                      >
                        {fmtRelative(r.ultimo)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#1A1A1A]">
                  <td className="font-body text-xs font-bold text-[#FAFAF8] py-2 pr-4">TOTAL</td>
                  <td className="font-mono text-xs font-bold text-[#FAFAF8] py-2 pr-4">{fmtNumber(covTotal.arriendo)}</td>
                  <td className="font-mono text-xs font-bold text-[#FAFAF8] py-2 pr-4">{fmtNumber(covTotal.venta)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
