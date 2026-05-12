"use client";

import type { DatoClave } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { HeroTopStrip } from "../HeroTopStrip";
import { DatoCard } from "../DatoCard";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Hero Verdict Block — variante Renta Corta (STR). Patrón 1 del design system.
 *
 * Estructura espejo de HeroVerdictBlock LTR:
 *   1. <HeroTopStrip /> — propiedad + score + metadata
 *   2. Divider sólido
 *   3. Cuerpo: tag "01 · VEREDICTO" + pregunta + alert callout +
 *      grid 3 DatoCards (NOI · Cash-on-Cash · Ventaja vs LTR)
 *
 * Commit 1 · 2026-05-11: vocabulario unificado con LTR (COMPRAR / AJUSTA
 * SUPUESTOS / BUSCAR OTRA). El tratamiento visual sigue el mismo patrón:
 *   COMPRAR          → Ink neutro, badge invertido
 *   AJUSTA SUPUESTOS → Ink secundario, badge texto Signal Red
 *   BUSCAR OTRA      → wash Signal Red, badge sólido
 */

type Tratamiento = "neutro" | "ajusta" | "rojo";

function tratamientoFor(v: STRVerdict): Tratamiento {
  if (v === "COMPRAR") return "neutro";
  if (v === "BUSCAR OTRA") return "rojo";
  return "ajusta";
}

const VERDICT_TOOLTIPS_STR: Record<string, string> = {
  COMPRAR: "El depto cumple los criterios de renta corta: ventaja sobre LTR clara, NOI sólido, recuperación de inversión razonable.",
  "AJUSTA SUPUESTOS": "El depto tiene potencial STR pero algún parámetro (ocupación, comisión, costos) está justo. Hay que ajustar antes de operar.",
  "BUSCAR OTRA": "Los números STR no superan al LTR. Mejor revisar otra propiedad o cambiar la estrategia.",
};

