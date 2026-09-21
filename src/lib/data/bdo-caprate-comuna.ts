// Cap rate NETO por comuna del mercado multifamily, publicado por BDO Chile. Entra al repo como
// DATO CITABLE y como cruce del benchmark propio de avisos (capref-comuna.ts); no es el benchmark.
//
// Fuente: BDO Auditores & Consultores, «Reporte N° 52 · Mercado de renta residencial
// multifamily · 4T 2025» (publicado feb-2026), página 5, gráfico «Multifamily y cap rate neto
// por comuna». Serie «Cap Rate Neto (%)». El neto de BDO es ingresos menos costos —«NOI del 80%
// más la vacancia»—, sobre edificios completos valuados a mercado: activos NUEVOS, unidades
// chicas (41,5 m² promedio), operación institucional. Promedio del reporte: neto 2,98%, bruto
// 3,72%.
//
// ALINEACIÓN CONFIRMADA A OJO (21-sep-2026) sobre la página renderizada: el gráfico trae 22
// comunas, y la etiqueta «Ñuñoa» no sale en el texto del PDF (está como trazado), así que la
// primera reconstrucción por texto —21 etiquetas para 22 valores— leyó el 3,0% de Santiago como
// «promedio» y corrió todas las demás una posición. Esta tabla es la del gráfico, valor por
// barra, de izquierda a derecha.
import { normalizeComuna } from "@/lib/comuna-stats";

export const BDO_CAPRATE_COMUNA = {
  fuente: "BDO Chile",
  reporte: "Reporte N° 52 · Mercado de renta residencial multifamily · 4T 2025",
  publicado: "2026-02",
  url: "https://www.bdo.cl/getmedia/63dc8a77-d558-428b-99a1-d1985bbf02d5/BDO-MULTIFAMILY-52_compressed.pdf",
  /** Lo que mide la serie: cap rate NETO (NOI menos vacancia) de edificios multifamily. */
  base: "neta" as const,
  promedioNetoPct: 2.98,
  promedioBrutoPct: 3.72,
  /** Neto por comuna, en %, en el orden del gráfico. Claves en la forma canónica de
   *  `scraped_properties` («Santiago», no «Santiago Centro»). */
  netoPorComuna: {
    "Santiago": 3.0,
    "Estación Central": 3.5,
    "La Florida": 3.4,
    "Independencia": 3.5,
    "Ñuñoa": 3.4,
    "San Miguel": 3.5,
    "La Cisterna": 3.4,
    "Las Condes": 3.9,
    "Quinta Normal": 2.8,
    "Providencia": 3.5,
    "Macul": 3.3,
    "Cerrillos": 3.2,
    "San Joaquín": 3.5,
    "Recoleta": 2.8,
    "Lo Barnechea": 4.7,
    "Conchalí": 3.2,
    "Renca": 3.8,
    "Huechuraba": 3.1,
    "Vitacura": 3.1,
    "La Reina": 3.2,
    "Puente Alto": 3.4,
    "Maipú": 2.8,
  } as Record<string, number>,
};

/** La cita corta que va en la fuente del informe. */
export const BDO_CITA_CORTA = "BDO, Reporte 52 multifamily, 4T-2025";

/** Cap rate neto de BDO para la comuna (alias resueltos por `normalizeComuna`), o null si el
 *  reporte no la cubre. */
export function bdoCapRateNetoComuna(comuna: string): number | null {
  const v = BDO_CAPRATE_COMUNA.netoPorComuna[normalizeComuna(comuna)];
  return typeof v === "number" && v > 0 ? v : null;
}
