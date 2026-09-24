// ─────────────────────────────────────────────────────────────────────────────
// «CÓMO LO PAGAS» — el modelo del capítulo (LTR III / STR IV), puro y compartido.
//
// Contrato: docs/wireframes/rediseno-informe/capitulo-como-lo-pagas.html (aprobado el
// 21-sep-2026). Tres bloques, en este orden:
//   1 · Caro o barato — la franja de cuartiles de la comuna con dos pines: tu precio y el
//       recomendado. Es lo que ubica todo lo demás.
//   2 · Cómo llegar al precio recomendado — el ancla es el mix de la card §5 (lo que
//       Franco recomienda: pie, plazo y descuento juntos, hacia COMPRAR), y de ahí cuelgan
//       cuatro pasos: qué pides · con qué · hasta dónde · si no cede. «Con qué» dice CUÁL
//       negociación te toca: el mercado (el vendedor pide más que la comuna) o tu caja
//       (el depto ya está bajo la mediana y lo que pides es lo que a ti te cierra).
//   3 · Puesta a punto — la razón antes del monto.
//
// EL PRECIO ANCLA ES EL RECOMENDADO, leído de `mixAComprar`. Nunca del escalón
// (`mixPalancas` en BUSCAR OTRA): esa caída fue el bug del 13-sep en el pop-up y el que
// el mockup reintrodujo el 21-sep. Lo caza `scripts/eval/golden/como-lo-pagas-catch-test.ts`.
//
// Lo que este capítulo YA NO dice (decisión 21-sep): el dial de precio, los cuatro
// precios sueltos, la primera oferta a −5% (sin fuente), el financiamiento (pie, cuota,
// tasa vs referencia, matriz pie × plazo: viven en el hero, el cap. II y el pop-up) y la
// línea del interés total (cola del pop-up: cola-popup-interes-total-del-credito).
//
// Este módulo no formatea moneda ni renderiza: emite números y segmentos de texto
// (`Seg`, con negrita opcional) que el componente pinta. Sin React, sin fetch.
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto, HallazgoPuestaAPunto, HallazgoSobreprecio, PosicionEnComuna, Veredicto } from "./types";
import { recomendacionFranco } from "./mix-a-comprar";
import { bandaDeDescuento, type BandaDescuento } from "./banda-esfuerzo";
import { etiquetaVeredicto } from "./veredicto-etiqueta";

/** Un tramo de texto; `b` = negrita. El componente los pinta, este módulo no. */
export interface Seg {
  t: string;
  b?: boolean;
}

export type CasoPagas =
  /** El veredicto ya es COMPRAR: no hay descuento que pedir; se muestra el margen. */
  | "comprar"
  /** El mix cruza sin pedirle un peso al vendedor: mueve lo tuyo y listo. */
  | "sin_descuento"
  /** El vendedor pide más que la comuna y aun con el descuento queda en o sobre la mediana. */
  | "mercado"
  /** El vendedor pide más que la comuna, pero lo que pides queda BAJO la mediana: el
   *  mercado te lleva hasta la mediana; de ahí para abajo, tu caja. */
  | "mercado_hasta_mediana"
  /** El depto ya está bajo la mediana: el argumento es tu caja, no el mercado. */
  | "caja"
  /** Banda difícil y el depto ya barato para la comuna: sin comparable que lo sostenga. */
  | "dificil_sin_evidencia"
  /** No hay precio recomendado: ninguna combinación llega a COMPRAR. */
  | "sin_salida";

export interface RecomendacionPagas {
  precioUF: number;
  /** Descuento sobre el precio de hoy, en %. 0 en `sin_descuento`. */
  descuentoPct: number;
  /** `mix` = la combinación de la card; `precio_solo` = solo el precio cruza (el mix es
   *  redundante con esa palanca y la card no lo dibuja). */
  via: "mix" | "precio_solo";
  pieDe: number;
  pieA: number;
  plazoDe: number;
  plazoA: number;
  destino: Veredicto;
  costoDiaUnoUF: number;
  descuentoSoloPrecioPct: number | null;
  banda: BandaDescuento;
}

