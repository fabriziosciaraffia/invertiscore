"use client";

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/tooltip";
import type { AirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";
import {
  calcDividendo,
  fmtCLP,
  fmtCLPShort,
  fmtUF,
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
  // STR/AMBAS — Ronda 2c
  modoGestion: "Modo gestión",
  comisionAdminPct: "Comisión administrador",
  costoElectricidad: "Electricidad",
  costoAgua: "Agua",
  costoWifi: "WiFi",
  costoInsumos: "Insumos",
  mantencionMensual: "Mantención",
  estaAmoblado: "Amoblado",
  costoAmoblamiento: "Costo de amoblar",
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
  const pieUF = precioUF * piePct / 100;

  const arriendo = Number(state.arriendo) || 0;
  const arriendoEstac = Number(state.arriendoEstac) || 0;
  const arriendoBodega = Number(state.arriendoBodega) || 0;
  const arriendoTotal = arriendo + arriendoEstac + arriendoBodega;
  const hasArriendoExtras = arriendoEstac > 0 || arriendoBodega > 0;

  const gastos = Number(state.gastos) || 0;
  const contribuciones = Number(state.contribuciones) || 0;

  const hasAjustes = state.editedFields.length > 0;
  const isEdited = (field: string) => state.editedFields.includes(field);

  // ── Modalidad helpers ──
  const mod = state.modalidad;
  const isLTR = !mod || mod === "ltr";
  const isSTR = mod === "str";
  const isAMBAS = mod === "both";
  const showOpAirbnb = isSTR || isAMBAS;
  const showArriendoLargo = isLTR || isAMBAS;

  // ── Display values ──
  const precioDisplay = precioUF > 0 ? fmtUF(precioUF) : "—";
  const pieDisplay = precioUF > 0
    ? `${piePct}% · ${fmtUF(pieUF)}`
    : `${piePct}%`;
  const plazoTasaDisplay = `${plazo}a · ${tasa}%`;
  const dividendoDisplay = dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—";

  const modoGestionLabel = state.modoGestion === "auto" ? "Auto-gestión" : "Administrador";
  const comisionDisplay = state.modoGestion === "auto"
    ? "3%"
    : `${state.comisionAdminPct}%`;
  const comisionTooltip = state.modoGestion === "auto"
    ? "Comisión que cobra Airbnb por reserva en auto-gestión."
    : "Comisión del operador profesional. Default 20%, ajustable en 'Ajustar condiciones'.";
  const ocupacionDisplay = airRoi && airRoi.ocupacionReferencia > 0
    ? `${Math.round(airRoi.ocupacionReferencia * 100)}%`
    : "—";

  // Tooltips contextuales por modalidad
  const gastosTooltip = isAMBAS
    ? "Gasto mensual del edificio. En LTR lo asume el arrendatario; en Airbnb se prorratea al costo por noche."
    : showOpAirbnb
      ? "Gasto mensual del edificio. En Airbnb se prorratea al costo por noche."
      : "Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia). Editable en Ajustar.";
  const contribTooltip = showOpAirbnb
    ? "Impuesto territorial trimestral. Aplica igual independiente del tipo de renta."
    : "Impuesto territorial trimestral del SII. Lo paga el propietario del inmueble. Franco lo calcula automáticamente. Editable en Ajustar.";

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
          <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] font-semibold m-0">
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

      {/* ─── Subsecciones jerárquicas (Ronda 2c.1) ───
          LTR: 01 General · 02 Arriendo largo · 03 Gastos fijos
          STR: 01 General · 02 Operación Airbnb · 03 Gastos fijos
          AMBAS: 01 General · 02 Arriendo largo · 03 Operación Airbnb · 04 Gastos fijos
          Grid SIEMPRE 4 cols con celdas vacías cuando faltan campos. */}

      {/* 01 · General — común a las 3 modalidades */}
      <SubSection number="01" title="General">
        <Cell
          label="Precio"
          value={precioDisplay}
          tooltip="Precio de compra del departamento. Editable en pasos previos."
          edited={isEdited("precio")}
        />
        <Cell
          label="Pie"
          value={pieDisplay}
          tooltip="Porcentaje del precio que pagas con recursos propios, sin crédito hipotecario."
          edited={isEdited("piePct")}
        />
        <Cell
          label="Plazo · Tasa"
          value={plazoTasaDisplay}
          tooltip="Plazo del crédito en años · Tasa anual del crédito hipotecario. Editable en Ajustar."
          edited={isEdited("plazoCredito") || isEdited("tasaInteres")}
        />
        <Cell
          label="Dividendo"
          value={dividendoDisplay}
          tooltip="Cuota mensual del crédito hipotecario. Calculada con precio, pie, plazo y tasa. Editable en Ajustar."
        />
      </SubSection>

      {/* 02 · Arriendo largo — solo LTR / AMBAS */}
      {showArriendoLargo && (
        <SubSection number={isAMBAS ? "02" : "02"} title="Arriendo largo">
          <ArriendoLargoCell
            arriendo={arriendo}
            arriendoEstac={arriendoEstac}
            arriendoBodega={arriendoBodega}
            arriendoTotal={arriendoTotal}
            hasArriendoExtras={hasArriendoExtras}
            sampleSize={sampleSize}
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
          <EmptyCell />
        </SubSection>
      )}

      {/* Operación Airbnb — solo STR / AMBAS. Numeración: 02 en STR, 03 en AMBAS. */}
      {showOpAirbnb && (
        <SubSection number={isAMBAS ? "03" : "02"} title="Operación Airbnb">
          <IngresoBrutoCell airRoi={airRoi} />
          <Cell
            label="Ocupación"
            value={airRoi?.isLoading ? "—" : ocupacionDisplay}
            tooltip="Porcentaje de noches ocupadas estimado por AirROI. Base del escenario neutro del análisis."
          />
          <Cell
            label="Modo gestión"
            value={modoGestionLabel}
            tooltip="Define quién opera el Airbnb. Auto-gestión: tú manejas reservas, check-in, limpieza y atención al huésped directamente. Administrador: operador profesional que gestiona el listing y se encarga de toda la operación día a día por una comisión sobre el ingreso bruto."
            edited={isEdited("modoGestion")}
          />
          <Cell
            label="Comisión"
            value={comisionDisplay}
            tooltip={comisionTooltip}
            edited={isEdited("comisionAdminPct")}
          />
        </SubSection>
      )}

      {/* Gastos fijos — siempre. Numeración: 03 en LTR/STR, 04 en AMBAS. */}
      <SubSection
        number={isAMBAS ? "04" : "03"}
        title="Gastos fijos"
      >
        <Cell
          label="Gastos comunes"
          value={gastos > 0 ? `${fmtCLP(gastos)}/mes` : "—"}
          tooltip={gastosTooltip}
          edited={isEdited("gastos")}
        />
        <Cell
          label="Contribuciones"
          value={contribuciones > 0 ? `${fmtCLP(contribuciones)}/trim` : "—"}
          tooltip={contribTooltip}
          edited={isEdited("contribuciones")}
        />
        <EmptyCell />
        <EmptyCell />
      </SubSection>

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

// ─── Subsección con border-left + título numerado (Ronda 2c.1) ──
// Patrón Capa 3 design-system-franco — variante Ink para bloques informativos
// jerárquicos. Border 2px + padding-left 14px. Grid SIEMPRE 4 cols.
function SubSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="pl-3.5"
      style={{ borderLeft: "2px solid var(--franco-text-secondary)" }}
    >
      <h4 className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] m-0 mb-3">
        {number} · {title}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  );
}

