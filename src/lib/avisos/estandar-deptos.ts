// ─────────────────────────────────────────────────────────────────────────────
// LAS COLUMNAS DE 25 AÑOS (16-oct-2026; hasta el 30-oct-2026 fueron el estándar de /deptos, que pasó a 30 años con todo el
// sitio: deptos/estandar.ts › PLAZO_POR_DEFECTO). Pie 20 % y 30 %, plazo 25 años, con la tasa de mercado. La
// evaluación de cada noche sigue con su perfil (pie 20 % y 30 %, 30 años: evaluar-aviso.ts › PLAZO_ESTANDAR); esto es el
// MISMO aviso a 25 años, con pie 20 % y 30 %, para que la opción de 25 años de Filtros salga de la evaluación de la noche y no
// de un cálculo en vivo (hasta el 30-oct-2026 también salía de acá la respuesta al instante de /deptos).
//
// Con la SONDA del motor (sondaConPatch) y el contexto que la fila ya resolvió (contextoDeFila): la misma cuenta con que
// el semanal recalcula un candidato con los números de la persona, así lo que /deptos cuenta y lo que el correo manda
// salen de la misma vara. Un Comprar de la sonda es el de runAnalysis (medido el 30-sep-2026 en 450 pares, guia-servidor.ts).
// Lo escriben el cron al evaluar (evaluar-avisos) y el relleno de una vez (scripts/rellenar-estandar-25.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { sondaConPatch } from "@/lib/analysis";
import { avisoDeCandidato, contextoDeFila, type CandidatoGuia } from "@/lib/guia/guia-servidor";
import { payloadDeAviso, respuestasDeAviso, type AvisoParaEvaluar, type FilaEvaluacion } from "./evaluar-aviso";
import { PIES_DEPTOS, PLAZO_COLUMNAS_25 } from "@/lib/deptos/estandar";

export { PIE_DEPTOS, PIES_DEPTOS, PLAZO_DEPTOS } from "@/lib/deptos/estandar";

export interface FilaEstandar25 {
  veredicto_20_25: string | null;
  score_20_25: number | null;
  flujo_20_25: number | null;
  veredicto_30_25: string | null;
  score_30_25: number | null;
  flujo_30_25: number | null;
}

export const ESTANDAR25_VACIO: FilaEstandar25 = {
  veredicto_20_25: null, score_20_25: null, flujo_20_25: null, veredicto_30_25: null, score_30_25: null, flujo_30_25: null,
};

/** Lo que la sonda dice de un aviso con un pie y un plazo: el veredicto, el puntaje, el flujo y la cuota. */
export interface SondaDeAviso {
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
  cuota: number | null;
}

/**
 * UN AVISO CON CUALQUIER PIE Y PLAZO (23-oct-2026, el «Cambiar» del pop-up de Explorar): la misma sonda y el mismo
 * contexto de la fila con que la noche lo evaluó y con que el semanal lo recalcula, con la tasa de mercado. null sin
 * arriendo o sin la mediana comunal guardada (no se consulta nada en vivo).
 */
/** `combo.tasa` (30-oct-2026): la tasa elegida para el crédito; sin ella, la del motor (`cfg.tasa`). La «de mercado» sigue
 *  siendo la del motor: es contra la que el informe compara. */
export function sondaDeCandidato(c: CandidatoGuia, combo: { piePct: number; plazoAnios: number; tasa?: number | null }, cfg: { uf: number; tasa: number }, asOf: Date = new Date()): SondaDeAviso | null {
  const ctx = contextoDeFila(c, cfg);
  if (!ctx || !c.arriendo || c.medianaComuna == null) return null;
  const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(c), combo.piePct, combo.tasa ?? cfg.tasa, c.arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }), ctx);
  const s = sondaConPatch(body as never, cfg.uf, c.medianaComuna as never, asOf, {});
  return {
    veredicto: s.veredicto ?? null,
    score: s.score != null ? Math.round(s.score) : null,
    flujo: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null,
    cuota: s.metricas?.cuotaMensual != null ? Math.round(s.metricas.cuotaMensual) : null,
  };
}

/** Un aviso a 25 años con pie 20 % y 30 %. Sin arriendo o sin la mediana comunal guardada, sin evaluación (null). */
export function evaluarEstandar25(c: CandidatoGuia, cfg: { uf: number; tasa: number }, asOf: Date = new Date()): FilaEstandar25 {
  const out: Record<string, string | number | null> = {};
  for (const pie of PIES_DEPTOS) {
    const s = sondaDeCandidato(c, { piePct: pie, plazoAnios: PLAZO_COLUMNAS_25 }, cfg, asOf);
    if (!s) return ESTANDAR25_VACIO;
    out[`veredicto_${pie}_25`] = s.veredicto;
    out[`score_${pie}_25`] = s.score;
    out[`flujo_${pie}_25`] = s.flujo;
  }
  return out as unknown as FilaEstandar25;
}

/** El aviso recién evaluado por el cron como candidato (lo que la fila resolvió), para evaluarlo a 25 años. */
export function candidatoDeEvaluacion(a: AvisoParaEvaluar, f: Pick<FilaEvaluacion, "precio_uf" | "antiguedad_anios" | "antiguedad_origen" | "arriendo" | "venta" | "gastos_comunes" | "mediana_comuna">): CandidatoGuia {
  return {
    avisoId: a.id, distanciaM: 0, comuna: a.comuna, lat: a.lat, lng: a.lng, m2: a.m2, dormitorios: a.dormitorios,
    banos: a.banos || 1, condicion: a.condicion, direccion: a.direccion, fechaEntrega: a.fechaEntrega, url: null,
    precioUF: f.precio_uf, antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
    antiguedadOrigen: f.antiguedad_origen, arriendo: f.arriendo, venta: f.venta, gastosComunes: f.gastos_comunes,
    medianaComuna: f.mediana_comuna ?? null,
  };
}
