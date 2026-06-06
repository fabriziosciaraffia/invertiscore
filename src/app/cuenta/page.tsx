import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSubscriptionAccess } from "@/lib/access";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CancelSubscriptionButton } from "./cancel-dialog";
import { DeleteAccountButton } from "./delete-account-button";

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CuentaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';

  // Fetch credits + subscription
  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("credits, subscription_status, subscription_ends_at, grace_ends_at")
    .eq("user_id", user.id)
    .single();

  const credits: number = creditsRow?.credits ?? 0;
  const subStatus: string = creditsRow?.subscription_status ?? "none";
  const subEnd: string | null = (creditsRow?.subscription_ends_at as string) ?? null;
  const graceEndsAt: string | null = (creditsRow?.grace_ends_at as string) ?? null;

  // Fetch payment history
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, product, amount, status, created_at, commerce_order")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const payments = paymentsData ?? [];

  // Plan state. isPastDueGrace = cargo recurrente falló pero la gracia sigue vigente
  // (mantiene acceso). Reusamos hasSubscriptionAccess como fuente de verdad de la
  // comparación de gracia (now < grace_ends_at); el && subStatus==='past_due' separa
  // este caso del 'active'. Seguro server-side: esta página es Server Component, así
  // que importar access.ts no filtra el admin client al bundle de cliente.
  const isSubscriber = subStatus === "active";
  // Cancelado pero con el ciclo pagado AÚN vigente: conserva acceso Pro hasta
  // subscription_ends_at. hasSubscriptionAccess es la fuente de verdad (now <
  // ends_at), igual que access.ts. El cancelado-vencido cae a free abajo.
  const isCancelledActive =
    subStatus === "cancelled" &&
    hasSubscriptionAccess({ subscription_status: subStatus, subscription_ends_at: subEnd });
  const isPastDueGrace =
    subStatus === "past_due" &&
    hasSubscriptionAccess({ subscription_status: subStatus, grace_ends_at: graceEndsAt });
  const hasCredits = credits > 0 && !isSubscriber && !isCancelledActive && !isPastDueGrace;
  const isFree = !isSubscriber && !isCancelledActive && !isPastDueGrace && credits === 0;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      {/* Navbar */}
      <UnifiedNav variant="app" />

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">{firstName ? `${firstName}, esta es tu cuenta` : "Tu cuenta"}</h1>
          <p className="font-mono text-sm text-[var(--franco-text-muted)] mt-1">{user.email}</p>
        </div>

        {/* ─── Sección 1: Tu Plan ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[var(--franco-text)]">Tu plan</h2>
          <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
            {isSubscriber && (
              <>
                <StatusBadge label="SUSCRIPTOR" tone="ink-400" />
                <p className="mt-3 font-body text-sm text-[var(--franco-text)]">Análisis Pro ilimitados</p>
                {subEnd && (
                  <p className="mt-1 font-body text-xs text-[var(--franco-text-muted)]">
                    Próxima renovación: {fmtDate(subEnd)}
                  </p>
                )}
                <div className="mt-4">
                  <CancelSubscriptionButton />
                </div>
              </>
            )}

            {isCancelledActive && (
              <>
                <StatusBadge label="CANCELADA" tone="ink-500" />
                <p className="mt-3 font-body text-sm text-[var(--franco-text)]">Tu suscripción fue cancelada</p>
                {subEnd && (
                  <p className="mt-1 font-body text-xs text-[var(--franco-text-muted)]">
                    Acceso Pro hasta: <span className="font-mono">{fmtDate(subEnd)}</span>
                  </p>
                )}
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-signal-red px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-signal-red/90"
                  >
                    Reactivar suscripción →
                  </Link>
                </div>
              </>
            )}

            {isPastDueGrace && (
              <>
                <StatusBadge label="PAGO PENDIENTE" tone="ink-700" />
                <p className="mt-3 font-body text-sm text-[var(--franco-text)]">
                  Tu último cobro no se procesó. Mantienes acceso hasta el {fmtDate(graceEndsAt)}.
                </p>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-signal-red px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-signal-red/90"
                  >
                    Actualiza tu método de pago →
                  </Link>
                </div>
              </>
            )}

            {hasCredits && (
              <>
                <StatusBadge label="PRO" tone="signal-red" />
                <p className="mt-3 font-body text-sm text-[var(--franco-text)]">
                  Tienes <strong className="font-mono">{credits}</strong> {credits === 1 ? "crédito" : "créditos"} para análisis Pro
                </p>
                <p className="mt-1 font-body text-xs text-[var(--franco-text-muted)]">
                  Cada análisis Pro consume 1 crédito
                </p>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-signal-red px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-signal-red/90"
                  >
                    Comprar más créditos →
                  </Link>
                </div>
              </>
            )}

            {isFree && (
              <>
                <StatusBadge label="FREE" tone="muted" />
                <p className="mt-3 font-body text-sm text-[var(--franco-text)]">
                  No tienes créditos ni suscripción activa
                </p>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-signal-red px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-signal-red/90"
                  >
                    Ver planes →
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ─── Sección 2: Historial de Compras ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[var(--franco-text)]">Historial de compras</h2>
          <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 overflow-x-auto">
            {payments.length === 0 ? (
              <p className="font-body text-sm text-[var(--franco-text-muted)] py-2">
                Todavía no has comprado nada.{" "}
                <Link href="/analisis/nuevo-v2" className="text-signal-red hover:underline">
                  Analiza tu primer departamento →
                </Link>
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Fecha</th>
                    <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Producto</th>
                    <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Monto</th>
                    <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const productLabel = p.product === "pro" ? "Análisis Pro" : p.product === "pack3" ? "Pack x3" : p.product === "subscription" ? "Suscripción Mensual" : p.product;
                    const isCredit = p.amount === 0 || (p.commerce_order && p.commerce_order.startsWith("credit-"));
                    const statusLabel = p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : "Pendiente";
                    const statusColor = p.status === "paid" ? "var(--ink-400)" : p.status === "rejected" ? "var(--signal-red)" : "var(--ink-500)";
                    return (
                      <tr key={p.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                        <td className="font-mono text-xs text-[var(--franco-text)] py-2 pr-4">{fmtDate(p.created_at)}</td>
                        <td className="font-body text-xs text-[var(--franco-text)] py-2 pr-4">{productLabel}</td>
                        <td className="font-mono text-xs text-[var(--franco-text)] py-2 pr-4">{isCredit ? "Crédito" : fmtCLP(p.amount)}</td>
                        <td className="py-2">
                          <span className="inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase" style={{ color: statusColor, borderColor: statusColor }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ─── Sección 3: Eliminar Cuenta ─── */}
        <section className="mt-16 border-t border-[var(--franco-border)] pt-8">
          <DeleteAccountButton />
        </section>
      </div>
    </div>
  );
}
