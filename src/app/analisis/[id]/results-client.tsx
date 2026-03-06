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
  "Yield Neto": "Retorno anual real descontando todos los gastos operativos (GGCC, contribuciones, mantención, vacancia). Es la métrica más honesta de rentabilidad.",
  "CAP Rate": "Net Operating Income / Precio. Estándar internacional para comparar inversiones inmobiliarias. No incluye financiamiento.",
  "Cash-on-Cash": "Retorno anual sobre TU capital invertido (el pie). Si es negativo, estás poniendo plata de tu bolsillo cada mes.",
  "ROI Total (10a)": "Retorno total considerando flujo de caja + plusvalía en el período. Incluye el efecto del apalancamiento.",
  "TIR": "Tasa Interna de Retorno. Permite comparar esta inversión con otras alternativas (depósito a plazo, fondos mutuos, etc.)",
  "Payback Pie": "Meses que toma recuperar el pie invertido solo con flujo de caja. N/A si el flujo es negativo.",
  "InvertiScore": "Puntaje de 1-100 que evalúa 5 dimensiones: Rentabilidad (30%), Flujo de Caja (25%), Plusvalía (20%), Riesgo (15%), Ubicación (10%)",
};

const RADAR_TOOLTIPS: Record<string, string> = {
  "Rentabilidad": "Evalúa yield bruto y neto. Peso: 30%",
  "Flujo Caja": "Evalúa el flujo de caja mensual neto. Peso: 25%",
  "Plusvalía": "Potencial de apreciación del valor. Peso: 20%",
  "Bajo Riesgo": "Evalúa antigüedad, tipo, vacancia y gastos. Peso: 15%",
  "Ubicación": "Calidad de la ubicación y demanda de arriendo. Peso: 10%",
};

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

function MiniScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "#059669" : score >= 65 ? "#3b82f6" : score >= 50 ? "#eab308" : score >= 30 ? "#f97316" : "#ef4444";
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: color, color }}>
      {score}
    </div>
  );
}

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

  const precioCLP = modified.precio * UF_CLP;
  const piePct = modified.piePct / 100;

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
  const yieldBruto = precioCLP > 0 ? (rentaAnual / precioCLP) * 100 : 0;
  const yieldNeto = precioCLP > 0 ? ((rentaAnual - gastosAnuales) / precioCLP) * 100 : 0;
  const capRate = precioCLP > 0 ? (noi / precioCLP) * 100 : 0;
  const precioM2 = modified.superficie > 0 ? modified.precio / modified.superficie : 0;

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    const t = (value - inMin) / (inMax - inMin);
    return outMin + clamp(t, 0, 1) * (outMax - outMin);
  };

  const COMUNAS_PREMIUM = ["providencia", "las condes", "vitacura", "lo barnechea", "ñuñoa", "la reina", "santiago centro", "viña del mar", "con con"];
  const isPremium = COMUNAS_PREMIUM.some((c) => modified.comuna.toLowerCase().includes(c));

  // Rentabilidad - same as analysis.ts
  let rentabilidadScore: number;
  if (yieldBruto >= 6) rentabilidadScore = lerp(yieldBruto, 6, 8, 90, 100);
  else if (yieldBruto >= 5) rentabilidadScore = lerp(yieldBruto, 5, 6, 70, 89);
  else if (yieldBruto >= 4) rentabilidadScore = lerp(yieldBruto, 4, 5, 45, 65);
  else if (yieldBruto >= 3) rentabilidadScore = lerp(yieldBruto, 3, 4, 25, 44);
  else rentabilidadScore = lerp(yieldBruto, 0, 3, 0, 24);
  if (yieldNeto >= 4) rentabilidadScore = Math.min(100, rentabilidadScore + 5);
  else if (yieldNeto < 2) rentabilidadScore = Math.max(0, rentabilidadScore - 5);
  rentabilidadScore = clamp(rentabilidadScore, 0, 100);

  // Flujo - same as analysis.ts
  let flujoCajaScore: number;
  if (flujoNetoMensual >= 0) flujoCajaScore = lerp(flujoNetoMensual, 0, 200000, 80, 100);
  else if (flujoNetoMensual >= -200000) flujoCajaScore = lerp(flujoNetoMensual, -200000, 0, 50, 79);
  else if (flujoNetoMensual >= -400000) flujoCajaScore = lerp(flujoNetoMensual, -400000, -200000, 25, 49);
  else if (flujoNetoMensual >= -600000) flujoCajaScore = lerp(flujoNetoMensual, -600000, -400000, 10, 24);
  else flujoCajaScore = lerp(flujoNetoMensual, -1000000, -600000, 0, 9);
  flujoCajaScore = clamp(flujoCajaScore, 0, 100);

  let plusvaliaScore = isPremium ? 85 : 55;
  plusvaliaScore += isPremium ? lerp(precioM2, 30, 120, 10, -10) : lerp(precioM2, 30, 100, 15, -15);
  if (modified.enConstruccion || modified.antiguedad <= 2) plusvaliaScore += 10;
  else if (modified.antiguedad >= 3 && modified.antiguedad <= 8) plusvaliaScore += 5;
  else if (modified.antiguedad > 20) plusvaliaScore -= 15;
  if (modified.piso >= 10) plusvaliaScore += 5;
  else if (modified.piso <= 2 && modified.piso > 0) plusvaliaScore -= 3;
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

  const [sensTasa, setSensTasa] = useState(0);
  const [sensArriendo, setSensArriendo] = useState(0);
  const [sensVacancia, setSensVacancia] = useState(0);

  const m = results.metrics;
  const exit = results.exitScenario;
  const refi = results.refinanceScenario;

  const fmt = useCallback((n: number) => fmtMoney(n, currency), [currency]);
  const toggleCurrency = useCallback(() => setCurrency((c) => c === "CLP" ? "UF" : "CLP"), []);

  const sensResult = useMemo(
    () => recalcForSensitivity(results, inputData, sensTasa, sensArriendo, sensVacancia),
    [results, inputData, sensTasa, sensArriendo, sensVacancia]
  );

  const sensBase = useMemo(
    () => recalcForSensitivity(results, inputData, 0, 0, 0),
    [results, inputData]
  );

  const sensPesimista = useMemo(
    () => recalcForSensitivity(results, inputData, 1.5, -15, 2),
    [results, inputData]
  );
  const sensOptimista = useMemo(
    () => recalcForSensitivity(results, inputData, -1, 10, 0),
    [results, inputData]
  );

  const radarData = [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusvalía", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Bajo Riesgo", value: results.desglose.riesgo, fullMark: 100 },
    { dimension: "Ubicación", value: results.desglose.ubicacion, fullMark: 100 },
  ];

  const waterfallData = [
    { name: "Arriendo", value: m.ingresoMensual, fill: "#059669" },
    { name: "Dividendo", value: -m.dividendo, fill: "#ef4444" },
    { name: "GGCC", value: -(m.egresosMensuales - m.dividendo - Math.round(results.metrics.precioCLP * 0.01 / 12)), fill: "#f97316" },
    { name: "Mantención", value: -Math.round(results.metrics.precioCLP * 0.01 / 12), fill: "#f59e0b" },
    { name: "Flujo Neto", value: m.flujoNetoMensual, fill: m.flujoNetoMensual >= 0 ? "#059669" : "#ef4444" },
  ];

  const cashflowData = useMemo(() => {
    if (cashflowYears <= 3) {
      const totalMonths = cashflowYears * 12;
      const data: { name: string; Ingreso: number; Dividendo: number; Gastos: number; Extra: number; Acumulado: number }[] = [];
      let acumulado = 0;

      const contribucionesMes = Math.round((inputData?.contribuciones ?? 0) / 3);
      const mantencion = inputData?.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
      const serviciosBasicos = inputData?.tipoRenta === "corta" ? (inputData?.serviciosBasicos ?? 0) : 0;
      let arriendoActual = m.ingresoMensual;
      let gastosActual = inputData?.gastos ?? 0;

      for (let i = 1; i <= totalMonths; i++) {
        if (i > 1 && (i - 1) % 12 === 0) {
          arriendoActual *= 1.035;
          gastosActual *= 1.03;
        }

        let ingreso = Math.round(arriendoActual);
        let extra = 0;

        if (i === 1) ingreso = 0;
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
      return results.projections.slice(0, cashflowYears).map((p) => ({
        name: `Año ${p.anio}`,
        Ingreso: p.arriendoMensual * 12,
        Dividendo: m.dividendo * 12,
        Gastos: 0,
        Extra: 0,
        Acumulado: p.flujoAcumulado,
      }));
    }
  }, [cashflowYears, results, m, inputData]);

  const projData = results.projections.slice(0, projectionYears).map((p) => ({
    name: `Año ${p.anio}`,
    "Valor Propiedad": p.valorPropiedad,
    "Saldo Crédito": p.saldoCredito,
    "Patrimonio Neto": p.patrimonioNeto,
    "Flujo Acumulado": p.flujoAcumulado,
  }));

  const mapQuery = inputData?.direccion
    ? `${inputData.direccion}, ${comuna || inputData?.comuna}, Chile`
    : `${comuna || inputData?.comuna}, Santiago, Chile`;
  const googleMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <>
      <CurrencyToggle currency={currency} onToggle={toggleCurrency} />

      {/* Radar Chart */}
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

      {/* Métricas */}
      <SectionCard title="Métricas de Inversión" icon={BarChart3} premium unlocked={unlocked}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Yield Bruto", value: `${m.yieldBruto.toFixed(1)}%` },
            { label: "Yield Neto", value: `${m.yieldNeto.toFixed(1)}%` },
            { label: "CAP Rate", value: `${m.capRate.toFixed(1)}%` },
            { label: "Cash-on-Cash", value: `${m.cashOnCash.toFixed(1)}%` },
            { label: "ROI Total (10a)", value: `${exit.multiplicadorCapital}x` },
            { label: "TIR", value: `${exit.tir.toFixed(1)}%` },
            { label: "Payback Pie", value: m.mesesPaybackPie < 999 ? `${m.mesesPaybackPie} meses` : "N/A" },
            { label: "UF/m²", value: `${m.precioM2.toFixed(1)}` },
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

      {/* Cascada */}
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

      {/* Flujo de Caja Dinámico */}
      <SectionCard
        title={`Flujo de Caja — ${cashflowYears <= 3 ? `${cashflowYears} año${cashflowYears > 1 ? "s" : ""} (mensual)` : `${cashflowYears} años (anual)`}`}
        description="Barras: ingresos y egresos. Línea: acumulado"
        icon={BarChart3}
        premium
        unlocked={unlocked}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Horizonte:</span>
          <input
            type="range" min={1} max={20} value={cashflowYears}
            onChange={(e) => setCashflowYears(Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm font-medium">
            {cashflowYears} año{cashflowYears > 1 ? "s" : ""}
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

      {/* Proyección Multi-Año */}
      <SectionCard title="Proyección Multi-Año" description={`Horizonte: ${projectionYears} años · Plusvalía 4%/año · Arriendos +3.5%/año`} icon={Calendar} premium unlocked={unlocked}>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Años:</span>
          <input type="range" min={3} max={20} value={projectionYears} onChange={(e) => setProjectionYears(Number(e.target.value))} className="w-48 accent-primary" />
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
              <Line type="monotone" dataKey="Saldo Crédito" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Patrimonio Neto" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Flujo Acumulado" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Escenario de Salida */}
      <SectionCard title="Escenario de Salida" icon={ArrowRightLeft} premium unlocked={unlocked}>
        <div className="mb-4 flex overflow-hidden rounded-lg border border-border">
          <button type="button" onClick={() => setExitMode("venta")} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "venta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>Venta</button>
          <button type="button" onClick={() => setExitMode("refinanciamiento")} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "refinanciamiento" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>Refinanciamiento</button>
        </div>

        {exitMode === "venta" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Escenario a {exit.anios} años con plusvalía 4%/año</p>
            {[
              { label: "Valor venta estimado", value: fmt(exit.valorVenta) },
              { label: "Saldo crédito restante", value: fmt(exit.saldoCredito), negative: true },
              { label: "Comisión venta (2%)", value: fmt(exit.comisionVenta), negative: true },
              { label: "Ganancia neta venta", value: fmt(exit.gananciaNeta), positive: true },
              { label: "Flujo acumulado período", value: fmt(exit.flujoAcumulado), positive: exit.flujoAcumulado > 0 },
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
            <p className="text-xs text-muted-foreground">Refinanciamiento a 5 años (80% nuevo avalúo)</p>
            {[
              { label: "Nuevo avalúo", value: fmt(refi.nuevoAvaluo) },
              { label: "Nuevo crédito (80%)", value: fmt(refi.nuevoCredito) },
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

      {/* Sensibilidad Interactiva */}
      <SectionCard title="Análisis de Sensibilidad" description="Mueve los sliders para ver cómo cambian los resultados" icon={Shield} premium unlocked={unlocked}>
        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tasa de interés</span>
              <span className={`font-medium ${sensTasa > 0 ? "text-red-400" : sensTasa < 0 ? "text-emerald-400" : ""}`}>
                {sensTasa > 0 ? "+" : ""}{sensTasa.toFixed(1)}%
              </span>
            </div>
            <input type="range" min={-2} max={2} step={0.1} value={sensTasa} onChange={(e) => setSensTasa(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>-2%</span><span>Base</span><span>+2%</span></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Arriendo</span>
              <span className={`font-medium ${sensArriendo > 0 ? "text-emerald-400" : sensArriendo < 0 ? "text-red-400" : ""}`}>
                {sensArriendo > 0 ? "+" : ""}{sensArriendo}%
              </span>
            </div>
            <input type="range" min={-20} max={20} step={1} value={sensArriendo} onChange={(e) => setSensArriendo(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>-20%</span><span>Base</span><span>+20%</span></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Vacancia adicional</span>
              <span className={`font-medium ${sensVacancia > 0 ? "text-red-400" : ""}`}>
                +{sensVacancia} mes{sensVacancia !== 1 ? "es" : ""}
              </span>
            </div>
            <input type="range" min={0} max={4} step={0.5} value={sensVacancia} onChange={(e) => setSensVacancia(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>2</span><span>4 meses</span></div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Score", render: <MiniScoreCircle score={sensResult.score} />, better: sensResult.score > sensBase.score, worse: sensResult.score < sensBase.score },
            { label: "Flujo Neto", render: <div className={`text-lg font-bold ${sensResult.flujo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtCLP(sensResult.flujo)}</div>, better: sensResult.flujo > sensBase.flujo, worse: sensResult.flujo < sensBase.flujo },
            { label: "Yield Neto", render: <div className="text-lg font-bold">{sensResult.yieldNeto.toFixed(1)}%</div>, better: sensResult.yieldNeto > sensBase.yieldNeto, worse: sensResult.yieldNeto < sensBase.yieldNeto },
          ].map(({ label, render, better, worse }) => (
            <div key={label} className={`rounded-lg border p-3 text-center ${better ? "border-emerald-500/30 bg-emerald-500/5" : worse ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-secondary/30"}`}>
              <div className="mb-1 text-xs text-muted-foreground">{label}</div>
              {render}
            </div>
          ))}
        </div>

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
                  <td className={`py-2 pr-4 font-medium ${data.flujo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtCLP(data.flujo)}</td>
                  <td className="py-2">{data.yieldNeto.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Comparación zona + Mapa */}
      <SectionCard title="Comparación con Zona" icon={Building2} premium unlocked={unlocked}>
        {(() => {
          const promedioM2 = m.precioM2 * 1.05;
          const promedioYield = m.yieldBruto * 0.9;
          const items = [
            { label: "Precio/m² (UF)", tuyo: m.precioM2, zona: promedioM2 },
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

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Ubicación: {mapQuery}</span>
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
              title="Mapa de ubicación"
            />
          </div>
        </div>
      </SectionCard>

      {/* Puntos Críticos */}
      <SectionCard title="Puntos Críticos" icon={Target} premium unlocked={unlocked}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Break-even tasa de interés</div>
            <div className="mt-1 text-2xl font-bold">
              {results.breakEvenTasa === -1 ? "N/A" : `${results.breakEvenTasa.toFixed(2)}%`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {results.breakEvenTasa === -1
                ? "Flujo negativo incluso a tasa 0% — revisar precio o arriendo"
                : "Tasa a la que el flujo mensual se vuelve negativo"}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Precio máximo de compra</div>
            <div className="mt-1 text-2xl font-bold">{results.valorMaximoCompra.toLocaleString("es-CL")} UF</div>
            <p className="mt-1 text-xs text-muted-foreground">Precio máximo para flujo positivo con estos datos</p>
          </div>
        </div>
      </SectionCard>

      {/* Análisis Detallado */}
      <SectionCard title="Análisis Detallado" icon={Brain} premium unlocked={unlocked}>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-emerald-400">Pros</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.pros.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-red-400">Contras</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.contras.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <h4 className="mb-2 text-sm font-semibold">Resumen</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{results.resumen}</p>
          </div>
        </div>
      </SectionCard>

      {!unlocked && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold">Desbloquea el informe completo</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Accede al radar de dimensiones, 8 métricas detalladas, flujo de caja mes a mes,
              proyecciones multi-año, escenarios de salida, análisis de sensibilidad y más.
            </p>
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Desbloquear Informe Completo — $4.990
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
