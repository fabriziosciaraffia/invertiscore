"use client";

// "¿Cómo llegamos a este número?" — bloque pedagógico que explica cómo se
// construyó el INGRESO BRUTO del escenario base (ADR × ocupación × días).
// Calibración v1 (mayo 2026) + override manual (iter 2026-05-10).
//
// E.2 (2026-07): panel simplificado. Los factores ADR de edificio/habilitación
// están neutralizados a 1,00 desde jun-2026 (doctrina: solo la gestión mueve el
// número, vía OCUPACIÓN). Mostrar edificio/habilitación como ejes con "×1.00"
// insinuaba que construían el ADR y no lo hacen. Ahora:
//   • El eje visible es GESTIÓN (mueve la banda de ocupación).
//   • Edificio/habilitación SOLO se muestran como eje si su factor persistido
//     es ≠ 1,00 (rama legacy pre-neutralización — mismo patrón condicional que
//     ya existía en la línea de tarifa).
//   • `dedicado` sube la banda de ocupación real → se NOMBRA en la línea de
//     gestión/ocupación (su efecto vivo). habilitación (amoblamiento/capex) vive
//     como contexto en el drawer de rentabilidad, no acá.
//   • Colapsable: cerrado = strip resumen; abierto = panel completo. Arranca
//     abierto si hay override manual (preserva esa transparencia).

import { useState } from "react";
import type { EjesAplicadosSTR as EjesType, OccFuenteSTR } from "@/lib/engines/short-term-engine";
import { InfoTooltip } from "@/components/ui/tooltip";
import { fmtDec } from "@/components/analysis/utils";

// Mínimo de comparables válidos para mostrar la ocupación realizada. Bajo este
// umbral la mediana es ruido — no se muestra la fila.
const MIN_N_REALIZADA = 10;
// Mínimo de superhosts para mostrar su sub-dato (muestra muy chica = no fiable).
const MIN_N_SUPERHOST = 3;

interface Props {
  ejes: EjesType | undefined;
  /** Revenue mensual del escenario base (para mostrar el resultado final) */
  revenueMensualBase: number;
  currency: "CLP" | "UF";
  valorUF: number;
  /** Fuente de la ocupación base (Remediación 2026-06). Si está presente, el
   * análisis es del motor nuevo: la fila separa ocupación observada vs
   * potencial. Si es undefined (v1), se mantiene la fila legacy. */
  occFuente?: OccFuenteSTR;
  /** Display-only (transparencia 2026-06). Mediana de occ realizada de la pool
   * de comparables AirROI. Si undefined (análisis histórico), no se renderiza. */
  occRealizada?: { p50: number; p50Superhost: number; n: number; nSuperhost: number };
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

export function EjesAplicadosSTR({ ejes, revenueMensualBase, currency, valorUF, occFuente, occRealizada }: Props) {
  const adrEsOverride = ejes?.adrOverride != null;
  const occEsOverride = ejes?.occOverride != null;
  // Arranca abierto si hay override manual: esa transparencia no se esconde
  // detrás de un click. Caso normal → cerrado (strip resumen).
  const [open, setOpen] = useState<boolean>(adrEsOverride || occEsOverride);

  if (!ejes) return null;

  const occPct = (ejes.ocupacionTarget * 100).toFixed(0);
  const adrFinal = ejes.adrFinal ?? ejes.adrAjustado;
  const ocupacionFinal = ejes.ocupacionFinal ?? ejes.ocupacionTarget;
  const occFinalPct = (ocupacionFinal * 100).toFixed(0);
  // Remediación 2026-06 — gap observada → potencial (solo motor nuevo).
  const occGap = Math.round((ejes.ocupacionTarget - ocupacionFinal) * 100);
  const occGapTxt = `${occGap >= 0 ? "+" : ""}${occGap} pts`;

  // E.2 — ejes edificio/habilitación solo si el factor ADR persistido ≠ 1,00
  // (rama legacy pre-neutralización). Con el motor actual nunca disparan.
  const edificioLegacy = ejes.factorEdificio.toFixed(2) !== "1.00";
  const habilitacionLegacy = ejes.factorHabilitacion.toFixed(2) !== "1.00";
  // `dedicado` sube la banda de ocupación (efecto vivo, no-ADR) → se nombra.
  const esDedicado = ejes.tipoEdificio === "dedicado";

  const gestionDesc = esDedicado
    ? "Edificio dedicado a renta corta: sube la banda de ocupación estable de la zona. La gestión mueve la ocupación, no la tarifa."
    : "La gestión mueve la ocupación, no la tarifa. Un operador profesional cobra tarifas parecidas y gana en ocupación estable.";

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 mt-3">
      {/* Header — clickable para colapsar/expandir */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
        aria-expanded={open}
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", color: "var(--franco-text-muted)", fontSize: 11 }}
          aria-hidden
        >
          ▸
        </span>
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">
          ¿Cómo llegamos a este número?
        </span>
        {!open && (
          <span className="ml-auto font-mono text-[10px] text-[var(--franco-text-tertiary)] uppercase tracking-[0.06em] shrink-0">
            Ver desglose
          </span>
        )}
      </button>

      {/* Cerrado — strip resumen (los números clave en una línea) */}
      {!open && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11.5px] text-[var(--franco-text-secondary)]">
          <span>ADR <span className="text-[var(--franco-text)] font-medium">{fmtMoney(adrFinal, currency, valorUF)}</span></span>
          <span>{occFuente ? "Ocupación observada" : "Ocupación"} <span className="text-[var(--franco-text)] font-medium">{occFinalPct}%</span></span>
          {occFuente && <span>Potencial <span className="text-[var(--franco-text)] font-medium">{occPct}%</span></span>}
          <span>Bruto <span className="text-[var(--franco-text)] font-medium">{fmtMoney(revenueMensualBase, currency, valorUF)}</span></span>
        </div>
      )}

