"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Loader2, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { AppNav } from "@/components/chrome/AppNav";
import GoogleMapRadius from "@/components/GoogleMapRadius";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { createClient } from "@/lib/supabase/client";
import { estimarContribuciones } from "@/lib/contribuciones";

const UF_CLP_FALLBACK = 38800;

const COMUNAS_GRAN_SANTIAGO = ["Santiago Centro","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];

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
  superficie: "Superficie total del departamento en metros cuadrados.",
  dormitorios: "Cantidad de dormitorios (sin contar living).",
  banos: "Cantidad de baños completos.",
  estacionamiento: "Estacionamientos incluidos en la compra.",
  bodega: "Bodegas incluidas en la compra.",
  precio: "Precio de venta publicado o acordado.",
  arriendo: "Arriendo esperado de mercado para este departamento.",
  gastos: "Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia).",
  contribuciones: "Las contribuciones se pagan 4 veces al año. Este valor es una estimación basada en la normativa del SII. El avalúo fiscal real puede variar — consúltalo en sii.cl con el ROL de la propiedad.",
  tasaInteres: "Tasa de interés anual del crédito hipotecario.",
  plazoCredito: "Duración del crédito hipotecario en años.",
  piePct: "Porcentaje del precio que se paga al contado.",
  vacanciaMeses: "Meses al año sin arrendatario. 1 mes/año es el estándar.",
  antiguedad: "Años del inmueble. Más antiguo = más mantención, menos plusvalía.",
  piso: "Pisos altos se arriendan más fácil y caro, y tienen mejor plusvalía.",
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
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div>
          <h3 className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.08em]">{title}</h3>
          {subtitle && <p className="font-body text-[11px] text-[var(--franco-text-muted)]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!open && summary && <span className="font-body text-[11px] text-[var(--franco-text-muted)]">{summary}</span>}
          <span className={`text-[var(--franco-text-muted)] text-sm transition-transform ${open ? "rotate-180" : ""}`}>↓</span>
        </div>
      </button>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  );
}

