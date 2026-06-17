"use client";

// Bloque de ingresos STR del paso 3 — preview live + overrides manuales.
// Iteración 2026-06: reordenado a "ingreso = héroe". El KPI del ingreso mensual
// va arriba y destacado; las preguntas de config (edificio / operador) bajan
// como "Ajusta los supuestos". El flujo incremental (ocultar hasta elegir
// edificio) se eliminó: tipoEdificio viene preseleccionado "residencial_puro"
// (wizardV3State) → el ingreso se ve de entrada.
//
// Inputs visibles:
//   - tipoEdificio (binario: residencial_puro | dedicado)
//   - gestionOption (binario: tu_mismo | pro_formal) → fusión modoGestion+adminPro
//   - comisionAdminPct (slider, solo si pro_formal)
//   - edificioPermiteAirbnb (select, oculto si tipoEdificio=dedicado)
//   - operadorNombre (text, solo si tipoEdificio=dedicado)
//
// Preview live:
//   - ADR baseline del prefetch AirROI (prop adrBaselineSugerido).
//   - Tarifa estimada = baseline (factores ADR neutralizados a 1.00).
//   - Ocupación target según banda (edificio × operador).
//   - Ingreso mensual estimado (bruto) = tarifa × ocupación × 365 / 12.
//
// Overrides manuales: ADR y Occ editables (input + badge + "Usar sugerido").

import { useEffect, useState } from "react";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import { FieldEstadoTag, UsarEstimacion } from "./FieldEstado";
import {
  fmtCLP,
  gestionOptionToMotor,
  type WizardV3State,
} from "./wizardV3State";

// ─── Helpers (replican lógica del motor para preview cliente) ───
const STR_OCUPACION_TARGET = {
  edificio_dedicado_admin_pro: 0.74,
  edificio_dedicado_auto: 0.65,
  admin_pro_residencial: 0.65,
  auto_gestion_residencial: 0.55,
} as const;

function calcBandaOcc(tipoEdificio: WizardV3State["tipoEdificio"], adminPro: boolean): {
  banda: keyof typeof STR_OCUPACION_TARGET;
  occ: number;
} {
  const dedicado = tipoEdificio === "dedicado";
  let banda: keyof typeof STR_OCUPACION_TARGET;
  if (dedicado && adminPro) banda = "edificio_dedicado_admin_pro";
  else if (dedicado && !adminPro) banda = "edificio_dedicado_auto";
  else if (!dedicado && adminPro) banda = "admin_pro_residencial";
  else banda = "auto_gestion_residencial";
  return { banda, occ: STR_OCUPACION_TARGET[banda] };
}

// Factores ADR neutralizados a 1.00 (2026-06) para reflejar el motor: el uplift
// de ADR por edificio/habilitación no tenía respaldo (ver STR_ADR_FACTOR en
// short-term-engine.ts). El preview ya no infla la tarifa por estos ejes.
// Estructura intacta por si se re-ancla con data.
function calcFactorEdif(): number {
  return 1.00;
}

function calcFactorHab(): number {
  return 1.00;
}

const inputBase =
  "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-body text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

