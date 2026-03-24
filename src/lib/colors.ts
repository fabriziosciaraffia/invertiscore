export const FRANCO_COLORS = {
  positive: '#B0BEC5',
  warning: '#FBBF24',
  negative: '#C8323C',
  neutral: '#71717A',
  base: '#FAFAF8',
} as const;

export function getScoreColor(value: number): string {
  if (value >= 70) return FRANCO_COLORS.positive;
  if (value >= 40) return FRANCO_COLORS.warning;
  return FRANCO_COLORS.negative;
}

export function getVerdictColor(verdict: 'COMPRAR' | 'AJUSTA EL PRECIO' | 'BUSCAR OTRA'): string {
  switch (verdict) {
    case 'COMPRAR': return FRANCO_COLORS.positive;
    case 'AJUSTA EL PRECIO': return FRANCO_COLORS.warning;
    case 'BUSCAR OTRA': return FRANCO_COLORS.negative;
  }
}

export function getVerdictLabel(score: number): 'COMPRAR' | 'AJUSTA EL PRECIO' | 'BUSCAR OTRA' {
  if (score >= 70) return 'COMPRAR';
  if (score >= 40) return 'AJUSTA EL PRECIO';
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
