/**
 * Barra horizontal con gradiente Signal Red → Ink 500 → Ink 400 + dot
 * indicador en `score`% + axis labels mono uppercase. Patrón 1 sección 2
 * (skill franco-design-system §1.3.1).
 *
 * Extraída del bloque inline de HeroTopStrip para la unificación con la
 * versión STR (`ScoreBarInlineSTR`). Move estructural en Ronda 4a.3.
 *
 * Props mínimas (genéricas) — el componente padre maneja el badge de
 * veredicto y el header label "Franco Score".
 */
export function ScoreBarInline({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100);
  return (
    <div className="flex flex-col gap-1">
      {/* GRADIENT INVARIANT — mismo en los 3 veredictos per skill */}
      <div
        className="rounded-[3px] relative"
        style={{
          height: 5,
          background:
            "linear-gradient(90deg, var(--signal-red) 0%, var(--ink-500) 50%, var(--ink-400) 100%)",
        }}
      >
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
      </div>
      <div className="flex justify-between font-mono text-[7px] text-[var(--franco-text-secondary)] uppercase tracking-[1px]">
        <span>BUSCAR</span>
        <span>AJUSTA</span>
        <span>COMPRAR</span>
      </div>
    </div>
  );
}
