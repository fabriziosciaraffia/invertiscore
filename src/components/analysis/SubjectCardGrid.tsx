"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { useDrawerAbierto } from "./informeTelemetry";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroLTR } from "./HeroLTR";
import { PiramideHallazgos, ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { HALLAZGO_DRAWER } from "./GenericFindingCard";
import { hasAiV2 } from "./AIInsightSection";
import { BloqueEsperaInforme } from "@/components/analysis/ProsaSkeleton";

/**
 * Orquestador del análisis IA: Hero Verdict + Subject Card Grid 2×2 + card
 * Zona Wide Context + ReestructuracionMiniCard (opcional, financingHealth
 * Nivel 3) + drawers de detalle.
 *
 * Goal C — veredicto inmediato: el grid renderiza SIEMPRE (todo lo del motor
 * existe desde el INSERT); la prosa IA es el único slot que espera, dentro del
 * hero (ProsaGenerando / error inline con retry). El overlay LoadingEditorial
 * full-page murió de esta superficie.
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
  fechaProsa,
  simulationSlot,
  onInformeVisible,
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
  /** Fecha de la PROSA vigente; el pie la prefiere sobre `createdAt`. Ver
   *  fechaProsaVigente() en pipeline-timing.ts. */
  fechaProsa?: string;
  /** A1 — sección Simulación (AdvancedSection). Se renderiza ENTRE la pirámide y la
   *  card Zona para lograr el orden "drawers → simulación → zona". El estado del
   *  drawer y el hook de zona viven acá, así que la card zona no se puede sacar afuera
   *  sin levantar ese estado; en cambio la simulación entra como slot. */
  simulationSlot?: ReactNode;
  /** Goal B (anclaje Goal C) — dispara UNA vez al montar el grid: el veredicto
   *  es visible desde el primer render. El caller captura `informe_visto` y
   *  persiste `informe_visible_at`. */
  onInformeVisible?: () => void;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);
  // I-3: apertura de drawer (todas las cards entran por acá).
  useDrawerAbierto(activeDrawer, "ltr");


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

  // Goal C/E — veredicto inmediato en DOS ZONAS (contrato:
  // mockup-resultados-dos-zonas.html). Zona 1 = el hero, 100% motor, sin
  // indicadores de carga (la apertura del 01 hace de prosa estática). Zona 2 =
  // mientras no hay prosa, UN solo bloque de espera (BloqueEsperaInforme:
  // mensajes progresivos + siluetas puras) — nada a medias, nada clickeable;
  // cuando llega, se materializa el contenido real. Prosa válida solo si pasa
  // hasAiV2 — un shape a medias no se renderiza como prosa.
  const prosaLista = !!aiAnalysis && hasAiV2(aiAnalysis);
  const prosa = prosaLista ? aiAnalysis : null;

  // Materialización (Goal E): la transición siluetas→cards corre SOLO cuando la
  // prosa llegó DESPUÉS del mount (generación en vivo). Prosa cacheada
  // (revisitas): el contenido real monta directo, sin flash ni animación.
  const prosaAusenteAlMontar = useRef(!prosaLista);
  const materializa = prosaLista && prosaAusenteAlMontar.current;

  // Goal B (anclaje movido por Goal C) — "veredicto visible" = mount del grid:
  // con el overlay muerto, el veredicto se ve desde el primer render. Ref y no
  // estado: notificar no re-renderiza; una sola notificación por mount.
  const informeVisibleNotificado = useRef(false);
  useEffect(() => {
    if (!informeVisibleNotificado.current) {
      informeVisibleNotificado.current = true;
      onInformeVisible?.();
    }
  }, [onInformeVisible]);

  return (
    <div id="informe-pro-section" className="mb-8">
      <HeroLTR
        onOpenDrawer={setActiveDrawer}
        data={prosa}
        prosaError={!prosa && !loading ? (error ?? null) : null}
        onRetryProsa={onRetry}
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
        fechaProsa={fechaProsa}
      />

      {/* ═══ ZONA 2 (Goal E) ═══ Sin prosa: UN solo bloque de espera — mensajes
          progresivos + siluetas puras (cero texto a medias, cero afordancia).
          Con error de prosa el bloque queda estático (el error vive inline en el
          hero, Goal C). Absorbe el strip "Franco está redactando el detalle…". */}
      {!prosa ? (
        <div className="mt-5">
          <BloqueEsperaInforme estatico={!loading && !!error} />
        </div>
      ) : (
        <div style={materializa ? { animation: "zona2Aparece 450ms ease-out" } : undefined}>
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

          {/* A1 — Simulación (AdvancedSection) va ENTRE la pirámide y la card zona:
              drawers → simulación → zona. El wrapper mt-6 da el respiro que faltaba
              entre la última fila de la pirámide y la card "Simula plazo y plusvalía". */}
          {simulationSlot && <div className="mt-6">{simulationSlot}</div>}

          {/* paridad drawer — afordance al drawer "A 10 años" (prosa IA largoPlazo). */}
          {simulationSlot && prosa?.largoPlazo?.contenido_clp?.trim() && (
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
          <style>{`
            @keyframes zona2Aparece {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              [style*="zona2Aparece"] { animation: none !important; }
            }
          `}</style>
        </div>
      )}

      <p className="text-center text-[10px] text-[var(--franco-text-muted)] mt-4">
        Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
      </p>

      {/* Limitación deliberada (Goal C): AnalysisDrawer exige prosa no-null (lee
          glosas IA por sección). Mientras la prosa está en vuelo, las cards se
          ven pero el drawer no se monta — se habilita solo cuando llega. */}
      {activeDrawer && results && inputData && prosa && (
        <AnalysisDrawer
          activeKey={activeDrawer}
          aiAnalysis={prosa}
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
