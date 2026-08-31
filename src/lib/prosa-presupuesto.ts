// ============================================================================
// PRESUPUESTO DE PROSA — Plan C (conviene.respuestaDirecta del hero LTR)
// ============================================================================
// La respuestaDirecta ensamblada tiene TRES piezas y solo UNA la escribe el modelo:
//
//   [respuesta al veredicto] + [apertura fija = fraseCanonica del #1] + [continuación]
//    └── motor, determinística ─────────────────────────────────────┘    └── LLM
//
// TECHO PLANO (hasta 4aa898e) — muerto. El máximo era 85 palabras TOTALES y la
// continuación se quedaba con el resto: `85 − apertura − respuesta`. O sea: el
// presupuesto de la única pieza que el modelo controla dependía del largo de dos
// piezas que NO controla. El modelo entregaba su largo natural igual, el guard
// insistía dos veces y aceptaba lo que hubiera → techo reportado, no enforzado.
//
// REGLA VIGENTE — la continuación tiene presupuesto PROPIO Y FIJO
// (CONTINUACION_MAX) y el techo TOTAL escala con lo que el motor antepuso:
//
//   techoTotal = palabras(respuesta) + palabras(apertura) + CONTINUACION_MAX
//
// El trabajo del modelo ("UN matiz, con su cifra y su consecuencia") no cambia de
// tamaño porque el motor haya elegido una apertura de 24 o de 40 palabras.
//
// ── CALIBRACIÓN DE CONTINUACION_MAX = 60 ───────────────────────────────────
// Medición determinística de la parte fija sobre los 9 seeds golden (0 tokens,
// `runAnalysis` + `aperturaSource`), y continuación real observada en generación
// fresca (K=6, datos del check A6):
//
//   seed     apertura(#1)      fijo   maxCont VIEJO   continuación observada
//   GS-1     cap_rate 40+1  =  41         44                38-46
//   GS-2     cap_rate 40+4  =  44         41                  —
//   GS-3     sobreprecio    =  31         54                  —
//   GS-4/6/7 sobreprecio    =  26         59                  —
//   GS-PC1   flujo_mens.35+2=  37         48                50-84  ← desbordaba
//   GS-PC2   cap_rate 40+4  =  44         41                30-44
//
// OJO (corrige el diagnóstico previo del check A6): la apertura de `flujo_mensual`
// NO es la larga — son 35 palabras contra las 40 de `cap_rate`. GS-PC1 desbordaba
// con MÁS presupuesto que su control (48 vs 41), así que la causa próxima no es el
// largo de la apertura: es que ese caso (pie 0 + BUSCAR OTRA estructural) tiene más
// contenido mandatado por doctrina (## 5.bis: estructura 100% + vacancia en plata)
// del que caben en el resto de un techo plano. El techo escalado es la regla
// correcta igual — pero por diseño, no por esa frase: el bug es que el presupuesto
// del modelo dependa de una pieza ajena.
//
// Por qué 60 y no 65:
//  · 60 > 46 = la continuación más larga que producen los seeds que YA cabían
//    (+30% de holgura) → ningún caso sano entra en reintento por el cambio.
//  · 60 < 62,5 = la mediana de GS-PC1 (50·55·58·67·68·84) → el caso que desbordaba
//    SIGUE obligado a recortar. Es la doctrina ("UN SOLO matiz"), no un pase libre.
//  · 65 habría dejado pasar 5/6 corridas de GS-PC1 sin reintento, pero licencia
//    +41% sobre la continuación más larga que hoy se escribe sin problema. Se eligió
//    el número más apretado que resuelve el desborde.
//
// ── VALIDADO en generación fresca (golden FULL, K=3, 2026-08-02) ────────────
//   seed     respuestaDirecta total   techo duro   antes
//   GS-1      91·93·98                  107        79-87
//   GS-PC1    98·94·90                  103        87·92·95·104·105·121  ← el caso
//   GS-PC2    94·104·102                110        74-88
// A6 verde 9/9 con el techo de emergencia 140 retirado. El desborde sistemático de
// GS-PC1 murió (la cola de 121 no vuelve a aparecer) y sus 3 corridas tardaron 172-239s
// contra los 45-52s del control: el guard reintenta de verdad, y converge.
//
// COSTO MEDIDO — el modelo escribe HASTA su presupuesto. Los casos que ya cabían se
// alargaron: GS-1 pasó de 38-46 palabras de continuación a 50-57, GS-PC2 de 30-44 a
// 50-60. O sea: CONTINUACION_MAX no es solo un techo, es la longitud editorial del
// lead del hero. Si 90-100 palabras se considera largo para esa línea, la palanca es
// bajar esta constante (a ~50 se recupera el largo histórico), NO tocar el guard.
// ============================================================================