function FieldLabel({ htmlFor, children, tip }: { htmlFor?: string; children: React.ReactNode; tip?: string }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label htmlFor={htmlFor} className="font-body text-[13px] font-semibold text-[var(--franco-text)]">{children}</label>
      {tip && <InfoTooltip content={tip} />}
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
  const isFocused = useRef(false);
  const isUF = currency === "UF";

  // Sync display when value changes externally (e.g. currency toggle, suggestion click)
  // Skip when user is actively editing (focused) — handleBlur formats on exit
  useEffect(() => {
    if (isFocused.current) return;
    if (!value) { setDisplay(""); return; }
    const num = Number(value) || 0;
    if (num === 0) { setDisplay(""); return; }
    if (isUF) {
      const rounded = Math.round(num * 100) / 100;
      if (rounded >= 100) {
        // Large UF values: show with thousands separator, no forced decimals
        setDisplay(Math.round(rounded).toLocaleString("es-CL"));
      } else {
        const [int, dec] = rounded.toFixed(2).split(".");
        setDisplay(Number(int).toLocaleString("es-CL") + "," + dec);
      }
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

  const handleFocus = () => { isFocused.current = true; };

  const handleBlur = () => {
    isFocused.current = false;
    const num = parseNum(display);
    if (num > 0) {
      if (isUF) {
        const rounded = Math.round(num * 100) / 100;
        if (rounded >= 100) {
          setDisplay(Math.round(rounded).toLocaleString("es-CL"));
        } else {
          const [int, dec] = rounded.toFixed(2).split(".");
          setDisplay(Number(int).toLocaleString("es-CL") + "," + dec);
        }
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
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--franco-text-muted)]">
        {isUF ? "UF" : "$"}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        min={min}
        className="flex h-10 w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] py-2 pl-10 pr-14 font-body text-[13px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] transition-colors focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ fontSize: "13px" }}
      />
      {onCurrencyToggle && (
        <button
          type="button"
          onClick={onCurrencyToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--franco-text-muted)] cursor-pointer hover:text-white/70"
          title={`Cambiar a ${isUF ? "CLP" : "UF"}`}
        >
          {isUF ? "→CLP" : "→UF"}
        </button>
      )}
    </div>
  );
}

const LS_KEY = "franco_form_draft";

// ─── Main Form ───────────────────────────────────────

const GUEST_LS_KEY = "franco_guest_analysis";

export default function NuevoAnalisisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);
  const [, setIsLoggedIn] = useState<boolean | null>(null); // only used as a gate for guestBlocked below
  const [guestBlocked, setGuestBlocked] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [extractMsg, setExtractMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [extractMissing, setExtractMissing] = useState<string[]>([]);
  const [sectionsForceOpen, setSectionsForceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const direccionInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const formInitialized = useRef(false);

  // Geocoding state
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radius, setRadius] = useState(800);
  const geocodeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const geoSourceRef = useRef<"autocomplete" | "manual" | null>(null);

  const [totalInRadius, setTotalInRadius] = useState(0);
  const [filteredInRadius, setFilteredInRadius] = useState(0);
  const [nearbyProperties, setNearbyProperties] = useState<{ lat: number; lng: number }[]>([]);
  const [suggestionSampleSize, setSuggestionSampleSize] = useState(0);

  // API-based suggestions (arriendo by radio/comuna)
  const [apiSuggestions, setApiSuggestions] = useState<{
    arriendo: number;
    ggcc: number | null;
    source: string;
    sampleSize: number;
    precioM2?: number;
  } | null>(null);

  // Venta precio reference (precioM2 from nearby venta properties)
  const [ventaRef, setVentaRef] = useState<{
    precioM2: number | null;
    sampleSize: number;
    filteredInRadius: number;
    nearbyProperties: { lat: number; lng: number }[];
  } | null>(null);

  // Check auth + guest limit on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const loggedIn = !!data.user;
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        const existing = localStorage.getItem(GUEST_LS_KEY);
        if (existing) setGuestBlocked(true);
      }
    });
  }, []);

  // Fetch real UF value + tasa hipotecaria on mount
  const [tasaRef, setTasaRef] = useState<{ value: string; updated_at: string | null }>({ value: "4.72", updated_at: null });
  const tasaModificadaRef = useRef(false);
  const cuotasModificadaRef = useRef(false);
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
          if (!tasaModificadaRef.current) {
            setForm((prev) => ({ ...prev, tasaInteres: d.value }));
          }
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
    valorMercado: "UF", precio: "UF", arriendo: "CLP", gastos: "CLP", contribuciones: "CLP", arriendoEstac: "CLP", arriendoBodega: "CLP",
  });
  // Store original CLP values so CLP→UF→CLP round-trip is lossless
  const [originalCLP, setOriginalCLP] = useState<Record<string, number>>({});
  const [editedInUF, setEditedInUF] = useState<Record<string, boolean>>({});

  const toggleFieldCurrency = useCallback((field: string) => {
    const currentCurrency = fieldCurrency[field] || "CLP";
    const wasUF = currentCurrency === "UF";
    const newCurrency = wasUF ? "CLP" : "UF";
    const uf = UF_CLP;

    setForm((f) => {
      const raw = Number(f[field as keyof typeof f]) || 0;
      if (raw === 0) return f;

      if (wasUF) {
        // UF → CLP: restore original if not edited in UF mode
        if (!editedInUF[field] && originalCLP[field]) {
          return { ...f, [field]: String(originalCLP[field]) };
        }
        return { ...f, [field]: String(Math.round(raw * uf)) };
      } else {
        // CLP → UF: save original CLP before converting
        setOriginalCLP((prev) => ({ ...prev, [field]: raw }));
        setEditedInUF((prev) => ({ ...prev, [field]: false }));
        return { ...f, [field]: String(Math.round((raw / uf) * 100) / 100) };
      }
    });
    setFieldCurrency((prev) => ({ ...prev, [field]: newCurrency }));
  }, [UF_CLP, fieldCurrency, originalCLP, editedInUF]);

  // ─── Form state ────────────────────────────────────
  const [form, setForm] = useState({
    nombreAnalisis: "",
    comuna: "",
    direccion: "",
    tipoPropiedad: "usado",
    dormitorios: "",
    banos: "",
    superficieUtil: "",
    antiguedad: "3-5",
    piso: "4-8",
    estacionamiento: "",
    arriendoEstac: "",
    bodega: "",
    arriendoBodega: "",
    estadoVenta: "inmediata",
    fechaEntregaMes: "",
    fechaEntregaAnio: "",
    cuotasPie: "",
    valorMercado: "",
    precio: "",
    piePct: "20",
    plazoCredito: "25",
    tasaInteres: "4.72",
    arriendo: "",
    gastos: "",
    contribuciones: "",
    vacanciaPct: "5",
    adminPct: "0",
  });

  const setField = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // If user edits a monetary field while in UF mode, mark it so we don't restore stale CLP original
    if (fieldCurrency[field] === "UF") {
      setEditedInUF((prev) => ({ ...prev, [field]: true }));
    }
  }, [fieldCurrency]);

  // ─── localStorage persistence ──────────────────────
  // Restore draft on mount, OR hydrate from revisar flow (takes precedence)
  useEffect(() => {
    try {
      const hydrateFlag = sessionStorage.getItem("franco:revisar:hydrate-form");
      const revisarRaw = sessionStorage.getItem("franco:revisar:v1");
      if (hydrateFlag && revisarRaw) {
        const revisar = JSON.parse(revisarRaw);
        if (revisar?.formState && typeof revisar.formState === "object") {
          setForm((prev) => ({ ...prev, ...revisar.formState }));
        }
        if (revisar?.apiPayload) {
          // Apply any inline edits the user made in the revisar screen
          setForm((prev) => ({
            ...prev,
            precio: String(revisar.apiPayload.precio ?? prev.precio),
            arriendo: String(revisar.apiPayload.arriendo ?? prev.arriendo),
            piePct: String(revisar.apiPayload.piePct ?? prev.piePct),
            plazoCredito: String(revisar.apiPayload.plazoCredito ?? prev.plazoCredito),
            tasaInteres: String(revisar.apiPayload.tasaInteres ?? prev.tasaInteres),
          }));
          // Ensure precio is read as UF on re-hydration since that's how we stored it
          setFieldCurrency((fc) => ({ ...fc, precio: "UF", arriendo: "CLP" }));
        }
        sessionStorage.removeItem("franco:revisar:hydrate-form");
        formInitialized.current = true;
        return;
      }
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

      if (d.estado_venta === "futura" || d.estado_venta === "verde" || d.estado_venta === "blanco") {
        updates.estadoVenta = "futura";
        updates.tipoPropiedad = "nuevo";
        if (d.fecha_entrega) {
          const [y, m] = String(d.fecha_entrega).split("-");
          if (y) updates.fechaEntregaAnio = y;
          if (m) updates.fechaEntregaMes = m;
        }
      } else {
        updates.estadoVenta = "inmediata";
        // Keep tipoPropiedad from input_data if available (could be nuevo with inmediata delivery)
        if (d.tipo === "nuevo" || d.tipo === "Nuevo") updates.tipoPropiedad = "nuevo";
        else updates.tipoPropiedad = "usado";
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

  // ─── Progress ─────────────────────────────────────
  const progress = useMemo(() => {
    const checks = [
      { label: "Comuna", done: !!form.comuna },
      { label: "Superficie", done: !!form.superficieUtil && parseNum(form.superficieUtil) > 0 },
      { label: "Precio", done: !!form.precio && Number(form.precio) > 0 },
      { label: "Arriendo", done: !!form.arriendo && Number(form.arriendo) > 0 },
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
    const dorm = form.dormitorios || "0";
    fetch(`/api/market-data?comuna=${encodeURIComponent(form.comuna)}&dormitorios=${dorm}`)
      .then((r) => r.json())
      .then((d) => setMarketData(d.data))
      .catch(() => setMarketData(null));
  }, [form.comuna, form.dormitorios]);

  // ─── Geocoding when address changes ────────────────
  useEffect(() => {
    if (form.direccion && form.comuna) {
      // Skip API geocoding if coords came from Places Autocomplete (more precise)
      if (geoSourceRef.current === "autocomplete") {
        geoSourceRef.current = null; // reset so manual edits will re-geocode
        setGeoLoading(false);
        return;
      }
      clearTimeout(geocodeTimeout.current);
      setGeoLoading(true);
      geocodeTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(form.direccion)}&comuna=${encodeURIComponent(form.comuna)}`);
          const data = await res.json();
          if (data.lat && data.lng) {
            geoSourceRef.current = "manual";
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

  // ─── Google Places Autocomplete ──────────────────
  useEffect(() => {
    if (autocompleteRef.current || !direccionInputRef.current) return;

    loadGoogleMaps();

    const tryInit = () => {
      if (!window.google?.maps?.places || !direccionInputRef.current) return false;

      const ac = new google.maps.places.Autocomplete(direccionInputRef.current, {
        componentRestrictions: { country: "cl" },
        types: ["address"],
        fields: ["geometry", "formatted_address", "address_components"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;

        geoSourceRef.current = "autocomplete";
        setGeoLat(place.geometry.location.lat());
        setGeoLng(place.geometry.location.lng());
        setGeoLoading(false);

        if (place.formatted_address) {
          const clean = place.formatted_address
            .replace(/,?\s*Chile\s*$/i, "")
            .replace(/,?\s*\d{7}\s*$/,  "")
            .trim();
          setField("direccion", clean);
        }

        // Auto-detect comuna from address_components
        const components = place.address_components || [];
        const comunaComp = components.find(
          (c) => c.types.includes("administrative_area_level_3") || c.types.includes("locality")
        );
        if (comunaComp) {
          const match = COMUNAS.find(
            (c) => c.comuna.toLowerCase() === comunaComp.long_name.toLowerCase()
          );
          if (match) {
            setField("comuna", match.comuna);
            setComunaSearch("");
          }
        }
      });

      autocompleteRef.current = ac;
      return true;
    };

    if (tryInit()) return;

    // Poll until Google Maps loads
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setField]);

  // ─── Fetch sugerencias + mapa (un solo efecto) ───
  useEffect(() => {
    if (!form.comuna) {
      setTotalInRadius(0);
      setNearbyProperties([]);
      setFilteredInRadius(0);
      setSuggestionSampleSize(0);
      setApiSuggestions(null);
      return;
    }

    const supUtil = parseNum(form.superficieUtil) || 0;
    const params = new URLSearchParams({
      comuna: form.comuna,
      superficie: String(supUtil > 0 ? supUtil : 50),
      dormitorios: form.dormitorios || "0",
      radius: String(radius),
    });
    if (geoLat && geoLng) {
      params.set("lat", String(geoLat));
      params.set("lng", String(geoLng));
    }
    const precioUF = fieldCurrency.precio === "UF"
      ? (Number(form.precio) || 0)
      : (Number(form.precio) || 0) / UF_CLP;
    if (precioUF > 0) params.set("precioUF", String(precioUF));

    fetch(`/api/data/suggestions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTotalInRadius(d.totalInRadius || 0);
        setFilteredInRadius(d.filteredInRadius || 0);
        setSuggestionSampleSize(d.sampleSize || 0);
        setNearbyProperties(
          (d.nearbyProperties || []).filter((p: { lat: number; lng: number }) => p.lat && p.lng)
        );
        // Store API suggestion values for arriendo
        if (d.arriendo) {
          setApiSuggestions({
            arriendo: d.arriendo,
            ggcc: d.ggcc || null,
            source: d.source || "estimacion",
            sampleSize: d.sampleSize || 0,
            precioM2: d.precioM2 || undefined,
          });
        } else {
          setApiSuggestions(null);
        }
      })
      .catch(() => {
        setTotalInRadius(0);
        setFilteredInRadius(0);
        setSuggestionSampleSize(0);
        setNearbyProperties([]);
        setApiSuggestions(null);
      });

    // Fetch venta reference (precio/m² from nearby venta properties)
    // Only requires lat/lng — superficie and dormitorios are optional filters
    if (geoLat && geoLng) {
      const ventaParams = new URLSearchParams({
        comuna: form.comuna,
        superficie: String(supUtil > 0 ? supUtil : 0),
        dormitorios: "0",
        radius: String(radius),
        lat: String(geoLat),
        lng: String(geoLng),
        type: "venta",
        condicion: form.tipoPropiedad === "nuevo" ? "nuevo" : "usado",
      });
      fetch(`/api/data/suggestions?${ventaParams}`)
        .then((r) => r.json())
        .then((d) => {
          const count = d.filteredInRadius || d.totalInRadius || 0;
          if (count > 0 || (d.precioM2 && d.precioM2 > 0)) {
            setVentaRef({
              precioM2: (d.precioM2 && d.precioM2 > 0) ? d.precioM2 : null,
              sampleSize: d.sampleSize || 0,
              filteredInRadius: count,
              nearbyProperties: (d.nearbyProperties || []).filter((p: { lat: number; lng: number }) => p.lat && p.lng),
            });
          } else {
            setVentaRef(null);
          }
        })
        .catch(() => setVentaRef(null));
    } else {
      setVentaRef(null);
    }
  }, [form.comuna, form.superficieUtil, form.dormitorios, form.precio, form.tipoPropiedad, fieldCurrency.precio, geoLat, geoLng, radius, UF_CLP]);

  // ─── Computed suggestions (prefer API data, fallback to market_data) ──
  const suggestions = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna) return null;

    const nEstac = Number(form.estacionamiento) || 0;
    const nBodega = Number(form.bodega) || 0;
    // Use user-entered rental income; fall back to estimates if empty
    const estacIncome = Number(form.arriendoEstac) || (nEstac * 40000);
    const bodegaIncome = Number(form.arriendoBodega) || (nBodega * 15000);
    const extraArriendo = estacIncome + bodegaIncome;

    // Precio venta: prefer ventaRef (radius-based) over marketData (static)
    // ventaRef.precioM2 is CLP/m² (from scraped_properties), marketData is UF/m²
    const precioM2VentaUF = ventaRef?.precioM2
      ? ventaRef.precioM2 / UF_CLP
      : (marketData?.precio_m2_venta_promedio ?? 0);
    // Deptos nuevos: precio/m² baja con la superficie (unidad "desde" ~25m² es la más cara/m²)
    const precioM2Ajustado = form.tipoPropiedad === "nuevo" && supUtil > 25
      ? precioM2VentaUF * Math.pow(25 / supUtil, 0.15)
      : precioM2VentaUF;
    const precioSugeridoUF = supUtil > 0 && precioM2Ajustado > 0 ? Math.round(precioM2Ajustado * supUtil) : 0;

    const precioUFForCalc = (fieldCurrency.precio === "UF"
      ? (Number(form.precio) || 0)
      : (Number(form.precio) || 0) / UF_CLP) || precioSugeridoUF;

    const contribuciones = estimarContribuciones(precioUFForCalc * UF_CLP, form.tipoPropiedad === "nuevo");

    // Use API-based arriendo if available, otherwise fallback
    // Prefer precioM2 × superficie (scales with size) over raw median arriendo
    if (apiSuggestions && supUtil > 0) {
      const precioM2Arriendo = apiSuggestions.precioM2 ?? 0;
      const arriendoBase = precioM2Arriendo > 0
        ? Math.round((precioM2Arriendo * supUtil) / 1000) * 1000
        : apiSuggestions.arriendo;
      return {
        arriendoBase,
        arriendo: arriendoBase + extraArriendo,
        extraArriendo,
        precioM2Arriendo,
        // ggcc: only show if API has real data (not estimated)
        gastos: apiSuggestions.ggcc && apiSuggestions.source !== "estimacion" ? apiSuggestions.ggcc : null,
        contribuciones, precioSugeridoUF, precioM2VentaUF,
        source: apiSuggestions.source, publicaciones: apiSuggestions.sampleSize,
      };
    }

    if (marketData && supUtil > 0) {
      const precioM2Arriendo = marketData.arriendo_promedio && supUtil > 0
        ? Math.round(marketData.arriendo_promedio / supUtil)
        : 0;
      return {
        arriendoBase: marketData.arriendo_promedio,
        arriendo: marketData.arriendo_promedio + extraArriendo,
        extraArriendo,
        precioM2Arriendo,
        gastos: null, // No fake gastos comunes
        contribuciones, precioSugeridoUF, precioM2VentaUF,
        source: marketData.source, publicaciones: marketData.numero_publicaciones,
      };
    }
    if (supUtil <= 0) return null;
    const arriendoBase = Math.round(6000 * supUtil);
    return {
      arriendoBase,
      arriendo: arriendoBase + extraArriendo,
      extraArriendo,
      precioM2Arriendo: 6000,
      gastos: null,
      contribuciones, precioSugeridoUF: 0, precioM2VentaUF: 0,
      source: "estimate" as const, publicaciones: 0,
    };
  }, [form.comuna, form.superficieUtil, form.precio, form.estacionamiento, form.arriendoEstac, form.bodega, form.arriendoBodega, form.tipoPropiedad, marketData, apiSuggestions, ventaRef, UF_CLP, fieldCurrency.precio]);

  // ─── Real-time calculations ────────────────────────
  const toCLP = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value * UF_CLP : value;
  }, [fieldCurrency, UF_CLP]);

  const toUF = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value : value / UF_CLP;
  }, [fieldCurrency, UF_CLP]);

  const calc = useMemo(() => {
    const precioUF = fieldCurrency.precio === "UF"
      ? (Number(form.precio) || 0)
      : (Number(form.precio) || 0) / UF_CLP;

    const supUtil = parseNum(form.superficieUtil) || 0;
    const piePct = parseFloat(form.piePct) || 20;
    const plazo = parseFloat(form.plazoCredito) || 25;
    const tasa = parseFloat(form.tasaInteres) || parseFloat(tasaRef.value) || 4.72;

    const precioCLP = precioUF * UF_CLP;
    const precioM2 = supUtil > 0 ? precioUF / supUtil : 0;
    const pieUF = precioUF * (piePct / 100);
    const pieCLP = pieUF * UF_CLP;
    const financiamientoPct = 100 - piePct;
    const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, UF_CLP);
    const antigNum = form.estadoVenta !== "inmediata" ? 0 : antiguedadToNumber(form.antiguedad);
    const mantencionRate = getMantencionRate(antigNum);
    const provisionAuto = Math.round((precioCLP * mantencionRate) / 12);
    const contribucionesAuto = estimarContribuciones(precioCLP, form.tipoPropiedad === "nuevo");
    const gastosAuto = Math.round(supUtil * 1200);

    return { precioUF, precioCLP, precioM2, pieUF, pieCLP, financiamientoPct, dividendo, provisionAuto, contribucionesAuto, gastosAuto };
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres, form.antiguedad, form.estadoVenta, fieldCurrency.precio, UF_CLP, tasaRef.value]);

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

  // ─── Sync tipoPropiedad → estadoVenta ──────────────
  useEffect(() => {
    if (form.tipoPropiedad === "usado") {
      setForm((prev) => ({ ...prev, estadoVenta: "inmediata" }));
    }
    // When switching to "nuevo", keep current estadoVenta (default "inmediata", user can toggle to "futura")
  }, [form.tipoPropiedad]);

  // ─── Auto-suggest cuotas from delivery date ────────
  useEffect(() => {
    if (cuotasModificadaRef.current) return;
    if (!form.fechaEntregaMes || !form.fechaEntregaAnio) return;
    const now = new Date();
    const entrega = new Date(Number(form.fechaEntregaAnio), Number(form.fechaEntregaMes) - 1);
    const meses = Math.max(1, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    setField("cuotasPie", String(meses));
  }, [form.fechaEntregaMes, form.fechaEntregaAnio, setField]);

  // ─── Siguiente → Revisar ───────────────────────────
  // En lugar de crear el análisis aquí, armamos el payload final + metadata y
  // navegamos a /analisis/nuevo/revisar. La creación real ocurre ahí.
  const REVISAR_SS_KEY = "franco:revisar:v1";
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    const supUtil = parseNum(form.superficieUtil) || 0;
    const precioUF = toUF("precio", Number(form.precio) || 0);
    const arriendo = Math.round(toCLP("arriendo", Number(form.arriendo) || 0));
    const gastos = Math.round(toCLP("gastos", Number(form.gastos) || 0));
    const contribuciones = Math.round(toCLP("contribuciones", Number(form.contribuciones) || 0));
    const antiguedad = form.estadoVenta !== "inmediata" ? 0 : antiguedadToNumber(form.antiguedad);
    const provisionMantencion = calc.provisionAuto;
    const ciudad = selectedComuna?.ciudad || "Santiago";
    const nombre = form.nombreAnalisis.trim() || `Depto ${form.dormitorios || '2'}D${form.banos || '1'}B ${form.comuna}`;

    const apiPayload = {
      nombre,
      comuna: form.comuna,
      ciudad,
      direccion: form.direccion || undefined,
      tipo: "Departamento",
      dormitorios: Number(form.dormitorios) || 2,
      banos: Number(form.banos) || 1,
      superficie: supUtil,
      superficieTotal: supUtil,
      antiguedad,
      enConstruccion: form.estadoVenta !== "inmediata",
      piso: 0,
      estacionamiento: Number(form.estacionamiento) > 0 ? "si" : "no",
      cantidadEstacionamientos: Number(form.estacionamiento),
      precioEstacionamiento: 0,
      bodega: Number(form.bodega) > 0,
      cantidadBodegas: Number(form.bodega),
      estadoVenta: form.estadoVenta === "futura" ? "futura" : "inmediata",
      fechaEntrega: form.estadoVenta === "futura"
        ? `${form.fechaEntregaAnio}-${form.fechaEntregaMes}`
        : undefined,
      cuotasPie: Number(form.cuotasPie) || (form.tipoPropiedad === "nuevo" && form.estadoVenta === "inmediata" ? 1 : 0),
      montoCuota: Number(form.cuotasPie) > 0 ? Math.round((calc.pieUF / Number(form.cuotasPie)) * UF_CLP) : 0,
      precio: precioUF,
      valorMercadoFranco: suggestions?.precioSugeridoUF || undefined,
      valorMercadoUsuario: form.valorMercado ? toUF("valorMercado", Number(form.valorMercado) || 0) : undefined,
      piePct: parseFloat(form.piePct),
      plazoCredito: parseFloat(form.plazoCredito),
      tasaInteres: parseFloat(form.tasaInteres),
      gastos: gastos || calc.gastosAuto,
      contribuciones: contribuciones || calc.contribucionesAuto,
      provisionMantencion,
      tipoRenta: "larga",
      arriendo,
      arriendoEstacionamiento: Number(form.arriendoEstac) || 0,
      arriendoBodega: Number(form.arriendoBodega) || 0,
      vacanciaMeses: parseFloat(form.vacanciaPct) * 12 / 100,
      usaAdministrador: parseFloat(form.adminPct) > 0,
      comisionAdministrador: parseFloat(form.adminPct) > 0 ? parseFloat(form.adminPct) : undefined,
      zonaRadio: {
        precioM2VentaCLP: ventaRef?.precioM2 || null,
        arriendoPromedio: suggestions?.arriendoBase || apiSuggestions?.arriendo || null,
        arriendoPrecioM2: suggestions?.precioM2Arriendo || apiSuggestions?.precioM2 || null,
        sampleSizeArriendo: apiSuggestions?.sampleSize || 0,
        sampleSizeVenta: ventaRef?.sampleSize || 0,
        radioMetros: radius,
        lat: geoLat || null,
        lng: geoLng || null,
      },
    };

    const mesEtiqueta = form.fechaEntregaMes && form.fechaEntregaAnio
      ? `${form.fechaEntregaMes.padStart(2, "0")}/${form.fechaEntregaAnio}`
      : "";
    const estadoLabel = form.estadoVenta === "futura" && mesEtiqueta
      ? `Entrega ${mesEtiqueta}`
      : "Entrega inmediata";

    const revisarPayload = {
      apiPayload,
      displayMeta: {
        direccionFull: form.direccion || "",
        comunaLabel: form.comuna,
        tipoLabel: form.tipoPropiedad === "nuevo" ? "Nuevo" : "Usado",
        estadoLabel,
        superficieM2: supUtil,
        UF_CLP,
        vmFrancoUF: suggestions?.precioSugeridoUF ?? null,
        arriendoRangeBase: suggestions?.arriendoBase ?? apiSuggestions?.arriendo ?? null,
      },
      formState: form,
    };

    try {
      sessionStorage.setItem(REVISAR_SS_KEY, JSON.stringify(revisarPayload));
    } catch {
      setError("No se pudo guardar el resumen. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/analisis/nuevo/revisar");
  };

  // ─── Shared input class ────────────────────────────
  const inputClass = "flex h-9 w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2 font-body text-[13px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Nav */}
      <AppNav
        variant="app"
        ctaSlot={
          <Link href="/dashboard" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
            ← Dashboard
          </Link>
        }
      />

      <div className="mx-auto max-w-[620px] px-4 pb-12 pt-6 overflow-x-hidden">
        {/* Guest blocked — already used their free analysis */}
        {guestBlocked && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--franco-card)] flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-[var(--franco-positive)]" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[var(--franco-text)]">Ya hiciste tu primer análisis gratis</h2>
            <p className="font-body text-base text-[var(--franco-text-muted)] mt-2 max-w-[360px]">
              Crea tu cuenta para análisis ilimitados — gratis, sin tarjeta.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
              <Link
                href="/register"
                className="bg-[#C8323C] text-white font-body text-sm font-bold px-6 py-3 rounded-lg shadow-[0_2px_10px_rgba(200,50,60,0.15)] min-h-[44px]"
              >
                Crear cuenta gratis →
              </Link>
              <Link
                href="/login"
                className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors py-2"
              >
                Ya tengo cuenta →
              </Link>
            </div>
          </div>
        )}

        {!guestBlocked && (<>
        <div className="mb-5">
          <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">Nuevo Análisis</h1>
          <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
            Los números que tu corredor no te va a mostrar. <span className="font-mono">UF hoy: {fmtCLP(UF_CLP)}</span>
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

        {/* Link paste / file upload section — compact */}
        <div className="mb-3 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3 space-y-2.5">
          <p className="font-body text-[11px] text-[var(--franco-text-muted)]">¿Tienes el link o cotización? Pégalo y Franco extrae los datos.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="Pega aquí el link de la publicación"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1 border border-[var(--franco-border)] rounded-lg bg-[var(--franco-card)] px-3 py-2.5 font-body text-xs text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none"
            />
            <button
              type="button"
              disabled={linkLoading || !linkUrl.trim()}
              onClick={handleLinkExtract}
              className="bg-[var(--franco-text)] text-[var(--franco-bg)] font-body text-xs font-bold px-4 py-2.5 rounded-lg shrink-0 disabled:opacity-50 hover:bg-white transition-colors flex items-center justify-center gap-1.5"
            >
              {linkLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo...</>
              ) : (
                <>Extraer datos</>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3 font-body text-xs text-[var(--franco-text-muted)]">
            <div className="h-px flex-1 bg-[var(--franco-border)]" />
            <span>o sube cotización</span>
            <div className="h-px flex-1 bg-[var(--franco-border)]" />
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
              className="border border-[var(--franco-border)] rounded-lg px-4 py-2 font-body text-xs text-[var(--franco-text-muted)] transition-colors hover:border-[var(--franco-border-hover)] disabled:opacity-50"
            >
              {quotationLoading ? (
                <><Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1.5" /> Analizando cotización con IA...</>
              ) : (
                <>Subir cotización (PDF o imagen)</>
              )}
            </button>
            {quotationFile && !quotationLoading && (
              <p className="font-body text-[11px] text-[var(--franco-text-muted)]">{quotationFile.name}</p>
            )}
          </div>
          {extractMsg && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 font-body text-xs ${
              extractMsg.type === "success"
                ? "border border-[#B0BEC5]/30 bg-[#B0BEC5]/10 text-[var(--franco-positive)]"
                : "border border-[#C8323C]/30 bg-[#C8323C]/10 text-[#C8323C]"
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
          <p className="font-body text-[11px] text-[var(--franco-text-muted)]">¿Prefieres hacerlo manual? Completa el formulario abajo ↓</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700 mb-3">{error}</div>
        )}

        {/* ════════════════════════════════════════════════════════
            BLOCK 1: ¿Qué depto estás evaluando?
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">¿Qué depto estás evaluando?</div>

          {/* Nombre del análisis */}
          <div>
            <FieldLabel htmlFor="nombreAnalisis">Nombre del análisis</FieldLabel>
            <input
              id="nombreAnalisis"
              type="text"
              placeholder="Ej: Depto Providencia 2D1B"
              value={form.nombreAnalisis}
              onChange={(e) => setField("nombreAnalisis", e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Comuna + Tipo row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Comuna */}
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
                className={inputClass}
              />
              {form.comuna && (
                <button
                  type="button"
                  onClick={() => { setField("comuna", ""); setComunaSearch(""); setComunaOpen(true); }}
                  className="absolute right-3 top-[34px] text-xs text-[var(--franco-text-muted)] hover:text-white/70"
                >✕</button>
              )}
              {comunaOpen && !form.comuna && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-lg">
                  {filteredComunas.length === 0 ? (
                    <div className="p-3 text-sm text-[var(--franco-text-secondary)]">No encontrada</div>
                  ) : (
                    filteredComunas.map((c) => (
                      <button
                        key={c.comuna} type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--franco-text)] hover:bg-[var(--franco-border)]"
                        onClick={() => {
                          setField("comuna", c.comuna);
                          setComunaSearch("");
                          setComunaOpen(false);
                        }}
                      >
                        <span>{c.comuna}</span>
                        <span className="text-xs text-[var(--franco-text-muted)]">{c.ciudad}, {c.region}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Tipo: Usado / Nuevo */}
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setField("tipoPropiedad", "usado"); setField("estadoVenta", "inmediata"); }}
                  className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                    form.tipoPropiedad === "usado"
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >Usado</button>
                <button
                  type="button"
                  onClick={() => { setField("tipoPropiedad", "nuevo"); setField("estadoVenta", "inmediata"); setField("antiguedad", "0-2"); }}
                  className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                    form.tipoPropiedad === "nuevo"
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >Nuevo</button>
              </div>
            </div>
          </div>

          {/* Banner: comuna fuera del Gran Santiago */}
          {form.comuna && !COMUNAS_GRAN_SANTIAGO.includes(form.comuna) && (
            <div className="rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-4 py-3">
              <p className="font-body text-[12px] text-[#FBBF24]">
                Franco está optimizado para el Gran Santiago. Los datos de mercado, plusvalía histórica y cercanía a metro pueden no estar disponibles para esta comuna. El análisis será menos preciso.
              </p>
            </div>
          )}

          {/* Dirección */}
          <div>
            <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
            <input
              ref={direccionInputRef}
              id="direccion"
              type="text"
              placeholder="Ej: Av Providencia 1234"
              value={form.direccion}
              onChange={(e) => setField("direccion", e.target.value)}
              className={inputClass}
            />
            {geoLoading && (
              <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">Geocodificando...</p>
            )}
            {geoLat && geoLng && !geoLoading && (
              <p className="mt-1 font-body text-[10px] text-[var(--franco-positive)]">Dirección georeferenciada</p>
            )}
          </div>

          {/* Map + Indicator + Radio */}
          {geoLat && geoLng && (
            <div className="space-y-3">
              {(() => {
                const arriendosCount = filteredInRadius || totalInRadius;
                const ventasCount = ventaRef?.filteredInRadius || 0;
                const totalComparables = arriendosCount + ventasCount;
                const minCount = Math.min(arriendosCount, ventasCount);
                const condicionLabel = form.tipoPropiedad === "nuevo" ? "ventas nuevas" : "ventas usadas";
                const dormLabel = form.dormitorios ? ` · de ${form.dormitorios} dorm` : "";
                const allNearby = [...nearbyProperties, ...(ventaRef?.nearbyProperties || [])];
                return (
                  <>
                    <GoogleMapRadius
                      lat={geoLat!}
                      lng={geoLng!}
                      radiusMeters={radius}
                      comuna={form.comuna}
                      nearbyProperties={allNearby}
                    />

                    {/* Indicador de datos + slider de radio */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-lg font-bold text-[var(--franco-text)]">{totalComparables}</span>
                        <div>
                          <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">comparables en {radius}m</div>
                          <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
                            {arriendosCount} arriendos · {ventasCount} {condicionLabel}{dormLabel}
                          </div>
                        </div>
                      </div>
                      <div className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${
                        minCount >= 20 ? 'bg-[#B0BEC5]/10 text-[var(--franco-positive)]' :
                        minCount >= 10 ? 'bg-[var(--franco-text)]/10 text-[var(--franco-text)]' :
                        minCount >= 5 ? 'bg-[#C8323C]/10 text-[#C8323C]' :
                        'bg-[var(--franco-text-muted)]/10 text-[var(--franco-text-muted)]'
                      }`}>
                        {minCount >= 20 ? 'Robustos' :
                         minCount >= 10 ? 'Suficientes' :
                         minCount >= 5 ? 'Limitados' :
                         'Pocos datos'}
                      </div>
                    </div>

                    {/* Progress bar under indicator */}
                    <div className="mt-2 h-1 bg-[var(--franco-border)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          minCount >= 20 ? 'bg-[#B0BEC5]' :
                          minCount >= 10 ? 'bg-[var(--franco-text)]' :
                          minCount >= 5 ? 'bg-[#C8323C]' :
                          'bg-[var(--franco-text-muted)]'
                        }`}
                        style={{ width: `${Math.min(minCount / 20 * 100, 100)}%` }}
                      />
                    </div>
                  </>
                );
              })()}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="font-body text-[12px] text-[var(--franco-text-muted)]">Radio</span>
                    <InfoTooltip content="Franco busca propiedades similares dentro de este radio para sugerir precios de mercado." />
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-[var(--franco-text)]">{radius}m</span>
                </div>
                <input
                  type="range" min={300} max={2000} step={100}
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full accent-[#C8323C]"
                />
              </div>
            </div>
          )}

          {/* Characteristics row — 5 compact columns */}
          <div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {/* m² */}
              <div>
                <div className="flex items-center gap-0.5 mb-1">
                  <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">m²</label>
                  <InfoTooltip content={TIPS.superficie} />
                </div>
                <input
                  id="superficieUtil"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="55"
                  value={form.superficieUtil}
                  onChange={(e) => setField("superficieUtil", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              {/* Dorm. */}
              <div>
                <div className="flex items-center gap-0.5 mb-1">
                  <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Dorm.</label>
                  <InfoTooltip content={TIPS.dormitorios} />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={6}
                  placeholder="2"
                  value={form.dormitorios}
                  onChange={(e) => setField("dormitorios", e.target.value)}
                  className={inputClass}
                />
              </div>
              {/* Baños */}
              <div>
                <div className="flex items-center gap-0.5 mb-1">
                  <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Baños</label>
                  <InfoTooltip content={TIPS.banos} />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={4}
                  placeholder="1"
                  value={form.banos}
                  onChange={(e) => setField("banos", e.target.value)}
                  className={inputClass}
                />
              </div>
              {/* Estac. */}
              <div className="max-sm:col-span-1">
                <div className="flex items-center gap-0.5 mb-1">
                  <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Estac.</label>
                  <InfoTooltip content={TIPS.estacionamiento} />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5}
                  placeholder="0"
                  value={form.estacionamiento}
                  onChange={(e) => setField("estacionamiento", e.target.value)}
                  className={inputClass}
                />
              </div>
              {/* Bodega */}
              <div className="max-sm:col-span-1">
                <div className="flex items-center gap-0.5 mb-1">
                  <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Bodega</label>
                  <InfoTooltip content={TIPS.bodega} />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={3}
                  placeholder="0"
                  value={form.bodega}
                  onChange={(e) => setField("bodega", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Antigüedad (solo para tipo usado) */}
            {form.tipoPropiedad === "usado" && (
              <div>
                <FieldLabel tip={TIPS.antiguedad}>Antigüedad</FieldLabel>
                <div className="relative">
                  <select
                    value={form.antiguedad}
                    onChange={(e) => setField("antiguedad", e.target.value)}
                    className="flex h-10 w-full appearance-none rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-[13px] text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none"
                  >
                    <option value="0-2" className="bg-[var(--franco-card)] text-[var(--franco-text)]">0-2 años (nuevo)</option>
                    <option value="3-5" className="bg-[var(--franco-card)] text-[var(--franco-text)]">3-5 años</option>
                    <option value="6-10" className="bg-[var(--franco-card)] text-[var(--franco-text)]">6-10 años</option>
                    <option value="11-20" className="bg-[var(--franco-card)] text-[var(--franco-text)]">11-20 años</option>
                    <option value="20+" className="bg-[var(--franco-card)] text-[var(--franco-text)]">20+ años</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 2: ¿Cuánto cuesta y genera?
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4 mt-3">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">¿Cuánto cuesta y genera?</div>

          {/* Valor de mercado estimado */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Valor de mercado ({fieldCurrency.valorMercado === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content="Precio al que se venden deptos similares en la zona. Se pre-rellena con datos del mercado. Si crees que vale más o menos, ajústalo." />
              </div>
              {suggestions && suggestions.precioSugeridoUF > 0 && !form.valorMercado && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, valorMercado: "UF" }));
                    setField("valorMercado", String(suggestions.precioSugeridoUF));
                  }}
                >
                  Usar sugerencia: {fmtUF(suggestions.precioSugeridoUF)}{ventaRef && ventaRef.sampleSize > 0 ? <span className="text-[var(--franco-text-muted)]"> · sobre {ventaRef.sampleSize} deptos {form.tipoPropiedad === "nuevo" ? "nuevos" : "usados"}</span> : null} ↗
                </span>
              )}
            </div>
            <MoneyInput
              id="valorMercado"
              value={form.valorMercado}
              onChange={(v) => setField("valorMercado", v)}
              placeholder={suggestions?.precioSugeridoUF ? String(suggestions.precioSugeridoUF) : "5.000"}
              currency={fieldCurrency.valorMercado}
              onCurrencyToggle={() => toggleFieldCurrency("valorMercado")}
            />
            {!form.valorMercado && (
              <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">Si lo dejas vacío, se asume igual al precio de compra.</p>
            )}
          </div>

          {/* Precio de compra */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Precio de compra ({fieldCurrency.precio === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content={TIPS.precio} />
              </div>
              {suggestions && suggestions.precioSugeridoUF > 0 && !form.precio && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, precio: "UF" }));
                    setField("precio", String(suggestions.precioSugeridoUF));
                  }}
                >
                  Sugerencia: {fmtUF(suggestions.precioSugeridoUF)}{ventaRef && ventaRef.sampleSize > 0 ? <span className="text-[var(--franco-text-muted)]"> · sobre {ventaRef.sampleSize} deptos {form.tipoPropiedad === "nuevo" ? "nuevos" : "usados"}</span> : null} ↗
                </span>
              )}
            </div>
            <MoneyInput
              id="precio"
              value={form.precio}
              onChange={(v) => setField("precio", v)}
              placeholder={fieldCurrency.precio === "UF" ? "3.200" : "124.160.000"}
              currency={fieldCurrency.precio}
              onCurrencyToggle={() => toggleFieldCurrency("precio")}
              required
            />
            {/* Ref text (muted, not clickable) */}
            {suggestions && suggestions.precioM2VentaUF > 0 && (
              <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                Ref: {fmtUF(suggestions.precioM2VentaUF)}/m² en la zona
              </p>
            )}
            {calc.precioUF > 0 && (
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                {fieldCurrency.precio === "UF" ? fmtCLP(calc.precioCLP) : fmtUF(calc.precioUF)}
                {calc.precioM2 > 0 && <> · {fmtUF(calc.precioM2)}/m²</>}
              </p>
            )}
            {(() => {
              const vm = Number(form.valorMercado) || 0;
              const pc = calc.precioUF;
              if (vm <= 0 || pc <= 0) return null;
              const diff = vm - pc;
              const pct = Math.abs(diff / vm * 100);
              if (pct < 2) return <p className="mt-1 text-xs text-[var(--franco-text-muted)]">Precio alineado con el mercado</p>;
              if (diff > 0) return <p className="mt-1 text-xs text-[var(--franco-positive)]">Pasada: {fmtUF(diff)} bajo mercado ({pct.toFixed(1).replace(".",",")}% descuento)</p>;
              return <p className="mt-1 text-xs text-[#C8323C]">Sobreprecio: {fmtUF(Math.abs(diff))} sobre mercado ({pct.toFixed(1).replace(".",",")}% extra)</p>;
            })()}
          </div>

          {/* Entrega (solo si tipo=Nuevo) */}
          <div
            style={{
              maxHeight: form.tipoPropiedad === "nuevo" ? 600 : 0,
              opacity: form.tipoPropiedad === "nuevo" ? 1 : 0,
              overflow: "hidden",
              transition: "all 0.3s ease",
            }}
          >
            <div className="rounded-[10px] p-4 space-y-3" style={{ background: "var(--franco-card)", border: "1px solid var(--franco-border)" }}>
              <div>
                <FieldLabel>Entrega</FieldLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setField("estadoVenta", "inmediata"); setField("cuotasPie", "1"); cuotasModificadaRef.current = false; }}
                    className="flex-1 rounded-lg px-3 py-2 font-body text-[13px] text-center transition-all"
                    style={form.estadoVenta === "inmediata"
                      ? { border: "1px solid var(--franco-text)", color: "var(--franco-text)", fontWeight: 500 }
                      : { border: "1px solid var(--franco-border)", color: "var(--franco-text-muted)" }}
                  >Inmediata</button>
                  <button
                    type="button"
                    onClick={() => { setField("estadoVenta", "futura"); cuotasModificadaRef.current = false; }}
                    className="flex-1 rounded-lg px-3 py-2 font-body text-[13px] text-center transition-all"
                    style={form.estadoVenta === "futura"
                      ? { border: "1px solid var(--franco-text)", color: "var(--franco-text)", fontWeight: 500 }
                      : { border: "1px solid var(--franco-border)", color: "var(--franco-text-muted)" }}
                  >Futura (verde/blanco)</button>
                </div>
              </div>

              {/* Fecha entrega (solo futura) */}
              <div
                style={{
                  maxHeight: form.estadoVenta === "futura" ? 100 : 0,
                  opacity: form.estadoVenta === "futura" ? 1 : 0,
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FieldLabel>Mes entrega</FieldLabel>
                    <select
                      value={form.fechaEntregaMes}
                      onChange={(e) => { setField("fechaEntregaMes", e.target.value); cuotasModificadaRef.current = false; }}
                      className="flex h-10 w-full appearance-none rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-[13px] text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none"
                    >
                      <option value="" className="bg-[var(--franco-card)] text-[var(--franco-text)]">Mes...</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, "0")} className="bg-[var(--franco-card)] text-[var(--franco-text)]">
                          {new Date(2000, i).toLocaleString("es-CL", { month: "long" })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-[var(--franco-text-muted)]" />
                  </div>
                  <div className="relative">
                    <FieldLabel>Año entrega</FieldLabel>
                    <select
                      value={form.fechaEntregaAnio}
                      onChange={(e) => { setField("fechaEntregaAnio", e.target.value); cuotasModificadaRef.current = false; }}
                      className="flex h-10 w-full appearance-none rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-[13px] text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none"
                    >
                      <option value="" className="bg-[var(--franco-card)] text-[var(--franco-text)]">Año...</option>
                      {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                        <option key={y} value={String(y)} className="bg-[var(--franco-card)] text-[var(--franco-text)]">{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-[var(--franco-text-muted)]" />
                  </div>
                </div>
              </div>

              {/* Pie + Cuotas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Pie ({form.piePct}%)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      value={form.piePct}
                      onChange={(e) => setField("piePct", e.target.value)}
                      className={inputClass + " w-20"}
                    />
                    {calc.precioUF > 0 && parseFloat(form.piePct) > 0 && (
                      <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">
                        {fmtUF(calc.pieUF)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="cuotasPie">Cuotas del pie</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      id="cuotasPie"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      placeholder={form.estadoVenta === "futura" ? "24" : "1"}
                      value={form.cuotasPie}
                      onChange={(e) => { setField("cuotasPie", e.target.value); cuotasModificadaRef.current = true; }}
                      className={inputClass + " w-20"}
                    />
                    {calc.pieUF > 0 && Number(form.cuotasPie) > 0 && (
                      <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">
                        {Number(form.cuotasPie) === 1 ? "1 cuota" : `${form.cuotasPie} cuotas`} de {fmtUF(Math.round((calc.pieUF / Number(form.cuotasPie)) * 10) / 10)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {form.estadoVenta === "inmediata" && (
                <p className="text-[11px]" style={{ color: "var(--franco-text-muted)" }}>
                  Default: 1 cuota (pago completo). Modifica si la inmobiliaria ofrece cuotas.
                </p>
              )}
              {form.estadoVenta === "futura" && form.fechaEntregaMes && form.fechaEntregaAnio && (
                <p className="text-[11px]" style={{ color: "var(--franco-text-muted)" }}>
                  {(() => {
                    const now = new Date();
                    const entrega = new Date(Number(form.fechaEntregaAnio), Number(form.fechaEntregaMes) - 1);
                    const meses = Math.max(0, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
                    return `${meses} meses hasta entrega. Pie se divide en cuotas mensuales.`;
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Arriendo mensual ($) */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Arriendo mensual ({fieldCurrency.arriendo === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content={TIPS.arriendo} />
              </div>
              {suggestions?.arriendo && !form.arriendo && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, arriendo: "CLP" }));
                    setField("arriendo", String(suggestions.arriendo));
                  }}
                >
                  Sugerencia: {fmtCLP(suggestions.arriendo)}{suggestionSampleSize > 0 && <span className="text-[var(--franco-text-muted)]"> · sobre {suggestionSampleSize} deptos</span>} ↗
                </span>
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
            {suggestions && suggestions.precioM2Arriendo > 0 && (
              <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                Ref: {fmtCLP(suggestions.precioM2Arriendo)}/m² mes en la zona
              </p>
            )}
            {form.arriendo && Number(form.arriendo) > 0 && (
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                {fieldCurrency.arriendo === "UF"
                  ? fmtCLP(Number(form.arriendo) * UF_CLP)
                  : fmtUF(Number(form.arriendo) / UF_CLP)
                }/mes
              </p>
            )}
          </div>

          {/* Arriendo estacionamiento/bodega — solo si hay al menos 1 */}
          {(Number(form.estacionamiento) > 0 || Number(form.bodega) > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {Number(form.estacionamiento) > 0 && (
                <div>
                  <FieldLabel>Arriendo estac. ({fieldCurrency.arriendoEstac === "UF" ? "UF" : "$"}/mes)</FieldLabel>
                  <MoneyInput
                    id="arriendoEstac"
                    value={form.arriendoEstac}
                    onChange={(v) => setField("arriendoEstac", v)}
                    placeholder={fieldCurrency.arriendoEstac === "UF" ? "1" : "40.000"}
                    currency={fieldCurrency.arriendoEstac}
                    onCurrencyToggle={() => toggleFieldCurrency("arriendoEstac")}
                  />
                  {!form.arriendoEstac && (
                    <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">Ref: ~$40.000/mes por estacionamiento</p>
                  )}
                </div>
              )}
              {Number(form.bodega) > 0 && (
                <div>
                  <FieldLabel>Arriendo bodega ({fieldCurrency.arriendoBodega === "UF" ? "UF" : "$"}/mes)</FieldLabel>
                  <MoneyInput
                    id="arriendoBodega"
                    value={form.arriendoBodega}
                    onChange={(v) => setField("arriendoBodega", v)}
                    placeholder={fieldCurrency.arriendoBodega === "UF" ? "0,4" : "15.000"}
                    currency={fieldCurrency.arriendoBodega}
                    onCurrencyToggle={() => toggleFieldCurrency("arriendoBodega")}
                  />
                  {!form.arriendoBodega && (
                    <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">Ref: ~$15.000/mes por bodega</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Gastos comunes ($) */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Gastos comunes ({fieldCurrency.gastos === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content={TIPS.gastos} />
              </div>
              {suggestions?.gastos && !form.gastos && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, gastos: "CLP" }));
                    setField("gastos", String(suggestions.gastos));
                  }}
                >
                  Sugerencia: {fmtCLP(suggestions.gastos)}{suggestionSampleSize > 0 && <span className="text-[var(--franco-text-muted)]"> · sobre {suggestionSampleSize} deptos</span>} ↗
                </span>
              )}
            </div>
            <MoneyInput
              id="gastos"
              value={form.gastos}
              onChange={(v) => setField("gastos", v)}
              placeholder="Ej: 80.000"
              currency={fieldCurrency.gastos}
              onCurrencyToggle={() => toggleFieldCurrency("gastos")}
            />
            {!form.gastos && !suggestions?.gastos && parseNum(form.superficieUtil) > 0 && (
              <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                Referencia: $1.500-2.500 por m² mensual. Un depto de {form.superficieUtil}m² paga aprox {fmtCLP(parseNum(form.superficieUtil) * 1500)}-{fmtCLP(parseNum(form.superficieUtil) * 2500)}
              </p>
            )}
          </div>

          {/* Contribuciones trimestrales ($) */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Contribuciones trimestrales ({fieldCurrency.contribuciones === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content={TIPS.contribuciones} />
              </div>
              {(suggestions?.contribuciones ?? 0) > 0 && !form.contribuciones && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, contribuciones: "CLP" }));
                    setField("contribuciones", String(suggestions!.contribuciones));
                  }}
                >
                  Sugerencia: {fmtCLP(suggestions!.contribuciones)} ↗
                </span>
              )}
            </div>
            <MoneyInput
              id="contribuciones"
              value={form.contribuciones}
              onChange={(v) => setField("contribuciones", v)}
              placeholder={suggestions?.contribuciones ? fmtInput(suggestions.contribuciones) : "Ej: 120.000"}
              currency={fieldCurrency.contribuciones}
              onCurrencyToggle={() => toggleFieldCurrency("contribuciones")}
            />
            {!form.contribuciones && (
              <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                {(suggestions?.contribuciones ?? 0) > 0
                  ? <>Estimación SII (tasas 0,93%-1,09%). Para dato exacto, consulta con tu ROL en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a></>
                  : suggestions?.contribuciones === 0
                    ? <>Estimación: $0 (posible exención DFL-2 por bajo avalúo fiscal). Consulta con tu ROL en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a></>
                    : <>Consultar en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a> con el ROL de la propiedad</>
                }
              </p>
            )}
          </div>

          {/* Vacancia + Administración */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel tip={TIPS.vacanciaMeses}>Vacancia: {form.vacanciaPct}%</FieldLabel>
              <input
                type="range" min={0} max={25} step={1}
                value={form.vacanciaPct}
                onChange={(e) => setField("vacanciaPct", e.target.value)}
                className="w-full accent-[#C8323C]"
              />
              <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">{`≈ ${(parseFloat(form.vacanciaPct) * 12 / 100).toFixed(1)} meses/año`}</p>
            </div>
            <div>
              <FieldLabel tip="Comisión si contratas administrador de arriendo. En 0% se desactiva.">Administración: {form.adminPct}%</FieldLabel>
              <input
                type="range" min={0} max={15} step={1}
                value={form.adminPct}
                onChange={(e) => setField("adminPct", e.target.value)}
                className="w-full accent-[#C8323C]"
              />
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                {parseFloat(form.adminPct) > 0
                  ? (Number(form.arriendo) || 0) > 0
                    ? `${fmtCLP(Math.round(toCLP("arriendo", Number(form.arriendo) || 0) * parseFloat(form.adminPct) / 100))}/mes`
                    : "Ingresa el arriendo para calcular"
                  : "Sin administrador"}
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 3: Financiamiento (SectionCard, collapsed)
            ════════════════════════════════════════════════════════ */}
        <div className="mt-3">
          <SectionCard
            title="FINANCIAMIENTO"
            subtitle={`Crédito a ${form.plazoCredito} años · tasa ${form.tasaInteres.replace(".", ",")}% · pie ${form.piePct}%`}
            defaultOpen={false}
            forceOpen={sectionsForceOpen}
            summary={`${form.plazoCredito}a, ${form.tasaInteres.replace(".", ",")}%, pie ${form.piePct}%`}
          >
            {/* Pie slider */}
            <div>
              <FieldLabel htmlFor="piePct" tip={TIPS.piePct}>Pie: {form.piePct}%</FieldLabel>
              <input
                id="piePct" type="range" min="10" max="50" step="5"
                value={form.piePct}
                onChange={(e) => setField("piePct", e.target.value)}
                className="mt-1 w-full accent-[#C8323C]"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between font-mono text-xs text-[var(--franco-text-muted)]">
                <span>{fmtUF(calc.pieUF)} ({fmtCLP(calc.pieCLP)})</span>
                <span>Financiamiento: {calc.financiamientoPct}%</span>
              </div>
            </div>

            {/* Plazo slider */}
            <div>
              <FieldLabel htmlFor="plazoCredito" tip={TIPS.plazoCredito}>Plazo crédito: {form.plazoCredito} años</FieldLabel>
              <input
                id="plazoCredito" type="range" min="10" max="30" step="5"
                value={form.plazoCredito}
                onChange={(e) => setField("plazoCredito", e.target.value)}
                className="mt-1 w-full accent-[#C8323C]"
                style={{ height: "44px" }}
              />
              <div className="flex justify-between font-mono text-xs text-[var(--franco-text-muted)]">
                <span>10 años</span><span>30 años</span>
              </div>
            </div>

            {/* Tasa input — accepts comma as decimal separator */}
            <div>
              <FieldLabel htmlFor="tasaInteres" tip={TIPS.tasaInteres}>Tasa interés anual (%)</FieldLabel>
              <input
                id="tasaInteres"
                type="text"
                inputMode="decimal"
                placeholder={tasaRef.value.replace(".", ",")}
                value={form.tasaInteres.replace(".", ",")}
                onChange={(e) => {
                  // Store with dot internally, display with comma
                  const val = e.target.value.replace(",", ".");
                  setField("tasaInteres", val);
                  tasaModificadaRef.current = true;
                }}
                required
                className={inputClass}
              />
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                Mercado actual: ~{tasaRef.value.replace(".", ",")}%
                {tasaRef.updated_at && ` (act. ${new Date(tasaRef.updated_at).toLocaleDateString("es-CL")})`}
              </p>
              {/* Subsidio a la Tasa (Ley 21.748) */}
              {(() => {
                const tasaMercado = parseFloat(tasaRef.value) || 4.1;
                const rebajaSubsidio = 0.6;
                const tasaConSubsidio = Math.round((tasaMercado - rebajaSubsidio) * 10) / 10;
                const califica = form.tipoPropiedad === "nuevo" && calc.precioUF > 0 && calc.precioUF <= 4000;
                return (
                  <div
                    style={{
                      maxHeight: califica ? 200 : 0,
                      opacity: califica ? 1 : 0,
                      overflow: "hidden",
                      transition: "all 0.3s ease",
                      marginTop: califica ? 8 : 0,
                    }}
                  >
                    <div
                      className="rounded-lg p-3"
                      style={{ background: "rgba(200,50,60,0.06)", border: "1px solid rgba(200,50,60,0.2)" }}
                    >
                      <p className="text-[13px] font-semibold text-[var(--franco-text)]">🏛️ Tu depto podría calificar al Subsidio a la Tasa</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--franco-text-secondary)" }}>
                        La Ley 21.748 rebaja la tasa hipotecaria en ~0,6% para viviendas nuevas ≤ 4.000 UF.
                      </p>
                      <p className="mt-1.5 text-xs" style={{ color: "var(--franco-text-secondary)" }}>
                        Tasa promedio: {tasaMercado.toFixed(1).replace(".", ",")}% <span style={{ color: "var(--franco-text-muted)" }}>→</span> Con subsidio: <span style={{ color: "#C8323C", fontWeight: 600 }}>~{tasaConSubsidio.toFixed(1).replace(".", ",")}%</span>
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { setField("tasaInteres", String(tasaConSubsidio)); tasaModificadaRef.current = true; }}
                          className="text-xs font-medium text-[var(--franco-text)] underline underline-offset-2 hover:text-[var(--franco-text)]"
                        >
                          Usar {tasaConSubsidio.toFixed(1).replace(".", ",")}%
                        </button>
                        <span className="text-[11px]" style={{ color: "var(--franco-text-muted)" }}>Vigente hasta mayo 2027</span>
                      </div>
                      <p className="mt-1.5 text-[11px]" style={{ color: "var(--franco-text-muted)" }}>
                        Requisitos: primera vivienda, promesa desde 2025.{" "}
                        <a href="https://www.minvu.gob.cl/nuevo-subsidio-al-credito-hipotecario/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--franco-text-secondary)]">
                          Más info
                        </a>
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {calc.dividendo > 0 && (
              <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Dividendo estimado</span>
                  <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmtCLP(calc.dividendo)}/mes</span>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ════════════════════════════════════════════════════════
            SUBMIT BUTTON (inline)
            ════════════════════════════════════════════════════════ */}
        <div className="mt-5">
          <button
            type="button"
            disabled={loading || !canSubmit}
            onClick={() => handleSubmit()}
            className="w-full py-3.5 rounded-xl bg-[#C8323C] text-white font-body text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-[#B02A34] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Preparando resumen...</>
            ) : (
              <>Siguiente →</>
            )}
          </button>
          <p className="text-center font-body text-[11px] text-[var(--franco-text-muted)] mt-2">
            {!canSubmit ? `Faltan: ${progress.missing.join(", ")}` : "Revisa tu resumen antes de analizar"}
          </p>
        </div>
      </>)}
      </div>
    </div>
  );
}
