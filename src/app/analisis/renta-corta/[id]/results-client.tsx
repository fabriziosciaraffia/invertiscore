"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  Lock, CheckCircle2, AlertTriangle, XCircle, Sparkles, Loader2,
  Building2, Zap, Droplets, Wifi, Package, Wrench, Receipt,
  Wallet, Scale, Settings, TrendingUp, Shield,
} from "lucide-react";
import type { ShortTermResult, EscenarioSTR, FlujoEstacionalMes, SensibilidadRow } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";

// ─── AI Analysis types (STR) ───────────────────────
interface AIAnalysisSTR {
  resumenEjecutivo_clp: string;
  resumenEjecutivo_uf: string;
  tuBolsillo: { titulo: string; contenido_clp: string; contenido_uf: string; alerta_clp: string; alerta_uf: string };
  vsAlternativas: { titulo: string; contenido_clp: string; contenido_uf: string };
  operacion: { titulo: string; contenido_clp: string; contenido_uf: string };
  proyeccion: { titulo: string; contenido_clp: string; contenido_uf: string };
  riesgos: { titulo: string; items_clp: string[]; items_uf: string[] };
  veredicto: { titulo: string; decision: "VIABLE" | "AJUSTA ESTRATEGIA" | "NO RECOMENDADO"; explicacion_clp: string; explicacion_uf: string };
  aFavor: string[];
  puntosAtencion: string[];
  textoSimple_clp: string;
  textoSimple_uf: string;
  textoImportante_clp: string;
  textoImportante_uf: string;
}

function aiText(obj: Record<string, unknown>, field: string, currency: "CLP" | "UF"): string {
  const key = field + (currency === "UF" ? "_uf" : "_clp");
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

function stripBullet(text: string): string {
  return text.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").trim();
}

function TypewriterText({ text, onComplete, speed = 40 }: { text: string; onComplete?: () => void; speed?: number }) {
  const [wordIndex, setWordIndex] = useState(0);
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  useEffect(() => {
    if (wordIndex >= words.length) { onComplete?.(); return; }
    const t = setTimeout(() => setWordIndex(i => i + 1), speed);
    return () => clearTimeout(t);
  }, [wordIndex, words.length, speed, onComplete]);
  return (
    <span>
      {words.slice(0, wordIndex).join("")}
      {wordIndex < words.length && <span className="animate-pulse text-[#C8323C]">|</span>}
    </span>
  );
}

function DelayedCallback({ delay, onComplete }: { delay: number; onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, delay);
    return () => clearTimeout(t);
  }, [delay, onComplete]);
  return null;
}

// ─── Module-level UF ───────────────────────────────
let UF_CLP = 38800;

// ─── Formatting helpers ────────────────────────────
function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtUF(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) {
    return "UF " + Math.round(rounded).toLocaleString("es-CL");
  }
  const [int, dec] = rounded.toFixed(1).split(".");
  return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
}

function fmtMoney(n: number, currency: "CLP" | "UF"): string {
  if (currency === "UF") return fmtUF(n / UF_CLP);
  return fmtCLP(n);
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000).toLocaleString("es-CL") + "K";
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtMoneyCompact(n: number, currency: "CLP" | "UF"): string {
  if (currency === "UF") return fmtUF(n / UF_CLP);
  return fmtM(n);
}

function fmtPct(n: number, decimals: number = 1): string {
  return (n * 100).toFixed(decimals).replace(".", ",") + "%";
}

function fmtPctRaw(n: number, decimals: number = 1): string {
  return n.toFixed(decimals).replace(".", ",") + "%";
}

function fmtAxisMoney(n: number, currency: "CLP" | "UF"): string {
  if (currency === "UF") {
    const uf = n / UF_CLP;
    if (Math.abs(uf) >= 1_000) return "UF " + (uf / 1_000).toFixed(0) + "K";
    if (Math.abs(uf) >= 100) return "UF " + Math.round(uf);
    if (Math.abs(uf) >= 1) return "UF " + uf.toFixed(1).replace(".", ",");
    return "UF " + uf.toFixed(2).replace(".", ",");
  }
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000).toLocaleString("es-CL") + "K";
  return "$" + Math.round(n).toLocaleString("es-CL");
}

// ─── Verdict mapping (STR → LTR color semantics) ────
// VIABLE          → positive (verde/gris azulado)
// AJUSTA ESTRAT.  → warning (amber)
// NO RECOMENDADO  → rojo Signal Red
type VerdictSTR = "VIABLE" | "AJUSTA ESTRATEGIA" | "NO RECOMENDADO";

const VERDICT_CONFIG: Record<VerdictSTR, {
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  icon: React.ElementType;
  label: string;
  shortLabel: string;
}> = {
  VIABLE: {
    color: "var(--franco-positive, #B0BEC5)",
    bg: "var(--franco-sc-good-bg, rgba(176,190,197,0.08))",
    border: "var(--franco-sc-good-border, rgba(176,190,197,0.4))",
    badgeBg: "rgba(176,190,197,0.15)",
    icon: CheckCircle2,
    label: "VIABLE",
    shortLabel: "VIABLE",
  },
  "AJUSTA ESTRATEGIA": {
    color: "var(--franco-warning, #FBBF24)",
    bg: "var(--franco-v-adjust-bg, rgba(251,191,36,0.08))",
    border: "rgba(251,191,36,0.3)",
    badgeBg: "rgba(251,191,36,0.15)",
    icon: AlertTriangle,
    label: "AJUSTA ESTRATEGIA",
    shortLabel: "AJUSTA",
  },
  "NO RECOMENDADO": {
    color: "#C8323C",
    bg: "var(--franco-sc-bad-bg, rgba(200,50,60,0.06))",
    border: "rgba(200,50,60,0.3)",
    badgeBg: "rgba(200,50,60,0.15)",
    icon: XCircle,
    label: "NO RECOMENDADO",
    shortLabel: "NO RECOM.",
  },
};

// ─── FadeIn animation wrapper ──────────────────────
function FadeIn({ show, delay = 0, children }: { show: boolean; delay?: number; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [show, delay]);
  if (!visible) return null;
  return <div className="animate-fadeIn">{children}</div>;
}

