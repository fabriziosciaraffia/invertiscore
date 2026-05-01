"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  calcDividendo,
  fmtCLP,
  parseDecimalLocale,
  type WizardV3State,
} from "./wizardV3State";

type TabKey = "financiamiento" | "arriendo" | "gastos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "financiamiento", label: "Financiamiento" },
  { key: "arriendo", label: "Arriendo" },
  { key: "gastos", label: "Gastos fijos" },
];

// Claves que cada tab trackea como "editable"
const TAB_FIELDS: Record<TabKey, (keyof WizardV3State)[]> = {
  financiamiento: ["plazoCredito", "tasaInteres"],
  arriendo: ["arriendo", "vacanciaPct", "adminPct", "arriendoEstac", "arriendoBodega"],
  gastos: ["gastos", "contribuciones"],
};

export function ModalAjusteCondiciones({
  open,
  onClose,
  state,
  onSave,
  suggestions,
  ufCLP,
}: {
  open: boolean;
  onClose: () => void;
  state: WizardV3State;
  onSave: (patch: Partial<WizardV3State>) => void;
  suggestions: {
    arriendo: number | null;
    gastos: number | null;
    contribuciones: number | null;
  };
  ufCLP: number;
}) {
  // Snapshot de inicio para detectar cambios dentro del modal.
  // Tanto `startSnapshot` como `local` se re-capturan en cada `open=true`,
  // garantizando que ediciones canceladas no se arrastren a la próxima apertura.
  const baselineSnapshot = {
    plazoCredito: state.plazoCredito,
    tasaInteres: state.tasaInteres,
    arriendo: state.arriendo,
    vacanciaPct: state.vacanciaPct,
    adminPct: state.adminPct,
    arriendoEstac: state.arriendoEstac,
    arriendoBodega: state.arriendoBodega,
    gastos: state.gastos,
    contribuciones: state.contribuciones,
  };
  const [startSnapshot, setStartSnapshot] = useResetOnOpen(open, baselineSnapshot);
  const [local, setLocal] = useResetOnOpen(open, baselineSnapshot);
  void setStartSnapshot; // disponible por si se necesita re-pinear snapshot
  const [activeTab, setActiveTab] = useState<TabKey>("financiamiento");

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
      <div className="flex items-center gap-1 px-4 pb-0">
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
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)" }}
      /* Backdrop click NO cierra: el modal tiene cambios potencialmente sin guardar. */
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {header}

        <div className="px-5 py-5">
          {activeTab === "financiamiento" && (
            <TabFinanciamiento local={local} setLocal={patch} state={state} ufCLP={ufCLP} />
          )}
          {activeTab === "arriendo" && (
            <TabArriendo local={local} setLocal={patch} state={state} suggestion={suggestions.arriendo} />
          )}
          {activeTab === "gastos" && (
            <TabGastos local={local} setLocal={patch} suggestions={suggestions} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--franco-border)]">
          <button
            type="button"
            onClick={onClose}
            className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="font-body font-medium text-[13px] px-4 py-2 rounded-lg text-[var(--franco-text)] hover:bg-[color-mix(in_srgb,var(--franco-text)_4%,transparent)] transition-colors"
              style={{ border: "0.5px solid var(--franco-border)" }}
            >
              Guardar y salir
            </button>
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
};

const inputBase =
  "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

function Suggest({ sugerido }: { sugerido: number | null }) {
  if (!sugerido) return null;
  return (
    <p
      className="font-body text-[10px] m-0 mt-1"
      style={{ color: "color-mix(in srgb, var(--ink-400) 70%, transparent)" }}
    >
      Mercado sugiere {fmtCLP(sugerido)}
    </p>
  );
}

function TabFinanciamiento({
  local, setLocal, state, ufCLP,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  state: WizardV3State;
  ufCLP: number;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(local.plazoCredito) || 25;
  const tasa = parseDecimalLocale(local.tasaInteres) || 4.72;
  const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, ufCLP);

  return (
    <div className="flex flex-col gap-4">
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
            trigger="click"
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
  local, setLocal, state, suggestion,
}: {
  local: LocalState;
  setLocal: <K extends keyof LocalState>(k: K, v: LocalState[K]) => void;
  state: WizardV3State;
  suggestion: number | null;
}) {
  const nEstac = Number(state.estacionamientos) || 0;
  const nBodega = Number(state.bodegas) || 0;
  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Arriendo mensual ($)
          </span>
          <InfoTooltip
            trigger="click"
            content="Calculado con la mediana de arriendos publicados de propiedades similares (mismos dormitorios, ±30% de superficie) en la zona. Edítalo si tienes referencia distinta."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.arriendo}
          onChange={(raw) => setLocal("arriendo", raw)}
        />
        <Suggest sugerido={suggestion} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
            Vacancia (%)
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
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
            Administración (%)
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
      {nEstac > 0 && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Arriendo estacionamiento ($/mes)
            </span>
            <InfoTooltip
              trigger="click"
              content="Sugerencia automática según valores típicos de la zona. Edítalo si tienes referencia de un arriendo real cercano."
            />
          </span>
          <MoneyInput
            className={inputBase}
            placeholder={(40000 * nEstac).toLocaleString("es-CL")}
            value={local.arriendoEstac}
            onChange={(raw) => setLocal("arriendoEstac", raw)}
          />
        </label>
      )}
      {nBodega > 0 && (
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Arriendo bodega ($/mes)
            </span>
            <InfoTooltip
              trigger="click"
              content="Sugerencia automática según valores típicos de la zona. Edítalo si tienes referencia distinta."
            />
          </span>
          <MoneyInput
            className={inputBase}
            placeholder={(15000 * nBodega).toLocaleString("es-CL")}
            value={local.arriendoBodega}
            onChange={(raw) => setLocal("arriendoBodega", raw)}
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
  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Gastos comunes ($/mes)
          </span>
          <InfoTooltip
            trigger="click"
            content="Pago mensual a la administración del edificio. Si no sabes el valor exacto, una buena referencia es 0,7% del valor del depto al año, dividido en 12 meses."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.gastos}
          onChange={(raw) => setLocal("gastos", raw)}
        />
        <Suggest sugerido={suggestions.gastos} />
      </label>
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Contribuciones (trimestral, $)
          </span>
          <InfoTooltip
            trigger="click"
            content="Impuesto territorial trimestral del SII. Deptos nuevos califican a exención DFL-2 si avalúo fiscal está bajo el umbral. Franco lo calcula automáticamente."
          />
        </span>
        <MoneyInput
          className={inputBase}
          value={local.contribuciones}
          onChange={(raw) => setLocal("contribuciones", raw)}
        />
        <Suggest sugerido={suggestions.contribuciones} />
      </label>
    </div>
  );
}
