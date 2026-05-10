"use client";

import { useMemo } from "react";
import type { AIAnalysisSTRv2, STRVerdict } from "@/lib/types";

/**
 * AI Insight Section — variante Renta Corta (Patrón 4 del design system).
 *
 * Renderiza el JSON IA producido por `/api/analisis/short-term/ai`.
 *
 * Reglas Patrón 4:
 *   • Border-left Ink 100 grueso (3px)
 *   • Background Ink translúcido sutil (~3%)
 *   • Border-radius asimétrico (esquinas izq cuadradas)
 *   • Tag pill "★ INSIGHT GENERADO POR FRANCO IA"
 *   • Cuerpo Sans 14px en CURSIVA (italic) — obligatorio
 */

// ─── Discriminator ────────────────────────────────────────────────
function hasAiSTRv2(ai: unknown): ai is AIAnalysisSTRv2 {
  if (!ai || typeof ai !== "object") return false;
  const a = ai as Record<string, unknown>;
  return (
    typeof a.siendoFrancoHeadline_clp === "string"
    && typeof a.conviene === "object"
    && a.conviene !== null
    && typeof (a.conviene as Record<string, unknown>).respuestaDirecta === "string"
    && typeof a.engineSignal === "string"
    && typeof a.francoVerdict === "string"
  );
}

// ─── Helpers de render ────────────────────────────────────────────
function renderParagraphs(text: string) {
  if (!text) return null;
  return text.split(/\n\n+/).map((parrafo, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {parrafo.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j} className="font-medium">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </p>
  ));
}

// ─── Componente principal ─────────────────────────────────────────
export function AIInsightSTR({
  ai,
  loading,
  error,
}: {
  ai: unknown;
  loading: boolean;
  error: string | null;
}) {
  const shape = useMemo<"v2" | "loading" | "empty">(() => {
    if (loading && !ai) return "loading";
    if (!ai || error || !hasAiSTRv2(ai)) return "empty";
    return "v2";
  }, [ai, loading, error]);

  if (shape === "loading") {
    return <Container><LoadingState /></Container>;
  }

  if (shape === "empty") {
    return null;
  }

  return <Container><RenderV2 ai={ai as AIAnalysisSTRv2} /></Container>;
}

// ─── Container Patrón 4 ───────────────────────────────────────────
function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-5 md:p-7"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: "3px solid var(--franco-text)",
        borderRadius: "0 14px 14px 0",
      }}
    >
      <p
        className="inline-flex items-center font-mono uppercase mb-3"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "var(--franco-text)",
          fontWeight: 600,
          background: "color-mix(in srgb, var(--franco-text) 6%, transparent)",
          padding: "4px 10px",
          borderRadius: 4,
        }}
      >
        ★ INSIGHT GENERADO POR FRANCO IA
      </p>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <p className="font-body italic text-[14px] text-[var(--franco-text-secondary)] leading-[1.65] m-0">
      Franco está analizando tu operación de renta corta…
    </p>
  );
}

