"use client";

// Paso 4 — Ajuste fino opcional. Iteración 2026-05-10. Reemplaza el modal
// ModalAjusteCondiciones (que se deprecia tras este cambio).
//
// 3 secciones inline:
//   1. Crédito hipotecario (plazoCredito + tasaInteres) — siempre visible.
//   2. Renta larga (vacanciaPct + adminPct LTR) — solo si modalidad ∈ {ltr, both}.
//   3. Renta corta — overrides (comisionAdminPct override) — solo si
//      modalidad ∈ {str, both}.

import { Loader2 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import { canAnalyzeFromTier, type TierInfo } from "./Paso3Modalidad";
import { parseDecimalLocale, type WizardV3State } from "./wizardV3State";

const inputBase =
  "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

export function Paso4AjusteFino({
  state,
  setState,
  tierInfo,
  onVolver,
  onAnalizar,
  submitting,
  submitError,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  tierInfo: TierInfo | null;
  onVolver: () => void;
  onAnalizar: () => void;
  submitting: boolean;
  submitError: string;
}) {
  const mod = state.modalidad;
  const showLTR = mod === "ltr" || mod === "both";
  const showSTR = mod === "str" || mod === "both";
  const canAnalyze = canAnalyzeFromTier(tierInfo);

  return (
    <div className="flex flex-col gap-5 animate-slide-left">
      <div>
        <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)] m-0 mb-1">
          Ajuste fino (opcional)
        </h2>
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
          Defaults razonables del mercado chileno. Edita solo si tienes data más fina para tu caso.
        </p>
      </div>

      {/* ── Sección 1: Crédito hipotecario ── */}
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
        <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
          Crédito hipotecario
        </div>

        <label className="block">
          <span className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
            Plazo del crédito: {state.plazoCredito} años
          </span>
          <input
            type="range" min={10} max={30} step={5}
            value={state.plazoCredito}
            onChange={(e) => setState({ plazoCredito: e.target.value })}
            className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Tasa de interés anual (%)</span>
            <InfoTooltip content="Tasa anual del crédito hipotecario. Hoy en Chile fluctúa entre 4% y 5,5% UF. Subsidio a la Tasa (Ley 21.748) puede bajar ~0,6 puntos si calificas." />
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="4,72"
            className={inputBase}
            value={state.tasaInteres}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*[.,]?\d*$/.test(v)) setState({ tasaInteres: v });
            }}
          />
        </label>
      </div>

      {/* ── Sección 2: Renta larga ── */}
      {showLTR && (
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
            Renta larga
          </div>

          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Vacancia: {state.vacanciaPct}%</span>
              <InfoTooltip content="Porcentaje del año estimado sin arrendatario. Default 5% ≈ 18 días/año." />
            </span>
            <input
              type="range" min={0} max={25} step={1}
              value={state.vacanciaPct}
              onChange={(e) => setState({ vacanciaPct: e.target.value })}
              className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
            />
            <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
              Default 5% = autogestión sólida. 0% = nunca vacío.
            </p>
          </label>

          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">Comisión gestión LTR: {state.adminPct}%</span>
              <InfoTooltip content="Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario). Default 0% asume autogestión. Típico 7-10% si delegas." />
            </span>
            <input
              type="range" min={0} max={15} step={1}
              value={state.adminPct}
              onChange={(e) => setState({ adminPct: e.target.value })}
              className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* ── Sección 3: Renta corta (overrides finos) ── */}
      {showSTR && (
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
            Renta corta — overrides
          </div>

          <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 leading-snug">
            Los ejes operacionales y los overrides de ADR/Occ se editan en el paso 3. Acá puedes ajustar la comisión exacta si tu acuerdo con el operador difiere del default por banda.
          </p>

          {state.gestionOption === "pro_formal" ? (
            <label className="block">
              <span className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
                Comisión exacta operador: {state.comisionAdminPct}%
              </span>
              <input
                type="range" min={5} max={30} step={1}
                value={state.comisionAdminPct}
                onChange={(e) => setState({ comisionAdminPct: e.target.value })}
                className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                Default 20% (Andes STR full-service). Rango habitual 15-25% en Santiago.
              </p>
            </label>
          ) : (
            <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 italic">
              Como elegiste auto-gestión, la comisión es 3% Airbnb (fija). Si vas a usar operador profesional, cambia la opción en el paso 3.
            </p>
          )}
        </div>
      )}

      {/* ── CTAs ── */}
      {submitError && (
        <StateBox variant="left-border" state="negative">{submitError}</StateBox>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onVolver}
          className="font-body text-[13px] font-medium text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
        >
          ← Volver al paso 3
        </button>
        <button
          type="button"
          onClick={onAnalizar}
          disabled={submitting || !canAnalyze}
          className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creando análisis…</>
          ) : !canAnalyze ? (
            <>Necesitas un crédito</>
          ) : (
            <>Ajustar y analizar →</>
          )}
        </button>
      </div>
    </div>
  );
}

// Helper utilitario re-exportado para keep callsites compatibles
export { parseDecimalLocale };
