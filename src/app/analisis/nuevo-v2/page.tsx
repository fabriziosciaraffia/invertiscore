"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Loader2, ChevronDown, CheckCircle2, AlertCircle, Check } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
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

function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function getMantencionRate(antiguedad: number): number {
  if (antiguedad <= 2) return 0.003;
  if (antiguedad <= 5) return 0.005;
  if (antiguedad <= 10) return 0.008;
  if (antiguedad <= 15) return 0.01;
  if (antiguedad <= 20) return 0.013;
  return 0.015;
}

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

// ─── Field tooltips ──────────────────────────────────
const TIPS: Record<string, string> = {
  superficie: "Superficie total del departamento en metros cuadrados.",
  dormitorios: "Cantidad de dormitorios (sin contar living).",
  banos: "Cantidad de baños completos.",
  estacionamiento: "Estacionamientos incluidos en la compra.",
  bodega: "Bodegas incluidas en la compra.",
  precio: "Precio de venta publicado o acordado.",
  arriendo: "Arriendo esperado de mercado para este departamento.",
  gastos: "Gasto común mensual estimado.",
  contribuciones: "Las contribuciones se pagan 4 veces al año. Este valor es una estimación basada en la normativa del SII.",
  tasaInteres: "Tasa de interés anual del crédito hipotecario.",
  plazoCredito: "Duración del crédito hipotecario en años.",
  piePct: "Porcentaje del precio que se paga al contado.",
  vacanciaMeses: "Meses al año sin arrendatario. 1 mes/año es el estándar.",
  antiguedad: "Años del inmueble. Más antiguo = más mantención, menos plusvalía.",
  capacidad: "Máximo de huéspedes que permite tu departamento.",
  modoGestion: "Auto-gestión: tú te encargas de todo. Airbnb cobra 3%. Con administrador: un operador gestiona huéspedes, limpieza y check-in/out.",
  comisionAdmin: "Comisión del administrador sobre el ingreso bruto. Típicamente 15-25%.",
  edificioAirbnb: "Algunos edificios prohíben Airbnb en su Reglamento de Copropiedad.",
  electricidad: "Consumo eléctrico mensual promedio. En Airbnb el dueño paga la luz.",
  agua: "Consumo de agua mensual promedio.",
  wifi: "Internet fijo mensual. Esencial para Airbnb.",
  insumos: "Sábanas, toallas, amenities, café, papel higiénico, etc.",
  mantencion: "Reposición de artículos, reparaciones menores, reemplazo de equipamiento.",
  amoblamiento: "Incluye muebles, electrodomésticos, decoración, ropa de cama, menaje de cocina.",
  arriendoLargo: "¿Cuánto arrendarías este depto en arriendo tradicional? Franco lo compara con la renta corta.",
};

// ─── Reusable components ─────────────────────────────

// SectionCard removed — wizard steps replace collapsible sections

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

// ─── Step labels ─────────────────────────────────────
const STEPS = [
  { num: 1, label: "Tu propiedad" },
  { num: 2, label: "Financiamiento" },
  { num: 3, label: "Modalidad" },
  { num: 4, label: "Costos" },
] as const;

const LS_KEY = "franco_draft_v2";
const GUEST_LS_KEY = "franco_guest_analysis_v2";

// ─── Main Wizard ─────────────────────────────────────