      {/* Abierto — panel completo */}
      {open && (
        <div className="mt-4">
          <div className="space-y-3">
            {/* Eje legacy: edificio (solo si factor ADR persistido ≠ 1,00) */}
            {edificioLegacy && (
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                    Edificio: {LABEL_EDIFICIO[ejes.tipoEdificio] ?? ejes.tipoEdificio}
                  </div>
                  <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
                    {ejes.tipoEdificio === "dedicado" && "Diseñado para renta corta — operación más fluida y ocupación más estable."}
                    {ejes.tipoEdificio === "mixto" && "Algunos vecinos operan Airbnb. Aceptación parcial."}
                    {ejes.tipoEdificio === "residencial_puro" && "La mayoría de los vecinos vive ahí."}
                  </div>
                </div>
                <div className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
                  ADR ×{fmtDec(ejes.factorEdificio, 2)}
                </div>
              </div>
            )}

            {/* Eje legacy: habilitación (solo si factor ADR persistido ≠ 1,00) */}
            {habilitacionLegacy && (
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                    Habilitación: {LABEL_HABILITACION[ejes.habilitacion] ?? ejes.habilitacion}
                  </div>
                  <div className="font-body text-[11px] text-[var(--franco-text-muted)]">
                    {ejes.habilitacion === "premium" && "Decoración curada, blancos hoteleros, amenidades."}
                    {ejes.habilitacion === "estandar" && "Amoblamiento decente + fotos profesionales."}
                    {ejes.habilitacion === "basico" && "Funcional, fotos amateur."}
                  </div>
                </div>
                <div className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
                  ADR ×{fmtDec(ejes.factorHabilitacion, 2)}
                </div>
              </div>
            )}

            {/* Eje vivo: gestión (mueve la ocupación). `dedicado` se nombra acá. */}
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                  Gestión: {ejes.adminPro ? "Profesional" : "Auto-gestión"}
                </div>
                <div className="font-body text-[11px] text-[var(--franco-text-muted)] max-w-[420px]">
                  {gestionDesc}
                </div>
              </div>
              <div className="font-mono text-[12px] text-[var(--franco-text-secondary)] shrink-0">
                Occ target {occPct}%
              </div>
            </div>
          </div>

          {/* Bloque de cálculo del ingreso */}
          <div className="mt-4 pt-3 border-t border-[var(--franco-border)] space-y-1.5">
            <div className="flex justify-between font-mono text-[12px]">
              <span className="text-[var(--franco-text-muted)]">Tarifa diaria promedio del mercado</span>
              <span className="text-[var(--franco-text-secondary)]">{fmtMoney(ejes.adrBaselineP50, currency, valorUF)}</span>
            </div>
            <div className="flex justify-between font-mono text-[12px]">
              <span className="text-[var(--franco-text-muted)]">Tu tarifa diaria estimada{ejes.factorADRTotal.toFixed(2) !== "1.00" ? ` (×${fmtDec(ejes.factorADRTotal, 2)})` : ""}</span>
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
            {occFuente ? (
              <>
                {/* Motor nuevo: el base factura la ocupación OBSERVADA; el target
                    se muestra aparte como potencial. */}
                <div className="flex justify-between font-mono text-[12px]">
                  <span className="text-[var(--franco-text-muted)] inline-flex items-center gap-1.5">
                    Ocupación estimada de la zona
                    <InfoTooltip content="Estimación del modelo de AirROI para la zona; es la ocupación que usa el cálculo." />
                  </span>
                  {occEsOverride ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--franco-text)] font-semibold">{occFinalPct}%</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] font-semibold text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] rounded-sm px-1.5 py-0.5">
                        Ajustado manualmente
                      </span>
                    </span>
                  ) : (
                    <span className="text-[var(--franco-text)] font-semibold">{occFinalPct}%</span>
                  )}
                </div>
                {/* Ocupación REALIZADA de comparables, justo debajo de la estimada.
                    Display-only: no afecta el veredicto. */}
                {occRealizada && occRealizada.n >= MIN_N_REALIZADA && (
                  <div className="flex justify-between font-mono text-[12px]">
                    <span className="text-[var(--franco-text-muted)] inline-flex items-center gap-1.5">
                      Ocupación realizada de comparables
                      <InfoTooltip content="Mediana de la ocupación real de los últimos 12 meses de las propiedades comparables activas." />
                    </span>
                    <span className="text-[var(--franco-text-secondary)]">
                      mediana {(occRealizada.p50 * 100).toFixed(0)}% · {occRealizada.n} comparables
                      {occRealizada.nSuperhost >= MIN_N_SUPERHOST &&
                        ` · superhost ${(occRealizada.p50Superhost * 100).toFixed(0)}%`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-mono text-[12px]">
                  <span className="text-[var(--franco-text-muted)]">
                    Potencial con gestión profesional{esDedicado ? " (edificio dedicado)" : ""}
                  </span>
                  <span className="text-[var(--franco-text-secondary)]">{occPct}% ({occGapTxt})</span>
                </div>
              </>
            ) : (
              /* Legacy v1 (sin occFuente): la fila original. */
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
            )}
            <div className="flex justify-between font-mono text-[13px]">
              <span className="text-[var(--franco-text)]">Ingresos brutos mensuales estimados</span>
              <span className="text-[var(--franco-text)] font-semibold">{fmtMoney(revenueMensualBase, currency, valorUF)}</span>
            </div>
          </div>

          {/* Caveat fallback_mercado: sin ocupación observada para esta dirección. */}
          {occFuente === "fallback_mercado" && (
            <p className="mt-3 font-body text-[11px] italic text-[var(--franco-text-muted)] leading-relaxed">
              Sin datos suficientes para estimar la ocupación de esta dirección; se usó la mediana de Santiago (~45%) como referencia.
            </p>
          )}

          {/* Caveat general */}
          <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)] leading-relaxed">
            {(adrEsOverride || occEsOverride)
              ? "Ajustaste uno o más valores manualmente. Los ejes operativos siguen mostrados como referencia, pero el motor está usando tus valores en el cálculo."
              : "Estas estimaciones se basan en datos de operadores reales en Santiago (proforma de operador profesional Providencia 2025 + análisis de 149 propiedades comparables de la zona). Calibración en mejora continua a medida que más usuarios usan Franco STR."}
          </p>
        </div>
      )}
    </div>
  );
}