export interface FranjaPagas {
  sujetoUfM2: number;
  medianaUfM2: number;
  p25UfM2: number | null;
  p75UfM2: number | null;
  posicion: PosicionEnComuna | null;
  /** El precio recomendado en UF/m², para el segundo pin. null sin recomendación. */
  recUfM2: number | null;
  desviacionPct: number;
  n: number;
  universo?: "nuevo" | "usado";
}

export interface PasoPagas {
  k: string;
  segs: Seg[];
}

export interface CapexPagas {
  montoUF: number;
  montoCLP: number;
  montoMinUF: number | null;
  montoMaxUF: number | null;
  ufM2: number;
  fraccionPct: number;
  antiguedadAnios: number;
  superficieUtilM2: number;
  intro: Seg[];
}

export interface ModeloComoLoPagas {
  modalidad: "LTR" | "STR";
  caso: CasoPagas;
  precioUF: number;
  rec: RecomendacionPagas | null;
  /** null cuando no hay mediana confiable (n < 15): el bloque 1 no se dibuja. */
  franja: FranjaPagas | null;
  /** La oración del bloque 1 (propuesta por cuartil; sin cuartiles, la desviación). */
  fraseFranja: Seg[] | null;
  /** La nota del ⓘ de la franja: de qué está hecha la muestra. */
  notaFranja: string | null;
  tituloBloque2: string;
  pasos: PasoPagas[];
  /** En `sin_salida`: lo que haría falta, fuera de rango. */
  fueraDeRango: { palanca: "precio" | "arriendo" | "adr"; deltaPct: number } | null;
  capex: CapexPagas | null;
}

export interface EntradaComoLoPagas {
  modalidad: "LTR" | "STR";
  veredicto: string;
  precioUF: number;
  superficieM2: number;
  comuna: string;
  piePctActual: number;
  plazoActual: number;
  /** null en COMPRAR (el motor no lo emite ahí). */
  distancia: HallazgoDistanciaVeredicto["valor"] | null;
  sobre: HallazgoSobreprecio | null;
  /** «Sobre esto no compensa»: el precio donde la TIR a 10 años cae al límite. */
  limiteTirUF: number | null;
  /** «Donde el mes cierra»: el precio donde el flujo mensual queda en cero. */
  mesCierraUF: number | null;
  /** COMPRAR: hasta qué precio sigue siendo Comprar, y a qué cae si pagas más. */
  precioMaximoComprarUF?: number | null;
  caeA?: Veredicto | null;
  /** La línea de la alternativa de comunas (LTR). STR: null hasta que el motor la calcule. */
  alternativa: string | null;
  capex: HallazgoPuestaAPunto["valor"] | null;
  /** UF→CLP del análisis, para las cifras en pesos de la copia. */
  valorUF: number;
}

// ── formato mínimo de la copia (la moneda del toggle la pone el componente) ──
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const UF = (n: number) => `UF ${miles(n)}`;
const CLP = (n: number) => `$${miles(n)}`;
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const uf1 = (n: number) => `UF ${n.toFixed(1).replace(".", ",")}`;
const ver = (v: Veredicto | string) => etiquetaVeredicto(v, "frase", String(v));

export const POSICION_TEXTO: Record<PosicionEnComuna, string> = {
  sobre_p75: "en el cuarto más caro de tu comuna",
  mediana_p75: "en la mitad central de tu comuna, del lado caro",
  p25_mediana: "en la mitad central de tu comuna, del lado barato",
  bajo_p25: "en el cuarto más barato de tu comuna",
};

/** Cortes de la banda de esfuerzo, en palabras del lector (el pop-up tiene los suyos). */
export const BANDA_PAGAS: Record<BandaDescuento, string> = {
  factible: "negociación factible — lo que se conversa en cualquier compraventa",
  con_argumentos: "alcanzable con argumentos — exigente, pero dentro de lo que se negocia cuando hay razones",
  dificil: "difícil — solo si el vendedor necesita vender",
};

/**
 * LA RECOMENDACIÓN, de la misma fuente que la card §5 y el pop-up.
 *
 * Orden: el mix que la card dibuja → si es redundante con la palanca sola de precio, esa
 * palanca (es lo que la card muestra como línea principal) → si no, no hay recomendación.
 * `mixAComprar` no cae al escalón: en BUSCAR OTRA sin `mixPalancasHastaComprar` la
 * respuesta es null, no `mixPalancas`.
 */
