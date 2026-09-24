// ─────────────────────────────────────────────────────────────────────────────
// EL MIX DE PALANCAS DEL COMPRADOR (10-sep-2026)
//
// Las cuatro palancas del hallazgo de distancia se prueban DE A UNA, "con el resto
// de los supuestos fijos". Esta pieza combina las TRES que dependen del comprador
// —precio, pie y plazo— y para cada combinación de pie × plazo devuelve el
// descuento mínimo de precio que cruza al veredicto de arriba.
//
// CUÁL DE ESAS COMBINACIONES RECOMIENDA FRANCO (24-sep-2026) — LA BANDA MÁS FÁCIL, Y DENTRO
// DE ELLA EL MEJOR NEGOCIO.
//
// La regla: entre las combinaciones que llegan a la meta y caben en el tope de capital, se toma
// la BANDA de dificultad del descuento más baja disponible —sin descuento · factible (≤5%) ·
// con argumentos (5-10%) · difícil (>10%), `banda-esfuerzo.ts`— y dentro de esa banda la de
// mayor Franco Score. El descuento, la plata del día uno, el pie y el plazo desempatan, en ese
// orden. La raíz del mix y `esElegida` describen esa celda; la leen la card «Lo que haría yo»,
// el pop-up (la celda «Franco») y el capítulo «A qué precio cerrar» (`como-lo-pagas.ts`, que se
// ancla a su precio). Una sola corona para las tres superficies.
//
// LA HISTORIA, porque esta es la tercera regla y cada una se midió:
//  · Hasta el 12-sep ganaba la de MENOR DESCUENTO (desempate: plata del día uno).
//  · El 12-sep pasó a mayor retorno sobre lo puesto (`e19d97bc`): bajaba la TIR en 9 de 10.
//  · El 13-sep pasó a MAYOR FRANCO SCORE (`b22fa085`). Medido entonces sobre 375 filas LTR y 59
//    STR contra la de menor descuento: subía el score en el 100% de las que cambiaban, la TIR
//    en el 69%, y pedía 6,1 puntos más de descuento en la mediana. Se aceptó a sabiendas.
//
// POR QUÉ SE CAMBIÓ (Fabrizio, 24-sep). El pop-up pasó a mostrar la grilla como un MAPA: cada
// celda dice cuánto descuento falta, con su banda. Con la corona por score, Franco marcaba
// celdas «difíciles» teniendo al lado otras «factibles» o sin descuento que también llegaban a
// Comprar, casi siempre por uno a tres puntos de score. El caso que lo mostró, La Reina
// (78dc0cb3): −25% con score 69 contra −1,2% con score 68 y el mismo flujo del mes. La lectura
// de Fabrizio: a igual negocio, pídele menos al vendedor; y la dificultad se lee por banda,
// porque nadie negocia décimas.
//
// LO QUE SE PIERDE, dicho en voz alta (medido 24-sep, `scripts/of-medir-celda-franco.ts`):
//  · El argumento central del 13-sep —«el mix no puede ofrecer una combinación que el propio
//    informe considere peor negocio»— deja de valer. Cambia la celda en 120 de 422 AJUSTA LTR
//    y 7 de 70 STR, y ahí la recomendada tiene 3 puntos menos de score en la mediana (máx 8).
//  · «La TIR se compra con descuento»: la recomendada compra la salida con PIE. En las que
//    cambian, el descuento baja 12,7 puntos (p50) y el pie del día uno sube UF 455 (p50); la
//    TIR baja. El flujo del mes mejora en 101 de las 120.
//  · La mejor por score sigue existiendo como RESPUESTA (`respuestas`, criterio «score») y la
//    lee el prompt de la IA, que no se toca. Ya no es la raíz: ver `coronaPorCriterio`.
//
// El score se sigue midiendo EN la celda con su descuento mínimo: si el descuento fuera libre,
// ordenar por score lo llevaría siempre al tope. Llega por la sonda ya calculado, así que este
// módulo no sabe de modalidades ni de unidades del motor. En «mejorar» (COMPRAR) no hay
// descuento: toda la grilla está en la banda cero y corona el score, como siempre.
//
// EL MENÚ DE RESPUESTAS (16-sep-2026) sale del pop-up con este cambio: el mapa las reemplaza.
// `respuestas` se sigue calculando porque el prompt lo lee.
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
import { nivelDeDescuento } from "./banda-esfuerzo";

/** Paso de la grilla del pie, en puntos. El mismo que usa `simularPieYPlazoStr`. */
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

