import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";
import type { Analisis, FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { encodeShareToken } from "@/lib/share-token";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
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
  // "short-term") y ?str= debe ser STR. Paridad con guards LTR/STR (E.1.1):
  // SQL `tipo_analisis` es autoritativa; jsonb solo se consulta cuando SQL
  // es null (análisis pre-migration 20260510).
  const ltrSql = (ltrRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const strSql = (strRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const ltrIsSTR =
    ltrSql === "short-term" ||
    (ltrSql == null && (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  const strIsSTR =
    strSql === "short-term" ||
    (strSql == null && (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  if (ltrIsSTR || !strIsSTR) {
    redirect(user ? "/dashboard" : "/");
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResults = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResultsPersisted = (str.results ?? null) as STRResultsWithScore | null;

  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const userTier = user ? await getUserAccessLevel(user.id) : "guest";
  const isOwner = user?.id === ltr.user_id && ltr.user_id !== null;
  const isSharedView = isLoggedIn && !isOwner && !isAdmin;

  // Wallet status (in-line CTA al cierre)
  let userCredits = 0;
  let welcomeAvailable = true;
  if (user) {
    // SALDO real = ledger + legacy vía getAvailableCredits (mismo fix que
    // /analisis/[id], /cuenta, /perfil). welcome sale del contador.
    const { data: creditsRow } = await supabase
      .from("user_credits")
      .select("welcome_credit_used")
      .eq("user_id", user.id)
      .single();
    welcomeAvailable = !(creditsRow?.welcome_credit_used ?? false);
    userCredits = await getAvailableCredits(user.id, supabase);
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

  // Recompute-on-load del lado STR (espejo LTR, rama comparabilidad-motores). Sin esto la
  // comparativa mostraría el patrimonio STR viejo (con flujo) contra el LTR (sin flujo) →
  // incomparable. Recomputa desde input_data + airbnbRaw congelado, UF y fecha congeladas a
  // la creación de la fila STR. Idempotente, cero DB writes. El lado LTR queda persistido
  // (su motor no cambió en esta rama; su patrimonio ya era sin-flujo). Fallback al persistido
  // si falta airbnbRaw.
  const strPrecioUF = Number(strInput?.precioCompraUF) || 0;
  const strPrecioCLP = Number(strInput?.precioCompra) || 0;
  const strUfFrozen = strPrecioUF > 0 ? strPrecioCLP / strPrecioUF : ufValue;
  const strAsOfFrozen = new Date(str.created_at ?? new Date().toISOString());
  const strMediana = strInput
    ? await prefetchMedianaComunaVenta(
        supabase,
        {
          comuna: (strInput.comuna as string) ?? str.comuna ?? "",
          superficie: Number(strInput.superficieUtil) || 0,
          dormitorios: Number(strInput.dormitorios) || 0,
        },
        strUfFrozen,
      )
    : { mediana: null, n: 0 };
  const strResults = (recomputeShortTermForLegacy(
    strInput,
    strResultsPersisted,
    strUfFrozen,
    strAsOfFrozen,
    strMediana,
  ) ?? strResultsPersisted) as STRResultsWithScore | null;

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
