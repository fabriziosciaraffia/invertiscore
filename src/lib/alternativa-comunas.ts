// ─── LA ALTERNATIVA DE COMUNAS (contrato §5) ─────────────────────────────────
//
// Dado un depto que no cierra en su comuna, en cuáles del roster SÍ cerraría.
//
// POR QUÉ EXISTE. El 50,2% del parque LTR cae en el estado sin salida de la
// recomendación (604 de 1.203, medido con el motor vivo), y lo único que ve es
// «Prueba con otro departamento». A dónde ir no era un dato: vivía en el prompt
// como instrucción al modelo —«Ángulo 2 · Inter-comuna», nombrar una comuna
// concreta de una lista fija agrupada por perfil— y la card de §5 no lleva prosa.
// El dato más útil para quien recibe un BUSCAR OTRO no tenía dónde aparecer.
//
// NO HAY UMBRAL DE CAP RATE, Y POR ESO NO SE INVENTA UNO. El veredicto no sale de
// una tasa: sale de las bandas del score (70/45) y de tres gates —GATE 1 fuerza
// BUSCAR OTRA por CoC severo, break-even imposible, sobreprecio comunal con flujo
// negativo o flujo severo—. Así que la pregunta «¿convendría ahí?» se responde de
// la única forma que no miente: se reconstruye el MISMO depto en esa comuna y se
// corre `runAnalysis`, la misma función del informe. Cruza la comuna cuyo
// veredicto deja de ser BUSCAR OTRA.
//
// EL PRESUPUESTO ACOTA. Una comuna donde el mismo departamento vale el doble no es
// una alternativa, es otro problema. Solo entran las que no cuestan más de lo que
// el comprador ya iba a pagar, con un margen de TOPE_PRESUPUESTO. Medido sobre el
// parque, el filtro cuesta 7 filas de cobertura (453 → 446 de 604) y saca de la
// lista a las comunas que solo «cierran» porque el depto ahí es inalcanzable.
//
// SIN QUERIES. El mercado por comuna viene del módulo generado en build time
// (`comuna-mercado.gen.ts`), así que esta función es PURA: mismo input, mismo
// resultado, y el catch-test corre sin base.
import { runAnalysis } from "@/lib/analysis";
import { getFactorCierre, normalizeComuna } from "@/lib/comuna-stats";
import { resolverReferenciaArriendo, arriendoDeReferencia } from "@/lib/referencia-arriendo";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { VENTA_POR_COMUNA, ARRIENDO_POR_COMUNA } from "@/lib/comuna-mercado.gen";
import type { AnalisisInput, Veredicto } from "@/lib/types";

/** Hasta cuánto más que el precio del sujeto se acepta. 1,05 = hasta 5% arriba. */
export const TOPE_PRESUPUESTO = 1.05;

/** Cuántas comunas nombra la LÍNEA de la card. El detalle va al pop-up. */
export const MAX_NOMBRADAS = 2;

/** Una comuna donde el mismo depto sí cerraría. */
export interface ComunaAlternativa {
  comuna: string;
  /** Veredicto del MISMO depto ahí, por `runAnalysis`. Nunca "BUSCAR OTRA". */
  veredicto: Veredicto;
  score: number;
  /** Lo que costaría ese departamento ahí, en UF. */
  precioUF: number;
  /** Lo que rentaría ahí, en CLP al mes. */
  arriendoCLP: number;
  /** El n de la muestra de venta y de arriendo que sostienen la celda. */
  nVenta: number;
  nArriendo: number;
}

export interface AlternativaComunas {
  /** Las que nombra la línea: `MAX_NOMBRADAS` como máximo, las de mayor score. */
  nombradas: string[];
  /** Todas las que cruzan, ordenadas por score. Es lo que lee el pop-up. */
  todas: ComunaAlternativa[];
}

/** El universo de mercado del sujeto, con la misma regla que el resto del motor. */
function universoDe(input: AnalisisInput): "nuevo" | "usado" {
  return input.esNuevo === true || input.antiguedad === 0 ? "nuevo" : "usado";
}

/**
 * El MISMO depto, comprado en otra comuna. Cambia lo que cambia el mercado —el
 * precio y el arriendo— y NO lo que pone el comprador: pie, tasa, plazo y gastos
 * viajan intactos, porque son suyos y no de la comuna.
 *
 * Las contribuciones sí escalan: son proporcionales al avalúo, así que dejarlas
 * fijas le regalaría al depto caro el gasto del barato.
 *
 * Devuelve null cuando la comuna no tiene muestra para esa tipología: una celda
 * bajo el umbral no se rellena con la de al lado.
 */
