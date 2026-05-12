// "¿Cómo llegamos a este número?" — bloque pedagógico que explica
// cómo se aplicaron los 3 ejes operacionales al baseline de AirROI.
// Calibración v1 (mayo 2026) + override manual (iter 2026-05-10).

import type { EjesAplicadosSTR as EjesType } from "@/lib/engines/short-term-engine";

interface Props {
  ejes: EjesType | undefined;
  /** Revenue mensual del escenario base (para mostrar el resultado final) */
  revenueMensualBase: number;
  currency: "CLP" | "UF";
  valorUF: number;
}

const fmtCLP = (n: number): string => "$" + Math.round(n).toLocaleString("es-CL");
const fmtUF = (n: number, valorUF: number): string => "UF " + (Math.round((n / valorUF) * 10) / 10).toLocaleString("es-CL");
const fmtMoney = (n: number, currency: "CLP" | "UF", valorUF: number) => currency === "UF" ? fmtUF(n, valorUF) : fmtCLP(n);

const LABEL_EDIFICIO: Record<string, string> = {
  residencial_puro: "Residencial",
  mixto: "Mixto",
  dedicado: "Edificio dedicado",
};

const LABEL_HABILITACION: Record<string, string> = {
  basico: "Básico",
  estandar: "Estándar",
  premium: "Premium",
};

export function EjesAplicadosSTR({ ejes, revenueMensualBase, currency, valorUF }: Props) {
  if (!ejes) return null;

  const occPct = (ejes.ocupacionTarget * 100).toFixed(0);
  // Iter 2026-05-10 — flags de override. Backward-compat: análisis pre-iter
  // no tienen estos campos en el jsonb, los tratamos como false.
  const adrEsOverride = ejes.adrOverride != null;
  const occEsOverride = ejes.occOverride != null;
  const adrFinal = ejes.adrFinal ?? ejes.adrAjustado;
  const ocupacionFinal = ejes.ocupacionFinal ?? ejes.ocupacionTarget;
  const occFinalPct = (ocupacionFinal * 100).toFixed(0);

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 mt-3">
      <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-4">
        ¿Cómo llegamos a este número?
      </div>

      <div className="space-y-3">
        {/* Eje 1: edificio */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">
              Edificio: {LABEL_EDIFICIO[ejes.tipoEdificio] ?? ejes.tipoEdificio}
            </div>
            <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
              {ejes.tipoEdificio === "dedicado" && "Diseñado para renta corta — operación más fluida y ocupación más estable."}
              {ejes.tipoEdificio === "mixto" && "Algunos vecinos operan Airbnb. Aceptación parcial."}
              {ejes.tipoEdificio === "residencial_puro" && "La mayoría de los vecinos vive ahí. ADR sin uplift."}
            </div>
          </div>
          <div className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
            ADR ×{ejes.factorEdificio.toFixed(2)}
          </div>
        </div>

        {/* Eje 3: habilitación */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">
              Habilitación: {LABEL_HABILITACION[ejes.habilitacion] ?? ejes.habilitacion}
            </div>
            <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
              {ejes.habilitacion === "premium" && "Decoración curada, blancos hoteleros, amenidades."}
              {ejes.habilitacion === "estandar" && "Amoblamiento decente + fotos profesionales."}
              {ejes.habilitacion === "basico" && "Funcional, fotos amateur. Sin uplift."}
            </div>
          </div>
          <div className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
            ADR ×{ejes.factorHabilitacion.toFixed(2)}
          </div>
        </div>

        {/* Eje 2: gestión */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-body text-[13px] font-semibold text-[var(--franco-text)]">
              Gestión: {ejes.adminPro ? "Profesional" : "Auto-gestión"}
            </div>
            <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
              La gestión profesional drives ocupación, no ADR. Operadores pro cobran ADRs conservadoras y ganan en ocupación estable.
            </div>
          </div>
          <div className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
            Occ target {occPct}%
          </div>
        </div>
      </div>

      {/* Línea final: resultado. Si hay override manual, el valor sugerido por
          ejes se muestra tachado y el badge "override manual" aparece junto al
          valor efectivamente usado por el motor. */}
      <div className="mt-4 pt-3 border-t border-[var(--franco-border)] space-y-1.5">
        <div className="flex justify-between font-mono text-[12px]">
          <span className="text-[var(--franco-text-muted)]">Tarifa diaria promedio del mercado</span>
          <span className="text-[var(--franco-text-secondary)]">{fmtMoney(ejes.adrBaselineP50, currency, valorUF)}</span>
        </div>
        <div className="flex justify-between font-mono text-[12px]">
          <span className="text-[var(--franco-text-muted)]">Tu tarifa diaria estimada (×{ejes.factorADRTotal.toFixed(2)})</span>
          {adrEsOverride ? (
            <span className="flex items-center gap-2">
              <span className="text-[var(--franco-text-muted)] line-through">{fmtMoney(ejes.adrAjustado, currency, valorUF)}</span>
              <span className="text-[var(--franco-text)] font-semibold">{fmtMoney(adrFinal, currency, valorUF)}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] font-semibold text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] rounded-sm px-1.5 py-0.5">
                Ajustado manualmente
              </span>
            </span>
          ) : (
            <span className="text-[var(--franco-text)] font-semibold">{fmtMoney(adrFinal, currency, valorUF)}</span>
          )}
        </div>
        <div className="flex justify-between font-mono text-[12px]">
          <span className="text-[var(--franco-text-muted)]">Ocupación estabilizada (mes 7+)</span>
          {occEsOverride ? (
            <span className="flex items-center gap-2">
              <span className="text-[var(--franco-text-muted)] line-through">{occPct}%</span>
              <span className="text-[var(--franco-text)] font-semibold">{occFinalPct}%</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] font-semibold text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] rounded-sm px-1.5 py-0.5">
                Ajustado manualmente
              </span>
            </span>
          ) : (
            <span className="text-[var(--franco-text)] font-semibold">{occFinalPct}%</span>
          )}
        </div>
        <div className="flex justify-between font-mono text-[13px]">
          <span className="text-[var(--franco-text)]">Ingresos brutos mensuales estimados</span>
          <span className="text-[var(--franco-text)] font-semibold">{fmtMoney(revenueMensualBase, currency, valorUF)}</span>
        </div>
      </div>

      {/* Caveat */}
      <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)] leading-relaxed">
        {(adrEsOverride || occEsOverride)
          ? "Ajustaste uno o más valores manualmente. Los ejes operativos siguen mostrados como referencia, pero el motor está usando tus valores en el cálculo."
          : "Estas estimaciones se basan en datos de operadores reales en Santiago (proforma de operador profesional Providencia 2025 + análisis de 149 propiedades comparables de la zona). Calibración en mejora continua a medida que más usuarios usan Franco STR."}
      </p>
    </div>
  );
}
