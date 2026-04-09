import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FrancoLogo from "@/components/franco-logo";
import { LogoutButton } from "@/components/logout-button";
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
    .select("credits, subscription_status, subscription_end")
    .eq("user_id", user.id)
    .single();

  const credits: number = creditsRow?.credits ?? 0;
  const subStatus: string = creditsRow?.subscription_status ?? "none";
  const subEnd: string | null = (creditsRow?.subscription_end as string) ?? null;

  // Fetch payment history
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, product, amount, status, created_at, commerce_order")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const payments = paymentsData ?? [];

  // Plan state
  const isSubscriber = subStatus === "active";
  const isCancelled = subStatus === "cancelled";
  const hasCredits = credits > 0 && !isSubscriber && !isCancelled;
  const isFree = !isSubscriber && !isCancelled && credits === 0;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#FAFAF8]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="font-body text-sm text-[#FAFAF8]/80 hover:text-[#FAFAF8] hover:bg-[#1A1A1A] px-3 py-1.5 rounded-md transition-colors"
            >
              ← Dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-[#FAFAF8]">{firstName ? `${firstName}, esta es tu cuenta` : "Tu cuenta"}</h1>
          <p className="font-mono text-sm text-[#71717A] mt-1">{user.email}</p>
        </div>

        {/* ─── Sección 1: Tu Plan ─── */}
        <section className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Tu plan</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-6">
            {isSubscriber && (
              <>
                <span className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase" style={{ color: "#16A34A", borderColor: "#16A34A" }}>
                  SUSCRIPTOR
                </span>
                <p className="mt-3 font-body text-sm text-[#FAFAF8]">Análisis Pro ilimitados</p>
                {subEnd && (
                  <p className="mt-1 font-body text-xs text-[#71717A]">
                    Próxima renovación: {fmtDate(subEnd)}
                  </p>
                )}
                <div className="mt-4">
                  <CancelSubscriptionButton />
                </div>
              </>
            )}

            {isCancelled && (
              <>
                <span className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase" style={{ color: "#D97706", borderColor: "#D97706" }}>
                  CANCELADA
                </span>
                <p className="mt-3 font-body text-sm text-[#FAFAF8]">Tu suscripción fue cancelada</p>
                {subEnd && (
                  <p className="mt-1 font-body text-xs text-[#71717A]">
                    Acceso Pro hasta: {fmtDate(subEnd)}
                  </p>
                )}
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-[#C8323C] px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-[#C8323C]/90"
                  >
                    Reactivar suscripción →
                  </Link>
                </div>
              </>
            )}

            {hasCredits && (
              <>
                <span className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase" style={{ color: "#C8323C", borderColor: "#C8323C" }}>
                  PRO
                </span>
                <p className="mt-3 font-body text-sm text-[#FAFAF8]">
                  Tienes <strong className="font-mono">{credits}</strong> {credits === 1 ? "crédito" : "créditos"} para análisis Pro
                </p>
                <p className="mt-1 font-body text-xs text-[#71717A]">
                  Cada análisis Pro consume 1 crédito
                </p>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-[#C8323C] px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-[#C8323C]/90"
                  >
                    Comprar más créditos →
                  </Link>
                </div>
              </>
            )}

            {isFree && (
              <>
                <span className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase" style={{ color: "#71717A", borderColor: "#71717A" }}>
                  FREE
                </span>
                <p className="mt-3 font-body text-sm text-[#FAFAF8]">
                  No tienes créditos ni suscripción activa
                </p>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-block rounded-md bg-[#C8323C] px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-[#C8323C]/90"
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
          <h2 className="font-heading text-lg font-bold mb-3 text-[#FAFAF8]">Historial de compras</h2>
          <div className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4 overflow-x-auto">
            {payments.length === 0 ? (
              <p className="font-body text-sm text-[#71717A] py-2">
                Todavía no has comprado nada.{" "}
                <Link href="/analisis/nuevo" className="text-[#C8323C] hover:underline">
                  Analiza tu primer departamento →
                </Link>
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Fecha</th>
                    <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Producto</th>
                    <th className="font-body text-xs font-medium text-[#71717A] pb-2 pr-4">Monto</th>
                    <th className="font-body text-xs font-medium text-[#71717A] pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const productLabel = p.product === "pro" ? "Análisis Pro" : p.product === "pack3" ? "Pack x3" : p.product === "subscription" ? "Suscripción Mensual" : p.product;
                    const isCredit = p.amount === 0 || (p.commerce_order && p.commerce_order.startsWith("credit-"));
                    const statusLabel = p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : "Pendiente";
                    const statusColor = p.status === "paid" ? "#16A34A" : p.status === "rejected" ? "#C8323C" : "#D97706";
                    return (
                      <tr key={p.id} className="border-b border-[#1A1A1A] last:border-b-0">
                        <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">{fmtDate(p.created_at)}</td>
                        <td className="font-body text-xs text-[#FAFAF8] py-2 pr-4">{productLabel}</td>
                        <td className="font-mono text-xs text-[#FAFAF8] py-2 pr-4">{isCredit ? "Crédito" : fmtCLP(p.amount)}</td>
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
        <section className="mt-16 border-t border-[#1A1A1A] pt-8">
          <DeleteAccountButton />
        </section>
      </div>
    </div>
  );
}
