"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { LoadingEditorial } from "@/components/analysis/LoadingEditorial";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroLTR } from "./HeroLTR";
import { PiramideHallazgos, ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { HALLAZGO_DRAWER } from "./GenericFindingCard";
import { hasAiV2 } from "./AIInsightSection";
import { ProsaSkeleton, SkeletonLine } from "@/components/analysis/ProsaSkeleton";

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
  aiStale = false,
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
  simulationSlot,
}: {
  aiAnalysis: AIAnalysisV2 | null;
  loading: boolean;
  /** F6 lazy-on-open: la prosa persistida quedó stale (versión vieja) y se está
   *  regenerando. La data del análisis ya existe → no secuestrar la página con el
   *  overlay editorial fixed; skeleton inline en el lugar de la prosa. */
  aiStale?: boolean;
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
  /** A1 — sección Simulación (AdvancedSection). Se renderiza ENTRE la pirámide y la
   *  card Zona para lograr el orden "drawers → simulación → zona". El estado del
   *  drawer y el hook de zona viven acá, así que la card zona no se puede sacar afuera
   *  sin levantar ese estado; en cambio la simulación entra como slot. */
  simulationSlot?: ReactNode;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);

  // ── Dev switch de tratamientos del hero (Ronda 3) — ?hero= + ?verdict= ──
  // Sin flag: base (Ronda 2). No persiste; solo para comparar en la página real.
  //   ?hero=tinta | ?hero=verdicto  · ?verdict=COMPRAR|AJUSTA SUPUESTOS|BUSCAR OTRA
  const [heroVerdictOverride, setHeroVerdictOverride] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = q.get("hero");
    if (h === "tinta" || h === "verdicto") document.documentElement.setAttribute("data-hero", h);
    const v = q.get("verdict");
    if (v === "COMPRAR" || v === "AJUSTA SUPUESTOS" || v === "BUSCAR OTRA") setHeroVerdictOverride(v);
    return () => document.documentElement.removeAttribute("data-hero");
  }, []);
  const veredictoEff = heroVerdictOverride ?? veredicto;

  // Secuencia de drawers = orden VISUAL de la pirámide (mismo array que renderiza),
  // filtrando las cards que tienen drawer y dedup por si dos cayeran al mismo. La
  // navegación prev/next del drawer se deriva de acá: "siguiente" = card siguiente
  // de la pirámide. Un solo orden de verdad. `zona` NO entra (se abre solo desde su
  // MiniCard) → queda fuera de las flechas.
  const drawerSequence: DrawerKey[] = [];
  for (const h of ordenarHallazgosPiramide(results, aiAnalysis)) {
    const key = HALLAZGO_DRAWER[h.id];
    if (key && !drawerSequence.includes(key)) drawerSequence.push(key);
  }

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

  // La transición post-arribo (editorial 1100ms antes de revelar) es solo para la
  // generación fresca; en regen stale ya no hay overlay que desvanecer, se revela directo.
  const showLoading = (loading && !aiAnalysis) || (hasReadyData && !loadingDismissed && !aiStale);

  if (showLoading) {
    // Regen stale on-open (F6): la data del análisis ya existía; en vez del overlay
    // editorial full-page, mostramos la página con el shell del hero (label + título) y
    // el ProsaSkeleton compartido en el lugar de la prosa. HeroLTR no puede renderizar
    // sin data (aiAnalysis es null mientras regenera), así que va el placeholder inline.
    if (aiStale && !aiAnalysis) {
      return (
        <div id="informe-pro-section" className="mb-8">
          <div
            className="rounded-[16px] overflow-hidden mb-3"
            style={{ background: "var(--franco-bg)", border: "0.5px solid var(--franco-border-strong)" }}
          >
            <div className="px-6 md:px-8 py-6">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] mb-3 m-0">
                Veredicto
              </p>
              <div className="mb-3.5"><SkeletonLine width="58%" /></div>
              <ProsaSkeleton />
            </div>
          </div>
        </div>
      );
    }
    // Generación fresca (sin prosa previa) + transición post-arribo: overlay editorial.
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
        veredicto={veredictoEff}
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

      {/* A1 — Simulación (AdvancedSection) va ENTRE la pirámide y la card zona:
          drawers → simulación → zona. El wrapper mt-6 da el respiro que faltaba
          entre la última fila de la pirámide y la card "Simula plazo y plusvalía"
          (paridad con el spacer de 24px que STR usa en la misma frontera; ni la
          pirámide ni el root de AdvancedSection aportan ese margen). */}
      {simulationSlot && <div className="mt-6">{simulationSlot}</div>}

      {/* paridad drawer — afordance al drawer "A 10 años" (prosa IA largoPlazo). El
          DrawerLargoPlazo quedó huérfano en la migración grid→pirámide (HALLAZGO_DRAWER
          es inyectivo y no lo mapea); se re-cablea acá como hermano de ZoneInsightMiniCard,
          que ya abre su drawer fuera de la pirámide con setActiveDrawer. El slot
          AdvancedSection no alcanza este estado (vive un nivel arriba), por eso el trigger
          va en SubjectCardGrid y no dentro del slot. Solo si hay prosa; fuera de prev/next. */}
      {simulationSlot && aiAnalysis?.largoPlazo?.contenido_clp?.trim() && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setActiveDrawer("largoPlazo")}
            className="font-mono uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
            style={{ fontSize: 11 }}
          >
            Leer el análisis a 10 años →
          </button>
        </div>
      )}

      {/* 5ª tarjeta ancha: Zona / POIs */}
      {analysisId && (
        <div className="mt-3">
          <ZoneInsightMiniCard
            data={zoneInsight}
            loading={zoneLoading}
            error={zoneError}
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
          sequence={drawerSequence}
          zoneInsight={zoneInsight}
          zoneLoading={zoneLoading}
          zoneError={zoneError}
          zoneCenter={zoneCenter}
          comuna={comuna ?? inputData.comuna}
          arriendoUsuarioCLP={Number(inputData.arriendo) || 0}
          createdAt={createdAt}
        />
      )}
    </div>
  );
}
