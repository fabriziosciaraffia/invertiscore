// ─────────────────────────────────────────────────────────────────────────────
// EL MIX DE PALANCAS DEL COMPRADOR (10-sep-2026)
//
// Las cuatro palancas del hallazgo de distancia se prueban DE A UNA, "con el resto
// de los supuestos fijos". Esta pieza combina las TRES que dependen del comprador
// —precio, pie y plazo— y para cada combinación de pie × plazo devuelve el
// descuento mínimo de precio que cruza al veredicto de arriba.
//
// CUÁL DE ESAS COMBINACIONES SE OFRECE (13-sep-2026). Hasta el 12-sep ganaba la de MENOR
// DESCUENTO, con la plata del día uno como desempate: un criterio sobre lo que hay que
// pedirle a un tercero, no sobre el negocio que queda. Desde hoy gana la de MAYOR FRANCO
// SCORE entre las que cruzan, y el descuento desempata.
//
// POR QUÉ EL SCORE Y NO UNA MÉTRICA SOLA. Se midieron tres criterios sobre las mismas
// celdas (375 filas LTR, 59 STR). Elegir por cash-on-cash sube el retorno anual pero BAJA
// la TIR en 9 de cada 10 filas donde cambia la elegida: compra retorno con más pie, y más
// pie es menos apalancamiento. Elegir por TIR hace lo inverso y encima la compra con
// descuento —pide 10,6 puntos más de rebaja en la mediana—, o sea le exige mucho más al
// vendedor y empeora el mes del comprador. El score pondera flujo, retorno sobre lo puesto
// y TIR juntas, así que no hay que elegir entre las dos, y es la MISMA vara con la que la
// página declara el veredicto: el mix deja de poder ofrecer una combinación que el informe
// que la muestra considera peor negocio. Medido: sube el score en el 100% de las filas
// donde cambia la elegida (mediana +2 pts), sube la TIR en el 69% y pide la mitad de
// descuento que el criterio por TIR.
//
// El score se mide EN la celda con su descuento mínimo: si el descuento fuera libre la
// regla lo llevaría siempre al tope. Llega por la sonda ya calculado, así que este módulo
// no sabe de modalidades ni de unidades del motor.
//
// El arriendo y la tasa quedan fuera por definición, no por costo: el arriendo lo
// pone el mercado y la tasa el banco. Un mix que le pide al comprador mover algo
// que no controla no es un plan, es una lista de deseos.
//
// POR QUÉ EXISTE. Medido sobre los seeds del golden, el mix ahorra entre 3 y 25
// puntos de descuento frente a mover el precio solo — y en tres casos convierte un
// "ningún ajuste realista alcanza" en una negociación normal. Pero se paga con
// plata del día 1, así que la cifra del pie viaja SIEMPRE al lado (ver
// `costoDiaUnoUF`): un mix sin su costo es un espejismo.
//
// COSTO: ~120-200 recomputes de veredicto (bisección por combinación), 0 tokens,
// sin base. Medido: 5-41 ms según la grilla, contra ~44 ms de un runAnalysis.
// ─────────────────────────────────────────────────────────────────────────────

import type { MixPalancas, PalancaDistancia, Veredicto } from "./types";

/** Paso de la grilla del pie, en puntos. El mismo que usa `simularPieYPlazo`. */
export const MIX_PIE_PASO_PCT = 5;

/**
 * Plazos que el mix puede proponer. Es el enum del WIZARD (`WizardV4Answers.plazoCredito`),
 * no `PLAZOS_COMERCIALES` del motor, que incluye 15.
 *
 * Dos razones y las dos son de producto: (1) el mix es la antesala de un CTA que
 * prellena el formulario, y proponer 15 sería proponer algo que el formulario no acepta;
 * (2) acortar el plazo SUBE la cuota, así que como palanca para cruzar va al revés.
 */
export const MIX_PLAZOS_WIZARD = [20, 25, 30] as const;

