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

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { registrarInformeVisto, leerEsperaMs } from "@/lib/informe-visto";
import { ArrowRight } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import { ShareButton } from "@/components/chrome/ShareButton";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { AppFooter } from "@/components/chrome/AppFooter";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import { NextAnalysisCTA, nextCtaState } from "@/components/analysis/NextAnalysisCTA";
import { MarcaSeccion, useDrawerAbierto } from "@/components/analysis/informeTelemetry";
import { CtaWelcome } from "@/components/analysis/CtaWelcome";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { HeroSTR } from "@/components/analysis/str/HeroSTR";
import { StateBox } from "@/components/ui/StateBox";
import { ViabilidadSTRBanner } from "@/components/analysis/str/ViabilidadSTRBanner";
import { AdvancedSectionSTR } from "@/components/analysis/str/AdvancedSectionSTR";
import { ordenarHallazgosPiramideSTR, HALLAZGO_DRAWER_STR } from "@/components/analysis/str/PiramideHallazgosSTR";
import { HallazgosAcordeon, type FilaHallazgo } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { findingDisplay } from "@/components/analysis/GenericFindingCard";
import { anchorHallazgo, numeroHallazgo } from "@/lib/orden-hallazgos";
import { EjesAplicadosSTR } from "@/components/analysis/str/EjesAplicadosSTR";
import { DrawerSTR, type DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";
import { DrawerContentSTR, DRAWER_TITULOS_STR } from "@/components/analysis/str/DrawerContentSTR";
import { ZonaCardSTR } from "@/components/analysis/str/ZonaCardSTR";
import { SubordinatedBanner } from "@/components/analysis/SubordinatedBanner";
import type { AIAnalysisSTRv2, HallazgoDistanciaVeredicto } from "@/lib/types";
import type { NivelPie } from "@/lib/analysis";
import { derivarCifraClaveStr } from "@/lib/cifra-clave";
import { buildFichaStr } from "@/lib/ficha-depto";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { DocumentoFrame, PortadaInforme } from "@/components/analysis/portada/PortadaInforme";
import { useComparablesCercanos } from "@/components/analysis/portada/useComparablesCercanos";

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
  fechaProsa?: string;
  userId: string | null;
  isSharedView: boolean;
  userCredits: number;
  welcomeAvailable?: boolean;
  aiAnalysisInitial?: unknown;
  /** Goal F (espejo LTR): la prosa persistida quedó con promptVersion vieja —
   *  el server no la pasó como inicial; el cliente NO pollea (el status la
   *  devolvería como ready) y regenera directo vía POST (stale-regen, gratis). */
  aiStaleInitial?: boolean;
  /** Hijo subordinado de un AMBAS: link al comparativo. Si viene, se oculta el
   * Compartir propio y se muestra el banner de subordinación (migración 20260715). */
  subordinatedHref?: string | null;
  /** Gate server-side (input_data.chargeMode === "welcome" + dueño): monta el
   * CTA post-análisis welcome (banda inline + popup). */
  showCtaWelcome?: boolean;
  /** Anónimo-DUEÑO (cap F2-2): informe completo sin sesión — se suprimen los
   * POST de regen IA (exigen login) y el header pasa a la variante de guardado. */
  isAnonOwner?: boolean;
  /** Escalera del pie precalculada en el server (`simularPieStr`): el reconstructor
   *  del input arrastra `next/headers` y no puede importarse desde el cliente. */
  nivelesPie?: NivelPie[];
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
  fechaProsa,
  isSharedView,
  userCredits,
  welcomeAvailable = true,
  aiAnalysisInitial,
  aiStaleInitial = false,
  subordinatedHref = null,
  showCtaWelcome = false,
  isAnonOwner = false,
  nivelesPie = [],
}: STRResultsProps) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  // E.2 — estado del drawer de detalle, levantado al orquestador (patrón LTR
  // SubjectCardGrid): lo abre la pirámide (hallazgos) y la card zona (tipoHuesped).
  const [activeDrawer, setActiveDrawer] = useState<DrawerKeySTR | null>(null);

  // Orden único de la pirámide STR — una sola pasada para la secuencia de drawers
  // y el resolver de telemetría (mismo array que renderiza).
  const hallazgosOrdenadosSTR = ordenarHallazgosPiramideSTR(results?.hallazgos);

  // Secuencia de drawers = orden VISUAL de la pirámide STR (mismo array que renderiza),
  // filtrando las cards con drawer y dedup. La navegación prev/next se deriva de acá.
  // `tipoHuesped` NO entra (se abre solo desde ZonaCardSTR) → queda fuera de las flechas.
  const drawerSequenceSTR: DrawerKeySTR[] = [];
  for (const h of hallazgosOrdenadosSTR) {
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

  // Goal F — generación bajo demanda SOLO para rescate/stale/manual (la normal
  // corre en el waitUntil del submit STR, patrón LTR). El trigger es telemetría
  // de pipeline_timing, nunca lógica.
  const generarProsa = useCallback(async (trigger: "rescate" | "stale-regen" | "manual") => {
    if (!analysisId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/short-term/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, trigger }),
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
  }, [analysisId]);

  // Goal F — polling PERSISTENTE de /short-term/[id]/ai-status (espejo LTR,
  // Goal C): la prosa se genera en background desde el submit; acá solo se
  // espera. 5s el primer minuto, 10s después; errores de red transitorios no
  // matan el loop (10 consecutivos sí). El RESCATE corre UNA vez y SOLO con
  // dictamen del server (`puedeRescate`: error registrado en pipeline_timing,
  // o >6 min sin prosa — imposible viva con maxDuration 300s del submit).
  // Filas stale (versión vieja): sin polling, regen directa gratis.
  useEffect(() => {
    if (!analysisId) return;
    if (aiAnalysis) return;
    const isPaid = accessLevel === "premium" || accessLevel === "subscriber";
    if (!isPaid) return;

    if (aiStaleInitial) {
      // Anónimo-dueño: el POST exige login → sin regen (espejo LTR).
      if (!aiError && !isAnonOwner) generarProsa("stale-regen");
      return;
    }

    let cancelled = false;
    setAiLoading(true);
    setAiError(null);

    const startTime = Date.now();
    const POLL_INTERVAL_MS = 5000;
    const POLL_INTERVAL_LARGO_MS = 10000;
    const BACKOFF_DESDE_MS = 60000;
    const MAX_ERRORES_CONSECUTIVOS = 10;
    let erroresConsecutivos = 0;
    let rescateDisparado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reagendar = () => {
      if (cancelled) return;
      const interval = Date.now() - startTime > BACKOFF_DESDE_MS ? POLL_INTERVAL_LARGO_MS : POLL_INTERVAL_MS;
      timer = setTimeout(poll, interval);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/analisis/short-term/${analysisId}/ai-status`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        erroresConsecutivos = 0;
        if (data?.ready && data.ai_analysis && typeof data.ai_analysis === "object") {
          setAiAnalysis(data.ai_analysis as Record<string, unknown>);
          setAiLoading(false);
          return;
        }
        if (data?.puedeRescate && !rescateDisparado && !isAnonOwner) {
          rescateDisparado = true;
          await generarProsa("rescate");
          return;
        }
        reagendar();
      } catch {
        if (cancelled) return;
        erroresConsecutivos += 1;
        if (erroresConsecutivos >= MAX_ERRORES_CONSECUTIVOS) {
          setAiError("Error cargando análisis");
          setAiLoading(false);
          return;
        }
        reagendar();
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  // Goal B — `informe_visto` STR: el veredicto es visible desde el primer
  // render (HeroSTR lo pinta con la prosa en skeleton inline), así que el
  // momento es el mount. ai_estado registra si la prosa venía persistida o
  // sigue en vuelo. Fail-soft entero (capture + RPC NULL-only vía helper).
  const posthog = usePostHog();
  const informeVistoRef = useRef(false);
  useEffect(() => {
    if (informeVistoRef.current) return;
    informeVistoRef.current = true;
    registrarInformeVisto({
      posthog,
      ids: [analysisId],
      modalidad: "str",
      aiEstado: initialAi ? "cacheada" : aiStaleInitial ? "stale-regen" : "generando",
      esperaMs: leerEsperaMs(),
      esOwner: !isSharedView,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FASE 4: la prosa llega CRUDA (con `**…**`) — el plumón se pinta en los
  // puntos de render. El strip sobrevive SOLO en /documento (el PDF no cambia).
  const aiParaRender = aiAnalysis;

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

  // I-3: apertura de drawer (pirámide + zona entran por acá). El resolver emite
  // en paralelo `informe_hallazgo_abierto {n, id_hallazgo}` cuando el drawer
  // corresponde a un hallazgo (línea base pre-rediseño, fix FASE 1). El hook
  // vive DESPUÉS de derivar `veredicto` porque el contexto FASE 5 lo necesita;
  // como derivación pura del prop `results`, el orden de hooks no varía.
  useDrawerAbierto(
    activeDrawer,
    "str",
    (key) => {
      const idx = hallazgosOrdenadosSTR.findIndex((h) => HALLAZGO_DRAWER_STR[h.id] === key);
      return idx >= 0 ? { n: idx + 1, id: hallazgosOrdenadosSTR[idx].id } : null;
    },
    { veredicto, accessLevel },
  );

  // E.5 — el HeroSTR lee los chips (dorm/baño/m²/precio/pie/gestión) directamente
  // de input_data; ya no se arma metadataItems/subtitle acá. propiedadTitle queda
  // porque lo usa el ShareButton.
  const propiedadTitle = nombre || `Depto en ${comuna}`;

  // ═══ PORTADA (FASE 3 rediseño Dictamen — espejo LTR) ═══
  const direccionPortada = formatDireccionDisplay((inputData?.direccion as string) ?? "");
  const titularCrudo = (aiAnalysis as { titular?: string | null } | null)?.titular ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rAny = results as any;
  const distanciaPortada =
    ((results?.hallazgos as { id: string }[] | undefined)?.find((h) => h.id === "distancia_veredicto") as
      | HallazgoDistanciaVeredicto
      | undefined) ?? null;
  const precioCompraCLP = Number(inputData?.precioCompra) || 0;
  const precioCompraUFIn = Number(inputData?.precioCompraUF) || 0;
  const ufStr = precioCompraUFIn > 0 ? precioCompraCLP / precioCompraUFIn : ufValue;
  // Los escenarios por modo viven en comparativa.str_auto/str_admin (verificado
  // contra el results persistido de bcc7af00 — los paths escenarios.strAuto no
  // existen y dejaban el ahorro de autogestión en null).
  const strAuto = rAny?.comparativa?.str_auto ?? rAny?.escenarios?.strAuto ?? rAny?.strAuto;
  const strAdmin = rAny?.comparativa?.str_admin ?? rAny?.escenarios?.strAdmin ?? rAny?.strAdmin;
  const difAutoAdmin =
    strAuto && strAdmin ? (Number(strAuto.flujoCajaMensual) || 0) - (Number(strAdmin.flujoCajaMensual) || 0) : null;
  const cifraPortada = derivarCifraClaveStr({
    veredicto,
    flujoBaseMensual: Number(rAny?.escenarios?.base?.flujoCajaMensual ?? NaN),
    ahorroAutogestionClpMes:
      inputData?.modoGestion === "administrador" && difAutoAdmin != null && difAutoAdmin > 0 ? difAutoAdmin : null,
    distancia: distanciaPortada,
    ufValue: ufStr,
  });
  const fichaPortada = buildFichaStr({
    input: inputData,
    // adrReferencia del escenario BASE = la tarifa efectiva (override incluido);
    // `adrAjustado` vive en ejesAplicados y no siempre es la tarifa del caso.
    adrNoche: Number(rAny?.escenarios?.base?.adrReferencia) || null,
    ocupacionZona: Number(rAny?.escenarios?.base?.ocupacionReferencia) || null,
    direccion: direccionPortada,
    comuna,
    moneda: currency,
  });
  const latPortada = typeof inputData?.lat === "number" ? (inputData.lat as number) : null;
  const lngPortada = typeof inputData?.lng === "number" ? (inputData.lng as number) : null;
  const compCercanos = useComparablesCercanos({
    comuna,
    superficie: Number(inputData?.superficieUtil) || 0,
    dormitorios: (inputData?.dormitorios as number) ?? null,
    lat: latPortada,
    lng: lngPortada,
  });
  const fechaCorta = (() => {
    const d = new Date(fechaProsa ?? createdAt ?? "");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  })();
  // ═══ FILAS DEL ACORDEÓN (FASE 4) ═══ el cuerpo es DrawerContentSTR, que ya
  // era solo-cuerpo (el shell DrawerSTR aportaba el chrome que ahora muere).
  const filasHallazgosStr: FilaHallazgo[] = hallazgosOrdenadosSTR.map((h, i) => {
    const d = findingDisplay(h, currency, ufValue);
    const key = HALLAZGO_DRAWER_STR[h.id];
    return {
      id: h.id,
      numero: numeroHallazgo(i),
      pregunta: d.title || h.titular,
      valor: d.kpi,
      valorRojo: d.kpiRed,
      anchorId: anchorHallazgo(h),
      cuerpo: key ? (
        <DrawerContentSTR
          activeKey={key}
          analysisId={analysisId}
          results={results}
          inputData={inputData as never}
          comuna={comuna}
          currency={currency}
          valorUF={ufValue}
          ai={aiParaRender as never}
          nivelesPie={nivelesPie}
        />
      ) : null,
    };
  });

  const scrollASimulacion = () => {
    document.getElementById("simulacion-interactiva-str")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isSubscriber = accessLevel === "subscriber";

  // F2-2 — CTA contextual: una sola fuente de props para el mount y la regla
  // de exclusión del pie (WalletStatusCTA no repite el estado rojo de compra).
  const nextCtaProps = {
    isLoggedIn: accessLevel !== "guest" && !isAnonOwner,
    isAnonOwner,
    isSubscriber,
    credits: userCredits,
    welcomeAvailable,
    isSharedView,
    source: "str" as const,
    registerNext: `/analisis/renta-corta/${analysisId}`,
  };
  const nextCtaEsCompra = nextCtaState(nextCtaProps) === "no_credits";
  const isAdmin = false; // El page.tsx ya resuelve admin a "subscriber"

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Chrome de nav/header — el PDF usa la vista documento aparte, no esta página. */}
      {accessLevel === "guest" || isAnonOwner ? (
        <PublicShareHeader
          date={formatFechaCorta(createdAt)}
          anonOwner={isAnonOwner}
          registerNext={`/analisis/renta-corta/${analysisId}`}
        />
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
      )}

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 md:py-8">
        {/* Banner de subordinación AMBAS — hijo STR de un comparativo. */}
        {subordinatedHref && (
          <SubordinatedBanner href={subordinatedHref} modalidad="STR" />
        )}

        {/* CTA conversión — anzuelo (superficie Ink) · solo guest */}
        {accessLevel === "guest" && (
          <div className="mb-5">
            <ConversionHook />
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
        {/* ═══ DOCUMENTO (FASE 3 rediseño Dictamen): papel + portada; el interior
            se transforma en FASE 4 ═══ */}
        <DocumentoFrame>
        <PortadaInforme
          veredicto={veredicto}
          score={score}
          direccion={direccionPortada}
          comuna={comuna}
          modalidadLabel="Renta corta"
          fecha={fechaCorta}
          titular={titularCrudo}
          cifra={cifraPortada}
          ficha={fichaPortada}
          currency={currency}
          onCurrencyChange={setCurrency}
          mapa={
            latPortada != null && lngPortada != null
              ? {
                  lat: latPortada,
                  lng: lngPortada,
                  comparables: compCercanos.comparables,
                  count: compCercanos.count,
                  label: direccionPortada || comuna,
                }
              : null
          }
          onAjustarSupuestos={scrollASimulacion}
        />
        {/* ═══ CUERPO — grilla con el ísotipo f. sticky en el margen (solo PC) ═══ */}
        <div className="doc-cuerpo">
        <div className="doc-cuerpo-margen" aria-hidden="true"><div className="doc-fmark">f.</div></div>
        <div className="min-w-0">
        {/* I-3 fix FASE 1: STR nunca emitió `hero` (solo LTR/comparativa) — el
            embudo por modalidad quedaba cojo al revés que piramide/zona. */}
        <MarcaSeccion seccion="hero" tipo="str" accessLevel={accessLevel} />
        <HeroSTR
          ai={aiParaRender as unknown as AIAnalysisSTRv2 | null}
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
          fechaProsa={fechaProsa}
          aiLoading={aiLoading && !aiAnalysis}
          onOpenDrawer={setActiveDrawer}
        />

        {/* Loading IA: el progreso vive en el slot de prosa del Hero
            (ProgresoGeneracion). Acá abajo solo queda el indicador de error,
            ahora CON reintento (Goal F — antes el error era terminal). */}
        {aiError && !aiAnalysis && (
          <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] mb-3 mt-1 px-1">
            ● Análisis IA no disponible · {aiError} ·{" "}
            <button
              type="button"
              onClick={() => generarProsa("manual")}
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-signal-red hover:underline"
            >
              Reintentar
            </button>
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

        {/* ═══ LOS HALLAZGOS — acordeón (FASE 4, mockup v12) ═══ */}
        <MarcaSeccion seccion="piramide" tipo="str" accessLevel={accessLevel} />
        <HallazgosAcordeon
          tipo="str"
          total={filasHallazgosStr.length}
          filas={filasHallazgosStr}
          veredicto={veredicto}
          accessLevel={accessLevel}
        />

        {/* ESCENARIOS Y PROYECCIÓN (07-10). La prosa ai.largoPlazo dejó de ir inline
            (str-paridad2) y ahora vive en su drawer "A 10 años", abierto desde una
            afordance en la columna Patrimonio (fuera de la secuencia de pirámide, como
            ZonaCardSTR→tipoHuesped). Solo se pasa el handler si hay prosa. */}
        <section className="doc-capitulo" id="simulacion-interactiva-str">
        <div className="doc-cap-eyebrow">La simulación</div>
        <MarcaSeccion seccion="advanced" tipo="str" accessLevel={accessLevel} />
        <div>
        <AdvancedSectionSTR
          results={results}
          currency={currency}
          valorUF={ufValue}
          forceOpen={false}
        />
        </div>
        {/* (a) FASE 4.1 · EL ANÁLISIS A 10 AÑOS — espejo exacto del LTR
            (SubjectCardGrid: "el juicio del horizonte, en su lugar"). Antes su única
            puerta era `onOpenLargoPlazo`, un afordance dentro de AdvancedSectionSTR que
            abría el overlay: quedaba detrás del gate del simulador y a dos clics. Como
            cuerpo del capítulo se lee sin abrir nada, igual que en renta larga.
            No es fila del acordeón a propósito: no tiene hallazgo ni valor que poner en
            la columna derecha — fabricárselo sería inventar. */}
        {(aiParaRender as unknown as AIAnalysisSTRv2 | null)?.largoPlazo?.contenido?.trim() && (
          <div className="mt-5">
            <div className="doc-cap-sub">El análisis a 10 años</div>
            <DrawerContentSTR
              activeKey="largoPlazo"
              analysisId={analysisId}
              results={results}
              inputData={inputData as never}
              comuna={comuna}
              currency={currency}
              valorUF={ufValue}
              ai={aiParaRender as never}
            />
          </div>
        )}
        </section>

        {/* ═══ CAPÍTULO · La zona ═══ card recesiva. E.2: la ex-card 06 "Tipo de huésped"
            se reancla acá (E.1a), abre el drawer tipoHuesped. */}
        <section className="doc-capitulo">
        <div className="doc-cap-eyebrow">La zona</div>
        <MarcaSeccion seccion="zona" tipo="str" accessLevel={accessLevel} />
        <ZonaCardSTR
          lat={(inputData?.lat as number) ?? ((inputData?.zonaRadio as { lat?: number } | undefined)?.lat) ?? null}
          lng={(inputData?.lng as number) ?? ((inputData?.zonaRadio as { lng?: number } | undefined)?.lng) ?? null}
          comuna={comuna}
          onOpen={() => setActiveDrawer("tipoHuesped")}
        />
        </section>
        </div>
        </div>
        </DocumentoFrame>

        {/* CTA post-análisis welcome — banda inline al cierre del informe +
            popup (trigger IntersectionObserver + dwell). Solo cobro welcome.
            Gate aiAnalysis: no montar (banda NI observer) mientras la prosa
            genera — el skeleton deja la banda en viewport y el popup dispara
            sobre el informe vacío, quemando el guard. Render, no CSS. */}
        {showCtaWelcome && aiAnalysis != null && (
          <>
            <div style={{ height: 24 }} />
            <CtaWelcome analysisId={analysisId} />
          </>
        )}

        {/* CTAs de dueño/wallet */}
        {(
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

            {/* CTA contextual — FUERA del documento (FASE 4). */}
            <div style={{ height: 16 }} />
            <MarcaSeccion seccion="next_cta" tipo="str" accessLevel={accessLevel} />
            <NextAnalysisCTA {...nextCtaProps} />

            {/* Wallet status */}
            <div style={{ height: 16 }} />
            <MarcaSeccion seccion="wallet_cta" tipo="str" accessLevel={accessLevel} />
            <WalletStatusCTA
              welcomeAvailable={welcomeAvailable}
              credits={userCredits}
              isSubscriber={isSubscriber}
              isAdmin={isAdmin}
              isSharedView={isSharedView}
              source="str"
              suppressNoCredits={nextCtaEsCompra}
            />
          </>
        )}

        {/* Link analizar otra propiedad — oculto cuando la banda CTA welcome
            está visible (mismo texto, destino distinto: evita el duplicado). */}
        {!showCtaWelcome && (
          <div className="mt-6 mb-4 flex items-center justify-center">
            <Link
              // El wizard legacy de renta corta se retiró. El formulario vivo es
              // el v4 (RUTA_WIZARD en cta-analizar.ts): este link decía v2, que
              // quedó atrás en el cutover ca3106f y mandaba a la gente al wizard
              // anterior. Apunta directo y no al redirect, para no gastar un salto.
              href="/analisis/nuevo-v4"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
            >
              Analizar otra propiedad
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* CTA conversión — cierre (campo Signal Red) · solo guest */}
        {accessLevel === "guest" && (
          <div className="mt-8 mb-4">
            <ConversionCloser />
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
        {activeDrawer && (
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
              ai={aiParaRender as never}
            />
          </DrawerSTR>
        )}
      </main>

      {/* Footer del sitio */}
      <AppFooter variant="minimal" />
    </div>
  );
}
