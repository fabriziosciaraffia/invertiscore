/**
 * Barra horizontal con gradiente Signal Red → Ink 500 → Ink 400 + dot
 * indicador en `score`% + axis labels mono uppercase. Patrón 1 sección 2
 * (skill franco-design-system).
 *
 * Props mínimas (genéricas) — el componente padre maneja el badge de
 * veredicto y el header label "Franco Score".
 */
export function ScoreBarInline({ score }: { score: number | null }) {
  const hasScore = score !== null && Number.isFinite(score);
  const clamped = hasScore ? Math.min(Math.max(score as number, 0), 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      {/* GRADIENT INVARIANT — mismo en los 3 veredictos per skill.
          Cuando score es null (análisis legacy sin FrancoScore), la barra se
          dibuja sin dot indicador. La banda + tonalidad sigue visible para no
          romper el layout. */}
      <div
        className="rounded-[3px] relative"
        style={{
          height: 5,
          background:
            "linear-gradient(90deg, var(--signal-red) 0%, var(--ink-500) 50%, var(--ink-400) 100%)",
          opacity: hasScore ? 1 : 0.35,
        }}
      >
        {hasScore && (
          <div
            className="absolute rounded-full"
            style={{
              width: 11,
              height: 11,
              left: `${clamped}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--franco-text)",
              border: "2px solid var(--franco-bg)",
            }}
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-[7px] text-[var(--franco-text-secondary)] uppercase tracking-[1px]">
        <span>BUSCAR</span>
        <span>AJUSTA</span>
        <span>COMPRAR</span>
      </div>
    </div>
  );
}