/** Presupuesto propio de la continuación (lo único que escribe el LLM). */
export const CONTINUACION_MAX = 60;

/** Holgura del guard: por debajo NO se gasta una regeneración. */
export const TOLERANCIA_PRESUPUESTO = 1.1;

/**
 * Presupuesto de `negociacion.contenido` (GOAL 16, prompt LTR v13).
 *
 * POR QUÉ 40 Y NO "2-3 FRASES". El contrato v12 no traía número y el campo medía
 * **88 palabras de promedio** sobre las 318 prosas v12 del parque. Con ese aire el
 * modelo llenaba: 65% citaba el techo del plan (impreso a dos centímetros), 63%
 * narraba el break-even de caja (ahora chip determinista) y un 6% arrastraba
 * además una frase-puente que solo existía para desambiguar su propia
 * duplicación. Sacadas las dos cifras que ya tienen forma propia, lo que queda
 * —el argumento negociador y, condicional, la palanca de financiamiento— cabe en
 * dos frases.
 *
 * Y va ENFORCADO, no sugerido: el modelo no cuenta bien, y un techo que solo se
 * pide es un techo que se pasa (lección del PLAN C, arriba).
 */
export const NEGOCIACION_MAX = 40;

/** Techo DURO de negociacion.contenido. Sobre esto se recorta por oración. */
export const TECHO_NEGOCIACION_DURO = Math.ceil(NEGOCIACION_MAX * TOLERANCIA_PRESUPUESTO); // 44

/** Techo DURO de la continuación. Sobre esto no se acepta: se recorta. */
export const TECHO_CONTINUACION_DURO = Math.ceil(CONTINUACION_MAX * TOLERANCIA_PRESUPUESTO); // 66

/** Palabras de un texto (mismo conteo en motor, guard y golden). */
export const contarPalabras = (s: unknown): number =>
  typeof s === "string" && s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0;

/**
 * Techo TOTAL de la respuestaDirecta ensamblada, dado lo que el motor antepone.
 * `duro = true` devuelve la línea que el guard enforza por construcción (la que
 * verifica el golden en A6); sin flag, el presupuesto que se le instruye al modelo.
 */
export const techoTotalRespuestaDirecta = (
  aperturaWC: number,
  respuestaWC: number,
  duro = false,
): number => aperturaWC + respuestaWC + (duro ? TECHO_CONTINUACION_DURO : CONTINUACION_MAX);

/** Corte por oración (mismo criterio que los strippers PLANC de ai-generation). */
const partirEnOraciones = (s: string): string[] =>
  s.split(/(?<=[.;])\s+/).map((x) => x.trim()).filter(Boolean);

/**
 * Cuántas oraciones INICIALES caben en `maxWC`. 0 = ni la primera cabe.
 */
function oracionesQueCaben(texto: string, maxWC: number): number {
  const oraciones = partirEnOraciones(texto);
  let acumulado = 0;
  let n = 0;
  for (const o of oraciones) {
    const wc = contarPalabras(o);
    if (acumulado + wc > maxWC) break;
    acumulado += wc;
    n++;
  }
  return n;
}

/**
 * ENFORCEMENT FINAL del presupuesto — corta por ORACIÓN, nunca a media frase.
 * Corre solo después de que los reintentos no convergieron: recorta las variantes
 * _clp y _uf al MISMO número de oraciones (si divergieran, el toggle de moneda
 * cambiaría el contenido de la prosa, no solo sus cifras). Si ni la primera oración
 * cabe, devuelve "" en ambas: la apertura del motor queda sola, que es prosa válida
 * y completa — degradar es preferible a publicar un techo que no se cumple.
 */
export function recortarContinuacion(
  clp: string,
  uf: string,
  maxWC: number = TECHO_CONTINUACION_DURO,
): { clp: string; uf: string; oracionesDescartadas: number } {
  const oracionesClp = partirEnOraciones(clp);
  const oracionesUf = partirEnOraciones(uf);
  const total = Math.max(oracionesClp.length, oracionesUf.length);
  const quedan = Math.min(
    clp.trim() ? oracionesQueCaben(clp, maxWC) : total,
    uf.trim() ? oracionesQueCaben(uf, maxWC) : total,
  );
  return {
    clp: oracionesClp.slice(0, quedan).join(" ").trim(),
    uf: oracionesUf.slice(0, quedan).join(" ").trim(),
    oracionesDescartadas: total - quedan,
  };
}
