/**
 * Tag mono uppercase "🔄 Simulación" (Patrón 7 visual marker). Move verbatim
 * desde results-client.tsx LTR (Ronda 4a.1). Hoy sin usages activos en LTR —
 * preservada para reuso futuro en Advanced Section.
 */
export function SimulationTag() {
  return (
    <span
      className="font-mono uppercase whitespace-nowrap"
      style={{
        fontSize: 9,
        letterSpacing: "1.2px",
        padding: "3px 8px",
        borderRadius: 3,
        background: "color-mix(in srgb, var(--franco-text) 12%, transparent)",
        color: "var(--franco-text)",
        border: "0.5px solid color-mix(in srgb, var(--franco-text) 25%, transparent)",
        fontWeight: 600,
      }}
    >
      🔄 Simulación
    </span>
  );
}
