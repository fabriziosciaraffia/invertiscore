"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { Loader2, AlertTriangle } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";

// Per-source storage + return-URL map. Keep in sync with the form files.
// v1 = /analisis/nuevo (classic form)
// v2 = /analisis/nuevo-v2 (wizard)
type RevisarSource = "v1" | "v2";

const SOURCE_CONFIG: Record<RevisarSource, {
  draftKey: string;
  guestKey: string;
  formUrl: string;
}> = {
  v1: {
    draftKey: "franco_form_draft",
    guestKey: "franco_guest_analysis",
    formUrl: "/analisis/nuevo",
  },
  v2: {
    draftKey: "franco_draft_v2",
    guestKey: "franco_guest_analysis_v2",
    formUrl: "/analisis/nuevo-v2",
  },
};

// ─── Contract ────────────────────────────────────────
// Sessionstorage key shared with the form and /analisis/nuevo/revisar.
export const REVISAR_SS_KEY = "franco:revisar:v1";
export const HYDRATE_FORM_FLAG = "franco:revisar:hydrate-form";

export interface RevisarDisplayMeta {
  direccionFull: string;
  comunaLabel: string;
  tipoLabel: string;
  estadoLabel: string;
  superficieM2: number;
  UF_CLP: number;
  vmFrancoUF: number | null;
  arriendoRangeBase: number | null;
}

export interface RevisarPayload {
  apiPayload: Record<string, unknown>;
  displayMeta: RevisarDisplayMeta;
  formState?: Record<string, unknown>;
  source?: RevisarSource;
}

export interface TierInfo {
  tier: "guest" | "free" | "premium" | "subscriber";
  isAdmin: boolean;
  credits: number;
  email: string | null;
}

