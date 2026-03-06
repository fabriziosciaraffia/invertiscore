"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  Lock, DollarSign, BarChart3, Brain, Calendar,
  Building2, Sparkles, ArrowRightLeft, Target, Shield, MapPin,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";

const UF_CLP = 38800;

const METRIC_TOOLTIPS: Record<string, string> = {
  "Yield Bruto": "Retorno anual bruto sin descontar gastos. Se calcula como (arriendo anual / precio) x 100. Benchmark Santiago: 3.5-4.5%",
  "Yield Neto": "Retorno anual real descontando todos los gastos operativos (GGCC, contribuciones, mantenci\u00f3n, vacancia). Es la m\u00e9trica m\u00e1s honesta de rentabilidad.",
  "CAP Rate": "Net Operating Income / Precio. Est\u00e1ndar internacional para comparar inversiones inmobiliarias. No incluye financiamiento.",
  "Cash-on-Cash": "Retorno anual sobre TU capital invertido (el pie). Si es negativo, est\u00e1s poniendo plata de tu bolsillo cada mes.",
  "ROI Total (10a)": "Retorno total considerando flujo de caja + plusval\u00eda en el per\u00edodo. Incluye el efecto del apalancamiento.",
  "TIR": "Tasa Interna de Retorno. Permite comparar esta inversi\u00f3n con otras alternativas (dep\u00f3sito a plazo, fondos mutuos, etc.)",
  "Payback Pie": "Meses que toma recuperar el pie invertido solo con flujo de caja. N/A si el flujo es negativo.",
  "InvertiScore": "Puntaje de 1-100 que eval\u00faa 5 dimensiones: Rentabilidad (30%), Flujo de Caja (25%), Plusval\u00eda (20%), Riesgo (15%), Ubicaci\u00f3n (10%)",
};

const RADAR_TOOLTIPS: Record<string, string> = {
  "Rentabilidad": "Eval\u00faa yield neto y cash-on-cash. Peso: 30%",
  "Flujo Caja": "Eval\u00faa el flujo de caja mensual neto. Peso: 25%",
  "Plusval\u00eda": "Potencial de apreciaci\u00f3n del valor. Peso: 20%",
  "Bajo Riesgo": "Eval\u00faa antig\u00fcedad, tipo, vacancia y gastos. Peso: 15%",
  "Ubicaci\u00f3n": "Calidad de la ubicaci\u00f3n y demanda de arriendo. Peso: 10%",
};

// Format helpers
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
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n);
}

// Mini score circle for sensitivity
function MiniScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "#059669" : score >= 65 ? "#3b82f6" : score >= 50 ? "#eab308" : score >= 30 ? "#f97316" : "#ef4444";
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: color, color }}>
      {score}
    </div>
  );
}

