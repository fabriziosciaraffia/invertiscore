"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DE AJUSTES (13-sep-2026) — LTR y STR, un solo componente.
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-palancas-final.html
// Datos: los emite el motor (bloque A). Este componente NO recalcula nada: pinta
// `mixPalancas.celdas`, `.despues`, `.score` y `palancas[].score/destino`. Si acá
// hubiera aritmética de veredicto, el informe podría decir dos cosas distintas del
// mismo caso a dos clics de distancia.
//
// CUATRO ESTADOS, y son cuatro renders:
//   · con grilla  — matriz pie × plazo + el ajuste óptimo + la tabla de las solas
//   · sin grilla, con solas — solo la tabla (6 filas STR; ninguna LTR)
//   · COMPRAR     — no hay a dónde subir: los márgenes de la card y las solas si mueven
//   · sin nada    — NO SE ABRE. El botón no se dibuja; lo decide el hero.
//
// Medido sobre el parque recomputado el 13-sep-2026:
//                con grilla   sin grilla+solas   sin nada   COMPRAR
//      LTR           772            0              270        160
//      STR           114            6               73         56
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { CeldaMix, CriterioRespuesta, MetricasCelda, RespuestaMix } from "@/lib/mix-palancas";
import type { MixPalancas } from "@/lib/types";
import { QUIEN_LA_PONE, type FilaLoQueHariaYo, type QuienLaPone } from "@/lib/lo-que-haria-yo";
import type { HallazgoDistanciaVeredicto, PalancaDistancia, Veredicto } from "@/lib/types";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { bandaEsfuerzoDescuento, ETIQUETA_BANDA_ESFUERZO } from "@/lib/distancia-veredicto-hallazgo";
import { ETIQUETA_BANDA_MARGEN } from "@/lib/sensibilidad-hallazgo";

type Currency = "CLP" | "UF";

/** Guion para el par que no aplica. Con pie 0 el retorno sobre lo puesto no existe y la
 *  fila VA IGUAL: omitirla dejaría seis pares donde el contrato dice siete. */
const PAR_SIN_VALOR = "—";

const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => `${dec1(n)}%`;
/** El signo va ANTES del símbolo, no entre el símbolo y el número: «−$283.194», no
 *  «$−283.194». Es la forma del resto del informe. */
const plata = (n: number, currency: Currency, valorUF: number) => {
  const signo = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return currency === "UF" ? `${signo}UF ${dec1(abs / valorUF)}` : `${signo}$${miles(abs)}`;
};
const plataFirmada = (n: number, currency: Currency, valorUF: number) =>
  `${n > 0 ? "+" : ""}${plata(n, currency, valorUF)}`;

/**
 * LA FRASE del dueño, bajo el nombre de cada fila. El HECHO no se declara acá: lo trae
 * `QUIEN_LA_PONE` del motor (16-sep-2026).
 *
 * Había dos mapas y discrepaban. El motor dice cuatro veces que precio, pie y plazo son lo
 * que el comprador controla; este archivo le atribuía el plazo al banco, y era la única
 * superficie del informe que lo hacía —la card, con el mismo dato, lo cuenta
 * como tuyo y por eso no lo nombra entre las alternativas ajenas—. Un hecho, dos fuentes,
 * dos respuestas a dos clics de distancia.
 *
 * Ahora la clave es el DUEÑO y no la palanca, así que no hay dónde volver a discrepar: lo
 * que queda acá es redacción. «Lo decides tú» sirve para las tres tuyas —el pie se pone, el
 * plazo se elige y la gestión se decide, pero «decidir» las cubre a las tres— y esa es la
 * razón de que sean tres frases y no seis.
 */
const FRASE_DEL_DUENO: Record<QuienLaPone, string> = {
  vendedor: "lo pone el vendedor",
  mercado: "lo pone el mercado",
  tuyo: "lo decides tú",
};


const NOMBRE: Record<PalancaDistancia["palanca"], string> = {
  precio: "Precio",
  arriendo: "Arriendo",
  adr: "Tarifa",
  plazo: "Plazo",
  pie: "Pie",
  // No «Gestión»: lo que el cálculo mueve es la comisión, no quién opera (16-sep-2026).
  gestion: "La comisión del administrador",
};

/**
 * EL MIX QUE LLEGA A COMPRAR, y solo ese (contrato §5 · 13-sep-2026).
 *
 * `mixPalancas` apunta al veredicto INMEDIATAMENTE superior: desde AJUSTA eso ya es
 * COMPRAR, pero desde BUSCAR OTRA es el escalón intermedio, y **el escalón no se muestra
 * nunca**. Hasta hoy el pop-up tomaba `mixPalancas ?? mixPalancasHastaComprar`, o sea
 * prefería el del escalón: 399 filas LTR y 55 STR estaban sensibilizando hacia Ajustar y
 * ofreciendo un plan que no lleva a Comprar, sin decirlo.
 *
 * Misma regla que la card (`salidaPorMixStr`), que ya lo hacía bien.
 */
function mixAComprar(v: HallazgoDistanciaVeredicto["valor"]) {
  return v.veredictoBase === "BUSCAR OTRA" ? v.mixPalancasHastaComprar ?? null : v.mixPalancas ?? null;
}

/**
 * LAS PALANCAS QUE LLEGAN AL DESTINO, y solo esas (17-sep-2026).
 *
 * MISMA REGLA QUE `mixAComprar`, Y ESA ES TODA LA HISTORIA: el 13-sep se arregló la
 * grilla y se dejó la tabla de al lado leyendo `palancas`, que en BUSCAR OTRA apunta al
 * escalón intermedio. Así, en 259 de 264 pop-ups sin grilla (98,1% — el 27,0% del total)
 * el chip de arriba decía «BUSCAR OTRO → ✓ COMPRAR» y las tres filas de la única tabla
 * en pantalla, bajo la columna «Llegas a», decían «Ajustar». Ninguna llegaba.
 *
 * La card de §5 ya lo hacía bien con el mismo dato desde el 10-sep
 * (`lo-que-haria-yo.ts`, `esBuscar ? dv.palancasHastaComprar : dv.palancas`), así que la
 * misma fila contestaba distinto en dos superficies a un clic de distancia — exactamente
 * lo que la fuente única vino a evitar. Acá se copia esa expresión, no se inventa otra.
 *
 * ⚠ AUSENTE ≠ VACÍO. En una fila persistida antes del salto de dos bandas el campo es
 * `undefined`: nadie midió la vía a COMPRAR. `[]` es «se midió y ninguna llega». Las dos
 * dibujan lo mismo —nada, que es «sin celda, sin oración»— pero por razones distintas, y
 * leer el undefined como lista vacía haría que el pop-up publicara una medición que no
 * existe. Por eso el predicado es `Array.isArray` y no `?? []`.
 */
function solasAComprar(v: HallazgoDistanciaVeredicto["valor"]): PalancaDistancia[] {
  if (v.veredictoBase !== "BUSCAR OTRA") return v.palancas ?? [];
  return Array.isArray(v.palancasHastaComprar) ? v.palancasHastaComprar : [];
}

/**
 * LO QUE LA CELDA ESCRIBE (14-sep-2026). Cada celda muestra su lectura en el descuento
 * mínimo —lo que CONSEGUIRÍAS con ella— salvo la del aro, que muestra la lectura a precio
 * de hoy: lo que TIENES. `esActual` es «el pie y el plazo que declaraste», no «tu caso».
 *
 * Fuente única de TRES superficies —la palabra de la celda, su score y su color—, que por
 * eso no pueden separarse. La primera versión de este arreglo cambió solo la palabra y dejó
 * el color leyendo `c.veredicto`: la celda del aro quedó con fondo azul —«llega a Comprar»—
 * y con «Ajustar score 67» escrito adentro.
 *
 * ⚠ Y EL PANEL DE DETALLE NO ES LA CUARTA, aunque esta acta lo declaró desde el 14-sep hasta
 *   el 17-sep-2026. `PanelCelda` no llamaba a esta función ni una vez: leía `sel.veredicto`
 *   crudo. La frase afirmaba una atadura inexistente, que es peor que no declarar ninguna —
 *   el mismo «presencia ≠ cableado» que el arco de los gates encontró en los predicados,
 *   acá en prosa. Hoy el panel se reparte a propósito, y conviene saber por qué:
 *
 *    · LAS DOS FRASES DEL ARO —«Pidiendo descuento llegas a Comprar sin pedir nada» y
 *      «…con −8,2%»— leen `sel.veredicto` CRUDO, y tienen que seguir haciéndolo. Hablan a
 *      propósito de la lectura CON descuento: es lo que la frase promete. Si llamaran acá
 *      recibirían `veredictoSinDescuento` y la oración diría una cosa mientras muestra la
 *      otra — el bug exacto que esta función existe para matar, causado por obedecerla.
 *    · LA LÍNEA DE LA CELDA QUE CAE sí llama acá. Tiene que decir la misma palabra que la
 *      celda muestra, y para las celdas que no son el aro `veredictoMostrado(c) ≡
 *      c.veredicto`: hoy es idéntico y gratis, y mañana los ata de verdad si alguien cambia
 *      qué lectura muestra la matriz.
 */
function veredictoMostrado(c: CeldaMix) {
  return c.esActual ? c.veredictoSinDescuento : c.veredicto;
}
function scoreMostrado(c: CeldaMix) {
  return c.esActual ? c.scoreSinDescuento : c.score;
}

/**
 * ¿ESTA CELDA TIENE PANEL? (17-sep-2026). En COMPRAR la del aro no.
 *
 * El panel tiene dos filas y en COMPRAR las dos se le quedan sin contenido para esa celda:
 * la primera no se dibuja —«Pides de descuento» es una pregunta que el modo `mejorar` no
 * hace, ver el acta de `PanelCelda`— y la segunda diría «Pie el día uno · no cambia», que
 * es la definición de la celda del aro. Lo demás ya está dicho tres veces en pantalla: el
 * aro la marca, la celda escribe su palabra y su score, y la leyenda explica el aro.
 *
 * Medido sobre el parque: son 210 celdas (154 LTR + 56 STR), el 100% de las del aro en
 * COMPRAR, porque su `costoDiaUnoUF` es 0 por construcción — el pie de la celda ES el pie
 * declarado. Otras 361 celdas de COMPRAR también quedarían con la segunda fila en cero,
 * pero ésas SÍ abren: en ellas «no cambia» es un hecho que el lector no tiene —el mismo
 * capital con otro plazo— y es justamente la razón por la que tomaría esa celda.
 *
 * NO SE HACE INERTE EL CLIC, y esto es lo que hay que saber antes de simplificarlo: en 26
 * de esas 210 la celda del aro ES una de las respuestas del menú, así que el clic sigue
 * eligiendo su línea (`setCriterio`) y lo único que no pasa es que se abra el panel. Por eso
 * el corte vive acá y no en el `onClick` del `<td>`.
 *
 * Y LA RAMA DE CELDA ÚNICA: medido, 0 de las 13 filas que la usan son COMPRAR, así que hoy
 * este corte no puede dejarla con su única celda muda. Si alguna vez lo fuera, el panel
 * estaría igual de vacío y el corte seguiría siendo el correcto.
 */
function abrePanel(c: CeldaMix | null, esComprar: boolean): boolean {
  return !!c && !(esComprar && c.esActual);
}

/**
 * ¿ESTA CELDA SE CAE DEL DESTINO? Una sola definición para las dos superficies que la
 * predican: la entrada de leyenda que cuenta las caídas y la línea del panel.
 *
 * El `!!vd` no es paranoia y por eso vive acá: `veredictoMostrado` devuelve el campo de la
 * celda, y `cruzaSegun` tipa su entrada como `Veredicto | null | undefined`. Con el
 * veredicto ausente, `undefined !== "COMPRAR"` es true — el panel afirmaría «Te saca de
 * Comprar» sobre una celda que la leyenda no cuenta entre las caídas. Eran dos predicados
 * escritos por separado con distinto manejo del nulo; ahora es uno.
 */
