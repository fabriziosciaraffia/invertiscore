// ─────────────────────────────────────────────────────────────────────────────
// «HAY SALIDA, Y ES ÉSTA» — la fuente única de las superficies que la nombran (10-sep-2026)
//
// El motor sabe desde `bece47c1` que hay filas estructurales que IGUAL tienen salida
// moviendo pie y plazo. Nadie leía ese campo, así que ocho lugares del informe seguían
// afirmando lo contrario — el peor, el pop-up: «la brecha no está en cómo estás mirando
// este depto, está en el depto», a dos clics del bloque que muestra la salida. Una
// contradicción dentro de la misma página destruye la confianza en las dos mitades.
//
// ⛔ LAS DOS CIFRAS DEL TÍTULO ESTABAN STALE, y las dos por razones distintas (17-sep-2026):
//
//  · «179 FILAS» era del 10-sep. **Remedido el 17-sep: 45** (LTR 37 · STR 8; de ellas 32 con
//    menú de respuestas). La caída NO es del motor: el 17-sep `hayAjustesQueMostrar` dejó de
//    contar `palancas` y pasó a contar las que llegan a COMPRAR, y con eso el pop-up dejó de
//    dibujarse en 237 filas. El número describe el parque de ESA fecha y va a volver a
//    moverse; lo que no caduca es la razón por la que este módulo existe —que ocho lugares
//    decían lo contrario del mismo hecho—, no el conteo.
//
//  · «OCHO SUPERFICIES» hoy son CATORCE, y **cinco de ellas están muertas**: no tienen
//    ningún nodo en el DOM de producción. Están inventariadas con su porqué en la cola de
//    salidas huérfanas; no se tocan desde acá.
//
// Este módulo existe para que esa rama se lea de UN lugar. Ocho `if` con la misma
// condición escrita ocho veces vuelven a divergir; ya divergieron una vez.
//
// ⚠ LA CONDICIÓN LLEVA LAS DOS MITADES, y omitir la primera es un desastre silencioso:
// `sinSalida` es `esEstructural && !alcanzable`, así que en una fila NORMAL —donde algo
// cruza solo— `sinSalida` también es `false`. Preguntar solo por `sinSalida === false`
// manda a las filas sanas por la rama de la salida combinada. Medido mientras se escribía
// esto: 778 filas contra las 179 reales.
//
// VOCABULARIO: nada de «palanca», «vía», «por sí sola», «brecha» ni «supuesto» en lo que
// sale de acá. Son palabras nuestras. El lector dice «cambio», «por separado», «a la vez».
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto } from "./types";
import type { RespuestaMix } from "./mix-palancas";
import type { MixPalancas } from "./types";

