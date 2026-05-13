"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Loader2,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { calcFlujoDesglose, getMantencionRate, calcExitScenario, calcProjections } from "@/lib/analysis";
import { readVeredicto } from "@/lib/results-helpers";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { findNearestStation } from "@/lib/metro-stations";
import type { MarketDataRow } from "@/lib/market-data";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
// Ronda 4a.1: leaf components extraídos a src/components/analysis/.
import { normalizeMetrics, fmtCLP, fmtUF, fmtMoney, fmtAxisMoney } from "@/components/analysis/utils";
// Ronda 4a.2: Advanced Section.
import { AdvancedSection } from "@/components/analysis/AdvancedSection";
// Ronda 4a.3: Hero + Subject Cards + AI section helpers.
import { SubjectCardGrid } from "@/components/analysis/SubjectCardGrid";
import { hasAiV2 } from "@/components/analysis/AIInsightSection";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "@/lib/plusvalia-historica";


// El valor de la UF llega siempre como prop desde el server (`ufValue`) y se
// pasa explícitamente a los formateadores y al motor. Antes existía un
// módulo-level `UF_CLP = 38800` mutado en runtime que NUNCA se propagaba al
// motor de `lib/analysis.ts`, causando divergencia entre el snapshot guardado
// (UF server) y los recálculos en cliente (UF default 38800). Ver
// audit/sesionA-residual-2/diagnostico.md.

