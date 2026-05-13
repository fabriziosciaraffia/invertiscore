"use client";

import type { DatoClave, AIAnalysisSTRv2 } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { HeroTopStrip } from "../HeroTopStrip";
import { DatoCard } from "../DatoCard";
import { StateBox } from "@/components/ui/StateBox";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Hero Verdict Block — variante Renta Corta (STR). Patrón 1 del design system.
 *
 * Estructura espejo de HeroVerdictBlock LTR:
 *   1. <HeroTopStrip /> — propiedad + score + metadata
 *   2. Divider sólido
 *   3. Cuerpo:
 *      - tag "01 · VEREDICTO" + pregunta
 *      - respuestaDirecta IA (prose Sans, paridad LTR)
 *      - alert callout: badge + veredictoFrase IA (o fallback hardcoded)
 *      - grid 3 DatoCards (NOI · Cash-on-Cash · Ventaja vs LTR)
 *      - reencuadre IA (prose Sans)
 *      - cajaAccionable IA en StateBox al cierre
 *      - opcional: nota Franco-diverge-del-motor
 *
 * Commit C · 2026-05-12: Hero embebe narrativa IA inline (paridad LTR).
 * Antes la narrativa vivía en AIInsightSTR como bloque separado abajo del
 * Hero. Audit H1.1 identificó la inconsistencia con LTR Hero.
 *
 * Fallback elegante: si `ai` es null o `conviene.*` campos faltan, el Hero
 * renderiza la versión motor-only (alert hardcoded + DatoCards) sin
 * sub-bloques IA. Backward-compat con análisis legacy pre-Commit C.
 */

type Tratamiento = "neutro" | "ajusta" | "rojo";

function tratamientoFor(v: STRVerdict): Tratamiento {
  if (v === "COMPRAR") return "neutro";
  if (v === "BUSCAR OTRA") return "rojo";
  return "ajusta";
}

