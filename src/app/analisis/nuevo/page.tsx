"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Loader2, ChevronDown, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
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
  provisionMantencion: "Reserva mensual para reparaciones. Varía según antigüedad: 0.3% (nuevo) a 1.5% (20+ años) del valor al año.",
  vacanciaMeses: "Meses al año sin arrendatario. 1 mes/año es el estándar.",
  antiguedad: "Años del inmueble. Más antiguo = más mantención, menos plusvalía.",
  estacionamiento: "Suma valor al arriendo (~$30.000-$50.000/mes extra) y a la plusvalía.",
  bodega: "Suma un pequeño valor al arriendo (~$10.000-$20.000/mes extra).",
  piso: "Pisos altos se arriendan más fácil y caro, y tienen mejor plusvalía.",
};

// ─── Estimaciones por comuna ─────────────────────────
// TODO: Reemplazar por datos reales vía API/scraping
// Estos valores son estimaciones basadas en promedios de mercado Q1 2026
const ESTIMACIONES_POR_COMUNA: Record<string, {
  arriendoM2: number;    // $/m² de arriendo mensual
  ggccM2: number;        // $/m² de gastos comunes
  contribUfM2: number;   // UF/m²/año de contribuciones
}> = {
  "Providencia": { arriendoM2: 7600, ggccM2: 1200, contribUfM2: 0.018 },
  "Las Condes": { arriendoM2: 8200, ggccM2: 1400, contribUfM2: 0.020 },
  "Ñuñoa": { arriendoM2: 7000, ggccM2: 1100, contribUfM2: 0.016 },
  "Santiago Centro": { arriendoM2: 6200, ggccM2: 1000, contribUfM2: 0.014 },
  "La Florida": { arriendoM2: 5800, ggccM2: 900, contribUfM2: 0.013 },
  "Macul": { arriendoM2: 5500, ggccM2: 850, contribUfM2: 0.012 },
  "San Miguel": { arriendoM2: 6000, ggccM2: 950, contribUfM2: 0.013 },
  "Estación Central": { arriendoM2: 5600, ggccM2: 900, contribUfM2: 0.012 },
  "Independencia": { arriendoM2: 5400, ggccM2: 850, contribUfM2: 0.011 },
  "Recoleta": { arriendoM2: 5200, ggccM2: 800, contribUfM2: 0.011 },
  "Vitacura": { arriendoM2: 9500, ggccM2: 1800, contribUfM2: 0.025 },
  "Lo Barnechea": { arriendoM2: 8500, ggccM2: 1600, contribUfM2: 0.022 },
  "Maipú": { arriendoM2: 5000, ggccM2: 750, contribUfM2: 0.010 },
  "Puente Alto": { arriendoM2: 4500, ggccM2: 700, contribUfM2: 0.009 },
  "Peñalolén": { arriendoM2: 5300, ggccM2: 850, contribUfM2: 0.012 },
  "La Reina": { arriendoM2: 7200, ggccM2: 1200, contribUfM2: 0.017 },
  "San Joaquín": { arriendoM2: 5100, ggccM2: 800, contribUfM2: 0.011 },
  "Pedro Aguirre Cerda": { arriendoM2: 4800, ggccM2: 750, contribUfM2: 0.010 },
  "Quinta Normal": { arriendoM2: 5000, ggccM2: 800, contribUfM2: 0.011 },
  "Conchalí": { arriendoM2: 4600, ggccM2: 700, contribUfM2: 0.010 },
};

// ─── Tasa de mantención por antigüedad ──────────────
function getMantencionRate(antiguedad: number): number {
  if (antiguedad <= 2) return 0.003;
  if (antiguedad <= 5) return 0.005;
  if (antiguedad <= 10) return 0.008;
  if (antiguedad <= 15) return 0.01;
  if (antiguedad <= 20) return 0.013;
  return 0.015;
}

// ─── Reusable components ─────────────────────────────

