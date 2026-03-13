import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis, FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { AnalysisNav } from "./analysis-nav";
import { PremiumResults } from "./results-client";
import { getUFValue } from "@/lib/uf";
import { getZoneComparison } from "@/lib/market-data";

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
  const results: FullAnalysisResult | null = analisis.results || null;

  // Access level: "guest" | "free" | "premium"
  const DEMO_ANALYSIS_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
  const isAdmin = user?.email === "fabriziosciaraffia@gmail.com";
  const isLoggedIn = !!user;
  const isDemo = analisis.id === DEMO_ANALYSIS_ID;
  const isPremium = isAdmin || isDemo || !!analisis.is_premium;
  const accessLevel: "guest" | "free" | "premium" = isDemo ? "premium" : !isLoggedIn ? "guest" : isPremium ? "premium" : "free";

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
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Navbar */}
      <AnalysisNav
        userId={user?.id ?? null}
        analysisId={analisis.id}
        score={analisis.score}
        nombre={analisis.nombre}
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
          freePrecioM2={results?.metrics?.precioM2 ?? precioM2}
          resumenEjecutivo={resumenEjecutivo}
          ufValue={ufValue}
          zoneData={zoneData}
          aiAnalysisInitial={(data as Record<string, unknown>).ai_analysis as Record<string, unknown> | undefined ?? undefined}
          nombre={analisis.nombre}
          ciudad={analisis.ciudad}
          createdAt={analisis.created_at}
          superficie={analisis.superficie}
          precioUF={analisis.precio}
        />

        {/* Fallback for old analyses without full results */}
        {!results && (
          <div className="mb-8 rounded-2xl border border-[#E6E6E2] bg-white p-6">
            <h3 className="mb-2 text-sm font-semibold">Resumen</h3>
            <p className="text-sm leading-relaxed text-[#71717A]">
              {analisis.resumen}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
