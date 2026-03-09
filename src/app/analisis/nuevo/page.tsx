"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Building2, ArrowLeft, Loader2, ChevronDown, ChevronUp, Sparkles, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { COMUNAS } from "@/lib/comunas";

const UF_CLP_FALLBACK = 38800;

// ─── Formatting helpers ──────────────────────────────
function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

/** Parse a Chilean-formatted number string: strip dots (thousands sep), replace comma with dot */
function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/** Format a number for display in an input (Chilean thousands separator) */
function fmtInput(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("es-CL");
}

function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

// ─── Field tooltips ──────────────────────────────────
const TIPS: Record<string, string> = {
  precio: "Precio de venta de la propiedad. Lo encuentras en la publicación o cotización.",
  piePct: "Porcentaje que pagas de tu bolsillo. Bancos financian hasta 80%, pie mínimo 20%.",
  gastos: "Gastos comunes del edificio. En renta larga lo paga el arrendatario; tú solo durante vacancia.",
  contribuciones: "Impuesto territorial trimestral. Consúltalo en sii.cl con el rol de la propiedad.",
  arriendo: "Cuánto esperas cobrar de arriendo mensual. Revisa arriendos similares en la zona.",
  tasaInteres: "Tasa real anual del crédito hipotecario. Simúlala en el sitio de tu banco.",
  provisionMantencion: "Reserva mensual para reparaciones. Regla general: 1% del valor al año ÷ 12.",
  vacanciaMeses: "Meses al año sin arrendatario. 1 mes/año es el estándar.",
  antiguedad: "Años del inmueble. Más antiguo = más mantención, menos plusvalía.",
  estacionamiento: "Suma valor al arriendo (~$30.000-$50.000/mes extra) y a la plusvalía.",
  bodega: "Suma un pequeño valor al arriendo (~$10.000-$20.000/mes extra).",
  piso: "Pisos altos se arriendan más fácil y caro, y tienen mejor plusvalía.",
};

// ─── Reusable components ─────────────────────────────

function SectionCard({
  title, defaultOpen = true, summary, children,
}: {
  title: string; defaultOpen?: boolean; summary?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {!open && summary && <span className="text-xs text-muted-foreground">{summary}</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="space-y-4 border-t border-border/50 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function FieldLabel({ htmlFor, children, tip }: { htmlFor?: string; children: React.ReactNode; tip?: string }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">{children}</label>
      {tip && <InfoTooltip content={tip} />}
    </div>
  );
}

function ButtonGroup({
  options, value, onChange,
}: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value} type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            value === o.value
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <div className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm">{label}</span>
    </button>
  );
}

/** Formatted numeric input — shows thousands separator, stores raw number */
function MoneyInput({
  id, value, onChange, placeholder, currency, onCurrencyToggle, required, min,
}: {
  id: string; value: string; onChange: (raw: string) => void; placeholder?: string;
  currency?: "CLP" | "UF"; onCurrencyToggle?: () => void; required?: boolean; min?: number;
}) {
  const [display, setDisplay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isUF = currency === "UF";

  // Sync display when value changes externally
  useEffect(() => {
    if (!value) { setDisplay(""); return; }
    const num = parseNum(value);
    if (num === 0) { setDisplay(""); return; }
    if (isUF) {
      setDisplay((Math.round(num * 10) / 10).toLocaleString("es-CL"));
    } else {
      setDisplay(Math.round(num).toLocaleString("es-CL"));
    }
  }, [value, isUF]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow typing freely — only digits, dots, commas
    setDisplay(raw);
    const num = parseNum(raw);
    onChange(num > 0 ? String(num) : "");
  };

  const handleBlur = () => {
    const num = parseNum(display);
    if (num > 0) {
      if (isUF) {
        setDisplay((Math.round(num * 10) / 10).toLocaleString("es-CL"));
      } else {
        setDisplay(Math.round(num).toLocaleString("es-CL"));
      }
      onChange(String(num));
    } else {
      setDisplay("");
      onChange("");
    }
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {isUF ? "UF" : "$"}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        min={min}
        className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-10 pr-14 text-[16px] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ fontSize: "16px" }}
      />
      {onCurrencyToggle && (
        <button
          type="button"
          onClick={onCurrencyToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
          title={`Cambiar a ${isUF ? "CLP" : "UF"}`}
        >
          {isUF ? "→CLP" : "→UF"}
        </button>
      )}
    </div>
  );
}

