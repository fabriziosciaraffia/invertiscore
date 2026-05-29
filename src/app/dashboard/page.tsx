import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis } from "@/lib/types";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { DashboardClient } from "./dashboard-client";
import { OnboardingClient } from "./onboarding-client";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';

  // Welcome email server-side e idempotente: se dispara tanto si el user ve
  // onboarding como si ve el dashboard, antes del branch needsOnboarding.
  // ensureWelcomeEmail nunca tira (fire-and-forget seguro).
  await ensureWelcomeEmail(user.id, user.email, fullName);

  // Check if user needs onboarding. Backlog #3 + UX fix #1: si el user ya
  // tiene ≥1 análisis está onboardeado de facto, aunque la flag onboarding_completed
  // no se haya seteado (ej: ruta /analisis/nuevo-v2 sin pasar antes por /dashboard).
  const [{ data: creditsRow }, { count: analisisCount }] = await Promise.all([
    supabase
      .from("user_credits")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("analisis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const needsOnboarding = !creditsRow?.onboarding_completed && (analisisCount ?? 0) === 0;

  if (needsOnboarding) {
    return <OnboardingClient />;
  }

  const { data: analisisList } = await supabase
    .from("analisis")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const analisis = (analisisList || []) as Analisis[];

  return <DashboardClient analisis={analisis} firstName={firstName} />;
}
