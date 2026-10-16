// ─────────────────────────────────────────────────────────────────────────────
// El estándar de /deptos (16-oct-2026, decisión de Fabrizio): pie 20 % y plazo 25 años, con la tasa de mercado. La
// evaluación de cada noche sigue con su perfil (pie 20 % y 30 %, 30 años: evaluar-aviso.ts › PLAZO_ESTANDAR); esto es el
// MISMO aviso a 25 años, con pie 20 % y 30 %, para que la respuesta al instante de /deptos («de 412 deptos 2D, 9
// convienen con pie 20 % y 25 años») salga de la evaluación de la noche y no de un cálculo en vivo.
//
// Con la SONDA del motor (sondaConPatch) y el contexto que la fila ya resolvió (contextoDeFila): la misma cuenta con que
// el semanal recalcula un candidato con los números de la persona, así lo que /deptos cuenta y lo que el correo manda
// salen de la misma vara. Un Comprar de la sonda es el de runAnalysis (medido el 30-sep-2026 en 450 pares, guia-servidor.ts).
// Lo escriben el cron al evaluar (evaluar-avisos) y el relleno de una vez (scripts/rellenar-estandar-25.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { sondaConPatch } from "@/lib/analysis";
import { avisoDeCandidato, contextoDeFila, type CandidatoGuia } from "@/lib/guia/guia-servidor";
import { payloadDeAviso, respuestasDeAviso, type AvisoParaEvaluar, type FilaEvaluacion } from "./evaluar-aviso";
import { PIES_DEPTOS, PLAZO_DEPTOS } from "@/lib/deptos/estandar";

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

/** Un aviso a 25 años con pie 20 % y 30 %. Sin arriendo o sin la mediana comunal guardada, sin evaluación (null). */
export function evaluarEstandar25(c: CandidatoGuia, cfg: { uf: number; tasa: number }, asOf: Date = new Date()): FilaEstandar25 {
  const ctx = contextoDeFila(c, cfg);
  if (!ctx || !c.arriendo || c.medianaComuna == null) return ESTANDAR25_VACIO;
  const out: Record<string, string | number | null> = {};
  for (const pie of PIES_DEPTOS) {
    const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(c), pie, cfg.tasa, c.arriendo.monto, { plazo: PLAZO_DEPTOS, tasaMercado: cfg.tasa }), ctx);
    const s = sondaConPatch(body as never, cfg.uf, c.medianaComuna as never, asOf, {});
    out[`veredicto_${pie}_25`] = s.veredicto ?? null;
    out[`score_${pie}_25`] = s.score != null ? Math.round(s.score) : null;
    out[`flujo_${pie}_25`] = s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null;
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
