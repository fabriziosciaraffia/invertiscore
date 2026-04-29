"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";
import { ResumenCard } from "./ResumenCard";
import { ModalAjusteCondiciones } from "./ModalAjusteCondiciones";
import {
  fmtCLP,
  fmtUF,
  type Modalidad,
  type WizardV3State,
} from "./wizardV3State";

const OPCIONES: { key: "ltr" | "str" | "both"; label: string; sub: string; star?: boolean }[] = [
  { key: "ltr", label: "Renta larga", sub: "Arriendo tradicional a 1+ año" },
  { key: "str", label: "Renta corta", sub: "Airbnb / nochetro" },
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
    gastos: number | null;
    contribuciones: number | null;
  };
  onAnalizar: () => void;
  submitting: boolean;
  submitError: string;
}) {
  const [ajustarOpen, setAjustarOpen] = useState(false);
  const [mostrandoProximamente, setMostrandoProximamente] = useState<"str" | "both" | null>(null);

  const mod = state.modalidad;

  function selectModalidad(key: "ltr" | "str" | "both") {
    if (key === "str" || key === "both") {
      setMostrandoProximamente(key);
      return;
    }
    setState({ modalidad: key });
  }

  // ─── Pantalla "próximamente" para STR/AMBAS ──
  if (mostrandoProximamente) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
        <h2 className="font-heading text-xl font-bold text-[var(--franco-text)] m-0">
          {mostrandoProximamente === "str" ? "Renta corta" : "Comparar ambas"} — próximamente
        </h2>
        <p className="font-body text-[14px] text-[var(--franco-text-secondary)] max-w-sm m-0">
          STR estará disponible próximamente. Por ahora, elige LTR para analizar arriendo tradicional.
        </p>
        <button
          type="button"
          onClick={() => setMostrandoProximamente(null)}
          className="mt-2 font-body text-[13px] font-medium text-signal-red hover:underline"
        >
          ← Volver a elegir
        </button>
      </div>
    );
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

          <ResumenCard
            state={state}
            ufCLP={ufCLP}
            sampleSize={state.sampleSize}
            onAjustar={() => setAjustarOpen(true)}
          />

          {/* Costo tier-aware */}
          {tierInfo && <CostoCard tierInfo={tierInfo} />}

          {submitError && (
            <StateBox variant="left-border" state="negative">{submitError}</StateBox>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={onAnalizar}
            disabled={submitting || mod !== "ltr"}
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

// Suppress unused export warning
export type { Modalidad };
