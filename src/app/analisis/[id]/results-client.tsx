"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import {
  Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  MapPin,
  RefreshCw, Loader2, Clock,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { calcFlujoDesglose, getMantencionRate, calcExitScenario } from "@/lib/analysis";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { findNearestStation } from "@/lib/metro-stations";
import type { MarketDataRow } from "@/lib/market-data";
import { StateBox } from "@/components/ui/StateBox";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { LoadingEditorial } from "@/components/analysis/LoadingEditorial";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { SimulationProvider, useSimulation } from "@/contexts/SimulationContext";
import SliderSimulacion from "@/components/analysis/SliderSimulacion";
import KPICard from "@/components/analysis/KPICard";
import {
  calculateKPIs,
  tonoTIR,
  tonoCapRate,
  tonoCashOnCash,
  tonoPayback,
  tonoMultiplo,
} from "@/lib/analysis/kpi-calculations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "@/lib/plusvalia-historica";
import type { YearProjection, AnalysisMetrics } from "@/lib/types";


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
          return <strong key={j} className="font-medium">{part.slice(2, -2)}</strong>;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CollapsibleSection({ title, subtitle, helpText, defaultOpen = false, badge, children }: {
  title: string;
  subtitle?: string;
  helpText?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-4 px-5 text-left gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[15px] font-medium text-[var(--franco-text)]">{title}</span>
            {badge}
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SimulationTag() {
  return (
    <span
      className="font-mono uppercase whitespace-nowrap"
      style={{
        fontSize: 9,
        letterSpacing: "1.2px",
        padding: "3px 8px",
        borderRadius: 3,
        background: "color-mix(in srgb, var(--franco-text) 12%, transparent)",
        color: "var(--franco-text)",
        border: "0.5px solid color-mix(in srgb, var(--franco-text) 25%, transparent)",
        fontWeight: 600,
      }}
    >
      🔄 Simulación
    </span>
  );
}

function IndicadoresRentabilidadContent({
  projections,
  metrics,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
}) {
  const { plazoAnios, plusvaliaAnual } = useSimulation();
  const kpis = useMemo(
    () => calculateKPIs({ projections, metrics, plazoAnios, plusvaliaAnual }),
    [projections, metrics, plazoAnios, plusvaliaAnual]
  );
  const plazoLabel = `${plazoAnios} ${plazoAnios === 1 ? "AÑO" : "AÑOS"}`;
  const paybackValue = kpis.paybackAnios ? `Año ${kpis.paybackAnios}` : ">30";

  return (
    <div className="flex flex-col gap-2.5">
      {/* 2 hero KPIs arriba */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <KPICard
          label={`TIR @ ${plazoLabel}`}
          value={`${kpis.tir.toFixed(1)}%`}
          sub="Retorno total anualizado"
          tone={tonoTIR(kpis.tir)}
          size="hero"
        />
        <KPICard
          label="CAP Rate"
          value={`${kpis.capRate.toFixed(1)}%`}
          sub="Rendimiento bruto sobre precio"
          tone={tonoCapRate(kpis.capRate)}
          size="hero"
        />
      </div>

      {/* 3 secundarios abajo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <KPICard
          label={`Cash-on-Cash @ ${plazoLabel}`}
          value={`${kpis.cashOnCash.toFixed(1)}%`}
          sub="Flujo / inversión"
          tone={tonoCashOnCash(kpis.cashOnCash)}
          size="small"
        />
        <KPICard
          label="Payback (con venta)"
          value={paybackValue}
          sub="Año en que recuperas toda la inversión"
          tone={tonoPayback(kpis.paybackAnios)}
          size="small"
        />
        <KPICard
          label={`Múltiplo @ ${plazoLabel}`}
          value={`${kpis.multiplo.toFixed(2)}x`}
          sub="Retorno total / inversión"
          tone={tonoMultiplo(kpis.multiplo)}
          size="small"
        />
      </div>
    </div>
  );
}

// ─── Gráfico de patrimonio (acordeón 2 · Capa 3) ─────
function GraficoPatrimonioContent({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { plazoAnios } = useSimulation();

  const chartData = useMemo(() => {
    const pieCLP = metrics.pieCLP ?? 0;
    const precioCLP = metrics.precioCLP ?? 0;
    const creditoInicial = Math.max(precioCLP - pieCLP, 0);
    const inversionInicial = pieCLP + Math.round(precioCLP * 0.02);
    const rows: Array<{
      anio: number;
      aporteAcum: number;
      valorDepto: number;
      patrimonioNeto: number;
      flujoAcumulado: number;
      deudaPendiente: number;
    }> = [];

    // Año 0 — día de cierre
    rows.push({
      anio: 0,
      aporteAcum: inversionInicial,
      valorDepto: precioCLP,
      patrimonioNeto: precioCLP - creditoInicial - Math.round(precioCLP * 0.02),
      flujoAcumulado: 0,
      deudaPendiente: creditoInicial,
    });

    // Años 1..plazoAnios
    for (let i = 1; i <= plazoAnios; i++) {
      const p = projections[i - 1];
      if (!p) break;
      const aporteAcum = inversionInicial + Math.abs(Math.min(0, p.flujoAcumulado));
      const comision = Math.round(p.valorPropiedad * 0.02);
      rows.push({
        anio: i,
        aporteAcum,
        valorDepto: p.valorPropiedad,
        patrimonioNeto: p.valorPropiedad - p.saldoCredito - comision,
        flujoAcumulado: p.flujoAcumulado,
        deudaPendiente: p.saldoCredito,
      });
    }
    return rows;
  }, [projections, metrics, plazoAnios]);

  // Año de entrega si es venta en blanco
  const entregaAnio = useMemo(() => {
    if (!inputData.fechaEntrega || inputData.estadoVenta === "inmediata") return null;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const ent = new Date(a, (me || 1) - 1);
    const meses = Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (meses <= 0) return null;
    return Math.ceil(meses / 12);
  }, [inputData.fechaEntrega, inputData.estadoVenta]);

  const last = chartData[chartData.length - 1];
  const ganancia = last ? last.patrimonioNeto - last.aporteAcum : 0;
  const gananciaPct = last && last.aporteAcum > 0 ? (ganancia / last.aporteAcum) * 100 : 0;

  const tickFormatter = (v: number) => fmtAxisMoney(v, currency);

  return (
    <div className="flex flex-col gap-4">
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: currency === "UF" ? 20 : 10, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--franco-border)" vertical={false} />
            <XAxis
              dataKey="anio"
              tick={{ fontSize: 11, fill: "var(--franco-text-secondary)" }}
              tickFormatter={(v) => `a${v}`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--franco-text-secondary)" }}
              tickFormatter={tickFormatter}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return null;
                const fmt = (n: number) => fmtMoney(n, currency);
                return (
                  <div
                    className="rounded-lg px-3 py-2.5 shadow-lg"
                    style={{
                      border: "0.5px solid var(--franco-border-hover)",
                      background: "var(--franco-card)",
                      fontSize: 12,
                      color: "var(--franco-text)",
                    }}
                  >
                    <div className="mb-1.5 font-medium">Año {row.anio}</div>
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }} />
                      Valor depto: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.valorDepto)}</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--signal-red)" }} />
                      − Deuda: <span className="ml-auto font-mono" style={{ color: "var(--signal-red)" }}>−{fmt(row.deudaPendiente)}</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: "var(--franco-text-secondary)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--signal-red)" }} />
                      Aporte acum: <span className="ml-auto font-mono" style={{ color: "var(--franco-text)" }}>{fmt(row.aporteAcum)}</span>
                    </div>
                    <div className="mt-1.5 pt-1.5 flex items-center gap-2" style={{ borderTop: "0.5px dashed var(--franco-border)" }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--franco-text)" }} />
                      <span className="font-medium" style={{ color: "var(--franco-text)" }}>= Patrimonio neto</span>
                      <span className="ml-auto font-mono font-bold" style={{ color: "var(--franco-text)" }}>{fmt(row.patrimonioNeto)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {entregaAnio !== null && entregaAnio <= plazoAnios && (
              <ReferenceLine
                x={entregaAnio}
                stroke="var(--franco-text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: "📦 Entrega", position: "top", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              />
            )}
            {/* Aporte acumulado en Signal Red — uso #8 explícito skill (egresos
                visualizados en gráficos / dinero que pones) */}
            <Bar
              dataKey="aporteAcum"
              stackId="composicion"
              fill="var(--signal-red)"
              name="Aporte acumulado"
              barSize={Math.max(8, Math.floor(280 / Math.max(plazoAnios, 1)))}
            />
            {/* Valor depto en Ink primary opacity 50% — proyección de valor */}
            <Bar
              dataKey="valorDepto"
              stackId="composicion"
              fill="var(--franco-text)"
              fillOpacity={0.5}
              name="Valor depto"
              barSize={Math.max(8, Math.floor(280 / Math.max(plazoAnios, 1)))}
            />
            {/* Patrimonio neto en Ink primary sólido — el resultado neto */}
            <Line
              type="monotone"
              dataKey="patrimonioNeto"
              stroke="var(--franco-text)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--franco-card)", stroke: "var(--franco-text)", strokeWidth: 1.5 }}
              name="Patrimonio neto"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center font-mono" style={{ fontSize: 10, color: "var(--franco-text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--signal-red)" }} />
          Aporte acumulado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--franco-text)", opacity: 0.5 }} />
          Valor depto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 rounded" style={{ background: "var(--franco-text)", height: 2 }} />
          Patrimonio neto
        </span>
      </div>

      {/* Checkpoint final — chart conclusive box (skill 7.B.3) */}
      {last && (
        <div
          className="flex justify-between items-start gap-3"
          style={{
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            borderLeft: "3px solid var(--franco-text-secondary)",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
            marginTop: "1.25rem",
          }}
        >
          {/* Izq: label uppercase + context Sans */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
            >
              Patrimonio al año {plazoAnios}
            </span>
            <span className="font-body" style={{ fontSize: 12, color: "var(--franco-text-secondary)" }}>
              vs {fmtMoney(last.aporteAcum, currency)} aportados
            </span>
          </div>
          {/* Der: valor mono bold + delta mono pequeño */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{ fontSize: 22, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmtMoney(last.patrimonioNeto, currency)}
            </span>
            <span
              className="font-mono whitespace-nowrap"
              style={{ fontSize: 11, color: ganancia >= 0 ? "var(--franco-text-secondary)" : "var(--signal-red)" }}
            >
              {ganancia >= 0 ? "+" : "−"}{fmtMoney(Math.abs(ganancia), currency)} ({ganancia >= 0 ? "+" : "−"}{Math.round(Math.abs(gananciaPct))}%)
            </span>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <span style={{ display: "none" }} aria-hidden>{valorUF}</span>
    </div>
  );
}

// ─── Venta o Refi (acordeón 3 · Capa 3) ──────────────
function VentaRefiContent({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { plazoAnios } = useSimulation();
  const [mode, setMode] = useState<"venta" | "refi">("venta");
  const [ltv, setLtv] = useState<0.60 | 0.70 | 0.75>(0.70);

  const data = useMemo(() => {
    const pieCLP = metrics.pieCLP ?? 0;
    const precioCLP = metrics.precioCLP ?? 0;
    const inversionInicial = pieCLP + Math.round(precioCLP * 0.02);

    const lastProy = projections[Math.min(plazoAnios, projections.length) - 1];
    if (!lastProy) {
      return null;
    }
    const valorDepto = lastProy.valorPropiedad;
    const deudaPendiente = lastProy.saldoCredito;
    const flujoAcumulado = lastProy.flujoAcumulado;
    const aporteAcum = inversionInicial + Math.abs(Math.min(0, flujoAcumulado));

    // Venta (sin notaría — ya no se resta)
    const comisionVenta = Math.round(valorDepto * 0.02);
    const teQueda = valorDepto - deudaPendiente - comisionVenta;
    const gananciaNeta = teQueda - aporteAcum;
    const gananciaPct = aporteAcum > 0 ? (gananciaNeta / aporteAcum) * 100 : 0;

    // Refi — LTV parametrizable
    const nuevoCredito = Math.round(valorDepto * ltv);
    const liquidez = nuevoCredito - deudaPendiente;

    return {
      valorDepto,
      deudaPendiente,
      comisionVenta,
      teQueda,
      aporteAcum,
      gananciaNeta,
      gananciaPct,
      nuevoCredito,
      liquidez,
      LTV: ltv,
    };
  }, [projections, metrics, plazoAnios, ltv]);

  const fmt = (n: number) => fmtMoney(n, currency);

  // Entrega futura: si el horizonte elegido está antes de la entrega, no aplica venta/refi
  const mesesPreEntrega = useMemo(() => {
    if (!inputData.fechaEntrega || inputData.estadoVenta === "inmediata") return 0;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const ent = new Date(a, (me || 1) - 1);
    return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }, [inputData.fechaEntrega, inputData.estadoVenta]);
  const horizonBeforeDelivery = mesesPreEntrega > 0 && plazoAnios * 12 <= mesesPreEntrega;

  if (horizonBeforeDelivery || !data) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg p-4"
        style={{ border: "1px solid color-mix(in srgb, var(--signal-red) 30%, transparent)", background: "color-mix(in srgb, var(--signal-red) 5%, transparent)" }}
      >
        <Clock className="h-5 w-5 shrink-0" style={{ color: "var(--signal-red)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--franco-text)" }}>
            No puedes vender ni refinanciar antes de la entrega
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--franco-text-secondary)" }}>
            Aumenta el plazo del slider para ver escenarios de salida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle segmented */}
      <div
        className="grid grid-cols-2 p-0.5 rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("venta")}
          className="py-2 px-3 rounded-md font-body text-sm transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
          style={{
            background: mode === "venta" ? "rgba(250,250,248,0.08)" : "transparent",
            color: mode === "venta" ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
            fontWeight: mode === "venta" ? 600 : 400,
            boxShadow: mode === "venta" ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            border: mode === "venta" ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
          }}
        >
          Si vendes
        </button>
        <button
          type="button"
          onClick={() => setMode("refi")}
          className="py-2 px-3 rounded-md font-body text-sm transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
          style={{
            background: mode === "refi" ? "rgba(250,250,248,0.08)" : "transparent",
            color: mode === "refi" ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
            fontWeight: mode === "refi" ? 600 : 400,
            boxShadow: mode === "refi" ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            border: mode === "refi" ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
          }}
        >
          Si refinancias
        </button>
      </div>

      {mode === "venta" ? (
        <>
          {/* Hero venta — Ink secundario per skill 7.B.4 */}
          <div
            style={{
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
              borderLeft: "3px solid var(--franco-text-secondary)",
              borderRadius: "0 8px 8px 0",
              padding: "14px 18px",
            }}
          >
            <p
              className="font-mono uppercase m-0 mb-1"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
            >
              Al vender en el año {plazoAnios} recibes
            </p>
            <p
              className="font-mono font-bold m-0 whitespace-nowrap"
              style={{ fontSize: 28, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmt(data.teQueda)}
            </p>
          </div>

          {/* Tabla desglose */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
            }}
          >
            {[
              { label: "Valor del depto", value: data.valorDepto, color: "var(--franco-text)", sign: "+" },
              { label: "− Deuda pendiente", value: data.deudaPendiente, color: "var(--signal-red)", sign: "−" },
              { label: "− Comisión venta (2%)", value: data.comisionVenta, color: "var(--signal-red)", sign: "−" },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between px-4 py-2.5"
                style={{
                  borderTop: i === 0 ? "none" : "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
                }}
              >
                <span className="font-body" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)" }}>
                  {row.label}
                </span>
                <span className="font-mono font-semibold whitespace-nowrap" style={{ fontSize: 13, color: row.color }}>
                  {row.sign}{fmt(row.value)}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between px-4 py-3"
              style={{
                borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 20%, transparent)",
                background: "color-mix(in srgb, var(--ink-400) 5%, transparent)",
              }}
            >
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}>
                = Te queda
              </span>
              <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 16, color: "var(--franco-text)" }}>
                {fmt(data.teQueda)}
              </span>
            </div>
          </div>

          {/* Badge ganancia neta */}
          <div
            className="rounded-lg p-3"
            style={{
              background: `color-mix(in srgb, ${data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 10%, transparent)`,
              border: `0.5px solid color-mix(in srgb, ${data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 30%, transparent)`,
            }}
          >
            <p className="font-body m-0" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 80%, transparent)" }}>
              Ganancia neta{" "}
              <span
                className="font-mono font-bold"
                style={{ color: data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)" }}
              >
                {data.gananciaNeta >= 0 ? "+" : "−"}{fmt(Math.abs(data.gananciaNeta))}
              </span>{" "}
              ({data.gananciaNeta >= 0 ? "+" : "−"}{Math.round(Math.abs(data.gananciaPct))}%) vs inversión total de{" "}
              <span className="font-mono" style={{ color: "var(--franco-text)" }}>
                {fmt(data.aporteAcum)}
              </span>
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Hero refi — Ink secundario per skill 7.B.4 (mismo treatment que venta) */}
          <div
            style={{
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
              borderLeft: "3px solid var(--franco-text-secondary)",
              borderRadius: "0 8px 8px 0",
              padding: "14px 18px",
            }}
          >
            <p
              className="font-mono uppercase m-0 mb-1"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
            >
              Sin vender, puedes sacar
            </p>
            <p
              className="font-mono font-bold m-0 whitespace-nowrap"
              style={{ fontSize: 28, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmt(data.liquidez)}
            </p>
          </div>

          {/* Selector LTV */}
          <div className="flex items-center gap-3">
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "1.2px", color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" }}
            >
              LTV banco
            </span>
            <div
              className="grid grid-cols-3 p-0.5 rounded-md flex-1 max-w-[220px]"
              style={{
                background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
                border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
              }}
            >
              {[0.60, 0.70, 0.75].map((opt) => {
                const active = ltv === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLtv(opt as 0.60 | 0.70 | 0.75)}
                    className="py-1.5 px-2 rounded-sm font-mono transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
                    style={{
                      fontSize: 11,
                      background: active ? "rgba(250,250,248,0.08)" : "transparent",
                      color: active ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
                      fontWeight: active ? 700 : 400,
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                      border: active ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
                    }}
                  >
                    {Math.round(opt * 100)}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabla desglose refi */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
            }}
          >
            {[
              { label: "Valor del depto", value: fmt(data.valorDepto), color: "var(--franco-text)" },
              { label: `× LTV ${Math.round(data.LTV * 100)}%`, value: "", color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" },
              { label: "= Nuevo crédito", value: fmt(data.nuevoCredito), color: "var(--franco-text)", bold: true },
              { label: "− Deuda actual", value: "−" + fmt(data.deudaPendiente), color: "var(--signal-red)" },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between px-4 py-2.5"
                style={{
                  borderTop: i === 0 ? "none" : "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
                }}
              >
                <span className="font-body" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)" }}>
                  {row.label}
                </span>
                <span
                  className="font-mono font-semibold whitespace-nowrap"
                  style={{ fontSize: 13, color: row.color, fontWeight: row.bold ? 700 : 600 }}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between px-4 py-3"
              style={{
                borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 20%, transparent)",
                background: "color-mix(in srgb, var(--franco-text) 5%, transparent)",
              }}
            >
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}>
                = Liquidez disponible
              </span>
              <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 16, color: "var(--franco-text)" }}>
                {fmt(data.liquidez)}
              </span>
            </div>
          </div>

          {/* Badge refi */}
          {/* Refi badge final — Ink secundario consistente con hero refi */}
          <div
            className="rounded-lg p-3"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
              border: "0.5px solid var(--franco-border)",
            }}
          >
            <p className="font-body m-0" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 80%, transparent)" }}>
              Mantienes el depto y liberas{" "}
              <span className="font-mono font-bold" style={{ color: "var(--franco-text)" }}>
                {fmt(data.liquidez)}
              </span>{" "}
              de capital.
            </p>
          </div>
        </>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <span style={{ display: "none" }} aria-hidden>{valorUF}</span>
    </div>
  );
}

