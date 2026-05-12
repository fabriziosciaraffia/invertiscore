import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { decodeShareToken } from "@/lib/share-token";
import type { Analisis, FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { SharedComparativaClient } from "./shared-client";

export const metadata: Metadata = {
  title: "Franco — Análisis comparativo Renta Larga vs Renta Corta",
  description: "Análisis honesto de inversión inmobiliaria. Renta larga vs renta corta lado a lado.",
  robots: { index: false, follow: false },
};

type LTRResultsWithCache = FullAnalysisResult & {
  comparativaAI?: AIAnalysisComparativa;
  tipoAnalisis?: string;
};

type STRResultsWithScore = ShortTermResult & {
  tipoAnalisis?: string;
  francoScore?: FrancoScoreSTR;
};

export default async function ShareComparativaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { print?: string };
}) {
  const decoded = decodeShareToken(params.token);
  if (!decoded) {
    notFound();
  }

  const supabase = createClient();
  const [{ data: ltrRow }, { data: strRow }, ufValue] = await Promise.all([
    supabase.from("analisis").select("*").eq("id", decoded.ltrId).single(),
    supabase.from("analisis").select("*").eq("id", decoded.strId).single(),
    getUFValue(),
  ]);

  if (!ltrRow || !strRow) {
    notFound();
  }

  const ltrType = (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  const strType = (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis;
  if (ltrType === "short-term" || strType !== "short-term") {
    notFound();
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResults = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResults = (str.results ?? null) as STRResultsWithScore | null;

  if (!ltrResults || !strResults) {
    notFound();
  }

  // Inputs específicos para tabla (amoblamiento, modo gestión)
  const strInput = (str.input_data ?? null) as Record<string, unknown> | null;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const modoGestion = ((strInput?.modoGestion as string) ?? "auto") as "auto" | "admin";
  const comisionAdministrador = (strInput?.comisionAdministrador as number) ?? 0.2;

  const printMode = searchParams.print === "true";

  return (
    <SharedComparativaClient
      ltrId={ltr.id}
      strId={str.id}
      nombre={ltr.nombre ?? str.nombre ?? ""}
      comuna={ltr.comuna ?? str.comuna ?? ""}
      direccion={ltr.direccion ?? str.direccion ?? ""}
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
      printMode={printMode}
      createdAt={ltr.created_at ?? str.created_at ?? new Date().toISOString()}
    />
  );
}
