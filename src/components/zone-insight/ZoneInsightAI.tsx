"use client";

import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import { InfoTooltip } from "@/components/ui/tooltip";

interface Props {
  insight: ZoneInsightData["insight"];
  currency: "CLP" | "UF";
}

export function ZoneInsightAI({ insight, currency }: Props) {
  const headline = currency === "CLP" ? insight.headline_clp : insight.headline_uf;
  const narrative = currency === "CLP" ? insight.narrative_clp : insight.narrative_uf;
  // P1 Fase 23 — IA vacía: dot pattern con disclaimer en vez de null silencioso.
  if (!headline && !narrative) {
    return (
      <p className="font-mono text-[11px] m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Análisis IA de la zona no disponible para este depto. Revisa stats y POIs abajo.
      </p>
    );
  }

  return (
    <div
      style={{
        // borderLeft Ink primary (mode-aware). Skill dice "Ink 100" pero en
        // light mode Ink 100 (#FAFAF8) = bg card claro, invisible. var(--franco-text)
        // es la interpretación práctica de "Ink primary visible en ambos modos".
        borderLeft: "3px solid var(--franco-text)",
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderRadius: "0 8px 8px 0",
        padding: "14px 18px",
      }}
    >
      {/* Tag pill: ★ asterisco firma identitaria IA (skill Patrón 4 obligatorio) */}
      <span
        className="inline-block font-mono uppercase font-medium mb-2.5"
        style={{
          fontSize: 9,
          letterSpacing: "0.06em",
          color: "var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          padding: "4px 8px",
          borderRadius: 4,
        }}
      >
        ★ Insight generado por Franco IA
      </span>

      <p
        className="inline-flex items-center gap-1 font-mono uppercase m-0 mb-2 font-semibold"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
      >
        <span>Drivers de demanda identificados</span>
        <InfoTooltip content="Factores que impulsan la demanda inmobiliaria en la zona: cercanía a transporte, servicios, áreas comerciales y tendencias de la comuna." />
      </p>
      {headline && (
        <p className="font-heading font-bold text-[18px] leading-[1.35] text-[var(--franco-text)] m-0 mb-2">
          {headline}
        </p>
      )}
      {narrative && (
        <p
          className="font-body italic text-[14px] leading-[1.65] m-0"
          style={{ color: "color-mix(in srgb, var(--franco-text) 90%, transparent)" }}
        >
          {narrative}
        </p>
      )}
    </div>
  );
}