// ─── Helpers ─────────────────────────────────────────
function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtCLPShort(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

// ─── Tier copy ───────────────────────────────────────
function tierCopy(info: TierInfo): { costo: string; plan: string; costoColor: string } {
  if (info.isAdmin) {
    return {
      costo: "Análisis gratis (admin)",
      plan: "ADMIN",
      costoColor: "var(--franco-text-secondary)",
    };
  }
  if (info.tier === "subscriber") {
    return {
      costo: "Incluido en tu suscripción FrancoMensual",
      plan: "FRANCOMENSUAL",
      costoColor: "var(--franco-v-buy)",
    };
  }
  if (info.tier === "premium" && info.credits > 0) {
    return {
      costo: `Usarás 1 de tus ${info.credits} créditos Pro`,
      plan: `PRO · ${info.credits} crédito${info.credits === 1 ? "" : "s"}`,
      costoColor: "var(--franco-v-adjust)",
    };
  }
  if (info.tier === "free") {
    return {
      costo: "Usarás tu crédito gratis de bienvenida",
      plan: "GRATUITO",
      costoColor: "var(--franco-v-adjust)",
    };
  }
  return {
    costo: "Análisis gratuito (modo invitado)",
    plan: "INVITADO",
    costoColor: "var(--franco-text-secondary)",
  };
}

// ─── Component ───────────────────────────────────────
export function ResumenConfirmacion({
  payload,
  tierInfo,
}: {
  payload: RevisarPayload;
  tierInfo: TierInfo;
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const { displayMeta, apiPayload } = payload;
  const sourceCfg = SOURCE_CONFIG[payload.source ?? "v1"];
  const { UF_CLP, vmFrancoUF, arriendoRangeBase, superficieM2, comunaLabel } = displayMeta;

  // Editable state (as strings for input control)
  const [precioUF, setPrecioUF] = useState<string>(String(apiPayload.precio ?? ""));
  const [arriendo, setArriendo] = useState<string>(String(apiPayload.arriendo ?? ""));
  const [piePct, setPiePct] = useState<string>(String(apiPayload.piePct ?? "20"));
  const [plazoCredito, setPlazoCredito] = useState<string>(String(apiPayload.plazoCredito ?? "25"));
  const [tasaInteres, setTasaInteres] = useState<string>(String(apiPayload.tasaInteres ?? "4.72"));

  // Validation state
  const [arriendoDirty, setArriendoDirty] = useState(false);
  const [precioDirty, setPrecioDirty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  // Derived: alert on arriendo if > 20% below suggested
  const arriendoNum = Number(arriendo) || 0;
  const arriendoLow = arriendoRangeBase !== null
    && arriendoRangeBase > 0
    && arriendoNum > 0
    && arriendoNum < arriendoRangeBase * 0.8;
  const arriendoRangeMin = arriendoRangeBase !== null ? Math.round(arriendoRangeBase * 0.8) : 0;
  const arriendoRangeMax = arriendoRangeBase !== null ? Math.round(arriendoRangeBase * 1.2) : 0;

  // Derived: alert on precio if > 15% above vmFranco
  const precioNum = Number(precioUF) || 0;
  const precioHigh = vmFrancoUF !== null
    && vmFrancoUF > 0
    && precioNum > 0
    && precioNum > vmFrancoUF * 1.15;

  const tieneAlerta = (arriendoDirty && arriendoLow) || (precioDirty && precioHigh);

  const precioCLP = precioNum * UF_CLP;
  const piePctNum = Number(piePct) || 20;
  const plazoNum = Number(plazoCredito) || 25;
  const tasaNum = Number(tasaInteres) || 4.72;
  const dividendo = useMemo(
    () => calcDividendo(precioNum, piePctNum, plazoNum, tasaNum, UF_CLP),
    [precioNum, piePctNum, plazoNum, tasaNum, UF_CLP],
  );

  const { costo, plan, costoColor } = tierCopy(tierInfo);

  // ─── Actions ─────────────────────────────────────
  function applyEditsToPayload(): Record<string, unknown> {
    const cuotasPie = Number(apiPayload.cuotasPie) || 0;
    const pieUF = precioNum * (piePctNum / 100);
    const montoCuota = cuotasPie > 0 ? Math.round((pieUF / cuotasPie) * UF_CLP) : 0;
    return {
      ...apiPayload,
      precio: precioNum,
      arriendo: arriendoNum,
      piePct: piePctNum,
      plazoCredito: plazoNum,
      tasaInteres: tasaNum,
      montoCuota,
    };
  }

  function handleVolver() {
    // Write the edited payload back to sessionStorage and flag hydration
    if (typeof window !== "undefined") {
      const next: RevisarPayload = {
        ...payload,
        apiPayload: applyEditsToPayload(),
      };
      try {
        sessionStorage.setItem(REVISAR_SS_KEY, JSON.stringify(next));
        sessionStorage.setItem(HYDRATE_FORM_FLAG, "1");
      } catch {
        /* ignore */
      }
    }
    router.push(sourceCfg.formUrl);
  }

  async function handleAnalizar() {
    setSubmitError("");
    setSubmitting(true);
    try {
      const body = applyEditsToPayload();
      const res = await fetch("/api/analisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al crear el análisis");
      }
      const data = await res.json();
      try {
        sessionStorage.removeItem(REVISAR_SS_KEY);
        sessionStorage.removeItem(HYDRATE_FORM_FLAG);
        localStorage.removeItem(sourceCfg.draftKey);
        if (tierInfo.tier === "guest") {
          // v2 writes an { ids: [...] } shape; v1 writes { id }
          const guestValue = payload.source === "v2"
            ? { ids: [data.id], timestamp: Date.now() }
            : { id: data.id, timestamp: Date.now() };
          localStorage.setItem(sourceCfg.guestKey, JSON.stringify(guestValue));
        }
      } catch { /* ignore */ }
      posthog?.capture("analysis_created", {
        comuna: apiPayload.comuna,
        tipo: apiPayload.tipo,
        dormitorios: apiPayload.dormitorios,
        score: data.score,
        veredicto: data.results?.veredicto,
        is_premium: false,
        source: payload.source ?? "v1",
      });
      router.push(`/analisis/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado");
      setSubmitting(false);
    }
  }

  // ─── Shared input class ───────────────────────────
  const inputBase =
    "w-full h-10 rounded-lg border bg-[var(--franco-card)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none transition-colors";
  const inputOk = "border-[var(--franco-border)] focus:border-[#C8323C]";
  const inputAlert = "border-[#C8323C] focus:border-[#C8323C]";

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* ── Header ───────────────────────── */}
      <div className="mb-6 md:mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-2">
          PASO FINAL · ANTES DE ANALIZAR
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-[var(--franco-text)] m-0 mb-2">
          Revisa tu análisis
        </h1>
        <p className="font-body text-sm md:text-base text-[var(--franco-text-secondary)] m-0">
          Edita lo que necesites. Cuando estés listo, analiza.
        </p>
      </div>

      {/* ── Bloque 1 · PROPIEDAD ──────────── */}
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 md:p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] m-0">
            Propiedad
          </h2>
          <button
            type="button"
            onClick={handleVolver}
            className="font-body text-[12px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
          >
            ← Volver al form
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <ReadonlyField label="Dirección" value={displayMeta.direccionFull || "—"} />
          <ReadonlyField label="Comuna" value={comunaLabel || "—"} />
          <ReadonlyField
            label="Tipo"
            value={[displayMeta.tipoLabel, displayMeta.estadoLabel].filter(Boolean).join(" · ") || "—"}
          />
          <ReadonlyField label="Superficie útil" value={superficieM2 > 0 ? `${superficieM2} m²` : "—"} />
        </div>
      </div>

      {/* ── Bloque 2 · PRECIO Y ARRIENDO ──── */}
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 md:p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] m-0">
            Precio y arriendo
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded-full bg-[#C8323C]/10 text-[#C8323C] font-semibold">
            editable
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Precio */}
          <div>
            <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
              Precio de compra
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
                UF
              </span>
              <input
                type="number"
                inputMode="decimal"
                className={`${inputBase} ${precioDirty && precioHigh ? inputAlert : inputOk} pl-10`}
                value={precioUF}
                onChange={(e) => setPrecioUF(e.target.value)}
                onBlur={() => setPrecioDirty(true)}
              />
            </div>
            <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
              ≈ {fmtCLPShort(precioCLP)}
            </p>
            {precioDirty && precioHigh && vmFrancoUF && (
              <p className="font-body text-[11px] text-[#C8323C] mt-1 m-0">
                Parece sobre mercado. Referencia zona: UF {Math.round(vmFrancoUF).toLocaleString("es-CL")}
              </p>
            )}
          </div>

          {/* Arriendo */}
          <div>
            <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
              Arriendo estimado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
                $
              </span>
              <input
                type="number"
                inputMode="numeric"
                className={`${inputBase} ${arriendoDirty && arriendoLow ? inputAlert : inputOk} pl-7`}
                value={arriendo}
                onChange={(e) => setArriendo(e.target.value)}
                onBlur={() => setArriendoDirty(true)}
              />
            </div>
            {arriendoDirty && arriendoLow && arriendoRangeBase && (
              <p className="font-body text-[11px] text-[#C8323C] mt-1 m-0">
                Parece bajo para {superficieM2}m² en {comunaLabel}. Mercado: {fmtCLP(arriendoRangeMin)} – {fmtCLP(arriendoRangeMax)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bloque 3 · FINANCIAMIENTO ─────── */}
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 md:p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] m-0">
            Financiamiento
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded-full bg-[#C8323C]/10 text-[#C8323C] font-semibold">
            editable
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
          <FinInput label="Pie" suffix="%" value={piePct} onChange={setPiePct} inputBase={inputBase} inputOk={inputOk} />
          <FinInput label="Plazo" suffix="años" value={plazoCredito} onChange={setPlazoCredito} inputBase={inputBase} inputOk={inputOk} />
          <FinInput label="Tasa" suffix="%" value={tasaInteres} onChange={setTasaInteres} inputBase={inputBase} inputOk={inputOk} />
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--franco-border)] flex items-center justify-between">
          <span className="font-body text-[12px] text-[var(--franco-text-secondary)]">Dividendo estimado</span>
          <span className="font-mono text-[15px] font-semibold text-[var(--franco-text)]">
            {fmtCLP(dividendo)}/mes
          </span>
        </div>
      </div>

      {/* ── Bloque 4 · ALERTA CONDICIONAL ─── */}
      {tieneAlerta && (
        <div className="mb-4">
          <StateBox variant="left-border" state="negative" label="Antes de continuar">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#C8323C]" />
              <div>
                {arriendoDirty && arriendoLow && (
                  <p className="m-0 mb-1">
                    Tu arriendo parece bajo. Si estás seguro, sigue — pero este detalle afecta todo el análisis.
                  </p>
                )}
                {precioDirty && precioHigh && (
                  <p className="m-0">
                    El precio está sobre mercado. Si estás seguro, sigue — pero el análisis mostrará sobreprecio.
                  </p>
                )}
              </div>
            </div>
          </StateBox>
        </div>
      )}

      {/* ── Bloque 5 · COSTO TIER-AWARE ───── */}
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 md:p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] m-0 mb-1.5">
              Costo
            </p>
            <p className="font-body text-[14px] font-medium m-0" style={{ color: costoColor }}>
              {costo}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] m-0 mb-1.5">
              Plan actual
            </p>
            <p className="font-mono text-[13px] font-semibold text-[var(--franco-text)] m-0 tracking-wide">
              {plan}
            </p>
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────── */}
      {submitError && (
        <div className="mb-4">
          <StateBox variant="left-border" state="negative">
            {submitError}
          </StateBox>
        </div>
      )}

      {/* ── Bloque 6 · BOTONES ─────────────── */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={handleVolver}
          disabled={submitting}
          className="font-body font-semibold text-[14px] text-[var(--franco-text)] px-5 py-3 rounded-lg border border-[var(--franco-border-hover)] bg-transparent hover:bg-[var(--franco-card)] transition-colors min-h-[44px] disabled:opacity-60"
        >
          ← Volver al formulario
        </button>
        <button
          type="button"
          onClick={handleAnalizar}
          disabled={submitting}
          className="font-body font-semibold text-[14px] text-white px-6 py-3 rounded-lg bg-[#C8323C] hover:bg-[#B02A34] transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creando…
            </>
          ) : (
            <>Analizar ahora →</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)] m-0 mb-1">
        {label}
      </p>
      <p className="font-body text-[14px] text-[var(--franco-text)] m-0 leading-tight">
        {value}
      </p>
    </div>
  );
}

function FinInput({
  label,
  suffix,
  value,
  onChange,
  inputBase,
  inputOk,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  inputBase: string;
  inputOk: string;
}) {
  return (
    <div>
      <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          className={`${inputBase} ${inputOk} pr-12`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[var(--franco-text-muted)] pointer-events-none">
          {suffix}
        </span>
      </div>
    </div>
  );
}
