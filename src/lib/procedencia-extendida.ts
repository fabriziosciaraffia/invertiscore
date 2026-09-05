// Procedencia extendida por tipo de hallazgo — builder determinístico (motor, NO IA).
//
// Devuelve la línea de FUENTE del hallazgo (fuente · fecha · alcance). Hasta T4 del
// rediseño (02-sep-2026) devolvía 1-2 frases de método y confianza; eso se movió al
// modal "Cómo se calcula" y acá queda solo la cita.
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
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { fuenteHistoricaPlusvalia } from "@/lib/plusvalia-procedencia";

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, nunca literal.
const PROYECCION_FRANCO_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;


/**
 * Procedencia extendida (método + insumos + confianza) para un hallazgo del motor.
 * @param currency / valorUF — solo los usan los tipos con monto (flujo, capex).
 */
/**
 * Línea de FUENTE de un hallazgo — regla transversal del contrato CONGELADO
 * (02-sep-2026, T4): la VFuente cita fuente, fecha y alcance. No cuenta el método
 * ni la confianza — eso vive en el modal "Cómo se calcula". Máximo dos líneas.
 * La consumen los drawers LTR y STR (mismo texto en las dos superficies) y la
 * corona de la pirámide.
 * @param currency / valorUF — conservados por firma; hoy ningún tipo los usa.
 */
export function procedenciaExtendida(
  h: Hallazgo,
  currency: "CLP" | "UF",
  valorUF: number,
): string {
  void currency;
  void valorUF;
  switch (h.id) {
    case "flujo_mensual":
      return "Motor Franco · flujo mensual del análisis";
    case "cap_rate": {
      const v = h.valor;
      const scope = v.scope === "comuna" ? "referencia de la comuna" : "referencia nacional";
      return `${v.fuente} · ${scope}`;
    }
    case "sobreprecio": {
      const v = h.valor;
      const universo = v.universo === "nuevo" ? " nuevos" : v.universo === "usado" ? " usados" : "";
      const donde = v.comuna ? ` en ${v.comuna}` : " de la comuna";
      return `Mediana de ${v.n} publicaciones de venta de departamentos${universo}${donde} · avisos, no transacciones`;
    }
    case "plusvalia": {
      const v = h.valor;
      // `v.fuente` ya trae período y atribución de ESTA comuna (builder); antes se le pegaba
      // "· 2014-2024" encima, aunque la serie fuera GfK 2015-2025.
      if (v.tieneData) return v.fuente && !/umbral/i.test(v.fuente) ? v.fuente : fuenteHistoricaPlusvalia(null, true);
      return `${fuenteHistoricaPlusvalia(null, false)} · la comuna no tiene serie propia`;
    }
    case "estructura_financiamiento":
      return "Tasa de referencia: promedio de mercado en UF · Motor Franco, actualización manual";
    case "capex_puesta_a_punto":
      switch (h.procedencia.confianza) {
        case "alta":
          return "Cotización ingresada por ti";
        case "baja":
          return "Estimación Motor Franco · sin antigüedad exacta";
        default:
          return "Estimación Motor Franco · por antigüedad y superficie";
      }
    case "tir":
      return "Motor Franco · escenario de venta a 10 años";
    case "sensibilidad":
      return "Motor Franco · reevaluación del veredicto sobre el arriendo";
    case "patrimonio":
      return `Motor Franco · escenario de venta a 10 años · plusvalía proyectada ${PROYECCION_FRANCO_PCT} anual`;
    default:
      return "";
  }
}
