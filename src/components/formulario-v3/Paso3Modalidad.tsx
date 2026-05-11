"use client";

// Paso 3 — Operacional inline. Iteración 2026-05-10.
// Reemplaza el modal ModalAjusteCondiciones por 4 bloques inline:
//   A · Estado del depto (estaAmoblado + habilitacion)
//   B · Operación Airbnb (componente BloqueOperacionSTR con preview + overrides)
//   C · Comparativa renta larga (arriendo + extras)
//   D · Costos mensuales (gastos + contribuciones + costos op STR collapsible)
//
// El paso 4 (ajuste fino) es opcional. CTAs:
//   - "Saltar y analizar" → onAnalizar directo
//   - "Continuar a ajuste fino →" → onAvanzar4

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, X, ArrowRight, ChevronDown } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";
import { InfoTooltip } from "@/components/ui/tooltip";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { BloqueOperacionSTR } from "./BloqueOperacionSTR";
import {
  fmtCLP,
  fmtUF,
  parseDecimalLocale,
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
  welcomeAvailable?: boolean;
  email: string | null;
}

export function canAnalyzeFromTier(info: TierInfo | null): boolean {
  if (!info) return false;
  if (info.isAdmin) return true;
  if (info.tier === "subscriber") return true;
  if (info.credits > 0) return true;
  if (info.welcomeAvailable) return true;
  return false;
}

const inputBase =
  "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