export function deptoEnComuna(
  input: AnalisisInput,
  comuna: string,
  ufClp: number,
): AnalisisInput | null {
  const dorms = Math.min(4, Math.max(1, Math.round(input.dormitorios)));
  const celda = VENTA_POR_COMUNA[`${comuna}|${dorms}|${universoDe(input)}`];
  const arr = ARRIENDO_POR_COMUNA[comuna];
  if (!celda || !arr) return null;
  if (!(input.superficie > 0) || !(ufClp > 0)) return null;

  // El precio publicado pasa a precio de cierre con el mismo factor del motor.
  const precioUF = celda.ufM2 * getFactorCierre(comuna) * input.superficie;
  if (!(precioUF > 0)) return null;

  // El arriendo, por la MISMA vía comunal que usa el informe: el UF/m²/mes pooled
  // de la comuna, la superficie del sujeto y el factor de su tipología.
  const arriendo = arriendoDeReferencia(
    resolverReferenciaArriendo({
      dorms,
      tipologia: { n: 0, medianaCLP: 0 },
      comunal: { n: arr.n, ufM2Mes: arr.ufM2Mes },
      superficieRefM2: input.superficie,
      ufCLP: ufClp,
    }),
  );
  if (arriendo === null) return null;

  const escala = input.precio > 0 ? precioUF / input.precio : 1;
  return {
    ...input,
    comuna,
    precio: precioUF,
    arriendo,
    contribuciones: Math.round((input.contribuciones || 0) * escala),
    // El valor de mercado es del depto que el usuario miró, no de éste.
    valorMercadoRef: null,
    valorMercadoUsuario: undefined,
  };
}

/**
 * Las comunas donde este departamento sí convendría. `null` cuando no hay
 * ninguna — y ahí la card NO inventa: se queda con el puente.
 *
 * El caller decide CUÁNDO llamarla (solo en el estado sin salida): son 23
 * corridas del motor, baratas pero no gratis.
 */
export function construirAlternativaComunas(p: {
  input: AnalisisInput;
  ufClp: number;
  asOf: Date;
}): AlternativaComunas | null {
  const { input, ufClp, asOf } = p;
  if (!input?.precio || !(input.precio > 0)) return null;
  const propia = normalizeComuna(input.comuna ?? "");
  const techo = input.precio * TOPE_PRESUPUESTO;

  const cruzan: ComunaAlternativa[] = [];
  for (const comuna of COMUNAS_DISPONIBLES) {
    if (comuna === propia) continue;
    const cf = deptoEnComuna(input, comuna, ufClp);
    if (!cf) continue;
    if (cf.precio > techo) continue; // el presupuesto manda
    let r;
    try {
      r = runAnalysis(cf, ufClp, undefined, asOf);
    } catch {
      continue; // una comuna que no calcula no entra; el resto sigue
    }
    if (r.veredicto === "BUSCAR OTRA") continue;
    cruzan.push({
      comuna,
      veredicto: r.veredicto as Veredicto,
      score: r.score,
      precioUF: cf.precio,
      arriendoCLP: cf.arriendo,
      nVenta: VENTA_POR_COMUNA[`${comuna}|${Math.min(4, Math.max(1, Math.round(input.dormitorios)))}|${universoDe(input)}`]?.n ?? 0,
      nArriendo: ARRIENDO_POR_COMUNA[comuna]?.n ?? 0,
    });
  }
  if (cruzan.length === 0) return null;

  // Por score, y a igual score la más barata: entre dos que cierran igual, la que
  // deja más plata en el bolsillo.
  cruzan.sort((a, b) => b.score - a.score || a.precioUF - b.precioUF);
  return {
    nombradas: cruzan.slice(0, MAX_NOMBRADAS).map((c) => c.comuna),
    todas: cruzan,
  };
}

/**
 * La línea de la card. SIN CIFRAS: el número de cuánto cuesta o cuánto renta es
 * del pop-up, no de acá — la línea existe para decir a dónde ir, y una cifra al
 * lado invita a compararla con la del depto que el lector ya descartó.
 *
 * Una o dos comunas, nunca más: una lista de cinco no es una recomendación.
 */
export function lineaAlternativaComunas(a: AlternativaComunas | null): string | null {
  const cs = a?.nombradas ?? [];
  if (cs.length === 0) return null;
  const donde = cs.length === 1 ? cs[0] : `${cs[0]} o ${cs[1]}`;
  return `En ${donde} un departamento como este sí convendría.`;
}
