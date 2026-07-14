import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";
import { resolveDisplayName } from "@/lib/welcome";
import { readVeredicto } from "@/lib/results-helpers";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { fmtCLP, fmtNumber, fmtRelative, fmtDateShort, fmtPlanLabel } from "@/lib/admin-format";
import { fmtDec } from "@/components/analysis/utils";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Iniciales para el avatar (hasta 2 palabras del nombre resuelto).
function initials(name: string, email: string): string {
  const base = name.trim() || email.trim();
  if (!base) return "?";
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// Veredicto → tono Franco. BUSCAR OTRA es el único en Signal Red (criticidad);
// COMPRAR y AJUSTA SUPUESTOS van en Ink (regla del rojo de franco-design-system).
function veredictoTone(v: string): StatusBadgeTone {
  if (v === "BUSCAR OTRA") return "signal-red";
  if (v === "AJUSTA SUPUESTOS") return "ink-500";
  return "ink-400"; // COMPRAR
}

type TimelineEvent = {
  key: string;
  // Orden cronológico inverso. ms = epoch de la fecha del evento (null → al final).
  ms: number | null;
  node: React.ReactNode;
};

export default async function AdminUsuarioDetallePage({
  params,
}: {
  params: { id: string };
}) {
  // ─── Gate idéntico al de /admin (SIEMPRE antes del service role) ───
  const supabaseAuth = createServerSupabase();
  const { data: { user: adminUser } } = await supabaseAuth.auth.getUser();

  if (!adminUser) redirect("/login");
  if (!isAdminUser(adminUser.email)) redirect("/dashboard");

  const sb = admin();
  const userId = params.id;

  // ─── Resolver el usuario por id ───
  const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(userId);
  const targetUser = userRes?.user ?? null;
  if (userErr || !targetUser) notFound();

  const email = targetUser.email ?? "";
  const nombre = resolveDisplayName(targetUser.user_metadata, email);
  const phone = targetUser.phone || (targetUser.user_metadata?.phone as string | undefined) || "";

  // ─── Datos del usuario (todo para UN solo user) ───
  const nowIso = new Date().toISOString();
  const [
    creditsRes,
    liveGrantsRes,
    welcomeGrantRes,
    analisisRes,
    paymentsRes,
    docsRes,
  ] = await Promise.all([
    sb
      .from("user_credits")
      .select("credits, is_unlimited, subscription_status, active_plan, subscription_ends_at, grace_ends_at")
      .eq("user_id", userId)
      .maybeSingle(),
    // Lotes vivos: mismo criterio que getAvailableCredits/consumeCredit.
    sb
      .from("credit_grants")
      .select("source, remaining")
      .eq("user_id", userId)
      .gt("remaining", 0)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    // Grant de bienvenida (vivo o consumido) para el evento de timeline.
    sb
      .from("credit_grants")
      .select("granted_at")
      .eq("user_id", userId)
      .eq("source", "welcome")
      .order("granted_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb
      .from("analisis")
      .select("id, comuna, tipo, dormitorios, banos, superficie, precio, arriendo, tipo_analisis, pending_payment, is_premium, results, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb
      .from("payments")
      .select("id, amount, product, status, flow_order, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb
      .from("documentos_tributarios")
      .select("id, estado, folio, error_mensaje, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const credits = creditsRes.data ?? null;
  const isUnlimited = credits?.is_unlimited ?? false;
  const subStatus = credits?.subscription_status ?? "none";
  const activePlan = credits?.active_plan ?? null;
  const legacyCredits = credits?.credits ?? 0;

  // ─── Saldo del ledger + desglose por source ───
  const liveGrants = (liveGrantsRes.data ?? []) as Array<{ source: string; remaining: number | null }>;
  const ledgerSaldo = liveGrants.reduce((s, g) => s + (g.remaining ?? 0), 0);
  const saldoTotal = ledgerSaldo + legacyCredits;
  const porSource = new Map<string, number>();
  for (const g of liveGrants) {
    porSource.set(g.source, (porSource.get(g.source) ?? 0) + (g.remaining ?? 0));
  }
  const desglose = Array.from(porSource.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // ─── Badge de estado derivado (jerarquía mayor) ───
  const payments = (paymentsRes.data ?? []) as Array<{
    id: string; amount: number | null; product: string | null; status: string | null;
    flow_order: number | null; created_at: string;
  }>;
  const tienePagoPaid = payments.some((p) => p.status === "paid");
  const estadoBadge: { label: string; tone: StatusBadgeTone } = isUnlimited
    ? { label: "Ilimitado", tone: "ink-400" }
    : subStatus === "active"
    ? { label: activePlan ? fmtPlanLabel(activePlan) : "Suscriptor", tone: "ink-400" }
    : tienePagoPaid
    ? { label: "Pagador", tone: "ink-700" }
    : { label: "Gratis", tone: "muted" };

  // ─── Timeline: fusión de 4 fuentes ordenada por fecha desc ───
  const analisis = (analisisRes.data ?? []) as Array<{
    id: string; comuna: string | null; tipo: string | null; dormitorios: number | null;
    banos: number | null; superficie: number | null; precio: number | null; arriendo: number | null;
    tipo_analisis: string | null; pending_payment: boolean | null; is_premium: boolean | null;
    results: { veredicto?: string; francoVerdict?: string; engineSignal?: string } | null;
    created_at: string;
  }>;
  const docs = (docsRes.data ?? []) as Array<{
    id: string; estado: string; folio: number | null; error_mensaje: string | null; created_at: string;
  }>;

  const toMs = (d: string | null | undefined) => (d ? new Date(d).getTime() : null);
  const events: TimelineEvent[] = [];

  // a) ANÁLISIS
  for (const a of analisis) {
    const ufM2 = a.superficie && a.superficie > 0 && a.precio ? a.precio / a.superficie : null;
    const modalidad = a.tipo_analisis === "short-term" ? "STR" : "LTR";
    const href = a.tipo_analisis === "short-term" ? `/analisis/renta-corta/${a.id}` : `/analisis/${a.id}`;
    const veredicto = readVeredicto(a.results);
    const pending = a.pending_payment === true;
    events.push({
      key: `an-${a.id}`,
      ms: toMs(a.created_at),
      node: (
        <article
          className={`rounded-lg border p-3 ${
            pending ? "border-[var(--signal-red)]" : "border-[var(--franco-border)]"
          } bg-[var(--franco-card)]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-body text-sm font-medium text-[var(--franco-text)]">
                Análisis · {a.comuna ?? "—"}
                <span className="font-mono text-[10px] text-[var(--franco-text-muted)] ml-2">{modalidad}</span>
              </div>
              <div className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1">
                {[a.tipo, a.dormitorios != null ? `${a.dormitorios}D` : null, a.banos != null ? `${a.banos}B` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
                {ufM2 != null && <> · {fmtDec(ufM2, 1)} UF/m²</>}
                {a.arriendo != null && a.arriendo > 0 && <> · arriendo {fmtCLP(a.arriendo)}</>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {veredicto && (
                <StatusBadge label={veredicto} tone={veredictoTone(veredicto)} className="text-[10px]" />
              )}
              {pending && (
                <StatusBadge label="Pago no asociado" tone="signal-red" className="text-[10px]" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
              {fmtDateShort(a.created_at)} · {fmtRelative(a.created_at)}
            </span>
            <Link
              href={href}
              className="font-body text-xs text-[var(--franco-text-muted)] hover:text-[#C8323C] transition-colors"
            >
              Ver informe →
            </Link>
          </div>
        </article>
      ),
    });
  }

  // b) PAGOS
  for (const p of payments) {
    const statusLabel =
      p.status === "paid" ? "pagado" : p.status === "rejected" ? "rechazado" : p.status === "cancelled" ? "cancelado" : "pendiente";
    events.push({
      key: `pay-${p.id}`,
      ms: toMs(p.created_at),
      node: (
        <article className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="font-body text-sm text-[var(--franco-text)]">Pago · {statusLabel}</div>
            <span className="font-mono text-xs text-[var(--franco-text)] shrink-0">
              {p.amount != null ? fmtCLP(p.amount) : "—"}
            </span>
          </div>
          <div className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1">
            {[p.product, p.flow_order != null ? `Flow ${p.flow_order}` : null].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(p.created_at)} · {fmtRelative(p.created_at)}
          </div>
        </article>
      ),
    });
  }

  // c) BOLETAS
  for (const d of docs) {
    const esError = d.estado === "error";
    events.push({
      key: `doc-${d.id}`,
      ms: toMs(d.created_at),
      node: (
        <article
          className={`rounded-lg border p-3 ${
            esError ? "border-[var(--signal-red)]" : "border-[var(--franco-border)]"
          } bg-[var(--franco-card)]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="font-body text-sm text-[var(--franco-text)]">
              Boleta · {d.estado}
              {d.folio != null && (
                <span className="font-mono text-[11px] text-[var(--franco-text-muted)] ml-2">Folio {d.folio}</span>
              )}
            </div>
            {esError && <StatusBadge label="Error" tone="signal-red" className="text-[10px]" />}
          </div>
          {esError && d.error_mensaje && (
            <div className="font-body text-xs text-[var(--signal-red)] mt-1">{d.error_mensaje}</div>
          )}
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(d.created_at)} · {fmtRelative(d.created_at)}
          </div>
        </article>
      ),
    });
  }

  // d) BIENVENIDA
  const welcomeAt = welcomeGrantRes.data?.granted_at as string | undefined;
  if (welcomeAt) {
    events.push({
      key: "welcome",
      ms: toMs(welcomeAt),
      node: (
        <article className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
          <div className="font-body text-sm text-[var(--franco-text)]">Cuenta creada · análisis de bienvenida</div>
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(welcomeAt)} · {fmtRelative(welcomeAt)}
          </div>
        </article>
      ),
    });
  }

  // Orden cronológico inverso (sin fecha → al final).
  events.sort((a, b) => {
    if (a.ms == null) return 1;
    if (b.ms == null) return -1;
    return b.ms - a.ms;
  });

  const sourceLabel = (s: string): string => {
    if (s === "welcome") return "Bienvenida";
    if (s === "single") return "Compra individual";
    if (s.startsWith("plan10")) return "Plan 10";
    if (s.startsWith("plan50")) return "Plan 50";
    return s;
  };

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {/* ← Usuarios */}
        <div className="mb-6">
          <Link
            href="/admin/usuarios"
            className="text-sm text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] font-body"
          >
            ← Usuarios
          </Link>
        </div>

        {/* ─── HEADER IDENTIDAD ─── */}
        <header className="mb-8 flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-lg font-bold text-[var(--franco-text)]">
            {initials(nombre, email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">{nombre || "—"}</h1>
              <StatusBadge label={estadoBadge.label} tone={estadoBadge.tone} />
            </div>
            <p className="font-mono text-sm text-[var(--franco-text)] mt-1 break-all">{email || "—"}</p>
            <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-2">
              Registró {fmtDateShort(targetUser.created_at)}
              {" · "}Último acceso {fmtRelative(targetUser.last_sign_in_at)}
              {phone && <> · {phone}</>}
              {" · "}ID {userId.slice(0, 8)}…
            </p>
          </div>
        </header>

        {/* ─── GRID: timeline (62%) + sidebar (38%) ─── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.62fr_1fr]">
          {/* TIMELINE */}
          <section className="order-1">
            <h2 className="font-heading text-lg font-bold mb-3 text-[var(--franco-text)]">Timeline</h2>
            {events.length === 0 ? (
              <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 font-body text-sm text-[var(--franco-text-muted)]">
                Sin actividad registrada.
              </div>
            ) : (
              <div className="space-y-2.5">{events.map((e) => <div key={e.key}>{e.node}</div>)}</div>
            )}
          </section>

          {/* SIDEBAR */}
          <aside className="order-2 space-y-6">
            {/* Card SALDO */}
            <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
              <div className="font-body text-xs text-[var(--franco-text-muted)] mb-1">Saldo de análisis</div>
              {isUnlimited ? (
                <StatusBadge label="Ilimitado" tone="ink-400" />
              ) : (
                <div className="font-mono text-3xl font-bold text-[var(--franco-text)]">{fmtNumber(saldoTotal)}</div>
              )}
              <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">credit_grants</div>
              {desglose.length > 0 && (
                <div className="border-t border-[var(--franco-border)] mt-3 pt-3 space-y-1.5">
                  {desglose.map(([source, remaining]) => (
                    <div key={source} className="flex items-center justify-between gap-3">
                      <span className="font-body text-xs text-[var(--franco-text)]">{sourceLabel(source)}</span>
                      <span className="font-mono text-xs text-[var(--franco-text)]">{fmtNumber(remaining)}</span>
                    </div>
                  ))}
                </div>
              )}
              {legacyCredits > 0 && (
                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <span className="font-body text-xs text-[var(--franco-text-muted)]">Créditos legacy</span>
                  <span className="font-mono text-xs text-[var(--franco-text-muted)]">{fmtNumber(legacyCredits)}</span>
                </div>
              )}
            </div>

            {/* Card SUSCRIPCIÓN */}
            {subStatus !== "none" && (
              <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
                <div className="font-body text-xs text-[var(--franco-text-muted)] mb-2">Suscripción</div>
                <dl className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Plan</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">{activePlan ?? "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Estado</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">{subStatus}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Vence</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">
                      {fmtDateShort(credits?.subscription_ends_at)}
                    </dd>
                  </div>
                  {subStatus === "past_due" && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-body text-xs text-[var(--signal-red)]">Gracia hasta</dt>
                      <dd className="font-mono text-xs text-[var(--signal-red)]">
                        {fmtDateShort(credits?.grace_ends_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