// ── TOPE DE ALCANCE: hasta cuánto capital extra sigue siendo una salida ──────
//
// El mix ahorra puntos de negociación y los cobra en plata propia el día 1. Sobre
// cierto punto deja de ser una salida y pasa a ser otra compra: pedirle a alguien que
// ponga el pie entero no es «ajustar supuestos».
//
// LA UNIDAD ES PUNTOS DEL PRECIO, y las otras dos se descartaron con datos:
//
//   · MÚLTIPLO DEL PIE — se rompe. En el parque hay 6 filas con pie declarado 0%,
//     donde el múltiplo ni siquiera está definido, y el máximo observado (23,04×)
//     sale de una fila con pie 1%: un múltiplo enorme sobre una base ridícula. Es la
//     misma razón por la que `DIST_PIE_TOPE_PCT` ya eligió ser ABSOLUTO.
//   · UF ABSOLUTAS — no escalan. UF 948 es un tercio del precio en un depto de
//     UF 3.000 y un 9% en uno de UF 10.000; un tope en UF filtra por tamaño del deal,
//     no por esfuerzo.
//
// Puntos del precio es escala-libre, está SIEMPRE definida (también con pie 0) y se
// lee sola: cuántos puntos más del precio hay que poner el día uno.
//
// POR QUÉ 15, y qué mide de verdad este tope.
//
// ⚠ LA PRIMERA MEDICIÓN ESTUVO MAL PLANTEADA Y EL NÚMERO CAMBIÓ. La FASE 0 midió «el
// costo del mejor combo por descuento, y después si era pagable», y dio 35 filas
// excluidas de 191. La implementación hace lo correcto —filtra por alcance ANTES de
// elegir— así que cuando el combo más barato en descuento es caro, el módulo encuentra
// otro que sí cabe. Con la semántica real el tope excluye **12 de 191 (6%)**, no 35.
//
// Eso cambia lo que el tope ES: no es un filtro grueso que separa poblaciones, es una RED
// DE SEGURIDAD que muerde solo donde NO existe ninguna combinación bajo los 15 puntos.
// Los 12 que caza tienen costo MÍNIMO entre 15,7 y 22,1 puntos:
//
//   15,7 · 16,0 · 16,1 · 16,1 · 16,4 · 16,4 · 16,7 · 16,8 · 17,0 · 17,8 · 21,3 · 22,1
//
// Sensibilidad sobre esos mínimos: tope 16 → 10 afuera · 18 → 2 · 20 → 2 · 25 → 0.
// Para topes bajo 15 haría falta otra corrida (el módulo no expone el mínimo cuando la
// fila SÍ tiene salida), así que ese tramo no está medido.
//
// LO QUE SÍ SOSTIENE EL 15, medido con la semántica implementada:
//  · preserva **67 de las 71** filas cuyo mix cruza SIN pedir descuento — el subconjunto
//    donde el informe hoy manda a irse y la salida no cuesta negociación, solo capital;
//  · la distribución del costo del mejor mix es p25 5,8 · p50 9,7 · p75 13,9 · p90 18,3,
//    o sea que 15 cae sobre el p75 y deja pasar tres cuartos sin discutir;
//  · y ninguna fila queda afuera por poco: el mínimo de los excluidos es 15,7, no 15,05.
//
// Lo que NO sostiene el 15, y conviene no repetirlo: en FASE 0 escribí que el tope «deja
// afuera casi exactamente las filas pie 0% → 30%». Con la medición correcta **solo 3 de
// los 12 tienen pie 0%**: las otras encuentran una combinación alternativa más barata.
// El tope no separa esa población — la separa el propio orden del módulo.
export const MIX_COSTO_TOPE_PTS_PRECIO = 15;

/** Precisión de la bisección del descuento, en puntos porcentuales. */
const MIX_PREC_PTS = 0.1;

const RANK: Record<Veredicto, number> = { "BUSCAR OTRA": 0, "AJUSTA SUPUESTOS": 1, COMPRAR: 2 };

type Combinacion = { descuentoPct: number; sinDescuento: boolean; piePct: number; plazoAnios: number; costoDiaUnoUF: number; costoPtsPrecio: number; score: number | null; metricas: MetricasCelda | null };

/**
 * Lo que la sonda devuelve por celda, del MISMO recompute: el veredicto y el Franco Score
 * con el que ese veredicto se declaró. Salen de la misma pasada del motor, así que el mix
 * no puede elegir sobre un score que no corresponda al veredicto que acaba de leer.
 */