export function HeroVerdictBlockSTR({
  results,
  ai,
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
  /** Análisis IA v2. Si null/undefined, el Hero renderiza versión motor-only
   * con alert hardcoded. Pasarlo activa la doctrina §1.1 (asesor inline). */
  ai?: AIAnalysisSTRv2 | null;
  veredicto: STRVerdict;
  /** Score 0-100 del FrancoScoreSTR. Null cuando el análisis es legacy sin
   * FrancoScore persistido (en ese caso el Hero renderiza "—" en lugar de
   * un score inventado · Commit E.0). */
  score: number | null;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  valorUF: number;
}) {
  // Normalizar veredicto legacy DB ("VIABLE", "AJUSTA ESTRATEGIA", etc).
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

  // ─── IA fields (opcional) ──────────────────────────────────────────
  // Si `ai.conviene` existe con los 4 campos, el Hero embebe la narrativa
  // Franco inline (paridad LTR). Si faltan campos, fallback al hardcoded.
  const aiConviene = ai?.conviene;
  const aiRespuesta = aiConviene?.respuestaDirecta?.trim() || null;
  const aiVeredictoFrase = aiConviene?.veredictoFrase?.trim() || null;
  const aiReencuadre = aiConviene?.reencuadre?.trim() || null;
  const aiCaja = aiConviene?.cajaAccionable?.trim() || null;

  // Detección Franco-diverge-del-motor (skill §1.7).
  const francoVerdictNorm = ai?.francoVerdict
    ? ((normalizeLegacyVerdict(ai.francoVerdict) as STRVerdict | null) ?? ai.francoVerdict)
    : null;
  const engineSignalNorm = ai?.engineSignal
    ? ((normalizeLegacyVerdict(ai.engineSignal) as STRVerdict | null) ?? ai.engineSignal)
    : null;
  const diverge = !!francoVerdictNorm && !!engineSignalNorm && francoVerdictNorm !== engineSignalNorm;
  const rationale = diverge ? ai?.francoVerdictRationale?.trim() || null : null;

  // Construcción de los 3 DatoCards desde el motor
  const base = results.escenarios.base;
  const noiMensual = base.noiMensual;
  const cashOnCash = base.cashOnCash;
  const sobreRenta = results.comparativa.sobreRenta;
  const sobreRentaPct = results.comparativa.sobreRentaPct;

  const datosClave: DatoClave[] = [
    {
      label: "NOI mensual",
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
      label: sobreRenta >= 0 ? "Ventaja vs LTR" : "Desventaja vs LTR",
      valor_clp: (sobreRenta >= 0 ? "+" : "") + fmtMoney(sobreRenta, "CLP", valorUF),
      valor_uf: (sobreRenta >= 0 ? "+" : "") + fmtMoney(sobreRenta, "UF", valorUF),
      subtexto: `${sobreRentaPct >= 0 ? "+" : ""}${fmtPct(sobreRentaPct * 100, 0)} mensual`,
      isLabel: false,
      color: sobreRenta < 0 ? "red" : "neutral",
    },
  ];

  // Pregunta — usa la del IA si está, fallback a hardcoded por veredicto
  const aiPregunta = aiConviene?.pregunta?.trim() || null;
  const pregunta = aiPregunta
    ?? (isRojo
      ? "¿Conviene operar este depto en renta corta?"
      : isAjusta
        ? "¿Cómo puedes hacer rendir este depto en renta corta?"
        : "¿Es buena oportunidad para renta corta?");

  // Alert callout: label + texto. Si hay IA veredictoFrase, lo usamos como
  // texto principal del callout. Si no, fallback al hardcoded.
  const alertLabel = isRojo
    ? "ANTES DE SEGUIR, DECIDE"
    : isAjusta
      ? "ANTES DE SEGUIR, DECIDE"
      : "CONSIDERA ANTES DE AVANZAR";
  const alertTextFallback = isRojo
    ? "El sobre-rendimiento contra LTR no compensa el riesgo operativo. Revisar antes de avanzar."
    : isAjusta
      ? "Los números cierran solo bajo el escenario base. Si la ocupación cae a la cuarta parte más baja del mercado (percentil 25), la operación deja de tener sentido."
      : "El depto ofrece una ventaja clara vs arriendo largo. Revisa los riesgos operativos antes de cerrar.";
  const alertText = aiVeredictoFrase ?? alertTextFallback;

  // Label dinámico para la cajaAccionable según veredicto (paridad LTR)
  const cajaLabel = isRojo
    ? "Próximos pasos:"
    : isAjusta
      ? "Antes de avanzar:"
      : "Considera antes de cerrar:";

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

        {/* IA respuestaDirecta — paridad LTR (post-pregunta, pre-callout) */}
        {aiRespuesta && (
          <p className="font-body text-[14px] md:text-[15px] text-[var(--franco-text)] leading-[1.65] m-0 mb-3 whitespace-pre-wrap">
            {aiRespuesta}
          </p>
        )}

        {/* Alert callout — badge + veredictoFrase IA o fallback hardcoded */}
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
          <p className="font-body text-[13px] md:text-[14px] text-[var(--franco-text)] m-0 leading-[1.5] whitespace-pre-wrap">
            {alertText}
          </p>
        </div>

        {/* Grid 3 DatoCards (motor) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5">
          {datosClave.map((dato, i) => (
            <DatoCard key={i} dato={dato} currency={currency} />
          ))}
        </div>

        {/* IA reencuadre — post-DatoCards, paridad LTR */}
        {aiReencuadre && (
          <p className="font-body text-[14px] md:text-[15px] text-[var(--franco-text)] leading-[1.65] m-0 mb-4 whitespace-pre-wrap">
            {aiReencuadre}
          </p>
        )}

        {/* IA cajaAccionable — StateBox final con label dinámico (paridad LTR) */}
        {aiCaja && (
          <StateBox
            variant="left-border"
            state={isNeutro ? "neutral" : "negative"}
            className="mt-2"
            style={{
              background: isRojo
                ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
                : isNeutro
                  ? "var(--franco-elevated)"
                  : "var(--franco-card)",
              borderRadius: "0 8px 8px 0",
              ...(isNeutro ? { borderLeft: "3px solid var(--franco-text-secondary)" } : {}),
            }}
          >
            {isNeutro ? (
              <p
                className="font-mono uppercase mb-2 m-0"
                style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--franco-text-tertiary)", fontWeight: 600 }}
              >
                {cajaLabel}
              </p>
            ) : (
              <span
                className="font-mono uppercase inline-block px-2.5 py-1 rounded mb-2"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                  color: badgeText,
                  background: badgeBg,
                  border: badgeBorder,
                }}
              >
                {cajaLabel}
              </span>
            )}
            <p className="font-body text-[13px] md:text-[14px] text-[var(--franco-text)] m-0 leading-[1.55] whitespace-pre-wrap">
              {aiCaja}
            </p>
          </StateBox>
        )}

        {/* Franco-diverge-del-motor (skill §1.7) — solo si Franco emite veredicto
            distinto al motor + razón. Patrón 4 sin Signal Red (bloque Ink-only). */}
        {diverge && rationale && (
          <div
            className="mt-4 p-3"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              borderLeft: "3px solid var(--franco-text)",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <p
              className="font-mono uppercase mb-1.5 m-0"
              style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text)", fontWeight: 600 }}
            >
              Franco diverge del motor
            </p>
            <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.55]">
              <span className="font-mono">Motor: {engineSignalNorm}</span>
              {" · "}
              <span className="font-mono font-medium">Franco: {francoVerdictNorm}</span>
            </p>
            <p className="font-body text-[13px] text-[var(--franco-text)] mt-1.5 m-0 leading-[1.55] whitespace-pre-wrap italic">
              {rationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper sobre HeroTopStrip. Actualmente delega 1:1 al componente shared —
 * los tooltips del badge de veredicto los resuelve HeroTopStrip internamente
 * leyendo VERDICT_TOOLTIPS de AIInsightSection (LTR + STR comparten los 3
 * valores base). Si en el futuro se requiere override STR-específico,
 * extender HeroTopStrip con prop `verdictTooltip?: string`.
 */
function HeroTopStripWrapper(props: React.ComponentProps<typeof HeroTopStrip>) {
  return <HeroTopStrip {...props} />;
}
