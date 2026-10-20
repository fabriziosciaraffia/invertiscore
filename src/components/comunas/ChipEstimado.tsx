// Chip de "arriendo estimado" para nombrar una cifra que sale del m² comunal y
// no de avisos propios. Misma marca en la tabla de tipologías, la comparativa
// de comunas similares y el bloque del ranking. Ink + tipografía, nunca rojo:
// es una advertencia de calidad de dato, no una alerta.
// Diseño plano (20-oct-2026): la píldora `cm-chip` de comunas.css, en Inter y sin versalitas.

export function ChipEstimado({ texto = "Estimado · m² comunal", className = "" }: { texto?: string; className?: string }) {
  return <span className={`cm-chip ${className}`.trim()}>{texto}</span>;
}