export function HeroVerdictBlockSTR({
  results,
  veredicto,
  score,
  propiedadTitle,
  propiedadSubtitle,
  metadataItems,
  currency,
  onCurrencyChange,
  valorUF,
}: {
  results: ShortTermResult;
  veredicto: STRVerdict;
  score: number;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  valorUF: number;
}) {
  // Commit 1 · 2026-05-11: normalizar veredicto recibido para soportar
  // legacy DB ("VIABLE", "AJUSTA ESTRATEGIA", "NO RECOMENDADO"). El render
  // siempre usa el vocabulario unificado. La variable local sombrea la prop
  // — los renders abajo usan `veredicto` ya normalizado.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _veredictoOriginal: string = veredicto;
  veredicto = (normalizeLegacyVerdict(veredicto) as STRVerdict | null) ?? "BUSCAR OTRA";
  const trato = tratamientoFor(veredicto);
  const isRojo = trato === "rojo";
  const isAjusta = trato === "ajusta";
  const isNeutro = trato === "neutro";

  const heroContainerBg = isNeutro
    ? "var(--franco-card)"
    : isRojo
      ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
      : "color-mix(in srgb, var(--franco-text) 4%, transparent)";
  const heroContainerBorder = isNeutro
    ? "0.5px solid var(--franco-border)"
    : isRojo
      ? "0.5px solid color-mix(in srgb, var(--signal-red) 35%, transparent)"
      : "0.5px solid color-mix(in srgb, var(--franco-text) 12%, transparent)";

  const dividerDashedColor = isNeutro
    ? "var(--franco-border)"
    : "color-mix(in srgb, var(--signal-red) 20%, transparent)";

  // Badge: rojo sólido (BUSCAR OTRA), texto rojo sobre card (AJUSTA), Ink invertido (COMPRAR)
  const badgeBg = isRojo
    ? "var(--signal-red)"
    : isAjusta
      ? "var(--franco-card)"
      : "var(--franco-text)";
  const badgeText = isRojo
    ? "var(--franco-bg)"
    : isAjusta
      ? "var(--signal-red)"
      : "var(--franco-bg)";
  const badgeBorder = isAjusta
    ? "0.5px solid color-mix(in srgb, var(--signal-red) 30%, transparent)"
    : undefined;

  // Construcción de los 3 DatoCards desde el motor
  const base = results.escenarios.base;
  const noiMensual = base.noiMensual;
  const cashOnCash = base.cashOnCash; // decimal
  const sobreRenta = results.comparativa.sobreRenta;
  const sobreRentaPct = results.comparativa.sobreRentaPct;

  const datosClave: DatoClave[] = [
    {
      label: noiMensual >= 0 ? "NOI mensual" : "NOI mensual",
      valor_clp: fmtMoney(noiMensual, "CLP", valorUF),
      valor_uf: fmtMoney(noiMensual, "UF", valorUF),
      subtexto: "Antes de dividendo",
      isLabel: false,
      color: noiMensual < 0 ? "red" : "neutral",
    },
    {
      label: "Cash-on-Cash",
      valor_clp: fmtPct(cashOnCash * 100, 1),
      valor_uf: fmtPct(cashOnCash * 100, 1),
      subtexto: "Anual sobre capital invertido",
      isLabel: false,
      color: cashOnCash < 0 ? "red" : isRojo ? "neutral" : "accent",
    },
    {
      label: sobreRenta >= 0 ? "Ventaja vs LTR" : "Ventaja vs LTR",
      valor_clp: (sobreRenta >= 0 ? "+" : "") + fmtMoney(sobreRenta, "CLP", valorUF),
      valor_uf: (sobreRenta >= 0 ? "+" : "") + fmtMoney(sobreRenta, "UF", valorUF),
      subtexto: `${sobreRentaPct >= 0 ? "+" : ""}${fmtPct(sobreRentaPct * 100, 0)} mensual`,
      isLabel: false,
      color: sobreRenta < 0 ? "red" : "neutral",
    },
  ];

  // Pregunta + alert por veredicto
  const pregunta = isRojo
    ? "¿Conviene operar este depto en renta corta?"
    : isAjusta
      ? "¿Cómo puedes hacer rendir este depto en renta corta?"
      : "¿Es buena oportunidad para renta corta?";

  const alertLabel = isRojo
    ? "ANTES DE SEGUIR, DECIDE"
    : isAjusta
      ? "ANTES DE SEGUIR, DECIDE"
      : "CONSIDERA ANTES DE AVANZAR";
  const alertText = isRojo
    ? "El sobre-rendimiento contra LTR no compensa el riesgo operativo. Revisar antes de avanzar."
    : isAjusta
      ? "Los números cierran solo bajo el escenario base. Si la ocupación cae al percentil 25 del mercado, la operación deja de tener sentido."
      : "El depto ofrece una ventaja clara vs arriendo largo. Revisa los riesgos operativos antes de cerrar.";

  return (
    <div
      className="relative rounded-[16px] overflow-hidden mb-6"
      style={{ background: heroContainerBg, border: heroContainerBorder }}
    >
      <HeroTopStripWrapper
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
        toggleGroupBorder="var(--franco-border)"
        dividerDashedColor={dividerDashedColor}
      />

      {/* Divider sólido entre TopStrip y Body */}
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* BODY */}
      <div className="px-5 md:px-8 py-5 md:py-6">
        <span
          className="font-mono uppercase block mb-2"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--franco-text-tertiary)",
          }}
        >
          01 · VEREDICTO
        </span>
        <h2 className="font-heading font-bold text-[22px] md:text-[26px] text-[var(--franco-text)] m-0 mb-3 leading-[1.2]">
          {pregunta}
        </h2>

        {/* Grid 3 DatoCards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5">
          {datosClave.map((dato, i) => (
            <DatoCard key={i} dato={dato} currency={currency} />
          ))}
        </div>

        {/* Alert callout — border-left por veredicto */}
        <div
          className="px-4 py-3"
          style={{
            background: isRojo
              ? "color-mix(in srgb, var(--signal-red) 8%, transparent)"
              : "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            borderLeft: `3px solid ${isNeutro ? "var(--franco-text-tertiary)" : "var(--signal-red)"}`,
            borderRadius: "0 8px 8px 0",
          }}
        >
          <p
            className="font-mono uppercase mb-1.5"
            style={{
              fontSize: 9,
              letterSpacing: "0.08em",
              color: isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)",
              fontWeight: 600,
            }}
          >
            {alertLabel}
          </p>
          <p className="font-body text-[13px] md:text-[14px] text-[var(--franco-text)] m-0 leading-[1.5]">
            {alertText}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper sobre HeroTopStrip que sustituye los tooltips LTR por los STR.
 * HeroTopStrip importa VERDICT_TOOLTIPS de AIInsightSection (LTR-only) — para
 * STR usamos la lookup local. Por ahora el componente shared no expone slot
 * de tooltip; el wrapper inyecta el tooltip al título del badge no se cambia
 * (lo hace HeroTopStrip internamente). Si en el futuro se requiere override,
 * extender HeroTopStrip con prop `verdictTooltip?: string`.
 */
function HeroTopStripWrapper(props: React.ComponentProps<typeof HeroTopStrip>) {
  // Side-effect-free: el lookup VERDICT_TOOLTIPS_STR queda disponible para
  // consumers manuales si se requiere. HeroTopStrip resuelve el suyo.
  void VERDICT_TOOLTIPS_STR;
  return <HeroTopStrip {...props} />;
}
