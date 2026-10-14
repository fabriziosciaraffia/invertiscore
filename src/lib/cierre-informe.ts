// ─────────────────────────────────────────────────────────────────────────────
// El final del informe (01-oct-2026, decisión de Fabrizio): UNA acción. Salieron «Un análisis no
// decide — compara» (NextAnalysisCTA), «Tu wallet» (WalletStatusCTA), el banner Pro y el «Analizar
// otra propiedad» suelto. Queda una línea discreta: «Te quedan 2 análisis.» con «Analizar otro depto»;
// sin análisis, solo «Analizar otro depto» con el precio. La vista de comparar vive en el dashboard.
//
// Cuál es la acción, en orden: el ticket del pack (primer informe anónimo) · la banda del crédito de
// bienvenida (recién usado) · esta línea. Nunca dos. Lo fija el tier CIERRE-INFORME.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtCLP, SINGLE_PRICE } from "@/lib/pricing";

export const ENLACE_CIERRE = "Analizar otro depto";

/** El ancho de la columna del informe (`.doc-dictamen .doc-page--secciones{max-width:700px}` en
 *  PortadaInforme): la línea del final se alinea con ella, no con el borde de la página. */
export const ANCHO_COLUMNA_INFORME = 700;

export interface TextoCierre {
  /** «Te quedan 2 análisis.» · null cuando no hay saldo que decir. */
  saldo: string | null;
  /** El texto del enlace: «Analizar otro depto», con el precio si no le quedan análisis. */
  enlace: string;
}

/**
 * `analisis`: los que le quedan (ledger + bienvenida sin usar). Con sesión y en cero, el enlace lleva el
 * precio. Sin sesión, o con el plan Ilimitado (no paga por análisis), el enlace va solo. Solo el Ilimitado
 * (14-oct-2026): el plan 10 y el plan 50 descuentan de sus lotes, así que en cero ven el precio como cualquiera.
 */
export function textoCierre(p: { analisis: number; conSesion: boolean; ilimitado: boolean }): TextoCierre {
  const n = Math.max(0, Math.floor(p.analisis));
  if (n > 0) return { saldo: n === 1 ? "Te queda 1 análisis." : `Te quedan ${n} análisis.`, enlace: ENLACE_CIERRE };
  if (p.conSesion && !p.ilimitado) return { saldo: null, enlace: `${ENLACE_CIERRE} · ${fmtCLP(SINGLE_PRICE)}` };
  return { saldo: null, enlace: ENLACE_CIERRE };
}