export function recomendacionPagas(e: Pick<EntradaComoLoPagas, "veredicto" | "precioUF" | "piePctActual" | "plazoActual" | "distancia">): RecomendacionPagas | null {
  if (e.veredicto === "COMPRAR" || !e.distancia) return null;
  const dv = e.distancia;
  // LA MISMA RECOMENDACIÓN QUE LA CARD Y QUE LA CELDA «FRANCO» DEL POP-UP (24-sep-2026):
  // `recomendacionFranco` es la fuente única. Hasta hoy acá se saltaba el mix cuando era
  // redundante con la palanca de precio; ya no, porque la card dejó de mostrar la palanca.
  const rec = recomendacionFranco(dv);
  if (rec?.via === "mix") {
    const mix = rec.mix;
    const d = mix.sinDescuento ? 0 : Math.max(0, mix.descuentoPct);
    return {
      precioUF: e.precioUF * (1 - d / 100),
      descuentoPct: d,
      via: "mix",
      pieDe: mix.piePct - mix.piePctDelta,
      pieA: mix.piePct,
      plazoDe: mix.plazoAnios - mix.plazoAniosDelta,
      plazoA: mix.plazoAnios,
      destino: (mix.destino ?? dv.veredictoObjetivo) as Veredicto,
      costoDiaUnoUF: mix.costoDiaUnoUF,
      descuentoSoloPrecioPct: mix.descuentoSoloPrecioPct,
      banda: bandaDeDescuento(d),
    };
  }
  if (rec?.via === "precio_solo") {
    const solo = rec.palanca;
    const d = Math.abs(solo.deltaPct);
    return {
      precioUF: solo.objetivo,
      descuentoPct: d,
      via: "precio_solo",
      pieDe: e.piePctActual,
      pieA: e.piePctActual,
      plazoDe: e.plazoActual,
      plazoA: e.plazoActual,
      destino: "COMPRAR",
      costoDiaUnoUF: 0,
      descuentoSoloPrecioPct: null,
      banda: bandaDeDescuento(d),
    };
  }
  return null;
}

/** El caso, a partir de la recomendación y la evidencia de la comuna. */
export function casoPagas(p: {
  veredicto: string;
  rec: RecomendacionPagas | null;
  sobre: HallazgoSobreprecio | null;
  recVsMedianaPct: number | null;
}): CasoPagas {
  if (p.veredicto === "COMPRAR") return "comprar";
  if (!p.rec) return "sin_salida";
  if (p.rec.descuentoPct <= 0) return "sin_descuento";
  const adverso = p.sobre?.direccion === "adverso";
  if (adverso) return p.recVsMedianaPct != null && p.recVsMedianaPct >= -2 ? "mercado" : "mercado_hasta_mediana";
  if (p.rec.banda === "dificil") return "dificil_sin_evidencia";
  return "caja";
}

function franjaDe(e: EntradaComoLoPagas, rec: RecomendacionPagas | null): FranjaPagas | null {
  const s = e.sobre?.valor;
  if (!s || !(s.medianaComunaUfM2 > 0) || !(s.sujetoUfM2 > 0)) return null;
  return {
    sujetoUfM2: s.sujetoUfM2,
    medianaUfM2: s.medianaComunaUfM2,
    p25UfM2: s.p25UfM2 ?? null,
    p75UfM2: s.p75UfM2 ?? null,
    posicion: s.posicion ?? null,
    recUfM2: rec && e.superficieM2 > 0 ? rec.precioUF / e.superficieM2 : null,
    desviacionPct: s.desviacionPct,
    n: s.n,
    ...(s.universo ? { universo: s.universo } : {}),
  };
}