export interface SalidaPorMix {
  /** Lo que hay que mover, en palabras del lector: «el pie en 30% y el plazo en 30 años». */
  movimiento: string;
  /** El gerundio para rematar una frase: «moviendo dos cosas a la vez» · «subiendo el pie». */
  remate: string;
  /** El descuento que ADEMÁS pide, en % positivo, o null si no pide ninguno. */
  descuentoPct: number | null;
  /** Plata propia extra el día uno, en UF. */
  costoDiaUnoUF: number;
  /** Qué dimensiones mueve: el copy STR dice «lo tuyo —pie y plazo—» / «—el pie—». */
  mueve: ("pie" | "plazo")[];
  /**
   * ¿EL MOTOR ENCONTRÓ MÁS DE UN CAMINO? (17-sep-2026)
   *
   * Los cinco campos de arriba describen UNA combinación —la equilibrada, la que el menú
   * llama «Lo que Franco recomienda»— porque cuando se escribieron había una sola. Desde el
   * menú de respuestas hay hasta tres, y eso deja a los cinco campos diciendo algo cierto
   * sobre un camino como si fuera el único.
   *
   * Medido sobre el parque el 17-sep: de las 45 filas donde este módulo emite, **32 tienen
   * más de un camino**. En esas 32, `movimiento` y `costoDiaUnoUF` describen la equilibrada y
   * el menú ofrece otras coordenadas y otros costos (28 filas con dos costos distintos, 4 con
   * tres). No son falsos: son incompletos, y lo que les faltaba era poder decirlo.
   *
   * ⚠ QUIÉN PONE EL CUALIFICADOR: LA SUPERFICIE, NO EL CAMPO. El PDF, la comparativa y el
   *   share NO tienen menú, así que el campo no puede decidir por ellos cuánto contar. Este
   *   booleano dice si HAY otros caminos; qué hacer con eso lo decide cada superficie, y las
   *   que no tienen dónde elegir lo usan solo para nombrar cuál están describiendo.
   *
   * ⛔ `null` = NADIE LO MIDIÓ, y no es `false`. `respuestas` viaja PERSISTIDO y es opcional:
   *   las filas anteriores al menú lo traen AUSENTE, y en STR el recompute cae a lo
   *   persistido, así que existen hoy. Leer ese `undefined` como «no hay otros caminos» haría
   *   que el ksub del capítulo escribiera «SOLO con pie y plazo» —una afirmación de
   *   exclusividad— sobre un campo que nadie calculó: el bug que este goal vino a matar,
   *   entrando por la puerta del default. Es lo que `types.ts` declara para este campo
   *   («AUSENTE ≠ VACÍO») y lo que el pop-up ya aplicó con `Array.isArray` en vez de `?? []`.
   *   Lo encontró la revisión adversaria del diff, no las mutaciones.
   *
   * ⚠ Y NO ES «¿EL POP-UP DIBUJA MENÚ?». Acá se pregunta por el MOTOR: cuántas combinaciones
   *   distintas encontró. El pop-up ADEMÁS exige tener grilla para dibujar el menú, así que
   *   los dos pueden diferir — y la diferencia es del pop-up, no de este campo.
   *
   *   MEDIDA, para que nadie la suponga grande: de las 45 filas, **1 sola** tiene otros
   *   caminos sin menú visible. En esa fila el cualificador nombra el plan, no una línea de
   *   pantalla, y eso está bien: las tres superficies que lo usan —los dos PDF y la línea de
   *   comparativa y share— no dibujan el pop-up en ningún caso.
   */
  hayOtrosCaminos: boolean | null;
}

/** Lo que el hallazgo STR necesita para decidir la combinación: el tipo mínimo, para que el
 *  builder pueda preguntarlo ANTES de armar el valor completo. */
export type ValorParaSalidaStr = Pick<HallazgoDistanciaVeredicto["valor"], "esEstructural" | "veredictoBase" | "mixPalancas" | "mixPalancasHastaComprar">;

const pct1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/**
 * ¿Este caso tiene salida combinando, aunque ningún cambio por separado alcance?
 *
 * `null` en los tres casos en que el informe NO puede afirmar que la hay:
 *   · la fila no es estructural — hay una salida más simple y ya se cuenta en otro lado;
 *   · `sinSalida` dice que no la hay;
 *   · `sinSalida` está AUSENTE, o sea que nadie lo midió. Ahí se conserva el texto viejo,
 *     que es lo que esa fila viene publicando: no se cambia una afirmación infundada por
 *     otra igual de infundada. Hoy son 0 filas del parque, pero el borde se escribe igual.
 */
export function salidaPorMix(v: HallazgoDistanciaVeredicto["valor"]): SalidaPorMix | null {
  if (!v.esEstructural) return null;
  if (typeof v.sinSalida !== "boolean" || v.sinSalida) return null;
  const m = v.mixPalancas;
  if (!m || !m.dentroDelAlcance) return null;
  return desdeMix(m);
}

