"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import {
  BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  MapPin,
  SlidersHorizontal, RefreshCw, Loader2, Clock,
  X,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { calcFlujoDesglose, getMantencionRate } from "@/lib/analysis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { findNearestStation } from "@/lib/metro-stations";
import type { MarketDataRow } from "@/lib/market-data";
import { StateBox } from "@/components/ui/StateBox";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";


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

// Parse simple markdown bold (**text**) inside AI content, preserving paragraph breaks.
function renderAiContent(texto: string): React.ReactNode {
  if (!texto) return null;
  return texto.split(/\n\n+/).map((parrafo, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {parrafo.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </p>
  ));
}

// Detects the new v2 AI structure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAiV2(ai: any): ai is import("@/lib/types").AIAnalysisV2 {
  return !!ai
    && typeof ai === "object"
    && typeof ai.siendoFrancoHeadline_clp === "string"
    && !!ai.conviene
    && typeof ai.conviene.respuestaDirecta_clp === "string";
}

function CollapsibleSection({ title, subtitle, helpText, defaultOpen = false, children }: {
  title: string;
  subtitle?: string;
  helpText?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-4 px-5 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-body text-[15px] font-semibold text-[var(--franco-text)]">{title}</span>
          </div>
          {subtitle && <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        <span className={`font-body text-lg text-[var(--franco-text-secondary)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}>↓</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {helpText && (
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-snug p-2.5 px-3.5 bg-[var(--franco-card)] rounded-lg mb-3.5">{helpText}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MetricRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-[var(--franco-border)]">
      <span className="font-body text-[13px] text-[var(--franco-text)] flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className={`font-mono text-sm font-medium ${color || "text-[var(--franco-text)]"}`}>{value}</span>
    </div>
  );
}

// ─── AI Analysis Section (v2) ────────────────────────
const VERDICT_STYLES: Record<string, { color: string; bg: string; border: string; bgInner: string; borderInner: string }> = {
  COMPRAR: {
    color: "var(--franco-positive)",
    bg: "rgba(176, 190, 197, 0.08)",
    border: "rgba(176, 190, 197, 0.30)",
    bgInner: "rgba(176, 190, 197, 0.18)",
    borderInner: "rgba(176, 190, 197, 0.40)",
  },
  "BUSCAR OTRA": {
    color: "#C8323C",
    bg: "rgba(200, 50, 60, 0.06)",
    border: "rgba(200, 50, 60, 0.25)",
    bgInner: "rgba(200, 50, 60, 0.12)",
    borderInner: "rgba(200, 50, 60, 0.30)",
  },
  "AJUSTA EL PRECIO": {
    color: "var(--franco-warning)",
    bg: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.25)",
    bgInner: "rgba(251, 191, 36, 0.15)",
    borderInner: "rgba(251, 191, 36, 0.30)",
  },
};

function getVerdictStyles(veredicto: string) {
  return VERDICT_STYLES[veredicto] || VERDICT_STYLES["AJUSTA EL PRECIO"];
}

// Parse UF string ("UF 4.664" / "UF 3,200") → numeric value in UF
function parseUFString(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.match(/[\d.,]+/);
  if (!m) return 0;
  const clean = m[0].replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

// Build the 3 DatoCards for the Hero using real motor data.
// Keeps the IA-generated subtexts as fallback, but values come from the engine
// so they stay consistent with MiniCards and drawers.
function buildHeroDatosClave(
  aiData: import("@/lib/types").AIAnalysisV2,
  results: import("@/lib/types").FullAnalysisResult | null | undefined,
  currency: "CLP" | "UF",
  valorUF: number
): import("@/lib/types").DatoClave[] {
  const iaDatos = aiData.conviene?.datosClave || [];

  // 1) Aporte / flujo mensual — from motor (ensures consistency)
  const flujo = results?.metrics?.flujoNetoMensual ?? 0;
  const flujoAbs = Math.abs(flujo);
  const flujoFmtCLP = (flujo < 0 ? "-$" : "+$") + Math.round(flujoAbs).toLocaleString("es-CL");
  const flujoFmtUF = (flujo < 0 ? "-UF " : "+UF ") + (
    flujoAbs / (valorUF || 1) >= 100
      ? Math.round(flujoAbs / (valorUF || 1)).toLocaleString("es-CL")
      : (Math.round((flujoAbs / (valorUF || 1)) * 100) / 100).toFixed(2).replace(".", ",")
  );
  const flujoColor: import("@/lib/types").DatoClave["color"] = flujo < 0 ? "red" : "green";
  const aporteCard: import("@/lib/types").DatoClave = {
    label: flujo < 0 ? "Aporte mensual" : "Te sobra mensual",
    valor_clp: flujoFmtCLP,
    valor_uf: flujoFmtUF,
    subtexto: flujo < 0 ? "Sale de tu bolsillo" : "Queda a tu favor",
    color: flujoColor,
  };

  // 2) Precio sugerido — directly from IA (not a motor number)
  const precioSugeridoRaw = aiData.negociacion?.precioSugerido || "";
  const precioSugeridoUF = parseUFString(precioSugeridoRaw);
  const precioSugeridoCLP = precioSugeridoUF * (valorUF || 0);
  const precioCard: import("@/lib/types").DatoClave = {
    label: "Precio sugerido",
    valor_uf: precioSugeridoUF > 0 ? `UF ${Math.round(precioSugeridoUF).toLocaleString("es-CL")}` : "—",
    valor_clp: precioSugeridoCLP > 0 ? "$" + Math.round(precioSugeridoCLP).toLocaleString("es-CL") : "—",
    subtexto: "Para cerrar bien",
    color: "accent",
  };

  // 3) Retorno 10 años — TIR from motor
  const tir = results?.exitScenario?.tir;
  let retornoValorCLP = "—";
  let retornoValorUF = "—";
  let retornoColor: import("@/lib/types").DatoClave["color"] = "neutral";
  let retornoSub = "A 10 años";
  if (typeof tir === "number" && !isNaN(tir)) {
    const tirFmt = "TIR " + tir.toFixed(1).replace(".", ",") + "%";
    retornoValorCLP = tirFmt;
    retornoValorUF = tirFmt;
    retornoColor = tir < 0 ? "red" : tir < 5 ? "neutral" : "green";
    retornoSub = "Rent. anual 10 años";
  } else if (typeof results?.exitScenario?.retornoTotal === "number") {
    const retorno = results!.exitScenario!.retornoTotal;
    const retAbs = Math.abs(retorno);
    retornoValorCLP = (retorno < 0 ? "-$" : "+$") + Math.round(retAbs / 1_000_000) + "M";
    retornoValorUF = (retorno < 0 ? "-UF " : "+UF ") + Math.round(retAbs / (valorUF || 1)).toLocaleString("es-CL");
    retornoColor = retorno < 0 ? "red" : "green";
  }
  const retornoCard: import("@/lib/types").DatoClave = {
    label: "Retorno 10 años",
    valor_clp: retornoValorCLP,
    valor_uf: retornoValorUF,
    subtexto: retornoSub,
    color: retornoColor,
  };

  // Subtextos are motor-dictated to stay consistent with the sign of the value.
  // Silence unused vars if they aren't consumed here.
  void currency;
  void iaDatos;
  return [aporteCard, precioCard, retornoCard];
}

function DatoCard({ dato, currency }: { dato: import("@/lib/types").DatoClave; currency: "CLP" | "UF" }) {
  const isAccent = dato.color === "accent";
  const valor = currency === "CLP" ? dato.valor_clp : dato.valor_uf;

  const colorClass = (
    {
      red: "text-[#C8323C]",
      green: "text-[var(--franco-positive)]",
      neutral: "text-[var(--franco-text)]",
      accent: "text-[var(--franco-text)]",
    } as Record<string, string>
  )[dato.color] || "text-[var(--franco-text)]";

  const borderClass = isAccent
    ? "border-2 border-[#C8323C]"
    : "border border-[var(--franco-border)]";
  const labelClass = isAccent
    ? "text-[#C8323C] font-semibold"
    : "text-[var(--franco-text-secondary)]";

  return (
    <div className={`bg-[var(--franco-card)] rounded-xl p-4 ${borderClass}`}>
      <p className={`font-mono text-[9px] uppercase tracking-[1.5px] mb-1.5 ${labelClass}`}>
        {dato.label}
      </p>
      <p className={`font-mono text-[22px] font-semibold m-0 ${colorClass}`}>
        {valor}
      </p>
      {dato.subtexto && (
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1 m-0">
          {dato.subtexto}
        </p>
      )}
    </div>
  );
}

// ─── Dashboard layout (hero + 2×2 grid + drawer) ────
function HeroTopStrip({
  score,
  veredicto,
  propiedadNombre,
  propiedadContext,
  propiedadSpecs,
  currency,
  onCurrencyChange,
  verdictColor,
}: {
  score: number;
  veredicto: string;
  propiedadNombre: string;
  propiedadContext: string;
  propiedadSpecs: string;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  verdictColor: string;
}) {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  return (
    <div className="px-5 md:px-8 py-4 md:py-5">
      <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] gap-4 md:gap-6 items-start md:items-center">

        {/* SCORE */}
        <div className="flex items-center gap-3 md:gap-4">
          <div>
            <p className="font-mono text-[8px] md:text-[9px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-1 m-0">
              Franco Score
            </p>
            <p className="font-mono text-[28px] md:text-[32px] font-bold leading-none mb-1.5 text-[var(--franco-text)] m-0">
              {score}
            </p>
            <div className="w-[120px] md:w-[140px]">
              <div
                className="h-1 rounded-full relative"
                style={{
                  background: "linear-gradient(to right, rgba(200,50,60,0.6), rgba(251,191,36,0.6) 50%, rgba(176,190,197,0.6))",
                }}
              >
                <div
                  className="absolute top-[-3px] w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    left: `${clampedScore}%`,
                    transform: "translateX(-50%)",
                    background: "var(--franco-text)",
                    borderColor: "var(--franco-card)",
                  }}
                />
              </div>
              <div className="flex justify-between font-mono text-[7px] text-[var(--franco-text-secondary)] uppercase tracking-[1px] mt-1">
                <span>Buscar</span>
                <span>Ajusta</span>
                <span>Comprar</span>
              </div>
            </div>
          </div>
          <span
            className="font-mono text-[10px] font-semibold tracking-[2px] uppercase px-2.5 py-1 rounded whitespace-nowrap"
            style={{
              color: verdictColor,
              background: `color-mix(in srgb, ${verdictColor} 18%, transparent)`,
            }}
          >
            {veredicto}
          </span>
        </div>

        {/* CONTEXTO */}
        <div className="flex flex-col gap-1 md:border-l md:border-[var(--franco-border)] md:pl-6 min-w-0 w-full">
          {propiedadContext && (
            <p className="font-body text-[11px] md:text-[12px] text-[var(--franco-text-secondary)] m-0 truncate">
              {propiedadContext}
            </p>
          )}
          <p className="font-heading text-[16px] md:text-[18px] font-bold text-[var(--franco-text)] m-0 leading-[1.2] truncate">
            {propiedadNombre}
          </p>
          <p className="font-mono text-[10px] text-[var(--franco-text-secondary)] m-0 mt-0.5 tracking-[0.3px] truncate">
            {propiedadSpecs}
          </p>
        </div>

        {/* TOGGLE CLP/UF */}
        <div className="flex bg-[var(--franco-bar-track)] rounded-md p-0.5 self-start md:self-center">
          <button
            type="button"
            onClick={() => onCurrencyChange("CLP")}
            className={`font-mono text-[10px] px-2.5 py-1 rounded font-medium tracking-[0.5px] transition-colors ${
              currency === "CLP"
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "bg-transparent text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
            }`}
          >
            CLP
          </button>
          <button
            type="button"
            onClick={() => onCurrencyChange("UF")}
            className={`font-mono text-[10px] px-2.5 py-1 rounded font-medium tracking-[0.5px] transition-colors ${
              currency === "UF"
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "bg-transparent text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
            }`}
          >
            UF
          </button>
        </div>

      </div>
    </div>
  );
}

function HeroCard({
  data,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadNombre,
  propiedadContext,
  propiedadSpecs,
  results,
  valorUF,
}: {
  data: import("@/lib/types").AIAnalysisV2;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadNombre: string;
  propiedadContext: string;
  propiedadSpecs: string;
  results: import("@/lib/types").FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  const v = getVerdictStyles(veredicto);
  const respuesta = currency === "CLP" ? data.conviene.respuestaDirecta_clp : data.conviene.respuestaDirecta_uf;
  const veredictoFrase = currency === "CLP" ? data.conviene.veredictoFrase_clp : data.conviene.veredictoFrase_uf;
  const reencuadre = currency === "CLP" ? data.conviene.reencuadre_clp : data.conviene.reencuadre_uf;
  const cajaAccionable = currency === "CLP" ? data.conviene.cajaAccionable_clp : data.conviene.cajaAccionable_uf;

  // Build the 3 DatoCards from motor data, not from IA.
  // This guarantees consistency with MiniCards and drawers.
  const datosClave = buildHeroDatosClave(data, results, currency, valorUF);

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-3"
      style={{
        background: `color-mix(in srgb, ${v.color} 5%, var(--franco-card))`,
        border: `1px solid color-mix(in srgb, ${v.color} 28%, transparent)`,
      }}
    >
      {/* FRANJA SUPERIOR */}
      <HeroTopStrip
        score={score}
        veredicto={veredicto}
        propiedadNombre={propiedadNombre}
        propiedadContext={propiedadContext}
        propiedadSpecs={propiedadSpecs}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        verdictColor={v.color}
      />

      {/* Divider tintado según veredicto */}
      <div
        className="h-px"
        style={{ background: `color-mix(in srgb, ${v.color} 20%, transparent)` }}
      />

      {/* CUERPO — veredicto completo */}
      <div className="p-6 md:p-8">
        <p
          className="font-mono text-[10px] uppercase tracking-[2px] mb-2 font-medium m-0"
          style={{ color: v.color }}
        >
          01 · Veredicto
        </p>
        <h2 className="font-heading font-bold text-[20px] md:text-[24px] leading-[1.25] mb-4 text-[var(--franco-text)] m-0">
          {data.conviene.pregunta}
        </h2>

        <div className="font-body text-[14px] md:text-[15px] leading-[1.65] text-[var(--franco-text)] mb-3">
          {renderAiContent(respuesta)}
        </div>

        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg my-4"
          style={{
            background: `color-mix(in srgb, ${v.color} 10%, transparent)`,
            border: `0.5px solid color-mix(in srgb, ${v.color} 25%, transparent)`,
          }}
        >
          <span
            className="self-start sm:self-auto font-mono text-[11px] font-semibold tracking-[2px] px-2.5 py-1 rounded uppercase shrink-0"
            style={{
              color: v.color,
              background: `color-mix(in srgb, ${v.color} 18%, transparent)`,
            }}
          >
            {veredicto}
          </span>
          <p className="font-body text-[13px] md:text-[14px] font-medium text-[var(--franco-text)] m-0">
            {veredictoFrase}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-4">
          {datosClave.map((dato, i) => (
            <DatoCard key={i} dato={dato} currency={currency} />
          ))}
        </div>

        <div className="font-body text-[14px] md:text-[15px] leading-[1.65] text-[var(--franco-text)]">
          {renderAiContent(reencuadre)}
        </div>

        <StateBox
          variant="left-border"
          state="warning"
          label={data.conviene.cajaLabel}
          className="mt-5"
        >
          {renderAiContent(cajaAccionable)}
        </StateBox>
      </div>
    </div>
  );
}

type MiniCardSection = "costoMensual" | "negociacion" | "largoPlazo" | "riesgos";

function extractRiesgoCount(content: string | undefined): number {
  if (!content || typeof content !== "string") return 3;
  // Count markdown bold segments (**Title.**), typical structure of risk blocks.
  const boldMatches = content.match(/\*\*[^*]+\*\*/g);
  if (boldMatches && boldMatches.length >= 2 && boldMatches.length <= 10) return boldMatches.length;
  // Fallback: numbered or bulleted lines.
  const bulletMatches = content.match(/(^|\n)\s*(?:\d+\.|•|·|-)\s+/g);
  if (bulletMatches && bulletMatches.length >= 2 && bulletMatches.length <= 10) return bulletMatches.length;
  // Fallback: paragraph breaks.
  const paras = content.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
  if (paras.length >= 2 && paras.length <= 10) return paras.length;
  return 3;
}

function getPunchline(
  section: MiniCardSection,
  data: import("@/lib/types").AISection | import("@/lib/types").AINegociacionSection,
  currency: "CLP" | "UF",
  results: import("@/lib/types").FullAnalysisResult | null | undefined,
  valorUF: number
): { value: string; sub: string; color: string } {
  // 1. Costo mensual — from motor
  if (section === "costoMensual") {
    const flujo = results?.metrics?.flujoNetoMensual;
    if (typeof flujo === "number" && !isNaN(flujo)) {
      const absV = Math.abs(flujo);
      const formatted = currency === "CLP"
        ? "$" + Math.round(absV).toLocaleString("es-CL")
        : "UF " + (Math.round((absV / (valorUF || 1)) * 100) / 100).toFixed(2).replace(".", ",");
      const isNeg = flujo < 0;
      return {
        value: `${isNeg ? "-" : "+"}${formatted}`,
        sub: isNeg ? "De tu bolsillo cada mes" : "Te sobra cada mes",
        color: isNeg ? "#C8323C" : "#B0BEC5",
      };
    }
    return { value: "—", sub: "Aporte mensual", color: "var(--franco-text)" };
  }

  // 2. Negociación — from IA (string in UF), converted to CLP on demand
  if (section === "negociacion" && "precioSugerido" in data && (data as import("@/lib/types").AINegociacionSection).precioSugerido) {
    const raw = (data as import("@/lib/types").AINegociacionSection).precioSugerido;
    const precioUF = parseUFString(raw);
    if (precioUF > 0 && valorUF > 0) {
      const value = currency === "CLP"
        ? "$" + Math.round(precioUF * valorUF).toLocaleString("es-CL")
        : "UF " + Math.round(precioUF).toLocaleString("es-CL");
      return { value, sub: "Precio al que conviene cerrar", color: "var(--franco-text)" };
    }
    // Fallback: raw string as IA provided (UF format)
    return { value: raw, sub: "Precio al que conviene cerrar", color: "var(--franco-text)" };
  }

  // 3. Largo plazo — from motor
  if (section === "largoPlazo") {
    const tir = results?.exitScenario?.tir;
    if (typeof tir === "number" && !isNaN(tir)) {
      const tirPct = tir.toFixed(1).replace(".", ",");
      const isNeg = tir < 0;
      const isMarginal = tir < 5 && tir >= 0;
      return {
        value: `TIR ${tirPct}%`,
        sub: "Rentabilidad anual a 10 años",
        color: isNeg ? "#C8323C" : isMarginal ? "#FBBF24" : "#B0BEC5",
      };
    }
    const retorno = results?.exitScenario?.retornoTotal;
    if (typeof retorno === "number" && !isNaN(retorno)) {
      const isNeg = retorno < 0;
      const formatted = currency === "CLP"
        ? "$" + Math.round(Math.abs(retorno) / 1_000_000) + "M"
        : "UF " + Math.round(Math.abs(retorno) / (valorUF || 1)).toLocaleString("es-CL");
      return {
        value: `${isNeg ? "-" : "+"}${formatted}`,
        sub: "Ganancia total 10 años",
        color: isNeg ? "#C8323C" : "#B0BEC5",
      };
    }
    return { value: "—", sub: "Retorno 10 años", color: "var(--franco-text)" };
  }

  // 4. Riesgos — count from IA content
  if (section === "riesgos") {
    const content = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
    const count = extractRiesgoCount(content);
    return {
      value: `${count} flancos`,
      sub: "Requieren defensa",
      color: "#FBBF24",
    };
  }

  return { value: "—", sub: "", color: "var(--franco-text)" };
}

function MiniCard({
  section,
  label,
  labelColor,
  data,
  currency,
  onClick,
  results,
  valorUF,
}: {
  section: MiniCardSection;
  label: string;
  labelColor: "info" | "warning" | "neutral";
  data: import("@/lib/types").AISection | import("@/lib/types").AINegociacionSection;
  currency: "CLP" | "UF";
  onClick: () => void;
  results: import("@/lib/types").FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  const punchline = getPunchline(section, data, currency, results, valorUF);
  const labelColorValue: Record<"info" | "warning" | "neutral", string> = {
    info: "var(--franco-text-secondary)",
    warning: "#FBBF24",
    neutral: "var(--franco-text)",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--franco-card)] border border-[var(--franco-border)] hover:border-[var(--franco-border-hover)] rounded-2xl p-4 md:p-5 text-left transition-colors duration-200 min-h-[150px] md:min-h-[168px] flex flex-col w-full"
    >
      <p
        className="font-mono text-[9px] uppercase tracking-[1.5px] mb-2 font-medium m-0"
        style={{ color: labelColorValue[labelColor] }}
      >
        {label}
      </p>
      <h3 className="font-heading font-bold text-[15px] md:text-[16px] leading-[1.3] mb-2 text-[var(--franco-text)] m-0">
        {data.pregunta}
      </h3>
      <p
        className="font-mono text-[17px] md:text-[19px] font-bold m-0 mb-1"
        style={{ color: punchline.color }}
      >
        {punchline.value}
      </p>
      <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mb-auto leading-[1.4] m-0">
        {punchline.sub}
      </p>
      <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] mt-3">
        Leer análisis completo →
      </span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div id="informe-pro-section" className="mb-8">
      {/* Hero con franja superior + cuerpo */}
      <div className="rounded-[16px] border border-[var(--franco-border)] bg-[var(--franco-card)] overflow-hidden mb-3">
        {/* Top strip skeleton */}
        <div className="px-5 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border-b border-[var(--franco-border)]">
          <div className="flex items-center gap-3">
            <div>
              <div className="h-2 w-16 bg-[var(--franco-bar-track)] rounded animate-pulse mb-1.5" />
              <div className="h-7 w-10 bg-[var(--franco-bar-track)] rounded animate-pulse mb-1.5" />
              <div className="h-1 w-32 bg-[var(--franco-bar-track)] rounded animate-pulse" />
            </div>
            <div className="h-5 w-20 bg-[var(--franco-bar-track)] rounded animate-pulse" />
          </div>
          <div className="flex-1 md:border-l md:border-[var(--franco-border)] md:pl-6">
            <div className="h-2 w-36 bg-[var(--franco-bar-track)] rounded animate-pulse mb-1.5" />
            <div className="h-4 w-24 bg-[var(--franco-bar-track)] rounded animate-pulse mb-1.5" />
            <div className="h-2 w-48 bg-[var(--franco-bar-track)] rounded animate-pulse" />
          </div>
          <div className="h-7 w-16 bg-[var(--franco-bar-track)] rounded animate-pulse" />
        </div>

        {/* Body skeleton */}
        <div className="p-6 md:p-8">
          <div className="h-3 w-24 bg-[var(--franco-bar-track)] rounded animate-pulse mb-3" />
          <div className="h-7 w-3/4 bg-[var(--franco-bar-track)] rounded animate-pulse mb-4" />
          <div className="space-y-2 mb-4">
            <div className="h-4 w-full bg-[var(--franco-bar-track)] rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-[var(--franco-bar-track)] rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-[var(--franco-bar-track)] rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-4">
            <div className="h-20 bg-[var(--franco-bar-track)] rounded-xl animate-pulse" />
            <div className="h-20 bg-[var(--franco-bar-track)] rounded-xl animate-pulse" />
            <div className="h-20 bg-[var(--franco-bar-track)] rounded-xl animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-[var(--franco-bar-track)] rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-[var(--franco-bar-track)] rounded animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[var(--franco-card)] border border-[var(--franco-border)] rounded-2xl p-5 min-h-[168px] flex flex-col"
          >
            <div className="h-3 w-20 bg-[var(--franco-bar-track)] rounded animate-pulse mb-2" />
            <div className="h-5 w-5/6 bg-[var(--franco-bar-track)] rounded animate-pulse mb-3" />
            <div className="h-7 w-32 bg-[var(--franco-bar-track)] rounded animate-pulse mb-1" />
            <div className="h-3 w-24 bg-[var(--franco-bar-track)] rounded animate-pulse mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}


function DashboardAnalysisSection({
  aiAnalysis,
  loading,
  error,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadNombre,
  propiedadContext,
  propiedadSpecs,
  onRetry,
  results,
  inputData,
  valorUF,
  analysisId,
  comuna,
}: {
  aiAnalysis: import("@/lib/types").AIAnalysisV2 | null;
  loading: boolean;
  error: string | null;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadNombre: string;
  propiedadContext: string;
  propiedadSpecs: string;
  onRetry: () => void;
  results: import("@/lib/types").FullAnalysisResult | null | undefined;
  inputData: import("@/lib/types").AnalisisInput | null | undefined;
  valorUF: number;
  analysisId?: string;
  comuna?: string;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);

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

  if (loading && !aiAnalysis) {
    return <DashboardSkeleton />;
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
            className="font-body text-sm font-semibold text-[#C8323C] hover:underline"
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
      <HeroCard
        data={aiAnalysis}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        veredicto={veredicto}
        score={score}
        propiedadNombre={propiedadNombre}
        propiedadContext={propiedadContext}
        propiedadSpecs={propiedadSpecs}
        results={results}
        valorUF={valorUF}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <MiniCard
          section="costoMensual"
          label="Costo mensual"
          labelColor="info"
          data={aiAnalysis.costoMensual}
          currency={currency}
          onClick={() => setActiveDrawer("costoMensual")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="negociacion"
          label="Negociación"
          labelColor="neutral"
          data={aiAnalysis.negociacion}
          currency={currency}
          onClick={() => setActiveDrawer("negociacion")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="largoPlazo"
          label="Largo plazo"
          labelColor="info"
          data={aiAnalysis.largoPlazo}
          currency={currency}
          onClick={() => setActiveDrawer("largoPlazo")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="riesgos"
          label="Riesgos"
          labelColor="warning"
          data={aiAnalysis.riesgos}
          currency={currency}
          onClick={() => setActiveDrawer("riesgos")}
          results={results}
          valorUF={valorUF}
        />
      </div>

      {/* 5ª tarjeta ancha: Zona / POIs */}
      {analysisId && (
        <div className="mt-3">
          <ZoneInsightMiniCard
            data={zoneInsight}
            loading={zoneLoading}
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
          zoneInsight={zoneInsight}
          zoneLoading={zoneLoading}
          zoneError={zoneError}
          zoneCenter={zoneCenter}
          comuna={comuna ?? inputData.comuna}
          arriendoUsuarioCLP={Number(inputData.arriendo) || 0}
        />
      )}
    </div>
  );
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionCard({ title, description, icon: Icon, children }: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mb-8">
      <Card className="border border-[var(--franco-border)] rounded-2xl shadow-sm bg-[var(--franco-card)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[var(--franco-text)]" />
            <CardTitle className="font-body font-bold text-lg text-[var(--franco-text)]">{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-[var(--franco-text-secondary)]">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
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
    return <p className="text-sm text-[var(--franco-text-secondary)]">Datos de mercado no disponibles.</p>;
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
    return <p className="text-sm text-[var(--franco-text-secondary)]">Datos de mercado no disponibles para esta zona.</p>;
  }

  // Yield zona: derive from the same values shown in the ARRIENDO and PRECIO/M² cards
  // so that if tuyo == zona for both, rent. bruta also matches exactly
  const superficie = inputData?.superficie || 50;
  const precioTotalZonaCLP = avgM2Zona * superficie * UF_CLP;
  const yieldZona = precioTotalZonaCLP > 0 && avgArriendoZona > 0
    ? (avgArriendoZona * 12) / precioTotalZonaCLP * 100
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
      zona: Math.round(yieldZona * 100) / 100,
      fmtVal: (v: number) => fmtPct(v),
      invertColor: false, // higher is better
    },
  ];

  return (
    <div>
      <p className="text-xs text-[var(--franco-text-secondary)] mb-3">
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
          const deltaColor = isFavorable ? "text-[var(--franco-positive)]" : "text-[#C8323C]";
          const deltaSign = delta > 0 ? "+" : "";
          const contextText = c.invertColor
            ? (delta < 0 ? "bajo el promedio" : "sobre el promedio")
            : (delta > 0 ? "sobre el promedio" : "bajo el promedio");
          return (
            <div key={c.title} className="bg-[var(--franco-elevated)] border border-[var(--franco-border)] rounded-[10px] p-4 text-center">
              <p className="font-body text-[10px] text-[var(--franco-text-secondary)] uppercase tracking-wide">{c.title}</p>
              <p className={`font-mono text-[32px] font-bold leading-none mt-1.5 ${deltaColor}`}>{deltaSign}{Math.round(delta)}%</p>
              <p className="font-body text-[10px] text-[var(--franco-text-muted)] mt-2">{contextText}</p>
              <div className="border-t border-[var(--franco-border)] mt-3 pt-2.5 space-y-1">
                <p className="text-[11px]"><span className="font-body text-[var(--franco-text-secondary)]">Tú: </span><span className="font-mono text-[var(--franco-text)]">{c.fmtVal(c.tuyo)}</span></p>
                <p className="text-[11px]"><span className="font-body text-[var(--franco-text-muted)]">Zona: </span><span className="font-mono text-[var(--franco-text-secondary)]">{c.fmtVal(c.zona)}</span></p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Map */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-[var(--franco-text-secondary)]">
          <MapPin className="h-4 w-4" />
          <span>Ubicación: {mapQuery}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--franco-border)]">
          <iframe src={googleMapUrl} width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa de ubicación" />
        </div>
      </div>
    </div>
  );
}


export function PremiumResults({
  results, accessLevel = "free", analysisId, inputData, comuna,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  score, freeYieldBruto, freeFlujo, freePrecioM2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumenEjecutivo: _resumenEjecutivo,
  ufValue, zoneData, aiAnalysisInitial,
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
  ownerFirstName = "",
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
  ufValue?: number;
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
  ownerFirstName?: string;
}) {
  const posthog = usePostHog();
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
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setIsTouchDevice(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // PostHog: track analysis view
  useEffect(() => {
    posthog?.capture('analysis_viewed', { analysis_id: analysisId, comuna, score, veredicto: results?.veredicto, is_owner: !isSharedView && !isSharedLink, is_shared_view: isSharedView || isSharedLink, access_level: accessLevel });
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
      { key: "pesimista", label: "Pesimista", sub: "Mercado difícil", icon: "↓", plusvalia: 2, arriendoGr: 1.5, gastosGr: 5, tasaDelta: 1.5, arriendoPct: -15, vacanciaDelta: 1, color: "#C8323C", borderClass: "border-[var(--franco-sc-bad-border)]", bgClass: "bg-[var(--franco-sc-bad-bg)]", labelClass: "text-[#C8323C]" },
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        fill: s.delta >= 0 ? "var(--franco-bar-fill)" : "rgba(200,50,60,0.8)",
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
      fill: flujo >= 0 ? "var(--franco-text-secondary)" : "#C8323C",
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
      { key: "Contribuciones", label: "Contribuciones", color: "var(--franco-text-muted)" },
      { key: "Mantencion", label: "Mantención", color: "rgba(200,50,60,0.6)" },
      { key: "Vacancia", label: "Vacancia", color: "var(--franco-border)" },
      { key: "Corretaje", label: "Corretaje", color: "var(--franco-text-muted)" },
      { key: "Recambio", label: "Recambio", color: "var(--franco-border)" },
      { key: "Administracion", label: "Administración", color: "var(--franco-text-muted)" },
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

  // Derived strings for HeroCard top strip
  const propiedadContext = ownerFirstName && !isSharedView
    ? `${ownerFirstName}, tu análisis en ${comuna || ciudad || "tu zona"}`
    : `Análisis en ${comuna || ciudad || "tu zona"}`;
  const propiedadSpecs = `${superficie}m² · ${fmtUF(precioUF)} · ${currency === "UF" ? fmtUF(freePrecioM2) : fmtCLP(freePrecioM2 * UF_CLP)}/m² · Pie ${inputData?.piePct ?? 20}%`;
  const resolvedVeredicto = results?.veredicto || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");

  const mainContent = (
    <>
      {/* Shared view banner (logged in user viewing someone else's analysis) */}
      {isSharedView && (
        <div className="bg-[var(--franco-card)] text-[var(--franco-text)] rounded-xl p-4 px-5 mb-4 flex items-center justify-between gap-3 flex-wrap border border-[var(--franco-border)]">
          <p className="font-body text-sm">Estás viendo un análisis compartido.</p>
          <a href="/analisis/nuevo" className="font-body text-sm font-semibold text-[#C8323C] hover:underline shrink-0">
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
          <DashboardAnalysisSection
            aiAnalysis={aiAnalysis}
            loading={aiLoading}
            error={aiError}
            currency={currency}
            onCurrencyChange={setCurrency}
            veredicto={resolvedVeredicto}
            score={score}
            propiedadNombre={nombre}
            propiedadContext={propiedadContext}
            propiedadSpecs={propiedadSpecs}
            onRetry={generateAiManually}
            results={results}
            inputData={inputData}
            valorUF={UF_CLP}
            analysisId={analysisId}
            comuna={comuna}
          />

          {/* 2. Flujo mensual desglose */}
          <CollapsibleSection
                title={flujoUnificado >= 0 ? "¿Cuánto te genera cada mes?" : "¿Cuánto sale de tu bolsillo cada mes?"}
                subtitle="Desglose real: arriendo vs todos los costos"
                helpText={flujoUnificado === 0 ? "El arriendo cubre exactamente todos los gastos. Break-even." : flujoUnificado > 0 ? "El arriendo cubre todos los gastos y te genera excedente. Acá está el desglose completo." : "El arriendo no cubre todos los gastos. Acá está el desglose completo — lo que tu corredor nunca te muestra."}
                defaultOpen
              >
                {flujoBreakdown && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-[var(--franco-card)] rounded-[10px] p-3 text-center border border-[var(--franco-border)]">
                      <p className="font-body text-[9px] text-[var(--franco-text-secondary)] uppercase tracking-wide">Arriendo</p>
                      <p className="font-mono text-lg font-semibold text-[var(--franco-text)] mt-1">{fmt(flujoBreakdown.arriendo)}</p>
                    </div>
                    <div className="bg-[var(--franco-card)] rounded-[10px] p-3 text-center border border-[var(--franco-border)]">
                      <p className="font-body text-[9px] text-[var(--franco-text-secondary)] uppercase tracking-wide">Dividendo</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className="bg-[var(--franco-card)] rounded-[10px] p-3 text-center border border-[var(--franco-border)]">
                      <p className="font-body text-[9px] text-[var(--franco-text-secondary)] uppercase tracking-wide">Gastos</p>
                      <p className="font-mono text-lg font-semibold text-[#C8323C] mt-1">-{fmt(flujoBreakdown.totalEgresos - flujoBreakdown.dividendo)}</p>
                    </div>
                    <div className={`bg-[var(--franco-card)] rounded-[10px] p-3 text-center border-2 ${flujoBreakdown.flujoNeto >= 0 ? "border-[var(--franco-positive)]" : "border-[#C8323C]"}`}>
                      <p className={`font-body text-[9px] uppercase tracking-wide font-semibold ${flujoBreakdown.flujoNeto >= 0 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}`}>Flujo neto</p>
                      <p className={`font-mono text-lg font-semibold mt-1 ${flujoBreakdown.flujoNeto >= 0 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}`}>
                        {flujoBreakdown.flujoNeto >= 0 ? "+" : ""}{fmt(flujoBreakdown.flujoNeto)}
                      </p>
                    </div>
                  </div>
                )}
              </CollapsibleSection>

          {/* 3. Rentabilidad */}
          <CollapsibleSection
                title="¿Qué tan buena es la rentabilidad?"
                subtitle="Tu corredor solo te muestra la primera"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Bruta", value: `${fmtPct(m.rentabilidadBruta ?? 0)}`, hint: "Sin descontar nada", color: "var(--franco-text)", tip: "Arriendo × 12 / Precio. No descuenta ningún gasto.", levels: ['importante', 'sinfiltro'] },
                    { label: "CAP Rate", value: `${fmtPct(m.capRate ?? 0)}`, hint: "Operativa", color: (m.capRate ?? 0) >= 4 ? "var(--franco-positive)" : (m.capRate ?? 0) >= 2 ? "var(--franco-text)" : "#C8323C", tip: "Descuenta GGCC, contribuciones y mantención. Similar a la rentabilidad neta pero sin descontar vacancia. Es la métrica estándar internacional para comparar propiedades entre sí, sin importar el financiamiento.", levels: ['sinfiltro'] },
                    { label: "Neta", value: `${fmtPct(m.rentabilidadNeta ?? 0)}`, hint: "La que importa", color: (m.rentabilidadNeta ?? 0) >= 3 ? "var(--franco-positive)" : (m.rentabilidadNeta ?? 0) >= 1 ? "var(--franco-text)" : "#C8323C", tip: "Descuenta TODO: gastos operativos + vacancia + corretaje + recambio. No incluye el dividendo hipotecario. Mide qué tan buena es la propiedad en sí, independiente de cómo la financies. Un depto puede tener buena rentabilidad neta y flujo negativo si el financiamiento es alto.", levels: ['sinfiltro'] },
                    { label: "Cash-on-Cash", value: `${fmtPct(m.cashOnCash ?? 0)}`, hint: "Retorno tu pie", color: (m.cashOnCash ?? 0) >= 0 ? "var(--franco-positive)" : "#C8323C", tip: "Cuánto te renta el pie que pusiste. Negativo = poniendo plata extra.", levels: ['importante', 'sinfiltro'] },
                    { label: "TIR 10a", value: fixedExit10 ? `${fmtPct(fixedExit10.tir)}` : "—", hint: "Tasa interna", color: fixedExit10 && fixedExit10.tir >= 0 ? "var(--franco-positive)" : "#C8323C", tip: "Tasa Interna de Retorno considerando plusvalía y amortización.", levels: ['sinfiltro'] },
                    { label: "ROI 10a", value: fixedExit10 ? `${fixedExit10.multiplicadorCapital}x` : "—", hint: "Multiplicador", color: fixedExit10 && fixedExit10.multiplicadorCapital >= 1 ? "var(--franco-positive)" : "#C8323C", tip: "Cuántas veces multiplicas tu inversión total en 10 años.", levels: ['importante', 'sinfiltro'] },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-[var(--franco-elevated)] border border-[var(--franco-border)] rounded-lg px-4 py-3.5 flex flex-col gap-1"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)] flex items-center gap-1">
                        {metric.label}
                        <InfoTooltip content={metric.tip} />
                      </span>
                      <span className="font-mono font-semibold text-lg" style={{ color: metric.color }}>{metric.value}</span>
                      <span className="text-[10px] text-[var(--franco-text-muted)]">{metric.hint}</span>
                    </div>
                  ))}
                </div>
                {/* Insight contextual */}
                <div
                  className="mt-3.5 rounded-r-lg py-3 px-4 text-[13px] leading-relaxed"
                  style={{
                    borderLeft: `3px solid ${(m.rentabilidadNeta ?? 0) >= 3 ? 'var(--franco-positive)' : '#C8323C'}`,
                    background: (m.rentabilidadNeta ?? 0) >= 3 ? 'var(--franco-sc-good-bg)' : 'rgba(200,50,60,0.08)',
                    color: "var(--franco-text-secondary)",
                  }}
                >
                  <span style={{ color: (m.rentabilidadNeta ?? 0) >= 3 ? 'var(--franco-positive)' : '#C8323C', fontWeight: 600 }}>Siendo franco:</span>{' '}
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

          {/* 4. Zone comparison */}
          <CollapsibleSection
            title="¿Cómo se compara con la zona?"
            subtitle={`Precio y arriendo vs el promedio de ${comuna}`}
          >
            <ZoneComparisonCards m={m} zoneData={zoneData} comuna={comuna} currency={currency} fmt={fmt} mapQuery={mapQuery} googleMapUrl={googleMapUrl} inputData={inputData} />
          </CollapsibleSection>

          {/* 5. Sensibilidad */}
          <CollapsibleSection
            title="¿Qué pasa si cambian las condiciones?"
            subtitle="3 escenarios: pesimista, base y optimista"
          >
            {sensScenarios && inputData && (
              <>
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-[var(--franco-text)]">Horizonte de venta</h4>
                    <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">{sensHorizon} años</span>
                  </div>
                  <input type="range" min={3} max={20} step={1} value={sensHorizon} onChange={(e) => setSensHorizon(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-2" />
                  <div className="flex justify-between text-[10px] text-[var(--franco-text-secondary)] mt-0.5"><span>3 años</span><span>20 años</span></div>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {sensScenarios.map((s) => {
                    const scBg = s.key === "pesimista" ? "var(--franco-sc-bad-bg)" : s.key === "optimista" ? "var(--franco-sc-good-bg)" : "var(--franco-card)";
                    const scBorder = s.key === "pesimista" ? "rgba(200,50,60,0.15)" : s.key === "optimista" ? "var(--franco-sc-good-border)" : "var(--franco-border)";
                    const scText = s.key === "pesimista" ? "#C8323C" : s.key === "optimista" ? "var(--franco-positive)" : "var(--franco-text-secondary)";
                    return (
                    <div key={s.key} className="rounded-lg" style={{ border: `1px solid ${scBorder}`, background: scBg, padding: "12px 16px" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base" style={{ color: scText }}>{s.icon}</span>
                        <div className="text-sm font-medium" style={{ color: scText }}>{s.sub}</div>
                      </div>
                      <div className="mb-2">
                        <div className="text-[10px] text-[var(--franco-text-secondary)]">Flujo mensual (año 1)</div>
                        <div className={`font-mono text-lg font-semibold ${s.flujoMensual >= 0 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}`}>
                          {fmt(s.flujoMensual)}<span className="text-xs font-normal text-[var(--franco-text-secondary)]">/mes</span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="text-[10px] text-[var(--franco-text-secondary)]">Retorno ({sensHorizon} años)</div>
                        <div className={`font-mono text-base font-semibold ${s.retorno >= 1 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}`}>{s.retorno}x</div>
                      </div>
                      <div className="border-t border-dashed border-[var(--franco-border)] pt-2 text-[11px] leading-relaxed text-[var(--franco-text-secondary)]">
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

          {/* 6. Plusvalía inmediata + Precios de equilibrio */}
          {((m.plusvaliaInmediataFranco ?? 0) !== 0 || (m.plusvaliaInmediataUsuario ?? 0) !== 0 || (m.precioFlujoNeutroUF ?? 0) > 0) && (
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
                          style={{ borderLeft: `3px solid ${positive ? 'var(--franco-positive)' : '#C8323C'}`, background: positive ? 'var(--franco-sc-good-bg)' : 'rgba(200,50,60,0.08)', color: "var(--franco-text-secondary)" }}
                        >
                          <span style={{ color: positive ? 'var(--franco-positive)' : '#C8323C', fontWeight: 600 }}>{positive ? 'Ventaja de compra' : 'Sobreprecio'}{label ? ` (${label})` : ''}:</span>{' '}
                          {positive
                            ? <>compraste {fmtUF(Math.abs(clp / UF_CLP))} bajo mercado ({fmtPct(Math.abs(pct))}).{m.flujoNetoMensual < 0 && <> Equivale a {Math.round(Math.abs(clp / m.flujoNetoMensual))} meses de flujo negativo recuperados al vender.</>}{m.flujoNetoMensual === 0 && <> Flujo neutro — la plusvalía es ganancia pura.</>}</>
                            : <>pagaste {fmtUF(Math.abs(clp / UF_CLP))} sobre mercado ({fmtPct(Math.abs(pct))}). Necesitas ~{Math.ceil(Math.abs(pct) / 4)} años extra de plusvalía para recuperar.</>
                          }
                          {extra && <span className="block text-[11px] text-[var(--franco-text-muted)] mt-1">{extra}</span>}
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
                    <div className="rounded-r-lg py-3 px-4 text-[13px] leading-relaxed" style={{ borderLeft: '3px solid var(--franco-positive)', background: 'var(--franco-sc-good-bg)', color: "var(--franco-text-secondary)" }}>
                      <span style={{ color: "var(--franco-positive)", fontWeight: 600 }}>Flujo positivo.</span> Buen precio para este financiamiento.
                    </div>
                  ) : (m.precioFlujoNeutroUF ?? 0) > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[var(--franco-elevated)] border border-[var(--franco-border)] rounded-lg px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">Flujo neutro</p>
                          <p className="font-mono font-semibold text-lg text-[var(--franco-warning)]">{fmtUF(m.precioFlujoNeutroUF ?? 0)}</p>
                          <p className="text-[10px] text-[var(--franco-text-muted)]">{fmtPct(m.descuentoParaNeutro ?? 0)} menos</p>
                        </div>
                        <div className="bg-[var(--franco-elevated)] border border-[var(--franco-border)] rounded-lg px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">Flujo +$50K</p>
                          <p className="font-mono font-semibold text-lg text-[var(--franco-positive)]">{fmtUF(m.precioFlujoPositivoUF ?? 0)}</p>
                          <p className="text-[10px] text-[var(--franco-text-muted)]">{m.precioCLP > 0 && m.precioFlujoPositivoCLP ? fmtPct(((m.precioCLP - (m.precioFlujoPositivoCLP ?? 0)) / m.precioCLP) * 100) : "—"} menos</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--franco-text-muted)]">
                        Precios máximos de compra para lograr cada nivel de flujo con tu financiamiento actual.
                        {(m.descuentoParaNeutro ?? 0) > 15 && " El margen de negociación necesario es alto — considera más pie, menor tasa, o buscar otra propiedad."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-r-lg py-3 px-4 text-[13px] leading-relaxed" style={{ borderLeft: '3px solid #C8323C', background: 'rgba(200,50,60,0.08)', color: "var(--franco-text-secondary)" }}>
                      <span style={{ color: '#C8323C', fontWeight: 600 }}>Sin precio de equilibrio.</span>{' '}
                      El arriendo no alcanza a cubrir los gastos fijos (sin dividendo). Considera más pie, menor tasa, o buscar otra propiedad.
                    </div>
                  )}
                </CollapsibleSection>
              )}

          {/* 7. Riesgos */}
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
                          const isCritical = risk.severity === "critical";
                          const borderColor = isCritical ? "#C8323C" : "var(--franco-warning)";
                          const bg = isCritical ? "var(--franco-sc-bad-bg)" : "var(--franco-v-adjust-bg)";
                          return (
                            <div key={risk.id} style={{ borderLeft: `3px solid ${borderColor}`, background: bg, borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                              <div className="font-body text-sm font-semibold" style={{ color: borderColor }}>{risk.titulo}</div>
                              <div className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-relaxed mt-1">{risk.detalle}</div>
                            </div>
                          );
                        })}
                        {extraContras.map((contra, i) => (
                          <div key={`extra-${i}`} style={{ borderLeft: "3px solid var(--franco-warning)", background: "var(--franco-v-adjust-bg)", borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                            <div className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-relaxed">{contra}</div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </CollapsibleSection>

          {/* 8. Waterfall chart — standalone */}
          <CollapsibleSection
            title="¿Cuáles son todos los costos?"
            subtitle="Cascada de costos mensuales — cada peso que entra y sale"
            defaultOpen
          >
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }} angle={-45} textAnchor="end" dy={10} interval={0} height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }} tickFormatter={fmtAxis} />
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload, label: wfLabel }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = waterfallData.find((d) => d.name === wfLabel);
                      if (!item) return null;
                      const fullNames: Record<string, string> = { "Arr.": "Arriendo", "Div.": "Dividendo", "GGCC": "Gastos comunes (vacancia)", "Cont.": "Contribuciones", "Mant.": "Mantención", "Vac.": "Vacancia", "Corr.": "Corretaje", "Rec.": "Recambio arrendatario", "Admin.": "Administración de arriendo", "Neto": "Flujo Neto" };
                      const displayName = fullNames[item.name] || item.name;
                      return (
                        <div className="rounded-lg border border-[var(--franco-border-hover)] bg-[var(--franco-card)] px-3 py-3 text-xs text-[var(--franco-text)] shadow-lg">
                          <div className="mb-1 font-semibold text-[var(--franco-text)]">{item.isResult ? `→ ${displayName}` : displayName}</div>
                          <div className={item.delta >= 0 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}>
                            {item.delta >= 0 ? "+" : ""}{fmt(item.delta)}
                          </div>
                          <div className="text-[var(--franco-text-secondary)]">Acumulado: {fmt(item.running)}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="var(--franco-text-muted)" strokeDasharray="6 3" strokeWidth={1.5} />
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
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--franco-text-secondary)]">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-bar-fill)" }} />Ingreso</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.8)" }} />Egreso</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text-secondary)" }} />Resultado</span>
            </div>
            {isTouchDevice && <p className="mt-4 text-center text-[10px] text-[var(--franco-text-secondary)]">Toca las barras para ver el detalle</p>}
            {m && (
              <div className={`mt-3 flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-mono font-semibold ${flujoUnificado >= 0 ? "bg-[var(--franco-positive)]/10 text-[var(--franco-positive)]" : "bg-[#C8323C]/10 text-[#C8323C]"}`}>
                Flujo neto mensual: {flujoUnificado >= 0 ? "+" : ""}{fmt(flujoUnificado)}
              </div>
            )}
          </CollapsibleSection>

          {/* 9. Cashflow año a año */}
          <CollapsibleSection
            title="¿Cómo es el flujo año a año?"
            subtitle={`Flujo de caja desde el año 1 hasta el ${horizonYears}`}
            defaultOpen
          >
            <div>
                  <h4 className="mb-1 text-sm font-semibold text-[var(--franco-text)]">
                    Flujo de Caja — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}
                  </h4>
                  <p className="mb-3 text-xs text-[var(--franco-text-secondary)]">Cuánto entra y cuánto sale. La línea muestra tu acumulado.</p>
                  <div className="relative h-64">
                    <ResponsiveContainer>
                      <ComposedChart data={cashflowData} stackOffset="sign" margin={{ top: 5, right: 10, left: currency === "UF" ? 20 : 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" horizontal vertical={false} />
                        {/* Eje categórico visible: barras uniformes */}
                        <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: cashflowData.length > 25 ? 7 : cashflowData.length > 15 ? 8 : 10, fill: "var(--franco-text-secondary)" }} angle={-45} textAnchor="end" dy={10} interval={cashflowData.length > 15 ? Math.ceil(cashflowData.length / 10) : isMonthlyView && horizonYears > 1 ? "preserveStartEnd" : 0} height={60} />
                        {/* Eje numérico oculto: posiciona la línea de entrega */}
                        <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }} tickFormatter={fmtAxis} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as CashflowRow | undefined;
                            if (!row) return null;
                            return (
                              <div className="rounded-lg border border-[var(--franco-border-hover)] bg-[var(--franco-card)] px-3 py-3 text-xs text-[var(--franco-text)] shadow-lg">
                                <div className="mb-1.5 font-semibold text-[var(--franco-text)]">{row.name}</div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-positive)" }} />Ingreso: <span className="font-medium text-[var(--franco-text)]">{fmt(row.Ingreso)}</span></div>
                                {egresoBarSeries.map(s => (
                                  <div key={s.key} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}: <span className="font-medium text-[#C8323C]">{fmt(row[s.key] as number)}</span></div>
                                ))}
                                <div className="my-1 border-t border-[var(--franco-border)]" />
                                <div className={`font-bold ${row.FlujoNeto >= 0 ? "text-[var(--franco-positive)]" : "text-[#C8323C]"}`}>Flujo neto: {fmt(row.FlujoNeto)}</div>
                                <div className="font-bold text-[var(--franco-text)]">Acumulado: {fmt(row.Acumulado)}</div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine y={0} stroke="var(--franco-text-muted)" strokeDasharray="6 3" strokeWidth={1} />
                        {/* Ingreso siempre primero */}
                        <Bar xAxisId="cat" dataKey="Ingreso" stackId="stack" fill="var(--franco-positive)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                        {/* Egresos ordenados por impacto promedio descendente */}
                        {egresoBarSeries.map((s, i) => (
                          <Bar key={s.key} xAxisId="cat" dataKey={s.key as string} name={s.label} stackId="stack" fill={s.color} radius={i === egresoBarSeries.length - 1 ? [0, 0, 4, 4] : undefined} />
                        ))}
                        {/* Línea acumulado */}
                        <Line xAxisId="cat" type="monotone" dataKey="Acumulado" stroke="var(--franco-text)" strokeWidth={2} dot={isMonthlyView ? { r: 2 } : false} legendType="none" />
                        {/* Línea vertical de entrega */}
                        {mesesPreEntregaTop > 0 && !horizonBeforeDelivery && (
                          <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="var(--franco-text-muted)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "var(--franco-text-secondary)" }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {horizonBeforeDelivery && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--franco-card)]/80 backdrop-blur-[1px]">
                        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]/95 px-6 py-5 text-center shadow-lg">
                          <Clock className="h-7 w-7 text-[var(--franco-text)]" />
                          <span className="text-sm font-semibold text-[var(--franco-text)]">Tu inversión aún no genera flujo</span>
                          <p className="text-xs text-[var(--franco-text-secondary)]">
                            La entrega está estimada para {fechaEntregaLabel}. Hasta entonces no hay ingresos ni gastos operativos.
                            Aumenta el horizonte a más de {mesesPreEntregaTop} meses para ver el flujo post-entrega.
                          </p>
                          <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="text-xs font-medium text-[var(--franco-text)] hover:underline">
                            Ver desde la entrega →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Leyenda manual */}
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[var(--franco-text-secondary)]" style={{ display: 'block', width: '100%', marginBottom: '8px' }}>
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-positive)" }} />Ingreso</span>
                      {egresoBarSeries.map(s => (
                        <span key={s.key} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                      ))}
                      <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "var(--franco-text)", height: 2 }} />Acumulado</span>
                    </div>
                  </div>
                  {isTouchDevice && <div style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '24px', clear: 'both', fontSize: '12px', color: "var(--franco-text-secondary)" }}>Toca las barras para ver el detalle</div>}
            </div>
          </CollapsibleSection>

          {/* 10. Patrimonio */}
          <CollapsibleSection
            title={`¿Cuánto ganas si vendes en ${horizonYears} años?`}
            subtitle="Proyección de patrimonio con plusvalía y amortización"
            defaultOpen
          >
            {/* Patrimonio chart + breakdown */}
            {projData.length > 0 && (
              <>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[var(--franco-text)]">Proyección de Patrimonio — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}</h4>
                    {horizonBeforeDelivery && (
                      <span className="rounded-full bg-[#C8323C]/10 px-2 py-0.5 text-[10px] font-medium text-[#C8323C]">
                        Período pre-entrega: tu patrimonio crece con los pagos del pie
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-[var(--franco-text-secondary)]">De dónde viene tu patrimonio. Plusvalía {fmtPct(plusvaliaRate)}/año y arriendos +{fmtPct(arriendoGrowth)}/año.</p>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ComposedChart data={projData} margin={{ top: 5, right: 10, left: currency === "UF" ? 20 : 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" horizontal vertical={false} />
                        <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: projData.length > 25 ? 7 : projData.length > 15 ? 8 : 10, fill: "var(--franco-text-secondary)" }} angle={-45} textAnchor="end" dy={10} interval={projData.length > 15 ? Math.ceil(projData.length / 10) : isMonthlyView ? "preserveStartEnd" : 0} height={60} />
                        <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }} tickFormatter={fmtAxis} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as PatrimonioRow | undefined;
                            if (!row) return null;
                            const pre = row.isPreEntrega;
                            return (
                              <div className="rounded-lg border border-[var(--franco-border-hover)] bg-[var(--franco-card)] px-3 py-3 text-xs text-[var(--franco-text)] shadow-lg">
                                <div className="mb-1.5 font-semibold text-[var(--franco-text)]">{row.name}{pre ? " (pre-entrega)" : ""}</div>
                                {pre ? (
                                  <>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.15 }} />Pie acumulado: <span className="font-medium" style={{ color: "var(--franco-text)" }}>{fmt(row.piePagado)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.25 }} />Plusvalía estimada: <span className="font-medium" style={{ color: "var(--franco-text)" }}>{fmt(row.plusvalia)}</span></div>
                                    <div style={{ color: "var(--franco-text-secondary)" }}>Deuda: <span style={{ color: "var(--franco-text-secondary)" }}>$0 (crédito aún no comienza)</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.3 }} />Valor propiedad: <span className="font-medium" style={{ color: "var(--franco-text)" }}>{fmt(row.valorPropiedad)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#C8323C" }} />Deuda restante: <span className="font-medium" style={{ color: "#C8323C" }}>-{fmt(row.saldoCredito ?? 0)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.15 }} />Pie + amortización: <span className="font-medium" style={{ color: "var(--franco-text)" }}>{fmt(row.piePagado + row.capitalAmortizado)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.25 }} />Plusvalía acumulada: <span className="font-medium" style={{ color: "var(--franco-text)" }}>{fmt(row.plusvalia)}</span></div>
                                    <div className="flex items-center gap-1.5" style={{ color: "var(--franco-text-secondary)" }}><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.30)", border: "1px solid rgba(200,50,60,0.5)" }} />Flujo de bolsillo: <span className="font-medium" style={{ color: "#C8323C" }}>{fmt(row.flujoAcumulado)}</span></div>
                                  </>
                                )}
                                <div className="mt-1 border-t border-[var(--franco-border)] pt-1 font-semibold" style={{ color: "var(--franco-text)" }}>Patrimonio neto: {fmt(row.patrimonioNeto)}</div>
                              </div>
                            );
                          }}
                        />
                        <Area xAxisId="cat" type="monotone" dataKey="valorPropArea" fill="var(--franco-text)" fillOpacity={0.06} stroke="var(--franco-text)" strokeWidth={2} />
                        <Area xAxisId="cat" type="monotone" dataKey="saldoCredito" fill="#C8323C" fillOpacity={0.06} stroke="none" />
                        <Bar xAxisId="cat" dataKey="piePagado" stackId="patrimonio" fill="var(--franco-text)" fillOpacity={0.15} name="Pie pagado" radius={[0, 0, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="capitalAmortizado" stackId="patrimonio" fill="var(--franco-text)" fillOpacity={0.4} name="Capital amortizado" radius={[0, 0, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="plusvalia" stackId="patrimonio" fill="var(--franco-text)" fillOpacity={0.25} name="Plusvalía" radius={[4, 4, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="flujoAcumulado" stackId="patrimonio" fill="rgba(200,50,60,0.25)" stroke="rgba(200,50,60,0.45)" strokeWidth={1} name="Flujo de bolsillo" radius={[0, 0, 0, 0]} />
                        <Line xAxisId="cat" type="monotone" dataKey="saldoCredito" stroke="#C8323C" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Deuda restante" />
                        <Line xAxisId="cat" type="monotone" dataKey="patrimonioNeto" stroke="var(--franco-text)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--franco-text)", stroke: "var(--franco-bg)", strokeWidth: 2 }} name="Patrimonio neto" />
                        {mesesPreEntregaTop > 0 && (
                          <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="var(--franco-text-muted)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "var(--franco-text-secondary)" }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--franco-text-secondary)]">
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.15 }} />Pie pagado</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.3 }} />Capital amortizado</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.08, border: "1px solid var(--franco-border)" }} />Plusvalía</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(200,50,60,0.30)", border: "1px solid rgba(200,50,60,0.5)" }} />Flujo de bolsillo</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.2 }} />Valor propiedad</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#C8323C", opacity: 0.7 }} />Deuda</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "var(--franco-text)", height: 3 }} />Patrimonio neto</span>
                  </div>
                  {isTouchDevice && <p className="mt-4 text-center text-[10px] text-[var(--franco-text-secondary)]">Toca las barras para ver el detalle</p>}
                  {/* Desglose de patrimonio */}
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
                      <div className="mt-4 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)]">
                        <div className="space-y-0 divide-y divide-[var(--franco-border)] sm:hidden">
                          {[
                            { label: "Tu inversión inicial (pie)", value: fmt(m.pieCLP), color: "text-[var(--franco-text)]" },
                            { label: `Ganancia por plusvalía (${fmtUF(inputData.precio)} → ${fmtUF(lastRow.valorPropiedad / UF_CLP)})`, value: fmt(plusvaliaGanancia), color: "text-[var(--franco-positive)]" },
                            { label: "Capital amortizado", value: fmt(capitalAmortizado), color: "text-[var(--franco-positive)]" },
                            { label: "Patrimonio neto total", value: fmt(patrimonioTotal), color: "text-[var(--franco-text)]", bold: true },
                          ].map(({ label, value, color, bold }) => (
                            <div key={label} className={`px-3 py-2 ${bold ? "bg-[var(--franco-border)]" : ""}`}>
                              <div className="text-[11px] text-[var(--franco-text-secondary)]">{label}</div>
                              <div className={`text-sm font-medium ${color || ""} ${bold ? "font-bold" : ""}`}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <table className="hidden w-full text-sm sm:table">
                          <tbody>
                            <tr className="border-b border-[var(--franco-border)]">
                              <td className="py-2 px-4 text-[var(--franco-text)]">Tu inversión inicial (pie)</td>
                              <td className="py-2 px-4 text-right font-medium text-[var(--franco-text)]">{fmt(m.pieCLP)}</td>
                            </tr>
                            <tr className="border-b border-[var(--franco-border)]">
                              <td className="py-2 px-4 text-[var(--franco-text)]">Ganancia por plusvalía ({fmtUF(inputData.precio)} → {fmtUF(lastRow.valorPropiedad / UF_CLP)})</td>
                              <td className="py-2 px-4 text-right font-medium text-[var(--franco-positive)]">{fmt(plusvaliaGanancia)}</td>
                            </tr>
                            <tr className="border-b border-[var(--franco-border)]">
                              <td className="py-2 px-4 text-[var(--franco-text)]">Capital amortizado (pagado del crédito)</td>
                              <td className="py-2 px-4 text-right font-medium text-[var(--franco-positive)]">{fmt(capitalAmortizado)}</td>
                            </tr>
                            <tr className="border-t border-[var(--franco-border)]">
                              <td className="py-2 px-4 font-semibold text-[var(--franco-text)]">Patrimonio neto total</td>
                              <td className="py-2 px-4 text-right font-bold text-[var(--franco-text)]">{fmt(patrimonioTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="px-3 pb-2 text-[10px] text-[var(--franco-text-secondary)] sm:px-4">= valor propiedad − deuda restante</p>
                      </div>

                      {/* Bloque 2: Lo que pusiste de tu bolsillo */}
                      <div className="mt-3 rounded-lg" style={{ border: "1px solid rgba(200,50,60,0.2)", background: "rgba(200,50,60,0.04)" }}>
                        <div className="px-3 py-2.5 sm:px-4">
                          <div className="mb-1 font-mono text-xs font-medium uppercase" style={{ color: "#C8323C" }}>Lo que pusiste de tu bolsillo</div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--franco-text-secondary)]">Flujo acumulado ({horizonYears === 1 ? "1 año" : `${horizonYears} años`})</span>
                            <span className="font-mono font-medium" style={{ color: "#C8323C" }}>{fmt(flujoAcum)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bloque 3: Ganancia real */}
                      <div className="mt-3 rounded-lg" style={{ border: "1px solid var(--franco-border)", background: "var(--franco-card)" }}>
                        <div className="px-3 py-3 sm:px-4">
                          <p className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Si vendieras en {horizonYears === 1 ? "1 año" : `${horizonYears} años`}, tu ganancia real sería:</p>
                          <p className="mt-0.5 font-mono text-xs" style={{ color: "var(--franco-text-muted)" }}>patrimonio − pie + flujo − gastos cierre</p>
                          <div className={`mt-2 font-mono text-[22px] font-semibold ${gananciaReal >= 0 ? "" : ""}`} style={{ color: gananciaReal >= 0 ? "var(--franco-text)" : "#C8323C" }}>{fmt(gananciaReal)}</div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </CollapsibleSection>

          {/* 11. Exit/Refi */}
          <CollapsibleSection
            title="¿Qué pasa si vendes o refinancias?"
            subtitle="Escenarios de salida: venta y refinanciamiento"
            defaultOpen
          >
            {horizonBeforeDelivery ? (
              <div>
                <div className="flex items-center gap-3 rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/5 p-4">
                  <Clock className="h-5 w-5 shrink-0 text-[#C8323C]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--franco-text)]">No puedes vender ni refinanciar antes de la entrega</p>
                    <p className="mt-1 text-xs text-[var(--franco-text-secondary)]">
                      La entrega está estimada para {fechaEntregaLabel}. Aumenta el horizonte para ver escenarios de salida.
                    </p>
                    <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="mt-2 text-xs font-medium text-[var(--franco-text)] hover:underline">
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
                  <button type="button" onClick={() => setExitMode("venta")} className={`flex-1 px-6 py-2.5 font-body text-sm font-semibold rounded-lg transition-colors ${exitMode === "venta" ? "bg-[#C8323C] text-white" : "bg-transparent border border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:border-[var(--franco-border-hover)]"}`}>Venta</button>
                  <button type="button" onClick={() => setExitMode("refinanciamiento")} className={`flex-1 px-6 py-2.5 font-body text-sm font-semibold rounded-lg transition-colors ${exitMode === "refinanciamiento" ? "bg-[#C8323C] text-white" : "bg-transparent border border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:border-[var(--franco-border-hover)]"}`}>Refinanciamiento</button>
                </div>

                {exitMode === "venta" ? (
                  <div className="space-y-4 text-sm text-[var(--franco-text)]">
                    {/* Intro */}
                    <p className="rounded-lg bg-[var(--franco-card)] p-3 text-xs text-[var(--franco-text-secondary)]">
                      Si vendieras {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`} al valor proyectado (plusvalía {fmtPct(plusvaliaRate)}/año), ¿cuánto ganarías?
                    </p>

                    {/* Lo que pusiste */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Lo que pusiste</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Pie inicial</span>
                        <span className="font-mono text-sm text-[var(--franco-text)]">{fmt(m.pieCLP)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Flujo de bolsillo ({horizonYears === 1 ? "1 año" : `${horizonYears} años`})</span>
                        <span className="font-mono text-sm" style={{ color: "#C8323C" }}>{fmt(Math.abs(fa))}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px] font-semibold text-[var(--franco-text)]">Total invertido</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmt(totalInvertido)}</span>
                      </div>
                    </div>

                    {/* Lo que recuperas */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Lo que recuperas</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Valor de venta estimado</span>
                        <span className="font-mono text-sm text-[var(--franco-text)]">{fmt(vp)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Saldo crédito restante</span>
                        <span className="font-mono text-sm" style={{ color: "var(--franco-text-secondary)" }}>{sc > 0 ? `-${fmt(sc)}` : fmt(0)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Comisión venta (2%)</span>
                        <span className="font-mono text-sm" style={{ color: "var(--franco-text-secondary)" }}>-{fmt(comision)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px] font-semibold text-[var(--franco-text)]">Recibes neto</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmt(recibeNeto)}</span>
                      </div>
                    </div>

                    {/* Resultado */}
                    <div className="rounded-[10px] p-5" style={{ background: "var(--franco-card)", border: "1px solid var(--franco-border)" }}>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Resultado</div>
                      <div className="flex items-center justify-between sm:flex-row flex-col gap-4">
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>Tu ganancia</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: ganancia >= 0 ? "var(--franco-text)" : "#C8323C" }}>{fmt(ganancia)}</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "var(--franco-border)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "var(--franco-border)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>Multiplicador</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: multiplicador >= 1 ? "var(--franco-text)" : "#C8323C" }}>{multiplicador}x</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "var(--franco-border)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "var(--franco-border)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>TIR</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: tir >= 0 ? "var(--franco-text)" : "#C8323C" }}>{fmtPct(tir)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Narrativa Franco */}
                    <div style={{ borderLeft: "2px solid #C8323C", background: "rgba(200,50,60,0.04)", borderRadius: "0 8px 8px 0", padding: "12px 16px" }}>
                      <p className="text-[13px] leading-relaxed" style={{ color: "var(--franco-text-secondary)" }}>
                        Pusiste <span className="font-medium text-[var(--franco-text)]">{fmtAbr(m.pieCLP)}</span> de pie y <span className="font-medium text-[var(--franco-text)]">{fmtAbr(fa)}</span> de flujo durante {horizonYears} años.
                        {" "}Al vender, recibes <span className="font-medium text-[var(--franco-text)]">{fmtAbr(recibeNeto)}</span> netos.
                        {" "}Tu ganancia real es <span className="font-medium text-[var(--franco-text)]">{fmtAbr(ganancia)}</span> — tu inversión inicial se multiplicó <span className="font-medium text-[var(--franco-text)]">{multiplicador}x</span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-[var(--franco-text)]">
                    {/* Intro */}
                    <p className="rounded-lg bg-[var(--franco-card)] p-3 text-xs text-[var(--franco-text-secondary)]">
                      Si en vez de vender refinancias {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`} con el nuevo valor de mercado, ¿cuánto capital puedes liberar para otra inversión?
                    </p>

                    {/* Selector % refi */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "var(--franco-text-secondary)" }}>% refinanciamiento:</span>
                      <div className="flex gap-1.5">
                        {[60, 70, 80, 90].map((pct) => (
                          <button key={pct} type="button" onClick={() => setRefiPct(pct)}
                            className="rounded px-3 py-1.5 text-xs font-medium transition-colors"
                            style={refiPct === pct
                              ? { border: "1px solid var(--franco-text)", color: "var(--franco-text)", fontWeight: 500 }
                              : { border: "1px solid var(--franco-border)", color: "var(--franco-text-secondary)" }}
                          >{pct}%</button>
                        ))}
                      </div>
                    </div>

                    {/* Tu depto hoy */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Tu depto hoy</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Nuevo avalúo (valor proyectado)</span>
                        <span className="font-mono text-sm text-[var(--franco-text)]">{fmt(vp)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Deuda actual</span>
                        <span className="font-mono text-sm text-[var(--franco-text)]">{fmt(sc)}</span>
                      </div>
                    </div>

                    {/* Nuevo crédito */}
                    <div>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Nuevo crédito</div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Nuevo crédito ({refiPct}% del avalúo)</span>
                        <span className="font-mono text-sm text-[var(--franco-text)]">{fmt(refiNuevoCredito)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px]" style={{ color: "var(--franco-text-secondary)" }}>Pago deuda anterior</span>
                        <span className="font-mono text-sm" style={{ color: "var(--franco-text-secondary)" }}>{sc > 0 ? `-${fmt(sc)}` : fmt(0)}</span>
                      </div>
                      <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--franco-border)" }}>
                        <span className="text-[13px] font-semibold text-[var(--franco-text)]">Capital liberado</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmt(refiCapitalLiberado)}</span>
                      </div>
                    </div>

                    {/* Impacto en tu flujo */}
                    <div className="rounded-[10px] p-5" style={{ background: "var(--franco-card)", border: "1px solid var(--franco-border)" }}>
                      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--franco-text-muted)", letterSpacing: "0.08em" }}>Impacto en tu flujo</div>
                      <div className="flex items-center justify-between sm:flex-row flex-col gap-4">
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>Nuevo dividendo</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: "#C8323C" }}>{fmt(refiNuevoDividendo)}</div>
                        </div>
                        <div className="hidden sm:block h-10" style={{ width: 1, background: "var(--franco-border)" }} />
                        <div className="sm:hidden w-full" style={{ height: 1, background: "var(--franco-border)" }} />
                        <div className="flex-1 text-center">
                          <div className="text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>Nuevo flujo neto</div>
                          <div className="mt-1 font-mono text-[22px] font-bold" style={{ color: "#C8323C" }}>{fmt(refiNuevoFlujoNeto)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Narrativa Franco */}
                    <div style={{ borderLeft: "2px solid #C8323C", background: "rgba(200,50,60,0.04)", borderRadius: "0 8px 8px 0", padding: "12px 16px" }}>
                      <p className="text-[13px] leading-relaxed" style={{ color: "var(--franco-text-secondary)" }}>
                        Sin vender tu depto, puedes liberar <span className="font-medium text-[var(--franco-text)]">{fmtAbr(refiCapitalLiberado)}</span> en efectivo refinanciando al {refiPct}%.
                        {" "}{nDeptos >= 2
                          ? <>Ese capital alcanza como pie para <span className="font-medium text-[var(--franco-text)]">{nDeptos} departamentos</span> similares.</>
                          : <>Ese capital equivale a <span className="font-medium text-[var(--franco-text)]">{(Math.round(refiCapitalLiberado / m.pieCLP * 10) / 10)}x</span> tu pie original.</>
                        }
                        {" "}Tu nuevo dividendo sube a <span className="font-medium text-[var(--franco-text)]">{fmt(refiNuevoDividendo)}</span>/mes y el flujo neto queda en <span className="font-medium text-[var(--franco-text)]">{fmt(refiNuevoFlujoNeto)}</span>/mes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
                );
              })()
            ) : null}
          </CollapsibleSection>
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
      {currentAccess === 'subscriber' ? (
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
                <label className="font-body text-sm font-medium text-[var(--franco-text)]">Administración</label>
                <span className="text-[11px] font-medium text-[var(--franco-text)]">{adjAdminPct}%</span>
              </div>
              <input type="range" min={0} max={15} step={1} value={adjAdminPct} onChange={(e) => setAdjAdminPct(Number(e.target.value))} className="w-full accent-[var(--franco-text-muted)] h-1.5" />
              <p className="text-[10px] text-[var(--franco-text-secondary)] leading-tight">{adjAdminPct > 0 ? `${fmtCLP(Math.round(adjArriendo * adjAdminPct / 100))}/mes` : "Sin administrador"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 p-3 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] text-center">
          <p className="text-[var(--franco-text-muted)] text-xs mb-2 font-body leading-relaxed">
            Desbloquea arriendo, vacancia y más variables con la suscripción mensual
          </p>
          <a href="/pricing" onClick={() => { posthog?.capture('pro_cta_clicked', { source: 'results' }); }} className="text-[#C8323C] text-xs font-semibold hover:underline font-body">
            Ver planes →
          </a>
        </div>
      )}
    </div>
  ) : null;

  const panelButton = hasPanelContent ? (
    <div>
      <Button onClick={handleRecalculate} disabled={recalcLoading} size="sm" className="w-full gap-2 bg-[#C8323C] text-white hover:bg-[#C8323C]/90">
        {recalcLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {recalcLoading ? "Recalculando..." : "Recalcular"}
      </Button>
      {recalcSuccess && <p className="mt-1 text-center text-xs text-[var(--franco-positive)]">Actualizado</p>}
    </div>
  ) : null;

  const projectionFields = hasPanelContent ? (
    currentAccess !== 'subscriber' ? (
      <div className="p-3 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] text-center">
        <p className="text-[var(--franco-text-muted)] text-xs mb-2 font-body leading-relaxed">
          Las proyecciones dinámicas (plusvalía, crecimiento) están disponibles con la suscripción mensual
        </p>
        <a href="/pricing" onClick={() => { posthog?.capture('pro_cta_clicked', { source: 'results' }); }} className="text-[#C8323C] text-xs font-semibold hover:underline font-body">
          Ver planes →
        </a>
      </div>
    ) : (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[var(--franco-text)]">Horizonte</label>
          <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">{horizonYears} año{horizonYears > 1 ? "s" : ""}</span>
        </div>
        <input type="range" min={1} max={20} value={horizonYears} onChange={(e) => setHorizonYears(Number(e.target.value))} className="mt-1 w-full accent-[var(--franco-text-muted)] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[var(--franco-text-secondary)]">{isMonthlyView ? "Vista mensual" : "Vista anual"}</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[var(--franco-text)]">Plusvalía anual</label>
          <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">{fmtPct(plusvaliaRate)}</span>
        </div>
        <input type="range" min={0} max={8} step={0.5} value={plusvaliaRate} onChange={(e) => setPlusvaliaRate(Number(e.target.value))} className="mt-1 w-full accent-[var(--franco-text-muted)] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[var(--franco-text-secondary)]">Promedio histórico: 3-5% anual</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[var(--franco-text)]">Crecimiento arriendo</label>
          <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">{fmtPct(arriendoGrowth)}/año</span>
        </div>
        <input type="range" min={0} max={6} step={0.5} value={arriendoGrowth} onChange={(e) => setArriendoGrowth(Number(e.target.value))} className="mt-1 w-full accent-[var(--franco-text-muted)] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[var(--franco-text-secondary)]">Promedio histórico: 3-4% anual</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-sm font-medium text-[var(--franco-text)]">Crecimiento gastos</label>
          <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">{fmtPct(costGrowth)}/año</span>
        </div>
        <input type="range" min={0} max={6} step={0.5} value={costGrowth} onChange={(e) => setCostGrowth(Number(e.target.value))} className="mt-1 w-full accent-[var(--franco-text-muted)] h-1.5" />
        <p className="mt-0.5 text-[10px] text-[var(--franco-text-secondary)]">Aplica a GGCC, contribuciones y mantención</p>
      </div>
    </div>
    )
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
            className="flex flex-col rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm"
            style={{ maxHeight: "calc(100vh - 2rem)" }}
          >
            <div className="shrink-0 px-3 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[var(--franco-text)]" />
                <h3 className="font-body text-xs font-semibold text-[var(--franco-text)]">Ajusta los números</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2">
              {panelFields}
            </div>
            <div className="shrink-0 border-t border-[var(--franco-border)] px-3 py-2">
              {panelButton}
            </div>
          </div>

          {/* Panel 2: sticky, always visible */}
          {(
            <div
              className="sticky top-20 mt-8 flex flex-col rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm animate-fadeIn"
              style={{ maxHeight: "calc(100vh - 2rem)" }}
            >
              <div className="shrink-0 px-3 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--franco-text)]" />
                  <h3 className="font-body text-xs font-semibold text-[var(--franco-text)]">Proyecciones</h3>
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
              className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-[var(--franco-card)] border border-[var(--franco-border)] text-[var(--franco-text)] shadow-[0_4px_20px_rgba(0,0,0,0.5)] px-4 py-3 lg:hidden transition-opacity duration-200"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-body text-[13px] font-medium">{fabState === 'projections' ? 'Proyecciones' : 'Ajusta los números'}</span>
            </button>
          )}

          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-2xl bg-[var(--franco-card)] shadow-2xl" style={{ maxHeight: "80vh" }}>
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--franco-border)]" />
                <div className="shrink-0 px-5 pt-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-[var(--franco-text)]" />
                      <h3 className="font-body text-base font-medium text-[var(--franco-text)]">
                        {fabState === 'projections' ? 'Proyecciones' : 'Ajusta los números'}
                      </h3>
                    </div>
                    <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full p-1 hover:bg-[var(--franco-border)]">
                      <X className="h-5 w-5 text-[var(--franco-text-secondary)]" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-2">
                  {fabState === 'projections' ? projectionFields : panelFields}
                </div>
                {fabState !== 'projections' && (
                  <div className="shrink-0 border-t border-[var(--franco-border)] px-5 py-3">
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

