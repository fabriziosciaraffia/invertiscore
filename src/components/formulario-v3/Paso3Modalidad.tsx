"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
// Ronda 2b: inputs STR críticos inline (modoGestion + edificioPermiteAirbnb).
// Resto de campos operativos viven en Modal Ajustar (Ronda 2c).
import { StateBox } from "@/components/ui/StateBox";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ResumenCard } from "./ResumenCard";
import { ModalAjusteCondiciones } from "./ModalAjusteCondiciones";
import {
  fmtCLP,
  fmtUF,
  type Modalidad,
  type WizardV3State,
} from "./wizardV3State";
import type { AirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";

const OPCIONES: { key: "ltr" | "str" | "both"; label: string; sub: string; star?: boolean }[] = [
  { key: "ltr", label: "Renta larga", sub: "Arriendo tradicional a 1+ año" },
  { key: "str", label: "Renta corta", sub: "Airbnb / corta estadía" },
  { key: "both", label: "Comparar ambas", sub: "LTR vs STR lado a lado", star: true },
];

export interface TierInfo {
  tier: "guest" | "free" | "premium" | "subscriber";
  isAdmin: boolean;
  credits: number;
  email: string | null;
}

export function Paso3Modalidad({
  state,
  setState,
  ufCLP,
  tierInfo,
  suggestions,
  airRoi,
  onEditarPaso2,
  onAnalizar,
  submitting,
  submitError,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  ufCLP: number;
  tierInfo: TierInfo | null;
  suggestions: {
    arriendo: number | null;
    arriendoSampleSize?: number;
    gastos: number | null;
    contribuciones: number | null;
  };
  airRoi: AirRoiSuggestion;
  /** Navegación cross-step desde Modal Ajustar (link "Editar en Paso 2"). */
  onEditarPaso2?: () => void;
  onAnalizar: () => void;
  submitting: boolean;
  submitError: string;
}) {
  const [ajustarOpen, setAjustarOpen] = useState(false);

  // Banner introductorio: dismiss persiste por sesión (sessionStorage,
  // se limpia al cerrar la pestaña). Mount-only check.
  const [introDismissed, setIntroDismissed] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("franco_p3_intro_dismissed") === "1") {
        setIntroDismissed(true);
      }
    } catch {
      // private mode — banner reaparece esta sesión, sin persistir.
    }
  }, []);
  function dismissIntro() {
    try {
      sessionStorage.setItem("franco_p3_intro_dismissed", "1");
    } catch {
      // graceful
    }
    setIntroDismissed(true);
  }

  const mod = state.modalidad;

  function selectModalidad(key: "ltr" | "str" | "both") {
    setState({ modalidad: key });
  }

  // Label compacto para el chip post-selección (LTR / STR / AMBAS)
  const modLabel = OPCIONES.find((o) => o.key === mod);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Estado 1: sin modalidad → grid de 3 ── */}
      {!mod && (
        <div key="grid" className="flex flex-col gap-5 animate-slide-left">
          <div>
            <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)] m-0 mb-1">
              ¿Cómo lo analizamos?
            </h2>
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
              Elige la modalidad para ver el resumen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {OPCIONES.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => selectModalidad(o.key)}
                className="relative text-left rounded-xl border p-4 transition-all bg-[var(--franco-card)] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] m-0 mb-1 font-semibold text-[var(--franco-text-muted)]">
                  {o.label}{o.star ? " ★" : ""}
                </p>
                <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0 leading-snug">
                  {o.sub}
                </p>
              </button>
            ))}
          </div>

          <p className="font-body text-[12px] text-[var(--franco-text-muted)] text-center m-0 py-4">
            Elige una opción para ver el resumen
          </p>
        </div>
      )}

      {/* ── Estado 2: modalidad elegida → chip + headline + resumen ── */}
      {mod && (
        <div key="compact" className="flex flex-col gap-5 animate-slide-left">
          {/* Chip compacto con "Cambiar" */}
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5"
            style={{
              background: "color-mix(in srgb, var(--signal-red) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--signal-red) 40%, transparent)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--signal-red)" }} strokeWidth={3} />
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text)]">
                {modLabel?.label}{modLabel?.star ? " ★" : ""}
              </span>
              <span className="font-body text-[12px] text-[var(--franco-text-secondary)] truncate">
                · {modLabel?.sub}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setState({ modalidad: null })}
              className="shrink-0 font-body text-[12px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-2"
            >
              Cambiar
            </button>
          </div>

          {/* Headline serif prominente con datos del depto */}
          <div>
            <h2 className="font-heading text-[18px] md:text-[20px] font-bold text-[var(--franco-text)] m-0 mb-0.5 leading-tight">
              Depto en {state.comuna || "—"}
              {" · "}{state.tipoPropiedad === "nuevo" ? "Nuevo" : "Usado"}
              {" · "}{state.superficieUtil || "—"}m²
            </h2>
            <p className="font-heading text-[14px] m-0" style={{ color: "color-mix(in srgb, var(--franco-text) 70%, transparent)" }}>
              {Number(state.precio) > 0 ? fmtUF(Number(state.precio)) : "—"}
              {" ≈ "}
              {Number(state.precio) > 0 ? fmtCLP(Number(state.precio) * ufCLP) : "—"}
              {" · pie "}{state.piePct}%
            </p>
          </div>

          {/* Banner introductorio dismissable — pattern dot indicator
              narrativo (Fase 4.8). sessionStorage persiste durante la
              sesión, reset al cerrar la pestaña. Copy condicional según si
              hay edits previos (Fase 14a) — evita el framing "valores
              automáticos" cuando el user ya editó campos en pasos 1-2. */}
          {!introDismissed && (
            <div className="flex items-start gap-3">
              <p className="font-mono text-[11px] m-0 flex-1 leading-[1.6] text-[var(--franco-text-secondary)]">
                {state.editedFields.length > 0
                  ? "● Estos son los valores con tus ajustes previos más sugerencias de mercado. Edítalos si necesitas refinar."
                  : "● Estos valores son sugerencias automáticas según el mercado de tu zona. Ajústalos si tienes información más precisa de tu caso."}
              </p>
              <button
                type="button"
                onClick={dismissIntro}
                aria-label="Cerrar mensaje"
                className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text-secondary)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <ResumenCard
            state={state}
            ufCLP={ufCLP}
            sampleSize={state.sampleSize}
            airRoi={airRoi}
            onAjustar={() => setAjustarOpen(true)}
          />

          {/* ── Sección "Operación Airbnb" — solo STR/AMBAS (Ronda 2b) ── */}
          {(mod === "str" || mod === "both") && (
            <OperacionAirbnbSection state={state} setState={setState} />
          )}

          {/* Costo tier-aware */}
          {tierInfo && <CostoCard tierInfo={tierInfo} />}

          {submitError && (
            <StateBox variant="left-border" state="negative">{submitError}</StateBox>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={onAnalizar}
            disabled={submitting || !mod}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando análisis…</>
            ) : (
              <>Analizar ahora →</>
            )}
          </button>
        </div>
      )}

      {mod && (
        <ModalAjusteCondiciones
          open={ajustarOpen}
          onClose={() => setAjustarOpen(false)}
          state={state}
          onSave={setState}
          suggestions={suggestions}
          ufCLP={ufCLP}
          onEditarPaso2={onEditarPaso2}
        />
      )}
    </div>
  );
}

