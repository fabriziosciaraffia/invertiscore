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
        borderLeft: "3px solid #FBBF24",
        background: "color-mix(in srgb, #FBBF24 8%, transparent)",
        borderRadius: "0 8px 8px 0",
        padding: "14px 18px",
      }}
    >
      {/* Badge: Insight generado por Franco IA */}
      <div className="flex items-center gap-1.5 mb-2.5" style={{ opacity: 0.75 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span
          className="font-mono uppercase font-medium"
          style={{ fontSize: 9, letterSpacing: "1.2px", color: "#FBBF24" }}
        >
          Insight generado por Franco IA
        </span>
      </div>

      <p
        className="font-mono uppercase m-0 mb-2 font-semibold"
        style={{ fontSize: 10, letterSpacing: "2px", color: "#FBBF24" }}
      >
        Drivers de demanda identificados
      </p>
      {headline && (
        <p className="font-heading font-bold text-[15px] md:text-[16px] leading-[1.35] text-[var(--franco-text)] m-0 mb-2">
          {headline}
        </p>
      )}
      {narrative && (
        <p
          className="font-heading italic text-[13px] md:text-[14px] leading-[1.65] m-0"
          style={{ color: "color-mix(in srgb, var(--franco-text) 90%, transparent)" }}
        >
          {narrative}
        </p>
      )}
    </div>
  );
}