/**
 * CUÁNTOS CAMINOS ABREN (17-sep-2026) — el número del que cuelga la doctrina del prompt.
 *
 * LA REGLA QUE IMPLEMENTA, y que es de producto: **Franco puede cerrar la puerta, pero solo
 * cuando NINGUNA respuesta abre.** «Ni bajando el precio ni poniendo más pie esto cierra» es
 * igual de contundente que «UF 1.839 es tu techo real» y no la desmiente nadie.
 *
 * ⚠ DOS LLAVES QUE SE PARECEN, Y NO GOBIERNAN LO MISMO. El bloque del prompt lleva las dos:
 *
 *   · `hayMixACOMPRAR` (de `salidaPorMix`) contesta UNA pregunta estrecha: «en una fila donde
 *     ningún cambio por separado alcanza, ¿la combinación EQUILIBRADA —la de tope 15 puntos—
 *     es la salida?». Solo existe en filas `esEstructural`. La lee el guard
 *     `niegaSalidaConMix` por su gate (`- hayMixACOMPRAR: sí`) y la usa el bloque STR. NO se
 *     toca: sacarla es otro cambio y no hace falta para esto.
 *
 *   · `caminosQueAbren` (esta función) contesta la ANCHA: ¿cuántas formas hay, en total, de
 *     mover el veredicto? Suma las que alcanzan por separado y las de la grilla que caben en
 *     SU tope. Existe en todas las filas. **De ésta, y solo de ésta, cuelga si se puede
 *     cerrar la puerta.**
 *
 *   Dicho al revés por si alguien las confunde: `hayMixACOMPRAR: no` NO autoriza a cerrar.
 *   Autoriza `caminosQueAbren: 0`.
 *
 * QUÉ CUENTA, y por qué no cuenta dos veces lo mismo:
 *  · las vías con `estado: "cruza"` — cada una alcanza sola;
 *  · más las respuestas del menú con `dentroDeSuTope`, deduplicadas por COORDENADA (la misma
 *    tripleta con la que el motor fusiona: pie, plazo y descuento), que es lo que hace el
 *    campo `hayOtrosCaminos` y por la misma razón — contar objetos daría 3 donde el lector ve 2;
 *  · menos las respuestas que son PURO PRECIO (no mueven ni pie ni plazo) cuando la vía del
 *    precio ya cruza sola: ahí las dos describen el mismo movimiento con otro nombre.
 *
 * ⚠ `respuestas` AUSENTE no es `respuestas: []`. Ausente = fila persistida antes del menú, o
 *   sea que NADIE miró los otros caminos; ahí la grilla aporta lo único que sí está medido,
 *   la equilibrada, y no se inventa un cero. Medido el 17-sep: 0 filas del parque, pero el
 *   borde se escribe igual — es la misma trampa que `hayOtrosCaminos` documenta abajo.
 */
export interface CaminosQueAbren {
  /** El número del que cuelga la doctrina. 0 ⇒ y solo entonces ⇒ se puede cerrar la puerta. */
  total: number;
  /** Cuántas alcanzan POR SEPARADO (bloque VÍAS). */
  viasSolas: number;
  /** La respuesta que el menú corona por score: «Lo que Franco recomienda». */
  recomendado: RespuestaMix | null;
  /** Las otras respuestas que caben en su tope, sin repetir la coordenada de la recomendada. */
  otros: RespuestaMix[];
}

