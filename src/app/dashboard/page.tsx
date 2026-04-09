import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis } from "@/lib/types";
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

  // Check if user needs onboarding
  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  const needsOnboarding = !creditsRow?.onboarding_completed;

  if (needsOnboarding) {
    return <OnboardingClient />;
  }

  const { data: analisisList } = await supabase
    .from("analisis")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const analisis = (analisisList || []) as Analisis[];

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';

  return <DashboardClient analisis={analisis} firstName={firstName} />;
}
