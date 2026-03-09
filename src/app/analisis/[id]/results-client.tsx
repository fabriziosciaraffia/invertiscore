"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  Lock, DollarSign, BarChart3, Brain, Calendar,
  Building2, Sparkles, Target, Shield, MapPin,
  SlidersHorizontal, RefreshCw, Loader2, Clock,
  Wallet, Scale, Handshake, TrendingUp, AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import type { FullAnalysisResult, AnalisisInput, AIAnalysis } from "@/lib/types";
import { calcFlujoDesglose } from "@/lib/analysis";
import { SEED_MARKET_DATA } from "@/lib/market-seed";
import type { MarketDataRow } from "@/lib/market-data";

// Module-level UF value, updated from server prop on mount
let UF_CLP = 38800;

const METRIC_TOOLTIPS: Record<string, string> = {
  "Yield Bruto": "Retorno anual bruto sin descontar gastos. Se calcula como (arriendo anual / precio) × 100. Benchmark Santiago: 3.5-4.5%",
  "Yield Neto": "Retorno anual real descontando gastos del propietario (contribuciones, mantención, GGCC en vacancia). En renta larga, el arrendatario paga GGCC.",
  "CAP Rate": "Retorno neto operativo anual dividido por el precio (NOI/Precio). A diferencia del 'cap rate' que manejan muchos corredores en Chile (que es solo arriendo×12/precio), este descuenta contribuciones, mantención, vacancia y GGCC solo durante meses sin arrendatario. Es la métrica internacional estándar.",
  "Cash-on-Cash": "Retorno anual sobre TU capital invertido (el pie). Si es negativo, estás poniendo plata de tu bolsillo cada mes.",
  "ROI Total": "Retorno total considerando flujo de caja + plusvalía en el período. Incluye el efecto del apalancamiento.",
  "TIR": "Tasa Interna de Retorno. Permite comparar esta inversión con otras alternativas (depósito a plazo, fondos mutuos, etc.)",
  "Payback Pie": "Meses que toma recuperar el pie invertido solo con flujo de caja. N/A si el flujo es negativo.",
  "InvertiScore": "Puntaje de 1-100 que evalúa 5 dimensiones: Rentabilidad (30%), Flujo de Caja (25%), Plusvalía (20%), Riesgo (15%), Eficiencia de compra (10%)",
};

const RADAR_TOOLTIPS: Record<string, string> = {
  "Rentabilidad": "Evalúa yield bruto y neto. Peso: 30%",
  "Flujo Caja": "Evalúa el flujo de caja mensual neto. Peso: 25%",
  "Plusvalía": "Potencial de apreciación del valor. Peso: 20%",
  "Bajo Riesgo": "Evalúa antigüedad, tipo, vacancia y gastos. Peso: 15%",
  "Eficiencia": "Mide si estás comprando a buen precio respecto al mercado de la zona. Compara tu precio por m² y tu yield bruto contra el promedio de publicaciones activas en la comuna. Peso: 10%",
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

function fmtAxisMoney(n: number, currency: "CLP" | "UF"): string {
  if (currency === "UF") {
    const uf = n / UF_CLP;
    if (Math.abs(uf) >= 1_000) return "UF " + (uf / 1_000).toFixed(0) + "K";
    if (Math.abs(uf) >= 100) return "UF " + Math.round(uf);
    if (Math.abs(uf) >= 1) return "UF " + uf.toFixed(1);
    return "UF " + uf.toFixed(2);
  }
  return fmtM(n);
}

// Strip leading bullet/symbol characters from AI text
// Strips everything before the first letter/number
function stripBullet(text: string): string {
  return text.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").replace(/price score/gi, "Eficiencia de compra").trim();
}


// Get the right AI text field based on currency toggle, with legacy fallback
function aiText(obj: Record<string, unknown>, field: string, currency: "CLP" | "UF"): string {
  const key = field + (currency === "UF" ? "_uf" : "_clp");
  let text = "";
  if (typeof obj[key] === "string" && obj[key]) text = obj[key] as string;
  // Legacy fallback: old analyses without _clp/_uf suffixes
  else if (typeof obj[field] === "string") text = obj[field] as string;
  return text.replace(/price score/gi, "Eficiencia de compra");
}

// Get the right AI items array based on currency toggle, with legacy fallback
function aiItems(obj: Record<string, unknown>, field: string, currency: "CLP" | "UF"): string[] {
  const key = field + (currency === "UF" ? "_uf" : "_clp");
  if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key] as string[];
  // Legacy fallback
  if (Array.isArray(obj[field])) return obj[field] as string[];
  return [];
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
  const mantencion = modified.provisionMantencion || Math.round((precioCLP * 0.01) / 12);

  const flujo = calcFlujoDesglose({
    arriendo: ingresoMensual,
    dividendo,
    ggcc: modified.gastos,
    contribuciones: modified.contribuciones,
    mantencion,
    vacanciaMeses: modified.vacanciaMeses,
  });

  const egresosMensuales = flujo.totalEgresos;
  const flujoNetoMensual = flujo.flujoNeto;

  const noi = (flujo.arriendo - (flujo.totalEgresos - flujo.dividendo)) * 12;
  const rentaAnual = ingresoMensual * 12;
  const gastosAnuales = (flujo.totalEgresos - flujo.dividendo) * 12;
  const yieldBruto = precioCLP > 0 ? (rentaAnual / precioCLP) * 100 : 0;
  const yieldNeto = precioCLP > 0 ? ((rentaAnual - gastosAnuales) / precioCLP) * 100 : 0;
  const capRate = precioCLP > 0 ? (noi / precioCLP) * 100 : 0;
  const precioM2 = modified.superficie > 0 ? modified.precio / modified.superficie : 0;

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    const t = (value - inMin) / (inMax - inMin);
    return outMin + clamp(t, 0, 1) * (outMax - outMin);
  };

  const PLUSVALIA_COMUNA: Record<string, number> = {
    "vitacura": 95, "lo barnechea": 95,
    "las condes": 90, "providencia": 90,
    "ñuñoa": 82, "la reina": 82,
    "san miguel": 70, "macul": 70, "la florida": 70,
    "santiago centro": 60,
    "estación central": 55, "estacion central": 55, "independencia": 55, "recoleta": 55,
    "quinta normal": 45, "pedro aguirre cerda": 45, "san joaquín": 45, "san joaquin": 45,
  };
  const COMUNAS_OVERSUPPLY = ["santiago centro", "estación central", "estacion central", "independencia"];
  const lookupC = (comuna: string, table: Record<string, number>, def: number) => {
    const c = comuna.toLowerCase().trim();
    if (table[c] !== undefined) return table[c];
    for (const key of Object.keys(table)) { if (c.includes(key) || key.includes(c)) return table[key]; }
    return def;
  };

  let rentabilidadScore: number;
  if (yieldBruto >= 6) rentabilidadScore = lerp(yieldBruto, 6, 8, 90, 100);
  else if (yieldBruto >= 5) rentabilidadScore = lerp(yieldBruto, 5, 6, 70, 89);
  else if (yieldBruto >= 4) rentabilidadScore = lerp(yieldBruto, 4, 5, 45, 65);
  else if (yieldBruto >= 3) rentabilidadScore = lerp(yieldBruto, 3, 4, 25, 44);
  else rentabilidadScore = lerp(yieldBruto, 0, 3, 0, 24);
  if (yieldNeto >= 4) rentabilidadScore = Math.min(100, rentabilidadScore + 5);
  else if (yieldNeto < 2) rentabilidadScore = Math.max(0, rentabilidadScore - 5);
  rentabilidadScore = clamp(rentabilidadScore, 0, 100);

  let flujoCajaScore: number;
  if (flujoNetoMensual >= 0) flujoCajaScore = lerp(flujoNetoMensual, 0, 200000, 80, 100);
  else if (flujoNetoMensual >= -200000) flujoCajaScore = lerp(flujoNetoMensual, -200000, 0, 50, 79);
  else if (flujoNetoMensual >= -400000) flujoCajaScore = lerp(flujoNetoMensual, -400000, -200000, 25, 49);
  else if (flujoNetoMensual >= -600000) flujoCajaScore = lerp(flujoNetoMensual, -600000, -400000, 10, 24);
  else flujoCajaScore = lerp(flujoNetoMensual, -1000000, -600000, 0, 9);
  flujoCajaScore = clamp(flujoCajaScore, 0, 100);

  let plusvaliaScore = lookupC(modified.comuna, PLUSVALIA_COMUNA, 50);
  const plusvaliaBase = lookupC(modified.comuna, PLUSVALIA_COMUNA, 50);
  plusvaliaScore += plusvaliaBase >= 80 ? lerp(precioM2, 30, 120, 8, -8) : lerp(precioM2, 30, 100, 12, -12);
  if (modified.enConstruccion || modified.antiguedad <= 2) plusvaliaScore += 10;
  else if (modified.antiguedad >= 3 && modified.antiguedad <= 8) plusvaliaScore += 5;
  else if (modified.antiguedad > 20) plusvaliaScore -= 15;
  if (modified.piso >= 10) plusvaliaScore += 5;
  else if (modified.piso <= 2 && modified.piso > 0) plusvaliaScore -= 3;
  plusvaliaScore = clamp(plusvaliaScore, 0, 100);

  const isOversupply = COMUNAS_OVERSUPPLY.some((c) => modified.comuna.toLowerCase().includes(c));
  let riesgoScore = 50;
  if (modified.tipo.toLowerCase().includes("departamento")) riesgoScore += 10;
  if (modified.antiguedad < 10 || modified.enConstruccion) riesgoScore += 10;
  else if (modified.antiguedad > 25) riesgoScore -= 15;
  if (capRate > 3) riesgoScore += 8;
  if (isOversupply) riesgoScore -= 5;
  const ratioGastos = ingresoMensual > 0 ? egresosMensuales / ingresoMensual : 2;
  if (ratioGastos > 1) riesgoScore -= 8;
  else if (ratioGastos > 0.8) riesgoScore -= 5;
  if (modified.vacanciaMeses > 1) riesgoScore -= 3;
  riesgoScore = clamp(riesgoScore, 10, 95);

  // Eficiencia de compra (10%)
  const tipoEf = modified.dormitorios <= 1 ? "1D" : modified.dormitorios === 2 ? "2D" : "3D";
  const seedEf = SEED_MARKET_DATA.find((d) => d.comuna === modified.comuna && d.tipo === tipoEf);
  let eficienciaScore = 50;
  if (seedEf) {
    const pm2Zona = seedEf.precio_m2_venta_promedio * UF_CLP;
    const pm2Prop = precioM2 * UF_CLP;
    const rP = pm2Zona > 0 ? pm2Prop / pm2Zona : 1;
    let sP: number;
    if (rP < 0.85) sP = lerp(rP, 0.70, 0.85, 100, 90);
    else if (rP < 0.95) sP = lerp(rP, 0.85, 0.95, 89, 70);
    else if (rP < 1.05) sP = lerp(rP, 0.95, 1.05, 69, 50);
    else if (rP < 1.15) sP = lerp(rP, 1.05, 1.15, 49, 30);
    else sP = lerp(rP, 1.15, 1.40, 29, 10);
    const supProm = tipoEf === "1D" ? 35 : tipoEf === "2D" ? 50 : 70;
    const yZona = pm2Zona > 0 && supProm > 0 ? (seedEf.arriendo_promedio * 12) / (pm2Zona * supProm) * 100 : 4.0;
    const rY = yZona > 0 ? yieldBruto / yZona : 1;
    let sY: number;
    if (rY > 1.20) sY = lerp(rY, 1.20, 1.50, 90, 100);
    else if (rY > 1.05) sY = lerp(rY, 1.05, 1.20, 70, 89);
    else if (rY > 0.95) sY = lerp(rY, 0.95, 1.05, 50, 69);
    else if (rY > 0.80) sY = lerp(rY, 0.80, 0.95, 30, 49);
    else sY = lerp(rY, 0.50, 0.80, 10, 29);
    eficienciaScore = clamp(Math.round(sP * 0.5 + sY * 0.5), 0, 100);
  }

  const score = clamp(Math.round(
    rentabilidadScore * 0.30 +
    flujoCajaScore * 0.25 +
    plusvaliaScore * 0.20 +
    riesgoScore * 0.15 +
    eficienciaScore * 0.10
  ), 0, 100);

  return { score, flujo: flujoNetoMensual, yieldNeto: Math.round(yieldNeto * 100) / 100 };
}

function RegisterOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-card/90 px-6 py-5 shadow-lg">
        <Lock className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium">Reg&iacute;strate gratis para ver esta secci&oacute;n</span>
        <a href="/register">
          <Button size="sm" className="gap-2">
            Reg&iacute;strate gratis
          </Button>
        </a>
      </div>
    </div>
  );
}

function PaywallOverlay({ analysisId }: { analysisId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Error al procesar el pago");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-card/90 px-6 py-5 shadow-lg">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium">Secci&oacute;n exclusiva del Informe Pro</span>
        <Button size="sm" className="gap-2" onClick={handleUnlock} disabled={loading}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Procesando..." : "Desbloquear — $4.990"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function BottomPaywallCTA({ analysisId }: { analysisId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Error al procesar el pago");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <Sparkles className="h-8 w-8 text-primary" />
        <h3 className="text-xl font-bold">Desbloquea Flujo, Patrimonio y Salida</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Accede a la cascada de costos, flujo de caja proyectado, patrimonio neto
          y escenarios de salida con horizonte ajustable de 1 a 20 a&ntilde;os.
        </p>
        <Button size="lg" className="gap-2" onClick={handleUnlock} disabled={loading}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Procesando..." : "Desbloquear Informe Pro \u2014 $4.990"}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, description, icon: Icon, children, gate = "none", accessLevel = "premium", analysisId, muted = false }: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  gate?: "none" | "login" | "premium";
  accessLevel?: "guest" | "free" | "premium";
  analysisId?: string;
  muted?: boolean;
}) {
  const showRegister = (gate === "login" && accessLevel === "guest") || (gate === "premium" && accessLevel === "guest");
  const showPaywall = gate === "premium" && accessLevel === "free";
  return (
    <div className="relative mb-8">
      <Card className={`border-border/50 ${muted ? "bg-muted/20" : "bg-card/50"}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle>{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {showRegister && <RegisterOverlay />}
      {showPaywall && analysisId && <PaywallOverlay analysisId={analysisId} />}
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
          <span className="text-xs text-muted-foreground">Valores en CLP calculados con UF = ${UF_CLP.toLocaleString("es-CL")}</span>
        )}
      </div>
    </div>
  );
}

export function PremiumResults({
  results, accessLevel = "free", analysisId, inputData, comuna,
  score, freeYieldBruto, freeFlujo, freePrecioM2, resumenEjecutivo,
  ufValue, zoneData, aiAnalysisInitial,
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
}) {
  // Update module-level UF value from server
  if (ufValue) UF_CLP = ufValue;
  const currentAccess = accessLevel;
  const [horizonYears, setHorizonYears] = useState(10);
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [plusvaliaRate, setPlusvaliaRate] = useState(4.0);
  const [refiPct, setRefiPct] = useState(80);


  // Adjustable parameters panel
  const [adjPrecio, setAdjPrecio] = useState(inputData?.precio ?? 0);
  const [adjPiePct, setAdjPiePct] = useState(inputData?.piePct ?? 20);
  const [adjPlazo, setAdjPlazo] = useState(inputData?.plazoCredito ?? 25);
  const [adjTasa, setAdjTasa] = useState(inputData?.tasaInteres ?? 4.72);
  const [adjArriendo, setAdjArriendo] = useState(inputData?.arriendo ?? 0);
  const [adjGastos, setAdjGastos] = useState(inputData?.gastos ?? 0);
  const [adjContribuciones, setAdjContribuciones] = useState(inputData?.contribuciones ?? 0);
  const [adjVacancia, setAdjVacancia] = useState(inputData?.vacanciaMeses ?? 1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  const [fabShown, setFabShown] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFabShown(true), 3000);
    return () => clearTimeout(timer);
  }, []);

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
        vacanciaMeses: adjVacancia,
      };
      const res = await fetch("/api/analisis/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, inputData: updatedInput }),
      });
      if (res.ok) {
        setRecalcSuccess(true);
        setTimeout(() => window.location.reload(), 500);
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Error al recalcular");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRecalcLoading(false);
    }
  }, [analysisId, inputData, adjPrecio, adjPiePct, adjPlazo, adjTasa, adjArriendo, adjGastos, adjContribuciones, adjVacancia]);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(
    aiAnalysisInitial && typeof aiAnalysisInitial === "object" && "veredicto" in aiAnalysisInitial ? aiAnalysisInitial as AIAnalysis : null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadAiAnalysis = useCallback(async () => {
    if (!analysisId || aiLoading) return;
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
  }, [analysisId, aiLoading]);

  const m = results?.metrics ?? null;

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
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
    return calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
      vacanciaMeses: inputData.vacanciaMeses,
    }).flujoNeto;
  }, [m, inputData, freeFlujo]);

  const flujoText = useMemo(() => {
    const f = flujoUnificado;
    const abs = Math.abs(f);
    if (f >= 0) return "La propiedad se paga sola y genera ganancia";
    if (abs <= 100000) return "Aporte mensual moderado para el mercado";
    if (abs <= 300000) return "Aporte mensual significativo de tu bolsillo";
    return "Aporte mensual elevado — evalúa bien";
  }, [flujoUnificado]);

  // Recalculate projections when plusvaliaRate changes
  const dynamicProjections = useMemo(() => {
    if (!results || !m || !inputData) return results?.projections ?? [];
    const precioCLP = inputData.precio * UF_CLP;
    const creditoCLP = precioCLP * (1 - inputData.piePct / 100);
    const mantencion = inputData.provisionMantencion || Math.round((precioCLP * 0.01) / 12);
    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;
    const cuotasPie = inputData.cuotasPie > 0 ? inputData.cuotasPie : mesesPreEntrega;
    const montoCuotaPie = inputData.montoCuota > 0 ? inputData.montoCuota : (cuotasPie > 0 ? Math.round(m.pieCLP / cuotasPie) : 0);

    let arriendoActual = inputData.arriendo;
    let gastosActual = inputData.gastos;
    let valorPropiedad = precioCLP;
    let flujoAcumulado = inputData.estadoVenta === "inmediata" ? -m.pieCLP : 0;
    const plusvaliaDec = plusvaliaRate / 100;

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

      // Usar función centralizada
      const flujoMes = calcFlujoDesglose({
        arriendo: arriendoActual,
        dividendo: m.dividendo,
        ggcc: gastosActual,
        contribuciones: inputData.contribuciones,
        mantencion,
        vacanciaMeses: inputData.vacanciaMeses ?? 1,
      });

      let flujoAnual = 0;
      for (let mo = mesInicio; mo <= mesFin; mo++) {
        if (mo <= mesesPreEntrega) {
          flujoAnual -= montoCuotaPie;
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
        arriendoActual *= 1.035;
        gastosActual *= 1.03;
      }
    }
    return projs;
  }, [results, m, inputData, plusvaliaRate]);

  // Dynamic exit scenario based on horizon
  const dynamicExit = useMemo(() => {
    if (!results || !m || dynamicProjections.length === 0) return null;
    const proy = dynamicProjections[horizonYears - 1];
    if (!proy) return null;
    const valorVenta = proy.valorPropiedad;
    const comisionVenta = Math.round(valorVenta * 0.02);
    const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
    const retornoTotal = proy.flujoAcumulado + gananciaNeta;
    const multiplicadorCapital = m.pieCLP > 0 ? Math.round((retornoTotal / m.pieCLP) * 100) / 100 : 0;
    const flujos = [-m.pieCLP];
    for (let i = 0; i < horizonYears; i++) {
      let flujo = dynamicProjections[i].flujoAnual;
      if (i === horizonYears - 1) flujo += valorVenta - proy.saldoCredito - comisionVenta;
      flujos.push(flujo);
    }
    const tir = calcTIR(flujos);
    return { anios: horizonYears, valorVenta: Math.round(valorVenta), saldoCredito: Math.round(proy.saldoCredito), comisionVenta, gananciaNeta: Math.round(gananciaNeta), flujoAcumulado: proy.flujoAcumulado, retornoTotal: Math.round(retornoTotal), multiplicadorCapital, tir };
  }, [results, m, dynamicProjections, horizonYears]);

  // Dynamic refinance scenario based on horizon + refiPct
  const dynamicRefi = useMemo(() => {
    if (!results || !m || !inputData || dynamicProjections.length === 0) return null;
    const proy = dynamicProjections[Math.min(horizonYears - 1, dynamicProjections.length - 1)];
    const nuevoAvaluo = proy.valorPropiedad;
    const nuevoCredito = Math.round(nuevoAvaluo * (refiPct / 100));
    const capitalLiberado = nuevoCredito - proy.saldoCredito;
    const tasaMensual = inputData.tasaInteres / 100 / 12;
    const n = inputData.plazoCredito * 12;
    const nuevoDividendo = tasaMensual === 0 ? Math.round(nuevoCredito / n) : Math.round((nuevoCredito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
    const refiF = calcFlujoDesglose({
      arriendo: proy.arriendoMensual,
      dividendo: nuevoDividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
      vacanciaMeses: inputData.vacanciaMeses ?? 1,
    });
    const nuevoFlujoNeto = refiF.flujoNeto;
    return { nuevoAvaluo: Math.round(nuevoAvaluo), nuevoCredito, capitalLiberado: Math.round(capitalLiberado), nuevoDividendo, nuevoFlujoNeto: Math.round(nuevoFlujoNeto) };
  }, [results, m, inputData, dynamicProjections, horizonYears, refiPct]);

  const sensBase = useMemo(
    () => results && inputData ? recalcForSensitivity(results, inputData, 0, 0, 0) : { score: 0, flujo: 0, yieldNeto: 0 },
    [results, inputData]
  );
  const sensPesimista = useMemo(
    () => results && inputData ? recalcForSensitivity(results, inputData, 1.5, -15, 2) : { score: 0, flujo: 0, yieldNeto: 0 },
    [results, inputData]
  );
  const sensOptimista = useMemo(
    () => results && inputData ? recalcForSensitivity(results, inputData, -1, 10, 0) : { score: 0, flujo: 0, yieldNeto: 0 },
    [results, inputData]
  );

  const radarData = results ? [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusvalía", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Bajo Riesgo", value: results.desglose.riesgo, fullMark: 100 },
    { dimension: "Eficiencia", value: results.desglose.eficiencia, fullMark: 100 },
  ] : [];

  const waterfallData = useMemo(() => {
    if (!m || !inputData) return [];
    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
    const wf = calcFlujoDesglose({
      arriendo: inputData.arriendo,
      dividendo: m.dividendo,
      ggcc: inputData.gastos,
      contribuciones: inputData.contribuciones,
      mantencion,
      vacanciaMeses: inputData.vacanciaMeses,
    });

    const steps: { name: string; delta: number }[] = [
      { name: "Arr.", delta: wf.arriendo },
      { name: "Div.", delta: -wf.dividendo },
      { name: "GGCC", delta: -wf.ggccVacancia },
      { name: "Cont.", delta: -wf.contribucionesMes },
      { name: "Mant.", delta: -wf.mantencion },
      { name: "Vac.", delta: -wf.vacanciaProrrata },
      { name: "Corr.", delta: -wf.corretajeProrrata },
      { name: "Rec.", delta: -wf.recambio },
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
        fill: s.delta >= 0 ? "#10b981" : "#ef4444",
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
      fill: "#1e40af",
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

    const mantencion = inputData.provisionMantencion || Math.round((m.precioCLP * 0.01) / 12);
    const totalMonths = horizonYears * 12;

    const mesesPreEntrega = inputData.estadoVenta !== "inmediata" && inputData.fechaEntrega
      ? (() => { const [a, me] = inputData.fechaEntrega!.split("-").map(Number); const now = new Date(); const ent = new Date(a, me - 1); return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))); })()
      : 0;

    // Always calculate month by month
    const allData: CashflowRow[] = [];
    allData.push({ name: "T0", _x: 0, Ingreso: 0, Dividendo: 0, GGCC: 0, Contribuciones: 0, Mantencion: 0, Vacancia: 0, FlujoNeto: 0, Acumulado: 0 });

    let acumulado = 0;
    let arriendoActual = inputData.arriendo;
    let gastosActual = inputData.gastos ?? 0;

    function buildRow(mes: number, arriendoAct: number, gastosAct: number, esVacancia: boolean): CashflowRow {
      const fd = calcFlujoDesglose({
        arriendo: arriendoAct,
        dividendo: m!.dividendo,
        ggcc: gastosAct,
        contribuciones: inputData!.contribuciones,
        mantencion,
        vacanciaMeses: inputData!.vacanciaMeses ?? 1,
      });
      const ingreso = esVacancia ? 0 : Math.round(arriendoAct);
      const ggcc = esVacancia ? -Math.round(gastosAct) : 0;
      // "Vacancia y otros" = vacancia + corretaje + recambio prorrateados
      const vac = -(fd.vacanciaProrrata + fd.corretajeProrrata + fd.recambio);
      const flujoNeto = ingreso + (-fd.dividendo) + ggcc + (-fd.contribucionesMes) + (-fd.mantencion) + vac;
      acumulado += flujoNeto;
      return { name: `M${mes}`, _x: mes, Ingreso: ingreso, Dividendo: -fd.dividendo, GGCC: ggcc, Contribuciones: -fd.contribucionesMes, Mantencion: -fd.mantencion, Vacancia: vac, FlujoNeto: flujoNeto, Acumulado: acumulado };
    }

    if (inputData.estadoVenta !== "inmediata" && mesesPreEntrega > 0) {
      for (let mes = 1; mes <= totalMonths; mes++) {
        if (mes <= mesesPreEntrega) {
          allData.push({ name: `M${mes}`, _x: mes, Ingreso: 0, Dividendo: 0, GGCC: 0, Contribuciones: 0, Mantencion: 0, Vacancia: 0, FlujoNeto: 0, Acumulado: acumulado });
        } else {
          const mesOp = mes - mesesPreEntrega;
          if (mesOp > 1 && (mes - 1) % 12 === 0) {
            arriendoActual *= 1.035;
            gastosActual *= 1.03;
          }
          allData.push(buildRow(mes, arriendoActual, gastosActual, mesOp === 1));
        }
      }
    } else {
      for (let i = 1; i <= totalMonths; i++) {
        if (i > 1 && (i - 1) % 12 === 0) {
          arriendoActual *= 1.035;
          gastosActual *= 1.03;
        }
        allData.push(buildRow(i, arriendoActual, gastosActual, i === 1));
      }
    }

    if (isMonthlyView) return allData;

    // Annual view: sample at T0 + year boundaries + delivery month
    const sampleSet = new Set<number>();
    sampleSet.add(0);
    for (let y = 1; y <= horizonYears; y++) sampleSet.add(y * 12);
    if (mesesPreEntrega > 0 && mesesPreEntrega <= totalMonths && mesesPreEntrega % 12 !== 0) sampleSet.add(mesesPreEntrega);
    const sampleArr = Array.from(sampleSet).sort((a, b) => a - b);

    return allData
      .filter((row) => sampleArr.includes(row._x))
      .map((row) => ({ ...row, name: annualCashflowLabel(row._x, mesesPreEntrega) }));
  }, [horizonYears, isMonthlyView, results, m, inputData]);

  interface PatrimonioRow {
    name: string;
    _x: number; // month number (0=T0, 12=Año 1, etc.)
    piePagado: number;
    capitalAmortizado: number;
    plusvalia: number;
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
      allData.push({ name: "T0", _x: 0, piePagado: 0, capitalAmortizado: 0, plusvalia: 0, saldoCredito: null, patrimonioNeto: 0, valorPropiedad: 0, isPreEntrega: true });

      for (let mo = 1; mo <= totalMonths; mo++) {
        const valorProp = precioCLP * Math.pow(1 + plusvaliaMensual, mo);
        const plusvaliaAcum = valorProp - precioCLP;

        if (mo < mesesPreEntrega) {
          // Pre-entrega: sin deuda ni valor propiedad
          // El mes justo antes de entrega usa 0 (no null) para que la línea suba DESDE cero
          const piePagado = Math.min(montoCuotaPie * mo, m.pieCLP);
          const esAntesDentrega = mo === mesesPreEntrega - 1;
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: Math.round(piePagado),
            capitalAmortizado: 0,
            plusvalia: Math.round(plusvaliaAcum),
            saldoCredito: esAntesDentrega ? 0 : null,
            patrimonioNeto: Math.round(piePagado + plusvaliaAcum),
            valorPropiedad: 0,
            isPreEntrega: true,
          });
        } else if (mo === mesesPreEntrega) {
          // Mes de entrega: deuda y valor propiedad aparecen
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: m.pieCLP,
            capitalAmortizado: 0,
            plusvalia: Math.round(plusvaliaAcum),
            saldoCredito: Math.round(creditoCLP),
            patrimonioNeto: Math.round(valorProp - creditoCLP),
            valorPropiedad: Math.round(valorProp),
            isEntrega: true,
          });
        } else {
          const mesesCredito = mo - mesesPreEntrega;
          const saldo = calcSaldo(mesesCredito);
          const capitalAmort = creditoCLP - saldo;
          allData.push({
            name: `M${mo}`, _x: mo,
            piePagado: m.pieCLP,
            capitalAmortizado: Math.round(Math.max(0, capitalAmort)),
            plusvalia: Math.round(plusvaliaAcum),
            saldoCredito: Math.round(saldo),
            patrimonioNeto: Math.round(valorProp - saldo),
            valorPropiedad: Math.round(valorProp),
          });
        }
      }
    } else {
      allData.push({ name: "T0", _x: 0, piePagado: m.pieCLP, capitalAmortizado: 0, plusvalia: 0, saldoCredito: creditoCLP, patrimonioNeto: m.pieCLP, valorPropiedad: precioCLP });

      for (let mo = 1; mo <= totalMonths; mo++) {
        const valorProp = precioCLP * Math.pow(1 + plusvaliaMensual, mo);
        const plusvaliaAcum = valorProp - precioCLP;
        const saldo = calcSaldo(mo);
        const capitalAmort = creditoCLP - saldo;
        allData.push({
          name: `M${mo}`, _x: mo,
          piePagado: m.pieCLP,
          capitalAmortizado: Math.round(Math.max(0, capitalAmort)),
          plusvalia: Math.round(plusvaliaAcum),
          saldoCredito: Math.round(saldo),
          patrimonioNeto: Math.round(valorProp - saldo),
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
  }, [results, m, inputData, horizonYears, plusvaliaRate, isMonthlyView]);

  const mapQuery = inputData?.direccion
    ? `${inputData.direccion}, ${comuna || inputData?.comuna}, Chile`
    : `${comuna || inputData?.comuna}, Santiago, Chile`;
  const googleMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  const exit = dynamicExit;
  const refi = dynamicRefi;

  const mainContent = (
    <>
      {/* Resumen ejecutivo with currency conversion */}
      <p className="mb-4 text-sm text-muted-foreground">{resumenEjecutivo}</p>

      {/* Currency Toggle */}
      <CurrencyToggle currency={currency} onToggle={toggleCurrency} />

      {/* ===== a) 3 Free Metric Boxes ===== */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>Yield Bruto</span>
              <InfoTooltip content="Retorno anual bruto: (arriendo anual / precio) × 100. Promedio Santiago: 3.5-4.5%" />
            </div>
            <div className="mt-1 text-2xl font-bold">{freeYieldBruto.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>Flujo Mensual</span>
              <InfoTooltip content="Lo que te queda (o falta) cada mes después de pagar dividendo, gastos comunes, contribuciones y mantención." />
            </div>
            <div className={`mt-1 text-2xl font-bold ${flujoUnificado >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {flujoUnificado >= 0 ? "+" : ""}{fmt(flujoUnificado)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{flujoText}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{currency === "UF" ? "UF/m²" : "Precio/m²"}</span>
              <InfoTooltip content="Precio por metro cuadrado. Permite comparar con otras propiedades de la zona." />
            </div>
            <div className="mt-1 text-2xl font-bold">
              {currency === "UF" ? `UF ${freePrecioM2.toFixed(1)}` : fmtCLP(freePrecioM2 * UF_CLP)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== SECTIONS ===== */}
      {results && m && (
        <>
          {/* ===== b) GRATIS SIN REGISTRO: Radar ===== */}
          <SectionCard title="Dimensiones del Score" icon={Target}>
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

          {/* CTA for guests — after radar */}
          {currentAccess === "guest" && (
            <Card className="mb-8 border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:flex-row md:text-left">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Tu InvertiScore es {score}. ¿Quieres saber por qué?</h3>
                  <p className="text-sm text-muted-foreground">Regístrate gratis para ver 8 métricas, sensibilidad, puntos críticos, comparación con zona y más.</p>
                </div>
                <a href="/register">
                  <Button size="lg" className="shrink-0 gap-2">Regístrate gratis</Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* ===== c) GRATIS CON REGISTRO: 8 Métricas ===== */}
          <SectionCard title="Métricas de Inversión" description="Los números clave. Pasa el cursor por cada métrica para saber qué significa." icon={BarChart3} gate="login" accessLevel={currentAccess} muted>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Yield Bruto", value: `${m.yieldBruto.toFixed(1)}%` },
                { label: "Yield Neto", value: `${m.yieldNeto.toFixed(1)}%` },
                { label: "CAP Rate", value: `${m.capRate.toFixed(1)}%`, subtitle: "CAP rate real (neto de gastos operativos)" },
                { label: "Cash-on-Cash", value: `${m.cashOnCash.toFixed(1)}%` },
                { label: "ROI Total", value: exit ? `${exit.multiplicadorCapital}x` : "\u2014" },
                { label: "TIR", value: exit ? `${exit.tir.toFixed(1)}%` : "\u2014" },
                { label: "Payback Pie", value: m.mesesPaybackPie < 999 ? `${m.mesesPaybackPie} meses` : "N/A" },
                { label: currency === "UF" ? "UF/m\u00B2" : "CLP/m\u00B2", value: currency === "UF" ? `UF ${m.precioM2.toFixed(1)}` : fmtCLP(m.precioM2 * UF_CLP) },
              ].map(({ label, value, subtitle }) => (
                <div key={label} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {label}
                    {METRIC_TOOLTIPS[label] && <InfoTooltip content={METRIC_TOOLTIPS[label]} />}
                  </div>
                  <div className="text-lg font-bold">{value}</div>
                  {subtitle && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{subtitle}</div>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ===== d) GRATIS CON REGISTRO: Sensibilidad ===== */}
          <SectionCard title="Análisis de Sensibilidad" description="¿Cómo cambian tus resultados si varían las condiciones?" icon={Shield} gate="login" accessLevel={currentAccess} muted>
            {results && inputData && (() => {
              const baseTasa = inputData.tasaInteres;
              const baseArriendo = inputData.arriendo;
              const baseVacancia = inputData.vacanciaMeses;

              // Table 1: Tasa vs Arriendo → Flujo neto mensual
              const tasaDeltas = [-1, 0, 1, 2];
              const arriendoPcts = [-15, 0, 15];
              const table1 = tasaDeltas.map((td) =>
                arriendoPcts.map((ap) => recalcForSensitivity(results, inputData, td, ap, 0))
              );

              // Table 2: Vacancia vs Plusvalía → Score
              const vacanciaVals = [0, 1, 2, 3];
              const plusvaliaVals = [2, 4, 6];
              const table2 = vacanciaVals.map((vac) =>
                plusvaliaVals.map((pv) => {
                  const r = recalcForSensitivity(results, inputData, 0, 0, vac - baseVacancia);
                  // Adjust score slightly for plusvalía context (higher plusvalía = better score)
                  const pvBonus = pv === 2 ? -5 : pv === 6 ? 5 : 0;
                  return { ...r, score: Math.min(100, Math.max(0, r.score + pvBonus)) };
                })
              );

              const scoreColor = (s: number) => s >= 60 ? "text-emerald-500" : s >= 40 ? "text-amber-500" : "text-red-500";
              const flujoColor = (f: number) => f >= 0 ? "text-emerald-500" : "text-red-500";

              return (
                <>
                  {/* Table 1 */}
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-semibold">Sensibilidad por tasa de interés y arriendo</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 text-left">Tasa</th>
                            {arriendoPcts.map((ap) => (
                              <th key={ap} className="pb-2 px-2 text-center">
                                {ap === 0 ? `${fmtCLP(baseArriendo)}` : `${ap > 0 ? "+" : ""}${ap}%`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tasaDeltas.map((td, i) => (
                            <tr key={td} className="border-b border-border/30">
                              <td className="py-2 pr-3 text-xs text-muted-foreground">
                                {td === 0 ? `${baseTasa.toFixed(1)}%` : `${(baseTasa + td).toFixed(1)}% (${td > 0 ? "+" : ""}${td}%)`}
                              </td>
                              {arriendoPcts.map((ap, j) => {
                                const cell = table1[i][j];
                                const isCurrent = td === 0 && ap === 0;
                                return (
                                  <td key={ap} className={`py-2 px-2 text-center font-medium ${flujoColor(cell.flujo)} ${isCurrent ? "rounded-md ring-2 ring-emerald-500/40 bg-emerald-500/5" : ""}`}>
                                    {fmtCLP(cell.flujo)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Flujo neto mensual. El escenario actual está resaltado.</p>
                  </div>

                  {/* Table 2 */}
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-semibold">Sensibilidad por vacancia y plusvalía</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 text-left">Vacancia</th>
                            {plusvaliaVals.map((pv) => (
                              <th key={pv} className="pb-2 px-2 text-center">Plusvalía {pv}%</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vacanciaVals.map((vac, i) => (
                            <tr key={vac} className="border-b border-border/30">
                              <td className="py-2 pr-3 text-xs text-muted-foreground">
                                {vac} mes{vac !== 1 ? "es" : ""}/año
                              </td>
                              {plusvaliaVals.map((pv, j) => {
                                const cell = table2[i][j];
                                const isCurrent = vac === Math.round(baseVacancia) && pv === 4;
                                return (
                                  <td key={pv} className={`py-2 px-2 text-center font-medium ${scoreColor(cell.score)} ${isCurrent ? "rounded-md ring-2 ring-emerald-500/40 bg-emerald-500/5" : ""}`}>
                                    {cell.score}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Score InvertiScore. El escenario actual está resaltado.</p>
                  </div>

                  <p className="mb-4 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
                    Cada celda muestra cómo cambian tus resultados si varían las condiciones. El escenario actual está resaltado.
                  </p>

                  {/* Keep Pessimist/Base/Optimist scenarios */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-4">Escenario</th>
                          <th className="pb-2 pr-4">Score</th>
                          <th className="pb-2 pr-4">Flujo Neto /mes</th>
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
                            <td className={`py-2 pr-4 font-medium ${data.flujo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(data.flujo)}</td>
                            <td className="py-2">{data.yieldNeto.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </SectionCard>

          {/* ===== e) GRATIS CON REGISTRO: Puntos Críticos ===== */}
          <SectionCard title="Puntos Críticos" description="Los límites que debes conocer antes de decidir." icon={Target} gate="login" accessLevel={currentAccess} muted>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <div className="text-xs text-muted-foreground">Break-even tasa de interés</div>
                <div className="mt-1 text-2xl font-bold">
                  {results.breakEvenTasa === -1 ? "N/A" : `${results.breakEvenTasa.toFixed(2)}%`}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {results.breakEvenTasa === -1
                    ? "Incluso con tasa 0%, el flujo sería negativo. Los gastos operativos superan el arriendo."
                    : inputData && results.breakEvenTasa < inputData.tasaInteres
                      ? `Para tener flujo positivo necesitarías una tasa de ${results.breakEvenTasa.toFixed(2)}%, muy por debajo de la actual (${inputData.tasaInteres.toFixed(2)}%). El retorno viene por la plusvalía, no por el flujo mensual.`
                      : `Tu flujo es positivo. Si la tasa sube por encima de ${results.breakEvenTasa.toFixed(2)}%, pasarías a flujo negativo. Margen de ${inputData ? (results.breakEvenTasa - inputData.tasaInteres).toFixed(2) : "—"} puntos porcentuales.`}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <div className="text-xs text-muted-foreground">Precio máximo de compra</div>
                <div className="mt-1 text-2xl font-bold">
                  {currency === "UF"
                    ? fmtUF(results.valorMaximoCompra)
                    : fmtCLP(results.valorMaximoCompra * UF_CLP)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para tener flujo positivo con estos datos, no deberías pagar más de este precio.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ===== f) GRATIS CON REGISTRO: Comparación zona + Mapa ===== */}
          <SectionCard title="Comparación con Zona" icon={Building2} gate="login" accessLevel={currentAccess}>
            {(() => {
              if (!zoneData || zoneData.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Datos de mercado no disponibles para esta comuna.
                  </p>
                );
              }

              const avgArriendoZona = Math.round(zoneData.reduce((s, d) => s + d.arriendo_promedio, 0) / zoneData.length);
              const avgM2Zona = Math.round(zoneData.reduce((s, d) => s + d.precio_m2_promedio, 0) / zoneData.length * 10) / 10;
              const totalPubs = zoneData.reduce((s, d) => s + d.numero_publicaciones, 0);

              const avgSuperficie = avgArriendoZona > 0 && avgM2Zona > 0
                ? avgArriendoZona / (avgM2Zona * UF_CLP / 12 * 0.045)
                : 50;
              const yieldZona = avgM2Zona > 0 && avgSuperficie > 0
                ? (avgArriendoZona * 12) / (avgM2Zona * avgSuperficie * UF_CLP) * 100
                : m.yieldBruto * 0.9;

              const items = [
                { label: currency === "UF" ? "Precio/m\u00B2 (UF)" : "Precio/m\u00B2 (CLP)", tuyo: currency === "UF" ? m.precioM2 : m.precioM2 * UF_CLP, zona: currency === "UF" ? avgM2Zona : avgM2Zona * UF_CLP },
                { label: "Arriendo promedio", tuyo: m.ingresoMensual, zona: avgArriendoZona },
                { label: "Yield Bruto (%)", tuyo: m.yieldBruto, zona: Math.round(yieldZona * 10) / 10 },
              ];
              return (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Basado en {totalPubs} publicaciones activas en {comuna}.
                  </p>
                  {items.map(({ label, tuyo, zona }) => {
                    const maxVal = Math.max(tuyo, zona) || 1;
                    const fmtVal = (v: number) =>
                      label.includes("Yield") ? v.toFixed(1) + "%"
                      : label.includes("Arriendo") ? fmt(v)
                      : currency === "UF" ? `UF ${v.toFixed(1)}` : fmtCLP(v);
                    return (
                      <div key={label}>
                        <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                        <div className="mb-1 flex items-center gap-3">
                          <span className="w-20 text-xs">Tu propiedad</span>
                          <div className="h-4 flex-1 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((tuyo / maxVal) * 100, 100)}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs font-medium">{fmtVal(tuyo)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs">Promedio zona</span>
                          <div className="h-4 flex-1 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.min((zona / maxVal) * 100, 100)}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs font-medium">{fmtVal(zona)}</span>
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
                <iframe src={googleMapUrl} width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa de ubicación" />
              </div>
            </div>
          </SectionCard>

          {/* ===== PREMIUM: g) Cascada de Costos Mensual ===== */}
          <SectionCard title="Cascada de Costos Mensual" description="Un mes típico estabilizado: así se reparte tu arriendo." icon={DollarSign} gate="premium" accessLevel={currentAccess} analysisId={analysisId}>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" dy={10} interval={0} height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtAxis} />
                  <RechartsTooltip
                    content={({ active, payload, label: wfLabel }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = waterfallData.find((d) => d.name === wfLabel);
                      if (!item) return null;
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                          <div className="mb-1 font-semibold">{item.isResult ? `→ ${item.name}` : item.name}</div>
                          <div className={item.delta >= 0 ? "text-emerald-500" : "text-red-400"}>
                            {item.delta >= 0 ? "+" : ""}{fmt(item.delta)}
                          </div>
                          <div className="text-muted-foreground">Acumulado: {fmt(item.running)}</div>
                        </div>
                      );
                    }}
                    {...(isTouchDevice ? { trigger: "click" as const } : {})}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="range" radius={[4, 4, 0, 0]}>
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
            {m && (
              <div className={`mt-3 flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-bold ${flujoUnificado >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                Flujo neto mensual: {flujoUnificado >= 0 ? "+" : ""}{fmt(flujoUnificado)}
              </div>
            )}
          </SectionCard>

          {/* ===== PREMIUM: h) Análisis Detallado (IA) ===== */}
          <SectionCard title="Análisis Detallado" icon={Brain} gate="premium" accessLevel={currentAccess} analysisId={analysisId}>
            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="space-y-4">
                {/* Fallback: análisis determinístico */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-emerald-400">A favor de esta inversión</h4>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {results.pros.map((p, i) => (
                      <li key={i}>{stripBullet(p)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-red-400">Puntos de atención</h4>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {results.contras.map((c, i) => (
                      <li key={i}>{stripBullet(c)}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                  <h4 className="mb-2 text-sm font-semibold">Veredicto</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{results.resumen}</p>
                </div>
                <button
                  type="button"
                  onClick={loadAiAnalysis}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4" />
                  Generar análisis profundo con IA
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analizando tu inversión con IA... (15-30 segundos)</p>
              </div>
            )}

            {aiError && (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
                  Error: {aiError}
                </div>
                <button type="button" onClick={loadAiAnalysis} className="text-sm font-medium text-primary hover:underline">
                  Reintentar
                </button>
                {/* Fallback */}
                <div className="mt-4 space-y-4 border-t border-border/30 pt-4">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-emerald-400">A favor de esta inversión</h4>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {results.pros.map((p, i) => <li key={i}>{stripBullet(p)}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-red-400">Puntos de atención</h4>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {results.contras.map((c, i) => <li key={i}>{stripBullet(c)}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {aiAnalysis && (
              <div className="space-y-5">
                {/* 1. Resumen Ejecutivo */}
                <div className={`rounded-lg border p-4 ${score >= 60 ? "border-emerald-500/30 bg-emerald-500/5" : score >= 40 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                  <p className="text-sm font-medium leading-relaxed">{ct(aiAnalysis as unknown as Record<string, unknown>, "resumenEjecutivo")}</p>
                </div>

                {/* 2. Tu Bolsillo */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{aiAnalysis.tuBolsillo.titulo}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "contenido")}</p>
                  {ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta") && (
                    <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <p className="flex items-start gap-2 text-xs text-red-400">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {ct(aiAnalysis.tuBolsillo as unknown as Record<string, unknown>, "alerta")}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Vs Alternativas */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{aiAnalysis.vsAlternativas.titulo}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ct(aiAnalysis.vsAlternativas as unknown as Record<string, unknown>, "contenido")}</p>
                </div>

                {/* 4. Negociación */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{aiAnalysis.negociacion.titulo}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ct(aiAnalysis.negociacion as unknown as Record<string, unknown>, "contenido")}</p>
                  {aiAnalysis.negociacion.precioSugerido && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Precio sugerido:</span>
                      <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-500">{aiAnalysis.negociacion.precioSugerido}</span>
                    </div>
                  )}
                </div>

                {/* 5. Proyección */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{aiAnalysis.proyeccion.titulo}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ct(aiAnalysis.proyeccion as unknown as Record<string, unknown>, "contenido")}</p>
                </div>

                {/* 6. Riesgos */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{aiAnalysis.riesgos.titulo}</h4>
                  </div>
                  <ul className="space-y-2">
                    {ci(aiAnalysis.riesgos as unknown as Record<string, unknown>, "items").map((r, i) => (
                      <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                        <span className="mr-1 font-medium text-red-400">⚠</span> {stripBullet(r)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 7. Veredicto */}
                <div className="rounded-lg border-2 border-border/50 bg-card/50 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <h4 className="text-sm font-semibold">{aiAnalysis.veredicto.titulo}</h4>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                      aiAnalysis.veredicto.decision === "COMPRAR" ? "bg-emerald-500/15 text-emerald-500" :
                      aiAnalysis.veredicto.decision === "NEGOCIAR" ? "bg-amber-500/15 text-amber-500" :
                      "bg-red-500/15 text-red-500"
                    }`}>
                      {aiAnalysis.veredicto.decision}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ct(aiAnalysis.veredicto as unknown as Record<string, unknown>, "explicacion")}</p>
                </div>

                {/* 8. A Favor / Puntos de Atención */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> A favor
                    </h4>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {aiAnalysis.aFavor.map((p, i) => <li key={i}>{p.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").trim()}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-400">
                      <AlertTriangle className="h-4 w-4" /> Atención
                    </h4>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {aiAnalysis.puntosAtencion.map((c, i) => <li key={i}>{c.replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ¿¡]+/, "").trim()}</li>)}
                    </ul>
                  </div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground/50">Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.</p>
              </div>
            )}
          </SectionCard>

          {/* ===== PREMIUM: i) Flujo, Patrimonio y Salida ===== */}
          <div className="relative mb-8">
            <Card className="border-border/50 bg-primary/[0.03]">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle>Flujo, Patrimonio y Salida</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Ajusta el horizonte para ver cómo evoluciona tu inversión en el tiempo.</p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Horizonte:</span>
                    <input type="range" min={1} max={20} value={horizonYears} onChange={(e) => setHorizonYears(Number(e.target.value))} className="w-48 accent-primary" />
                    <span className="text-sm font-medium">{horizonYears} año{horizonYears > 1 ? "s" : ""}</span>
                    <span className="text-xs text-muted-foreground">({isMonthlyView ? "vista mensual" : "vista anual"})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Plusvalía anual:</span>
                    <input type="range" min={0} max={8} step={0.5} value={plusvaliaRate} onChange={(e) => setPlusvaliaRate(Number(e.target.value))} className="w-48 accent-primary" />
                    <span className="text-sm font-medium">{plusvaliaRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Promedio histórico Santiago: 3-5% anual. Comunas premium pueden superar 6%.</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Flujo de Caja */}
                <div>
                  <h4 className="mb-1 text-sm font-semibold">
                    Flujo de Caja — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}
                  </h4>
                  <p className="mb-3 text-xs text-muted-foreground">Cuánto entra y cuánto sale. La línea azul muestra tu acumulado.</p>
                  <div className="relative h-64">
                    <ResponsiveContainer>
                      <ComposedChart data={cashflowData} stackOffset="sign" margin={{ top: 5, right: 10, left: 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                        {/* Eje categórico visible: barras uniformes */}
                        <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: cashflowData.length > 25 ? 7 : cashflowData.length > 15 ? 8 : 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" dy={10} interval={cashflowData.length > 15 ? Math.ceil(cashflowData.length / 10) : isMonthlyView && horizonYears > 1 ? "preserveStartEnd" : 0} height={60} />
                        {/* Eje numérico oculto: posiciona la línea de entrega */}
                        <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtAxis} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as CashflowRow | undefined;
                            if (!row) return null;
                            return (
                              <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                                <div className="mb-1.5 font-semibold">{row.name}</div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#10b981" }} />Ingreso: <span className="font-medium text-emerald-500">{fmt(row.Ingreso)}</span></div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />Dividendo: <span className="font-medium text-red-400">{fmt(row.Dividendo)}</span></div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />GGCC vacancia: <span className="font-medium text-red-400">{fmt(row.GGCC)}</span></div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#d97706" }} />Contribuciones: <span className="font-medium text-red-400">{fmt(row.Contribuciones)}</span></div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#f43f5e" }} />Mantención: <span className="font-medium text-red-400">{fmt(row.Mantencion)}</span></div>
                                <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#6b7280" }} />Vacancia: <span className="font-medium text-red-400">{fmt(row.Vacancia)}</span></div>
                                <div className="my-1 border-t border-border/50" />
                                <div className={`font-bold ${row.FlujoNeto >= 0 ? "text-emerald-500" : "text-red-500"}`}>Flujo neto: {fmt(row.FlujoNeto)}</div>
                                <div className="text-blue-400">Acumulado: {fmt(row.Acumulado)}</div>
                              </div>
                            );
                          }}
                          {...(isTouchDevice ? { trigger: "click" as const } : {})}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 3" strokeWidth={1} />
                        {/* Una sola columna apilada: ingreso sube, egresos bajan */}
                        <Bar xAxisId="cat" dataKey="Ingreso" stackId="stack" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar xAxisId="cat" dataKey="Dividendo" stackId="stack" fill="#ef4444" />
                        <Bar xAxisId="cat" dataKey="GGCC" stackId="stack" fill="#f97316" />
                        <Bar xAxisId="cat" dataKey="Contribuciones" stackId="stack" fill="#d97706" />
                        <Bar xAxisId="cat" dataKey="Mantencion" stackId="stack" fill="#f43f5e" />
                        <Bar xAxisId="cat" dataKey="Vacancia" name="Vacancia y otros" stackId="stack" fill="#6b7280" radius={[0, 0, 4, 4]} />
                        {/* Línea acumulado */}
                        <Line xAxisId="cat" type="monotone" dataKey="Acumulado" stroke="#3b82f6" strokeWidth={2} dot={isMonthlyView ? { r: 2 } : false} legendType="none" />
                        {/* Línea vertical de entrega */}
                        {mesesPreEntregaTop > 0 && !horizonBeforeDelivery && (
                          <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {/* Leyenda manual */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#10b981" }} />Ingreso</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />Dividendo</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />GGCC vacancia</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#d97706" }} />Contribuciones</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#f43f5e" }} />Mantención</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#6b7280" }} />Vacancia</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "#3b82f6", height: 2 }} />Acumulado</span>
                    </div>
                    {horizonBeforeDelivery && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[1px]">
                        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-primary/30 bg-card/95 px-6 py-5 text-center shadow-lg">
                          <Clock className="h-7 w-7 text-primary" />
                          <span className="text-sm font-semibold">Tu inversión aún no genera flujo</span>
                          <p className="text-xs text-muted-foreground">
                            La entrega está estimada para {fechaEntregaLabel}. Hasta entonces no hay ingresos ni gastos operativos.
                            Aumenta el horizonte a más de {mesesPreEntregaTop} meses para ver el flujo post-entrega.
                          </p>
                          <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="text-xs font-medium text-primary hover:underline">
                            Ver desde la entrega →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Proyección de Patrimonio */}
                {projData.length > 0 && (
                  <>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-sm font-semibold">Proyección de Patrimonio — {isMonthlyView ? `${horizonYears} año${horizonYears > 1 ? "s" : ""} (mensual)` : `${horizonYears} años (anual)`}</h4>
                        {horizonBeforeDelivery && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            Período pre-entrega: tu patrimonio crece con los pagos del pie
                          </span>
                        )}
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">De dónde viene tu patrimonio. Plusvalía {plusvaliaRate.toFixed(1)}%/año y arriendos +3.5%/año.</p>
                      <div className="h-72">
                        <ResponsiveContainer>
                          <ComposedChart data={projData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }} barCategoryGap="15%" barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                            {/* Eje categórico visible: barras uniformes */}
                            <XAxis xAxisId="cat" dataKey="name" tick={{ fontSize: projData.length > 25 ? 7 : projData.length > 15 ? 8 : 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" dy={10} interval={projData.length > 15 ? Math.ceil(projData.length / 10) : isMonthlyView ? "preserveStartEnd" : 0} height={60} />
                            {/* Eje numérico oculto: posiciona la línea de entrega */}
                            <XAxis xAxisId="num" dataKey="_x" type="number" hide domain={[0, horizonYears * 12]} />
                            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtAxis} />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const row = payload[0]?.payload as PatrimonioRow | undefined;
                                if (!row) return null;
                                const pre = row.isPreEntrega;
                                return (
                                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                                    <div className="mb-1.5 font-semibold">{row.name}{pre ? " (pre-entrega)" : ""}</div>
                                    {pre ? (
                                      <>
                                        <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#065f46" }} />Pie acumulado: <span className="font-medium">{fmt(row.piePagado)}</span></div>
                                        <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#22c55e", opacity: 0.5 }} />Plusvalía estimada: <span className="font-medium">{fmt(row.plusvalia)}</span></div>
                                        <div className="text-muted-foreground">Deuda: $0 (crédito aún no comienza)</div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#1e40af", opacity: 0.3 }} />Valor propiedad: <span className="font-medium">{fmt(row.valorPropiedad)}</span></div>
                                        <div className="flex items-center gap-1.5 text-red-400"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />Deuda restante: <span className="font-medium">-{fmt(row.saldoCredito ?? 0)}</span></div>
                                        <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#065f46" }} />Pie + amortización: <span className="font-medium">{fmt(row.piePagado + row.capitalAmortizado)}</span></div>
                                        <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#22c55e", opacity: 0.5 }} />Plusvalía acumulada: <span className="font-medium">{fmt(row.plusvalia)}</span></div>
                                      </>
                                    )}
                                    <div className="mt-1 border-t border-border/50 pt-1 font-semibold" style={{ color: "#f59e0b" }}>Patrimonio neto: {fmt(row.patrimonioNeto)}</div>
                                  </div>
                                );
                              }}
                              {...(isTouchDevice ? { trigger: "click" as const } : {})}
                            />
                            {/* Área azul oscuro: valor propiedad (0 pre-entrega futura, valor real post-entrega) */}
                            <Area xAxisId="cat" type="monotone" dataKey="valorPropArea" fill="#1e40af" fillOpacity={0.12} stroke="#1e40af" strokeWidth={2} />
                            {/* Área roja: deuda */}
                            <Area xAxisId="cat" type="monotone" dataKey="saldoCredito" fill="#ef4444" fillOpacity={0.12} stroke="none" />
                            {/* Barras apiladas: pie + amortización */}
                            <Bar xAxisId="cat" dataKey="piePagado" stackId="patrimonio" fill="#065f46" name="Pie pagado" radius={[0, 0, 0, 0]} />
                            <Bar xAxisId="cat" dataKey="capitalAmortizado" stackId="patrimonio" fill="#059669" name="Capital amortizado" radius={[0, 0, 0, 0]} />
                            {/* Plusvalía: azul */}
                            <Bar xAxisId="cat" dataKey="plusvalia" stackId="patrimonio" fill="#22c55e" fillOpacity={0.4} stroke="#22c55e" strokeOpacity={0.6} name="Plusvalía" radius={[4, 4, 0, 0]} />
                            {/* Línea: deuda roja */}
                            <Line xAxisId="cat" type="monotone" dataKey="saldoCredito" stroke="#ef4444" strokeWidth={2} dot={false} name="Deuda restante" />
                            {/* Línea principal: patrimonio neto naranja */}
                            <Line xAxisId="cat" type="monotone" dataKey="patrimonioNeto" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, fill: "#f59e0b" }} name="Patrimonio neto" />
                            {/* Línea vertical de entrega */}
                            {mesesPreEntregaTop > 0 && (
                              <ReferenceLine xAxisId="num" x={mesesPreEntregaTop} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Entrega", position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Leyenda manual */}
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#065f46" }} />Pie pagado</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#059669" }} />Capital amortizado</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#22c55e", opacity: 0.5 }} />Plusvalía</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#1e40af", opacity: 0.3 }} />Valor propiedad</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444", opacity: 0.4 }} />Deuda</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded" style={{ background: "#f59e0b", height: 3 }} />Patrimonio neto</span>
                      </div>
                      {/* Desglose de patrimonio */}
                      {(() => {
                        const lastProj = dynamicProjections[horizonYears - 1];
                        if (!lastProj || !m || !inputData) return null;
                        const precioOriginal = inputData.precio * UF_CLP;
                        const creditoOriginal = precioOriginal * (1 - inputData.piePct / 100);
                        const plusvaliaGanancia = lastProj.valorPropiedad - precioOriginal;
                        const capitalAmortizado = creditoOriginal - lastProj.saldoCredito;
                        const flujoAcum = lastProj.flujoAcumulado;
                        const patrimonioTotal = m.pieCLP + plusvaliaGanancia + capitalAmortizado + flujoAcum;
                        return (
                          <div className="mt-4 rounded-lg border border-border/50 bg-secondary/30">
                            {/* Mobile: stacked list */}
                            <div className="space-y-0 divide-y divide-border/30 sm:hidden">
                              {[
                                { label: "Tu inversión inicial (pie)", value: fmt(m.pieCLP) },
                                { label: `Ganancia por plusvalía (${fmtUF(inputData.precio)} → ${fmtUF(lastProj.valorPropiedad / UF_CLP)})`, value: fmt(plusvaliaGanancia), color: "text-emerald-400" },
                                { label: "Capital amortizado", value: fmt(capitalAmortizado), color: "text-emerald-400" },
                                { label: "Flujo acumulado", value: fmt(flujoAcum), color: flujoAcum >= 0 ? "text-emerald-400" : "text-red-400" },
                                { label: "Patrimonio neto total", value: fmt(patrimonioTotal), color: "text-primary", bold: true },
                              ].map(({ label, value, color, bold }) => (
                                <div key={label} className={`px-3 py-2 ${bold ? "bg-secondary/40" : ""}`}>
                                  <div className="text-[11px] text-muted-foreground">{label}</div>
                                  <div className={`text-sm font-medium ${color || ""} ${bold ? "font-bold" : ""}`}>{value}</div>
                                </div>
                              ))}
                            </div>
                            {/* Desktop: table */}
                            <table className="hidden w-full text-sm sm:table">
                              <tbody>
                                <tr className="border-b border-border/30">
                                  <td className="py-2 px-4 text-muted-foreground">Tu inversión inicial (pie)</td>
                                  <td className="py-2 px-4 text-right font-medium">{fmt(m.pieCLP)}</td>
                                </tr>
                                <tr className="border-b border-border/30">
                                  <td className="py-2 px-4 text-muted-foreground">Ganancia por plusvalía ({fmtUF(inputData.precio)} → {fmtUF(lastProj.valorPropiedad / UF_CLP)})</td>
                                  <td className="py-2 px-4 text-right font-medium text-emerald-400">{fmt(plusvaliaGanancia)}</td>
                                </tr>
                                <tr className="border-b border-border/30">
                                  <td className="py-2 px-4 text-muted-foreground">Capital amortizado (pagado del crédito)</td>
                                  <td className="py-2 px-4 text-right font-medium text-emerald-400">{fmt(capitalAmortizado)}</td>
                                </tr>
                                <tr className="border-b border-border/30">
                                  <td className="py-2 px-4 text-muted-foreground">Flujo acumulado (ganancia/aporte de bolsillo)</td>
                                  <td className={`py-2 px-4 text-right font-medium ${flujoAcum >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(flujoAcum)}</td>
                                </tr>
                                <tr className="border-t border-border/50">
                                  <td className="py-2 px-4 font-semibold">Patrimonio neto total</td>
                                  <td className="py-2 px-4 text-right font-bold text-primary">{fmt(patrimonioTotal)}</td>
                                </tr>
                              </tbody>
                            </table>
                            <p className="px-3 pb-2 text-[10px] text-muted-foreground sm:px-4">= pie + plusvalía + amortización + flujo</p>
                          </div>
                        );
                      })()}
                    </div>
                    <hr className="border-border/30" />
                  </>
                )}

                {/* Escenario de Salida */}
                {horizonBeforeDelivery ? (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Escenario de Salida</h4>
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                      <Clock className="h-5 w-5 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">No puedes vender ni refinanciar antes de la entrega</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          La entrega está estimada para {fechaEntregaLabel}. Aumenta el horizonte para ver escenarios de salida.
                        </p>
                        <button type="button" onClick={() => setHorizonYears(anosParaVerFlujo)} className="mt-2 text-xs font-medium text-primary hover:underline">
                          Ver desde la entrega →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : exit && refi ? (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Escenario de Salida {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`}</h4>
                    <p className="mb-3 text-xs text-muted-foreground">Toda inversión tiene un momento de salida. Simulamos dos opciones:</p>
                    <div className="mb-4 flex overflow-hidden rounded-lg border border-border">
                      <button type="button" onClick={() => setExitMode("venta")} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "venta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>Venta</button>
                      <button type="button" onClick={() => setExitMode("refinanciamiento")} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "refinanciamiento" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>Refinanciamiento</button>
                    </div>

                    {exitMode === "venta" ? (
                      <div className="space-y-3 text-sm">
                        <p className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
                          Si vendieras {exit.anios === 1 ? "al año 1" : `a los ${exit.anios} años`} al valor proyectado (plusvalía {plusvaliaRate.toFixed(1)}%/año), ¿cuánto ganarías después de pagar el crédito y la comisión?
                        </p>
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
                        {exit.multiplicadorCapital > 1 && (
                          <p className="mt-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400">
                            Tu pie se multiplicaría por {exit.multiplicadorCapital}x en {exit.anios === 1 ? "1 año" : `${exit.anios} años`}.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <p className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
                          Si en vez de vender refinancias {horizonYears === 1 ? "al año 1" : `a los ${horizonYears} años`} con el nuevo valor de mercado, ¿cuánto capital puedes liberar para otra inversión?
                        </p>
                        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 p-3">
                          <span className="text-xs text-muted-foreground">% refinanciamiento:</span>
                          <div className="flex flex-wrap gap-1">
                            {[60, 70, 80, 90].map((pct) => (
                              <button key={pct} type="button" onClick={() => setRefiPct(pct)}
                                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${refiPct === pct ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                              >{pct}%</button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Los bancos en Chile financian hasta 80% del valor de tasación. Algunos ofrecen hasta 90% para propiedades de inversión con buen historial.</p>
                        {[
                          { label: "Nuevo avalúo", value: fmt(refi.nuevoAvaluo) },
                          { label: `Nuevo crédito (${refiPct}%)`, value: fmt(refi.nuevoCredito) },
                          { label: "Capital liberado", value: fmt(refi.capitalLiberado), positive: true },
                          { label: "Nuevo dividendo", value: fmt(refi.nuevoDividendo) },
                          { label: "Nuevo flujo neto", value: fmt(refi.nuevoFlujoNeto), positive: refi.nuevoFlujoNeto > 0 },
                        ].map(({ label, value, positive }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={positive ? "text-emerald-400 font-medium" : ""}>{value}</span>
                          </div>
                        ))}
                        {refi.capitalLiberado > 0 && (
                          <p className="mt-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-400">
                            Podrías usar {fmt(refi.capitalLiberado)} como pie para una segunda inversión.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {currentAccess === "guest" && <RegisterOverlay />}
            {currentAccess === "free" && analysisId && (
              <PaywallOverlay analysisId={analysisId} />
            )}
          </div>

          {/* ===== Bottom CTAs ===== */}
          {currentAccess === "guest" && (
            <Card className="mb-8 border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <Lock className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-bold">Regístrate para ver el análisis completo</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Accede gratis a 8 métricas, sensibilidad, puntos críticos, comparación con zona y más.
                </p>
                <a href="/register">
                  <Button size="lg" className="gap-2">Regístrate gratis</Button>
                </a>
              </CardContent>
            </Card>
          )}

          {currentAccess === "free" && analysisId && (
            <BottomPaywallCTA analysisId={analysisId} />
          )}
        </>
      )}

    </>
  );

  // Panel content shared between desktop sidebar and mobile drawer
  const panelContent = currentAccess !== "guest" && inputData ? (
    <div className="space-y-5">
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cuánto cuesta</h4>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Precio (UF)</label>
              <input type="number" value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-20 rounded border border-border bg-background px-2 py-0.5 text-right text-xs" />
            </div>
            <input type="range" min={500} max={10000} step={50} value={adjPrecio} onChange={(e) => setAdjPrecio(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Pie</label>
              <span className="text-xs font-medium">{adjPiePct}%</span>
            </div>
            <input type="range" min={10} max={50} step={5} value={adjPiePct} onChange={(e) => setAdjPiePct(Number(e.target.value))} className="w-full accent-primary" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financiamiento</h4>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Plazo</label>
              <span className="text-xs font-medium">{adjPlazo} años</span>
            </div>
            <input type="range" min={10} max={30} step={1} value={adjPlazo} onChange={(e) => setAdjPlazo(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Tasa (%)</label>
              <input type="number" step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-16 rounded border border-border bg-background px-2 py-0.5 text-right text-xs" />
            </div>
            <input type="range" min={1} max={8} step={0.1} value={adjTasa} onChange={(e) => setAdjTasa(Number(e.target.value))} className="w-full accent-primary" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cuánto genera</h4>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Arriendo</label>
              <input type="number" value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-24 rounded border border-border bg-background px-2 py-0.5 text-right text-xs" />
            </div>
            <input type="range" min={100000} max={2000000} step={10000} value={adjArriendo} onChange={(e) => setAdjArriendo(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">GGCC</label>
              <input type="number" value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-24 rounded border border-border bg-background px-2 py-0.5 text-right text-xs" />
            </div>
            <input type="range" min={0} max={300000} step={5000} value={adjGastos} onChange={(e) => setAdjGastos(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Contrib. /trim</label>
              <input type="number" value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-24 rounded border border-border bg-background px-2 py-0.5 text-right text-xs" />
            </div>
            <input type="range" min={0} max={500000} step={10000} value={adjContribuciones} onChange={(e) => setAdjContribuciones(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Vacancia (meses/año)</label>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((v) => (
                <button key={v} type="button" onClick={() => setAdjVacancia(v)}
                  className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${adjVacancia === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >{v}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Button onClick={handleRecalculate} disabled={recalcLoading} className="w-full gap-2">
        {recalcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {recalcLoading ? "Recalculando..." : "Recalcular"}
      </Button>
      {recalcSuccess && <p className="text-center text-sm text-emerald-500">Actualizado</p>}
    </div>
  ) : null;

  return (
    <div className={`${panelContent ? "lg:flex lg:items-start lg:gap-6" : ""}`}>
      {/* Main content */}
      <div className={panelContent ? "min-w-0 lg:flex-1" : ""}>
        {mainContent}
      </div>

      {/* Desktop: sticky sidebar */}
      {panelContent && (
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div
            className="scrollbar-hide sticky top-[80px] overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white p-4"
            style={{ maxHeight: "calc(100vh - 100px)" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Ajusta los números</h3>
            </div>
            {panelContent}
          </div>
        </aside>
      )}

      {/* Mobile: floating button + drawer */}
      {panelContent && (
        <>
          <div className="fixed bottom-20 right-4 z-40 flex items-center gap-3 lg:hidden">
            {!fabShown && (
              <div className="animate-pulse rounded-full bg-[#059669] px-4 py-2 text-sm font-medium text-white shadow-lg">
                Ajusta el análisis
              </div>
            )}
            <button
              type="button"
              onClick={() => { setDrawerOpen(true); setFabShown(true); }}
              className={`flex items-center justify-center rounded-full bg-[#059669] text-white shadow-lg transition-all duration-500 hover:scale-105 ${fabShown ? "h-[52px] w-[52px]" : "h-[72px] w-[72px]"}`}
            >
              <SlidersHorizontal className={`transition-all duration-500 ${fabShown ? "h-5 w-5" : "h-7 w-7"}`} />
            </button>
          </div>

          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Ajusta los números</h3>
                  </div>
                  <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full p-1 hover:bg-muted">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {panelContent}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