const COMUNAS_GRAN_SANTIAGO = ["Santiago","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const METRIC_TOOLTIPS: Record<string, string> = {
  "Rentabilidad Bruta": "Rentabilidad anual bruta: arriendo anual dividido por el precio. No descuenta ningún gasto. Es el número que te muestra el corredor.",
  "Rentabilidad Neta": "Rentabilidad después de TODOS los gastos: operativos, vacancia, corretaje y recambio de arrendatario. Es el número más honesto de rentabilidad.",
  "Rent. Operativa (CAP Rate)": "Retorno neto operativo anual (NOI/Precio). Descuenta gastos comunes, contribuciones y mantención. Estándar internacional para comparar propiedades.",
  "Cash-on-Cash": "Retorno anual sobre TU capital invertido (el pie). Si es negativo, estás poniendo plata de tu bolsillo cada mes.",
  "ROI Total": "Retorno total considerando flujo de caja + plusvalía en el período. Incluye el efecto del apalancamiento.",
  "TIR": "Tasa Interna de Retorno. Permite comparar esta inversión con otras alternativas (depósito a plazo, fondos mutuos, etc.)",
  "Payback Pie": "Meses que toma recuperar el pie invertido solo con flujo de caja. N/A si el flujo es negativo.",
  "Franco Score": "Puntaje de 1-100 que evalúa 4 dimensiones: Rentabilidad (30%), Flujo de Caja (25%), Plusvalía (25%), Eficiencia de compra (20%)",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RADAR_TOOLTIPS: Record<string, string> = {
  "Rentabilidad": "Rentabilidad bruta del arriendo sobre el precio de compra. Incluye bonus por rentabilidad neta alta. Peso: 30%",
  "Flujo Caja": "Flujo mensual relativo al arriendo. Mide qué proporción del ingreso queda disponible después de todos los gastos. Peso: 25%",
  "Plusvalía": "Potencial de valorización basado en cercanía a estaciones de metro (actuales y futuras), plusvalía histórica de la comuna (2014-2024) y antigüedad del inmueble. Peso: 25%",
  "Eficiencia": "Comparación de tu precio por m² y yield bruto contra publicaciones reales en un radio de 1,5 km. Peso: 20%",
};

// Ronda 4a.1: normalizeMetrics, fmtCLP, fmtPct, parseUFString → src/components/analysis/utils.ts
// Ronda 4a.2: fmtUF, fmtMoney, fmtM, fmtAxisMoney → src/components/analysis/utils.ts.

// Ronda 4a.3: renderAiContent + hasAiV2 → src/components/analysis/AIInsightSection.tsx.

// Ronda 4a.1: CollapsibleSection, MetricRow, SimulationTag → src/components/analysis/.

// Ronda 4a.2: IndicadoresRentabilidadContent → src/components/analysis/Indicators.tsx.

// ─── Gráfico de patrimonio (acordeón 2 · Capa 3) ─────
// Ronda 4a.2: GraficoPatrimonioContent → src/components/analysis/PatrimonioChart.tsx.

// ─── Venta o Refi (acordeón 3 · Capa 3) ──────────────
// Ronda 4a.2: VentaRefiContent → src/components/analysis/SaleRefiBlock.tsx.

// Ronda 4a.2: AdvancedSection → src/components/analysis/AdvancedSection.tsx.

// Ronda 4a.3: VERDICT_TOOLTIPS + FRANCO_SCORE_TOOLTIP + VERDICT_STYLES +
// getVerdictStyles + buildHeroDatosClave → src/components/analysis/AIInsightSection.tsx.

// stub eliminado-bloque - cuerpo dummy para preservar match (sin uso):
// Ronda 4a.3: buildHeroDatosClave + HeroTopStrip + HeroCard +
// ReestructuracionMiniCard + DashboardAnalysisSection → src/components/analysis/.


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calcTIR(flujos: number[]): number {
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dnpv = 0;
    for (let i = 0; i < flujos.length; i++) {
      npv += flujos[i] / Math.pow(1 + rate, i);
      dnpv -= (i * flujos[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(npv) < 1) break;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
    if (rate < -0.99) rate = -0.5;
    if (rate > 10) rate = 1;
  }
  return Math.round(rate * 10000) / 100;
}


// RegisterOverlay removed — all users see content directly

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function consumeAnalysisCredit(analysisId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/analisis/use-credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error || "Error al usar crédito" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Error de conexión" };
  }
}

// PaywallOverlay removed — all users see content directly

// BottomPaywallCTA removed — all users see content directly

// Ronda 4a.1: SectionCard, ZoneComparisonCards → src/components/analysis/.


export function PremiumResults({
  results, accessLevel = "free", analysisId, inputData, comuna,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  score, freeYieldBruto, freeFlujo, freePrecioM2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumenEjecutivo: _resumenEjecutivo,
  ufValue,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zoneData,
  aiAnalysisInitial,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nombre = "", ciudad = "", createdAt = "", superficie = 0, precioUF = 0,
  hidePanel = false,
  demoAiData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  creatorName,
  isSharedView = false,
  isSharedLink = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userCredits = 0,
  welcomeAvailable = true,
  ownerFirstName = "",
  analysesCount = 0,
  isLoggedIn = false,
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
  zoneData?: MarketDataRow[] | null;
  aiAnalysisInitial?: unknown;
  nombre?: string;
  ciudad?: string;
  createdAt?: string;
  superficie?: number;
  precioUF?: number;
  hidePanel?: boolean;
  demoAiData?: import("@/lib/types").AIAnalysisV2;
  creatorName?: string;
  isSharedView?: boolean;
  isSharedLink?: boolean;
  userCredits?: number;
  welcomeAvailable?: boolean;
  ownerFirstName?: string;
  analysesCount?: number;
  isLoggedIn?: boolean;
}) {
  const posthog = usePostHog();
  const currentAccess = accessLevel;
  const [horizonYears, setHorizonYears] = useState(10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sensHorizon, setSensHorizon] = useState(10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [plusvaliaRate, setPlusvaliaRate] = useState(4.0);
  // P5 Fase 24 — Sliders huérfanos eliminados (Opción A). Estos valores
  // afectan dynamicProjections pero el user nunca pudo modificarlos. Si se
  // expone en el futuro, rehacer limpio en SliderSimulacion bajo "Avanzado".
  const arriendoGrowth = 3.5;
  const costGrowth = 3.0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [refiPct, setRefiPct] = useState(80);


  // Adjustable parameters panel
  const [adjPrecio, setAdjPrecio] = useState(inputData?.precio ?? 0);
  const [adjPiePct, setAdjPiePct] = useState(inputData?.piePct ?? 20);
  const [adjPlazo, setAdjPlazo] = useState(inputData?.plazoCredito ?? 25);
  const [adjTasa, setAdjTasa] = useState(inputData?.tasaInteres ?? 4.72);
  const [adjArriendo, setAdjArriendo] = useState(inputData?.arriendo ?? 0);
  const [adjGastos, setAdjGastos] = useState(inputData?.gastos ?? 0);
  const [adjContribuciones, setAdjContribuciones] = useState(inputData?.contribuciones ?? 0);
  const [adjVacanciaPct, setAdjVacanciaPct] = useState(() => Math.round((inputData?.vacanciaMeses ?? 1) * 100 / 12));
  const [adjAdminPct, setAdjAdminPct] = useState(() => inputData?.usaAdministrador ? (inputData?.comisionAdministrador ?? 7) : 0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [fabState, setFabState] = useState<'inputs' | 'hidden' | 'projections'>('inputs');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isTouchDevice, setIsTouchDevice] = useState(false);

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

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setIsTouchDevice(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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

  const handleRecalculate = useCallback(async () => {
    if (!analysisId || !inputData) return;
    setRecalcLoading(true);
    setRecalcSuccess(false);
    try {
      const updatedInput: AnalisisInput = {
        ...inputData,
        precio: adjPrecio,
        piePct: adjPiePct,
        plazoCredito: adjPlazo,
        tasaInteres: adjTasa,
        arriendo: adjArriendo,
        gastos: adjGastos,
        contribuciones: adjContribuciones,
        vacanciaMeses: adjVacanciaPct * 12 / 100,
        usaAdministrador: adjAdminPct > 0,
        comisionAdministrador: adjAdminPct > 0 ? adjAdminPct : undefined,
      };
      const res = await fetch("/api/analisis/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, inputData: updatedInput }),
      });
      const resData = await res.json().catch(() => null);
      if (res.ok) {
        setRecalcSuccess(true);
        posthog?.capture('recalculate_used', { analysis_id: analysisId, comuna });
        setTimeout(() => window.location.reload(), 500);
      } else {
        alert(resData?.error || "Error al recalcular");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRecalcLoading(false);
    }
  }, [analysisId, inputData, adjPrecio, adjPiePct, adjPlazo, adjTasa, adjArriendo, adjGastos, adjContribuciones, adjVacanciaPct, adjAdminPct]);

  // AI Analysis state — new v2 structure. Polls /ai-status while the fire-and-forget
  // generation from /api/analisis completes; falls back to POST /api/analisis/ai after timeout.
  const [aiAnalysis, setAiAnalysis] = useState<import("@/lib/types").AIAnalysisV2 | null>(
    hasAiV2(aiAnalysisInitial) ? aiAnalysisInitial : null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateAiManually = useCallback(async () => {
    if (!analysisId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
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

  // Poll /ai-status for the background-generated analysis. If it doesn't show up
  // in 60s, fall back to a manual POST to /api/analisis/ai.
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
    if (hasAiV2(aiAnalysis)) return;

    let cancelled = false;
    setAiLoading(true);
    setAiError(null);

    const startTime = Date.now();
    const POLL_INTERVAL = 5000;
    const MAX_WAIT_BEFORE_MANUAL = 60000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/analisis/${analysisId}/ai-status`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.ready && hasAiV2(data.ai_analysis)) {
          setAiAnalysis(data.ai_analysis);
          setAiLoading(false);
          return;
        }
        if (Date.now() - startTime > MAX_WAIT_BEFORE_MANUAL) {
          // Timeout: trigger manual generation via POST /api/analisis/ai
          const aiRes = await fetch("/api/analisis/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysisId }),
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
        timer = setTimeout(poll, POLL_INTERVAL);
      } catch {
        if (cancelled) return;
        setAiError("Error cargando análisis");
        setAiLoading(false);
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
    });
  }, [results, m, inputData, plusvaliaRate, ufValue]);

  // Dynamic refinance scenario based on horizon + refiPct
  // dynamicRefi removed — refi section now calculates directly from projData


  // ─── Sensitivity scenarios with projections ───
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sensScenarios = useMemo(() => {
    if (!results || !m || !inputData) return null;

    const precioCLP = inputData.precio * ufValue;
    const pieCLP = precioCLP * (inputData.piePct / 100);
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const nMeses = inputData.plazoCredito * 12;

    const configs = [
      { key: "pesimista", label: "Pesimista", sub: "Mercado difícil", icon: "↓", plusvalia: 2, arriendoGr: 1.5, gastosGr: 5, tasaDelta: 1.5, arriendoPct: -15, vacanciaDelta: 1, color: "var(--signal-red)", borderClass: "border-[var(--franco-sc-bad-border)]", bgClass: "bg-[var(--franco-sc-bad-bg)]", labelClass: "text-signal-red" },
      { key: "base", label: "Base", sub: "Escenario actual", icon: "→", plusvalia: plusvaliaRate, arriendoGr: arriendoGrowth, gastosGr: costGrowth, tasaDelta: 0, arriendoPct: 0, vacanciaDelta: 0, color: "var(--franco-text)", borderClass: "border-[var(--franco-border)]", bgClass: "bg-[var(--franco-card)]", labelClass: "text-[var(--franco-text)]" },
      { key: "optimista", label: "Optimista", sub: "Viento a favor", icon: "↑", plusvalia: 6, arriendoGr: 5, gastosGr: 2, tasaDelta: -1, arriendoPct: 10, vacanciaDelta: -Math.min(0.5, inputData.vacanciaMeses), color: "var(--franco-text)", borderClass: "border-[var(--franco-sc-good-border)]", bgClass: "bg-[var(--franco-sc-good-bg)]", labelClass: "text-[var(--franco-positive)]" },
    ];

    return configs.map(cfg => {
      const h = Math.min(sensHorizon, 20);

      // Scenario-adjusted inputs
      const scenTasa = inputData.tasaInteres + cfg.tasaDelta;
      const scenArriendo = Math.round(inputData.arriendo * (1 + cfg.arriendoPct / 100));
      const scenVacancia = inputData.vacanciaMeses + cfg.vacanciaDelta;

      // Recalculate dividendo with scenario tasa
      const scenTasaMes = scenTasa / 100 / 12;
      const scenDividendo = creditoCLP <= 0 ? 0 : scenTasaMes === 0 ? Math.round(creditoCLP / nMeses) : Math.round((creditoCLP * scenTasaMes) / (1 - Math.pow(1 + scenTasaMes, -nMeses)));

      // Saldo crédito with scenario tasa
      const calcSaldoScen = (mPagados: number) => {
        if (mPagados >= nMeses) return 0;
        if (scenTasaMes === 0) return creditoCLP * (1 - mPagados / nMeses);
        const cuota = (creditoCLP * scenTasaMes) / (1 - Math.pow(1 + scenTasaMes, -nMeses));
        return creditoCLP * Math.pow(1 + scenTasaMes, mPagados) - cuota * ((Math.pow(1 + scenTasaMes, mPagados) - 1) / scenTasaMes);
      };

      let arriendoAct = scenArriendo;
      let gastosAct = m.gastos;
      let contribAct = m.contribuciones;
      let flujoAcumH = 0;
      let flujoMes1 = 0;

      for (let anio = 1; anio <= h; anio++) {
        // Mantención sigue la fórmula del motor (precio × rate(antig+año) / 12).
        // Antes la rama `inputData.provisionMantencion ||` usaba el snapshot
        // mutado año-1 como CONSTANTE, divergente del motor año a año.
        const mantBase = Math.round((precioCLP * getMantencionRate(inputData.antiguedad + anio)) / 12);
        const mant = Math.round(mantBase * Math.pow(1 + cfg.gastosGr / 100, anio - 1));
        const fl = calcFlujoDesglose({
          arriendo: arriendoAct,
          dividendo: scenDividendo,
          ggcc: gastosAct,
          contribuciones: contribAct,
          mantencion: mant,
          vacanciaMeses: scenVacancia,
          usaAdministrador: inputData.usaAdministrador,
          comisionAdministrador: inputData.comisionAdministrador,
        });
        if (anio === 1) flujoMes1 = fl.flujoNeto;
        flujoAcumH += fl.flujoNeto * 12;
        arriendoAct *= (1 + cfg.arriendoGr / 100);
        gastosAct *= (1 + cfg.gastosGr / 100);
        contribAct *= (1 + cfg.gastosGr / 100);
      }

      const valorVenta = precioCLP * Math.pow(1 + cfg.plusvalia / 100, h);
      const saldoH = Math.max(0, calcSaldoScen(Math.min(h * 12, nMeses)));
      const comision = valorVenta * 0.02;
      const ganancia = valorVenta - saldoH - comision;
      const utilidadNeta = ganancia + flujoAcumH - pieCLP;
      const retorno = pieCLP > 0 ? (pieCLP + utilidadNeta) / pieCLP : 0;

      return {
        ...cfg, flujoMensual: flujoMes1, bolsilloTotal: Math.round(flujoAcumH),
        valorVenta: Math.round(valorVenta), saldoCredito: Math.round(saldoH),
        comisionVenta: Math.round(comision), gananciaBruta: Math.round(ganancia),
        pieCLP: Math.round(pieCLP), utilidadNeta: Math.round(utilidadNeta),
        retorno: Math.round(retorno * 10) / 10,
        scenTasa, scenArriendo, scenVacancia: Math.round(scenVacancia * 100 / 12),
      };
    });
  }, [results, m, inputData, sensHorizon, plusvaliaRate, arriendoGrowth, costGrowth]);

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

    function getMantencionForMonth(mes: number): number {
      // Fórmula canónica del motor (precio × rate(antig+año) / 12). Antes la
      // rama `inputData.provisionMantencion ||` mantenía el valor año-1 como
      // CONSTANTE, divergente del motor.
      const anioProyeccion = Math.ceil(mes / 12);
      const antiguedadActual = inputData!.antiguedad + anioProyeccion;
      const mantencionBase = Math.round((m!.precioCLP * getMantencionRate(antiguedadActual)) / 12);
      return Math.round(mantencionBase * Math.pow(1 + costGrowthDec, anioProyeccion - 1));
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

  interface PatrimonioRow {
    name: string;
    _x: number; // month number (0=T0, 12=Año 1, etc.)
    piePagado: number;
    capitalAmortizado: number;
    plusvalia: number;
    flujoAcumulado: number; // accumulated cash flow (negative = out of pocket)
    saldoCredito: number | null;
    patrimonioNeto: number;
    valorPropiedad: number;
    valorPropArea?: number | null; // null pre-entrega (futura), valorPropiedad post-entrega
    isEntrega?: boolean;
    isPreEntrega?: boolean;
  }

  // Label helper for annual patrimonio X axis
  function annualPatrimonioLabel(month: number, preEntrega: number): string {
    if (month === 0) return "T0";
    // Hide the transition point label (month before delivery) to keep axis clean
    if (preEntrega > 1 && month === preEntrega - 1) return "";
    if (preEntrega > 0 && month === preEntrega && month % 12 !== 0) return "Entrega";
    if (month % 12 === 0) return `Año ${month / 12}`;
    return `M${month}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const projData = useMemo((): PatrimonioRow[] => {
    if (!results || !m || !inputData) return [];
    const precioCLP = inputData.precio * ufValue;
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;
    const cuotasPie = inputData.cuotasPie > 0 ? inputData.cuotasPie : mesesPreEntrega;
    const montoCuotaPie = inputData.montoCuota > 0 ? inputData.montoCuota : (cuotasPie > 0 ? Math.round(m.pieCLP / cuotasPie) : 0);
    const plusvaliaDec = plusvaliaRate / 100;
    const plusvaliaMensual = Math.pow(1 + plusvaliaDec, 1 / 12) - 1;

    // Fix #1: usar valor de mercado Franco como base de plusvalía
    const valorMercadoFrancoCLP = m.valorMercadoFrancoUF ? m.valorMercadoFrancoUF * ufValue : null;
    const valorBase = valorMercadoFrancoCLP || precioCLP;

    // Fix #2: gastos de cierre (~2% del precio de compra)
    const gastosCierre = precioCLP * 0.02;

    // Flujo acumulado: compute month-by-month with growing arriendo/costs (same logic as cashflowData)
    const costGrowthDec = costGrowth / 100;
    const flujoAcumByMonth: number[] = [0]; // index 0 = T0
    {
      let arriendoAct = inputData.arriendo;
      let gastosAct = m.gastos;
      let contribucionesAct = m.contribuciones;
      let acum = 0;
      const esPreEntregaFlow = mesesPreEntrega > 0 && inputData.estadoVenta !== "inmediata";
      for (let mo = 1; mo <= horizonYears * 12; mo++) {
        if (esPreEntregaFlow) {
          if (mo > mesesPreEntrega + 1 && (mo - 1) % 12 === 0) {
            arriendoAct *= (1 + arriendoGrowth / 100);
            gastosAct *= (1 + costGrowthDec);
            contribucionesAct *= (1 + costGrowthDec);
          }
        } else {
          if (mo > 1 && (mo - 1) % 12 === 0) {
            arriendoAct *= (1 + arriendoGrowth / 100);
            gastosAct *= (1 + costGrowthDec);
            contribucionesAct *= (1 + costGrowthDec);
          }
        }
        if (esPreEntregaFlow && mo <= mesesPreEntrega) {
          flujoAcumByMonth.push(0);
        } else {
          const anioProyeccion = Math.ceil(mo / 12);
          const antiguedadActual = inputData.antiguedad + anioProyeccion;
          // Fórmula canónica del motor; antes `inputData.provisionMantencion ||`
          // mantenía el snapshot año-1 como constante (fork residual Sesión A).
          const mantencionBase = Math.round((precioCLP * getMantencionRate(antiguedadActual)) / 12);
          const mantencion = Math.round(mantencionBase * Math.pow(1 + costGrowthDec, anioProyeccion - 1));
          const fd = calcFlujoDesglose({
            arriendo: arriendoAct,
            dividendo: m.dividendo,
            ggcc: gastosAct,
            contribuciones: contribucionesAct,
            mantencion,
            vacanciaMeses: inputData.vacanciaMeses ?? 1,
            usaAdministrador: inputData.usaAdministrador,
            comisionAdministrador: inputData.comisionAdministrador,
          });
          acum += fd.flujoNeto;
          flujoAcumByMonth.push(acum);
        }
      }
    }

    const calcSaldo = (mesActual: number) => {
      if (creditoCLP <= 0) return 0;
      const tasaMensual = inputData.tasaInteres / 100 / 12;
      const n = inputData.plazoCredito * 12;
      if (tasaMensual === 0) return creditoCLP * (1 - mesActual / n);
      const div = (creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
      return Math.max(0, creditoCLP * Math.pow(1 + tasaMensual, mesActual) - div * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual));
    };

    // Always calculate month by month
    const totalMonths = horizonYears * 12;
    const allData: PatrimonioRow[] = [];

    if (mesesPreEntrega > 0 && inputData.estadoVenta !== "inmediata") {
      allData.push({ name: "T0", _x: 0, piePagado: 0, capitalAmortizado: 0, plusvalia: 0, flujoAcumulado: 0, saldoCredito: null, patrimonioNeto: 0, valorPropiedad: 0, isPreEntrega: true });

      for (let mo = 1; mo <= totalMonths; mo++) {
        const valorProp = valorBase * Math.pow(1 + plusvaliaMensual, mo);
        const plusvaliaAcum = valorProp - precioCLP;

        if (mo < mesesPreEntrega) {
          // Pre-entrega: sin deuda ni valor propiedad, sin flujo operativo, sin gastos cierre
          // El mes justo antes de entrega usa 0 (no null) para que la línea suba DESDE cero
          const piePagado = Math.min(montoCuotaPie * mo, m.pieCLP);
          const esAntesDentrega = mo === mesesPreEntrega - 1;
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: Math.round(piePagado),
            capitalAmortizado: 0,
            plusvalia: Math.round(plusvaliaAcum),
            flujoAcumulado: 0,
            saldoCredito: esAntesDentrega ? 0 : null,
            patrimonioNeto: Math.round(piePagado + plusvaliaAcum),
            valorPropiedad: 0,
            isPreEntrega: true,
          });
        } else if (mo === mesesPreEntrega) {
          // Mes de entrega: deuda y valor propiedad aparecen, gastos cierre se pagan
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: m.pieCLP,
            capitalAmortizado: 0,
            plusvalia: Math.round(plusvaliaAcum),
            flujoAcumulado: 0,
            saldoCredito: Math.round(creditoCLP),
            patrimonioNeto: Math.round(valorProp - creditoCLP - gastosCierre + 0 - m.pieCLP),
            valorPropiedad: Math.round(valorProp),
            isEntrega: true,
          });
        } else {
          const flujoAcum = (flujoAcumByMonth[mo] ?? 0);
          const mesesCredito = mo - mesesPreEntrega;
          const saldo = calcSaldo(mesesCredito);
          const capitalAmort = creditoCLP - saldo;
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: m.pieCLP,
            capitalAmortizado: Math.round(Math.max(0, capitalAmort)),
            plusvalia: Math.round(plusvaliaAcum),
            flujoAcumulado: Math.round(flujoAcum),
            saldoCredito: Math.round(saldo),
            patrimonioNeto: Math.round(valorProp - saldo - gastosCierre + flujoAcum - m.pieCLP),
            valorPropiedad: Math.round(valorProp),
          });
        }
      }
    } else {
      // Entrega inmediata: gastos cierre desde T0, flujo acumula desde mes 1
      const plusvaliaInmediata = valorBase - precioCLP;
      allData.push({ name: "T0", _x: 0, piePagado: m.pieCLP, capitalAmortizado: 0, plusvalia: Math.round(plusvaliaInmediata), flujoAcumulado: 0, saldoCredito: creditoCLP, patrimonioNeto: Math.round(valorBase - creditoCLP - gastosCierre + 0 - m.pieCLP), valorPropiedad: Math.round(valorBase) });

      for (let mo = 1; mo <= totalMonths; mo++) {
        const flujoAcum = (flujoAcumByMonth[mo] ?? 0);
        const valorProp = valorBase * Math.pow(1 + plusvaliaMensual, mo);
        const plusvaliaAcum = valorProp - precioCLP;
        const saldo = calcSaldo(mo);
        const capitalAmort = creditoCLP - saldo;
        allData.push({
          name: `M${mo}`, _x: mo,
          piePagado: m.pieCLP,
          capitalAmortizado: Math.round(Math.max(0, capitalAmort)),
          plusvalia: Math.round(plusvaliaAcum),
          flujoAcumulado: Math.round(flujoAcum),
          saldoCredito: Math.round(saldo),
          patrimonioNeto: Math.round(valorProp - saldo - gastosCierre + flujoAcum - m.pieCLP),
          valorPropiedad: Math.round(valorProp),
        });
      }
    }

    // valorPropArea: null pre-entrega (Recharts skips null), 0 for month before delivery (transition point), value post-entrega
    const mesAnteEntrega = mesesPreEntrega > 1 ? mesesPreEntrega - 1 : -1;
    for (const row of allData) {
      if (row.isPreEntrega) {
        row.valorPropArea = row._x === mesAnteEntrega ? 0 : null;
      } else {
        row.valorPropArea = row.valorPropiedad;
      }
    }

    if (isMonthlyView) return allData;

    // Annual view: sample at T0 + year boundaries + month before delivery + delivery month
    const sampleSet = new Set<number>();
    sampleSet.add(0);
    for (let y = 1; y <= horizonYears; y++) sampleSet.add(y * 12);
    if (mesesPreEntrega > 0 && mesesPreEntrega <= totalMonths) {
      if (mesesPreEntrega % 12 !== 0) sampleSet.add(mesesPreEntrega);
      // Add month before delivery as transition point (line rises from 0)
      const pre = mesesPreEntrega - 1;
      if (pre > 0 && !sampleSet.has(pre)) sampleSet.add(pre);
    }
    const sampleArr = Array.from(sampleSet).sort((a, b) => a - b);

    return allData
      .filter((row) => sampleArr.includes(row._x))
      .map((row) => ({ ...row, name: annualPatrimonioLabel(row._x, mesesPreEntrega) }));
  }, [results, m, inputData, horizonYears, plusvaliaRate, isMonthlyView, arriendoGrowth, costGrowth]);

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
          <a href="/analisis/nuevo-v2" className="font-body text-sm font-medium text-signal-red hover:underline shrink-0">
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
          {/* 1. AI Analysis — dashboard (hero + 2×2 + drawer) */}
          <SubjectCardGrid
            aiAnalysis={aiAnalysis}
            loading={aiLoading}
            error={aiError}
            currency={currency}
            onCurrencyChange={setCurrency}
            veredicto={resolvedVeredicto}
            score={score}
            propiedadTitle={propiedadTitle}
            propiedadSubtitle={propiedadSubtitle}
            metadataItems={metadataItems}
            onRetry={generateAiManually}
            results={results}
            inputData={inputData}
            valorUF={ufValue}
            analysisId={analysisId}
            comuna={comuna}
          />

          {/* ═══ CAPA 3 · SIMULACIÓN (acordeón unificado) ═══ */}
          <SimulationProvider
            plazoAnios={horizonYears}
            plusvaliaAnual={plusvaliaRate}
            setPlazoAnios={setHorizonYears}
            setPlusvaliaAnual={setPlusvaliaRate}
            plazoBase={10}
            plusvaliaBase={PLUSVALIA_HISTORICA[comuna ?? ""]?.anualizada ?? PLUSVALIA_DEFAULT.anualizada}
          >
            {m && inputData && (
              <AdvancedSection
                projections={dynamicProjections}
                metrics={m}
                inputData={inputData}
                currency={currency}
                valorUF={ufValue}
              />
            )}
          </SimulationProvider>
        </>
      )}

    </>
  );

  // Panel fields (scrollable) and button (fixed footer) — shared between desktop sidebar and mobile drawer
  const hasPanelContent = !hidePanel && !isSharedView && (currentAccess === "premium" || currentAccess === "subscriber") && !!inputData;

  // Mobile FAB: 3-state based on scroll (inputs → hidden → projections)
  useEffect(() => {
    if (!hasPanelContent) return;
    const handleScroll = () => {
      const proSection = document.getElementById("informe-pro-section");
      const projZone = document.getElementById("projections-zone-marker");
      const threshold = 80;
      if (!proSection) { setFabState('inputs'); return; }
      const proTop = proSection.getBoundingClientRect().top;
      if (proTop > threshold) {
        setFabState('inputs');
      } else if (!projZone) {
        setFabState('hidden');
      } else {
        const projTop = projZone.getBoundingClientRect().top;
        setFabState(projTop < threshold ? 'projections' : 'hidden');
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasPanelContent]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const panelFields = hasPanelContent ? (
    <div className="space-y-2">
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">Cuánto cuesta</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Precio (UF)</label>
              <input type="number" value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-20 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 text-right text-[11px] font-mono text-[var(--franco-text)]" />
            </div>
            <input type="range" min={500} max={10000} step={50} value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Pie</label>
              <span className="text-[11px] font-medium text-[var(--franco-text)]">{adjPiePct}%</span>
            </div>
            <input type="range" min={10} max={50} step={5} value={adjPiePct} onChange={(e) => setAdjPiePct(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">Financiamiento</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Plazo</label>
              <span className="text-[11px] font-medium text-[var(--franco-text)]">{adjPlazo} años</span>
            </div>
            <input type="range" min={10} max={30} step={1} value={adjPlazo} onChange={(e) => setAdjPlazo(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Tasa (%)</label>
              <input type="number" step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-16 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 text-right text-[11px] font-mono text-[var(--franco-text)]" />
            </div>
            <input type="range" min={1} max={8} step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">Cuánto genera</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Arriendo</label>
              <input type="number" value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-24 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 text-right text-[11px] font-mono text-[var(--franco-text)]" />
            </div>
            <input type="range" min={100000} max={2000000} step={10000} value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">GGCC</label>
              <input type="number" value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-24 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 text-right text-[11px] font-mono text-[var(--franco-text)]" />
            </div>
            <input type="range" min={0} max={300000} step={5000} value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Contrib. /trim</label>
              <input type="number" value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-24 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 text-right text-[11px] font-mono text-[var(--franco-text)]" />
            </div>
            <input type="range" min={0} max={500000} step={10000} value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Vacancia</label>
              <span className="text-[11px] font-medium text-[var(--franco-text)]">{adjVacanciaPct}%</span>
            </div>
            <input type="range" min={0} max={25} step={1} value={adjVacanciaPct} onChange={(e) => setAdjVacanciaPct(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
            <p className="text-[10px] text-[var(--franco-text-secondary)] leading-tight">{`≈ ${(adjVacanciaPct * 12 / 100).toFixed(1)} meses/año`}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[var(--franco-text)]">Gestión del arriendo</label>
              <span className="text-[11px] font-medium text-[var(--franco-text)]">{adjAdminPct}%</span>
            </div>
            <input type="range" min={0} max={15} step={1} value={adjAdminPct} onChange={(e) => setAdjAdminPct(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
            <p className="text-[10px] text-[var(--franco-text-secondary)] leading-tight">{adjAdminPct > 0 ? `${fmtCLP(Math.round(adjArriendo * adjAdminPct / 100))}/mes` : "Sin administrador"}</p>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const panelButton = hasPanelContent ? (
    <div>
      <Button onClick={handleRecalculate} disabled={recalcLoading} size="sm" className="w-full gap-2 bg-signal-red text-white hover:bg-signal-red/90">
        {recalcLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {recalcLoading ? "Recalculando..." : "Recalcular"}
      </Button>
      {recalcSuccess && <p className="mt-1 text-center text-xs text-[var(--franco-positive)]">Actualizado</p>}
    </div>
  ) : null;

  // P5 Fase 24 — projectionFields dead code eliminado. Sliders huérfanos
  // (Horizonte, Plusvalía, Crecimiento arriendo/gastos) nunca se renderizaron.
  // Si se requiere exponer simulación avanzada, hacerlo en SliderSimulacion.

  // Paneles laterales eliminados (Fase 3). Capa 1+2 usan siempre valores del
  // análisis original; la simulación editable vive en el acordeón Capa 3.
  return (
    <>
      <div className="min-w-0">
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

        {/* WalletStatusCTA in-line al cierre — refleja estado del wallet
            del user logueado. Excluye admin/sharedView/welcomeDisponible. */}
        <div className="mt-8">
          <WalletStatusCTA
            welcomeAvailable={welcomeAvailable}
            credits={userCredits}
            isSubscriber={accessLevel === "subscriber"}
            isAdmin={false /* admin → accessLevel="subscriber" en este componente */}
            isSharedView={isSharedView}
            source="ltr"
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
    </>
  );
}