/** La oración del bloque 1. Con cuartiles, por posición; sin ellos, la desviación. */
export function fraseFranja(f: FranjaPagas): Seg[] {
  if (f.posicion && f.p25UfM2 != null && f.p75UfM2 != null) {
    return [
      { t: "Tu precio por m² está " },
      { t: POSICION_TEXTO[f.posicion], b: true },
      { t: `: ${uf1(f.sujetoUfM2)} contra una mediana de ${uf1(f.medianaUfM2)}, y la mitad de los avisos comparables va de ${uf1(f.p25UfM2)} a ${uf1(f.p75UfM2)}.` },
    ];
  }
  const d = Math.abs(f.desviacionPct);
  if (d <= 2) return [{ t: `Tu precio por m² (${uf1(f.sujetoUfM2)}) está en línea con la mediana de la comuna (${uf1(f.medianaUfM2)}).` }];
  return [
    { t: `Tu precio por m² (${uf1(f.sujetoUfM2)}) está ` },
    { t: `${d}% ${f.desviacionPct > 0 ? "sobre" : "bajo"}`, b: true },
    { t: ` la mediana de la comuna (${uf1(f.medianaUfM2)}).` },
  ];
}

/** La nota del ⓘ: de qué está hecha la muestra. Avisos, no transacciones — es lo único de
 *  las tres notas al pie que evitaba una mala lectura, y por eso sobrevive acá. */
export function notaFranja(f: FranjaPagas, comuna: string): string {
  const univ = f.universo ? ` de departamentos ${f.universo === "nuevo" ? "nuevos" : "usados"}` : "";
  return `Mediana de ${miles(f.n)} publicaciones de venta${univ} en ${comuna || "la comuna"} · superficie ±20% y misma tipología · últimos 90 días · precios pedidos en avisos, no de transacciones`;
}

/** El paso «Hasta dónde». Redacción fijada por Fabrizio el 21-sep-2026. */
export function pasoHastaDonde(p: { limiteTirUF: number | null; mesCierraUF: number | null; precioUF: number; sinSalida?: boolean }): PasoPagas | null {
  const segs: Seg[] = [];
  if (p.limiteTirUF != null && p.limiteTirUF > 0 && !p.sinSalida) {
    segs.push({ t: "Sobre " }, { t: UF(p.limiteTirUF), b: true }, { t: " la TIR a 10 años baja del 6%: ahí conviene más otro tipo de inversión. " });
  }
  if (p.mesCierraUF != null && p.mesCierraUF > 0 && p.precioUF > 0) {
    const bajo = Math.round((1 - p.mesCierraUF / p.precioUF) * 100);
    segs.push(
      { t: `${segs.length ? "Y el" : "El"} flujo mensual es positivo recién en ` },
      { t: UF(p.mesCierraUF), b: true },
      { t: p.sinSalida ? `, ${bajo}% bajo tu precio: no es una oferta, es la medida del problema.` : `, ${bajo}% bajo tu precio — no es el número a pelear, es el marco.` },
    );
  }
  return segs.length ? { k: "Hasta dónde", segs } : null;
}

function pasoSiNoCede(e: EntradaComoLoPagas, obligatorio: boolean): PasoPagas | null {
  if (e.alternativa) return { k: "Si no cede", segs: [{ t: e.alternativa, b: true }] };
  if (!obligatorio) return null;
  if (e.modalidad === "STR") {
    return { k: "Si no cede", segs: [{ t: "En renta corta el motor todavía no calcula comunas alternativas: si el vendedor no cede, la otra vía es la tarifa y la ocupación del capítulo III." }] };
  }
  return { k: "Si no cede", segs: [{ t: "Sin comuna alternativa que cruce para este depto: si el vendedor no cede, la respuesta honesta es mirar otro." }] };
}