function CostoCard({ tierInfo }: { tierInfo: TierInfo }) {
  const { costo, plan, color } = tierCopy(tierInfo);
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
          Costo
        </p>
        <p className="font-body text-[13px] font-medium m-0" style={{ color }}>
          {costo}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
          Plan actual
        </p>
        <p className="font-mono text-[12px] font-semibold text-[var(--franco-text)] m-0 tracking-wide">
          {plan}
        </p>
      </div>
    </div>
  );
}

function tierCopy(info: TierInfo): { costo: string; plan: string; color: string } {
  // Capa 1 binario: tier ya queda señalado por plan acronym (FRANCOMENSUAL, PRO,
  // GRATUITO, INVITADO, ADMIN). Color colapsado a Ink primario sin amarillo/verde.
  if (info.isAdmin) return { costo: "Análisis gratis (admin)", plan: "ADMIN", color: "var(--franco-text)" };
  if (info.tier === "subscriber") return { costo: "Incluido en tu suscripción FrancoMensual", plan: "FRANCOMENSUAL", color: "var(--franco-text)" };
  if (info.tier === "premium" && info.credits > 0) return { costo: `Usarás 1 de tus ${info.credits} créditos Pro`, plan: `PRO · ${info.credits} crédito${info.credits === 1 ? "" : "s"}`, color: "var(--franco-text)" };
  if (info.tier === "free") return { costo: "Usarás tu crédito gratis de bienvenida", plan: "GRATUITO", color: "var(--franco-text)" };
  return { costo: "Análisis gratuito (modo invitado)", plan: "INVITADO", color: "var(--franco-text)" };
}