/**
 * EL TOPE DE LA RESPUESTA DE FLUJO (16-sep-2026). Es el único que se ensancha, y solo para
 * «la que más alivia el mes».
 *
 * POR QUÉ ESTA RESPUESTA Y NINGUNA OTRA. El tope de 15 es una red de seguridad contra
 * «esto ya no es ajustar supuestos, es otra compra»: mide cuánto capital extra sigue siendo
 * una salida. La respuesta de flujo es la única que COMPRA MES CON CAPITAL —más pie es
 * menos deuda y por lo tanto mejor mes— así que es la única donde el capital extra no es un
 * peaje sino el mecanismo. Ensancharle la puerta a ella es coherente; ensancharla para
 * todas convertiría el tope en decorado.
 *
 * POR QUÉ 25 Y NO OTRO NÚMERO. Sale de la sensibilidad ya medida sobre el mínimo de las
 * filas que el tope de 15 deja afuera (ver el bloque de arriba): 16 → 10 afuera · 18 → 2 ·
 * 20 → 2 · 25 → 0. En 25 no queda ninguna fila del parque sin salida por costo. Y coincide
 * con `DIST_STR_TOPE_AJUSTA_PCT`, que ya vale 25 por su propia doctrina — pero eso es una
 * coincidencia de número, no un préstamo de argumento: este tope está en PUNTOS DEL PRECIO
 * que el comprador pone, y aquél en puntos de descuento que se le piden al vendedor.
 *
 * LA TASA NO LO HEREDA, Y ES DELIBERADO. «La que más rinde» sigue midiéndose contra los 15
 * puntos de la equilibrada, por dos razones. La primera es de lectura: la fusión se define
 * como «la corona de la tasa cae en la misma celda que la de score», y dos respuestas que
 * compiten sobre conjuntos de candidatas distintos podrían dejar de coincidir por un motivo
 * que no es el negocio sino el tope. La segunda es de coherencia: ofrecer mejor tasa a un
 * costo que la propia recomendación declara fuera de alcance es la contradicción que el
 * criterio por score se eligió para evitar.
 */
export const MIX_COSTO_TOPE_PTS_PRECIO_FLUJO = 25;

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
  /**
   * LA RECOMENDACIÓN DE FRANCO: la que corona la raíz —desde el 24-sep-2026 por banda de
   * dificultad y después score, ver la cabecera—. Exactamente una celda la lleva: es la celda
   * «Franco» del pop-up, la de la card y la del capítulo «A qué precio cerrar».
   *
   * Las otras coronas —tasa y flujo— NO entran acá; viajan en `coronaDe`. Quien quiera
   * «¿qué respuestas corona esta celda?» tiene que preguntarle a ese campo: éste contesta
   * solo por la recomendación.
   */
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
  /**
   * ¿Está dentro del tope de alcance DE LA EQUILIBRADA? Una celda cara no se ofrece por más
   * score que deje.
   *
   * ⚠ DESDE EL MENÚ DE RESPUESTAS ESTE BOOLEANO YA NO CONTESTA SOLO (16-sep-2026), y hay
   * que saberlo antes de leerlo. Se mide contra `MIX_COSTO_TOPE_PTS_PRECIO` (15) y nada
   * más, porque es el campo que viaja PERSISTIDO en las filas del parque y porque la raíz
   * entera sigue describiendo a la equilibrada. Pero la respuesta de flujo corre con su
   * propio tope de 25, así que una celda del tramo (15, 25] puede venir con
   * `alcanzable: false` y estar ofrecida en `MixPalancas.respuestas` al mismo tiempo. Las
   * dos cosas son ciertas: no cabe en el tope de la recomendación y sí cabe en el suyo.
   *
   * ⛔ LA CONSECUENCIA QUE ESTO TENÍA EN EL RENDER YA SE RESOLVIÓ (16-sep-2026), Y NO COMO
   * DECÍA ESTA ACTA. Acá quedó escrito que «quien monte el menú tiene que hacer que el color
   * y el panel pregunten por el tope de LA RESPUESTA QUE SE ESTÁ VIENDO». **Eso está mal y
   * queda derogado**, por dos razones que aparecieron al abrir el contrato:
   *
   *  · La leyenda de los DOS contratos rotula el swatch azul «llega a Comprar» —no «es una
   *    salida» ni «cabe en el tope»—, así que el color nunca fue una pregunta sobre topes y
   *    no hay ningún tope por el que deba preguntar, ni éste ni el de la respuesta elegida.
   *  · El contrato del menú pinta `cruza` las celdas que están SOBRE el tope y que su propio
   *    menú no ofrece, y su script no repinta la matriz al cambiar de respuesta: solo mueve
   *    el aro. Repintar el mapa habría roto la comparación entre respuestas, que es para lo
   *    que el menú existe.
   *
   * Lo que se hizo: `alcanzable` SALIÓ del predicado del color (`cruzaSegun`), que ahora
   * pregunta solo por la palabra que la celda escribe. Quién es una salida lo dice el menú,
   * que lista las respuestas por su nombre. Y el panel dejó de escribir «no llega a Comprar»
   * sobre una celda que llega: ahora declara el descuento y cuelga del pie la nota de que
   * pide más capital del que la recomendación pone.
   *
   * Quien quiera saber si una celda cabe para una respuesta concreta, la fuente es
   * `RespuestaMix.dentroDeSuTope`, que viaja con su tope declarado al lado.
   */
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
  /**
   * LOS CRITERIOS QUE CORONAN ESTA CELDA (16-sep-2026). Vacío en las que no corona ninguno.
   *
   * ⛔ DESDE EL 24-sep-2026 YA NO ES REDUNDANTE CON `esElegida`. Hasta ese día valía
   * `esElegida` ⟺ `coronaDe.includes("score")`, porque la raíz coronaba por score. Ahora la
   * raíz corona por banda y después score, y `coronaDe: ["score"]` marca la de MEJOR SCORE, que
   * solo lee el prompt. Pueden caer en celdas distintas (120 de 422 filas AJUSTA LTR, medido).
   *
   * Se conservan las dos porque contestan preguntas distintas y tienen dueños distintos.
   * `esElegida` es el booleano que ya viaja PERSISTIDO en las filas del parque y del que
   * cuelga la tinta plena del pop-up —el contrato del menú fija que «el fondo de tinta no
   * se mueve: marca siempre lo que Franco recomienda»—, así que convertirlo en rol obligaría
   * a un adaptador de lectura por celda sobre filas ya escritas, y el repo no tiene ningún
   * molde de esa migración. `coronaDe` es el dato nuevo: qué OTRAS respuestas encender
   * cuando el usuario elige otra opción del menú.
   *
   * O sea: si alguna vez parecen contradecirse, la pregunta no es cuál revertir sino cuál
   * de las dos preguntas se está haciendo. `esElegida` no se deriva de acá ni al revés: las
   * dos las escribe el motor en la misma pasada, con la misma celda.
   *
   * Ausente en filas recomputadas antes de esta fecha.
   */
  coronaDe?: CriterioRespuesta[];
};

