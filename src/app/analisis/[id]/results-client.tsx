"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  Lock, Sparkles, Shield, MapPin, Check,
  SlidersHorizontal, RefreshCw, Loader2, Clock,
  Wallet, Scale, Handshake, TrendingUp, AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput, AIAnalysis } from "@/lib/types";
import { calcFlujoDesglose, getMantencionRate } from "@/lib/analysis";
import { findNearestStation } from "@/lib/metro-stations";
import type { MarketDataRow } from "@/lib/market-data";
import FrancoLogo from "@/components/franco-logo";


// Module-level UF value, updated from server prop on mount
let UF_CLP = 38800;

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

// Compatibilidad con análisis guardados con nombres viejos (yieldBruto, yieldNeto)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMetrics(metrics: any): import("@/lib/types").AnalysisMetrics | null {
  if (!metrics) return null;
  return {
    ...metrics,
    rentabilidadBruta: metrics.rentabilidadBruta ?? metrics.yieldBruto ?? 0,
    rentabilidadNeta: metrics.rentabilidadNeta ?? metrics.yieldNeto ?? 0,
    capRate: metrics.capRate ?? 0,
    cashOnCash: metrics.cashOnCash ?? 0,
    precioM2: metrics.precioM2 ?? 0,
    mesesPaybackPie: metrics.mesesPaybackPie ?? 999,
    dividendo: metrics.dividendo ?? 0,
    flujoNetoMensual: metrics.flujoNetoMensual ?? 0,
    noi: metrics.noi ?? 0,
    pieCLP: metrics.pieCLP ?? 0,
    precioCLP: metrics.precioCLP ?? 0,
    ingresoMensual: metrics.ingresoMensual ?? 0,
    egresosMensuales: metrics.egresosMensuales ?? 0,
    valorMercadoFrancoUF: metrics.valorMercadoFrancoUF ?? metrics.valorMercadoUF ?? 0,
    valorMercadoUsuarioUF: metrics.valorMercadoUsuarioUF ?? metrics.valorMercadoUF ?? 0,
    plusvaliaInmediataFranco: metrics.plusvaliaInmediataFranco ?? metrics.plusvaliaInmediata ?? 0,
    plusvaliaInmediataFrancoPct: metrics.plusvaliaInmediataFrancoPct ?? metrics.plusvaliaInmediataPct ?? 0,
    plusvaliaInmediataUsuario: metrics.plusvaliaInmediataUsuario ?? metrics.plusvaliaInmediata ?? 0,
    plusvaliaInmediataUsuarioPct: metrics.plusvaliaInmediataUsuarioPct ?? metrics.plusvaliaInmediataPct ?? 0,
    precioFlujoNeutroCLP: metrics.precioFlujoNeutroCLP ?? 0,
    precioFlujoNeutroUF: metrics.precioFlujoNeutroUF ?? 0,
    precioFlujoPositivoCLP: metrics.precioFlujoPositivoCLP ?? 0,
    precioFlujoPositivoUF: metrics.precioFlujoPositivoUF ?? 0,
    descuentoParaNeutro: metrics.descuentoParaNeutro ?? 0,
  };
}

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

function fmtPct(n: number, decimals: number = 1): string {
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
  return fmtM(n);
}

// Strip leading bullet/symbol characters from AI text
// Strips everything before the first letter/number
function stripBullet(text: string): string {
  return text.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").replace(/price score/gi, "Eficiencia de compra").trim();
}


