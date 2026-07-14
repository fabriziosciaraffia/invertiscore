import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Analisis, FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { AnalysisNav } from "./analysis-nav";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import { PremiumResults } from "./results-client";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { getZoneComparison } from "@/lib/market-data";
import { getUserAccessLevel } from "@/lib/access";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";
import { enrichMetricsLegacy } from "@/lib/analysis/enrich-metrics-legacy";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { prefetchMedianaComunaVenta, type MedianaComunaSnapshot } from "@/lib/api-helpers/analisis-pipeline";

// Replica el formato de fecha de la vista AMBAS (shared-client → formatFechaCorta):
// "7 de junio 2026". Usado en el header público de la vista guest.
function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

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
  searchParams,
}: {
  params: { id: string };
  searchParams?: { print?: string };
}) {
  // Modo print (PDF headless): renderiza el cuerpo del análisis sin chrome de
  // navegación ni CTAs de conversión, con AdvancedSection abierta, para que
  // Puppeteer lo capture completo. Ver api/.../pdf (2b).
  const printMode = searchParams?.print === "true";

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

  // Commit E.1.1 · 2026-05-13 — guard simétrico LTR↔STR con precedencia
  // estricta. La columna SQL `tipo_analisis` es autoritativa; el flag jsonb
  // `results.tipoAnalisis` se consulta SOLO cuando la columna es null
  // (análisis pre-migration 20260510). Sin esta precedencia, los 44 análisis
  // con metadata inconsistente (SQL=long-term, jsonb=short-term — restos de
  // bugs anteriores) producían un redirect loop entre LTR y STR.
  const rawTipo = (data as Record<string, unknown>).tipo_analisis;
  const rawResultsForGuard = (data as { results?: { tipoAnalisis?: string } }).results;
  if (
    rawTipo === "short-term" ||
    (rawTipo == null && rawResultsForGuard?.tipoAnalisis === "short-term")
  ) {
    redirect(`/analisis/renta-corta/${params.id}`);
  }

  const analisis = data as Analisis;
  const rawResults: FullAnalysisResult | null = analisis.results || null;
  const inputDataRaw = analisis.input_data as AnalisisInput | undefined;
  // Fix drift UF prosa↔KPI (Opción 3): el render recomputa con la UF CONGELADA al
  // crear (reconstruida desde precioCLP/precio), NO con la UF viva. Así los KPI
  // calzan con la prosa IA, que también usa la UF congelada (ai-generation.ts:716).
  // `ufValue` (getUFValue) queda solo como fallback para filas legacy sin precioCLP
  // reconstruible. Mismo patrón "snapshot congelado gana" que mediana_comuna_snapshot.
  // Ver of-audit-drift-uf.md.
  const ufFrozen = resolveUfForAnalysis(rawResults, inputDataRaw, ufValue, analisis.id);
  // Recompute on-load (Opción A — idempotente). Garantiza coherencia entre
  // snapshots persistidos pre-evolución del motor y runtime fresh:
  // - TIR Card 04 (snapshot) vs Card 08 (runtime) — cierra B3 H3 inconsistency.
  // - Precio sugerido header vs drawer — cierra Fase 3.6 v9 inconsistency.
  // - Metrics legacy sin gastos/contribuciones — cierra B1 NaN cascade.
  // Análisis nuevos (motor actual al guardar) son no-op funcional. AI
  // (`ai_analysis`) vive en columna separada y se preserva por construcción.
  // Si falta input_data (caso edge legacy), cae a enrichMetricsLegacy como
  // patch mínimo. Ver audit/sesionB-bug-snapshot/diagnostico.md.
  // Mediana comunal inyectada al recompute (sobreprecio-sync): permite que el
  // motor siembre el hallazgo de sobreprecio sync en el primer render, en vez de
  // depender del ai_analysis async.
  // Fase B — fuente única: el snapshot PRESENTE gana siempre (foto fija del
  // análisis). Si existe (mediana number O null), se usa tal cual — el null
  // congelado al crear se respeta (el recompute lo trata como "sin sobreprecio",
  // correcto) y NO se re-resuelve por render. FALLBACK a la resolución vieja
  // (prefetch vivo) SOLO cuando no hay snapshot (análisis pre-Fase A) — exactamente
  // el comportamiento previo (Fase 1). Mismo criterio "existe → usalo; ausente →
  // fallback" en las 3 lecturas, para que traten el caso null idéntico (sin
  // re-resolución no hay divergencia). El recompute recibe el mismo shape { mediana, n }.
  const medianaSnapshot = (data as Record<string, unknown>).mediana_comuna_snapshot as
    | MedianaComunaSnapshot
    | null
    | undefined;
  const medianaComuna = inputDataRaw
    ? (medianaSnapshot != null
        ? { mediana: medianaSnapshot.mediana, n: medianaSnapshot.n ?? 0 }
        : await prefetchMedianaComunaVenta(supabase, inputDataRaw, ufFrozen))
    : undefined;
  // Fecha de análisis CONGELADA a created_at (espejo de ufFrozen): el recompute
  // usa la fecha de creación de la fila, no la viva, para que meses-hasta-entrega,
  // plusvalía proyectada, penalty del score y prosa NO deriven entre recargas.
  // Ver of-datedrift-design.md.
  const asOfFrozen = new Date(analisis.created_at);
  const results: FullAnalysisResult | null = inputDataRaw
    ? recomputeResultsForLegacy(inputDataRaw, ufFrozen, medianaComuna, asOfFrozen)
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

  // Owner first name for personalization
  const ownerFullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const ownerFirstName = isOwner ? (ownerFullName.split(' ')[0] || '') : '';

  // Check user-level subscription/credits status
  const userTier = user ? await getUserAccessLevel(user.id) : "guest";

  // Fetch user credits + welcome flag para "use credit" CTA y WalletStatusCTA.
  let userCredits = 0;
  let welcomeAvailable = true;
  if (user) {
    // welcome_credit_used sale del contador; el SALDO real sale del ledger
    // (credit_grants + legacy) vía getAvailableCredits. Leer user_credits.credits
    // crudo era el bug: =0 en el modelo ledger → el wallet decía "sin créditos" a
    // quien sí tenía saldo comprado. RLS credit_grants_select_own permite leerlo
    // con el server client. Mismo fix que /cuenta y /perfil.
    const { data: creditsRow } = await supabase
      .from("user_credits")
      .select("welcome_credit_used")
      .eq("user_id", user.id)
      .single();
    welcomeAvailable = !(creditsRow?.welcome_credit_used ?? false);
    userCredits = await getAvailableCredits(user.id, supabase);
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

  const UF_CLP = ufFrozen;

  // Basic metrics for free section (works with or without full results)
  const precioCLP = analisis.precio * UF_CLP;
  const yieldBruto = precioCLP > 0 ? ((analisis.arriendo * 12) / precioCLP * 100) : 0;
  // Hero "$/M²": lee la cifra canónica del motor (sin estacionamiento, fuente
  // única compartida con la narración IA y las anomalías). Fallback al cómputo
  // local solo para filas legacy sin results.metrics.precioVsComuna.
  const precioM2 = results?.metrics?.precioVsComuna?.sujetoUfM2
    ?? (analisis.superficie > 0 ? analisis.precio / analisis.superficie : 0);
  const flujoEstimado = results?.metrics?.flujoNetoMensual ?? (analisis.arriendo - Math.round((analisis.precio * 0.8 * UF_CLP * 0.0472 / 12) / (1 - Math.pow(1 + 0.0472 / 12, -300))) - analisis.gastos - Math.round(analisis.contribuciones / 3));

  const resumenEjecutivo = results?.resumenEjecutivo ??
    `Inversión con score ${analisis.score}/100. Rentabilidad bruta ${yieldBruto.toFixed(1)}%.`;

  // Fetch zone comparison data
  const zoneData = await getZoneComparison(analisis.comuna);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Navbar — oculto en print mode (el PDF agrega su propio header) */}
      {!printMode && (accessLevel === "guest" ? (
        <PublicShareHeader date={formatFechaCorta(analisis.created_at)} />
      ) : (
        <AnalysisNav
          userId={user?.id ?? null}
          analysisId={analisis.id}
          score={analisis.score}
          nombre={analisis.nombre}
          comuna={analisis.comuna}
          isSharedView={isSharedView}
        />
      ))}

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
          ufValue={ufFrozen}
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
          printMode={printMode}
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
