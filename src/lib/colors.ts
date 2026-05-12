// Capa 1 binaria (franco-design-system): Ink + Signal Red exclusivamente.
// Antes `warning` era amber (#FBBF24) y `positive` teal en light mode. Ambos
// migrados a Ink en Commit 1 · 2026-05-11 — el warning es ahora Ink 500
// (mismo gris secundario que el tipo neutral; la diferencia entre estados se
// expresa por jerarquía tipográfica + label, no por color).
export const FRANCO_COLORS = {
  positive: '#B0BEC5',  // Ink 400 — neutral OK por Capa 1
  warning: '#888780',   // Ink 500 — antes amber #FBBF24 (prohibido)
  negative: '#C8323C',  // Signal Red — uso #1 (criticidad)
  neutral: '#71717A',   // Ink intermedio
  base: '#FAFAF8',      // Ink 100
} as const;

export function getScoreColor(value: number): string {
  if (value >= 70) return FRANCO_COLORS.positive;
  if (value >= 40) return FRANCO_COLORS.warning;
  return FRANCO_COLORS.negative;
}

// Commit 1 · 2026-05-11: vocabulario unificado COMPRAR/AJUSTA SUPUESTOS/BUSCAR OTRA.
export function getVerdictColor(verdict: 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA'): string {
  switch (verdict) {
    case 'COMPRAR': return FRANCO_COLORS.positive;
    case 'AJUSTA SUPUESTOS': return FRANCO_COLORS.warning;
    case 'BUSCAR OTRA': return FRANCO_COLORS.negative;
  }
}

export function getVerdictLabel(score: number): 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA' {
  if (score >= 70) return 'COMPRAR';
  if (score >= 40) return 'AJUSTA SUPUESTOS';
  return 'BUSCAR OTRA';
}

export function getFlowColor(value: number): string {
  return value >= 0 ? FRANCO_COLORS.positive : FRANCO_COLORS.negative;
}

export function getRentabilityColor(value: number, zoneAverage: number): string {
  if (zoneAverage === 0) return FRANCO_COLORS.base;
  const ratio = value / zoneAverage;
  if (ratio >= 1.1) return FRANCO_COLORS.positive;
  if (ratio >= 0.9) return FRANCO_COLORS.neutral;
  return FRANCO_COLORS.negative;
}

export function getCapRateColor(value: number, zoneAverage: number): string {
  return value >= zoneAverage ? FRANCO_COLORS.positive : FRANCO_COLORS.negative;
}

export function getStateBg(color: string, opacity: '08' | '15' = '15'): string {
  return color + opacity;
}

export function getStateBorder(color: string, opacity: '30' | '35' = '35'): string {
  return color + opacity;
}