export default function NuevoAnalisisV2Page() {
  const router = useRouter();
  const posthog = usePostHog();

  // ─── Wizard state ──────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ─── General state ─────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ufValue, setUfValue] = useState(UF_CLP_FALLBACK);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestBlocked, setGuestBlocked] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const formInitialized = useRef(false);
  const direccionInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Geocoding
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

  // API suggestions
  const [apiSuggestions, setApiSuggestions] = useState<{
    arriendo: number;
    ggcc: number | null;
    source: string;
    sampleSize: number;
    precioM2?: number;
  } | null>(null);

  const [ventaRef, setVentaRef] = useState<{
    precioM2: number | null;
    sampleSize: number;
    filteredInRadius: number;
    nearbyProperties: { lat: number; lng: number }[];
  } | null>(null);

  // Market data
  const [marketData, setMarketData] = useState<{
    arriendo_promedio: number; precio_m2_promedio: number;
    precio_m2_venta_promedio: number; gastos_comunes_m2: number;
    numero_publicaciones: number; source: string;
  } | null>(null);

  // ─── Auth check ────────────────────────────────────
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

  // ─── Fetch UF + tasa ──────────────────────────────
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

  // ─── Currency toggles ─────────────────────────────
  const [fieldCurrency, setFieldCurrency] = useState<Record<string, "CLP" | "UF">>({
    precio: "UF", arriendo: "CLP", gastos: "CLP", contribuciones: "CLP",
    arriendoEstac: "CLP", arriendoBodega: "CLP", arriendoLargo: "CLP",
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
    // Step 1: Tu propiedad
    direccion: "",
    comuna: "",
    tipoPropiedad: "usado",
    dormitorios: "",
    banos: "",
    superficieUtil: "",
    antiguedad: "3-5",
    estacionamiento: "",
    arriendoEstac: "",
    bodega: "",
    arriendoBodega: "",
    estadoVenta: "inmediata" as "inmediata" | "futura",
    fechaEntregaMes: "",
    fechaEntregaAnio: "",
    cuotasPie: "",

    // Step 2: Financiamiento
    precio: "",
    piePct: "20",
    plazoCredito: "25",
    tasaInteres: "4.72",

    // Step 3: Modalidad
    modalidad: "both" as "ltr" | "str" | "both",

    // Step 4: Costos
    // Shared
    gastos: "",
    contribuciones: "",
    // LTR
    arriendo: "",
    vacanciaPct: "5",
    adminPct: "0",
    // STR
    capacidadHuespedes: "2",
    modoGestion: "auto" as "auto" | "administrador",
    comisionAdministrador: "20",
    edificioPermiteAirbnb: "no_seguro" as "si" | "no" | "no_seguro",
    costoElectricidad: "35000",
    costoAgua: "8000",
    costoWifi: "22000",
    costoInsumos: "20000",
    mantencion: "11000",
    estaAmoblado: false as boolean,
    costoAmoblamiento: "3500000",
    arriendoLargo: "",
  });

  const setField = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldCurrency[field] === "UF") {
      setEditedInUF((prev) => ({ ...prev, [field]: true }));
    }
  }, [fieldCurrency]);

  // Track which STR cost fields were manually edited
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});
  const setFieldWithEdit = useCallback((field: string, value: string) => {
    setField(field, value);
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  }, [setField]);

  // ─── localStorage persistence ──────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && typeof draft === "object" && (draft.comuna || draft.direccion)) {
          setShowDraftBanner(true);
        }
      }
    } catch { /* ignore */ }
    formInitialized.current = true;
  }, []);

  useEffect(() => {
    if (!formInitialized.current) return;
    if (!form.comuna && !form.precio && !form.direccion) return;
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

  // ─── Update STR cost defaults when dormitorios changes ──
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

  // ─── Auto-fill gastos from superficie ──────────────
  useEffect(() => {
    if (userEdited.gastos) return;
    const sup = parseNum(form.superficieUtil);
    if (sup > 0) {
      setForm((prev) => ({ ...prev, gastos: String(Math.round(sup * 1200)) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.superficieUtil]);

  // ─── Sync tipoPropiedad → estadoVenta ──────────────
  useEffect(() => {
    if (form.tipoPropiedad === "usado") {
      setForm((prev) => ({ ...prev, estadoVenta: "inmediata" }));
    }
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
    if (currentStep !== 1) return;
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
  }, [setField, currentStep]);

  // ─── Fetch suggestions + map data ──────────────────
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

  // ─── Computed suggestions ──────────────────────────
  const suggestions = useMemo(() => {
    const supUtil = parseNum(form.superficieUtil) || 0;
    if (!form.comuna) return null;

    const nEstac = Number(form.estacionamiento) || 0;
    const nBodega = Number(form.bodega) || 0;
    const estacIncome = Number(form.arriendoEstac) || (nEstac * 40000);
    const bodegaIncome = Number(form.arriendoBodega) || (nBodega * 15000);
    const extraArriendo = estacIncome + bodegaIncome;

    const precioM2VentaUF = ventaRef?.precioM2
      ? ventaRef.precioM2 / UF_CLP
      : (marketData?.precio_m2_venta_promedio ?? 0);
    const precioM2Ajustado = form.tipoPropiedad === "nuevo" && supUtil > 25
      ? precioM2VentaUF * Math.pow(25 / supUtil, 0.15)
      : precioM2VentaUF;
    const precioSugeridoUF = supUtil > 0 && precioM2Ajustado > 0 ? Math.round(precioM2Ajustado * supUtil) : 0;

    const precioUFForCalc = (fieldCurrency.precio === "UF"
      ? (Number(form.precio) || 0)
      : (Number(form.precio) || 0) / UF_CLP) || precioSugeridoUF;

    const contribuciones = estimarContribuciones(precioUFForCalc * UF_CLP, form.tipoPropiedad === "nuevo");

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
        gastos: null,
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

  // Arriendo largo suggestion for STR
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
  }, [form.precio, form.superficieUtil, form.piePct, form.plazoCredito, form.tasaInteres, form.antiguedad, form.estadoVenta, form.tipoPropiedad, fieldCurrency.precio, UF_CLP, tasaRef.value]);

  // ─── Step validation ───────────────────────────────
  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 1: return !!form.direccion && !!form.superficieUtil && parseNum(form.superficieUtil) > 0;
      case 2: return !!form.precio && Number(form.precio) > 0;
      case 3: return true;
      case 4: {
        const mod = form.modalidad;
        if (mod === "ltr" || mod === "both") {
          if (!form.arriendo || Number(form.arriendo) <= 0) return false;
        }
        if (mod === "str") {
          if (!form.arriendoLargo || Number(form.arriendoLargo) <= 0) return false;
        }
        return true;
      }
    }
    return false;
  }, [currentStep, form]);

  // ─── Step navigation ───────────────────────────────
  const goToStep = useCallback((step: number) => {
    if (step === currentStep) return;
    if (step > currentStep && !canAdvance) return;
    // Can only go to completed steps or next step
    if (step > currentStep + 1 && !completedSteps.has(step - 1)) return;

    setSlideDir(step > currentStep ? "left" : "right");
    setIsTransitioning(true);

    // Mark current step as completed if advancing
    if (step > currentStep) {
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
    }

    setTimeout(() => {
      setCurrentStep(step);
      setIsTransitioning(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 150);
  }, [currentStep, canAdvance, completedSteps]);

  const goNext = useCallback(() => {
    if (currentStep < 4 && canAdvance) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, canAdvance, goToStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Auto-advance from step 3 after selection
  const handleModalidadSelect = useCallback((modalidad: "ltr" | "str" | "both") => {
    setField("modalidad", modalidad);
    setTimeout(() => {
      setCompletedSteps((prev) => new Set(prev).add(3));
      setSlideDir("left");
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(4);
        setIsTransitioning(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 150);
    }, 500);
  }, [setField]);

  // ─── Submit ────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    const supUtil = parseNum(form.superficieUtil) || 0;
    const precioUF = toUF("precio", Number(form.precio) || 0);
    const precioCLP = precioUF * UF_CLP;
    const ciudad = selectedComuna?.ciudad || "Santiago";
    const mod = form.modalidad;

    try {
      const promises: Promise<{ type: "ltr" | "str"; id: string }>[] = [];

      // LTR submit
      if (mod === "ltr" || mod === "both") {
        const arriendo = Math.round(toCLP("arriendo", Number(form.arriendo) || 0));
        const gastos = Math.round(toCLP("gastos", Number(form.gastos) || 0));
        const contribuciones = Math.round(toCLP("contribuciones", Number(form.contribuciones) || 0));
        const antiguedad = form.estadoVenta !== "inmediata" ? 0 : antiguedadToNumber(form.antiguedad);
        const nombre = `Depto ${form.dormitorios || "2"}D${form.banos || "1"}B ${form.comuna}`;

        const ltrPromise = fetch("/api/analisis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
            piePct: parseFloat(form.piePct),
            plazoCredito: parseFloat(form.plazoCredito),
            tasaInteres: parseFloat(form.tasaInteres),
            gastos: gastos || calc.gastosAuto,
            contribuciones: contribuciones || calc.contribucionesAuto,
            provisionMantencion: calc.provisionAuto,
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
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Error al crear análisis de renta larga");
          }
          const data = await res.json();
          return { type: "ltr" as const, id: data.id };
        });
        promises.push(ltrPromise);
      }

      // STR submit
      if (mod === "str" || mod === "both") {
        // In "both" mode, use the LTR arriendo field as the long-term rent reference
        const arriendoLargoRaw = mod === "both" ? Number(form.arriendo) || 0 : Number(form.arriendoLargo) || 0;
        const arriendoLargoCurrency = mod === "both" ? "arriendo" as const : "arriendoLargo" as const;
        const arriendoLargoCLP = Math.round(toCLP(arriendoLargoCurrency, arriendoLargoRaw));

        const strPromise = fetch("/api/analisis/short-term", {
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
            mesesEntrega: form.tipoPropiedad === "nuevo" && form.estadoVenta === "futura" ? Number(form.cuotasPie) || 12 : 0,
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
            gastosComunes: Number(form.gastos) || 0,
            mantencion: Number(form.mantencion) || 0,
            contribuciones: Math.round(toCLP("contribuciones", Number(form.contribuciones) || 0)) || calc.contribucionesAuto,
            estaAmoblado: form.estaAmoblado,
            costoAmoblamiento: form.estaAmoblado ? 0 : Number(form.costoAmoblamiento) || 0,
            arriendoLargoMensual: arriendoLargoCLP,
            valorUF: UF_CLP,
            lat: geoLat || null,
            lng: geoLng || null,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Error al crear análisis de renta corta");
          }
          const data = await res.json();
          return { type: "str" as const, id: data.id };
        });
        promises.push(strPromise);
      }

      const results = await Promise.all(promises);
      localStorage.removeItem(LS_KEY);

      if (!isLoggedIn) {
        localStorage.setItem(GUEST_LS_KEY, JSON.stringify({ ids: results.map((r) => r.id), timestamp: Date.now() }));
      }

      const ltrResult = results.find((r) => r.type === "ltr");
      const strResult = results.find((r) => r.type === "str");

      posthog?.capture("wizard_analysis_created", {
        comuna: form.comuna,
        modalidad: mod,
        dormitorios: form.dormitorios,
      });

      if (mod === "both" && ltrResult && strResult) {
        // Fallback: go to LTR result (comparativa page doesn't exist yet)
        router.push(`/analisis/${ltrResult.id}`);
      } else if (mod === "ltr" && ltrResult) {
        router.push(`/analisis/${ltrResult.id}`);
      } else if (mod === "str" && strResult) {
        router.push(`/analisis/renta-corta/${strResult.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  };

  // ─── Shared classes ────────────────────────────────
  const inputClass = "flex h-9 w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2 font-body text-[13px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const selectClass = "flex h-10 w-full appearance-none rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-[13px] text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none";

  // ─── Costs expandable state ────────────────────────
  const [costosOpen, setCostosOpen] = useState(false);

  // ─── Render ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[640px] items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
              ← Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Step indicator */}
      <div className="sticky top-14 z-40 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[640px] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (completedSteps.has(step.num) || step.num === currentStep) {
                      goToStep(step.num);
                    }
                  }}
                  disabled={!completedSteps.has(step.num) && step.num !== currentStep && step.num > currentStep}
                  className={`flex items-center gap-1.5 transition-all ${
                    step.num === currentStep
                      ? "opacity-100"
                      : completedSteps.has(step.num)
                        ? "opacity-80 cursor-pointer hover:opacity-100"
                        : "opacity-30 cursor-default"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-mono font-bold transition-all ${
                    step.num === currentStep
                      ? "bg-[#C8323C] text-white"
                      : completedSteps.has(step.num)
                        ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                        : "border border-[var(--franco-border)] text-[var(--franco-text-muted)]"
                  }`}>
                    {completedSteps.has(step.num) ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </span>
                  <span className="hidden sm:inline font-body text-[11px] text-[var(--franco-text)]">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-px w-4 sm:w-8 transition-colors ${
                    completedSteps.has(step.num) ? "bg-[var(--franco-text)]" : "bg-[var(--franco-border)]"
                  }`} />
                )}
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-[var(--franco-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8323C] rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 pb-12 pt-6 overflow-x-hidden">
        {/* Guest blocked */}
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

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 font-body text-sm text-red-700 mb-3">{error}</div>
          )}

          {/* Step content with transition */}
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning
                ? slideDir === "left" ? "translateX(-20px)" : "translateX(20px)"
                : "translateX(0)",
            }}
          >

            {/* ═══════════════════════════════════════════════
                STEP 1: Tu propiedad
                ═══════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="mb-5">
                  <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">Tu propiedad</h1>
                  <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                    ¿Dónde está y cómo es? <span className="font-mono">UF hoy: {fmtCLP(UF_CLP)}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
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

                  {/* Comuna + Tipo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        Franco está optimizado para el Gran Santiago. Los datos de mercado pueden no estar disponibles para esta comuna.
                      </p>
                    </div>
                  )}

                  {/* Map */}
                  {geoLat && geoLng && (
                    <div className="space-y-3">
                      <GoogleMapRadius
                        lat={geoLat}
                        lng={geoLng}
                        radiusMeters={radius}
                        comuna={form.comuna}
                        nearbyProperties={[...nearbyProperties, ...(ventaRef?.nearbyProperties || [])]}
                      />
                      {(() => {
                        const arriendosCount = filteredInRadius || totalInRadius;
                        const ventasCount = ventaRef?.filteredInRadius || 0;
                        const totalComparables = arriendosCount + ventasCount;
                        const minCount = Math.min(arriendosCount, ventasCount);
                        return (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-lg font-bold text-[var(--franco-text)]">{totalComparables}</span>
                              <div>
                                <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">comparables en {radius}m</div>
                                <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
                                  {arriendosCount} arriendos · {ventasCount} ventas
                                </div>
                              </div>
                            </div>
                            <div className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${
                              minCount >= 20 ? "bg-[#B0BEC5]/10 text-[var(--franco-positive)]" :
                              minCount >= 10 ? "bg-[var(--franco-text)]/10 text-[var(--franco-text)]" :
                              minCount >= 5 ? "bg-[#C8323C]/10 text-[#C8323C]" :
                              "bg-[var(--franco-text-muted)]/10 text-[var(--franco-text-muted)]"
                            }`}>
                              {minCount >= 20 ? "Robustos" :
                               minCount >= 10 ? "Suficientes" :
                               minCount >= 5 ? "Limitados" :
                               "Pocos datos"}
                            </div>
                          </div>
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

                  {/* Characteristics */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
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
                    <div>
                      <div className="flex items-center gap-0.5 mb-1">
                        <label className="font-mono text-[11px] text-[var(--franco-text-muted)] uppercase">Dorm.</label>
                        <InfoTooltip content={TIPS.dormitorios} />
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={6}
                        placeholder="2"
                        value={form.dormitorios}
                        onChange={(e) => setField("dormitorios", e.target.value)}
                        className={inputClass}
                      />
                    </div>
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

                  {/* Arriendo estac/bodega */}
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

                  {/* Antigüedad (solo usado) */}
                  {form.tipoPropiedad === "usado" && (
                    <div>
                      <FieldLabel tip={TIPS.antiguedad}>Antigüedad</FieldLabel>
                      <div className="relative">
                        <select
                          value={form.antiguedad}
                          onChange={(e) => setField("antiguedad", e.target.value)}
                          className={selectClass}
                        >
                          <option value="0-2">0-2 años (nuevo)</option>
                          <option value="3-5">3-5 años</option>
                          <option value="6-10">6-10 años</option>
                          <option value="11-20">11-20 años</option>
                          <option value="20+">20+ años</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
                      </div>
                    </div>
                  )}

                  {/* Entrega futura (solo nuevo) */}
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
                              className={selectClass}
                            >
                              <option value="">Mes...</option>
                              {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
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
                              className={selectClass}
                            >
                              <option value="">Año...</option>
                              {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                                <option key={y} value={String(y)}>{y}</option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-[var(--franco-text-muted)]" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FieldLabel>Pie ({form.piePct}%)</FieldLabel>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" inputMode="numeric" min="0" max="100"
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
                              type="number" inputMode="numeric" min="1"
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
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                STEP 2: Precio y financiamiento
                ═══════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <div className="mb-5">
                  <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">Precio y financiamiento</h1>
                  <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                    ¿Cuánto cuesta y cómo lo financias?
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
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
                          Sugerencia: {fmtUF(suggestions.precioSugeridoUF)} ↗
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
                    {calc.precioUF > 0 && (
                      <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                        {fieldCurrency.precio === "UF" ? fmtCLP(calc.precioCLP) : fmtUF(calc.precioUF)}
                        {calc.precioM2 > 0 && <> · {fmtUF(calc.precioM2)}/m²</>}
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

                  {/* Tasa */}
                  <div>
                    <FieldLabel htmlFor="tasaInteres" tip={TIPS.tasaInteres}>Tasa interés anual (%)</FieldLabel>
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
                    <p className="mt-1 text-xs text-[var(--franco-text-muted)]">
                      Mercado actual: ~{tasaRef.value.replace(".", ",")}%
                      {tasaRef.updated_at && ` (act. ${new Date(tasaRef.updated_at).toLocaleDateString("es-CL")})`}
                    </p>
                    {/* Subsidio a la Tasa */}
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
                              La Ley 21.748 rebaja la tasa hipotecaria en ~0,6% para viviendas nuevas ≤ 4.000 UF.
                            </p>
                            <p className="mt-1.5 text-xs" style={{ color: "var(--franco-text-secondary)" }}>
                              Tasa promedio: {tasaMercado.toFixed(1).replace(".", ",")}% → Con subsidio: <span style={{ color: "#C8323C", fontWeight: 600 }}>~{tasaConSubsidio.toFixed(1).replace(".", ",")}%</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => { setField("tasaInteres", String(tasaConSubsidio)); tasaModificadaRef.current = true; }}
                              className="mt-2 text-xs font-medium text-[var(--franco-text)] underline underline-offset-2 hover:text-[var(--franco-text)]"
                            >
                              Usar {tasaConSubsidio.toFixed(1).replace(".", ",")}%
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Plazo */}
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

                  {/* Dividendo */}
                  {calc.dividendo > 0 && (
                    <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Dividendo estimado</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--franco-text)]">{fmtCLP(calc.dividendo)}/mes</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                STEP 3: Modalidad
                ═══════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-3">
                <div className="mb-5">
                  <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">¿Cómo quieres rentarla?</h1>
                  <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                    Elige la modalidad de inversión que quieres analizar.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Renta larga */}
                  <button
                    type="button"
                    onClick={() => handleModalidadSelect("ltr")}
                    className={`w-full rounded-xl border-2 p-5 text-left transition-all ${
                      form.modalidad === "ltr"
                        ? "border-[var(--franco-text)] bg-[var(--franco-card)]"
                        : "border-[var(--franco-border)] bg-[var(--franco-card)] hover:border-[var(--franco-text)]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[var(--franco-text)]">Renta larga</h3>
                        <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                          Arriendo 12+ meses. Ingreso estable, menor gestión.
                        </p>
                      </div>
                      {form.modalidad === "ltr" && (
                        <div className="h-6 w-6 rounded-full bg-[var(--franco-text)] flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-[var(--franco-bg)]" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Renta corta */}
                  <button
                    type="button"
                    onClick={() => handleModalidadSelect("str")}
                    className={`w-full rounded-xl border-2 p-5 text-left transition-all ${
                      form.modalidad === "str"
                        ? "border-[var(--franco-text)] bg-[var(--franco-card)]"
                        : "border-[var(--franco-border)] bg-[var(--franco-card)] hover:border-[var(--franco-text)]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[var(--franco-text)]">Renta corta</h3>
                        <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                          Airbnb/Booking por noches. Mayor ingreso potencial, más gestión.
                        </p>
                      </div>
                      {form.modalidad === "str" && (
                        <div className="h-6 w-6 rounded-full bg-[var(--franco-text)] flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-[var(--franco-bg)]" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Comparar ambas — RECOMENDADO */}
                  <button
                    type="button"
                    onClick={() => handleModalidadSelect("both")}
                    className={`w-full rounded-xl border-2 p-5 text-left transition-all ${
                      form.modalidad === "both"
                        ? "border-[#C8323C] bg-[var(--franco-card)]"
                        : "border-[var(--franco-border)] bg-[var(--franco-card)] hover:border-[#C8323C]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-bold text-lg text-[var(--franco-text)]">Comparar ambas</h3>
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[#C8323C] text-white px-2 py-0.5 rounded-full">
                            Recomendado
                          </span>
                        </div>
                        <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                          Franco analiza ambas modalidades y te dice cuál conviene más.
                        </p>
                      </div>
                      {form.modalidad === "both" && (
                        <div className="h-6 w-6 rounded-full bg-[#C8323C] flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                <p className="text-center font-body text-[11px] text-[var(--franco-text-muted)] mt-3">
                  1 crédito = 1 análisis (incluye ambas modalidades)
                </p>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                STEP 4: Ingresos y costos
                ═══════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="space-y-3">
                <div className="mb-5">
                  <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)]">Ingresos y costos</h1>
                  <p className="font-body text-[13px] text-[var(--franco-text-muted)] mt-1">
                    Últimos datos para tu análisis de {form.modalidad === "ltr" ? "renta larga" : form.modalidad === "str" ? "renta corta" : "ambas modalidades"}.
                  </p>
                </div>

                {/* A: Costos compartidos (siempre visible) */}
                <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
                  <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">Costos fijos</div>

                  {/* Gastos comunes */}
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
                          Sugerencia: {fmtCLP(suggestions.gastos)} ↗
                        </span>
                      )}
                    </div>
                    <MoneyInput
                      id="gastos"
                      value={form.gastos}
                      onChange={(v) => { setField("gastos", v); setUserEdited((prev) => ({ ...prev, gastos: true })); }}
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

                  {/* Contribuciones */}
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
                          ? <>Estimación SII. Para dato exacto, consulta con tu ROL en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a></>
                          : <>Consultar en <a href="https://www4.sii.cl/mapasui/internet/" target="_blank" rel="noopener noreferrer" className="text-[#C8323C] hover:underline">sii.cl/mapas</a> con el ROL de la propiedad</>
                        }
                      </p>
                    )}
                  </div>
                </div>

                {/* B: Renta larga (visible si ltr o both) */}
                {(form.modalidad === "ltr" || form.modalidad === "both") && (
                  <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
                    <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">Renta larga</div>

                    {/* Arriendo mensual */}
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
                    </div>

                    {/* Vacancia + Admin */}
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
                )}

                {/* C: Renta corta (visible si str o both) */}
                {(form.modalidad === "str" || form.modalidad === "both") && (
                  <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
                    <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">Renta corta</div>

                    {/* Capacidad + Gestión */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldLabel tip={TIPS.capacidad}>Capacidad huéspedes</FieldLabel>
                        <div className="relative">
                          <select
                            value={form.capacidadHuespedes}
                            onChange={(e) => setField("capacidadHuespedes", e.target.value)}
                            className={selectClass}
                          >
                            {[1,2,3,4,5,6].map((n) => (
                              <option key={n} value={String(n)}>{n} {n === 1 ? "huésped" : "huéspedes"}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--franco-text-muted)]" />
                        </div>
                      </div>
                      <div>
                        <FieldLabel tip={TIPS.modoGestion}>Gestión</FieldLabel>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setField("modoGestion", "auto")}
                            className={`flex-1 rounded-lg border px-2 py-2 font-body text-[12px] text-center transition-all ${
                              form.modoGestion === "auto"
                                ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                                : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                            }`}
                          >Auto</button>
                          <button
                            type="button"
                            onClick={() => setField("modoGestion", "administrador")}
                            className={`flex-1 rounded-lg border px-2 py-2 font-body text-[12px] text-center transition-all ${
                              form.modoGestion === "administrador"
                                ? "bg-[var(--franco-text)] text-[var(--franco-bg)] font-semibold border-[var(--franco-text)]"
                                : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
                            }`}
                          >Admin</button>
                        </div>
                        <p className="mt-1 font-body text-[10px] text-[var(--franco-text-muted)]">
                          {form.modoGestion === "auto" ? "Airbnb cobra 3% de comisión" : "Un operador gestiona todo. 15-25% del ingreso"}
                        </p>
                      </div>
                    </div>

                    {/* Comisión admin (solo si admin) */}
                    {form.modoGestion === "administrador" && (
                      <div>
                        <FieldLabel tip={TIPS.comisionAdmin}>Comisión administrador: {form.comisionAdministrador}%</FieldLabel>
                        <input
                          type="range" min={10} max={30} step={1}
                          value={form.comisionAdministrador}
                          onChange={(e) => setField("comisionAdministrador", e.target.value)}
                          className="w-full accent-[#C8323C]"
                        />
                        <div className="flex justify-between font-mono text-[10px] text-[var(--franco-text-muted)]">
                          <span>10%</span><span>30%</span>
                        </div>
                      </div>
                    )}

                    {/* Edificio permite Airbnb */}
                    <div>
                      <FieldLabel tip={TIPS.edificioAirbnb}>¿Edificio permite Airbnb?</FieldLabel>
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
                        <div className="mt-2 rounded-lg border border-[#C8323C]/30 bg-[#C8323C]/10 px-3 py-2">
                          <p className="font-body text-[12px] text-[#C8323C] font-semibold">El reglamento del edificio prohíbe arriendo por noches. Esto puede generar multas y problemas legales.</p>
                        </div>
                      )}
                      {form.edificioPermiteAirbnb === "no_seguro" && (
                        <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                          Revisa el Reglamento de Copropiedad antes de publicar en Airbnb.
                        </p>
                      )}
                    </div>

                    {/* Costos operativos */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setCostosOpen(!costosOpen)}
                        className="flex w-full items-center justify-between py-2"
                      >
                        <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Costos operativos mensuales</span>
                        <span className={`text-[var(--franco-text-muted)] text-sm transition-transform ${costosOpen ? "rotate-180" : ""}`}>↓</span>
                      </button>
                      {!costosOpen && (
                        <p className="font-body text-[11px] text-[var(--franco-text-muted)]">
                          Total: {fmtCLP(
                            Number(form.costoElectricidad) + Number(form.costoAgua) +
                            Number(form.costoWifi) + Number(form.costoInsumos)
                          )}/mes (pre-llenados por tipología)
                        </p>
                      )}
                      {costosOpen && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <FieldLabel tip={TIPS.electricidad}>Electricidad</FieldLabel>
                            <MoneyInput
                              id="costoElectricidad"
                              value={form.costoElectricidad}
                              onChange={(v) => setFieldWithEdit("costoElectricidad", v)}
                              placeholder="35.000"
                            />
                          </div>
                          <div>
                            <FieldLabel tip={TIPS.agua}>Agua</FieldLabel>
                            <MoneyInput
                              id="costoAgua"
                              value={form.costoAgua}
                              onChange={(v) => setFieldWithEdit("costoAgua", v)}
                              placeholder="8.000"
                            />
                          </div>
                          <div>
                            <FieldLabel tip={TIPS.wifi}>WiFi/Cable</FieldLabel>
                            <MoneyInput
                              id="costoWifi"
                              value={form.costoWifi}
                              onChange={(v) => setFieldWithEdit("costoWifi", v)}
                              placeholder="22.000"
                            />
                          </div>
                          <div>
                            <FieldLabel tip={TIPS.insumos}>Insumos</FieldLabel>
                            <MoneyInput
                              id="costoInsumos"
                              value={form.costoInsumos}
                              onChange={(v) => setFieldWithEdit("costoInsumos", v)}
                              placeholder="20.000"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mantención */}
                    <div>
                      <FieldLabel tip={TIPS.mantencion}>Mantención mensual</FieldLabel>
                      <MoneyInput
                        id="mantencion"
                        value={form.mantencion}
                        onChange={(v) => setFieldWithEdit("mantencion", v)}
                        placeholder="11.000"
                      />
                    </div>

                    {/* Amoblamiento */}
                    <div>
                      <FieldLabel tip={TIPS.amoblamiento}>¿Está amoblado?</FieldLabel>
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

                    {!form.estaAmoblado && (
                      <div>
                        <FieldLabel>Costo amoblamiento</FieldLabel>
                        <MoneyInput
                          id="costoAmoblamiento"
                          value={form.costoAmoblamiento}
                          onChange={(v) => setFieldWithEdit("costoAmoblamiento", v)}
                          placeholder="3.500.000"
                        />
                        <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                          Incluye muebles, electrodomésticos, decoración, menaje.
                        </p>
                      </div>
                    )}

                    {/* Arriendo largo (comparativa) — solo si modo STR puro, en "both" se toma del campo LTR */}
                    {form.modalidad === "str" && (
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <label className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Arriendo largo plazo ({fieldCurrency.arriendoLargo === "UF" ? "UF" : "$"})</label>
                          <InfoTooltip content={TIPS.arriendoLargo} />
                        </div>
                        {arriendoSugerido && !form.arriendoLargo && (
                          <span
                            className="font-mono text-[11px] text-[#C8323C] cursor-pointer hover:underline"
                            onClick={() => {
                              setFieldCurrency((prev) => ({ ...prev, arriendoLargo: "CLP" }));
                              setField("arriendoLargo", String(arriendoSugerido));
                            }}
                          >
                            Sugerencia: {fmtCLP(arriendoSugerido)} ↗
                          </span>
                        )}
                      </div>
                      <MoneyInput
                        id="arriendoLargo"
                        value={form.arriendoLargo}
                        onChange={(v) => setField("arriendoLargo", v)}
                        placeholder="450.000"
                        currency={fieldCurrency.arriendoLargo}
                        onCurrencyToggle={() => toggleFieldCurrency("arriendoLargo")}
                        required
                      />
                      <p className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
                        Franco compara la renta corta contra este arriendo tradicional.
                      </p>
                    </div>
                    )}
                  </div>
                )}

                {/* Mini-resumen + Submit */}
                <div className="mt-5">
                  <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3 mb-3">
                    <p className="font-body text-[12px] text-[var(--franco-text-muted)]">
                      Depto {form.dormitorios || "–"}D{form.banos || "–"}B en {form.comuna || "–"}, {calc.precioUF > 0 ? fmtUF(calc.precioUF) : "–"} — {form.modalidad === "ltr" ? "Renta larga" : form.modalidad === "str" ? "Renta corta" : "Comparar ambas"}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={loading || !canAdvance}
                    onClick={handleSubmit}
                    className="w-full py-3.5 rounded-xl bg-[#C8323C] text-white font-body text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-[#B02A34] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Calculando...</>
                    ) : (
                      <>Analizar rentabilidad</>
                    )}
                  </button>
                  <p className="text-center font-body text-[11px] text-[var(--franco-text-muted)] mt-2">
                    Análisis con datos reales de mercado
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Navigation buttons (not on step 3, which auto-advances) */}
          {currentStep !== 3 && (
            <div className="flex items-center justify-between mt-6">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
                >
                  ← Atrás
                </button>
              ) : (
                <div />
              )}
              {currentStep < 4 && (
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={goNext}
                  className="bg-[var(--franco-text)] text-[var(--franco-bg)] font-body text-sm font-bold px-6 py-2.5 rounded-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              )}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
