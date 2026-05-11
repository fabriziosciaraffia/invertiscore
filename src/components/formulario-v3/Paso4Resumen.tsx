"use client";

// Paso 4 — Resumen consolidado navegable. Iteración 2026-05-10 (Commit 1).
// Reemplaza Paso4AjusteFino: los ajustes finos (plazo, tasa, vacancia,
// adminPct, comisión exacta, overrides ADR/Occ) son ahora data operacional
// que vive en pasos 2 y 3, no "tuneo" diferido. Este paso es solo lectura
// + navegación inline para editar cada sección.
//
// Anatomía siguiendo design system Franco:
//   - Sin color decorativo (solo Ink + Signal Red en CTA).
//   - Label uppercase mono + título Serif por sección.
//   - Filas con label Sans (izq) + valor Mono (der).
//   - Botón "Editar" mono uppercase por sección → setStep(N).
//   - CTAs footer: "← Volver" Sans gris + "Analizar ahora →" Signal Red sólido.

import { Loader2 } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";
import { canAnalyzeFromTier, type TierInfo } from "./Paso3Modalidad";
import {
  fmtCLP,
  fmtUF,
  gestionOptionToMotor,
  parseDecimalLocale,
  parseNum,
  type WizardV3State,
} from "./wizardV3State";

const LABEL_TIPO_EDIFICIO: Record<WizardV3State["tipoEdificio"], string> = {
  residencial_puro: "Residencial",
  dedicado: "Dedicado / aparthotel",
};
const LABEL_HABILITACION: Record<WizardV3State["habilitacion"], string> = {
  basico: "Básico",
  estandar: "Estándar",
  premium: "Premium",
};
const LABEL_MODALIDAD: Record<NonNullable<WizardV3State["modalidad"]>, string> = {
  ltr: "Renta larga",
  str: "Renta corta",
  both: "Ambas (LTR vs STR)",
};
const LABEL_EDIFICIO_PERMITE: Record<WizardV3State["edificioPermiteAirbnb"], string> = {
  si: "Sí permite",
  no: "No permite",
  no_seguro: "No estoy seguro",
};

// ─── Helpers ────────────────────────────────────────────

const STR_OCUPACION_TARGET = {
  edificio_dedicado_admin_pro: 0.74,
  edificio_dedicado_auto: 0.65,
  admin_pro_residencial: 0.65,
  auto_gestion_residencial: 0.55,
} as const;

function calcOccDerivada(
  tipoEdificio: WizardV3State["tipoEdificio"],
  adminPro: boolean,
): number {
  const dedicado = tipoEdificio === "dedicado";
  if (dedicado && adminPro) return STR_OCUPACION_TARGET.edificio_dedicado_admin_pro;
  if (dedicado && !adminPro) return STR_OCUPACION_TARGET.edificio_dedicado_auto;
  if (!dedicado && adminPro) return STR_OCUPACION_TARGET.admin_pro_residencial;
  return STR_OCUPACION_TARGET.auto_gestion_residencial;
}

function calcFactorADR(
  tipoEdificio: WizardV3State["tipoEdificio"],
  habilitacion: WizardV3State["habilitacion"],
): number {
  const fE = tipoEdificio === "dedicado" ? 1.10 : 1.00;
  const fH = { basico: 1.0, estandar: 1.05, premium: 1.10 }[habilitacion];
  return fE * fH;
}

// ─── Tipos ──────────────────────────────────────────────

interface SectionConfig {
  numero: string;
  title: string;
  editStep: 1 | 2 | 3;
  rows: { label: string; value: string }[];
}

// ─── Subcomponente: sección del resumen ─────────────────

