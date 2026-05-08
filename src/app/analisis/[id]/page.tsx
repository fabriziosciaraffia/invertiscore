import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Analisis, FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { AnalysisNav } from "./analysis-nav";
import { PremiumResults } from "./results-client";
import { getUFValue } from "@/lib/uf";
import { getZoneComparison } from "@/lib/market-data";
import { getUserAccessLevel } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { enrichMetricsLegacy } from "@/lib/analysis/enrich-metrics-legacy";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("analisis")
    .select("nombre, score, comuna, creator_name")
    .eq("id", params.id)
    .single();

  if (!data) {
    return { title: "Franco — Análisis de inversión inmobiliaria" };
  }

  const title = `Análisis Franco: ${data.nombre}`;
  const creatorText = data.creator_name ? `Análisis de ${data.creator_name} — ` : "";
  const description = `${creatorText}Franco Score: ${data.score}/100. Análisis de inversión inmobiliaria en ${data.comuna}.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
  const ogImageUrl = `${siteUrl}/api/og?id=${params.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/analisis/${params.id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      siteName: "Franco",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function AnalisisDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: { user } }, ufValue] = await Promise.all([
    supabase.auth.getUser(),
    getUFValue(),
  ]);

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    redirect(user ? "/dashboard" : "/");
  }

  const analisis = data as Analisis;
  const rawResults: FullAnalysisResult | null = analisis.results || null;
  const inputDataRaw = analisis.input_data as AnalisisInput | undefined;
  // Recompute on-load (Opción A — idempotente). Garantiza coherencia entre
  // snapshots persistidos pre-evolución del motor y runtime fresh:
  // - TIR Card 04 (snapshot) vs Card 08 (runtime) — cierra B3 H3 inconsistency.
  // - Precio sugerido header vs drawer — cierra Fase 3.6 v9 inconsistency.
  // - Metrics legacy sin gastos/contribuciones — cierra B1 NaN cascade.
  // Análisis nuevos (motor actual al guardar) son no-op funcional. AI
  // (`ai_analysis`) vive en columna separada y se preserva por construcción.
  // Si falta input_data (caso edge legacy), cae a enrichMetricsLegacy como
  // patch mínimo. Ver audit/sesionB-bug-snapshot/diagnostico.md.
  const results: FullAnalysisResult | null = inputDataRaw
    ? recomputeResultsForLegacy(inputDataRaw, ufValue)
    : (rawResults && rawResults.metrics
      ? { ...rawResults, metrics: enrichMetricsLegacy(rawResults.metrics, {} as AnalisisInput) }
      : rawResults);

  // Access level: "guest" | "free" | "premium" | "subscriber"
  const DEMO_ANALYSIS_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const isDemo = analisis.id === DEMO_ANALYSIS_ID;
  const isOwner = user?.id === analisis.user_id && analisis.user_id !== null;
  const isSharedView = isLoggedIn && !isOwner && !isAdmin;
  const isSharedLink = !isLoggedIn && !!analisis.user_id;
  const isPremium = isAdmin || isDemo || !!analisis.is_premium;

  // Fase 1: Guest sin registro → siempre redirigir a /register (sin excepciones)
  if (!user) {
    redirect('/register');
  }

  // Owner first name for personalization
  const ownerFullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const ownerFirstName = isOwner ? (ownerFullName.split(' ')[0] || '') : '';

  // Check user-level subscription/credits status
  const userTier = user ? await getUserAccessLevel(user.id) : "guest";

  // Fetch user credits + welcome flag para "use credit" CTA y WalletStatusCTA.
  let userCredits = 0;
  let welcomeAvailable = true;
  if (user) {
    const { data: credits } = await supabase
      .from("user_credits")
      .select("credits, welcome_credit_used")
      .eq("user_id", user.id)
      .single();
    userCredits = credits?.credits ?? 0;
    welcomeAvailable = !(credits?.welcome_credit_used ?? false);
  }

  // Pro CTA banner: total de analisis del user para threshold check.
  let analysesCount = 0;
  if (user) {
    const { count } = await supabase
      .from("analisis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    analysesCount = count ?? 0;
  }

  let accessLevel: "guest" | "free" | "premium" | "subscriber";
  if (isAdmin) {
    accessLevel = "subscriber";
  } else if (isDemo) {
    accessLevel = "premium";
  } else if (!isLoggedIn) {
    accessLevel = "guest";
  } else if (userTier === "subscriber") {
    accessLevel = "subscriber";
  } else if (isSharedView) {
    accessLevel = analisis.is_premium ? "premium" : "free";
  } else {
    accessLevel = isPremium ? "premium" : "free";
  }

  const UF_CLP = ufValue;

  // Basic metrics for free section (works with or without full results)
  const precioCLP = analisis.precio * UF_CLP;
  const yieldBruto = precioCLP > 0 ? ((analisis.arriendo * 12) / precioCLP * 100) : 0;
  const precioM2 = analisis.superficie > 0 ? analisis.precio / analisis.superficie : 0;
  const flujoEstimado = results?.metrics?.flujoNetoMensual ?? (analisis.arriendo - Math.round((analisis.precio * 0.8 * UF_CLP * 0.0472 / 12) / (1 - Math.pow(1 + 0.0472 / 12, -300))) - analisis.gastos - Math.round(analisis.contribuciones / 3));

  const resumenEjecutivo = results?.resumenEjecutivo ??
    `Inversión con score ${analisis.score}/100. Rentabilidad bruta ${yieldBruto.toFixed(1)}%.`;

  // Fetch zone comparison data
  const zoneData = await getZoneComparison(analisis.comuna);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Navbar */}
      <AnalysisNav
        userId={user?.id ?? null}
        analysisId={analisis.id}
        score={analisis.score}
        nombre={analisis.nombre}
        comuna={analisis.comuna}
        isSharedView={isSharedView}
      />

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <PremiumResults
          results={results}
          accessLevel={accessLevel}
          analysisId={analisis.id}
          inputData={analisis.input_data as AnalisisInput | undefined}
          comuna={analisis.comuna}
          score={analisis.score}
          freeYieldBruto={results?.metrics?.rentabilidadBruta ?? yieldBruto}
          freeFlujo={flujoEstimado}
          freePrecioM2={precioM2}
          resumenEjecutivo={resumenEjecutivo}
          ufValue={ufValue}
          zoneData={zoneData}
          aiAnalysisInitial={(data as Record<string, unknown>).ai_analysis as Record<string, unknown> | undefined ?? undefined}
          nombre={analisis.nombre}
          ciudad={analisis.ciudad}
          createdAt={analisis.created_at}
          superficie={analisis.superficie}
          precioUF={analisis.precio}
          creatorName={(data as Record<string, unknown>).creator_name as string | undefined}
          isSharedView={isSharedView}
          isSharedLink={isSharedLink}
          userCredits={userCredits}
          welcomeAvailable={welcomeAvailable}
          ownerFirstName={ownerFirstName}
          analysesCount={analysesCount}
          isLoggedIn={isLoggedIn}
        />

        {/* Fallback for old analyses without full results */}
        {!results && (
          <div className="mb-8 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
            <h3 className="mb-2 text-sm font-serif font-bold text-[var(--franco-text)]">Resumen</h3>
            <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              {analisis.resumen}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