// ─── Capa 3 unificada: un único acordeón con todo adentro ────
function Capa3Unificado({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const [open, setOpen] = useState(false);

  const sectionHeader = (num: string, label: string, title: string) => (
    <div style={{ marginBottom: 14 }}>
      <span
        className="font-mono uppercase block mb-1.5"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--franco-text-tertiary)",
        }}
      >
        {num} · {label}
      </span>
      <h3
        className="font-heading font-bold m-0"
        style={{ fontSize: 20, lineHeight: 1.25, color: "var(--franco-text)" }}
      >
        {title}
      </h3>
    </div>
  );

  if (!open) {
    // CTA promocional colapsado
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left group transition-colors"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--franco-text) 12%, transparent)",
          borderLeft: "3px solid var(--franco-text)",
          borderRadius: "0 10px 10px 0",
          padding: "22px 24px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 12%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 8%, transparent)")}
      >
        <div
          className="flex items-center gap-2 mb-3"
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "1.5px",
              color: "var(--franco-text)",
              fontWeight: 600,
            }}
          >
            🔄 Simulación
          </span>
        </div>

        <div className="mb-2" style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 19, lineHeight: 1.35, color: "var(--franco-text)" }}>
          ¿Qué pasaría si la plusvalía fuera 6%?
        </div>
        <div className="mb-4" style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 19, lineHeight: 1.35, color: "var(--franco-text)" }}>
          ¿Y si vendes en 15 años?
        </div>

        <p
          className="font-body m-0 mb-4"
          style={{
            fontSize: 13,
            color: "color-mix(in srgb, var(--franco-text) 65%, transparent)",
            lineHeight: 1.5,
          }}
        >
          Explora distintos escenarios sin afectar tu análisis principal.
        </p>

        <div className="flex justify-end">
          <span
            className="font-body font-medium inline-flex items-center gap-1"
            style={{
              fontSize: 13,
              color: "var(--franco-text)",
            }}
          >
            Explorar escenarios
            <span aria-hidden>→</span>
          </span>
        </div>
      </button>
    );
  }

  // Contenido expandido — UNA mega-card con header + 4 sub-secciones separadas
  // por dividers solid (skill Patrón 7.B).
  return (
    <div
      style={{
        background: "var(--franco-card)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: "12px",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Section header único arriba */}
      <div
        className="flex items-start justify-between gap-3"
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "0.5px solid var(--franco-border)",
        }}
      >
        <div>
          <span
            className="font-mono uppercase block mb-1"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              color: "var(--franco-text)",
              fontWeight: 600,
            }}
          >
            🔄 Simulación interactiva
          </span>
          <p
            className="font-body m-0"
            style={{
              fontSize: 13,
              color: "var(--franco-text-secondary)",
            }}
          >
            Explora distintos escenarios sin afectar el análisis principal
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar simulación"
          className="shrink-0 rounded-md transition-colors"
          style={{
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--franco-text-secondary)",
            background: "transparent",
            border: "0.5px solid var(--franco-border)",
            cursor: "pointer",
          }}
        >
          ↑
        </button>
      </div>

      {/* Sub-sección 07 · ESCENARIOS */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("07", "Escenarios", "Ajusta plazo y plusvalía")}
        <SliderSimulacion variant="integrated" />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 08 · INDICADORES */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("08", "Indicadores", "Rendimiento y métricas")}
        <IndicadoresRentabilidadContent projections={projections} metrics={metrics} />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 09 · PATRIMONIO */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("09", "Patrimonio", "Cómo crece tu capital")}
        <GraficoPatrimonioContent
          projections={projections}
          metrics={metrics}
          inputData={inputData}
          currency={currency}
          valorUF={valorUF}
        />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 10 · VENTA O REFINANCIAMIENTO */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("10", "Venta o refinanciamiento", "Cómo materializas la inversión")}
        <VentaRefiContent
          projections={projections}
          metrics={metrics}
          inputData={inputData}
          currency={currency}
          valorUF={valorUF}
        />
      </div>
    </div>
  );
}