function ResumenSection({
  numero,
  title,
  rows,
  onEditar,
}: SectionConfig & { onEditar: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
      {/* Header: label uppercase mono + título Serif + botón Editar */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.08em] mb-1">
            {numero}
          </div>
          <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] m-0 leading-tight">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onEditar}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-dotted px-2 py-1"
        >
          Editar →
        </button>
      </div>

      {/* Filas: label Sans (izq) + valor Mono (der) */}
      <dl className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-3 py-1 border-b border-dashed border-[var(--franco-border)] last:border-b-0"
          >
            <dt className="font-body text-[13px] text-[var(--franco-text-secondary)]">{row.label}</dt>
            <dd className="font-mono text-[13px] text-[var(--franco-text)] text-right m-0">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────

export function Paso4Resumen({
  state,
  ufCLP,
  tierInfo,
  onEditarStep,
  onVolver,
  onAnalizar,
  submitting,
  submitError,
}: {
  state: WizardV3State;
  ufCLP: number;
  tierInfo: TierInfo | null;
  /** Navega al paso N y permite al user editar la sección correspondiente. */
  onEditarStep: (n: 1 | 2 | 3) => void;
  /** Botón "← Volver" al paso 3. */
  onVolver: () => void;
  /** "Analizar ahora →" — submit final. */
  onAnalizar: () => void;
  submitting: boolean;
  submitError: string;
}) {
  const mod = state.modalidad;
  const canAnalyze = canAnalyzeFromTier(tierInfo);

  // ─── Derivaciones para mostrar ─────────────────────

  const precioUF = parseNum(state.precio);
  const precioCLP = precioUF * ufCLP;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = parseDecimalLocale(state.tasaInteres) || 4.72;
  const supUtil = parseDecimalLocale(state.superficieUtil);
  const precioPorM2 = supUtil > 0 ? precioUF / supUtil : 0;
  const pieUF = precioUF * (piePct / 100);
  const creditoCLP = (precioUF - pieUF) * ufCLP;
  const tasaMensual = tasa / 100 / 12;
  const n = plazo * 12;
  const dividendoCLP = creditoCLP > 0 && tasaMensual > 0
    ? Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)))
    : 0;

  const motor = gestionOptionToMotor(state.gestionOption);
  const occDerivada = calcOccDerivada(state.tipoEdificio, motor.adminPro);
  const factorADR = calcFactorADR(state.tipoEdificio, state.habilitacion);
  const occFinal = state.occOverride !== null ? state.occOverride : occDerivada;
  const adrEsOverride = state.adrOverride !== null;
  const occEsOverride = state.occOverride !== null;
  const comisionUsadaPct = state.gestionOption === "tu_mismo" ? 3 : Number(state.comisionAdminPct);

  // ─── Secciones del resumen ──────────────────────────

  const seccionPropiedad: SectionConfig = {
    numero: "01 · PROPIEDAD",
    title: "Lo que vas a comprar",
    editStep: 1,
    rows: [
      { label: "Dirección", value: state.direccion || "—" },
      { label: "Comuna", value: state.comuna || "—" },
      { label: "Tipo", value: state.tipoPropiedad === "nuevo" ? "Nuevo" : "Usado" },
      { label: "Superficie útil", value: state.superficieUtil ? `${state.superficieUtil} m²` : "—" },
      {
        label: "Tipología",
        value: `${state.dormitorios || "—"}D · ${state.banos || "—"}B${state.esStudio ? " (studio)" : ""}`,
      },
      { label: "Estac. / Bodega", value: `${state.estacionamientos || "0"} · ${state.bodegas || "0"}` },
    ],
  };

  const seccionFinanciamiento: SectionConfig = {
    numero: "02 · FINANCIAMIENTO",
    title: "Cómo la compras",
    editStep: 2,
    rows: [
      { label: "Precio", value: precioUF > 0 ? `${fmtUF(precioUF)} ≈ ${fmtCLP(precioCLP)}` : "—" },
      { label: "Precio por m²", value: precioPorM2 > 0 ? fmtUF(precioPorM2) : "—" },
      { label: "Pie", value: `${piePct}% · ${fmtUF(pieUF)}` },
      { label: "Plazo crédito", value: `${plazo} años` },
      { label: "Tasa anual", value: `${state.tasaInteres}%` },
      { label: "Dividendo estimado", value: dividendoCLP > 0 ? `${fmtCLP(dividendoCLP)}/mes` : "—" },
    ],
  };

  const operacionalRows: { label: string; value: string }[] = [
    { label: "Modalidad de análisis", value: mod ? LABEL_MODALIDAD[mod] : "—" },
  ];

  if (mod === "str" || mod === "both") {
    operacionalRows.push(
      { label: "Tipo de edificio", value: LABEL_TIPO_EDIFICIO[state.tipoEdificio] },
      { label: "Gestión", value: state.gestionOption === "pro_formal" ? "Operador profesional" : "Auto-gestión" },
      { label: "Comisión operador", value: `${comisionUsadaPct}%` },
      { label: "Habilitación", value: LABEL_HABILITACION[state.habilitacion] },
      { label: "Edificio permite Airbnb", value: LABEL_EDIFICIO_PERMITE[state.edificioPermiteAirbnb] },
    );
    if (state.tipoEdificio === "dedicado" && state.operadorNombre.trim().length > 0) {
      operacionalRows.push({ label: "Operador del edificio", value: state.operadorNombre.trim() });
    }
    operacionalRows.push(
      {
        label: "ADR ajustado",
        value: adrEsOverride
          ? `${fmtCLP(state.adrOverride!)} (override manual)`
          : "Derivado automáticamente",
      },
      {
        label: "Ocupación estabilizada",
        value: occEsOverride
          ? `${Math.round(occFinal * 100)}% (override manual)`
          : `${Math.round(occDerivada * 100)}% (mes 7+)`,
      },
      { label: "Factor ADR (edif × hab)", value: `×${factorADR.toFixed(2)}` },
    );
  }

  if (mod === "ltr" || mod === "both") {
    operacionalRows.push(
      { label: "Vacancia LTR", value: `${state.vacanciaPct}%` },
      { label: "Gestión LTR", value: state.adminPct === "0" ? "Autogestión" : `${state.adminPct}% corredor` },
    );
  }

  operacionalRows.push({
    label: "Estado del depto",
    value: state.estaAmoblado
      ? "Ya amoblado"
      : `Falta amoblar (${state.costoAmoblamiento ? fmtCLP(parseNum(state.costoAmoblamiento)) : "—"})`,
  });

  const seccionOperacional: SectionConfig = {
    numero: "03 · OPERACIONAL",
    title: "Cómo lo operas",
    editStep: 3,
    rows: operacionalRows,
  };

  const costosRows: { label: string; value: string }[] = [
    { label: "Arriendo de referencia LTR", value: state.arriendo ? `${fmtCLP(parseNum(state.arriendo))}/mes` : "—" },
    { label: "Gastos comunes", value: state.gastos ? `${fmtCLP(parseNum(state.gastos))}/mes` : "—" },
    { label: "Contribuciones", value: state.contribuciones ? `${fmtCLP(parseNum(state.contribuciones))}/trim` : "—" },
  ];
  if (mod === "str" || mod === "both") {
    const totalSTROps = parseNum(state.costoElectricidad)
      + parseNum(state.costoAgua)
      + parseNum(state.costoWifi)
      + parseNum(state.costoInsumos)
      + parseNum(state.mantencionMensual);
    costosRows.push({
      label: "Costos operativos STR",
      value: totalSTROps > 0 ? `${fmtCLP(totalSTROps)}/mes (luz + agua + wifi + insumos + mant.)` : "—",
    });
  }

  const seccionCostos: SectionConfig = {
    numero: "04 · COSTOS",
    title: "Lo que te cuesta cada mes",
    editStep: 3,
    rows: costosRows,
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 animate-slide-left">
      <div>
        <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)] m-0 mb-1">
          Revisa antes de analizar
        </h2>
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
          Edita cualquier sección si necesitas ajustar algo antes de analizar.
        </p>
      </div>

      <ResumenSection {...seccionPropiedad} onEditar={() => onEditarStep(1)} />
      <ResumenSection {...seccionFinanciamiento} onEditar={() => onEditarStep(2)} />
      <ResumenSection {...seccionOperacional} onEditar={() => onEditarStep(3)} />
      <ResumenSection {...seccionCostos} onEditar={() => onEditarStep(3)} />

      {submitError && (
        <StateBox variant="left-border" state="negative">{submitError}</StateBox>
      )}

      {/* Footer CTAs siguiendo Patrón 5 — Form Step */}
      <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-[var(--franco-border)]">
        <button
          type="button"
          onClick={onVolver}
          className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
        >
          ← Volver al paso 3
        </button>
        <button
          type="button"
          onClick={onAnalizar}
          disabled={submitting || !canAnalyze}
          className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creando análisis…</>
          ) : !canAnalyze ? (
            <>Necesitas un crédito</>
          ) : (
            <>Analizar ahora →</>
          )}
        </button>
      </div>
    </div>
  );
}
