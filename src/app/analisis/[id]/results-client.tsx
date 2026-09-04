"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { registrarInformeVisto, leerEsperaMs, type InformeAiEstado } from "@/lib/informe-visto";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { calcFlujoDesglose, calcExitScenario, calcProjections } from "@/lib/analysis";
import { resolverModeloCostos, calcMantencionMensual, antiguedadEfectiva } from "@/lib/modelo-costos";
import { readVeredicto } from "@/lib/results-helpers";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { findNearestStation } from "@/lib/metro-stations";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { CtaWelcome } from "@/components/analysis/CtaWelcome";
import { NextAnalysisCTA, nextCtaState } from "@/components/analysis/NextAnalysisCTA";
import { MarcaSeccion } from "@/components/analysis/informeTelemetry";
// Ronda 4a.1: leaf components extraídos a src/components/analysis/.
import { normalizeMetrics, fmtCLP, fmtUF, fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";
// Ronda 4a.2: Advanced Section.
// Ronda 4a.3: Hero + Subject Cards + AI section helpers.
import { SubjectCardGrid } from "@/components/analysis/SubjectCardGrid";
import { hasAiV2 } from "@/components/analysis/AIInsightSection";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";


// El valor de la UF llega siempre como prop desde el server (`ufValue`) y se
// pasa explícitamente a los formateadores y al motor. Antes existía un
// módulo-level `UF_CLP = 38800` mutado en runtime que NUNCA se propagaba al
// motor de `lib/analysis.ts`, causando divergencia entre el snapshot guardado
// (UF server) y los recálculos en cliente (UF default 38800). Ver
// audit/sesionA-residual-2/diagnostico.md.

const COMUNAS_GRAN_SANTIAGO = ["Santiago","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];

// Los helpers y componentes que vivían acá (formatos, tooltips, hero, patrimonio,
// AdvancedSection, Indicators…) se extrajeron a src/components/analysis/ en la ronda
// 4a y varios murieron en T3 (capítulos); T5 borra los comentarios que los seguían
// nombrando por archivos que ya no existen.

// BottomPaywallCTA removed — all users see content directly

// Ronda 4a.1: SectionCard → src/components/analysis/.


export function PremiumResults({
  results, accessLevel = "free", analysisId, inputData, comuna,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  score, freeYieldBruto, freeFlujo, freePrecioM2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumenEjecutivo: _resumenEjecutivo,
  ufValue,
  aiAnalysisInitial,
  aiStale = false,
  puedeRegenerarProsa = true,
  prosaDesactualizada = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nombre = "", ciudad = "", createdAt = "", fechaProsa, superficie = 0, precioUF = 0,
  demoAiData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  creatorName,
  isSharedView = false,
  isSharedLink = false,
  userCredits = 0,
  welcomeAvailable = true,
  ownerFirstName = "",
  analysesCount = 0,
  isLoggedIn = false,
  showCtaWelcome = false,
  isAnonOwner = false,
}: {
  results?: FullAnalysisResult | null;
  accessLevel?: "guest" | "free" | "premium" | "subscriber";
  analysisId?: string;
  inputData?: AnalisisInput;
  comuna?: string;
  score: number;
  freeYieldBruto: number;
  freeFlujo: number;
  freePrecioM2: number;
  resumenEjecutivo: string;
  ufValue: number;
  aiAnalysisInitial?: unknown;
  aiStale?: boolean;
  /** El POST de regeneración exige sesión Y dueño: sin eso no se intenta. */
  puedeRegenerarProsa?: boolean;
  /** Se está mostrando prosa de una versión anterior (el lector no puede regenerar). */
  prosaDesactualizada?: boolean;
  nombre?: string;
  ciudad?: string;
  createdAt?: string;
  fechaProsa?: string;
  superficie?: number;
  precioUF?: number;
  demoAiData?: import("@/lib/types").AIAnalysisV2;
  creatorName?: string;
  isSharedView?: boolean;
  isSharedLink?: boolean;
  userCredits?: number;
  welcomeAvailable?: boolean;
  ownerFirstName?: string;
  analysesCount?: number;
  isLoggedIn?: boolean;
  /** Gate server-side (input_data.chargeMode === "welcome" + dueño): monta el
   * CTA post-análisis welcome (banda inline + popup). */
  showCtaWelcome?: boolean;
  /** Anónimo-DUEÑO (cap F2-2): ve el informe completo pero SIN sesión — los
   * POST de regeneración IA (stale-regen / rescate) exigen login y saldrían
   * 401, así que se suprimen; el polling público a /ai-status queda. Si la
   * generación de creación murió, su recovery es registrarse (claim → regen). */
  isAnonOwner?: boolean;
}) {
  const posthog = usePostHog();
  // T3: sin sliders el horizonte y la plusvalía quedan fijos (los del motor).
  const horizonYears = 10;
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  // Default del slider = la MISMA tasa que proyecta el motor (PLUSVALIA_PROYECCION_ANUAL,
  // 3%). Así la simulación abre coincidiendo con el análisis estático de arriba; mover el
  // slider es explorar, no corregir. Math.round evita el float de 0.03*100.
  const plusvaliaRate = Math.round(PLUSVALIA_PROYECCION_ANUAL * 100);
  // P5 Fase 24 — Sliders huérfanos eliminados (Opción A). Estos valores
  // afectan dynamicProjections pero el user nunca pudo modificarlos. Si se
  // expone en el futuro, rehacer limpio en SliderSimulacion bajo "Avanzado".
  const arriendoGrowth = 3.5;
  const costGrowth = 3.0;


  // ─── Banner partial-failure (Ronda 2b) ──
  // Cuando el wizard v3 hizo modalidad="both" y solo LTR se creó (STR falló por
  // crédito o AirROI), dejó un flag en sessionStorage. Lo leemos UNA VEZ al
  // montar y mostramos un StateBox dismissible al tope de la página. Limpiamos
  // el flag al leer para evitar que se repita en navegaciones futuras.
  const [bothPartial, setBothPartial] = useState<{ failed: "ltr" | "str"; error: string } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("franco_both_partial");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ok?: string; failed?: string; error?: string };
      // Solo mostrar si esta página (LTR) corresponde al lado que sí funcionó.
      if (parsed.ok === "ltr" && parsed.failed === "str") {
        setBothPartial({ failed: "str", error: parsed.error || "El análisis de renta corta falló." });
      }
      sessionStorage.removeItem("franco_both_partial");
    } catch { /* ignore */ }
  }, []);

  // PostHog: track analysis view
  useEffect(() => {
    const veredicto = readVeredicto(results);
    posthog?.capture('analysis_viewed', {
      analysis_id: analysisId,
      comuna,
      score,
      veredicto,
      // Commit E.2 · 2026-05-13 — flag deprecado, siempre false. Antes filtraba
      // análisis donde `francoVerdict !== engineSignal`; tras colapsar a un
      // solo `veredicto`, la divergencia ya no existe en producción. Se mantiene
      // el campo en el event schema para continuidad de queries históricas;
      // queries nuevas deben ignorarlo. Eliminar en una iteración posterior
      // cuando PostHog haya rotado el período de retención.
      francoOverridesEngine: false,
      is_owner: !isSharedView && !isSharedLink,
      is_shared_view: isSharedView || isSharedLink,
      access_level: accessLevel,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI Analysis state — new v2 structure. Polls /ai-status while the fire-and-forget
  // generation from /api/analisis completes; falls back to POST /api/analisis/ai after timeout.
  const [aiAnalysis, setAiAnalysis] = useState<import("@/lib/types").AIAnalysisV2 | null>(
    hasAiV2(aiAnalysisInitial) ? aiAnalysisInitial : null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Goal B (simplificado por Goal C) — estado de la prosa AL MOMENTO en que el
  // veredicto queda visible (= mount del grid, ahora inmediato). Ya no registra
  // "por qué vía llegó la prosa": el evento dispara antes de que llegue.
  const aiEstadoAlMontar = useRef<InformeAiEstado>(
    aiStale ? "stale-regen" : hasAiV2(aiAnalysisInitial) ? "cacheada" : "generando"
  );

  // `trigger` es telemetría de timing (Goal A): declara QUIÉN pidió la
  // generación (botón manual / regen por versión stale / fallback de 60s).
  // Viaja en el body y termina en pipeline_timing.generaciones[].trigger.
  const generateAiManually = useCallback(async (trigger: "manual" | "stale-regen" = "manual") => {
    if (!analysisId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, trigger }),
      });
      const data = await res.json();
      if (res.ok && hasAiV2(data)) {
        setAiAnalysis(data);
      } else {
        setAiError(data?.error || "Error al generar análisis");
      }
    } catch {
      setAiError("Error de conexión");
    } finally {
      setAiLoading(false);
    }
  }, [analysisId]);

  // Goal B — el grid avisa cuando el veredicto queda visible (Goal C: al montar,
  // el overlay murió). Captura `informe_visto` + persiste `informe_visible_at`
  // (fail-soft, NULL-only en el SQL). El demo (sin analysisId) no registra.
  const onInformeVisible = useCallback(() => {
    if (!analysisId) return;
    registrarInformeVisto({
      posthog,
      ids: [analysisId],
      modalidad: "ltr",
      aiEstado: aiEstadoAlMontar.current,
      esperaMs: leerEsperaMs(),
      esOwner: !isSharedView && !isSharedLink,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, posthog, isSharedView, isSharedLink]);

  // Goal C — polling PERSISTENTE de /ai-status. Ya no abandona a los 60s para
  // regenerar (eso duplicaba la generación completa mientras la background
  // seguía viva — medido en prod: el usuario pagaba 60s de polling + una
  // generación entera). Ahora:
  //   · 5s el primer minuto, 10s después (backoff), sin tope propio.
  //   · El RESCATE (POST /api/analisis/ai, trigger "rescate") corre UNA vez y
  //     SOLO cuando el server declara la generación muerta (`puedeRescate`:
  //     entrada error en pipeline_timing, o >6 min sin prosa — imposible que
  //     siga viva con maxDuration 300s en /api/analisis).
  //   · Errores de red transitorios no matan el loop (10 consecutivos sí).
  useEffect(() => {
    // Demo path: no analysisId, use hardcoded demo data.
    if (!analysisId && demoAiData) {
      if (!hasAiV2(aiAnalysis) && hasAiV2(demoAiData)) {
        setAiLoading(true);
        const t = setTimeout(() => {
          setAiAnalysis(demoAiData as unknown as import("@/lib/types").AIAnalysisV2);
          setAiLoading(false);
        }, 400);
        return () => clearTimeout(t);
      }
      return;
    }
    if (!analysisId) return;
    // T2.1: con prosa vieja en pantalla igual se intenta la regen (solo el dueño); si falla,
    // la vieja se queda con su fecha. Sin prosa y con 500: error inline + Reintentar.
    if (hasAiV2(aiAnalysis) && !aiStale) return;

    // F6 lazy-on-open: la prosa persistida quedó STALE (versión vieja) → el server no la
    // pasó como inicial y marcó aiStale. El poll a /ai-status devolvería la MISMA prosa
    // vieja como "ready", así que NUNCA polleamos en este caso: regeneramos directo vía
    // POST (route no cobra: hadPriorProse). Guard !aiError → un fallo no reintenta; el
    // effect corre una vez ([analysisId]) → sin loop.
    if (aiStale) {
      // Solo el DUEÑO con sesión (o admin) puede regenerar: el POST responde 401
      // sin sesión y 403 sobre una fila ajena. Antes se disparaba igual desde un
      // link compartido y el request moría en 401, dejando el informe sin prosa y
      // con un error a cuestas. Ahora al que no puede regenerar el server le mandó
      // la prosa vieja con su fecha, y acá no se intenta nada.
      if (!aiError && puedeRegenerarProsa && !isAnonOwner) generateAiManually("stale-regen");
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
        const res = await fetch(`/api/analisis/${analysisId}/ai-status`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        erroresConsecutivos = 0;
        if (data?.ready && hasAiV2(data.ai_analysis)) {
          setAiAnalysis(data.ai_analysis);
          setAiLoading(false);
          return;
        }
        if (data?.puedeRescate && !rescateDisparado && !isAnonOwner) {
          // La generación background está muerta (dictamen del server, no un
          // timeout del cliente): una regeneración de verdad, una sola vez.
          rescateDisparado = true;
          const aiRes = await fetch("/api/analisis/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysisId, trigger: "rescate" }),
          });
          const aiData = await aiRes.json();
          if (cancelled) return;
          if (aiRes.ok && hasAiV2(aiData)) {
            setAiAnalysis(aiData);
            setAiLoading(false);
          } else {
            setAiError(aiData?.error || "Error generando análisis");
            setAiLoading(false);
          }
          return;
        }
        reagendar();
      } catch {
        if (cancelled) return;
        // Red transitoria (mobile, cambio de red): el polling sigue; recién
        // tras una racha larga de fallos se declara el error.
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

  const m = normalizeMetrics(results?.metrics);

  // F2-2 — CTA contextual "siguiente análisis" (copy A). Una sola fuente de
  // props: el mount (dentro del cuerpo, antes de la Advanced Section) y la
  // regla de exclusión del pie (WalletStatusCTA no repite el estado rojo).
  const nextCtaProps = {
    isLoggedIn,
    isAnonOwner,
    isSubscriber: accessLevel === "subscriber",
    credits: userCredits,
    welcomeAvailable,
    isSharedView: isSharedView || isSharedLink,
    source: "ltr" as const,
    registerNext: analysisId ? `/analisis/${analysisId}` : undefined,
  };
  const nextCtaEsCompra = nextCtaState(nextCtaProps) === "no_credits";

  // Top-level pre-delivery months calculation
  const mesesPreEntregaTop = useMemo(() => {
    if (!inputData || inputData.estadoVenta === "inmediata" || !inputData.fechaEntrega) return 0;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    if (!a || !me) return 0;
    const now = new Date();
    const ent = new Date(a, me - 1);
    return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }, [inputData]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fechaEntregaLabel = useMemo(() => {
    if (!inputData?.fechaEntrega) return "";
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${meses[(me || 1) - 1]} ${a}`;
  }, [inputData]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const horizonBeforeDelivery = mesesPreEntregaTop > 0 && horizonYears * 12 <= mesesPreEntregaTop;
  const mesesParaVerFlujo = mesesPreEntregaTop + 12;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const anosParaVerFlujo = Math.ceil(mesesParaVerFlujo / 12);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fmt = useCallback((n: number) => fmtMoney(n, currency, ufValue), [currency, ufValue]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fmtAxis = useCallback((n: number) => fmtAxisMoney(n, currency, ufValue), [currency, ufValue]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const flujoBreakdown = useMemo(() => {
    if (!m || !inputData) return null;
    return calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: m.gastos,
      contribuciones: m.contribuciones,
      mantencion: m.provisionMantencionAjustada,
      vacanciaMeses: inputData.vacanciaMeses ?? 1,
      usaAdministrador: inputData.usaAdministrador,
      comisionAdministrador: inputData.comisionAdministrador,
    });
  }, [m, inputData]);

  // Capa 3 — Simulación. Recompute projections cuando cambian sliders.
  // Antes (Sesión A) era un clon inline divergente de calcProjections; hoy
  // delega al motor (lib/analysis.ts) para garantizar coherencia con la TIR
  // principal en defaults. Ver audit/sesionA-fix/ y el diagnóstico previo.
  const dynamicProjections = useMemo(() => {
    if (!results || !m || !inputData) return results?.projections ?? [];
    return calcProjections({
      input: inputData,
      metrics: m,
      plazoVenta: 30,
      plusvaliaAnual: plusvaliaRate / 100,
      ufClp: ufValue,
      // Fecha congelada a created_at (no la viva del navegador): el simulador de
      // sliders no debe driftar meses-hasta-entrega. of-datedrift-design.md.
      asOf: createdAt ? new Date(createdAt) : new Date(),
    });
  }, [results, m, inputData, plusvaliaRate, ufValue, createdAt]);

  // dynamicRefi removed — refi section now calculates directly from projData


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const radarData = results ? [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusvalía", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Eficiencia", value: results.desglose.eficiencia, fullMark: 100 },
  ] : [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const waterfallData = useMemo(() => {
    if (!m || !inputData) return [];
    const wf = calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: m.gastos,
      contribuciones: m.contribuciones,
      mantencion: m.provisionMantencionAjustada,
      vacanciaMeses: inputData.vacanciaMeses,
      usaAdministrador: inputData.usaAdministrador,
      comisionAdministrador: inputData.comisionAdministrador,
    });

    const egresos = [
      { name: "Div.", value: wf.dividendo },
      { name: "GGCC", value: wf.ggccVacancia },
      { name: "Cont.", value: wf.contribucionesMes },
      { name: "Mant.", value: wf.mantencion },
      { name: "Vac.", value: wf.vacanciaProrrata },
      { name: "Corr.", value: wf.corretajeProrrata },
      { name: "Rec.", value: wf.recambio },
      { name: "Gestión", value: wf.administracion },
    ].filter(e => e.value > 0).sort((a, b) => b.value - a.value);

    const steps: { name: string; delta: number }[] = [
      { name: "Arr.", delta: wf.arriendo },
      ...egresos.map(e => ({ name: e.name, delta: -e.value })),
    ];

    let running = 0;
    const items: { name: string; range: [number, number]; fill: string; isResult: boolean; delta: number; running: number }[] = [];
    for (const s of steps) {
      const newRunning = running + s.delta;
      const bottom = Math.min(running, newRunning);
      const top = Math.max(running, newRunning);
      items.push({
        name: s.name,
        range: [bottom, top],
        fill: s.delta >= 0 ? "var(--franco-bar-fill)" : "color-mix(in srgb, var(--signal-red) 80%, transparent)",
        isResult: false,
        delta: s.delta,
        running: newRunning,
      });
      running = newRunning;
    }
    // FLUJO NETO result bar: from 0 to running
    const flujo = running;
    items.push({
      name: "Neto",
      range: [Math.min(0, flujo), Math.max(0, flujo)],
      fill: flujo >= 0 ? "var(--franco-text-secondary)" : "var(--signal-red)",
      isResult: true,
      delta: flujo,
      running: flujo,
    });
    return items;
  }, [m, inputData]);

  interface CashflowRow {
    name: string;
    _x: number; // month number (0=T0, 1=M1, 12=Año 1, etc.)
    Ingreso: number;
    Dividendo: number;
    GGCC: number;
    Contribuciones: number;
    Mantencion: number;
    Vacancia: number;
    Corretaje: number;
    Recambio: number;
    Administracion: number;
    FlujoNeto: number;
    Acumulado: number;
  }

  const isMonthlyView = horizonYears <= 2;

  // Label helper for annual view X axis
  function annualCashflowLabel(month: number, preEntrega: number): string {
    if (month === 0) return "T0";
    if (preEntrega > 0 && month === preEntrega && month % 12 !== 0) return "Entrega";
    if (month % 12 === 0) return `Año ${month / 12}`;
    return `M${month}`;
  }

  const cashflowData = useMemo((): CashflowRow[] => {
    if (!m || !results || !inputData) return [];

    const totalMonths = horizonYears * 12;

    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;

    // Always calculate month by month
    const allData: CashflowRow[] = [];
    allData.push({ name: "T0", _x: 0, Ingreso: 0, Dividendo: 0, GGCC: 0, Contribuciones: 0, Mantencion: 0, Vacancia: 0, Corretaje: 0, Recambio: 0, Administracion: 0, FlujoNeto: 0, Acumulado: 0 });

    let acumulado = 0;
    let arriendoActual = inputData.arriendo;
    let gastosActual = m.gastos;
    let contribucionesActual = m.contribuciones;
    const costGrowthDec = costGrowth / 100;

    // Misma fuente única que calcProjections (modelo-costos.ts): gate por versión,
    // antigüedad efectiva (reset post-CapEx en v3) y techo 6% sobre el arriendo del
    // depto reajustado. Antes la rama `inputData.provisionMantencion ||` mantenía
    // el valor año-1 como CONSTANTE, divergente del motor.
    const modeloCostos = resolverModeloCostos(inputData.methodologyVersion);
    const tieneCapex = modeloCostos === "v3" && (m.capexPuestaAPuntoCLP ?? 0) > 0;
    const aniosEntregaCliente = Math.ceil(mesesPreEntrega / 12);
    const ufCliente = inputData.precio > 0 ? m.precioCLP / inputData.precio : 0;
    function getMantencionForMonth(mes: number): number {
      const anioProyeccion = Math.ceil(mes / 12);
      // Convención de `t` espejo del motor: legacy año 1 ⇒ antigüedad + 1; v3 parte en 0.
      const t = modeloCostos === "v3"
        ? Math.max(0, anioProyeccion - 1 - aniosEntregaCliente)
        : anioProyeccion;
      const antiguedadActual = antiguedadEfectiva(inputData!.antiguedad, t, tieneCapex);
      return calcMantencionMensual({
        modelo: modeloCostos,
        antiguedad: antiguedadActual,
        superficieUtilM2: inputData!.superficie,
        precioCLP: m!.precioCLP,
        arriendoCLP: inputData!.arriendo * Math.pow(1 + arriendoGrowth / 100, anioProyeccion - 1),
        ufClp: ufCliente,
        factorInflacion: Math.pow(1 + costGrowthDec, anioProyeccion - 1),
      });
    }

    function buildRow(mes: number, arriendoAct: number, gastosAct: number, contribAct: number): CashflowRow {
      const mantencionMes = getMantencionForMonth(mes);
      const fd = calcFlujoDesglose({
        arriendo: arriendoAct,
        dividendo: m!.dividendo,
        ggcc: gastosAct,
        contribuciones: contribAct,
        mantencion: mantencionMes,
        vacanciaMeses: inputData!.vacanciaMeses ?? 1,
        usaAdministrador: inputData!.usaAdministrador,
        comisionAdministrador: inputData!.comisionAdministrador,
      });
      const flujoNeto = fd.flujoNeto;
      acumulado += flujoNeto;
      return { name: `M${mes}`, _x: mes, Ingreso: Math.round(arriendoAct), Dividendo: -fd.dividendo, GGCC: -fd.ggccVacancia, Contribuciones: -fd.contribucionesMes, Mantencion: -fd.mantencion, Vacancia: -fd.vacanciaProrrata, Corretaje: -fd.corretajeProrrata, Recambio: -fd.recambio, Administracion: -fd.administracion, FlujoNeto: Math.round(flujoNeto), Acumulado: acumulado };
    }

    if (inputData.estadoVenta !== "inmediata" && mesesPreEntrega > 0) {
      for (let mes = 1; mes <= totalMonths; mes++) {
        if (mes <= mesesPreEntrega) {
          allData.push({ name: `M${mes}`, _x: mes, Ingreso: 0, Dividendo: 0, GGCC: 0, Contribuciones: 0, Mantencion: 0, Vacancia: 0, Corretaje: 0, Recambio: 0, Administracion: 0, FlujoNeto: 0, Acumulado: acumulado });
        } else {
          if (mes > mesesPreEntrega + 1 && (mes - 1) % 12 === 0) {
            arriendoActual *= (1 + arriendoGrowth / 100);
            gastosActual *= (1 + costGrowthDec);
            contribucionesActual *= (1 + costGrowthDec);
          }
          allData.push(buildRow(mes, arriendoActual, gastosActual, contribucionesActual));
        }
      }
    } else {
      for (let i = 1; i <= totalMonths; i++) {
        if (i > 1 && (i - 1) % 12 === 0) {
          arriendoActual *= (1 + arriendoGrowth / 100);
          gastosActual *= (1 + costGrowthDec);
          contribucionesActual *= (1 + costGrowthDec);
        }
        allData.push(buildRow(i, arriendoActual, gastosActual, contribucionesActual));
      }
    }

    if (isMonthlyView) return allData;

    // Annual view: aggregate 12 months per year
    const annualData: CashflowRow[] = [allData[0]]; // T0
    for (let y = 1; y <= horizonYears; y++) {
      const start = (y - 1) * 12 + 1; // month index in allData (T0 is index 0, M1 is index 1)
      const end = y * 12;
      let sumIngreso = 0, sumDividendo = 0, sumGGCC = 0, sumContribuciones = 0;
      let sumMantencion = 0, sumVacancia = 0, sumCorretaje = 0, sumRecambio = 0, sumAdministracion = 0, sumFlujoNeto = 0;
      for (let mi = start; mi <= end && mi < allData.length; mi++) {
        const row = allData[mi];
        sumIngreso += row.Ingreso;
        sumDividendo += row.Dividendo;
        sumGGCC += row.GGCC;
        sumContribuciones += row.Contribuciones;
        sumMantencion += row.Mantencion;
        sumVacancia += row.Vacancia;
        sumCorretaje += row.Corretaje;
        sumRecambio += row.Recambio;
        sumAdministracion += row.Administracion;
        sumFlujoNeto += row.FlujoNeto;
      }
      const lastMonth = Math.min(end, allData.length - 1);
      annualData.push({
        name: annualCashflowLabel(end, mesesPreEntrega),
        _x: end,
        Ingreso: Math.round(sumIngreso),
        Dividendo: Math.round(sumDividendo),
        GGCC: Math.round(sumGGCC),
        Contribuciones: Math.round(sumContribuciones),
        Mantencion: Math.round(sumMantencion),
        Vacancia: Math.round(sumVacancia),
        Corretaje: Math.round(sumCorretaje),
        Recambio: Math.round(sumRecambio),
        Administracion: Math.round(sumAdministracion),
        FlujoNeto: Math.round(sumFlujoNeto),
        Acumulado: allData[lastMonth]?.Acumulado ?? 0,
      });
    }
    return annualData;
  }, [horizonYears, isMonthlyView, results, m, inputData, arriendoGrowth, costGrowth]);

  // Egreso bar series ordered by average absolute impact (descending), filtered to non-zero
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const egresoBarSeries = useMemo(() => {
    const allSeries: { key: keyof CashflowRow; label: string; color: string }[] = [
      { key: "Dividendo", label: "Dividendo", color: "color-mix(in srgb, var(--signal-red) 85%, transparent)" },
      { key: "GGCC", label: "GGCC", color: "color-mix(in srgb, var(--signal-red) 70%, transparent)" },
      { key: "Contribuciones", label: "Contribuciones", color: "var(--franco-text-muted)" },
      { key: "Mantencion", label: "Mantención", color: "color-mix(in srgb, var(--signal-red) 60%, transparent)" },
      { key: "Vacancia", label: "Vacancia", color: "var(--franco-border)" },
      { key: "Corretaje", label: "Corretaje", color: "var(--franco-text-muted)" },
      { key: "Recambio", label: "Recambio", color: "var(--franco-border)" },
      { key: "Administracion", label: "Gestión del arriendo", color: "var(--franco-text-muted)" },
    ];
    const dataRows = cashflowData.filter(r => r._x > 0);
    if (dataRows.length === 0) return allSeries.filter(s => s.key !== "Administracion");
    return allSeries
      .map(s => {
        const avg = dataRows.reduce((sum, r) => sum + Math.abs(r[s.key] as number), 0) / dataRows.length;
        return { ...s, avg };
      })
      .filter(s => s.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [cashflowData]);

  // Exit scenario helper — usa el motor como fuente única de verdad
  const calcExitForYear = useCallback((years: number, _flujoAcum: number) => {
    if (!results || !m || !inputData || dynamicProjections.length === 0) return null;
    if (!dynamicProjections[years - 1]) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unused = _flujoAcum; // firma compatible; el motor recomputa internamente
    return calcExitScenario(inputData, m, dynamicProjections, years);
  }, [results, m, inputData, dynamicProjections]);

  // Fixed 10-year exit for header metrics (independent of horizon slider)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fixedExit10 = useMemo(() => {
    if (dynamicProjections.length < 10) return null;
    // Calculate 10-year flujo acumulado from dynamicProjections
    let flujoAcum10 = 0;
    for (let i = 0; i < 10; i++) flujoAcum10 += dynamicProjections[i].flujoAnual;
    return calcExitForYear(10, flujoAcum10);
  }, [dynamicProjections, calcExitForYear]);

  // dynamicExit removed — exit section now reads directly from projData

  // T3 (02-sep-2026): murió acá `projData`, un useMemo de ~180 líneas sin
  // consumidor (eslint-disable unused) cuyas deps no incluían `ufValue` — la deuda
  // anotada en memoria. El patrimonio año a año lo dibuja el capítulo V desde
  // `buildPatrimonioSeries`, la fuente única compartida con el PDF.

  const mapQuery = inputData?.direccion
    ? `${inputData.direccion}, ${comuna || inputData?.comuna}, Chile`
    : `${comuna || inputData?.comuna}, Santiago, Chile`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const googleMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  // (exit/refi section reads directly from projData inline)

  // Derived strings for HeroCard top strip
  // Title: "Depto {dorm}D{baños}B / {comuna}" si hay schema completo;
  // fallback al nombre user-given si dormitorios/baños faltan (análisis legacy).
  const propiedadTitle = (inputData?.dormitorios != null && inputData?.banos != null)
    ? `Depto ${inputData.dormitorios}D${inputData.banos}B / ${comuna || ciudad || ""}`
    : nombre || `Depto / ${comuna || ciudad || ""}`;
  const propiedadSubtitle = ownerFirstName && !isSharedView
    ? `${ownerFirstName}, tu análisis en ${comuna || ciudad || "tu zona"}`
    : `Análisis en ${comuna || ciudad || "tu zona"}`;
  // Metadata 3x2 (Fase 18): Superficie/Pie/Financiamiento siempre en su unidad
  // natural (m² / % / años·%). Precio, $/M² y Arriendo respetan toggle currency.
  const arriendoCLP = Number(inputData?.arriendo) || 0;
  const plazoAnios = Number(inputData?.plazoCredito) || 25;
  const tasaPct = Number(inputData?.tasaInteres) || 4.72;
  const tasaStr = tasaPct.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const metadataItems = [
    {
      label: "SUPERFICIE",
      value: `${superficie} m²`,
      tooltip: "Superficie útil del depto en metros cuadrados.",
    },
    {
      label: "PRECIO",
      value: currency === "UF" ? fmtUF(precioUF) : fmtCLP(precioUF * ufValue),
    },
    {
      label: "$/M²",
      value: currency === "UF"
        ? `UF ${(Math.round(freePrecioM2 * 100) / 100).toLocaleString("es-CL")}/m²`
        : fmtCLP(freePrecioM2 * ufValue),
      tooltip: "Precio por metro cuadrado. Útil para comparar contra el promedio de la comuna independiente del tamaño del depto.",
    },
    {
      label: "PIE",
      value: `${inputData?.piePct ?? 20}%`,
      tooltip: "Porcentaje del precio pagado con recursos propios, sin crédito hipotecario.",
    },
    {
      label: "FINANCIAMIENTO",
      value: `${plazoAnios} años · ${tasaStr}%`,
      tooltip: "Plazo del crédito hipotecario y tasa anual de interés.",
    },
    {
      label: "ARRIENDO",
      value: arriendoCLP > 0
        ? (currency === "UF"
          ? `UF ${(Math.round((arriendoCLP / ufValue) * 100) / 100).toLocaleString("es-CL")}/mes`
          : `${fmtCLP(arriendoCLP)}/mes`)
        : "—",
      tooltip: "Arriendo mensual estimado o ajustado por el usuario.",
    },
  ];
  const resolvedVeredicto = readVeredicto(results) || (score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");

  const mainContent = (
    <>
      {/* Shared view banner (logged in user viewing someone else's analysis) */}
      {isSharedView && (
        <div className="bg-[var(--franco-card)] text-[var(--franco-text)] rounded-xl p-4 px-5 mb-4 flex items-center justify-between gap-3 flex-wrap border border-[var(--franco-border)]">
          <p className="font-body text-sm">Estás viendo un análisis compartido.</p>
          <a href="/analisis/nuevo-v4" className="font-body text-sm font-medium text-signal-red hover:underline shrink-0">
            Analizar mi propio depto →
          </a>
        </div>
      )}
      {/* Banner: comuna fuera del Gran Santiago */}
      {(() => {
        const comunaActual = (comuna || inputData?.comuna || '').trim();
        if (comunaActual && !COMUNAS_GRAN_SANTIAGO.includes(comunaActual)) {
          return (
            <div className="rounded-xl border border-[var(--franco-warning)]/30 bg-[var(--franco-warning)]/[0.06] px-5 py-3.5 mb-4">
              <p className="font-body text-[13px] text-[var(--franco-warning)]">
                Este análisis tiene precisión limitada. Franco está optimizado para el Gran Santiago — los datos de mercado, plusvalía y metro aplican a esa zona.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* ═══════ DETAIL SECTIONS ═══════ */}
      {results && m && (
        <>
          <MarcaSeccion seccion="hero" tipo="ltr" accessLevel={accessLevel} />
          {/* 1. AI Analysis — dashboard (hero + 2×2 + drawer) */}
          <SubjectCardGrid
            aiAnalysis={aiAnalysis}
            loading={aiLoading}
            error={aiError}
            accessLevel={accessLevel}
            currency={currency}
            onCurrencyChange={setCurrency}
            veredicto={resolvedVeredicto}
            score={score}
            propiedadTitle={propiedadTitle}
            propiedadSubtitle={propiedadSubtitle}
            metadataItems={metadataItems}
            onRetry={() => generateAiManually("manual")}
            onInformeVisible={onInformeVisible}
            results={results}
            inputData={inputData}
            valorUF={ufValue}
            analysisId={analysisId}
            comuna={comuna}
            createdAt={createdAt}
            fechaProsa={fechaProsa}
            prosaDesactualizada={prosaDesactualizada || (aiStale && hasAiV2(aiAnalysis) && aiAnalysis === aiAnalysisInitial)}
          />
        </>
      )}

    </>
  );

  // P5 Fase 24 — projectionFields dead code eliminado. Sliders huérfanos
  // (Horizonte, Plusvalía, Crecimiento arriendo/gastos) nunca se renderizaron.
  // Si se requiere exponer simulación avanzada, hacerlo en SliderSimulacion.

  // Paneles laterales eliminados (Fase 3). Capa 1+2 usan siempre valores del
  // análisis original; la simulación editable vive en el acordeón Capa 3.
  return (
    <>
      <div className="min-w-0">
        {/* CTA conversión — anzuelo (superficie Ink) · solo guest */}
        {accessLevel === "guest" && (
          <div className="mb-5">
            <ConversionHook />
          </div>
        )}
        {bothPartial && (
          <div className="max-w-5xl mx-auto px-4 md:px-6 pt-4">
            <div className="flex items-start gap-3 rounded-r-lg p-4 relative"
              style={{
                borderLeft: "3px solid #C8323C",
                background: "color-mix(in srgb, #C8323C 6%, transparent)",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold m-0 mb-1" style={{ color: "#C8323C" }}>
                  Análisis Airbnb no se generó
                </p>
                <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-snug">
                  {bothPartial.error} Puedes reintentarlo desde el dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBothPartial(null)}
                aria-label="Cerrar mensaje"
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text-secondary)] transition-colors"
              >
                <span className="font-body text-[16px] leading-none">×</span>
              </button>
            </div>
          </div>
        )}
        {mainContent}

        {/* CTA post-análisis welcome — banda inline al cierre del informe +
            popup (trigger IntersectionObserver + dwell). Solo cobro welcome.
            Gate aiAnalysis: no montar (banda NI observer) mientras el informe
            está en skeleton de generación — el layout corto deja la banda en
            viewport y el popup dispara sobre el skeleton, quemando el guard.
            Render, no CSS (el observer no debe armarse). */}
        {showCtaWelcome && analysisId && aiAnalysis != null && (
          <div className="mt-8">
            <CtaWelcome analysisId={analysisId} />
          </div>
        )}

        {/* CTAs FUERA del documento (FASE 4): el informe termina en su footer;
            lo comercial vive después, en el flujo de la página. */}
        <div className="mt-8">
          <MarcaSeccion seccion="next_cta" tipo="ltr" accessLevel={accessLevel} />
          <NextAnalysisCTA {...nextCtaProps} />
        </div>

        {/* WalletStatusCTA in-line al cierre — refleja estado del wallet
            del user logueado. Excluye admin/sharedView/welcomeDisponible. */}
        <div className="mt-8">
          <MarcaSeccion seccion="wallet_cta" tipo="ltr" accessLevel={accessLevel} />
          <WalletStatusCTA
            welcomeAvailable={welcomeAvailable}
            credits={userCredits}
            isSubscriber={accessLevel === "subscriber"}
            isAdmin={false /* admin → accessLevel="subscriber" en este componente */}
            isSharedView={isSharedView}
            source="ltr"
            suppressNoCredits={nextCtaEsCompra}
          />
        </div>
      </div>
      <ProCTABanner
        analysesCount={analysesCount}
        isLoggedIn={isLoggedIn}
        accessLevel={accessLevel}
        welcomeAvailable={welcomeAvailable}
        isSharedView={isSharedView}
        source="results"
      />
      {/* CTA conversión — cierre (campo Signal Red) · solo guest */}
      {accessLevel === "guest" && (
        <div className="mt-8 mb-4">
          <ConversionCloser />
        </div>
      )}
    </>
  );
}

