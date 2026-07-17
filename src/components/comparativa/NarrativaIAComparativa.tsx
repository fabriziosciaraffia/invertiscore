"use client";

import { useEffect, useState } from "react";
import type { AIAnalysisComparativa } from "@/lib/types";

interface Props {
  ltrId: string;
  strId: string;
  cached: AIAnalysisComparativa | null;
}

// ─── Narrativa IA "Cuál te conviene" · Patrón 4 (AI Insight) ────────────
// Render del JSON de /api/analisis/comparativa/ai. Fase C · Plan C: apertura motor
// (fraseCanonica del #1 diferencial) + 3 movimientos IA (quienDeberiasSer, switchPath,
// cierre). La posición de Franco NO va acá (vive en el hero); el cierre es la condición.
// Fallback legacy: prosa v0 sin `apertura` cae a `headline`.
// Cursiva editorial reservada para contenido IA (Patrón 4).
export function NarrativaIAComparativa({ ltrId, strId, cached }: Props) {
  const [ai, setAi] = useState<AIAnalysisComparativa | null>(cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ai) return; // ya hay cache (server-side persistido)
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/analisis/comparativa/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ltrId, strId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<AIAnalysisComparativa>;
      })
      .then((data) => {
        if (!cancelled) {
          setAi(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Error generando análisis");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ai, ltrId, strId]);

  return (
    <div
      className="mb-8 p-6 sm:p-8"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        borderLeft: "3px solid var(--franco-text)",
        border: "0.5px solid var(--franco-border)",
        borderLeftWidth: "3px",
        borderRadius: "0 12px 12px 0",
      }}
    >
      <div
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          border: "0.5px solid var(--franco-border)",
        }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] font-semibold">
          ★ ANÁLISIS GENERADO POR FRANCO IA
        </span>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {ai && !error && (
        <>
          {/* Apertura DETERMINÍSTICA (motor) — fraseCanonica del #1 diferencial.
              Fallback legacy a `headline` (prosa v0). */}
          <p className="font-heading text-[19px] sm:text-[22px] font-bold text-[var(--franco-text)] leading-snug mb-6 italic">
            {ai.apertura ?? ai.headline ?? ""}
          </p>

          <Section
            label="01 · QUIÉN TIENES QUE SER"
            body={ai.conviene.quienDeberiasSer}
          />
          <Section
            label="02 · ¿Y SI MIGRO DESPUÉS?"
            body={ai.conviene.switchPath}
          />
          <Section
            label="03 · SI ESTO SE SOSTIENE"
            body={ai.conviene.cierre}
            isClosing={true}
          />

          {/* Fase C — la sección "balance" (prosa v0) murió: sus cifras viven en la
              pirámide. La posición de Franco vive en el hero; acá el cierre es la
              condición. Prosa v0 sin regenerar renderiza sin `balance` (aceptable). */}
        </>
      )}
    </div>
  );
}

function Section({ label, body, isClosing }: { label: string; body: string; isClosing?: boolean }) {
  return (
    <div className={isClosing ? "mt-6 pt-5 border-t border-[var(--franco-border)]" : "mt-5"}>
      <p
        className="font-mono mb-2 m-0"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: isClosing ? "var(--signal-red)" : "var(--franco-text-secondary)",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        className="font-body text-[14px] text-[var(--franco-text)] m-0 italic"
        style={{ lineHeight: 1.65 }}
      >
        {body}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-8">
      <p className="font-mono text-[11px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-3 inline-flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--signal-red)" }}
        />
        Franco está analizando ambas modalidades
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Comparando rentabilidad, esfuerzo, riesgo y balance patrimonial · ~15 segundos
      </p>
      <div className="mt-4 space-y-2">
        <SkeletonLine width="65%" />
        <SkeletonLine width="92%" />
        <SkeletonLine width="78%" />
      </div>
    </div>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{
        width,
        background: "color-mix(in srgb, var(--franco-text) 6%, transparent)",
      }}
    />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="py-4">
      <p
        className="font-mono uppercase mb-2"
        style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--signal-red)", fontWeight: 600 }}
      >
        ERROR · NARRATIVA NO DISPONIBLE
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        {message}. Los KPIs y la tabla comparativa siguen disponibles arriba.
      </p>
    </div>
  );
}
