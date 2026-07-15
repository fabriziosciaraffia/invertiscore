import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { decodeShareToken } from "@/lib/share-token";
import type { Analisis, FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
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

  // Paridad con guards LTR/STR (E.1.1): SQL `tipo_analisis` es autoritativa;
  // jsonb solo se consulta cuando SQL es null (análisis pre-migration 20260510).
  const ltrSql = (ltrRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const strSql = (strRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const ltrIsSTR =
    ltrSql === "short-term" ||
    (ltrSql == null && (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  const strIsSTR =
    strSql === "short-term" ||
    (strSql == null && (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  if (ltrIsSTR || !strIsSTR) {
    notFound();
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResults = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResultsPersisted = (str.results ?? null) as STRResultsWithScore | null;

  if (!ltrResults || !strResultsPersisted) {
    notFound();
  }

  // Inputs específicos para tabla (amoblamiento, modo gestión)
  const strInput = (str.input_data ?? null) as Record<string, unknown> | null;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const modoGestion = ((strInput?.modoGestion as string) ?? "auto") as "auto" | "admin";
  const comisionAdministrador = (strInput?.comisionAdministrador as number) ?? 0.2;

  // Recompute-on-load del lado STR (espejo LTR, rama comparabilidad-motores). Igual que la
  // vista privada: patrimonio STR comparable con LTR. UF y fecha congeladas a la creación.
  // Idempotente, cero DB writes. Fallback al persistido si falta airbnbRaw.
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
  ) ?? strResultsPersisted) as STRResultsWithScore;

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
