import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import type { Analisis, FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { encodeShareToken } from "@/lib/share-token";
import { ComparativaClient } from "./comparativa-client";

export const metadata: Metadata = {
  title: "Franco — Comparativa Renta Larga vs Renta Corta",
  description: "Compara qué modalidad de renta conviene más para tu departamento.",
};

type LTRResultsWithCache = FullAnalysisResult & {
  comparativaAI?: AIAnalysisComparativa;
  tipoAnalisis?: string;
};

type STRResultsWithScore = ShortTermResult & {
  tipoAnalisis?: string;
  francoScore?: FrancoScoreSTR;
};

export default async function ComparativaPage({
  searchParams,
}: {
  searchParams: { ltr?: string; str?: string };
}) {
  const supabase = createClient();
  const ltrId = searchParams.ltr;
  const strId = searchParams.str;

  const [{ data: { user } }, ufValue] = await Promise.all([
    supabase.auth.getUser(),
    getUFValue(),
  ]);

  if (!ltrId || !strId) {
    redirect(user ? "/dashboard" : "/");
  }

  const [{ data: ltrRow }, { data: strRow }] = await Promise.all([
    supabase.from("analisis").select("*").eq("id", ltrId).single(),
    supabase.from("analisis").select("*").eq("id", strId).single(),
  ]);

  if (!ltrRow || !strRow) {
    redirect(user ? "/dashboard" : "/");
  }

  // Validación de IDs cruzados: ?ltr= debe ser análisis LTR (no marcado como
  // "short-term") y ?str= debe ser STR. Si están cruzados redirigimos.
  const ltrType = (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  const strType = (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  if (ltrType === "short-term" || strType !== "short-term") {
    redirect(user ? "/dashboard" : "/");
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResults = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResults = (str.results ?? null) as STRResultsWithScore | null;

  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const userTier = user ? await getUserAccessLevel(user.id) : "guest";
  const isOwner = user?.id === ltr.user_id && ltr.user_id !== null;
  const isSharedView = isLoggedIn && !isOwner && !isAdmin;

  // Wallet status (in-line CTA al cierre)
  let userCredits = 0;
  let welcomeAvailable = true;
  if (user) {
    const { data: creditsRow } = await supabase
      .from("user_credits")
      .select("credits, welcome_credit_used")
      .eq("user_id", user.id)
      .single();
    userCredits = creditsRow?.credits ?? 0;
    welcomeAvailable = !(creditsRow?.welcome_credit_used ?? false);
  }

  let accessLevel: "guest" | "free" | "premium" | "subscriber";
  if (isAdmin) accessLevel = "subscriber";
  else if (!isLoggedIn) accessLevel = "guest";
  else if (userTier === "subscriber") accessLevel = "subscriber";
  else accessLevel = (ltr.is_premium || str.is_premium) ? "premium" : "free";

  // Inputs (necesarios para tabla side-by-side: amoblamiento, modo gestión)
  const strInput = (str.input_data ?? null) as Record<string, unknown> | null;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const modoGestion = ((strInput?.modoGestion as string) ?? "auto") as "auto" | "admin";
  const comisionAdministrador = (strInput?.comisionAdministrador as number) ?? 0.2;

  // Share token determinístico (Commit 3c) — sin DB column. Permite generar
  // URLs públicas `/share/comparativa/[token]` que decoderán al par (LTR, STR).
  const shareToken = encodeShareToken(ltr.id, str.id);

  return (
    <ComparativaClient
      ltrId={ltr.id}
      strId={str.id}
      shareToken={shareToken}
      nombre={ltr.nombre ?? str.nombre ?? ""}
      comuna={ltr.comuna ?? str.comuna ?? ""}
      ciudad={ltr.ciudad ?? str.ciudad ?? ""}
      dormitorios={ltr.dormitorios ?? str.dormitorios ?? 0}
      banos={ltr.banos ?? str.banos ?? 0}
      superficie={ltr.superficie ?? str.superficie ?? 0}
      precioUF={ltr.precio ?? str.precio ?? 0}
      ltrScore={ltr.score ?? 0}
      strScore={strResults?.francoScore?.score ?? 0}
      ltrResults={ltrResults}
      strResults={strResults}
      cachedAI={ltrResults?.comparativaAI ?? null}
      costoAmoblamiento={costoAmoblamiento}
      modoGestion={modoGestion}
      comisionAdministrador={comisionAdministrador}
      ufValue={ufValue}
      accessLevel={accessLevel}
      isOwner={isOwner}
      isSharedView={isSharedView}
      userCredits={userCredits}
      welcomeAvailable={welcomeAvailable}
    />
  );
}
