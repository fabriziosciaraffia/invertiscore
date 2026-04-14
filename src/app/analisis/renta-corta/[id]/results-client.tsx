"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  Lock, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, ArrowUpDown, Home, DollarSign,
  Building2, Zap, Droplets, Wifi, Package, Wrench, Receipt,
} from "lucide-react";
import type { ShortTermResult, EscenarioSTR, FlujoEstacionalMes, SensibilidadRow } from "@/lib/engines/short-term-engine";

// ─── Module-level UF ───────────────────────────────
let UF_CLP = 38800;

// ─── Formatting helpers (same as LTR) ──────────────
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

// ─── Verdict helpers ────────────────────────────────
const VERDICT_CONFIG = {
  VIABLE: {
    color: "var(--franco-positive, #B0BEC5)",
    bg: "rgba(176,190,197,0.12)",
    border: "rgba(176,190,197,0.25)",
    icon: CheckCircle2,
    label: "VIABLE",
  },
  "AJUSTA ESTRATEGIA": {
    color: "var(--franco-warning, #FBBF24)",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.25)",
    icon: AlertTriangle,
    label: "AJUSTA ESTRATEGIA",
  },
  "NO RECOMENDADO": {
    color: "#C8323C",
    bg: "rgba(200,50,60,0.10)",
    border: "rgba(200,50,60,0.20)",
    icon: XCircle,
    label: "NO RECOMENDADO",
  },
} as const;

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
        {locked ? (
          <Lock className="h-4 w-4 text-[var(--franco-text-secondary)] shrink-0" />
        ) : guestLocked ? (
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
    <div className="mb-6 flex items-center justify-between border border-[var(--franco-border)] bg-[var(--franco-card)] rounded-2xl px-4 py-3">
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

// ─── ViewLevel toggle ───────────────────────────────
function ViewLevelToggle({ level, onChange }: { level: ViewLevel; onChange: (l: ViewLevel) => void }) {
  const options: { value: ViewLevel; label: string }[] = [
    { value: "simple", label: "En Simple" },
    { value: "importante", label: "Lo Importante" },
    { value: "sinfiltro", label: "Sin Filtro" },
  ];
  return (
    <div className="sticky top-[60px] z-40 bg-[var(--franco-bg)] border-b border-[var(--franco-border)] py-2 mb-6 -mx-4 px-4">
      <div className="flex gap-1 bg-[var(--franco-elevated,var(--franco-card))] rounded-xl p-1 max-w-md mx-auto">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 text-center py-2 px-3 rounded-lg font-body text-xs font-medium transition-colors ${
              level === o.value
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type ViewLevel = "simple" | "importante" | "sinfiltro";

// ─── Metric Card ────────────────────────────────────
function MetricCard({ label, value, subtext, color, tooltip, icon: Icon }: {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
  tooltip?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-[var(--franco-text-secondary)]" />}
        <span className="font-body text-xs text-[var(--franco-text-secondary)]">
          {label}
        </span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <p className={`font-mono text-lg font-semibold ${color || "text-[var(--franco-text)]"}`}>
        {value}
      </p>
      {subtext && (
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-0.5">{subtext}</p>
      )}
    </div>
  );
}

// ─── Escenario verdict for individual scenarios ─────
function escenarioVerdict(esc: EscenarioSTR): ShortTermResult["veredicto"] {
  if (esc.capRate >= 0.06 && esc.cashOnCash >= 0.08) return "VIABLE";
  if (esc.capRate >= 0.04 && esc.cashOnCash >= 0.04) return "AJUSTA ESTRATEGIA";
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
}

export function STRResultsClient({
  analysisId, results, inputData, accessLevel, ufValue,
  nombre, comuna, ciudad, superficie, createdAt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId, isSharedView, userCredits,
}: STRResultsProps) {
  // Update module-level UF
  if (ufValue) UF_CLP = ufValue;

  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("importante");
  const toggleCurrency = useCallback(() => setCurrency(c => c === "CLP" ? "UF" : "CLP"), []);

  const isGuest = accessLevel === "guest";
  const isFree = accessLevel === "free";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isPremium = accessLevel === "premium" || accessLevel === "subscriber";
  const showSection = (levels: ViewLevel[]) => levels.includes(viewLevel);

  // Shorthand access
  const r = results;
  const base = r.escenarios.base;
  const comp = r.comparativa;
  const inp = inputData as Record<string, unknown> | null;

  const precioCompra = (inp?.precioCompra as number) ?? 0;
  const dormitorios = (inp?.dormitorios as number) ?? 0;
  const banos = (inp?.banos as number) ?? 0;
  const modoGestion = (inp?.modoGestion as string) ?? "auto";
  const direccion = (inp?.direccion as string) ?? "";
  const costoAmoblamiento = (inp?.costoAmoblamiento as number) ?? 0;

  const verdictCfg = VERDICT_CONFIG[r.veredicto];
  const VerdictIcon = verdictCfg.icon;

  // Format date
  const fechaAnalisis = createdAt ? new Date(createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";

  // ─── Comparativa table data ───────────────────────
  const comparativaRows = useMemo(() => {
    const ltr = comp.ltr;
    const str = modoGestion === "administrador" ? comp.str_admin : comp.str_auto;
    const rows = [
      { label: "Ingreso bruto", ltr: ltr.ingresoBruto, str: str.ingresoBrutoMensual, tooltip: "Ingreso mensual antes de cualquier descuento." },
      { label: "(-) Comisión", ltr: -Math.round(ltr.ingresoBruto * 0.05), str: -str.comisionMensual, tooltip: "Comisión de corredor (LTR 5%) o plataforma/administrador (STR)." },
      { label: "(-) Costos operativos", ltr: 0, str: -str.costosOperativos, tooltip: "Electricidad, agua, WiFi, insumos, mantención. En LTR los paga el arrendatario." },
      { label: "(-) Gastos comunes", ltr: -((inp?.gastosComunes as number) ?? 0), str: -((inp?.gastosComunes as number) ?? 0), tooltip: "Gastos comunes del edificio. Iguales en ambos modelos." },
      { label: "= NOI", ltr: ltr.noiMensual, str: str.noiMensual, isTotal: true, tooltip: "Net Operating Income: lo que queda después de todos los costos operativos, antes del dividendo." },
      { label: "(-) Dividendo", ltr: -r.dividendoMensual, str: -r.dividendoMensual, tooltip: "Cuota mensual del crédito hipotecario." },
      { label: "= Flujo de caja", ltr: ltr.flujoCaja, str: str.flujoCajaMensual, isResult: true, tooltip: "Lo que entra (o sale) de tu bolsillo cada mes." },
    ];
    return rows;
  }, [comp, r.dividendoMensual, modoGestion, inp]);

  // ─── Estacionalidad chart data ────────────────────
  const seasonalData = useMemo(() => {
    return r.flujoEstacional.map((m: FlujoEstacionalMes) => ({
      mes: m.mes.substring(0, 3),
      ingresoBruto: m.ingresoBruto,
      ingresoNeto: m.ingresoNeto,
      flujo: m.flujo,
      factor: m.factor,
    }));
  }, [r.flujoEstacional]);

  // ─── Sensibilidad data ────────────────────────────
  const sensData = r.sensibilidad;

  // ─── Break-even as percent of market ──────────────
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
              <a href={isSharedView ? "/analisis/nuevo" : "/dashboard"}>
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
        {/* BLOQUE 1: RESUMEN EJECUTIVO                */}
        {/* ═══════════════════════════════════════════ */}

        {/* Verdict banner */}
        <div
          className="rounded-2xl border-2 p-6 mb-6"
          style={{ borderColor: verdictCfg.border, backgroundColor: verdictCfg.bg }}
        >
          <div className="flex items-center gap-3 mb-3">
            <VerdictIcon className="h-7 w-7" style={{ color: verdictCfg.color }} />
            <span
              className="font-mono text-2xl font-bold tracking-wide"
              style={{ color: verdictCfg.color }}
            >
              {verdictCfg.label}
            </span>
          </div>
          <p className="font-body text-sm text-[var(--franco-text-secondary)] leading-relaxed">
            {r.veredicto === "VIABLE" && (
              <>La renta corta genera <span className="font-mono font-medium text-[var(--franco-text)]">{fmtPct(comp.sobreRentaPct)}</span> más que el arriendo tradicional en NOI mensual.</>
            )}
            {r.veredicto === "AJUSTA ESTRATEGIA" && (
              <>La renta corta puede funcionar con ajustes. El break-even está en el <span className="font-mono font-medium text-[var(--franco-text)]">{fmtPctRaw(breakEvenPct * 100, 0)}</span> del mercado (P50).</>
            )}
            {r.veredicto === "NO RECOMENDADO" && (
              <>Para esta propiedad, el arriendo tradicional es más rentable. La renta corta no cubre los costos operativos adicionales.</>
            )}
          </p>
        </div>

        {/* Property info card */}
        <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] p-5 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-xl font-bold text-[var(--franco-text)] mb-1">{nombre}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-[var(--franco-text-secondary)]">
                {direccion && <span>{direccion}</span>}
                <span>{comuna}, {ciudad}</span>
                <span>{superficie} m² · {dormitorios}D/{banos}B</span>
                <span>{modoGestion === "administrador" ? "Con administrador" : "Gestión propia"}</span>
              </div>
              {fechaAnalisis && <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1.5">Analizado el {fechaAnalisis}</p>}
            </div>
            <div className="font-mono text-right">
              <p className="text-[11px] text-[var(--franco-text-secondary)]">Precio</p>
              <p className="text-lg font-bold text-[var(--franco-text)]">{fmtMoney(precioCompra, currency)}</p>
            </div>
          </div>
        </div>

        {/* Currency toggle */}
        <CurrencyToggle currency={currency} onToggle={toggleCurrency} />

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="NOI mensual"
            value={fmtMoney(base.noiMensual, currency)}
            color={base.noiMensual >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]"}
            tooltip="Net Operating Income mensual del escenario base (P50). Ingresos menos todos los costos operativos, antes del dividendo."
            icon={DollarSign}
          />
          <MetricCard
            label="CAP Rate"
            value={fmtPct(base.capRate)}
            color={base.capRate >= 0.06 ? "text-[var(--franco-text)]" : base.capRate >= 0.04 ? "text-[var(--franco-warning,#FBBF24)]" : "text-[#C8323C]"}
            tooltip="Retorno neto operativo anual sobre el precio de compra. Estándar internacional de rentabilidad inmobiliaria."
            icon={TrendingUp}
          />
          <MetricCard
            label="Cash-on-Cash"
            value={fmtPct(base.cashOnCash)}
            color={base.cashOnCash >= 0.08 ? "text-[var(--franco-text)]" : base.cashOnCash >= 0.04 ? "text-[var(--franco-warning,#FBBF24)]" : "text-[#C8323C]"}
            tooltip="Retorno anual sobre tu capital invertido (pie + amoblamiento + gastos de cierre)."
            icon={ArrowUpDown}
          />
          <MetricCard
            label="Sobre-renta vs LTR"
            value={fmtMoney(comp.sobreRenta, currency)}
            subtext={comp.sobreRenta >= 0 ? `+${fmtPct(comp.sobreRentaPct)} vs arriendo largo` : `${fmtPct(comp.sobreRentaPct)} vs arriendo largo`}
            color={comp.sobreRenta >= 0 ? "text-[var(--franco-text)]" : "text-[#C8323C]"}
            tooltip="Diferencia mensual en NOI entre renta corta y arriendo tradicional. Es lo que ganas (o pierdes) extra por operar en Airbnb."
            icon={Home}
          />
        </div>

        {/* Siendo franco box */}
        <div
          className="rounded-xl border p-4 mb-6"
          style={{ borderColor: verdictCfg.border, backgroundColor: verdictCfg.bg }}
        >
          <p className="font-body text-xs font-semibold text-[var(--franco-text)] mb-1">Siendo franco:</p>
          <p className="font-body text-sm text-[var(--franco-text-secondary)] leading-relaxed">
            {r.veredicto === "VIABLE" && (
              <>
                En Airbnb este depto genera <span className="font-mono">{fmtMoney(comp.sobreRenta, currency)}</span>/mes más que en arriendo tradicional.
                {costoAmoblamiento > 0 && comp.paybackMeses > 0 && (
                  <> Recuperas el amoblamiento en <span className="font-mono">{comp.paybackMeses} meses</span>.</>
                )}
              </>
            )}
            {r.veredicto === "AJUSTA ESTRATEGIA" && (
              <>
                La renta corta puede funcionar, pero necesitas alcanzar al menos el <span className="font-mono">{fmtPctRaw(breakEvenPct * 100, 0)}</span> del revenue promedio del mercado para no perder plata.
                {costoAmoblamiento > 0 && comp.paybackMeses > 0 && (
                  <> El amoblamiento se paga en <span className="font-mono">{comp.paybackMeses} meses</span>.</>
                )}
                {comp.paybackMeses < 0 && <> Con estos números, la inversión en amoblamiento no se recupera.</>}
              </>
            )}
            {r.veredicto === "NO RECOMENDADO" && (
              <>
                Los costos operativos de la renta corta (electricidad, insumos, limpieza) hacen que el arriendo tradicional sea más rentable para esta propiedad. El flujo de caja con Airbnb es <span className="font-mono">{fmtMoney(base.flujoCajaMensual, currency)}</span>/mes vs <span className="font-mono">{fmtMoney(comp.ltr.flujoCaja, currency)}</span>/mes con arriendo largo.
              </>
            )}
          </p>
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
        {/* VIEW LEVEL TOGGLE                          */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && (
          <ViewLevelToggle level={viewLevel} onChange={setViewLevel} />
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 2: COMPARATIVA STR vs LTR           */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && (
          <CollapsibleSection
            title="STR vs Arriendo Largo"
            subtitle="Comparativa mensual lado a lado"
            helpText="Compara los ingresos y costos de operar en Airbnb versus arrendar a largo plazo. Todos los valores son mensuales."
            defaultOpen
            locked={false}
            guestLocked={false}
            analysisId={analysisId}
          >
            {/* Table */}
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

            {/* Payback amoblamiento */}
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
        {/* BLOQUE 3: ESCENARIOS (premium)             */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["importante", "sinfiltro"]) && (
          <CollapsibleSection
            title="Escenarios por percentil"
            subtitle="Conservador (P25), Base (P50), Agresivo (P75)"
            helpText="Cada escenario usa datos reales de propiedades comparables en tu zona. P25 = solo superas al 25% del mercado, P50 = rendimiento típico, P75 = estás entre los mejores."
            defaultOpen
            locked={isFree}
            analysisId={analysisId}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["conservador", "base", "agresivo"] as const).map(key => {
                const esc = r.escenarios[key];
                const v = escenarioVerdict(esc);
                const vCfg = VERDICT_CONFIG[v];
                const isBase = key === "base";

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 ${isBase ? "border-2" : ""}`}
                    style={{ borderColor: isBase ? verdictCfg.border : "var(--franco-border)", backgroundColor: isBase ? verdictCfg.bg : "var(--franco-card)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-body text-xs font-semibold text-[var(--franco-text)] uppercase tracking-wider">
                        {esc.label}
                      </span>
                      <span
                        className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: vCfg.color, backgroundColor: vCfg.bg, border: `1px solid ${vCfg.border}` }}
                      >
                        {v}
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

        {/* ─── Sensibilidad ──────────────────────── */}
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
                      <tr
                        key={i}
                        className={`border-b border-[var(--franco-border)] ${isBase ? "bg-[var(--franco-elevated,var(--franco-card))]" : ""}`}
                      >
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
            {/* Break-even crossover indicator */}
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
        {/* BLOQUE 4: ESTACIONALIDAD (premium)         */}
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
            {/* Chart */}
            <div className="h-[280px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
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
                    formatter={(value: any, name: any) => [
                      fmtMoney(Number(value), currency),
                      name === "flujo" ? "Flujo de caja" : name === "ingresoNeto" ? "Ingreso neto" : "Ingreso bruto",
                    ]}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="var(--franco-text-secondary)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={-r.dividendoMensual}
                    stroke="#C8323C"
                    strokeDasharray="6 3"
                    strokeOpacity={0.4}
                    label={{ value: "Dividendo", position: "left", fontSize: 10, fill: "#C8323C" }}
                  />
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

            {/* Ramp-up info */}
            {r.perdidaRampUp > 0 && (
              <div className="bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
                <p className="font-body text-xs font-medium text-[var(--franco-text)] mb-1">Período de ramp-up</p>
                <p className="font-body text-[11px] text-[var(--franco-text-secondary)] leading-relaxed">
                  Los primeros 3 meses el ingreso es menor mientras la propiedad gana tracción (70% → 80% → 90% del revenue esperado).
                  Pérdida estimada por ramp-up: <span className="font-mono font-medium text-[var(--franco-text)]">{fmtMoney(r.perdidaRampUp, currency)}</span>
                </p>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* BLOQUE 5: P&L DETALLADO (sin filtro only)  */}
        {/* ═══════════════════════════════════════════ */}
        {!isGuest && showSection(["sinfiltro"]) && (
          <CollapsibleSection
            title="P&L detallado"
            subtitle="Desglose de costos operativos mensuales"
            helpText="Todos los costos mensuales que implica operar en renta corta. En arriendo largo, la mayoría de estos los paga el arrendatario."
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
              {/* Total */}
              <div className="flex items-center justify-between py-3">
                <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Total costos operativos</span>
                <span className="font-mono text-sm font-semibold text-[var(--franco-text)]">
                  {fmtMoney(base.comisionMensual + base.costosOperativos, currency)}
                </span>
              </div>
            </div>

            {/* Break-even */}
            <div className="mt-4 bg-[var(--franco-elevated,var(--franco-card))] rounded-lg border border-[var(--franco-border)] p-4">
              <p className="font-body text-xs font-medium text-[var(--franco-text)] mb-2">Break-even</p>
              <p className="font-body text-[12px] text-[var(--franco-text-secondary)] leading-relaxed">
                Necesitas generar <span className="font-mono font-medium text-[var(--franco-text)]">{fmtMoney(r.breakEvenRevenueAnual / 12, currency)}/mes</span> (<span className="font-mono">{fmtMoney(r.breakEvenRevenueAnual, currency)}/año</span>) para cubrir todos los costos.
                Eso es el <span className="font-mono font-medium text-[var(--franco-text)]">{fmtPctRaw(breakEvenPct * 100, 0)}</span> del revenue promedio del mercado (P50).
              </p>
              {/* Visual gauge */}
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
        {/* BLOQUE 6: DATOS DE MERCADO (sin filtro)    */}
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
                  {(["p25", "p50", "p75"] as const).map(p => {
                    const pKey = p as "p25" | "p50" | "p75";
                    const val = r.escenarios[pKey === "p25" ? "conservador" : pKey === "p50" ? "base" : "agresivo"].adrReferencia;
                    const isBase = pKey === "p50";
                    return (
                      <div key={p} className={`flex justify-between items-center ${isBase ? "font-semibold" : ""}`}>
                        <span className="font-body text-xs text-[var(--franco-text-secondary)] uppercase">{p.toUpperCase()}</span>
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
                  {(["p25", "p50", "p75"] as const).map(p => {
                    const pKey = p as "p25" | "p50" | "p75";
                    const val = r.escenarios[pKey === "p25" ? "conservador" : pKey === "p50" ? "base" : "agresivo"].ocupacionReferencia;
                    const isBase = pKey === "p50";
                    return (
                      <div key={p} className={`flex justify-between items-center ${isBase ? "font-semibold" : ""}`}>
                        <span className="font-body text-xs text-[var(--franco-text-secondary)] uppercase">{p.toUpperCase()}</span>
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

        {/* ─── Financiamiento summary (Sin Filtro) ── */}
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

        {/* ─── Bottom CTA ──────────────────────────── */}
        <div className="mt-8 text-center pb-12">
          <a href="/analisis/nuevo">
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
