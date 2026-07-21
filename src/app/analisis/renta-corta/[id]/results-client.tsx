"use client";

/**
 * Results client (Renta Corta).
 *
 * Render del módulo STR (E.2 · orden LTR: la pirámide ES el detalle):
 *   • UnifiedNav variant="app"
 *   • HeroVerdictBlockSTR (veredicto + score + KPIs + conviene IA)
 *   • EjesAplicadosSTR — panel "¿Cómo llegamos?" (colapsable)
 *   • PiramideHallazgosSTR — el detalle; sus cards abren DrawerContentSTR
 *   • AdvancedSectionSTR (07-10 · escenarios · patrimonio · venta)
 *   • ZonaCardSTR — destino zona, abre el drawer tipoHuesped
 *   • DrawerSTR + DrawerContentSTR — overlay de detalle (estado acá)
 *
 * Gating: el render completo se muestra siempre. Los CTAs (WalletStatusCTA +
 * ProCTABanner) gestionan el upgrade.
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import { ShareButton } from "@/components/chrome/ShareButton";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { AppFooter } from "@/components/chrome/AppFooter";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { HeroSTR } from "@/components/analysis/str/HeroSTR";
import { StateBox } from "@/components/ui/StateBox";
import { ViabilidadSTRBanner } from "@/components/analysis/str/ViabilidadSTRBanner";
import { AdvancedSectionSTR } from "@/components/analysis/str/AdvancedSectionSTR";
import { PiramideHallazgosSTR, ordenarHallazgosPiramideSTR, HALLAZGO_DRAWER_STR } from "@/components/analysis/str/PiramideHallazgosSTR";
import { EjesAplicadosSTR } from "@/components/analysis/str/EjesAplicadosSTR";
import { DrawerSTR, type DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";
import { DrawerContentSTR, DRAWER_TITULOS_STR } from "@/components/analysis/str/DrawerContentSTR";
import { ZonaCardSTR } from "@/components/analysis/str/ZonaCardSTR";
import { SubordinatedBanner } from "@/components/analysis/SubordinatedBanner";
import type { AIAnalysisSTRv2 } from "@/lib/types";

// Replica el formato de fecha de la vista AMBAS (shared-client → formatFechaCorta):
// "7 de junio 2026". Usado en el header público de la vista guest.
function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

interface STRResultsProps {
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
  printMode?: boolean;
  /** Hijo subordinado de un AMBAS: link al comparativo. Si viene, se oculta el
   * Compartir propio y se muestra el banner de subordinación (migración 20260715). */
  subordinatedHref?: string | null;
}

