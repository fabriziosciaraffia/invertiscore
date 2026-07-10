// Hallazgo tipado de SENSIBILIDAD_STR (robustez del veredicto) — motor determinístico STR.
// SOLO-LECTURA: decisividad 0 fija (meta-dato del conjunto, sin driver único). Usa el ATAJO
// determinístico breakEvenPctDelMercado (short-term-engine.ts:272) en vez de la bisección-occ
// (ambos aprobados en of-e1a). Mide cuánto del nivel de mercado necesitas facturar para no
// perder plata: >100% = necesitas rendir sobre la zona típica (frágil).
//
// Cortes 100/110 alineados a los gates STR: Gate-2 capa COMPRAR con beRatio>1,10 y Gate-1
// fuerza BUSCAR con beRatio>1,30 (short-term-score.ts). Dirección binaria: adverso solo en
// la banda frágil (>110%); holgado (<100) y borde [100,110] son favorables.

import type { HallazgoSensibilidadStr } from "./types";

export const BE_STR_CORTE_FAVORABLE = 100; // ≤100% del mercado ⇒ holgado
export const BE_STR_CORTE_FRAGIL = 110;    // >110% ⇒ frágil (adverso), alineado a Gate-2
export const BE_STR_BANDA_PTS = 25;        // normalización de magnitudContinua

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct0 = (n: number) => Math.round(n).toString();

/**
 * Construye el proto-hallazgo de SENSIBILIDAD_STR. SOLO-LECTURA (decisividad 0). Devuelve
 * null si el break-even no es computable. Voz: tuteo neutro chileno.
 */
export function buildHallazgoSensibilidadStr(p: {
  /** Break-even como fracción del revenue de mercado (breakEvenPctDelMercado; 1,0 = al nivel). */
  breakEvenPctDelMercado: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoSensibilidadStr | null {
  if (!Number.isFinite(p.breakEvenPctDelMercado)) return null;

  // Redondeo de display ANTES de decidir dirección/banda: KPI (Math.round(be)) y dirección
  // deben coincidir siempre (evita el borde float 1,10*100=110,0000001 > 110 → adverso).
  const be = Math.round(p.breakEvenPctDelMercado * 100);
  const fragil = be > BE_STR_CORTE_FRAGIL;
  const holgado = be < BE_STR_CORTE_FAVORABLE;
  const direccion: "favorable" | "adverso" = fragil ? "adverso" : "favorable";
  const magnitudContinua = clamp01(Math.abs(be - BE_STR_CORTE_FRAGIL) / BE_STR_BANDA_PTS);
  const beFmt = pct0(be);

  let titular: string;
  let fraseCanonica: string;
  if (fragil) {
    titular = "El veredicto se sostiene solo si la ocupación se cumple.";
    fraseCanonica =
      `Para no perder plata necesitas facturar el ${beFmt}% del nivel de mercado — sobre lo que rinde la zona ` +
      `típica. Es un margen apretado: si la ocupación o el ADR vienen algo abajo, el corto deja de cuadrar. ` +
      `Confírmalos contra listings comparables activos antes de comprar.`;
  } else if (holgado) {
    titular = "El veredicto aguanta aunque rindas bajo la zona.";
    fraseCanonica =
      `Tu punto de equilibrio está en el ${beFmt}% del nivel de mercado: cuadras facturando por debajo de lo ` +
      `que rinde la zona típica. Hay colchón si la ocupación o el ADR vienen algo más bajos de lo asumido.`;
  } else {
    titular = "El veredicto cuadra justo al nivel de la zona.";
    fraseCanonica =
      `Tu punto de equilibrio está en el ${beFmt}% del nivel de mercado — justo en el borde. Cuadras si la zona ` +
      `rinde lo típico, pero sin colchón para un mal trimestre de ocupación o ADR.`;
  }

  return {
    id: "sensibilidad_str",
    tipo: "robustez_veredicto_str",
    valor: {
      beRatioPct: be,
      corteFavorable: BE_STR_CORTE_FAVORABLE,
      corteFragil: BE_STR_CORTE_FRAGIL,
      banda: BE_STR_BANDA_PTS,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: 0, // SOLO-LECTURA
    magnitudContinua,
    procedencia: {
      base: "break-even como % de los ingresos brutos de mercado de la zona; recálculo determinístico sobre tus costos y la cuota",
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
