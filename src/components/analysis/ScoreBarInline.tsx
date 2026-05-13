/**
 * Barra horizontal con 3 segmentos discretos + dot indicador en `score`% +
 * axis labels mono uppercase. Patrón 1 sección 2 (skill franco-design-system).
 *
 * Commit E.1 · 2026-05-13 — Barras de 3 bandas que matchean exactamente los
 * thresholds de veredicto:
 *   0-44   → Signal Red    → BUSCAR OTRA
 *   45-69  → Ink medio     → AJUSTA SUPUESTOS
 *   70-100 → Ink fuerte    → COMPRAR
 *
 * Reemplaza el gradiente continuo previo. Coherencia visual: la posición del
 * dot revela inequívocamente la banda de veredicto.
 */
export function ScoreBarInline({ score }: { score: number | null }) {
  const hasScore = score !== null && Number.isFinite(score);
  const clamped = hasScore ? Math.min(Math.max(score as number, 0), 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="rounded-[3px] relative"
        style={{
          height: 5,
          background:
            "linear-gradient(90deg," +
            " var(--signal-red) 0% 45%," +
            " var(--ink-500) 45% 70%," +
            " var(--franco-text) 70% 100%" +
            ")",
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

/**
 * Sub-texto "zona <interpretativa> · banda <veredicto>" que va debajo de la
 * ScoreBarInline en el Hero. Da contexto verbal a la posición del dot.
 * Commit E.1 · 2026-05-13.
 */
export function ScoreBarBandLabel({
  score,
  veredicto,
}: {
  score: number | null;
  veredicto: string;
}) {
  if (score === null || !Number.isFinite(score)) return null;
  const zona =
    score >= 80 ? "sólida" :
      score >= 65 ? "buena" :
        score >= 50 ? "regular" :
          score >= 30 ? "débil" : "evitar";
  return (
    <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mt-1.5">
      zona <span className="text-[var(--franco-text)]">{zona}</span>
      <span className="px-1.5 opacity-40">·</span>
      banda <span className="text-[var(--franco-text)]">{veredicto}</span>
    </p>
  );
}