export function STRResultsClient({
  analysisId,
  results,
  inputData,
  accessLevel,
  ufValue,
  nombre,
  comuna,
  ciudad,
  createdAt,
  isSharedView,
  userCredits,
  welcomeAvailable = true,
  aiAnalysisInitial,
  printMode = false,
  subordinatedHref = null,
}: STRResultsProps) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  // E.2 — estado del drawer de detalle, levantado al orquestador (patrón LTR
  // SubjectCardGrid): lo abre la pirámide (hallazgos) y la card zona (tipoHuesped).
  const [activeDrawer, setActiveDrawer] = useState<DrawerKeySTR | null>(null);

  // Secuencia de drawers = orden VISUAL de la pirámide STR (mismo array que renderiza),
  // filtrando las cards con drawer y dedup. La navegación prev/next se deriva de acá.
  // `tipoHuesped` NO entra (se abre solo desde ZonaCardSTR) → queda fuera de las flechas.
  const drawerSequenceSTR: DrawerKeySTR[] = [];
  for (const h of ordenarHallazgosPiramideSTR(results?.hallazgos)) {
    const key = HALLAZGO_DRAWER_STR[h.id];
    if (key && !drawerSequenceSTR.includes(key)) drawerSequenceSTR.push(key);
  }

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
  // Commit E.0 (2026-05-13): eliminado fallback `score ?? 50`. Análisis legacy
  // sin FrancoScoreSTR persistido pasan score=null al Hero (renderiza "—") y
  // dispara banner "Análisis incompleto · regenera" arriba del Hero. Antes
  // mostrábamos un 50 inventado que contradecía slider visual y badge motor
  // (bug Lastarria). El veredicto sigue cayendo a results.veredicto (motor)
  // mientras no se elimina la divergencia en E.2.
  const francoScore = results.francoScore;
  const score: number | null = francoScore?.score ?? null;
  const isIncompleteScore = score === null;
  const veredicto: STRVerdict =
    (francoScore?.veredicto as STRVerdict) ?? results.veredicto;

  // E.5 — el HeroSTR lee los chips (dorm/baño/m²/precio/pie/gestión) directamente
  // de input_data; ya no se arma metadataItems/subtitle acá. propiedadTitle queda
  // porque lo usa el ShareButton.
  const propiedadTitle = nombre || `Depto en ${comuna}`;

  const isSubscriber = accessLevel === "subscriber";
  const isAdmin = false; // El page.tsx ya resuelve admin a "subscriber"

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Chrome de nav/header — oculto en print mode (el PDF agrega su header) */}
      {!printMode && (accessLevel === "guest" ? (
        <PublicShareHeader date={formatFechaCorta(createdAt)} />
      ) : (
        <UnifiedNav
          variant="app"
          // Hijo subordinado de un AMBAS: sin Compartir propio (el share vive en
          // el comparativo). Nav general se conserva.
          actionsSlot={
            subordinatedHref ? undefined : (
              <ShareButton
                path={`/analisis/renta-corta/${analysisId}`}
                pdfUrl={`/api/analisis/renta-corta/${analysisId}/pdf`}
                analysisId={analysisId}
                modalidad="STR"
                title={`Análisis Franco: ${propiedadTitle}`}
                text={`Mira el análisis de este depto. Score: ${score ?? "—"}/100`}
                score={score ?? undefined}
                nombre={propiedadTitle}
                comuna={comuna}
              />
            )
          }
        />
      ))}

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 md:py-8">
        {/* Banner de subordinación AMBAS — hijo STR de un comparativo. */}
        {subordinatedHref && !printMode && (
          <SubordinatedBanner href={subordinatedHref} modalidad="STR" />
        )}

        {/* CTA conversión — anzuelo (superficie Ink) · solo guest, no en print */}
        {accessLevel === "guest" && !printMode && (
          <div className="mb-5">
            <ConversionHook href="/register" />
          </div>
        )}

        {/* Banner análisis incompleto — Commit E.0 (2026-05-13).
            Análisis STR generados antes del FrancoScoreSTR (Commit 2) no tienen
            score persistido. Antes mostrábamos "50" hardcoded; ahora "—" en el
            Hero + este banner que invita a regenerar. */}
        {isIncompleteScore && (
          <div className="mb-4">
            <StateBox variant="left-border" state="attention" label="Análisis incompleto">
              Este análisis fue generado con una versión anterior del motor y no tiene Franco Score persistido. Regenera el análisis para ver el score completo y las recomendaciones actualizadas.
            </StateBox>
          </div>
        )}

        {/* 01 · VEREDICTO — HeroSTR (E.5 · port del patrón HeroLTR). Superficie
            continua: identidad + score/gauge/chips + mapa · veredicto (prosa IA
            conviene.{respuestaDirecta, reencuadre, cajaAccionable}) · TOP-3 hallazgos
            con puente a la pirámide. veredictoFrase ya no se renderiza; título por
            conviene.pregunta ?? hardcode (v3 podó el campo). */}
        <HeroSTR
          ai={aiAnalysis as unknown as AIAnalysisSTRv2 | null}
          results={results}
          veredicto={veredicto}
          score={score}
          inputData={inputData}
          comuna={comuna}
          ciudad={ciudad}
          currency={currency}
          onCurrencyChange={setCurrency}
          valorUF={ufValue}
          createdAt={createdAt}
          aiLoading={aiLoading && !aiAnalysis}
        />

        {/* Loading IA: el skeleton + copy viven ahora en el slot de prosa del Hero
            (ProsaSkeleton). Acá abajo solo queda el indicador de error. */}
        {aiError && !aiAnalysis && (
          <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] mb-3 mt-1 px-1">
            ● Análisis IA no disponible · {aiError}
          </p>
        )}

        {/* gap menor 24px — Hero → Cards */}
        <div style={{ height: 24 }} />

        {/* Commit 4 · 2026-05-12 — Viabilidad STR honesta por zona.
            Aparece sólo cuando tierZona = "baja" o recomendacionModalidad =
            "LTR_PREFERIDO". Doctrina Franco: decir cuando STR no conviene. */}
        <ViabilidadSTRBanner results={results} />

        {/* Calibración v1 — bloque pedagógico "¿Cómo llegamos a este número?" */}
        {results.ejesAplicados && (
          <>
            <EjesAplicadosSTR
              ejes={results.ejesAplicados}
              revenueMensualBase={results.escenarios.base.ingresoBrutoMensual}
              currency={currency}
              valorUF={ufValue}
              occFuente={results.occFuente}
              occRealizada={results.ocupacionRealizadaComparables}
            />
            <div style={{ height: 24 }} />
          </>
        )}

        {/* EL DETALLE — Pirámide de hallazgos STR. Orden Filosofía 1 sobre
            results.hallazgos. E.2: la pirámide ES el detalle; sus cards abren los
            drawers (HALLAZGO_DRAWER_STR) que antes colgaban del grid muerto. */}
        <PiramideHallazgosSTR
          hallazgos={results.hallazgos}
          currency={currency}
          valorUF={ufValue}
          onOpenDrawer={setActiveDrawer}
        />
        <div style={{ height: 24 }} />

        {/* ESCENARIOS Y PROYECCIÓN (07-10). La prosa ai.largoPlazo dejó de ir inline
            (str-paridad2) y ahora vive en su drawer "A 10 años", abierto desde una
            afordance en la columna Patrimonio (fuera de la secuencia de pirámide, como
            ZonaCardSTR→tipoHuesped). Solo se pasa el handler si hay prosa. */}
        <AdvancedSectionSTR
          results={results}
          currency={currency}
          valorUF={ufValue}
          forceOpen={printMode}
          onOpenLargoPlazo={
            !printMode && (aiAnalysis as unknown as AIAnalysisSTRv2 | null)?.largoPlazo?.contenido?.trim()
              ? () => setActiveDrawer("largoPlazo")
              : undefined
          }
        />

        {/* gap — Simulación → Zona */}
        <div style={{ height: 24 }} />

        {/* ZONA (destino) — card recesiva. E.2: la ex-card 06 "Tipo de huésped"
            se reancla acá (E.1a), abre el drawer tipoHuesped. */}
        <ZonaCardSTR
          lat={(inputData?.lat as number) ?? ((inputData?.zonaRadio as { lat?: number } | undefined)?.lat) ?? null}
          lng={(inputData?.lng as number) ?? ((inputData?.zonaRadio as { lng?: number } | undefined)?.lng) ?? null}
          comuna={comuna}
          onOpen={() => setActiveDrawer("tipoHuesped")}
        />

        {/* CTAs de dueño/wallet — ocultos en print mode */}
        {!printMode && (
          <>
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
          </>
        )}

        {/* Link analizar otra propiedad — oculto en print mode (es navegación) */}
        {!printMode && (
          <div className="mt-6 mb-4 flex items-center justify-center">
            <Link
              href="/analisis/renta-corta"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
            >
              Analizar otra propiedad
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* CTA conversión — cierre (campo Signal Red) · solo guest, no en print */}
        {accessLevel === "guest" && !printMode && (
          <div className="mt-8 mb-4">
            <ConversionCloser href="/register" />
          </div>
        )}

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

        {/* Drawer de detalle (overlay) — abierto desde la pirámide o la card zona.
            E.2: estado levantado acá; el contenido vive en DrawerContentSTR. */}
        {!printMode && activeDrawer && (
          <DrawerSTR
            activeKey={activeDrawer}
            titulo={DRAWER_TITULOS_STR[activeDrawer]}
            sequence={drawerSequenceSTR}
            onClose={() => setActiveDrawer(null)}
            onNavigate={(k) => setActiveDrawer(k)}
          >
            <DrawerContentSTR
              activeKey={activeDrawer}
              analysisId={analysisId}
              results={results}
              inputData={inputData as never}
              comuna={comuna}
              currency={currency}
              valorUF={ufValue}
              ai={aiAnalysis as never}
            />
          </DrawerSTR>
        )}
      </main>

      {/* Footer del sitio — oculto en print mode (chrome, no cuerpo del análisis) */}
      {!printMode && <AppFooter variant="minimal" />}
    </div>
  );
}