// Copy de tooltips por veredicto — usado en el badge del callout (Fase 17).
const VERDICT_TOOLTIPS: Record<string, string> = {
  COMPRAR: "El depto cumple los criterios de inversión: buena rentabilidad, flujo razonable y plusvalía proyectada.",
  "AJUSTA EL PRECIO": "El depto tiene potencial pero el precio actual no lo justifica. Negociar puede convertirlo en buena inversión.",
  "BUSCAR OTRA": "Los números no cierran. Mejor dedicar el presupuesto a otra propiedad o zona.",
};

const FRANCO_SCORE_TOOLTIP = "Puntaje 0-100 que combina rentabilidad (30%), flujo de caja (25%), plusvalía proyectada (25%) y eficiencia (20%) del depto. Sobre 70: COMPRAR. Entre 50-70: AJUSTA EL PRECIO. Bajo 50: BUSCAR OTRA.";

// Tooltips de las 3 DatoCards del Hero. Lookup por label (los labels son
// hardcoded por buildHeroDatosClave). Si una label nueva aparece sin entry,
// el card se renderiza sin tooltip (degradación graceful).
const DATO_TOOLTIPS: Record<string, string> = {
  "Aporte mensual": "Lo que sale de tu bolsillo cada mes porque el arriendo no cubre los costos (dividendo + gastos + contribuciones + mantención).",
  "Te sobra mensual": "Excedente mensual: el arriendo cubre todos los costos y queda saldo a tu favor.",
  "Precio sugerido": "Precio recomendado por Franco para que la inversión tenga sentido financiero. Útil como punto de partida para negociar.",
  "Ventaja": "Diferencia favorable entre el precio que pagas y el valor de mercado del depto en la zona. Compras bajo mercado.",
  "Sobreprecio": "Diferencia desfavorable: estás pagando más que el valor de mercado en la zona.",
  "Precio alineado": "Tu precio de compra coincide con el valor de mercado de la zona (±2% de diferencia).",
};

