"use client";

import { useState, useEffect } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { LoadingEditorial } from "@/components/analysis/LoadingEditorial";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroVerdictBlock } from "./HeroVerdictBlock";
import { MiniCard } from "./MiniCard";
import { ReestructuracionMiniCard } from "./ReestructuracionMiniCard";
import { hasAiV2 } from "./AIInsightSection";

/**
 * Orquestador del análisis IA: Hero Verdict + Subject Card Grid 2×2 + card
 * Zona Wide Context + ReestructuracionMiniCard (opcional, financingHealth
 * Nivel 3) + drawers de detalle.
 *
 * Maneja 3 estados: loading (LoadingEditorial), error (retry CTA), ready
 * (render completo). Mantiene state interno de drawer activo.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3, ex-DashboardAnalysisSection).
 */
export function SubjectCardGrid({
  aiAnalysis,
  loading,
  error,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  onRetry,
  results,
  inputData,
  valorUF,
  analysisId,
  comuna,
}: {
  aiAnalysis: AIAnalysisV2 | null;
  loading: boolean;
  error: string | null;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  onRetry: () => void;
  results: FullAnalysisResult | null | undefined;
  inputData: AnalisisInput | null | undefined;
  valorUF: number;
  analysisId?: string;
  comuna?: string;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);

  // Preload zone-insight at dashboard mount (non-blocking).
  // Only fires if we have an analysisId and the analysis has coords (checked server-side).
  const {
    data: zoneInsight,
    loading: zoneLoading,
    error: zoneError,
  } = useZoneInsight(analysisId, !!analysisId);

  // Coords for the map — derived from input_data (same source the endpoint uses).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputAny = inputData as any;
  const zoneCenter =
    typeof inputAny?.lat === "number" && typeof inputAny?.lng === "number"
      ? { lat: inputAny.lat as number, lng: inputAny.lng as number }
      : typeof inputAny?.zonaRadio?.lat === "number" && typeof inputAny?.zonaRadio?.lng === "number"
        ? { lat: inputAny.zonaRadio.lat as number, lng: inputAny.zonaRadio.lng as number }
        : null;

  const hasReadyData = !!aiAnalysis && hasAiV2(aiAnalysis);
  const [loadingDismissed, setLoadingDismissed] = useState(hasReadyData);
  useEffect(() => {
    if (hasReadyData && !loadingDismissed) {
      const t = setTimeout(() => setLoadingDismissed(true), 1100);
      return () => clearTimeout(t);
    }
  }, [hasReadyData, loadingDismissed]);

  const showLoading = (loading && !aiAnalysis) || (hasReadyData && !loadingDismissed);

  if (showLoading) {
    return (
      <div id="informe-pro-section" className="mb-8 rounded-[16px] overflow-hidden">
        <LoadingEditorial isDataReady={hasReadyData} />
      </div>
    );
  }

  if ((error && !aiAnalysis) || (!aiAnalysis && !loading) || (aiAnalysis && !hasAiV2(aiAnalysis))) {
    return (
      <div id="informe-pro-section" className="mb-8">
        <div className="rounded-2xl bg-[var(--franco-card)] border border-[var(--franco-border)] p-8 text-center">
          <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-4">
            No pudimos generar el análisis. Esto puede tardar hasta un minuto.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="font-body text-sm font-medium text-signal-red hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!aiAnalysis) return null;

  return (
    <div id="informe-pro-section" className="mb-8">
      <HeroVerdictBlock
        data={aiAnalysis}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        veredicto={veredicto}
        score={score}
        propiedadTitle={propiedadTitle}
        propiedadSubtitle={propiedadSubtitle}
        metadataItems={metadataItems}
        results={results}
        valorUF={valorUF}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <MiniCard
          section="costoMensual"
          numero="02"
          label="Costo mensual"
          data={aiAnalysis.costoMensual}
          currency={currency}
          onClick={() => setActiveDrawer("costoMensual")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="negociacion"
          numero="03"
          label="Negociación"
          data={aiAnalysis.negociacion}
          currency={currency}
          onClick={() => setActiveDrawer("negociacion")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="largoPlazo"
          numero="04"
          label="Largo plazo"
          data={aiAnalysis.largoPlazo}
          currency={currency}
          onClick={() => setActiveDrawer("largoPlazo")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="riesgos"
          numero="05"
          label="Riesgos"
          data={aiAnalysis.riesgos}
          currency={currency}
          onClick={() => setActiveDrawer("riesgos")}
          results={results}
          valorUF={valorUF}
        />
      </div>

      {/* Card opcional: Reestructuración (entre el grid 2x2 y la Zona).
          Solo aparece cuando aiAnalysis.reestructuracion existe — Nivel 3 del
          escalonado financingHealth (skill §1.5). */}
      {aiAnalysis.reestructuracion && (
        <div className="mt-3">
          <ReestructuracionMiniCard
            data={aiAnalysis.reestructuracion}
            currency={currency}
            valorUF={valorUF}
            onClick={() => setActiveDrawer("reestructuracion")}
          />
        </div>
      )}

      {/* 5ª tarjeta ancha: Zona / POIs */}
      {analysisId && (
        <div className="mt-3">
          <ZoneInsightMiniCard
            data={zoneInsight}
            loading={zoneLoading}
            onClick={() => setActiveDrawer("zona")}
            currency={currency}
          />
        </div>
      )}

      <p className="text-center text-[10px] text-[var(--franco-text-muted)] mt-4">
        Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
      </p>

      {activeDrawer && results && inputData && (
        <AnalysisDrawer
          activeKey={activeDrawer}
          aiAnalysis={aiAnalysis}
          currency={currency}
          results={results}
          inputData={inputData}
          valorUF={valorUF}
          onClose={() => setActiveDrawer(null)}
          onNavigate={(key) => setActiveDrawer(key)}
          zoneInsight={zoneInsight}
          zoneLoading={zoneLoading}
          zoneError={zoneError}
          zoneCenter={zoneCenter}
          comuna={comuna ?? inputData.comuna}
          arriendoUsuarioCLP={Number(inputData.arriendo) || 0}
        />
      )}
    </div>
  );
}
