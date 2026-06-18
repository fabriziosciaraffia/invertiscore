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
import { MoneyInput } from "@/components/ui/MoneyInput";
import { CampoEstado } from "./FieldEstado";
import {
  fmtCLP,
  gestionOptionToMotor,
  omit,
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
  const { banda, occ: occDerivada } = calcBandaOcc(state.tipoEdificio, motor.adminPro);

  // ADR sugerido = baseline de mercado tal cual. No se aplica factor por edificio/
  // habilitación: el uplift de ADR no tenía respaldo (ver STR_ADR_FACTOR, =1.00).
  const adrDerivado = adrBaselineSugerido != null
    ? Math.round(adrBaselineSugerido)
    : null;

  const adrEsOverride = state.adrOverride !== null;
  const occEsOverride = state.occOverride !== null;
  const adrFinal = adrEsOverride ? (state.adrOverride as number) : adrDerivado;
  const occFinal = occEsOverride ? (state.occOverride as number) : occDerivada;

  const revenueMensual = adrFinal != null
    ? Math.round((adrFinal * occFinal * 365) / 12)
    : null;

  // ─── Hint reactivo (sub-2 C2, familia override). Baseline keyado "adr"/"occ"
  // en suggestionBaselines = derivada al momento de setear el override. El hint
  // aparece si la derivada se movió DESPUÉS (un param del depto la cambió) y
  // restaurar cambiaría el valor. Mismo patrón que C1 (CampoEstado.hint). ──
  const baseAdr = state.suggestionBaselines.adr;
  const baseOcc = state.suggestionBaselines.occ;
  const showHintAdr = adrEsOverride && adrDerivado != null && baseAdr != null
    && Math.round(adrDerivado) !== Math.round(baseAdr)
    && (adrFinal == null || Math.round(adrDerivado) !== Math.round(adrFinal));
  const showHintOcc = occEsOverride && baseOcc != null
    && Math.round(occDerivada * 100) !== Math.round(baseOcc * 100)
    && Math.round(occFinal * 100) !== Math.round(occDerivada * 100);

  // ─── Restaurar al valor estimado (override → null) + limpiar baseline ───
  function resetAdrOverride() {
    setState({ adrOverride: null, suggestionBaselines: omit(state.suggestionBaselines, "adr") });
  }
  function resetOccOverride() {
    setState({ occOverride: null, suggestionBaselines: omit(state.suggestionBaselines, "occ") });
  }

  // Tarifa: edición directa de la caja → setea override + baseline["adr"] =
  // derivada actual. Vacío / igual a la tarifa sugerida → "estimado" (null) +
  // limpia baseline. El display usa el override si existe, si no la derivada.
  function onTarifaChange(raw: string) {
    const n = Number(raw);
    const esOverride = Number.isFinite(n) && n > 0 && (adrDerivado == null || Math.round(n) !== adrDerivado);
    setState({
      adrOverride: esOverride ? Math.round(n) : null,
      suggestionBaselines: esOverride && adrDerivado != null
        ? { ...state.suggestionBaselines, adr: adrDerivado }
        : omit(state.suggestionBaselines, "adr"),
    });
  }

  // ─── Buffer local de ocupación (input %) ───
  // El input muestra la banda derivada cuando no hay override, o el override.
  // La validación (parse, comparar con la banda) ocurre en blur.
  const [occBuffer, setOccBuffer] = useState<string>(
    state.occOverride !== null
      ? String(Math.round(state.occOverride * 100))
      : String(Math.round(occDerivada * 100)),
  );
  useEffect(() => {
    setOccBuffer(
      state.occOverride !== null
        ? String(Math.round(state.occOverride * 100))
        : String(Math.round(occDerivada * 100)),
    );
  }, [state.occOverride, occDerivada]);

  // Setea override + baseline["occ"] = banda derivada; si coincide con la banda
  // o es inválido → "estimado" (null) + limpia baseline.
  function commitOccBuffer() {
    const trimmed = occBuffer.trim();
    const pct = Number(trimmed);
    const esOverride = trimmed !== "" && Number.isFinite(pct) && pct > 0 && pct <= 95
      && Math.round(occDerivada * 100) !== Math.round(pct);
    setState({
      occOverride: esOverride ? pct / 100 : null,
      suggestionBaselines: esOverride
        ? { ...state.suggestionBaselines, occ: occDerivada }
        : omit(state.suggestionBaselines, "occ"),
    });
  }

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-5 mt-3">
      <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
        Ingresos estimados Airbnb
      </div>

      {/* ── Resultado: ingreso mensual estimado (derivado, no editable) ──
          Línea de resumen modesta (un escalón sobre el valor de campo), sin
          caja ni border-left: se integra al lenguaje de la card. */}
      <div>
        <div className="flex items-baseline justify-between gap-x-3 gap-y-1 flex-wrap">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text-secondary)]">
            Ingreso mensual estimado
            <InfoTooltip content="Lo que entra a tu bolsillo cada mes en promedio, antes de descontar gastos, comisiones y crédito hipotecario. Calculado como tarifa × ocupación × 30 días." />
          </span>
          {adrBaselineSugerido == null ? (
            <span className="flex items-center gap-1.5 font-body text-[12px] text-[var(--franco-text-muted)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--franco-text)] animate-pulse" aria-hidden />
              Esperando estimación de mercado…
            </span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[18px] font-semibold text-[var(--franco-text)] leading-none">
                {revenueMensual != null ? fmtCLP(revenueMensual) : "—"}
              </span>
              <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">/mes · bruto</span>
            </span>
          )}
        </div>

        {/* Tarifa diaria + Ocupación — variables editables que producen el
            resultado. Cajas como el resto de los campos, con marcador de estado. */}
        <div className="mt-3 pt-4 border-t border-dashed border-[var(--franco-border)]">
          <div className="grid grid-cols-2 gap-3">
            {/* Tu tarifa diaria */}
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">Tu tarifa diaria</span>
                <InfoTooltip content="Lo que vas a cobrar por noche, anclado a la tarifa de mercado de la zona. Es la base del cálculo de ingresos." />
              </span>
              <MoneyInput
                className={inputBase}
                value={adrEsOverride ? String(state.adrOverride) : (adrDerivado != null ? String(adrDerivado) : "")}
                onChange={onTarifaChange}
              />
              <CampoEstado
                edited={adrEsOverride}
                onRestore={resetAdrOverride}
                hint={showHintAdr && adrDerivado != null
                  ? { value: `${fmtCLP(adrDerivado)}/noche`, onUse: resetAdrOverride }
                  : undefined}
              >
                {adrBaselineSugerido != null && <>mercado sugiere {fmtCLP(adrBaselineSugerido)}/noche</>}
              </CampoEstado>
            </label>

            {/* Ocupación estabilizada */}
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">Ocupación (mes 7+)</span>
                <InfoTooltip content="Porcentaje del año que el depto está reservado. 'Estabilizada' = cuando ya llevas más de 6 meses operando, tienes reseñas y el listing maduró." />
              </span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={occBuffer}
                  onChange={(e) => setOccBuffer(e.target.value)}
                  onBlur={commitOccBuffer}
                  className={`${inputBase} pr-8 text-right`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">%</span>
              </div>
              <CampoEstado
                edited={occEsOverride}
                onRestore={resetOccOverride}
                hint={showHintOcc
                  ? { value: `${(occDerivada * 100).toFixed(0)}%`, onUse: resetOccOverride }
                  : undefined}
              >
                banda {(occDerivada * 100).toFixed(0)}% (mes 7+)
              </CampoEstado>
            </label>
          </div>

          <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-2 italic">
            Banda operacional: {banda.replace(/_/g, " ")}.
          </p>
        </div>
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
