"use client";

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/tooltip";
import type { AirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";
import {
  calcDividendo,
  fmtCLP,
  fmtCLPShort,
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
  adminPct: "Gestión del arriendo",
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
  airRoi,
  onAjustar,
}: {
  state: WizardV3State;
  ufCLP: number;
  sampleSize: number;
  /** Estimación AirROI — solo se renderiza cuando modalidad ∈ {str, both}. */
  airRoi?: AirRoiSuggestion;
  onAjustar: () => void;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = Number(state.tasaInteres) || 4.72;
  const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, ufCLP);

  const arriendo = Number(state.arriendo) || 0;
  const arriendoEstac = Number(state.arriendoEstac) || 0;
  const arriendoBodega = Number(state.arriendoBodega) || 0;
  const arriendoTotal = arriendo + arriendoEstac + arriendoBodega;
  const hasArriendoExtras = arriendoEstac > 0 || arriendoBodega > 0;

  const gastos = Number(state.gastos) || 0;
  const contribuciones = Number(state.contribuciones) || 0;

  const hasAjustes = state.editedFields.length > 0;
  const isEdited = (field: string) => state.editedFields.includes(field);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        border: hasAjustes
          ? "1px solid var(--franco-text-secondary)"
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

      {/* Grid de valores: 4 cols desktop, 2 cols mobile. 8 celdas, 2 filas.
          Fila 1: Plazo, Tasa, Dividendo, Arriendo estimado (+leyenda).
          Fila 2: Vacancia, Gestión del arriendo, Gastos comunes, Contribuciones. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        <Cell
          label="Plazo"
          value={`${plazo} años`}
          tooltip="Plazo del crédito hipotecario en años. Editable en Ajustar."
          edited={isEdited("plazoCredito")}
        />
        <Cell
          label="Tasa"
          value={`${tasa}%`}
          tooltip="Tasa anual del crédito hipotecario. Hoy en Chile fluctúa entre 4% y 5,5% UF. Si calificas al Subsidio a la Tasa (Ley 21.748), puede bajar ~0,6 puntos. Editable en Ajustar."
          edited={isEdited("tasaInteres")}
        />
        <Cell
          label="Dividendo"
          value={dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"}
          tooltip="Cuota mensual del crédito hipotecario. Calculada con precio, pie, plazo y tasa. Editable en Ajustar."
        />
        <ArriendoCell
          modalidad={state.modalidad}
          arriendo={arriendo}
          arriendoEstac={arriendoEstac}
          arriendoBodega={arriendoBodega}
          arriendoTotal={arriendoTotal}
          hasArriendoExtras={hasArriendoExtras}
          sampleSize={sampleSize}
          airRoi={airRoi}
          isEdited={isEdited}
        />
        <Cell
          label="Vacancia"
          value={`${state.vacanciaPct}%`}
          tooltip="Porcentaje del año estimado sin arrendatario (búsqueda y transición). Default 5% ≈ 18 días/año. Se descuenta mes a mes del arriendo proyectado para reflejar flujo realista. Editable en Ajustar."
          edited={isEdited("vacanciaPct")}
        />
        <Cell
          label="Gestión arriendo"
          value={`${state.adminPct}%`}
          tooltip="Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario). Se descuenta mes a mes del arriendo bruto. Default 0% asume autogestión. Típico mercado: 7-10% si delega. Editable en Ajustar."
          edited={isEdited("adminPct")}
        />
        <Cell
          label="Gastos comunes"
          value={gastos > 0 ? `${fmtCLP(gastos)}/mes` : "—"}
          tooltip="Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia). Editable en Ajustar."
          edited={isEdited("gastos")}
        />
        <Cell
          label="Contribuciones"
          value={contribuciones > 0 ? `${fmtCLP(contribuciones)}/trim` : "—"}
          tooltip="Impuesto territorial trimestral del SII. Lo paga el propietario del inmueble. Franco lo calcula automáticamente. Editable en Ajustar."
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

function Cell({
  label,
  value,
  edited = false,
  tooltip,
}: {
  label: ReactNode;
  value: string;
  edited?: boolean;
  tooltip?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-0.5">
        <span>{label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
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

// ─── Cell adaptativo de arriendo según modalidad (Ronda 2b) ──
// LTR → "Arriendo estimado" (o "Arriendo total" cuando hay extras estac/bodega)
// STR → "Ingreso bruto estimado" con valor AirROI
// AMBAS → 2 valores apilados verticalmente: Arriendo largo + Ingreso Airbnb
function ArriendoCell({
  modalidad,
  arriendo,
  arriendoEstac,
  arriendoBodega,
  arriendoTotal,
  hasArriendoExtras,
  sampleSize,
  airRoi,
  isEdited,
}: {
  modalidad: WizardV3State["modalidad"];
  arriendo: number;
  arriendoEstac: number;
  arriendoBodega: number;
  arriendoTotal: number;
  hasArriendoExtras: boolean;
  sampleSize: number;
  airRoi?: AirRoiSuggestion;
  isEdited: (field: string) => boolean;
}) {
  const airRoiLoading = airRoi?.isLoading === true;
  const airRoiValue = airRoi?.ingresoBrutoMensual ?? 0;
  const airRoiSampleSize = airRoi?.sampleSize ?? 0;
  const airRoiSource = airRoi?.source;
  const airRoiError = airRoi?.error;

  // ── Modalidad STR: reemplazar "Arriendo estimado" por "Ingreso bruto" ──
  if (modalidad === "str") {
    return (
      <div>
        <Cell
          label="Ingreso bruto estimado"
          value={
            airRoiLoading
              ? "—"
              : airRoiValue > 0
                ? `${fmtCLP(airRoiValue)}/mes`
                : "—"
          }
          tooltip="Estimación del ingreso bruto mensual de Airbnb basada en datos AirROI (ADR × ocupación esperada × días). No incluye comisión plataforma ni costos operativos. Editable en Ajustar."
        />
        {airRoiLoading && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-muted)] animate-pulse">
            Estimando con AirROI…
          </p>
        )}
        {!airRoiLoading && airRoiError && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
            ● No pudimos estimar tu ingreso. Continúa y lo verás en el análisis.
          </p>
        )}
        {!airRoiLoading && !airRoiError && airRoiValue > 0 && airRoiSource === "comparables" && airRoiSampleSize > 0 && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
            ● Basado en {airRoiSampleSize} listings Airbnb similares
          </p>
        )}
        {!airRoiLoading && !airRoiError && airRoiValue > 0 && airRoiSource === "calculator_direct" && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
            ● Estimación directa AirROI (sin comparables en zona)
          </p>
        )}
      </div>
    );
  }

  // ── Modalidad AMBAS: dos valores apilados (Arriendo largo + Ingreso Airbnb) ──
  if (modalidad === "both") {
    const arriendoEditedAmbas =
      isEdited("arriendo") || isEdited("arriendoEstac") || isEdited("arriendoBodega");
    return (
      <div>
        <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-0.5">
          <span>Arriendo largo</span>
          <InfoTooltip content="Arriendo mensual estimado para renta tradicional (LTR). Editable en Ajustar." />
        </p>
        <p className="font-mono text-[14px] font-semibold m-0 leading-tight text-[var(--franco-text)]">
          {hasArriendoExtras
            ? arriendoTotal > 0 ? `${fmtCLP(arriendoTotal)}/mes` : "—"
            : arriendo > 0 ? `${fmtCLP(arriendo)}/mes` : "—"}
          {arriendoEditedAmbas && (
            <span
              className="ml-1.5 font-mono text-[10px] text-[#C8323C]"
              aria-label="Ajustado manualmente"
            >
              ●
            </span>
          )}
        </p>
        <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mt-2 mb-0.5">
          <span>Ingreso Airbnb</span>
          <InfoTooltip content="Ingreso bruto mensual estimado por AirROI (ADR × ocupación)." />
        </p>
        <p className="font-mono text-[14px] font-semibold m-0 leading-tight text-[var(--franco-text)]">
          {airRoiLoading
            ? "—"
            : airRoiValue > 0 ? `${fmtCLP(airRoiValue)}/mes` : "—"}
        </p>
        {airRoiLoading && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-muted)] animate-pulse">
            Estimando AirROI…
          </p>
        )}
        {!airRoiLoading && airRoiError && (
          <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
            ● Airbnb no estimable, lo verás en el análisis.
          </p>
        )}
      </div>
    );
  }

  // ── Modalidad LTR (default) — comportamiento pre-Ronda 2b ──
  return (
    <div>
      <Cell
        label={hasArriendoExtras ? "Arriendo total" : "Arriendo estimado"}
        value={
          hasArriendoExtras
            ? arriendoTotal > 0 ? `${fmtCLP(arriendoTotal)}/mes` : "—"
            : arriendo > 0 ? `${fmtCLP(arriendo)}/mes` : "—"
        }
        tooltip={
          hasArriendoExtras
            ? "Suma del arriendo del depto, estacionamiento y bodega. La sugerencia base se calcula con la mediana de arriendos publicados de propiedades similares (mismos dormitorios, ±30% superficie) en la zona. Editable en Ajustar."
            : "Sugerencia calculada con la mediana de arriendos publicados de propiedades similares (mismos dormitorios, ±30% superficie) en la zona. Edítalo si tienes referencia distinta. Editable en Ajustar."
        }
        edited={isEdited("arriendo") || isEdited("arriendoEstac") || isEdited("arriendoBodega")}
      />
      {hasArriendoExtras && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
          ● Incluye
          {arriendoEstac > 0 ? ` ${fmtCLPShort(arriendoEstac)} estac` : ""}
          {arriendoEstac > 0 && arriendoBodega > 0 ? " ·" : ""}
          {arriendoBodega > 0 ? ` ${fmtCLPShort(arriendoBodega)} bodega` : ""}
        </p>
      )}
      {sampleSize > 0 && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
          ● Basado en {sampleSize} deptos similares
        </p>
      )}
    </div>
  );
}