export function BloqueOperacionSTR({
  state,
  setState,
  /** ADR baseline sugerido (CLP/noche). Si null, el preview muestra "—". En
   * la implementación real esto viene del prefetch AirROI; hoy lo recibimos
   * como prop para mantener el componente desacoplado. */
  adrBaselineSugerido,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  adrBaselineSugerido: number | null;
}) {
  // ─── Derivaciones live ───
  const motor = gestionOptionToMotor(state.gestionOption);
  const factorEdif = calcFactorEdif();
  const factorHab = calcFactorHab();
  const factorADRTotal = factorEdif * factorHab;
  const { banda, occ: occDerivada } = calcBandaOcc(state.tipoEdificio, motor.adminPro);

  const adrDerivado = adrBaselineSugerido != null
    ? Math.round(adrBaselineSugerido * factorADRTotal)
    : null;

  const adrEsOverride = state.adrOverride !== null;
  const occEsOverride = state.occOverride !== null;
  const adrFinal = adrEsOverride ? (state.adrOverride as number) : adrDerivado;
  const occFinal = occEsOverride ? (state.occOverride as number) : occDerivada;

  const revenueMensual = adrFinal != null
    ? Math.round((adrFinal * occFinal * 365) / 12)
    : null;

  // ─── Override handlers ───
  function enableAdrOverride() {
    if (adrDerivado != null) setState({ adrOverride: adrDerivado });
  }
  function resetAdrOverride() { setState({ adrOverride: null }); }
  function enableOccOverride() { setState({ occOverride: occDerivada }); }
  function resetOccOverride() { setState({ occOverride: null }); }

  // ─── Local buffers para inputs (iter 2026-05-10) ───
  // Permitir borrar el contenido sin colapsar el override. La validación
  // (parse a número, commit a state) ocurre en blur.
  const [adrBuffer, setAdrBuffer] = useState<string>(
    state.adrOverride !== null ? String(state.adrOverride) : "",
  );
  const [occBuffer, setOccBuffer] = useState<string>(
    state.occOverride !== null ? String(Math.round(state.occOverride * 100)) : "",
  );
  // Sync cuando override se cambia desde afuera (ej. "Usar sugerido" reset).
  useEffect(() => {
    setAdrBuffer(state.adrOverride !== null ? String(state.adrOverride) : "");
  }, [state.adrOverride]);
  useEffect(() => {
    setOccBuffer(state.occOverride !== null ? String(Math.round(state.occOverride * 100)) : "");
  }, [state.occOverride]);

  function commitAdrBuffer() {
    const trimmed = adrBuffer.trim();
    if (trimmed === "") {
      // Empty → mantener override pero con valor inválido implícito hace que
      // adrFinal caiga al derivado. Mejor reset explícito.
      setState({ adrOverride: null });
      return;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) {
      setState({ adrOverride: null });
      return;
    }
    setState({ adrOverride: Math.round(num) });
  }
  function commitOccBuffer() {
    const trimmed = occBuffer.trim();
    if (trimmed === "") {
      setState({ occOverride: null });
      return;
    }
    const pct = Number(trimmed);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 95) {
      setState({ occOverride: null });
      return;
    }
    setState({ occOverride: pct / 100 });
  }

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-5 mt-3">
      <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
        Ingresos estimados Airbnb
      </div>

      {/* ── HÉROE: Ingreso mensual estimado (resultado primero) ──
          Border-left Ink con esquinas izquierdas cuadradas (regla design
          system). El KPI del ingreso es el dominante; tarifa y ocupación
          quedan como breakdown de soporte debajo. */}
      <div
        className="rounded-r-lg p-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text-secondary)] m-0 mb-1.5 flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            Ingreso mensual estimado
            <InfoTooltip content="Lo que entra a tu bolsillo cada mes en promedio, antes de descontar gastos, comisiones y crédito hipotecario. Calculado como tarifa × ocupación × 30 días." />
          </span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal font-normal text-[var(--franco-text-muted)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--franco-text)] animate-pulse" aria-hidden />
            live
          </span>
        </p>

        {adrBaselineSugerido == null ? (
          <p className="font-body text-[13px] text-[var(--franco-text-muted)] m-0 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--franco-text)] animate-pulse" aria-hidden />
            Esperando estimación de mercado…
          </p>
        ) : (
          <>
            {/* KPI dominante del ingreso (Mono Bold) + qualifier "bruto" sutil */}
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[26px] font-bold text-[var(--franco-text)] leading-none">
                {revenueMensual != null ? fmtCLP(revenueMensual) : "—"}
              </span>
              <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">/mes · bruto</span>
            </div>

            {/* Breakdown de soporte: tarifa de mercado, tu tarifa (override),
                ocupación (override). Overrides inline intactos. */}
            <div className="space-y-1.5 mt-3 pt-3 border-t border-dashed border-[var(--franco-border)]">
              <div className="flex justify-between font-mono text-[11px] text-[var(--franco-text-muted)]">
                <span className="flex items-center gap-1.5">
                  Tarifa diaria promedio del mercado
                  <InfoTooltip content="Lo que cobran por noche, en promedio, los Airbnb parecidos al tuyo en esta zona." />
                </span>
                <span>{fmtCLP(adrBaselineSugerido)}</span>
              </div>

              {/* Tu tarifa diaria estimada — editable (interna: adrAjustado).
                  Sin uplift por edificio/habilitación (factores neutralizados a
                  1.00): la base = tarifa de mercado, salvo override manual. */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--franco-border)]">
                <span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[var(--franco-text)]">
                  Tu tarifa diaria estimada
                  <InfoTooltip content="Lo que vas a cobrar por noche, anclado a la tarifa de mercado de la zona. Es la base del cálculo de ingresos." />
                </span>
                {!adrEsOverride ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-[var(--franco-text)]">
                      {adrDerivado != null ? fmtCLP(adrDerivado) : "—"}/noche
                    </span>
                    <button
                      type="button"
                      onClick={enableAdrOverride}
                      className="font-mono text-[10px] text-[var(--franco-text-muted)] underline decoration-dotted hover:text-[var(--franco-text)]"
                    >
                      Editar manualmente
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={adrBuffer}
                      onChange={(e) => setAdrBuffer(e.target.value)}
                      onBlur={commitAdrBuffer}
                      placeholder="—"
                      className="w-28 h-8 px-2 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-right"
                    />
                    <FieldEstadoTag estado="modificado" />
                    <UsarEstimacion onClick={resetAdrOverride} label="Usar estimación" />
                  </span>
                )}
              </div>

              {/* Ocupación — editable */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--franco-border)]">
                <span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[var(--franco-text)]">
                  Ocupación estabilizada (mes 7+)
                  <InfoTooltip content="Porcentaje del año que el depto está reservado. 'Estabilizada' = cuando ya llevas más de 6 meses operando, tienes reseñas y el listing maduró." />
                </span>
                {!occEsOverride ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-[var(--franco-text)]">
                      {(occDerivada * 100).toFixed(0)}%
                    </span>
                    <button
                      type="button"
                      onClick={enableOccOverride}
                      className="font-mono text-[10px] text-[var(--franco-text-muted)] underline decoration-dotted hover:text-[var(--franco-text)]"
                    >
                      Editar manualmente
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={occBuffer}
                      onChange={(e) => setOccBuffer(e.target.value)}
                      onBlur={commitOccBuffer}
                      placeholder="—"
                      className="w-20 h-8 px-2 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-right"
                    />
                    <span className="font-mono text-[12px]">%</span>
                    <FieldEstadoTag estado="modificado" />
                    <UsarEstimacion onClick={resetOccOverride} label="Usar estimación" />
                  </span>
                )}
              </div>
            </div>

            <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-2 italic">
              {(adrEsOverride || occEsOverride)
                ? "Override manual activo — el motor usa tus valores en lugar de los derivados de los ejes."
                : "Banda operacional: " + banda.replace(/_/g, " ") + "."}
            </p>
          </>
        )}
      </div>

      {/* ── Ajusta los supuestos (demotado, debajo del ingreso) ──
          Las dos preguntas mueven la banda de ocupación → el ingreso de arriba
          se recalcula live al cambiarlas. */}
      <div className="space-y-4 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0">
          Ajusta los supuestos
        </p>

        {/* ── Eje 1: Tipo de edificio (binario) ── */}
        <div>
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">¿Cómo es el edificio?</span>
            <InfoTooltip content="Residencial = la mayoría de los vecinos vive ahí. Dedicado = edificio diseñado para Airbnb (tipo Andes STR, HOM), donde todos los departamentos son de renta corta." />
          </span>
          <div className="flex flex-col gap-1.5">
            {([
              { value: "residencial_puro", label: "Residencial", subtitle: "La mayoría de los vecinos vive ahí" },
              { value: "dedicado", label: "Dedicado 100% renta corta", subtitle: "Tipo Andes STR, HOM — diseñado para Airbnb" },
            ] as const).map((opt) => {
              const active = state.tipoEdificio === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    // Edificio dedicado → auto-aplica defaults que reflejan la
                    // realidad: opera con admin profesional y obviamente permite
                    // Airbnb. El user puede cambiar gestionOption manualmente
                    // después; edificioPermiteAirbnb queda oculto.
                    if (opt.value === "dedicado") {
                      const m = gestionOptionToMotor("pro_formal");
                      setState({
                        tipoEdificio: opt.value,
                        gestionOption: "pro_formal",
                        modoGestion: m.modoGestion,
                        adminPro: m.adminPro,
                        comisionAdminPct: String(m.comisionDefaultPct),
                        edificioPermiteAirbnb: "si",
                      });
                    } else {
                      setState({ tipoEdificio: opt.value });
                    }
                  }}
                  className={`text-left px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >
                  <div className={`font-body text-[13px] ${active ? "font-semibold" : "text-[var(--franco-text)]"}`}>{opt.label}</div>
                  <div className={`font-mono text-[10px] ${active ? "text-[var(--franco-bg)]/70" : "text-[var(--franco-text-muted)]"}`}>{opt.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Eje 2: Quién opera (fusión modoGestion + adminPro) ── */}
        <div>
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">¿Quién va a operar el Airbnb?</span>
            <InfoTooltip content="Auto-gestión: tú te encargas de todo (limpieza, check-in, mensajes). Solo pagas la comisión 3% de Airbnb. Operador profesional: una empresa (tipo Andes STR, HOM) maneja todo. Cobra ~20% del ingreso pero suele lograr más ocupación." />
          </span>
          <div className="flex flex-col gap-1.5">
            {([
              { value: "tu_mismo", label: "Auto-gestión", subtitle: "Tú operas · comisión Airbnb 3%" },
              { value: "pro_formal", label: "Operador profesional", subtitle: "Andes STR, HOM · comisión ~20%" },
            ] as const).map((opt) => {
              const active = state.gestionOption === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const m = gestionOptionToMotor(opt.value);
                    setState({
                      gestionOption: opt.value,
                      modoGestion: m.modoGestion,
                      adminPro: m.adminPro,
                      comisionAdminPct: String(m.comisionDefaultPct),
                    });
                  }}
                  className={`text-left px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                      : "bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                  }`}
                >
                  <div className={`font-body text-[13px] ${active ? "font-semibold" : "text-[var(--franco-text)]"}`}>{opt.label}</div>
                  <div className={`font-mono text-[10px] ${active ? "text-[var(--franco-bg)]/70" : "text-[var(--franco-text-muted)]"}`}>{opt.subtitle}</div>
                </button>
              );
            })}
          </div>
          {/* Comisión slider — solo si pro_formal */}
          {state.gestionOption === "pro_formal" && (
            <div className="mt-3">
              <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
                Comisión exacta: {state.comisionAdminPct}%
              </label>
              <input
                type="range" min="10" max="30" step="1"
                value={state.comisionAdminPct}
                onChange={(e) => setState({ comisionAdminPct: e.target.value })}
                className="w-full h-2 bg-[var(--franco-border-hover)] rounded-full accent-[var(--franco-text)] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[var(--franco-text-muted)] m-0">
                Ajusta si tu acuerdo difiere del default 20%.
              </p>
            </div>
          )}
        </div>

        {/* ── ¿Edificio permite Airbnb? ──
            Oculto si tipoEdificio=dedicado — un edificio 100% renta corta
            obviamente lo permite (auto-seteado a "si" en el handler de
            tipoEdificio). */}
        {state.tipoEdificio !== "dedicado" && (
          <div>
            <label className="font-body text-[13px] font-semibold text-[var(--franco-text)] block mb-1.5">
              ¿Tu edificio permite Airbnb?
            </label>
            <select
              className={`${inputBase} appearance-none pr-8`}
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
        )}

        {/* ── Operador (condicional a dedicado) ── */}
        {state.tipoEdificio === "dedicado" && (
          <div>
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Operador del edificio (opcional)</span>
              <InfoTooltip content="Si conoces la marca del operador del edificio (ej. Andes STR, HOM), nos ayuda a refinar estimaciones para futuros usuarios." />
            </span>
            <input
              type="text"
              value={state.operadorNombre}
              onChange={(e) => setState({ operadorNombre: e.target.value })}
              placeholder="Andes STR, HOM…"
              maxLength={200}
              className={inputBase}
            />
          </div>
        )}
      </div>
    </div>
  );
}
