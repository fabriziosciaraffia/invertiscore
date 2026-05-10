"use client";

import { useMemo } from "react";
import type { AIAnalysisSTRv2, STRVerdict } from "@/lib/types";

/**
 * AI Insight Section — variante Renta Corta (Patrón 4 del design system).
 *
 * Renderiza el JSON IA producido por `/api/analisis/short-term/ai`.
 *
 * Compat: detecta v1 (legacy) vs v2 (Ronda 4d) por shape — análisis pre-4d
 * persistidos en BD siguen renderizando con su shape antiguo. Análisis nuevos
 * usan v2 alineado con doctrina analysis-voice-franco.
 *
 * Reglas Patrón 4:
 *   • Border-left Ink 100 grueso (3px)
 *   • Background Ink translúcido sutil (~3%)
 *   • Border-radius asimétrico (esquinas izq cuadradas)
 *   • Tag pill "★ INSIGHT GENERADO POR FRANCO IA"
 *   • Cuerpo Sans 14px en CURSIVA (italic) — obligatorio
 */

// ─── Tipos legacy v1 (compat) ─────────────────────────────────────
interface AIAnalysisSTRv1Shape {
  textoSimple_clp?: string;
  textoSimple_uf?: string;
  textoImportante_clp?: string;
  textoImportante_uf?: string;
  tuBolsillo?: { titulo: string; contenido_clp: string; contenido_uf: string; alerta_clp?: string; alerta_uf?: string };
  vsAlternativas?: { titulo: string; contenido_clp: string; contenido_uf: string };
  operacion?: { titulo: string; contenido_clp: string; contenido_uf: string };
  proyeccion?: { titulo: string; contenido_clp: string; contenido_uf: string };
  riesgos?: { titulo: string; items_clp?: string[]; items_uf?: string[] };
  veredicto?: { titulo: string; explicacion_clp: string; explicacion_uf: string };
}

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
function pickFieldClpUf(obj: Record<string, unknown> | undefined, base: string, currency: "CLP" | "UF"): string {
  if (!obj) return "";
  const key = base + (currency === "UF" ? "_uf" : "_clp");
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

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
  currency,
  loading,
  error,
}: {
  ai: unknown;
  currency: "CLP" | "UF";
  loading: boolean;
  error: string | null;
}) {
  const shape = useMemo<"v2" | "v1" | "loading" | "empty">(() => {
    if (loading && !ai) return "loading";
    if (!ai || error) return "empty";
    if (hasAiSTRv2(ai)) return "v2";
    return "v1";
  }, [ai, loading, error]);

  if (shape === "loading") {
    return <Container><LoadingState /></Container>;
  }

  if (shape === "empty") {
    return null;
  }

  if (shape === "v2") {
    return <Container><RenderV2 ai={ai as AIAnalysisSTRv2} /></Container>;
  }

  return <Container><RenderV1 ai={ai as AIAnalysisSTRv1Shape} currency={currency} /></Container>;
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

// ─── Render v1 (compat — análisis pre-4d) ────────────────────────
function RenderV1({ ai, currency }: { ai: AIAnalysisSTRv1Shape; currency: "CLP" | "UF" }) {
  const headline = pickFieldClpUf(ai as Record<string, unknown>, "textoImportante", currency)
    || pickFieldClpUf(ai as Record<string, unknown>, "textoSimple", currency);

  return (
    <>
      {headline && (
        <h3 className="font-heading font-bold text-[18px] md:text-[20px] text-[var(--franco-text)] m-0 mb-4 leading-[1.3]">
          {headline}
        </h3>
      )}
      <div className="font-body italic text-[14px] text-[var(--franco-text)] leading-[1.65] space-y-5">
        {ai.tuBolsillo && (
          <SectionV1
            label="TU BOLSILLO"
            title={ai.tuBolsillo.titulo}
            content={pickFieldClpUf(ai.tuBolsillo as Record<string, unknown>, "contenido", currency)}
            alert={pickFieldClpUf(ai.tuBolsillo as Record<string, unknown>, "alerta", currency)}
          />
        )}
        {ai.vsAlternativas && (
          <SectionV1
            label="STR vs LTR"
            title={ai.vsAlternativas.titulo}
            content={pickFieldClpUf(ai.vsAlternativas as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {ai.operacion && (
          <SectionV1
            label="OPERACIÓN"
            title={ai.operacion.titulo}
            content={pickFieldClpUf(ai.operacion as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {ai.proyeccion && (
          <SectionV1
            label="PROYECCIÓN"
            title={ai.proyeccion.titulo}
            content={pickFieldClpUf(ai.proyeccion as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {ai.riesgos && (
          <RiesgosBlockV1
            label="RIESGOS"
            title={ai.riesgos.titulo}
            items={
              currency === "UF"
                ? ai.riesgos.items_uf ?? []
                : ai.riesgos.items_clp ?? []
            }
          />
        )}
        {ai.veredicto && (
          <SectionV1
            label="VEREDICTO"
            title={ai.veredicto.titulo}
            content={pickFieldClpUf(ai.veredicto as Record<string, unknown>, "explicacion", currency)}
          />
        )}
      </div>
    </>
  );
}

function SectionV1({ label, title, content, alert }: { label: string; title: string; content: string; alert?: string }) {
  return (
    <div>
      <p
        className="font-mono uppercase not-italic mb-1.5"
        style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
      >
        {label}
      </p>
      {title && (
        <h4 className="font-heading font-bold not-italic text-[15px] text-[var(--franco-text)] m-0 mb-2">
          {title}
        </h4>
      )}
      <div>{renderParagraphs(content)}</div>
      {alert && (
        <div
          className="mt-3 p-3 not-italic"
          style={{
            borderLeft: "3px solid var(--franco-text-secondary)",
            background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            borderRadius: "0 6px 6px 0",
          }}
        >
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.5]">{alert}</p>
        </div>
      )}
    </div>
  );
}

function RiesgosBlockV1({ label, title, items }: { label: string; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p
        className="font-mono uppercase not-italic mb-1.5"
        style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
      >
        {label}
      </p>
      {title && (
        <h4 className="font-heading font-bold not-italic text-[15px] text-[var(--franco-text)] m-0 mb-2">
          {title}
        </h4>
      )}
      <ul className="list-none p-0 m-0 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono not-italic text-[var(--franco-text-tertiary)] shrink-0" style={{ fontSize: 11, paddingTop: 2 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{renderParagraphs(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