export type SondaMix = {
  veredicto: Veredicto;
  score: number | null;
  /**
   * Las cifras de ESA combinación, para el lado «después» de los pares del pop-up. Las
   * llena el llamador con lo que su recompute ya produjo —no se recalcula nada— y el mix
   * solo guarda las de la celda que corona. Opcional a propósito: los catch-tests y los
   * censos sondean sin métricas y el módulo no las necesita para elegir.
   */
  metricas?: MetricasCelda | null;
};

/** El lado «después» de los pares: lo que la combinación elegida deja. Unidades del lector:
 *  plata mensual en CLP, porcentajes en puntos (5,2 = 5,2%). */
export type MetricasCelda = {
  cuotaMensual: number | null;
  flujoMensual: number | null;
  /** Retorno sobre lo puesto — «por cada $100 que pones, al año». */
  cocPct: number | null;
  capRateNetoPct: number | null;
  tirPct: number | null;
};

/**
 * UNA CELDA DE LA GRILLA, tal como la pinta el pop-up de ajustes. Viaja para TODAS las
 * combinaciones probadas, crucen o no: la matriz tiene que poder mostrar «Buscar» en una
 * celda que no llega, y el panel de detalle decir «no llega a Comprar».
 *
 * `veredicto` y `score` son LO QUE CONSIGUES con esa combinación: medidos en su descuento
 * mínimo cuando la celda cruza, y sin descuento cuando no cruza ni en el tope. Es la
 * pregunta que el cuadrito contesta —«¿y si pongo este pie a este plazo?»— y por eso una
 * celda verde dice «Comprar» y no «Ajustar»: con el descuento que pide, llega. El descuento
 * va aparte, en el panel, porque es lo que hay que pedirle a un tercero.
 *
 * `veredictoSinDescuento` y `scoreSinDescuento` conservan el estado a precio de hoy, para
 * quien necesite separar lo que se consigue moviendo solo lo propio.
 *
 * Nada de esto es cómputo nuevo: la sonda a descuento 0 ya se hacía para saber si la celda
 * cruzaba sola, y la sonda en el mínimo ya se hacía para leer el score con el que se elige.
 */
export type CeldaMix = {
  piePct: number;
  plazoAnios: number;
  /** La combinación declarada en el análisis (pie y plazo de hoy). */
  esActual: boolean;
  /** La que el mix corona. Exactamente una celda la lleva. */
  esElegida: boolean;
  /** Veredicto de la celda EN su descuento mínimo (o sin descuento si no cruza). */
  veredicto: Veredicto;
  /** Score de la celda EN su descuento mínimo (o sin descuento si no cruza). */
  score: number | null;
  /** Veredicto a precio de hoy, moviendo solo pie y plazo. */
  veredictoSinDescuento: Veredicto;
  scoreSinDescuento: number | null;
  /** Descuento mínimo que hace cruzar esta celda, o null si no cruza ni en el tope. */
  descuentoPct: number | null;
  /** Plata propia extra el día uno, sobre el pie declarado. Puede ser negativa. */
  costoDiaUnoUF: number;
  costoPtsPrecio: number;
  /** ¿Está dentro del tope de alcance? Una celda cara no se ofrece por más score que deje. */
  alcanzable: boolean;
  /**
   * LAS CIFRAS DE ESTA CELDA, en la misma lectura de la que salen `veredicto` y `score`:
   * el descuento mínimo si cruza, el precio de hoy si no.
   *
   * Viajan desde el 14-sep-2026. Antes el motor las calculaba para TODAS las celdas —la
   * sonda devuelve cuota, flujo, retorno, cap rate y TIR en la misma pasada que el
   * veredicto— y las tiraba en el mismo bucle, salvo las de la coronada (`despues`). Con
   * eso, dos celdas solo se podían comparar por el score, que es un entero que pondera
   * cinco cosas a la vez: nadie podía preguntar cuál deja mejor mes o mejor tasa.
   *
   * CERO SONDAS NUEVAS: el dato ya está en la mano cuando la celda se arma.
   *
   * `null` cuando el llamador sondea sin métricas — los catch-tests lo hacen a propósito
   * (`SondaMix.metricas` es opcional). Ausente en filas recomputadas antes de esa fecha.
   */
  metricas?: MetricasCelda | null;
};