function AISuggestion({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-1.5 flex w-full items-start gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-left transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
      >
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
        <span className="text-xs text-emerald-700 dark:text-emerald-400">{children} <span className="font-medium underline">Usar</span></span>
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/40">
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
      <span className="text-xs text-emerald-700 dark:text-emerald-400">{children}</span>
    </div>
  );
}

const LS_KEY = "invertiscore_form_draft";

// ─── Main Form ───────────────────────────────────────

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);
  const [linkUrl, setLinkUrl] = useState("");
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const formInitialized = useRef(false);

  // Fetch real UF value + tasa hipotecaria on mount
  const [tasaRef, setTasaRef] = useState<{ value: string; updated_at: string | null }>({ value: "4.72", updated_at: null });
  useEffect(() => {
    fetch("/api/uf")
      .then((r) => r.json())
      .then((d) => { if (d.uf) setUfValue(d.uf); })
      .catch(() => {});
    fetch("/api/config?key=tasa_hipotecaria")
      .then((r) => r.json())
      .then((d) => {
        if (d.value) {
          setTasaRef({ value: d.value, updated_at: d.updated_at });
          setForm((prev) => ({ ...prev, tasaInteres: d.value }));
        }
      })
      .catch(() => {});
  }, []);

  const UF_CLP = ufValue;

  // Market data from API
  const [marketData, setMarketData] = useState<{
    arriendo_promedio: number; precio_m2_promedio: number;
    precio_m2_venta_promedio: number; gastos_comunes_m2: number;
    numero_publicaciones: number; source: string;
  } | null>(null);

  // Per-field currency toggles
  const [fieldCurrency, setFieldCurrency] = useState<Record<string, "CLP" | "UF">>({
    precio: "UF", arriendo: "CLP", gastos: "CLP", contribuciones: "CLP",
  });
  const toggleFieldCurrency = (field: string) => {
    setFieldCurrency((prev) => ({ ...prev, [field]: prev[field] === "CLP" ? "UF" : "CLP" }));
  };

  // ─── Form state ────────────────────────────────────
  const [form, setForm] = useState({
    nombreAnalisis: "",
    comuna: "",
    direccion: "",
    dormitorios: "2",
    banos: "1",
    superficieUtil: "",
    antiguedad: "3-5",
    piso: "4-8",
    estacionamiento: true,
    bodega: false,
    estadoVenta: "inmediata",
    fechaEntregaMes: "",
    fechaEntregaAnio: "",
    cuotasPie: "",
    montoCuota: "",
    precio: "",
    piePct: "20",
    plazoCredito: "25",
    tasaInteres: "4.72",
    arriendo: "",
    gastos: "",
    contribuciones: "",
    vacanciaMeses: "1",
  });

  const setField = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ─── localStorage persistence ──────────────────────
  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && typeof draft === "object" && draft.comuna) {
          setShowDraftBanner(true);
          // Don't auto-restore — wait for user click
        }
      }
    } catch { /* ignore */ }
    formInitialized.current = true;
  }, []);

  // Save draft on every change (debounced)
  useEffect(() => {
    if (!formInitialized.current) return;
    // Only save if there's meaningful data
    if (!form.comuna && !form.precio && !form.arriendo) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(form));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timeout);
  }, [form]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...draft }));
        if (draft.comuna) setComunaSearch("");
      }
    } catch { /* ignore */ }
    setShowDraftBanner(false);
  }, []);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setShowDraftBanner(false);
  }, []);

  // ─── Progress bar ─────────────────────────────────
  const progress = useMemo(() => {
    const checks = [
      { label: "Comuna", done: !!form.comuna },
      { label: "Superficie", done: !!form.superficieUtil && parseNum(form.superficieUtil) > 0 },
      { label: "Precio", done: !!form.precio && parseNum(form.precio) > 0 },
      { label: "Arriendo", done: !!form.arriendo && parseNum(form.arriendo) > 0 },
    ];
    const done = checks.filter((c) => c.done).length;
    const missing = checks.filter((c) => !c.done).map((c) => c.label);
    return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100), missing };
  }, [form.comuna, form.superficieUtil, form.precio, form.arriendo]);

  const canSubmit = progress.done === progress.total;

  // ─── Comuna search ─────────────────────────────────
  const [comunaSearch, setComunaSearch] = useState("");
  const [comunaOpen, setComunaOpen] = useState(false);
  const comunaRef = useRef<HTMLDivElement>(null);

  const filteredComunas = useMemo(() => {
    if (!comunaSearch) return COMUNAS.slice(0, 20);
    const q = comunaSearch.toLowerCase();
    return COMUNAS.filter((c) => c.comuna.toLowerCase().includes(q)).slice(0, 15);
  }, [comunaSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comunaRef.current && !comunaRef.current.contains(e.target as Node)) setComunaOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedComuna = useMemo(() => COMUNAS.find((c) => c.comuna === form.comuna), [form.comuna]);

  // ─── Market data fetch ─────────────────────────────
  useEffect(() => {
    if (!form.comuna) { setMarketData(null); return; }
    fetch(`/api/market-data?comuna=${encodeURIComponent(form.comuna)}&dormitorios=${form.dormitorios}`)
      .then((r) => r.json())
      .then((d) => setMarketData(d.data))
      .catch(() => setMarketData(null));
  }, [form.comuna, form.dormitorios]);

  // ─── Computed suggestions ──────────────────────────
  const suggestions = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna) return null;

    const precioM2Venta = marketData?.precio_m2_venta_promedio ?? 0;
    const precioSugeridoUF = supUtil > 0 && precioM2Venta > 0 ? Math.round(precioM2Venta * supUtil) : 0;

    const precioUFForCalc = (fieldCurrency.precio === "UF"
      ? parseNum(form.precio)
      : parseNum(form.precio) / UF_CLP) || precioSugeridoUF;

    const avaluoFiscal = precioUFForCalc * UF_CLP * 0.65;
    const contribAnual = Math.round(avaluoFiscal * 0.011);
    const contribuciones = Math.round(contribAnual / 4);

    if (marketData && supUtil > 0) {
      return {
        arriendo: marketData.arriendo_promedio,
        gastos: Math.round(marketData.gastos_comunes_m2 * supUtil),
        contribuciones, precioSugeridoUF, precioM2Venta,
        source: marketData.source, publicaciones: marketData.numero_publicaciones,
      };
    }
    if (supUtil <= 0) return null;
    return {
      arriendo: Math.round(6000 * supUtil), gastos: Math.round(1100 * supUtil),
      contribuciones, precioSugeridoUF: 0, precioM2Venta: 0,
      source: "estimate" as const, publicaciones: 0,
    };
  }, [form.comuna, form.superficieUtil, form.precio, marketData, UF_CLP, fieldCurrency.precio]);

  // ─── Auto-fill all from suggestions ────────────────
  const autoFillAll = useCallback(() => {
    if (!suggestions) return;
    setForm((prev) => {
      const updates: Record<string, string | boolean> = {};
      if (!prev.arriendo && suggestions.arriendo) updates.arriendo = String(suggestions.arriendo);
      if (!prev.gastos && suggestions.gastos) updates.gastos = String(suggestions.gastos);
      if (!prev.contribuciones && suggestions.contribuciones) updates.contribuciones = String(suggestions.contribuciones);
      if (!prev.precio && suggestions.precioSugeridoUF > 0) updates.precio = String(suggestions.precioSugeridoUF);
      return { ...prev, ...updates };
    });
  }, [suggestions]);

  // ─── Real-time calculations ────────────────────────
  const toCLP = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value * UF_CLP : value;
  }, [fieldCurrency, UF_CLP]);

  const toUF = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value : value / UF_CLP;
  }, [fieldCurrency, UF_CLP]);

  const calc = useMemo(() => {
    const precioUF = fieldCurrency.precio === "UF"
      ? parseNum(form.precio)
      : parseNum(form.precio) / UF_CLP;

    const supUtil = parseNum(form.superficieUtil) || 0;
    const piePct = parseFloat(form.piePct) || 20;
    const plazo = parseFloat(form.plazoCredito) || 25;
    const tasa = parseFloat(form.tasaInteres) || 4.72;

    const precioCLP = precioUF * UF_CLP;
    const precioM2 = supUtil > 0 ? precioUF / supUtil : 0;
    const pieUF = precioUF * (piePct / 100);
    const pieCLP = pieUF * UF_CLP;
    const financiamientoPct = 100 - piePct;
    const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, UF_CLP);
    const provisionAuto = Math.round((precioCLP * 0.01) / 12);
    const contribucionesAuto = Math.round(precioCLP * 0.65 * 0.011 / 4);
    const gastosAuto = Math.round(supUtil * 1200);

    return { precioUF, precioCLP, precioM2, pieUF, pieCLP, financiamientoPct, dividendo, provisionAuto, contribucionesAuto, gastosAuto };
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres, fieldCurrency.precio, UF_CLP]);

  // ─── Collapsible section summaries ─────────────────
  const seccion2Summary = form.superficieUtil
    ? `${form.superficieUtil} m², ${form.dormitorios}D${form.banos}B, ${form.estacionamiento ? "con" : "sin"} estac.`
    : "Sin completar";
  const seccion4Summary = `${form.plazoCredito} años, tasa ${form.tasaInteres}%`;

  // ─── Antigüedad mapping ────────────────────────────
  function antiguedadToNumber(val: string): number {
    switch (val) {
      case "0-2": return 1;
      case "3-5": return 4;
      case "6-10": return 8;
      case "11-20": return 15;
      case "20+": return 25;
      default: return 5;
    }
  }

  function pisoToNumber(val: string): number {
    switch (val) {
      case "1-3": return 2;
      case "4-8": return 6;
      case "9-15": return 12;
      case "16+": return 20;
      default: return 6;
    }
  }

  // ─── Submit ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supUtil = parseNum(form.superficieUtil) || 0;
    const precioUF = toUF("precio", parseNum(form.precio));
    const arriendo = Math.round(toCLP("arriendo", parseNum(form.arriendo)));
    const gastos = Math.round(toCLP("gastos", parseNum(form.gastos)));
    const contribuciones = Math.round(toCLP("contribuciones", parseNum(form.contribuciones)));
    const antiguedad = form.estadoVenta !== "inmediata" ? 0 : antiguedadToNumber(form.antiguedad);
    const provisionMantencion = calc.provisionAuto;
    const ciudad = selectedComuna?.ciudad || "Santiago";
    const nombre = form.nombreAnalisis.trim() || `Depto ${form.dormitorios}D${form.banos}B ${form.comuna}`;

    try {
      const res = await fetch("/api/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          comuna: form.comuna,
          ciudad,
          direccion: form.direccion || undefined,
          tipo: "Departamento",
          dormitorios: Number(form.dormitorios),
          banos: Number(form.banos),
          superficie: supUtil,
          superficieTotal: supUtil,
          antiguedad,
          enConstruccion: form.estadoVenta !== "inmediata",
          piso: pisoToNumber(form.piso),
          estacionamiento: form.estacionamiento ? "si" : "no",
          precioEstacionamiento: 0,
          bodega: form.bodega,
          estadoVenta: form.estadoVenta,
          fechaEntrega: form.estadoVenta !== "inmediata"
            ? `${form.fechaEntregaAnio}-${form.fechaEntregaMes}`
            : undefined,
          cuotasPie: Number(form.cuotasPie) || 0,
          montoCuota: Math.round(toCLP("gastos", parseNum(form.montoCuota) || 0)),
          precio: precioUF,
          piePct: parseFloat(form.piePct),
          plazoCredito: parseFloat(form.plazoCredito),
          tasaInteres: parseFloat(form.tasaInteres),
          gastos: gastos || calc.gastosAuto,
          contribuciones: contribuciones || calc.contribucionesAuto,
          provisionMantencion,
          tipoRenta: "larga",
          arriendo,
          vacanciaMeses: parseFloat(form.vacanciaMeses),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el análisis");
      }

      const data = await res.json();
      localStorage.removeItem(LS_KEY);
      router.push(`/analisis/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">InvertiScore</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto max-w-2xl px-4 pb-28 pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Nuevo Análisis</h1>
          <p className="text-sm text-muted-foreground">
            Ingresa los datos de la propiedad · UF hoy: {fmtCLP(UF_CLP)}
          </p>
        </div>

        {/* Draft banner */}
        {showDraftBanner && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">Tienes un análisis sin terminar</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={restoreDraft} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
                Recuperar
              </button>
              <button type="button" onClick={discardDraft} className="rounded-md border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100">
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Progress bar — sticky */}
        <div className="sticky top-0 z-50 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between">
            {progress.pct === 100 ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Todo listo para analizar
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Faltan: {progress.missing.join(", ")}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progress.pct === 100 ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>

        {/* Link paste / file upload section */}
        <div className="mb-4 rounded-xl border border-emerald-200 bg-[#f0fdf4] p-5 space-y-4">
          <div className="text-center">
            <p className="text-base font-semibold">¿Tienes el link de la publicación? 🔗</p>
            <p className="mt-1 text-sm text-muted-foreground">Pégalo y nosotros extraemos los datos automáticamente. Sin escribir nada.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Pega aquí el link de Portal Inmobiliario, TocToc o Yapo"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex h-10 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
            />
            <Button
              type="button"
              disabled
              className="shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Extraer datos <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-emerald-200" />
            <span>o sube una cotización</span>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => alert("Próximamente: sube una cotización en PDF y la extraemos automáticamente.")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              <Upload className="h-4 w-4" /> Subir cotización (PDF o imagen)
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">¿Prefieres hacerlo manual? Completa el formulario abajo ↓</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* Nombre del análisis — siempre visible */}
          <div>
            <FieldLabel htmlFor="nombreAnalisis">Nombre del análisis (opcional)</FieldLabel>
            <input
              id="nombreAnalisis"
              type="text"
              placeholder="Se generará automáticamente si lo dejas vacío"
              value={form.nombreAnalisis}
              onChange={(e) => setField("nombreAnalisis", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">Ej: Depto Providencia 2D1B, Inversión Ñuñoa</p>
          </div>

          {/* ══════ SECCIÓN 1: ¿Dónde está? ══════ */}
          <SectionCard title="¿Dónde está?" defaultOpen={false} summary={form.comuna ? `${form.comuna}${form.direccion ? ` · ${form.direccion}` : ""}` : "Sin completar"}>
            <div ref={comunaRef} className="relative">
              <FieldLabel htmlFor="comunaSearch">Comuna</FieldLabel>
              <input
                id="comunaSearch"
                type="text"
                value={form.comuna ? form.comuna : comunaSearch}
                onChange={(e) => {
                  setComunaSearch(e.target.value);
                  setComunaOpen(true);
                  if (form.comuna) setField("comuna", "");
                }}
                onFocus={() => { if (!form.comuna) setComunaOpen(true); }}
                placeholder="Buscar comuna..."
                required
                autoComplete="off"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {form.comuna && (
                <button
                  type="button"
                  onClick={() => { setField("comuna", ""); setComunaSearch(""); setComunaOpen(true); }}
                  className="absolute right-3 top-[38px] text-xs text-muted-foreground hover:text-foreground"
                >✕</button>
              )}
              {comunaOpen && !form.comuna && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                  {filteredComunas.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No encontrada</div>
                  ) : (
                    filteredComunas.map((c) => (
                      <button
                        key={c.comuna} type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                        onClick={() => {
                          setField("comuna", c.comuna);
                          setComunaSearch("");
                          setComunaOpen(false);
                        }}
                      >
                        <span>{c.comuna}</span>
                        <span className="text-xs text-muted-foreground">{c.ciudad}, {c.region}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
              <input
                id="direccion"
                type="text"
                placeholder="Ej: Av Providencia 1234, Providencia"
                value={form.direccion}
                onChange={(e) => setField("direccion", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </SectionCard>

          {/* ══════ SECCIÓN 2: ¿Cómo es? (colapsada) ══════ */}
          <SectionCard title="¿Cómo es?" defaultOpen={false} summary={seccion2Summary}>
            <div>
              <FieldLabel>Superficie total (m²)</FieldLabel>
              <input
                id="superficieUtil"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="55"
                value={form.superficieUtil}
                onChange={(e) => setField("superficieUtil", e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">Superficie total según escritura o ficha. Incluye terrazas y logias si están en la escritura.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Dormitorios</FieldLabel>
                <ButtonGroup
                  options={[
                    { value: "1", label: "1" }, { value: "2", label: "2" },
                    { value: "3", label: "3" }, { value: "4", label: "4+" },
                  ]}
                  value={form.dormitorios}
                  onChange={(v) => setField("dormitorios", v)}
                />
              </div>
              <div>
                <FieldLabel>Baños</FieldLabel>
                <ButtonGroup
                  options={[
                    { value: "1", label: "1" }, { value: "2", label: "2" },
                    { value: "3", label: "3" }, { value: "4", label: "4" },
                  ]}
                  value={form.banos}
                  onChange={(v) => setField("banos", v)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel tip={TIPS.antiguedad}>Antigüedad</FieldLabel>
                <div className="relative">
                  <select
                    value={form.antiguedad}
                    onChange={(e) => setField("antiguedad", e.target.value)}
                    className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="0-2">0-2 años (nuevo)</option>
                    <option value="3-5">3-5 años</option>
                    <option value="6-10">6-10 años</option>
                    <option value="11-20">11-20 años</option>
                    <option value="20+">20+ años</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <FieldLabel tip={TIPS.piso}>Piso</FieldLabel>
                <div className="relative">
                  <select
                    value={form.piso}
                    onChange={(e) => setField("piso", e.target.value)}
                    className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="1-3">1-3 (bajo)</option>
                    <option value="4-8">4-8 (medio)</option>
                    <option value="9-15">9-15 (alto)</option>
                    <option value="16+">16+ (muy alto)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              <ToggleSwitch
                checked={form.estacionamiento}
                onChange={(v) => setField("estacionamiento", v)}
                label="Estacionamiento"
              />
              <ToggleSwitch
                checked={form.bodega}
                onChange={(v) => setField("bodega", v)}
                label="Bodega"
              />
            </div>
          </SectionCard>

          {/* Auto-fill button */}
          {suggestions && form.comuna && form.superficieUtil && (!form.precio || !form.arriendo || !form.gastos || !form.contribuciones) && (
            <button
              type="button"
              onClick={autoFillAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Sparkles className="h-4 w-4" />
              Auto-rellenar con datos de {form.comuna}
            </button>
          )}

          {/* ══════ SECCIÓN 3: ¿Cuánto cuesta? ══════ */}
          <SectionCard title="¿Cuánto cuesta?" defaultOpen={false} summary={form.precio ? `${fieldCurrency.precio === "UF" ? fmtUF(parseNum(form.precio)) : fmtCLP(parseNum(form.precio))}, pie ${form.piePct}%` : "Sin completar"}>
            <div>
              <FieldLabel htmlFor="precio" tip={TIPS.precio}>Precio de venta</FieldLabel>
              <MoneyInput
                id="precio"
                value={form.precio}
                onChange={(v) => setField("precio", v)}
                placeholder={fieldCurrency.precio === "UF" ? "3.200" : "124.160.000"}
                currency={fieldCurrency.precio}
                onCurrencyToggle={() => toggleFieldCurrency("precio")}
                required
              />
              {calc.precioUF > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {fieldCurrency.precio === "UF" ? fmtCLP(calc.precioCLP) : fmtUF(calc.precioUF)}
                  {calc.precioM2 > 0 && <> · {fmtUF(calc.precioM2)}/m²</>}
                </p>
              )}
              {suggestions && suggestions.precioSugeridoUF > 0 && !form.precio && (
                <AISuggestion onClick={() => {
                  setFieldCurrency((prev) => ({ ...prev, precio: "UF" }));
                  setField("precio", String(suggestions.precioSugeridoUF));
                }}>
                  Ref. zona: {fmtUF(suggestions.precioM2Venta)}/m² → {fmtUF(suggestions.precioSugeridoUF)} para {form.superficieUtil} m²
                </AISuggestion>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="piePct" tip={TIPS.piePct}>Pie: {form.piePct}%</FieldLabel>
              <input
                id="piePct" type="range" min="10" max="50" step="5"
                value={form.piePct}
                onChange={(e) => setField("piePct", e.target.value)}
                className="mt-1 w-full accent-primary"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmtUF(calc.pieUF)} ({fmtCLP(calc.pieCLP)})</span>
                <span>Financiamiento: {calc.financiamientoPct}%</span>
              </div>
            </div>

            <div>
              <FieldLabel>Estado de venta</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setField("estadoVenta", "inmediata")}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    form.estadoVenta === "inmediata"
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Entrega inmediata
                </button>
                <button
                  type="button"
                  onClick={() => setField("estadoVenta", "futura")}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    form.estadoVenta !== "inmediata"
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span>Entrega futura</span>
                  <span className="block text-[11px] font-normal opacity-70">Venta en blanco o en verde</span>
                </button>
              </div>
            </div>

            {form.estadoVenta !== "inmediata" && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <FieldLabel>Fecha de entrega estimada</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={form.fechaEntregaMes}
                      onChange={(e) => setField("fechaEntregaMes", e.target.value)}
                      className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Mes...</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                          {new Date(2000, i).toLocaleString("es-CL", { month: "long" })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <div className="relative">
                    <select
                      value={form.fechaEntregaAnio}
                      onChange={(e) => setField("fechaEntregaAnio", e.target.value)}
                      className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Año...</option>
                      {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ══════ SECCIÓN 4: ¿Cómo lo financias? (colapsada) ══════ */}
          <SectionCard title="¿Cómo lo financias?" defaultOpen={false} summary={seccion4Summary}>
            <div>
              <FieldLabel htmlFor="plazoCredito">Plazo crédito: {form.plazoCredito} años</FieldLabel>
              <input
                id="plazoCredito" type="range" min="10" max="30" step="5"
                value={form.plazoCredito}
                onChange={(e) => setField("plazoCredito", e.target.value)}
                className="mt-1 w-full accent-primary"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 años</span><span>30 años</span>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="tasaInteres" tip={TIPS.tasaInteres}>Tasa interés anual (%)</FieldLabel>
              <input
                id="tasaInteres"
                type="number"
                step="0.01"
                min="0"
                placeholder="4.72"
                value={form.tasaInteres}
                onChange={(e) => setField("tasaInteres", e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Mercado actual: ~{tasaRef.value}%
                {tasaRef.updated_at && ` (act. ${new Date(tasaRef.updated_at).toLocaleDateString("es-CL")})`}
              </p>
            </div>

            {calc.dividendo > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dividendo estimado</span>
                  <span className="text-lg font-bold text-primary">{fmtCLP(calc.dividendo)}/mes</span>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ══════ SECCIÓN 5: ¿Cuánto genera? ══════ */}
          <SectionCard title="¿Cuánto genera?" defaultOpen={false} summary={form.arriendo ? `Arriendo ${fieldCurrency.arriendo === "UF" ? fmtUF(parseNum(form.arriendo)) : fmtCLP(parseNum(form.arriendo))}/mes` : "Sin completar"}>
            <div>
              <FieldLabel htmlFor="arriendo" tip={TIPS.arriendo}>Arriendo esperado /mes</FieldLabel>
              <MoneyInput
                id="arriendo"
                value={form.arriendo}
                onChange={(v) => setField("arriendo", v)}
                placeholder={
                  fieldCurrency.arriendo === "UF"
                    ? suggestions?.arriendo ? (suggestions.arriendo / UF_CLP).toFixed(1) : "12"
                    : suggestions?.arriendo ? fmtInput(suggestions.arriendo) : "450.000"
                }
                currency={fieldCurrency.arriendo}
                onCurrencyToggle={() => toggleFieldCurrency("arriendo")}
                required
              />
              {suggestions?.arriendo && !form.arriendo && (
                <AISuggestion onClick={() => {
                  setFieldCurrency((prev) => ({ ...prev, arriendo: "CLP" }));
                  setField("arriendo", String(suggestions.arriendo));
                }}>
                  Ref. zona: {fmtCLP(suggestions.arriendo)}/mes
                  {suggestions.publicaciones > 0 && <> · {suggestions.publicaciones} publicaciones</>}
                </AISuggestion>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="gastos" tip={TIPS.gastos}>Gastos comunes /mes</FieldLabel>
                <MoneyInput
                  id="gastos"
                  value={form.gastos}
                  onChange={(v) => setField("gastos", v)}
                  placeholder={suggestions?.gastos ? fmtInput(suggestions.gastos) : fmtInput(calc.gastosAuto)}
                  currency={fieldCurrency.gastos}
                  onCurrencyToggle={() => toggleFieldCurrency("gastos")}
                />
                {!form.gastos && suggestions?.gastos && (
                  <AISuggestion onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, gastos: "CLP" }));
                    setField("gastos", String(suggestions.gastos));
                  }}>Ref: {fmtCLP(suggestions.gastos)}/mes</AISuggestion>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="contribuciones" tip={TIPS.contribuciones}>Contribuciones /trim</FieldLabel>
                <MoneyInput
                  id="contribuciones"
                  value={form.contribuciones}
                  onChange={(v) => setField("contribuciones", v)}
                  placeholder={suggestions?.contribuciones ? fmtInput(suggestions.contribuciones) : fmtInput(calc.contribucionesAuto)}
                  currency={fieldCurrency.contribuciones}
                  onCurrencyToggle={() => toggleFieldCurrency("contribuciones")}
                />
                {!form.contribuciones && suggestions?.contribuciones && (
                  <AISuggestion onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, contribuciones: "CLP" }));
                    setField("contribuciones", String(suggestions.contribuciones));
                  }}>Est: {fmtCLP(suggestions.contribuciones)}/trim</AISuggestion>
                )}
              </div>
            </div>

            <div>
              <FieldLabel tip={TIPS.vacanciaMeses}>Vacancia (meses/año)</FieldLabel>
              <ButtonGroup
                options={[
                  { value: "0", label: "0" }, { value: "1", label: "1" },
                  { value: "2", label: "2" }, { value: "3", label: "3" },
                ]}
                value={form.vacanciaMeses}
                onChange={(v) => setField("vacanciaMeses", v)}
              />
            </div>
          </SectionCard>

          {/* Dividendo preview (outside cards) */}
          {calc.dividendo > 0 && calc.precioUF > 0 && parseNum(form.arriendo) > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Arriendo</span>
                <span className="font-medium text-emerald-600">+{fmtCLP(toCLP("arriendo", parseNum(form.arriendo)))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span>Dividendo</span>
                <span className="font-medium text-red-500">-{fmtCLP(calc.dividendo)}</span>
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Flujo estimado</span>
                  {(() => {
                    const flujo = toCLP("arriendo", parseNum(form.arriendo)) - calc.dividendo;
                    return (
                      <span className={`text-lg font-bold ${flujo >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {flujo >= 0 ? "+" : ""}{fmtCLP(flujo)}/mes
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Solo arriendo vs dividendo. El score incluye todos los costos.
                </p>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* Sticky submit footer — PC & mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <Button
            className={`w-full gap-2 ${canSubmit && !loading ? "animate-pulse bg-emerald-600 hover:bg-emerald-700" : ""}`}
            size="lg"
            type="submit"
            disabled={loading || !canSubmit}
            onClick={handleSubmit}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generando InvertiScore...</>
            ) : canSubmit ? (
              <><CheckCircle2 className="h-4 w-4" /> Generar InvertiScore</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Generar InvertiScore</>
            )}
          </Button>
          {!canSubmit && !loading && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Falta: {progress.missing.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
