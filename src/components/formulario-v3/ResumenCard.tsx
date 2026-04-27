"use client";

import {
  calcDividendo,
  fmtCLP,
  type WizardV3State,
} from "./wizardV3State";

export function ResumenCard({
  state,
  ufCLP,
  sampleSize,
  onAjustar,
}: {
  state: WizardV3State;
  ufCLP: number;
  sampleSize: number;
  onAjustar: () => void;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = Number(state.tasaInteres) || 4.72;
  const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, ufCLP);

  const arriendo = Number(state.arriendo) || 0;
  const gastos = Number(state.gastos) || 0;
  const contribuciones = Number(state.contribuciones) || 0;

  const hasAjustes = state.editedFields.length > 0;
  const isEdited = (field: string) => state.editedFields.includes(field);

  const valueColor = (field: string) =>
    isEdited(field) ? "var(--franco-v-adjust)" : "var(--franco-text)";

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{
        borderColor: hasAjustes
          ? "color-mix(in srgb, var(--franco-v-adjust) 35%, transparent)"
          : "var(--franco-border)",
        background: "var(--franco-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] font-semibold m-0">
            Datos del análisis
          </h3>
          {hasAjustes && (
            <span
              className="font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: "color-mix(in srgb, var(--franco-v-adjust) 12%, transparent)",
                color: "var(--franco-v-adjust)",
              }}
            >
              ajustado
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAjustar}
          className="font-body text-[12px] font-medium text-signal-red hover:underline shrink-0"
        >
          Ajustar
        </button>
      </div>

      {/* Grid de valores: 3 cols desktop, 2 cols mobile. 6 celdas, 2 filas balanceadas.
          Orden por fila — fila 1: Plazo·Tasa, Dividendo, Arriendo (+leyenda).
          Fila 2: Vacancia·Admin, Gastos comunes, Contribuciones. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <Cell
          label="Plazo · Tasa"
          value={`${plazo}a · ${tasa}%`}
          color={isEdited("plazoCredito") || isEdited("tasaInteres") ? "var(--franco-v-adjust)" : "var(--franco-text)"}
        />
        <Cell label="Dividendo" value={dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"} />
        <div>
          <Cell
            label="Arriendo est."
            value={arriendo > 0 ? `${fmtCLP(arriendo)}/mes` : "—"}
            color={valueColor("arriendo")}
          />
          {sampleSize > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "var(--ink-400)" }}
                aria-hidden="true"
              />
              <span
                className="font-body text-[9px] truncate"
                style={{ color: "color-mix(in srgb, var(--ink-400) 80%, transparent)" }}
              >
                Basado en {sampleSize} deptos similares
              </span>
            </div>
          )}
        </div>
        <Cell
          label="Vacancia · Admin"
          value={`${state.vacanciaPct}% · ${state.adminPct}%`}
          color={isEdited("vacanciaPct") || isEdited("adminPct") ? "var(--franco-v-adjust)" : "var(--franco-text)"}
        />
        <Cell
          label="Gastos comunes"
          value={gastos > 0 ? `${fmtCLP(gastos)}/mes` : "—"}
          color={valueColor("gastos")}
        />
        <Cell
          label="Contribuciones"
          value={contribuciones > 0 ? `${fmtCLP(contribuciones)}/trim` : "—"}
          color={valueColor("contribuciones")}
        />
      </div>

      {/* Footer nota: solo cuando hay ajustes manuales */}
      {hasAjustes && (
        <p className="font-body text-[11px] text-[var(--franco-text-muted)] m-0 border-t border-[var(--franco-border)] pt-3">
          {state.editedFields.length} ajustado{state.editedFields.length === 1 ? "" : "s"} manualmente · Resto son valores estimados de mercado.
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, color = "var(--franco-text)" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)] m-0 mb-0.5">
        {label}
      </p>
      <p
        className="font-mono text-[14px] font-semibold m-0 leading-tight"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