// ─── AI Analysis Section (v2) ────────────────────────
const VERDICT_STYLES: Record<string, { color: string; bg: string; border: string; bgInner: string; borderInner: string }> = {
  COMPRAR: {
    color: "var(--franco-positive)",
    bg: "color-mix(in srgb, var(--franco-positive) 8%, transparent)",
    border: "color-mix(in srgb, var(--franco-positive) 30%, transparent)",
    bgInner: "color-mix(in srgb, var(--franco-positive) 18%, transparent)",
    borderInner: "color-mix(in srgb, var(--franco-positive) 40%, transparent)",
  },
  "BUSCAR OTRA": {
    color: "var(--signal-red)",
    bg: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
    border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
    bgInner: "color-mix(in srgb, var(--signal-red) 12%, transparent)",
    borderInner: "color-mix(in srgb, var(--signal-red) 30%, transparent)",
  },
  "AJUSTA EL PRECIO": {
    color: "var(--signal-red)",
    bg: "color-mix(in srgb, var(--signal-red) 8%, transparent)",
    border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
    bgInner: "color-mix(in srgb, var(--signal-red) 15%, transparent)",
    borderInner: "color-mix(in srgb, var(--signal-red) 30%, transparent)",
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
    subtexto: flujo < 0 ? "Sale de tu bolsillo" : "Entra a tu bolsillo",
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

  // 3) Pasada / Sobreprecio / Precio alineado — vs valor de mercado Franco
  const precioUF = results?.metrics?.valorMercadoUsuarioUF ?? 0; // no siempre viene
  const vmFrancoUF = results?.metrics?.valorMercadoFrancoUF ?? 0;
  const precioCLP = results?.metrics?.precioCLP ?? 0;
  const vmFrancoCLP = vmFrancoUF > 0 ? vmFrancoUF * (valorUF || 0) : precioCLP;
  const diferenciaCLP = vmFrancoCLP - precioCLP;
  const pctDiferencia = vmFrancoCLP > 0 ? (Math.abs(diferenciaCLP) / vmFrancoCLP) * 100 : 0;
  const esPasada = diferenciaCLP > 0 && pctDiferencia > 2;
  const esSobreprecio = diferenciaCLP < 0 && pctDiferencia > 2;

  let pasadaLabel: string;
  let pasadaValorCLP: string;
  let pasadaValorUF: string;
  let pasadaSub: string;
  let pasadaColor: import("@/lib/types").DatoClave["color"];
  const fmtCLPSigned = (v: number) => (v >= 0 ? "+$" : "−$") + Math.round(Math.abs(v)).toLocaleString("es-CL");
  const fmtUFSigned = (v: number) => {
    const uf = v / (valorUF || 1);
    return (v >= 0 ? "+UF " : "−UF ") + Math.round(Math.abs(uf)).toLocaleString("es-CL");
  };

  let pasadaIsLabel: boolean;
  if (esPasada) {
    pasadaLabel = "Ventaja";
    pasadaValorCLP = fmtCLPSigned(diferenciaCLP);
    pasadaValorUF = fmtUFSigned(diferenciaCLP);
    pasadaSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% bajo mercado`;
    pasadaColor = "green";
    pasadaIsLabel = true; // etiqueta cuantitativa sin verbo
  } else if (esSobreprecio) {
    pasadaLabel = "Sobreprecio";
    pasadaValorCLP = fmtCLPSigned(diferenciaCLP);
    pasadaValorUF = fmtUFSigned(diferenciaCLP);
    pasadaSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% sobre mercado`;
    pasadaColor = "red";
    pasadaIsLabel = true; // etiqueta cuantitativa sin verbo
  } else {
    // Precio y vmFranco coinciden (≤2% de diferencia). En vez de mostrar
    // "≈ UF 0" sin contexto (semánticamente confuso), mostrar el precio de
    // compra como valor del card y un subtexto claro.
    pasadaLabel = "Precio alineado";
    pasadaValorCLP = "$" + Math.round(precioCLP).toLocaleString("es-CL");
    pasadaValorUF = "UF " + Math.round(precioCLP / (valorUF || 1)).toLocaleString("es-CL");
    pasadaSub = "Tu precio coincide con mercado";
    pasadaColor = "neutral";
    pasadaIsLabel = false; // verbo "coincide" conjugado → narrative
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _precioUFUnused = precioUF;
  const retornoCard: import("@/lib/types").DatoClave = {
    label: pasadaLabel,
    valor_clp: pasadaValorCLP,
    valor_uf: pasadaValorUF,
    subtexto: pasadaSub,
    isLabel: pasadaIsLabel,
    color: pasadaColor,
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
      red: "text-signal-red",
      green: "text-[var(--franco-positive)]",
      neutral: "text-[var(--franco-text)]",
      accent: "text-[var(--franco-text)]",
    } as Record<string, string>
  )[dato.color] || "text-[var(--franco-text)]";

  // Featured (accent) card: bg elevated + border 1.5px Signal Red — se siente
  // elevada respecto a las cards normales. Normal: bg card + border 0.5px
  // transparent (sin border visible, layout reservation only).
  const borderClass = isAccent
    ? "border-[1.5px] border-signal-red"
    : "border-[0.5px] border-transparent";
  const bgClass = isAccent
    ? "bg-[var(--franco-elevated)]"
    : "bg-[var(--franco-card)]";
  const labelClass = isAccent
    ? "text-signal-red font-medium"
    : "text-[var(--franco-text-secondary)]";

  const tooltip = DATO_TOOLTIPS[dato.label];

  return (
    <div className={`${bgClass} rounded-xl p-4 ${borderClass}`}>
      <p className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[1.5px] mb-1.5 ${labelClass}`}>
        <span>{dato.label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </p>
      <p className={`font-mono text-[22px] font-semibold m-0 ${colorClass}`}>
        {valor}
      </p>
      {dato.subtexto && (
        dato.isLabel ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] mt-1 m-0">
            {dato.subtexto}
          </p>
        ) : (
          <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1 m-0">
            {dato.subtexto}
          </p>
        )
      )}
    </div>
  );
}

// ─── Dashboard layout (hero + 2×2 grid + drawer) ────
function HeroTopStrip({
  score,
  veredicto,
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  currency,
  onCurrencyChange,
  badgeBg,
  badgeText,
  badgeBorder,
  toggleGroupBorder,
  dividerDashedColor,
}: {
  score: number;
  veredicto: string;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string | undefined;
  toggleGroupBorder: string;
  dividerDashedColor: string;
}) {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  return (
    <div className="px-5 md:px-8 py-4 md:py-5">

      {/* ROW 1 — prop-top: title + subtitle (izq) | toggle CLP/UF (der) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="font-heading font-bold text-[18px] md:text-[22px] text-[var(--franco-text)] m-0 leading-[1.2] truncate">
            {propiedadTitle}
          </h2>
          {propiedadSubtitle && (
            <p className="font-body text-[11px] md:text-[12px] text-[var(--franco-text-secondary)] m-0 truncate">
              {propiedadSubtitle}
            </p>
          )}
        </div>
        <div
          className="flex bg-[var(--franco-bar-track)] rounded-md p-0.5 self-start md:self-center shrink-0"
          style={{ border: `0.5px solid ${toggleGroupBorder}` }}
        >
          <button
            type="button"
            onClick={() => onCurrencyChange("CLP")}
            className={`font-mono text-[10px] px-2.5 py-1 rounded font-medium tracking-[0.5px] transition-colors ${
              currency === "CLP"
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "bg-transparent text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text)]"
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
                : "bg-transparent text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text)]"
            }`}
          >
            UF
          </button>
        </div>
      </div>

      {/* DIVIDER DASHED entre prop-top y parallel-row */}
      <div
        className="my-4 md:my-5"
        style={{ borderTop: `0.5px dashed ${dividerDashedColor}` }}
      />

      {/* ROW 2 — parallel-row: metadata 3x2 (desktop izq) | divider vertical | score+badge (desktop der) */}
      {/* Mobile: SCORE primero, METADATA segundo (skill regla dura) */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_1.4fr] md:gap-6 md:items-start">

        {/* Metadata 2x3 mobile / 3x2 desktop — siempre order-2 (mobile abajo / desktop derecha) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-2 shrink-0 order-2">
          {metadataItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 font-mono text-[8px] md:text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] whitespace-nowrap">
                <span>{item.label}</span>
                {item.tooltip && <InfoTooltip content={item.tooltip} />}
              </span>
              <span className="font-mono text-[12px] md:text-[13px] font-medium text-[var(--franco-text)] whitespace-nowrap">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Score block — siempre order-1 (mobile arriba / desktop izquierda).
            Vertical divider Ink en md+ a la derecha del score block.
            Layout post-Fase 18:
              [FRANCO SCORE ?]   [BADGE VEREDICTO]
              [score]   [────barra────]
              BUSCAR · AJUSTA · COMPRAR */}
        <div className="order-1 md:pr-6 md:border-r md:border-[color-mix(in_srgb,var(--franco-text)_12%,transparent)]">
          {/* Header row: label "Franco Score" + badge a la derecha.
              Tracking reducido (1.5px label / 1px badge) y padding compacto
              para que "BUSCAR OTRA" (badge más largo) entre en el ancho 1fr
              del score block en desktop. */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="inline-flex items-center gap-1 font-mono text-[8px] md:text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0">
              <span>Franco Score</span>
              <InfoTooltip content={FRANCO_SCORE_TOOLTIP} />
            </p>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span
                className="font-mono text-[10px] font-semibold tracking-[1px] uppercase px-2 py-1 rounded whitespace-nowrap text-center"
                style={{ color: badgeText, background: badgeBg, border: badgeBorder }}
              >
                {veredicto}
              </span>
              <InfoTooltip content={VERDICT_TOOLTIPS[veredicto] ?? VERDICT_TOOLTIPS["AJUSTA EL PRECIO"]} />
            </span>
          </div>

          {/* Score number izq + bar+axis a la derecha (horizontal) */}
          <div className="flex items-center gap-3">
            <p className="font-mono text-[28px] md:text-[32px] font-bold leading-none text-[var(--franco-text)] m-0 shrink-0">
              {score}
            </p>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* GRADIENT INVARIANT — mismo en los 3 veredictos per skill */}
              <div
                className="rounded-[3px] relative"
                style={{
                  height: 5,
                  background: "linear-gradient(90deg, var(--signal-red) 0%, var(--ink-500) 50%, var(--ink-400) 100%)",
                }}
              >
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 11,
                    height: 11,
                    left: `${clampedScore}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "var(--franco-text)",
                    border: "2px solid var(--franco-bg)",
                  }}
                />
              </div>
              <div className="flex justify-between font-mono text-[7px] text-[var(--franco-text-secondary)] uppercase tracking-[1px]">
                <span>BUSCAR</span>
                <span>AJUSTA</span>
                <span>COMPRAR</span>
              </div>
            </div>
          </div>
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
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  results,
  valorUF,
}: {
  data: import("@/lib/types").AIAnalysisV2;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  results: import("@/lib/types").FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  // v.color sigue usándose para la numeración "01 · Veredicto" tag (consistencia con
  // VERDICT_STYLES). El resto del styling vive en helpers veredicto-based abajo.
  const v = getVerdictStyles(veredicto);
  const isCompra = veredicto === "COMPRAR";
  const isAjusta = veredicto === "AJUSTA EL PRECIO";
  const isBuscar = veredicto === "BUSCAR OTRA";

  // Hero container — bg/border per veredicto (Capa 3 Patrón 1)
  const heroContainerBg = isCompra
    ? "var(--franco-card)"
    : isBuscar
      ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
      : "color-mix(in srgb, var(--franco-text) 4%, transparent)"; // AJUSTA Ink secundario per skill
  const heroContainerBorder = isCompra
    ? "0.5px solid var(--franco-border)"
    : isBuscar
      ? "0.5px solid color-mix(in srgb, var(--signal-red) 35%, transparent)"
      : "0.5px solid color-mix(in srgb, var(--franco-text) 12%, transparent)";

  // Divider dashed entre prop-top y parallel-row (dentro de HeroTopStrip)
  const dividerDashedColor = isCompra
    ? "var(--franco-border)"
    : "color-mix(in srgb, var(--signal-red) 20%, transparent)";

  // Badge / pill 3-case (skill Patrón 1):
  // BUSCAR → Signal Red sólido + white | AJUSTA → outline (bg page + Signal Red text + border) | COMPRAR → Ink invertido
  const badgeBg = isCompra
    ? "var(--franco-text)"
    : isAjusta
      ? "var(--franco-bg)"
      : "var(--signal-red)";
  const badgeText = isCompra
    ? "var(--franco-bg)"
    : isAjusta
      ? "var(--signal-red)"
      : "white";
  const badgeBorder = isAjusta ? "0.5px solid var(--franco-border)" : undefined;

  // Verdict callout banner — bg/border per veredicto
  // - BUSCAR OTRA: wash Signal Red 8%
  // - AJUSTA EL PRECIO: var(--franco-card) (Hero tiene wash Ink, callout
  //   destaca con color de Hero base + acentos Signal Red en pill/label)
  // - COMPRAR: var(--franco-elevated) (Hero ES var(--franco-card), elevated
  //   crea elevación visible sin tinte cromático)
  const calloutBg = isBuscar
    ? "color-mix(in srgb, var(--signal-red) 8%, transparent)"
    : isCompra
      ? "var(--franco-elevated)"
      : "var(--franco-card)"; // AJUSTA
  const calloutBorder = isBuscar
    ? "none"
    : "0.5px solid var(--franco-border)"; // COMPRAR + AJUSTA con border sutil

  // Toggle CLP/UF group border (tintado per veredicto)
  // AJUSTA bumped a Signal Red 35% (era Ink 12% imperceptible). Esto hace al toggle
  // border de AJUSTA más visible que el de BUSCAR (25%) — la jerarquía global
  // BUSCAR > AJUSTA se mantiene vía container wash (BUSCAR signal-red 6% vs
  // AJUSTA Ink 4%).
  const toggleGroupBorder = isCompra
    ? "var(--franco-border)"
    : isBuscar
      ? "color-mix(in srgb, var(--signal-red) 25%, transparent)"
      : "color-mix(in srgb, var(--signal-red) 35%, transparent)";

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
        background: heroContainerBg,
        border: heroContainerBorder,
      }}
    >
      {/* FRANJA SUPERIOR */}
      <HeroTopStrip
        score={score}
        veredicto={veredicto}
        propiedadTitle={propiedadTitle}
        propiedadSubtitle={propiedadSubtitle}
        metadataItems={metadataItems}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        badgeBg={badgeBg}
        badgeText={badgeText}
        badgeBorder={badgeBorder}
        toggleGroupBorder={toggleGroupBorder}
        dividerDashedColor={dividerDashedColor}
      />

      {/* Divider sólido neutro entre HeroTopStrip y CUERPO (no compite con el dashed dentro de HeroTopStrip) */}
      <div
        className="h-px"
        style={{ background: "color-mix(in srgb, var(--franco-text) 12%, transparent)" }}
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
          {isCompra ? "¿Por qué conviene?" : isAjusta ? "¿Conviene si negocias?" : "¿Por qué no conviene?"}
        </h2>

        <div className="font-body text-[14px] md:text-[15px] leading-[1.65] text-[var(--franco-text)] mb-3">
          {renderAiContent(respuesta)}
        </div>

        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-r-lg my-4"
          style={{
            background: calloutBg,
            border: calloutBorder,
          }}
        >
          <span
            className="font-mono text-[11px] font-semibold tracking-[2px] px-2.5 py-1 rounded uppercase shrink-0"
            style={{
              color: badgeText,
              background: badgeBg,
              border: badgeBorder,
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
          state={isCompra ? "neutral" : "negative"}
          className="mt-5"
          style={{
            // - BUSCAR OTRA: wash Signal Red 6%
            // - AJUSTA EL PRECIO: var(--franco-card) (state="negative" preserva
            //   borderLeft Signal Red + label Signal Red vía StateBox internal)
            // - COMPRAR: var(--franco-elevated) (Hero base es card; elevated
            //   crea elevación visible sin tinte cromático)
            background: isBuscar
              ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
              : isCompra
                ? "var(--franco-elevated)"
                : "var(--franco-card)",
            borderRadius: "0 8px 8px 0",
            ...(isCompra ? { borderLeft: "3px solid var(--franco-text-secondary)" } : {}),
          }}
        >
          {isCompra ? (
            <p
              className="font-mono text-[10px] uppercase tracking-[2px] mb-2 m-0 font-semibold"
              style={{ color: "var(--franco-text-tertiary)" }}
            >
              Considera antes de avanzar:
            </p>
          ) : (
            <span
              className="font-mono text-[10px] font-semibold tracking-[2px] uppercase inline-block px-2.5 py-1 rounded mb-2"
              style={{ color: badgeText, background: badgeBg, border: badgeBorder }}
            >
              {isAjusta ? "Antes de negociar:" : "Próximos pasos:"}
            </span>
          )}
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
        sub: isNeg ? "Sale de tu bolsillo" : "Entra a tu bolsillo",
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
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
      // Skill Patrón 2: KPI binario (signal-red criticidad / var(--franco-text)
      // neutro). El dato hace el trabajo — la distinción TIR baja vs alta vive
      // en el valor mismo, no en color intermedio.
      return {
        value: `TIR ${tirPct}%`,
        sub: "Rentabilidad anual a 10 años",
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
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
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
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
      color: "var(--signal-red)",
    };
  }

  return { value: "—", sub: "", color: "var(--franco-text)" };
}

