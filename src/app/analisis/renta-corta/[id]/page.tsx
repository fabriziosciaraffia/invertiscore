import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { STRResultsClient } from "./results-client";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { normalizeLegacyVerdict } from "@/lib/types";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("analisis")
    .select("nombre, comuna, results")
    .eq("id", params.id)
    .single();

  if (!data) {
    return { title: "Franco — Análisis de renta corta" };
  }

  const results = data.results as ShortTermResult | null;
  // Commit 1 · 2026-05-11: normalizar veredicto legacy en metadata.
  const veredicto = normalizeLegacyVerdict(results?.veredicto) ?? "Análisis";
  const title = `Renta Corta: ${data.nombre} — ${veredicto}`;
  const description = `Análisis de renta corta en ${data.comuna}. Veredicto: ${veredicto}.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/analisis/renta-corta/${params.id}`,
      siteName: "Franco",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function STRResultPage({
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

  const results = data.results as (ShortTermResult & { tipoAnalisis?: string }) | null;

  // Redirect to LTR page if not a short-term analysis
  if (!results?.tipoAnalisis || results.tipoAnalisis !== "short-term") {
    redirect(`/analisis/${params.id}`);
  }

  // Access level determination (same pattern as LTR)
  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const isOwner = user?.id === data.user_id && data.user_id !== null;
  const isSharedView = isLoggedIn && !isOwner && !isAdmin;
  const isPremium = isAdmin || !!data.is_premium;

  const userTier = user ? await getUserAccessLevel(user.id) : "guest";

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

  let accessLevel: "guest" | "free" | "premium" | "subscriber";
  if (isAdmin) {
    accessLevel = "subscriber";
  } else if (!isLoggedIn) {
    accessLevel = "guest";
  } else if (userTier === "subscriber") {
    accessLevel = "subscriber";
  } else if (isSharedView) {
    accessLevel = data.is_premium ? "premium" : "free";
  } else {
    accessLevel = isPremium ? "premium" : "free";
  }

  const sharedProps = {
    analysisId: data.id,
    results,
    inputData: data.input_data,
    accessLevel,
    ufValue,
    nombre: data.nombre ?? "",
    comuna: data.comuna ?? "",
    ciudad: data.ciudad ?? "",
    superficie: data.superficie ?? 0,
    createdAt: data.created_at ?? "",
    userId: user?.id ?? null,
    isSharedView,
    userCredits,
    welcomeAvailable,
    aiAnalysisInitial: data.ai_analysis ?? null,
  };

  return <STRResultsClient {...sharedProps} />;
}