function SectionCard({
  title, subtitle, defaultOpen = true, forceOpen, summary, children,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean; forceOpen?: boolean; summary?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const prevForce = useRef(forceOpen);
  useEffect(() => {
    if (forceOpen && !prevForce.current) setOpen(true);
    prevForce.current = forceOpen;
  }, [forceOpen]);
  return (
    <div className="rounded-xl border border-[#E6E6E2] bg-white mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div>
          <h3 className="font-mono text-[10px] text-[#71717A] uppercase tracking-[0.08em]">{title}</h3>
          {subtitle && <p className="font-body text-[11px] text-[#71717A]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!open && summary && <span className="font-body text-[11px] text-[#71717A]">{summary}</span>}
          <span className={`text-[#71717A] text-sm transition-transform ${open ? "rotate-180" : ""}`}>↓</span>
        </div>
      </button>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  );
}

function FieldLabel({ htmlFor, children, tip }: { htmlFor?: string; children: React.ReactNode; tip?: string }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label htmlFor={htmlFor} className="font-body text-[13px] font-semibold text-[#0F0F0F]">{children}</label>
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
          className={`min-w-[40px] rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
            value === o.value
              ? "bg-[#0F0F0F] text-white font-semibold border-[#0F0F0F]"
              : "bg-white border-[#E6E6E2] text-[#71717A] hover:border-[#0F0F0F]/30"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#71717A]">
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
        className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white py-2 pl-10 pr-14 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 transition-colors focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ fontSize: "13px" }}
      />
      {onCurrencyToggle && (
        <button
          type="button"
          onClick={onCurrencyToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#71717A] cursor-pointer hover:text-[#0F0F0F]"
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
        className="mt-1.5 flex w-full items-start gap-1.5 rounded-md border border-[#E6E6E2] bg-[#FAFAF8] px-2.5 py-1.5 text-left transition-colors hover:bg-[#F0F0EC]"
      >
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#0F0F0F]" />
        <span className="text-xs text-[#0F0F0F]">{children} <span className="font-medium underline">Usar</span></span>
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[#E6E6E2] bg-[#FAFAF8] px-2.5 py-1.5">
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#0F0F0F]" />
      <span className="text-xs text-[#0F0F0F]">{children}</span>
    </div>
  );
}

const LS_KEY = "franco_form_draft";

// ─── Main Form ───────────────────────────────────────

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [mode, setMode] = useState("larga");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [extractMsg, setExtractMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [extractMissing, setExtractMissing] = useState<string[]>([]);
  const [sectionsForceOpen, setSectionsForceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formInitialized = useRef(false);

  // Geocoding state
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radius, setRadius] = useState(800);
  const geocodeTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Sugerencias por radio/comuna
  const [radioSugerencias, setRadioSugerencias] = useState<{
    arriendo: number;
    ggcc: number | null;
    contribTrim: number;
    source: "radio" | "comuna" | "estimacion";
    sampleSize: number;
    radiusMeters?: number;
    precioM2?: number;
  } | null>(null);

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
    estacionamiento: "0",
    bodega: "0",
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
    vacanciaPct: "5",
    adminPct: "7",
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

  // ─── Shared: fill form from extracted data ─────────
  const fillFormFromExtraction = useCallback((d: Record<string, unknown>): string[] => {
    const missing: string[] = [];

    setForm((prev) => {
      const updates: Record<string, string> = {};

      if (d.comuna) {
        const match = COMUNAS.find((c) => c.comuna.toLowerCase() === String(d.comuna).toLowerCase());
        if (match) updates.comuna = match.comuna;
        else missing.push("comuna");
      } else missing.push("comuna");

      if (d.direccion) updates.direccion = String(d.direccion);
      if (d.dormitorios) updates.dormitorios = String(d.dormitorios);
      if (d.banos) updates.banos = String(d.banos);
      if (d.superficie) updates.superficieUtil = String(d.superficie);
      else missing.push("superficie");

      if (d.precio_uf) {
        updates.precio = String(d.precio_uf);
        setFieldCurrency((fc) => ({ ...fc, precio: "UF" }));
      } else if (d.precio_clp) {
        updates.precio = String(d.precio_clp);
        setFieldCurrency((fc) => ({ ...fc, precio: "CLP" }));
      } else missing.push("precio");

      if (d.estacionamientos != null) updates.estacionamiento = String(d.estacionamientos);
      if (d.bodegas != null) updates.bodega = String(d.bodegas);

      if (d.gastos_comunes) {
        updates.gastos = String(d.gastos_comunes);
        setFieldCurrency((fc) => ({ ...fc, gastos: "CLP" }));
      }

      if (d.arriendo_estimado) {
        updates.arriendo = String(d.arriendo_estimado);
        setFieldCurrency((fc) => ({ ...fc, arriendo: "CLP" }));
      }

      if (d.piso != null) {
        const p = Number(d.piso);
        if (p <= 3) updates.piso = "1-3";
        else if (p <= 8) updates.piso = "4-8";
        else if (p <= 15) updates.piso = "9-15";
        else updates.piso = "16+";
      }

      if (d.antiguedad != null) {
        const a = Number(d.antiguedad);
        if (a <= 2) updates.antiguedad = "0-2";
        else if (a <= 5) updates.antiguedad = "3-5";
        else if (a <= 10) updates.antiguedad = "6-10";
        else if (a <= 20) updates.antiguedad = "11-20";
        else updates.antiguedad = "20+";
      }

      if (d.estado_venta === "futura") {
        updates.estadoVenta = "futura";
        if (d.fecha_entrega) {
          const [y, m] = String(d.fecha_entrega).split("-");
          if (y) updates.fechaEntregaAnio = y;
          if (m) updates.fechaEntregaMes = m;
        }
      } else {
        updates.estadoVenta = "inmediata";
      }

      if (!updates.precio) missing.push("precio");
      if (!d.arriendo_estimado) missing.push("arriendo");

      return { ...prev, ...updates };
    });

    // Open all sections so user sees extracted data
    setSectionsForceOpen(true);

    return missing;
  }, []);

  const scrollToFirstMissing = useCallback((missing: string[]) => {
    setTimeout(() => {
      const fieldMap: Record<string, string> = {
        comuna: "comunaSearch", superficie: "superficieUtil", precio: "precio", arriendo: "arriendo",
      };
      for (const m of missing) {
        const elId = fieldMap[m];
        if (elId) {
          document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    }, 300);
  }, []);

  // ─── Quotation (PDF/image) upload ─────────────────
  const handleQuotationUpload = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setExtractMsg({ type: "error", text: "El archivo es demasiado grande. Máximo 10MB." });
      return;
    }
    setQuotationLoading(true);
    setExtractMsg(null);
    setExtractMissing([]);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/scraping/parse-quotation", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setExtractMsg({ type: "error", text: json.error || "No pudimos leer la cotización. Intenta con otra imagen o completa manualmente." });
        return;
      }

      const missing = fillFormFromExtraction(json.data);
      setExtractMissing(missing);
      setExtractMsg({ type: "success", text: "Datos extraídos de la cotización. Revisa y ajusta si es necesario." });
      scrollToFirstMissing(missing);
    } catch {
      setExtractMsg({ type: "error", text: "No pudimos leer la cotización. Intenta con otra imagen o completa manualmente." });
    } finally {
      setQuotationLoading(false);
    }
  }, [fillFormFromExtraction, scrollToFirstMissing]);

  // ─── Link extraction (Firecrawl) ──────────────────
  const handleLinkExtract = useCallback(async () => {
    if (!linkUrl.trim()) return;
    setLinkLoading(true);
    setExtractMsg(null);
    setExtractMissing([]);

    try {
      const res = await fetch("/api/scraping/parse-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await res.json();

      if (!res.ok) {
        setExtractMsg({ type: "error", text: json.error || "No pudimos leer esta publicación. Intenta con otra o completa manualmente." });
        return;
      }

      const missing = fillFormFromExtraction(json.data);
      setExtractMissing(missing);
      const portal = json.portal || "portal";
      setExtractMsg({ type: "success", text: `Datos extraídos de ${portal}. Revisa y ajusta si es necesario.` });
      scrollToFirstMissing(missing);
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
      setExtractMsg({
        type: "error",
        text: isTimeout
          ? "La publicación tardó demasiado en cargar. Intenta de nuevo o completa manualmente."
          : "No pudimos leer esta publicación. Intenta con otra o completa manualmente.",
      });
    } finally {
      setLinkLoading(false);
    }
  }, [linkUrl, fillFormFromExtraction, scrollToFirstMissing]);

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

  // ─── Geocoding when address changes ────────────────
  useEffect(() => {
    if (form.direccion && form.comuna) {
      clearTimeout(geocodeTimeout.current);
      setGeoLoading(true);
      geocodeTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(form.direccion)}&comuna=${encodeURIComponent(form.comuna)}`);
          const data = await res.json();
          if (data.lat && data.lng) {
            setGeoLat(data.lat);
            setGeoLng(data.lng);
          } else {
            setGeoLat(null);
            setGeoLng(null);
          }
        } catch {
          setGeoLat(null);
          setGeoLng(null);
        } finally {
          setGeoLoading(false);
        }
      }, 1000);
    } else {
      setGeoLat(null);
      setGeoLng(null);
    }
    return () => clearTimeout(geocodeTimeout.current);
  }, [form.direccion, form.comuna]);

  // ─── Fetch sugerencias por radio/comuna ───────────
  useEffect(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna || supUtil <= 0) { setRadioSugerencias(null); return; }

    const params = new URLSearchParams({
      comuna: form.comuna,
      superficie: String(supUtil),
      dormitorios: form.dormitorios,
      radius: String(radius),
    });
    if (geoLat && geoLng) {
      params.set("lat", String(geoLat));
      params.set("lng", String(geoLng));
    }
    const precioUF = fieldCurrency.precio === "UF"
      ? parseNum(form.precio)
      : parseNum(form.precio) / UF_CLP;
    if (precioUF > 0) params.set("precioUF", String(precioUF));

    fetch(`/api/data/suggestions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.arriendo) setRadioSugerencias(d);
        else setRadioSugerencias(null);
      })
      .catch(() => setRadioSugerencias(null));
  }, [form.comuna, form.superficieUtil, form.dormitorios, form.precio, fieldCurrency.precio, geoLat, geoLng, radius, UF_CLP]);

  // ─── Computed suggestions ──────────────────────────
  const suggestions = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna) return null;

    const nEstac = Number(form.estacionamiento) || 0;
    const nBodega = Number(form.bodega) || 0;
    const extraArriendo = nEstac * 40000 + nBodega * 15000;

    const precioM2Venta = marketData?.precio_m2_venta_promedio ?? 0;
    const precioSugeridoUF = supUtil > 0 && precioM2Venta > 0 ? Math.round(precioM2Venta * supUtil) : 0;

    const precioUFForCalc = (fieldCurrency.precio === "UF"
      ? parseNum(form.precio)
      : parseNum(form.precio) / UF_CLP) || precioSugeridoUF;

    const avaluoFiscal = precioUFForCalc * UF_CLP * 0.65;
    const contribAnual = Math.round(avaluoFiscal * 0.011);
    const contribuciones = Math.round(contribAnual / 4);

    const extraLabel = [
      nEstac > 0 ? `${nEstac} estac.` : "",
      nBodega > 0 ? `${nBodega} bod.` : "",
    ].filter(Boolean).join(" + ");

    if (marketData && supUtil > 0) {
      return {
        arriendoBase: marketData.arriendo_promedio,
        arriendo: marketData.arriendo_promedio + extraArriendo,
        extraArriendo, extraLabel,
        gastos: Math.round(marketData.gastos_comunes_m2 * supUtil),
        contribuciones, precioSugeridoUF, precioM2Venta,
        source: marketData.source, publicaciones: marketData.numero_publicaciones,
      };
    }
    if (supUtil <= 0) return null;
    const arriendoBase = Math.round(6000 * supUtil);
    return {
      arriendoBase,
      arriendo: arriendoBase + extraArriendo,
      extraArriendo, extraLabel,
      gastos: Math.round(1100 * supUtil),
      contribuciones, precioSugeridoUF: 0, precioM2Venta: 0,
      source: "estimate" as const, publicaciones: 0,
    };
  }, [form.comuna, form.superficieUtil, form.precio, form.estacionamiento, form.bodega, marketData, UF_CLP, fieldCurrency.precio]);

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

  // ─── "Franco sugiere" estimations ───────────────────
  const [sugeridos, setSugeridos] = useState<Record<string, boolean>>({});

  const francoSugerencias = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna || supUtil <= 0) return null;
    const data = ESTIMACIONES_POR_COMUNA[form.comuna];
    if (!data) return null;

    const dorm = Number(form.dormitorios) || 2;
    const ajusteDorm = dorm >= 3 ? 1.05 : dorm === 1 ? 0.95 : 1.0;

    const arriendo = Math.round(data.arriendoM2 * supUtil * ajusteDorm / 1000) * 1000;
    const ggcc = Math.round(data.ggccM2 * supUtil / 1000) * 1000;

    const precioUF = (fieldCurrency.precio === "UF"
      ? parseNum(form.precio)
      : parseNum(form.precio) / UF_CLP) || 3000;
    const avaluoFiscal = precioUF * 0.7;
    const contribAnualUF = avaluoFiscal * data.contribUfM2;
    const contribTrim = Math.round(contribAnualUF / 4 * UF_CLP / 1000) * 1000;

    return { arriendo, ggcc, contribTrim };
  }, [form.comuna, form.superficieUtil, form.dormitorios, form.precio, fieldCurrency.precio, UF_CLP]);

  const aplicarSugerencia = useCallback((campo: string, valor: number) => {
    if (campo === "arriendo") {
      setFieldCurrency((prev) => ({ ...prev, arriendo: "CLP" }));
      setField("arriendo", String(valor));
    }
    if (campo === "ggcc") {
      setFieldCurrency((prev) => ({ ...prev, gastos: "CLP" }));
      setField("gastos", String(valor));
    }
    if (campo === "contribuciones") {
      setFieldCurrency((prev) => ({ ...prev, contribuciones: "CLP" }));
      setField("contribuciones", String(valor));
    }
    setSugeridos((prev) => ({ ...prev, [campo]: true }));
  }, [setField]);

  const aplicarTodas = useCallback((sug: NonNullable<typeof francoSugerencias>) => {
    setFieldCurrency((prev) => ({ ...prev, arriendo: "CLP", gastos: "CLP", contribuciones: "CLP" }));
    setField("arriendo", String(sug.arriendo));
    setField("gastos", String(sug.ggcc));
    setField("contribuciones", String(sug.contribTrim));
    setSugeridos({ arriendo: true, ggcc: true, contribuciones: true });
  }, [setField]);

  // Clear "sugerido" badge when user manually edits the field
  useEffect(() => {
    if (sugeridos.arriendo && form.arriendo && francoSugerencias && String(francoSugerencias.arriendo) !== form.arriendo) {
      setSugeridos((prev) => ({ ...prev, arriendo: false }));
    }
  }, [form.arriendo, sugeridos.arriendo, francoSugerencias]);
  useEffect(() => {
    if (sugeridos.ggcc && form.gastos && francoSugerencias && String(francoSugerencias.ggcc) !== form.gastos) {
      setSugeridos((prev) => ({ ...prev, ggcc: false }));
    }
  }, [form.gastos, sugeridos.ggcc, francoSugerencias]);
  useEffect(() => {
    if (sugeridos.contribuciones && form.contribuciones && francoSugerencias && String(francoSugerencias.contribTrim) !== form.contribuciones) {
      setSugeridos((prev) => ({ ...prev, contribuciones: false }));
    }
  }, [form.contribuciones, sugeridos.contribuciones, francoSugerencias]);

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
    const antigNum = form.estadoVenta !== "inmediata" ? 0 : antiguedadToNumber(form.antiguedad);
    const mantencionRate = getMantencionRate(antigNum);
    const provisionAuto = Math.round((precioCLP * mantencionRate) / 12);
    const contribucionesAuto = Math.round(precioCLP * 0.65 * 0.011 / 4);
    const gastosAuto = Math.round(supUtil * 1200);

    return { precioUF, precioCLP, precioM2, pieUF, pieCLP, financiamientoPct, dividendo, provisionAuto, contribucionesAuto, gastosAuto };
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres, form.antiguedad, form.estadoVenta, fieldCurrency.precio, UF_CLP]);

  // ─── Collapsible section summaries ─────────────────
  const seccion2Summary = form.superficieUtil
    ? `${form.superficieUtil} m², ${form.dormitorios}D${form.banos}B, ${Number(form.estacionamiento)} estac., ${Number(form.bodega)} bod.`
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
          estacionamiento: Number(form.estacionamiento) > 0 ? "si" : "no",
          cantidadEstacionamientos: Number(form.estacionamiento),
          precioEstacionamiento: 0,
          bodega: Number(form.bodega) > 0,
          cantidadBodegas: Number(form.bodega),
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
          vacanciaMeses: parseFloat(form.vacanciaPct) * 12 / 100,
          usaAdministrador: parseFloat(form.adminPct) > 0,
          comisionAdministrador: parseFloat(form.adminPct) > 0 ? parseFloat(form.adminPct) : undefined,
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
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E6E6E2] bg-white">
        <div className="mx-auto flex h-14 max-w-[620px] items-center justify-between px-4">
          <FrancoLogo size="header" href="/" />
          <Link href="/dashboard" className="font-body text-sm text-[#71717A] hover:text-[#0F0F0F] transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-[620px] px-4 pb-28 pt-6">
        <div className="mb-5">
          <h1 className="font-heading font-bold text-2xl text-[#0F0F0F]">Nuevo Análisis</h1>
          <p className="font-body text-[13px] text-[#71717A] mt-1">
            Los números que tu corredor no te va a mostrar. <span className="font-mono">UF hoy: {fmtCLP(UF_CLP)}</span>
          </p>
        </div>

        {/* Mode selector */}
        <div className="mb-5">
          <div className="font-mono text-[9px] text-[#71717A] uppercase tracking-[0.1em] mb-2.5">¿QUÉ TIPO DE INVERSIÓN ANALIZAMOS?</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode("larga")}
              className={`text-left rounded-xl p-5 transition-all ${
                mode === "larga"
                  ? "bg-white border-2 border-[#0F0F0F]"
                  : "bg-white border border-[#E6E6E2] hover:border-[#0F0F0F]/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[22px]">🏢</div>
                {mode === "larga" && (
                  <span className="bg-[#0F0F0F] text-white font-mono text-[7px] font-bold px-2 py-0.5 rounded tracking-wide">SELECCIONADO</span>
                )}
              </div>
              <div className="font-body text-[15px] font-bold text-[#0F0F0F] mb-1">Renta larga</div>
              <div className="font-body text-xs text-[#71717A] leading-snug">Arriendo tradicional. Contrato anual con un inquilino fijo.</div>
              <div className="font-mono text-[10px] text-[#0F0F0F] font-medium mt-2.5">Flujo mensual · Plusvalía · ROI</div>
            </button>
            <div className="text-left rounded-xl p-5 bg-white border border-[#E6E6E2] opacity-50 cursor-default overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[22px]">✈️</div>
                <span className="bg-[#C8323C] text-white font-mono text-[7px] font-bold px-2 py-0.5 rounded tracking-wide">PRÓXIMAMENTE</span>
              </div>
              <div className="font-body text-[15px] font-bold text-[#0F0F0F] mb-1">Renta corta</div>
              <div className="font-body text-xs text-[#71717A] leading-snug">Tipo Airbnb. Arriendos por noche con rotación de huéspedes.</div>
              <div className="font-mono text-[10px] text-[#71717A] font-medium mt-2.5">Ocupación · Tarifa/noche · RevPAR</div>
            </div>
          </div>
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

        {/* Progress bar */}
        <div className="bg-white border border-[#E6E6E2] rounded-[10px] px-4 py-2.5 mb-4 flex justify-between items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-[#F0F0EC] overflow-hidden">
            <div
              className="h-full bg-[#0F0F0F] rounded-full transition-all duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[#0F0F0F] font-semibold">{progress.done}/{progress.total}</span>
          {progress.missing.length > 0 && (
            <span className="font-body text-[10px] text-[#71717A]">Faltan: {progress.missing.join(", ")}</span>
          )}
        </div>

        {/* Link paste / file upload section */}
        <div className="mb-3 rounded-xl border border-[#E6E6E2] bg-white p-5 text-center space-y-3.5">
          <div>
            <p className="font-body text-sm font-bold text-[#0F0F0F]">¿Tienes el link de la publicación? 🔗</p>
            <p className="font-body text-xs text-[#71717A] mb-3.5">Pégalo y Franco extrae los datos. Sin escribir nada.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="Pega aquí el link de la publicación"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1 border border-[#E6E6E2] rounded-lg bg-[#FAFAF8] px-3 py-2.5 font-body text-xs text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
            />
            <button
              type="button"
              disabled={linkLoading || !linkUrl.trim()}
              onClick={handleLinkExtract}
              className="bg-[#0F0F0F] text-white font-body text-xs font-bold px-4 py-2.5 rounded-lg shrink-0 disabled:opacity-50 hover:bg-[#0F0F0F]/90 transition-colors flex items-center justify-center gap-1.5"
            >
              {linkLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo...</>
              ) : (
                <>Extraer datos ✦</>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3 font-body text-xs text-[#71717A]">
            <div className="h-px flex-1 bg-[#E6E6E2]" />
            <span>o sube una cotización</span>
            <div className="h-px flex-1 bg-[#E6E6E2]" />
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setQuotationFile(f); handleQuotationUpload(f); }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={quotationLoading || linkLoading}
              className="border border-[#E6E6E2] rounded-lg px-4 py-2 font-body text-xs text-[#71717A] transition-colors hover:border-[#0F0F0F]/30 disabled:opacity-50"
            >
              {quotationLoading ? (
                <><Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1.5" /> Analizando cotización con IA...</>
              ) : (
                <>📄 Subir cotización (PDF o imagen)</>
              )}
            </button>
            {quotationFile && !quotationLoading && (
              <p className="font-body text-[11px] text-[#71717A]">{quotationFile.name}</p>
            )}
          </div>
          {extractMsg && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 font-body text-xs ${
              extractMsg.type === "success"
                ? "border border-[#0F0F0F] bg-[#0F0F0F]/5 text-[#0F0F0F]"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}>
              {extractMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {extractMsg.text}
            </div>
          )}
          {extractMissing.length > 0 && extractMsg?.type === "success" && (
            <p className="font-body text-[11px] text-amber-600">
              No se encontró: {extractMissing.join(", ")}
            </p>
          )}
          <p className="font-body text-[11px] text-[#71717A]">¿Prefieres hacerlo manual? Completa el formulario abajo ↓</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700">{error}</div>
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
              className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
            />
            <p className="mt-1 font-body text-[10px] text-[#71717A]">Ej: Depto Providencia 2D1B, Inversión Ñuñoa</p>
          </div>

          {/* ══════ SECCIÓN 1: ¿Dónde está? ══════ */}
          <SectionCard title="¿DÓNDE ESTÁ?" subtitle="Ubicación de la propiedad" defaultOpen={false} forceOpen={sectionsForceOpen} summary={form.comuna ? `${form.comuna}${form.direccion ? ` · ${form.direccion}` : ""}` : "Sin completar"}>
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
                className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
              />
              {form.comuna && (
                <button
                  type="button"
                  onClick={() => { setField("comuna", ""); setComunaSearch(""); setComunaOpen(true); }}
                  className="absolute right-3 top-[38px] text-xs text-[#71717A] hover:text-[#0F0F0F]"
                >✕</button>
              )}
              {comunaOpen && !form.comuna && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[#E6E6E2] bg-white shadow-lg">
                  {filteredComunas.length === 0 ? (
                    <div className="p-3 text-sm text-[#71717A]">No encontrada</div>
                  ) : (
                    filteredComunas.map((c) => (
                      <button
                        key={c.comuna} type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#F0F0EC]"
                        onClick={() => {
                          setField("comuna", c.comuna);
                          setComunaSearch("");
                          setComunaOpen(false);
                        }}
                      >
                        <span>{c.comuna}</span>
                        <span className="text-xs text-[#71717A]">{c.ciudad}, {c.region}</span>
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
                className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
              />
              {geoLoading && (
                <p className="mt-1 font-body text-[10px] text-[#71717A]">Geocodificando dirección...</p>
              )}
              {geoLat && geoLng && !geoLoading && (
                <p className="mt-1 font-body text-[10px] text-[#16A34A]">Dirección georeferenciada</p>
              )}
            </div>

            {/* Radio de búsqueda — solo visible cuando hay dirección geocodificada */}
            {geoLat && geoLng && (
              <div className="mt-1">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="font-body text-[13px] font-semibold text-[#0F0F0F]">Radio de búsqueda</span>
                    <InfoTooltip content="Franco busca propiedades similares dentro de este radio para sugerir precios de mercado. Más chico = más preciso pero menos datos." />
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-[#0F0F0F]">{radius}m</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full accent-[#0F0F0F]"
                />
                <div className="flex justify-between font-mono text-[9px] text-[#71717A] mt-1">
                  <span>300m</span>
                  <span>2km</span>
                </div>
                <div className="font-body text-[10px] text-[#71717A] mt-1">
                  {radius <= 500 ? "Hiperlocalizado — solo tu barrio inmediato" :
                   radius <= 800 ? "~10 min caminando — buen balance precisión/datos" :
                   radius <= 1200 ? "Zona amplia — más datos, menos preciso" :
                   "Zona muy amplia — útil si hay pocos datos cerca"}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ══════ SECCIÓN 2: ¿Cómo es? (colapsada) ══════ */}
          <SectionCard title="¿CÓMO ES?" subtitle="Características del departamento" defaultOpen={false} forceOpen={sectionsForceOpen} summary={seccion2Summary}>
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
                className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-1 font-body text-[10px] text-[#71717A]">Superficie total según escritura o ficha. Incluye terrazas y logias si están en la escritura.</p>
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
                    className="flex h-10 w-full appearance-none rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#71717A] focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
                  >
                    <option value="0-2">0-2 años (nuevo)</option>
                    <option value="3-5">3-5 años</option>
                    <option value="6-10">6-10 años</option>
                    <option value="11-20">11-20 años</option>
                    <option value="20+">20+ años</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                </div>
              </div>
              <div>
                <FieldLabel tip={TIPS.piso}>Piso</FieldLabel>
                <div className="relative">
                  <select
                    value={form.piso}
                    onChange={(e) => setField("piso", e.target.value)}
                    className="flex h-10 w-full appearance-none rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#71717A] focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
                  >
                    <option value="1-3">1-3 (bajo)</option>
                    <option value="4-8">4-8 (medio)</option>
                    <option value="9-15">9-15 (alto)</option>
                    <option value="16+">16+ (muy alto)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel tip={TIPS.estacionamiento}>Estacionamientos</FieldLabel>
                <ButtonGroup
                  options={[
                    { value: "0", label: "0" }, { value: "1", label: "1" },
                    { value: "2", label: "2" }, { value: "3", label: "3" },
                  ]}
                  value={form.estacionamiento}
                  onChange={(v) => setField("estacionamiento", v)}
                />
              </div>
              <div>
                <FieldLabel tip={TIPS.bodega}>Bodegas</FieldLabel>
                <ButtonGroup
                  options={[
                    { value: "0", label: "0" }, { value: "1", label: "1" },
                    { value: "2", label: "2" },
                  ]}
                  value={form.bodega}
                  onChange={(v) => setField("bodega", v)}
                />
              </div>
            </div>
          </SectionCard>

          {/* Auto-fill button */}
          {suggestions && form.comuna && form.superficieUtil && (!form.precio || !form.arriendo || !form.gastos || !form.contribuciones) && (
            <button
              type="button"
              onClick={autoFillAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E6E6E2] bg-[#FAFAF8] py-3 text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#F0F0EC]"
            >
              <Sparkles className="h-4 w-4" />
              Auto-rellenar con datos de {form.comuna}
            </button>
          )}

          {/* ══════ SECCIÓN 3: ¿Cuánto cuesta? ══════ */}
          <SectionCard title="¿CUÁNTO CUESTA?" subtitle="Precio y condiciones de compra" defaultOpen={false} forceOpen={sectionsForceOpen} summary={form.precio ? `${fieldCurrency.precio === "UF" ? fmtUF(parseNum(form.precio)) : fmtCLP(parseNum(form.precio))}, pie ${form.piePct}%` : "Sin completar"}>
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
                <p className="mt-1 text-xs text-[#71717A]">
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
                className="mt-1 w-full accent-[#0F0F0F]"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between font-mono text-xs text-[#71717A]">
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
                  className={`rounded-lg border px-4 py-2 font-body text-[13px] transition-colors ${
                    form.estadoVenta === "inmediata"
                      ? "bg-[#0F0F0F] text-white font-semibold border-[#0F0F0F]"
                      : "bg-white border-[#E6E6E2] text-[#71717A] hover:border-[#0F0F0F]/30"
                  }`}
                >
                  Entrega inmediata
                </button>
                <button
                  type="button"
                  onClick={() => setField("estadoVenta", "futura")}
                  className={`rounded-lg border px-4 py-2 font-body text-[13px] transition-colors ${
                    form.estadoVenta !== "inmediata"
                      ? "bg-[#0F0F0F] text-white font-semibold border-[#0F0F0F]"
                      : "bg-white border-[#E6E6E2] text-[#71717A] hover:border-[#0F0F0F]/30"
                  }`}
                >
                  <span>Entrega futura</span>
                  <span className="block font-body text-[9px] font-normal text-[#71717A]">Venta en blanco o en verde</span>
                </button>
              </div>
            </div>

            {form.estadoVenta !== "inmediata" && (
              <div className="rounded-lg border border-[#E6E6E2]/50 bg-[#F0F0EC]/50 p-4 space-y-3">
                <FieldLabel>Fecha de entrega estimada</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={form.fechaEntregaMes}
                      onChange={(e) => setField("fechaEntregaMes", e.target.value)}
                      className="flex h-10 w-full appearance-none rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#71717A] focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
                    >
                      <option value="">Mes...</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                          {new Date(2000, i).toLocaleString("es-CL", { month: "long" })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  </div>
                  <div className="relative">
                    <select
                      value={form.fechaEntregaAnio}
                      onChange={(e) => setField("fechaEntregaAnio", e.target.value)}
                      className="flex h-10 w-full appearance-none rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#71717A] focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none"
                    >
                      <option value="">Año...</option>
                      {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ══════ SECCIÓN 4: ¿Cómo lo financias? (colapsada) ══════ */}
          <SectionCard title="¿CÓMO LO FINANCIAS?" subtitle="Crédito hipotecario" defaultOpen={false} forceOpen={sectionsForceOpen} summary={seccion4Summary}>
            <div>
              <FieldLabel htmlFor="plazoCredito">Plazo crédito: {form.plazoCredito} años</FieldLabel>
              <input
                id="plazoCredito" type="range" min="10" max="30" step="5"
                value={form.plazoCredito}
                onChange={(e) => setField("plazoCredito", e.target.value)}
                className="mt-1 w-full accent-[#0F0F0F]"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between font-mono text-xs text-[#71717A]">
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
                className="flex h-10 w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-[13px] text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:ring-1 focus:ring-[#0F0F0F]/10 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-1 text-xs text-[#71717A]">
                Mercado actual: ~{tasaRef.value}%
                {tasaRef.updated_at && ` (act. ${new Date(tasaRef.updated_at).toLocaleDateString("es-CL")})`}
              </p>
            </div>

            {calc.dividendo > 0 && (
              <div className="rounded-lg border border-[#E6E6E2] bg-[#FAFAF8] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[13px] font-medium text-[#0F0F0F]">Dividendo estimado</span>
                  <span className="font-mono text-[15px] font-bold text-[#0F0F0F]">{fmtCLP(calc.dividendo)}/mes</span>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ══════ Franco sugiere ══════ */}
          {(() => {
            // Use radioSugerencias if available, otherwise fallback to francoSugerencias
            const sug = radioSugerencias || (francoSugerencias ? {
              arriendo: francoSugerencias.arriendo,
              ggcc: francoSugerencias.ggcc,
              contribTrim: francoSugerencias.contribTrim,
              source: "estimacion" as const,
              sampleSize: 0,
              radiusMeters: undefined as number | undefined,
              precioM2: undefined as number | undefined,
            } : null);
            if (!sug || (form.arriendo && form.gastos && form.contribuciones)) return null;

            return (
              <div className="bg-white border border-[#E6E6E2] rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✦</span>
                    <span className="font-body text-[13px] font-semibold text-[#0F0F0F]">Franco sugiere</span>
                  </div>
                  <span className="font-mono text-[9px] text-[#71717A] uppercase tracking-wide">
                    {sug.source === "radio"
                      ? `${sug.sampleSize} publicaciones en ${sug.radiusMeters}m`
                      : sug.source === "comuna"
                      ? `${sug.sampleSize} publicaciones en ${form.comuna}`
                      : `Estimación para ${form.comuna}`
                    }
                  </span>
                </div>

                <div className="font-body text-xs text-[#71717A] mb-3">
                  {sug.source === "radio"
                    ? `Basado en ${sug.sampleSize} propiedades similares dentro de ${sug.radiusMeters}m de tu dirección.`
                    : sug.source === "comuna"
                    ? `Basado en ${sug.sampleSize} publicaciones activas en ${form.comuna}.`
                    : `Estimación basada en promedios de mercado. Ingresa la dirección para datos más precisos.`
                  }
                  {sug.precioM2 && (
                    <span className="font-mono text-[#0F0F0F]"> Precio/m²: ${sug.precioM2.toLocaleString("es-CL")}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {!form.arriendo && (
                    <div className="bg-[#FAFAF8] rounded-lg p-3">
                      <div className="font-body text-[9px] text-[#71717A] uppercase tracking-wide mb-1">Arriendo /mes</div>
                      <div className="font-mono text-sm font-bold text-[#0F0F0F]">{fmtCLP(sug.arriendo)}</div>
                      <button type="button" onClick={() => aplicarSugerencia("arriendo", sug.arriendo)}
                        className="mt-2 font-body text-[10px] text-[#C8323C] font-semibold cursor-pointer hover:underline">
                        Usar este valor →
                      </button>
                    </div>
                  )}
                  {!form.gastos && sug.ggcc && (
                    <div className="bg-[#FAFAF8] rounded-lg p-3">
                      <div className="font-body text-[9px] text-[#71717A] uppercase tracking-wide mb-1">GGCC /mes</div>
                      <div className="font-mono text-sm font-bold text-[#0F0F0F]">{fmtCLP(sug.ggcc)}</div>
                      <button type="button" onClick={() => aplicarSugerencia("ggcc", sug.ggcc!)}
                        className="mt-2 font-body text-[10px] text-[#C8323C] font-semibold cursor-pointer hover:underline">
                        Usar este valor →
                      </button>
                    </div>
                  )}
                  {!form.contribuciones && (
                    <div className="bg-[#FAFAF8] rounded-lg p-3">
                      <div className="font-body text-[9px] text-[#71717A] uppercase tracking-wide mb-1">Contrib. /trim</div>
                      <div className="font-mono text-sm font-bold text-[#0F0F0F]">{fmtCLP(sug.contribTrim)}</div>
                      <button type="button" onClick={() => aplicarSugerencia("contribuciones", sug.contribTrim)}
                        className="mt-2 font-body text-[10px] text-[#C8323C] font-semibold cursor-pointer hover:underline">
                        Usar este valor →
                      </button>
                    </div>
                  )}
                </div>

                {!form.arriendo && !form.gastos && !form.contribuciones && sug.ggcc && (
                  <button type="button" onClick={() => aplicarTodas({ arriendo: sug.arriendo, ggcc: sug.ggcc!, contribTrim: sug.contribTrim })}
                    className="mt-3 w-full py-2 rounded-lg border border-[#0F0F0F] text-[#0F0F0F] font-body text-xs font-semibold hover:bg-[#0F0F0F] hover:text-white transition-colors">
                    Usar todas las sugerencias
                  </button>
                )}
              </div>
            );
          })()}

          {/* ══════ SECCIÓN 5: ¿Cuánto genera? ══════ */}
          <SectionCard title="¿CUÁNTO GENERA?" subtitle="Ingresos y gastos operacionales" defaultOpen={false} forceOpen={sectionsForceOpen} summary={form.arriendo ? `Arriendo ${fieldCurrency.arriendo === "UF" ? fmtUF(parseNum(form.arriendo)) : fmtCLP(parseNum(form.arriendo))}/mes` : "Sin completar"}>
            <div>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="arriendo" tip={TIPS.arriendo}>Arriendo esperado /mes</FieldLabel>
                {sugeridos.arriendo && (
                  <span className="font-mono text-[8px] text-[#C8323C] bg-[#C8323C]/10 px-1.5 py-0.5 rounded mb-1">✦ Sugerido</span>
                )}
              </div>
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
                  {fmtCLP(suggestions.arriendo)} sugerido/mes
                  {suggestions.extraLabel && <> · incluye {suggestions.extraLabel}</>}
                  {suggestions.publicaciones > 0 && <> · {suggestions.publicaciones} publicaciones</>}
                </AISuggestion>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="gastos" tip={TIPS.gastos}>Gastos comunes /mes</FieldLabel>
                  {sugeridos.ggcc && (
                    <span className="font-mono text-[8px] text-[#C8323C] bg-[#C8323C]/10 px-1.5 py-0.5 rounded mb-1">✦ Sugerido</span>
                  )}
                </div>
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
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="contribuciones" tip={TIPS.contribuciones}>Contribuciones /trim</FieldLabel>
                  {sugeridos.contribuciones && (
                    <span className="font-mono text-[8px] text-[#C8323C] bg-[#C8323C]/10 px-1.5 py-0.5 rounded mb-1">✦ Sugerido</span>
                  )}
                </div>
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
              <FieldLabel tip={TIPS.vacanciaMeses}>Vacancia</FieldLabel>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[13px] font-semibold text-[#0F0F0F]">{form.vacanciaPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={form.vacanciaPct}
                onChange={(e) => setField("vacanciaPct", e.target.value)}
                className="w-full accent-[#0F0F0F]"
              />
              <p className="mt-1 font-body text-[10px] text-[#71717A]">{`≈ ${(parseFloat(form.vacanciaPct) * 12 / 100).toFixed(1)} meses/año`}</p>
            </div>

            {/* Administración de arriendo */}
            <div>
              <FieldLabel tip="Si contratas un corredor o empresa para gestionar el arriendo (cobrar, buscar arrendatarios, coordinar reparaciones). Típicamente cobran entre 5% y 10% del arriendo mensual. En 0% se desactiva.">Administración</FieldLabel>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[13px] font-semibold text-[#0F0F0F]">{form.adminPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                step={1}
                value={form.adminPct}
                onChange={(e) => setField("adminPct", e.target.value)}
                className="w-full accent-[#0F0F0F]"
              />
              <p className="mt-1 text-xs text-[#71717A]">
                {parseFloat(form.adminPct) > 0
                  ? parseNum(form.arriendo) > 0
                    ? `${fmtCLP(Math.round(toCLP("arriendo", parseNum(form.arriendo)) * parseFloat(form.adminPct) / 100))}/mes`
                    : "Ingresa el arriendo para calcular"
                  : "Sin administrador"}
              </p>
            </div>
          </SectionCard>

          {/* Dividendo preview (outside cards) */}
          {calc.dividendo > 0 && calc.precioUF > 0 && parseNum(form.arriendo) > 0 && (
            <div className="rounded-xl border border-[#E6E6E2] bg-white p-4">
              <div className="flex items-center justify-between font-body text-[13px]">
                <span className="text-[#0F0F0F]">Arriendo</span>
                <span className="font-mono font-medium text-[#16A34A]">+{fmtCLP(toCLP("arriendo", parseNum(form.arriendo)))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-body text-[13px]">
                <span className="text-[#0F0F0F]">Dividendo</span>
                <span className="font-mono font-medium text-red-500">-{fmtCLP(calc.dividendo)}</span>
              </div>
              <div className="mt-2 border-t border-[#E6E6E2] pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[13px] font-semibold text-[#0F0F0F]">Flujo estimado</span>
                  {(() => {
                    const flujo = toCLP("arriendo", parseNum(form.arriendo)) - calc.dividendo;
                    return (
                      <span className={`font-mono text-[15px] font-bold ${flujo >= 0 ? "text-[#16A34A]" : "text-red-500"}`}>
                        {flujo >= 0 ? "+" : ""}{fmtCLP(flujo)}/mes
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-0.5 font-body text-[10px] text-[#71717A]">
                  Solo arriendo vs dividendo. El score incluye todos los costos.
                </p>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* Sticky submit footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#E6E6E2] py-3 px-5 z-50">
        <div className="max-w-[620px] mx-auto">
          <button
            type="button"
            disabled={loading || !canSubmit}
            onClick={handleSubmit}
            className={`w-full py-3.5 rounded-[10px] font-body text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              canSubmit && !loading
                ? "bg-[#C8323C] text-white shadow-[0_-2px_16px_rgba(200,50,60,0.15)]"
                : "bg-[#C8323C]/80 text-white"
            } disabled:cursor-not-allowed`}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generando Franco Score...</>
            ) : (
              <><span>✦</span> Generar Franco Score</>
            )}
          </button>
          {!canSubmit && !loading && (
            <div className="font-body text-[10px] text-[#71717A] text-center mt-1">
              Faltan: {progress.missing.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
