"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import { useDebouncedReady } from "@/hooks/useDebouncedReady";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import {
  calcDividendo,
  fmtCLP,
  fmtUF,
  parseDecimalLocale,
  type WizardV3State,
} from "./wizardV3State";

// 3-tier alert helper: aligned (<5%) / soft (5-15%) / strong (>15%).
// Replicado del patrón de Paso2Financiamiento (validación precio Fase 12).
// Si user o market son inválidos (≤0), retorna null → no se muestra alerta.
function calcTier(user: number, market: number) {
  if (!(user > 0 && market > 0)) return null;
  const dev = (user - market) / market;
  const absDev = Math.abs(dev);
  const tier: "aligned" | "soft" | "strong" =
    absDev < 0.05 ? "aligned" : absDev <= 0.15 ? "soft" : "strong";
  const direction: "high" | "low" = dev > 0 ? "high" : "low";
  const rounded = Math.round(absDev * 100 * 10) / 10;
  const pctStr = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toString().replace(".", ",");
  return { tier, direction, pctStr };
}

type TabKey = "financiamiento" | "arriendo" | "operacion-airbnb" | "gastos";

// Tabs dinámicos según modalidad (Ronda 2c).
// LTR: Financiamiento · Arriendo · Gastos fijos
// STR: Financiamiento · Operación Airbnb · Gastos fijos
// AMBAS: Financiamiento · Arriendo (LTR) · Operación Airbnb (STR) · Gastos fijos
const TABS_BY_MODALIDAD: Record<"ltr" | "str" | "both", { key: TabKey; label: string }[]> = {
  ltr: [
    { key: "financiamiento", label: "Financiamiento" },
    { key: "arriendo", label: "Arriendo" },
    { key: "gastos", label: "Gastos fijos" },
  ],
  str: [
    { key: "financiamiento", label: "Financiamiento" },
    { key: "operacion-airbnb", label: "Operación Airbnb" },
    { key: "gastos", label: "Gastos fijos" },
  ],
  both: [
    { key: "financiamiento", label: "Financiamiento" },
    { key: "arriendo", label: "Arriendo (LTR)" },
    { key: "operacion-airbnb", label: "Operación Airbnb (STR)" },
    { key: "gastos", label: "Gastos fijos" },
  ],
};

// Claves que cada tab trackea como "editable" (footer "AJUSTADO" badge).
// arriendoLargo no tiene tab propio — vive en Arriendo (LTR) cuando AMBAS,
// en Operación Airbnb cuando STR; en ambos casos `arriendo` es la key trackeada.
const TAB_FIELDS: Record<TabKey, (keyof WizardV3State)[]> = {
  financiamiento: ["plazoCredito", "tasaInteres"],
  arriendo: ["arriendo", "vacanciaPct", "adminPct", "arriendoEstac", "arriendoBodega"],
  "operacion-airbnb": [
    "modoGestion",
    "comisionAdminPct",
    "costoElectricidad",
    "costoAgua",
    "costoWifi",
    "costoInsumos",
    "mantencionMensual",
    "estaAmoblado",
    "costoAmoblamiento",
    // Solo en modo STR puro este tab edita arriendo (referencia LTR);
    // en AMBAS lo trackea el tab "arriendo" y aquí no se renderiza.
    "arriendo",
  ],
  gastos: ["gastos", "contribuciones"],
};

