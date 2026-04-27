"use client";

import type { ZoneInsightData } from "@/hooks/useZoneInsight";

function countPOIs(data: ZoneInsightData | null): number {
  if (!data) return 0;
  return (
    data.pois.metro.length +
    data.pois.clinicas.length +
    data.pois.parques.length +
    data.pois.universidades.length +
    data.pois.institutos.length +
    data.pois.colegios.length +
    data.pois.malls.length +
    data.pois.negocios.length +
    data.pois.trenes.length
  );
}

function pickPreview(data: ZoneInsightData | null, currency: "CLP" | "UF"): string {
  if (!data) return "";
  const i = data.insight;
  const direct = currency === "CLP" ? i.preview_clp : i.preview_uf;
  if (direct) return direct;
  // Fallback for caches created before preview_* existed
  const narrative = currency === "CLP" ? i.narrative_clp : i.narrative_uf;
  if (!narrative) return "";
  return narrative.slice(0, 140).trim() + (narrative.length > 140 ? "…" : "");
}

interface Props {
  data: ZoneInsightData | null;
  loading: boolean;
  onClick: () => void;
  currency: "CLP" | "UF";
}

export function ZoneInsightMiniCard({ data, loading, onClick, currency }: Props) {
  const totalPOIs = countPOIs(data);
  const preview = loading && !data
    ? "Analizando atractores urbanos y demanda de la zona…"
    : pickPreview(data, currency) || "Explora el entorno del depto y los drivers de demanda.";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading && !data}
      className="w-full text-left transition-colors disabled:cursor-wait group relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--ink-400) 6%, transparent) 0%, transparent 60%), var(--franco-card)",
        border: "1px solid var(--franco-border)",
        borderRadius: 16,
        padding: "16px 18px",
        minHeight: 120,
      }}
    >
      {/* Top-border horizontal de 3px — reemplaza el border-left para evitar artefactos con radius-2xl */}
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 pointer-events-none"
        style={{ height: 3, background: "var(--ink-400)" }}
      />
      <div className="grid items-center gap-3.5 md:gap-4" style={{ gridTemplateColumns: "44px 1fr auto" }}>
        {/* Icono: radar / círculos concéntricos */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "color-mix(in srgb, var(--ink-400) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ink-400) 35%, transparent)",
            color: "var(--ink-400)",
          }}
          aria-hidden="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Body */}
        <div className="min-w-0 flex flex-col gap-1">
          <span
            className="font-mono text-[9px] uppercase tracking-[1.5px] font-medium"
            style={{ color: "var(--ink-400)" }}
          >
            Zona · 06
          </span>
          <h3 className="font-heading font-bold text-[15px] md:text-[16px] leading-[1.2] text-[var(--franco-text)] m-0">
            Lo que no ves a simple vista
          </h3>
          <p
            className="font-heading italic text-[12px] md:text-[12.5px] leading-[1.5] m-0 mt-0.5"
            style={{
              color: "color-mix(in srgb, var(--franco-text) 78%, transparent)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {preview.startsWith("\"") ? preview : `"${preview}"`}
          </p>
        </div>

        {/* Right stack */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className="font-mono text-[9px] uppercase tracking-[1px] px-[7px] py-[3px] rounded"
            style={{
              background: "color-mix(in srgb, var(--ink-400) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ink-400) 25%, transparent)",
              color: "var(--ink-400)",
            }}
          >
            {loading && !data ? "—" : `${totalPOIs} lugares`}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-[1.3px] hidden md:inline"
            style={{ color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" }}
          >
            Explorar →
          </span>
        </div>
      </div>
    </button>
  );
}
