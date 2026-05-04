"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
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
import { getCostosDefault, AMOBLAMIENTO_DEFAULT } from "@/lib/engines/short-term-engine";

const UF_CLP_FALLBACK = 38800;

const COMUNAS_GRAN_SANTIAGO = ["Santiago Centro","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];

// ─── Formatting helpers ──────────────────────────────
function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function fmtInput(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("es-CL");
}

function calcDividendo(creditoCLP: number, tasaAnualPct: number, plazoAnos: number): number {
  if (creditoCLP <= 0) return 0;
  const tasaMensual = tasaAnualPct / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(creditoCLP / n);
  return Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

// ─── Field tooltips ──────────────────────────────────
const TIPS: Record<string, string> = {
  superficie: "Superficie útil del departamento en metros cuadrados.",
  dormitorios: "Cantidad de dormitorios. Studio = 0.",
  banos: "Cantidad de baños completos.",
  capacidad: "Máximo de huéspedes que permite tu departamento.",
  precio: "Precio de compra del departamento.",
  piePct: "Porcentaje del precio que pagas al contado.",
  tasaInteres: "Tasa de interés anual del crédito hipotecario.",
  plazoCredito: "Duración del crédito hipotecario en años.",
  modoGestion: "Auto-gestión: tú te encargas de todo. Airbnb cobra 3%. Con administrador: un operador gestiona huéspedes, limpieza y check-in/out.",
  comisionAdmin: "Comisión del administrador sobre el ingreso bruto. Típicamente 15-25%.",
  edificioAirbnb: "Algunos edificios prohíben Airbnb en su Reglamento de Copropiedad.",
  electricidad: "Consumo eléctrico mensual promedio. En Airbnb el dueño paga la luz.",
  agua: "Consumo de agua mensual promedio.",
  wifi: "Internet fijo mensual. Esencial para Airbnb.",
  insumos: "Sábanas, toallas, amenities, café, papel higiénico, etc.",
  gastosComunes: "Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia).",
  mantencion: "Reposición de artículos, reparaciones menores, reemplazo de equipamiento.",
  amoblamiento: "Incluye muebles, electrodomésticos, decoración, ropa de cama, menaje de cocina.",
  contribuciones: "Impuesto territorial. Se paga 4 veces al año.",
  arriendoLargo: "¿Cuánto arrendarías este depto en arriendo tradicional? Franco lo compara con la renta corta.",
};

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

function MoneyInput({
  id, value, onChange, placeholder, currency, onCurrencyToggle, required,
}: {
  id: string; value: string; onChange: (raw: string) => void; placeholder?: string;
  currency?: "CLP" | "UF"; onCurrencyToggle?: () => void; required?: boolean;
}) {
  const [display, setDisplay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);
  const isUF = currency === "UF";

  useEffect(() => {
    if (isFocused.current) return;
    if (!value) { setDisplay(""); return; }
    const num = Number(value) || 0;
    if (num === 0) { setDisplay(""); return; }
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
  }, [value, isUF]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
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

const LS_KEY = "franco_draft_renta_corta";
const GUEST_LS_KEY = "franco_guest_analysis_str";

// ─── Main Form ───────────────────────────────────────

export default function RentaCortaFormPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestBlocked, setGuestBlocked] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const formInitialized = useRef(false);
  const direccionInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Geocoding state
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radius, setRadius] = useState(800);
  const geocodeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const geoSourceRef = useRef<"autocomplete" | "manual" | null>(null);

  const [nearbyProperties, setNearbyProperties] = useState<{ lat: number; lng: number }[]>([]);
  const [totalInRadius, setTotalInRadius] = useState(0);
  const [filteredInRadius, setFilteredInRadius] = useState(0);
  const [suggestionSampleSize, setSuggestionSampleSize] = useState(0);

  // Arriendo largo suggestion from market data
  const [apiSuggestions, setApiSuggestions] = useState<{
    arriendo: number;
    source: string;
    sampleSize: number;
    precioM2?: number;
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

  // Fetch real UF value + tasa on mount
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

  // Per-field currency toggles
  const [fieldCurrency, setFieldCurrency] = useState<Record<string, "CLP" | "UF">>({
    precio: "UF", arriendoLargo: "CLP", contribuciones: "CLP",
  });
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
        if (!editedInUF[field] && originalCLP[field]) {
          return { ...f, [field]: String(originalCLP[field]) };
        }
        return { ...f, [field]: String(Math.round(raw * uf)) };
      } else {
        setOriginalCLP((prev) => ({ ...prev, [field]: raw }));
        setEditedInUF((prev) => ({ ...prev, [field]: false }));
        return { ...f, [field]: String(Math.round((raw / uf) * 100) / 100) };
      }
    });
    setFieldCurrency((prev) => ({ ...prev, [field]: newCurrency }));
  }, [UF_CLP, fieldCurrency, originalCLP, editedInUF]);

  // ─── Form state ────────────────────────────────────
  const [form, setForm] = useState({
    // Propiedad
    direccion: "",
    comuna: "",
    dormitorios: "1",
    banos: "1",
    superficieUtil: "",
    capacidadHuespedes: "2",
    tipoPropiedad: "usado",
    estadoVenta: "inmediata" as "inmediata" | "futura",
    mesesEntrega: "12",
    cuotasPie: "1",

    // Financiamiento
    precio: "",
    piePct: "20",
    tasaInteres: "4.72",
    plazoCredito: "25",

    // Gestión
    modoGestion: "auto" as "auto" | "administrador",
    comisionAdministrador: "20",
    edificioPermiteAirbnb: "no_seguro" as "si" | "no" | "no_seguro",

    // Costos operativos (pre-filled by dormitorios)
    costoElectricidad: "35000",
    costoAgua: "8000",
    costoWifi: "22000",
    costoInsumos: "20000",
    gastosComunes: "",
    mantencion: "11000",
    contribuciones: "",

    // Amoblamiento
    estaAmoblado: false as boolean,
    costoAmoblamiento: "3500000",

    // Comparativa
    arriendoLargo: "",
  });

  // Track which cost fields user has manually edited
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  const setField = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldCurrency[field] === "UF") {
      setEditedInUF((prev) => ({ ...prev, [field]: true }));
    }
  }, [fieldCurrency]);

  const setFieldWithEdit = useCallback((field: string, value: string) => {
    setField(field, value);
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  }, [setField]);

  // ─── Update cost defaults when dormitorios changes ──
  useEffect(() => {
    const dorm = Number(form.dormitorios) || 1;
    const defaults = getCostosDefault(dorm);
    const key = String(Math.min(dorm, 3));
    const amob = AMOBLAMIENTO_DEFAULT[key] ?? AMOBLAMIENTO_DEFAULT["1"];

    setForm((prev) => {
      const updates: Partial<typeof prev> = {};
      if (!userEdited.costoElectricidad) updates.costoElectricidad = String(defaults.costoElectricidad);
      if (!userEdited.costoAgua) updates.costoAgua = String(defaults.costoAgua);
      if (!userEdited.costoWifi) updates.costoWifi = String(defaults.costoWifi);
      if (!userEdited.costoInsumos) updates.costoInsumos = String(defaults.costoInsumos);
      if (!userEdited.mantencion) updates.mantencion = String(defaults.mantencion);
      if (!userEdited.costoAmoblamiento) updates.costoAmoblamiento = String(amob);
      return { ...prev, ...updates };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dormitorios]);

  // ─── Auto-fill gastos comunes from superficie ──────
  useEffect(() => {
    if (userEdited.gastosComunes) return;
    const sup = parseNum(form.superficieUtil);
    if (sup > 0) {
      setForm((prev) => ({ ...prev, gastosComunes: String(Math.round(sup * 1200)) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.superficieUtil]);

  // ─── Auto-suggest cuotas from meses entrega ────────
  useEffect(() => {
    if (cuotasModificadaRef.current) return;
    const meses = Number(form.mesesEntrega) || 12;
    if (form.estadoVenta === "futura" && meses > 0) {
      setForm((prev) => ({ ...prev, cuotasPie: String(meses) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mesesEntrega, form.estadoVenta]);

  // ─── localStorage persistence ──────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && typeof draft === "object" && (draft.direccion || draft.comuna)) {
          setShowDraftBanner(true);
        }
      }
    } catch { /* ignore */ }
    formInitialized.current = true;
  }, []);

  useEffect(() => {
    if (!formInitialized.current) return;
    if (!form.direccion && !form.precio) return;
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

  // ─── Progress ─────────────────────────────────────
  const progress = useMemo(() => {
    const checks = [
      { label: "Dirección", done: !!form.direccion },
      { label: "Superficie", done: !!form.superficieUtil && parseNum(form.superficieUtil) > 0 },
      { label: "Precio", done: !!form.precio && parseNum(form.precio) > 0 },
      { label: "Arriendo largo plazo", done: !!form.arriendoLargo && parseNum(form.arriendoLargo) > 0 },
    ];
    const done = checks.filter((c) => c.done).length;
    const missing = checks.filter((c) => !c.done).map((c) => c.label);
    return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100), missing };
  }, [form.direccion, form.superficieUtil, form.precio, form.arriendoLargo]);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comunaRef.current && !comunaRef.current.contains(e.target as Node)) setComunaOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedComuna = useMemo(() => COMUNAS.find((c) => c.comuna === form.comuna), [form.comuna]);

  // ─── Fetch arriendo suggestion for LTR comparison ──
  useEffect(() => {
    if (!form.comuna) { setApiSuggestions(null); return; }
    const dorm = form.dormitorios || "0";
    const supUtil = parseNum(form.superficieUtil) || 0;
    const params = new URLSearchParams({
      comuna: form.comuna,
      superficie: String(supUtil > 0 ? supUtil : 50),
      dormitorios: dorm,
      radius: String(radius),
    });
    if (geoLat && geoLng) {
      params.set("lat", String(geoLat));
      params.set("lng", String(geoLng));
    }

    fetch(`/api/data/suggestions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTotalInRadius(d.totalInRadius || 0);
        setFilteredInRadius(d.filteredInRadius || 0);
        setSuggestionSampleSize(d.sampleSize || 0);
        setNearbyProperties(
          (d.nearbyProperties || []).filter((p: { lat: number; lng: number }) => p.lat && p.lng)
        );
        if (d.arriendo) {
          setApiSuggestions({
            arriendo: d.arriendo,
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
  }, [form.comuna, form.superficieUtil, form.dormitorios, geoLat, geoLng, radius]);

  // Arriendo largo suggestion
  const arriendoSugerido = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna || supUtil <= 0) return null;
    if (apiSuggestions) {
      const precioM2 = apiSuggestions.precioM2 ?? 0;
      return precioM2 > 0
        ? Math.round((precioM2 * supUtil) / 1000) * 1000
        : apiSuggestions.arriendo;
    }
    return Math.round(6000 * supUtil);
  }, [form.comuna, form.superficieUtil, apiSuggestions]);

  // ─── Geocoding when address changes ────────────────
  useEffect(() => {
    if (form.direccion && form.comuna) {
      if (geoSourceRef.current === "autocomplete") {
        geoSourceRef.current = null;
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
            .replace(/,?\s*\d{7}\s*$/, "")
            .trim();
          setField("direccion", clean);
        }

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

    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setField]);

  // ─── Computed values ──────────────────────────────
  const toCLP = useCallback((field: string, value: number) => {
    return fieldCurrency[field] === "UF" ? value * UF_CLP : value;
  }, [fieldCurrency, UF_CLP]);

  const calc = useMemo(() => {
    const precioUF = fieldCurrency.precio === "UF"
      ? (Number(form.precio) || 0)
      : (Number(form.precio) || 0) / UF_CLP;

    const precioCLP = precioUF * UF_CLP;
    const piePct = parseFloat(form.piePct) || 20;
    const plazo = parseFloat(form.plazoCredito) || 25;
    const tasa = parseFloat(form.tasaInteres) || parseFloat(tasaRef.value) || 4.72;

    const pieUF = precioUF * (piePct / 100);
    const pieCLP = pieUF * UF_CLP;
    const financiamientoPct = 100 - piePct;
    const creditoCLP = precioCLP * (1 - piePct / 100);
    const dividendo = calcDividendo(creditoCLP, tasa, plazo);
    const contribucionesAuto = estimarContribuciones(precioCLP, form.tipoPropiedad === "nuevo");

    return { precioUF, precioCLP, pieUF, pieCLP, financiamientoPct, dividendo, contribucionesAuto };
  }, [form.precio, form.piePct, form.plazoCredito, form.tasaInteres, form.tipoPropiedad, fieldCurrency.precio, UF_CLP, tasaRef.value]);

  // ─── Submit ────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    const supUtil = parseNum(form.superficieUtil) || 0;
    const precioCLP = calc.precioCLP;
    const precioUF = calc.precioUF;
    const arriendoLargoCLP = Math.round(toCLP("arriendoLargo", Number(form.arriendoLargo) || 0));
    const ciudad = selectedComuna?.ciudad || "Santiago";

    try {
      const res = await fetch("/api/analisis/short-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion: form.direccion,
          comuna: form.comuna,
          ciudad,
          dormitorios: Number(form.dormitorios) || 1,
          banos: Number(form.banos) || 1,
          superficieUtil: supUtil,
          capacidadHuespedes: Number(form.capacidadHuespedes) || 2,
          tipoPropiedad: form.tipoPropiedad,
          estadoVenta: form.tipoPropiedad === "nuevo" ? form.estadoVenta : "inmediata",
          mesesEntrega: form.tipoPropiedad === "nuevo" && form.estadoVenta === "futura" ? Number(form.mesesEntrega) || 12 : 0,
          cuotasPie: form.tipoPropiedad === "nuevo" && form.estadoVenta === "futura" ? Number(form.cuotasPie) || 1 : 1,

          precioCompra: Math.round(precioCLP),
          precioCompraUF: Math.round(precioUF * 100) / 100,
          piePct: parseFloat(form.piePct),
          tasaInteres: parseFloat(form.tasaInteres),
          plazoCredito: parseFloat(form.plazoCredito),

          modoGestion: form.modoGestion,
          comisionAdministrador: form.modoGestion === "administrador" ? parseFloat(form.comisionAdministrador) / 100 : 0.20,
          edificioPermiteAirbnb: form.edificioPermiteAirbnb,

          costoElectricidad: Number(form.costoElectricidad) || 0,
          costoAgua: Number(form.costoAgua) || 0,
          costoWifi: Number(form.costoWifi) || 0,
          costoInsumos: Number(form.costoInsumos) || 0,
          gastosComunes: Number(form.gastosComunes) || 0,
          mantencion: Number(form.mantencion) || 0,
          contribuciones: Math.round(toCLP("contribuciones", Number(form.contribuciones) || 0)) || calc.contribucionesAuto,

          estaAmoblado: form.estaAmoblado,
          costoAmoblamiento: form.estaAmoblado ? 0 : Number(form.costoAmoblamiento) || 0,

          arriendoLargoMensual: arriendoLargoCLP,

          valorUF: UF_CLP,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el análisis");
      }

      const data = await res.json();
      localStorage.removeItem(LS_KEY);
      if (!isLoggedIn) {
        localStorage.setItem(GUEST_LS_KEY, JSON.stringify({ id: data.id, timestamp: Date.now() }));
      }
      posthog?.capture("str_analysis_created", {
        comuna: form.comuna,
        dormitorios: form.dormitorios,
        modoGestion: form.modoGestion,
      });
      router.push(`/analisis/renta-corta/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  };

  // ─── Shared input class ────────────────────────────
  const inputClass = "flex h-9 w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2 font-body text-[13px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const selectClass = "flex h-10 w-full appearance-none rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-[13px] text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none";

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
        {/* Guest blocked */}
        {guestBlocked && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--franco-card)] flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-[var(--franco-positive)]" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[var(--franco-text)]">Ya hiciste tu análisis de renta corta gratis</h2>
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
          <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">Análisis de Renta Corta</h1>
          <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
            Evalúa si tu propiedad rinde más en Airbnb que en arriendo tradicional. <span className="font-mono">UF hoy: {fmtCLP(UF_CLP)}</span>
          </p>
        </div>

        {/* Draft banner */}
        {showDraftBanner && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">Tienes un análisis de renta corta sin terminar</span>
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

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700 mb-3">{error}</div>
        )}

        {/* ════════════════════════════════════════════════════════
            BLOCK 1: Ubicación y Propiedad
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">Ubicación y propiedad</div>

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
            <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">La dirección se usa para buscar comparables Airbnb en la zona.</p>
          </div>

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

          {/* Banner: comuna fuera del Gran Santiago */}
          {form.comuna && !COMUNAS_GRAN_SANTIAGO.includes(form.comuna) && (
            <div className="rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-4 py-3">
              <p className="font-body text-[12px] text-[#FBBF24]">
                Los datos de Airbnb están optimizados para el Gran Santiago. La estimación puede ser menos precisa fuera de esta zona.
              </p>
            </div>
          )}

          {/* Map */}
          {geoLat && geoLng && (
            <div className="space-y-3">
              <GoogleMapRadius
                lat={geoLat!}
                lng={geoLng!}
                radiusMeters={radius}
                comuna={form.comuna}
                nearbyProperties={nearbyProperties}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-lg font-bold text-[var(--franco-text)]">{totalInRadius || filteredInRadius}</span>
                  <div>
                    <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">comparables en {radius}m</div>
                    <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
                      arriendos similares en la zona
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="font-body text-[12px] text-[var(--franco-text-muted)]">Radio</span>
                    <InfoTooltip content="Franco busca propiedades similares dentro de este radio." />
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

          {/* Property characteristics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <div className="relative">
                <select
                  value={form.dormitorios}
                  onChange={(e) => setField("dormitorios", e.target.value)}
                  className={selectClass}
                >
                  <option value="0">Studio</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
              </div>
            </div>
            {/* Baños */}
            <div>
              <div className="flex items-center gap-0.5 mb-1">
                <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Baños</label>
                <InfoTooltip content={TIPS.banos} />
              </div>
              <div className="relative">
                <select
                  value={form.banos}
                  onChange={(e) => setField("banos", e.target.value)}
                  className={selectClass}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
              </div>
            </div>
            {/* Capacidad */}
            <div>
              <div className="flex items-center gap-0.5 mb-1">
                <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Huésp.</label>
                <InfoTooltip content={TIPS.capacidad} />
              </div>
              <div className="relative">
                <select
                  value={form.capacidadHuespedes}
                  onChange={(e) => setField("capacidadHuespedes", e.target.value)}
                  className={selectClass}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
              </div>
            </div>
          </div>

          {/* Tipo propiedad */}
          <div>
            <FieldLabel>Tipo de propiedad</FieldLabel>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setField("tipoPropiedad", "usado")}
                className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                  form.tipoPropiedad === "usado"
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                    : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                }`}
              >Usado</button>
              <button
                type="button"
                onClick={() => setField("tipoPropiedad", "nuevo")}
                className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                  form.tipoPropiedad === "nuevo"
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                    : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                }`}
              >Nuevo</button>
            </div>
          </div>

          {/* Entrega futura (solo si tipo=Nuevo) */}
          <div
            style={{
              maxHeight: form.tipoPropiedad === "nuevo" ? 400 : 0,
              opacity: form.tipoPropiedad === "nuevo" ? 1 : 0,
              overflow: "hidden",
              transition: "all 0.3s ease",
            }}
          >
            <div className="rounded-[10px] p-4 space-y-3" style={{ background: "var(--franco-card)", border: "1px solid var(--franco-border)" }}>
              <div>
                <FieldLabel>Estado de entrega</FieldLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setField("estadoVenta", "inmediata"); setField("cuotasPie", "1"); cuotasModificadaRef.current = false; }}
                    className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                      form.estadoVenta === "inmediata"
                        ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                        : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                    }`}
                  >Entrega inmediata</button>
                  <button
                    type="button"
                    onClick={() => { setField("estadoVenta", "futura"); cuotasModificadaRef.current = false; }}
                    className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                      form.estadoVenta === "futura"
                        ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                        : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                    }`}
                  >Entrega futura</button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: form.estadoVenta === "futura" ? 300 : 0,
                  opacity: form.estadoVenta === "futura" ? 1 : 0,
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                }}
              >
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel htmlFor="mesesEntrega">Meses para entrega</FieldLabel>
                    <input
                      id="mesesEntrega"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="60"
                      placeholder="12"
                      value={form.mesesEntrega}
                      onChange={(e) => { setField("mesesEntrega", e.target.value); cuotasModificadaRef.current = false; }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel>Pie ({form.piePct}%)</FieldLabel>
                    <div className="flex items-center">
                      <span className="font-mono text-[12px] text-[var(--franco-text-muted)]">
                        {calc.pieUF > 0 ? fmtUF(calc.pieUF) : "—"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor="cuotasPie">Cuotas de pie</FieldLabel>
                    <input
                      id="cuotasPie"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      placeholder="12"
                      value={form.cuotasPie}
                      onChange={(e) => { setField("cuotasPie", e.target.value); cuotasModificadaRef.current = true; }}
                      className={inputClass}
                    />
                  </div>
                </div>
                {calc.pieUF > 0 && Number(form.cuotasPie) > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-[var(--franco-text-muted)]">
                    {form.cuotasPie} cuotas de {fmtUF(Math.round((calc.pieUF / Number(form.cuotasPie)) * 10) / 10)}
                  </p>
                )}
                <div className="mt-2 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-3 py-2">
                  <p className="font-body text-[11px] text-[#FBBF24]">
                    Durante los meses previos a la entrega pagarás las cuotas del pie sin generar ingresos. El análisis incluye este período.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 2: Precio y Financiamiento
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4 mt-3">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">Precio y financiamiento</div>

          {/* Precio de compra */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Precio de compra ({fieldCurrency.precio === "UF" ? "UF" : "$"})</label>
              <InfoTooltip content={TIPS.precio} />
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
            {calc.precioUF > 0 && (
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                {fieldCurrency.precio === "UF" ? fmtCLP(calc.precioCLP) : fmtUF(calc.precioUF)}
              </p>
            )}
          </div>

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

          {/* Tasa + Plazo row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="tasaInteres" tip={TIPS.tasaInteres}>Tasa (%)</FieldLabel>
              <input
                id="tasaInteres"
                type="text"
                inputMode="decimal"
                placeholder={tasaRef.value.replace(".", ",")}
                value={form.tasaInteres.replace(".", ",")}
                onChange={(e) => {
                  const val = e.target.value.replace(",", ".");
                  setField("tasaInteres", val);
                  tasaModificadaRef.current = true;
                }}
                required
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-[var(--franco-text-muted)]">
                Mercado: ~{tasaRef.value.replace(".", ",")}%
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="plazoCredito" tip={TIPS.plazoCredito}>Plazo (años)</FieldLabel>
              <input
                id="plazoCredito"
                type="number"
                inputMode="numeric"
                min="10"
                max="30"
                value={form.plazoCredito}
                onChange={(e) => setField("plazoCredito", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

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
                  <p className="text-[13px] font-semibold text-[var(--franco-text)]">Tu depto podría calificar al Subsidio a la Tasa</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--franco-text-secondary)" }}>
                    La Ley 21.748 rebaja la tasa hipotecaria en ~0,6% para viviendas nuevas de hasta 4.000 UF.
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

          {/* Dividendo estimado */}
          {calc.dividendo > 0 && (
            <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
              <div className="flex items-center justify-between">
                <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Dividendo estimado</span>
                <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmtCLP(calc.dividendo)}/mes</span>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 3: Gestión Airbnb
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4 mt-3">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">Gestión Airbnb</div>

          {/* Modo gestión toggle */}
          <div>
            <FieldLabel tip={TIPS.modoGestion}>Modo de gestión</FieldLabel>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setField("modoGestion", "auto")}
                className={`flex-1 rounded-lg border px-3 py-2.5 font-body text-[13px] text-center transition-all ${
                  form.modoGestion === "auto"
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                    : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                }`}
              >Auto-gestión</button>
              <button
                type="button"
                onClick={() => setField("modoGestion", "administrador")}
                className={`flex-1 rounded-lg border px-3 py-2.5 font-body text-[13px] text-center transition-all ${
                  form.modoGestion === "administrador"
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                    : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                }`}
              >Con administrador</button>
            </div>
            <p className="mt-1.5 font-body text-[11px] text-[var(--franco-text-muted)]">
              {form.modoGestion === "auto"
                ? "Tú gestionas huéspedes, limpieza y check-in. Airbnb cobra 3% de comisión."
                : "Un operador se encarga de todo. Comisión típica: 15-25% del ingreso bruto."}
            </p>
          </div>

          {/* Comisión administrador */}
          <div
            style={{
              maxHeight: form.modoGestion === "administrador" ? 120 : 0,
              opacity: form.modoGestion === "administrador" ? 1 : 0,
              overflow: "hidden",
              transition: "all 0.3s ease",
            }}
          >
            <FieldLabel htmlFor="comisionAdmin" tip={TIPS.comisionAdmin}>Comisión administrador: {form.comisionAdministrador}%</FieldLabel>
            <input
              id="comisionAdmin"
              type="range" min="10" max="30" step="1"
              value={form.comisionAdministrador}
              onChange={(e) => setField("comisionAdministrador", e.target.value)}
              className="w-full accent-[#C8323C]"
            />
            <div className="flex justify-between font-mono text-[10px] text-[var(--franco-text-muted)]">
              <span>10%</span><span>30%</span>
            </div>
          </div>

          {/* ¿Tu edificio permite Airbnb? */}
          <div>
            <FieldLabel tip={TIPS.edificioAirbnb}>¿Tu edificio permite Airbnb?</FieldLabel>
            <div className="relative">
              <select
                value={form.edificioPermiteAirbnb}
                onChange={(e) => setField("edificioPermiteAirbnb", e.target.value)}
                className={selectClass}
              >
                <option value="si">Sí</option>
                <option value="no">No</option>
                <option value="no_seguro">No estoy seguro</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
            </div>
            {form.edificioPermiteAirbnb === "no" && (
              <div className="mt-2 rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/[0.06] px-4 py-3">
                <p className="font-body text-[12px] text-[#C8323C]">
                  Tu edificio podría tener restricciones. Revisa el Reglamento de Copropiedad antes de invertir.
                </p>
              </div>
            )}
            {form.edificioPermiteAirbnb === "no_seguro" && (
              <p className="mt-1.5 font-body text-[11px] text-[var(--franco-text-muted)]">
                Te recomendamos revisar el Reglamento de Copropiedad de tu edificio.
              </p>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 4: Costos Operativos Mensuales
            ════════════════════════════════════════════════════════ */}
        <div className="mt-3">
          <SectionCard
            title="COSTOS OPERATIVOS MENSUALES"
            subtitle="Pre-llenados según tipología. Edita si tienes datos reales."
            defaultOpen={false}
            summary={fmtCLP(
              (Number(form.costoElectricidad) || 0) +
              (Number(form.costoAgua) || 0) +
              (Number(form.costoWifi) || 0) +
              (Number(form.costoInsumos) || 0) +
              (Number(form.gastosComunes) || 0) +
              (Number(form.mantencion) || 0)
            ) + "/mes"}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="costoElectricidad" tip={TIPS.electricidad}>Electricidad</FieldLabel>
                <MoneyInput
                  id="costoElectricidad"
                  value={form.costoElectricidad}
                  onChange={(v) => setFieldWithEdit("costoElectricidad", v)}
                  placeholder="35.000"
                />
              </div>
              <div>
                <FieldLabel htmlFor="costoAgua" tip={TIPS.agua}>Agua</FieldLabel>
                <MoneyInput
                  id="costoAgua"
                  value={form.costoAgua}
                  onChange={(v) => setFieldWithEdit("costoAgua", v)}
                  placeholder="8.000"
                />
              </div>
              <div>
                <FieldLabel htmlFor="costoWifi" tip={TIPS.wifi}>WiFi / Cable</FieldLabel>
                <MoneyInput
                  id="costoWifi"
                  value={form.costoWifi}
                  onChange={(v) => setFieldWithEdit("costoWifi", v)}
                  placeholder="22.000"
                />
              </div>
              <div>
                <FieldLabel htmlFor="costoInsumos" tip={TIPS.insumos}>Insumos</FieldLabel>
                <MoneyInput
                  id="costoInsumos"
                  value={form.costoInsumos}
                  onChange={(v) => setFieldWithEdit("costoInsumos", v)}
                  placeholder="20.000"
                />
              </div>
              <div>
                <FieldLabel htmlFor="gastosComunes" tip={TIPS.gastosComunes}>Gastos comunes</FieldLabel>
                <MoneyInput
                  id="gastosComunes"
                  value={form.gastosComunes}
                  onChange={(v) => setFieldWithEdit("gastosComunes", v)}
                  placeholder="66.000"
                />
                {!userEdited.gastosComunes && parseNum(form.superficieUtil) > 0 && (
                  <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">
                    Estimado: ~$1.200/m² mensual
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="mantencion" tip={TIPS.mantencion}>Mantención</FieldLabel>
                <MoneyInput
                  id="mantencion"
                  value={form.mantencion}
                  onChange={(v) => setFieldWithEdit("mantencion", v)}
                  placeholder="11.000"
                />
              </div>
            </div>

            {/* Contribuciones trimestrales */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-center gap-1">
                  <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Contribuciones trimestrales ({fieldCurrency.contribuciones === "UF" ? "UF" : "$"})</label>
                  <InfoTooltip content="Impuesto territorial. Se paga 4 veces al año. En el análisis se divide por 3 para obtener el costo mensual equivalente." />
                </div>
                {(calc.contribucionesAuto ?? 0) > 0 && !form.contribuciones && (
                  <span
                    className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                    onClick={() => {
                      setFieldCurrency((prev) => ({ ...prev, contribuciones: "CLP" }));
                      setField("contribuciones", String(calc.contribucionesAuto));
                    }}
                  >
                    Sugerencia: {fmtCLP(calc.contribucionesAuto)} ↗
                  </span>
                )}
              </div>
              <MoneyInput
                id="contribuciones"
                value={form.contribuciones}
                onChange={(v) => setFieldWithEdit("contribuciones", v)}
                placeholder={calc.contribucionesAuto > 0 ? fmtInput(calc.contribucionesAuto) : "120.000"}
                currency={fieldCurrency.contribuciones}
                onCurrencyToggle={() => toggleFieldCurrency("contribuciones")}
              />
              {!form.contribuciones && (
                <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">
                  {(calc.contribucionesAuto ?? 0) > 0
                    ? <>Estimación SII. Para dato exacto, consulta con tu ROL en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a></>
                    : <>Consultar en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a> con el ROL de la propiedad</>
                  }
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 5: Amoblamiento
            ════════════════════════════════════════════════════════ */}
        <div className="mt-3">
          <SectionCard
            title="AMOBLAMIENTO"
            defaultOpen={true}
            summary={form.estaAmoblado ? "Ya amoblado" : fmtCLP(Number(form.costoAmoblamiento) || 0)}
          >
            <div>
              <FieldLabel>¿Está amoblado?</FieldLabel>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setField("estaAmoblado", true)}
                  className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                    form.estaAmoblado
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >Sí</button>
                <button
                  type="button"
                  onClick={() => setField("estaAmoblado", false)}
                  className={`flex-1 rounded-lg border px-3 py-2 font-body text-[13px] text-center transition-all ${
                    !form.estaAmoblado
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >No</button>
              </div>
            </div>

            <div
              style={{
                maxHeight: !form.estaAmoblado ? 120 : 0,
                opacity: !form.estaAmoblado ? 1 : 0,
                overflow: "hidden",
                transition: "all 0.3s ease",
              }}
            >
              <FieldLabel htmlFor="costoAmoblamiento" tip={TIPS.amoblamiento}>Costo amoblamiento</FieldLabel>
              <MoneyInput
                id="costoAmoblamiento"
                value={form.costoAmoblamiento}
                onChange={(v) => setFieldWithEdit("costoAmoblamiento", v)}
                placeholder="3.500.000"
              />
              <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">
                Incluye muebles, electrodomésticos, decoración, ropa de cama y menaje.
              </p>
            </div>
          </SectionCard>
        </div>

        {/* ════════════════════════════════════════════════════════
            BLOCK 6: Comparativa con Renta Larga
            ════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4 mt-3">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">Comparativa con renta larga</div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Arriendo largo plazo estimado ({fieldCurrency.arriendoLargo === "UF" ? "UF" : "$"})</label>
                <InfoTooltip content={TIPS.arriendoLargo} />
              </div>
              {arriendoSugerido && arriendoSugerido > 0 && !form.arriendoLargo && (
                <span
                  className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                  onClick={() => {
                    setFieldCurrency((prev) => ({ ...prev, arriendoLargo: "CLP" }));
                    setField("arriendoLargo", String(arriendoSugerido));
                  }}
                >
                  Sugerencia: {fmtCLP(arriendoSugerido)}{suggestionSampleSize > 0 && <span className="text-[var(--franco-text-muted)]"> · {suggestionSampleSize} deptos</span>} ↗
                </span>
              )}
            </div>
            <MoneyInput
              id="arriendoLargo"
              value={form.arriendoLargo}
              onChange={(v) => setField("arriendoLargo", v)}
              placeholder={arriendoSugerido ? fmtInput(arriendoSugerido) : "450.000"}
              currency={fieldCurrency.arriendoLargo}
              onCurrencyToggle={() => toggleFieldCurrency("arriendoLargo")}
              required
            />
            {form.arriendoLargo && Number(form.arriendoLargo) > 0 && (
              <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                {fieldCurrency.arriendoLargo === "UF"
                  ? fmtCLP(Number(form.arriendoLargo) * UF_CLP)
                  : fmtUF(Number(form.arriendoLargo) / UF_CLP)
                }/mes
              </p>
            )}
            <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">
              Franco compara este valor con los ingresos Airbnb para determinar si la renta corta conviene.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SUBMIT BUTTON
            ════════════════════════════════════════════════════════ */}
        <div className="mt-5">
          <button
            type="button"
            disabled={loading || !canSubmit}
            onClick={() => handleSubmit()}
            className="w-full py-3.5 rounded-xl bg-[#C8323C] text-white font-body text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-[#B02A34] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analizando renta corta...</>
            ) : (
              <>Analizar rentabilidad Airbnb</>
            )}
          </button>
          <p className="text-center font-body text-[11px] text-[var(--franco-text-muted)] mt-2">
            {!canSubmit ? `Faltan: ${progress.missing.join(", ")}` : "Análisis con datos reales de Airbnb"}
          </p>
        </div>
      </>)}
      </div>
    </div>
  );
}
