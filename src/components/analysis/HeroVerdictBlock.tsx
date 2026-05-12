"use client";

import { Calculator } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";
import type { AIAnalysisV2, FullAnalysisResult } from "@/lib/types";
import { HeroTopStrip } from "./HeroTopStrip";
import { DatoCard } from "./DatoCard";
import {
  buildHeroDatosClave,
  getVerdictStyles,
  renderAiContent,
} from "./AIInsightSection";

/**
 * Hero Verdict Block (Patrón 1 completo). Estructura en 3 secciones:
 *  1. <HeroTopStrip /> — property + score + metadata
 *  2. Divider sólido
 *  3. Cuerpo: tag "01 · Veredicto", pregunta, respuesta IA, banner callout,
 *     grid 3 DatoCards, reencuadre, alert box (StateBox left-border).
 *
 * Diferenciación visual por veredicto (4 variantes: COMPRAR, AJUSTA SUPUESTOS,
 * BUSCAR OTRA, RECONSIDERA LA ESTRUCTURA) — wash, borde, badge y label del
 * alert cambian. El gradient del ScoreBarInline es invariante (skill).
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3, ex-HeroCard).
 */
export function HeroVerdictBlock({
  data,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  results,
  valorUF,
}: {
  data: AIAnalysisV2;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  results: FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  // v.color sigue usándose para la numeración "01 · Veredicto" tag (consistencia con
  // VERDICT_STYLES). El resto del styling vive en helpers veredicto-based abajo.
  const v = getVerdictStyles(veredicto);
  const isCompra = veredicto === "COMPRAR";
  const isAjusta = veredicto === "AJUSTA SUPUESTOS";
  const isBuscar = veredicto === "BUSCAR OTRA";
  // 4to veredicto: el depto está bien, la matemática del financiamiento no.
  // Comparte tratamiento neutro con COMPRAR (badge Ink invertido, sin wash rojo)
  // pero icono Calculator y tag distinto.
  const isReconsidera = veredicto === "RECONSIDERA LA ESTRUCTURA";
  const isInkVerdict = isCompra || isReconsidera; // tratamientos Ink-neutros

  // Hero container — bg/border per veredicto (Capa 3 Patrón 1)
  const heroContainerBg = isCompra
    ? "var(--franco-card)"
    : isBuscar
      ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
      : "color-mix(in srgb, var(--franco-text) 4%, transparent)"; // AJUSTA + RECONSIDERA = Ink secundario neutro
  const heroContainerBorder = isCompra
    ? "0.5px solid var(--franco-border)"
    : isBuscar
      ? "0.5px solid color-mix(in srgb, var(--signal-red) 35%, transparent)"
      : "0.5px solid color-mix(in srgb, var(--franco-text) 12%, transparent)";

  // Divider dashed entre prop-top y parallel-row (dentro de HeroTopStrip)
  const dividerDashedColor = isInkVerdict
    ? "var(--franco-border)"
    : "color-mix(in srgb, var(--signal-red) 20%, transparent)";

  // Badge / pill 4-case (skill Patrón 1):
  // BUSCAR → Signal Red sólido + white
  // AJUSTA → outline (bg page + Signal Red text + border)
  // COMPRAR → Ink invertido
  // RECONSIDERA → Ink invertido + icono Calculator (mismo tratamiento que COMPRAR para consistencia neutra)
  const badgeBg = isInkVerdict
    ? "var(--franco-text)"
    : isAjusta
      ? "var(--franco-bg)"
      : "var(--signal-red)";
  const badgeText = isInkVerdict
    ? "var(--franco-bg)"
    : isAjusta
      ? "var(--signal-red)"
      : "white";
  const badgeBorder = isAjusta ? "0.5px solid var(--franco-border)" : undefined;

  // Verdict callout banner — bg/border per veredicto
  // - BUSCAR OTRA: wash Signal Red 8%
  // - AJUSTA SUPUESTOS: var(--franco-card)
  // - COMPRAR / RECONSIDERA: var(--franco-elevated) (sin tinte cromático)
  const calloutBg = isBuscar
    ? "color-mix(in srgb, var(--signal-red) 8%, transparent)"
    : isInkVerdict
      ? "var(--franco-elevated)"
      : "var(--franco-card)"; // AJUSTA
  const calloutBorder = isBuscar
    ? "none"
    : "0.5px solid var(--franco-border)";

  // Toggle CLP/UF group border (tintado per veredicto)
  const toggleGroupBorder = isInkVerdict
    ? "var(--franco-border)"
    : isBuscar
      ? "color-mix(in srgb, var(--signal-red) 25%, transparent)"
      : "color-mix(in srgb, var(--signal-red) 35%, transparent)";

  const respuesta = currency === "CLP" ? data.conviene.respuestaDirecta_clp : data.conviene.respuestaDirecta_uf;
  const veredictoFrase = currency === "CLP" ? data.conviene.veredictoFrase_clp : data.conviene.veredictoFrase_uf;
  const reencuadre = currency === "CLP" ? data.conviene.reencuadre_clp : data.conviene.reencuadre_uf;
  const cajaAccionable = currency === "CLP" ? data.conviene.cajaAccionable_clp : data.conviene.cajaAccionable_uf;

  // Build the 3 DatoCards from motor data, not from IA.
  // This guarantees consistency with MiniCards and drawers.
  const datosClave = buildHeroDatosClave(data, results, currency, valorUF);

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-3"
      style={{
        background: heroContainerBg,
        border: heroContainerBorder,
      }}
    >
      {/* FRANJA SUPERIOR */}
      <HeroTopStrip
        score={score}
        veredicto={veredicto}
        propiedadTitle={propiedadTitle}
        propiedadSubtitle={propiedadSubtitle}
        metadataItems={metadataItems}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        badgeBg={badgeBg}
        badgeText={badgeText}
        badgeBorder={badgeBorder}
        toggleGroupBorder={toggleGroupBorder}
        dividerDashedColor={dividerDashedColor}
      />

      {/* Divider sólido neutro entre HeroTopStrip y CUERPO (no compite con el dashed dentro de HeroTopStrip) */}
      <div
        className="h-px"
        style={{ background: "color-mix(in srgb, var(--franco-text) 12%, transparent)" }}
      />

      {/* CUERPO — veredicto completo */}
      <div className="p-6 md:p-8">
        <p
          className="font-mono text-[10px] uppercase tracking-[2px] mb-2 font-medium m-0"
          style={{ color: v.color }}
        >
          01 · Veredicto
        </p>
        <h2 className="font-heading font-bold text-[20px] md:text-[24px] leading-[1.25] mb-4 text-[var(--franco-text)] m-0">
          {isCompra
            ? "¿Por qué conviene?"
            : isAjusta
              ? "¿Conviene si negocias?"
              : isReconsidera
                ? "¿Y si cambias la estructura?"
                : "¿Por qué no conviene?"}
        </h2>

        <div className="font-body text-[14px] md:text-[15px] leading-[1.65] text-[var(--franco-text)] mb-3">
          {renderAiContent(respuesta)}
        </div>

        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-r-lg my-4"
          style={{
            background: calloutBg,
            border: calloutBorder,
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[2px] px-2.5 py-1 rounded uppercase shrink-0"
            style={{
              color: badgeText,
              background: badgeBg,
              border: badgeBorder,
            }}
          >
            {isReconsidera && <Calculator size={12} aria-hidden="true" />}
            {veredicto}
          </span>
          <p className="font-body text-[13px] md:text-[14px] font-medium text-[var(--franco-text)] m-0">
            {veredictoFrase}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-4">
          {datosClave.map((dato, i) => (
            <DatoCard key={i} dato={dato} currency={currency} />
          ))}
        </div>

        <div className="font-body text-[14px] md:text-[15px] leading-[1.65] text-[var(--franco-text)]">
          {renderAiContent(reencuadre)}
        </div>

        <StateBox
          variant="left-border"
          state={isInkVerdict ? "neutral" : "negative"}
          className="mt-5"
          style={{
            // - BUSCAR OTRA: wash Signal Red 6%
            // - AJUSTA SUPUESTOS: var(--franco-card) (state="negative" preserva
            //   borderLeft Signal Red + label Signal Red vía StateBox internal)
            // - COMPRAR / RECONSIDERA: var(--franco-elevated) sin tinte cromático
            background: isBuscar
              ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
              : isInkVerdict
                ? "var(--franco-elevated)"
                : "var(--franco-card)",
            borderRadius: "0 8px 8px 0",
            ...(isInkVerdict ? { borderLeft: "3px solid var(--franco-text-secondary)" } : {}),
          }}
        >
          {isInkVerdict ? (
            <p
              className="font-mono text-[10px] uppercase tracking-[2px] mb-2 m-0 font-semibold"
              style={{ color: "var(--franco-text-tertiary)" }}
            >
              {isReconsidera ? "Ajusta el financiamiento:" : "Considera antes de avanzar:"}
            </p>
          ) : (
            <span
              className="font-mono text-[10px] font-semibold tracking-[2px] uppercase inline-block px-2.5 py-1 rounded mb-2"
              style={{ color: badgeText, background: badgeBg, border: badgeBorder }}
            >
              {isAjusta ? "Antes de negociar:" : "Próximos pasos:"}
            </span>
          )}
          {renderAiContent(cajaAccionable)}
        </StateBox>
      </div>
    </div>
  );
}
