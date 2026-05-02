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
    arriendoSampleSize?: number;
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
            <TabArriendo
              local={local}
              setLocal={patch}
              state={state}
              suggestion={suggestions.arriendo}
              sampleSize={suggestions.arriendoSampleSize}
            />
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
  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            Arriendo mensual ($)
          </span>
          <InfoTooltip
            trigger="click"
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
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
              Vacancia (%)
            </span>
            <InfoTooltip
              trigger="click"
              content="Porcentaje del año estimado sin arrendatario (búsqueda de inquilino, transición). Default 5% ≈ 18 días/año. Se descuenta del ingreso de arriendo proyectado para reflejar flujo realista."
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
              Administración (%)
            </span>
            <InfoTooltip
              trigger="click"
              content="Porcentaje del arriendo que se paga al administrador (corredor que gestiona la propiedad). Default 0% asume autogestión. Típico mercado: 7-10% si delega."
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
            trigger="click"
            content="Pago mensual a la administración del edificio. Lo paga el arrendatario, pero se considera en la proyección por períodos de vacancia. Edita si conoces el valor real."
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
            trigger="click"
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
