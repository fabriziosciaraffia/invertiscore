import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import type { Analisis, FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { readFrancoVerdict } from "@/lib/results-helpers";
import { ComparativaClient } from "./comparativa-client";

export const metadata: Metadata = {
  title: "Franco — Comparativa Renta Larga vs Renta Corta",
  description: "Compara qué modalidad de renta conviene más para tu departamento.",
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

  // Validación de IDs cruzados (Ronda 2a): ?ltr= debe ser análisis LTR
  // (no marcado como "short-term") y ?str= debe ser STR. Si están cruzados,
  // los datos en columnas quedarían incoherentes — mejor redirigir.
  const ltrType = (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  const strType = (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  if (ltrType === "short-term" || strType !== "short-term") {
    redirect(user ? "/dashboard" : "/");
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResults = (ltr.results ?? null) as FullAnalysisResult | null;
  const strResults = (str.results ?? null) as STRResultsWithScore | null;

  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const userTier = user ? await getUserAccessLevel(user.id) : "guest";
  const isOwner = user?.id === ltr.user_id && ltr.user_id !== null;

  let accessLevel: "guest" | "free" | "premium" | "subscriber";
  if (isAdmin) accessLevel = "subscriber";
  else if (!isLoggedIn) accessLevel = "guest";
  else if (userTier === "subscriber") accessLevel = "subscriber";
  else accessLevel = (ltr.is_premium || str.is_premium) ? "premium" : "free";

  return (
    <ComparativaClient
      ltrId={ltr.id}
      strId={str.id}
      nombre={ltr.nombre ?? str.nombre ?? ""}
      comuna={ltr.comuna ?? str.comuna ?? ""}
      ciudad={ltr.ciudad ?? str.ciudad ?? ""}
      dormitorios={ltr.dormitorios ?? str.dormitorios ?? 0}
      banos={ltr.banos ?? str.banos ?? 0}
      superficie={ltr.superficie ?? str.superficie ?? 0}
      precioUF={ltr.precio ?? str.precio ?? 0}
      arriendoLTR={ltrResults?.metrics?.ingresoMensual ?? ltr.arriendo ?? 0}
      ltrScore={ltr.score ?? 0}
      ltrVeredicto={readFrancoVerdict(ltrResults) ?? null}
      ltrFlujoMensual={ltrResults?.metrics?.flujoNetoMensual ?? 0}
      ltrRentBruta={ltrResults?.metrics?.rentabilidadBruta ?? 0}
      ltrNOI={(ltrResults?.metrics?.noi ?? 0) / 12}
      ltrDividendo={ltrResults?.metrics?.dividendo ?? 0}
      ltrEgresos={Math.max(0, (ltrResults?.metrics?.egresosMensuales ?? 0) - (ltrResults?.metrics?.dividendo ?? 0))}
      ltrMultiplicador={ltrResults?.exitScenario?.multiplicadorCapital ?? 0}
      strScore={strResults?.francoScore?.score ?? 0}
      strVeredicto={strResults?.veredicto ?? null}
      strIngresoBruto={strResults?.escenarios?.base?.ingresoBrutoMensual ?? 0}
      strNOI={strResults?.escenarios?.base?.noiMensual ?? 0}
      strFlujoMensual={strResults?.escenarios?.base?.flujoCajaMensual ?? 0}
      strCapRate={strResults?.escenarios?.base?.capRate ?? 0}
      strComisionMensual={strResults?.escenarios?.base?.comisionMensual ?? 0}
      strCostosOperativos={strResults?.escenarios?.base?.costosOperativos ?? 0}
      strDividendo={strResults?.dividendoMensual ?? 0}
      strSobreRentaPct={strResults?.comparativa?.sobreRentaPct ?? 0}
      ufValue={ufValue}
      accessLevel={accessLevel}
      isOwner={isOwner}
    />
  );
}
