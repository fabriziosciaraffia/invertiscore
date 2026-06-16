"use client";

// Paso 3 — Operacional inline.
// Estructura por ZONAS de pertenencia (sin letras A/B/C/D):
//   Renta larga (LTR)  · arriendo + extras + vacancia + gestión LTR
//   Renta corta (STR)  · estado del depto + operación Airbnb + costos operativos
//   Comunes            · gastos comunes + contribuciones
// Orden LTR → STR → Comunes. Los headers de zona son la estructura; las intros
// de una línea aparecen solo en AMBAS (desambiguan qué input alimenta qué
// escenario). En modalidad única el chip ya identifica el modo → label sin intro.
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
  markFieldEdited,
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
  // Solo en AMBAS las intros de zona aportan (desambiguan LTR vs STR vs común).
  const isAmbas = mod === "both";

  function selectModalidad(key: "ltr" | "str" | "both") {
    setState({ modalidad: key });
  }

  // setState + marcado en editedFields para los campos PRELLENADOS (arriendo,
  // gastos, contribuciones, costos op STR, amoblamiento). Sin esto, el prefill
  // de mercado/escalado los sobrescribía en silencio tras una edición manual.
  // Mismo mecanismo que el Paso 2 (markFieldEdited en wizardV3State).
  function trackEdit(key: keyof WizardV3State, value: string) {
    setState(markFieldEdited(state.editedFields, key, value));
  }

  const modLabel = OPCIONES.find((o) => o.key === mod);

  // Tipología para los headers dinámicos de las cards STR.
  const tipologiaLabel = state.esStudio
    ? "para tu studio"
    : `para tu depto ${state.dormitorios || "—"}D${state.banos || "—"}B`;

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

  // ── Estado 2: modalidad elegida → zonas operacionales ──
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

      {/* ════ Zonas operacionales — agrupadas por pertenencia (LTR / STR /
          Comunes), orden LTR → STR → Comunes. Los headers de zona son la
          estructura (sin letras A/B/C/D); las intros aparecen solo en AMBAS.
          Gap mayor (gap-10) entre zonas; gap menor (gap-5) dentro. ════ */}
      <div className="flex flex-col gap-10">

        {/* ── Zona RENTA LARGA (solo LTR / AMBAS) ── */}
        {showLTR && (
          <section className="flex flex-col gap-5">
            <ZoneHeader
              name="Renta larga"
              intro={isAmbas ? "Cuánto cobras de arriendo y qué se te va en vacancia y gestión." : undefined}
            />
            <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
              <label className="block">
                <span className="flex items-center gap-1.5 mb-1.5">
                  <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Arriendo mensual estimado</span>
                  <InfoTooltip content="Sugerencia calculada con la mediana de arriendos publicados de propiedades similares en la zona." />
                </span>
                <MoneyInput
                  className={inputBase}
                  value={state.arriendo}
                  onChange={(raw) => trackEdit("arriendo", raw)}
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

              {/* Vacancia + % gestión LTR — pertenecen al bloque operacional LTR. */}
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
          </section>
        )}

        {/* ── Zona RENTA CORTA (solo STR / AMBAS) ── */}
        {showSTR && (
          <section className="flex flex-col gap-5">
            <ZoneHeader
              name="Renta corta"
              intro={isAmbas ? "Cómo habilitas el depto, quién lo opera y qué cuesta correrlo." : undefined}
            />

            {/* Ingresos estimados Airbnb — héroe de la sub-zona STR (primero) */}
            <BloqueOperacionSTR
              state={state}
              setState={setState}
              adrBaselineSugerido={adrBaselineSugerido}
            />

            {/* Habilitación del depto */}
            <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
              <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
                Habilitación del depto · {tipologiaLabel}
              </div>

              {/* ¿Está amoblado? */}
              <div>
                <span className="flex items-center gap-1.5 mb-1.5">
                  <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">¿Está amoblado?</span>
                  <InfoTooltip content="Si el depto ya viene amoblado, no se considera inversión inicial. Si no, sumamos el costo de amoblar al cálculo." />
                </span>
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
                    <span className="flex items-center gap-1.5 mb-1.5">
                      <label className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                        Costo de amoblar (CLP único)
                      </label>
                      <InfoTooltip content="Inversión única para amoblar el depto y dejarlo listo para Airbnb. Se descuenta del flujo del año 1." />
                    </span>
                    <MoneyInput
                      className={inputBase}
                      value={state.costoAmoblamiento}
                      onChange={(raw) => trackEdit("costoAmoblamiento", raw)}
                    />
                    <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                      Default escalado por dormitorios × habilitación.
                    </p>
                  </div>
                )}
              </div>

              {/* Habilitación */}
              <div>
                <span className="flex items-center gap-1.5 mb-1.5">
                  <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Habilitación / posicionamiento</span>
                  <InfoTooltip content="Qué tan cuidado está el departamento: amoblamiento, fotos y amenidades. Premium implica decoración curada, blancos hoteleros y amenidades extra. Define el costo de habilitación, no la tarifa." />
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
                  {state.habilitacion === "basico" && "Funcional, fotos amateur."}
                  {state.habilitacion === "estandar" && "Decente, con fotos profesionales."}
                  {state.habilitacion === "premium" && "Decoración curada y amenidades extra."}
                </p>
              </div>
            </div>

            {/* Costos operativos — movidos desde la antigua zona Costos. El
                header de la card es el toggle del collapsible. El gate showSTR
                lo hereda de esta zona (no necesita condición propia). */}
            <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
              <button
                type="button"
                onClick={() => setStrCostsOpen((o) => !o)}
                className="flex w-full items-center justify-between"
              >
                <span className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
                  Costos operativos · {tipologiaLabel}
                </span>
                <ChevronDown className={`h-4 w-4 text-[var(--franco-text-muted)] transition-transform ${strCostsOpen ? "rotate-180" : ""}`} />
              </button>
              {strCostsOpen && (
                <div className="grid grid-cols-2 gap-3">
                  <CostInput
                    label="Electricidad"
                    value={state.costoElectricidad}
                    onChange={(v) => trackEdit("costoElectricidad", v)}
                    tooltip="Cuenta de luz mensual promedio. En Airbnb la paga el dueño, no el huésped."
                  />
                  <CostInput
                    label="Agua"
                    value={state.costoAgua}
                    onChange={(v) => trackEdit("costoAgua", v)}
                    tooltip="Cuenta de agua mensual promedio. La paga el dueño."
                  />
                  <CostInput
                    label="Internet"
                    value={state.costoWifi}
                    onChange={(v) => trackEdit("costoWifi", v)}
                    tooltip="Plan de internet mensual. Es fijo, no varía con el tamaño del depto. Esencial para Airbnb — un mal internet baja las reseñas."
                  />
                  <CostInput
                    label="Insumos"
                    value={state.costoInsumos}
                    onChange={(v) => trackEdit("costoInsumos", v)}
                    tooltip="Reposición mensual de amenities, café, papel higiénico, jabones."
                  />
                  <CostInput
                    label="Mantención"
                    value={state.mantencionMensual}
                    onChange={(v) => trackEdit("mantencionMensual", v)}
                    tooltip="Reparaciones menores y reposición de equipamiento que se desgasta."
                  />
                </div>
              )}
              {strCostsOpen && (
                <p className="font-mono text-[11px] text-[var(--franco-text-muted)] m-0">
                  Defaults escalados por tipología (excepto Internet, que es plan fijo). Edita si tienes data real.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Zona COSTOS DEL DEPARTAMENTO (siempre visible). Nombre unificado
            en todas las modalidades; la intro (solo AMBAS) transmite el "común
            a ambas" sin cambiar el título. ── */}
        <section className="flex flex-col gap-5">
          <ZoneHeader
            name="Costos del departamento"
            intro={isAmbas ? "Gastos fijos del depto: los pagas arriendes como arriendes." : undefined}
          />
          <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-4">
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">
                  Gastos comunes mensuales
                </span>
                <InfoTooltip content="Cuota mensual a la administración del edificio. La pagas tú aunque el depto esté vacío." />
              </span>
              <MoneyInput
                className={inputBase}
                value={state.gastos}
                onChange={(raw) => trackEdit("gastos", raw)}
              />
              {suggestions.gastos && (
                <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                  Mercado sugiere {fmtCLP(suggestions.gastos)} (tier comuna · superficie × valor m²).
                </p>
              )}
            </label>

            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">
                  Contribuciones (trimestral, CLP)
                </span>
                <InfoTooltip content="Impuesto territorial que paga el dueño cada 3 meses. Lo calcula el SII según el avalúo fiscal." />
              </span>
              <MoneyInput
                className={inputBase}
                value={state.contribuciones}
                onChange={(raw) => trackEdit("contribuciones", raw)}
              />
              {suggestions.contribuciones && (
                <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
                  Mercado sugiere {fmtCLP(suggestions.contribuciones)} (cálculo SII estimado).
                </p>
              )}
            </label>
          </div>
        </section>

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
          {/* "Saltar y analizar" solo cuando el user puede analizar. Sin
              créditos NO mostramos un botón dead-end disabled "Necesitas un
              crédito": la CostoCard de arriba es la única señal de paywall y
              ofrece las salidas (comprar single / ver planes). "Continuar al
              paso 4" queda como único CTA del pie. */}
          {canAnalyze && (
            <button
              type="button"
              onClick={onAnalizar}
              disabled={submitting || !mod}
              className="font-body text-[13px] font-medium text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-4 py-2.5 rounded-lg border border-[var(--franco-border)] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
              ) : (
                <>Saltar y analizar</>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onAvanzar4}
            disabled={submitting || !mod}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            Continuar al paso 4 <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────

/** Header de zona operacional (Renta larga / Renta corta / Costos del depto).
 * Reemplaza las letras A/B/C/D: el nombre de zona ES la estructura.
 * Título Serif Bold 18px — mismo tratamiento de autoridad que los títulos de
 * sección del Paso 4 (ResumenSection) para que la pertenencia se lea fuerte.
 * Intro Sans opcional (Ink muted) solo en AMBAS, donde desambigua qué input
 * alimenta qué escenario. */
function ZoneHeader({ name, intro }: { name: string; intro?: string }) {
  return (
    <div>
      <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] m-0 leading-tight">
        {name}
      </h3>
      {intro && (
        <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0 mt-1 leading-snug">
          {intro}
        </p>
      )}
    </div>
  );
}

function CostInput({
  label, value, onChange, tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Opcional. 1 frase explicando el campo en lenguaje no técnico. */
  tooltip?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 mb-1.5">
        <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
          {label}
        </span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <MoneyInput
        className={inputBase}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

export function CostoCard({ tierInfo }: { tierInfo: TierInfo }) {
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
        {/* Deep-link de compra: paga $9.990 y desbloquea su próximo análisis
            directo, conservando la intención de compra (vs /pricing genérico).
            Link secundario a planes para quien quiere volumen. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/checkout?product=single"
            className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] uppercase tracking-[0.06em] font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--signal-red)" }}
          >
            Comprar 1 análisis
            <ArrowRight size={12} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center self-start font-mono text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--franco-text-muted)] hover:text-[var(--franco-text-secondary)] transition-colors"
          >
            Ver todos los planes
          </Link>
        </div>
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
