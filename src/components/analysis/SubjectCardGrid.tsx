"use client";

import { useState, useEffect } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { LoadingEditorial } from "@/components/analysis/LoadingEditorial";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroLTR } from "./HeroLTR";
import { PiramideHallazgos } from "./PiramideHallazgos";
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
  onRetry,
  results,
  inputData,
  valorUF,
  analysisId,
  comuna,
  createdAt,
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
  createdAt?: string;
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
      <HeroLTR
        data={aiAnalysis}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        veredicto={veredicto}
        score={score}
        propiedadTitle={propiedadTitle}
        inputData={inputData}
        results={results}
        comuna={comuna}
        valorUF={valorUF}
        createdAt={createdAt}
      />

      {/* Fase 2 — La pirámide de hallazgos reemplaza el grid 2×2 de dimensiones IA.
          Cada card abre su drawer vía onOpenDrawer (setActiveDrawer, dueño del
          estado acá). cap_rate no mapea a drawer todavía (llega en Fase 3). */}
      <PiramideHallazgos
        results={results}
        aiAnalysis={aiAnalysis}
        currency={currency}
        valorUF={valorUF}
        onOpenDrawer={setActiveDrawer}
      />

      {/* Fase 1b — Las cards Reestructuración (estructura) y Puesta a punto (capex)
          se retiraron: ya son hallazgos DENTRO de la pirámide de arriba; dejarlas
          duplicaba el dato. Sus drawers siguen existiendo y se reconectan desde la
          pirámide en el paso siguiente. */}

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