// ─── FadeIn animation components ────────────────────
function TypewriterText({ text, onComplete, speed = 40 }: { text: string; onComplete?: () => void; speed?: number }) {
  const [wordIndex, setWordIndex] = useState(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  useEffect(() => {
    if (wordIndex >= words.length) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setWordIndex(i => i + 1), speed);
    return () => clearTimeout(t);
  }, [wordIndex, words.length, speed, onComplete]);

  // Auto-scroll: keep the writing cursor centered vertically
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      if (rect.bottom > viewportCenter + 60) {
        window.scrollBy({ top: rect.bottom - viewportCenter, behavior: "smooth" });
      }
    }
  }, [wordIndex]);

  return (
    <span ref={containerRef}>
      {words.slice(0, wordIndex).join("")}
      {wordIndex < words.length && <span className="animate-pulse text-[#C8323C]">|</span>}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FadeInText({ text, onComplete, delay = 600 }: { text: string; onComplete?: () => void; delay?: number }) {
  useEffect(() => {
    if (!onComplete) return;
    const t = setTimeout(onComplete, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount
  return <span className="animate-fadeIn">{text}</span>;
}

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
    <div className="bg-[#151515] rounded-xl border border-white/[0.08] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => !locked && !guestLocked && setOpen(!open)}
        className="w-full flex justify-between items-center p-4 px-5 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-body text-[15px] font-semibold text-[#FAFAF8]">{title}</span>
            {locked && <span className="font-mono text-[8px] font-bold text-[#C8323C] bg-[#C8323C]/10 px-1.5 py-0.5 rounded">PRO</span>}
          </div>
          {subtitle && <p className="font-body text-xs text-[#FAFAF8]/50 mt-0.5">{subtitle}</p>}
        </div>
        {locked ? (
          <Lock className="h-4 w-4 text-[#FAFAF8]/50 shrink-0" />
        ) : guestLocked ? (
          <Lock className="h-4 w-4 text-[#FAFAF8]/50 shrink-0" />
        ) : (
          <span className={`font-body text-lg text-[#FAFAF8]/50 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}>↓</span>
        )}
      </button>

      {/* Guest locked: show blurred content + register overlay */}
      {guestLocked && (
        <div className="px-5 pb-5 relative">
          <div className="filter blur-[6px] opacity-40 pointer-events-none h-[110px] overflow-hidden">
            {children}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lock className="h-5 w-5 text-[#FAFAF8] mb-2" />
            <p className="font-body text-sm font-medium text-[#FAFAF8] mb-1">Regístrate gratis para ver esta sección</p>
            <a href="/register">
              <button type="button" className="bg-[#FAFAF8] text-[#0F0F0F] font-body text-xs font-semibold px-5 py-2 rounded-lg mt-1">
                Crear cuenta gratis →
              </button>
            </a>
          </div>
        </div>
      )}

      {open && !locked && !guestLocked && (
        <div className="px-5 pb-5">
          {helpText && (
            <p className="font-body text-[13px] text-[#FAFAF8]/60 leading-snug p-2.5 px-3.5 bg-[#1A1A1A] rounded-lg mb-3.5">{helpText}</p>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MetricRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.08]">
      <span className="font-body text-[13px] text-[#FAFAF8]/70 flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className={`font-mono text-sm font-medium ${color || "text-[#FAFAF8]"}`}>{value}</span>
    </div>
  );
}

function ScoreBarInline({ score, veredicto }: { score: number; veredicto?: string }) {
  // Use motor's veredicto if available (includes overrides), fallback to score-based
  const label = veredicto || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");
  const color = label === "COMPRAR" ? "#B0BEC5" : label === "BUSCAR OTRA" ? "#C8323C" : "#FBBF24";
  const badgeColor = color;
  const badgeBg = label === "COMPRAR" ? "rgba(176,190,197,0.12)" : label === "BUSCAR OTRA" ? "rgba(220,38,38,0.12)" : "rgba(251,191,36,0.12)";
  const badgeBorder = label === "COMPRAR" ? "rgba(176,190,197,0.3)" : label === "BUSCAR OTRA" ? "rgba(220,38,38,0.3)" : "rgba(251,191,36,0.3)";
  return (
    <div className="w-full min-w-[220px] max-w-[280px]">
      <p className="font-mono text-[9px] text-[#FAFAF8]/35 uppercase tracking-[3px] mb-1">FRANCO SCORE</p>
      <p className="font-mono text-[52px] font-bold text-[#FAFAF8] leading-none">{score}</p>
      {/* Bar with zones */}
      <div className="relative mt-3 h-2 rounded-full overflow-hidden flex">
        <div className="w-[40%] bg-[#C8323C]/15" />
        <div className="w-[30%] bg-white/[0.06]" />
        <div className="w-[30%] bg-[#B0BEC5]/15" />
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
        <div className="absolute rounded-full border-2 border-[#1A1A1A]" style={{ width: 14, height: 14, top: -3, left: `calc(${score}% - 7px)`, backgroundColor: color, transition: "left 0.7s" }} />
      </div>
      {/* Zone labels — aligned under each zone */}
      <div className="flex mt-2">
        <span className="font-mono text-[8px] text-[#FAFAF8]/30 w-[40%] text-left tracking-wide">BUSCAR OTRA</span>
        <span className="font-mono text-[8px] text-[#FAFAF8]/30 w-[30%] text-center tracking-wide">AJUSTA EL PRECIO</span>
        <span className="font-mono text-[8px] text-[#FAFAF8]/30 w-[30%] text-right tracking-wide">COMPRAR</span>
      </div>
      {/* Verdict badge */}
      <div className="mt-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[2px] px-4 py-1 rounded-md inline-block"
          style={{ color: badgeColor, backgroundColor: badgeBg, border: `0.5px solid ${badgeBorder}` }}>{label}</span>
      </div>
      <p className="text-[11px] text-[#71717A] text-center mt-3 max-w-[260px] leading-relaxed font-body">
        Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
      </p>
    </div>
  );
}

// ─── AI Analysis Section with typewriter ────────────
function AIAnalysisSection({
  aiAnalysis, aiLoading, aiError, loadAiAnalysis, score, ct, ci, currentAccess, analysisId,
  projectionsContent, aiAnalysisInitiallyLoaded = false, isSharedView = false,
  projectionsExpanded = false, onExpandProjections, projectionsCTALabel, projectionsCTAValue,
}: {
  aiAnalysis: AIAnalysis | null;
  aiLoading: boolean;
  aiError: string | null;
  loadAiAnalysis: () => void;
  score: number;
  ct: (obj: Record<string, unknown>, field: string) => string;
  ci: (obj: Record<string, unknown>, field: string) => string[];
  currentAccess: "guest" | "free" | "premium";
  analysisId?: string;
  projectionsContent?: React.ReactNode | ((chartPhase: number, isFirstReveal: boolean) => React.ReactNode);
  aiAnalysisInitiallyLoaded?: boolean;
  isSharedView?: boolean;
  projectionsExpanded?: boolean;
  onExpandProjections?: () => void;
  projectionsCTALabel?: string;
  projectionsCTAValue?: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const isFirstReveal = !aiAnalysisInitiallyLoaded && !isSharedView;
  // If AI analysis was pre-loaded from DB, skip animation entirely
  const [phaseIndex, setPhaseIndex] = useState(() => {
    if (aiAnalysisInitiallyLoaded) return 9; // show all immediately
    return -1; // -1=idle, 0=loading, 1..8=sections, 9=done
  });
  // Charts show immediately (no sequential reveal) — controlled by projectionsExpanded in parent
  const chartPhase = 5; // always show all charts when projections are visible

  // Intersection observer: trigger animation once when visible (only for freshly generated)
  useEffect(() => {
    if (!aiAnalysis || hasAnimated.current || phaseIndex >= 9) return;
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        setPhaseIndex(0); // loading
        setTimeout(() => setPhaseIndex(1), 800); // resumen
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [aiAnalysis, phaseIndex]);

  const showAll = phaseIndex >= 9;
  const next = (to: number) => () => setTimeout(() => setPhaseIndex(to), 250);

  // Auto-scroll to non-typewriter AI sections
  // Anchor divs are placed OUTSIDE FadeIn so they exist in DOM before content renders
  // Scrolls so the anchor appears at ~30% from the top of the viewport
  useEffect(() => {
    if (!isFirstReveal) return;
    const anchorId = phaseIndex === 6 ? "ai-anchor-riesgos" : phaseIndex === 7 ? "ai-anchor-veredicto" : phaseIndex === 8 ? "ai-anchor-afavor" : phaseIndex === 9 ? "ai-anchor-veredicto-final" : null;
    if (anchorId) {
      // For veredicto final (phase 9), wait longer for content to render
      const scrollDelay = phaseIndex === 9 ? 800 : 400;
      setTimeout(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(anchorId);
          if (el) {
            const rect = el.getBoundingClientRect();
            const targetY = window.scrollY + rect.top - window.innerHeight * 0.35;
            window.scrollTo({ top: targetY, behavior: "smooth" });
          }
        });
      }, scrollDelay);
    }
  }, [phaseIndex, isFirstReveal]);

  // If already animated, show everything
  const content = aiAnalysis ? (
    <div className="space-y-5">
      {/* Loading phase */}
      {phaseIndex === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Sparkles className="h-8 w-8 animate-pulse text-[#C8323C]" />
          <p className="font-body text-sm text-[#FAFAF8]/50">Analizando tu inversión con IA...</p>
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8323C]" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8323C]" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8323C]" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {/* 1. Resumen Ejecutivo */}
      {phaseIndex >= 1 && (
        <div className={`rounded-lg border p-4 ${score >= 70 ? "border-[#B0BEC5]/30 bg-[#B0BEC5]/5" : score >= 40 ? "border-[#FBBF24]/30 bg-[#FBBF24]/5" : "border-[#C8323C]/30 bg-[#C8323C]/5"}`}>
          <p className="text-sm font-medium leading-relaxed text-[#FAFAF8]">
            {showAll ? ct(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo") : phaseIndex === 1 ? (
              <TypewriterText text={ct(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo")} onComplete={next(2)} />
            ) : ct(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo")}
          </p>
        </div>
      )}

      {/* 2. Tu Bolsillo */}
      <FadeIn show={phaseIndex >= 2}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#FAFAF8]" />
            <h4 className="font-body text-sm font-semibold text-[#FAFAF8]">{aiAnalysis.tuBolsillo.titulo}</h4>
          </div>
          <p className="text-sm leading-relaxed text-[#FAFAF8]/[0.75]">
            {showAll ? ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido") : phaseIndex === 2 ? (
              <TypewriterText text={ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido")} onComplete={next(3)} />
            ) : ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido")}
          </p>
          {ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta") && (
            <div className="mt-3 rounded-md border border-[#C8323C]/20 bg-[#C8323C]/5 px-3 py-2">
              <p className="flex items-start gap-2 text-xs text-[#C8323C]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta")}
              </p>
            </div>
          )}
        </div>
      </FadeIn>

      {/* 3. Vs Alternativas */}
      <FadeIn show={phaseIndex >= 3}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#FAFAF8]" />
            <h4 className="font-body text-sm font-semibold text-[#FAFAF8]">{aiAnalysis.vsAlternativas.titulo}</h4>
          </div>
          <p className="text-sm leading-relaxed text-[#FAFAF8]/[0.75]">
            {showAll ? ct(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido") : phaseIndex === 3 ? (
              <TypewriterText text={ct(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido")} onComplete={next(4)} />
            ) : ct(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido")}
          </p>
        </div>
      </FadeIn>

      {/* 4. Negociación */}
      <FadeIn show={phaseIndex >= 4}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Handshake className="h-4 w-4 text-[#FAFAF8]" />
            <h4 className="font-body text-sm font-semibold text-[#FAFAF8]">{aiAnalysis.negociacion.titulo}</h4>
          </div>
          <p className="text-sm leading-relaxed text-[#FAFAF8]/[0.75]">
            {showAll ? ct(aiAnalysis.negociacion as unknown as Record<string, unknown>, "contenido") : phaseIndex === 4 ? (
              <TypewriterText text={ct(aiAnalysis.negociacion as unknown as Record<string, unknown>, "contenido")} onComplete={next(5)} />
            ) : ct(aiAnalysis.negociacion as unknown as Record<string, unknown>, "contenido")}
          </p>
          {aiAnalysis.negociacion.precioSugerido && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[#FAFAF8]/50">Precio sugerido:</span>
              <span className="rounded-md bg-[#B0BEC5]/10 px-3 py-1 text-sm font-bold text-[#B0BEC5]">{aiAnalysis.negociacion.precioSugerido}</span>
            </div>
          )}
        </div>
      </FadeIn>

      {/* 5. Proyección */}
      <FadeIn show={phaseIndex >= 5}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#FAFAF8]" />
            <h4 className="font-body text-sm font-semibold text-[#FAFAF8]">{aiAnalysis.proyeccion.titulo}</h4>
          </div>
          <p className="text-sm leading-relaxed text-[#FAFAF8]/[0.75]">
            {showAll ? ct(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido") : phaseIndex === 5 ? (
              <TypewriterText text={ct(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido")} onComplete={next(6)} />
            ) : ct(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido")}
          </p>
        </div>
      </FadeIn>

      {/* 6. Riesgos */}
      <div id="ai-anchor-riesgos" />
      <FadeIn show={phaseIndex >= 6}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#FAFAF8]" />
            <h4 className="font-body text-sm font-semibold text-[#FAFAF8]">{aiAnalysis.riesgos.titulo}</h4>
          </div>
          <ul className="space-y-2">
            {ci(aiAnalysis.riesgos as unknown as Record<string, unknown>, "items").map((r, i) => (
              <FadeIn key={i} show={showAll || phaseIndex >= 6} delay={showAll ? 0 : i * 150}>
                <li className="text-sm leading-relaxed text-[#FAFAF8]/[0.75]">
                  <span className="mr-1 font-medium text-[#C8323C]">⚠</span> {stripBullet(r)}
                </li>
              </FadeIn>
            ))}
          </ul>
          {phaseIndex === 6 && <DelayedCallback delay={ci(aiAnalysis.riesgos as unknown as Record<string, unknown>, "items").length * 150 + 500} onComplete={() => setPhaseIndex(7)} />}
        </div>
      </FadeIn>

      {/* 7. Veredicto — inline during typewriter */}
      <div id="ai-anchor-veredicto" />
      <FadeIn show={phaseIndex >= 7}>
        <div className="rounded-xl border border-white/[0.08] bg-[#1A1A1A] p-4">
          <p className="text-sm leading-relaxed text-[#FAFAF8]">
            {showAll ? ct(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion") : phaseIndex === 7 ? (
              <TypewriterText text={ct(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion")} onComplete={next(8)} />
            ) : ct(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion")}
          </p>
        </div>
      </FadeIn>

      {/* 8. A Favor / Puntos de Atención */}
      <div id="ai-anchor-afavor" />
      <FadeIn show={phaseIndex >= 8}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium text-[#B0BEC5]">
              <CheckCircle2 className="h-4 w-4" /> A favor
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-[#FAFAF8]/60">
              {aiAnalysis.aFavor.map((p, i) => (
                <FadeIn key={i} show={showAll || phaseIndex >= 8} delay={showAll ? 0 : i * 100}>
                  <li>{p.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").trim()}</li>
                </FadeIn>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 font-body text-sm font-medium text-[#FBBF24]">
              <AlertTriangle className="h-4 w-4" /> Atención
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-[#FAFAF8]/60">
              {aiAnalysis.puntosAtencion.map((c, i) => (
                <FadeIn key={i} show={showAll || phaseIndex >= 8} delay={showAll ? 0 : (aiAnalysis.aFavor.length + i) * 100}>
                  <li>{c.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").trim()}</li>
                </FadeIn>
              ))}
            </ul>
          </div>
        </div>
        {phaseIndex === 8 && <DelayedCallback delay={(aiAnalysis.aFavor.length + aiAnalysis.puntosAtencion.length) * 100 + 500} onComplete={() => setPhaseIndex(9)} />}
      </FadeIn>

      {showAll && (
        <p className="text-center text-[10px] text-[#FAFAF8]/30">Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.</p>
      )}
    </div>
  ) : null;

  const isAnalyzing = aiLoading || (phaseIndex >= 0 && phaseIndex < 9 && !!aiAnalysis);
  const isComplete = phaseIndex >= 9 || (showAll && !!aiAnalysis);
  const showCTA = !aiAnalysis && !aiLoading && !aiError;

  // Gate: if not premium, show locked CTA
  if (currentAccess !== "premium") {
    return (
      <div ref={sectionRef} className="mb-8">
        <div className="rounded-2xl overflow-hidden mt-5">
          {/* Dark header */}
          <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, rgba(200,50,60,0.08) 50%, #1A1A1A 100%)", borderBottom: "1px solid rgba(200,50,60,0.2)" }} className="px-6 md:px-8 py-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.12) 0%, transparent 70%)" }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.06) 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="font-mono text-[10px] text-[#C8323C] uppercase tracking-[0.15em] mb-1.5">INFORME PRO</div>
              <div className="font-heading font-bold text-xl md:text-2xl text-white">Análisis completo con IA</div>
              <div className="font-body text-xs text-white/50 mt-1.5">Análisis personalizado + proyecciones a 20 años</div>
            </div>
          </div>
          {/* Locked body */}
          <div className="bg-[#151515] border border-white/[0.08] border-t-0 rounded-b-2xl">
            <div className="py-11 px-6 flex flex-col items-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#FAFAF8 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.06) 0%, transparent 70%)" }} />
              <div className="relative z-10 text-center">
                <div className="text-4xl mb-3 text-[#C8323C]/70">✦</div>
                <div className="font-body text-[15px] font-semibold text-[#FAFAF8] mb-1">Análisis IA + proyecciones a 20 años</div>
                <div className="font-body text-[13px] text-[#FAFAF8]/50 mb-5 max-w-xs mx-auto">Veredicto personalizado, precio sugerido, flujo dinámico, patrimonio y escenarios de salida.</div>
                <BottomPaywallCTA analysisId={analysisId ?? ""} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="informe-pro-section" className="mb-8">
      <div className="rounded-2xl overflow-hidden mt-5">
        {/* Dark header */}
        <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, rgba(200,50,60,0.08) 50%, #1A1A1A 100%)", borderBottom: "1px solid rgba(200,50,60,0.2)" }} className="px-6 md:px-8 py-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.12) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.06) 0%, transparent 70%)" }} />
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <div className="font-mono text-[10px] text-[#C8323C] uppercase tracking-[0.15em] mb-1.5">INFORME PRO</div>
              <div className="font-heading font-bold text-xl md:text-2xl text-white">Análisis completo con IA</div>
              <div className="font-body text-xs text-white/50 mt-1.5">Análisis personalizado + proyecciones a 20 años</div>
            </div>
            {isAnalyzing && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#C8323C] animate-pulse" />
                <span className="font-mono text-[11px] text-white/50">Analizando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="bg-[#151515] border border-white/[0.08] border-t-0 rounded-b-2xl relative overflow-hidden">
          {/* STATE A: CTA to generate */}
          {showCTA && (
            <div className="py-12 px-8 flex flex-col items-center relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#FAFAF8 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full" style={{ background: "radial-gradient(circle, rgba(200,50,60,0.08) 0%, transparent 70%)", animation: "glow-pulse 3s ease-in-out infinite" }} />
              <div className="relative z-10 text-center">
                <div className="text-5xl mb-4 text-[#C8323C]/70">✦</div>
                <div className="font-body text-[15px] font-semibold text-[#FAFAF8] mb-1.5">Genera el análisis completo con IA</div>
                <div className="font-body text-[13px] text-[#FAFAF8]/50 mb-6 max-w-sm">Franco analiza tu inversión y te dice la verdad — con datos, sin filtro.</div>
                <button
                  type="button"
                  onClick={loadAiAnalysis}
                  className="bg-[#C8323C] text-white font-body text-[15px] font-bold px-8 py-3.5 rounded-lg shadow-[0_4px_20px_rgba(200,50,60,0.3)] flex items-center gap-2 mx-auto hover:shadow-[0_4px_24px_rgba(200,50,60,0.4)] transition-shadow"
                >
                  <span className="text-base">✦</span>
                  Generar análisis IA →
                </button>
              </div>
            </div>
          )}

          {/* STATE B: Loading (real fetch) */}
          {aiLoading && (
            <div className="py-12 px-8 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#C8323C]" />
              <p className="font-body text-sm text-[#FAFAF8]/50">Analizando tu inversión con IA... (15-30 segundos)</p>
            </div>
          )}

          {/* Error */}
          {aiError && (
            <div className="p-8 space-y-3">
              <div className="rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/5 p-4 text-sm text-[#C8323C]">
                Error: {aiError}
              </div>
              <button type="button" onClick={loadAiAnalysis} className="text-sm font-medium text-[#FAFAF8] hover:underline">
                Reintentar
              </button>
            </div>
          )}

          {/* STATE B/C: AI content with typewriter */}
          {aiAnalysis && (
            <div className="p-6 md:p-8">
              <div className="font-body text-[15px] font-bold text-[#FAFAF8] mb-3">Siendo franco:</div>
              {content}

              {/* Veredicto final — shown after all phases complete */}
              <div id="ai-anchor-veredicto-final" />
              {isComplete && aiAnalysis.veredicto && (() => {
                const vc = aiAnalysis.veredicto.decision === "COMPRAR" ? "#B0BEC5"
                  : aiAnalysis.veredicto.decision === "AJUSTA EL PRECIO" || aiAnalysis.veredicto.decision === ("NEGOCIAR" as string) ? "#FBBF24"
                  : "#C8323C";
                return (
                  <div className="mt-6 pt-6 border-t border-white/[0.06] animate-fadeIn">
                    <div
                      className="relative overflow-hidden rounded-xl text-center"
                      style={{ background: "#151515", border: `1px solid ${vc}15`, padding: "40px 24px" }}
                    >
                      {/* Radial gradient glow from top */}
                      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center top, ${vc}12 0%, transparent 55%)` }} />
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg, transparent 0%, ${vc}55 50%, transparent 100%)` }} />

                      <div className="relative">
                        <div className="flex items-baseline justify-center gap-2 mb-4">
                          <span className="font-mono text-[10px] uppercase tracking-[3px] text-[#FAFAF8]/20">VEREDICTO</span>
                          <FrancoLogo size="sm" inverted />
                        </div>
                        <div
                          className="inline-block font-mono font-semibold text-2xl tracking-[5px] uppercase rounded-lg"
                          style={{
                            color: vc,
                            background: `${vc}12`,
                            border: `1px solid ${vc}35`,
                            padding: "14px 36px",
                            boxShadow: `0 0 40px ${vc}15, 0 0 15px ${vc}08, 0 4px 16px rgba(0,0,0,0.4)`,
                          }}
                        >
                          {aiAnalysis.veredicto.decision}
                        </div>
                        {aiAnalysis.negociacion?.precioSugerido && (
                          <div className="font-mono text-[13px] text-[#FAFAF8]/40 mt-4">
                            Precio sugerido: {aiAnalysis.negociacion.precioSugerido}
                          </div>
                        )}
                        <p className="text-[11px] text-zinc-500 text-center mt-4 max-w-md mx-auto leading-relaxed">
                          Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión. Consulta con un profesional antes de decidir.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Projections — collapsed CTA or expanded content */}
          {/* Projections zone marker — always in DOM for FAB detection */}
          <div id="projections-zone-marker" />

          {projectionsContent && (aiAnalysis || aiLoading) && (
            <>
              {!projectionsExpanded && isComplete && onExpandProjections && (
                <div className="px-6 md:px-8 pb-8">
                  <div className="border-t border-white/[0.06] pt-6" />
                  <div
                    onClick={onExpandProjections}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-[#151515] px-6 py-5 transition-all hover:border-white/[0.1] hover:bg-[#1A1A1A]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#222222]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#B0BEC5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <rect x="4" y="14" width="3" height="6" rx="0.5" />
                          <rect x="10.5" y="10" width="3" height="10" rx="0.5" />
                          <rect x="17" y="5" width="3" height="15" rx="0.5" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#FAFAF8]/20">
                          {projectionsCTALabel || "Patrimonio en 10 años"}
                        </div>
                        <div className="text-sm font-medium text-[#FAFAF8]">
                          ¿Cuánto vale tu inversión a futuro?
                        </div>
                        {projectionsCTAValue && (
                          <div className="font-mono text-[13px] font-medium text-[#B0BEC5]">
                            {projectionsCTAValue}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-lg text-[#FAFAF8]/20">↓</span>
                  </div>
                </div>
              )}

              {projectionsExpanded && (
                <>
                  <div id="projections-start" className="mx-6 md:mx-8">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/[0.08]" />
                      <span className="font-mono text-[9px] text-[#FAFAF8]/50 uppercase tracking-[0.1em]">PROYECCIONES</span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                  </div>
                  <div className="p-6 md:p-8 pt-4">
                    {typeof projectionsContent === "function" ? projectionsContent(chartPhase, isFirstReveal) : projectionsContent}
                  </div>
                </>
              )}
            </>
          )}

          {/* CTAs at the end — only after AI triggered */}
          {(aiAnalysis || aiLoading) && (
            <>
              <div className="px-6 md:px-8 pb-6 flex flex-col sm:flex-row gap-2.5">
                <a href="/analisis/nuevo" className="bg-[#FAFAF8] text-[#0F0F0F] font-body font-semibold px-6 py-3 rounded-lg text-sm text-center">
                  Analizar otra propiedad →
                </a>
              </div>
              {isComplete && (
                <p className="px-6 md:px-8 pb-6 text-center text-[10px] text-[#FAFAF8]/30">Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.</p>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes glow-pulse { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.15); } } @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// Helper: triggers a callback after a delay (no visual output)
function DelayedCallback({ delay, onComplete }: { delay: number; onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, delay);
    return () => clearTimeout(t);
  }, [delay, onComplete]);
  return null;
}

// Get the right AI text field based on currency toggle, with legacy fallback
function aiText(obj: Record<string, unknown>, field: string, currency: "CLP" | "UF"): string {
  const key = field + (currency === "UF" ? "_uf" : "_clp");
  let text = "";
  if (typeof obj[key] === "string" && obj[key]) text = obj[key] as string;
  // Legacy fallback: old analyses without _clp/_uf suffixes
  else if (typeof obj[field] === "string") text = obj[field] as string;
  // Strip markdown bold and replace price score
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/price score/gi, "Eficiencia de compra");
}

// Get the right AI items array based on currency toggle, with legacy fallback
function aiItems(obj: Record<string, unknown>, field: string, currency: "CLP" | "UF"): string[] {
  const key = field + (currency === "UF" ? "_uf" : "_clp");
  let items: string[] = [];
  if (Array.isArray(obj[key]) && obj[key].length > 0) items = obj[key] as string[];
  // Legacy fallback
  else if (Array.isArray(obj[field])) items = obj[field] as string[];
  // Strip markdown bold
  return items.map(s => s.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1"));
}

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


function RegisterOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#151515]/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-[#151515]/90 px-6 py-5 shadow-lg">
        <Lock className="h-6 w-6 text-[#FAFAF8]" />
        <span className="text-sm font-medium text-[#FAFAF8]">Regístrate gratis para ver esta sección</span>
        <a href="/register">
          <Button size="sm" className="gap-2">
            Regístrate gratis
          </Button>
        </a>
      </div>
    </div>
  );
}

function PaywallOverlay({ analysisId }: { analysisId: string }) {
  function handleUnlock() {
    window.location.href = `/checkout?product=pro&analysisId=${analysisId}`;
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#151515]/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-[#151515]/90 px-6 py-5 shadow-lg">
        <Sparkles className="h-6 w-6 text-[#C8323C]" />
        <span className="font-body text-sm font-medium text-[#FAFAF8]">Sección exclusiva del Informe Pro</span>
        <Button size="sm" className="gap-2 bg-[#C8323C] text-white font-bold hover:bg-[#C8323C]/90" onClick={handleUnlock}>
          <Sparkles className="h-4 w-4" />
          Desbloquear la verdad — $4.990
        </Button>
        <span className="font-body text-xs text-[#FAFAF8]/50">$4.990 por análisis</span>
      </div>
    </div>
  );
}

function BottomPaywallCTA({ analysisId }: { analysisId: string }) {
  function handleUnlock() {
    window.location.href = `/checkout?product=pro&analysisId=${analysisId}`;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleUnlock}
        className="bg-[#C8323C] text-white font-body text-sm font-bold px-6 py-3 rounded-lg shadow-[0_4px_20px_rgba(200,50,60,0.25)] hover:shadow-[0_4px_24px_rgba(200,50,60,0.35)] transition-shadow"
      >
        Desbloquear la verdad — $4.990
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionCard({ title, description, icon: Icon, children, gate = "none", accessLevel = "premium", analysisId }: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  gate?: "none" | "login" | "premium";
  accessLevel?: "guest" | "free" | "premium";
  analysisId?: string;
}) {
  const showRegister = (gate === "login" && accessLevel === "guest") || (gate === "premium" && accessLevel === "guest");
  const showPaywall = gate === "premium" && accessLevel === "free";
  return (
    <div className="relative mb-8">
      <Card className="border border-white/[0.08] rounded-2xl shadow-sm bg-[#151515]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[#FAFAF8]" />
            <CardTitle className="font-body font-bold text-lg text-[#FAFAF8]">{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-[#FAFAF8]/50">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {showRegister && <RegisterOverlay />}
      {showPaywall && analysisId && <PaywallOverlay analysisId={analysisId} />}
    </div>
  );
}

function ZoneComparisonCards({ m, zoneData, comuna, currency, fmt, mapQuery, googleMapUrl, inputData }: {
  m: ReturnType<typeof normalizeMetrics>;
  zoneData: MarketDataRow[] | null | undefined;
  comuna?: string;
  currency: "CLP" | "UF";
  fmt: (n: number) => string;
  mapQuery: string;
  googleMapUrl: string;
  inputData?: import("@/lib/types").AnalisisInput;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonaRadio = (inputData as any)?.zonaRadio as { precioM2VentaCLP?: number; arriendoPromedio?: number; arriendoPrecioM2?: number; sampleSizeArriendo?: number; sampleSizeVenta?: number; radioMetros?: number } | undefined;
  const hasRadioData = zonaRadio && (zonaRadio.precioM2VentaCLP || zonaRadio.arriendoPromedio);

  if (!m) {
    return <p className="text-sm text-[#FAFAF8]/50">Datos de mercado no disponibles.</p>;
  }

  // Prefer radius-based data; fallback to comuna-level market_data
  let avgArriendoZona: number;
  let avgM2Zona: number; // UF/m²
  let totalPubs: number;
  let sourceLabel: string;

  if (hasRadioData) {
    avgArriendoZona = zonaRadio.arriendoPromedio || 0;
    avgM2Zona = zonaRadio.precioM2VentaCLP ? Math.round(zonaRadio.precioM2VentaCLP / UF_CLP * 10) / 10 : 0;
    totalPubs = Math.max(zonaRadio.sampleSizeArriendo || 0, zonaRadio.sampleSizeVenta || 0);
    sourceLabel = `Basado en ${totalPubs} comparables en radio de ${zonaRadio.radioMetros || 800}m.`;
  } else if (zoneData && zoneData.length > 0) {
    avgArriendoZona = Math.round(zoneData.reduce((s, d) => s + d.arriendo_promedio, 0) / zoneData.length);
    avgM2Zona = Math.round(zoneData.reduce((s, d) => s + d.precio_m2_promedio, 0) / zoneData.length * 10) / 10;
    totalPubs = zoneData.reduce((s, d) => s + d.numero_publicaciones, 0);
    sourceLabel = `Basado en ${totalPubs} publicaciones activas en ${comuna}.`;
  } else {
    return <p className="text-sm text-[#FAFAF8]/50">Datos de mercado no disponibles para esta zona.</p>;
  }

  // Yield zona: use radius arriendo and venta precio/m² if available
  const superficie = inputData?.superficie || 50;
  const yieldZona = avgM2Zona > 0 && avgArriendoZona > 0
    ? (avgArriendoZona * 12) / (avgM2Zona * superficie * UF_CLP) * 100
    : (m.rentabilidadBruta ?? 0) * 0.9;

  const tuyoPrecioM2 = currency === "UF" ? m.precioM2 : m.precioM2 * UF_CLP;
  const zonaPrecioM2 = currency === "UF" ? avgM2Zona : avgM2Zona * UF_CLP;

  const cards = [
    {
      title: currency === "UF" ? "PRECIO/M² (UF)" : "PRECIO/M²",
      tuyo: tuyoPrecioM2,
      zona: zonaPrecioM2,
      fmtVal: (v: number) => currency === "UF" ? `UF ${v.toFixed(1).replace(".", ",")}` : fmtCLP(v),
      invertColor: true, // lower is better
    },
    {
      title: "ARRIENDO",
      tuyo: m.ingresoMensual,
      zona: avgArriendoZona,
      fmtVal: (v: number) => fmt(v),
      invertColor: false, // higher is better
    },
    {
      title: "RENT. BRUTA",
      tuyo: m.rentabilidadBruta,
      zona: Math.round(yieldZona * 10) / 10,
      fmtVal: (v: number) => fmtPct(v),
      invertColor: false, // higher is better
    },
  ];

  return (
    <div>
      <p className="text-xs text-[#FAFAF8]/50 mb-3">
        {sourceLabel}
        {hasRadioData && avgArriendoZona > 0 && m.ingresoMensual > 0 && (() => {
          const diff = ((m.ingresoMensual - avgArriendoZona) / avgArriendoZona) * 100;
          return Math.abs(diff) > 10 && diff < 0
            ? " La sugerencia de Franco usa la mediana (más conservadora que el promedio)."
            : null;
        })()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {cards.map((c) => {
          const delta = c.zona !== 0 ? ((c.tuyo - c.zona) / c.zona) * 100 : 0;
          const isFavorable = c.invertColor ? delta < 0 : delta > 0;
          const deltaColor = isFavorable ? "text-[#B0BEC5]" : "text-[#C8323C]";
          const deltaSign = delta > 0 ? "+" : "";
          const contextText = c.invertColor
            ? (delta < 0 ? "bajo el promedio" : "sobre el promedio")
            : (delta > 0 ? "sobre el promedio" : "bajo el promedio");
          return (
            <div key={c.title} className="bg-[#1A1A1A] rounded-[10px] p-4 text-center">
              <p className="font-body text-[10px] text-[#FAFAF8]/40 uppercase tracking-wide">{c.title}</p>
              <p className={`font-mono text-[32px] font-bold leading-none mt-1.5 ${deltaColor}`}>{deltaSign}{Math.round(delta)}%</p>
              <p className="font-body text-[10px] text-[#FAFAF8]/35 mt-2">{contextText}</p>
              <div className="border-t border-white/[0.06] mt-3 pt-2.5 space-y-1">
                <p className="text-[11px]"><span className="font-body text-[#FAFAF8]/40">Tú: </span><span className="font-mono text-[#FAFAF8]">{c.fmtVal(c.tuyo)}</span></p>
                <p className="text-[11px]"><span className="font-body text-[#FAFAF8]/30">Zona: </span><span className="font-mono text-[#FAFAF8]/50">{c.fmtVal(c.zona)}</span></p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Map */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-[#FAFAF8]/50">
          <MapPin className="h-4 w-4" />
          <span>Ubicación: {mapQuery}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <iframe src={googleMapUrl} width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa de ubicación" />
        </div>
      </div>
    </div>
  );
}

function CurrencyToggle({ currency, onToggle }: { currency: "CLP" | "UF"; onToggle: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between border border-white/[0.08] bg-[#151515] rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-8 w-20 items-center rounded-full bg-white/[0.08] p-1 transition-colors"
        >
          <div
            className={`absolute h-6 w-9 rounded-full bg-[#FAFAF8] transition-transform ${
              currency === "UF" ? "translate-x-[40px]" : "translate-x-0"
            }`}
          />
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "CLP" ? "text-[#0F0F0F]" : "text-[#FAFAF8]/50"}`}>
            CLP
          </span>
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "UF" ? "text-[#0F0F0F]" : "text-[#FAFAF8]/50"}`}>
            UF
          </span>
        </button>
        {currency === "CLP" && (
          <span className="text-xs text-[#FAFAF8]/40">Valores en CLP calculados con UF = ${UF_CLP.toLocaleString("es-CL")}</span>
        )}
      </div>
    </div>
  );
}

export function PremiumResults({
  results, accessLevel = "free", analysisId, inputData, comuna,
  score, freeYieldBruto, freeFlujo, freePrecioM2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumenEjecutivo: _resumenEjecutivo,
  ufValue, zoneData, aiAnalysisInitial,
  nombre = "", ciudad = "", createdAt = "", superficie = 0, precioUF = 0,
  hidePanel = false,
  demoAiData,
  creatorName,
  isSharedView = false,
  isSharedLink = false,
}: {
  results?: FullAnalysisResult | null;
  accessLevel?: "guest" | "free" | "premium";
  analysisId?: string;
  inputData?: AnalisisInput;
  comuna?: string;
  score: number;
  freeYieldBruto: number;
  freeFlujo: number;
  freePrecioM2: number;
  resumenEjecutivo: string;
  ufValue?: number;
  zoneData?: MarketDataRow[] | null;
  aiAnalysisInitial?: AIAnalysis | unknown;
  nombre?: string;
  ciudad?: string;
  createdAt?: string;
  superficie?: number;
  precioUF?: number;
  hidePanel?: boolean;
  demoAiData?: AIAnalysis;
  creatorName?: string;
  isSharedView?: boolean;
  isSharedLink?: boolean;
}) {
  // Update module-level UF value from server
  if (ufValue) UF_CLP = ufValue;
  const currentAccess = accessLevel;
  const [horizonYears, setHorizonYears] = useState(10);
  const [sensHorizon, setSensHorizon] = useState(10);
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [plusvaliaRate, setPlusvaliaRate] = useState(4.0);
  const [arriendoGrowth, setArriendoGrowth] = useState(3.5);
  const [costGrowth, setCostGrowth] = useState(3.0);
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  const [fabState, setFabState] = useState<'inputs' | 'hidden' | 'projections'>('inputs');
  const [projectionsExpanded, setProjectionsExpanded] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setIsTouchDevice(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(
    aiAnalysisInitial && typeof aiAnalysisInitial === "object" && "veredicto" in aiAnalysisInitial ? aiAnalysisInitial as AIAnalysis : null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadAiAnalysis = useCallback(async () => {
    if (aiLoading) return;
    // Demo mode: use hardcoded AI data with simulated delay
    if (!analysisId && demoAiData) {
      setAiLoading(true);
      setAiError(null);
      setTimeout(() => {
        setAiAnalysis(demoAiData);
        setAiLoading(false);
      }, 1500);
      return;
    }
    if (!analysisId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      if (!res.ok) throw new Error("Error al generar análisis");
      const data = await res.json();
      setAiAnalysis(data);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setAiLoading(false);
    }
  }, [analysisId, aiLoading, demoAiData]);

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

  const fechaEntregaLabel = useMemo(() => {
    if (!inputData?.fechaEntrega) return "";
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${meses[(me || 1) - 1]} ${a}`;
  }, [inputData]);

  const horizonBeforeDelivery = mesesPreEntregaTop > 0 && horizonYears * 12 <= mesesPreEntregaTop;
  const mesesParaVerFlujo = mesesPreEntregaTop + 12;
  const anosParaVerFlujo = Math.ceil(mesesParaVerFlujo / 12);

  const fmt = useCallback((n: number) => fmtMoney(n, currency), [currency]);
  const fmtAxis = useCallback((n: number) => fmtAxisMoney(n, currency), [currency]);
  const toggleCurrency = useCallback(() => setCurrency((c) => c === "CLP" ? "UF" : "CLP"), []);
  // Helper to get AI text for current currency
  const ct = useCallback((obj: Record<string, unknown>, field: string) => aiText(obj, field, currency), [currency]);
  const ci = useCallback((obj: Record<string, unknown>, field: string) => aiItems(obj, field, currency), [currency]);

  // Flujo unificado: SIEMPRE recalculado con calcFlujoDesglose (ignora valor guardado en DB)
  const flujoUnificado = useMemo(() => {
    if (!m || !inputData) return freeFlujo;
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * getMantencionRate(inputData.antiguedad)) / 12);
    return calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
      vacanciaMeses: inputData.vacanciaMeses,
      usaAdministrador: inputData.usaAdministrador,
      comisionAdministrador: inputData.comisionAdministrador,
    }).flujoNeto;
  }, [m, inputData, freeFlujo]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const flujoText = useMemo(() => {
    const f = flujoUnificado;
    const abs = Math.abs(f);
    if (f === 0) return "Break-even — sin ganancia ni pérdida mensual.";
    if (f > 0) return "La propiedad se paga sola y genera ganancia";
    if (abs <= 100000) return "Aporte mensual moderado para el mercado";
    if (abs <= 300000) return "Aporte mensual significativo de tu bolsillo";
    return "Aporte mensual elevado — evalúa bien";
  }, [flujoUnificado]);

  const flujoBreakdown = useMemo(() => {
    if (!m || !inputData) return null;
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * getMantencionRate(inputData.antiguedad)) / 12);
    return calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
      vacanciaMeses: inputData.vacanciaMeses ?? 1,
      usaAdministrador: inputData.usaAdministrador,
      comisionAdministrador: inputData.comisionAdministrador,
    });
  }, [m, inputData]);

  // Recalculate projections when plusvaliaRate changes
  const dynamicProjections = useMemo(() => {
    if (!results || !m || !inputData) return results?.projections ?? [];
    const precioCLP = inputData.precio * UF_CLP;
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;
    let arriendoActual = inputData.arriendo;
    let gastosActual = inputData.gastos;
    let contribucionesActual = inputData.contribuciones;
    let valorPropiedad = precioCLP;
    let flujoAcumulado = 0;
    const plusvaliaDec = plusvaliaRate / 100;
    const costGrowthDec = costGrowth / 100;

    const calcSaldo = (mesActual: number) => {
      const tasaMensual = inputData.tasaInteres / 100 / 12;
      const n = inputData.plazoCredito * 12;
      if (tasaMensual === 0) return creditoCLP * (1 - mesActual / n);
      const div = (creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
      return creditoCLP * Math.pow(1 + tasaMensual, mesActual) - div * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual);
    };

    const projs = [];
    for (let anio = 1; anio <= 20; anio++) {
      const mesInicio = (anio - 1) * 12 + 1;
      const mesFin = anio * 12;

      // Mantención crece por antigüedad + inflación de costos
      const antiguedadActual = inputData.antiguedad + anio;
      const mantencionBase = inputData.provisionMantencion || Math.round((precioCLP * getMantencionRate(antiguedadActual)) / 12);
      const mantencion = Math.round(mantencionBase * Math.pow(1 + costGrowthDec, anio - 1));

      // Usar función centralizada
      const flujoMes = calcFlujoDesglose({
        arriendo: arriendoActual,
        dividendo: m.dividendo,
        ggcc: gastosActual,
        contribuciones: contribucionesActual,
        mantencion,
        vacanciaMeses: inputData.vacanciaMeses ?? 1,
        usaAdministrador: inputData.usaAdministrador,
        comisionAdministrador: inputData.comisionAdministrador,
      });

      let flujoAnual = 0;
      for (let mo = mesInicio; mo <= mesFin; mo++) {
        if (mo <= mesesPreEntrega) {
          // Pre-entrega: sin flujo operativo (cuotas pie son inversión de capital, no flujo)
        } else {
          flujoAnual += flujoMes.flujoNeto;
        }
      }
      flujoAcumulado += flujoAnual;
      valorPropiedad *= (1 + plusvaliaDec);
      const mesesCredito = Math.max(0, mesFin - mesesPreEntrega);
      const saldo = mesesCredito > 0 ? Math.max(0, calcSaldo(mesesCredito)) : creditoCLP;
      projs.push({
        anio,
        arriendoMensual: Math.round(arriendoActual),
        flujoAnual: Math.round(flujoAnual),
        flujoAcumulado: Math.round(flujoAcumulado),
        valorPropiedad: Math.round(valorPropiedad),
        saldoCredito: Math.round(saldo),
        patrimonioNeto: Math.round(valorPropiedad - saldo),
      });
      if (mesFin > mesesPreEntrega) {
        arriendoActual *= (1 + arriendoGrowth / 100);
        gastosActual *= (1 + costGrowthDec);
        contribucionesActual *= (1 + costGrowthDec);
      }
    }
    return projs;
  }, [results, m, inputData, plusvaliaRate, arriendoGrowth, costGrowth]);

  // Dynamic refinance scenario based on horizon + refiPct
  // dynamicRefi removed — refi section now calculates directly from projData


  // ─── Sensitivity scenarios with projections ───
  const sensScenarios = useMemo(() => {
    if (!results || !m || !inputData) return null;

    const precioCLP = inputData.precio * UF_CLP;
    const pieCLP = precioCLP * (inputData.piePct / 100);
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const nMeses = inputData.plazoCredito * 12;

    const configs = [
      { key: "pesimista", label: "Pesimista", sub: "Mercado difícil", icon: "↓", plusvalia: 2, arriendoGr: 1.5, gastosGr: 5, tasaDelta: 1.5, arriendoPct: -15, vacanciaDelta: 1, color: "#C8323C", borderClass: "border-[#C8323C]/60", bgClass: "", labelClass: "text-[#C8323C]" },
      { key: "base", label: "Base", sub: "Escenario actual", icon: "→", plusvalia: plusvaliaRate, arriendoGr: arriendoGrowth, gastosGr: costGrowth, tasaDelta: 0, arriendoPct: 0, vacanciaDelta: 0, color: "#FAFAF8", borderClass: "border-[#FAFAF8]/30 ring-0", bgClass: "bg-[#1A1A1A]", labelClass: "text-[#FAFAF8]" },
      { key: "optimista", label: "Optimista", sub: "Viento a favor", icon: "↑", plusvalia: 6, arriendoGr: 5, gastosGr: 2, tasaDelta: -1, arriendoPct: 10, vacanciaDelta: -Math.min(0.5, inputData.vacanciaMeses), color: "#FAFAF8", borderClass: "border-[#FAFAF8]/30", bgClass: "", labelClass: "text-[#B0BEC5]" },
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
      let gastosAct = inputData.gastos;
      let contribAct = inputData.contribuciones;
      let flujoAcumH = 0;
      let flujoMes1 = 0;

      for (let anio = 1; anio <= h; anio++) {
        const mantBase = inputData.provisionMantencion || Math.round((precioCLP * getMantencionRate(inputData.antiguedad + anio)) / 12);
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

  const radarData = results ? [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusvalía", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Eficiencia", value: results.desglose.eficiencia, fullMark: 100 },
  ] : [];

  const waterfallData = useMemo(() => {
    if (!m || !inputData) return [];
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * getMantencionRate(inputData.antiguedad)) / 12);
    const wf = calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
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
      { name: "Admin.", value: wf.administracion },
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
        fill: s.delta >= 0 ? "rgba(250,250,248,0.6)" : "rgba(200,50,60,0.8)",
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
      fill: flujo >= 0 ? "rgba(250,250,248,0.5)" : "#C8323C",
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
    const precioCLPBase = inputData.provisionMantencion ? 0 : m.precioCLP;

    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;

    // Always calculate month by month
    const allData: CashflowRow[] = [];
    allData.push({ name: "T0", _x: 0, Ingreso: 0, Dividendo: 0, GGCC: 0, Contribuciones: 0, Mantencion: 0, Vacancia: 0, Corretaje: 0, Recambio: 0, Administracion: 0, FlujoNeto: 0, Acumulado: 0 });

    let acumulado = 0;
    let arriendoActual = inputData.arriendo;
    let gastosActual = inputData.gastos ?? 0;
    let contribucionesActual = inputData.contribuciones;
    const costGrowthDec = costGrowth / 100;

    function getMantencionForMonth(mes: number): number {
      const anioProyeccion = Math.ceil(mes / 12);
      const antiguedadActual = inputData!.antiguedad + anioProyeccion;
      const mantencionBase = inputData!.provisionMantencion || Math.round((precioCLPBase * getMantencionRate(antiguedadActual)) / 12);
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
  const egresoBarSeries = useMemo(() => {
    const allSeries: { key: keyof CashflowRow; label: string; color: string }[] = [
      { key: "Dividendo", label: "Dividendo", color: "rgba(200,50,60,0.85)" },
      { key: "GGCC", label: "GGCC", color: "rgba(200,50,60,0.7)" },
      { key: "Contribuciones", label: "Contribuciones", color: "rgba(250,250,248,0.35)" },
      { key: "Mantencion", label: "Mantención", color: "rgba(200,50,60,0.6)" },
      { key: "Vacancia", label: "Vacancia", color: "rgba(250,250,248,0.25)" },
      { key: "Corretaje", label: "Corretaje", color: "rgba(250,250,248,0.35)" },
      { key: "Recambio", label: "Recambio", color: "rgba(250,250,248,0.25)" },
      { key: "Administracion", label: "Administración", color: "rgba(250,250,248,0.35)" },
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

  // Exit scenario helper — calculates exit metrics for a given year
  const calcExitForYear = useCallback((years: number, flujoAcum: number) => {
    if (!results || !m || dynamicProjections.length === 0) return null;
    const proy = dynamicProjections[years - 1];
    if (!proy) return null;
    const valorVenta = proy.valorPropiedad;
    const comisionVenta = Math.round(valorVenta * 0.02);
    const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
    const retornoTotal = flujoAcum + gananciaNeta;
    const multiplicadorCapital = m.pieCLP > 0 ? Math.round((retornoTotal / m.pieCLP) * 100) / 100 : 0;
    const flujos = [-m.pieCLP];
    for (let i = 0; i < years; i++) {
      let flujo = dynamicProjections[i].flujoAnual;
      if (i === years - 1) flujo += valorVenta - proy.saldoCredito - comisionVenta;
      flujos.push(flujo);
    }
    const tir = calcTIR(flujos);
    return { anios: years, valorVenta: Math.round(valorVenta), saldoCredito: Math.round(proy.saldoCredito), comisionVenta, gananciaNeta: Math.round(gananciaNeta), flujoAcumulado: flujoAcum, retornoTotal: Math.round(retornoTotal), multiplicadorCapital, tir };
  }, [results, m, dynamicProjections]);

  // Fixed 10-year exit for header metrics (independent of horizon slider)
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

  const projData = useMemo((): PatrimonioRow[] => {
    if (!results || !m || !inputData) return [];
    const precioCLP = inputData.precio * UF_CLP;
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;
    const cuotasPie = inputData.cuotasPie > 0 ? inputData.cuotasPie : mesesPreEntrega;
    const montoCuotaPie = inputData.montoCuota > 0 ? inputData.montoCuota : (cuotasPie > 0 ? Math.round(m.pieCLP / cuotasPie) : 0);
    const plusvaliaDec = plusvaliaRate / 100;
    const plusvaliaMensual = Math.pow(1 + plusvaliaDec, 1 / 12) - 1;

    // Fix #1: usar valor de mercado Franco como base de plusvalía
    const valorMercadoFrancoCLP = m.valorMercadoFrancoUF ? m.valorMercadoFrancoUF * UF_CLP : null;
    const valorBase = valorMercadoFrancoCLP || precioCLP;

    // Fix #2: gastos de cierre (~2% del precio de compra)
    const gastosCierre = precioCLP * 0.02;

    // Flujo acumulado: compute month-by-month with growing arriendo/costs (same logic as cashflowData)
    const costGrowthDec = costGrowth / 100;
    const flujoAcumByMonth: number[] = [0]; // index 0 = T0
    {
      let arriendoAct = inputData.arriendo;
      let gastosAct = inputData.gastos ?? 0;
      let contribucionesAct = inputData.contribuciones;
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
          const mantencionBase = inputData.provisionMantencion || Math.round((precioCLP * getMantencionRate(antiguedadActual)) / 12);
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
  const googleMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  // (exit/refi section reads directly from projData inline)

  // Automatic "Siendo franco:" text — based on veredicto (includes overrides)
  const siendoFrancoText = useMemo(() => {
    const flujoAbs = fmtCLP(Math.abs(flujoUnificado));
    const veredicto = results?.veredicto || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");

    if (veredicto === "BUSCAR OTRA") {
      if (flujoUnificado >= 0) return "Score bajo a pesar del flujo positivo — otras métricas no acompañan.";
      return `Este depto no da los números. Flujo negativo de ${flujoAbs}/mes y las condiciones no mejoran con ajustes de precio.`;
    }
    if (veredicto === "AJUSTA EL PRECIO") {
      if (flujoUnificado >= 0) return "Flujo positivo pero métricas justas. Puede funcionar si consigues mejor precio.";
      return `Este depto te cuesta ${flujoAbs}/mes de tu bolsillo. Negociable si consigues mejor precio.`;
    }
    // COMPRAR
    if (flujoUnificado >= 0) return "Este depto da los números. Rentabilidad sólida y flujo positivo.";
    if (flujoUnificado > -50000) return "Este depto da los números. Rentabilidad sólida y flujo casi neutro.";
    return `Buenas métricas, pero cada mes pones ${flujoAbs} de tu bolsillo por el financiamiento. La inversión depende de la plusvalía.`;
  }, [score, flujoUnificado, results?.veredicto]);

  const mainContent = (
    <>
      {/* Shared view banner (logged in user viewing someone else's analysis) */}
      {isSharedView && (
        <div className="bg-[#0F0F0F] text-white rounded-xl p-4 px-5 mb-4 flex items-center justify-between gap-3 flex-wrap border border-white/[0.08]">
          <p className="font-body text-sm">Estás viendo un análisis compartido.</p>
          <a href="/analisis/nuevo" className="font-body text-sm font-semibold text-[#C8323C] hover:underline shrink-0">
            Analizar mi propio depto →
          </a>
        </div>
      )}
      {/* Shared link banner (guest arriving via shared link) */}
      {isSharedLink && (
        <div className="bg-[#0F0F0F] text-white rounded-xl p-4 px-5 mb-4 flex items-center justify-between gap-3 flex-wrap border border-white/[0.08]">
          <p className="font-body text-sm">
            {creatorName ? `${creatorName} te compartió este análisis.` : "Te compartieron un análisis."}
            {" "}Regístrate para verlo completo.
          </p>
          <a href="/register" className="font-body text-sm font-semibold text-[#C8323C] hover:underline shrink-0">
            Crear cuenta gratis →
          </a>
        </div>
      )}

      {/* Banner: comuna fuera del Gran Santiago */}
      {(() => {
        const comunaActual = (comuna || inputData?.comuna || '').trim();
        if (comunaActual && !COMUNAS_GRAN_SANTIAGO.includes(comunaActual)) {
          return (
            <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-5 py-3.5 mb-4">
              <p className="font-body text-[13px] text-[#FBBF24]">
                Este análisis tiene precisión limitada. Franco está optimizado para el Gran Santiago — los datos de mercado, plusvalía y metro aplican a esa zona.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* ═══════ BLOCK 1 — EXECUTIVE SUMMARY (NO REGISTRATION) ═══════ */}
      <div className="bg-[#1A1A1A] rounded-2xl p-7 md:p-8 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          {/* Left: Score Bar */}
          <div className="relative">
            <div className={currentAccess === "guest" ? "filter blur-[8px] pointer-events-none" : ""}>
              <ScoreBarInline score={score} veredicto={results?.veredicto} />
            </div>
            {currentAccess === "guest" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Lock className="h-4 w-4 text-[#FAFAF8] mb-1.5" />
                <p className="font-body text-[11px] font-medium text-[#FAFAF8] text-center leading-tight">Regístrate gratis<br />para ver tu Score</p>
                <a href="/register" className="mt-2">
                  <span className="font-body text-[10px] font-semibold text-[#C8323C] hover:underline">Crear cuenta →</span>
                </a>
              </div>
            )}
          </div>

          {/* Right: Info + Metrics + Siendo Franco */}
          <div>
            {currentAccess === "guest" && creatorName && (
              <p className="font-body text-xs font-semibold text-[#C8323C] mb-1">Análisis de {creatorName}</p>
            )}
            <h1 className="font-heading font-bold text-xl md:text-2xl text-[#FAFAF8]">{nombre}</h1>
            <p className="font-body text-xs text-[#FAFAF8]/50 mt-1">
              {ciudad && <>{ciudad} · </>}{superficie}m² · {fmtUF(precioUF)} ({currency === "UF" ? fmtUF(freePrecioM2) : fmtCLP(freePrecioM2 * UF_CLP)}/m²) · Pie {inputData?.piePct ?? 20}%
            </p>
            {createdAt && (
              <p className="font-body text-[10px] text-[#FAFAF8]/30 mt-0.5">
                Analizado el {new Date(createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}

            {/* Currency Toggle */}
            <div className="mt-3">
              <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
            </div>

            {/* 3 metrics grid */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/[0.03] rounded-[10px] p-2.5 border border-white/[0.08] text-center overflow-hidden">
                <p className="font-body text-[8px] sm:text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide truncate">Flujo mensual</p>
                <p className={`font-mono text-sm sm:text-lg font-semibold mt-1 truncate ${flujoUnificado >= 0 ? "text-[#FAFAF8]" : "text-[#C8323C]"}`}>
                  {flujoUnificado >= 0 ? "+" : ""}{fmtM(flujoUnificado)}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-[10px] p-2.5 border border-white/[0.08] text-center overflow-hidden">
                <p className="font-body text-[8px] sm:text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide truncate">Rent. neta</p>
                <p className="font-mono text-sm sm:text-lg font-semibold mt-1 truncate text-[#FAFAF8]">
                  {m ? `${fmtPct(m.rentabilidadNeta ?? 0)}` : `${fmtPct(freeYieldBruto)}`}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-[10px] p-2.5 border border-white/[0.08] text-center overflow-hidden">
                <p className="font-body text-[8px] sm:text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide truncate">Retorno 10a</p>
                <p className="font-mono text-sm sm:text-lg font-semibold mt-1 truncate text-[#FAFAF8]">
                  {fixedExit10 ? `${fixedExit10.multiplicadorCapital}x` : "—"}
                </p>
              </div>
            </div>

            {/* "Siendo franco:" box */}
            {(() => {
              const vd = results?.veredicto || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");
              const sfColor = vd === "COMPRAR" ? "#B0BEC5" : vd === "BUSCAR OTRA" ? "#C8323C" : "#FBBF24";
              return (
                <div className={`mt-3.5 ${currentAccess === "guest" ? "filter blur-[6px] pointer-events-none" : ""}`} style={{ borderLeft: `3px solid ${sfColor}`, background: `${sfColor}08`, borderRadius: "0 8px 8px 0", padding: "12px 16px" }}>
                  <p className="font-body text-[13px] font-semibold" style={{ color: sfColor }}>Siendo franco:</p>
                  <p className="font-body text-[12px] mt-1" style={{ color: "#888888" }}>{siendoFrancoText}</p>
                </div>
              );
            })()}

            {/* Debug: metro distance (temporary) */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inp = inputData as any;
              const dLat = inp?.lat || inp?.zonaRadio?.lat;
              const dLng = inp?.lng || inp?.zonaRadio?.lng;
              if (!dLat || !dLng) return <p className="mt-2 font-mono text-[9px] text-white/20">Debug: sin coordenadas en input_data (keys: {inp ? Object.keys(inp).filter(k => k.includes("lat") || k.includes("lng") || k.includes("zona") || k.includes("geo")).join(",") : "null"})</p>;
              const nearest = findNearestStation(dLat, dLng, "active");
              return (
                <p className="mt-2 font-mono text-[9px] text-white/20">
                  Debug: depto=({Number(dLat).toFixed(4)},{Number(dLng).toFixed(4)}) | Metro: {nearest ? `${nearest.station.name} (${nearest.station.line}) a ${nearest.distance.toFixed(0)}m — estación=({nearest.station.lat},{nearest.station.lng})` : "ninguno"}
                </p>
              );
            })()}
          </div>
        </div>

        {/* Dimension bars */}
        {results && (
          <div className={`flex flex-col gap-2.5 mt-4 pt-4 border-t border-white/[0.08] ${currentAccess === "guest" ? "filter blur-[6px] pointer-events-none" : ""}`}>
            {radarData.map((d) => {
              const val = Math.round(d.value);
              const fillColor = val < 40 ? "#C8323C" : val < 70 ? "#FBBF24" : "rgba(176,190,197,0.8)";
              const numColor = val < 40 ? "text-[#C8323C]" : val < 70 ? "text-[#FBBF24]" : "text-[#B0BEC5]";
              return (
                <div key={d.dimension} className="flex items-center gap-3">
                  <span className="font-body text-[11px] text-[#FAFAF8]/50 w-[75px] shrink-0">{d.dimension}</span>
                  <div className="relative flex-1 h-1.5 rounded-full overflow-hidden flex">
                    <div className="w-[40%] bg-[#C8323C]/15" />
                    <div className="w-[30%] bg-white/[0.06]" />
                    <div className="w-[30%] bg-[#B0BEC5]/15" />
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${val}%`, backgroundColor: fillColor }} />
                  </div>
                  <span className={`font-mono text-[11px] font-medium w-[28px] text-right shrink-0 ${numColor}`}>{val}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Scroll prompt */}
        <button
          type="button"
          onClick={() => document.getElementById("bloque-detalle")?.scrollIntoView({ behavior: "smooth" })}
          className="block mx-auto mt-4 font-body text-[11px] text-[#FAFAF8]/60 cursor-pointer hover:text-[#FAFAF8] transition-colors"
        >
          Profundizar en el análisis ↓
        </button>

        {/* Guest CTA — does not reveal score */}
        {currentAccess === "guest" && (
          <div className="mt-6 p-6 bg-[#151515] rounded-xl border border-white/[0.08] text-center md:text-left md:flex md:items-center md:gap-4">
            <div className="flex-1">
              <h3 className="font-heading font-bold text-lg text-[#FAFAF8]">
                {isSharedLink
                  ? (creatorName ? `${creatorName} te compartió este análisis` : "Te compartieron este análisis")
                  : "Tu Franco Score está listo. ¿Quieres verlo?"}
              </h3>
              <p className="font-body text-sm text-[#FAFAF8]/50 mt-1">
                {isSharedLink
                  ? "Regístrate para ver el análisis completo."
                  : "Regístrate gratis para ver tu score, 8 métricas, riesgos y más."}
              </p>
            </div>
            <a href="/register" className="mt-4 md:mt-0 inline-block">
              <button type="button" className="bg-[#FAFAF8] text-[#0F0F0F] font-body text-sm font-semibold px-6 py-2.5 rounded-lg">Regístrate gratis</button>
            </a>
          </div>
        )}
      </div>
      {/* end Block 1 */}

      {/* ═══════ BLOCK 2 — DETAIL (REGISTERED FREE) ═══════ */}
      {results && m && (
        <>
          {/* Separator */}
          <div id="bloque-detalle" className="flex items-center gap-3 mb-4 mt-2">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono text-[9px] text-[#FAFAF8]/50 uppercase tracking-[0.1em]">DETALLE DEL ANÁLISIS</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* ─── GUEST LAYOUT: visible sections → CTA → grouped locked block ─── */}
          {currentAccess === "guest" ? (
            <>
              {/* Section 1: Bolsillo — VISIBLE */}
              <CollapsibleSection
                title={flujoUnificado >= 0 ? "¿Cuánto te genera cada mes?" : "¿Cuánto sale de tu bolsillo cada mes?"}
                subtitle="Desglose real: arriendo vs todos los costos"
                defaultOpen
              >
                {flujoBreakdown && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Arriendo</p>
                      <p className="font-mono text-lg font-semibold text-[#FAFAF8] mt-1">{fmt(flujoBreakdown.arriendo)}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Dividendo</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Gastos</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.totalEgresos - flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className={`bg-[#151515] rounded-[10px] p-3 text-center border-2 ${flujoBreakdown.flujoNeto >= 0 ? "border-[#B0BEC5]" : "border-[#C8323C]"}`}>
                      <p className={`font-body text-[9px] uppercase tracking-wide font-semibold ${flujoBreakdown.flujoNeto >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>Flujo neto</p>
                      <p className={`font-mono text-lg font-semibold mt-1 ${flujoBreakdown.flujoNeto >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>
                        {flujoBreakdown.flujoNeto >= 0 ? "+" : ""}{fmt(flujoBreakdown.flujoNeto)}
                      </p>
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 3: Zone — VISIBLE (moved up for guest) */}
              <CollapsibleSection
                title="¿Cómo se compara con la zona?"
                subtitle={`Precio y arriendo vs el promedio de ${comuna}`}
                defaultOpen
              >
                <ZoneComparisonCards m={m} zoneData={zoneData} comuna={comuna} currency={currency} fmt={fmt} mapQuery={mapQuery} googleMapUrl={googleMapUrl} inputData={inputData} />
              </CollapsibleSection>

              {/* CTA de registro */}
              <div className="rounded-xl border-2 border-[#C8323C]/30 bg-[#C8323C]/[0.03] text-center py-8 px-5 mb-5 mt-2">
                <h3 className="font-heading font-bold text-lg text-[#FAFAF8]">
                  {isSharedLink ? "Regístrate para ver el análisis completo" : "Regístrate gratis para ver tu Franco Score y el análisis completo"}
                </h3>
                <p className="font-body text-[13px] text-[#FAFAF8]/50 mt-1.5 mb-4">
                  {isSharedLink
                    ? "Te compartieron un análisis de inversión. Crea tu cuenta gratis para ver el Score, rentabilidad, riesgos y más."
                    : "Crea tu cuenta en 10 segundos. Sin tarjeta."}
                </p>
                <a href="/register">
                  <button type="button" className="bg-[#C8323C] text-white font-body text-[13px] font-bold px-6 py-2.5 rounded-lg shadow-[0_2px_10px_rgba(200,50,60,0.15)]">Crear cuenta gratis →</button>
                </a>
                <p className="font-body text-xs text-[#FAFAF8]/50 mt-3">
                  <a href="/login" className="hover:underline">Ya tengo cuenta →</a>
                </p>
              </div>

              {/* Grouped locked sections block */}
              <div className="relative rounded-xl border border-white/[0.08] bg-[#1A1A1A] p-6 mb-5 overflow-hidden">
                {/* Decorative blur behind */}
                <div className="absolute inset-0 top-[140px] filter blur-[8px] opacity-20 pointer-events-none overflow-hidden px-5">
                  <div className="h-4 bg-white/[0.08] rounded mb-2 w-3/4" />
                  <div className="h-4 bg-white/[0.08] rounded mb-2 w-1/2" />
                  <div className="h-4 bg-white/[0.08] rounded mb-2 w-2/3" />
                  <div className="h-4 bg-white/[0.08] rounded mb-2 w-3/5" />
                  <div className="h-4 bg-white/[0.08] rounded mb-2 w-1/2" />
                  <div className="h-4 bg-white/[0.08] rounded w-2/3" />
                </div>

                <div className="relative z-10 text-center">
                  <Lock className="h-6 w-6 text-[#FAFAF8]/50 mx-auto mb-3" />
                  <h3 className="font-heading font-bold text-lg text-[#FAFAF8] mb-4">Regístrate gratis para ver:</h3>

                  <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mb-6">
                    {[
                      "Rentabilidad detallada",
                      "Análisis de riesgos",
                      "Sensibilidad (3 escenarios)",
                      "Tu Franco Score completo",
                    ].map((feat) => (
                      <div key={feat} className="flex items-center gap-1.5 justify-center">
                        <Check className="w-3.5 h-3.5 text-[#B0BEC5] shrink-0" />
                        <span className="font-body text-sm text-[#FAFAF8]/70">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {isSharedLink && creatorName && (
                    <p className="font-body text-xs text-[#FAFAF8]/50 mb-4">Este análisis fue creado por {creatorName}</p>
                  )}

                  <a href="/register">
                    <button type="button" className="bg-[#FAFAF8] text-[#0F0F0F] font-body text-[13px] font-bold px-6 py-2.5 rounded-lg">Crear cuenta gratis →</button>
                  </a>
                  <p className="font-body text-xs text-[#FAFAF8]/50 mt-3">
                    <a href="/login" className="hover:underline">Ya tengo cuenta →</a>
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* ─── LOGGED IN LAYOUT: original order ─── */
            <>
              {/* Section 1: Flujo desglose */}
              <CollapsibleSection
                title={flujoUnificado >= 0 ? "¿Cuánto te genera cada mes?" : "¿Cuánto sale de tu bolsillo cada mes?"}
                subtitle="Desglose real: arriendo vs todos los costos"
                helpText={flujoUnificado === 0 ? "El arriendo cubre exactamente todos los gastos. Break-even." : flujoUnificado > 0 ? "El arriendo cubre todos los gastos y te genera excedente. Acá está el desglose completo." : "El arriendo no cubre todos los gastos. Acá está el desglose completo — lo que tu corredor nunca te muestra."}
                defaultOpen
              >
                {flujoBreakdown && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Arriendo</p>
                      <p className="font-mono text-lg font-semibold text-[#FAFAF8] mt-1">{fmt(flujoBreakdown.arriendo)}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Dividendo</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-[10px] p-3 text-center border border-white/[0.08]">
                      <p className="font-body text-[9px] text-[#FAFAF8]/40 uppercase tracking-wide">Gastos</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.totalEgresos - flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className={`bg-[#151515] rounded-[10px] p-3 text-center border-2 ${flujoBreakdown.flujoNeto >= 0 ? "border-[#B0BEC5]" : "border-[#C8323C]"}`}>
                      <p className={`font-body text-[9px] uppercase tracking-wide font-semibold ${flujoBreakdown.flujoNeto >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>Flujo neto</p>
                      <p className={`font-mono text-lg font-semibold mt-1 ${flujoBreakdown.flujoNeto >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>
                        {flujoBreakdown.flujoNeto >= 0 ? "+" : ""}{fmt(flujoBreakdown.flujoNeto)}
                      </p>
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 2: Rentabilidad */}
              <CollapsibleSection
                title="¿Qué tan buena es la rentabilidad?"
                subtitle="Tu corredor solo te muestra la primera"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-[2px]">
                  {[
                    { label: "Bruta", value: `${fmtPct(m.rentabilidadBruta ?? 0)}`, hint: "Sin descontar nada", color: "#FAFAF8", tip: "Arriendo × 12 / Precio. No descuenta ningún gasto." },
                    { label: "CAP Rate", value: `${fmtPct(m.capRate ?? 0)}`, hint: "Operativa", color: (m.capRate ?? 0) >= 4 ? "#B0BEC5" : (m.capRate ?? 0) >= 2 ? "#FAFAF8" : "#C8323C", tip: "Descuenta GGCC, contribuciones y mantención. Similar a la rentabilidad neta pero sin descontar vacancia. Es la métrica estándar internacional para comparar propiedades entre sí, sin importar el financiamiento." },
                    { label: "Neta", value: `${fmtPct(m.rentabilidadNeta ?? 0)}`, hint: "La que importa", color: (m.rentabilidadNeta ?? 0) >= 3 ? "#B0BEC5" : (m.rentabilidadNeta ?? 0) >= 1 ? "#FAFAF8" : "#C8323C", tip: "Descuenta TODO: gastos operativos + vacancia + corretaje + recambio. No incluye el dividendo hipotecario. Mide qué tan buena es la propiedad en sí, independiente de cómo la financies. Un depto puede tener buena rentabilidad neta y flujo negativo si el financiamiento es alto." },
                    { label: "Cash-on-Cash", value: `${fmtPct(m.cashOnCash ?? 0)}`, hint: "Retorno tu pie", color: (m.cashOnCash ?? 0) >= 0 ? "#B0BEC5" : "#C8323C", tip: "Cuánto te renta el pie que pusiste. Negativo = poniendo plata extra." },
                    { label: "TIR 10a", value: fixedExit10 ? `${fmtPct(fixedExit10.tir)}` : "—", hint: "Tasa interna", color: fixedExit10 && fixedExit10.tir >= 0 ? "#B0BEC5" : "#C8323C", tip: "Tasa Interna de Retorno considerando plusvalía y amortización." },
                    { label: "ROI 10a", value: fixedExit10 ? `${fixedExit10.multiplicadorCapital}x` : "—", hint: "Multiplicador", color: fixedExit10 && fixedExit10.multiplicadorCapital >= 1 ? "#B0BEC5" : "#C8323C", tip: "Cuántas veces multiplicas tu inversión total en 10 años." },
                  ].map((metric, i) => (
                    <div
                      key={metric.label}
                      className="bg-[#1A1A1A] px-4 py-3.5 flex flex-col gap-1"
                      style={{
                        borderRadius: i === 0 ? '8px 0 0 0' : i === 2 ? '0 8px 0 0' : i === 3 ? '0 0 0 8px' : i === 5 ? '0 0 8px 0' : '0',
                      }}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40 flex items-center gap-1">
                        {metric.label}
                        <InfoTooltip content={metric.tip} />
                      </span>
                      <span className="font-mono font-semibold text-lg" style={{ color: metric.color }}>{metric.value}</span>
                      <span className="text-[10px] text-[#FAFAF8]/20">{metric.hint}</span>
                    </div>
                  ))}
                </div>
                {/* Insight contextual */}
                <div
                  className="mt-3.5 rounded-r-lg py-3 px-4 text-[13px] leading-relaxed"
                  style={{
                    borderLeft: `3px solid ${(m.rentabilidadNeta ?? 0) >= 3 ? '#B0BEC5' : '#C8323C'}`,
                    background: (m.rentabilidadNeta ?? 0) >= 3 ? 'rgba(176,190,197,0.04)' : 'rgba(200,50,60,0.04)',
                    color: 'rgba(250,250,248,0.6)',
                  }}
                >
                  <span style={{ color: (m.rentabilidadNeta ?? 0) >= 3 ? '#B0BEC5' : '#C8323C', fontWeight: 600 }}>Siendo franco:</span>{' '}
                  {(() => {
                    const neta = m.rentabilidadNeta ?? 0;
                    const flujo = m.flujoNetoMensual ?? 0;
                    if (neta >= 3 && flujo >= 0) return `Rentabilidad neta de ${fmtPct(neta)} con flujo positivo — los números cierran.`;
                    if (neta >= 3 && flujo < 0) return `Rentabilidad neta de ${fmtPct(neta)} pero flujo negativo de ${fmtCLP(Math.abs(flujo))}/mes. La propiedad rinde bien, el costo lo pone el financiamiento.`;
                    if (neta < 3 && flujo >= 0) return `Rentabilidad neta baja (${fmtPct(neta)}), pero al menos el flujo es positivo.`;
                    return `La bruta engaña — con ${fmtPct(neta)} neta y flujo de -${fmtCLP(Math.abs(flujo))}/mes, la inversión depende 100% de la plusvalía.`;
                  })()
                  }
                </div>
              </CollapsibleSection>

              {/* Section 2b: Plusvalía inmediata + Precios de equilibrio */}
              {m && ((m.plusvaliaInmediataFranco ?? 0) !== 0 || (m.plusvaliaInmediataUsuario ?? 0) !== 0 || (m.precioFlujoNeutroUF ?? 0) > 0) && (
                <CollapsibleSection
                  title="¿A qué precio conviene?"
                  subtitle="Plusvalía inmediata y precios de equilibrio"
                >
                  {/* Plusvalía inmediata — dual: Franco + Usuario */}
                  {(() => {
                    const francoUF = m.valorMercadoFrancoUF ?? 0;
                    const usuarioUF = m.valorMercadoUsuarioUF ?? 0;
                    const francoSame = Math.abs(francoUF - usuarioUF) / (francoUF || 1) < 0.02;
                    const showFranco = francoUF > 0 && Math.abs(m.plusvaliaInmediataFrancoPct ?? 0) > 2;
                    const showUsuario = usuarioUF > 0 && Math.abs(m.plusvaliaInmediataUsuarioPct ?? 0) > 2 && !francoSame;
                    if (!showFranco && !showUsuario) return null;

                    const renderLine = (label: string, clp: number, pct: number, extra?: string) => {
                      const positive = clp > 0;
                      return (
                        <div
                          className="rounded-r-lg py-2.5 px-4 text-[13px] leading-relaxed"
                          style={{ borderLeft: `3px solid ${positive ? '#B0BEC5' : '#C8323C'}`, background: positive ? 'rgba(176,190,197,0.04)' : 'rgba(200,50,60,0.04)', color: 'rgba(250,250,248,0.6)' }}
                        >
                          <span style={{ color: positive ? '#B0BEC5' : '#C8323C', fontWeight: 600 }}>{positive ? 'Ventaja de compra' : 'Sobreprecio'}{label ? ` (${label})` : ''}:</span>{' '}
                          {positive
                            ? <>compraste {fmtUF(Math.abs(clp / UF_CLP))} bajo mercado ({fmtPct(Math.abs(pct))}).{m.flujoNetoMensual < 0 && <> Equivale a {Math.round(Math.abs(clp / m.flujoNetoMensual))} meses de flujo negativo recuperados al vender.</>}{m.flujoNetoMensual === 0 && <> Flujo neutro — la plusvalía es ganancia pura.</>}</>
                            : <>pagaste {fmtUF(Math.abs(clp / UF_CLP))} sobre mercado ({fmtPct(Math.abs(pct))}). Necesitas ~{Math.ceil(Math.abs(pct) / 4)} años extra de plusvalía para recuperar.</>
                          }
                          {extra && <span className="block text-[11px] text-[#FAFAF8]/30 mt-1">{extra}</span>}
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-2 mb-3">
                        {showFranco && renderLine(
                          showUsuario ? "datos Franco" : "",
                          m.plusvaliaInmediataFranco ?? 0,
                          m.plusvaliaInmediataFrancoPct ?? 0,
                          showUsuario ? `Valor mercado Franco: ${fmtUF(francoUF)} — usado para proyecciones.` : undefined
                        )}
                        {showUsuario && renderLine(
                          "tu estimación",
                          m.plusvaliaInmediataUsuario ?? 0,
                          m.plusvaliaInmediataUsuarioPct ?? 0,
                          `Tu estimación: ${fmtUF(usuarioUF)}.${!francoSame ? " Los cálculos usan el valor de Franco para las proyecciones." : ""}`
                        )}
                      </div>
                    );
                  })()}

                  {/* Precios de equilibrio */}
                  {m.flujoNetoMensual >= 0 ? (
                    <div className="rounded-r-lg py-3 px-4 text-[13px] leading-relaxed" style={{ borderLeft: '3px solid #B0BEC5', background: 'rgba(176,190,197,0.04)', color: 'rgba(250,250,248,0.6)' }}>
                      <span style={{ color: '#B0BEC5', fontWeight: 600 }}>Flujo positivo.</span> Buen precio para este financiamiento.
                    </div>
                  ) : (m.precioFlujoNeutroUF ?? 0) > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-[2px]">
                        <div className="bg-[#1A1A1A] rounded-l-lg px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40">Flujo neutro</p>
                          <p className="font-mono font-semibold text-lg text-[#FBBF24]">{fmtUF(m.precioFlujoNeutroUF ?? 0)}</p>
                          <p className="text-[10px] text-[#FAFAF8]/20">{fmtPct(m.descuentoParaNeutro ?? 0)} menos</p>
                        </div>
                        <div className="bg-[#1A1A1A] rounded-r-lg px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40">Flujo +$50K</p>
                          <p className="font-mono font-semibold text-lg text-[#B0BEC5]">{fmtUF(m.precioFlujoPositivoUF ?? 0)}</p>
                          <p className="text-[10px] text-[#FAFAF8]/20">{m.precioCLP > 0 && m.precioFlujoPositivoCLP ? fmtPct(((m.precioCLP - (m.precioFlujoPositivoCLP ?? 0)) / m.precioCLP) * 100) : "—"} menos</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#FAFAF8]/30">
                        Precios máximos de compra para lograr cada nivel de flujo con tu financiamiento actual.
                        {(m.descuentoParaNeutro ?? 0) > 15 && " El margen de negociación necesario es alto — considera más pie, menor tasa, o buscar otra propiedad."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-r-lg py-3 px-4 text-[13px] leading-relaxed" style={{ borderLeft: '3px solid #C8323C', background: 'rgba(200,50,60,0.04)', color: 'rgba(250,250,248,0.6)' }}>
                      <span style={{ color: '#C8323C', fontWeight: 600 }}>Sin precio de equilibrio.</span>{' '}
                      El arriendo no alcanza a cubrir los gastos fijos (sin dividendo). Considera más pie, menor tasa, o buscar otra propiedad.
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* Section 3: Zone comparison */}
              <CollapsibleSection
                title="¿Cómo se compara con la zona?"
                subtitle={`Precio y arriendo vs el promedio de ${comuna}`}
              >
                <ZoneComparisonCards m={m} zoneData={zoneData} comuna={comuna} currency={currency} fmt={fmt} mapQuery={mapQuery} googleMapUrl={googleMapUrl} inputData={inputData} />
              </CollapsibleSection>

              {/* Section 4: Risks */}
              <CollapsibleSection
                title="¿Cuáles son los riesgos?"
                subtitle="Qué puede salir mal y cuánto te afecta"
              >
                <div className="space-y-3">
                  {(() => {
                    // Build structured risks sorted by severity and impact
                    const risks = ([
                      {
                        id: "flujo_negativo",
                        titulo: `Flujo negativo: ${fmt(Math.abs(flujoUnificado))}/mes`,
                        detalle: "Cada mes tendrás que poner esta plata de tu bolsillo para cubrir los costos. Asegúrate de tener este flujo disponible de forma estable.",
                        severity: "critical" as const,
                        show: flujoUnificado < 0,
                      },
                      {
                        id: "cash_on_cash",
                        titulo: `Cash-on-cash negativo: ${fmtPct(m.cashOnCash ?? 0)}`,
                        detalle: flujoUnificado >= 0 ? "Cash-on-cash negativo por alta inversión inicial, pero el flujo mensual es positivo." : "El arriendo no alcanza a cubrir los costos. La inversión depende 100% de la plusvalía futura.",
                        severity: "critical" as const,
                        show: (m.cashOnCash ?? 0) < 0,
                      },
                      {
                        id: "precio_maximo",
                        titulo: `Precio máximo: ${currency === "UF" ? fmtUF(results.valorMaximoCompra) : fmtCLP(results.valorMaximoCompra * UF_CLP)}`,
                        detalle: "Para flujo positivo con estos datos, no deberías pagar más de este precio.",
                        severity: "critical" as const,
                        show: true,
                      },
                      {
                        id: "cap_rate_bajo",
                        titulo: `CAP rate bajo: ${fmtPct(m.capRate ?? 0)}`,
                        detalle: "Podrías ajustar el precio de compra o buscar una propiedad más rentable en la zona.",
                        severity: "critical" as const,
                        show: (m.capRate ?? 0) < 4.0,
                      },
                      {
                        id: "ggcc_altos",
                        titulo: `Gastos comunes altos (${inputData ? Math.round((inputData.gastos / inputData.arriendo) * 100) : 0}% del arriendo)`,
                        detalle: "Aunque los paga el arrendatario, GGCC altos dificultan arrendar y aumentan tu costo durante vacancia.",
                        severity: "warning" as const,
                        show: !!inputData && inputData.arriendo > 0 && (inputData.gastos / inputData.arriendo) > 0.25,
                      },
                      {
                        id: "breakeven_tasa",
                        titulo: `Break-even tasa: ${results.breakEvenTasa === -1 ? "N/A" : `${fmtPct(results.breakEvenTasa, 2)}`}`,
                        detalle: results.breakEvenTasa === -1
                          ? "Incluso con tasa 0%, el flujo sería negativo. El problema es estructural."
                          : inputData && results.breakEvenTasa < inputData.tasaInteres
                            ? `Necesitarías una tasa de ${fmtPct(results.breakEvenTasa, 2)} para flujo positivo, bajo la actual (${fmtPct(inputData.tasaInteres, 2)}).`
                            : `Si la tasa sube sobre ${fmtPct(results.breakEvenTasa, 2)}, pasas a flujo negativo.`,
                        severity: "warning" as const,
                        show: true,
                      },
                    ]).filter(r => r.show);

                    // Also include contras that aren't covered by structured risks
                    const structuredPhrases = ["flujo negativo", "cash-on-cash", "cash on cash", "pie está rentando", "de tu bolsillo", "precio máximo", "precio por m²", "cap rate", "gastos comunes", "break-even", "breakeven"];
                    const extraContras = (results.contras || []).filter(c => {
                      const lower = c.toLowerCase();
                      return !structuredPhrases.some(p => lower.includes(p));
                    });

                    return (
                      <>
                        {risks.map((risk) => {
                          const color = risk.severity === "critical" ? "#C8323C" : "#FBBF24";
                          return (
                            <div key={risk.id} style={{ borderLeft: `3px solid ${color}`, background: `${color}08`, borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                              <div className="font-body text-sm font-semibold" style={{ color }}>{risk.titulo}</div>
                              <div className="font-body text-[13px] text-[#FAFAF8]/50 leading-relaxed mt-1">{risk.detalle}</div>
                            </div>
                          );
                        })}
                        {extraContras.map((contra, i) => (
                          <div key={`extra-${i}`} style={{ borderLeft: "3px solid #FBBF24", background: "#FBBF2408", borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                            <div className="font-body text-[13px] text-[#FAFAF8]/50 leading-relaxed">{contra}</div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </CollapsibleSection>

              {/* Section 5: Sensitivity */}
              <CollapsibleSection
                title="¿Qué pasa si cambian las condiciones?"
                subtitle="3 escenarios: pesimista, base y optimista"
              >
                {sensScenarios && inputData && (
                  <>
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-[#FAFAF8]">Horizonte de venta</h4>
                        <span className="font-mono text-sm font-semibold text-[#FAFAF8]">{sensHorizon} años</span>
                      </div>
                      <input type="range" min={3} max={20} step={1} value={sensHorizon} onChange={(e) => setSensHorizon(Number(e.target.value))} className="w-full accent-[#71717A] h-2" />
                      <div className="flex justify-between text-[10px] text-[#FAFAF8]/50 mt-0.5"><span>3 años</span><span>20 años</span></div>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                      {sensScenarios.map((s) => {
                        const scColor = s.key === "pesimista" ? "#C8323C" : s.key === "optimista" ? "#B0BEC5" : "#333333";
                        const scBg = s.key === "base" ? "#0F0F0F" : `${scColor}15`;
                        const scBorder = s.key === "base" ? "#33333366" : `${scColor}35`;
                        const scText = s.key === "pesimista" ? "#C8323C" : s.key === "optimista" ? "#B0BEC5" : "#999999";
                        return (
                        <div key={s.key} className="rounded-lg" style={{ border: `1px solid ${scBorder}`, background: scBg, padding: "12px 16px" }}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-base" style={{ color: scText }}>{s.icon}</span>
                            <div className="text-sm font-medium" style={{ color: scText }}>{s.sub}</div>
                          </div>
                          <div className="mb-2">
                            <div className="text-[10px] text-[#FAFAF8]/40">Flujo mensual (año 1)</div>
                            <div className={`font-mono text-lg font-semibold ${s.flujoMensual >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>
                              {fmt(s.flujoMensual)}<span className="text-xs font-normal text-[#FAFAF8]/50">/mes</span>
                            </div>
                          </div>
                          <div className="mb-3">
                            <div className="text-[10px] text-[#FAFAF8]/40">Retorno ({sensHorizon} años)</div>
                            <div className={`font-mono text-base font-semibold ${s.retorno >= 1 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>{s.retorno}x</div>
                          </div>
                          <div className="border-t border-dashed border-white/[0.06] pt-2 text-[11px] leading-relaxed text-[#FAFAF8]/40">
                            <div>Tasa {fmtPct(s.scenTasa, 2)} · Arr. {fmtM(s.scenArriendo)}</div>
                            <div>Vac. {s.scenVacancia}% · Plusv. {s.plusvalia}%/año</div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CollapsibleSection>
            </>
          )}

          {/* Paywall CTA between Block 2 and Block 3 */}
          {currentAccess === "free" && analysisId && (
            <div className="text-center py-8 mt-4 border-t border-white/[0.08] mb-5">
              <h3 className="font-heading font-bold text-lg text-[#FAFAF8]">¿Quieres el análisis completo?</h3>
              <p className="font-body text-[13px] text-[#FAFAF8]/50 mt-1 mb-4 max-w-[400px] mx-auto">Proyecciones a 20 años, flujo dinámico, escenarios de salida y análisis IA personalizado.</p>
              <BottomPaywallCTA analysisId={analysisId} />
            </div>
          )}

          {/* ═══════ BLOCK 3 — INFORME PRO (AI + PROJECTIONS) ═══════ */}
          <AIAnalysisSection
            aiAnalysis={aiAnalysis}
            aiLoading={aiLoading}
            aiError={aiError}
            loadAiAnalysis={loadAiAnalysis}
            score={score}
            ct={ct}
            ci={ci}
            currentAccess={currentAccess}
            analysisId={analysisId}
            aiAnalysisInitiallyLoaded={!!(aiAnalysisInitial && typeof aiAnalysisInitial === "object" && "veredicto" in aiAnalysisInitial)}
            isSharedView={isSharedView}
            projectionsExpanded={projectionsExpanded}
            onExpandProjections={() => setProjectionsExpanded(true)}
            projectionsCTALabel={`Patrimonio en ${horizonYears} años`}
            projectionsCTAValue={dynamicProjections.length > 0 ? fmt(dynamicProjections[Math.min(horizonYears - 1, dynamicProjections.length - 1)].patrimonioNeto) : undefined}
            projectionsContent={(chartPhase, isFirstReveal) => (<>
          {/* Patrimonio projection */}
          <div id="premium-chart-anchor-1" />
          {(!isFirstReveal || chartPhase >= 1) && (
          <div id="premium-chart-1" style={isFirstReveal && chartPhase === 1 ? { animation: "slideUp 600ms ease-out forwards" } : undefined}>
          <CollapsibleSection
            title={`¿Cuánto ganas si vendes en ${horizonYears} años?`}
            subtitle="Proyección de patrimonio con plusvalía y amortización"
            locked={currentAccess !== "premium"}
            analysisId={analysisId}
            defaultOpen={isFirstReveal && chartPhase <= 4}
          >
            {/* Patrimonio chart + breakdown */}
            {projData.length > 0 && (
              <>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#FAFAF8]">Proyección de Patrimonio — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}</h4>
                    {horizonBeforeDelivery && (
                      <span className="rounded-full bg-[#C8323C]/10 px-2 py-0.5 text-[10px] font-medium text-[#C8323C]">
                        Período pre-entrega: tu patrimonio crece con los pagos del pie
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-[#FAFAF8]/50">De dónde viene tu patrimonio. Plusvalía {fmtPct(plusvaliaRate)}/año y arriendos +{fmtPct(arriendoGrowth)}/año.</p>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ComposedChart data={projData} margin={{ top: 5, right: 10, left: currency === "UF" ? 20 : 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal vertical={false} />
                        <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: projData.length > 25 ? 7 : projData.length > 15 ? 8 : 10, fill: "rgba(250,250,248,0.5)" }} angle={-45} textAnchor="end" dy={10} interval={projData.length > 15 ? Math.ceil(projData.length / 10) : isMonthlyView ? "preserveStartEnd" : 0} height={60} />
                        <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                        <YAxis tick={{ fontSize: 10, fill: "rgba(250,250,248,0.5)" }} tickFormatter={fmtAxis} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as PatrimonioRow | undefined;
                            if (!row) return null;
                            const pre = row.isPreEntrega;
                            return (
                              <div className="rounded-lg border border-white/[0.15] bg-[#1E1E1E] px-3 py-3 text-xs text-[#FAFAF8] shadow-lg">
                                <div className="mb-1.5 font-semibold text-[#FAFAF8]">{row.name}{pre ? " (pre-entrega)" : ""}</div>
                                {pre ? (
                                  <>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.15 }} />Pie acumulado: <span className="font-medium" style={{ color: "#FAFAF8" }}>{fmt(row.piePagado)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.25 }} />Plusvalía estimada: <span className="font-medium" style={{ color: "#FAFAF8" }}>{fmt(row.plusvalia)}</span></div>
                                    <div style={{ color: "rgba(250,250,248,0.5)" }}>Deuda: <span style={{ color: "rgba(250,250,248,0.5)" }}>$0 (crédito aún no comienza)</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.3 }} />Valor propiedad: <span className="font-medium" style={{ color: "#FAFAF8" }}>{fmt(row.valorPropiedad)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#C8323C" }} />Deuda restante: <span className="font-medium" style={{ color: "#C8323C" }}>-{fmt(row.saldoCredito ?? 0)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.15 }} />Pie + amortización: <span className="font-medium" style={{ color: "#FAFAF8" }}>{fmt(row.piePagado + row.capitalAmortizado)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.25 }} />Plusvalía acumulada: <span className="font-medium" style={{ color: "#FAFAF8" }}>{fmt(row.plusvalia)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "rgba(250,250,248,0.5)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.30)", border: "1px solid rgba(200,50,60,0.5)" }} />Flujo de bolsillo: <span className="font-medium" style={{ color: "#C8323C" }}>{fmt(row.flujoAcumulado)}</span></div>
                                  </>
                                )}
                                <div className="mt-1 border-t border-white/[0.06] pt-1 font-semibold" style={{ color: "#FAFAF8" }}>Patrimonio neto: {fmt(row.patrimonioNeto)}</div>
                              </div>
                            );
                          }}
                        />
                        <Area xAxisId="cat" type="monotone" dataKey="valorPropArea" fill="#FAFAF8" fillOpacity={0.06} stroke="#FAFAF8" strokeWidth={2} />
                        <Area xAxisId="cat" type="monotone" dataKey="saldoCredito" fill="#C8323C" fillOpacity={0.06} stroke="none" />
                        <Bar xAxisId="cat" dataKey="piePagado" stackId="patrimonio" fill="#FAFAF8" fillOpacity={0.15} name="Pie pagado" radius={[0, 0, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="capitalAmortizado" stackId="patrimonio" fill="#FAFAF8" fillOpacity={0.4} name="Capital amortizado" radius={[0, 0, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="plusvalia" stackId="patrimonio" fill="#FAFAF8" fillOpacity={0.25} name="Plusvalía" radius={[4, 4, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="flujoAcumulado" stackId="patrimonio" fill="rgba(200,50,60,0.25)" stroke="rgba(200,50,60,0.45)" strokeWidth={1} name="Flujo de bolsillo" radius={[0, 0, 0, 0]} />
                        <Line xAxisId="cat" type="monotone" dataKey="saldoCredito" stroke="#C8323C" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Deuda restante" />
                        <Line xAxisId="cat" type="monotone" dataKey="patrimonioNeto" stroke="#FAFAF8" strokeWidth={2.5} dot={{ r: 4, fill: "#FAFAF8", stroke: "#0F0F0F", strokeWidth: 2 }} name="Patrimonio neto" />
                        {mesesPreEntregaTop > 0 && (
                          <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="rgba(250,250,248,0.3)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "rgba(250,250,248,0.5)" }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#FAFAF8]/60">
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(250,250,248,0.15)" }} />Pie pagado</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(250,250,248,0.30)" }} />Capital amortizado</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(250,250,248,0.08)", border: "1px solid rgba(250,250,248,0.20)" }} />Plusvalía</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.30)", border: "1px solid rgba(200,50,60,0.5)" }} />Flujo de bolsillo</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#FAFAF8", opacity: 0.2 }} />Valor propiedad</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#C8323C", opacity: 0.7 }} />Deuda</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "#FAFAF8", height: 3 }} />Patrimonio neto</span>
                  </div>
                  {isTouchDevice && <p className="mt-4 text-center text-[10px] text-[#FAFAF8]/50">Toca las barras para ver el detalle</p>}
                  {/* Desglose de patrimonio — reads from projData (same source as chart) */}
                  {(() => {
                    const lastRow = projData.find(r => r._x === horizonYears * 12);
                    if (!lastRow || !m || !inputData) return null;
                    // All values from projData so table matches chart exactly
                    const plusvaliaGanancia = lastRow.plusvalia;
                    const capitalAmortizado = lastRow.capitalAmortizado;
                    const flujoAcum = lastRow.flujoAcumulado;
                    const patrimonioTotal = lastRow.piePagado + lastRow.capitalAmortizado + lastRow.plusvalia; // = valorProp - saldo
                    const gananciaReal = lastRow.patrimonioNeto; // already = valorProp - saldo - gastosCierre + flujo - pie
                    return (
                      <>
                      {/* Bloque 1: Desglose de patrimonio */}
                      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                        <div className="space-y-0 divide-y divide-border/30 sm:hidden">
                          {[
                            { label: "Tu inversión inicial (pie)", value: fmt(m.pieCLP), color: "text-[#FAFAF8]" },
                            { label: `Ganancia por plusvalía (${fmtUF(inputData.precio)} → ${fmtUF(lastRow.valorPropiedad / UF_CLP)})`, value: fmt(plusvaliaGanancia), color: "text-[#B0BEC5]" },
                            { label: "Capital amortizado", value: fmt(capitalAmortizado), color: "text-[#B0BEC5]" },
                            { label: "Patrimonio neto total", value: fmt(patrimonioTotal), color: "text-[#FAFAF8]", bold: true },
                          ].map(({ label, value, color, bold }) => (
                            <div key={label} className={`px-3 py-2 ${bold ? "bg-white/[0.05]" : ""}`}>
                              <div className="text-[11px] text-[#FAFAF8]/60">{label}</div>
                              <div className={`text-sm font-medium ${color || ""} ${bold ? "font-bold" : ""}`}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <table className="hidden w-full text-sm sm:table">
                          <tbody>
                            <tr className="border-b border-white/[0.04]">
                              <td className="py-2 px-4 text-[#FAFAF8]/70">Tu inversión inicial (pie)</td>
                              <td className="py-2 px-4 text-right font-medium text-[#FAFAF8]">{fmt(m.pieCLP)}</td>
                            </tr>
                            <tr className="border-b border-white/[0.04]">
                              <td className="py-2 px-4 text-[#FAFAF8]/70">Ganancia por plusvalía ({fmtUF(inputData.precio)} → {fmtUF(lastRow.valorPropiedad / UF_CLP)})</td>
                              <td className="py-2 px-4 text-right font-medium text-[#B0BEC5]">{fmt(plusvaliaGanancia)}</td>
                            </tr>
                            <tr className="border-b border-white/[0.04]">
                              <td className="py-2 px-4 text-[#FAFAF8]/70">Capital amortizado (pagado del crédito)</td>
                              <td className="py-2 px-4 text-right font-medium text-[#B0BEC5]">{fmt(capitalAmortizado)}</td>
                            </tr>
                            <tr className="border-t border-white/[0.06]">
                              <td className="py-2 px-4 font-semibold text-[#FAFAF8]">Patrimonio neto total</td>
                              <td className="py-2 px-4 text-right font-bold text-[#FAFAF8]">{fmt(patrimonioTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="px-3 pb-2 text-[10px] text-[#FAFAF8]/50 sm:px-4">= valor propiedad − deuda restante</p>
                      </div>

                      {/* Bloque 2: Lo que pusiste de tu bolsillo */}
                      <div className="mt-3 rounded-lg" style={{ border: "1px solid rgba(200,50,60,0.2)", background: "rgba(200,50,60,0.04)" }}>
                        <div className="px-3 py-2.5 sm:px-4">
                          <div className="mb-1 font-mono text-xs font-medium uppercase" style={{ color: "#C8323C" }}>Lo que pusiste de tu bolsillo</div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#FAFAF8]/60">Flujo acumulado ({horizonYears === 1 ? "1 año" : `${horizonYears} años`})</span>
                            <span className="font-mono font-medium" style={{ color: "#C8323C" }}>{fmt(flujoAcum)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bloque 3: Ganancia real */}
                      <div className="mt-3 rounded-lg" style={{ border: "1px solid rgba(250,250,248,0.1)", background: "rgba(250,250,248,0.03)" }}>
                        <div className="px-3 py-3 sm:px-4">
                          <p className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Si vendieras en {horizonYears === 1 ? "1 año" : `${horizonYears} años`}, tu ganancia real sería:</p>
                          <p className="mt-0.5 font-mono text-xs" style={{ color: "rgba(250,250,248,0.3)" }}>patrimonio − pie + flujo − gastos cierre</p>
                          <div className={`mt-2 font-mono text-[22px] font-semibold ${gananciaReal >= 0 ? "" : ""}`} style={{ color: gananciaReal >= 0 ? "#FAFAF8" : "#C8323C" }}>{fmt(gananciaReal)}</div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </CollapsibleSection>
          </div>
          )}

          {/* Cashflow year by year */}
          <div id="premium-chart-anchor-2" />
          {(!isFirstReveal || chartPhase >= 2) && (
          <div id="premium-chart-2" style={isFirstReveal && chartPhase === 2 ? { animation: "slideUp 600ms ease-out forwards" } : undefined}>
          <CollapsibleSection
            title="¿Cómo es el flujo año a año?"
            subtitle={`Flujo de caja desde el año 1 hasta el ${horizonYears}`}
            locked={currentAccess !== "premium"}
            defaultOpen={isFirstReveal && chartPhase <= 4}
            analysisId={analysisId}
          >
            <div>
                  <h4 className="mb-1 text-sm font-semibold text-[#FAFAF8]">
                    Flujo de Caja — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}
                  </h4>
                  <p className="mb-3 text-xs text-[#FAFAF8]/50">Cuánto entra y cuánto sale. La línea muestra tu acumulado.</p>
                  <div className="relative h-64">
                    <ResponsiveContainer>
                      <ComposedChart data={cashflowData} stackOffset="sign" margin={{ top: 5, right: 10, left: currency === "UF" ? 20 : 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal vertical={false} />
                        {/* Eje categórico visible: barras uniformes */}
                        <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: cashflowData.length > 25 ? 7 : cashflowData.length > 15 ? 8 : 10, fill: "rgba(250,250,248,0.5)" }} angle={-45} textAnchor="end" dy={10} interval={cashflowData.length > 15 ? Math.ceil(cashflowData.length / 10) : isMonthlyView && horizonYears > 1 ? "preserveStartEnd" : 0} height={60} />
                        {/* Eje numérico oculto: posiciona la línea de entrega */}
                        <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                        <YAxis tick={{ fontSize: 10, fill: "rgba(250,250,248,0.5)" }} tickFormatter={fmtAxis} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as CashflowRow | undefined;
                            if (!row) return null;
                            return (
                              <div className="rounded-lg border border-white/[0.15] bg-[#1E1E1E] px-3 py-3 text-xs text-[#FAFAF8] shadow-lg">
                                <div className="mb-1.5 font-semibold text-[#FAFAF8]">{row.name}</div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(176,190,197,0.7)" }} />Ingreso: <span className="font-medium text-[#FAFAF8]">{fmt(row.Ingreso)}</span></div>
                                {egresoBarSeries.map(s => (
                                  <div key={s.key} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}: <span className="font-medium text-[#C8323C]">{fmt(row[s.key] as number)}</span></div>
                                ))}
                                <div className="my-1 border-t border-white/[0.06]" />
                                <div className={`font-bold ${row.FlujoNeto >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}`}>Flujo neto: {fmt(row.FlujoNeto)}</div>
                                <div className="font-bold text-[#FAFAF8]">Acumulado: {fmt(row.Acumulado)}</div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine y={0} stroke="rgba(250,250,248,0.3)" strokeDasharray="6 3" strokeWidth={1} />
                        {/* Ingreso siempre primero */}
                        <Bar xAxisId="cat" dataKey="Ingreso" stackId="stack" fill="#B0BEC5" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                        {/* Egresos ordenados por impacto promedio descendente */}
                        {egresoBarSeries.map((s, i) => (
                          <Bar key={s.key} xAxisId="cat" dataKey={s.key as string} name={s.label} stackId="stack" fill={s.color} radius={i === egresoBarSeries.length - 1 ? [0, 0, 4, 4] : undefined} />
                        ))}
                        {/* Línea acumulado */}
                        <Line xAxisId="cat" type="monotone" dataKey="Acumulado" stroke="#FAFAF8" strokeWidth={2} dot={isMonthlyView ? { r: 2 } : false} legendType="none" />
                        {/* Línea vertical de entrega */}
                        {mesesPreEntregaTop > 0 && !horizonBeforeDelivery && (
                          <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="rgba(250,250,248,0.3)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "rgba(250,250,248,0.5)" }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {horizonBeforeDelivery && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#151515]/80 backdrop-blur-[1px]">
                        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-[#151515]/95 px-6 py-5 text-center shadow-lg">
                          <Clock className="h-7 w-7 text-[#FAFAF8]" />
                          <span className="text-sm font-semibold text-[#FAFAF8]">Tu inversión aún no genera flujo</span>
                          <p className="text-xs text-[#FAFAF8]/50">
                            La entrega está estimada para {fechaEntregaLabel}. Hasta entonces no hay ingresos ni gastos operativos.
                            Aumenta el horizonte a más de {mesesPreEntregaTop} meses para ver el flujo post-entrega.
                          </p>
                          <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="text-xs font-medium text-[#FAFAF8] hover:underline">
                            Ver desde la entrega →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Leyenda manual */}
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[#FAFAF8]/60" style={{ display: 'block', width: '100%', marginBottom: '8px' }}>
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(176,190,197,0.7)" }} />Ingreso</span>
                      {egresoBarSeries.map(s => (
                        <span key={s.key} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                      ))}
                      <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "#FAFAF8", height: 2 }} />Acumulado</span>
                    </div>
                  </div>
                  {isTouchDevice && <div style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '24px', clear: 'both', fontSize: '12px', color: 'rgba(250,250,248,0.4)' }}>Toca las barras para ver el detalle</div>}
            </div>
          </CollapsibleSection>
          </div>
          )}

          {/* Waterfall chart */}
          <div id="premium-chart-anchor-3" />
          {(!isFirstReveal || chartPhase >= 3) && (
          <div id="premium-chart-3" style={isFirstReveal && chartPhase === 3 ? { animation: "slideUp 600ms ease-out forwards" } : undefined}>
          <CollapsibleSection
            title="¿Cuáles son todos los costos?"
            subtitle="Cascada de costos mensuales — cada peso que entra y sale"
            locked={currentAccess !== "premium"}
            defaultOpen={isFirstReveal && chartPhase <= 4}
            analysisId={analysisId}
          >
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(250,250,248,0.5)" }} angle={-45} textAnchor="end" dy={10} interval={0} height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(250,250,248,0.5)" }} tickFormatter={fmtAxis} />
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload, label: wfLabel }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = waterfallData.find((d) => d.name === wfLabel);
                      if (!item) return null;
                      const fullNames: Record<string, string> = { "Arr.": "Arriendo", "Div.": "Dividendo", "GGCC": "Gastos comunes (vacancia)", "Cont.": "Contribuciones", "Mant.": "Mantención", "Vac.": "Vacancia", "Corr.": "Corretaje", "Rec.": "Recambio arrendatario", "Admin.": "Administración de arriendo", "Neto": "Flujo Neto" };
                      const displayName = fullNames[item.name] || item.name;
                      return (
                        <div className="rounded-lg border border-white/[0.15] bg-[#1E1E1E] px-3 py-3 text-xs text-[#FAFAF8] shadow-lg">
                          <div className="mb-1 font-semibold text-[#FAFAF8]">{item.isResult ? `→ ${displayName}` : displayName}</div>
                          <div className={item.delta >= 0 ? "text-[#B0BEC5]" : "text-[#C8323C]"}>
                            {item.delta >= 0 ? "+" : ""}{fmt(item.delta)}
                          </div>
                          <div className="text-[#FAFAF8]/60">Acumulado: {fmt(item.running)}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(250,250,248,0.3)" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="range" radius={[4, 4, 0, 0]} activeBar={false}>
                    {waterfallData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.fill}
                        stroke={entry.isResult ? entry.fill : "none"}
                        strokeWidth={entry.isResult ? 3 : 0}
                        fillOpacity={entry.isResult ? 1 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#FAFAF8]/60">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(250,250,248,0.6)" }} />Ingreso</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.8)" }} />Egreso</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(250,250,248,0.5)" }} />Resultado</span>
            </div>
            {isTouchDevice && <p className="mt-4 text-center text-[10px] text-[#FAFAF8]/50">Toca las barras para ver el detalle</p>}
            {m && (
              <div className={`mt-3 flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-mono font-semibold ${flujoUnificado >= 0 ? "bg-[#B0BEC5]/10 text-[#B0BEC5]" : "bg-[#C8323C]/10 text-[#C8323C]"}`}>
                Flujo neto mensual: {flujoUnificado >= 0 ? "+" : ""}{fmt(flujoUnificado)}
              </div>
            )}
          </CollapsibleSection>
          </div>
          )}

          {/* Exit scenarios */}
          <div id="premium-chart-anchor-4" />
          {(!isFirstReveal || chartPhase >= 4) && (
          <div id="premium-chart-4" style={isFirstReveal && chartPhase === 4 ? { animation: "slideUp 600ms ease-out forwards" } : undefined}>
          <CollapsibleSection
            title="¿Qué pasa si vendes o refinancias?"
            subtitle="Escenarios de salida: venta y refinanciamiento"
            locked={currentAccess !== "premium"}
            analysisId={analysisId}
            defaultOpen={isFirstReveal && chartPhase <= 4}
          >
            {horizonBeforeDelivery ? (
              <div>
                <div className="flex items-center gap-3 rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/5 p-4">
                  <Clock className="h-5 w-5 shrink-0 text-[#C8323C]" />
                  <div>
                    <p className="text-sm font-medium text-[#FAFAF8]">No puedes vender ni refinanciar antes de la entrega</p>
                    <p className="mt-1 text-xs text-[#FAFAF8]/50">
                      La entrega está estimada para {fechaEntregaLabel}. Aumenta el horizonte para ver escenarios de salida.
                    </p>
                    <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="mt-2 text-xs font-medium text-[#FAFAF8] hover:underline">
                      Ver desde la entrega →
                    </button>
                  </div>
                </div>
              </div>
            ) : projData.length > 0 && m ? (
              (() => {
                const lastPoint = projData.find(r => r._x === horizonYears * 12);
                if (!lastPoint || !inputData) return null;
                const vp = lastPoint.valorPropiedad;
                const sc = lastPoint.saldoCredito ?? 0;
                const fa = lastPoint.flujoAcumulado;
                const comision = Math.round(vp * 0.02);
                const recibeNeto = vp - sc - comision;
                const totalInvertido = m.pieCLP + Math.abs(fa);
                const ganancia = recibeNeto - totalInvertido;
                const multiplicador = m.pieCLP > 0 ? Math.round((recibeNeto / m.pieCLP) * 100) / 100 : 0;
                // TIR: build yearly cash flows from projData
                const tirFlujos = [-m.pieCLP];
                for (let y = 1; y <= horizonYears; y++) {
                  const moEnd = y * 12;
                  const moStart = (y - 1) * 12;
                  const rowEnd = projData.find(r => r._x === moEnd);
                  const rowStart = projData.find(r => r._x === moStart);
                  const flujoAnual = (rowEnd?.flujoAcumulado ?? 0) - (rowStart?.flujoAcumulado ?? 0);
                  if (y === horizonYears) {
                    const vpY = rowEnd?.valorPropiedad ?? 0;
                    const scY = rowEnd?.saldoCredito ?? 0;
                    tirFlujos.push(flujoAnual + vpY - scY - Math.round(vpY * 0.02));
                  } else {
                    tirFlujos.push(flujoAnual);
                  }
                }
                const tir = calcTIR(tirFlujos);
                // Abbreviated format for narrative
                const fmtAbr = (n: number) => fmtM(Math.abs(n));
                // Refi calculations from projData
                const refiNuevoCredito = Math.round(vp * (refiPct / 100));
                const refiCapitalLiberado = refiNuevoCredito - sc;
                const refiTasaMensual = inputData.tasaInteres / 100 / 12;
                const refiN = 20 * 12; // 20-year new term
                const refiNuevoDividendo = refiTasaMensual === 0 ? Math.round(refiNuevoCredito / refiN) : Math.round((refiNuevoCredito * refiTasaMensual) / (1 - Math.pow(1 + refiTasaMensual, -refiN)));
                // Projected arriendo/gastos at horizon year
                const arriendoProyectado = Math.round(inputData.arriendo * Math.pow(1 + arriendoGrowth / 100, horizonYears));
                const gastosProyectados = Math.round((inputData.gastos ?? 0) * Math.pow(1 + costGrowth / 100, horizonYears));
                const contribProyectadas = Math.round(inputData.contribuciones * Math.pow(1 + costGrowth / 100, horizonYears));
                const antiguedadFutura = inputData.antiguedad + horizonYears;
                const mantProyectada = inputData.provisionMantencion || Math.round(((inputData.precio * UF_CLP) * getMantencionRate(antiguedadFutura)) / 12);
                const refiFlujoDsg = calcFlujoDesglose({
                  arriendo: arriendoProyectado,
                  dividendo: refiNuevoDividendo,
                  ggcc: gastosProyectados,
                  contribuciones: contribProyectadas,
                  mantencion: mantProyectada,
                  vacanciaMeses: inputData.vacanciaMeses ?? 1,
                  usaAdministrador: inputData.usaAdministrador,
                  comisionAdministrador: inputData.comisionAdministrador,
                });
                const refiNuevoFlujoNeto = refiFlujoDsg.flujoNeto;
                const nDeptos = Math.floor(refiCapitalLiberado / m.pieCLP);

                return (
              <div>
                <div className="mb-4 flex gap-2">
                  <button type="button" onClick={() => setExitMode("venta")} className={`flex-1 px-6 py-2.5 font-body text-sm font-semibold rounded-lg transition-colors ${exitMode === "venta" ? "bg-[#FAFAF8] text-[#0F0F0F]" : "bg-transparent border border-white/[0.08] text-[#FAFAF8]/50 hover:text-[#FAFAF8] hover:border-white/[0.16]"}`}>Venta</button>
                  <button type="button" onClick={() => setExitMode("refinanciamiento")} className={`flex-1 px-6 py-2.5 font-body text-sm font-semibold rounded-lg transition-colors ${exitMode === "refinanciamiento" ? "bg-[#FAFAF8] text-[#0F0F0F]" : "bg-transparent border border-white/[0.08] text-[#FAFAF8]/50 hover:text-[#FAFAF8] hover:border-white/[0.16]"}`}>Refinanciamiento</button>
                </div>

                {exitMode === "venta" ? (
                  <div className="space-y-4 text-sm text-[#FAFAF8]">
                    {/* Intro */}
                    <p className="rounded-lg bg-white/[0.03] p-3 text-xs text-[#FAFAF8]/60">
                      Si vendieras {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`} al valor proyectado (plusvalía {fmtPct(plusvaliaRate)}/año), ¿cuánto ganarías?
                    </p>

                    {/* Lo que pusiste */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Lo que pusiste</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Pie inicial</span>
                        <span className="font-mono text-sm text-[#FAFAF8]">{fmt(m.pieCLP)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Flujo de bolsillo ({horizonYears === 1 ? "1 año" : `${horizonYears} años`})</span>
                        <span className="font-mono text-sm" style={{ color: "#C8323C" }}>{fmt(Math.abs(fa))}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.1)" }}>
                        <span className="text-[13px] font-semibold text-[#FAFAF8]">Total invertido</span>
                        <span className="font-mono text-[15px] font-bold text-[#FAFAF8]">{fmt(totalInvertido)}</span>
                      </div>
                    </div>

                    {/* Lo que recuperas */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Lo que recuperas</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Valor de venta estimado</span>
                        <span className="font-mono text-sm text-[#FAFAF8]">{fmt(vp)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Saldo crédito restante</span>
                        <span className="font-mono text-sm" style={{ color: "rgba(250,250,248,0.5)" }}>{sc > 0 ? `-${fmt(sc)}` : fmt(0)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Comisión venta (2%)</span>
                        <span className="font-mono text-sm" style={{ color: "rgba(250,250,248,0.5)" }}>-{fmt(comision)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.1)" }}>
                        <span className="text-[13px] font-semibold text-[#FAFAF8]">Recibes neto</span>
                        <span className="font-mono text-[15px] font-bold text-[#FAFAF8]">{fmt(recibeNeto)}</span>
                      </div>
                    </div>

                    {/* Resultado */}
                    <div className="rounded-[10px] p-5" style={{ background: "rgba(250,250,248,0.03)", border: "1px solid rgba(250,250,248,0.1)" }}>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Resultado</div>
                      <div className="flex items-center justify-between sm:flex-row flex-col gap-4">
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.4)" }}>Tu ganancia</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: ganancia >= 0 ? "#FAFAF8" : "#C8323C" }}>{fmt(ganancia)}</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.4)" }}>Multiplicador</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: multiplicador >= 1 ? "#FAFAF8" : "#C8323C" }}>{multiplicador}x</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.4)" }}>TIR</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: tir >= 0 ? "#FAFAF8" : "#C8323C" }}>{fmtPct(tir)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Narrativa Franco */}
                    <div style={{ borderLeft: "2px solid #C8323C", background: "rgba(200,50,60,0.04)", borderRadius: "0 8px 8px 0", padding: "12px 16px" }}>
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(250,250,248,0.6)" }}>
                        Pusiste <span className="font-medium text-[#FAFAF8]">{fmtAbr(m.pieCLP)}</span> de pie y <span className="font-medium text-[#FAFAF8]">{fmtAbr(fa)}</span> de flujo durante {horizonYears} años.
                        {" "}Al vender, recibes <span className="font-medium text-[#FAFAF8]">{fmtAbr(recibeNeto)}</span> netos.
                        {" "}Tu ganancia real es <span className="font-medium text-[#FAFAF8]">{fmtAbr(ganancia)}</span> — tu inversión inicial se multiplicó <span className="font-medium text-[#FAFAF8]">{multiplicador}x</span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-[#FAFAF8]">
                    {/* Intro */}
                    <p className="rounded-lg bg-white/[0.03] p-3 text-xs text-[#FAFAF8]/60">
                      Si en vez de vender refinancias {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`} con el nuevo valor de mercado, ¿cuánto capital puedes liberar para otra inversión?
                    </p>

                    {/* Selector % refi */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "rgba(250,250,248,0.4)" }}>% refinanciamiento:</span>
                      <div className="flex gap-1.5">
                        {[60, 70, 80, 90].map((pct) => (
                          <button key={pct} type="button" onClick={() => setRefiPct(pct)}
                            className="rounded px-3 py-1.5 text-xs font-medium transition-colors"
                            style={refiPct === pct
                              ? { border: "1px solid #FAFAF8", color: "#FAFAF8", fontWeight: 500 }
                              : { border: "1px solid rgba(250,250,248,0.1)", color: "rgba(250,250,248,0.4)" }}
                          >{pct}%</button>
                        ))}
                      </div>
                    </div>

                    {/* Tu depto hoy */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Tu depto hoy</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Nuevo avalúo (valor proyectado)</span>
                        <span className="font-mono text-sm text-[#FAFAF8]">{fmt(vp)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Deuda actual</span>
                        <span className="font-mono text-sm text-[#FAFAF8]">{fmt(sc)}</span>
                      </div>
                    </div>

                    {/* Nuevo crédito */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Nuevo crédito</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Nuevo crédito ({refiPct}% del avalúo)</span>
                        <span className="font-mono text-sm text-[#FAFAF8]">{fmt(refiNuevoCredito)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.06)" }}>
                        <span className="text-[13px]" style={{ color: "rgba(250,250,248,0.5)" }}>Pago deuda anterior</span>
                        <span className="font-mono text-sm" style={{ color: "rgba(250,250,248,0.5)" }}>{sc > 0 ? `-${fmt(sc)}` : fmt(0)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(250,250,248,0.1)" }}>
                        <span className="text-[13px] font-semibold text-[#FAFAF8]">Capital liberado</span>
                        <span className="font-mono text-[15px] font-bold text-[#FAFAF8]">{fmt(refiCapitalLiberado)}</span>
                      </div>
                    </div>

                    {/* Impacto en tu flujo */}
                    <div className="rounded-[10px] p-5" style={{ background: "rgba(250,250,248,0.03)", border: "1px solid rgba(250,250,248,0.1)" }}>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,250,248,0.3)", letterSpacing: "0.08em" }}>Impacto en tu flujo</div>
                      <div className="flex items-center justify-between sm:flex-row flex-col gap-4">
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.4)" }}>Nuevo dividendo</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: "#C8323C" }}>{fmt(refiNuevoDividendo)}</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "rgba(250,250,248,0.1)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "rgba(250,250,248,0.4)" }}>Nuevo flujo neto</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: "#C8323C" }}>{fmt(refiNuevoFlujoNeto)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Narrativa Franco */}
                    <div style={{ borderLeft: "2px solid #C8323C", background: "rgba(200,50,60,0.04)", borderRadius: "0 8px 8px 0", padding: "12px 16px" }}>
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(250,250,248,0.6)" }}>
                        Sin vender tu depto, puedes liberar <span className="font-medium text-[#FAFAF8]">{fmtAbr(refiCapitalLiberado)}</span> en efectivo refinanciando al {refiPct}%.
                        {" "}{nDeptos >= 2
                          ? <>Ese capital alcanza como pie para <span className="font-medium text-[#FAFAF8]">{nDeptos} departamentos</span> similares.</>
                          : <>Ese capital equivale a <span className="font-medium text-[#FAFAF8]">{(Math.round(refiCapitalLiberado / m.pieCLP * 10) / 10)}x</span> tu pie original.</>
                        }
                        {" "}Tu nuevo dividendo sube a <span className="font-medium text-[#FAFAF8]">{fmt(refiNuevoDividendo)}</span>/mes y el flujo neto queda en <span className="font-medium text-[#FAFAF8]">{fmt(refiNuevoFlujoNeto)}</span>/mes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
                );
              })()
            ) : null}
          </CollapsibleSection>
          </div>
          )}

            </>)}
          />

          {/* ===== Bottom CTAs ===== */}
          {currentAccess === "guest" && (
            <div className="mb-8 p-8 bg-[#151515] rounded-2xl border border-white/[0.08] text-center">
              <Lock className="h-8 w-8 text-[#FAFAF8] mx-auto mb-3" />
              <h3 className="font-heading text-xl font-bold text-[#FAFAF8]">Regístrate para ver el análisis completo</h3>
              <p className="max-w-md mx-auto font-body text-sm text-[#FAFAF8]/50 mt-2">
                Accede gratis a 8 métricas, sensibilidad, puntos críticos, comparación con zona y más.
              </p>
              <a href="/register" className="mt-4 inline-block">
                <Button size="lg" className="gap-2 bg-[#FAFAF8] text-[#0F0F0F] hover:bg-[#FAFAF8]/90">Regístrate gratis</Button>
              </a>
            </div>
          )}
        </>
      )}

    </>
  );

  // Panel fields (scrollable) and button (fixed footer) — shared between desktop sidebar and mobile drawer
  const hasPanelContent = !hidePanel && !isSharedView && currentAccess !== "guest" && !!inputData;

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

  const panelFields = hasPanelContent ? (
    <div className="space-y-2">
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40">Cuánto cuesta</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Precio (UF)</label>
              <input type="number" value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-20 rounded border border-white/[0.08] bg-[#1A1A1A] px-2 py-0.5 text-right text-[11px] font-mono text-[#FAFAF8]" />
            </div>
            <input type="range" min={500} max={10000} step={50} value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Pie</label>
              <span className="text-[11px] font-medium text-[#FAFAF8]/70">{adjPiePct}%</span>
            </div>
            <input type="range" min={10} max={50} step={5} value={adjPiePct} onChange={(e) => setAdjPiePct(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40">Financiamiento</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Plazo</label>
              <span className="text-[11px] font-medium text-[#FAFAF8]/70">{adjPlazo} años</span>
            </div>
            <input type="range" min={10} max={30} step={1} value={adjPlazo} onChange={(e) => setAdjPlazo(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Tasa (%)</label>
              <input type="number" step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-16 rounded border border-white/[0.08] bg-[#1A1A1A] px-2 py-0.5 text-right text-[11px] font-mono text-[#FAFAF8]" />
            </div>
            <input type="range" min={1} max={8} step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#FAFAF8]/40">Cuánto genera</h4>
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Arriendo</label>
              <input type="number" value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-24 rounded border border-white/[0.08] bg-[#1A1A1A] px-2 py-0.5 text-right text-[11px] font-mono text-[#FAFAF8]" />
            </div>
            <input type="range" min={100000} max={2000000} step={10000} value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">GGCC</label>
              <input type="number" value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-24 rounded border border-white/[0.08] bg-[#1A1A1A] px-2 py-0.5 text-right text-[11px] font-mono text-[#FAFAF8]" />
            </div>
            <input type="range" min={0} max={300000} step={5000} value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Contrib. /trim</label>
              <input type="number" value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-24 rounded border border-white/[0.08] bg-[#1A1A1A] px-2 py-0.5 text-right text-[11px] font-mono text-[#FAFAF8]" />
            </div>
            <input type="range" min={0} max={500000} step={10000} value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Vacancia</label>
              <span className="text-[11px] font-medium text-[#FAFAF8]/70">{adjVacanciaPct}%</span>
            </div>
            <input type="range" min={0} max={25} step={1} value={adjVacanciaPct} onChange={(e) => setAdjVacanciaPct(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
            <p className="text-[10px] text-[#FAFAF8]/50 leading-tight">{`≈ ${(adjVacanciaPct * 12 / 100).toFixed(1)} meses/año`}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Administración</label>
              <span className="text-[11px] font-medium text-[#FAFAF8]/70">{adjAdminPct}%</span>
            </div>
            <input type="range" min={0} max={15} step={1} value={adjAdminPct} onChange={(e) => setAdjAdminPct(Number(e.target.value))} className="w-full accent-[#71717A] h-1.5" />
            <p className="text-[10px] text-[#FAFAF8]/50 leading-tight">{adjAdminPct > 0 ? `${fmtCLP(Math.round(adjArriendo * adjAdminPct / 100))}/mes` : "Sin administrador"}</p>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const panelButton = hasPanelContent ? (
    <div>
      <Button onClick={handleRecalculate} disabled={recalcLoading} size="sm" className="w-full gap-2 bg-[#FAFAF8] text-[#0F0F0F] hover:bg-[#FAFAF8]/90">
        {recalcLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {recalcLoading ? "Recalculando..." : "Recalcular"}
      </Button>
      {recalcSuccess && <p className="mt-1 text-center text-xs text-[#B0BEC5]">Actualizado</p>}
    </div>
  ) : null;

  const projectionFields = hasPanelContent ? (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Horizonte</label>
          <span className="font-mono text-sm font-semibold text-[#FAFAF8]">{horizonYears} año{horizonYears > 1 ? "s" : ""}</span>
        </div>
        <input type="range" min={1} max={20} value={horizonYears} onChange={(e) => setHorizonYears(Number(e.target.value))} className="mt-1 w-full accent-[#71717A] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[#FAFAF8]/40">{isMonthlyView ? "Vista mensual" : "Vista anual"}</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Plusvalía anual</label>
          <span className="font-mono text-sm font-semibold text-[#FAFAF8]">{fmtPct(plusvaliaRate)}</span>
        </div>
        <input type="range" min={0} max={8} step={0.5} value={plusvaliaRate} onChange={(e) => setPlusvaliaRate(Number(e.target.value))} className="mt-1 w-full accent-[#71717A] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[#FAFAF8]/40">Promedio histórico: 3-5% anual</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Crecimiento arriendo</label>
          <span className="font-mono text-sm font-semibold text-[#FAFAF8]">{fmtPct(arriendoGrowth)}/año</span>
        </div>
        <input type="range" min={0} max={6} step={0.5} value={arriendoGrowth} onChange={(e) => setArriendoGrowth(Number(e.target.value))} className="mt-1 w-full accent-[#71717A] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[#FAFAF8]/40">Promedio histórico: 3-4% anual</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[#FAFAF8]/70">Crecimiento gastos</label>
          <span className="font-mono text-sm font-semibold text-[#FAFAF8]">{fmtPct(costGrowth)}/año</span>
        </div>
        <input type="range" min={0} max={6} step={0.5} value={costGrowth} onChange={(e) => setCostGrowth(Number(e.target.value))} className="mt-1 w-full accent-[#71717A] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[#FAFAF8]/40">Aplica a GGCC, contribuciones y mantención</p>
      </div>
    </div>
  ) : null;

  return (
    <div className={hasPanelContent ? "lg:grid lg:grid-cols-[1fr_260px] lg:gap-6" : ""}>
      {/* Main content — all zones */}
      <div className="min-w-0">
        {mainContent}
      </div>

      {/* Sidebar column — both panels stacked */}
      {hasPanelContent && (
        <aside className="hidden lg:block">
          {/* Panel 1: Normal position, stays at top */}
          <div
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#151515] shadow-sm"
            style={{ maxHeight: "calc(100vh - 2rem)" }}
          >
            <div className="shrink-0 px-3 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#FAFAF8]" />
                <h3 className="font-body text-xs font-semibold text-[#FAFAF8]">Ajusta los números</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2">
              {panelFields}
            </div>
            <div className="shrink-0 border-t border-white/[0.08] px-3 py-2">
              {panelButton}
            </div>
          </div>

          {/* Panel 2: sticky, only visible when projections expanded */}
          {projectionsExpanded && (
            <div
              className="sticky top-20 mt-8 flex flex-col rounded-2xl border border-white/[0.08] bg-[#151515] shadow-sm animate-fadeIn"
              style={{ maxHeight: "calc(100vh - 2rem)" }}
            >
              <div className="shrink-0 px-3 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#FAFAF8]" />
                  <h3 className="font-body text-xs font-semibold text-[#FAFAF8]">Proyecciones</h3>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2">
                {projectionFields}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Mobile FAB + drawer */}
      {hasPanelContent && (
        <>
          {!drawerOpen && fabState !== 'hidden' && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-[#1E1E1E] border border-white/[0.10] text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] px-4 py-3 lg:hidden transition-opacity duration-200"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-body text-[13px] font-medium">{fabState === 'projections' ? 'Proyecciones' : 'Ajusta los números'}</span>
            </button>
          )}

          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-2xl bg-[#1A1A1A] shadow-2xl" style={{ maxHeight: "80vh" }}>
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#FAFAF8]/20" />
                <div className="shrink-0 px-5 pt-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-[#FAFAF8]" />
                      <h3 className="font-body text-base font-medium text-[#FAFAF8]">
                        {fabState === 'projections' ? 'Proyecciones' : 'Ajusta los números'}
                      </h3>
                    </div>
                    <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full p-1 hover:bg-white/[0.08]">
                      <X className="h-5 w-5 text-[#FAFAF8]/50" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-2">
                  {fabState === 'projections' ? projectionFields : panelFields}
                </div>
                {fabState !== 'projections' && (
                  <div className="shrink-0 border-t border-white/[0.08] px-5 py-3">
                    {panelButton}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