/**
 * LOS TRES CRITERIOS QUE PUEDEN CORONAR, en el orden en que el contrato del menú los pinta
 * (`docs/wireframes/rediseno-informe/popup-menu-respuestas.html`): «Lo que Franco
 * recomienda» · «La que más rinde» · «La que más alivia el mes».
 *
 * `costo` NO está acá, y la distinción importa: `costo` no es una respuesta, es el narrador
 * del borde —el criterio con el que se reporta cuánto costaría la más barata cuando NINGUNA
 * celda está dentro del alcance—. Ver `elegirCelda`.
 */
export type CriterioRespuesta = "score" | "tir" | "flujo";

/**
 * UNA RESPUESTA DEL MENÚ (16-sep-2026).
 *
 * LA VARA ÚNICA ES PARA EL VEREDICTO, NO PARA EL CONSEJO. Franco juzga con UNA SOLA VARA
 * —el Franco Score, la misma con la que la página declara el veredicto— y por eso la
 * respuesta por score sigue siendo el default y sigue describiéndose en la RAÍZ de
 * `MixPalancas`. Lo que cambia es que, hecho el juicio, Franco muestra que hay más de un
 * camino para llegar ahí: la misma grilla contestada con otras dos preguntas que el lector
 * se hace de verdad —¿cuál rinde más? ¿cuál me cierra el mes?— y que el score, que las
 * pondera juntas, no puede contestar por separado.
 *
 * Esto NO deroga el acta de por qué se eligió el score (arriba, 13-sep-2026). Aquella
 * decidía con qué vara se CORONA la recomendación, y sigue vigente palabra por palabra.
 * Ésta decide qué más se MUESTRA al lado, sin mover la corona.
 *
 * Cada respuesta declara su propio tope porque hay dos en juego y un consumidor que tenga
 * que adivinar cuál se aplicó lo va a adivinar mal — el mismo argumento que ya obligó a
 * declarar `costoDiaUnoBase`.
 */
