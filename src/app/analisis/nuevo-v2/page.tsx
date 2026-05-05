"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { Loader2 } from "lucide-react";
import { AppNav } from "@/components/chrome/AppNav";
import { LoadingEditorial } from "@/components/analysis/LoadingEditorial";
import { estimarContribuciones } from "@/lib/contribuciones";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { WizardStepper } from "@/components/formulario-v3/WizardStepper";
import { Paso1Propiedad } from "@/components/formulario-v3/Paso1Propiedad";
import { Paso2Financiamiento } from "@/components/formulario-v3/Paso2Financiamiento";
import { Paso3Modalidad, type TierInfo } from "@/components/formulario-v3/Paso3Modalidad";
import { useAirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";
import {
  DEFAULT_STATE,
  antiguedadToNumber,
  mesesHastaEntrega,
  parseDecimalLocale,
  parseNum,
  type WizardV3State,
} from "@/components/formulario-v3/wizardV3State";

const UF_CLP_FALLBACK = 38800;
const DRAFT_KEY = "franco_wizard_v3_draft";
const LEGACY_V2_KEY = "franco_draft_v2";
const MIGRATION_FLAG = "franco_draft_v2_migrated_to_v3";
const GUEST_LS_KEY = "franco_guest_analysis_v2";

export default function NuevoAnalisisV3Page() {
  const router = useRouter();
  const posthog = usePostHog();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ufCLP, setUfCLP] = useState(UF_CLP_FALLBACK);
  // Tasa hipotecaria de mercado (referencia para subsidio + microcopy).
  // Se actualiza desde /api/config?key=tasa_hipotecaria. Independiente de
  // state.tasaInteres (que puede ser editada por el user).
  const [tasaMercado, setTasaMercado] = useState<number>(4.72);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const initialized = useRef(false);

  const [state, setState] = useState<WizardV3State>(DEFAULT_STATE);
  const patch = useCallback((p: Partial<WizardV3State>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Suggestions from /api/data/suggestions
  const [suggestions, setSuggestions] = useState<{
    arriendo: number | null;
    gastos: number | null;
    contribuciones: number | null;
    precioM2UF: number | null;   // UF/m² sugerido (para cálculo de precioSugeridoUF)
    precioM2SampleSize: number | null; // n comparables del fetch de venta (para hint)
    sampleSize: number;
    radiusUsed: number | null;
    totalInRadius: number;
    // Shape "cruda": lat/lng pueden venir null desde el backend cuando la
    // propiedad no tiene geolocalización. El filtro estricto vive en MapaThumbnail
    // para poder loggear la proporción raw/válidos.
    nearbyProperties: Array<{ lat: number | null; lng: number | null }>;
  }>({
    arriendo: null, gastos: null, contribuciones: null, precioM2UF: null,
    precioM2SampleSize: null,
    sampleSize: 0, radiusUsed: null, totalInRadius: 0, nearbyProperties: [],
  });

  // ─── AirROI prefetch — solo cuando modalidad ∈ {str, both} (Ronda 2b) ──
  // El hook es no-op si !enabled. Cache server-side 90 días en el endpoint.
  const airRoi = useAirRoiSuggestion({
    enabled: state.modalidad === "str" || state.modalidad === "both",
    direccion: state.direccion,
    dormitorios: Number(state.dormitorios) || 2,
    banos: Number(state.banos) || 1,
    capacidadHuespedes: Number(state.capacidadHuespedes) || 2,
    ufClp: ufCLP,
  });

  // ─── Mount: migrate v2 draft, load v3 draft, fetch UF + tasa + tier ──
  useEffect(() => {
    // 1) Migración de draft viejo (una sola vez)
    try {
      if (!localStorage.getItem(MIGRATION_FLAG)) {
        localStorage.removeItem(LEGACY_V2_KEY);
        localStorage.setItem(MIGRATION_FLAG, "true");
      }
    } catch { /* ignore */ }

    // 2) Cargar draft v3 si existe
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") {
          setState((prev) => ({ ...prev, ...draft }));
        }
      }
    } catch { /* ignore */ }
    initialized.current = true;

    // 3) Fetch UF del día + tasa hipotecaria + tier del usuario
    fetch("/api/uf").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.value) setUfCLP(Number(d.value));
    }).catch(() => { /* use fallback */ });

    fetch("/api/config?key=tasa_hipotecaria").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.value) {
        const n = Number(d.value);
        if (Number.isFinite(n)) setTasaMercado(n);
        // Normalizar a coma chilena en display. parseDecimalLocale maneja
        // ambos formatos al consumirla, pero el render del input es literal.
        const tasaStr = String(d.value).replace(".", ",");
        setState((prev) => prev.tasaInteres === DEFAULT_STATE.tasaInteres
          ? { ...prev, tasaInteres: tasaStr }
          : prev);
      }
    }).catch(() => { /* keep default */ });

    fetch("/api/me/tier").then((r) => r.ok ? r.json() : null).then((d: TierInfo | null) => {
      setTierInfo(d ?? { tier: "guest", isAdmin: false, credits: 0, email: null });
      setIsLoggedIn(d?.tier !== "guest");
    }).catch(() => {
      setTierInfo({ tier: "guest", isAdmin: false, credits: 0, email: null });
      setIsLoggedIn(false);
    });
  }, []);

  // ─── Persist draft (debounced) ──
  useEffect(() => {
    if (!initialized.current) return;
    if (!state.direccion && !state.precio) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [state]);

  // ─── Fetch market suggestions when key inputs change ──
  // Objetivo doble: (1) obtener conteo de comparables apenas haya dirección,
  // incluso sin superficie ingresada; (2) prefill arriendo/gastos/contribuciones
  // solo cuando hay superficie real.
  useEffect(() => {
    if (!state.comuna) return;
    const sup = parseDecimalLocale(state.superficieUtil);
    const supForFetch = sup > 0 ? sup : 50; // default p/ conteo; no prefill cuando sup=0
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      comuna: state.comuna,
      superficie: String(supForFetch),
      dormitorios: state.dormitorios || "2",
    });
    if (state.lat && state.lng) {
      params.set("lat", String(state.lat));
      params.set("lng", String(state.lng));
    }
    if (state.precio) {
      params.set("precioUF", state.precio);
    }
    // Segundo fetch paralelo con type=venta para obtener UF/m² sale y así poder
    // mostrar la sugerencia de precio en paso 2. Opcional — si falla se ignora.
    const paramsVenta = new URLSearchParams(params);
    paramsVenta.set("type", "venta");
    const ventaPromise = fetch(`/api/data/suggestions?${paramsVenta}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null);

    fetch(`/api/data/suggestions?${params}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : null)
      .then(async (d) => {
        if (!d) return;
        const venta = await ventaPromise;
        // Contribuciones: SIEMPRE desde fórmula SII con precio declarado.
        // Nunca usar d.contribTrim del backend: allí viene calculado desde el
        // median(preciosM2) de arriendos, que no representa el valor del depto.
        const precioCLP = (parseNum(state.precio) || 0) * ufCLP;
        const contribSugerida = precioCLP > 0
          ? estimarContribuciones(precioCLP, state.tipoPropiedad === "nuevo")
          : null;
        const sampleSize = d.filteredInRadius ?? d.sampleSize ?? 0;
        const radiusUsed = d.radiusUsed ?? d.radiusMeters ?? null;
        const totalInRadius = d.totalInRadius ?? 0;
        // Pasar nearbyProperties crudo (con nulls). El filtro estricto vive en
        // MapaThumbnail para que pueda loggear cuántos se descartaron.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nearbyProperties: Array<{ lat: number | null; lng: number | null }> = Array.isArray(d.nearbyProperties)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? d.nearbyProperties.map((p: any) => ({
              lat: p?.lat ?? null,
              lng: p?.lng ?? null,
            }))
          : [];
        // venta.precioM2 viene en la misma unidad que el campo `precio` crudo de
        // scraped_properties con type=venta. Evidencia del form v2 legacy
        // (`ventaRef.precioM2 / UF_CLP`) confirma que está en CLP/m² en la
        // práctica. Convertimos a UF/m² dividiendo por ufCLP.
        const precioM2UF: number | null = venta && Number.isFinite(venta.precioM2) && venta.precioM2 > 0 && ufCLP > 0
          ? Number(venta.precioM2) / ufCLP
          : null;
        const precioM2SampleSize: number | null = venta
          ? (venta.sampleSize ?? venta.filteredInRadius ?? null)
          : null;
        if (venta && venta.precioM2 !== undefined) {
          console.info("[MapaPrecio]", {
            raw_precioM2: venta.precioM2,
            ufCLP,
            calculado_UF_m2: precioM2UF,
            sampleSize: venta.sampleSize ?? venta.filteredInRadius,
          });
        }
        // GGCC: si el RPC no tiene datos (comparables sin gastos), usar fallback
        // por tier de comuna — mejor mostrar estimación realista que un "—".
        const gastosFinal = sup > 0
          ? (d.ggcc ?? getGgccFallback(state.comuna, sup))
          : null;
        const next = {
          arriendo: sup > 0 ? (d.arriendo ?? null) : null,
          gastos: gastosFinal,
          contribuciones: sup > 0 ? contribSugerida : null,
          precioM2UF,
          precioM2SampleSize,
          sampleSize,
          radiusUsed,
          totalInRadius,
          nearbyProperties,
        };
        setSuggestions(next);

        // Prefill reactivo: siempre que cambia la sugerencia, actualizamos los
        // campos inferibles salvo que el usuario los haya editado explícitamente
        // (editedFields). Drop del guard "!prev.X" que hacía el prefill one-shot
        // y causaba desincronización cuando cambiaba el precio (contribuciones).
        setState((prev) => {
          const patchObj: Partial<WizardV3State> = {
            sampleSize,
            radiusUsed,
          };
          if (sup > 0) {
            if (next.arriendo && !prev.editedFields.includes("arriendo")) {
              patchObj.arriendo = String(next.arriendo);
            }
            if (next.gastos && !prev.editedFields.includes("gastos")) {
              patchObj.gastos = String(next.gastos);
            }
            if (next.contribuciones && !prev.editedFields.includes("contribuciones")) {
              patchObj.contribuciones = String(next.contribuciones);
            }
          }
          return { ...prev, ...patchObj };
        });
      })
      .catch(() => { /* ignore aborts/errors */ });
    return () => ctrl.abort();
  }, [state.comuna, state.superficieUtil, state.dormitorios, state.lat, state.lng, state.precio, state.tipoPropiedad, ufCLP]);

  // ─── Step validation ──
  const canAdvanceFromStep1 = !!(state.direccion && state.comuna && state.tipoPropiedad
    && parseDecimalLocale(state.superficieUtil) > 0);
  const canAdvanceFromStep2 = parseNum(state.precio) > 0;

  function goNext() {
    if (step === 1 && canAdvanceFromStep1) { setSlideDir("left"); setStep(2); }
    else if (step === 2 && canAdvanceFromStep2) { setSlideDir("left"); setStep(3); }
  }
  function goBack() {
    setSlideDir("right");
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function handleCancel() {
    if (typeof window === "undefined") return;
    if (window.confirm("¿Descartar el análisis? Se perderán los datos ingresados.")) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      router.push("/dashboard");
    }
  }

  // En paso 3, si hay modalidad elegida el "back" limpia la selección y mantiene
  // al usuario en paso 3 (permite elegir otra). Si no hay modalidad, va a paso 2.
  function goBackStep3() {
    if (state.modalidad) {
      patch({ modalidad: null });
    } else {
      goBack();
    }
  }

  // ─── Submit (bifurcación LTR / STR / AMBAS — Ronda 2a) ──
  // Modalidad LTR: POST /api/analisis (gratis, no consume créditos).
  // Modalidad STR: POST /api/analisis/short-term (consume 1 crédito).
  // Modalidad AMBAS: Promise.allSettled de ambos. No atómico — si STR falla
  //   por falta de crédito, LTR sí se crea y user va a results LTR con flag
  //   de partial en sessionStorage para que el destino muestre toast.
  async function handleAnalizar() {
    setSubmitError("");
    setSubmitting(true);
    try {
      const mod = state.modalidad;
      if (!mod) {
        throw new Error("Elige una modalidad para continuar");
      }

      // ─── Helpers compartidos ──
      // Parser que respeta el 0 explícito (studios, sin estac, sin bodega)
      // pero usa fallback si el campo está vacío / inválido. Crítico para el
      // caso B4 de la auditoría: `Number("0") || fallback` era falsy y
      // sobrescribía 0 con 2.
      const parseIntSafe = (v: string, fallback: number): number => {
        if (v === "" || v == null) return fallback;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
      };
      const supUtil = parseDecimalLocale(state.superficieUtil);
      const precioUF = parseNum(state.precio);
      const precioCompraCLP = Math.round(precioUF * ufCLP);
      const nEstac = parseIntSafe(state.estacionamientos, 0);
      const nBodega = parseIntSafe(state.bodegas, 0);
      const antigNum = state.tipoPropiedad === "usado" ? antiguedadToNumber(state.antiguedad) : 0;
      // En Nuevo+Futura: respetar state.cuotasPie si el usuario lo editó; sino
      // usar la sugerencia basada en meses hasta entrega.
      const cuotasPie = state.tipoPropiedad === "nuevo" && state.estadoVenta === "futura"
        ? (Number(state.cuotasPie) || mesesHastaEntrega(state.fechaEntregaMes, state.fechaEntregaAnio))
        : state.tipoPropiedad === "nuevo" && state.pieModoPago === "cuotas"
          ? Number(state.cuotasPie) || 1
          : state.tipoPropiedad === "nuevo" ? 1 : 0;
      const pieUF = precioUF * (Number(state.piePct) / 100);
      const nombre = `Depto ${state.dormitorios || "2"}D${state.banos || "1"}B ${state.comuna}`;

      const arriendo = Number(state.arriendo) || 0;
      const gastos = Number(state.gastos) || 0;
      const contribuciones = Number(state.contribuciones) || 0;

      // ─── Payload LTR (idéntico a v3 pre-bifurcación) ──
      const ltrPayload = {
        nombre,
        comuna: state.comuna,
        ciudad: state.ciudad || "Santiago",
        direccion: state.direccion || undefined,
        tipo: "Departamento",
        dormitorios: parseIntSafe(state.dormitorios, 2),
        esStudio: state.esStudio === true,
        banos: parseIntSafe(state.banos, 1),
        superficie: supUtil,
        superficieTotal: supUtil,
        antiguedad: antigNum,
        enConstruccion: state.estadoVenta !== "inmediata",
        piso: 0,
        estacionamiento: nEstac > 0 ? "si" : "no",
        cantidadEstacionamientos: nEstac,
        precioEstacionamiento: 0,
        bodega: nBodega > 0,
        cantidadBodegas: nBodega,
        estadoVenta: state.estadoVenta === "futura" ? "futura" : "inmediata",
        fechaEntrega: state.estadoVenta === "futura"
          ? `${state.fechaEntregaAnio}-${state.fechaEntregaMes}`
          : undefined,
        cuotasPie,
        montoCuota: cuotasPie > 0 ? Math.round((pieUF / cuotasPie) * ufCLP) : 0,
        precio: precioUF,
        // Valor de mercado de referencia — crítico para que el motor no caiga
        // al fallback `input.precio`. Sin este campo, vmFrancoUF === precioUF,
        // plusvaliaInmediataFranco === 0, y la narrativa IA se confunde entre
        // el indicador por m² y el absoluto.
        valorMercadoFranco: suggestions.precioM2UF && supUtil > 0
          ? Math.round(suggestions.precioM2UF * supUtil)
          : undefined,
        valorMercadoUsuario: undefined, // no se pregunta en v3
        piePct: Number(state.piePct),
        plazoCredito: Number(state.plazoCredito),
        tasaInteres: parseDecimalLocale(state.tasaInteres) || 4.72,
        gastos,
        contribuciones,
        provisionMantencion: Math.round((precioUF * ufCLP * getMantencionRate(antigNum)) / 12),
        tipoRenta: "larga",
        arriendo,
        arriendoEstacionamiento: Number(state.arriendoEstac) || 0,
        arriendoBodega: Number(state.arriendoBodega) || 0,
        vacanciaMeses: Number(state.vacanciaPct) * 12 / 100,
        usaAdministrador: Number(state.adminPct) > 0,
        comisionAdministrador: Number(state.adminPct) > 0 ? Number(state.adminPct) : undefined,
        zonaRadio: {
          precioM2VentaCLP: null,
          arriendoPromedio: suggestions.arriendo,
          arriendoPrecioM2: null,
          sampleSizeArriendo: suggestions.sampleSize,
          sampleSizeVenta: 0,
          radioMetros: suggestions.radiusUsed ?? 500,
          lat: state.lat,
          lng: state.lng,
        },
      };

      // ─── Payload STR (Ronda 2a — usa defaults del state cuando UI no
      // expone aún el input. Inputs específicos STR llegan en Ronda 2b.) ──
      // Convenciones del endpoint /api/analisis/short-term:
      //   - body.piePct y body.tasaInteres en %, el endpoint divide por 100
      //   - body.comisionAdministrador en decimal (0.20 = 20%)
      //   - body.precioCompra en CLP, body.precioCompraUF en UF
      const strPayload = {
        // Identificación + propiedad
        direccion: state.direccion || "",
        comuna: state.comuna,
        ciudad: state.ciudad || "Santiago",
        tipoPropiedad: state.tipoPropiedad,
        lat: state.lat,
        lng: state.lng,
        dormitorios: parseIntSafe(state.dormitorios, 2),
        banos: parseIntSafe(state.banos, 1),
        superficieUtil: supUtil,
        capacidadHuespedes: parseIntSafe(state.capacidadHuespedes, 2),

        // Financiamiento (compartido con LTR)
        precioCompra: precioCompraCLP,
        precioCompraUF: precioUF,
        piePct: Number(state.piePct),
        tasaInteres: parseDecimalLocale(state.tasaInteres) || 4.72,
        plazoCredito: Number(state.plazoCredito),

        // Operación Airbnb
        modoGestion: state.modoGestion,
        comisionAdministrador: state.modoGestion === "administrador"
          ? (parseDecimalLocale(state.comisionAdminPct) / 100)
          : 0.20,
        edificioPermiteAirbnb: state.edificioPermiteAirbnb,

        // Costos operativos mensuales
        costoElectricidad: Number(state.costoElectricidad) || 0,
        costoAgua: Number(state.costoAgua) || 0,
        costoWifi: Number(state.costoWifi) || 0,
        costoInsumos: Number(state.costoInsumos) || 0,
        gastosComunes: gastos,
        mantencion: Number(state.mantencionMensual) || 0,
        contribuciones,

        // Inversión inicial
        estaAmoblado: state.estaAmoblado,
        costoAmoblamiento: Number(state.costoAmoblamiento) || 0,

        // Comparativa
        arriendoLargoMensual: arriendo,
      };

      // ─── Sub-funciones de POST (const arrow para strict-mode ES5) ──
      type AnalisisRow = { id: string };
      const postLTR = async (): Promise<AnalisisRow> => {
        const res = await fetch("/api/analisis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ltrPayload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Error al crear el análisis LTR");
        }
        return res.json();
      };
      const postSTR = async (): Promise<AnalisisRow> => {
        const res = await fetch("/api/analisis/short-term", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(strPayload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Error al crear el análisis STR");
        }
        return res.json();
      };

      // ─── Cleanup compartido (draft, guest LS, posthog) ──
      const cleanup = (ids: string[], modKey: string) => {
        try {
          localStorage.removeItem(DRAFT_KEY);
          if (!isLoggedIn && ids.length > 0) {
            localStorage.setItem(GUEST_LS_KEY, JSON.stringify({ ids, timestamp: Date.now() }));
          }
        } catch { /* ignore */ }
        posthog?.capture("wizard_v3_analysis_created", {
          comuna: state.comuna,
          modalidad: modKey,
          tipo: state.tipoPropiedad,
          editedFieldsCount: state.editedFields.length,
        });
      };

      // ─── Bifurcación por modalidad ──
      if (mod === "ltr") {
        const data = await postLTR();
        cleanup([data.id], "ltr");
        router.push(`/analisis/${data.id}`);
        return;
      }

      if (mod === "str") {
        const data = await postSTR();
        cleanup([data.id], "str");
        router.push(`/analisis/renta-corta/${data.id}`);
        return;
      }

      // mod === "both" — Promise.allSettled, no atómico
      const [ltrRes, strRes] = await Promise.allSettled([postLTR(), postSTR()]);
      const ltrOk = ltrRes.status === "fulfilled";
      const strOk = strRes.status === "fulfilled";

      if (ltrOk && strOk) {
        cleanup([ltrRes.value.id, strRes.value.id], "both");
        router.push(`/analisis/comparativa?ltr=${ltrRes.value.id}&str=${strRes.value.id}`);
        return;
      }
      if (ltrOk && !strOk) {
        const errMsg = strRes.status === "rejected"
          ? (strRes.reason instanceof Error ? strRes.reason.message : String(strRes.reason))
          : "STR falló";
        try {
          sessionStorage.setItem(
            "franco_both_partial",
            JSON.stringify({ ok: "ltr", failed: "str", error: errMsg }),
          );
        } catch { /* ignore */ }
        cleanup([ltrRes.value.id], "both-partial-ltr");
        router.push(`/analisis/${ltrRes.value.id}`);
        return;
      }
      if (!ltrOk && strOk) {
        const errMsg = ltrRes.status === "rejected"
          ? (ltrRes.reason instanceof Error ? ltrRes.reason.message : String(ltrRes.reason))
          : "LTR falló";
        try {
          sessionStorage.setItem(
            "franco_both_partial",
            JSON.stringify({ ok: "str", failed: "ltr", error: errMsg }),
          );
        } catch { /* ignore */ }
        cleanup([strRes.value.id], "both-partial-str");
        router.push(`/analisis/renta-corta/${strRes.value.id}`);
        return;
      }
      // Ambos fallaron
      const ltrErr = ltrRes.status === "rejected"
        ? (ltrRes.reason instanceof Error ? ltrRes.reason.message : String(ltrRes.reason))
        : "LTR falló";
      const strErr = strRes.status === "rejected"
        ? (strRes.reason instanceof Error ? strRes.reason.message : String(strRes.reason))
        : "STR falló";
      throw new Error(`Ambos análisis fallaron — LTR: ${ltrErr}. STR: ${strErr}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado");
      setSubmitting(false);
    }
  }

  const titleByStep = {
    1: { title: "Ingresa los datos de la propiedad", sub: "Con dirección y superficie ya podemos inferir lo demás." },
    2: { title: "¿Cómo la compras?", sub: "Precio y pie. Tasa y plazo los asignamos nosotros — podrás ajustarlos en el siguiente paso." },
    3: { title: "Último paso", sub: "Confirma la modalidad y revisa el resumen." },
  }[step];

  // Overlay full-page durante submit (30-60s). Cubre la ventana real sin
  // feedback — el POST /api/analisis tarda en server-side y antes el user
  // veía solo un spinner inline en el botón "Analizar ahora".
  if (submitting) {
    return <LoadingEditorial />;
  }

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <AppNav variant="app" />

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Header + stepper */}
        <div className="mb-10">
          <WizardStepper current={step} />
          <div className="mt-5">
            <h1 className="font-heading text-2xl md:text-[32px] font-bold text-[var(--franco-text)] m-0 mb-1.5 leading-tight">
              {titleByStep.title}
            </h1>
            <p className="font-body text-sm md:text-base text-[var(--franco-text-secondary)] m-0">
              {titleByStep.sub}
            </p>
          </div>
        </div>

        {/* Step content with slide transition */}
        <div className="overflow-hidden">
          <div
            key={step}
            className={`transition-all duration-300 ease-out ${slideDir === "left" ? "animate-slide-left" : "animate-slide-right"}`}
            style={{ willChange: "transform, opacity" }}
          >
            {step === 1 && (
              <Paso1Propiedad
                state={state}
                setState={patch}
                comparablesCount={suggestions.totalInRadius}
                comparables={suggestions.nearbyProperties}
              />
            )}
            {step === 2 && (
              <Paso2Financiamiento
                state={state}
                setState={patch}
                ufCLP={ufCLP}
                tasaMercado={tasaMercado}
                precioM2UF={suggestions.precioM2UF}
                precioM2SampleSize={suggestions.precioM2SampleSize}
              />
            )}
            {step === 3 && (
              <Paso3Modalidad
                state={state}
                setState={patch}
                ufCLP={ufCLP}
                tierInfo={tierInfo}
                suggestions={{
                  arriendo: suggestions.arriendo,
                  arriendoSampleSize: suggestions.sampleSize,
                  gastos: suggestions.gastos,
                  contribuciones: suggestions.contribuciones,
                }}
                airRoi={airRoi}
                onEditarPaso2={() => { setSlideDir("right"); setStep(2); }}
                onAnalizar={handleAnalizar}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>
        </div>

        {/* Footer unificado: "Cancelar" siempre visible en los 3 pasos.
            "← Atrás" oculto en paso 1. En paso 3 con modalidad elegida, el "← Atrás"
            se transforma en "← Cambiar modalidad" y solo limpia la selección.
            El CTA principal del paso 3 ("Analizar ahora →") sigue viviendo dentro
            de Paso3Modalidad — aquí solo renderizamos la fila de secondary actions. */}
        <div
          className="mt-8 pt-6 flex items-center justify-between gap-3"
          style={{ borderTop: "0.5px solid var(--franco-border)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
            >
              Cancelar
            </button>
            {step > 1 && (
              <button
                type="button"
                onClick={step === 3 ? goBackStep3 : goBack}
                className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
              >
                {step === 3 && state.modalidad ? "← Cambiar modalidad" : "← Atrás"}
              </button>
            )}
          </div>
          {step < 3 && (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 1 ? !canAdvanceFromStep1 : !canAdvanceFromStep2}
              className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          )}
        </div>

        {/* Loading indicator for initial data */}
        {!tierInfo && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 font-body text-[11px] text-[var(--franco-text-muted)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Cargando datos del usuario…
          </div>
        )}
      </main>

      {/* Slide keyframes via Tailwind-friendly inline style tag */}
      <style jsx global>{`
        @keyframes slideLeft {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideRight {
          from { transform: translateX(-16px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-left  { animation: slideLeft  300ms ease-out; }
        .animate-slide-right { animation: slideRight 300ms ease-out; }
      `}</style>
    </div>
  );
}

function getMantencionRate(antiguedad: number): number {
  if (antiguedad <= 2) return 0.003;
  if (antiguedad <= 5) return 0.005;
  if (antiguedad <= 10) return 0.008;
  if (antiguedad <= 15) return 0.01;
  if (antiguedad <= 20) return 0.013;
  return 0.015;
}
