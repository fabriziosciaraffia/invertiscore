// Chip de "arriendo estimado" para nombrar una cifra que sale del m² comunal y
// no de avisos propios. Misma marca en la tabla de tipologías, la comparativa
// de comunas similares y el bloque del ranking. Ink + tipografía, nunca rojo:
// es una advertencia de calidad de dato, no una alerta.

export function ChipEstimado({ texto = "Estimado · m² comunal", className = "" }: { texto?: string; className?: string }) {
  return (
    <span
      className={`ml-2 inline-block rounded-full border border-[var(--franco-border)] px-1.5 py-px align-middle font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] ${className}`}
    >
      {texto}
    </span>
  );
}