export type RespuestaMix = {
  criterio: CriterioRespuesta;
  /**
   * Los OTROS criterios que coronan esta misma celda. Vacío ⇒ la respuesta va sola.
   *
   * LA FUSIÓN LA RESUELVE EL MOTOR, no el render: si cada superficie tuviera que volver a
   * comparar celdas para saber si dos respuestas son la misma, dos superficies terminarían
   * fusionando distinto — que es exactamente lo que pasó cuando el destino del mix se
   * dejaba derivar (ver `MixPalancas.destino`). El motor emite el dato; la prosa lo redacta.
   *
   * Es simétrico por construcción: si la de score nombra a la de tasa, la de tasa nombra a
   * la de score.
   */
  fusionadaCon: CriterioRespuesta[];
  /** La celda coronada, con las mismas tres coordenadas que identifican a una celda. */
  piePct: number;
  plazoAnios: number;
  descuentoPct: number;
  /** true ⇔ pie y plazo solos ya cruzan. Mismo significado que en la raíz. */
  sinDescuento: boolean;
  piePctDelta: number;
  plazoAniosDelta: number;
  costoDiaUnoUF: number;
  costoPtsPrecio: number;
  /**
   * EL TOPE QUE SE LE APLICÓ A ESTA RESPUESTA, en puntos del precio. 15 para la equilibrada
   * y para la tasa; 25 para la de flujo (ver `MIX_COSTO_TOPE_PTS_PRECIO_FLUJO`). Viaja
   * declarado y no supuesto: con dos topes vivos, suponerlo es adivinarlo.
   */
  topePtsPrecio: number;
  /** ¿Cabe en SU tope? No es lo mismo que `dentroDelAlcance` de la raíz, que contesta
   *  siempre por la equilibrada y por los 15 puntos. */
  dentroDeSuTope: boolean;
  /** El score de la celda coronada. Viaja también en la respuesta de flujo y en la de tasa,
   *  porque el contrato muestra las tres con su cifra y la recomendada con la suya. */
  score: number | null;
  /** Las cifras de la celda coronada: el lado «después» de los pares, por respuesta. */
  metricas: MetricasCelda | null;
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
 *  · `tir` — la que más rinde. Desde el menú de respuestas (16-sep-2026).
 *  · `flujo` — la que más alivia el mes. Desde el menú de respuestas (16-sep-2026).
 *  · `costo` — la más barata en puntos del precio. Es el criterio del borde donde NINGUNA
 *    celda está dentro del alcance: ahí no se está eligiendo un plan sino reportando cuánto
 *    costaría el más barato, y el retorno de una salida que no existe no significa nada.
 *
 * ⚠ TRES SON RESPUESTAS Y UNO ES EL NARRADOR, y la distinción no es cosmética. `score`,
 * `tir` y `flujo` coronan celdas que se le OFRECEN al lector: cada una contesta una
 * pregunta distinta sobre la misma grilla y cada una viaja en `MixPalancas.respuestas` con
 * su propio tope. `costo` no se ofrece nunca: es con lo que se reporta cuánto costaría la
 * salida más barata cuando ninguna cabe. Quien lea esta unión como «cuatro criterios
 * equivalentes» va a terminar ofreciendo el borde como si fuera un plan.
 */
export type CriterioEleccion = CriterioRespuesta | "costo" | "franco";

/**
 * EL VALOR CON EL QUE COMPITE CADA CRITERIO. `null` ⇒ esa celda no puede contestar esa
 * pregunta y se ordena al final; nunca corona.
 *
 * ⚠ ACÁ VIVE LA EXCEPCIÓN DE `SondaMix.metricas`, VIVA Y NO ABANDONADA. El campo es
 * opcional a propósito —«los catch-tests y los censos sondean sin métricas y el módulo no
 * las necesita para elegir»— y eso dejó de ser cierto para dos de los tres criterios: el
 * flujo y la TIR SÍ las necesitan. La salida no es volver el campo obligatorio, que
 * pondría en rojo los nueve arneses que sondean sin métricas y borraría una invariante que
 * alguien escribió con su razón. La salida es la que el propio módulo ya usaba para el
 * score: una celda sin el número no le gana a una que lo tiene, se va al final, y si es la
 * única que hay entonces ese criterio simplemente no tiene respuesta que ofrecer.
 */
const VALOR_DEL_CRITERIO: Record<CriterioRespuesta, (c: Combinacion) => number | null> = {
  score: (c) => c.score,
  tir: (c) => c.metricas?.tirPct ?? null,
  flujo: (c) => c.metricas?.flujoMensual ?? null,
};

export function elegirCelda<T extends Combinacion>(xs: readonly T[], criterio: CriterioEleccion): T[] {
  // «franco» compite por el score DENTRO de su banda: el valor es el del score.
  const valor = criterio === "costo" ? null : VALOR_DEL_CRITERIO[criterio === "franco" ? "score" : criterio];
  const porValor = (a: T, b: T) => {
    if (!valor) return 0;
    // null al final: sin número no se compite (filas legacy sin métricas recomputables, y
    // celdas sondeadas sin métricas a propósito).
    const va = valor(a);
    const vb = valor(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  };

  // EL DESEMPATE APORTA LO QUE EL CRITERIO NO MIRA (16-sep-2026).
  //
  // Hasta el menú de respuestas había un solo criterio de respuesta y un solo desempate:
  // descuento mínimo primero, porque el descuento es lo que hay que pedirle a un tercero y
  // es lo escaso. Ese argumento NO es universal, y la diferencia se mide:
  //
  //  · SCORE ya trae el capital adentro —pondera flujo, retorno sobre lo puesto y TIR
  //    juntas— así que un empate de score es un empate en el que la plata ya se contó. Su
  //    desempate queda libre para gastarse en lo escaso. No se mueve.
  //  · TIR es un retorno SOBRE lo puesto: tampoco es ciega al capital. Mismo desempate.
  //  · FLUJO mira SOLO el mes. Es ciega al capital, y por eso su desempate tiene que
  //    aportarlo: entre dos celdas que dejan el MISMO mes, corona la que pide menos plata
  //    el día uno. Medido sobre el parque, con el tope de flujo en 25: el empate de flujo
  //    aparece en 6 filas, en 3 de ellas los dos órdenes eligen celdas distintas, y ahí
  //    «descuento primero» coronaba celdas que costaban 154, 318 y 573 UF más por el mismo
  //    mes. Una respuesta que se vende como «la que más alivia el mes» no puede cobrar eso.
  //
  // Y `plazoAnios` cierra los cuatro (16-sep-2026). El acta de arriba decía que el
  // desempate existe «para que el resultado no dependa del recorrido de la grilla», y eso
  // era casi cierto: dos celdas iguales en todo salvo el plazo empataban del todo y ganaba
  // la que el bucle insertó primero. Medido: pasa en 4 de 346 filas, y en las 4 gana el
  // plazo MENOR, que es lo mismo que elige esta clave —menos plazo es menos interés a
  // igualdad de todo lo demás—. O sea que declararlo cambia CERO filas y convierte un
  // determinismo por accidente en uno por regla.
  //
  // UN SOLO ORDENAMIENTO, Y ES UNA INVARIANTE CON GATE: el invariante 6 de
  // `mix-score-catch-test.ts` cuenta las llamadas a ordenar que hay en este archivo y da
  // rojo con más de una, porque la elección ya estuvo repartida en dos y podían derivar
  // por su lado. Por eso el criterio elige el COMPARADOR y no el camino: cuatro criterios,
  // una sola llamada. (Y el guard mira el texto crudo, así que este comentario tampoco
  // puede nombrar la llamada con su sintaxis: ya se pagó esa vez.)
  const cmp: (a: T, b: T) => number =
    criterio === "costo"
      ? // EL BORDE: no es una respuesta, es el narrador. Se ordena por plata y no por
        // negocio, porque acá no se elige un plan sino que se reporta cuánto costaría el
        // más barato, y el retorno de una salida que no existe no significa nada.
        (a, b) => a.costoPtsPrecio - b.costoPtsPrecio || a.descuentoPct - b.descuentoPct || a.piePct - b.piePct || a.plazoAnios - b.plazoAnios
      : criterio === "flujo"
        ? (a, b) => porValor(a, b) || a.costoDiaUnoUF - b.costoDiaUnoUF || a.descuentoPct - b.descuentoPct || a.piePct - b.piePct || a.plazoAnios - b.plazoAnios
        : criterio === "franco"
          ? // LA RECOMENDACIÓN (24-sep-2026): primero la BANDA de dificultad más baja (sin
            // descuento · factible · con argumentos · difícil), y dentro de ella el mejor score.
            // El resto del desempate es el mismo del score. Ver el acta de la cabecera.
            (a, b) => nivelDeDescuento(a.descuentoPct) - nivelDeDescuento(b.descuentoPct) || porValor(a, b) || a.descuentoPct - b.descuentoPct || a.costoDiaUnoUF - b.costoDiaUnoUF || a.piePct - b.piePct || a.plazoAnios - b.plazoAnios
          : (a, b) => porValor(a, b) || a.descuentoPct - b.descuentoPct || a.costoDiaUnoUF - b.costoDiaUnoUF || a.piePct - b.piePct || a.plazoAnios - b.plazoAnios;
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
  /**
   * QUÉ PREGUNTA CONTESTA LA GRILLA (15-sep-2026).
   *
   * · «cruzar» (default, y lo único que existía): el caso está DEBAJO de la meta y la grilla
   *   busca cuánto hace falta para llegar. Hay un umbral, así que hay un descuento mínimo
   *   que biseccionar y un tope de capital que define qué es una salida real.
   *
   * · «mejorar»: el caso YA está en la meta —COMPRAR— y la pregunta es otra: cómo queda cada
   *   opción. Sin umbral, «cuánto descuento pedir» no tiene respuesta honesta —cualquier
   *   descuento mejora y el máximo sería «todo el que consigas», que no es un consejo—, así
   *   que el eje del precio desaparece. Lo que queda es pie × plazo, y con eso cambian tres
   *   cosas que son la misma decisión: el pie baja un escalón, el plazo deja de filtrarse a
   *   los ≥ declarado, y el tope de alcance no aplica. Cada una está argumentada en su sitio.
   */
  modo?: "cruzar" | "mejorar";
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
  const mejorar = p.modo === "mejorar";
  const pies: number[] = [p.piePct];
  if (p.pieCalifica) {
    for (let x = p.piePct + MIX_PIE_PASO_PCT; x <= p.pieTopePct; x += MIX_PIE_PASO_PCT) pies.push(x);
    // ── UN ESCALÓN HACIA ABAJO, Y SOLO EN «MEJORAR» (15-sep-2026) ───────────
    //
    // La doctrina de arriba —«hacia abajo no se explora porque menos pie empeora el mes»—
    // vale para CRUZAR: ahí la grilla propone un plan para llegar, y proponer menos pie
    // sería una recomendación al revés. Con la meta ya alcanzada la pregunta es otra:
    // menos pie es menos capital inmovilizado, y eso es una opción legítima.
    //
    // UN escalón, no hasta el piso, y está medido: sobre las 160 filas COMPRAR del parque,
    // un escalón mejora la TIR en 142 (88,8%) con p50 +2,5 puntos y techo +10,5; bajando
    // hasta el piso la mediana salta a +11 y el techo a +120,7, y la mejor TIR cae en pie
    // 5% en el 81,1% de los casos. Eso ya no es un mejor negocio, es apalancamiento, y la
    // grilla se volvería una máquina de proponerlo. Un escalón lo deja adentro en una
    // magnitud comparable con lo que mueven los otros criterios.
    if (mejorar && p.piePct - MIX_PIE_PASO_PCT > 0) pies.unshift(p.piePct - MIX_PIE_PASO_PCT);
  }
  // Plazo: solo hacia arriba y solo lo que el wizard acepta. Si ya está en el máximo, la
  // grilla queda de una columna y el mix se reduce a las otras dos palancas — es el borde
  // que `redundanteConPalancaSola` tiene que poder declarar.
  //
  // EN «MEJORAR» NO SE FILTRA (15-sep-2026). Acortar el plazo sube la cuota, así que para
  // cruzar va al revés y por eso se recorta; sin umbral que cruzar es una opción como
  // cualquier otra —más cuota, menos interés total— y es la grilla que se midió.
  const plazosArriba = mejorar ? [...MIX_PLAZOS_WIZARD] : MIX_PLAZOS_WIZARD.filter((a) => a >= p.plazoCredito);
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
    // ⚠ EN «MEJORAR» NO SE BISECCIONA NUNCA, Y ESTO NO ES UNA OPTIMIZACIÓN (15-sep-2026).
    //
    // Con la meta alcanzada uno esperaría que la salida temprana de abajo cubriera todo —si
    // la celda ya está en COMPRAR, no hay descuento que buscar—. Pero el pie baja un escalón
    // y el plazo puede acortarse, así que HAY celdas que a precio de hoy NO alcanzan: medido
    // sobre el parque, 51 de 160 filas tienen alguna. Sin este corte, esas celdas caían a la
    // bisección y volvían con un descuento —48 filas del parque lo hacían— o sea que la
    // grilla de COMPRAR terminaba pidiendo plata al vendedor justo donde la decisión dice
    // que no hay nada honesto que pedir. Y peor: esa celda mostraría «Comprar» —su lectura
    // en el descuento— en vez de decir que te saca del veredicto, que es el hecho.
    //
    // Toda la grilla se lee a precio de HOY. La que cae, lo dice.
    if (mejorar) return { pct: 0, sin: true, base, enMin: base };
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
      //
      // ⚠ CON UNA EXCEPCIÓN, Y ESTÁ ACÁ PARA QUE NADIE LA DESHAGA (14-sep-2026).
      //
      // Lo de arriba vale para las celdas que PROMETEN: se leen como «si consigo esto». NO
      // vale para la celda del caso base, la que el render marca con el aro de «hoy»: esa el
      // usuario la lee como «mi situación», y mostrarle su lectura con descuento la hacía
      // decir «Comprar» sobre un caso que la misma página declara «Ajustar». Medido sobre el
      // parque: 501 de 739 filas, y el 100% de las 360 que el pop-up efectivamente dibuja.
      //
      // El motor NO cambia: sigue emitiendo las dos lecturas por celda, que es lo correcto.
      // Quien elige cuál mostrar es el render, y desde el 14-sep la celda del aro muestra
      // `veredictoSinDescuento` / `scoreSinDescuento` mientras las demás muestran estas.
      // La matriz lo declara en su subtítulo y con un chip en la celda, porque dos lecturas
      // calladas en la misma grilla es exactamente lo que hizo falta arreglar dos veces.
      //
      // O sea: las dos decisiones son correctas y son de celdas distintas. Si alguna vez
      // parecen contradecirse, la pregunta no es cuál revertir sino cuál celda se está
      // mirando.
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
        coronaDe: [], // se llena abajo, con las coronas ya resueltas
      });
      if (r.pct === null || !r.enMin) continue;
      // ⛔ EN «MEJORAR», UNA CELDA QUE PERDIÓ EL VEREDICTO NO ES UNA RESPUESTA (17-sep-2026).
      //
      // `explorarCelda` corta arriba y devuelve `pct: 0` para TODAS, así que sin esta línea
      // entran a `combos` también las celdas que a precio de hoy ya no sostienen la meta —las
      // que abrió el pie un escalón abajo—, y de `combos` salen las tres coronas del menú.
      // `elegirCelda(…, "tir")` coronaba la de pie más bajo sin preguntar qué veredicto tiene.
      //
      // Medido antes del arreglo: 8 de 138 filas COMPRAR con menú (5,8%) ofrecían bajo «La que
      // más rinde» —y bajo una bajada que dice «Las dos siguen en Comprar»— una celda que la
      // leyenda de la misma matriz marca como caída. Y en un empate de score la raíz podía caer
      // ahí también, que es peor: la raíz es la que describen los campos planos del mix, o sea
      // lo que lee TODO lo que no sea el menú. (La frase anterior decía «veinte consumidores
      // fuera de este pop-up» y era del otro modo: en «mejorar» la raíz es `mixComprar`, que
      // hoy leen los dos heros y nadie más. El riesgo es el mismo; el alcance no era ese.)
      //
      // LA CELDA SIGUE DIBUJÁNDOSE. Bajar el pie te saca de Comprar y eso es información real:
      // por eso entró al modo «mejorar» y por eso la leyenda tiene una entrada para el gris. Lo
      // que no puede es ser una RESPUESTA. Son dos preguntas con dos superficies —el color dice
      // qué pasa, el menú dice qué hacer— y es la misma separación con la que el azul huérfano
      // convive con un menú que no lo ofrece.
      //
      // ⚠ NO VACÍA `combos` — PERO LA GARANTÍA ES MEDIDA, NO ESTRUCTURAL, y la primera
      // versión de este acta decía «por construcción». El argumento era que la celda del caso
      // declarado sostiene el veredicto: cierto cuando esa celda EXISTE, y hay 8 filas COMPRAR
      // del parque donde no existe, porque su plazo declarado no está en {20, 25, 30} y la
      // grilla no lo incluye. En esas la garantía descansa en que alguna otra celda sostenga
      // el veredicto, que es un hecho del caso y no del código.
      // Medido: `combos` queda vacío en 0 de 217 filas COMPRAR con grilla. Si algún día no
      // fuera 0, `calcularMixPalancas` devolvería null y la matriz entera dejaría de dibujarse
      // —no se rompe nada, pero se pierde una pieza sin avisar—. El catch-test lo fija sobre
      // el fixture que modela la caída; el parque lo confirma.
      if (mejorar && !alcanza(lectura.veredicto)) continue;
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
  //
  // Y EN «MEJORAR» NO APLICA (15-sep-2026). El tope significa «cuánto capital extra sigue
  // siendo una salida», y con la meta ya alcanzada no hay salida que buscar: filtrar por él
  // sería recortar opciones con la vara de una pregunta que nadie hizo. Medido sobre las 160
  // filas COMPRAR: muerde en 14 (8,8%) —las del pie declarado bajo 15, que es la condición
  // exacta porque `costoPtsPrecio` es el pie menos el declarado— y en LAS 14 cambia la corona
  // del flujo, en 8 la del score y en NINGUNA la de la TIR: el tope solo recortaba por arriba
  // y la TIR mira al revés. O sea que le estaba escondiendo al flujo justo sus mejores celdas.
  const alcanzables = mejorar ? combos : combos.filter((c) => c.costoPtsPrecio <= MIX_COSTO_TOPE_PTS_PRECIO);
  const dentroDelAlcance = alcanzables.length > 0;

  // LA REGLA (24-sep-2026, reemplaza la del 13-sep): entre las que cruzan, la de la BANDA de
  // dificultad más baja disponible, y dentro de ella la de mayor Franco Score. Ver el acta de
  // la cabecera. En «mejorar» (COMPRAR) no hay descuento que clasificar y sigue el score: toda
  // la grilla está en la banda cero.
  //
  // Sin ninguna alcanzable se devuelve igual la MÁS BARATA de las que cruzan, con
  // `dentroDelAlcance: false`. Mismo criterio que `deltaMinimoFueraDeTope`: el número
  // existe aunque la puerta esté cerrada, y decir «costaría 30 puntos del precio» es
  // más honesto que callar. Quien decide si eso es una salida es `sinSalida`, no acá.
  const elegibles = dentroDelAlcance ? elegirCelda(alcanzables, mejorar ? "score" : "franco") : elegirCelda(combos, "costo");
  const mejor = elegibles[0];
  const segunda = elegibles[1] ?? null;

  // ── EL MENÚ DE RESPUESTAS ──────────────────────────────────────────────────
  //
  // La MISMA grilla contestada con tres preguntas distintas. La primera es la que ya
  // estaba —la vara con la que la página declara el veredicto— y sigue siendo la que
  // describen los campos planos de la raíz. Las otras dos se agregan al lado.
  //
  // LA FUSIÓN SE RESUELVE ACÁ Y NO EN EL RENDER. Si cada superficie tuviera que volver a
  // comparar celdas para saber si dos respuestas son la misma, dos superficies terminarían
  // fusionando distinto — es la lección que ya costó una vez, cuando el destino del mix se
  // dejaba derivar y la misma tarjeta publicó dos descuentos del mismo precio.
  const TOPE_DE_LA_RESPUESTA: Record<CriterioRespuesta, number> = {
    score: MIX_COSTO_TOPE_PTS_PRECIO,
    tir: MIX_COSTO_TOPE_PTS_PRECIO,
    flujo: MIX_COSTO_TOPE_PTS_PRECIO_FLUJO,
  };
  const laMisma = (a: Combinacion, b: Combinacion) =>
    a.piePct === b.piePct && a.plazoAnios === b.plazoAnios && a.descuentoPct === b.descuentoPct;

  const coronaPorCriterio = (criterio: CriterioRespuesta): Combinacion | null => {
    // ⚠ DESDE EL 24-sep-2026 LA RESPUESTA «score» YA NO ES LA RAÍZ. La raíz corona por banda
    // y después score (la recomendación); esta respuesta sigue siendo «la de mejor score», que
    // el pop-up ya no muestra pero el PROMPT sí lee (`caminosQueAbren.recomendado`), y Fabrizio
    // decidió no tocar el prompt: la IA sale del informe. En el borde sin alcanzables y en
    // «mejorar» las dos coinciden con `mejor`, como antes.
    if (criterio === "score") return !dentroDelAlcance || mejorar ? mejor : elegirCelda(alcanzables, "score")[0];
    const caben = combos.filter((c) => c.costoPtsPrecio <= TOPE_DE_LA_RESPUESTA[criterio]);
    if (caben.length === 0) return null;
    const primera = elegirCelda(caben, criterio)[0];
    // Sin el número del criterio no hay respuesta: la celda se ordenó al final y coronarla
    // sería contestar una pregunta con un dato que no existe.
    return VALOR_DEL_CRITERIO[criterio](primera) == null ? null : primera;
  };

  const ORDEN_DEL_CONTRATO: CriterioRespuesta[] = ["score", "tir", "flujo"];
  const coronas = ORDEN_DEL_CONTRATO.map((criterio) => ({ criterio, celda: coronaPorCriterio(criterio) })).filter(
    (x): x is { criterio: CriterioRespuesta; celda: Combinacion } => x.celda !== null,
  );
  const respuestas: RespuestaMix[] = coronas.map(({ criterio, celda }) => ({
    criterio,
    fusionadaCon: coronas.filter((o) => o.criterio !== criterio && laMisma(o.celda, celda)).map((o) => o.criterio),
    piePct: celda.piePct,
    plazoAnios: celda.plazoAnios,
    descuentoPct: celda.descuentoPct,
    sinDescuento: celda.sinDescuento,
    piePctDelta: Math.round((celda.piePct - p.piePct) * 10) / 10,
    plazoAniosDelta: celda.plazoAnios - p.plazoCredito,
    costoDiaUnoUF: celda.costoDiaUnoUF,
    costoPtsPrecio: celda.costoPtsPrecio,
    topePtsPrecio: TOPE_DE_LA_RESPUESTA[criterio],
    dentroDeSuTope: celda.costoPtsPrecio <= TOPE_DE_LA_RESPUESTA[criterio],
    score: celda.score,
    metricas: celda.metricas,
  }));

  const soloPrecio = combos.find((c) => c.piePct === p.piePct && c.plazoAnios === p.plazoCredito) ?? null;
  // El contraste NO se filtra por alcance: mover solo el precio con el pie de hoy nunca
  // agrega capital, así que siempre es alcanzable por construcción.

  // ── ¿EL MIX AGREGA ALGO? ──────────────────────────────────────────────────
  // Si mueve UNA sola dimensión y esa palanca ya se reporta sola, el mix está repitiendo
  // una vía con otro nombre. Eso es ruido, y el render tiene que poder no dibujarlo.
  for (const c of celdas) {
    c.esElegida = c.piePct === mejor.piePct && c.plazoAnios === mejor.plazoAnios && c.descuentoPct === mejor.descuentoPct;
    // Las DOS marcas se escriben en la misma pasada y sobre la misma celda: `esElegida` es
    // la tinta plena que no se mueve —el contrato fija que marca siempre lo que Franco
    // recomienda— y `coronaDe` es qué otras respuestas encender cuando el lector elige otra
    // opción del menú. Son redundantes en «score» a propósito; ver el tipo.
    c.coronaDe = coronas
      .filter((x) => c.piePct === x.celda.piePct && c.plazoAnios === x.celda.plazoAnios && c.descuentoPct === x.celda.descuentoPct)
      .map((x) => x.criterio);
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
    respuestas,
    redundanteConPalancaSola,
    destino: p.meta,
  };
}