export function Paso3Modalidad({
  state,
  setState,
  ufCLP,
  tierInfo,
  suggestions,
  airRoi,
  onAnalizar,
  onAvanzar4,
  onVolverAResumen,
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
  /** "Saltar y analizar" → POST directo. */
  onAnalizar: () => void;
  /** "Continuar a ajuste fino →" → navega al paso 4 sin POST. */
  onAvanzar4: () => void;
  /** "Volver al resumen →" → solo cuando state.returnToStep !== null.
   * Reemplaza onAnalizar + onAvanzar4 en modo edit-from-resumen. */
  onVolverAResumen: () => void;
  submitting: boolean;
  submitError: string;
}) {
  // Banner introductorio dismissable
  const [introDismissed, setIntroDismissed] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("franco_p3_intro_dismissed") === "1") setIntroDismissed(true);
    } catch { /* private mode */ }
  }, []);
  function dismissIntro() {
    try { sessionStorage.setItem("franco_p3_intro_dismissed", "1"); } catch { /* graceful */ }
    setIntroDismissed(true);
  }

  // Costos operativos STR collapsible
  const [strCostsOpen, setStrCostsOpen] = useState(true);

  const mod = state.modalidad;
  const showSTR = mod === "str" || mod === "both";
  const showLTR = mod === "ltr" || mod === "both";

  function selectModalidad(key: "ltr" | "str" | "both") {
    setState({ modalidad: key });
  }

  const modLabel = OPCIONES.find((o) => o.key === mod);

  // Derivar ADR baseline para el bloque B. AirROI da ingreso mensual + occ;
  // ADR/noche = (ingresoAnual) / (occ × 365).
  const adrBaselineSugerido: number | null = (() => {
    if (airRoi.isLoading || airRoi.error) return null;
    const ingresoAnual = airRoi.ingresoBrutoMensual * 12;
    const occ = airRoi.ocupacionReferencia;
    if (ingresoAnual <= 0 || occ <= 0) return null;
    return Math.round(ingresoAnual / (occ * 365));
  })();

  // ── Estado 1: sin modalidad ──
  if (!mod) {
    return (
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
          Elige una opción para ver los bloques operacionales
        </p>
      </div>
    );
  }

  // ── Estado 2: modalidad elegida → bloques A-D ──
  const canAnalyze = canAnalyzeFromTier(tierInfo);

  return (
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

      {/* Headline depto */}
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

      {/* Banner introductorio */}
      {!introDismissed && (
        <div className="flex items-start gap-3">
          <p className="font-mono text-[11px] m-0 flex-1 leading-[1.6] text-[var(--franco-text-secondary)]">
            ● Completa los bloques operacionales abajo. Defaults son sugerencias del mercado — edita si tienes data real.
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

      {/* ════ Bloque A · Estado del depto (siempre visible) ════ */}
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
        <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
          A · Estado del depto
        </div>

        {/* ¿Está amoblado? */}
        <div>
          <span className="font-body text-[13px] font-semibold text-[var(--franco-text)] block mb-1.5">¿Está amoblado?</span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: false, label: "No, falta amoblar" },
              { value: true, label: "Sí, ya amoblado" },
            ] as const).map((opt) => {
              const active = state.estaAmoblado === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setState({ estaAmoblado: opt.value })}
                  className={`h-10 rounded-lg font-body text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                      : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 mt-2 leading-snug">
            {state.estaAmoblado ? "Sin inversión inicial pendiente." : "Se calcula inversión inicial para amoblar."}
          </p>
          {!state.estaAmoblado && (
            <div className="mt-3">
              <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
                Costo de amoblar (CLP único)
              </label>
              <MoneyInput
                className={inputBase}
                value={state.costoAmoblamiento}
                onChange={(raw) => setState({ costoAmoblamiento: raw })}
              />
              <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                Default $3.500.000 para 2D1B estándar Airbnb.
              </p>
            </div>
          )}
        </div>

        {/* Habilitación */}
        <div>
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Habilitación / posicionamiento</span>
            <InfoTooltip content="Define la calidad percibida por los huéspedes y por tanto el ADR. Premium implica decoración curada, blancos hoteleros, amenidades extra." />
          </span>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "basico", label: "Básico" },
              { value: "estandar", label: "Estándar" },
              { value: "premium", label: "Premium" },
            ] as const).map((opt) => {
              const active = state.habilitacion === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setState({ habilitacion: opt.value })}
                  className={`h-10 rounded-lg font-body text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                      : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] m-0 mt-1.5 leading-snug">
            {state.habilitacion === "basico" && "Funcional, fotos amateur. ADR sin uplift."}
            {state.habilitacion === "estandar" && "Decente + fotos profesionales. ADR ×1.05."}
            {state.habilitacion === "premium" && "Decoración curada, amenidades. ADR ×1.10."}
          </p>
        </div>
      </div>

      {/* ════ Bloque B · Operación Airbnb (solo STR/AMBAS) ════ */}
      {showSTR && (
        <BloqueOperacionSTR
          state={state}
          setState={setState}
          adrBaselineSugerido={adrBaselineSugerido}
        />
      )}

      {/* ════ Bloque C · Comparativa renta larga (solo LTR/AMBAS) ════ */}
      {showLTR && (
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
            C · Comparativa renta larga
          </div>

          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Arriendo mensual estimado</span>
              <InfoTooltip content="Sugerencia calculada con la mediana de arriendos publicados de propiedades similares en la zona." />
            </span>
            <MoneyInput
              className={inputBase}
              value={state.arriendo}
              onChange={(raw) => setState({ arriendo: raw })}
            />
            {suggestions.arriendo && (
              <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                Mercado sugiere {fmtCLP(suggestions.arriendo)}
                {suggestions.arriendoSampleSize ? ` · ${suggestions.arriendoSampleSize} comparables` : ""}.
              </p>
            )}
          </label>

          {Number(state.estacionamientos) > 0 && (
            <label className="block">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
                Arriendo estacionamiento ($/mes)
              </span>
              <MoneyInput
                className={inputBase}
                value={state.arriendoEstac}
                onChange={(raw) => setState({ arriendoEstac: raw })}
                placeholder={(40000 * Number(state.estacionamientos)).toLocaleString("es-CL")}
              />
            </label>
          )}

          {Number(state.bodegas) > 0 && (
            <label className="block">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
                Arriendo bodega ($/mes)
              </span>
              <MoneyInput
                className={inputBase}
                value={state.arriendoBodega}
                onChange={(raw) => setState({ arriendoBodega: raw })}
                placeholder={(15000 * Number(state.bodegas)).toLocaleString("es-CL")}
              />
            </label>
          )}

          {/* Vacancia + % gestión LTR — movidos desde paso 4 (eran "ajuste
              fino" mal ubicados; pertenecen al bloque operacional LTR). */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-[var(--franco-border)]">
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">Vacancia: {state.vacanciaPct}%</span>
                <InfoTooltip content="Porcentaje del año sin arrendatario. Default 5% ≈ 18 días/año. Se descuenta del flujo proyectado." />
              </span>
              <input
                type="range" min={0} max={25} step={1}
                value={state.vacanciaPct}
                onChange={(e) => setState({ vacanciaPct: e.target.value })}
                className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">Gestión LTR: {state.adminPct}%</span>
                <InfoTooltip content="Comisión del corredor LTR (publicación, cobranza). Default 0% = autogestión. Típico 7-10% si delegas." />
              </span>
              <input
                type="range" min={0} max={15} step={1}
                value={state.adminPct}
                onChange={(e) => setState({ adminPct: e.target.value })}
                className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* ════ Bloque D · Costos mensuales (siempre visible) ════ */}
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
        <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
          D · Costos mensuales recurrentes
        </div>

        <label className="block">
          <span className="font-body text-[13px] font-semibold text-[var(--franco-text)] block mb-1.5">
            Gastos comunes mensuales
          </span>
          <MoneyInput
            className={inputBase}
            value={state.gastos}
            onChange={(raw) => setState({ gastos: raw })}
          />
          {suggestions.gastos && (
            <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
              Mercado sugiere {fmtCLP(suggestions.gastos)} (tier comuna · superficie × valor m²).
            </p>
          )}
        </label>

        <label className="block">
          <span className="font-body text-[13px] font-semibold text-[var(--franco-text)] block mb-1.5">
            Contribuciones (trimestral, CLP)
          </span>
          <MoneyInput
            className={inputBase}
            value={state.contribuciones}
            onChange={(raw) => setState({ contribuciones: raw })}
          />
          {suggestions.contribuciones && (
            <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
              Mercado sugiere {fmtCLP(suggestions.contribuciones)} (cálculo SII estimado).
            </p>
          )}
        </label>

        {/* Costos operativos STR — collapsible, solo si STR/AMBAS */}
        {showSTR && (
          <div className="pt-3 border-t border-dashed border-[var(--franco-border)]">
            <button
              type="button"
              onClick={() => setStrCostsOpen((o) => !o)}
              className="flex w-full items-center justify-between"
            >
              <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                Costos operativos STR
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${strCostsOpen ? "rotate-180" : ""}`} />
            </button>
            {strCostsOpen && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <CostInput label="Electricidad" value={state.costoElectricidad} onChange={(v) => setState({ costoElectricidad: v })} />
                <CostInput label="Agua" value={state.costoAgua} onChange={(v) => setState({ costoAgua: v })} />
                <CostInput label="WiFi" value={state.costoWifi} onChange={(v) => setState({ costoWifi: v })} />
                <CostInput label="Insumos" value={state.costoInsumos} onChange={(v) => setState({ costoInsumos: v })} />
                <CostInput label="Mantención" value={state.mantencionMensual} onChange={(v) => setState({ mantencionMensual: v })} />
              </div>
            )}
            {strCostsOpen && (
              <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-2 m-0">
                Defaults para 2D1B en Santiago. Edita si tienes data real.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Costo tier-aware */}
      {tierInfo && <CostoCard tierInfo={tierInfo} />}

      {submitError && (
        <StateBox variant="left-border" state="negative">{submitError}</StateBox>
      )}

      {/* CTAs paso 3 — modo normal vs modo edit-from-resumen. */}
      {state.returnToStep !== null ? (
        // Modo edit-from-resumen: un solo CTA "Volver al resumen →" que
        // reemplaza tanto "Saltar y analizar" como "Continuar a ajuste fino".
        <div className="flex justify-end pt-4 border-t border-[var(--franco-border)]">
          <button
            type="button"
            onClick={onVolverAResumen}
            disabled={submitting || !mod}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            Volver al resumen <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-[var(--franco-border)]">
          <button
            type="button"
            onClick={onAnalizar}
            disabled={submitting || !mod || !canAnalyze}
            className="font-body text-[13px] font-medium text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-4 py-2.5 rounded-lg border border-[var(--franco-border)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
            ) : !canAnalyze ? (
              <>Necesitas un crédito</>
            ) : (
              <>Saltar y analizar</>
            )}
          </button>
          <button
            type="button"
            onClick={onAvanzar4}
            disabled={submitting || !mod}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            Continuar a ajuste fino <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────

function CostInput({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
        {label}
      </span>
      <MoneyInput
        className={inputBase}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

function CostoCard({ tierInfo }: { tierInfo: TierInfo }) {
  const copy = tierCopy(tierInfo);
  if (!copy.canAnalyze) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{
          border: "1px solid var(--franco-sc-bad-border)",
          background: "var(--franco-sc-bad-bg)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
              Costo
            </p>
            <p className="font-body text-[13px] font-medium m-0" style={{ color: "var(--signal-red)" }}>
              {copy.costo}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
              Plan actual
            </p>
            <p className="font-mono text-[12px] font-semibold m-0 tracking-wide" style={{ color: "var(--signal-red)" }}>
              {copy.plan}
            </p>
          </div>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] uppercase tracking-[0.06em] font-medium hover:opacity-80 transition-opacity"
          style={{ color: "var(--signal-red)" }}
        >
          Ver planes
          <ArrowRight size={12} />
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
          Costo
        </p>
        <p className="font-body text-[13px] font-medium m-0" style={{ color: copy.color }}>
          {copy.costo}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
          Plan actual
        </p>
        <p className="font-mono text-[12px] font-semibold text-[var(--franco-text)] m-0 tracking-wide">
          {copy.plan}
        </p>
      </div>
    </div>
  );
}

function tierCopy(info: TierInfo): { costo: string; plan: string; color: string; canAnalyze: boolean } {
  if (info.isAdmin) return { costo: "Análisis gratis (admin)", plan: "ADMIN", color: "var(--franco-text)", canAnalyze: true };
  if (info.tier === "subscriber") return { costo: "Incluido en tu suscripción FrancoMensual", plan: "FRANCOMENSUAL", color: "var(--franco-text)", canAnalyze: true };
  if (info.credits > 0) return { costo: `Usarás 1 de tus ${info.credits} créditos Pro`, plan: `PRO · ${info.credits} crédito${info.credits === 1 ? "" : "s"}`, color: "var(--franco-text)", canAnalyze: true };
  if (info.welcomeAvailable) return { costo: "Usarás tu crédito gratis de bienvenida", plan: "GRATUITO", color: "var(--franco-text)", canAnalyze: true };
  return { costo: "Sin créditos disponibles. Compra uno para continuar.", plan: "SIN CRÉDITOS", color: "var(--signal-red)", canAnalyze: false };
}

// Re-exports utilitarios para compatibilidad con callsites antiguos
export type { Modalidad };
export { parseDecimalLocale };
