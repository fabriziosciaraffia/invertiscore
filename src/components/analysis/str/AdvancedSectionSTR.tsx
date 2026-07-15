"use client";

import type { ShortTermResult, EscenarioSTR } from "@/lib/engines/short-term-engine";
import { IndicatorsSTR } from "./IndicatorsSTR";
import { PatrimonioChartSTR } from "./PatrimonioChartSTR";
import { SaleBlockSTR } from "./SaleBlockSTR";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Patrón 7 — Advanced Section, variante Renta Corta.
 *
 * Paridad de formato con el canon LTR (AdvancedSection.tsx · alcance B):
 *   - SIN colapso: siempre visible (murió el CTA-anzuelo + las preguntas).
 *   - Superficie recesiva: card con bg tint 2.5%, border 0.5px, radius 16,
 *     inset shadow — panel hundido bajo la pirámide, sin chrome de colapso.
 *   - Layout 2-col protagonista: izq Patrimonio · der Venta (md:grid-cols-2).
 *   - Numeración 07-10 eliminada; ESCENARIOS full-width arriba · INDICADORES
 *     strip abajo (re-homing de la divergencia intrínseca STR).
 *
 * Diferencia intrínseca (NO se fuerza a igualar LTR): en STR los escenarios
 * vienen por percentil del mercado AirROI (p25/p50/p75), no por sliders
 * interactivos. El bloque ESCENARIOS muestra los 3 como cards.
 *
 * Copy "SIMULACIÓN INTERACTIVA" sin sliders (S6): diferido — se conserva verbatim.
 */
