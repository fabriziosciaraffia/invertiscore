"use client";

import { useState } from "react";
import type { ShortTermResult, EscenarioSTR } from "@/lib/engines/short-term-engine";
import { IndicatorsSTR } from "./IndicatorsSTR";
import { PatrimonioChartSTR } from "./PatrimonioChartSTR";
import { SaleBlockSTR } from "./SaleBlockSTR";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Patrón 7 — Advanced Section, variante Renta Corta.
 *
 * Estructura idéntica al LTR (07-10) pero sin SliderSimulacion: en STR los
 * escenarios vienen por percentil del mercado AirROI (p25/p50/p75), no por
 * sliders interactivos. El sub-patrón 07 muestra los 3 escenarios como cards.
 *
 * Numeración global:
 *   07 · ESCENARIOS  (cards conservador / base / agresivo por percentil)
 *   08 · INDICADORES (KPIs STR)
 *   09 · PATRIMONIO  (chart con projections de Ronda 4b)
 *   10 · VENTA       (escenario de salida con ExitScenarioSTR)
 */
export function AdvancedSectionSTR({
  results,
  currency,
  valorUF,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const [open, setOpen] = useState(false);

  const sectionHeader = (num: string, label: string, title: string) => (
    <div style={{ marginBottom: 14 }}>
      <span
        className="font-mono uppercase block mb-1.5"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-tertiary)" }}
      >
        {num} · {label}
      </span>
      <h3 className="font-heading font-bold m-0" style={{ fontSize: 20, lineHeight: 1.25, color: "var(--franco-text)" }}>
        {title}
      </h3>
    </div>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left group transition-colors"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--franco-text) 12%, transparent)",
          borderLeft: "3px solid var(--franco-text)",
          borderRadius: "0 10px 10px 0",
          padding: "22px 24px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 12%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 8%, transparent)")}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "var(--franco-text-secondary)", fontWeight: 500 }}
          >
            ⏳ SIMULACIÓN INTERACTIVA
          </span>
        </div>
        <p className="font-body text-[14px] m-0 mb-4 text-[var(--franco-text)] leading-[1.5]">
          Indicadores avanzados, patrimonio proyectado y escenarios de venta. Explora cómo se comporta tu inversión año a año.
        </p>
        <span
          className="font-mono uppercase inline-block"
          style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}
        >
          Explorar ↓
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--franco-card)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Header principal */}
      <div className="px-5 md:px-7 py-5 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--franco-border)" }}>
        <div>
          <span
            className="font-mono uppercase block mb-1"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "var(--franco-text-secondary)", fontWeight: 500 }}
          >
            ⏳ SIMULACIÓN INTERACTIVA
          </span>
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
            Indicadores avanzados · Patrimonio · Venta
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono uppercase text-[10px] tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
        >
          Colapsar ↑
        </button>
      </div>

      {/* 07 ESCENARIOS */}
      <div className="px-5 md:px-7 py-6">
        {sectionHeader("07", "ESCENARIOS", "Cómo varía con la ocupación del mercado")}
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-4 leading-[1.6]">
          Los escenarios usan los percentiles de revenue del mercado AirROI para tu zona. El base (p50) es la mediana esperable; conservador (p25) y agresivo (p75) son los extremos plausibles.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <EscenarioCard escenario={results.escenarios.conservador} subtitle="Percentil 25 — caída de demanda" currency={currency} valorUF={valorUF} />
          <EscenarioCard escenario={results.escenarios.base} subtitle="Percentil 50 — operación esperable" currency={currency} valorUF={valorUF} featured />
          <EscenarioCard escenario={results.escenarios.agresivo} subtitle="Percentil 75 — temporada alta" currency={currency} valorUF={valorUF} />
        </div>
      </div>

      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* 08 INDICADORES */}
      <div className="px-5 md:px-7 py-6">
        {sectionHeader("08", "INDICADORES", "KPIs avanzados de la operación")}
        <IndicatorsSTR results={results} currency={currency} valorUF={valorUF} />
      </div>

      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* 09 PATRIMONIO */}
      <div className="px-5 md:px-7 py-6">
        {sectionHeader("09", "PATRIMONIO", `Tu patrimonio a lo largo de ${results.exitScenario?.yearVenta ?? 10} años`)}
        <PatrimonioChartSTR results={results} currency={currency} valorUF={valorUF} />
      </div>

      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* 10 VENTA */}
      <div className="px-5 md:px-7 py-6">
        {sectionHeader("10", "VENTA", "Si decides salir del activo")}
        <SaleBlockSTR results={results} currency={currency} valorUF={valorUF} />
      </div>
    </div>
  );
}

/** Card por escenario en sub-sección 07. Featured = base (p50). */
function EscenarioCard({
  escenario,
  subtitle,
  currency,
  valorUF,
  featured = false,
}: {
  escenario: EscenarioSTR;
  subtitle: string;
  currency: "CLP" | "UF";
  valorUF: number;
  featured?: boolean;
}) {
  const isCritical = escenario.flujoCajaMensual < 0;
  const borderColor = featured
    ? "var(--franco-text)"
    : "var(--franco-border)";
  const borderWidth = featured ? "1.5px" : "0.5px";

  return (
    <div
      style={{
        background: "var(--franco-card)",
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <p
        className="font-mono uppercase mb-2"
        style={{ fontSize: 10, letterSpacing: "1.2px", color: "var(--franco-text-secondary)", fontWeight: 500 }}
      >
        {escenario.label}
      </p>
      <p
        className="font-mono font-bold m-0"
        style={{
          fontSize: 22,
          color: isCritical ? "var(--signal-red)" : "var(--franco-text)",
          lineHeight: 1.1,
        }}
      >
        {(escenario.flujoCajaMensual >= 0 ? "+" : "")}{fmtMoney(escenario.flujoCajaMensual, currency, valorUF)}
      </p>
      <p className="font-mono text-[10px] text-[var(--franco-text-secondary)] uppercase tracking-[0.06em] mt-1 mb-3">
        FLUJO MENSUAL
      </p>
      <p className="font-body text-[12px] text-[var(--franco-text-secondary)] leading-[1.5] mb-3 m-0">
        {subtitle}
      </p>
      <div className="border-t-[0.5px] border-[var(--franco-border)] pt-2 flex justify-between text-[11px] font-mono text-[var(--franco-text-secondary)]">
        <span>NOI {fmtMoney(escenario.noiMensual, currency, valorUF)}</span>
        <span>CAP {fmtPct(escenario.capRate * 100, 1)}</span>
      </div>
    </div>
  );
}
