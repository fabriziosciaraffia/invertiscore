// Hallazgo tipado de VENTAJA_VS_LTR — el hallazgo ESTRELLA del corto. Motor determinístico
// STR. DECISIVO: 1:1 con la dim `ventaja` del score. Envuelve comparativa.sobreRentaPct /
// sobreRenta (short-term-engine.ts:960-961, sobre NOI: base.noiMensual − ltr_noiMensual) SIN
// recalcular. Diseño congelado en of-e1a-piramide-str.md.
//
// CLÁUSULA obligatoria (aprobación Fabrizio) — estabilizado-vs-contractual: la rama favorable
// SIEMPRE contrasta el upside STR (ocupación PROYECTADA, estabilizada) contra el LTR
// (contrato GARANTIZADO). Nunca presentar la sobre-renta favorable como certeza.
//
// CASO ESPECIAL — LTR negativo: si ltr_noiMensual ≤ 0 el % estalla (denominador cruza 0);
// el KPI va en CLP absoluto y la frase no usa %.

import type { HallazgoVentajaVsLtr } from "./types";

// Borde: bajo +15% de sobre-renta la ventaja no paga el esfuerzo operativo extra del corto
// (recomendacionModalidad usa 0,15 para STR_VENTAJA_CLARA). Banda de magnitud 30 pts.
export const VENTAJA_BORDE_PCT = 15;
export const VENTAJA_BANDA_PTS = 30;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct0 = (n: number) => Math.round(Math.abs(n)).toString();
const fmtAbs = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");

/**
 * Construye el proto-hallazgo de VENTAJA_VS_LTR. `decisividad` la inyecta el assembler (dim
 * ventaja). Devuelve null si la sobre-renta no es computable. Voz: tuteo neutro chileno.
 */
export function buildHallazgoVentajaVsLtr(p: {
  /** Sobre-renta como fracción decimal (comparativa.sobreRentaPct). */
  sobreRentaPct: number;
  /** Sobre-renta absoluta, CLP/mes (comparativa.sobreRenta). */
  sobreRentaCLP: number;
  /** NOI LTR mensual (comparativa.ltr.noiMensual) — detecta denominador ≤ 0. */
  ltrNoiMensual: number;
  /** Decisividad de la dim ventaja (0..1), inyectada por el assembler STR. */
  decisividad: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoVentajaVsLtr | null {
  if (!Number.isFinite(p.sobreRentaCLP)) return null;

  const ltrNegativo = !Number.isFinite(p.ltrNoiMensual) || p.ltrNoiMensual <= 0;
  const pct = Number.isFinite(p.sobreRentaPct) ? p.sobreRentaPct * 100 : 0;
  // Dirección robusta: por CLP cuando el % es ilegible (LTR ≤ 0), por % en el caso normal.
  const direccion: "favorable" | "adverso" = ltrNegativo
    ? (p.sobreRentaCLP >= 0 ? "favorable" : "adverso")
    : (pct >= 0 ? "favorable" : "adverso");
  const magnitudContinua = clamp01(Math.abs(pct) / VENTAJA_BANDA_PTS);
  const acotada = direccion === "favorable" && pct < VENTAJA_BORDE_PCT;

  let titular: string;
  let fraseCanonica: string;
  if (ltrNegativo) {
    titular = direccion === "favorable" ? "En corto pones menos de tu bolsillo que en largo." : "Ni corto ni largo cubren la cuota.";
    fraseCanonica =
      `El arriendo largo tampoco cubre los costos de este depto; en corto pones ${fmtAbs(p.sobreRentaCLP)} ` +
      `${p.sobreRentaCLP >= 0 ? "menos" : "más"} de tu bolsillo al mes. La comparación en porcentaje no dice ` +
      `nada acá porque ninguna de las dos modalidades llega a cubrir la cuota.`;
  } else if (direccion === "adverso") {
    titular = "El arriendo largo te rendiría más.";
    fraseCanonica =
      `Arrendando largo el mismo depto rendirías ${pct0(pct)}% más neto que en corto. Con la ocupación ` +
      `proyectada, el esfuerzo operativo del corto —rotación, gestión, estacionalidad— no se paga; el largo es la mejor jugada acá.`;
  } else if (acotada) {
    titular = "El corto le gana al largo, pero por poco.";
    fraseCanonica =
      `En corto rindes ${pct0(pct)}% más neto que el largo — una ventaja acotada, y compara un corto ` +
      `estabilizado (ocupación proyectada) contra un largo contractual y garantizado. Bajo +15% no alcanza a ` +
      `pagar el esfuerzo operativo extra; si la ocupación proyectada no se cumple, la ventaja se borra.`;
  } else {
    titular = "El corto le saca ventaja clara al arriendo largo.";
    fraseCanonica =
      `En corto rindes ${pct0(pct)}% más neto que arrendando largo el mismo depto —pero esa ventaja compara un ` +
      `corto estabilizado, con la ocupación proyectada, contra un arriendo largo contractual y garantizado. La ` +
      `diferencia justifica el esfuerzo operativo extra —rotación, gestión, estacionalidad—; si la ocupación proyectada no se cumple, se achica.`;
  }

  return {
    id: "ventaja_vs_ltr",
    tipo: "ventaja_vs_ltr",
    valor: {
      sobreRentaPct: Math.round(pct * 10) / 10,
      sobreRentaCLP: Math.round(p.sobreRentaCLP),
      ltrNoiMensual: Math.round(p.ltrNoiMensual),
      ltrNegativo,
      bordePct: VENTAJA_BORDE_PCT,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base: "sobre-renta sobre NOI: corto (escenario base) menos el arriendo largo que declaraste, neto de comisión y gastos",
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