export function AdvancedSectionSTR({
  results,
  currency,
  valorUF,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  forceOpen = false,
  aiLargoPlazo,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
  // forceOpen: legacy del colapso (alcance B: la sección ya no colapsa, siempre
  // visible). Se mantiene en la firma para no tocar el caller.
  forceOpen?: boolean;
  /** E.2 — prosa IA "¿Cuánto se gana a 10 años?" (ai.largoPlazo). Migró desde el
   *  drawer flujo (mismatch temático) a su hogar: lead narrativo de Patrimonio.
   *  Null/undefined (free/guest/legacy) → solo el chart, sin prosa. */
  aiLargoPlazo?: { contenido?: string | null; cajaAccionable?: string | null } | null;
}) {
  // fix-occfuente-override 2026-07 — si el usuario definió la ocupación a mano, los rótulos
  // del bloque de escenarios NO la llaman "mediana observada": declaran procedencia.
  const occEsOverride = results.occFuente === "override";
  const occBasePct = Math.round(results.escenarios.base.ocupacionReferencia * 100);
  const occObsPct = Math.round((typeof results.occObservada === "number" ? results.occObservada : results.escenarios.base.ocupacionReferencia) * 100);

  // Subhead de bloque/columna: label mono (SIN número) + título serif. Mismo
  // molde que el subhead del canon LTR.
  const subhead = (label: string, title: string) => (
    <div style={{ marginBottom: 14 }}>
      <span
        className="font-mono uppercase block mb-1.5"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-tertiary)" }}
      >
        {label}
      </span>
      <h3 className="font-heading font-bold m-0" style={{ fontSize: 18, lineHeight: 1.25, color: "var(--franco-text)" }}>
        {title}
      </h3>
    </div>
  );

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 2.5%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 16,
        padding: "22px 24px 26px",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--franco-text) 3%, transparent)",
      }}
    >
      {/* Header — mono kicker + sub (copy STR verbatim, S6 diferido), SIN chrome
          de colapso. Un solo divider inferior, como el header del canon LTR. */}
      <div style={{ paddingBottom: 18, borderBottom: "0.5px solid var(--franco-border)" }}>
        <span
          className="font-mono uppercase block mb-1"
          style={{ fontSize: 10, letterSpacing: "1.5px", color: "var(--franco-text-secondary)", fontWeight: 500 }}
        >
          SIMULACIÓN INTERACTIVA
        </span>
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
          Indicadores avanzados · Patrimonio · Venta
        </p>
      </div>

      {/* ESCENARIOS — full-width arriba (divergencia intrínseca STR re-homed) */}
      <div style={{ marginTop: 22 }}>
        {subhead("Escenarios", "Cómo varía con la ocupación del mercado")}
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-4 leading-[1.6]">
          {occEsOverride
            ? `La base usa la ocupación que definiste (${occBasePct}%), no la observada de la zona (${occObsPct}%) — es un supuesto tuyo, no un dato de mercado; conservador es la cuarta parte más baja del mercado (p25), un escenario de caída de demanda. El potencial NO es el percentil 75 del mercado: es el techo alcanzable con gestión profesional una vez estabilizada la operación.`
            : "La base es la mediana de ocupación observada de la zona (percentil 50), la operación esperable; conservador es la cuarta parte más baja del mercado (p25), un escenario de caída de demanda. El potencial NO es el percentil 75 del mercado: es el techo alcanzable con gestión profesional una vez estabilizada la operación."}
        </p>
        {/* E.5 caveat (b) — procedencia de los percentiles de mercado (texto-solo;
            plumbing de `source` en backlog str-source-procedencia). */}
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mb-4 leading-[1.5] italic">
          Estimación de mercado (AirROI), no transacciones cerradas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <EscenarioCard escenario={results.escenarios.conservador} subtitle="Cuarta parte más baja del mercado (p25) — caída de demanda" currency={currency} valorUF={valorUF} />
          <EscenarioCard escenario={results.escenarios.base} subtitle={occEsOverride ? `Ocupación definida por ti (${occBasePct}%) — la observada es ${occObsPct}%` : "Mediana observada de la zona (p50) — operación esperable"} currency={currency} valorUF={valorUF} featured />
          <EscenarioCard escenario={results.escenarios.agresivo} label="Potencial (gestión pro)" subtitle="Potencial con gestión profesional, estabilizado" currency={currency} valorUF={valorUF} />
        </div>
      </div>

      {/* Dos columnas protagonistas (paridad LTR): izq Patrimonio · der Venta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ marginTop: 22 }}>
        <div className="min-w-0">
          {subhead("Patrimonio", `Tu patrimonio a lo largo de ${results.exitScenario?.yearVenta ?? 10} años`)}
          {/* E.2 — lead narrativo ai.largoPlazo (migrado del drawer flujo). El
              horizonte 10 años (TIR, multiplicador, plusvalía vs alternativas) es su
              hogar temático, junto al chart de patrimonio. */}
          {aiLargoPlazo?.contenido?.trim() && (
            <>
              <p
                className="font-mono uppercase mb-2 m-0"
                style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)" }}
              >
                ★ Análisis Franco IA · horizonte {results.exitScenario?.yearVenta ?? 10} años
              </p>
              <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.65] m-0 mb-4 whitespace-pre-wrap">
                {aiLargoPlazo.contenido}
              </p>
            </>
          )}
          <PatrimonioChartSTR results={results} currency={currency} valorUF={valorUF} />
          {aiLargoPlazo?.cajaAccionable?.trim() && (
            <div
              className="mt-4"
              style={{
                borderLeft: "3px solid var(--franco-text-secondary)",
                background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
                borderRadius: "0 8px 8px 0",
                padding: "12px 15px",
              }}
            >
              <p
                className="font-mono uppercase mb-1.5 m-0"
                style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)", fontWeight: 600 }}
              >
                Antes de comprometer una década:
              </p>
              <p className="font-body text-[13.5px] text-[var(--franco-text)] m-0 leading-[1.55] whitespace-pre-wrap">
                {aiLargoPlazo.cajaAccionable}
              </p>
            </div>
          )}
        </div>
        <div className="min-w-0">
          {subhead("Venta", "Si decides salir del activo")}
          <SaleBlockSTR results={results} currency={currency} valorUF={valorUF} />
        </div>
      </div>

      {/* INDICADORES — strip técnico subordinado, abajo (paridad LTR) */}
      <div style={{ marginTop: 22 }}>
        {subhead("Indicadores", "Métricas clave de retorno")}
        <IndicatorsSTR results={results} currency={currency} valorUF={valorUF} />
      </div>
    </div>
  );
}

/** Card por escenario en el bloque ESCENARIOS. Featured = base (p50). */
function EscenarioCard({
  escenario,
  subtitle,
  currency,
  valorUF,
  featured = false,
  label,
}: {
  escenario: EscenarioSTR;
  subtitle: string;
  currency: "CLP" | "UF";
  valorUF: number;
  featured?: boolean;
  /** Override presentacional del rótulo. Si se pasa, reemplaza a
   * `escenario.label` SOLO en la UI (el motor no se toca). Usado para
   * relabelizar "Agresivo" → "Potencial (gestión pro)". */
  label?: string;
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
        {label ?? escenario.label}
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