// ─── CollapsibleSection ─────────────────────────────
function CollapsibleSection({ title, subtitle, helpText, defaultOpen = false, locked = false, guestLocked = false, analysisId, children }: {
  title: string;
  subtitle?: string;
  helpText?: string;
  defaultOpen?: boolean;
  locked?: boolean;
  guestLocked?: boolean;
  analysisId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || guestLocked);

  function handleUnlock() {
    if (!analysisId) return;
    window.location.href = `/checkout?product=pro&analysisId=${analysisId}`;
  }

  return (
    <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => !locked && !guestLocked && setOpen(!open)}
        className="w-full flex justify-between items-center p-4 px-5 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-body text-[15px] font-semibold text-[var(--franco-text)]">{title}</span>
            {locked && <span className="font-mono text-[8px] font-bold text-[#C8323C] bg-[#C8323C]/10 px-1.5 py-0.5 rounded">PRO</span>}
          </div>
          {subtitle && <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        {locked || guestLocked ? (
          <Lock className="h-4 w-4 text-[var(--franco-text-secondary)] shrink-0" />
        ) : (
          <span className={`font-body text-lg text-[var(--franco-text-secondary)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}>↓</span>
        )}
      </button>

      {guestLocked && (
        <div className="px-5 pb-5 relative">
          <div className="filter blur-[6px] opacity-40 pointer-events-none h-[110px] overflow-hidden">
            {children}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lock className="h-5 w-5 text-[var(--franco-text)] mb-2" />
            <p className="font-body text-sm font-medium text-[var(--franco-text)] mb-1">Regístrate gratis para ver esta sección</p>
            <a href="/register">
              <button type="button" className="bg-[#C8323C] text-white font-body text-xs font-semibold px-5 py-2 rounded-lg mt-1">
                Crear cuenta gratis →
              </button>
            </a>
          </div>
        </div>
      )}

      {open && !locked && !guestLocked && (
        <div className="px-5 pb-5">
          {helpText && (
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-snug p-2.5 px-3.5 bg-[var(--franco-card)] rounded-lg mb-3.5">{helpText}</p>
          )}
          {children}
        </div>
      )}

      {locked && (
        <div className="px-5 pb-5 text-center">
          <div className="filter blur-[4px] opacity-30 pointer-events-none h-[60px] overflow-hidden">
            {children}
          </div>
          <button
            type="button"
            onClick={handleUnlock}
            className="bg-[#C8323C] text-white font-body text-xs font-bold px-5 py-2 rounded-md mt-2 shadow-[0_2px_10px_rgba(200,50,60,0.15)]"
          >
            Desbloquear — $4.990
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CurrencyToggle ─────────────────────────────────
function CurrencyToggle({ currency, onToggle }: { currency: "CLP" | "UF"; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border border-[var(--franco-border)] bg-[var(--franco-card)] rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-8 w-20 items-center rounded-full bg-[var(--franco-border)] p-1 transition-colors"
        >
          <div
            className={`absolute h-6 w-9 rounded-full bg-[var(--franco-text)] transition-transform ${
              currency === "UF" ? "translate-x-[40px]" : "translate-x-0"
            }`}
          />
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "CLP" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>
            CLP
          </span>
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "UF" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>
            UF
          </span>
        </button>
        {currency === "CLP" && (
          <span className="text-xs text-[var(--franco-text-secondary)]">Valores en CLP calculados con UF = ${UF_CLP.toLocaleString("es-CL")}</span>
        )}
      </div>
    </div>
  );
}

// ─── ViewLevel ──────────────────────────────────────
type ViewLevel = "simple" | "importante" | "sinfiltro";

// ─── Score + gradient bar (mirror LTR ScoreBarInline) ─
function ScoreBarInlineSTR({ score, veredicto }: { score: number; veredicto: VerdictSTR }) {
  const cfg = VERDICT_CONFIG[veredicto];
  return (
    <div className="w-full min-w-[220px]">
      <p className="font-mono text-[9px] text-[var(--franco-text-secondary)] uppercase tracking-[3px] mb-1">FRANCO SCORE STR</p>
      <p className="font-mono text-[52px] font-bold text-[var(--franco-text)] leading-none">{score}</p>
      {/* Gradient bar + indicator dot */}
      <div className="relative mt-3 h-2 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full opacity-20"
          style={{ background: "var(--franco-score-gradient, linear-gradient(90deg, #C8323C 0%, #FBBF24 50%, #B0BEC5 100%))" }}
        />
        <div
          className="absolute rounded-full border-2 border-[var(--franco-bg)]"
          style={{ width: 14, height: 14, top: -3, left: `calc(${Math.max(0, Math.min(100, score))}% - 7px)`, backgroundColor: cfg.color, transition: "left 0.7s" }}
        />
      </div>
      {/* Zone labels */}
      <div className="flex mt-2">
        <span className="font-mono text-[8px] text-[var(--franco-text-muted)] w-[40%] text-left tracking-wide">NO RECOM.</span>
        <span className="font-mono text-[8px] text-[var(--franco-text-muted)] w-[30%] text-center tracking-wide">AJUSTA</span>
        <span className="font-mono text-[8px] text-[var(--franco-text-muted)] w-[30%] text-right tracking-wide">VIABLE</span>
      </div>
      {/* Verdict badge */}
      <div className="mt-3">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[2px] px-4 py-1 rounded-md inline-block"
          style={{ color: cfg.color, backgroundColor: cfg.badgeBg, border: `0.5px solid ${cfg.badgeBg}` }}
        >
          {cfg.label}
        </span>
      </div>
      <p className="text-[11px] text-[var(--franco-text-muted)] mt-3 max-w-[260px] leading-relaxed font-body">
        Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
      </p>
    </div>
  );
}

// ─── Escenario verdict (sobre-renta vs LTR) ────────
function escenarioVerdict(esc: EscenarioSTR, ltrNoiMensual: number): VerdictSTR {
  const sobreRenta = esc.noiMensual - ltrNoiMensual;
  const sobreRentaPct = ltrNoiMensual !== 0 ? sobreRenta / ltrNoiMensual : 0;
  if (sobreRentaPct >= 0.10) return "VIABLE";
  if (sobreRentaPct >= 0 && esc.noiMensual > 0) return "AJUSTA ESTRATEGIA";
  return "NO RECOMENDADO";
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

interface STRResultsProps {
  analysisId: string;
  results: ShortTermResult;
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

export function STRResultsClient({
  analysisId, results, inputData, accessLevel, ufValue,
  nombre, comuna, ciudad, superficie, createdAt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId, isSharedView, userCredits, welcomeAvailable = true, aiAnalysisInitial,
}: STRResultsProps) {
  if (ufValue) UF_CLP = ufValue;

  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("importante");
  const toggleCurrency = useCallback(() => setCurrency(c => c === "CLP" ? "UF" : "CLP"), []);

  // AI Analysis state
  const initialAi: AIAnalysisSTR | null =
    aiAnalysisInitial && typeof aiAnalysisInitial === "object" && "veredicto" in (aiAnalysisInitial as Record<string, unknown>)
      ? (aiAnalysisInitial as AIAnalysisSTR)
      : null;
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisSTR | null>(initialAi);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiInitiallyLoaded = !!initialAi;

  const loadAiAnalysis = useCallback(async () => {
    if (aiLoading || !analysisId) return;
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
        throw new Error(data.error || "Error al generar análisis");
      }
      const data = await res.json();
      setAiAnalysis(data);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setAiLoading(false);
    }
  }, [analysisId, aiLoading]);

  const isGuest = accessLevel === "guest";
  const isFree = accessLevel === "free";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isPremium = accessLevel === "premium" || accessLevel === "subscriber";
  const showSection = (levels: ViewLevel[]) => levels.includes(viewLevel);

  // Shorthand
  const r = results;
  const base = r.escenarios.base;
  const comp = r.comparativa;
  const inp = inputData as Record<string, unknown> | null;

  const precioCompra = (inp?.precioCompra as number) ?? 0;
  const dormitorios = (inp?.dormitorios as number) ?? 0;
  const banos = (inp?.banos as number) ?? 0;
  const modoGestion = (inp?.modoGestion as string) ?? "auto";
  const costoAmoblamiento = (inp?.costoAmoblamiento as number) ?? 0;

  // Franco Score STR (may not exist in older analyses)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const francoScore: FrancoScoreSTR | undefined = (results as any)?.francoScore;
  const score = francoScore?.score ?? 50;
  const effectiveVeredicto: VerdictSTR = (francoScore?.veredicto as VerdictSTR) ?? r.veredicto;
  const verdictCfg = VERDICT_CONFIG[effectiveVeredicto];

  // Dimension bars from francoScore (or fallback)
  const dimensions = useMemo(() => {
    if (!francoScore) return [];
    return [
      { label: francoScore.desglose.rentabilidad.label, value: francoScore.desglose.rentabilidad.score, detail: francoScore.desglose.rentabilidad.detail },
      { label: francoScore.desglose.sostenibilidad.label, value: francoScore.desglose.sostenibilidad.score, detail: francoScore.desglose.sostenibilidad.detail },
      { label: francoScore.desglose.ventaja.label, value: francoScore.desglose.ventaja.score, detail: francoScore.desglose.ventaja.detail },
      { label: francoScore.desglose.factibilidad.label, value: francoScore.desglose.factibilidad.score, detail: francoScore.desglose.factibilidad.detail },
    ];
  }, [francoScore]);

  const fechaAnalisis = createdAt ? new Date(createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";

  // "Siendo franco" copy — basado en flujo real y sobre-renta
  const siendoFrancoText = useMemo(() => {
    const flujo = base.flujoCajaMensual;
    const sobreRentaPct = comp.sobreRentaPct; // fracción (0.20 = 20%)
    const paybackTxt = comp.paybackMeses > 0 && comp.paybackMeses < 999
      ? ` El amoblamiento se recupera en ${comp.paybackMeses} meses.`
      : costoAmoblamiento > 0 && comp.paybackMeses < 0
      ? ` Con estos números, la inversión en amoblamiento no se recupera.`
      : "";

    let texto: string;
    if (effectiveVeredicto === "VIABLE") {
      if (flujo >= 0) {
        texto = `Este depto se paga solo en Airbnb. Genera ${fmtMoney(flujo, currency)}/mes de flujo positivo y ${fmtPctRaw(sobreRentaPct * 100, 0)} más que arriendo largo.`;
      } else {
        texto = `Airbnb genera ${fmtPctRaw(sobreRentaPct * 100, 0)} más que arriendo largo, pero el flujo sigue negativo (${fmtMoney(flujo, currency)}/mes). Negocia mejor precio o aumenta el pie.`;
      }
    } else if (effectiveVeredicto === "AJUSTA ESTRATEGIA") {
      if (sobreRentaPct > 0) {
        texto = `Airbnb genera ${fmtPctRaw(sobreRentaPct * 100, 0)} más que arriendo largo, pero el margen es ajustado. Considera negociar el precio de compra o mejorar la gestión para subir la ocupación.`;
      } else {
        texto = `La renta corta y el arriendo largo generan similar para esta propiedad. El esfuerzo extra de Airbnb no se justifica claramente.`;
      }
    } else {
      texto = `El arriendo tradicional es más rentable para esta propiedad. Los costos operativos de la renta corta (electricidad, insumos, limpieza, comisiones) se comen el ingreso adicional.`;
    }
    return texto + paybackTxt;
  }, [effectiveVeredicto, costoAmoblamiento, comp, currency, base.flujoCajaMensual]);

  // KPIs (4 cards)
  const kpis = useMemo(() => [
    { label: "NOI mensual", value: fmtMoneyCompact(base.noiMensual, currency), positive: base.noiMensual >= 0 },
    { label: "CAP Rate", value: fmtPct(base.capRate), positive: base.capRate >= 0.04 },
    { label: "Cash-on-Cash", value: fmtPct(base.cashOnCash), positive: base.cashOnCash >= 0 },
    { label: "vs LTR", value: (comp.sobreRenta >= 0 ? "+" : "") + fmtMoneyCompact(comp.sobreRenta, currency), positive: comp.sobreRenta >= 0 },
  ], [base, comp, currency]);

  // Comparativa table data
  const comparativaRows = useMemo(() => {
    const gastosComunes = (inp?.gastosComunes as number) ?? 0;
    const ltrIngresoBruto = comp.ltr.ingresoBruto ?? 0;
    const strIngresoBruto = base.ingresoBrutoMensual ?? 0;
    const ltrComision = Math.round(ltrIngresoBruto * 0.05);
    const strComision = base.comisionMensual ?? 0;
    const strCostosOp = (base.costosOperativos ?? 0) - gastosComunes;
    const ltrNoi = comp.ltr.noiMensual ?? 0;
    const strNoi = base.noiMensual ?? 0;
    const dividendo = r.dividendoMensual ?? 0;
    const ltrFlujo = comp.ltr.flujoCaja ?? 0;
    const strFlujo = base.flujoCajaMensual ?? 0;

    return [
      { label: "Ingreso bruto", ltr: ltrIngresoBruto, str: strIngresoBruto, tooltip: "Ingreso mensual antes de cualquier descuento." },
      { label: "(-) Comisión", ltr: -ltrComision, str: -strComision, tooltip: "Comisión de corredor (LTR 5%) o plataforma/administrador (STR)." },
      { label: "(-) Costos operativos", ltr: 0, str: -strCostosOp, tooltip: "Electricidad, agua, WiFi, insumos, mantención. En LTR los paga el arrendatario." },
      { label: "(-) Gastos comunes", ltr: -gastosComunes, str: -gastosComunes, tooltip: "Gastos comunes del edificio. Iguales en ambos modelos." },
      { label: "= NOI", ltr: ltrNoi, str: strNoi, isTotal: true, tooltip: "Net Operating Income: lo que queda después de costos operativos, antes del dividendo." },
      { label: "(-) Dividendo", ltr: -dividendo, str: -dividendo, tooltip: "Cuota mensual del crédito hipotecario." },
      { label: "= Flujo de caja", ltr: ltrFlujo, str: strFlujo, isResult: true, tooltip: "Lo que entra (o sale) de tu bolsillo cada mes." },
    ];
  }, [comp, base, r.dividendoMensual, inp]);

  const seasonalData = useMemo(() => r.flujoEstacional.map((m: FlujoEstacionalMes) => ({
    mes: m.mes.substring(0, 3),
    flujo: m.flujo,
  })), [r.flujoEstacional]);

  const sensData = r.sensibilidad;
  const breakEvenPct = r.breakEvenPctDelMercado;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* ─── Navbar ─────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <a href="/" className="font-heading text-lg font-bold text-[var(--franco-text)]">
            <span className="opacity-30 font-normal">re</span>franco<span className="font-body font-semibold text-[#C8323C]">.ai</span>
          </a>
          <div className="flex items-center gap-2">
            {isGuest ? (
              <a href="/register">
                <Button size="sm" className="bg-[#C8323C] text-white hover:bg-[#C8323C]/90 font-body text-xs">
                  Registrarme gratis
                </Button>
              </a>
            ) : (
              <a href={isSharedView ? "/analisis/nuevo-v2" : "/dashboard"}>
                <Button variant="ghost" size="sm" className="font-body text-xs text-[var(--franco-text-secondary)]">
                  ← {isSharedView ? "Analizar mi depto" : "Dashboard"}
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-4xl px-4 py-8">

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 1 — RESUMEN EJECUTIVO (hero card)   */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-[var(--franco-card)] rounded-2xl p-7 md:p-8 mb-5 border border-[var(--franco-border)]">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">

            {/* Left: Score bar */}
            <div className="relative">
              <div className={isGuest ? "filter blur-[8px] pointer-events-none" : ""}>
                <ScoreBarInlineSTR score={score} veredicto={effectiveVeredicto} />
              </div>
              {isGuest && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Lock className="h-4 w-4 text-[var(--franco-text)] mb-1.5" />
                  <p className="font-body text-[11px] font-medium text-[var(--franco-text)] text-center leading-tight">Regístrate gratis<br />para ver tu Score</p>
                  <a href="/register" className="mt-2">
                    <span className="font-body text-[10px] font-semibold text-[#C8323C] hover:underline">Crear cuenta →</span>
                  </a>
                </div>
              )}
            </div>

            {/* Right: Property + toggle + KPIs + Siendo franco */}
            <div>
              <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-1">
                Este es el análisis de renta corta de tu departamento en {comuna || ciudad || "tu zona"}
              </p>

              <h1 className="font-heading font-bold text-xl md:text-2xl text-[var(--franco-text)]">{nombre}</h1>
              <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-1">
                {ciudad && <>{ciudad} · </>}{superficie}m² · {dormitorios}D/{banos}B · {fmtMoney(precioCompra, currency)} · {modoGestion === "administrador" ? "Con administrador" : "Gestión propia"}
              </p>
              {fechaAnalisis && (
                <p className="font-body text-[10px] text-[var(--franco-text-muted)] mt-0.5">Analizado el {fechaAnalisis}</p>
              )}

              {/* Currency toggle */}
              <div className="mt-3">
                <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
              </div>

              {/* 4 KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {kpis.map((k) => (
                  <div key={k.label} className="bg-[var(--franco-card)] rounded-[10px] p-2.5 border border-[var(--franco-border)] text-center overflow-hidden">
                    <p className="font-body text-[8px] sm:text-[9px] text-[var(--franco-text-secondary)] uppercase tracking-wide truncate">{k.label}</p>
                    <p className={`font-mono text-sm sm:text-base font-semibold mt-1 truncate ${k.positive ? "text-[var(--franco-text)]" : "text-[#C8323C]"}`}>
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Siendo franco */}
              <div
                className={`mt-3.5 ${isGuest ? "filter blur-[6px] pointer-events-none" : ""}`}
                style={{
                  borderLeft: `3px solid ${verdictCfg.color}`,
                  background: verdictCfg.bg,
                  borderRadius: "0 8px 8px 0",
                  padding: "12px 16px",
                }}
              >
                <p className="font-body text-[13px] font-semibold" style={{ color: verdictCfg.color }}>Siendo franco:</p>
                <p className="font-body text-[12px] mt-1 text-[var(--franco-text-secondary)]">{siendoFrancoText}</p>
              </div>
            </div>
          </div>

          {/* Dimension bars below the grid */}
          {dimensions.length > 0 && (
            <div className={`flex flex-col gap-2.5 mt-4 pt-4 border-t border-[var(--franco-border)] ${isGuest ? "filter blur-[6px] pointer-events-none" : ""}`}>
              {dimensions.map((d) => {
                const val = Math.round(d.value);
                const dimColor = val >= 70 ? "var(--franco-positive, #B0BEC5)" : val >= 40 ? "var(--franco-warning, #FBBF24)" : "#C8323C";
                const numClass = val >= 70 ? "text-[var(--franco-positive,#B0BEC5)]" : val >= 40 ? "text-[var(--franco-warning,#FBBF24)]" : "text-[#C8323C]";
                return (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="font-body text-[11px] text-[var(--franco-text-secondary)] w-[105px] shrink-0 flex items-center gap-1">
                      {d.label}
                      <InfoTooltip content={d.detail} />
                    </span>
                    <div className="relative flex-1 h-1.5 rounded-full overflow-hidden bg-[var(--franco-border)]">
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${val}%`, backgroundColor: dimColor }} />
                    </div>
                    <span className={`font-mono text-[11px] font-medium w-[28px] text-right shrink-0 ${numClass}`}>{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {francoScore?.overrideApplied && !isGuest && (
            <div className="mt-4 pt-3 border-t border-[var(--franco-border)]">
              <p className="font-body text-[11px] text-[var(--franco-text-secondary)]">
                <span className="font-semibold text-[var(--franco-text)]">Nota:</span> {francoScore.overrideApplied}
              </p>
            </div>
          )}
        </div>

        {/* Guest CTA */}
        {isGuest && (
          <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] p-6 mb-6 text-center">
            <p className="font-body text-sm font-medium text-[var(--franco-text)] mb-2">
              Regístrate gratis para ver el análisis completo
            </p>
            <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-4">
              Comparativa detallada, escenarios, estacionalidad y más.
            </p>
            <a href="/register">
              <Button className="bg-[#C8323C] text-white hover:bg-[#C8323C]/90 font-body text-sm font-semibold px-6">
                Crear cuenta gratis →
              </Button>
            </a>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* STICKY VIEW LEVEL TOGGLE                   */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && (
          <div className="sticky top-[60px] z-40 bg-[var(--franco-bg)]/95 backdrop-blur-sm py-3 mb-4">
            <p className="text-center text-xs sm:text-sm text-[var(--franco-text-muted)] mb-2 sm:mb-3 font-body">
              Elige cómo quieres ver el análisis. Mismos datos, diferente profundidad.
            </p>
            <div className="flex gap-1 bg-[var(--franco-card)] rounded-xl p-1 sm:p-1.5 border border-[var(--franco-border)]">
              {([
                { v: "simple", label: "En Simple", sub: "La versión rápida" },
                { v: "importante", label: "Lo Importante", sub: "Los números clave" },
                { v: "sinfiltro", label: "Sin Filtro", sub: "Todo el detalle" },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setViewLevel(opt.v)}
                  className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    viewLevel === opt.v
                      ? "bg-[#C8323C] text-white"
                      : "text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-card)]"
                  }`}
                >
                  {opt.label}
                  <span className="hidden sm:block text-[10px] font-normal opacity-70 mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 2 — STR vs LTR                       */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && (
          <FadeIn show delay={0}>
            <CollapsibleSection
              title="STR vs Arriendo Largo"
              subtitle="Comparativa mensual lado a lado"
              helpText="Compara los ingresos y costos de operar en Airbnb versus arrendar a largo plazo. Todos los valores son mensuales."
              defaultOpen
              analysisId={analysisId}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--franco-border)]">
                      <th className="text-left font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 pr-4"></th>
                      <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 px-3 w-[110px]">Renta Larga</th>
                      <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 px-3 w-[110px]">Renta Corta</th>
                      <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 pl-3 w-[100px]">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativaRows.map((row, i) => {
                      const delta = row.str - row.ltr;
                      const deltaColor = delta > 0 ? "text-[var(--franco-positive,#B0BEC5)]" : delta < 0 ? "text-[#C8323C]" : "text-[var(--franco-text-secondary)]";
                      const rowBg = row.isResult ? "bg-[var(--franco-elevated,var(--franco-card))]" : row.isTotal ? "bg-[var(--franco-card)]" : "";
                      const fontWeight = (row.isTotal || row.isResult) ? "font-semibold" : "font-normal";
                      return (
                        <tr key={i} className={`border-b border-[var(--franco-border)] ${rowBg}`}>
                          <td className="py-2.5 pr-4">
                            <span className={`font-body text-[13px] ${fontWeight} text-[var(--franco-text)] flex items-center gap-1`}>
                              {row.label}
                              {row.tooltip && <InfoTooltip content={row.tooltip} />}
                            </span>
                          </td>
                          <td className={`text-right font-mono text-[13px] ${fontWeight} text-[var(--franco-text)] py-2.5 px-3`}>
                            {isFree && !row.isResult && !row.isTotal ? "—" : fmtMoney(row.ltr, currency)}
                          </td>
                          <td className={`text-right font-mono text-[13px] ${fontWeight} text-[var(--franco-text)] py-2.5 px-3`}>
                            {isFree && !row.isResult && !row.isTotal ? "—" : fmtMoney(row.str, currency)}
                          </td>
                          <td className={`text-right font-mono text-[13px] ${fontWeight} ${deltaColor} py-2.5 pl-3`}>
                            {isFree && !row.isResult ? "—" : (delta > 0 ? "+" : "") + fmtMoney(delta, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {costoAmoblamiento > 0 && comp.paybackMeses > 0 && (
                <div className="mt-4 bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-xs text-[var(--franco-text-secondary)]">Payback amoblamiento</span>
                    <span className="font-mono text-sm font-medium text-[var(--franco-text)]">{comp.paybackMeses} meses</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--franco-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((12 / comp.paybackMeses) * 100, 100)}%`,
                        backgroundColor: comp.paybackMeses <= 12 ? "var(--franco-positive, #B0BEC5)" : comp.paybackMeses <= 24 ? "var(--franco-warning, #FBBF24)" : "#C8323C",
                      }}
                    />
                  </div>
                  <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1.5">
                    Inversión de {fmtMoney(costoAmoblamiento, currency)} recuperada con la sobre-renta mensual de {fmtMoney(comp.sobreRenta, currency)}
                  </p>
                </div>
              )}
              {costoAmoblamiento > 0 && comp.paybackMeses < 0 && (
                <div className="mt-4 bg-[rgba(200,50,60,0.06)] rounded-lg border border-[rgba(200,50,60,0.15)] p-4">
                  <p className="font-body text-xs text-[#C8323C] font-medium">
                    La sobre-renta es negativa. La inversión en amoblamiento ({fmtMoney(costoAmoblamiento, currency)}) no se recupera con renta corta.
                  </p>
                </div>
              )}
            </CollapsibleSection>
          </FadeIn>
        )}

        {/* Free-tier paywall CTA */}
        {isFree && (
          <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] p-6 mb-3 text-center">
            <p className="font-body text-sm font-medium text-[var(--franco-text)] mb-1.5">Desbloquea el análisis completo</p>
            <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-4">
              Escenarios por percentil, estacionalidad mensual, P&L detallado y datos de mercado.
            </p>
            <button
              type="button"
              onClick={() => window.location.href = `/checkout?product=pro&analysisId=${analysisId}`}
              className="bg-[#C8323C] text-white font-body text-sm font-bold px-6 py-2.5 rounded-lg shadow-[0_2px_10px_rgba(200,50,60,0.15)]"
            >
              Desbloquear — $4.990
            </button>
            {userCredits > 0 && (
              <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-2">
                Tienes {userCredits} crédito{userCredits > 1 ? "s" : ""} disponible{userCredits > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 3 — ESCENARIOS                       */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["importante", "sinfiltro"]) && (
          <CollapsibleSection
            title="Escenarios por percentil"
            subtitle="Conservador (P25), Base (P50), Agresivo (P75)"
            helpText="Cada escenario usa datos reales de propiedades comparables. P25 = solo superas al 25% del mercado, P50 = rendimiento típico, P75 = estás entre los mejores."
            defaultOpen
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["conservador", "base", "agresivo"] as const).map(key => {
                const esc = r.escenarios[key];
                const v = escenarioVerdict(esc, comp.ltr.noiMensual);
                const vCfg = VERDICT_CONFIG[v];
                const isBase = key === "base";

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 ${isBase ? "border-2" : ""}`}
                    style={{
                      borderColor: isBase ? verdictCfg.border : "var(--franco-border)",
                      backgroundColor: isBase ? verdictCfg.bg : "var(--franco-card)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-body text-xs font-semibold text-[var(--franco-text)] uppercase tracking-wider">
                        {esc.label}
                      </span>
                      <span
                        className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ color: vCfg.color, backgroundColor: vCfg.badgeBg, border: `1px solid ${vCfg.badgeBg}` }}
                      >
                        {vCfg.shortLabel}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-body text-xs text-[var(--franco-text-secondary)]">Revenue anual</span>
                        <span className="font-mono text-xs font-medium text-[var(--franco-text)]">{fmtMoney(esc.revenueAnual, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-xs text-[var(--franco-text-secondary)]">NOI mensual</span>
                        <span className={`font-mono text-xs font-medium ${esc.noiMensual >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]"}`}>
                          {fmtMoney(esc.noiMensual, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-xs text-[var(--franco-text-secondary)]">Flujo de caja</span>
                        <span className={`font-mono text-xs font-medium ${esc.flujoCajaMensual >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]"}`}>
                          {fmtMoney(esc.flujoCajaMensual, currency)}
                        </span>
                      </div>

                      <div className="border-t border-[var(--franco-border)] pt-2 mt-2 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">ADR</span>
                          <span className="font-mono text-[11px] text-[var(--franco-text)]">{fmtMoney(esc.adrReferencia, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">Ocupación</span>
                          <span className="font-mono text-[11px] text-[var(--franco-text)]">{fmtPctRaw(esc.ocupacionReferencia * 100, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">CAP Rate</span>
                          <span className="font-mono text-[11px] text-[var(--franco-text)]">{fmtPct(esc.capRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">Cash-on-Cash</span>
                          <span className="font-mono text-[11px] text-[var(--franco-text)]">{fmtPct(esc.cashOnCash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 4 — SENSIBILIDAD                     */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["importante", "sinfiltro"]) && (
          <CollapsibleSection
            title="Sensibilidad"
            subtitle="Cómo cambian los números según el revenue"
            helpText="Cada fila muestra qué pasa con tu rentabilidad a distintos niveles de ingreso. La fila P50 es el escenario base."
            defaultOpen={false}
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--franco-border)]">
                    <th className="text-left font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 pr-3">Percentil</th>
                    <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 px-2">Revenue anual</th>
                    <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 px-2">NOI mensual</th>
                    <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 px-2">Sobre-renta</th>
                    <th className="text-right font-body text-xs font-medium text-[var(--franco-text-secondary)] py-2 pl-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sensData.map((row: SensibilidadRow, i: number) => {
                    const isBase = row.label === "P50";
                    const srColor = row.sobreRenta >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]";
                    return (
                      <tr key={i} className={`border-b border-[var(--franco-border)] ${isBase ? "bg-[var(--franco-elevated,var(--franco-card))]" : ""}`}>
                        <td className={`py-2 pr-3 font-body text-[13px] ${isBase ? "font-semibold" : ""} text-[var(--franco-text)]`}>
                          {row.label}
                          {isBase && <span className="ml-1 text-[10px] text-[var(--franco-text-secondary)]">(base)</span>}
                        </td>
                        <td className="text-right font-mono text-[13px] text-[var(--franco-text)] py-2 px-2">{fmtMoney(row.revenueAnual, currency)}</td>
                        <td className={`text-right font-mono text-[13px] ${row.noiMensual >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]"} py-2 px-2`}>
                          {fmtMoney(row.noiMensual, currency)}
                        </td>
                        <td className={`text-right font-mono text-[13px] ${srColor} py-2 px-2`}>
                          {(row.sobreRenta >= 0 ? "+" : "") + fmtMoney(row.sobreRenta, currency)}
                        </td>
                        <td className={`text-right font-mono text-[13px] ${srColor} py-2 pl-2`}>
                          {(row.sobreRentaPct >= 0 ? "+" : "") + fmtPct(row.sobreRentaPct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(() => {
              const crossover = sensData.find((row: SensibilidadRow) => row.sobreRenta < 0);
              if (!crossover) return null;
              return (
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-3">
                  En el escenario <span className="font-mono font-medium">{crossover.label}</span>, la renta corta deja de convenir frente al arriendo largo.
                </p>
              );
            })()}
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 5 — ESTACIONALIDAD                   */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["importante", "sinfiltro"]) && (
          <CollapsibleSection
            title="Estacionalidad"
            subtitle="Flujo mensual estimado por mes del año"
            helpText="Los ingresos en renta corta varían según la temporada. Verano y vacaciones de invierno suelen ser peak. Los meses más bajos pueden generar flujo negativo."
            defaultOpen={false}
            locked={isFree}
            analysisId={analysisId}
          >
            <div style={{ minHeight: 300, width: "100%" }} className="mb-4">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={seasonalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: "var(--franco-text-secondary)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--franco-border)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--franco-text-secondary)" }}
                    tickFormatter={(v: number) => fmtAxisMoney(v, currency)}
                    tickLine={false}
                    axisLine={false}
                    width={65}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--franco-card)",
                      border: "1px solid var(--franco-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [fmtMoney(Number(value), currency), "Flujo de caja"]}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="var(--franco-text-secondary)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Bar dataKey="flujo" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {seasonalData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.flujo >= 0 ? "var(--franco-positive, #B0BEC5)" : "#C8323C"}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {r.perdidaRampUp > 0 && (
              <div className="bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                <p className="font-body text-xs font-medium text-[var(--franco-text)] mb-1">Período de ramp-up</p>
                <p className="font-body text-[11px] text-[var(--franco-text-secondary)] leading-relaxed">
                  Los primeros 3 meses el ingreso es menor mientras la propiedad gana tracción (70% → 80% → 90% del revenue esperado).
                  Pérdida estimada: <span className="font-mono font-medium text-[var(--franco-text)]">{fmtMoney(r.perdidaRampUp, currency)}</span>
                </p>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 6 — P&L DETALLADO (Sin Filtro)       */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["sinfiltro"]) && (
          <CollapsibleSection
            title="P&L detallado"
            subtitle="Desglose de costos operativos mensuales"
            helpText="Todos los costos mensuales que implica operar en renta corta. En arriendo largo, la mayoría los paga el arrendatario."
            defaultOpen={false}
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="space-y-0">
              {[
                { label: "Comisión plataforma/admin", value: base.comisionMensual, icon: Receipt, tooltip: modoGestion === "administrador" ? "Comisión del administrador sobre el ingreso bruto." : "Comisión de Airbnb (3%) sobre el ingreso bruto." },
                { label: "Electricidad", value: (inp?.costoElectricidad as number) ?? 0, icon: Zap },
                { label: "Agua", value: (inp?.costoAgua as number) ?? 0, icon: Droplets },
                { label: "WiFi", value: (inp?.costoWifi as number) ?? 0, icon: Wifi },
                { label: "Insumos", value: (inp?.costoInsumos as number) ?? 0, icon: Package, tooltip: "Artículos de limpieza, amenities, sábanas, etc." },
                { label: "Gastos comunes", value: (inp?.gastosComunes as number) ?? 0, icon: Building2 },
                { label: "Mantención", value: (inp?.mantencion as number) ?? 0, icon: Wrench },
                { label: "Contribuciones (mensual)", value: Math.round(((inp?.contribuciones as number) ?? 0) / 4), icon: Receipt, tooltip: "Contribuciones trimestrales divididas en 3 meses." },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-[var(--franco-border)]">
                  <span className="font-body text-[13px] text-[var(--franco-text)] flex items-center gap-2">
                    <item.icon className="h-3.5 w-3.5 text-[var(--franco-text-secondary)]" />
                    {item.label}
                    {item.tooltip && <InfoTooltip content={item.tooltip} />}
                  </span>
                  <span className="font-mono text-[13px] text-[var(--franco-text)]">{fmtMoney(item.value, currency)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Total costos operativos</span>
                <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">
                  {fmtMoney(base.comisionMensual + base.costosOperativos, currency)}
                </span>
              </div>
            </div>

            <div className="mt-4 bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
              <p className="font-body text-xs font-medium text-[var(--franco-text)] mb-2">Break-even</p>
              <p className="font-body text-[12px] text-[var(--franco-text-secondary)] leading-relaxed">
                Necesitas generar <span className="font-mono font-medium text-[var(--franco-text)]">{fmtMoney(r.breakEvenRevenueAnual / 12, currency)}/mes</span> (<span className="font-mono">{fmtMoney(r.breakEvenRevenueAnual, currency)}/año</span>) para cubrir todos los costos.
                Eso es el <span className="font-mono font-medium text-[var(--franco-text)]">{fmtPctRaw(breakEvenPct * 100, 0)}</span> del revenue promedio del mercado (P50).
              </p>
              <div className="mt-3 relative">
                <div className="w-full h-3 bg-[var(--franco-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(breakEvenPct * 100, 100)}%`,
                      backgroundColor: breakEvenPct <= 0.7 ? "var(--franco-positive, #B0BEC5)" : breakEvenPct <= 0.9 ? "var(--franco-warning, #FBBF24)" : "#C8323C",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono text-[10px] text-[var(--franco-text-secondary)]">0%</span>
                  <span className="font-mono text-[10px] text-[var(--franco-text-secondary)]">P50 (100%)</span>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 7 — DATOS DE MERCADO (Sin Filtro)    */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["sinfiltro"]) && (
          <CollapsibleSection
            title="Datos de mercado"
            subtitle="Percentiles de propiedades comparables"
            helpText="Datos de propiedades similares operando en renta corta en tu zona. Fuente: datos públicos de plataformas de alojamiento."
            defaultOpen={false}
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ADR */}
              <div className="bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-3 flex items-center gap-1">
                  Tarifa diaria (ADR)
                  <InfoTooltip content="Average Daily Rate: precio promedio por noche cobrado por propiedades comparables." />
                </p>
                <div className="space-y-2">
                  {(["conservador", "base", "agresivo"] as const).map(key => {
                    const val = r.escenarios[key].adrReferencia;
                    const pLabel = key === "conservador" ? "P25" : key === "base" ? "P50" : "P75";
                    const isBase = key === "base";
                    return (
                      <div key={key} className={`flex justify-between items-center ${isBase ? "font-semibold" : ""}`}>
                        <span className="font-body text-xs text-[var(--franco-text-secondary)] uppercase">{pLabel}</span>
                        <span className={`font-mono text-xs ${isBase ? "font-semibold" : ""} text-[var(--franco-text)]`}>
                          {fmtMoney(val, currency)}/noche
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ocupación */}
              <div className="bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-3 flex items-center gap-1">
                  Ocupación
                  <InfoTooltip content="Porcentaje de noches ocupadas al año por propiedades comparables." />
                </p>
                <div className="space-y-2">
                  {(["conservador", "base", "agresivo"] as const).map(key => {
                    const val = r.escenarios[key].ocupacionReferencia;
                    const pLabel = key === "conservador" ? "P25" : key === "base" ? "P50" : "P75";
                    const isBase = key === "base";
                    return (
                      <div key={key} className={`flex justify-between items-center ${isBase ? "font-semibold" : ""}`}>
                        <span className="font-body text-xs text-[var(--franco-text-secondary)] uppercase">{pLabel}</span>
                        <span className={`font-mono text-xs ${isBase ? "font-semibold" : ""} text-[var(--franco-text)]`}>
                          {fmtPctRaw(val * 100, 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue anual */}
              <div className="bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-3 flex items-center gap-1">
                  Revenue anual
                  <InfoTooltip content="Ingreso bruto anual estimado para propiedades comparables." />
                </p>
                <div className="space-y-2">
                  {(["conservador", "base", "agresivo"] as const).map(key => {
                    const esc = r.escenarios[key];
                    const pLabel = key === "conservador" ? "P25" : key === "base" ? "P50" : "P75";
                    const isBase = key === "base";
                    return (
                      <div key={key} className={`flex justify-between items-center ${isBase ? "font-semibold" : ""}`}>
                        <span className="font-body text-xs text-[var(--franco-text-secondary)] uppercase">{pLabel}</span>
                        <span className={`font-mono text-xs ${isBase ? "font-semibold" : ""} text-[var(--franco-text)]`}>
                          {fmtMoney(esc.revenueAnual, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* ─── Financiamiento (Sin Filtro) ──────── */}
        {!isGuest && showSection(["sinfiltro"]) && (
          <CollapsibleSection
            title="Financiamiento"
            subtitle="Estructura del crédito hipotecario"
            defaultOpen={false}
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-0.5">Pie</p>
                <p className="font-mono text-sm font-medium text-[var(--franco-text)]">{fmtMoney(r.pie, currency)}</p>
              </div>
              <div>
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-0.5">Crédito</p>
                <p className="font-mono text-sm font-medium text-[var(--franco-text)]">{fmtMoney(r.montoCredito, currency)}</p>
              </div>
              <div>
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-0.5">Dividendo</p>
                <p className="font-mono text-sm font-medium text-[var(--franco-text)]">{fmtMoney(r.dividendoMensual, currency)}/mes</p>
              </div>
              <div>
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mb-0.5">Capital invertido</p>
                <p className="font-mono text-sm font-medium text-[var(--franco-text)]">{fmtMoney(r.capitalInvertido, currency)}</p>
                <p className="font-body text-[10px] text-[var(--franco-text-secondary)]">Pie + amoblamiento + cierre</p>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE — ANÁLISIS IA                        */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && (
          <AIAnalysisSTRSection
            analysisId={analysisId}
            accessLevel={accessLevel}
            aiAnalysis={aiAnalysis}
            aiLoading={aiLoading}
            aiError={aiError}
            loadAiAnalysis={loadAiAnalysis}
            aiInitiallyLoaded={aiInitiallyLoaded}
            currency={currency}
            viewLevel={viewLevel}
            veredicto={effectiveVeredicto}
            userCredits={userCredits}
          />
        )}

        {/* ─── WalletStatusCTA in-line al cierre ────── */}
        <div className="mt-8">
          <WalletStatusCTA
            welcomeAvailable={welcomeAvailable}
            credits={userCredits}
            isSubscriber={accessLevel === "subscriber"}
            isAdmin={false /* admin → accessLevel="subscriber" en este componente */}
            isSharedView={isSharedView}
            source="str"
          />
        </div>

        {/* ─── Bottom CTA (navegación secundaria) ───── */}
        <div className="mt-8 text-center pb-12">
          <a href="/analisis/nuevo-v2">
            <Button
              variant="outline"
              className="font-body text-sm border-[var(--franco-border)] text-[var(--franco-text)] hover:bg-[var(--franco-card)]"
            >
              ← Analizar otra propiedad
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// AI ANALYSIS STR SECTION
// ═══════════════════════════════════════════════════

function AIAnalysisSTRSection({
  analysisId, accessLevel, aiAnalysis, aiLoading, aiError, loadAiAnalysis,
  aiInitiallyLoaded, currency, viewLevel, veredicto, userCredits,
}: {
  analysisId: string;
  accessLevel: "guest" | "free" | "premium" | "subscriber";
  aiAnalysis: AIAnalysisSTR | null;
  aiLoading: boolean;
  aiError: string | null;
  loadAiAnalysis: () => void;
  aiInitiallyLoaded: boolean;
  currency: "CLP" | "UF";
  viewLevel: ViewLevel;
  veredicto: VerdictSTR;
  userCredits: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const [phaseIndex, setPhaseIndex] = useState<number>(() => (aiInitiallyLoaded ? 9 : -1));

  useEffect(() => {
    if (!aiAnalysis || hasAnimated.current || phaseIndex >= 9) return;
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        setPhaseIndex(0);
        setTimeout(() => setPhaseIndex(1), 600);
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [aiAnalysis, phaseIndex]);

  const showAll = phaseIndex >= 9;
  const next = (to: number) => () => setTimeout(() => setPhaseIndex(to), 250);

  const isFree = accessLevel === "free";
  const cfg = VERDICT_CONFIG[veredicto];

  // Premium gate
  if (isFree) {
    return (
      <div ref={sectionRef} className="mb-8">
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] overflow-hidden mt-5">
          <div className="h-[3px] bg-[#C8323C]" />
          <div className="px-6 md:px-8 pt-6 pb-5" style={{ backgroundImage: "linear-gradient(135deg, rgba(200,50,60,0.20) 0%, rgba(200,50,60,0.11) 30%, rgba(200,50,60,0.04) 60%, transparent 90%)" }}>
            <div className="font-mono text-xs text-[#C8323C] uppercase tracking-widest font-semibold mb-1.5">INFORME PRO</div>
            <div className="font-heading font-bold text-2xl text-[var(--franco-text)]">Análisis completo con IA</div>
            <div className="font-body text-sm text-[var(--franco-text-secondary)] mt-1.5">Análisis personalizado de tu propiedad en renta corta</div>
          </div>
          <div className="border-t border-[var(--franco-border)]">
            <div className="py-11 px-6 flex flex-col items-center text-center">
              <div className="text-4xl mb-3 text-[#C8323C]/70">✦</div>
              <div className="font-body text-[15px] font-semibold text-[var(--franco-text)] mb-1">Veredicto detallado + cómo operar + riesgos</div>
              <div className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-5 max-w-xs mx-auto">Flujo real, tips de operación, estacionalidad, proyección a 10 años y puntos críticos.</div>
              <button
                type="button"
                onClick={() => window.location.href = `/checkout?product=pro&analysisId=${analysisId}`}
                className="bg-[#C8323C] text-white font-body text-sm font-bold px-6 py-2.5 rounded-lg shadow-[0_2px_10px_rgba(200,50,60,0.15)]"
              >
                Desbloquear — $4.990
              </button>
              {userCredits > 0 && (
                <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-2">
                  Tienes {userCredits} crédito{userCredits > 1 ? "s" : ""} disponible{userCredits > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showCTA = !aiAnalysis && !aiLoading && !aiError;
  const isAnalyzing = aiLoading || (phaseIndex >= 0 && phaseIndex < 9 && !!aiAnalysis);
  const isComplete = phaseIndex >= 9 || (showAll && !!aiAnalysis);

  // Simplified view text
  const simpleText = aiAnalysis ? aiText(aiAnalysis as unknown as Record<string, unknown>, viewLevel === "simple" ? "textoSimple" : "textoImportante", currency) : "";
  const useSimplifiedView = (viewLevel === "simple" || viewLevel === "importante") && !!simpleText;

  const parseImportante = (txt: string) => {
    const getSection = (marker: string, nextMarkers: string[]): string => {
      const regex = new RegExp(`^${marker}:?\\s*\\n([\\s\\S]*?)(?=^(?:${nextMarkers.join("|")}):?\\s*$|$)`, "m");
      const match = txt.match(regex);
      return match ? match[1].trim() : "";
    };
    return {
      resumen: getSection("RESUMEN", ["A FAVOR", "EN CONTRA", "RECOMENDACIÓN"]),
      aFavor: getSection("A FAVOR", ["EN CONTRA", "RECOMENDACIÓN"]),
      enContra: getSection("EN CONTRA", ["RECOMENDACIÓN"]),
      recomendacion: getSection("RECOMENDACIÓN", []),
    };
  };
  const parseBullets = (text: string) => text.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

  return (
    <div ref={sectionRef} className="mb-8">
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] overflow-hidden mt-5">
        <div className="h-[3px] bg-[#C8323C]" />
        <div className="px-6 md:px-8 pt-6 pb-5 flex justify-between items-center" style={{ backgroundImage: "linear-gradient(135deg, rgba(200,50,60,0.20) 0%, rgba(200,50,60,0.11) 30%, rgba(200,50,60,0.04) 60%, transparent 90%)" }}>
          <div>
            <div className="font-mono text-xs text-[#C8323C] uppercase tracking-widest font-semibold mb-1.5">INFORME PRO</div>
            <div className="font-heading font-bold text-2xl text-[var(--franco-text)]">Análisis completo con IA</div>
            <div className="font-body text-sm text-[var(--franco-text-secondary)] mt-1.5">Análisis personalizado de tu propiedad en renta corta</div>
          </div>
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C8323C] animate-pulse" />
              <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">Analizando...</span>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--franco-border)]">
          {showCTA && (
            <div className="py-12 px-8 flex flex-col items-center text-center">
              <div className="text-5xl mb-4 text-[#C8323C]/70">✦</div>
              <div className="font-body text-[15px] font-semibold text-[var(--franco-text)] mb-1.5">Genera el análisis completo con IA</div>
              <div className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-6 max-w-sm">Franco analiza tu propiedad en Airbnb y te dice la verdad — con datos, sin filtro.</div>
              <button
                type="button"
                onClick={loadAiAnalysis}
                className="bg-[#C8323C] text-white font-body text-[15px] font-bold px-8 py-3.5 rounded-lg shadow-[0_4px_20px_rgba(200,50,60,0.3)] flex items-center gap-2 mx-auto hover:shadow-[0_4px_24px_rgba(200,50,60,0.4)] transition-shadow"
              >
                <span className="text-base">✦</span>
                Generar análisis IA →
              </button>
            </div>
          )}

          {aiLoading && (
            <div className="py-12 px-8 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#C8323C]" />
              <p className="font-body text-sm text-[var(--franco-text-secondary)]">Analizando tu inversión con IA... (15-30 segundos)</p>
            </div>
          )}

          {aiError && (
            <div className="p-8 space-y-3">
              <div className="rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/5 p-4 text-sm text-[#C8323C]">
                Error: {aiError}
              </div>
              <button type="button" onClick={loadAiAnalysis} className="text-sm font-medium text-[var(--franco-text)] hover:underline">
                Reintentar
              </button>
            </div>
          )}

          {aiAnalysis && (
            <div className="p-6 md:p-8">
              <div className="font-body text-[15px] font-bold text-[var(--franco-text)] mb-3">Siendo franco:</div>

              {/* Loading phase */}
              {phaseIndex === 0 && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Sparkles className="h-8 w-8 animate-pulse text-[#C8323C]" />
                  <p className="font-body text-sm text-[var(--franco-text-secondary)]">Analizando tu inversión con IA...</p>
                </div>
              )}

              {/* Simplified view */}
              {useSimplifiedView && phaseIndex >= 1 && (() => {
                if (viewLevel === "importante" && /^RESUMEN:/m.test(simpleText) && /^A FAVOR:/m.test(simpleText)) {
                  const { resumen, aFavor, enContra, recomendacion } = parseImportante(simpleText);
                  return (
                    <div className="space-y-4">
                      {resumen && (
                        <div className="rounded-lg p-4" style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.color}`, borderRadius: "0 8px 8px 0" }}>
                          <p className="text-sm font-medium leading-relaxed text-[var(--franco-text-secondary)] font-body">{resumen}</p>
                        </div>
                      )}
                      {(aFavor || enContra) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {aFavor && (
                            <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
                              <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium" style={{ color: "var(--franco-positive, #B0BEC5)" }}>
                                <CheckCircle2 className="h-4 w-4" /> A favor
                              </h4>
                              <ul className="list-disc space-y-1.5 pl-4 text-sm text-[var(--franco-text-secondary)] font-body">
                                {parseBullets(aFavor).map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            </div>
                          )}
                          {enContra && (
                            <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
                              <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium" style={{ color: "var(--franco-warning, #FBBF24)" }}>
                                <AlertTriangle className="h-4 w-4" /> Atención
                              </h4>
                              <ul className="list-disc space-y-1.5 pl-4 text-sm text-[var(--franco-text-secondary)] font-body">
                                {parseBullets(enContra).map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {recomendacion && (
                        <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-[var(--franco-text)]" />
                            <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">Recomendación</h4>
                          </div>
                          <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)] font-body">{recomendacion}</p>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 shadow-sm">
                    {simpleText.split("\n\n").map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-[var(--franco-text-secondary)] font-body mb-3 last:mb-0">{p}</p>
                    ))}
                  </div>
                );
              })()}

              {/* Sin filtro — full structured view */}
              {!useSimplifiedView && (
                <div className="space-y-5">
                  {/* 1. Resumen */}
                  {phaseIndex >= 1 && (
                    <div className="rounded-lg p-4" style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.color}`, borderRadius: "0 8px 8px 0" }}>
                      <p className="text-sm font-medium leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo", currency) : phaseIndex === 1 ? (
                          <TypewriterText text={aiText(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo", currency)} onComplete={next(2)} />
                        ) : aiText(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo", currency)}
                      </p>
                    </div>
                  )}

                  {/* 2. Tu Bolsillo */}
                  {phaseIndex >= 2 && (
                    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm animate-fadeIn">
                      <div className="mb-2 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-[var(--franco-text)]" />
                        <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">{aiAnalysis.tuBolsillo.titulo}</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido", currency) : phaseIndex === 2 ? (
                          <TypewriterText text={aiText(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido", currency)} onComplete={next(3)} />
                        ) : aiText(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido", currency)}
                      </p>
                      {aiText(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta", currency) && (
                        <div className="mt-3 rounded-md border border-[#C8323C]/20 bg-[#C8323C]/5 px-3 py-2">
                          <p className="flex items-start gap-2 text-xs text-[#C8323C]">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {aiText(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta", currency)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. vs Alternativas */}
                  {phaseIndex >= 3 && (
                    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm animate-fadeIn">
                      <div className="mb-2 flex items-center gap-2">
                        <Scale className="h-4 w-4 text-[var(--franco-text)]" />
                        <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">{aiAnalysis.vsAlternativas.titulo}</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido", currency) : phaseIndex === 3 ? (
                          <TypewriterText text={aiText(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido", currency)} onComplete={next(4)} />
                        ) : aiText(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido", currency)}
                      </p>
                    </div>
                  )}

                  {/* 4. Operación */}
                  {phaseIndex >= 4 && (
                    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm animate-fadeIn">
                      <div className="mb-2 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-[var(--franco-text)]" />
                        <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">{aiAnalysis.operacion.titulo}</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis.operacion as unknown as Record<string, unknown>, "contenido", currency) : phaseIndex === 4 ? (
                          <TypewriterText text={aiText(aiAnalysis.operacion as unknown as Record<string, unknown>, "contenido", currency)} onComplete={next(5)} />
                        ) : aiText(aiAnalysis.operacion as unknown as Record<string, unknown>, "contenido", currency)}
                      </p>
                    </div>
                  )}

                  {/* 5. Proyección */}
                  {phaseIndex >= 5 && (
                    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm animate-fadeIn">
                      <div className="mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[var(--franco-text)]" />
                        <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">{aiAnalysis.proyeccion.titulo}</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido", currency) : phaseIndex === 5 ? (
                          <TypewriterText text={aiText(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido", currency)} onComplete={next(6)} />
                        ) : aiText(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido", currency)}
                      </p>
                    </div>
                  )}

                  {/* 6. Riesgos */}
                  {phaseIndex >= 6 && (
                    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm animate-fadeIn">
                      <div className="mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[var(--franco-text)]" />
                        <h4 className="font-body text-sm font-semibold text-[var(--franco-text)]">{aiAnalysis.riesgos.titulo}</h4>
                      </div>
                      <ul className="space-y-2">
                        {(currency === "UF" ? aiAnalysis.riesgos.items_uf : aiAnalysis.riesgos.items_clp).map((r, i) => (
                          <li key={i} className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                            <span className="mr-1 font-medium text-[#C8323C]">⚠</span> {stripBullet(r)}
                          </li>
                        ))}
                      </ul>
                      {phaseIndex === 6 && <DelayedCallback delay={800} onComplete={() => setPhaseIndex(7)} />}
                    </div>
                  )}

                  {/* 7. Veredicto explicación */}
                  {phaseIndex >= 7 && (
                    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 animate-fadeIn">
                      <p className="text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                        {showAll ? aiText(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion", currency) : phaseIndex === 7 ? (
                          <TypewriterText text={aiText(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion", currency)} onComplete={next(8)} />
                        ) : aiText(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion", currency)}
                      </p>
                    </div>
                  )}

                  {/* 8. A favor / Atención */}
                  {phaseIndex >= 8 && (
                    <div className="grid gap-4 sm:grid-cols-2 animate-fadeIn">
                      <div>
                        <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium" style={{ color: "var(--franco-positive, #B0BEC5)" }}>
                          <CheckCircle2 className="h-4 w-4" /> A favor
                        </h4>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--franco-text-secondary)]">
                          {aiAnalysis.aFavor.map((p, i) => <li key={i}>{stripBullet(p)}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium" style={{ color: "var(--franco-warning, #FBBF24)" }}>
                          <AlertTriangle className="h-4 w-4" /> Atención
                        </h4>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--franco-text-secondary)]">
                          {aiAnalysis.puntosAtencion.map((c, i) => <li key={i}>{stripBullet(c)}</li>)}
                        </ul>
                      </div>
                      {phaseIndex === 8 && <DelayedCallback delay={600} onComplete={() => setPhaseIndex(9)} />}
                    </div>
                  )}
                </div>
              )}

              {useSimplifiedView && phaseIndex >= 1 && phaseIndex < 9 && (
                <DelayedCallback delay={500} onComplete={() => setPhaseIndex(9)} />
              )}

              {/* Veredicto final */}
              {isComplete && aiAnalysis.veredicto && (
                <div className="mt-6 pt-6 border-t border-[var(--franco-border)] animate-fadeIn">
                  <div
                    className="relative overflow-hidden rounded-xl text-center bg-[var(--franco-card)]"
                    style={{ border: `1px solid ${cfg.badgeBg}`, padding: "40px 24px" }}
                  >
                    <div className="flex items-baseline justify-center gap-2 mb-4">
                      <span className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-muted)]">VEREDICTO</span>
                    </div>
                    <div
                      className="inline-block font-mono font-semibold text-2xl tracking-[5px] uppercase rounded-lg"
                      style={{
                        color: cfg.color,
                        background: cfg.badgeBg,
                        border: `1px solid ${cfg.badgeBg}`,
                        padding: "14px 36px",
                      }}
                    >
                      {aiAnalysis.veredicto.decision}
                    </div>
                    <p className="text-[11px] text-[var(--franco-text-muted)] text-center mt-4 max-w-md mx-auto leading-relaxed">
                      Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión. Consulta con un profesional antes de decidir.
                    </p>
                  </div>
                </div>
              )}

              {showAll && (
                <p className="mt-4 text-center text-[10px] text-[var(--franco-text-muted)]">
                  Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
