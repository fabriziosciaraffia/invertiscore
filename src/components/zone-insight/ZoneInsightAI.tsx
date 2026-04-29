"use client";

import type { ZoneInsightData } from "@/hooks/useZoneInsight";

interface Props {
  insight: ZoneInsightData["insight"];
  currency: "CLP" | "UF";
}

export function ZoneInsightAI({ insight, currency }: Props) {
  const headline = currency === "CLP" ? insight.headline_clp : insight.headline_uf;
  const narrative = currency === "CLP" ? insight.narrative_clp : insight.narrative_uf;
  if (!headline && !narrative) return null;

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
        className="font-mono uppercase m-0 mb-2 font-semibold"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
      >
        Drivers de demanda identificados
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
