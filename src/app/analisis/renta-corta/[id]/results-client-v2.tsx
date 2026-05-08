"use client";

/**
 * Results client (Renta Corta) — v2 Ronda 4c.
 *
 * Reescritura del client STR para alcanzar paridad visual con LTR usando los
 * patrones del design-system-franco:
 *   • Patrón 0   AppNav variant="app"
 *   • Patrón 1   HeroVerdictBlockSTR (veredicto + score + KPIs hero)
 *   • Patrón 2   SubjectCardGridSTR (4 dimensiones: rentabilidad / sostenibilidad
 *                / ventaja vs LTR / factibilidad)
 *   • Patrón 3   DrawerSTR (detalle por dimensión)
 *   • Patrón 4   AIInsightSTR (cursiva editorial, shape STR legacy)
 *   • Patrón 7   AdvancedSectionSTR (07 escenarios · 08 indicadores ·
 *                09 patrimonio · 10 venta — sin sliders)
 *
 * Gating: el render completo se muestra siempre. Los CTAs (WalletStatusCTA +
 * ProCTABanner) gestionan el upgrade. La doctrina de gating fina queda para
 * Ronda 4d alineada con el refactor de prompts STR.
 *
 * Activación: feature flag NEXT_PUBLIC_STR_V2 (default 'false') leído por
 * page.tsx. Mientras esté en 'false', se sirve el legacy `results-client.tsx`.
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppNav } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { HeroVerdictBlockSTR } from "@/components/analysis/str/HeroVerdictBlockSTR";
import { SubjectCardGridSTR } from "@/components/analysis/str/SubjectCardGridSTR";
import { AdvancedSectionSTR } from "@/components/analysis/str/AdvancedSectionSTR";
import { AIInsightSTR } from "@/components/analysis/str/AIInsightSTR";

interface STRResultsV2Props {
  analysisId: string;
  results: ShortTermResult & { francoScore?: FrancoScoreSTR };
  inputData: Record<string, unknown> | null;
  accessLevel: "guest" | "free" | "premium" | "subscriber";
  ufValue: number;
  nombre: string;
  comuna: string;
  ciudad: string;
  superficie: number;
  createdAt: string;
  userId: string | null;
  isSharedView: boolean;
  userCredits: number;
  welcomeAvailable?: boolean;
  aiAnalysisInitial?: unknown;
}

export function STRResultsClientV2({
  analysisId,
  results,
  inputData,
  accessLevel,
  ufValue,
  nombre,
  comuna,
  superficie,
  isSharedView,
  userCredits,
  welcomeAvailable = true,
  aiAnalysisInitial,
}: STRResultsV2Props) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");

  // ─── AI state ─────────────────────────────────────
  const initialAi =
    aiAnalysisInitial && typeof aiAnalysisInitial === "object"
      ? (aiAnalysisInitial as Record<string, unknown>)
      : null;
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(initialAi);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadAi = useCallback(async () => {
    if (aiLoading || !analysisId || aiAnalysis) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/short-term/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error generando análisis IA");
      }
      const data = await res.json();
      setAiAnalysis(data as Record<string, unknown>);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setAiLoading(false);
    }
  }, [analysisId, aiLoading, aiAnalysis]);

  // Carga lazy: si premium y aún no hay AI, dispara una vez al montar.
  useEffect(() => {
    const isPaid = accessLevel === "premium" || accessLevel === "subscriber";
    if (isPaid && !aiAnalysis && !aiLoading && !aiError) {
      loadAi();
    }
  }, [accessLevel, aiAnalysis, aiLoading, aiError, loadAi]);

  // ─── Datos derivados ──────────────────────────────
  const francoScore = results.francoScore;
  const score = francoScore?.score ?? 50;
  const veredicto: STRVerdict =
    (francoScore?.veredicto as STRVerdict) ?? results.veredicto;

  const precioCompra = (inputData?.precioCompra as number) ?? 0;
  const dormitorios = (inputData?.dormitorios as number) ?? 0;
  const banos = (inputData?.banos as number) ?? 0;
  const piePct = ((inputData?.piePercent as number) ?? 0) * 100;

  const propiedadTitle = nombre || `Depto en ${comuna}`;
  const propiedadSubtitle =
    [dormitorios && `${dormitorios}D`, banos && `${banos}B`, superficie && `${superficie}m²`, comuna]
      .filter(Boolean)
      .join(" · ");

  const fmtPrecioMetadata =
    currency === "UF"
      ? `UF ${Math.round(precioCompra / ufValue).toLocaleString("es-CL")}`
      : `$${(precioCompra / 1_000_000).toFixed(1).replace(".", ",")}M`;

  const fmtPrecioM2 =
    superficie > 0
      ? currency === "UF"
        ? `UF ${(precioCompra / ufValue / superficie).toFixed(1).replace(".", ",")}/m²`
        : `$${Math.round(precioCompra / superficie / 1000).toLocaleString("es-CL")}K/m²`
      : "—";

  const metadataItems = [
    { label: "SUPERFICIE", value: `${superficie} m²` },
    { label: "PRECIO", value: fmtPrecioMetadata },
    { label: "$/m²", value: fmtPrecioM2 },
    { label: "PIE", value: `${Math.round(piePct)}%` },
    { label: "DORMS", value: `${dormitorios}D ${banos}B` },
    { label: "MODO", value: (inputData?.modoGestion as string) === "auto" ? "Auto-gestión" : "Administrador" },
  ];

  const isSubscriber = accessLevel === "subscriber";
  const isAdmin = false; // El page.tsx ya resuelve admin a "subscriber"

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <AppNav variant="app" />

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 md:py-8">
        {/* 01 · VEREDICTO — Hero */}
        <HeroVerdictBlockSTR
          results={results}
          veredicto={veredicto}
          score={score}
          propiedadTitle={propiedadTitle}
          propiedadSubtitle={propiedadSubtitle}
          metadataItems={metadataItems}
          currency={currency}
          onCurrencyChange={setCurrency}
          valorUF={ufValue}
        />

        {/* gap mayor 40px — Hero → Cards */}
        <div style={{ height: 24 }} />

        {/* 02-05 · DIMENSIONES — Subject Card Grid */}
        <SubjectCardGridSTR
          results={results}
          inputData={inputData as { edificioPermiteAirbnb?: "si" | "no" | "no_seguro" } | null}
          comuna={comuna}
          currency={currency}
          valorUF={ufValue}
        />

        {/* gap mayor 40px — Cards → Advanced */}
        <div style={{ height: 24 }} />

        {/* 07-10 · SIMULACIÓN INTERACTIVA */}
        <AdvancedSectionSTR
          results={results}
          currency={currency}
          valorUF={ufValue}
        />

        {/* gap mayor — Advanced → AI Insight */}
        <div style={{ height: 24 }} />

        {/* AI Insight (Patrón 4) — cursiva obligatoria */}
        <AIInsightSTR
          ai={aiAnalysis as never}
          currency={currency}
          loading={aiLoading}
          error={aiError}
        />

        {/* CTA banner (free) */}
        <div style={{ height: 24 }} />
        <ProCTABanner
          analysesCount={1}
          isLoggedIn={accessLevel !== "guest"}
          accessLevel={accessLevel}
          welcomeAvailable={welcomeAvailable}
          isSharedView={isSharedView}
          source="str_v2"
        />

        {/* Wallet status */}
        <div style={{ height: 16 }} />
        <WalletStatusCTA
          welcomeAvailable={welcomeAvailable}
          credits={userCredits}
          isSubscriber={isSubscriber}
          isAdmin={isAdmin}
          isSharedView={isSharedView}
          source="str"
        />

        {/* Link analizar otra propiedad */}
        <div className="mt-6 mb-4 flex items-center justify-center">
          <Link
            href="/analisis/renta-corta"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
          >
            Analizar otra propiedad
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Disclaimer */}
        <p
          className="font-body text-center mt-6 mb-2 mx-auto"
          style={{
            fontSize: 11,
            color: "color-mix(in srgb, var(--franco-text) 40%, transparent)",
            maxWidth: 520,
          }}
        >
          Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
        </p>
      </main>

      <AppFooter variant="minimal" />
    </div>
  );
}