function conQue(e: EntradaComoLoPagas, caso: CasoPagas, rec: RecomendacionPagas, f: FranjaPagas | null, recVsMed: number | null): Seg[] {
  if (!f) {
    return [
      { t: "Sin mediana de la comuna que lo respalde. ", b: true },
      { t: `Lo que pides es el número al que a ti te cierra${rec.pieA !== rec.pieDe ? `, poniendo ${pct1(rec.pieA).replace(",0", "")}% de pie` : ""}: dilo así, no como si el mercado lo dijera.` },
    ];
  }
  const n = miles(f.n);
  const desv = Math.abs(f.desviacionPct);
  const univ = f.universo ? ` de ${f.universo === "nuevo" ? "nuevos" : "usados"}` : "";
  if (caso === "mercado") {
    const arriba = recVsMed ?? 0;
    return [
      { t: "Tu argumento es el mercado. ", b: true },
      { t: `El vendedor pide ` },
      { t: `${desv}% más`, b: true },
      { t: ` que la mediana de ${n} avisos comparables${univ} en ${e.comuna || "la comuna"}. ` },
      ...(arriba > 2
        ? [{ t: `Aun cerrando en ${UF(rec.precioUF)} sigue ` }, { t: `${Math.round(arriba)}% arriba`, b: true }, { t: " de esa mediana: le pides que baje a un precio que todavía es alto para la comuna. Ese dato va en la mesa." }]
        : [{ t: `Cerrando en ${UF(rec.precioUF)} quedas ` }, { t: "en la mediana", b: true }, { t: " de la comuna: no le pides más que lo que el mercado ya dice. Ese dato va en la mesa." }]),
    ];
  }
  if (caso === "mercado_hasta_mediana") {
    const medUF = f.medianaUfM2 * e.superficieM2;
    return [
      { t: "Tu argumento es el mercado hasta la mediana; de ahí para abajo, tu caja. ", b: true },
      { t: "El vendedor pide " },
      { t: `${desv}% más`, b: true },
      { t: ` que la mediana de ${n} avisos comparables${univ}: eso lo lleva hasta ` },
      { t: UF(medUF), b: true },
      { t: `, y es el dato que va en la mesa. Lo que pides queda ${Math.abs(Math.round(recVsMed ?? 0))}% más abajo todavía, y ese tramo no lo respalda la comuna: es el número al que a ti te cierra${rec.pieA !== rec.pieDe ? `, poniendo ${pct1(rec.pieA).replace(",0", "")}% de pie` : ""}.${rec.banda === "dificil" ? " Y es difícil: cierra solo con un vendedor que necesita vender." : ""}` },
    ];
  }
  if (caso === "dificil_sin_evidencia") {
    return [
      { t: "No hay argumento de mercado. ", b: true },
      { t: `El depto ya está ` },
      { t: `${desv}% bajo`, b: true },
      { t: ` la mediana de ${n} avisos comparables${univ} y pides ` },
      { t: `${pct1(rec.descuentoPct)}% más`, b: true },
      { t: `: lo que pides queda ${Math.abs(Math.round(recVsMed ?? 0))}% bajo la comuna. Esto cierra solo con un vendedor que necesita vender. Si no cede, la respuesta honesta es mirar otro, no forzar este.` },
    ];
  }
  // caja
  return [
    { t: "Tu argumento es tu caja, no el mercado. ", b: true },
    { t: `El depto ya está ` },
    { t: `${desv}% bajo`, b: true },
    { t: ` la mediana de ${n} avisos comparables${univ}, y lo que pides queda ` },
    { t: `${Math.abs(Math.round(recVsMed ?? 0))}% bajo`, b: true },
    { t: `. El vendedor no tiene un comparable que le diga que está caro: lo que tienes es el número al que a ti te cierra${rec.pieA !== rec.pieDe ? `, poniendo ${pct1(rec.pieA).replace(",0", "")}% de pie` : ""}. Dilo así — no como si el mercado lo respaldara.` },
  ];
}

