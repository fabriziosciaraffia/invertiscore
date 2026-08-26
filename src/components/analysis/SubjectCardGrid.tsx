"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { MarcaSeccion, useDrawerAbierto } from "./informeTelemetry";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroLTR } from "./HeroLTR";
import { PiramideHallazgos, ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { HALLAZGO_DRAWER } from "./GenericFindingCard";
import { hasAiV2 } from "./AIInsightSection";
import { stripMarcasDeep } from "@/lib/prosa-marcas";
import { derivarCifraClaveLtr } from "@/lib/cifra-clave";
import { buildFichaLtr } from "@/lib/ficha-depto";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { DocumentoFrame, PortadaInforme } from "./portada/PortadaInforme";
import { useComparablesCercanos } from "./portada/useComparablesCercanos";
import type { HallazgoDistanciaVeredicto, HallazgoSobreprecio } from "@/lib/types";
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
  accessLevel = "free",
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
  /** I-3 (fix FASE 1 rediseño-dictamen): viaja en `informe_seccion_vista` de las
   *  marcas `piramide`/`zona`, que hasta ahora no existían en LTR. */
  accessLevel?: string;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);

  // Orden único de la pirámide — se calcula UNA vez acá y alimenta la secuencia
  // de drawers y el resolver de telemetría (mismo array que renderiza).
  const hallazgosOrdenados = ordenarHallazgosPiramide(results, aiAnalysis);

  // I-3: apertura de drawer (todas las cards entran por acá). El resolver emite
  // en paralelo `informe_hallazgo_abierto {n, id_hallazgo}` cuando el drawer
  // corresponde a un hallazgo de la pirámide (línea base pre-rediseño).
  useDrawerAbierto(activeDrawer, "ltr", (key) => {
    const idx = hallazgosOrdenados.findIndex((h) => HALLAZGO_DRAWER[h.id] === key);
    return idx >= 0 ? { n: idx + 1, id: hallazgosOrdenados[idx].id } : null;
  });

  // Secuencia de drawers = orden VISUAL de la pirámide (mismo array que renderiza),
  // filtrando las cards que tienen drawer y dedup por si dos cayeran al mismo. La
  // navegación prev/next del drawer se deriva de acá: "siguiente" = card siguiente
  // de la pirámide. Un solo orden de verdad. `zona` NO entra (se abre solo desde su
  // MiniCard) → queda fuera de las flechas.
  const drawerSequence: DrawerKey[] = [];
  for (const h of hallazgosOrdenados) {
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
  // Render tolerante FASE 2 (rediseño Dictamen): la prosa v10 trae marcas de
  // destacador `**…**` que la UI actual no pinta — se strippean en la RAÍZ (un
  // solo punto para hero + pirámide + drawers; nunca `**` crudos en pantalla).
  // FASE 4 reemplaza este strip por el render con plumón, acá mismo.
  const prosa = prosaLista ? stripMarcasDeep(aiAnalysis) : null;

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

  // ═══ PORTADA (FASE 3 rediseño Dictamen — mockups v8/v9) ═══
  // Los datos se arman acá (motor + input); la IA solo aporta el titular, que
  // llega CRUDO (con `**…**`) desde aiAnalysis — el plumón se pinta en la
  // portada, mientras el resto de la prosa sigue strippeada (stripMarcasDeep).
  const direccionPortada = formatDireccionDisplay(inputData?.direccion);
  const comunaPortada = comuna || inputData?.comuna || "";
  const titularCrudo = (aiAnalysis as { titular?: string | null } | null)?.titular ?? null;
  const distanciaPortada =
    ((results?.hallazgos as { id: string }[] | undefined)?.find((h) => h.id === "distancia_veredicto") as
      | HallazgoDistanciaVeredicto
      | undefined) ?? null;
  const cifraPortada =
    results?.metrics && inputData
      ? derivarCifraClaveLtr({
          veredicto,
          flujoNetoMensual: (results.metrics as { flujoNetoMensual?: number }).flujoNetoMensual ?? NaN,
          distancia: distanciaPortada,
          ufValue: valorUF,
        })
      : null;
  const sobreprecioPortada =
    ((results?.metrics as { hallazgoSobreprecio?: HallazgoSobreprecio | null } | undefined)?.hallazgoSobreprecio ??
      aiAnalysis?.hallazgoSobreprecio) || null;
  const fichaPortada = inputData
    ? buildFichaLtr({
        input: inputData,
        results,
        medianaUfM2: sobreprecioPortada?.valor.medianaComunaUfM2 ?? null,
        universoMediana: sobreprecioPortada?.valor.universo ?? null,
        direccion: direccionPortada,
        comuna: comunaPortada,
        ufValue: valorUF,
        moneda: currency,
      })
    : null;
  // Coords para el mapa de portada (misma fuente que zoneCenter, ya derivada arriba).
  const compCercanos = useComparablesCercanos({
    comuna: comunaPortada,
    superficie: Number(inputData?.superficie) || 0,
    dormitorios: inputData?.dormitorios,
    lat: zoneCenter?.lat ?? null,
    lng: zoneCenter?.lng ?? null,
  });
  const fechaCorta = (() => {
    const d = new Date(fechaProsa ?? createdAt ?? "");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  })();
  const scrollASimulacion = () => {
    document.getElementById("simulacion-interactiva")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="informe-pro-section" className="mb-8">
      <DocumentoFrame>
      {fichaPortada && (
        <PortadaInforme
          veredicto={veredicto}
          score={score}
          direccion={direccionPortada}
          comuna={comunaPortada}
          modalidadLabel="Renta larga"
          fecha={fechaCorta}
          titular={titularCrudo}
          cifra={cifraPortada}
          ficha={fichaPortada}
          currency={currency}
          onCurrencyChange={onCurrencyChange}
          mapa={
            zoneCenter
              ? {
                  lat: zoneCenter.lat,
                  lng: zoneCenter.lng,
                  comparables: compCercanos.comparables,
                  count: compCercanos.count,
                  label: direccionPortada || comunaPortada,
                }
              : null
          }
          onAjustarSupuestos={scrollASimulacion}
        />
      )}
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
          {/* I-3 fix FASE 1: LTR nunca emitió `piramide` (solo STR/comparativa) y el
              agregado global daba alcance imposible. La marca vive en la rama con
              prosa porque la pirámide solo se renderiza con prosa. */}
          <MarcaSeccion seccion="piramide" tipo="ltr" accessLevel={accessLevel} />
          {/* prosa (strippeada), no aiAnalysis crudo: el eco-check apertura↔01 de la
              pirámide compara texto y debe ver lo MISMO que muestra el hero. */}
          <PiramideHallazgos
            results={results}
            aiAnalysis={prosa}
            currency={currency}
            valorUF={valorUF}
            onOpenDrawer={setActiveDrawer}
          />

          {/* A1 — Simulación (AdvancedSection) va ENTRE la pirámide y la card zona:
              drawers → simulación → zona. El wrapper mt-6 da el respiro que faltaba
              entre la última fila de la pirámide y la card "Simula plazo y plusvalía". */}
          {simulationSlot && <div className="mt-6" id="simulacion-interactiva">{simulationSlot}</div>}

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
              {/* I-3 fix FASE 1: `zona` tampoco existía en LTR. Dentro del guard
                  analysisId — sin card de zona (demo) no hay nada que medir. */}
              <MarcaSeccion seccion="zona" tipo="ltr" accessLevel={accessLevel} />
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

      </DocumentoFrame>

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
