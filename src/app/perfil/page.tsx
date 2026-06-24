import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSubscriptionAccess } from "@/lib/access";
import { getAvailableCredits } from "@/lib/credits-grant";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, CreditCard, Clock, Sparkles } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { ChangePasswordForm } from "./change-password-form";
import { isAdminUser } from "@/lib/admin";

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  product: string;
  created_at: string;
  analysis_id: string | null;
  commerce_order: string | null;
}

interface AnalysisInfo {
  id: string;
  nombre: string;
  score: number | null;
}

export default async function PerfilPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nombre = user.user_metadata?.nombre || user.user_metadata?.full_name || "Usuario";
  const email = user.email || "";
  const isAdmin = isAdminUser(email);
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  // Fetch user credits + subscription status
  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("credits, subscription_status, subscription_ends_at, grace_ends_at, is_unlimited, active_plan")
    .eq("user_id", user.id)
    .single();

  // Saldo real = ledger vivo (credit_grants) + contador legacy. Antes leía solo
  // creditsRow.credits (=0 en el modelo ledger) → "Gratuito" a quien sí tenía
  // crédito. RLS credit_grants_select_own permite leer los propios lotes.
  const credits: number = await getAvailableCredits(user.id, supabase);
  const subStatus: string = creditsRow?.subscription_status ?? "none";
  const graceEndsAt: string | null = (creditsRow?.grace_ends_at as string) ?? null;
  const subEnd: string | null = (creditsRow?.subscription_ends_at as string) ?? null;
  const isSubscriber = subStatus === "active";
  // Plan FINITO (plan10/plan50) vs ILIMITADO: un finito consume saldo del ledger →
  // ya NO es "ilimitado". Solo is_unlimited mantiene ese copy.
  const isUnlimited: boolean = creditsRow?.is_unlimited === true;
  const activePlan: string | null = (creditsRow?.active_plan as string) ?? null;
  // Cancelado con el ciclo pagado aún vigente: conserva acceso Pro hasta subEnd.
  // hasSubscriptionAccess es la fuente de verdad (now < ends_at), igual que access.ts.
  const isCancelledActive =
    subStatus === "cancelled" &&
    hasSubscriptionAccess({ subscription_status: subStatus, subscription_ends_at: subEnd });
  // Cargo recurrente falló pero la gracia sigue vigente (mantiene acceso). Reusamos
  // hasSubscriptionAccess como fuente de verdad de la comparación de gracia; seguro
  // server-side (esta página es Server Component). Ver access.ts.
  const isPastDueGrace =
    subStatus === "past_due" &&
    hasSubscriptionAccess({ subscription_status: subStatus, grace_ends_at: graceEndsAt });

  // Fetch payment history (filtered by user_id)
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, amount, status, product, created_at, analysis_id, commerce_order")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const payments: PaymentRow[] = paymentsData || [];

  // Fetch analysis info for the payments
  const analysisIds = Array.from(new Set(payments.map((p) => p.analysis_id).filter((id): id is string => !!id)));
  const analysisMap = new Map<string, AnalysisInfo>();
  if (analysisIds.length > 0) {
    const { data: analyses } = await supabase
      .from("analisis")
      .select("id, nombre, score")
      .in("id", analysisIds);
    for (const a of (analyses ?? []) as AnalysisInfo[]) {
      analysisMap.set(a.id, a);
    }
  }

  // Plan label + description
  let planLabel: string;
  let planDescription: string;
  let planCtaText: string | null = "Ver planes";
  let planCtaHref = "/pricing";

  if (isAdmin) {
    planLabel = "Admin";
    planDescription = "Acceso completo a todas las funciones.";
    planCtaText = null;
  } else if (isSubscriber && isUnlimited) {
    planLabel = "Suscripción Mensual";
    planDescription = "Análisis ilimitados + todas las variables del panel de ajustes.";
    planCtaText = "Gestionar";
    planCtaHref = "/pricing";
  } else if (isSubscriber) {
    // Plan FINITO (plan10/plan50): saldo REAL del ciclo (antes decía "ilimitados").
    // Solo plan10/plan50 explícitos; otro plan finito (futuro plan20, etc.) → genérico
    // "Suscripción" (no mostrar "Plan 10" a quien no lo tiene). El saldo se muestra igual.
    planLabel = activePlan === "plan10" ? "Plan 10" : activePlan === "plan50" ? "Plan 50" : "Suscripción";
    planDescription = `${credits} ${credits === 1 ? "análisis disponible" : "análisis disponibles"} · todas las variables.`;
    planCtaText = "Gestionar";
    planCtaHref = "/pricing";
  } else if (isPastDueGrace) {
    const graceDate = graceEndsAt
      ? new Date(graceEndsAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
      : "—";
    planLabel = "Pago pendiente";
    planDescription = `Tu último cobro no se procesó. Mantienes acceso hasta el ${graceDate}.`;
    planCtaText = "Actualiza tu método de pago →";
    planCtaHref = "/pricing";
  } else if (isCancelledActive) {
    const endDate = subEnd
      ? new Date(subEnd).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
      : "—";
    planLabel = "Suscripción cancelada";
    planDescription = `Acceso Pro hasta el ${endDate}.`;
    planCtaText = "Reactivar suscripción →";
    planCtaHref = "/pricing";
  } else if (credits > 0) {
    planLabel = "Análisis disponibles";
    planDescription = `Tienes ${credits} ${credits === 1 ? "análisis disponible" : "análisis disponibles"}. Úsalos cuando quieras.`;
    planCtaText = "Comprar más";
    planCtaHref = "/pricing";
  } else {
    planLabel = "Gratuito";
    planDescription = "Tu primer análisis es gratis. Para analizar más, compra análisis ($9.990) o suscríbete a un plan mensual.";
    planCtaText = "Ver planes";
    planCtaHref = "/pricing";
  }

  function fmtAmount(amount: number, commerceOrder: string | null): string {
    if (amount === 0 || (commerceOrder && commerceOrder.startsWith("credit-"))) return "Crédito";
    return "$" + amount.toLocaleString("es-CL");
  }

  function fmtProductName(product: string): string {
    if (product === "pro") return "Análisis";
    if (product === "pack3") return "Pack 3×";
    if (product === "subscription") return "Suscripción";
    return product;
  }

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="app" />

      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold text-[var(--franco-text)]">Mi Perfil</h1>

        {/* Datos personales */}
        <Card className="mb-6 border-[var(--franco-border)] bg-[var(--franco-card)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[var(--franco-text)]">Datos Personales</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[var(--franco-text-secondary)]">Nombre</div>
                <div className="font-medium text-[var(--franco-text)]">{nombre}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--franco-text-secondary)]">Email</div>
                <div className="font-medium text-[var(--franco-text)]">{email}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--franco-text-secondary)]">Fecha de registro</div>
                <div className="font-medium text-[var(--franco-text)]">{createdAt}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan actual */}
        <Card className="mb-6 border-[var(--franco-border)] bg-[var(--franco-card)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[var(--franco-text)]">Plan Actual</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-[var(--franco-text)]">{planLabel}</div>
                <p className="text-sm text-[var(--franco-text-secondary)]">{planDescription}</p>
              </div>
              {planCtaText && (
                <Link href={planCtaHref} className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border border-[var(--franco-border)] bg-[var(--franco-card)] text-[var(--franco-text)] font-body font-medium hover:bg-[var(--franco-elevated)] hover:border-[var(--franco-border-hover)]"
                  >
                    {planCtaText}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Créditos disponibles. Visible a no-suscriptores Y a finitos (plan10/plan50,
            que ahora consumen saldo). Oculto solo a ILIMITADOS (no aplica un contador).
            Nota: un ilimitado tiene credits=0, pero el !isUnlimited lo blinda por si
            quedan grants viejos. */}
        {credits > 0 && !isUnlimited && (
          <div className="mb-6 rounded-xl border border-[#C8323C]/30 bg-[var(--franco-card)] p-5 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-[#C8323C]" />
            <div className="font-mono text-3xl font-bold text-[#C8323C]">{credits}</div>
            <div className="mt-1 text-sm text-[var(--franco-text-muted)]">
              {credits === 1 ? "análisis disponible" : "análisis disponibles"}
            </div>
            <p className="mt-3 text-xs text-[var(--franco-text-muted)]">
              Úsalo en cualquier análisis tuyo desde la página de resultados.
            </p>
          </div>
        )}

        {/* Historial de pagos */}
        <Card className="mb-6 border-[var(--franco-border)] bg-[var(--franco-card)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[var(--franco-text)]">Historial de análisis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-[var(--franco-text-secondary)]">
                Aún no has comprado análisis.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => {
                  const analysis = p.analysis_id ? analysisMap.get(p.analysis_id) : null;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--franco-border)] p-3">
                      <div className="min-w-0 flex-1">
                        {analysis ? (
                          <Link href={`/analisis/${analysis.id}`} className="block truncate text-sm font-medium text-[var(--franco-text)] hover:underline">
                            {analysis.nombre}
                          </Link>
                        ) : (
                          <div className="text-sm font-medium text-[var(--franco-text)]">{fmtProductName(p.product)}</div>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--franco-text-secondary)]">
                          <span>{new Date(p.created_at).toLocaleDateString("es-CL")}</span>
                          {analysis && analysis.score != null && (
                            <>
                              <span className="text-[var(--franco-text-muted)]">·</span>
                              <span className="font-mono">Score {analysis.score}</span>
                            </>
                          )}
                          <span className="text-[var(--franco-text-muted)]">·</span>
                          <span>{fmtProductName(p.product)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-sm font-medium text-[#C8323C]">
                        {fmtAmount(p.amount, p.commerce_order)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cambiar contraseña */}
        <Card className="border-[var(--franco-border)] bg-[var(--franco-card)]">
          <CardHeader>
            <CardTitle className="text-[var(--franco-text)]">Cambiar Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
