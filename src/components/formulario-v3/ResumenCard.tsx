"use client";

import {
  calcDividendo,
  fmtCLP,
  type WizardV3State,
} from "./wizardV3State";

// Labels human-readable para footer "X ajustado(s) manualmente". Keys
// alineadas con state.editedFields. Si una key falta acá, se cae a la key
// cruda como fallback.
const FIELD_LABELS: Record<string, string> = {
  precio: "Precio",
  piePct: "Pie",
  plazoCredito: "Plazo",
  tasaInteres: "Tasa",
  arriendo: "Arriendo",
  vacanciaPct: "Vacancia",
  adminPct: "Administración",
  arriendoEstac: "Arriendo estac.",
  arriendoBodega: "Arriendo bodega",
  gastos: "Gastos comunes",
  contribuciones: "Contribuciones",
};

function formatEditedFooter(keys: string[]): string {
  const labels = keys.map((k) => FIELD_LABELS[k] ?? k);
  if (labels.length === 1) {
    return `${labels[0]} ajustado manualmente · Resto: valores estimados de mercado.`;
  }
  if (labels.length === 2) {
    return `${labels[0]} y ${labels[1]} ajustados manualmente · Resto: valores estimados.`;
  }
  if (labels.length === 3) {
    return `${labels[0]}, ${labels[1]} y ${labels[2]} ajustados manualmente · Resto: valores estimados.`;
  }
  // 4+
  const restCount = labels.length - 2;
  return `${labels[0]}, ${labels[1]} y ${restCount} más ajustados manualmente · Resto: valores estimados.`;
}

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

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        // Excepción Capa 1 documentada en globals.css (decisión producto 2026-05).
        border: hasAjustes
          ? "1px solid #C8323C"
          : "0.5px solid var(--franco-border)",
        background: "var(--franco-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] font-semibold m-0">
            Datos del análisis
          </h3>
          {hasAjustes && (
            // Excepción Capa 1 documentada en globals.css (decisión producto 2026-05).
            // Badge alineado con dot/border Signal Red por consistencia visual.
            <span
              className="font-mono text-[9px] uppercase tracking-[0.06em] font-semibold rounded"
              style={{
                background: "#C8323C",
                color: "#FFFFFF",
                padding: "4px 8px",
              }}
            >
              AJUSTADO
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
          edited={isEdited("plazoCredito") || isEdited("tasaInteres")}
        />
        <Cell label="Dividendo" value={dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"} />
        <div>
          <Cell
            label="Arriendo est."
            value={arriendo > 0 ? `${fmtCLP(arriendo)}/mes` : "—"}
            edited={isEdited("arriendo")}
          />
          {sampleSize > 0 && (
            <p
              className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]"
            >
              ● Basado en {sampleSize} deptos similares
            </p>
          )}
        </div>
        <Cell
          label="Vacancia · Admin"
          value={`${state.vacanciaPct}% · ${state.adminPct}%`}
          edited={isEdited("vacanciaPct") || isEdited("adminPct")}
        />
        <Cell
          label="Gastos comunes"
          value={gastos > 0 ? `${fmtCLP(gastos)}/mes` : "—"}
          edited={isEdited("gastos")}
        />
        <Cell
          label="Contribuciones"
          value={contribuciones > 0 ? `${fmtCLP(contribuciones)}/trim` : "—"}
          edited={isEdited("contribuciones")}
        />
      </div>

      {/* Footer nota: solo cuando hay ajustes manuales. Enumera las claves
          editadas con labels legibles (Fase 14a — antes solo conteo). */}
      {hasAjustes && (
        <p className="font-body text-[11px] text-[var(--franco-text-muted)] m-0 border-t border-[var(--franco-border)] pt-3">
          {formatEditedFooter(state.editedFields)}
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, edited = false }: { label: string; value: string; edited?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-0.5">
        {label}
      </p>
      <p className="font-mono text-[14px] font-semibold m-0 leading-tight text-[var(--franco-text)]">
        {value}
        {edited && (
          // Excepción Capa 1 documentada en globals.css (decisión producto 2026-05).
          <span
            className="ml-1.5 font-mono text-[10px] text-[#C8323C]"
            aria-label="Ajustado manualmente"
          >
            ●
          </span>
        )}
      </p>
    </div>
  );
}