export function ModalAjusteCondiciones({
  open,
  onClose,
  state,
  onSave,
  suggestions,
  ufCLP,
  onEditarPaso2,
}: {
  open: boolean;
  onClose: () => void;
  state: WizardV3State;
  onSave: (patch: Partial<WizardV3State>) => void;
  suggestions: {
    arriendo: number | null;
    arriendoSampleSize?: number;
    gastos: number | null;
    contribuciones: number | null;
  };
  ufCLP: number;
  /** Callback para "Editar en Paso 2" desde Tab Financiamiento. Si no se
   * provee, el bloque read-only no muestra el link. */
  onEditarPaso2?: () => void;
}) {
  // Cantidades en Paso 1 — necesarias para prefill de arriendos extras.
  const nEstac = Number(state.estacionamientos) || 0;
  const nBodega = Number(state.bodegas) || 0;

  // Modalidad activa — controla qué tabs se muestran (Ronda 2c).
  const modalidadKey: "ltr" | "str" | "both" = state.modalidad === "str"
    ? "str"
    : state.modalidad === "both"
      ? "both"
      : "ltr";
  const TABS = TABS_BY_MODALIDAD[modalidadKey];

  // Snapshot de inicio para detectar cambios dentro del modal.
  // Tanto `startSnapshot` como `local` se re-capturan en cada `open=true`,
  // garantizando que ediciones canceladas no se arrastren a la próxima apertura.
  //
  // Prefill estac/bodega: si la propiedad tiene la unidad pero el state viene
  // vacío, sembramos defaults de mercado (40k/estac, 15k/bodega) en el snapshot.
  // Snapshot y local arrancan con el mismo prefill → no se marca como editado
  // si el user lo acepta sin tocar. Si guarda, el prefill persiste al wizard.
  // Si edita o pone 0, su intención prevalece.
  const baselineSnapshot = {
    plazoCredito: state.plazoCredito,
    tasaInteres: state.tasaInteres,
    arriendo: state.arriendo,
    vacanciaPct: state.vacanciaPct,
    adminPct: state.adminPct,
    arriendoEstac:
      !state.arriendoEstac && nEstac > 0
        ? String(40000 * nEstac)
        : state.arriendoEstac,
    arriendoBodega:
      !state.arriendoBodega && nBodega > 0
        ? String(15000 * nBodega)
        : state.arriendoBodega,
    gastos: state.gastos,
    contribuciones: state.contribuciones,
    // Operación Airbnb (Ronda 2c) — tracked en STR/AMBAS
    modoGestion: state.modoGestion,
    comisionAdminPct: state.comisionAdminPct,
    costoElectricidad: state.costoElectricidad,
    costoAgua: state.costoAgua,
    costoWifi: state.costoWifi,
    costoInsumos: state.costoInsumos,
    mantencionMensual: state.mantencionMensual,
    estaAmoblado: state.estaAmoblado,
    costoAmoblamiento: state.costoAmoblamiento,
  };
  const [startSnapshot, setStartSnapshot] = useResetOnOpen(open, baselineSnapshot);
  const [local, setLocal] = useResetOnOpen(open, baselineSnapshot);
  void setStartSnapshot; // disponible por si se necesita re-pinear snapshot
  const [activeTab, setActiveTab] = useState<TabKey>("financiamiento");

  // Si el tab activo no existe en la modalidad actual (ej. user cambió de LTR
  // a STR mientras tab="arriendo"), redirigir al primero de la lista.
  useEffect(() => {
    if (!TABS.find((t) => t.key === activeTab)) {
      setActiveTab(TABS[0].key);
    }
  }, [TABS, activeTab]);

  // Keys que cambiaron respecto al snapshot inicial
  const dirtyKeys = useMemo(() => {
    const result: Set<string> = new Set();
    (Object.keys(startSnapshot) as (keyof typeof startSnapshot)[]).forEach((k) => {
      if (local[k] !== startSnapshot[k]) result.add(k as string);
    });
    return result;
  }, [local, startSnapshot]);

  // Qué tabs tienen cambios
  const tabHasChanges = (tab: TabKey) => TAB_FIELDS[tab].some((f) => dirtyKeys.has(f as string));

  function patch<K extends keyof typeof local>(k: K, v: (typeof local)[K]) {
    setLocal((p) => ({ ...p, [k]: v }));
  }

  function handleSaveAndExit() {
    // Merge editedFields: existing + new dirty keys
    const merged = new Set<string>(state.editedFields);
    dirtyKeys.forEach((k) => merged.add(k));
    onSave({ ...local, editedFields: Array.from(merged) });
    onClose();
  }

  function handleNext() {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (idx < TABS.length - 1) {
      setActiveTab(TABS[idx + 1].key);
    } else {
      handleSaveAndExit();
    }
  }

  const isLastTab = activeTab === TABS[TABS.length - 1].key;
  const isDirty = dirtyKeys.size > 0;

  // Handler "Editar en Paso 2" — confirma si hay cambios sin guardar antes
  // de cerrar el modal y navegar atrás (Ronda 2c.2).
  function handleEditarPaso2() {
    if (isDirty && !window.confirm("¿Descartar cambios y volver al Paso 2?")) return;
    onEditarPaso2?.();
    onClose();
  }

  // Esc: confirmar si hay cambios; si no, cerrar directo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isDirty && !window.confirm("¿Descartar cambios?")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isDirty, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Custom header with tabs
  const header = (
    <div className="border-b border-[var(--franco-border)]">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-heading text-lg md:text-xl font-bold text-[var(--franco-text)] m-0">
          Ajustar condiciones
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-1 px-4 pb-0 overflow-x-hidden">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          const dirty = tabHasChanges(t.key);
          // Prioridad del color: dirty (intermedio Ink 500) > active (blanco) > default (muted)
          const color = dirty
            ? "var(--ink-500)"
            : active
              ? "var(--franco-text)"
              : "var(--franco-text-muted)";
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 font-body text-[12px] font-medium transition-colors ${
                active
                  ? "border-b-2 border-signal-red -mb-px"
                  : "hover:text-[var(--franco-text)]"
              }`}
              style={{ color }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10"
      style={{ background: "rgba(0,0,0,0.55)" }}
      /* Backdrop click NO cierra: el modal tiene cambios potencialmente sin guardar.
         Backdrop sin overflow — el scroll vive dentro del card body para que el
         scrollbar aparezca pegado al borde derecho del modal y no del viewport. */
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0">{header}</div>

        <div className="flex-1 overflow-y-auto scrollbar-modal px-5 py-5">
          {activeTab === "financiamiento" && (
            <TabFinanciamiento
              local={local}
              setLocal={patch}
              state={state}
              ufCLP={ufCLP}
              onEditarPaso2={onEditarPaso2 ? handleEditarPaso2 : undefined}
            />
          )}
          {activeTab === "arriendo" && (
            <TabArriendo
              local={local}
              setLocal={patch}
              state={state}
              suggestion={suggestions.arriendo}
              sampleSize={suggestions.arriendoSampleSize}
            />
          )}
          {activeTab === "operacion-airbnb" && (
            <TabOperacionAirbnb
              local={local}
              setLocal={patch}
              modalidadKey={modalidadKey}
            />
          )}
          {activeTab === "gastos" && (
            <TabGastos local={local} setLocal={patch} suggestions={suggestions} />
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--franco-border)]">
          <button
            type="button"
            onClick={onClose}
            className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {!isLastTab && (
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="font-body font-medium text-[13px] px-4 py-2 rounded-lg text-[var(--franco-text)] hover:bg-[color-mix(in_srgb,var(--franco-text)_4%,transparent)] transition-colors"
                style={{ border: "0.5px solid var(--franco-border)" }}
              >
                Guardar y salir
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="font-body font-medium text-[13px] text-white px-4 py-2 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors"
            >
              {isLastTab ? "Fin →" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Tab components ─────────────────────────────────
type LocalState = {
  plazoCredito: string;
  tasaInteres: string;
  arriendo: string;
  vacanciaPct: string;
  adminPct: string;
  arriendoEstac: string;
  arriendoBodega: string;
  gastos: string;
  contribuciones: string;
  // Operación Airbnb — Ronda 2c
  modoGestion: "auto" | "administrador";
  comisionAdminPct: string;
  costoElectricidad: string;
  costoAgua: string;
  costoWifi: string;
  costoInsumos: string;
  mantencionMensual: string;
  estaAmoblado: boolean;
  costoAmoblamiento: string;
};

const inputBase =
  "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

function Suggest({
  sugerido,
  sampleSize,
  note,
}: {
  sugerido: number | null;
  sampleSize?: number;
  /** Continuación inline del hint, pe. fórmula del cálculo. Tiene prioridad sobre sampleSize. */
  note?: string;
}) {
  if (!sugerido) return null;
  const tail = note
    ? ` · ${note}`
    : sampleSize && sampleSize > 0
      ? ` · basado en ${sampleSize} ${sampleSize === 1 ? "propiedad comparable" : "propiedades comparables"}`
      : "";
  return (
    <p className="font-body text-[11px] mt-1 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
      Mercado sugiere {fmtCLP(sugerido)}{tail}
    </p>
  );
}

function TabFinanciamiento({
  local, setLocal, state, ufCLP, onEditarPaso2,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  state: WizardV3State;
  ufCLP: number;
  /** Handler "Editar en Paso 2" — ya viene wrappeado con confirm en el modal. */
  onEditarPaso2?: () => void;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(local.plazoCredito) || 25;
  const tasa = parseDecimalLocale(local.tasaInteres) || 4.72;
  const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, ufCLP);
  const pieUF = precioUF * piePct / 100;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Precio + Pie read-only (Ronda 2c.2) ──
          Bloque informativo arriba del tab para que el usuario vea los
          valores definidos en pasos previos sin tener que volver. Si quiere
          editarlos, link "Editar en Paso 2" cierra modal y navega. */}
      {precioUF > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ background: "color-mix(in srgb, var(--franco-text) 3%, transparent)" }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] m-0 mb-1">
                Precio
              </p>
              <p className="font-mono text-[14px] font-medium text-[var(--franco-text)] m-0 leading-tight">
                {fmtUF(precioUF)}
              </p>
              <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] m-0 mt-0.5">
                ≈ {fmtCLP(precioUF * ufCLP)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] m-0 mb-1">
                Pie
              </p>
              <p className="font-mono text-[14px] font-medium text-[var(--franco-text)] m-0 leading-tight">
                {piePct}% · {fmtUF(pieUF)}
              </p>
              <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] m-0 mt-0.5">
                ≈ {fmtCLP(pieUF * ufCLP)}
              </p>
            </div>
          </div>
          {onEditarPaso2 && (
            <div className="mt-3 pt-3 border-t border-[var(--franco-border)]">
              <button
                type="button"
                onClick={onEditarPaso2}
                className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-2 transition-colors"
              >
                Editar en Paso 2 →
              </button>
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
          Plazo del crédito (años)
        </span>
        <input
          type="range" min={10} max={30} step={5}
          value={local.plazoCredito}
          onChange={(e) => setLocal("plazoCredito", e.target.value)}
          className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
        />
        <span className="font-mono text-[12px] text-[var(--franco-text-secondary)]">{plazo} años</span>
      </label>
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Tasa de interés anual (%)
          </span>
          <InfoTooltip
            content="Tasa anual del crédito hipotecario. Hoy en Chile fluctúa entre 4% y 5,5% UF. Si calificas al Subsidio a la Tasa (Ley 21.748), puede bajar ~0,6 puntos."
          />
        </span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="4,72"
          className={inputBase}
          value={local.tasaInteres}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*[.,]?\d*$/.test(v)) setLocal("tasaInteres", v);
          }}
        />
      </label>
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ background: "color-mix(in srgb, var(--franco-text) 3%, transparent)" }}
      >
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mb-0.5">
          Dividendo recalculado
        </p>
        <p className="font-mono text-[16px] font-semibold text-[var(--franco-text)] m-0">
          {dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"}
        </p>
      </div>
    </div>
  );
}

function TabArriendo({
  local, setLocal, state, suggestion, sampleSize,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  state: WizardV3State;
  suggestion: number | null;
  sampleSize?: number;
}) {
  const nEstac = Number(state.estacionamientos) || 0;
  const nBodega = Number(state.bodegas) || 0;
  const [arriendoReady, commitArriendo] = useDebouncedReady(local.arriendo);
  const arriendoTier = arriendoReady
    ? calcTier(parseDecimalLocale(local.arriendo), suggestion ?? 0)
    : null;

  // Total = depto + estac + bodega. Refleja lo que el motor calcula como
  // ingresoMensual (analysis.ts:calcIngresoMensual). Valores vacíos = 0.
  const arriendoNum = Number(local.arriendo) || 0;
  const estacNum = Number(local.arriendoEstac) || 0;
  const bodegaNum = Number(local.arriendoBodega) || 0;
  const totalArriendo = arriendoNum + estacNum + bodegaNum;
  const hasExtras = nEstac > 0 || nBodega > 0;
  const breakdownParts: string[] = [`Depto ${fmtCLP(arriendoNum)}`];
  if (nEstac > 0) breakdownParts.push(`estacionamiento ${fmtCLP(estacNum)}`);
  if (nBodega > 0) breakdownParts.push(`bodega ${fmtCLP(bodegaNum)}`);

  return (
    <div className="flex flex-col gap-4">
      {/* Bloque 1 — Arriendo mensual + extras (estac/bodega) juntos */}
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Arriendo mensual ($)
          </span>
          <InfoTooltip
            content="Sugerencia calculada con la mediana de arriendos publicados de propiedades similares (mismos dormitorios, ±30% superficie) en la zona. Edítalo si tienes referencia distinta."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.arriendo}
          onChange={(raw) => setLocal("arriendo", raw)}
          onBlur={commitArriendo}
        />
        <Suggest sugerido={suggestion} sampleSize={sampleSize} />
        <ArriendoAlert tier={arriendoTier} />
      </label>
      {nEstac > 0 && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Arriendo estacionamiento ($/mes)
            </span>
            <InfoTooltip
              content="Sugerencia automática según valores típicos de la zona. Edítalo si tienes referencia de un arriendo real cercano."
            />
          </span>
          <MoneyInput
            className={inputBase}
            placeholder={(40000 * nEstac).toLocaleString("es-CL")}
            value={local.arriendoEstac}
            onChange={(raw) => setLocal("arriendoEstac", raw)}
          />
          <p className="font-mono text-[11px] mt-1 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
            ● Se suma al arriendo total mensual.
          </p>
        </label>
      )}
      {nBodega > 0 && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Arriendo bodega ($/mes)
            </span>
            <InfoTooltip
              content="Sugerencia automática según valores típicos de la zona. Edítalo si tienes referencia distinta."
            />
          </span>
          <MoneyInput
            className={inputBase}
            placeholder={(15000 * nBodega).toLocaleString("es-CL")}
            value={local.arriendoBodega}
            onChange={(raw) => setLocal("arriendoBodega", raw)}
          />
          <p className="font-mono text-[11px] mt-1 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
            ● Se suma al arriendo total mensual.
          </p>
        </label>
      )}

      {/* Bloque 2 — Total mensual (solo si la propiedad tiene extras).
          Patrón 3 caja resultado conclusiva (variante Ink — informativo, no
          crítico): border-left Ink primario 3px + wash Ink 3% + esquinas izq
          cuadradas. Estructura tipográfica: label + KPI prominente + breakdown. */}
      {hasExtras && (
        <div
          className="mt-2 p-3 rounded-r-lg"
          style={{
            borderLeft: "3px solid var(--franco-text)",
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-1">
            Total mensual
          </p>
          <p className="font-mono text-[18px] font-bold text-[var(--franco-text)] m-0 mb-1.5 leading-tight">
            {fmtCLP(totalArriendo)}
          </p>
          <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] m-0 leading-snug">
            {breakdownParts.join(" + ")}
          </p>
        </div>
      )}

      {/* Bloque 3 — Vacancia + Gestión */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Vacancia (%)
            </span>
            <InfoTooltip
              content="Porcentaje del año estimado sin arrendatario (búsqueda y transición). Default 5% ≈ 18 días/año. Se descuenta mes a mes del arriendo proyectado para reflejar flujo realista."
            />
          </span>
          <input
            type="range" min={0} max={25} step={1}
            value={local.vacanciaPct}
            onChange={(e) => setLocal("vacanciaPct", e.target.value)}
            className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
          <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">{local.vacanciaPct}%</span>
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Gestión del arriendo (%)
            </span>
            <InfoTooltip
              content="Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario). Se descuenta mes a mes del arriendo bruto. Default 0% asume autogestión. Típico mercado: 7-10% si delega."
            />
          </span>
          <input
            type="range" min={0} max={15} step={1}
            value={local.adminPct}
            onChange={(e) => setLocal("adminPct", e.target.value)}
            className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
          <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">{local.adminPct}%</span>
        </label>
      </div>
    </div>
  );
}

// ─── Tab Operación Airbnb (STR / AMBAS) — Ronda 2c ──
// Campos: comisión admin (slider, condicional a modoGestion="admin"),
// costos operativos (4 inputs), mantención, amoblamiento toggle + monto,
// arriendoLargo (solo en modo STR puro — en AMBAS lo edita el tab Arriendo LTR).
function TabOperacionAirbnb({
  local, setLocal, modalidadKey,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  modalidadKey: "ltr" | "str" | "both";
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Modo de gestión ── */}
      <div>
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Modo de gestión
          </span>
          <InfoTooltip content="Auto-gestión: tú operas el Airbnb, comisión 3% Airbnb. Administrador: operador profesional con comisión 15-30%." />
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["auto", "administrador"] as const).map((m) => {
            const active = local.modoGestion === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setLocal("modoGestion", m)}
                className={`text-left px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                }`}
              >
                <p className="font-body text-[13px] font-medium m-0 mb-0.5">
                  {m === "auto" ? "Auto-gestión" : "Administrador"}
                </p>
                <p className="font-mono text-[10px] m-0 leading-snug opacity-80">
                  {m === "auto" ? "Comisión Airbnb 3%." : "Comisión 15-30%."}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Comisión admin (solo si modoGestion="administrador") ── */}
      {local.modoGestion === "administrador" && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Comisión administrador (%)
            </span>
            <InfoTooltip content="Porcentaje del ingreso bruto que cobra el operador profesional. Rango habitual 15-25% en Santiago." />
          </span>
          <input
            type="range" min={10} max={30} step={1}
            value={local.comisionAdminPct}
            onChange={(e) => setLocal("comisionAdminPct", e.target.value)}
            className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
          <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">{local.comisionAdminPct}%</span>
        </label>
      )}

      {/* ── Costos operativos mensuales ── */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text-secondary)] m-0 mb-1">
          Costos operativos mensuales
        </p>
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mb-2 leading-snug">
          Costos del propietario que no se traspasan al huésped. Defaults estimados para departamento 2D1B en Santiago.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                Electricidad ($)
              </span>
              <InfoTooltip content="Cuenta de luz mensual. Default $35.000 según promedio consumo Airbnb 2D1B Santiago." />
            </span>
            <MoneyInput
              className={inputBase}
              value={local.costoElectricidad}
              onChange={(raw) => setLocal("costoElectricidad", raw)}
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                Agua ($)
              </span>
              <InfoTooltip content="Cuenta de agua mensual. Default $8.000." />
            </span>
            <MoneyInput
              className={inputBase}
              value={local.costoAgua}
              onChange={(raw) => setLocal("costoAgua", raw)}
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                WiFi / Cable ($)
              </span>
              <InfoTooltip content="Plan internet mensual. Default $22.000 (fibra estándar)." />
            </span>
            <MoneyInput
              className={inputBase}
              value={local.costoWifi}
              onChange={(raw) => setLocal("costoWifi", raw)}
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                Insumos ($)
              </span>
              <InfoTooltip content="Reposición de amenities, limpieza, lavandería. Default $20.000." />
            </span>
            <MoneyInput
              className={inputBase}
              value={local.costoInsumos}
              onChange={(raw) => setLocal("costoInsumos", raw)}
            />
          </label>
        </div>
      </div>

      {/* ── Mantención mensual ── */}
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Mantención ($/mes)
          </span>
          <InfoTooltip content="Reparaciones menores y mantenimiento mensual. Default $11.000." />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.mantencionMensual}
          onChange={(raw) => setLocal("mantencionMensual", raw)}
        />
      </label>

      {/* ── Amoblado (toggle + monto) ── */}
      <div>
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            ¿Está amoblado?
          </span>
          <InfoTooltip content="Si el depto ya viene amoblado, no se considera inversión inicial. Si no, se calcula el costo de amoblar para Airbnb." />
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["si", "no"] as const).map((opt) => {
            const isAmob = opt === "si";
            const active = local.estaAmoblado === isAmob;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setLocal("estaAmoblado", isAmob)}
                className={`h-10 rounded-lg font-body text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                }`}
              >
                {isAmob ? "Sí, ya amoblado" : "No, falta amoblar"}
              </button>
            );
          })}
        </div>
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mt-2 leading-snug">
          {local.estaAmoblado
            ? "Ya tienes el depto amoblado. No se descuenta inversión inicial."
            : "Se calcula inversión inicial para amoblar."}
        </p>
        {!local.estaAmoblado && (
          <label className="block mt-3">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                Costo de amoblar (CLP único)
              </span>
              <InfoTooltip content="Inversión única para amoblar. Default $3.500.000 para 2D1B estándar Airbnb. Se descuenta del flujo año 1." />
            </span>
            <MoneyInput
              className={inputBase}
              value={local.costoAmoblamiento}
              onChange={(raw) => setLocal("costoAmoblamiento", raw)}
            />
          </label>
        )}
      </div>

      {/* ── Arriendo largo de referencia (solo modo STR puro) ──
          En AMBAS este campo lo edita el tab "Arriendo (LTR)" — evitar
          duplicación que confunde y desincroniza. */}
      {modalidadKey === "str" && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Arriendo largo de referencia ($/mes)
            </span>
            <InfoTooltip content="Arriendo tradicional mensual estimado. Se usa para comparar STR vs LTR. Si dejas vacío, Franco lo estima de mercado." />
          </span>
          <MoneyInput
            className={inputBase}
            value={local.arriendo}
            onChange={(raw) => setLocal("arriendo", raw)}
          />
        </label>
      )}
    </div>
  );
}

function TabGastos({
  local, setLocal, suggestions,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  suggestions: { gastos: number | null; contribuciones: number | null };
}) {
  const [gastosReady, commitGastos] = useDebouncedReady(local.gastos);
  const [contribReady, commitContrib] = useDebouncedReady(local.contribuciones);
  const gastosTier = gastosReady
    ? calcTier(parseDecimalLocale(local.gastos), suggestions.gastos ?? 0)
    : null;
  const contribTier = contribReady
    ? calcTier(parseDecimalLocale(local.contribuciones), suggestions.contribuciones ?? 0)
    : null;
  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Gastos comunes ($/mes)
          </span>
          <InfoTooltip
            content="Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia)."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.gastos}
          onChange={(raw) => setLocal("gastos", raw)}
          onBlur={commitGastos}
        />
        <Suggest
          sugerido={suggestions.gastos}
          note="calculado por superficie útil × valor $/m² según tier de comuna"
        />
        <GastosAlert tier={gastosTier} />
      </label>
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Contribuciones (trimestral, $)
          </span>
          <InfoTooltip
            content="Impuesto territorial trimestral del SII. Lo paga el propietario del inmueble. Franco lo calcula automáticamente."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.contribuciones}
          onChange={(raw) => setLocal("contribuciones", raw)}
          onBlur={commitContrib}
        />
        <Suggest
          sugerido={suggestions.contribuciones}
          note="calculado con avalúo fiscal estimado (precio × 0,7), exenciones DFL-2 si aplica, y tasa progresiva SII"
        />
        <ContribAlert tier={contribTier} />
      </label>
    </div>
  );
}

// ─── Alert components per field ─────────────────────
type Tier = ReturnType<typeof calcTier>;

function ArriendoAlert({ tier }: { tier: Tier }) {
  if (!tier) return null;
  if (tier.tier === "aligned") {
    return (
      <p className="font-mono text-[11px] mt-2 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Arriendo dentro del rango sugerido.
      </p>
    );
  }
  if (tier.tier === "soft") {
    if (tier.direction === "high") {
      return (
        <div className="mt-2">
          <StateBox variant="left-border" state="attention" label="Atención">
            <span className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
              <span>El arriendo está {tier.pctStr}% sobre la sugerencia. Verifica que sea alcanzable en la zona.</span>
            </span>
          </StateBox>
        </div>
      );
    }
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="info" label="Información">
          Arriendo {tier.pctStr}% bajo la sugerencia. La proyección será conservadora.
        </StateBox>
      </div>
    );
  }
  // strong
  if (tier.direction === "high") {
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="attention" label="Atención">
          <span className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
            <span>El arriendo está un {tier.pctStr}% sobre la sugerencia — desviación importante. Puede sobreestimar el flujo proyectado. Verifica el dato.</span>
          </span>
        </StateBox>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <StateBox variant="left-border" state="info" label="Información">
        Arriendo {tier.pctStr}% bajo la sugerencia — diferencia importante. La proyección será muy conservadora. Verifica el dato.
      </StateBox>
    </div>
  );
}

function GastosAlert({ tier }: { tier: Tier }) {
  if (!tier) return null;
  if (tier.tier === "aligned") {
    return (
      <p className="font-mono text-[11px] mt-2 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Gastos dentro del rango del tier de comuna.
      </p>
    );
  }
  if (tier.tier === "soft") {
    if (tier.direction === "high") {
      return (
        <div className="mt-2">
          <StateBox variant="left-border" state="attention" label="Atención">
            <span className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
              <span>Gastos {tier.pctStr}% sobre el promedio del tier de comuna. Verifica el valor real.</span>
            </span>
          </StateBox>
        </div>
      );
    }
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="info" label="Información">
          Gastos {tier.pctStr}% bajo el promedio del tier de comuna.
        </StateBox>
      </div>
    );
  }
  // strong
  if (tier.direction === "high") {
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="attention" label="Atención">
          <span className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
            <span>Gastos {tier.pctStr}% sobre el promedio del tier de comuna — desviación importante. Verifica el valor real con la administración del edificio.</span>
          </span>
        </StateBox>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <StateBox variant="left-border" state="info" label="Información">
        Gastos {tier.pctStr}% bajo el promedio del tier de comuna — diferencia importante. Confirma con la administración.
      </StateBox>
    </div>
  );
}

function ContribAlert({ tier }: { tier: Tier }) {
  if (!tier) return null;
  if (tier.tier === "aligned") {
    return (
      <p className="font-mono text-[11px] mt-2 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Contribuciones alineadas con cálculo SII.
      </p>
    );
  }
  if (tier.tier === "soft") {
    if (tier.direction === "high") {
      return (
        <div className="mt-2">
          <StateBox variant="left-border" state="attention" label="Atención">
            <span className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
              <span>Contribuciones {tier.pctStr}% sobre el cálculo SII. Verifica con avalúo real.</span>
            </span>
          </StateBox>
        </div>
      );
    }
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="info" label="Información">
          Contribuciones {tier.pctStr}% bajo el cálculo SII.
        </StateBox>
      </div>
    );
  }
  // strong
  if (tier.direction === "high") {
    return (
      <div className="mt-2">
        <StateBox variant="left-border" state="attention" label="Atención">
          <span className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
            <span>Contribuciones {tier.pctStr}% sobre el cálculo SII — desviación importante. Verifica con avalúo real del SII.</span>
          </span>
        </StateBox>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <StateBox variant="left-border" state="info" label="Información">
        Contribuciones {tier.pctStr}% bajo el cálculo SII — diferencia importante. Verifica si aplica DFL-2 u otra exención.
      </StateBox>
    </div>
  );
}