function capexDe(e: EntradaComoLoPagas): CapexPagas | null {
  const c = e.capex;
  if (!c || !(c.montoUF > 0)) return null;
  const rango = c.montoMinUF != null && c.montoMaxUF != null && c.montoMaxUF > c.montoMinUF;
  const fraccionPct = Math.round((c.fraccionInversion ?? 0) * 100);
  const que =
    e.modalidad === "STR"
      ? "la tarifa por noche que el análisis asume es la de mercado para un depto como este, y el mercado la paga a un depto que está a su nivel"
      : "el arriendo que el análisis asume es el de mercado para un depto como este, y el mercado lo paga a un depto que está a su nivel";
  const intro: Seg[] = [
    { t: `Antes de cobrar hay que gastar: ${que}. Ponerlo a ese nivel —un depto de ${c.antiguedadAnios} años y ${c.superficieUtilM2} m² útiles— es la puesta a punto, y Franco la corre con ` },
    { t: UF(c.montoUF), b: true },
    { t: ` (${CLP(c.montoCLP)}) dentro de la plata del día 1 que el score usa. ` },
    {
      t:
        c.origen === "override"
          ? "Es tu cotización: entra tal cual."
          : `Con una cotización real, el número se ajusta${fraccionPct >= 20 ? "; acá pesa: es más de un quinto de lo que pones el día 1" : ""}.`,
    },
  ];
  return {
    montoUF: c.montoUF,
    montoCLP: c.montoCLP,
    montoMinUF: rango ? (c.montoMinUF as number) : null,
    montoMaxUF: rango ? (c.montoMaxUF as number) : null,
    ufM2: c.ufM2,
    fraccionPct,
    antiguedadAnios: c.antiguedadAnios,
    superficieUtilM2: c.superficieUtilM2,
    intro,
  };
}

