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
  gestion: "Gestión",
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
 * LO QUE LA CELDA ESCRIBE (14-sep-2026). Cada celda muestra su lectura en el descuento
 * mínimo —lo que CONSEGUIRÍAS con ella— salvo la del aro, que muestra la lectura a precio
 * de hoy: lo que TIENES. `esActual` es «el pie y el plazo que declaraste», no «tu caso».
 *
 * Fuente única a propósito: la palabra, el score, el color y el panel de detalle leen de
 * acá, así que no pueden separarse. La primera versión de este arreglo cambió solo la
 * palabra y dejó el color leyendo `c.veredicto`: la celda del aro quedó con fondo azul
 * —«llega a Comprar»— y con «Ajustar score 67» escrito adentro.
 */
function veredictoMostrado(c: CeldaMix) {
  return c.esActual ? c.veredictoSinDescuento : c.veredicto;
}
function scoreMostrado(c: CeldaMix) {
  return c.esActual ? c.scoreSinDescuento : c.score;
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
  return (mixAComprar(v)?.celdas?.length ?? 0) > 0 || (v.palancas?.length ?? 0) > 0;
}

export function PopupAjustes({
  veredicto,
  distancia,
  filasComprar,
  currency,
  valorUF,
  precioUF,
  antes,
}: PopupAjustesProps) {
  const v = distancia?.valor;
  const mix = v ? mixAComprar(v) : null;
  const celdas = mix?.celdas ?? [];
  const solas = v?.palancas ?? [];
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

      {esComprar ? (
        <SeccionComprar filas={filasComprar ?? []} />
      ) : (
        celdas.length > 0 && (
          <SeccionMatriz
            celdas={celdas}
            destino={destino}
            sel={sel}
            onSel={(c) => {
              setSel(c);
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

      {hayMenu && !esComprar && (
        <SeccionRespuestas
          respuestas={respuestas}
          criterio={respuestaSel?.criterio ?? "score"}
          onElegir={setCriterio}
          currency={currency}
          valorUF={valorUF}
        />
      )}

      {!esComprar && mix && celdas.length > 0 && (
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
  // UNA SOLA CELDA no es ni matriz ni línea: es UNA combinación. Son 23 filas LTR, donde el
  // pie ya está en el techo y el plazo también. Dibujarle ejes, cabeceras y leyenda a un
  // cuadrito solo sería andamiaje alrededor de una sola afirmación, así que se dice en
  // palabras y el detalle queda a un clic, igual que en la matriz.
  const unaSola = celdas.length === 1;

  if (unaSola) {
    const c = celdas[0];
    // ESTA RAMA ESCRIBE `c.veredicto`, ASÍ QUE SU COLOR LEE `c.veredicto`. No es un olvido:
    // es la misma regla que la matriz, aplicada a lo que esta rama dice. Si algún día la
    // celda única pasa al precio de hoy, acá se cambia la palabra Y esta línea, juntas.
    const cruza = cruzaSegun(c.veredicto, c, destino);
    return (
      <section className="paj-sec">
        {/* ESTE TÍTULO NO SE MOVIÓ, A PROPÓSITO (16-sep-2026). La otra rama pasó a «Las
            combinaciones que Franco probó»; acá el plural mentiría, porque hay UNA. La forma
            que calzaría —«La única combinación»— es la misma frase que ya dice el pie de esta
            rama, y las 13 filas de celda única viajan juntas en su propio goal (decisión
            Fabrizio). Las dos ramas son excluyentes, así que estos dos títulos nunca se ven
            juntos.
            LO QUE SÍ CONVIVE, y hay que saberlo: en estas 13 filas la tabla de abajo ya dice
            «Un cambio a la vez». O sea que el pop-up queda con un título de DUEÑO arriba y
            uno de EJE abajo. No se contradicen —son dos cosas distintas, no dos respuestas a
            la misma pregunta— pero la oposición limpia que había («depende de ti» / «no
            depende de ti») se perdió, y este título sigue siendo el impreciso de los dos: su
            celda también promete un descuento, que lo pone el vendedor. Eso se arregla con
            las 13, no acá. */}
        <div className="paj-st">Ajustes que dependen de ti</div>
        <div className="paj-unica" onClick={() => onSel(sel ? null : c)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSel(sel ? null : c); }}>
          <span className="k">
            Con pie {dec1(c.piePct).replace(",0", "")}% a {c.plazoAnios} años
          </span>
          {/* PENDIENTE DE DECISIÓN, NO DE CÓDIGO (medido el 14-sep-2026). Esta rama sigue
              diciendo la lectura del descuento mínimo, así que en las 12 filas LTR que la
              usan —las 12 tienen celda de hoy y las 12 contradicen a su fila— el cuadrito
              dice «Comprar 70» sobre un informe que dice «Ajustar 68».
              Es el mismo bug que la matriz acaba de perder, pero acá no hay aro ni chip ni
              segunda celda: con UNA sola combinación no hay dos lecturas que separar, y
              cambiar la palabra se llevaría de la cara la promesa «con −X% llegas a
              Comprar» sin superficie donde devolverla. Eso es decisión de producto y no se
              inventa acá. `veredictoMostrado` ya existe para cuando se decida. */}
          <span className={`v${cruza ? " cruza" : ""}`}>
            {etiquetaVeredicto(c.veredicto, "frase")} · score {c.score ?? PAR_SIN_VALOR}
          </span>
        </div>
        <p className="paj-sx paj-pie">Es la única combinación que Franco puede probar: tu pie y tu plazo ya están en el techo.</p>
        {sel && <PanelCelda sel={sel} destino={destino} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />}
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
          Cuando no hay celda de hoy —16 filas LTR y 2 STR— la segunda mitad no se dice. */}
      <p className="paj-sx">
        El descuento que pides se ajusta en consecuencia.
        {hayActual ? " La del aro no: va a precio de hoy." : ""}
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
                  return (
                    <td
                      key={plazo}
                      className={clases}
                      onClick={() => onSel(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onSel(c);
                      }}
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
        <span>
          <i className="paj-sw b" />
          llega a {etiquetaVeredicto(destino, "frase")}
        </span>
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

      {sel && <PanelCelda sel={sel} destino={destino} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />}
    </section>
  );
}

/** El detalle de una celda: los DOS datos que la matriz no muestra y su ✕. */
function PanelCelda({
  sel,
  destino,
  currency,
  valorUF,
  onCerrar,
}: {
  sel: CeldaMix;
  destino: Veredicto;
  currency: Currency;
  valorUF: number;
  onCerrar: () => void;
}) {
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
        {/* LAS DOS LECTURAS, SEPARADAS Y CADA UNA CON SU RÓTULO. La celda del aro dice lo que
            TIENES; acá se dice a dónde llega esa misma combinación SI pides el descuento. Sin
            esta separación el panel rotulaba «Pides de descuento −24,2%» sobre una celda que
            acababa de decir «Ajustar», y la contradicción se mudaba del cuadrito al clic. */}
        {/* DOS CASOS QUE ESTABAN COLAPSADOS EN UNO, Y SOLO UNO ERA CIERTO (16-sep-2026).
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
        <span className="l">{sel.esActual ? "Pidiendo descuento llegas a" : "Pides de descuento"}</span>
        <span className="v">
          {sel.descuentoPct === null
            ? `no llega a ${etiquetaVeredicto(destino, "frase")}`
            : sel.esActual
              ? sel.descuentoPct === 0
                ? `${etiquetaVeredicto(sel.veredicto, "frase")} sin pedir nada`
                : `${etiquetaVeredicto(sel.veredicto, "frase")} con −${pct1(sel.descuentoPct)}`
              : sel.descuentoPct === 0
                ? "nada"
                : `−${pct1(sel.descuentoPct)}`}
        </span>
        <span className="l">Pie extra el día uno</span>
        <span className={`v${sel.costoDiaUnoUF > 0 ? " mal" : ""}`}>
          {sel.costoDiaUnoUF === 0 ? "—" : plataFirmada(sel.costoDiaUnoUF * valorUF, currency, valorUF)}
          {/* LA NOTA NO ES UN ERROR, ES UN PRECIO. La celda llega —el cuadrito lo dice y el
              color ahora también— y lo que se declara es cuánto capital pide de más respecto
              de lo que Franco recomienda poner. Cuelga del pie y no del descuento porque es
              el pie lo que se encareció. Precedente de forma: `.paj-neg small`. */}
          {sel.descuentoPct !== null && !sel.alcanzable && (
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
  currency,
  valorUF,
}: {
  respuestas: RespuestaMix[];
  criterio: CriterioRespuesta;
  onElegir: (c: CriterioRespuesta) => void;
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
      <p className="paj-sx">
        {vistas.length === 2 ? "Los dos llegan" : "Los tres llegan"} a Comprar. Cambia qué le pides al vendedor y
        cuánta plata pones tú.
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
                  ) : (
                    <>
                      <span className="nb">
                        Pie {dPie && <><s>{dec1(r.piePct - r.piePctDelta).replace(",0", "")}%</s>{" "}</>}
                        {dPie ? <b>{dec1(r.piePct).replace(",0", "")}%</b> : `${dec1(r.piePct).replace(",0", "")}%`} ·
                      </span>{" "}
                      <span className="nb">
                        Plazo {dPlazo && <><s>{r.plazoAnios - r.plazoAniosDelta}</s>{" "}</>}
                        {dPlazo ? <b>{r.plazoAnios} años</b> : `${r.plazoAnios} años`} ·
                      </span>{" "}
                      <span className="nb">{r.sinDescuento ? "no pides descuento" : `pides ${pct1(r.descuentoPct)}`}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="paj-opt-v">{sinCelda ? destinoDe(r) : cifraDe(r, currency, valorUF)}</div>
              <div className="disco">{on ? "✓" : "›"}</div>
              <div className="paj-opt-tr">
                {sinCelda ? "Mover el pie o el plazo no ayuda: el ajuste es solo de precio." : tradeOffDe(r, rec, currency, valorUF)}
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
function destinoDe(r: RespuestaMix) {
  return (
    <>
      {etiquetaVeredicto("COMPRAR", "frase")}
      <small>llegas a · score {r.score ?? PAR_SIN_VALOR}</small>
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
function tradeOffDe(r: RespuestaMix, rec: RespuestaMix | null, currency: Currency, valorUF: number): string {
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
    if (p.palanca === "gestion") return p.modoGestionObjetivo === "auto" ? "Tú mismo" : "Administrador";
    return `${p.deltaPct >= 0 ? "+" : "−"}${pct1(Math.abs(p.deltaPct))}`;
  };
  const detalle = (p: PalancaDistancia) => {
    if (p.palanca === "precio") return `UF ${miles(p.objetivo)}`;
    if (p.palanca === "arriendo") return plata(p.objetivo, currency, valorUF);
    if (p.palanca === "adr") return `${plata(p.objetivo, currency, valorUF)} la noche`;
    if (p.palanca === "gestion") return `comisión ${pct1(p.objetivo)}`;
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
