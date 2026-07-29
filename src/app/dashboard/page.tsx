import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureWelcomeEmail, resolveDisplayName } from "@/lib/welcome";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import {
  queryDashboardRows,
  fetchAmbasSiblings,
  fetchDashboardStats,
  type AnalisisDashboardRow,
} from "@/lib/dashboard-query";
import { OnboardingClient } from "./onboarding-client";
import { Continuar } from "./continuar";
import { StatsStrip } from "./stats-strip";
import { Archive } from "./archive";
import { EmptyState } from "./empty-state";
import { parseParams, primeraFrase, PAGE_SIZE } from "./dashboard-helpers";

/**
 * Dashboard v2 — contrato `assets-export/mockup-dashboard.html`.
 *
 * Antes: `select("*")` traía los jsonb `results` + `input_data` de las 229 filas
 * del usuario para pintar una lista plana sin búsqueda, sin orden y sin
 * paginación. Ahora la página consulta la vista `analisis_dashboard`, que ya
 * viene aplanada, y el filtro/búsqueda/orden viajan en la URL (`?q=&mod=&v=
 * &sort=&dir=&page=`) para que el trabajo lo haga Postgres.
 *
 * Server Component puro: el único cliente son el input de búsqueda (debounce) y
 * los botones de acción de fila.
 */

// La lista depende de searchParams y de datos por usuario: nada que cachear.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = resolveDisplayName(user.user_metadata, user.email);
  const firstName = fullName.split(" ")[0] || "";

  // Welcome email server-side e idempotente, antes del branch de onboarding.
  await ensureWelcomeEmail(user.id, user.email, fullName);

  const [{ data: creditsRow }, { count: analisisCount }] = await Promise.all([
    supabase.from("user_credits").select("onboarding_completed").eq("user_id", user.id).single(),
    supabase
      .from("analisis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pending_payment", false),
  ]);

  // Un usuario con ≥1 análisis está onboardeado de facto, aunque la flag no se
  // haya seteado (ej: entró por /analisis/nuevo-v4 sin pasar por el dashboard).
  if (!creditsRow?.onboarding_completed && (analisisCount ?? 0) === 0) {
    return <OnboardingClient />;
  }

  const params = parseParams(searchParams);

  // «Cargar 25 más» acumula: la página N pide (N+1)×25 filas desde el inicio en
  // vez de saltar a un offset. Con 215 unidades el costo es irrelevante y la URL
  // sigue describiendo exactamente lo que se ve — un `?page=3` compartido
  // muestra las mismas 100 filas al que lo abre.
  const [stats, page] = await Promise.all([
    fetchDashboardStats(supabase, user.id),
    queryDashboardRows(supabase, {
      userId: user.id,
      q: params.q || undefined,
      modalidad: params.mod,
      veredicto: params.v,
      sort: params.sort,
      dir: params.dir,
      page: 0,
      pageSize: (params.page + 1) * PAGE_SIZE,
    }),
  ]);

  if (stats.total === 0) {
    return (
      <div className="min-h-screen bg-[var(--franco-bg)]">
        <UnifiedNav variant="app" />
        <div className="mx-auto max-w-[1100px] px-6 py-5">
          <EmptyState />
        </div>
      </div>
    );
  }

  // CONTINUAR ignora los filtros del archivo: son los 4 más recientes, siempre.
  const recientes = await queryDashboardRows(supabase, {
    userId: user.id,
    sort: "fecha",
    dir: "desc",
    page: 0,
    pageSize: 4,
  });

  // Los hermanos `str` de los pares AMBAS de ambas zonas, en una sola consulta,
  // y el «Siendo franco:» de la card hero — en paralelo, no encadenados.
  const groupIds = [...page.rows, ...recientes.rows]
    .map((r) => r.ambas_group_id)
    .filter((g): g is string => Boolean(g));
  const hero: AnalisisDashboardRow | undefined = recientes.rows[0];

  const [siblings, resumenRow] = await Promise.all([
    fetchAmbasSiblings(supabase, user.id, groupIds),
    // `resumen` es texto largo y no vive en la vista: se pide para UNA fila.
    hero
      ? supabase.from("analisis").select("resumen").eq("id", hero.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const heroResumen = primeraFrase(resumenRow?.data?.resumen);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="app" />

      <div className="mx-auto max-w-[1100px] px-6 pb-16 pt-5">
        {/* ── Header compacto: saludo + total + CTA en una línea ── */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-heading text-[22px] font-bold tracking-[-0.01em] text-[var(--franco-text)]">
              {firstName ? `${firstName}, estas son tus inversiones` : "Tus inversiones"}
            </h1>
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)]">
              {stats.total} {stats.total === 1 ? "análisis" : "análisis"}
            </span>
          </div>
          <Link
            href="/analisis/nuevo-v4"
            className="shrink-0 rounded-lg bg-signal-red px-[18px] py-2.5 font-body text-[13px] font-medium text-white no-underline"
          >
            Analizar inversión →
          </Link>
        </div>

        <Continuar rows={recientes.rows} siblings={siblings} heroResumen={heroResumen} />

        <StatsStrip stats={stats} params={params} />

        <Archive
          rows={page.rows}
          siblings={siblings}
          total={page.total}
          hasMore={page.hasMore}
          params={params}
          stats={stats}
        />
      </div>
    </div>
  );
}