export function construirComoLoPagas(e: EntradaComoLoPagas): ModeloComoLoPagas {
  const rec = recomendacionPagas(e);
  const franja = franjaDe(e, rec);
  const recVsMed = franja && franja.recUfM2 != null ? ((franja.recUfM2 - franja.medianaUfM2) / franja.medianaUfM2) * 100 : null;
  const caso = casoPagas({ veredicto: e.veredicto, rec, sobre: e.sobre, recVsMedianaPct: recVsMed });
  const capex = capexDe(e);
  const base = {
    modalidad: e.modalidad,
    caso,
    precioUF: e.precioUF,
    rec,
    franja,
    fraseFranja: franja ? fraseFranja(franja) : null,
    notaFranja: franja ? notaFranja(franja, e.comuna) : null,
    capex,
  };

  // ── COMPRAR: no hay descuento que pedir; se muestra el margen ──
  if (caso === "comprar") {
    // EL PUENTE (decisión Fabrizio, 21-sep-2026): cuando el bloque 1 dice que el metro está
    // caro para la comuna y el veredicto ya es COMPRAR, el bloque 2 no salta a «Nada» sin
    // retomarlo: a ese precio el caso ya cierra, y si igual quiere negociar, el argumento
    // es el mercado. Con el metro en línea o barato, «cierra al precio pedido» y listo.
    const adverso = !!franja && e.sobre?.direccion === "adverso";
    const pasos: PasoPagas[] = [
      adverso
        ? {
            k: "Qué pides",
            segs: [
              { t: "Nada que necesites: a " },
              { t: UF(e.precioUF), b: true },
              { t: " el caso ya cierra. Si igual quieres negociar, tienes el argumento del mercado: el vendedor pide " },
              { t: `${Math.abs(franja.desviacionPct)}% más`, b: true },
              { t: ` que la mediana de ${miles(franja.n)} avisos comparables${franja.universo ? ` de ${franja.universo === "nuevo" ? "nuevos" : "usados"}` : ""} en ${e.comuna || "la comuna"}.` },
            ],
          }
        : { k: "Qué pides", segs: [{ t: "Nada: a " }, { t: UF(e.precioUF), b: true }, { t: " el caso ya es Comprar. Cierra al precio pedido." }] },
    ];
    if (e.precioMaximoComprarUF != null && e.precioMaximoComprarUF > e.precioUF) {
      const pct = Math.round((e.precioMaximoComprarUF / e.precioUF - 1) * 1000) / 10;
      pasos.push({
        k: "Hasta dónde",
        segs: [{ t: "Sigue siendo Comprar hasta " }, { t: UF(e.precioMaximoComprarUF), b: true }, { t: ` (+${pct1(pct)}%)${e.caeA ? `; sobre eso cae a ${ver(e.caeA)}` : ""}.` }],
      });
    }
    return { ...base, tituloBloque2: "Qué margen tienes", pasos, fueraDeRango: null };
  }

  // ── SIN SALIDA: ninguna combinación llega a Comprar ──
  if (caso === "sin_salida") {
    const dv = e.distancia;
    const fr = dv ? (dv.veredictoBase === "BUSCAR OTRA" ? dv.deltaMinimoComprarFueraDeTope ?? null : dv.deltaMinimoFueraDeTope ?? null) : null;
    const pasos: PasoPagas[] = [];
    const queHaria: Seg[] = [];
    if (fr) {
      const abs = Math.abs(fr.deltaPct);
      const que = fr.palanca === "precio" ? `${pct1(abs)}% menos de precio` : fr.palanca === "arriendo" ? `${pct1(abs)}% más de arriendo` : `${pct1(abs)}% más por noche`;
      queHaria.push({ t: "Llegar a Comprar pediría un " }, { t: que, b: true });
      if (fr.palanca === "precio") queHaria.push({ t: ` (${UF(e.precioUF * (1 - abs / 100))})` });
      queHaria.push({ t: ", fuera de todo rango. " });
    }
    queHaria.push({ t: "Franco no encontró una combinación de pie, plazo y descuento que lo haga convenir." });
    pasos.push({ k: "Qué haría falta", segs: queHaria });
    if (franja) {
      const n = miles(franja.n);
      const desv = Math.abs(franja.desviacionPct);
      pasos.push({
        k: "Con qué",
        segs:
          franja.desviacionPct > 2
            ? [{ t: "El vendedor pide " }, { t: `${desv}% más`, b: true }, { t: ` que la mediana de ${n} avisos comparables: el dato de la comuna existe, pero ni un descuento a la mediana alcanza para que el caso convenga.` }]
            : [{ t: "El depto ya está " }, { t: `${desv}% bajo`, b: true }, { t: ` la mediana de ${n} avisos comparables: no hay argumento de mercado y el problema es la estructura, no el precio.` }],
      });
    }
    const hasta = pasoHastaDonde({ limiteTirUF: null, mesCierraUF: e.mesCierraUF, precioUF: e.precioUF, sinSalida: true });
    if (hasta) pasos.push(hasta);
    pasos.push({ k: "Qué hacer", segs: e.alternativa ? [{ t: e.alternativa, b: true }] : [{ t: "Prueba con otro departamento." }] });
    return { ...base, tituloBloque2: "Por qué no hay un precio que negociar", pasos, fueraDeRango: fr ? { palanca: fr.palanca, deltaPct: fr.deltaPct } : null };
  }

  // ── CON RECOMENDACIÓN ──
  const r = rec as RecomendacionPagas;
  const pasos: PasoPagas[] = [];
  const conPie = r.pieA !== r.pieDe ? `, con ${pct1(r.pieA).replace(",0", "")}% de pie` : "";
  const conPlazo = r.plazoA !== r.plazoDe ? `${conPie ? " y" : ", a"} ${r.plazoA} años` : "";
  if (caso === "sin_descuento") {
    pasos.push({
      k: "Qué pides",
      segs: [{ t: "Nada al vendedor: con " }, { t: `${pct1(r.pieA).replace(",0", "")}% de pie${r.plazoA !== r.plazoDe ? ` y ${r.plazoA} años` : ""}`, b: true }, { t: ` el caso llega a ${ver(r.destino)} sin pedirle un peso. Lo que cambia es lo tuyo.` }],
    });
  } else {
    pasos.push({
      k: "Qué pides",
      segs: [
        { t: UF(r.precioUF), b: true },
        { t: ` · ${CLP(r.precioUF * e.valorUF)} — ` },
        { t: `−${pct1(r.descuentoPct)}%`, b: true },
        { t: ` sobre el precio de hoy${conPie}${conPlazo}${r.via === "precio_solo" ? ", sin mover pie ni plazo" : ""}.` },
      ],
    });
    pasos.push({ k: "Con qué", segs: conQue(e, caso, r, franja, recVsMed) });
  }
  const hasta = pasoHastaDonde({ limiteTirUF: e.limiteTirUF, mesCierraUF: e.mesCierraUF, precioUF: e.precioUF });
  if (hasta) pasos.push(hasta);
  const siNo = pasoSiNoCede(e, r.banda === "dificil");
  if (siNo) pasos.push(siNo);
  return { ...base, tituloBloque2: caso === "sin_descuento" ? "Cómo llegar sin pedir descuento" : "Cómo llegar al precio recomendado", pasos, fueraDeRango: null };
}
