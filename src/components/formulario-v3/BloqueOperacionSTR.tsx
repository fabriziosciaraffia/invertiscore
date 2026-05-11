"use client";

// Bloque B del paso 3 — Operación STR con preview live + overrides manuales.
// Iteración 2026-05-10. Reemplaza el contenido inline + modal "Operación Airbnb".
//
// Inputs visibles:
//   - tipoEdificio (binario: residencial_puro | dedicado)
//   - gestionOption (binario: tu_mismo | pro_formal) → fusión modoGestion+adminPro
//   - comisionAdminPct (slider, solo si pro_formal)
//   - edificioPermiteAirbnb (select)
//   - operadorNombre (text, solo si tipoEdificio=dedicado)
//
// Preview live:
//   - ADR baseline mock (en futuro vendrá del prefetch AirROI; hoy hardcoded
//     o derivado del airRoi suggestion del Paso3).
//   - Factores ADR aplicados (edificio × habilitación).
//   - Ocupación target según banda.
//   - Revenue mensual estimado.
//
// Overrides manuales:
//   - ADR editable: click "Editar manualmente" → input + badge override + "Usar sugerido"
//   - Occ editable: idem

import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
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

function calcFactorEdif(tipoEdificio: WizardV3State["tipoEdificio"]): number {
  return tipoEdificio === "dedicado" ? 1.10 : 1.00;
}

function calcFactorHab(hab: WizardV3State["habilitacion"]): number {
  return { basico: 1.0, estandar: 1.05, premium: 1.10 }[hab];
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
  const factorEdif = calcFactorEdif(state.tipoEdificio);
  const factorHab = calcFactorHab(state.habilitacion);
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

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 space-y-5 mt-3">
      <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
        Operación Airbnb
      </div>

      {/* ── Eje 1: Tipo de edificio (binario) ── */}
      <div>
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">¿Cómo es el edificio?</span>
          <InfoTooltip content="Residencial = la mayoría de los vecinos vive ahí. Dedicado = aparthotel tipo Andes STR, Mayflower (100% renta corta)." />
        </span>
        <div className="flex flex-col gap-1.5">
          {([
            { value: "residencial_puro", label: "Residencial", subtitle: "La mayoría vive ahí · ADR ×1.00" },
            { value: "dedicado", label: "Dedicado 100% renta corta", subtitle: "Tipo Andes STR, Mayflower · ADR ×1.10" },
          ] as const).map((opt) => {
            const active = state.tipoEdificio === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setState({ tipoEdificio: opt.value })}
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
          <InfoTooltip content="Auto-gestión: tú operas (comisión Airbnb 3%). Operador profesional: empresa formal tipo Andes STR (comisión ~20% pero suele lograr ocupación significativamente mayor)." />
        </span>
        <div className="flex flex-col gap-1.5">
          {([
            { value: "tu_mismo", label: "Auto-gestión", subtitle: "Tú operas · comisión Airbnb 3%" },
            { value: "pro_formal", label: "Operador profesional", subtitle: "Andes STR, Mayflower · comisión ~20%" },
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

      {/* ── ¿Edificio permite Airbnb? ── */}
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

      {/* ── Operador (condicional a dedicado) ── */}
      {state.tipoEdificio === "dedicado" && (
        <div>
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="font-body text-[13px] font-semibold text-[var(--franco-text)]">Operador del edificio (opcional)</span>
            <InfoTooltip content="Si lo conoces (ej. Andes STR, Mayflower), nos ayuda a refinar estimaciones para futuros usuarios." />
          </span>
          <input
            type="text"
            value={state.operadorNombre}
            onChange={(e) => setState({ operadorNombre: e.target.value })}
            placeholder="Andes STR, Mayflower, Wynwood…"
            maxLength={200}
            className={inputBase}
          />
        </div>
      )}

      {/* ── Preview operacional live + overrides ── */}
      <div
        className="rounded-lg p-4 mt-2"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text-secondary)] m-0 mb-2">
          Preview operacional · live
        </p>

        {adrBaselineSugerido == null ? (
          <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0">
            Esperando estimación de AirROI para calcular el preview…
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[11px] text-[var(--franco-text-muted)]">
              <span>ADR baseline (AirROI)</span>
              <span>{fmtCLP(adrBaselineSugerido)}</span>
            </div>
            <div className="flex justify-between font-mono text-[11px] text-[var(--franco-text-muted)]">
              <span>× factor edificio</span>
              <span>×{factorEdif.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-mono text-[11px] text-[var(--franco-text-muted)]">
              <span>× factor habilitación</span>
              <span>×{factorHab.toFixed(2)}</span>
            </div>

            {/* ADR ajustado — editable */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--franco-border)]">
              <span className="font-mono text-[12px] font-semibold text-[var(--franco-text)]">ADR ajustado</span>
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
                    type="number"
                    min="1000"
                    step="500"
                    value={state.adrOverride ?? 0}
                    onChange={(e) => setState({ adrOverride: Number(e.target.value) || null })}
                    className="w-28 h-8 px-2 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-right"
                  />
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.06em] font-semibold" style={{ background: "#FBBF24", color: "#0F0F0F" }}>
                    override
                  </span>
                  <button
                    type="button"
                    onClick={resetAdrOverride}
                    className="font-mono text-[10px] text-[var(--franco-text-muted)] underline decoration-dotted hover:text-[var(--franco-text)]"
                  >
                    Usar sugerido
                  </button>
                </span>
              )}
            </div>

            {/* Ocupación — editable */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--franco-border)]">
              <span className="font-mono text-[12px] font-semibold text-[var(--franco-text)]">Ocupación estabilizada (mes 7+)</span>
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
                    type="number"
                    min="1"
                    max="95"
                    step="1"
                    value={Math.round((state.occOverride ?? 0) * 100)}
                    onChange={(e) => {
                      const pct = Math.max(1, Math.min(95, Number(e.target.value) || 0));
                      setState({ occOverride: pct / 100 });
                    }}
                    className="w-20 h-8 px-2 rounded border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-right"
                  />
                  <span className="font-mono text-[12px]">%</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.06em] font-semibold" style={{ background: "#FBBF24", color: "#0F0F0F" }}>
                    override
                  </span>
                  <button
                    type="button"
                    onClick={resetOccOverride}
                    className="font-mono text-[10px] text-[var(--franco-text-muted)] underline decoration-dotted hover:text-[var(--franco-text)]"
                  >
                    Usar sugerido
                  </button>
                </span>
              )}
            </div>

            {/* Revenue mensual */}
            <div className="flex justify-between pt-2 border-t border-[var(--franco-text)] mt-2">
              <span className="font-mono text-[12px] font-bold text-[var(--franco-text)]">Revenue mensual estimado</span>
              <span className="font-mono text-[14px] font-bold text-[var(--franco-text)]">
                {revenueMensual != null ? fmtCLP(revenueMensual) : "—"}
              </span>
            </div>

            <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-2 italic">
              {(adrEsOverride || occEsOverride)
                ? "Override manual activo — el motor usa tus valores en lugar de los derivados de los ejes."
                : "Banda operacional: " + banda.replace(/_/g, " ") + "."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