// Recalculate score for sensitivity (client-side simplified version)
function recalcForSensitivity(
  results: FullAnalysisResult,
  inputData: AnalisisInput | undefined,
  tasaDelta: number,
  arriendoPct: number,
  vacanciaDelta: number
) {
  if (!inputData) return { score: results.score, flujo: results.metrics.flujoNetoMensual, yieldNeto: results.metrics.yieldNeto };

  const modified = { ...inputData };
  modified.tasaInteres = inputData.tasaInteres + tasaDelta;
  modified.arriendo = Math.round(inputData.arriendo * (1 + arriendoPct / 100));
  modified.vacanciaMeses = inputData.vacanciaMeses + vacanciaDelta;

  // Recalc metrics
  const precioCLP = modified.precio * UF_CLP;
  const piePct = modified.piePct / 100;
  const pieCLP = precioCLP * piePct;
  const creditoCLP = precioCLP * (1 - piePct);
  const tasaMensual = modified.tasaInteres / 100 / 12;
  const n = modified.plazoCredito * 12;
  const dividendo = creditoCLP <= 0 ? 0 : tasaMensual === 0 ? Math.round(creditoCLP / n) : Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));

  const ingresoMensual = modified.arriendo;
  const contribucionesMes = Math.round(modified.contribuciones / 3);
  const mantencion = modified.provisionMantencion || Math.round((precioCLP * 0.01) / 12);
  const vacanciaMensual = Math.round((modified.arriendo * modified.vacanciaMeses) / 12);
  const corretajeMensual = Math.round((modified.arriendo * 0.5) / 24);

  const egresosMensuales = dividendo + modified.gastos + contribucionesMes + mantencion + vacanciaMensual + corretajeMensual;
  const flujoNetoMensual = ingresoMensual - egresosMensuales;

  const noi = (ingresoMensual - modified.gastos - contribucionesMes - mantencion - vacanciaMensual) * 12;
  const rentaAnual = ingresoMensual * 12;
  const gastosAnuales = (modified.gastos + contribucionesMes + mantencion + vacanciaMensual + corretajeMensual) * 12;
  const yieldNeto = precioCLP > 0 ? ((rentaAnual - gastosAnuales) / precioCLP) * 100 : 0;
  const capRate = precioCLP > 0 ? (noi / precioCLP) * 100 : 0;
  const cashOnCash = pieCLP > 0 ? ((flujoNetoMensual * 12) / pieCLP) * 100 : 0;
  const precioM2 = modified.superficie > 0 ? modified.precio / modified.superficie : 0;

  // Score calc (mirrors analysis.ts)
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    const t = (value - inMin) / (inMax - inMin);
    return outMin + clamp(t, 0, 1) * (outMax - outMin);
  };

  const COMUNAS_PREMIUM = ["providencia", "las condes", "vitacura", "lo barnechea", "\u00f1u\u00f1oa", "la reina", "santiago centro", "vi\u00f1a del mar", "con con"];
  const isPremium = COMUNAS_PREMIUM.some((c) => modified.comuna.toLowerCase().includes(c));

  let rentabilidadScore = lerp(yieldNeto, 1, 6, 20, 100);
  if (cashOnCash > 5) rentabilidadScore = Math.min(100, rentabilidadScore + 10);
  else if (cashOnCash < 0) rentabilidadScore = Math.max(0, rentabilidadScore - 15);
  rentabilidadScore = clamp(rentabilidadScore, 0, 100);

  let flujoCajaScore = lerp(flujoNetoMensual, -200000, 200000, 5, 95);
  if (flujoNetoMensual < 0) flujoCajaScore = Math.max(0, flujoCajaScore - 10);
  else if (flujoNetoMensual > 100000) flujoCajaScore = Math.min(100, flujoCajaScore + 5);
  flujoCajaScore = clamp(flujoCajaScore, 0, 100);

  let plusvaliaScore = isPremium ? 85 : 55;
  plusvaliaScore += isPremium ? lerp(precioM2, 30, 120, 10, -10) : lerp(precioM2, 30, 100, 15, -15);
  if (modified.enConstruccion || modified.antiguedad <= 2) plusvaliaScore += 10;
  else if (modified.antiguedad >= 3 && modified.antiguedad <= 8) plusvaliaScore += 5;
  else if (modified.antiguedad > 20) plusvaliaScore -= 15;
  plusvaliaScore = clamp(plusvaliaScore, 0, 100);

  let riesgoScore = 60;
  if (modified.tipo.toLowerCase().includes("departamento")) riesgoScore += 8;
  if (modified.antiguedad < 10 || modified.enConstruccion) riesgoScore += 8;
  else if (modified.antiguedad > 25) riesgoScore -= 15;
  if (capRate > 3) riesgoScore += 8;
  const ratioGastos = ingresoMensual > 0 ? modified.gastos / ingresoMensual : 1;
  if (ratioGastos < 0.2) riesgoScore += 5;
  else if (ratioGastos > 0.35) riesgoScore -= 10;
  if (modified.vacanciaMeses > 2) riesgoScore -= 10;
  riesgoScore = clamp(riesgoScore, 0, 100);

  const ubicacionScore = clamp(isPremium ? 92 : 55, 0, 100);

  const score = clamp(Math.round(
    rentabilidadScore * 0.30 +
    flujoCajaScore * 0.25 +
    plusvaliaScore * 0.20 +
    riesgoScore * 0.15 +
    ubicacionScore * 0.10
  ), 0, 100);

  return { score, flujo: flujoNetoMensual, yieldNeto: Math.round(yieldNeto * 100) / 100 };
}

function PremiumOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/90 px-6 py-4 shadow-lg">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">Disponible en Informe Premium</span>
      </div>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children, premium = false, unlocked = false }: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  premium?: boolean;
  unlocked?: boolean;
}) {
  return (
    <div className="relative mb-8">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle>{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {premium && !unlocked && <PremiumOverlay />}
    </div>
  );
}

// Currency toggle component
function CurrencyToggle({ currency, onToggle }: { currency: "CLP" | "UF"; onToggle: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-8 w-20 items-center rounded-full bg-muted p-1 transition-colors"
        >
          <div
            className={`absolute h-6 w-9 rounded-full bg-primary transition-transform ${
              currency === "UF" ? "translate-x-[40px]" : "translate-x-0"
            }`}
          />
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "CLP" ? "text-primary-foreground" : "text-muted-foreground"}`}>
            CLP
          </span>
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "UF" ? "text-primary-foreground" : "text-muted-foreground"}`}>
            UF
          </span>
        </button>
        {currency === "CLP" && (
          <span className="text-xs text-muted-foreground">Valores en CLP calculados con UF = $38.800</span>
        )}
      </div>
    </div>
  );
}

export function PremiumResults({ results, unlocked = false, inputData, comuna }: {
  results: FullAnalysisResult;
  unlocked?: boolean;
  inputData?: AnalisisInput;
  comuna?: string;
}) {
  const [projectionYears, setProjectionYears] = useState(10);
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [cashflowYears, setCashflowYears] = useState(1);
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");

  // Sensitivity sliders
  const [sensTasa, setSensTasa] = useState(0);
  const [sensArriendo, setSensArriendo] = useState(0);
  const [sensVacancia, setSensVacancia] = useState(0);

  const m = results.metrics;
  const exit = results.exitScenario;
  const refi = results.refinanceScenario;

  const fmt = useCallback((n: number) => fmtMoney(n, currency), [currency]);
  const toggleCurrency = useCallback(() => setCurrency((c) => c === "CLP" ? "UF" : "CLP"), []);

  // Sensitivity recalc
  const sensResult = useMemo(
    () => recalcForSensitivity(results, inputData, sensTasa, sensArriendo, sensVacancia),
    [results, inputData, sensTasa, sensArriendo, sensVacancia]
  );

  const sensBase = useMemo(
    () => recalcForSensitivity(results, inputData, 0, 0, 0),
    [results, inputData]
  );

  // Predefined scenarios
  const sensPesimista = useMemo(
    () => recalcForSensitivity(results, inputData, 1.5, -15, 2),
    [results, inputData]
  );
  const sensOptimista = useMemo(
    () => recalcForSensitivity(results, inputData, -1, 10, 0),
    [results, inputData]
  );

  // Radar chart data with tooltips
  const radarData = [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusval\u00eda", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Bajo Riesgo", value: results.desglose.riesgo, fullMark: 100 },
    { dimension: "Ubicaci\u00f3n", value: results.desglose.ubicacion, fullMark: 100 },
  ];

  // Waterfall data
  const waterfallData = [
    { name: "Arriendo", value: m.ingresoMensual, fill: "#059669" },
    { name: "Dividendo", value: -m.dividendo, fill: "#ef4444" },
    { name: "GGCC", value: -(m.egresosMensuales - m.dividendo - Math.round(results.metrics.precioCLP * 0.01 / 12)), fill: "#f97316" },
    { name: "Mantenci\u00f3n", value: -Math.round(results.metrics.precioCLP * 0.01 / 12), fill: "#f59e0b" },
    { name: "Flujo Neto", value: m.flujoNetoMensual, fill: m.flujoNetoMensual >= 0 ? "#059669" : "#ef4444" },
  ];

  // Dynamic Cashflow: generate data based on slider (1-3 years = months, 4+ = years)
  const cashflowData = useMemo(() => {
    if (cashflowYears <= 3) {
      // Show months
      const totalMonths = cashflowYears * 12;
      const data: { name: string; Ingreso: number; Dividendo: number; Gastos: number; Extra: number; Acumulado: number }[] = [];
      let acumulado = 0;

      const contribucionesMes = Math.round((inputData?.contribuciones ?? 0) / 3);
      const mantencion = inputData?.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
      const serviciosBasicos = inputData?.tipoRenta === "corta" ? (inputData?.serviciosBasicos ?? 0) : 0;
      let arriendoActual = m.ingresoMensual;
      let gastosActual = inputData?.gastos ?? 0;

      for (let i = 1; i <= totalMonths; i++) {
        // Apply inflation per year (after year 1)
        if (i > 1 && (i - 1) % 12 === 0) {
          arriendoActual *= 1.035;
          gastosActual *= 1.03;
        }

        let ingreso = Math.round(arriendoActual);
        let extra = 0;

        // First month of each year: vacancia
        if (i === 1) ingreso = 0;
        // Second month: corretaje
        if (i === 2 && inputData?.tipoRenta === "larga") extra = Math.round(m.ingresoMensual * 0.5);

        const egreso = m.dividendo + Math.round(gastosActual) + contribucionesMes + mantencion + serviciosBasicos;
        const flujo = ingreso - egreso - extra;
        acumulado += flujo;

        data.push({
          name: `M${i}`,
          Ingreso: ingreso,
          Dividendo: m.dividendo,
          Gastos: Math.round(gastosActual) + contribucionesMes + mantencion,
          Extra: extra + serviciosBasicos,
          Acumulado: acumulado,
        });
      }
      return data;
    } else {
      // Show years
      return results.projections.slice(0, cashflowYears).map((p) => ({
        name: `A\u00f1o ${p.anio}`,
        Ingreso: p.arriendoMensual * 12,
        Dividendo: m.dividendo * 12,
        Gastos: 0,
        Extra: 0,
        Acumulado: p.flujoAcumulado,
      }));
    }
  }, [cashflowYears, results, m, inputData]);

  // Multi-year projections
  const projData = results.projections.slice(0, projectionYears).map((p) => ({
    name: `A\u00f1o ${p.anio}`,
    "Valor Propiedad": p.valorPropiedad,
    "Saldo Cr\u00e9dito": p.saldoCredito,
    "Patrimonio Neto": p.patrimonioNeto,
    "Flujo Acumulado": p.flujoAcumulado,
  }));

  // Map URL
  const mapQuery = inputData?.direccion
    ? `${inputData.direccion}, ${comuna || inputData?.comuna}, Chile`
    : `${comuna || inputData?.comuna}, Santiago, Chile`;
  const googleMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <>
      {/* Currency Toggle */}
      <CurrencyToggle currency={currency} onToggle={toggleCurrency} />

      {/* 6. Radar Chart */}
      <SectionCard title="Dimensiones del Score" icon={Target} premium unlocked={unlocked}>
        <div className="mb-3 flex flex-wrap gap-2">
          {radarData.map((d) => (
            <div key={d.dimension} className="flex items-center gap-1 rounded bg-secondary/30 px-2 py-1 text-xs">
              <span>{d.dimension}: <strong>{Math.round(d.value)}</strong></span>
              <InfoTooltip content={RADAR_TOOLTIPS[d.dimension] || ""} />
            </div>
          ))}
        </div>
        <div className="mx-auto h-72 w-full max-w-md">
          <ResponsiveContainer>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
              <Radar name="Score" dataKey="value" stroke="#059669" fill="#059669" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 7. Dashboard 8 Metrics with tooltips */}
      <SectionCard title="M\u00e9tricas de Inversi\u00f3n" icon={BarChart3} premium unlocked={unlocked}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Yield Bruto", value: `${m.yieldBruto.toFixed(1)}%` },
            { label: "Yield Neto", value: `${m.yieldNeto.toFixed(1)}%` },
            { label: "CAP Rate", value: `${m.capRate.toFixed(1)}%` },
            { label: "Cash-on-Cash", value: `${m.cashOnCash.toFixed(1)}%` },
            { label: "ROI Total (10a)", value: `${exit.multiplicadorCapital}x` },
            { label: "TIR", value: `${exit.tir.toFixed(1)}%` },
            { label: "Payback Pie", value: m.mesesPaybackPie < 999 ? `${m.mesesPaybackPie} meses` : "N/A" },
            { label: "UF/m\u00b2", value: `${m.precioM2.toFixed(1)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {label}
                {METRIC_TOOLTIPS[label] && <InfoTooltip content={METRIC_TOOLTIPS[label]} />}
              </div>
              <div className="text-lg font-bold">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 8. Waterfall */}
      <SectionCard title="Cascada de Costos Mensual" description="Del arriendo bruto al flujo neto" icon={DollarSign} premium unlocked={unlocked}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={waterfallData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <RechartsTooltip formatter={((v: number) => fmt(v)) as never} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 9. Dynamic Cashflow with Slider */}
      <SectionCard
        title={`Flujo de Caja \u2014 ${cashflowYears <= 3 ? `${cashflowYears} a\u00f1o${cashflowYears > 1 ? "s" : ""} (mensual)` : `${cashflowYears} a\u00f1os (anual)`}`}
        description="Barras: ingresos y egresos. L\u00ednea: acumulado"
        icon={BarChart3}
        premium
        unlocked={unlocked}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Horizonte:</span>
          <input
            type="range"
            min={1}
            max={20}
            value={cashflowYears}
            onChange={(e) => setCashflowYears(Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm font-medium">
            {cashflowYears} a\u00f1o{cashflowYears > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground">
            ({cashflowYears <= 3 ? "vista mensual" : "vista anual"})
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={cashflowData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={cashflowYears <= 1 ? 0 : "preserveStartEnd"} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <RechartsTooltip formatter={((v: number) => fmt(v)) as never} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingreso" stackId="a" fill="#059669" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Dividendo" stackId="b" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Gastos" stackId="b" fill="#f97316" />
              <Bar dataKey="Extra" stackId="b" fill="#f59e0b" />
              <Line type="monotone" dataKey="Acumulado" stroke="#3b82f6" strokeWidth={2} dot={cashflowYears <= 3 ? { r: 2 } : false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 10. Proyecci\u00f3n Multi-a\u00f1o */}
      <SectionCard title="Proyecci\u00f3n Multi-A\u00f1o" description={`Horizonte: ${projectionYears} a\u00f1os \u00b7 Plusval\u00eda 4%/a\u00f1o \u00b7 Arriendos +3.5%/a\u00f1o`} icon={Calendar} premium unlocked={unlocked}>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">A\u00f1os:</span>
          <input
            type="range" min={3} max={20} value={projectionYears}
            onChange={(e) => setProjectionYears(Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm font-medium">{projectionYears}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={projData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <RechartsTooltip formatter={((v: number) => fmt(v)) as never} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Valor Propiedad" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Saldo Cr\u00e9dito" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Patrimonio Neto" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Flujo Acumulado" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 11. Escenario de Salida */}
      <SectionCard title="Escenario de Salida" icon={ArrowRightLeft} premium unlocked={unlocked}>
        <div className="mb-4 flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setExitMode("venta")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "venta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Venta
          </button>
          <button
            type="button"
            onClick={() => setExitMode("refinanciamiento")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "refinanciamiento" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Refinanciamiento
          </button>
        </div>

        {exitMode === "venta" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Escenario a {exit.anios} a\u00f1os con plusval\u00eda 4%/a\u00f1o</p>
            {[
              { label: "Valor venta estimado", value: fmt(exit.valorVenta) },
              { label: "Saldo cr\u00e9dito restante", value: fmt(exit.saldoCredito), negative: true },
              { label: "Comisi\u00f3n venta (2%)", value: fmt(exit.comisionVenta), negative: true },
              { label: "Ganancia neta venta", value: fmt(exit.gananciaNeta), positive: true },
              { label: "Flujo acumulado per\u00edodo", value: fmt(exit.flujoAcumulado), positive: exit.flujoAcumulado > 0 },
              { label: "Retorno total", value: fmt(exit.retornoTotal), bold: true, positive: true },
              { label: "Multiplicador de capital", value: `${exit.multiplicadorCapital}x`, bold: true },
              { label: "TIR", value: `${exit.tir.toFixed(1)}%`, bold: true },
            ].map(({ label, value, negative, positive, bold }) => (
              <div key={label} className={`flex justify-between ${bold ? "border-t border-border/50 pt-2 font-bold" : ""}`}>
                <span className="text-muted-foreground">{label}</span>
                <span className={negative ? "text-red-400" : positive ? "text-emerald-400" : ""}>{negative ? "-" : ""}{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Refinanciamiento a 5 a\u00f1os (80% nuevo aval\u00fao)</p>
            {[
              { label: "Nuevo aval\u00fao", value: fmt(refi.nuevoAvaluo) },
              { label: "Nuevo cr\u00e9dito (80%)", value: fmt(refi.nuevoCredito) },
              { label: "Capital liberado", value: fmt(refi.capitalLiberado), positive: true },
              { label: "Nuevo dividendo", value: fmt(refi.nuevoDividendo) },
              { label: "Nuevo flujo neto", value: fmt(refi.nuevoFlujoNeto), positive: refi.nuevoFlujoNeto > 0 },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className={positive ? "text-emerald-400 font-medium" : ""}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 12. Interactive Sensitivity Analysis */}
      <SectionCard title="An\u00e1lisis de Sensibilidad" description="Mueve los sliders para ver c\u00f3mo cambian los resultados" icon={Shield} premium unlocked={unlocked}>
        {/* Interactive Sliders */}
        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tasa de inter\u00e9s</span>
              <span className={`font-medium ${sensTasa > 0 ? "text-red-400" : sensTasa < 0 ? "text-emerald-400" : ""}`}>
                {sensTasa > 0 ? "+" : ""}{sensTasa.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.1}
              value={sensTasa}
              onChange={(e) => setSensTasa(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-2%</span><span>Base</span><span>+2%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Arriendo</span>
              <span className={`font-medium ${sensArriendo > 0 ? "text-emerald-400" : sensArriendo < 0 ? "text-red-400" : ""}`}>
                {sensArriendo > 0 ? "+" : ""}{sensArriendo}%
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={sensArriendo}
              onChange={(e) => setSensArriendo(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-20%</span><span>Base</span><span>+20%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Vacancia adicional</span>
              <span className={`font-medium ${sensVacancia > 0 ? "text-red-400" : ""}`}>
                +{sensVacancia} mes{sensVacancia !== 1 ? "es" : ""}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={0.5}
              value={sensVacancia}
              onChange={(e) => setSensVacancia(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span><span>2</span><span>4 meses</span>
            </div>
          </div>
        </div>

        {/* Live results */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className={`rounded-lg border p-3 text-center ${
            sensResult.score > sensBase.score ? "border-emerald-500/30 bg-emerald-500/5" :
            sensResult.score < sensBase.score ? "border-red-500/30 bg-red-500/5" :
            "border-border/50 bg-secondary/30"
          }`}>
            <div className="mb-1 text-xs text-muted-foreground">Score</div>
            <MiniScoreCircle score={sensResult.score} />
          </div>
          <div className={`rounded-lg border p-3 text-center ${
            sensResult.flujo > sensBase.flujo ? "border-emerald-500/30 bg-emerald-500/5" :
            sensResult.flujo < sensBase.flujo ? "border-red-500/30 bg-red-500/5" :
            "border-border/50 bg-secondary/30"
          }`}>
            <div className="mb-1 text-xs text-muted-foreground">Flujo Neto</div>
            <div className={`text-lg font-bold ${sensResult.flujo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {fmtCLP(sensResult.flujo)}
            </div>
          </div>
          <div className={`rounded-lg border p-3 text-center ${
            sensResult.yieldNeto > sensBase.yieldNeto ? "border-emerald-500/30 bg-emerald-500/5" :
            sensResult.yieldNeto < sensBase.yieldNeto ? "border-red-500/30 bg-red-500/5" :
            "border-border/50 bg-secondary/30"
          }`}>
            <div className="mb-1 text-xs text-muted-foreground">Yield Neto</div>
            <div className="text-lg font-bold">{sensResult.yieldNeto.toFixed(1)}%</div>
          </div>
        </div>

        {/* Predefined scenarios table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Escenario</th>
                <th className="pb-2 pr-4">Score</th>
                <th className="pb-2 pr-4">Flujo Neto</th>
                <th className="pb-2">Yield Neto</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Pesimista", desc: "+1.5% tasa, -15% arriendo, +2m vacancia", data: sensPesimista, color: "text-red-400" },
                { label: "Base", desc: "Valores actuales", data: sensBase, color: "" },
                { label: "Optimista", desc: "-1% tasa, +10% arriendo", data: sensOptimista, color: "text-emerald-400" },
              ].map(({ label, desc, data, color }) => (
                <tr key={label} className="border-b border-border/30">
                  <td className="py-2 pr-4">
                    <div className={`font-medium ${color}`}>{label}</div>
                    <div className="text-[10px] text-muted-foreground">{desc}</div>
                  </td>
                  <td className="py-2 pr-4"><MiniScoreCircle score={data.score} /></td>
                  <td className={`py-2 pr-4 font-medium ${data.flujo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtCLP(data.flujo)}
                  </td>
                  <td className="py-2">{data.yieldNeto.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 13. Comparaci\u00f3n zona + Mapa */}
      <SectionCard title="Comparaci\u00f3n con Zona" icon={Building2} premium unlocked={unlocked}>
        {(() => {
          const promedioM2 = m.precioM2 * 1.05;
          const promedioYield = m.yieldBruto * 0.9;
          const items = [
            { label: "Precio/m\u00b2 (UF)", tuyo: m.precioM2, zona: promedioM2 },
            { label: "Yield Bruto (%)", tuyo: m.yieldBruto, zona: promedioYield },
          ];
          return (
            <div className="space-y-4">
              {items.map(({ label, tuyo, zona }) => {
                const maxVal = Math.max(tuyo, zona);
                return (
                  <div key={label}>
                    <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="w-20 text-xs">Tu propiedad</span>
                      <div className="h-4 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(tuyo / maxVal) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-medium">{tuyo.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-xs">Promedio zona</span>
                      <div className="h-4 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${(zona / maxVal) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-medium">{zona.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Map */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Ubicaci\u00f3n: {mapQuery}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/50">
            <iframe
              src={googleMapUrl}
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de ubicaci\u00f3n"
            />
          </div>
        </div>
      </SectionCard>

      {/* 14. Break-even & 15. Valor m\u00e1ximo */}
      <SectionCard title="Puntos Cr\u00edticos" icon={Target} premium unlocked={unlocked}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Break-even tasa de inter\u00e9s</div>
            <div className="mt-1 text-2xl font-bold">
              {results.breakEvenTasa === -1 ? "N/A" : `${results.breakEvenTasa.toFixed(2)}%`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {results.breakEvenTasa === -1
                ? "Flujo negativo incluso a tasa 0% \u2014 revisar precio o arriendo"
                : "Tasa a la que el flujo mensual se vuelve negativo"}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Precio m\u00e1ximo de compra</div>
            <div className="mt-1 text-2xl font-bold">{results.valorMaximoCompra.toLocaleString("es-CL")} UF</div>
            <p className="mt-1 text-xs text-muted-foreground">Precio m\u00e1ximo para flujo positivo con estos datos</p>
          </div>
        </div>
      </SectionCard>

      {/* 16. An\u00e1lisis IA */}
      <SectionCard title="An\u00e1lisis Detallado" icon={Brain} premium unlocked={unlocked}>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-emerald-400">Pros</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.pros.map((p, i) => (
                <li key={i}>\u2022 {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-red-400">Contras</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.contras.map((c, i) => (
                <li key={i}>\u2022 {c}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <h4 className="mb-2 text-sm font-semibold">Resumen</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{results.resumen}</p>
          </div>
        </div>
      </SectionCard>

      {/* CTA Final */}
      {!unlocked && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold">Desbloquea el informe completo</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Accede al radar de dimensiones, 8 m\u00e9tricas detalladas, flujo de caja mes a mes,
              proyecciones multi-a\u00f1o, escenarios de salida, an\u00e1lisis de sensibilidad y m\u00e1s.
            </p>
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Desbloquear Informe Completo \u2014 $4.990
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
