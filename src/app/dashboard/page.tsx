import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis } from "@/lib/types";
import { ensureWelcomeEmail, resolveDisplayName } from "@/lib/welcome";
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

  // Fallback en cadena según proveedor (Google full_name/name · email+password
  // nombre · derivado del email). Antes solo miraba full_name/name → los
  // usuarios de email+password (que guardan el nombre en user_metadata.nombre)
  // recibían el welcome con "Hola," sin nombre.
  const fullName = resolveDisplayName(user.user_metadata, user.email);
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
      .eq("user_id", user.id)
      // Excluir filas bloqueadas pre-pago: no cuentan como análisis del usuario
      // hasta que el pago las desbloquee (pending_payment=false).
      .eq("pending_payment", false),
  ]);

  const needsOnboarding = !creditsRow?.onboarding_completed && (analisisCount ?? 0) === 0;

  if (needsOnboarding) {
    return <OnboardingClient />;
  }

  const { data: analisisList } = await supabase
    .from("analisis")
    .select("*")
    .eq("user_id", user.id)
    // Ocultar filas bloqueadas pre-pago de "Mis análisis" hasta el desbloqueo.
    .eq("pending_payment", false)
    .order("created_at", { ascending: false });

  const analisis = (analisisList || []) as Analisis[];

  return <DashboardClient analisis={analisis} firstName={firstName} />;
}
