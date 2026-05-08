"use client";

import { useMemo } from "react";

/**
 * AI Insight Section — variante Renta Corta (Patrón 4 del design system).
 *
 * Consume el shape AIAnalysisSTR legacy actual (textoSimple/textoImportante/sinFiltro
 * + 8 secciones). El refactor a doctrina canónica analysis-voice-franco
 * (siendoFrancoHeadline + 7 secciones tipo LTR) viene en Ronda 4d.
 *
 * Reglas Patrón 4:
 *   • Border-left Ink 100 grueso (3px)
 *   • Background Ink translúcido sutil (~3%)
 *   • Border-radius asimétrico (esquinas izq cuadradas)
 *   • Tag pill "★ INSIGHT GENERADO POR FRANCO IA"
 *   • Cuerpo Sans 14px en CURSIVA (italic) — obligatorio
 */

interface AIAnalysisSTRMin {
  textoSimple_clp?: string;
  textoSimple_uf?: string;
  textoImportante_clp?: string;
  textoImportante_uf?: string;
  // Secciones legacy STR
  tuBolsillo?: { titulo: string; contenido_clp: string; contenido_uf: string; alerta_clp?: string; alerta_uf?: string };
  vsAlternativas?: { titulo: string; contenido_clp: string; contenido_uf: string };
  operacion?: { titulo: string; contenido_clp: string; contenido_uf: string };
  proyeccion?: { titulo: string; contenido_clp: string; contenido_uf: string };
  riesgos?: { titulo: string; items_clp?: string[]; items_uf?: string[] };
  veredicto?: { titulo: string; explicacion_clp: string; explicacion_uf: string };
}

function pickField(obj: Record<string, unknown> | undefined, base: string, currency: "CLP" | "UF"): string {
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

export function AIInsightSTR({
  ai,
  currency,
  loading,
  error,
}: {
  ai: AIAnalysisSTRMin | null | undefined;
  currency: "CLP" | "UF";
  loading: boolean;
  error: string | null;
}) {
  const headline = useMemo(() => {
    if (!ai) return "";
    return pickField(ai as Record<string, unknown>, "textoImportante", currency)
      || pickField(ai as Record<string, unknown>, "textoSimple", currency);
  }, [ai, currency]);

  if (loading && !ai) {
    return (
      <div
        className="p-5 md:p-6"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          borderLeft: "3px solid var(--franco-text)",
          borderRadius: "0 14px 14px 0",
        }}
      >
        <p className="font-mono uppercase mb-3" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)", fontWeight: 600 }}>
          ★ INSIGHT GENERADO POR FRANCO IA
        </p>
        <p className="font-body italic text-[14px] text-[var(--franco-text-secondary)] leading-[1.65] m-0">
          Franco está analizando tu operación de renta corta…
        </p>
      </div>
    );
  }

  if (error || !ai) {
    return null;
  }

  const tuBolsillo = ai.tuBolsillo;
  const vsAlt = ai.vsAlternativas;
  const operacion = ai.operacion;
  const proyeccion = ai.proyeccion;
  const veredicto = ai.veredicto;

  return (
    <div
      className="p-5 md:p-7"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: "3px solid var(--franco-text)",
        borderRadius: "0 14px 14px 0",
      }}
    >
      {/* Tag pill */}
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

      {headline && (
        <h3 className="font-heading font-bold text-[18px] md:text-[20px] text-[var(--franco-text)] m-0 mb-4 leading-[1.3]">
          {headline}
        </h3>
      )}

      {/* Sub-secciones — todas en italic per Patrón 4 */}
      <div className="font-body italic text-[14px] text-[var(--franco-text)] leading-[1.65] space-y-5">
        {tuBolsillo && (
          <Section
            label="TU BOLSILLO"
            title={tuBolsillo.titulo}
            content={pickField(tuBolsillo as Record<string, unknown>, "contenido", currency)}
            alert={pickField(tuBolsillo as Record<string, unknown>, "alerta", currency)}
          />
        )}
        {vsAlt && (
          <Section
            label="STR vs LTR"
            title={vsAlt.titulo}
            content={pickField(vsAlt as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {operacion && (
          <Section
            label="OPERACIÓN"
            title={operacion.titulo}
            content={pickField(operacion as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {proyeccion && (
          <Section
            label="PROYECCIÓN"
            title={proyeccion.titulo}
            content={pickField(proyeccion as Record<string, unknown>, "contenido", currency)}
          />
        )}
        {ai.riesgos && (
          <RiesgosBlock
            label="RIESGOS"
            title={ai.riesgos.titulo}
            items={
              currency === "UF"
                ? ai.riesgos.items_uf ?? []
                : ai.riesgos.items_clp ?? []
            }
          />
        )}
        {veredicto && (
          <Section
            label="VEREDICTO"
            title={veredicto.titulo}
            content={pickField(veredicto as Record<string, unknown>, "explicacion", currency)}
          />
        )}
      </div>
    </div>
  );
}

function Section({ label, title, content, alert }: { label: string; title: string; content: string; alert?: string }) {
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
            borderLeft: "3px solid var(--signal-red)",
            background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            borderRadius: "0 6px 6px 0",
          }}
        >
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.5]">
            {alert}
          </p>
        </div>
      )}
    </div>
  );
}

function RiesgosBlock({ label, title, items }: { label: string; title: string; items: string[] }) {
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
