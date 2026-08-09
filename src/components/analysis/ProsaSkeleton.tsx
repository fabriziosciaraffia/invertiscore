"use client";

/**
 * ProsaSkeleton — placeholder de carga de la prosa IA.
 *
 * Componente ÚNICO compartido por las superficies de resultados con slot de prosa
 * inline (STR · Comparativa · LTR desde Goal C). No se duplica por superficie. El
 * copy "Franco está completando el análisis…" permanece visible junto al shimmer:
 * animación + texto se complementan (decisión Fabrizio). El dot Signal Red
 * pulsante es el uso de loading activo del sistema (Patrón 6 · única excepción
 * donde rojo no es "negativo").
 *
 * ProsaGenerando (Goal C) — variante VIVA para la espera larga del LTR (la
 * generación toma 1-3 minutos): mensajes progresivos honestos que describen las
 * etapas reales del trabajo, sin prometer tiempos. Temporizador ciego (mismo
 * patrón que LoadingEditorial): los triggers aproximan el ritmo real de las
 * etapas, no lo miden. El último mensaje queda fijo hasta que llegue la prosa.
 */

import { useEffect, useState } from "react";

export function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{ width, background: "color-mix(in srgb, var(--franco-text) 6%, transparent)" }}
    />
  );
}

export function ProsaSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] flex items-center gap-2 m-0 mb-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal-red animate-pulse shrink-0" aria-hidden />
        Franco está completando el análisis…
      </p>
      <SkeletonLine width="70%" />
      <SkeletonLine width="94%" />
      <SkeletonLine width="85%" />
      <div className="pt-2" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="76%" />
    </div>
  );
}

// Mensajes honestos: describen las etapas reales del pipeline (lectura de datos,
// contraste con la zona, redacción, guards de calidad) en voz Franco — tuteo
// neutro, sin prometer tiempos, sin exponer maquinaria interna. El último cubre
// la cola larga (regeneraciones de calidad) y queda fijo.
const MENSAJES_GENERANDO = [
  "Franco está revisando los números de este análisis…",
  "Contrastando precio y arriendo contra la zona…",
  "Redactando el veredicto y las palancas de negociación…",
  "Puliendo la redacción final — ya casi está…",
];
const MENSAJE_TRIGGERS_MS = [0, 10000, 30000, 75000];

export function ProsaGenerando() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timers = MENSAJE_TRIGGERS_MS.slice(1).map((ms, i) => setTimeout(() => setIdx(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-2 py-1">
      <p
        key={idx}
        className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] flex items-center gap-2 m-0 mb-1"
        style={{ animation: "prosaMsgIn 420ms ease-out" }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal-red shrink-0" style={{ animation: "prosaDotPulse 1.4s ease-in-out infinite" }} aria-hidden />
        {MENSAJES_GENERANDO[idx]}
      </p>
      <SkeletonLine width="70%" />
      <SkeletonLine width="94%" />
      <SkeletonLine width="85%" />
      <div className="pt-2" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="76%" />
      <style>{`
        @keyframes prosaMsgIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes prosaDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="prosaMsgIn"], [style*="prosaDotPulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
