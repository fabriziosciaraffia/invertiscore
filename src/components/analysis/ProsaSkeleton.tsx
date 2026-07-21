/**
 * ProsaSkeleton — placeholder de carga de la prosa IA.
 *
 * Componente ÚNICO compartido por las superficies de resultados con slot de prosa
 * inline (STR · Comparativa). No se duplica por superficie. El copy "Franco está
 * completando el análisis…" permanece visible junto al shimmer: animación + texto
 * se complementan (decisión Fabrizio). El dot Signal Red pulsante es el uso de
 * loading activo del sistema (Patrón 6 · única excepción donde rojo no es "negativo").
 *
 * Nota LTR: la página LTR usa el Loading Editorial full-page (Patrón 6 stepper),
 * un paradigma distinto — no consume este skeleton.
 */

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