// ─── Render v2 (canónico Ronda 4d) ───────────────────────────────
function RenderV2({ ai }: { ai: AIAnalysisSTRv2 }) {
  const headline = ai.siendoFrancoHeadline_clp || ai.siendoFrancoHeadline_uf;
  const verdictDiverge = ai.francoVerdict !== ai.engineSignal;

  return (
    <>
      {headline && (
        <h3 className="font-heading font-bold text-[18px] md:text-[20px] text-[var(--franco-text)] m-0 mb-4 leading-[1.3]">
          {headline}
        </h3>
      )}

      {/* Veredicto Franco — explícito si diverge del motor.
          Patrón 4 prohíbe Signal Red en AI Insight: bloque va Ink-only. */}
      {verdictDiverge && ai.francoVerdictRationale && (
        <div
          className="mb-5 p-4 not-italic"
          style={{
            background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            borderLeft: "3px solid var(--franco-text)",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <p className="font-mono uppercase mb-1.5" style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text)", fontWeight: 500 }}>
            FRANCO DIVERGE DEL MOTOR
          </p>
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.55]">
            <span className="font-mono">Motor: {ai.engineSignal}</span> &nbsp;·&nbsp;{" "}
            <span className="font-mono font-medium">Franco: {ai.francoVerdict}</span>
          </p>
          <p className="font-body italic text-[13px] text-[var(--franco-text)] mt-2 m-0 leading-[1.55]">
            {ai.francoVerdictRationale}
          </p>
        </div>
      )}

      {/* 6 secciones doctrina canónica — todas en italic per Patrón 4 */}
      <div className="font-body italic text-[14px] text-[var(--franco-text)] leading-[1.65] space-y-5">
        <SectionV2 numero="01" label="¿CONVIENE?" pregunta={ai.conviene.pregunta} verdictBadge={ai.francoVerdict}>
          <p className="m-0">{ai.conviene.respuestaDirecta}</p>
          {ai.conviene.veredictoFrase && (
            <p className="mt-3 m-0 font-medium">{ai.conviene.veredictoFrase}</p>
          )}
          {ai.conviene.reencuadre && (
            <p className="mt-3 m-0">{ai.conviene.reencuadre}</p>
          )}
          {ai.conviene.cajaAccionable && <CajaAccionable text={ai.conviene.cajaAccionable} />}
        </SectionV2>

        <SectionV2 numero="02" label="RENTABILIDAD" pregunta={ai.rentabilidad.pregunta}>
          <p className="m-0">{ai.rentabilidad.contenido}</p>
          {ai.rentabilidad.cajaAccionable && <CajaAccionable text={ai.rentabilidad.cajaAccionable} />}
        </SectionV2>

        <SectionV2 numero="03" label="vs ARRIENDO LARGO" pregunta={ai.vsLTR.pregunta}>
          <p className="m-0">{ai.vsLTR.contenido}</p>
          {ai.vsLTR.estrategiaSugerida && (
            <p className="mt-3 m-0 font-medium text-[14px]" style={{ color: "var(--franco-text)" }}>
              {ai.vsLTR.estrategiaSugerida}
            </p>
          )}
          {ai.vsLTR.cajaAccionable && <CajaAccionable text={ai.vsLTR.cajaAccionable} />}
        </SectionV2>

        <SectionV2 numero="04" label="OPERACIÓN" pregunta={ai.operacion.pregunta}>
          <p className="m-0">{ai.operacion.contenido}</p>
          {ai.operacion.cajaAccionable && <CajaAccionable text={ai.operacion.cajaAccionable} />}
        </SectionV2>

        <SectionV2 numero="05" label="LARGO PLAZO" pregunta={ai.largoPlazo.pregunta}>
          <p className="m-0">{ai.largoPlazo.contenido}</p>
          {ai.largoPlazo.cajaAccionable && <CajaAccionable text={ai.largoPlazo.cajaAccionable} />}
        </SectionV2>

        <SectionV2 numero="06" label="RIESGOS" pregunta={ai.riesgos.pregunta}>
          {renderParagraphs(ai.riesgos.contenido)}
          {ai.riesgos.cajaAccionable && <CajaAccionable text={ai.riesgos.cajaAccionable} variant="strong" />}
        </SectionV2>
      </div>
    </>
  );
}

function SectionV2({
  numero,
  label,
  pregunta,
  verdictBadge,
  children,
}: {
  numero: string;
  label: string;
  pregunta: string;
  verdictBadge?: STRVerdict;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5 not-italic">
        <p
          className="font-mono uppercase m-0"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
        >
          {numero} · {label}
        </p>
        {verdictBadge && (
          <span
            className="font-mono uppercase shrink-0"
            style={{
              fontSize: 9,
              letterSpacing: "0.08em",
              color: "var(--franco-text)",
              fontWeight: verdictBadge === "NO RECOMENDADO" ? 700 : 500,
              background: verdictBadge === "NO RECOMENDADO"
                ? "color-mix(in srgb, var(--franco-text) 12%, transparent)"
                : "color-mix(in srgb, var(--franco-text) 6%, transparent)",
              padding: "2px 8px",
              borderRadius: 3,
            }}
          >
            {verdictBadge}
          </span>
        )}
      </div>
      {pregunta && (
        <h4 className="font-heading font-bold not-italic text-[15px] text-[var(--franco-text)] m-0 mb-2 leading-[1.3]">
          {pregunta}
        </h4>
      )}
      <div>{children}</div>
    </div>
  );
}

function CajaAccionable({ text, variant = "soft" }: { text: string; variant?: "soft" | "strong" }) {
  const isStrong = variant === "strong";
  return (
    <div
      className="mt-3 p-3 not-italic"
      style={{
        background: isStrong
          ? "color-mix(in srgb, var(--franco-text) 6%, transparent)"
          : "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: `3px solid ${isStrong ? "var(--franco-text)" : "var(--franco-text-secondary)"}`,
        borderRadius: "0 6px 6px 0",
      }}
    >
      <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.55]">
        {text}
      </p>
    </div>
  );
}

