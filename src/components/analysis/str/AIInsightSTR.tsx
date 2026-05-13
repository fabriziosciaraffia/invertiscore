"use client";

import { useMemo } from "react";
import type { AIAnalysisSTRv2, STRVerdict } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";

/**
 * AI Insight Section — variante Renta Corta (Patrón 4 del design system).
 *
 * Iteración Commit 2 — 2026-05-11:
 * Esta apertura IA quedó reducida a `siendoFrancoHeadline` + `conviene`
 * (paralelo a cómo el LTR embebe el bloque conviene dentro del Hero).
 *
 * Las secciones rentabilidad / vsLTR / operacion / largoPlazo / riesgos
 * ahora viven dentro de los drawers correspondientes (ver
 * `SubjectCardGridSTR.tsx`). Mover la narrativa Franco a donde el usuario
 * profundiza es el cambio core de Commit 2 — la voz no se pierde en el
 * detalle.
 *
 * Reglas Patrón 4:
 *   • Border-left Ink 100 grueso (3px)
 *   • Background Ink translúcido sutil (~3%)
 *   • Border-radius asimétrico (esquinas izq cuadradas)
 *   • Tag pill "★ INSIGHT GENERADO POR FRANCO IA"
 *   • Cuerpo Sans 14px en CURSIVA (italic) — obligatorio
 */

// ─── Discriminator ────────────────────────────────────────────────
// Commit E.2 · 2026-05-13 — chequeo de `veredicto` (campo único). Análisis IA
// legacy con `engineSignal` y/o `francoVerdict` se aceptan también (compat).
function hasAiSTRv2(ai: unknown): ai is AIAnalysisSTRv2 {
  if (!ai || typeof ai !== "object") return false;
  const a = ai as Record<string, unknown>;
  const hasVerdictField =
    typeof a.veredicto === "string"
    || typeof a.engineSignal === "string"
    || typeof a.francoVerdict === "string";
  return (
    typeof a.siendoFrancoHeadline_clp === "string"
    && typeof a.conviene === "object"
    && a.conviene !== null
    && typeof (a.conviene as Record<string, unknown>).respuestaDirecta === "string"
    && hasVerdictField
  );
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

  return <Container><RenderApertura ai={ai as AIAnalysisSTRv2} /></Container>;
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

// ─── Apertura: headline + conviene ───────────────────────────────
// Las otras 5 secciones (rentabilidad / vsLTR / operacion / largoPlazo /
// riesgos) ahora viven en los drawers — ver SubjectCardGridSTR.tsx.
function RenderApertura({ ai }: { ai: AIAnalysisSTRv2 }) {
  const headline = ai.siendoFrancoHeadline_clp || ai.siendoFrancoHeadline_uf;
  // Commit E.2 · 2026-05-13 — veredicto único. Lee `veredicto` (post-E.2);
  // fallback `francoVerdict` / `engineSignal` para análisis IA cacheados pre-E.2.
  // Cache pre-Commit 1 emitía "VIABLE"/"NO RECOMENDADO" — normalizamos al
  // vocabulario canónico antes de pintar el badge.
  const aiAny = ai as unknown as { veredicto?: string; francoVerdict?: string; engineSignal?: string };
  const rawVerdict = aiAny.veredicto ?? aiAny.francoVerdict ?? aiAny.engineSignal;
  const veredictoNorm = (normalizeLegacyVerdict(rawVerdict) as STRVerdict | null) ?? (rawVerdict as STRVerdict | undefined);

  return (
    <>
      {headline && (
        <h3 className="font-heading font-bold text-[18px] md:text-[20px] text-[var(--franco-text)] m-0 mb-4 leading-[1.3]">
          {headline}
        </h3>
      )}

      {/* Sección 01 — ¿CONVIENE? (apertura, sin numeración 02-06: esas
          viven en drawers).
          Commit E.2 · 2026-05-13: eliminada la caja "Franco diverge del motor".
          La doctrina post-E.2 prohíbe contradecir al motor en el render. */}
      <div className="font-body italic text-[14px] text-[var(--franco-text)] leading-[1.65]">
        <SeccionApertura
          label="¿CONVIENE?"
          pregunta={ai.conviene.pregunta}
          verdictBadge={veredictoNorm}
        >
          <p className="m-0">{ai.conviene.respuestaDirecta}</p>
          {ai.conviene.veredictoFrase && (
            <p className="mt-3 m-0 font-medium">{ai.conviene.veredictoFrase}</p>
          )}
          {ai.conviene.reencuadre && (
            <p className="mt-3 m-0">{ai.conviene.reencuadre}</p>
          )}
          {ai.conviene.cajaAccionable && <CajaAccionable text={ai.conviene.cajaAccionable} />}
        </SeccionApertura>
      </div>
    </>
  );
}

function SeccionApertura({
  label,
  pregunta,
  verdictBadge,
  children,
}: {
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
          {label}
        </p>
        {verdictBadge && (
          <span
            className="font-mono uppercase shrink-0"
            style={{
              fontSize: 9,
              letterSpacing: "0.08em",
              color: "var(--franco-text)",
              fontWeight: verdictBadge === "BUSCAR OTRA" ? 700 : 500,
              background: verdictBadge === "BUSCAR OTRA"
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

function CajaAccionable({ text }: { text: string }) {
  return (
    <div
      className="mt-3 p-3 not-italic"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: "3px solid var(--franco-text-secondary)",
        borderRadius: "0 6px 6px 0",
      }}
    >
      <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.55]">
        {text}
      </p>
    </div>
  );
}
