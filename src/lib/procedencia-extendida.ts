// Procedencia extendida por tipo de hallazgo — builder determinístico (motor, NO IA).
//
// Devuelve 1-2 frases de MÉTODO: de dónde sale el número, con qué insumos y cuánta
// confianza. NO re-narra el hallazgo (eso lo hace fraseCanonica) — aporta transparencia
// de procedencia. Molde: el procedenciaTexto de capex, generalizado a los 6 tipos.
// Voz: analysis-voice-franco §2.1 (tuteo chileno, sin engine-isms A11).
//
// DOS consumidores, mismo insumo (hallazgo.valor/.procedencia — disponible idéntico en
// ambos):
//   (a) los 3 drawers solo-motor (capRate, estructura, capex) en lugar de la fraseCanonica
//       repetida (eco terciario).
//   (b) la corona sin body de la pirámide (llena el aire vertical cuando bodyDuplicado
//       suprime la fraseCanonica).
//
// Direction/branch-aware solo donde el método o la confianza ramifican: plusvalia
// (tieneData) y capex (confianza). Los demás tienen método constante — cambian las
// cifras, no el método.

import type { Hallazgo } from "@/lib/types";

// Formato — espejo de GenericFindingCard (coma decimal chilena, separador de miles punto).
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const intOrPct1 = (n: number) => (Number.isInteger(n) ? String(n) : pct1(n));
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtUF = (n: number) => "UF " + Math.round(n).toLocaleString("es-CL");
const fmtMoneyFromCLP = (clp: number, currency: "CLP" | "UF", valorUF: number) =>
  currency === "UF" ? fmtUF(valorUF > 0 ? clp / valorUF : 0) : fmtCLP(clp);

/**
 * Procedencia extendida (método + insumos + confianza) para un hallazgo del motor.
 * @param currency / valorUF — solo los usan los tipos con monto (flujo, capex).
 */
export function procedenciaExtendida(
  h: Hallazgo,
  currency: "CLP" | "UF",
  valorUF: number,
): string {
  switch (h.id) {
    case "flujo_mensual": {
      const v = h.valor;
      // Mejora futura (Flag B): citar el monto de arriendo requiere agregarlo al `valor`
      // del hallazgo (cambio de motor). Hoy la corona no recibe inputData, así que el
      // texto queda a nivel método (cita el dividendo, no el arriendo).
      const dividendo = fmtMoneyFromCLP(v.dividendoMensualCLP, currency, valorUF);
      return `Sale de tus cifras declaradas, no de una estimación de mercado: al arriendo le restamos el dividendo de ${dividendo} y todos los gastos operativos —contribuciones, gastos comunes, vacancia y mantención—. Por eso la confianza es alta.`;
    }
    case "cap_rate": {
      const v = h.valor;
      const scope = v.scope === "comuna" ? "de la comuna" : "nacional";
      // `fuente` es una cita de origen (a veces con su propio rango %); va como
      // atribución final, no inline antes de capRefPct, para no chocar dos porcentajes.
      return `El cap rate (${pct1(v.capRatePct)}%) es tu renta anual neta de gastos dividida por el precio. Lo comparamos contra un promedio de mercado ${scope} de referencia (${pct1(v.capRefPct)}%), no un dato en tiempo real. Fuente: ${v.fuente}.`;
    }
    case "sobreprecio": {
      const v = h.valor;
      return `Comparamos tu precio por m² (UF ${pct1(v.sujetoUfM2)}) contra la mediana de ${v.n} publicaciones de venta de la comuna (UF ${pct1(v.medianaComunaUfM2)}). Es una mediana de avisos ajustada a un precio de cierre estimado —una referencia, no una tasación—.`;
    }
    case "plusvalia": {
      const v = h.valor;
      if (v.tieneData) {
        return `Es la apreciación real anualizada de la comuna entre 2014 y 2024 (${pct1(v.anualizadaPct)}%), comparada contra un umbral de referencia de ${pct1(v.refPct)}%. Es historia observada, no una proyección: el pasado no garantiza el futuro.`;
      }
      return `La comuna no tiene serie histórica propia, así que usamos un umbral de apreciación real de referencia (${pct1(v.refPct)}%). Es un piso conservador, no una proyección de tu comuna.`;
    }
    case "estructura_financiamiento": {
      const v = h.valor;
      return `Miramos dos palancas de tu financiamiento: el pie (${intOrPct1(v.piePct)}%) contra un óptimo fijo de 25%, y tu tasa (${pct1(v.tasaPct)}%) contra un promedio de mercado de referencia (${pct1(v.tasaMarketPct)}%). La tasa de referencia se actualiza manualmente con el promedio de mercado, no en tiempo real.`;
    }
    case "capex_puesta_a_punto": {
      const v = h.valor;
      switch (h.procedencia.confianza) {
        case "alta":
          return `Sale de la cotización que ingresaste, así que el monto es firme.`;
        case "baja":
          return `Estimación gruesa: no capturamos la antigüedad exacta, así que el monto es un orden de magnitud. Con una cotización real, se ajusta.`;
        default:
          return `Estimado según la antigüedad del depto (${v.antiguedadAnios} años) y su superficie, a unos UF ${pct1(v.ufM2)}/m². Con una cotización real, el número se ajusta.`;
      }
    }
    case "tir": {
      const v = h.valor;
      return `La TIR es la rentabilidad anual de toda la operación: parte de tu inversión inicial (pie, gastos de cierre y puesta a punto), suma o resta tus aportes mensuales año a año, y cierra con la venta proyectada a 10 años neta del saldo del crédito y la comisión. La comparamos contra un mínimo de ${v.umbralPct}% —el piso bajo el cual un deal apalancado rinde menos de lo que justifica su riesgo e iliquidez—, no contra un instrumento puntual.`;
    }
    case "sensibilidad": {
      return `Este margen sale de reevaluar tu inversión bajando el arriendo declarado de a poco —en pasos de medio punto— hasta ver dónde el veredicto dejaría de sostenerse. El arriendo es el número más fácil de cargar optimista al simular, por eso lo estresamos a él y no al resto: si el veredicto aguanta una caída grande, la conclusión no depende de haber achuntado el arriendo al peso; si aguanta poco, confírmalo contra publicaciones reales de la zona antes de decidir.`;
    }
    default: {
      // Exhaustividad: si se agrega un tipo de hallazgo sin procedencia, no rompe el render.
      return "";
    }
  }
}