/**
 * LA ELECCIÓN, EN UNA SOLA FUNCIÓN (12-sep-2026).
 *
 * Antes había dos ordenamientos —uno para las alcanzables y otro para el fallback— y cada
 * uno podía derivar por su lado. Ahora el criterio entra como dato:
 *
 *  · `score` — entre las que cruzan, la del mejor negocio según la vara de Franco: el score
 *    pondera flujo, retorno sobre lo puesto y TIR juntas. El descuento desempata (es lo que
 *    hay que pedirle a un tercero), después la plata del día uno y por último el pie, para
 *    que el resultado no dependa del recorrido de la grilla. Una celda sin score medible NO
 *    le gana a una con número: se ordena al final.
 *  · `costo` — la más barata en puntos del precio. Es el criterio del borde donde NINGUNA
 *    celda está dentro del alcance: ahí no se está eligiendo un plan sino reportando cuánto
 *    costaría el más barato, y el retorno de una salida que no existe no significa nada.
 */
export function elegirCelda<T extends Combinacion>(xs: readonly T[], criterio: "score" | "costo"): T[] {
  const porScore = (a: T, b: T) => {
    // null al final: sin número no se compite (filas legacy sin métricas recomputables).
    if (a.score == null && b.score == null) return 0;
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score;
  };
  const cmp = (a: T, b: T) =>
    criterio === "score"
      ? porScore(a, b) || a.descuentoPct - b.descuentoPct || a.costoDiaUnoUF - b.costoDiaUnoUF || a.piePct - b.piePct
      : a.costoPtsPrecio - b.costoPtsPrecio || a.descuentoPct - b.descuentoPct || a.piePct - b.piePct;
  return [...xs].sort(cmp);
}

/**
 * Devuelve el mejor mix y su contexto, o `null` si NINGUNA combinación cruza.
 *
 * `null` es explícito y significa "se probaron las N combinaciones y ninguna alcanza".
 * No es lo mismo que el campo ausente en una fila vieja — ver el tipo `MixPalancas`.
 */