// ─── Sección "Operación Airbnb" (Ronda 2b) ──
// Inputs críticos inline en Paso 3 cuando modalidad ∈ {str, both}. Resto de
// campos operativos (comisión exacta, costos electricidad/agua/wifi/insumos,
// mantención, amoblamiento) viven en Modal Ajustar (Ronda 2c).
function OperacionAirbnbSection({
  state,
  setState,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
}) {
  const inputClass =
    "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-body text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";
  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-[var(--franco-border)]">
      <div className="flex items-center gap-1.5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text-secondary)] m-0">
          Operación Airbnb
        </h3>
        <InfoTooltip content="Estos datos definen cómo operarás el Airbnb. El resto (costos operativos, amoblamiento, comisión exacta) puedes ajustarlos en 'Ajustar condiciones'." />
      </div>

      {/* Modo de gestión — toggle 2 cols */}
      <div>
        <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
          Modo de gestión
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["auto", "administrador"] as const).map((m) => {
            const active = state.modoGestion === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setState({ modoGestion: m })}
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
                  {m === "auto"
                    ? "Tú gestionas. Comisión Airbnb 3%."
                    : "Operador profesional. Comisión 20% por defecto."}
                </p>
              </button>
            );
          })}
        </div>
        {state.modoGestion === "administrador" && (
          <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 mt-2">
            Puedes ajustar la comisión exacta en &ldquo;Ajustar condiciones&rdquo;.
          </p>
        )}
      </div>

      {/* Edificio permite Airbnb */}
      <div>
        <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
          ¿Tu edificio permite Airbnb?
        </label>
        <select
          className={`${inputClass} appearance-none pr-8`}
          value={state.edificioPermiteAirbnb}
          onChange={(e) =>
            setState({
              edificioPermiteAirbnb: e.target.value as WizardV3State["edificioPermiteAirbnb"],
            })
          }
        >
          <option value="si">Sí permite</option>
          <option value="no">No permite</option>
          <option value="no_seguro">No estoy seguro</option>
        </select>
        {state.edificioPermiteAirbnb === "no" && (
          <div className="mt-2">
            <StateBox variant="left-border" state="negative">
              Algunos edificios prohíben Airbnb en su reglamento. Verifica antes de invertir — esto puede invalidar el modelo de negocio.
            </StateBox>
          </div>
        )}
        {state.edificioPermiteAirbnb === "no_seguro" && (
          <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 mt-2">
            Te conviene revisar el reglamento de copropiedad antes de comprar.
          </p>
        )}
      </div>
    </div>
  );
}

// Suppress unused export warning
export type { Modalidad };