function caeDelDestino(c: CeldaMix, destino: Veredicto): boolean {
  const vd = veredictoMostrado(c);
  return !!vd && vd !== destino;
}

/**
 * ¿ESTA CELDA LLEGA AL DESTINO? Y que el color diga lo mismo que la palabra.
 *
 * `alcanzable` sale de la bisección —hay un descuento que cruza y cuesta dentro del tope—,
 * pero el veredicto que la celda ESCRIBE sale de recomputar en el descuento publicado, que
 * es el de la bisección redondeado. Cuando el redondeo cae hacia abajo, el recompute ya no
 * cruza: la celda quedaba pintada de «llega a Comprar» y con la palabra «Ajustar» adentro.
 * Con el verde eso no se notaba; con el azul del veredicto la contradicción es literal.
 *
 * Acá manda la palabra, que es un recompute de verdad. El redondeo del motor es un arreglo
 * aparte —anotado el 13-sep-2026— y hasta que se haga el color no promete de más.
 *
 * Por eso el predicado recibe LA PALABRA ESCRITA y no la saca él: la regla no es «la
 * palabra del descuento mínimo» sino «la palabra que esta celda tiene escrita», y no todas
 * las ramas escriben la misma. Es el mismo argumento con el que la corona pierde la tinta
 * plena cuando cae sobre el aro: una marca que promete un destino sobre una celda que dice
 * lo contrario miente.
 *
 * Cada sitio de render nombra su lectura al llamar. La matriz pasa `veredictoMostrado(c)`;
 * la rama de celda única pasa `c.veredicto`, porque es lo que esa rama escribe. Cuando el
 * predicado sacaba la palabra por su cuenta, cambiar la matriz desincronizó a la otra rama
 * en silencio: la palabra quedó diciendo «Comprar» y el color dejó de pintarla.
 *
 * ⛔ Y EL TOPE SALIÓ DE ACÁ (16-sep-2026). Hasta el menú de respuestas el predicado pedía
 * además `c.alcanzable`, que no pregunta por la palabra sino por el tope de la equilibrada.
 * Con eso, una celda que dice «Comprar» y cuesta más de 15 puntos del precio quedaba pintada
 * de gris: la contradicción exacta que este predicado existe para matar, entrando por el
 * tercer conjunto en vez de por la palabra. Medido sobre el parque: 57 de 1.912 celdas
 * decían «Comprar» en gris, y el panel de una de ellas escribía «no llega a Comprar» encima.
 * Se vio en el navegador sobre `54344fa0`, que es la fila del propio contrato.
 *
 * QUIÉN MANDA: LA LEYENDA. Los dos contratos rotulan el swatch azul «llega a Comprar» —no
 * «es una salida», no «cabe en el tope»— así que el azul es una afirmación sobre LLEGAR, y
 * el tope nunca fue parte de esa pregunta. El contrato nuevo lo dibuja así de frente: en su
 * estado A pinta `cruza` las dos celdas de pie 30% que están sobre el tope y que su propio
 * menú no ofrece (popup-menu-respuestas.html:264-265), y de sus ocho celdas azules solo UNA
 * está en el menú. El azul huérfano es el estado normal de esta matriz.
 *
 * QUIÉN ES UNA SALIDA LO DICE EL MENÚ, que lista las respuestas por su nombre. Son dos
 * preguntas distintas y cada una tiene su superficie: el color dice si llega, el menú dice
 * si Franco te lo ofrece.
 */
function cruzaSegun(veredictoEscrito: Veredicto | null | undefined, c: CeldaMix, destino: Veredicto) {
  return c.descuentoPct !== null && veredictoEscrito === destino;
}
function cruzaDeVerdad(c: CeldaMix, destino: Veredicto) {
  return cruzaSegun(veredictoMostrado(c), c, destino);
}

/**
 * SIN `modalidad` (16-sep-2026). La traía para una sola cosa: decidir si iba la nota de la
 * tarifa. Esa nota ahora cuelga de que exista su fila, y `adr` solo existe en renta corta,
 * así que la modalidad viaja adentro del dato y el prop quedaba sin lector. Todo lo demás
 * que el pop-up dibuja sale del hallazgo, que ya viene por modalidad.
 */
export interface PopupAjustesProps {
  veredicto: Veredicto;
  /** El hallazgo de distancia con la grilla y las palancas. Ausente en COMPRAR. */
  distancia?: HallazgoDistanciaVeredicto | null;
  /** Las filas de la card en COMPRAR: Margen, Precio, Verifica. */
  filasComprar?: FilaLoQueHariaYo[] | null;
  /**
   * LA GRILLA DE COMPRAR (15-sep-2026). Pie × plazo sin descuento. Viene por su propio prop
   * y no dentro de `distancia` porque ese hallazgo es null en COMPRAR por construcción; el
   * motor la emite en `results.mixComprar` (LTR) y en la simulación (STR).
   *
   * Es el MISMO tipo que la grilla de los otros dos veredictos, así que la dibuja el mismo
   * componente: lo que cambia no es la forma sino lo que las marcas AFIRMAN, y eso vive en
   * la leyenda.
   */
  mixComprar?: MixPalancas | null;
  currency: Currency;
  valorUF: number;
  /** Precio del caso, en UF: el CTA lo necesita para nombrar el precio negociado. */
  precioUF: number;
  /** EL LADO «ANTES» de los pares: lo que el caso es hoy. Lo pasa el hero desde los
   *  resultados ya recomputados — el pop-up no vuelve a medir nada. */
  antes?: (MetricasCelda & { score?: number | null }) | null;
}

/** ¿Hay algo que mostrar? Lo usan los heros para decidir si dibujan el botón. */
export function hayAjustesQueMostrar(p: {
  veredicto: Veredicto;
  distancia?: HallazgoDistanciaVeredicto | null;
  filasComprar?: FilaLoQueHariaYo[] | null;
}): boolean {
  if (p.veredicto === "COMPRAR") return (p.filasComprar?.length ?? 0) > 0;
  const v = p.distancia?.valor;
  if (!v) return false;
  // LA MISMA FUENTE QUE DIBUJA. Contar `palancas` acá y dibujar `palancasHastaComprar`
  // abajo deja al hero abriendo un pop-up vacío, que es el estado que el invariante 6
  // existe para impedir.
  return (mixAComprar(v)?.celdas?.length ?? 0) > 0 || solasAComprar(v).length > 0;
}

export function PopupAjustes({
  veredicto,
  distancia,
  filasComprar,
  mixComprar,
  currency,
  valorUF,
  precioUF,
  antes,
}: PopupAjustesProps) {
  const v = distancia?.valor;
  // EN COMPRAR LA GRILLA VIENE POR OTRA PUERTA (15-sep-2026). `distancia` es null ahí —no hay
  // veredicto superior— así que la grilla de COMPRAR llega en su propio prop. De acá para
  // abajo el componente no vuelve a distinguir: es el mismo tipo y el mismo render.
  const mix = veredicto === "COMPRAR" ? mixComprar ?? null : v ? mixAComprar(v) : null;
  const celdas = mix?.celdas ?? [];
  const solas = v ? solasAComprar(v) : [];
  // DOS ESTADOS, Y SON DOS PREGUNTAS DISTINTAS (16-sep-2026).
  //
  // `sel` es la celda cuyo PANEL DE DETALLE está abierto: arranca en null, responde en
  // TODAS las celdas y se apaga con la ✕. `criterio` es LA RESPUESTA QUE SE ESTÁ LEYENDO:
  // nunca es null, arranca en la recomendada y solo se mueve entre las celdas coronadas.
  //
  // El contrato del menú no tiene panel de detalle —cero `.cel`, cero «Pides de descuento»,
  // cero ✕— y su script deja inerte el clic en una celda que no es respuesta. Acá el panel
  // se conserva a propósito (decisión Fabrizio, 16-sep): el descuento y el pie extra de
  // CUALQUIER celda son información real y no se pierden porque el mockup no los dibuje.
  // Por eso hacen falta los dos estados, y por eso el aro no puede servir a los dos: el aro
  // es de la respuesta —la leyenda nueva lo nombra «la que estás viendo»— y la celda del
  // panel se identifica en el propio panel, que la titula «Pie 30% · 30 años».
  const [sel, setSel] = useState<CeldaMix | null>(null);
  const [criterio, setCriterio] = useState<CriterioRespuesta>("score");

  const esComprar = veredicto === "COMPRAR";
  // El destino de la matriz es COMPRAR siempre que haya matriz: el escalón no se dibuja.
  const destino: Veredicto = "COMPRAR";

  // ── EL MENÚ ──────────────────────────────────────────────────────────────
  // `respuestas` es OPCIONAL y puede faltar: LTR recomputa siempre en la visita, pero STR
  // cae a lo persistido cuando el recompute devuelve null (`renta-corta/[id]/page.tsx:145`,
  // `recomputed ?? persistedResults`). Sin menú, el pop-up queda exactamente como antes.
  const respuestas = mix?.respuestas ?? [];
  // SE DIBUJA CON DOS CELDAS DISTINTAS, NO CON DOS RESPUESTAS. La clave es la misma tripleta
  // con la que el motor fusiona, así que contar celdas distintas ES contar líneas del menú:
  // si las tres coronas caen en la misma celda hay un solo camino y no hay nada que elegir.
  // Medido sobre el parque: 90 filas con tres líneas, 241 con dos y 33 con una sola.
  const lineas = new Set(respuestas.map((r) => `${r.piePct}|${r.plazoAnios}|${r.descuentoPct}`));
  const hayMenu = celdas.length > 0 && lineas.size >= 2;
  const respuestaSel = respuestas.find((r) => r.criterio === criterio) ?? respuestas[0] ?? null;
  // La celda que el aro marca: la de la respuesta que se está leyendo…
  const celdaDeLaRespuesta = respuestaSel
    ? celdas.find(
        (c) =>
          c.piePct === respuestaSel.piePct &&
          c.plazoAnios === respuestaSel.plazoAnios &&
          c.descuentoPct === respuestaSel.descuentoPct,
      ) ?? null
    : null;
  // …SALVO CUANDO EL PLAN NO SE MUEVE A NINGUNA CELDA (16-sep-2026).
  //
  // Con las dos deltas en cero el plan es quedarse donde estás y negociar precio. Apuntar
  // ahí con el aro no despega la recomendación de la celda: la deja parada sobre la ÚNICA
  // celda del grillado que no dice «Comprar», porque la celda de hoy muestra su lectura a
  // precio de hoy. Medido sobre el parque: 143 filas LTR (37,1% de las que tienen menú) y 7
  // STR abren así, con el aro sobre un cuadrito que dice «Ajustar» mientras el menú promete
  // Comprar, y con la tinta retirada —la corona la pierde cuando cae sobre el aro— o sea sin
  // ninguna marca en pantalla.
  //
  // Y hay una razón más de fondo, medida: en esas 150 filas la recomendación ES la palanca
  // sola de precio. Mismo descuento en 150 de 150 y mismo score de destino en 148. El motor
  // ya lo declara con `redundanteConPalancaSola`, la card §5 lo lee y por eso no dibuja el
  // mix, y las dos puertas STR devuelven null. El pop-up era la única superficie que seguía
  // presentándolo como un movimiento en la grilla.
  //
  // ⚠ LA REGLA SE ESCRIBE CON LAS DOS DELTAS, NO CON LA BANDERA. `redundanteConPalancaSola`
  // es un superconjunto: también es true en 19 filas LTR donde el mix SÍ mueve una dimensión
  // y esa palanca ya cruza sola. Esas apuntan a una celda de verdad y su fila no miente, así
  // que quedan fuera a propósito (decisión Fabrizio, 16-sep).
  const planSinCelda = !!respuestaSel && respuestaSel.piePctDelta === 0 && respuestaSel.plazoAniosDelta === 0;
  const aro = hayMenu ? (planSinCelda ? null : celdaDeLaRespuesta) : sel;

  // ¿EL AJUSTE AJUSTA ALGO? (17-sep-2026)
  //
  // El bloque de abajo se titula «El ajuste» y dibuja siete pares antes → después. Con las
  // dos deltas en cero y sin descuento los siete salen idénticos: «$17.539.910 →
  // $17.539.910», «Score 77 → 77». Medido: 17 de 217 filas COMPRAR (7,8%) abren así. Un
  // llama ajuste y no ajusta nada no describe nada — y el lector tiene que leer siete
  // filas para descubrirlo.
  //
  // Es la misma doctrina de «sin celda, sin oración» que ya gobierna «hoy» en la leyenda,
  // la nota de la tarifa y la segunda mitad del subtítulo de la matriz: la pieza cuelga de
  // lo que describe. Acá lo que describe es un movimiento, y no hay ninguno.
  //
  // CUELGA DE LA RESPUESTA ELEGIDA, no de la fila: el mismo pop-up donde la recomendada no
  // mueve nada tiene otras líneas en el menú que sí mueven, y al elegirlas el bloque vuelve.
  // Sin menú cae a la raíz, que es de donde el bloque leía antes de que hubiera respuestas.
  const ajustaAlgo = (() => {
    const r = respuestaSel;
    const dPie = r ? r.piePctDelta : mix?.piePctDelta ?? 0;
    const dPlazo = r ? r.plazoAniosDelta : mix?.plazoAniosDelta ?? 0;
    const sinDcto = r ? r.sinDescuento : mix?.sinDescuento ?? true;
    return dPie !== 0 || dPlazo !== 0 || !sinDcto;
  })();

  return (
    <div className="paj">
      {/* LOS CHIPS DE VEREDICTO, con signo, igual que la card. En COMPRAR es uno solo:
          no hay a dónde subir y una flecha a ninguna parte sería una promesa vacía. */}
      <div className="paj-chips">
        <Pill veredicto={veredicto} />
        {!esComprar && (
          <>
            <span className="paj-fl">→</span>
            <Pill veredicto={destino} destacado />
          </>
        )}
      </div>

      {esComprar && <SeccionComprar filas={filasComprar ?? []} />}
      {/* LA MATRIZ EN LOS TRES VEREDICTOS (15-sep-2026). Hasta hoy `esComprar` la apagaba, y
          no por decisión: el hallazgo de distancia es null en COMPRAR y sin él no había
          grilla. Con la grilla por su propia puerta, la matriz dibuja igual — es el mismo
          tipo— y lo que cambia es lo que las marcas afirman, que vive en la leyenda. */}
      {(
        celdas.length > 0 && (
          <SeccionMatriz
            celdas={celdas}
            destino={destino}
            esComprar={esComprar}
            sel={sel}
            onSel={(c) => {
              // SIN PANEL TAMPOCO HAY SELECCIÓN. Cuando no hay menú el aro de «la que estás
              // viendo» ES `sel` —`const aro = hayMenu ? … : sel`, unas líneas más arriba—,
              // así que dejar entrar una celda que no abre panel pondría esa marca sobre una
              // celda que no muestra nada. La cita va por nombre y no por número de línea a
              // propósito: este mismo cambio corrió las que había.
              setSel(abrePanel(c, esComprar) ? c : null);
              // Y SI LA CELDA ES UNA RESPUESTA, TAMBIÉN LA ELIGE. El contrato hace esto y
              // nada más («desde la matriz también, pero solo a las celdas que el menú
              // ofrece»); acá se le suma el panel, que el contrato no tiene.
              const r = c && respuestas.find((x) => x.piePct === c.piePct && x.plazoAnios === c.plazoAnios && x.descuentoPct === c.descuentoPct);
              if (r) setCriterio(r.criterio);
            }}
            aro={aro}
            hayMenu={hayMenu}
            hayAro={aro !== null}
            currency={currency}
            valorUF={valorUF}
          />
        )
      )}

      {hayMenu && (
        <SeccionRespuestas
          respuestas={respuestas}
          criterio={respuestaSel?.criterio ?? "score"}
          onElegir={setCriterio}
          esComprar={esComprar}
          currency={currency}
          valorUF={valorUF}
        />
      )}

      {mix && celdas.length > 0 && ajustaAlgo && (
        <SeccionOptimo
          mix={mix}
          respuesta={respuestaSel}
          hayMenu={hayMenu}
          currency={currency}
          valorUF={valorUF}
          precioUF={precioUF}
          antes={antes ?? null}
        />
      )}

      {solas.length > 0 && <SeccionSolas solas={solas} currency={currency} valorUF={valorUF} />}

      {/* EL CTA SIGUE FUERA DE COMPRAR, y ahora por su propia razón: se dibuja con el
          precio NEGOCIADO («Analízalo a UF X») y en COMPRAR no hay descuento que negociar,
          así que nombraría el precio de hoy y sería un botón para volver a mirar lo mismo. */}
      {!esComprar && mix && celdas.length > 0 && <Cta mix={mix} precioUF={precioUF} />}
    </div>
  );
}