export function calcularMixPalancas(p: {
  /** Veredicto al que hay que llegar (el inmediatamente superior al base). */
  meta: Veredicto;
  precioUF: number;
  /** Pie declarado, en % del precio. */
  piePct: number;
  plazoCredito: number;
  /**
   * ¿El pie se puede mover? Lo decide el hallazgo de distancia con su doctrina:
   * `false` con bono pie (la inmobiliaria lo cubre y subirlo desarma el trato) o con
   * el pie ya en el techo. Si es false, el pie NO entra a la grilla.
   */
  pieCalifica: boolean;
  /**
   * Tope del descuento de precio, en %. Es el MISMO que gobierna la palanca sola: si el
   * mix pudiera pedir un descuento que la palanca sola tiene prohibido ofrecer, Franco se
   * contradiría dentro del mismo informe.
   */
  topePct: number;
  /**
   * Techo del NIVEL de pie que el mix puede proponer. Llega por parámetro y no por
   * import para no cerrar un ciclo con `distancia-veredicto-hallazgo.ts`, que es quien
   * llama acá; su fuente única sigue siendo `DIST_PIE_TOPE_PCT`.
   */
  pieTopePct: number;
  /**
   * Las palancas que YA cruzan solas. Solo se usa para marcar el mix redundante, así que
   * acepta la unión ANCHA de `PalancaDistancia` —la que comparten LTR y STR, con `adr` y
   * `gestion`— en vez de la de acá: el mix solo pregunta si contiene una de las suyas, y
   * estrechar el tipo obligaría al llamador a filtrar sin ninguna ganancia.
   */
  palancasQueCruzan: PalancaDistancia["palanca"][];
  /**
   * Sonda del motor: veredicto Y score para el input parchado, en una sola pasada. Hasta el
   * 12-sep-2026 devolvía solo el veredicto y la elegida se decidía por descuento mínimo, un
   * criterio sobre lo que hay que pedirle al vendedor y no sobre el negocio que queda.
   */
  sondaAtPatch: (patch: { precio?: number; piePct?: number; plazoCredito?: number }) => SondaMix;
}): MixPalancas | null {
  if (!Number.isFinite(p.precioUF) || p.precioUF <= 0) return null;
  if (!Number.isFinite(p.piePct) || !Number.isFinite(p.plazoCredito)) return null;

  // ── LA GRILLA ─────────────────────────────────────────────────────────────
  // Pie: del declarado hasta el techo, paso 5, NUNCA hacia abajo. El techo es el mismo
  // del hallazgo (`DIST_PIE_TOPE_PCT`), con su razón ya escrita allá: a alguien con 10%
  // declarado pedirle 40% deja de ser un ajuste de supuestos. Y hacia abajo no se explora
  // porque menos pie empeora el mes: sería una recomendación al revés.
  const pies: number[] = [p.piePct];
  if (p.pieCalifica) {
    for (let x = p.piePct + MIX_PIE_PASO_PCT; x <= p.pieTopePct; x += MIX_PIE_PASO_PCT) pies.push(x);
  }
  // Plazo: solo hacia arriba y solo lo que el wizard acepta. Si ya está en el máximo, la
  // grilla queda de una columna y el mix se reduce a las otras dos palancas — es el borde
  // que `redundanteConPalancaSola` tiene que poder declarar.
  const plazosArriba = MIX_PLAZOS_WIZARD.filter((a) => a >= p.plazoCredito);
  const plazos: number[] = plazosArriba.length > 0 ? [...plazosArriba] : [p.plazoCredito];

  const alcanza = (v: Veredicto) => RANK[v] >= RANK[p.meta];
  const sondar = (descuentoPct: number, piePct: number, plazoAnios: number) =>
    p.sondaAtPatch({ precio: p.precioUF * (1 - descuentoPct / 100), piePct, plazoCredito: plazoAnios });
  const cruza = (descuentoPct: number, piePct: number, plazoAnios: number) => alcanza(sondar(descuentoPct, piePct, plazoAnios).veredicto);

  /**
    * Explora UNA celda: el descuento mínimo que la cruza (o null) y las DOS lecturas que el
    * pop-up necesita, sin sondear de más.
    *
    * `base` es la sonda a descuento 0, que ya se hacía para preguntar si pie y plazo solos
    * alcanzan; de ahí salen el veredicto y el score que la celda muestra. `enMin` es la
    * sonda en el descuento mínimo, que ya se hacía para leer el score con el que se elige.
    * Cuando la celda cruza sin descuento las dos son la MISMA lectura y no se repite la
    * llamada: antes se sondeaba dos veces el mismo punto.
    */
  const explorarCelda = (piePct: number, plazoAnios: number): { pct: number | null; sin: boolean; base: SondaMix; enMin: SondaMix | null } => {
    const base = sondar(0, piePct, plazoAnios);
    if (alcanza(base.veredicto)) return { pct: 0, sin: true, base, enMin: base };
    if (!cruza(p.topePct, piePct, plazoAnios)) return { pct: null, sin: false, base, enMin: null };
    let lo = 0;
    let hi = p.topePct;
    while (hi - lo > MIX_PREC_PTS) {
      const mid = (lo + hi) / 2;
      if (cruza(mid, piePct, plazoAnios)) hi = mid;
      else lo = mid;
    }
    // SE REDONDEA HACIA ARRIBA, Y ES CORRECTITUD, NO POLÍTICA (14-sep-2026).
    //
    // El invariante del bucle garantiza que `hi` cruza y que `lo` no. `Math.round` podía
    // bajar el valor publicado hasta 0,05 puntos por debajo de `hi`, o sea meterlo en el
    // tramo (lo, hi) donde el cruce NO está verificado. Recomputado en ese número, el caso
    // ya no alcanzaba: la celda quedaba pintada «llega a Comprar» con la palabra «Ajustar»
    // adentro. Medido sobre el parque: 388 de 1.806 celdas alcanzables, el 21,5%.
    //
    // `Math.ceil` publica siempre un punto que cruza, por construcción. Cuesta como máximo
    // 0,1 punto más de descuento pedido al vendedor, y eso está medido y aceptado.
    //
    // La tolerancia de 1e-9 evita que un `hi` que ya es múltiplo exacto de 0,1 salte un
    // décimo entero por ruido de punto flotante.
    //
    // Y el `min` con el tope no es decorativo: el tope es el MISMO que gobierna la palanca
    // sola, y publicar por encima haría que el mix pida un descuento que el precio solo
    // tiene prohibido ofrecer. Con `hi <= topePct` y topes de un decimal o menos el clamp
    // nunca muerde; queda igual porque el día que el tope tenga más decimales, muerde.
    const pct = Math.min(Math.ceil(hi * 10 - 1e-9) / 10, p.topePct);
    return { pct, sin: false, base, enMin: sondar(pct, piePct, plazoAnios) };
  };

  const pieCLP = (descuentoPct: number, piePct: number) => (p.precioUF * (1 - descuentoPct / 100) * piePct) / 100;
  // BASE DEL COSTO: SIEMPRE el pie declarado hoy, sobre el precio de hoy. Es la única base
  // que el usuario reconoce, y la única que existe en los casos donde el precio solo NO
  // cruza — que son justamente aquellos donde el mix más vale.
  const pieDeclaradoUF = (p.precioUF * p.piePct) / 100;

  // UNA sola pasada por la grilla produce las dos cosas: las combinaciones que compiten por
  // ser la elegida y la matriz completa que el pop-up dibuja. EL SCORE SE MIDE EN LA CELDA
  // QUE SE VA A OFRECER, con su descuento MÍNIMO: bajar el precio sube el score, así que si
  // el descuento fuera libre la elección lo llevaría siempre al tope; anclado al mínimo que
  // cruza, el descuento sigue siendo el menor posible y el score solo arbitra entre celdas.
  const combos: Combinacion[] = [];
  const celdas: CeldaMix[] = [];
  for (const pie of pies) {
    for (const plazo of plazos) {
      const r = explorarCelda(pie, plazo);
      const costoUF = Math.round(pieCLP(r.pct ?? 0, pie) - pieDeclaradoUF);
      const costoPts = Math.round(((100 * (pieCLP(r.pct ?? 0, pie) - pieDeclaradoUF)) / p.precioUF) * 10) / 10;
      const scoreBase = Number.isFinite(r.base.score as number) ? (r.base.score as number) : null;
      // LO QUE CONSIGUES con esa celda: su lectura en el descuento mínimo cuando cruza. Sin
      // esto una celda marcada «llega a Comprar» mostraría «Ajustar», que es su estado a
      // precio de hoy — y la leyenda diría una cosa y el cuadrito otra.
      const lectura = r.enMin ?? r.base;
      const scoreLectura = Number.isFinite(lectura.score as number) ? (lectura.score as number) : null;
      celdas.push({
        piePct: pie,
        plazoAnios: plazo,
        esActual: pie === p.piePct && plazo === p.plazoCredito,
        esElegida: false, // se marca abajo, cuando la elección ya está hecha
        veredicto: lectura.veredicto,
        score: scoreLectura,
        veredictoSinDescuento: r.base.veredicto,
        scoreSinDescuento: scoreBase,
        descuentoPct: r.pct,
        costoDiaUnoUF: costoUF,
        costoPtsPrecio: costoPts,
        alcanzable: r.pct !== null && costoPts <= MIX_COSTO_TOPE_PTS_PRECIO,
        // De la MISMA lectura que el veredicto y el score de arriba, para que las tres cosas
        // describan el mismo punto. Se dejaban caer acá; ahora se guardan.
        metricas: lectura.metricas ?? null,
      });
      if (r.pct === null || !r.enMin) continue;
      const score = r.enMin.score;
      combos.push({
        descuentoPct: r.pct,
        sinDescuento: r.sin,
        piePct: pie,
        plazoAnios: plazo,
        score: Number.isFinite(score as number) ? (score as number) : null,
        metricas: r.enMin.metricas ?? null,
        costoDiaUnoUF: costoUF,
        costoPtsPrecio: costoPts,
      });
    }
  }
  const probadas = pies.length * plazos.length;
  if (combos.length === 0) return null;

  // ── EL FILTRO DE ALCANCE ──────────────────────────────────────────────────
  // El tope va sobre el valor CON SIGNO, no sobre el absoluto. Hay combinaciones que
  // ABARATAN el día uno —el descuento achica el pie en plata más de lo que lo agranda
  // el porcentaje; el mínimo medido en el parque es −7 puntos— y con `Math.abs` esas
  // filas quedarían afuera POR BARATAS, que es exactamente al revés de lo que el tope
  // quiere hacer.
  //
  // El filtro se aplica ANTES de elegir la mejor, no después: el tope define qué
  // combinaciones son salidas reales, y ordenar primero podría coronar una que no lo es.
  const alcanzables = combos.filter((c) => c.costoPtsPrecio <= MIX_COSTO_TOPE_PTS_PRECIO);
  const dentroDelAlcance = alcanzables.length > 0;

  // LA REGLA (13-sep-2026): entre las que cruzan, la de MAYOR Franco Score; el descuento
  // desempata. Es la misma vara con la que la página declara el veredicto, así que el mix
  // no puede ofrecer una combinación que el propio informe considere peor negocio.
  //
  // Sin ninguna alcanzable se devuelve igual la MÁS BARATA de las que cruzan, con
  // `dentroDelAlcance: false`. Mismo criterio que `deltaMinimoFueraDeTope`: el número
  // existe aunque la puerta esté cerrada, y decir «costaría 30 puntos del precio» es
  // más honesto que callar. Quien decide si eso es una salida es `sinSalida`, no acá.
  const elegibles = dentroDelAlcance ? elegirCelda(alcanzables, "score") : elegirCelda(combos, "costo");
  const mejor = elegibles[0];
  const segunda = elegibles[1] ?? null;

  const soloPrecio = combos.find((c) => c.piePct === p.piePct && c.plazoAnios === p.plazoCredito) ?? null;
  // El contraste NO se filtra por alcance: mover solo el precio con el pie de hoy nunca
  // agrega capital, así que siempre es alcanzable por construcción.

  // ── ¿EL MIX AGREGA ALGO? ──────────────────────────────────────────────────
  // Si mueve UNA sola dimensión y esa palanca ya se reporta sola, el mix está repitiendo
  // una vía con otro nombre. Eso es ruido, y el render tiene que poder no dibujarlo.
  for (const c of celdas) {
    c.esElegida = c.piePct === mejor.piePct && c.plazoAnios === mejor.plazoAnios && c.descuentoPct === mejor.descuentoPct;
  }

  const movidas: ("precio" | "plazo" | "pie")[] = [];
  if (mejor.descuentoPct > 0) movidas.push("precio");
  if (mejor.piePct !== p.piePct) movidas.push("pie");
  if (mejor.plazoAnios !== p.plazoCredito) movidas.push("plazo");
  const redundanteConPalancaSola = movidas.length === 1 && p.palancasQueCruzan.includes(movidas[0]);

  return {
    celdas,
    score: mejor.score,
    despues: mejor.metricas,
    descuentoPct: mejor.descuentoPct,
    sinDescuento: mejor.sinDescuento,
    piePct: mejor.piePct,
    plazoAnios: mejor.plazoAnios,
    piePctDelta: Math.round((mejor.piePct - p.piePct) * 10) / 10,
    plazoAniosDelta: mejor.plazoAnios - p.plazoCredito,
    descuentoSoloPrecioPct: soloPrecio ? soloPrecio.descuentoPct : null,
    costoDiaUnoUF: mejor.costoDiaUnoUF,
    costoPtsPrecio: mejor.costoPtsPrecio,
    dentroDelAlcance,
    costoDiaUnoBase: "pie_declarado",
    combinacionesQueCruzan: combos.length,
    combinacionesProbadas: probadas,
    segunda: segunda
      ? {
          descuentoPct: segunda.descuentoPct,
          sinDescuento: segunda.sinDescuento,
          piePct: segunda.piePct,
          plazoAnios: segunda.plazoAnios,
          costoDiaUnoUF: segunda.costoDiaUnoUF,
          costoPtsPrecio: segunda.costoPtsPrecio,
        }
      : null,
    redundanteConPalancaSola,
    destino: p.meta,
  };
}