function MiniCard({
  section,
  numero,
  label,
  data,
  currency,
  onClick,
  results,
  valorUF,
}: {
  section: MiniCardSection;
  /** Numeración mono per skill líneas 254-258 ("02 · COSTO MENSUAL", etc). */
  numero: string;
  label: string;
  data: import("@/lib/types").AISection | import("@/lib/types").AINegociacionSection;
  currency: "CLP" | "UF";
  onClick: () => void;
  results: import("@/lib/types").FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  const punchline = getPunchline(section, data, currency, results, valorUF);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)] rounded-[12px] p-[1.125rem] text-left transition-colors duration-200 min-h-[150px] md:min-h-[168px] flex flex-col w-full"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[1.5px] mb-2 font-medium m-0 text-[var(--franco-text-secondary)]"
      >
        {numero} · {label}
      </p>
      <h3 className="font-heading font-bold text-[18px] leading-[1.3] mb-2 text-[var(--franco-text)] m-0">
        {(() => {
          // Override pregunta para Costo Mensual según signo del flujo (Fase 19).
          if (section === "costoMensual") {
            const flujo = results?.metrics?.flujoNetoMensual ?? 0;
            if (flujo < -1000) return "¿Cuánto te cuesta mes a mes?";
            if (flujo > 1000) return "¿Cuánto te queda mes a mes?";
            return "¿Cómo queda tu flujo mensual?";
          }
          return data.pregunta;
        })()}
      </h3>
      <p
        className="font-mono text-[22px] font-bold m-0 mb-1 leading-[1.1]"
        style={{ color: punchline.color }}
      >
        {punchline.value}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] mb-auto leading-[1.4] m-0">
        {punchline.sub}
      </p>
      <div className="border-t-[0.5px] border-[var(--franco-border)] mt-4 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)]">
          Leer análisis completo →
        </span>
      </div>
    </button>
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
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
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
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
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

  const hasReadyData = !!aiAnalysis && hasAiV2(aiAnalysis);
  const [loadingDismissed, setLoadingDismissed] = useState(hasReadyData);
  useEffect(() => {
    if (hasReadyData && !loadingDismissed) {
      const t = setTimeout(() => setLoadingDismissed(true), 1100);
      return () => clearTimeout(t);
    }
  }, [hasReadyData, loadingDismissed]);

  const showLoading = (loading && !aiAnalysis) || (hasReadyData && !loadingDismissed);

  if (showLoading) {
    return (
      <div id="informe-pro-section" className="mb-8 rounded-[16px] overflow-hidden">
        <LoadingEditorial isDataReady={hasReadyData} />
      </div>
    );
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
            className="font-body text-sm font-medium text-signal-red hover:underline"
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
        propiedadTitle={propiedadTitle}
        propiedadSubtitle={propiedadSubtitle}
        metadataItems={metadataItems}
        results={results}
        valorUF={valorUF}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <MiniCard
          section="costoMensual"
          numero="02"
          label="Costo mensual"
          data={aiAnalysis.costoMensual}
          currency={currency}
          onClick={() => setActiveDrawer("costoMensual")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="negociacion"
          numero="03"
          label="Negociación"
          data={aiAnalysis.negociacion}
          currency={currency}
          onClick={() => setActiveDrawer("negociacion")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="largoPlazo"
          numero="04"
          label="Largo plazo"
          data={aiAnalysis.largoPlazo}
          currency={currency}
          onClick={() => setActiveDrawer("largoPlazo")}
          results={results}
          valorUF={valorUF}
        />
        <MiniCard
          section="riesgos"
          numero="05"
          label="Riesgos"
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
            <CardTitle className="font-body font-medium text-lg text-[var(--franco-text)]">{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-[var(--franco-text-secondary)]">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          const deltaColor = isFavorable ? "text-[var(--franco-positive)]" : "text-signal-red";
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
  analysesCount?: number;
  isLoggedIn?: boolean;
}) {
  const posthog = usePostHog();
  // Update module-level UF value from server
  if (ufValue) UF_CLP = ufValue;
  const currentAccess = accessLevel;
  const [horizonYears, setHorizonYears] = useState(10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sensHorizon, setSensHorizon] = useState(10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [plusvaliaRate, setPlusvaliaRate] = useState(4.0);
  const [arriendoGrowth, setArriendoGrowth] = useState(3.5);
  const [costGrowth, setCostGrowth] = useState(3.0);
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
  const fmt = useCallback((n: number) => fmtMoney(n, currency), [currency]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fmtAxis = useCallback((n: number) => fmtAxisMoney(n, currency), [currency]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Match motor: arranca desde valor de mercado Franco (si existe) para que
    // Capa 3 con plazo=10 y plusvalía=4% coincida con la TIR de Capa 1.
    const vmFrancoUF = (inputData as AnalisisInput & { valorMercadoFranco?: number }).valorMercadoFranco || inputData.precio;
    let valorPropiedad = vmFrancoUF * UF_CLP;
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
    const INFLACION_UF = 0.03; // match del motor analysis.ts
    for (let anio = 1; anio <= 30; anio++) {
      const mesInicio = (anio - 1) * 12 + 1;
      const mesFin = anio * 12;

      // Mantención crece por antigüedad + inflación de costos
      const antiguedadActual = inputData.antiguedad + anio;
      const mantencionBase = inputData.provisionMantencion || Math.round((precioCLP * getMantencionRate(antiguedadActual)) / 12);
      const mantencion = Math.round(mantencionBase * Math.pow(1 + costGrowthDec, anio - 1));

      // Dividendo (UF fijo) crece con inflación UF ~3% en CLP — match motor
      const dividendoAnio = Math.round(m.dividendo * Math.pow(1 + INFLACION_UF, anio - 1));

      // Usar función centralizada
      const flujoMes = calcFlujoDesglose({
        arriendo: arriendoActual,
        dividendo: dividendoAnio,
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sensScenarios = useMemo(() => {
    if (!results || !m || !inputData) return null;

    const precioCLP = inputData.precio * UF_CLP;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      value: currency === "UF" ? fmtUF(precioUF) : fmtCLP(precioUF * UF_CLP),
    },
    {
      label: "$/M²",
      value: currency === "UF"
        ? `UF ${(Math.round(freePrecioM2 * 100) / 100).toLocaleString("es-CL")}/m²`
        : fmtCLP(freePrecioM2 * UF_CLP),
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
          ? `UF ${(Math.round((arriendoCLP / UF_CLP) * 100) / 100).toLocaleString("es-CL")}/mes`
          : `${fmtCLP(arriendoCLP)}/mes`)
        : "—",
      tooltip: "Arriendo mensual estimado o ajustado por el usuario.",
    },
  ];
  const resolvedVeredicto = results?.veredicto || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");

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
          <DashboardAnalysisSection
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
            valorUF={UF_CLP}
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
              <Capa3Unificado
                projections={dynamicProjections}
                metrics={m}
                inputData={inputData}
                currency={currency}
                valorUF={UF_CLP}
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const projectionFields = hasPanelContent ? (
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
  ) : null;

  // Paneles laterales eliminados (Fase 3). Capa 1+2 usan siempre valores del
  // análisis original; la simulación editable vive en el acordeón Capa 3.
  return (
    <>
      <div className="min-w-0">
        {mainContent}
      </div>
      <ProCTABanner
        analysesCount={analysesCount}
        isLoggedIn={isLoggedIn}
        accessLevel={accessLevel}
        source="results"
      />
    </>
  );
}