function Pill({ veredicto, destacado }: { veredicto: Veredicto; destacado?: boolean }) {
  const signo = veredicto === "COMPRAR" ? "✓" : veredicto === "AJUSTA SUPUESTOS" ? "−" : "✕";
  return (
    <span className={`paj-pill${destacado ? " dest" : ""}`}>
      <span className="paj-signo">{signo}</span>
      {etiquetaVeredicto(veredicto, "banda")}
    </span>
  );
}

// ── 2 · la matriz ───────────────────────────────────────────────────────────
function SeccionMatriz({
  celdas,
  destino,
  esComprar,
  sel,
  onSel,
  aro,
  hayMenu,
  hayAro,
  currency,
  valorUF,
}: {
  celdas: CeldaMix[];
  destino: Veredicto;
  /** ¿El caso YA está en el destino? Cambia lo que la leyenda AFIRMA de sus marcas: el azul
   *  pasa de «llega a» a «sigue siendo», y aparecen las entradas de las que caen. La forma
   *  de la matriz no cambia. */
  esComprar: boolean;
  /** La celda cuyo PANEL está abierto. Puede ser cualquiera, incluso una que nadie ofrece. */
  sel: CeldaMix | null;
  onSel: (c: CeldaMix | null) => void;
  /** La celda que lleva EL ARO. Con menú es la de la respuesta que se está leyendo —la
   *  leyenda la nombra «la que estás viendo»—; sin menú sigue siendo la del panel, que es
   *  lo que el aro significaba antes de que hubiera respuestas que elegir. */
  aro: CeldaMix | null;
  hayMenu: boolean;
  /** ¿Hay aro EN PANTALLA? No es lo mismo que «hay menú»: cuando la respuesta elegida es un
   *  plan que no se mueve a ninguna celda, el menú existe y el aro no. La leyenda cuelga de
   *  esto y no de `hayMenu`, o nombraría una marca ausente — que es exactamente la clase de
   *  bug que el barrido de coherencia buscó y no encontró; sería el primer caso. */
  hayAro: boolean;
  currency: Currency;
  valorUF: number;
}) {
  const pies = Array.from(new Set(celdas.map((c) => c.piePct))).sort((a, b) => a - b);
  const plazos = Array.from(new Set(celdas.map((c) => c.plazoAnios))).sort((a, b) => a - b);
  const at = (pie: number, plazo: number) => celdas.find((c) => c.piePct === pie && c.plazoAnios === plazo) ?? null;
  // «HOY» NO SE INVENTA: 16 filas LTR y 2 STR no tienen celda actual porque su plazo
  // declarado no está en la grilla. Ahí no se marca nada y la leyenda tampoco la nombra.
  const hayActual = celdas.some((c) => c.esActual);
  // LA GRILLA REAL NO ES 3×3 (medido el 13-sep-2026). Los pies van del declarado hasta 30
  // de cinco en cinco y los plazos son los del wizard que no acortan el crédito, así que la
  // forma depende del caso: de 1×1 a 7×3, con 3×2 como la más común (47% LTR, 38% STR) y
  // una de cada tres grillas con UNA SOLA COLUMNA.
  //
  // Con una sola columna esto no es una matriz: es una lista de pies para un plazo fijo, y
  // dibujarle un eje horizontal que rotula una sola cosa es ruido. Ahí el plazo se dice en
  // el encabezado y el eje desaparece.
  const unaColumna = plazos.length === 1;
  // Y con UNA SOLA FILA tampoco: son 63 filas LTR y 2 STR donde el pie ya está en el techo
  // o no califica, así que la grilla es una línea de plazos para un pie fijo. Rotular un eje
  // vertical sobre una sola fila es la misma clase de ruido: el pie se dice en su cabecera.
  const unaFila = pies.length === 1;
  // UNA SOLA CELDA no es ni matriz ni línea: es UNA combinación. Son 12 filas LTR y 0 STR,
  // donde el pie ya está en el techo y el plazo también. Dibujarle ejes, cabeceras y leyenda a
  // un cuadrito solo sería andamiaje alrededor de una sola afirmación, así que se dice en
  // palabras y el detalle queda a un clic, igual que en la matriz.
  // (Decía «23 filas LTR». Remedido el 17-sep-2026 sobre el parque: son 12 LTR, y el lado STR
  // da 0 de 58 filas con mix dibujable. El archivo tenía 23 acá, 12 abajo y 13 en memoria.)
  const unaSola = celdas.length === 1;

  if (unaSola) {
    const c = celdas[0];
    // ESTA RAMA YA NO ESCRIBE `c.veredicto`: escribe la lectura de HOY, como la matriz.
    // Su color lee lo mismo que su palabra —esa parte de la regla no cambió— y por eso el
    // predicado recibe `veredictoMostrado(c)` y no el campo crudo.
    const cruza = cruzaSegun(veredictoMostrado(c), c, destino);
    // LA PROMESA SALE DEL CUADRITO Y SE VA A SU LÍNEA (17-sep-2026).
    //
    // El cuadrito decía la lectura EN EL DESCUENTO MÍNIMO, o sea «Comprar · score 70» sobre
    // un informe que dice «Ajustar · score 68». Medido: las 12 filas que usan esta rama lo
    // hacían, 12 de 12. Y el «70» no era casualidad ni un score: **70 es el umbral de
    // COMPRAR**, y la bisección aterriza sobre la frontera, así que las 12 mostraban el
    // mismo número. Un umbral disfrazado de score es peor que un score equivocado, porque se
    // lee como una medición de este departamento cuando es una constante del motor.
    //
    // No hacía falta forma nueva: la matriz ya resolvió esta pregunta separando las dos
    // lecturas —el aro dice hoy, el chip declara la otra— y `veredictoSinDescuento` /
    // `scoreSinDescuento` YA traen la lectura correcta en las 12 (coinciden exacto con el
    // informe). Lo único que faltaba era dónde devolver la promesa, y el bloque ya tiene pie
    // de texto. Acá no hay chip porque no hay grilla que anotar: hay una oración.
    //
    // Se dice sólo cuando hay algo que prometer: con `descuentoPct` nulo no cruza ni pidiendo
    // el tope, y con 0 la celda ya llega sin pedir nada —ahí `veredictoMostrado` y
    // `c.veredicto` son la misma lectura y la oración repetiría el cuadrito.
    const promesa = c.descuentoPct !== null && c.descuentoPct > 0 && cruzaSegun(c.veredicto, c, destino);
    return (
      <section className="paj-sec">
        {/* ESTE TÍTULO NO SE MOVIÓ, A PROPÓSITO (16-sep-2026). La otra rama pasó a «Las
            combinaciones que Franco probó»; acá el plural mentiría, porque hay UNA. La forma
            que calzaría —«La única combinación»— es la misma frase que ya dice el pie de esta
            rama, y las 12 filas de celda única viajaron juntas en su propio goal (decisión
            Fabrizio). Las dos ramas son excluyentes, así que estos dos títulos nunca se ven
            juntos.
            LO QUE SÍ CONVIVE, y hay que saberlo: en estas 12 filas la tabla de abajo ya dice
            «Un cambio a la vez». O sea que el pop-up queda con un título de DUEÑO arriba y
            uno de EJE abajo. No se contradicen —son dos cosas distintas, no dos respuestas a
            la misma pregunta— pero la oposición limpia que había («depende de ti» / «no
            depende de ti») se perdió, y este título sigue siendo el impreciso de los dos: su
            celda también promete un descuento, que lo pone el vendedor. El goal de las 12
            (17-sep-2026) sacó esa promesa del cuadrito a su propia línea, así que ahora está
            NOMBRADA aparte en vez de disuelta adentro — pero el título no se tocó ahí, por
            decisión de Fabrizio, y sigue siendo la pieza impaga. */}
        <div className="paj-st">Ajustes que dependen de ti</div>
        {/* LA MISMA REGLA QUE LA MATRIZ, y acá hace falta decir por qué puede morder. En esta
            rama la única celda es SIEMPRE la del aro por construcción —`esActual: pie ===
            p.piePct && plazo === p.plazoCredito` (mix-palancas.ts:690) y la grilla tiene una
            sola combinación, que es la declarada— así que en COMPRAR `abrePanel` deja toda la
            sección sin superficie que abra nada. Medido: 0 de las 12 filas que usan esta rama
            son COMPRAR, así que hoy no pasa. Si pasara, la sección no fingiría un botón. */}
        <div
          className="paj-unica"
          onClick={abrePanel(c, esComprar) ? () => onSel(sel ? null : c) : undefined}
          role={abrePanel(c, esComprar) ? "button" : undefined}
          tabIndex={abrePanel(c, esComprar) ? 0 : undefined}
          onKeyDown={abrePanel(c, esComprar) ? (e) => { if (e.key === "Enter" || e.key === " ") onSel(sel ? null : c); } : undefined}
        >
          <span className="k">
            Con pie {dec1(c.piePct).replace(",0", "")}% a {c.plazoAnios} años
          </span>
          {/* RESUELTO EL 17-sep-2026 (era «PENDIENTE DE DECISIÓN, NO DE CÓDIGO»). El cuadrito
              dice la lectura de HOY —la misma que el informe— y la promesa bajó a su propia
              línea. Ver el acta arriba, en `promesa`. */}
          <span className={`v${cruza ? " cruza" : ""}`}>
            {etiquetaVeredicto(veredictoMostrado(c), "frase")} · score {scoreMostrado(c) ?? PAR_SIN_VALOR}
          </span>
        </div>
        {promesa && (
          <p className="paj-sx paj-promesa">
            Con −{pct1(c.descuentoPct!)} de descuento llega a{" "}
            <b>{etiquetaVeredicto(c.veredicto, "frase")}</b>.
          </p>
        )}
        <p className="paj-sx paj-pie">Es la única combinación que Franco puede probar: tu pie y tu plazo ya están en el techo.</p>
        {abrePanel(sel, esComprar) && sel && (
          <PanelCelda sel={sel} destino={destino} esComprar={esComprar} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />
        )}
      </section>
    );
  }

  return (
    <section className="paj-sec">
      {/* EL TÍTULO DEJA DE ORGANIZAR POR DUEÑO (16-sep-2026).
          Decía «Ajustes que dependen de ti» sobre una matriz cuyo tercer eje es el
          DESCUENTO, que lo pone el vendedor. No era impreciso en una minoría de filas: el
          descuento es lo que cada celda promete, así que el título se contradecía en las
          405 filas LTR y las 59 STR que dibujan matriz —o sea en todas— y encima contra su
          propia bajada, dos líneas más abajo: «El descuento que PIDES». El menú, veinte
          píxeles después, lo repite: «Cambia qué le pides al vendedor».
          (Medido con la entrada de cada página. En 366 de las 405 LTR y 38 de las 59 STR
          TODAS las celdas piden descuento; en el resto alguna no llega a ningún precio y
          no muestra número, que es lo único que impide decir «cada celda, siempre».
          Ojo con el 607/89 que se cita más abajo: ese cuenta la TABLA de palancas solas,
          que es otro conjunto. Los dos números vivían mezclados hasta que un barrido
          adversario los separó.)
          Lo que esta sección responde no es de quién depende sino QUÉ SE COMBINA: pie,
          plazo y descuento a la vez, contra la tabla de abajo, que mueve uno solo. Las dos
          palabras del título son las que el pop-up ya usa en pantalla para esto mismo —el
          pie de la rama de celda única dice «la única COMBINACIÓN que Franco puede PROBAR»,
          y el botón que abre todo esto se llama «Ver qué se probó»—, así que no entra
          vocabulario nuevo. Diverge del contrato (popup-palancas-final.html:194 y
          popup-menu-respuestas.html:246/:340), anotado ahí. */}
      <div className="paj-st">Las combinaciones que Franco probó</div>
      {/* LA MATRIZ TIENE DOS LECTURAS Y LO DICE (14-sep-2026). Cada celda muestra lo que
          CONSEGUIRÍAS con ella, o sea su lectura en el descuento mínimo. La del aro no: esa
          muestra lo que TIENES, a precio de hoy. Sin esta línea las dos lecturas conviven
          calladas y el próximo lector deshace el arreglo — es la receta del contrato para
          declarar que un subconjunto se lee distinto: una línea en palabras encima, y una
          marca sin color en lo que difiere (acá, el chip de la celda).
          Cuando no hay celda de hoy —16 filas LTR y 2 STR— la segunda mitad no se dice.

          Y EN COMPRAR NO HAY DOS LECTURAS (15-sep-2026): sin umbral no hay descuento que
          biseccionar, así que TODA la grilla se lee a precio de hoy y la línea que separaba
          las dos lecturas no tiene nada que separar. Decirla ahí sería anunciar un descuento
          que el pop-up no pide en ninguna celda. Lo que esa matriz sí necesita declarar es
          qué mueve: pie y plazo, lo tuyo, sin tocar el precio. */}
      <p className="paj-sx">
        {esComprar ? (
          "Todas van a precio de hoy: lo único que se mueve es lo tuyo, el pie y el plazo."
        ) : (
          <>
            El descuento que pides se ajusta en consecuencia.
            {hayActual ? " La del aro no: va a precio de hoy." : ""}
          </>
        )}
      </p>
      {!unaColumna && <div className="paj-ejex">Plazo del crédito</div>}
      <div className={`paj-mwrap${unaColumna ? " sola" : ""}${unaFila ? " linea" : ""}`}>
        {!unaFila && <div className="paj-ejey">Pie que pones</div>}
        <div className="paj-mtxbox">
        <table className="paj-mtx">
          <tbody>
            <tr>
              <th className="rot" />
              {plazos.map((p) => (
                <th key={p}>
                  {p} años
                  {unaColumna && <small>el único plazo que no acorta tu crédito</small>}
                </th>
              ))}
            </tr>
            {pies.map((pie) => (
              <tr key={pie}>
                <th className="rot">
                  {unaFila ? "Pie " : ""}{dec1(pie).replace(",0", "")}%
                  {unaFila && <small>tu pie, el único que Franco prueba acá</small>}
                </th>
                {plazos.map((plazo) => {
                  const c = at(pie, plazo);
                  if (!c) return <td key={plazo} className="vacia" />;
                  const cruza = cruzaDeVerdad(c, destino);
                  // EL ARO GANA, LA CORONA PIERDE EL FONDO (decisión Fabrizio, 14-sep-2026).
                  // En 145 de 360 filas la celda del aro es TAMBIÉN la coronada: pasa cuando
                  // el plan es solo precio y no mueve ni pie ni plazo. Ahí el fondo de tinta,
                  // que la leyenda nombra «el óptimo», caería sobre una celda que dice
                  // «Ajustar» — o sea prometería lo contrario de lo que pasa. La recomendación
                  // en esas filas no es «quédate donde estás», es «mover pie y plazo no te
                  // ayuda», y eso lo dice el panel del ajuste, que sigue nombrándola con sus
                  // chips y su descuento. El fondo se retira; la corona no se pierde.
                  const coronaVisible = c.esElegida && !c.esActual;
                  const clases = [
                    coronaVisible ? "mix" : cruza ? "cruza" : "",
                    c.esActual ? "hoy" : "",
                    // EL ARO YA NO ES DEL PANEL CUANDO HAY MENÚ. La comparación suma el
                    // descuento porque dos respuestas pueden compartir pie y plazo y no ser
                    // la misma celda; es la misma tripleta con la que el motor fusiona.
                    aro &&
                    aro.piePct === c.piePct &&
                    aro.plazoAnios === c.plazoAnios &&
                    aro.descuentoPct === c.descuentoPct
                      ? "sel"
                      : "",
                  ].filter(Boolean).join(" ");
                  // ⛔ SIN PANEL, SIN AFFORDANCE (17-sep-2026). La celda del aro en COMPRAR
                  //    no abre panel, y dejarla como `role="button"` era peor que no tener
                  //    panel: en 184 de esas 210 el clic no produce nada visible, y si el
                  //    lector tenía abierto el panel de otra celda se lo cerraba sin decir
                  //    por qué. Ahora no es interactiva y se ve que no lo es.
                  //    LO QUE SE PIERDE, dicho para que nadie lo redescubra: en 26 de las 210
                  //    esa celda es también una línea del menú, así que se pierde el atajo de
                  //    elegirla desde la matriz. No se pierde la acción: el menú de abajo
                  //    lista esa misma línea y es clickeable.
                  const interactiva = abrePanel(c, esComprar);
                  return (
                    <td
                      key={plazo}
                      className={clases}
                      onClick={interactiva ? () => onSel(c) : undefined}
                      role={interactiva ? "button" : undefined}
                      tabIndex={interactiva ? 0 : undefined}
                      onKeyDown={interactiva ? (e) => {
                        if (e.key === "Enter" || e.key === " ") onSel(c);
                      } : undefined}
                    >
                      {/* LA CELDA DEL ARO HABLA DEL HOY. `esActual` significa «el pie y el
                          plazo que tienes declarados», no «tu caso actual»: la lectura normal
                          de una celda es la de su descuento mínimo, y en esta el aro prometía
                          «tu situación» mientras el contenido mostraba «tu situación con un
                          descuento encima». Medido: en 501 de 739 filas mostraba un veredicto
                          distinto al de la propia página. El dato ya viajaba en la celda.
                          Y la marca es EL ARO, sola, como manda el contrato visual
                          (popup-palancas-final.html:189, donde esta celda ya decía «Ajustar
                          score 62» marcada solo con el aro). El chip de tinta que hubo acá
                          entre el 14 y el 15 de septiembre se retiró: en esta matriz la tinta
                          plena ya significa «el óptimo» —la celda coronada y su swatch de
                          leyenda— así que el chip prometía lo contrario de lo que la celda
                          dice. Quien habla es el aro; quien explica es el subtítulo. */}
                      {etiquetaVeredicto(veredictoMostrado(c), "frase")}
                      <small>score {scoreMostrado(c) ?? PAR_SIN_VALOR}</small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="paj-leyenda">
        {hayActual && (
          <span>
            <i className="paj-sw c" />
            hoy
          </span>
        )}
        {/* EL SWATCH AFIRMA COSAS DISTINTAS SEGÚN DÓNDE ESTÁS (15-sep-2026).
            En AJUSTAR y BUSCAR el azul es una PROMESA condicionada a un descuento que hay
            que negociarle a un tercero: «llega a Comprar». En COMPRAR es una CONSTATACIÓN
            sobre lo que ya tenés si movés lo tuyo: «sigue siendo Comprar». No hay una frase
            que sirva para las dos sin volverse vaga —«queda en Comprar» es raro cuando
            todavía no llegaste—, y colapsarlas borraría justo la distinción que el color
            existe para hacer.
            «sigue siendo» no es vocabulario nuevo: es lo que la sección de arriba escribe
            dos veces en cada COMPRAR —«El arriendo puede caer hasta $X y sigue siendo
            Comprar»—. Y el precedente de un swatch que cambia lo que afirma es el vecino:
            «lo que Franco recomienda» / «el óptimo», con su acta. */}
        <span>
          <i className="paj-sw b" />
          {esComprar ? "sigue siendo" : "llega a"} {etiquetaVeredicto(destino, "frase")}
        </span>
        {/* LAS QUE CAEN, UNA ENTRADA POR VEREDICTO PRESENTE (15-sep-2026). En COMPRAR el pie
            baja un escalón, y ahí hay celdas que pierden el veredicto: medido, en 51 de las
            160 filas (31,9%), con p50 4 celdas de 12. Es información real —bajar el pie te
            saca de Comprar— y el gris, que en los otros veredictos significa «no llega» (un
            no-evento que la leyenda ni nombra), acá pasa a significar «te caés».
            NO LLEVA CHIP EN LA CELDA. La matriz hermana sí lo lleva («↓ Ajustar»,
            `Matriz.tsx:47`) porque allá la celda muestra un NÚMERO y el veredicto vive solo
            en el tooltip; acá la celda escribe la palabra, así que el chip sería la segunda
            marca del mismo hecho. Una marca por hecho.
            UNA ENTRADA, NO UNA POR VEREDICTO (17-sep-2026). Hasta hoy se dibujaba una por
            veredicto caído presente —«baja a Ajustar», «baja a Buscar otro»— y las dos usaban
            el MISMO swatch, porque el gris de la celda es uno solo. Medido en el navegador,
            en los dos temas: rgb(244,244,246) las dos en claro y rgb(26,26,30) en oscuro. La
            leyenda prometía dos marcas y dibujaba una.
            Es la misma regla con la que el chip «↓ Ajustar» se quedó afuera dos párrafos más
            arriba: UNA MARCA POR HECHO. La leyenda explica el COLOR, y el color dice una sola
            cosa —«esta combinación te saca de Comprar»—; cuál es el veredicto de destino lo
            escribe la celda, con su palabra, que es donde el lector lo está mirando.
            «deja de ser» es el espejo literal de «sigue siendo», que es lo que el swatch de
            arriba escribe en esta misma leyenda: la oposición se lee sin vocabulario nuevo. */}
        {esComprar && celdas.some((c) => caeDelDestino(c, destino)) && (
          <span>
            <i className="paj-sw e" />
            deja de ser {etiquetaVeredicto(destino, "frase")}
          </span>
        )}
        {/* SIN CELDA, SIN ORACIÓN — la misma doctrina que ya gobierna «hoy» acá arriba y que
            la otra matriz del informe declara por escrito. Con el fondo retirado de la celda
            del aro, en 145 filas no queda ninguna celda con tinta plena: nombrar «el óptimo»
            ahí sería señalar un color que no está en pantalla. */}
        {celdas.some((c) => c.esElegida && !c.esActual) && (
          <span>
            <i className="paj-sw a" />
            {/* «EL ÓPTIMO» PASA A «LO QUE FRANCO RECOMIENDA» (16-sep-2026). Es uno de los dos
                cambios que el contrato pone explícitamente «a aprobar»: con el menú el óptimo
                deja de ser uno solo —hay hasta tres celdas coronadas— pero la recomendación
                sigue siendo una, y es la que lleva la tinta plena. El swatch no cambia; cambia
                lo que afirma. Sin menú el texto nuevo sigue siendo cierto, así que no hay dos
                leyendas que mantener. */}
            {hayMenu ? "lo que Franco recomienda" : "el óptimo"}
          </span>
        )}
        {/* LA CUARTA ENTRADA, el otro cambio que el contrato pone a aprobar. El aro de tinta
            ya existía y ya seguía al usuario en producción, y era la única marca de la matriz
            que la leyenda nunca explicó. Con el menú pasa a ser la más importante —es el
            puente entre la fila que lees y la celda— así que dejarla muda sería peor que
            antes. Solo con menú: sin él el aro vuelve a ser el del panel, que no es «la que
            estás viendo» sino «la que tocaste», y nombrarlo así mentiría.

            Y DESDE EL 16-sep CUELGA DEL ARO, NO DEL MENÚ: cuando la respuesta elegida es un
            plan que no se mueve a ninguna celda, hay menú y no hay aro. Nombrarlo igual sería
            señalar una marca ausente — la clase de bug que el barrido de coherencia buscó en
            481 pop-ups y no encontró; sería el primer caso. */}
        {hayAro && (
          <span>
            <i className="paj-sw d" />
            la que estás viendo
          </span>
        )}
      </div>

      {abrePanel(sel, esComprar) && sel && (
        <PanelCelda sel={sel} destino={destino} esComprar={esComprar} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />
      )}
    </section>
  );
}

/** El detalle de una celda: los DOS datos que la matriz no muestra y su ✕. */
function PanelCelda({
  sel,
  destino,
  esComprar,
  currency,
  valorUF,
  onCerrar,
}: {
  sel: CeldaMix;
  destino: Veredicto;
  /** Cambia QUÉ PREGUNTA contesta el panel. Ver el acta de la primera fila. */
  esComprar: boolean;
  currency: Currency;
  valorUF: number;
  onCerrar: () => void;
}) {
  // LA CELDA QUE TE SACA DEL VEREDICTO, que es lo único que la celda no dice ya. El cuadrito
  // escribe su palabra y su score —`etiquetaVeredicto(veredictoMostrado(c))` con su `<small>`—
  // y la leyenda explica el color; lo que falta es la consecuencia de tomarla, y hasta hoy el
  // panel la despachaba con «Pides de descuento: nada».
  //
  // Medido el 17-sep-2026: 295 celdas en 71 de las 218 filas COMPRAR que abren el pop-up.
  //
  // ⚠ Y ESE DENOMINADOR DISCREPA EN UNO con el del acta de `ajustaAlgo`, más arriba en este
  //   mismo archivo, que dice «17 de 217 filas COMPRAR» y es del mismo día. Se verificó que
  //   NO son universos distintos: en COMPRAR toda fila que abre el pop-up dibuja además la
  //   matriz, así que las dos cuentan lo mismo y una está stale. La de acá es la fresca. No
  //   se corrige la otra a ciegas: se anota, porque reemplazar una cifra medida por otra sin
  //   saber qué movió el parque es exactamente como se ensucian estas actas.
  //
  // Llama a `veredictoMostrado` a propósito, aunque para una celda que no es la del aro sea
  // idéntico a `sel.veredicto` — ver el acta de esa función, que explica por qué las dos
  // frases del aro NO lo hacen.
  const cae = esComprar && caeDelDestino(sel, destino);
  return (
    <div className="paj-cel">
      <span className="x" onClick={onCerrar} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCerrar(); }}>
        ✕
      </span>
      <div className="ct">
        Pie {dec1(sel.piePct).replace(",0", "")}% · {sel.plazoAnios} años
      </div>
      <div className="paj-cg">
        {/* ⛔ LA FILA DEL DESCUENTO NO EXISTE EN COMPRAR (17-sep-2026).
            En modo «mejorar» el eje del precio desaparece —no hay umbral que cruzar, así que
            «cuánto descuento pedir» no tiene respuesta honesta y `explorarCelda` devuelve
            `{pct: 0}` para TODAS las celdas (mix-palancas.ts:613)—. La consecuencia acá era
            que las 2.220 celdas no-aro de COMPRAR escribían «Pides de descuento: nada»:
            medido sobre el parque, el 100%. Es verdad y es vacío, y ocupaba la mitad del
            panel justo donde las 295 que caen no tenían dónde decirlo.
            La fila entera se va: si no queda nada que poner, no se dibuja la fila. Es la
            misma doctrina de «sin celda, sin oración» que ya gobierna «hoy» en la leyenda y
            la nota de la tarifa — la pieza cuelga de lo que describe.
            (Las 210 celdas del aro de COMPRAR no llegan acá: no abren panel, ver `abrePanel`.)

            LAS DOS LECTURAS, SEPARADAS Y CADA UNA CON SU RÓTULO. La celda del aro dice lo que
            TIENES; acá se dice a dónde llega esa misma combinación SI pides el descuento. Sin
            esta separación el panel rotulaba «Pides de descuento −24,2%» sobre una celda que
            acababa de decir «Ajustar», y la contradicción se mudaba del cuadrito al clic.

            DOS CASOS QUE ESTABAN COLAPSADOS EN UNO, Y SOLO UNO ERA CIERTO (16-sep-2026).
            La condición era `descuentoPct === null || !alcanzable` y las dos ramas escribían
            «no llega a Comprar». Son hechos distintos:
              · `descuentoPct === null` — no cruza NI pidiendo el tope entero. «No llega» es
                verdad, y es la única celda de la que lo es.
              · `!alcanzable` — cruza, y cuesta más de lo que la recomendación pone. Decirle
                «no llega» era falso, y desde el menú es además lo contrario de lo que la
                página hace al lado: en 43 filas del parque esa celda ES la que el menú
                ofrece como «la que más alivia el mes».
            Ahora el descuento se dice como en cualquier celda que cruza —porque es un número
            real— y lo que la califica cuelga del pie, que es la cifra que se encareció. */}
        {!esComprar && (
          <>
            <span className="l">{sel.esActual ? "Pidiendo descuento llegas a" : "Pides de descuento"}</span>
            <span className="v">
              {sel.descuentoPct === null
                ? `no llega a ${etiquetaVeredicto(destino, "frase")}`
                : sel.esActual
                  ? sel.descuentoPct === 0
                    // MEDIDO EN CERO FUERA DE COMPRAR, y se queda igual: la celda del aro sin
                    // descuento exige que el caso YA alcance el destino, que es lo que un
                    // veredicto distinto de COMPRAR niega. Si el motor cambiara y esa celda
                    // apareciera acá, sin esta rama caería en la de abajo y escribiría
                    // «Comprar con −0,0%».
                    ? `${etiquetaVeredicto(sel.veredicto, "frase")} sin pedir nada`
                    : `${etiquetaVeredicto(sel.veredicto, "frase")} con −${pct1(sel.descuentoPct)}`
                  : sel.descuentoPct === 0
                    ? "nada"
                    : `−${pct1(sel.descuentoPct)}`}
            </span>
          </>
        )}
        {cae && (
          <>
            <span className="l">Si la tomas</span>
            {/* En rojo por lo mismo que el pie que encarece: es el costo de la celda, no su
                promesa. La leyenda dice «deja de ser Comprar» de la MATRIZ; acá se le habla
                al lector, que es lo que hace el resto del panel («Pides», «llegas a»). */}
            <span className="v mal">Te saca de {etiquetaVeredicto(destino, "frase")}</span>
          </>
        )}
        {/* ⛔ EL RÓTULO LLEVA LA DIRECCIÓN, Y POR ESO SON TRES (17-sep-2026).
            Era uno solo, «Pie extra el día uno», con el número firmado. En las 1.318 celdas
            donde la combinación LIBERA capital eso imprimía «Pie extra el día uno:
            −$13.944.700» — «extra» y «menos» en la misma línea, y encima en el color neutro
            mientras la que cuesta plata va en rojo. El color estaba bien; la palabra no
            acompañaba.
            Ahora la dirección la dice el rótulo y el número no la repite: en la rama que
            libera va SIN signo, porque «liberas −$13.944.700» vuelve a poner las dos
            direcciones juntas. En la rama que encarece el «+» se queda, que concuerda con
            «extra». «Liberas» no es palabra nueva: es la del trade-off del menú («libera
            UF 205»).
            Y el cero deja de ser un guion: «no cambia» es un hecho —el mismo capital con
            otro plazo— y es la razón por la que alguien tomaría esa celda. Son 787 celdas.
            De ellas, las 361 de COMPRAR que llegan al destino son las que más lo necesitan:
            sin la fila del descuento, su panel queda con esta sola fila, y un «—» ahí no es
            una respuesta — la fila se dibujaba igual, pero sin decir nada. */}
        <span className="l">
          {sel.costoDiaUnoUF === 0
            ? "Pie el día uno"
            : sel.costoDiaUnoUF > 0
              ? "Pie extra el día uno"
              : "Pie que liberas el día uno"}
        </span>
        <span className={`v${sel.costoDiaUnoUF > 0 ? " mal" : ""}`}>
          {sel.costoDiaUnoUF === 0
            ? "no cambia"
            : sel.costoDiaUnoUF > 0
              ? plataFirmada(sel.costoDiaUnoUF * valorUF, currency, valorUF)
              : plata(Math.abs(sel.costoDiaUnoUF) * valorUF, currency, valorUF)}
          {/* LA NOTA NO ES UN ERROR, ES UN PRECIO. La celda llega —el cuadrito lo dice y el
              color ahora también— y lo que se declara es cuánto capital pide de más respecto
              de lo que Franco recomienda poner. Cuelga del pie y no del descuento porque es
              el pie lo que se encareció. Precedente de forma: `.paj-neg small`.

              ⛔ Y NO SALE EN COMPRAR (17-sep-2026). `alcanzable` son DOS condiciones
              (`mix-palancas.ts:699`): que la celda cruce y que cueste `<= MIX_COSTO_TOPE_PTS_PRECIO`
              (15). En modo «mejorar» la primera es siempre verdadera —`:613` devuelve `pct: 0`
              para todas— así que ahí el booleano contesta SOLO por el tope, y ese tope está
              DESACTIVADO en ese modo: `:771` elige entre `combos` entero. O sea que la nota
              juzgaba con una vara que el propio modo apagó, y le decía «más pie del que
              Franco recomienda poner» a 96 celdas cuya recomendación nunca miró ese número.
              Fuera de COMPRAR las dos condiciones gobiernan y la nota sigue igual, en 135 de
              las 231. */}
          {!esComprar && sel.descuentoPct !== null && !sel.alcanzable && (
            <small>más pie del que Franco recomienda poner</small>
          )}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EL MENÚ DE RESPUESTAS — «Hay más de un camino» (16-sep-2026).

   Contrato: docs/wireframes/rediseno-informe/popup-menu-respuestas.html, estados A y B.

   LOS TEXTOS SON DETERMINISTAS Y SALEN DEL MOCKUP. Nada de copy generado, nada de prompt.
   Los títulos son literales; la línea de coordenadas y el trade-off se arman con cifras del
   motor y un marco fijo.

   EL TRADE-OFF ES UNA RESTA CONTRA LA RECOMENDADA, no contra hoy. Verificado sobre las cinco
   filas del contrato: «UF 94 más de pie que hoy» = costoDiaUnoUF de la recomendada; «libera
   UF 205» = 94 − (−111), la resta contra la recomendada; «UF 558 más de pie que la
   recomendada» = 652 − 94. Las tres al decimal.

   LO QUE NO SE PORTA, Y ES A PROPÓSITO: el mockup adorna cada trade-off con juicios —«El mes
   queda casi cerrado», «porque no toca tu pie»— que son prosa y dependen de leer el número.
   Esta fase deja la prosa afuera, así que van las TRES CLÁUSULAS QUE SON HECHOS: cuánto rinde
   de más o de menos, cuánto capital libera o cuesta, y cuánto más o menos hay que pedirle al
   vendedor. Si alguna vez entran los juicios, entran con su propio radio.
   ───────────────────────────────────────────────────────────────────────────── */
const TITULO_RESPUESTA: Record<CriterioRespuesta, string> = {
  score: "Lo que Franco recomienda",
  tir: "La que más rinde",
  flujo: "La que más alivia el mes",
};
/** El título de la línea fusionada, tal como lo escribe el contrato en su estado B. */
function tituloDe(r: RespuestaMix): string {
  if (r.criterio === "score" && (r.fusionadaCon ?? []).includes("tir")) {
    return "Lo que Franco recomienda, y la que más rinde";
  }
  return TITULO_RESPUESTA[r.criterio];
}

function SeccionRespuestas({
  respuestas,
  criterio,
  onElegir,
  esComprar,
  currency,
  valorUF,
}: {
  respuestas: RespuestaMix[];
  criterio: CriterioRespuesta;
  onElegir: (c: CriterioRespuesta) => void;
  /** Sin umbral que cruzar el trade-off compara otras cosas: ver `tradeOffDe`. */
  esComprar: boolean;
  currency: Currency;
  valorUF: number;
}) {
  // LA FUSIÓN SE DIBUJA COMO UNA LÍNEA CON LOS DOS NOMBRES, no como la misma celda repetida.
  // El motor ya la resolvió: basta con quedarse con la PRIMERA respuesta de cada celda —el
  // orden del contrato es score, tir, flujo— y su título nombra a las dos.
  const vistas: RespuestaMix[] = [];
  for (const r of respuestas) {
    if (!vistas.some((x) => x.piePct === r.piePct && x.plazoAnios === r.plazoAnios && x.descuentoPct === r.descuentoPct)) {
      vistas.push(r);
    }
  }
  const rec = respuestas.find((r) => r.criterio === "score") ?? null;

  return (
    <section className="paj-sec">
      <div className="paj-st">Hay más de un camino</div>
      {/* EN COMPRAR NO SE LLEGA, SE MANTIENE (15-sep-2026) — el mismo argumento del swatch:
          «llegar» es una promesa condicionada a un descuento, y acá no hay ninguno. Y lo que
          cambia entre las respuestas tampoco es «qué le pides al vendedor»: al vendedor no se
          le pide nada. Lo único que se mueve es lo tuyo. */}
      <p className="paj-sx">
        {esComprar ? (
          <>
            {vistas.length === 2 ? "Las dos siguen" : "Las tres siguen"} en Comprar. Cambia cuánta plata pones tú
            y a cuántos años.
          </>
        ) : (
          <>
            {vistas.length === 2 ? "Los dos llegan" : "Los tres llegan"} a Comprar. Cambia qué le pides al vendedor y
            cuánta plata pones tú.
          </>
        )}
      </p>
      <div className="paj-opts">
        {vistas.map((r) => {
          // La fila está «on» cuando el criterio elegido cae en SU celda: con la fusión, una
          // sola fila representa a dos criterios y los dos la encienden.
          const suyos: CriterioRespuesta[] = [r.criterio, ...(r.fusionadaCon ?? [])];
          const on = suyos.includes(criterio);
          const dPie = r.piePctDelta !== 0;
          const dPlazo = r.plazoAniosDelta !== 0;
          // EL PLAN QUE NO SE MUEVE A NINGUNA CELDA. Con las dos deltas en cero, «Pie 20% ·
          // Plazo 25 años» dice «hoy», o sea no dice nada, y el score de la celda es el de
          // hoy —54— peleado con el que este plan alcanza —74—. La fila deja de apuntar a la
          // matriz y toma la forma de la tabla de abajo: qué cambia, cuánto, y a dónde llegas.
          const sinCelda = r.piePctDelta === 0 && r.plazoAniosDelta === 0;
          return (
            <button
              key={r.criterio}
              type="button"
              className={`fila-nav${on ? " on" : ""}`}
              onClick={() => onElegir(r.criterio)}
            >
              <div className="paj-opt-t">
                {tituloDe(r)}
                <span className="paj-opt-sub">
                  {sinCelda ? (
                    // NI COORDENADAS NI SCORE DE CELDA: lo único que se mueve es el precio, y
                    // quién lo mueve importa tanto como cuánto. El «lo pone el vendedor» es
                    // literal del dueño que declara el motor, la misma fuente que la tabla.
                    //
                    // ⚠ Y EN COMPRAR NO SE MUEVE NI EL PRECIO (17-sep-2026). Esta rama se
                    // escribió para AJUSTAR, donde el plan ES negociar. En COMPRAR todas las
                    // respuestas son sin descuento —la bajada de la matriz lo dice dos líneas
                    // antes— así que «Sin pedir descuento · lo pone el vendedor» nombraba a un
                    // vendedor al que no se le pide nada, en una sección cuya propia bajada
                    // acaba de decir que lo único que se mueve es lo tuyo. Acá la respuesta no
                    // es un plan: es que el plan es quedarte donde estás, y eso se dice.
                    esComprar ? (
                      <>
                        <span className="nb">
                          <b>No mover nada</b> ·
                        </span>{" "}
                        <span className="nb">es lo que ya tienes</span>
                      </>
                    ) : (
                    <>
                      <span className="nb">
                        {/* «−26,4% de precio» es literal de la card §5, que para estas mismas
                            filas ya escribe «Alternativamente: −26,4% de precio. Pero eso no
                            depende de ti: lo pone el vendedor». El signo va porque acá el
                            descuento es el dato principal de la fila, no una coordenada. */}
                        <b>{r.sinDescuento ? "Sin pedir descuento" : `Negocias −${pct1(r.descuentoPct)} de precio`}</b> ·
                      </span>{" "}
                      <span className="nb">{FRASE_DEL_DUENO[QUIEN_LA_PONE.precio]}</span>
                    </>
                    )
                  ) : (
                    <>
                      <span className="nb">
                        Pie {dPie && <><s>{dec1(r.piePct - r.piePctDelta).replace(",0", "")}%</s>{" "}</>}
                        {dPie ? <b>{dec1(r.piePct).replace(",0", "")}%</b> : `${dec1(r.piePct).replace(",0", "")}%`} ·
                      </span>{" "}
                      {/* El separador cuelga del descuento: sin él, «Plazo 30 años ·» deja un
                          punto medio al aire al final de la línea. */}
                      <span className="nb">
                        Plazo {dPlazo && <><s>{r.plazoAnios - r.plazoAniosDelta}</s>{" "}</>}
                        {dPlazo ? <b>{r.plazoAnios} años</b> : `${r.plazoAnios} años`}
                        {!esComprar ? " ·" : ""}
                      </span>{" "}
                      {/* EN COMPRAR NO SE DICE (15-sep-2026). Ahí TODAS las respuestas son sin
                          descuento —la bajada de la matriz ya lo declara una vez—, así que
                          repetirlo en cada línea no distingue nada: es ruido en las tres. */}
                      {!esComprar && (
                        <span className="nb">{r.sinDescuento ? "no pides descuento" : `pides ${pct1(r.descuentoPct)}`}</span>
                      )}
                    </>
                  )}
                </span>
              </div>
              <div className="paj-opt-v">{sinCelda ? destinoDe(r, esComprar) : cifraDe(r, currency, valorUF)}</div>
              <div className="disco">{on ? "✓" : "›"}</div>
              <div className="paj-opt-tr">
                {/* LA FRASE FIJA TIENE DOS VERSIONES, una por veredicto. En AJUSTAR «el ajuste
                    es solo de precio» es el hecho; en COMPRAR no hay precio que ajustar y la
                    frase decía lo contrario de la bajada de su propia sección. Lo que esta
                    línea informa en COMPRAR es por qué la grilla no ofrece nada mejor. */}
                {sinCelda
                  ? esComprar
                    ? "Ninguna combinación de pie y plazo mejora lo que ya tienes."
                    : "Mover el pie o el plazo no ayuda: el ajuste es solo de precio."
                  : tradeOffDe(r, rec, currency, valorUF, esComprar)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * EL DESTINO, cuando la fila no apunta a ninguna celda.
 *
 * El score NO SE SACA: CAMBIA DE DUEÑO. El problema nunca fue que 74 estuviera mal, sino que
 * se leía como «el score de la celda que estás señalando» mientras esa celda decía 54. Bajo
 * «llegas a», 74 es el score del DESTINO y 54 no compite con él — que es exactamente lo que
 * el par «Franco Score 54 → 74» del panel de abajo ya explica.
 *
 * La forma sale de la columna «Llegas a» de la tabla de palancas solas, 200 px más abajo en
 * este mismo pop-up: veredicto en frase y el score en segunda línea. Y no es un parecido
 * casual — en estas filas la recomendación ES la palanca sola de precio: mismo descuento en
 * 150 de 150 y mismo score de destino en 148.
 */
function destinoDe(r: RespuestaMix, esComprar: boolean) {
  return (
    <>
      {etiquetaVeredicto("COMPRAR", "frase")}
      {/* EN COMPRAR NO SE LLEGA, SE MANTIENE (17-sep-2026) — el mismo argumento con el que
          el swatch dice «sigue siendo» en vez de «llega a». Escribir «llegas a Comprar»
          sobre una fila que YA es Comprar convierte el veredicto que tienes en una promesa. */}
      <small>{esComprar ? "sigue siendo" : "llegas a"} · score {r.score ?? PAR_SIN_VALOR}</small>
    </>
  );
}

/** La cifra de la derecha: la del criterio que corona, y la de su fusionada debajo. */
function cifraDe(r: RespuestaMix, currency: Currency, valorUF: number) {
  const tir = r.metricas?.tirPct;
  const flujo = r.metricas?.flujoMensual;
  if (r.criterio === "score") {
    const conTir = (r.fusionadaCon ?? []).includes("tir") && tir != null;
    return (
      <>
        {r.score ?? PAR_SIN_VALOR}
        <small>score{conTir ? ` · TIR ${pct1(tir)}` : ""}</small>
      </>
    );
  }
  if (r.criterio === "tir") {
    return (
      <>
        {tir != null ? pct1(tir) : PAR_SIN_VALOR}
        <small>TIR</small>
      </>
    );
  }
  return (
    <>
      {flujo != null ? plataFirmada(flujo, currency, valorUF) : PAR_SIN_VALOR}
      <small>flujo</small>
    </>
  );
}

/** Las tres cláusulas que son hechos, restadas contra la recomendada. */
function tradeOffDe(r: RespuestaMix, rec: RespuestaMix | null, currency: Currency, valorUF: number, sinUmbral: boolean): string {
  if (r.criterio === "score") {
    return (r.fusionadaCon ?? []).includes("tir")
      ? "Acá las dos preguntas tienen la misma respuesta: es el mejor negocio de la grilla y también la que más rinde."
      : "El mejor negocio de la grilla, con la misma vara que declara el veredicto.";
  }
  if (!rec) return "";
  const partes: string[] = [];
  // LAS DIFERENCIAS DE TIR Y DE DESCUENTO VAN EN PUNTOS, NO EN PORCENTAJE. Son restas entre
  // dos porcentajes, así que «3,2%» diría que rinde un 3,2% más de lo que rinde —una
  // proporción— cuando lo que pasa es que rinde 3,2 puntos más. El contrato lo escribe así:
  // «Rinde 3,2 puntos más», «le pide 4,5 puntos más de descuento al vendedor».
  const puntos = (x: number) => `${dec1(Math.abs(x)).replace("−", "")} ${Math.abs(x) === 1 ? "punto" : "puntos"}`;
  const dTir = r.metricas?.tirPct != null && rec.metricas?.tirPct != null ? r.metricas.tirPct - rec.metricas.tirPct : null;
  if (dTir != null && Math.abs(dTir) >= 0.05) {
    partes.push(`rinde ${puntos(dTir)} ${dTir > 0 ? "más" : "menos"}`);
  }
  // ── EL MES Y EL SCORE, CUANDO NO HAY DESCUENTO (15-sep-2026) ──────────────
  //
  // Esta línea comparaba TIR, costo del día uno y descuento. En AJUSTAR alcanzaba: el eje
  // escaso era el descuento y estaba nombrado. En COMPRAR el descuento desaparece, y las dos
  // dimensiones que quedan moviéndose son justo las dos que la línea NO miraba.
  //
  // Medido sobre las 160 filas COMPRAR: la respuesta de TIR corona otra celda en 99 (61,9%),
  // y en 67 de esas 99 (67,7%) empeora el mes —p50 −$25.600, mínimo −$263.300— y el score
  // —p50 −1—. Son las mismas 67: cuando empeora, empeora las dos juntas. Sin esta parte, la
  // línea de `092b7792` diría «rinde 3,7 puntos más y libera UF 550 el día uno» y callaría
  // los $143.000 que te saca del mes. Las dos mitades ciertas, la foto al revés.
  //
  // Van solo en COMPRAR y no siempre: en los otros veredictos el mes y el score se mueven
  // con el descuento, que la línea ya nombra, y decirlo tres veces sería ruido.
  if (sinUmbral) {
    const dFlujo =
      r.metricas?.flujoMensual != null && rec.metricas?.flujoMensual != null
        ? r.metricas.flujoMensual - rec.metricas.flujoMensual
        : null;
    // El corte en mil pesos: bajo eso es ruido de redondeo en una cifra mensual.
    if (dFlujo != null && Math.abs(dFlujo) >= 1_000) {
      // SIEMPRE «deja», y el signo lo lleva «más»/«menos». Con «saca … menos al mes» salía
      // una doble negación que hay que leer dos veces para saber de qué lado está.
      partes.push(`deja ${plata(Math.abs(dFlujo), currency, valorUF)} ${dFlujo > 0 ? "más" : "menos"} al mes`);
    }
    const dScore = r.score != null && rec.score != null ? Math.round(r.score) - Math.round(rec.score) : null;
    if (dScore != null && dScore !== 0) {
      // El score es ENTERO, así que no pasa por `puntos()`: «4,0 puntos» sobre un número que
      // la página nunca escribe con decimal se lee como otra magnitud.
      const abs = Math.abs(dScore);
      partes.push(`el score queda ${abs} ${abs === 1 ? "punto" : "puntos"} ${dScore > 0 ? "arriba" : "abajo"}`);
    }
  }
  // Y EL COSTO DEL DÍA UNO VIAJA EN UF: hay que llevarlo a la moneda del lector antes de
  // formatearlo, como hace el resto del pop-up. Sin el factor, «UF 205» salía «$205».
  const dUF = r.costoDiaUnoUF - rec.costoDiaUnoUF;
  if (Math.round(dUF) !== 0) {
    const monto = plata(Math.abs(dUF) * valorUF, currency, valorUF);
    partes.push(dUF < 0 ? `libera ${monto} el día uno` : `cuesta ${monto} más de pie`);
  }
  const dDcto = r.descuentoPct - rec.descuentoPct;
  if (Math.abs(dDcto) >= 0.05) {
    partes.push(`le pide ${puntos(dDcto)} ${dDcto > 0 ? "más" : "menos"} de descuento al vendedor`);
  }
  if (partes.length === 0) return "Comparada con la recomendada, no cambia nada de lo que se compara.";
  // Coma entre las primeras y « y » antes de la última, que es como el informe enumera.
  const cola = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0];
  return `Comparada con la recomendada: ${cola}.`;
}

// ── 3 · el ajuste óptimo ────────────────────────────────────────────────────
function SeccionOptimo({
  mix,
  respuesta,
  hayMenu,
  currency,
  valorUF,
  precioUF,
  antes,
}: {
  mix: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>;
  /** La respuesta que se está leyendo. `null` en filas sin menú persistido, y ahí todo se
   *  lee de la raíz, que es exactamente lo que este bloque hacía antes. */
  respuesta: RespuestaMix | null;
  hayMenu: boolean;
  currency: Currency;
  valorUF: number;
  precioUF: number;
  antes: (MetricasCelda & { score?: number | null }) | null;
}) {
  // EL BLOQUE PASA A DESCRIBIR LA RESPUESTA ELEGIDA, NO LA RAÍZ (16-sep-2026). Los siete
  // campos que necesita existen los dos lados con el mismo significado, así que la elección
  // es una sola línea y el resto del bloque no se entera. Sin respuesta —fila vieja sin el
  // campo persistido— cae a la raíz y queda como estaba.
  const r = respuesta;
  const descuentoPct = r ? r.descuentoPct : mix.descuentoPct;
  const sinDescuento = r ? r.sinDescuento : mix.sinDescuento;
  const piePct = r ? r.piePct : mix.piePct;
  const piePctDelta = r ? r.piePctDelta : mix.piePctDelta;
  const plazoAnios = r ? r.plazoAnios : mix.plazoAnios;
  const plazoAniosDelta = r ? r.plazoAniosDelta : mix.plazoAniosDelta;
  const costoDiaUnoUF = r ? r.costoDiaUnoUF : ((mix.celdas ?? []).find((c) => c.esElegida)?.costoDiaUnoUF ?? null);
  const score = r ? r.score : mix.score ?? null;
  const d = (r ? r.metricas : mix.despues) ?? null;

  const actual = (mix.celdas ?? []).find((c) => c.esActual) ?? null;
  const precioObjetivo = precioUF * (1 - descuentoPct / 100);
  const pieAntesUF = actual ? (precioUF * actual.piePct) / 100 : null;
  const pieDespuesUF = pieAntesUF != null && costoDiaUnoUF != null ? pieAntesUF + costoDiaUnoUF : null;

  return (
    <section className="paj-sec">
      {/* EL TÍTULO NOMBRA LA RESPUESTA ELEGIDA. Sin menú se conserva el fijo de siempre: no
          hay nada que nombrar cuando hay un solo camino. */}
      <div className="paj-st">{hayMenu && r ? `El ajuste: ${tituloDe(r).toLowerCase()}` : "El ajuste óptimo"}</div>
      <div className="paj-eleg">
        <div className="paj-chipsm">
          {piePctDelta !== 0 && (
            <span className="paj-chip">
              Pie <s>{dec1(piePct - piePctDelta).replace(",0", "")}%</s>{" "}
              {dec1(piePct).replace(",0", "")}%
            </span>
          )}
          {piePctDelta !== 0 && plazoAniosDelta !== 0 && <span className="paj-plus">+</span>}
          {plazoAniosDelta !== 0 && (
            <span className="paj-chip">
              Plazo <s>{plazoAnios - plazoAniosDelta}</s> {plazoAnios} años
            </span>
          )}
        </div>
        <div className="paj-neg">
          {sinDescuento ? (
            "→ Sin pedir descuento"
          ) : (
            <>
              → Negocias −{pct1(descuentoPct)} dcto. en precio
              <small>
                UF {miles(precioUF)} → UF {miles(precioObjetivo)}
                {/* LA BANDA DE ESFUERZO, QUE YA EXISTÍA Y NO SE VEÍA. El motor clasifica
                    desde hace tiempo cuán conseguible es este descuento —tres bandas con
                    cortes doctrinales 5 y 12, §1.12.1— y hasta hoy el único que lo leía era
                    el modelo que narra. Medido el 15-sep-2026: el 86,8% de las 265 filas con
                    descuento cae en «difícil, requiere vendedor motivado» y se publicaba con
                    la misma cara que un 4%.
                    Va acá y no en la tabla de palancas solas: ese es OTRO descuento —el
                    precio si fuera lo único que mueves— y cae en banda distinta en el 10,5%
                    de las filas. Las dos marcas en el mismo modal dirían dos cosas sobre
                    «el descuento» en una pantalla. */}
                <span className="paj-banda">{ETIQUETA_BANDA_ESFUERZO[bandaEsfuerzoDescuento(descuentoPct).banda]}</span>
              </small>
            </>
          )}
        </div>
        <Par
          label="Pie el día uno"
          antes={pieAntesUF != null ? plata(pieAntesUF * valorUF, currency, valorUF) : PAR_SIN_VALOR}
          despues={pieDespuesUF != null ? plata(pieDespuesUF * valorUF, currency, valorUF) : PAR_SIN_VALOR}
          tono={costoDiaUnoUF != null && costoDiaUnoUF > 0 ? "mal" : undefined}
        />
        <Par label="Cuota mensual" antes={antes?.cuotaMensual != null ? plata(antes.cuotaMensual, currency, valorUF) : PAR_SIN_VALOR} despues={d?.cuotaMensual != null ? plata(d.cuotaMensual, currency, valorUF) : PAR_SIN_VALOR} />
        <Par
          label="Flujo mensual"
          antes={antes?.flujoMensual != null ? plataFirmada(antes.flujoMensual, currency, valorUF) : PAR_SIN_VALOR}
          despues={d?.flujoMensual != null ? plataFirmada(d.flujoMensual, currency, valorUF) : PAR_SIN_VALOR}
          tono={d?.flujoMensual != null ? (d.flujoMensual >= 0 ? "bien" : "mal") : undefined}
        />
        {/* EL PAR DEL RETORNO VA SIEMPRE. Con pie 0 no existe y va con guion: omitirlo
            dejaría seis pares donde el contrato dice siete (21 filas LTR, 8 STR). */}
        <Par
          label="Por cada $100 que pones, al año"
          antes={antes?.cocPct != null ? `${antes.cocPct >= 0 ? "+" : "−"}$${dec1(Math.abs(antes.cocPct)).replace("−", "")}` : PAR_SIN_VALOR}
          despues={d?.cocPct != null ? `${d.cocPct >= 0 ? "+" : "−"}$${dec1(Math.abs(d.cocPct)).replace("−", "")}` : PAR_SIN_VALOR}
          tono={d?.cocPct != null ? (d.cocPct >= 0 ? "bien" : "mal") : undefined}
        />
        <Par label="Cap rate neto" antes={antes?.capRateNetoPct != null ? pct1(antes.capRateNetoPct) : PAR_SIN_VALOR} despues={d?.capRateNetoPct != null ? pct1(d.capRateNetoPct) : PAR_SIN_VALOR} />
        <Par label="TIR a 10 años" antes={antes?.tirPct != null ? pct1(antes.tirPct) : PAR_SIN_VALOR} despues={d?.tirPct != null ? pct1(d.tirPct) : PAR_SIN_VALOR} />
        <Par
          label="Franco Score"
          antes={antes?.score != null ? String(antes.score) : actual?.scoreSinDescuento != null ? String(actual.scoreSinDescuento) : PAR_SIN_VALOR}
          despues={score != null ? String(score) : PAR_SIN_VALOR}
          tono="destino"
        />
      </div>
    </section>
  );
}

/**
 * Un par antes → después. El `tono` NO es decoración:
 *   · `bien` / `mal` es el semáforo del DATO, y solo va donde el dato tiene signo (flujo
 *     mensual, retorno por cada $100). Verde y rojo ahí son la lectura convencional.
 *   · `destino` es el Franco Score de después, que no es un dato con signo sino el número
 *     que declara el veredicto al que llegas: va con el azul de Comprar.
 */
function Par({ label, antes, despues, tono }: { label: string; antes: string; despues: string; tono?: "bien" | "mal" | "destino" }) {
  return (
    <div className="paj-par">
      <div className="l">{label}</div>
      <div className="p">
        <span className="a1">{antes}</span>
        <span className="fl">→</span>
        <span className={`b1${tono ? ` ${tono}` : ""}`}>{despues}</span>
      </div>
    </div>
  );
}

// ── 4 · un cambio a la vez ────────────────────────────────────────────────────
function SeccionSolas({
  solas,
  currency,
  valorUF,
}: {
  solas: PalancaDistancia[];
  currency: Currency;
  valorUF: number;
}) {
  // SIN FILA DE TARIFA, SIN ORACIÓN (16-sep-2026). La nota colgaba de la modalidad, o sea se
  // dibujaba en los 91 pop-ups STR con tabla; en 31 de ellos (34,1%) no hay fila de tarifa y
  // la nota explicaba algo que no está en pantalla —y en 22 de esos 31 la tabla sí tiene una
  // fila del usuario, así que debajo de «lo decides tú» se leía «la pone el mercado».
  // Es la misma doctrina del subtítulo de la matriz: la oración cuelga de lo que describe.
  // `adr` solo existe en renta corta, así que esta condición ya trae la modalidad adentro y
  // la otra sobraba.
  const hayTarifa = solas.some((p) => p.palanca === "adr");
  const cifra = (p: PalancaDistancia) => {
    if (p.palanca === "plazo") return `${p.objetivo} años`;
    if (p.palanca === "pie") return `${dec1(p.objetivo).replace(",0", "")}%`;
    // La columna se llama «Cuánto» y ésta era la única fila que no contestaba con una
    // cantidad: decía «Tú mismo». Ahora dice lo que deja de salir cada mes; sin el monto
    // (palanca persistida antes del campo) cae a los puntos de comisión, que sí es cuánto.
    if (p.palanca === "gestion") {
      return typeof p.comisionMensual === "number" && p.comisionMensual > 0
        ? `−${plata(p.comisionMensual, currency, valorUF)}`
        : `−${pct1(Math.abs(p.deltaPct))} pts`;
    }
    return `${p.deltaPct >= 0 ? "+" : "−"}${pct1(Math.abs(p.deltaPct))}`;
  };
  const detalle = (p: PalancaDistancia) => {
    if (p.palanca === "precio") return `UF ${miles(p.objetivo)}`;
    if (p.palanca === "arriendo") return plata(p.objetivo, currency, valorUF);
    if (p.palanca === "adr") return `${plata(p.objetivo, currency, valorUF)} la noche`;
    // `pct1` ya trae el símbolo: agregarlo otra vez daba «del 20,0%% al 3,0%%» (visto renderizado).
    if (p.palanca === "gestion") return `del ${pct1(p.actual)} al ${pct1(p.objetivo)}`;
    return null;
  };
  return (
    <section className="paj-sec paj-nod">
      {/* EL TÍTULO DEJA DE ORGANIZAR POR DUEÑO (16-sep-2026).
          «No depende de ti» era falso de la tabla entera en 43 de 607 pop-ups LTR (7,1%) y
          11 de 89 STR (12,4%) —ahí TODAS las filas son del usuario— y de alguna fila en 265
          LTR y 49 STR. El dueño ya lo dice cada fila en su `<em>`, así que la sección no
          necesita decirlo, y cuando lo dice, miente.
          Lo que esta tabla responde es OTRA pregunta que la matriz de arriba: qué pasa si se
          mueve UNA sola cosa, sin combinarla con nada. Ese es el eje y ese es el título.
          Sin la palabra «palanca», que es jerga prohibida en copy (`salida-por-mix-catch
          -test.ts:83` y el tier de vocabulario STR) y que este pop-up no dice ni una vez en
          pantalla. Y sin repetir «Si cambia», que es el encabezado de la primera columna dos
          líneas más abajo.
          Ojo: «no depende de ti» sigue vivo y bien usado en la card §5 (`lineaNoDependeDeTi`),
          donde la lista SÍ está filtrada por dueño. Lo que estaba mal era pedirle la frase a
          una tabla sin filtrar. Diverge del contrato (popup-palancas-final.html:263),
          anotado ahí. */}
      <div className="paj-st">Un cambio a la vez</div>
      <table>
        <tbody>
          <tr>
            <th>Si cambia</th>
            <th>Cuánto</th>
            <th>Llegas a</th>
          </tr>
          {solas.map((p, i) => (
            <tr key={`${p.palanca}-${i}`}>
              <td>
                {NOMBRE[p.palanca]}
                <em>{FRASE_DEL_DUENO[QUIEN_LA_PONE[p.palanca]]}</em>
              </td>
              <td className="num">
                {cifra(p)}
                {detalle(p) && <small>{detalle(p)}</small>}
              </td>
              <td className={`dst${p.destino === "COMPRAR" ? " comprar" : ""}`}>
                {p.destino ? etiquetaVeredicto(p.destino, "frase") : PAR_SIN_VALOR}
                <small>score {p.score ?? PAR_SIN_VALOR}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hayTarifa && <p className="paj-sx paj-pie">La tarifa la pone el mercado, no tú.</p>}
    </section>
  );
}

// ── COMPRAR · cuánto aguanta el veredicto ───────────────────────────────────
//
// NO HAY MATRIZ NI ÓPTIMO: no hay a dónde subir, y sensibilizar hacia arriba sería
// inventar un veredicto que no existe.
//
// Y TAMPOCO HAY BARRAS (13-sep-2026). Hubo dos rieles dibujando las fronteras —el arriendo
// que puede caer y el precio que puede subir— y se retiraron: las tres filas ya dicen lo
// mismo con oraciones completas, y una barra que repite una oración no agrega profundidad,
// agrega una segunda lectura que hay que reconciliar con la primera. Peor todavía, las dos
// se leían en direcciones opuestas —una cae, la otra sube— así que el mismo riel
// significaba cosas distintas según cuál mirabas. La frontera es un número con su oración;
// eso ya está.
//
// Queda el pop-up más corto que el resto, y está bien: en COMPRAR hay menos que decir.
function SeccionComprar({ filas }: { filas: FilaLoQueHariaYo[] }) {
  const verifica = filas.some((f) => f.rotuloCorto === "Verifica");
  return (
    <section className="paj-sec paj-nod paj-aguanta">
      <div className="paj-st">{verifica ? "Cuánto aguanta, y qué verificar" : "Cuánto aguanta este veredicto"}</div>
      <table>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${f.titulo}-${i}`}>
              <td>
                {f.rotuloCorto ?? f.titulo}
                {/* LA BANDA DEL MARGEN (15-sep-2026). El motor clasifica en tres desde Fase 0
                    y acá se escribía la misma oración en los tres casos: 44 de las 217 filas
                    COMPRAR del parque aguantan menos de 7 puntos y se leían igual que una que
                    aguanta 48 —en renta corta, 23 de 57—. La forma es la de la tabla de
                    abajo: `.paj-nod td:first-child em` es la MISMA regla que pone «lo pone el
                    vendedor» bajo el nombre de la palanca, y esta sección ya la hereda porque
                    comparte `paj-nod`. Cero CSS nuevo. */}
                {f.banda && <em>{ETIQUETA_BANDA_MARGEN[f.banda]}</em>}
              </td>
              <td className="paj-oracion">
                {f.oracion ?? f.cifra}
                {/* A DÓNDE CAE SI SE PASA DEL BORDE. Lo medía la misma bisección que publica
                    la cifra y lo botaba adentro del predicado. Cae a Ajustar en 213 de las
                    217 filas COMPRAR; una sola cae a Buscar otro, y esa es justamente la que
                    no se puede leer igual que las demás.
                    Sin dato no va la línea: con `firme` nadie miró más abajo. */}
                {f.caeA && (
                  <small>
                    {f.rotuloCorto === "Precio" ? "Por encima de eso" : "Abajo de eso"}, pasa a{" "}
                    {etiquetaVeredicto(f.caeA, "frase")}.
                  </small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── el CTA, INERTE hasta el bloque C ────────────────────────────────────────
function Cta({
  mix,
  precioUF,
}: {
  mix: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>;
  precioUF: number;
}) {
  // EL CTA SIGUE LEYENDO LA RAÍZ, o sea la recomendación, y no la respuesta elegida: es un
  // botón inerte que nombra UN precio objetivo, y prometer el de la respuesta que el lector
  // está mirando sería ofrecer tres precios distintos con el mismo botón. Cuando el CTA deje
  // de ser inerte, esta decisión se toma con su propio radio.
  const objetivo = precioUF * (1 - mix.descuentoPct / 100);
  // INERTE A PROPÓSITO (13-sep-2026): el botón se dibuja con el precio negociado y NO
  // navega. Conectarlo pide que el wizard acepte un precio por query y, sobre todo, que
  // esté tomada la decisión de si un re-análisis consume crédito. Hasta entonces, un CTA
  // que navega cobraría un análisis que nadie decidió cobrar.
  if (mix.sinDescuento) return null;
  return (
    <div className="paj-cta">
      <p>Si consigues ese precio, el informe cambia entero.</p>
      <span className="paj-btn" aria-disabled="true">
        <span className="ico" />
        Analízalo a UF {miles(objetivo)}
      </span>
    </div>
  );
}
