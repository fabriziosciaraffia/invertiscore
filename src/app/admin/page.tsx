import { requireAdminPage } from "@/lib/admin-auth";
import { fmtCLP, fmtNumber } from "@/lib/admin-format";
import {
  adminOverview,
  adminWeeklyStats,
  filtroNoTest,
  getTestAccountIds,
  leerIncludeTest,
  PRODUCTO_CONSUMO,
} from "@/lib/admin-rpc";
import { AdminTitular } from "./admin-titular";
import { AdminFunnel, type CheckoutAbandonado } from "./admin-funnel";
import { AdminTendencia } from "./admin-tendencia";
import { ContextoBar } from "./test-toggle";

export const dynamic = "force-dynamic";

/** Semanas de la serie de tendencia. */
const SEMANAS = 12;

/** `product <> 'analysis_charge'` sin comerse los NULL (en SQL `<>` sobre NULL da NULL). */
const SIN_CONSUMOS = `product.is.null,product.neq.${PRODUCTO_CONSUMO}`;

function fmtToday(): string {
  return new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Resumen del panel: 4 bloques, en pirámide invertida.
 *
 *   1. Titular en prosa — qué está pasando, en una frase.
 *   2. Funnel proporcional — dónde se cae la gente.
 *   3. Tendencia — cómo viene, semana a semana, con cohortes.
 *   4. Tres KPIs — los números que se miran al final, no al principio.
 *
 * Todo lo operacional (estado del sistema, crons, cobertura, boletas) vive ahora
 * en /admin/operacion: son dos preguntas distintas —"¿cómo va el negocio?" y
 * "¿está todo funcionando?"— y mezclarlas hacía que ninguna se respondiera bien.
 *
 * Los agregados salen de admin_overview y admin_weekly_stats (SQL, sin traer
 * filas a JS). Si esas funciones todavía no están creadas en la base, las
 * llamadas devuelven vacío y la página se ve en cero en vez de caerse.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Gate compartido (src/lib/admin-auth.ts): anon client primero, service role
  // solo después de validar la allowlist.
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);

  const testUserIds = await getTestAccountIds(sb);
  const noTest = includeTest ? null : filtroNoTest(testUserIds);
  const testIdSet = new Set(testUserIds);

  const [overview, semanas, checkoutsRow] = await Promise.all([
    adminOverview(sb, includeTest),
    adminWeeklyStats(sb, { weeks: SEMANAS, includeTest }),
    // Los checkouts abandonados se traen como filas (no como conteo) porque con
    // este volumen cada caso es información: quién, qué producto y cuándo.
    (() => {
      const q = sb
        .from("payments")
        .select("id, user_id, product, amount, created_at")
        .eq("status", "pending")
        .gt("amount", 0)
        .or(SIN_CONSUMOS)
        .order("created_at", { ascending: false })
        .limit(20);
      return noTest ? q.or(noTest) : q;
    })(),
  ]);

  const checkoutRows = (checkoutsRow.data ?? []) as Array<{
    id: string; user_id: string; product: string | null; amount: number | null; created_at: string;
  }>;

  // Correos de los usuarios que aparecen en la tabla de abandonados — la única
  // identidad que esta página necesita resolver. Se piden por id (uno por
  // usuario ÚNICO, no por fila) en vez de paginar la base entera: la lista está
  // topeada en 20 filas y en la práctica son un puñado de usuarios.
  const idsAbandonados = Array.from(new Set(checkoutRows.map((p) => p.user_id)));
  const emailById = new Map<string, string>(
    (
      await Promise.all(
        idsAbandonados.map(async (id) => {
          const { data } = await sb.auth.admin.getUserById(id);
          return [id, data?.user?.email ?? ""] as const;
        })
      )
    ).filter(([, email]) => email !== "")
  );

  const abandonados: CheckoutAbandonado[] = checkoutRows.map((p) => ({
    paymentId: p.id,
    email: emailById.get(p.user_id) ?? "—",
    producto: p.product ?? "—",
    monto: p.amount ?? 0,
    fecha: p.created_at,
    esTest: testIdSet.has(p.user_id),
  }));

  const tasaActivacion =
    overview.registrados > 0 ? Math.round((overview.activaron / overview.registrados) * 100) : 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Resumen</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">{fmtToday()}</p>
        </div>
      </div>

      <ContextoBar
        includeTest={includeTest}
        href={includeTest ? "/admin" : "/admin?test=1"}
        usuarios={overview.registrados}
        testCount={testUserIds.length}
      />

      {/* ─── 1 · TITULAR ─── */}
      <section className="mb-8">
        <AdminTitular
          registrados={overview.registrados}
          nuevos30d={overview.nuevos_30d}
          activaron={overview.activaron}
          iniciaronCheckout={overview.iniciaron_checkout}
          pagaron={overview.pagaron}
          includeTest={includeTest}
        />
      </section>

      {/* ─── 2 · FUNNEL ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Dónde se cae</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Todo el histórico{includeTest ? " · con cuentas de prueba" : " · sin cuentas de prueba"}
          </span>
        </div>
        <AdminFunnel
          includeTest={includeTest}
          abandonados={abandonados}
          etapas={[
            {
              valor: overview.registrados,
              nombre: "Registrados",
              detalle: "Cuentas creadas",
              caida: "",
            },
            {
              valor: overview.activaron,
              nombre: "Activaron",
              detalle: "Generaron su primer análisis",
              caida: "se registraron y nunca generaron un análisis",
            },
            {
              valor: overview.iniciaron_checkout,
              nombre: "Iniciaron checkout",
              detalle: "Pago pendiente sobre $0",
              caida: "no abrieron el checkout",
            },
            {
              valor: overview.pagaron,
              nombre: "Pagaron",
              detalle: "Pago confirmado sobre $0",
              caida: "abandonaron el checkout",
            },
          ]}
        />
      </section>

      {/* ─── 3 · TENDENCIA ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Cómo viene</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Últimas {SEMANAS} semanas
          </span>
        </div>
        <AdminTendencia semanas={semanas} />
      </section>

      {/* ─── 4 · KPIs ─── */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Los tres números</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Últimos 30 días
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            valor={fmtNumber(overview.nuevos_30d)}
            label="Usuarios nuevos"
            sub={
              overview.registrados > 0
                ? `${Math.round((overview.nuevos_30d / overview.registrados) * 100)}% de toda la base`
                : undefined
            }
          />
          <Kpi
            valor={`${tasaActivacion}%`}
            label="Tasa de activación"
            sub={`${fmtNumber(overview.activaron)} de ${fmtNumber(overview.registrados)} generaron un análisis`}
          />
          <Kpi
            valor={fmtCLP(overview.ingresos_30d)}
            label="Ingresos"
            sub="pagos confirmados sobre $0"
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>
    </>
  );
}

function Kpi({
  valor,
  label,
  sub,
  className = "",
}: {
  valor: string;
  label: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 ${className}`}>
      <div className="truncate font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]" title={valor}>
        {valor}
      </div>
      <div className="mt-1 font-body text-[13px] text-[var(--franco-text)]">{label}</div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-tertiary)]">{sub}</div>}
    </div>
  );
}
