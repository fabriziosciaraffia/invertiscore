"use client";

import { InfoTooltip } from "@/components/ui/tooltip";
import { ScoreBarInline, ScoreBarBandLabel } from "./ScoreBarInline";
import { FRANCO_SCORE_TOOLTIP, VERDICT_TOOLTIPS } from "./AIInsightSection";

/**
 * Franja superior del Hero Verdict Block (Patrón 1 sección 1+2). Contiene:
 * row 1 — propiedad title/subtitle + toggle CLP/UF
 * row 2 — metadata 2x3 (mobile) / 3x2 (desktop) + score block + barra ScoreBarInline
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3, líneas 280-443).
 * El score gradient bar se extrajo a <ScoreBarInline />.
 */
export function HeroTopStrip({
  score,
  veredicto,
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  currency,
  onCurrencyChange,
  badgeBg,
  badgeText,
  badgeBorder,
  toggleGroupBorder,
  dividerDashedColor,
}: {
  score: number | null;
  veredicto: string;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string | undefined;
  toggleGroupBorder: string;
  dividerDashedColor: string;
}) {
  return (
    <div className="px-5 md:px-8 py-4 md:py-5">

      {/* ROW 1 — prop-top: title + subtitle (izq) | toggle CLP/UF (der) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="font-heading font-bold text-[18px] md:text-[22px] text-[var(--franco-text)] m-0 leading-[1.2] truncate">
            {propiedadTitle}
          </h2>
          {propiedadSubtitle && (
            <p className="font-body text-[11px] md:text-[12px] text-[var(--franco-text-secondary)] m-0 truncate">
              {propiedadSubtitle}
            </p>
          )}
        </div>
        <div
          className="flex bg-[var(--franco-bar-track)] rounded-md p-0.5 self-start md:self-center shrink-0"
          style={{ border: `0.5px solid ${toggleGroupBorder}` }}
        >
          <button
            type="button"
            onClick={() => onCurrencyChange("CLP")}
            className={`font-mono text-[10px] px-2.5 py-1 rounded font-medium tracking-[0.5px] transition-colors ${
              currency === "CLP"
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "bg-transparent text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text)]"
            }`}
          >
            CLP
          </button>
          <button
            type="button"
            onClick={() => onCurrencyChange("UF")}
            className={`font-mono text-[10px] px-2.5 py-1 rounded font-medium tracking-[0.5px] transition-colors ${
              currency === "UF"
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "bg-transparent text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text)]"
            }`}
          >
            UF
          </button>
        </div>
      </div>

      {/* DIVIDER DASHED entre prop-top y parallel-row */}
      <div
        className="my-4 md:my-5"
        style={{ borderTop: `0.5px dashed ${dividerDashedColor}` }}
      />

      {/* ROW 2 — parallel-row: metadata 3x2 (desktop izq) | divider vertical | score+badge (desktop der) */}
      {/* Mobile: SCORE primero, METADATA segundo (skill regla dura) */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_1.4fr] md:gap-6 md:items-start">

        {/* Metadata 2x3 mobile / 3x2 desktop — siempre order-2 (mobile abajo / desktop derecha) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-2 shrink-0 order-2">
          {metadataItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 font-mono text-[8px] md:text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] whitespace-nowrap">
                <span>{item.label}</span>
                {item.tooltip && <InfoTooltip content={item.tooltip} />}
              </span>
              <span className="font-mono text-[12px] md:text-[13px] font-medium text-[var(--franco-text)] whitespace-nowrap">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Score block — siempre order-1 (mobile arriba / desktop izquierda).
            Vertical divider Ink en md+ a la derecha del score block.
            Layout post-Fase 18:
              [FRANCO SCORE ?]   [BADGE VEREDICTO]
              [score]   [────barra────]
              BUSCAR · AJUSTA · COMPRAR */}
        <div className="order-1 md:pr-6 md:border-r md:border-[color-mix(in_srgb,var(--franco-text)_12%,transparent)]">
          {/* Header row: label "Franco Score" + badge a la derecha.
              Tracking reducido (1.5px label / 1px badge) y padding compacto
              para que "BUSCAR OTRA" (badge más largo) entre en el ancho 1fr
              del score block en desktop. */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="inline-flex items-center gap-1 font-mono text-[8px] md:text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0">
              <span>Franco Score</span>
              <InfoTooltip content={FRANCO_SCORE_TOOLTIP} />
            </p>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span
                className="font-mono text-[10px] font-semibold tracking-[1px] uppercase px-2 py-1 rounded whitespace-nowrap text-center"
                style={{ color: badgeText, background: badgeBg, border: badgeBorder }}
              >
                {veredicto}
              </span>
              <InfoTooltip content={VERDICT_TOOLTIPS[veredicto] ?? VERDICT_TOOLTIPS["AJUSTA SUPUESTOS"]} />
            </span>
          </div>

          {/* Score number izq + bar+axis a la derecha (horizontal).
              Score null (análisis legacy sin FrancoScore) → "—" + barra
              atenuada sin dot. Evita mostrar un score 50 inventado que
              contradice slider y badge (bug Lastarria · Commit E.0). */}
          <div className="flex items-center gap-3">
            <p
              className={`font-mono text-[28px] md:text-[32px] font-bold leading-none m-0 shrink-0 ${
                score === null ? "text-[var(--franco-text-secondary)]" : "text-[var(--franco-text)]"
              }`}
            >
              {score === null ? "—" : score}
            </p>
            <div className="flex-1 min-w-0">
              <ScoreBarInline score={score} />
            </div>
          </div>
          {/* Sub-texto banda · Commit E.1 · 2026-05-13.
              "zona <interpretativa> · banda <veredicto>" da contexto verbal
              a la posición del dot. Solo se muestra si hay score. */}
          <ScoreBarBandLabel score={score} veredicto={veredicto} />
        </div>

      </div>
    </div>
  );
}