function EmptyCell() {
  return <div aria-hidden="true" />;
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

// ─── Cell de Arriendo largo (LTR + AMBAS Arriendo largo subsec) ──
// Reusa la lógica de Ronda 2b — total con extras estac/bodega + microcopies.
function ArriendoLargoCell({
  arriendo,
  arriendoEstac,
  arriendoBodega,
  arriendoTotal,
  hasArriendoExtras,
  sampleSize,
  isEdited,
}: {
  arriendo: number;
  arriendoEstac: number;
  arriendoBodega: number;
  arriendoTotal: number;
  hasArriendoExtras: boolean;
  sampleSize: number;
  isEdited: (field: string) => boolean;
}) {
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

// ─── Cell de Ingreso bruto (STR + AMBAS Operación Airbnb subsec) ──
function IngresoBrutoCell({ airRoi }: { airRoi?: AirRoiSuggestion }) {
  const isLoading = airRoi?.isLoading === true;
  const value = airRoi?.ingresoBrutoMensual ?? 0;
  const sampleSize = airRoi?.sampleSize ?? 0;
  const source = airRoi?.source;
  const error = airRoi?.error;
  return (
    <div>
      <Cell
        label="Ingreso bruto"
        value={isLoading ? "—" : value > 0 ? `${fmtCLP(value)}/mes` : "—"}
        tooltip="Estimación del ingreso bruto mensual de Airbnb basada en datos AirROI (ADR × ocupación esperada × días). No incluye comisión plataforma ni costos operativos. Editable en Ajustar."
      />
      {isLoading && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-muted)] animate-pulse">
          Estimando con AirROI…
        </p>
      )}
      {!isLoading && error && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
          ● No pudimos estimar tu ingreso. Lo verás en el análisis.
        </p>
      )}
      {!isLoading && !error && value > 0 && source === "comparables" && sampleSize > 0 && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
          ● Basado en {sampleSize} listings similares
        </p>
      )}
      {!isLoading && !error && value > 0 && source === "calculator_direct" && (
        <p className="font-mono text-[11px] mt-1 m-0 leading-snug text-[var(--franco-text-secondary)]">
          ● Estimación directa AirROI
        </p>
      )}
    </div>
  );
}
