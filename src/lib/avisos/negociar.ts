// ─────────────────────────────────────────────────────────────────────────────
// LOS QUE CONVIENEN SI NEGOCIAS (02-nov-2026, goal «Filtros v2 y negociar», mockup docs/puerta-b-mockups/8-filtros-v2-negociar.html).
// Para cada aviso que la noche da AJUSTAR con un pie (20 % o 30 %, a 30 años, tasa del motor), el descuento mínimo sobre el precio
// publicado con el que llega a COMPRAR: la misma celda del precio recomendado del re-análisis (mix-palancas.ts › explorarCelda) con
// ese pie y ese plazo, meta COMPRAR, bisección de 0,1 punto y redondeo hacia arriba, hasta TOPE_NEGOCIAR_PCT. Se guarda con el
// precio negociado (en UF enteras, como el botón del re-análisis: reanalisis.ts › precioRecomendadoUF) y el puntaje y el flujo a
// ese precio. El precio guardado se verifica: si al redondearlo la sonda no da Comprar, sube de a 0,1 punto.
// Vacío si no llega dentro del tope o si no da Ajustar. LOS BUSCAR OTRO NUNCA ENTRAN: el informe de un Buscar otro apunta su precio
// recomendado a Ajustar, no a Comprar (distancia-veredicto-hallazgo.ts › veredictoObjetivo), y la capa lo contradiría.
// La evaluación del 02-nov-2026 (memoria «negociar-en-explorar-02-nov»): 3,6 ms por aviso en local; ~400 avisos por punto de
// descuento entre 1 y 10 %; al precio negociado quedan en el piso de Comprar (puntaje mediano 70).
// Lo escriben el cron al evaluar (evaluar-avisos) y el relleno de una vez (scripts/rellenar-negociar.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { sondaConPatch } from "@/lib/analysis";
import { avisoDeCandidato, contextoDeFila, type CandidatoGuia } from "@/lib/guia/guia-servidor";
import { payloadDeAviso, respuestasDeAviso } from "./evaluar-aviso";
import { precioRecomendadoUF } from "@/lib/reanalisis";
import { PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { TOPE_NEGOCIAR_PCT } from "./negociar-tope";

/** Hasta cuánto se busca, en % del precio publicado (negociar-tope.ts, sin el motor: lo lee el navegador). Filtros ofrece 5 % y
 *  10 % (portal.ts › TOPES_NEGOCIAR). */
export { TOPE_NEGOCIAR_PCT };
/** Precisión de la bisección, en puntos: la misma del mix. */
const PREC_PTS = 0.1;

/** Lo que se guarda por pie: el descuento (%), el precio negociado (UF enteras) y el puntaje y el flujo a ese precio. */
export interface Negociado {
  d: number;
  p: number;
  s: number | null;
  f: number | null;
}

export interface FilaNegociar {
  negociar_20: Negociado | null;
  negociar_30: Negociado | null;
}
export const NEGOCIAR_VACIO: FilaNegociar = { negociar_20: null, negociar_30: null };

/** El plazo de las columnas de la noche: las que se negocian (con 25 años, otra tasa o renta corta, la capa no existe). */
export const PLAZO_NEGOCIAR = PLAZO_POR_DEFECTO;

/**
 * EL DESCUENTO MÍNIMO A COMPRAR de un aviso con un pie (a PLAZO_NEGOCIAR años, tasa del motor). null si a precio publicado la
 * sonda ya da Comprar (no hay nada que negociar), si no llega ni con el tope o si falta lo que la sonda necesita.
 */
export function negociarCandidato(c: CandidatoGuia, piePct: number, cfg: { uf: number; tasa: number }, asOf: Date = new Date(), tope: number = TOPE_NEGOCIAR_PCT): Negociado | null {
  const ctx = contextoDeFila(c, cfg);
  if (!ctx || !c.arriendo || c.medianaComuna == null) return null;
  const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(c), piePct, cfg.tasa, c.arriendo.monto, { plazo: PLAZO_NEGOCIAR, tasaMercado: cfg.tasa }), ctx) as Record<string, unknown> & { precio: number };
  const precio = Number(body.precio);
  if (!(precio > 0)) return null;
  const sondaEn = (precioUF: number) => sondaConPatch(body as never, cfg.uf, c.medianaComuna as never, asOf, { precio: precioUF } as never);
  const cruza = (d: number) => sondaEn(precio * (1 - d / 100)).veredicto === "COMPRAR";
  if (sondaEn(precio).veredicto === "COMPRAR" || !cruza(tope)) return null;
  let lo = 0, hi = tope;
  while (hi - lo > PREC_PTS) {
    const mid = (lo + hi) / 2;
    if (cruza(mid)) hi = mid;
    else lo = mid;
  }
  // Hacia arriba, como el mix: publica siempre un punto que cruza. Y el precio en UF enteras se verifica.
  let d = Math.min(Math.ceil(hi * 10 - 1e-9) / 10, tope);
  for (;;) {
    const p = precioRecomendadoUF(precio, d);
    const s = sondaEn(p);
    if (s.veredicto === "COMPRAR") {
      return { d, p, s: s.score != null ? Math.round(s.score) : null, f: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null };
    }
    if (d >= tope) return null;
    d = Math.min(Math.round((d + PREC_PTS) * 10) / 10, tope);
  }
}

/** Los dos pies de la noche: solo los que la noche da Ajustar supuestos con ese pie. */
export function evaluarNegociar(c: CandidatoGuia, veredictos: { veredicto_20: string | null; veredicto_30: string | null }, cfg: { uf: number; tasa: number }, asOf: Date = new Date()): FilaNegociar {
  return {
    negociar_20: veredictos.veredicto_20 === "AJUSTA SUPUESTOS" ? negociarCandidato(c, 20, cfg, asOf) : null,
    negociar_30: veredictos.veredicto_30 === "AJUSTA SUPUESTOS" ? negociarCandidato(c, 30, cfg, asOf) : null,
  };
}