export function caminosQueAbren(
  v: HallazgoDistanciaVeredicto["valor"],
  /**
   * LO QUE ESTA FUNCIÓN NO PUEDE ADIVINAR, y por eso entra por parámetro: en qué modalidad
   * corre. STR desde BUSCAR OTRA lee `mixPalancasHastaComprar` y LTR siempre `mixPalancas`
   * — dejar que lo dedujera acá sería un tercer lugar donde esa elección se escribe, y ya
   * hay dos (`salidaPorMix` y `salidaPorMixStr`) que tienen que coincidir con la card.
   *
   *  · `grilla` — de dónde salen las respuestas. Default: `v.mixPalancas`.
   *  · `equilibrada` — la respuesta de la combinación equilibrada según su modalidad. Solo
   *    se usa en el borde de `respuestas` AUSENTE, donde es lo único medido.
   */
  opts?: { grilla?: MixPalancas | null; equilibrada?: SalidaPorMix | null },
): CaminosQueAbren {
  const equilibrada = opts?.equilibrada ?? null;
  const viasSolas = (v.vias ?? []).filter((x) => x.estado === "cruza").length;
  const cruzaPrecioSolo = (v.vias ?? []).some((x) => x.estado === "cruza" && x.palanca === "precio");
  const m = opts?.grilla !== undefined ? opts.grilla : v.mixPalancas;

  // AUSENTE ≠ VACÍO: sin menú medido, la grilla aporta lo único medido — la equilibrada.
  if (!m || !Array.isArray(m.respuestas)) {
    return { total: viasSolas + (equilibrada ? 1 : 0), viasSolas, recomendado: null, otros: [] };
  }

  const vistas = new Set<string>();
  const abren: RespuestaMix[] = [];
  for (const r of m.respuestas) {
    if (!r.dentroDeSuTope) continue;
    if (cruzaPrecioSolo && r.piePctDelta === 0 && r.plazoAniosDelta === 0) continue;
    const k = `${r.piePct}|${r.plazoAnios}|${r.descuentoPct}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    abren.push(r);
  }
  const recomendado = abren.find((r) => r.criterio === "score") ?? abren[0] ?? null;
  const otros = recomendado ? abren.filter((r) => r !== recomendado) : [];
  return { total: viasSolas + abren.length, viasSolas, recomendado, otros };
}

/**
 * El movimiento de UNA respuesta del menú, con LAS MISMAS PALABRAS que usa la equilibrada.
 *
 * No es una cortesía de estilo: si el bloque del prompt describiera la recomendada con un
 * molde y las otras con otro, el modelo leería dos clases de objeto donde hay una sola, y la
 * prosa saldría tratando a las «otras» como algo menor. Comparte la lógica de `desdeMix` a
 * propósito — misma pregunta, misma respuesta.
 *
 * Devuelve `null` cuando la respuesta no mueve ni pie ni plazo: eso es un descuento de precio
 * a secas, que ya se cuenta como vía sola y no es una combinación que nombrar.
 */
export function movimientoDeRespuesta(r: RespuestaMix): string | null {
  const partes: string[] = [];
  if (r.piePctDelta !== 0) partes.push(`el pie en ${pct1(r.piePct)}%`);
  if (r.plazoAniosDelta !== 0) partes.push(`el plazo en ${r.plazoAnios} años`);
  return partes.length ? partes.join(" y ") : null;
}

/**
 * STR: LA FUENTE DE LA CARD (12-sep-2026 · v19). El motor STR emite DOS combinaciones —
 * `mixPalancas` al escalón y, desde BUSCAR OTRA, `mixPalancasHastaComprar`— y la card de §5
 * (`lo-que-haria-yo.ts`) lee en BUSCAR solo el camino a Comprar: el mix al escalón no se
 * dibuja. El prompt y el guard leen de ACÁ, no de `salidaPorMix`, para que la prosa nombre
 * exactamente la salida que el lector tiene al lado. Medido: 7 filas AJUSTA con salida por
 * esta fuente; 9 BUSCAR con combinación solo al escalón, que van por `mixAlEscalonStr`.
 */
export function salidaPorMixStr(v: ValorParaSalidaStr): SalidaPorMix | null {
  if (!v.esEstructural) return null;
  const m = v.veredictoBase === "BUSCAR OTRA" && v.mixPalancasHastaComprar !== undefined ? v.mixPalancasHastaComprar : v.mixPalancas;
  if (!m || !m.dentroDelAlcance || m.redundanteConPalancaSola) return null;
  return desdeMix(m);
}

/**
 * STR desde BUSCAR OTRA: la combinación que llega al ESCALÓN (AJUSTA SUPUESTOS) cuando no hay
 * una a Comprar. La card no la muestra, pero el motor la tiene: la prosa no puede decir «no
 * hay forma» y tampoco prometer Comprar. `null` fuera de ese caso exacto.
 */
export function mixAlEscalonStr(v: ValorParaSalidaStr): SalidaPorMix | null {
  if (!v.esEstructural || v.veredictoBase !== "BUSCAR OTRA") return null;
  if (salidaPorMixStr(v)) return null;
  const m = v.mixPalancas;
  if (!m || !m.dentroDelAlcance || m.redundanteConPalancaSola) return null;
  return desdeMix(m);
}

function desdeMix(m: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>): SalidaPorMix | null {
  const partes: string[] = [];
  if (m.piePctDelta !== 0) partes.push(`el pie en ${pct1(m.piePct)}%`);
  if (m.plazoAniosDelta !== 0) partes.push(`el plazo en ${m.plazoAnios} años`);
  if (partes.length === 0) return null;

  const descuentoPct = m.sinDescuento ? null : Math.abs(m.descuentoPct);
  // «Dos a la vez» tiene que ser VERDAD: medido en el parque, 128 de las 179 mueven pie y
  // plazo, 47 solo el pie y 4 solo el plazo. Con una sola dimensión el descuento cuenta
  // como la segunda cosa —el precio también se mueve—; sin descuento, se nombra la única.
  const remate =
    partes.length >= 2 || descuentoPct !== null
      ? "moviendo dos cosas a la vez"
      : m.piePctDelta !== 0
        ? "subiendo el pie"
        : "estirando el plazo";

  const mueve: ("pie" | "plazo")[] = [];
  if (m.piePctDelta !== 0) mueve.push("pie");
  if (m.plazoAniosDelta !== 0) mueve.push("plazo");

  // LA MISMA TRIPLETA CON LA QUE EL MOTOR FUSIONA las respuestas que son la misma celda
  // (`mix-palancas.ts`: score y TIR se fusionan cuando coinciden en pie, plazo y descuento).
  // Contar objetos en vez de coordenadas daría 3 donde el lector ve 2 líneas.
  // `Array.isArray` y NO `?? []`: ver el acta del campo. Ausente es «no se midió», y eso no
  // se convierte en «no hay» sin inventar una afirmación.
  const caminos = Array.isArray(m.respuestas)
    ? new Set(m.respuestas.map((r) => `${r.piePct}|${r.plazoAnios}|${r.descuentoPct}`))
    : null;
  return {
    movimiento: partes.join(" y "),
    remate,
    descuentoPct,
    costoDiaUnoUF: m.costoDiaUnoUF,
    mueve,
    hayOtrosCaminos: caminos === null ? null : caminos.size >= 2,
  };
}

// ── EL COPY STR (12-sep-2026 · «la fraseCanonica estructural STR deja de negar el mix») ──
// Cinco superficies STR seguían diciendo «no hay forma» en las 16 filas con combinación. Las
// que son neutrales de modalidad —cierrePopupSalida, tituloCardSalida, lineaMiniSalida— se
// reutilizan tal cual; estas son las que LTR no tiene: el cierre de la fraseCanonica, el
// escalón desde BUSCAR (la combinación llega a Ajusta supuestos, no a Comprar) y el pie del
// PDF STR, que en LTR nombra dos condiciones que renta corta no tiene.

/** «pie y plazo» · «el pie» · «el plazo»: lo tuyo, lo que se mueve sin pedirle nada a nadie. */
export function loTuyo(s: SalidaPorMix): string {
  return s.mueve.length >= 2 ? "pie y plazo" : s.mueve[0] === "plazo" ? "el plazo" : "el pie";
}

/** El cierre de la fraseCanonica STR con combinación. `escalon` = a dónde llega cuando NO es
 *  Comprar («Ajusta supuestos», desde BUSCAR); null = llega a Comprar. Lee el descuento como el
 *  prompt lee `descuentoQueAdemásPide`: con descuento se dice; sin descuento, la forma corta.
 *
 *  ✅ LA PREMISA INCOMPLETA SE ARREGLÓ ACÁ (17-sep-2026). Lo que sigue es el acta de cuando
 *    no estaba arreglada, porque explica qué se ganaba esperando y qué se paga al hacerlo
 *    (17-sep-2026). `loTuyo(s)` dice «pie y plazo» describiendo la equilibrada, y el menú
 *    puede ofrecer otro camino que la frase no nombra. En esas filas el modelo recibe «Con
 *    lo tuyo —pie y plazo—» como hecho dado, sin saber que hay más.
 *
 *    ⚠ CUÁNTAS SON: **6**, y manda `hayOtrosCaminos`. Este acta decía **4** y los dos números
 *      eran ciertos con definiciones distintas: 4 contaba solo las respuestas que mueven UNA
 *      dimensión; `hayOtrosCaminos` cuenta CUALQUIER coordenada distinta (pie, plazo o
 *      descuento). Gobierna la del campo, y la razón no es que sea más grande: es que ese
 *      campo ya gobierna el ksub del capítulo STR, y dos definiciones de «hay otro camino»
 *      conviviendo en el repo es el problema de los dos mapas otra vez — cada superficie
 *      termina contestando distinto la misma pregunta.
 *
 *    No se tocaba porque la fraseCanonica viaja al prompt (`ai-generation-str.ts:725`) y
 *    cambiarla MUEVE EL HASH DE GENERACIÓN. Ese costo se paga ahora, con los prompts
 *    abiertos, que es donde correspondía: el hash del user STR se mueve y las filas STR
 *    nuevas nacen con la frase completa. NO invalida prosa persistida — eso lo hace
 *    `PROMPT_VERSION_STR`, que no se toca desde acá.
 *
 *    (La otra superficie viva de `loTuyo` —el ksub del capítulo STR— sí lo usa: ver
 *    `CapitulosInversionStr.tsx`. Hubo una tercera, `DrawerDistanciaStr`, que estaba muerta
 *    y se borró el 17-sep-2026.) */
export function cierreFraseCanonicaStr(s: SalidaPorMix, escalon: string | null): string {
  // EL CUALIFICADOR VA DENTRO DE LOS GUIONES, no pegado detrás. «Con lo tuyo —pie y plazo—
  // —lo que Franco recomienda—» pone dos incisos seguidos y se lee como un tropezón; adentro,
  // el inciso sigue siendo uno y nombra lo que describe. Mismo nombre que el menú por la
  // misma razón que `RECOMENDADA` documenta: un solo vocabulario para un solo objeto.
  //
  // TRES RAMAS, y la del medio importa: `null` es `respuestas` AUSENTE —nadie midió— y ahí no
  // se dibuja nada, porque afirmar «es el único camino» sin haberlo medido es la misma
  // invención que este módulo existe para evitar.
  const tuyo = s.hayOtrosCaminos === true
    ? `Con lo tuyo —${loTuyo(s)}, ${RECOMENDADA}—`
    : `Con lo tuyo —${loTuyo(s)}—`;
  if (escalon) return `${tuyo}${s.descuentoPct === null ? "" : ` y un descuento de ${pct1(s.descuentoPct)}%`} llega a ${escalon}, no a Comprar.`;
  return s.descuentoPct === null ? `${tuyo} sí llega a Comprar.` : `${tuyo} y un descuento de ${pct1(s.descuentoPct)}% llega a Comprar.`;
}

/** El pie del PDF STR (bloque «por qué no cierra»). */
export function pieDocumentoSalidaStr(s: SalidaPorMix, escalon: string | null): string {
  // EL CUALIFICADOR VA AL FINAL, no pegado al movimiento. En el menú «Lo que Franco
  // recomienda» es la CELDA ENTERA: pie, plazo Y descuento son sus tres coordenadas. Metido
  // entre el movimiento y el descuento calificaba media celda y dejaba el descuento
  // leyéndose como un extra fuera de la recomendación.
  const base = `con ${s.movimiento}${s.descuentoPct === null ? "" : `, y un ${pct1(s.descuentoPct)}% de descuento`}`;
  const con = s.hayOtrosCaminos === true ? `${base} —${RECOMENDADA}—` : base;
  return `Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero ${con}${escalon ? ` llega a ${escalon}, no a Comprar` : ", sí"}. Lo que pide es plata tuya el día uno.`;
}

/**
 * EL CUALIFICADOR, PARA LAS SUPERFICIES QUE NO TIENEN DÓNDE ELEGIR (17-sep-2026).
 *
 * El PDF, la comparativa y el share describen la equilibrada y no dibujan menú. Cuando el
 * motor encontró más de un camino, la línea tiene que decir CUÁL está describiendo — si no,
 * el lector se lleva un plan como si fuera el plan.
 *
 * ⚠ EL NOMBRE ES EL DEL MENÚ, y eso es la mitad de la decisión: «Lo que Franco recomienda»
 *   es el título que esa misma combinación lleva en `TITULO_RESPUESTA` (`PopupAjustes.tsx`).
 *   Inventar acá un segundo nombre para la misma cosa —«el plan principal», «la
 *   recomendada»— le daría al lector dos vocabularios para un solo objeto, que es cómo
 *   empiezan las divergencias que este módulo existe para evitar.
 *
 * ⚠ Y NO SE DIBUJA CUANDO ES EL ÚNICO CAMINO. Medido: 13 de las 45 filas. Nombrar «la
 *   recomendada» donde no hay nada más que recomendar promete una elección que no existe —
 *   la misma doctrina de «sin celda, sin oración» que ya gobierna «hoy» en la leyenda del
 *   pop-up y la nota de la tarifa.
 */
export const RECOMENDADA = "lo que Franco recomienda";

// ── EL COPY DE CADA SUPERFICIE ───────────────────────────────────────────────
// Vive acá, y no repartido en los componentes, por dos razones: se testea sin montar
// JSX, y la familia se lee junta — que es la única forma de que varios lugares digan lo
// mismo con la misma voz. (El ksub del capítulo STR es la excepción y no debería serlo:
// su copy vive en `CapitulosInversionStr.tsx`, así que solo se puede vigilar por regex.)
//
// ⛔ CINCO SE RETIRARON EL 17-sep-2026, TODAS MEDIDAS SIN LECTOR. El método fue
// «consumidores reales, no referencias», y la diferencia entre las dos cosas es todo:
//
//  · `tituloCardSalida` — produce `.title`. Los tres consumidores de `findingDisplay`
//    que corren en producción no lo leen: el PDF STR lee `kpi`/`ksub`/`kpiRed`,
//    `PrincipalesHallazgos` destructura `{kpi, kpiNegativo}` y el anexo
//    (`resumen-anexo.ts`) lee `kpi`/`ksub`/`kpiRed`.
//    ⚠ Pero `.title` SÍ se pinta en otras dos partes —`GenericFindingCard.tsx:501` y el
//      bundle del juez—, así que la razón verdadera no es «nadie lee el campo» sino que
//      **este hallazgo no llega**: `orden-hallazgos.ts` saca `distancia_veredicto` de la
//      pirámide por id (136 y 195). Escrito mal, este bullet le da permiso al próximo
//      retiro de `.title` en un hallazgo que SÍ entra a la pirámide. Ver el acta larga en
//      `distancia-copy.ts`.
//  · `ksubCardSalida` — tenía una vía viva posible, el anexo de comparativa, y se MIDIÓ:
//    de 960 filas, 742 traen el hallazgo de distancia y en **0** entra al top-3 del anexo.
//    No es casualidad: la distancia lleva decisividad 0 por construcción y `topFindings`
//    ordena por decisividad. Las otras dos vías la filtran antes.
//  · `cierrePopupSalida` y `cierrePopupEscalonStr` — vivían en `DrawerDistanciaLtr` y
//    `DrawerDistanciaStr`. El primero estaba detrás de `drawerSequence = ["zona"]`; el
//    segundo no tenía NI UN import en todo el repo. Y su contenido no quedó huérfano: lo
//    dice el pop-up de ajustes, que además dice más. (Los dos drawers se borraron el mismo
//    día: ya no existen, así que ningún grep los va a encontrar.)
//  · `SUBTITULO_PLAN_SALIDA` — el subtítulo del drawer de negociación. `DrawerNegociacion`
//    sigue VIVO en `CapitulosInversion.tsx`; lo que estaba muerto era la segunda montura.
//
// LA REGLA QUE SALIÓ DE ESTO, y vale más que el retiro: **reemplazado se retira, apagado
// se decide, nunca por inercia.** Cuatro de las cinco estaban reemplazadas por superficies
// mejores. La quinta se midió antes de tocarla.

/** E · el subtítulo del capítulo de negociación. El plan existe; no pasa por el vendedor.
 *
 *  ⚠ ÉSTA SÍ ESTÁ VIVA, y estuvo a un paso de retirarse por un diagnóstico mío equivocado
 *    (17-sep-2026). La FASE 0 la contó entre las muertas porque su único uso está en
 *    `AnalysisDrawer.tsx`, que es el archivo del drawer inalcanzable. Pero ese uso vive DENTRO
 *    de `DrawerNegociacion`, que es una función EXPORTADA y que `CapitulosInversion.tsx` monta
 *    —pasándole `capitulo`, que es justo la condición de la que este subtítulo cuelga—.
 *    El archivo estaba muerto; la función, no.
 *
 *    LA LECCIÓN, que corrige el método: «consumidores reales, no referencias» hay que
 *    aplicarlo al SÍMBOLO, no al archivo donde vive. Un archivo con una superficie muerta
 *    puede exportar otra viva, y el grep por archivo las confunde. */
export const SUBTITULO_PLAN_SALIDA = "El plan no pasa por el vendedor";

/** D · la línea corta de comparativa, share y PDF de ambas.
 *
 *  EL CUALIFICADOR VA ADELANTE, y es la única de las tres donde va así: es la más corta, el
 *  lector no tiene ninguna otra señal de que hubo una elección, y puesto al final competiría
 *  con el «sí», que es lo que la línea vino a decir. */
export function lineaMiniSalida(s: SalidaPorMix, veredictoBase: string): string {
  const con = s.hayOtrosCaminos === true ? `${RECOMENDADA} —${s.movimiento}—` : s.movimiento;
  return `Ningún cambio por separado lo mueve de ${veredictoBase}: con ${con}, sí.`;
}

/** G · el pie del PDF LTR. */
export function pieDocumentoSalida(s: SalidaPorMix): string {
  // CON COMA Y NO CON RAYAS. La oración ya trae una raya suelta («alcanza — pero con…»), así
  // que un inciso entre rayas adentro deja TRES en una frase y el lector puede cerrar el par
  // en la equivocada. Lo marcó la revisión adversaria del diff.
  const con = s.hayOtrosCaminos === true ? `${s.movimiento}, que es ${RECOMENDADA},` : `${s.movimiento},`;
  return `Cumplir las dos es condición necesaria para un Comprar, y ningún cambio por separado alcanza — pero con ${con} sí. No es cuestión de afinar un número: lo que pide es plata tuya el día uno.`;
}
