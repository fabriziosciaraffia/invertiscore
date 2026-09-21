/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · LA FRASE ESTRUCTURAL STR DEJA DE NEGAR EL MIX — catch-test (12-sep-2026). 0 tokens.
// ============================================================================
// Espejo STR de las siete líneas de LTR (goal del 10-sep): afirmaciones deterministas que
// contradicen al bloque que las acompaña en la misma página. El motor STR sabe desde 7cdf3250
// que 16 filas estructurales tienen combinación —7 AJUSTA a COMPRAR, 9 BUSCAR solo al
// escalón— y cinco superficies seguían diciendo «no hay forma»:
//
//   1. EL HALLAZGO (titular y cierre de la fraseCanonica, distancia-veredicto-str-hallazgo.ts).
//      No se renderiza —la pirámide lo filtra— pero entra al user prompt, y v19 lo cazó desde
//      adentro: el francoCaveat del modelo dijo «DISTANCIA señala que la brecha es del negocio,
//      pero SALIDA COMBINADA confirma hayMixACOMPRAR=sí». Con mix: «Con lo tuyo —pie y plazo—
//      y un descuento de X% llega a Comprar» (sin descuento, la forma corta; desde BUSCAR al
//      escalón, «llega a Ajustar, no a Comprar», con la etiqueta única). Sin combinación no cambia nada.
//   2. EL POP-UP «Ver ajustes» (hasta el 13-sep `DrawerDistanciaStr`, borrado el 17-sep;
//      hoy `PopupAjustes`): intro, pie de la matriz y cierre «Este
//      departamento no da».
//   3. EL PDF (DocumentoSTR, bloque «por qué no cierra»).
//   4. EL FOOTER DE LA CARD §5 (HeroStrDictamen): «Ninguno mueve el veredicto» gana «; juntos,
//      sí» como LTR, y «; juntos, solo hasta Ajustar» desde BUSCAR.
//   5. EL CAPÍTULO «Cómo lo pagas» (CapitulosInversionStr): «fuera de lo negociable».
//
// Todo el copy sale de salida-por-mix.ts, un solo módulo, con `salidaPorMixStr` y
// `mixAlEscalonStr` como fuente (la misma que la card y el prompt). Los hallazgos se
// RECONSTRUYEN desde los fixtures con la cadena de la página (sin base): el fixture guarda
// la frase vieja y este tier mide la que el motor escribe HOY.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/salida-str-copy-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { salidaPorMixStr, mixAlEscalonStr, cierreFraseCanonicaStr, pieDocumentoSalidaStr, lineaMiniSalida, pieDocumentoSalida } from "../../../src/lib/salida-por-mix";
import { lineaFooterVias } from "../../../src/lib/palancas-en-palabras";
import { etiquetaVeredicto } from "../../../src/lib/veredicto-etiqueta";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";

/** La etiqueta única del escalón (goal 10a): «Ajustar». El PDF conserva «Ajusta supuestos» hasta 10b. */
const ESCALON = etiquetaVeredicto("AJUSTA SUPUESTOS");

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const fixtures = JSON.parse(leer("src/app/dev/drawers-pixel/fixtures.json")) as Record<string, any>;

/** El hallazgo de distancia, reconstruido HOY desde el fixture (la MISMA cadena que la página). */
function distanciaDe(clave: string): HallazgoDistanciaVeredicto {
  const fx = fixtures[clave];
  const d = fx.input_data as Record<string, unknown>;
  const uf = Number(d.precioCompra) / Number(d.precioCompraUF);
  const ctx = buildStrRecomputeCtx(d, fx.results, uf);
  if (!ctx) throw new Error(`${clave}: irreconstruible`);
  const asOf = new Date(fx.created_at);
  const result = calcShortTerm(ctx.inputs, asOf);
  const francoScore = calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra: ctx.inputs.precioCompra });
  const hallazgos = mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
    result, francoScore, comuna: String(fx.comuna ?? ""), precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
    piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number,
    mediana: { mediana: null, n: 0 }, valorUF: uf, incluyeCorretaje: false, veredictoCtx: { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf },
  }));
  const h = hallazgos.find((x): x is HallazgoDistanciaVeredicto => x.id === "distancia_veredicto");
  if (!h) throw new Error(`${clave}: sin distancia_veredicto`);
  return h;
}

// ── 1 · el hallazgo: titular y cierre según la combinación ──────────────────
{
  // AJUSTA estructural con mix a COMPRAR (761b08ad): pie 30% + plazo 30 años + descuento.
  // El descuento se LEE del motor y no se fija: era −17,5% hasta el 12-sep-2026 y pasó a
  // −15% con el score de retorno sobre lo puesto (cash-on-cash y TIR como dimensiones: con
  // más pie la celda cruza antes). Lo que fija este bloque es que el cierre diga el MISMO
  // número que `descuentoQueAdemásPide`, no cuál es ese número.
  const h = distanciaDe("estructuralMixStr");
  const salidaH = salidaPorMixStr(h.valor);
  if (!h.valor.esEstructural || !salidaH) F("1 · estructuralMixStr tenía que ser estructural con combinación a COMPRAR");
  if (h.titular !== "Ningún ajuste por separado lo lleva al veredicto de arriba; juntos, sí.") F(`1 · titular con mix: «${h.titular}»`);
  const dH = salidaH?.descuentoPct ?? null;
  if (dH === null) F("1 · estructuralMixStr tenía que pedir descuento además del pie y el plazo");
  else {
    // EL PIN SE PARTIÓ EN TRES (17-sep-2026) y con eso mide más, no menos. Era un literal
    // que incluía «Con lo tuyo —pie y plazo—», y al entrar el cualificador de
    // `hayOtrosCaminos` ese literal se rompió — correctamente: el guard cazó el cambio. Pero
    // lo que este bloque declara vigilar, y dice arriba, es que el cierre diga el MISMO
    // número que `descuentoQueAdemásPide`; la forma del inciso era incidental. Ahora van por
    // separado el número, lo que se mueve, y el cualificador con sus dos direcciones.
    if (!h.fraseCanonica.includes(`y un descuento de ${String(dH).replace(".", ",")}% llega a Comprar.`)) {
      F(`1 · el cierre no lee descuentoQueAdemásPide (${dH}%): «${h.fraseCanonica.slice(-160)}»`);
    }
    if (!/Con lo tuyo —pie y plazo(,|—)/.test(h.fraseCanonica)) F(`1 · el cierre dejó de nombrar lo que se mueve: «${h.fraseCanonica.slice(-160)}»`);
    // LAS DOS DIRECCIONES: nombrar de más promete una elección que no existe, y nombrar de
    // menos entrega una de varias como si fuera la única — que es la premisa incompleta que
    // este cambio vino a sacar del prompt.
    const cualifica = /, lo que Franco recomienda—/.test(h.fraseCanonica);
    if (salidaH?.hayOtrosCaminos === true && !cualifica) F("1 · con más de un camino el cierre tiene que nombrar CUÁL describe");
    if (salidaH?.hayOtrosCaminos !== true && cualifica) F("1 · con un solo camino —o sin medir— el cierre NO puede nombrar «lo que Franco recomienda»");
  }
  if (/brecha/i.test(h.fraseCanonica)) F("1 · con combinación la frase sigue diciendo «brecha»");
  if (!/no cambia el veredicto; recién/.test(h.fraseCanonica)) F("1 · la primera oración (los topes probados de a uno) tenía que quedar: sigue siendo verdad");

  // BUSCAR estructural con mix solo al escalón (grajalesStr 5dc42a82): pie 25% + plazo 30 + −11%.
  const g = distanciaDe("grajalesStr");
  const escalonG = mixAlEscalonStr(g.valor);
  if (salidaPorMixStr(g.valor) || !escalonG) F("1 · grajalesStr tenía que llegar solo al escalón");
  if (g.titular !== "Ningún ajuste por separado lo lleva al veredicto de arriba; juntos, sí.") F(`1 · titular al escalón: «${g.titular}»`);
  // EL NÚMERO SE LEE DEL MOTOR, NO SE ESCRIBE ACÁ (14-sep-2026). Esta línea fijaba «11%» a
  // mano sobre un hallazgo RECOMPUTADO, así que vigilaba una cifra en vez del invariante. Al
  // pasar el redondeo del descuento de `round` a `ceil` el motor publicó 11,1% y el test se
  // puso rojo por un cambio correcto. Su hermana de arriba ya leía `salidaH.descuentoPct`;
  // ahora las dos hacen lo mismo y lo que se vigila es que el cierre CITE el número del
  // motor, que es el invariante que importa.
  const dG = escalonG?.descuentoPct ?? null;
  if (dG === null) F("1 · grajalesStr tenía que pedir descuento además del pie y el plazo");
  else if (!g.fraseCanonica.includes(`Con lo tuyo —pie y plazo— y un descuento de ${String(dG).replace(".", ",")}% llega a ${ESCALON}, no a Comprar.`)) {
    F(`1 · el cierre al escalón no lee el descuento del motor (${dG}%): «${g.fraseCanonica.slice(-160)}»`);
  }

  // Sin combinación (maculStrSinSalida 213d321c): nada cambia.
  const m = distanciaDe("maculStrSinSalida");
  if (salidaPorMixStr(m.valor) || mixAlEscalonStr(m.valor)) F("1 · maculStrSinSalida no tenía combinación");
  if (m.titular !== "Ningún ajuste realista lo lleva al veredicto de arriba.") F(`1 · sin combinación el titular cambió: «${m.titular}»`);
  if (!/La brecha (es del negocio|no es de este departamento)/.test(m.fraseCanonica)) F("1 · sin combinación el cierre de siempre tenía que quedar");
}

// ── 2 · el copy, desde el único módulo ──────────────────────────────────────
{
  // `hayOtrosCaminos: false` en los dos de base — son los que estaban antes del menú de
  // respuestas y describen el caso de UN solo camino. La rama nueva se prueba abajo, con su
  // propio par: sin eso, el campo entra al tipo y ninguna aserción lo ejercita.
  const s = { movimiento: "el pie en 30% y el plazo en 30 años", remate: "moviendo dos cosas a la vez", descuentoPct: 17.5, costoDiaUnoUF: 261, mueve: ["pie", "plazo"] as ("pie" | "plazo")[], hayOtrosCaminos: false };
  const sin = { ...s, movimiento: "el pie en 30%", remate: "subiendo el pie", descuentoPct: null, mueve: ["pie"] as ("pie" | "plazo")[] };
  if (cierreFraseCanonicaStr(s, null) !== "Con lo tuyo —pie y plazo— y un descuento de 17,5% llega a Comprar.") F(`2 · cierreFraseCanonicaStr con descuento: «${cierreFraseCanonicaStr(s, null)}»`);
  if (cierreFraseCanonicaStr(sin, null) !== "Con lo tuyo —el pie— sí llega a Comprar.") F(`2 · cierreFraseCanonicaStr forma corta: «${cierreFraseCanonicaStr(sin, null)}»`);
  if (cierreFraseCanonicaStr(s, ESCALON) !== `Con lo tuyo —pie y plazo— y un descuento de 17,5% llega a ${ESCALON}, no a Comprar.`) F(`2 · cierreFraseCanonicaStr al escalón: «${cierreFraseCanonicaStr(s, ESCALON)}»`);
  // ── EL CUALIFICADOR, LAS DOS RAMAS (17-sep-2026) ──────────────────────────
  // Con más de un camino las tres superficies sin menú nombran CUÁL describen; con uno solo
  // no dibujan nada. Se prueban las dos formas de cada una: verificar solo la que cambió deja
  // sin gate a la que se quedó igual, que es la que el 71% de las filas ve.
  {
    const uno = { ...s, hayOtrosCaminos: false };
    const varios = { ...s, hayOtrosCaminos: true };
    const REC = "lo que Franco recomienda";

    const miniUno = lineaMiniSalida(uno, "Ajusta supuestos");
    const miniVarios = lineaMiniSalida(varios, "Ajusta supuestos");
    if (miniUno.includes(REC)) F(`2b · lineaMiniSalida nombra la recomendada con UN solo camino: «${miniUno}»`);
    if (!miniVarios.includes(`con ${REC} —el pie en 30% y el plazo en 30 años—`)) {
      F(`2b · lineaMiniSalida no antepone el cualificador con varios caminos: «${miniVarios}»`);
    }

    const pieUno = pieDocumentoSalida(uno);
    const pieVarios = pieDocumentoSalida(varios);
    if (pieUno.includes(REC)) F(`2b · pieDocumentoSalida nombra la recomendada con UN solo camino: «${pieUno}»`);
    if (!pieVarios.includes(`el plazo en 30 años, que es ${REC},`)) {
      F(`2b · pieDocumentoSalida no nombra la recomendada con coma: con rayas quedan TRES en la misma oración — «${pieVarios}»`);
    }

    // El caso ESCALÓN también, que no tenía ninguna aserción: es el que arma la frase más
    // larga y donde el cualificador convive con el destino.
    const escUno = pieDocumentoSalidaStr(uno, ESCALON);
    const escVarios = pieDocumentoSalidaStr(varios, ESCALON);
    if (escUno.includes(REC)) F(`2b · pieDocumentoSalidaStr(escalón) nombra la recomendada con UN camino: «${escUno}»`);
    if (!escVarios.includes(`de descuento —${REC}—`)) {
      F(`2b · en el escalón el cualificador no va DESPUÉS del descuento: la recomendada es la celda entera, no solo el movimiento — «${escVarios}»`);
    }

    const strUno = pieDocumentoSalidaStr(uno, null);
    const strVarios = pieDocumentoSalidaStr(varios, null);
    if (strUno.includes(REC)) F(`2b · pieDocumentoSalidaStr nombra la recomendada con UN solo camino: «${strUno}»`);
    if (!strVarios.includes(`de descuento —${REC}—`)) {
      F(`2b · pieDocumentoSalidaStr no pone el cualificador después del descuento: «${strVarios}»`);
    }

    // Y EL NOMBRE ES EL DEL MENÚ, no uno nuevo: se lee de `PopupAjustes.tsx` en vez de
    // fijarlo acá. Con el literal escrito dos veces, renombrar el del menú deja este verde.
    // Sin comentarios: ese archivo está lleno de actas que citan literales del contrato, así
    // que sobre el texto crudo una nota satisface al predicado. (Cuarta vez en este arco.)
    const POPUP = leer("src/components/analysis/shared/PopupAjustes.tsx")
      .replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (!/score: "Lo que Franco recomienda"/.test(POPUP)) {
      F("2b · el menú dejó de llamarla «Lo que Franco recomienda»: el cualificador del PDF y del share quedó con un nombre que ya no existe");
    }
  }

  // ── Y QUIÉN PRODUCE `hayOtrosCaminos` (17-sep-2026) ───────────────────────
  // Los fixtures de arriba lo fijan a mano, así que prueban a los CONSUMIDORES y no al
  // productor: con `desdeMix` devolviendo siempre `false` —o siempre `true`— las seis
  // aserciones de arriba siguen verdes. Verificado por mutación; por eso va este par.
  //
  // El fixture declara solo los campos que `salidaPorMixStr` → `desdeMix` lee, que es toda
  // la superficie de esa cadena. Las dos respuestas difieren en `plazoAnios`: la clave de
  // fusión del motor es la TRIPLETA (pie, plazo, descuento), así que dos objetos con las
  // mismas coordenadas son UNA línea para el lector y tienen que contar como una.
  {
    const raiz = {
      piePctDelta: 5, piePct: 30, plazoAniosDelta: 5, plazoAnios: 30,
      sinDescuento: false, descuentoPct: -17.5, costoDiaUnoUF: 261,
      dentroDelAlcance: true, redundanteConPalancaSola: false,
    };
    const valor = (respuestas: unknown[]) =>
      ({ esEstructural: true, veredictoBase: "AJUSTA SUPUESTOS", mixPalancas: { ...raiz, respuestas } } as unknown as Parameters<typeof salidaPorMixStr>[0]);
    const r = (piePct: number, plazoAnios: number) => ({ piePct, plazoAnios, descuentoPct: -17.5 });

    const una = salidaPorMixStr(valor([r(30, 30)]));
    if (!una) F("2c · el fixture de UN camino no produjo salida: el resto del bloque no midió nada");
    else if (una.hayOtrosCaminos) F("2c · `hayOtrosCaminos` es true con UNA sola respuesta");

    const dos = salidaPorMixStr(valor([r(30, 30), r(30, 25)]));
    if (!dos) F("2c · el fixture de DOS caminos no produjo salida");
    else if (!dos.hayOtrosCaminos) F("2c · `hayOtrosCaminos` es false con DOS respuestas en coordenadas distintas");

    // Y LA FUSIÓN: dos objetos en la MISMA celda son una línea, no dos.
    const fusionadas = salidaPorMixStr(valor([r(30, 30), r(30, 30)]));
    if (fusionadas?.hayOtrosCaminos) {
      F("2c · dos respuestas en la MISMA celda cuentan como dos caminos: el lector ve una línea y el PDF nombraría una elección que no existe");
    }

    // LAS TRES COORDENADAS, CADA UNA CON SU PAR. Con los tres fixtures variando solo el
    // plazo, borrar `piePct` o `descuentoPct` de la clave quedaba VERDE — y el motor fusiona
    // por la TRIPLETA, así que dos respuestas que comparten pie y plazo pero piden distinto
    // descuento SON dos líneas para el lector. Lo marcó la revisión adversaria.
    const soloPie = salidaPorMixStr(valor([r(30, 30), { piePct: 25, plazoAnios: 30, descuentoPct: -17.5 }]));
    if (!soloPie?.hayOtrosCaminos) F("2c · dos respuestas que solo difieren en el PIE cuentan como un camino");
    const soloDesc = salidaPorMixStr(valor([r(30, 30), { piePct: 30, plazoAnios: 30, descuentoPct: -12 }]));
    if (!soloDesc?.hayOtrosCaminos) F("2c · dos respuestas que solo difieren en el DESCUENTO cuentan como un camino");

    // ⛔ AUSENTE ≠ VACÍO, y las dos formas dicen cosas distintas.
    const vacio = salidaPorMixStr(valor([]));
    if (vacio?.hayOtrosCaminos !== false) F("2c · con `respuestas: []` —medido, no hay— el campo debería ser false y da " + String(vacio?.hayOtrosCaminos));
    const ausente = salidaPorMixStr({ esEstructural: true, veredictoBase: "AJUSTA SUPUESTOS", mixPalancas: { ...raiz } } as unknown as Parameters<typeof salidaPorMixStr>[0]);
    if (ausente?.hayOtrosCaminos !== null) {
      F("2c · con `respuestas` AUSENTE el campo tiene que ser `null`: leerlo como false hace que el ksub afirme «solo con…» sobre algo que nadie midió");
    }
  }

  // ⛔ `cierrePopupEscalonStr` y `cierrePopupSalida` SE RETIRARON (17-sep-2026). Vivían en
  //   `DrawerDistanciaStr` —cero importadores en todo el repo— y en `DrawerDistanciaLtr`,
  //   detrás de `drawerSequence = ["zona"]`. Su contenido no quedó huérfano: lo dice el
  //   pop-up de ajustes, que además dice a dónde CAE la celda. Estas dos aserciones se van
  //   con ellas; lo que el lector sí ve sigue vigilado en los bloques 2b, 2c y 3b.
  if (pieDocumentoSalidaStr(s, null) !== "Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero con el pie en 30% y el plazo en 30 años, y un 17,5% de descuento, sí. Lo que pide es plata tuya el día uno.") F(`2 · pieDocumentoSalidaStr a Comprar: «${pieDocumentoSalidaStr(s, null)}»`);
  if (pieDocumentoSalidaStr(sin, "Ajusta supuestos") !== "Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero con el pie en 30% llega a Ajusta supuestos, no a Comprar. Lo que pide es plata tuya el día uno.") F(`2 · pieDocumentoSalidaStr al escalón: «${pieDocumentoSalidaStr(sin, "Ajusta supuestos")}»`);
  if (lineaFooterVias(0, 5, true) !== "Franco probó cinco ajustes por separado. Ninguno mueve el veredicto; juntos, sí.") F(`2 · lineaFooterVias con salida: «${lineaFooterVias(0, 5, true)}»`);
  if (lineaFooterVias(0, 5, true, ESCALON) !== `Franco probó cinco ajustes por separado. Ninguno mueve el veredicto; juntos, solo hasta ${ESCALON}.`) F(`2 · lineaFooterVias al escalón: «${lineaFooterVias(0, 5, true, ESCALON)}»`);
  if (lineaFooterVias(0, 4, true) !== "Franco probó cuatro ajustes por separado. Ninguno mueve el veredicto; juntos, sí.") F("2 · la línea de LTR (cuatro ajustes, sin escalón) cambió");
}

// ── 3 · las cuatro superficies leen del módulo ──────────────────────────────
{
  // ⚠ ACTA (13-sep-2026) · EL POP-UP DEJÓ DE TENER PROSA. Hasta hoy esta parte fijaba tres
  // cosas del cuerpo de `DrawerDistanciaStr`: que leyera `salidaPorMixStr` y
  // `mixAlEscalonStr`, que usara los cierres del módulo (`cierrePopupSalida` /
  // `cierrePopupEscalonStr`) y que no quedara el cierre viejo hardcodeado.
  //
  // El pop-up nuevo (`PopupAjustes`, bloque B) NO tiene intro ni cierre en prosa: es título,
  // matriz, óptimo, tabla y CTA. Los dos cierres siguen existiendo y siguen usándose en las
  // otras superficies —la card, la frase canónica del motor, el PDF— y ahí se siguen
  // fijando, más abajo. Pero en el pop-up ya no tienen sujeto: exigirlos sería exigir prosa
  // que el contrato visual sacó a propósito.
  //
  // Lo que SÍ se fija ahora es que el pop-up lea la celda del motor, que es de donde salen
  // la matriz y el óptimo. `DrawerDistanciaStr` ya no existe —se borró el 17-sep-2026, sin
  // un solo importador en todo el repo—; si alguna vez vuelve un cuerpo con prosa propia,
  // el tier del pop-up (`popup-ajustes`) lo caza por el lado del hero.
  const popup = leer("src/components/analysis/shared/PopupAjustes.tsx");
  if (!popup) F("3 · no se encontró PopupAjustes, el cuerpo del pop-up");
  if (!/mixPalancas/.test(popup) || !/\.celdas/.test(popup)) F("3 · el pop-up no lee la grilla del motor (`mixPalancas.celdas`)");
  const pdf = leer("src/app/analisis/renta-corta/[id]/documento/DocumentoSTR.tsx");
  if (!/pieDocumentoSalidaStr\(/.test(pdf)) F("3 · DocumentoSTR no usa pieDocumentoSalidaStr con combinación");
  const hero = leer("src/components/analysis/str/HeroStrDictamen.tsx");
  if (!/lineaFooterVias\([^)]*salidaPorMixStr|salidaPorMixStr\(distancia\.valor\)/.test(hero)) F("3 · el footer de la card STR no pasa la combinación a lineaFooterVias");
  const cap = leer("src/components/analysis/str/CapitulosInversionStr.tsx");
  if (/esEstructural \? "fuera de lo negociable" : subeTxt/.test(cap)) F("3 · el capítulo «Cómo lo pagas» sigue diciendo «fuera de lo negociable» aunque haya combinación");

  // ── EL «SOLO» DEL KSUB, QUE ERA FALSO EN 4 FILAS (17-sep-2026) ────────────
  // `loTuyo` describe la combinación EQUILIBRADA. Con el menú de respuestas el motor ofrece
  // hasta tres, y medido sobre el parque hay 4 filas STR donde este ksub decía «solo con pie
  // y plazo» mientras el menú ofrecía además una que mueve UNA sola dimensión. La palabra
  // que mentía era «solo».
  //
  // Se mide sin comentarios: el acta de arriba de esa línea cita «solo con» para explicar
  // por qué se fue, así que sobre el texto crudo el predicado se cumpliría con la prosa.
  // ⛔ 3b RETIRADO el 21-sep-2026. El `ksub` de la fila del capítulo —donde vivía
  //   `subEstructural`— se retiró con el rediseño de «Cómo lo pagas»: la fila lleva título
  //   y cifra, y además ese `ksub` estaba en `display:none` para las dos modalidades desde
  //   el rediseño de la portada (`.doc-dictamen .hall.cap .ksub`), o sea que la regla
  //   protegía una línea que nadie leía. La regla del «solo» (cualificador solo con un
  //   camino) sigue viva donde sí se lee: el menú de respuestas del pop-up y la card, con
  //   sus propios guards. El bloque queda desactivado, no borrado, por si el ksub vuelve.
  if (false) {
    const capSC = cap.replace(/\/\*[^]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const bloque = capSC.match(/const subEstructural = [^;]*;/)?.[0] ?? "";
    if (!bloque) F("3b · no se encontró `subEstructural` en el capítulo");
    else {
      // ⛔ CADA LITERAL ATADO A SU RAMA, y no «que exista en algún lado» (17-sep-2026).
      //   Con los tres predicados de presencia, INVERTIR las dos ramas —decir «solo» justo
      //   cuando HAY otros caminos— quedaba VERDE: el bug original al revés y peor. Y poner
      //   el mismo template en las dos ramas también pasaba. Lo cazó la revisión adversaria
      //   del diff, no las mutaciones propias.
      // Por POSICIÓN y no por regex: los templates traen ternarios anidados (`=== null ? ""
      // : " más descuento"`), así que cualquier `[^:]*` se corta antes del literal que importa.
      const iSi = bloque.indexOf("hayOtrosCaminos === true");
      const iNo = bloque.indexOf("hayOtrosCaminos === false");
      const ramaSi = iSi >= 0 && iNo > iSi ? bloque.slice(iSi, iNo) : "";
      const ramaNo = iNo >= 0 ? bloque.slice(iNo) : "";
      if (!ramaSi || !ramaNo) F("3b · el ksub dejó de bifurcar en las tres ramas de `hayOtrosCaminos`");
      else {
        if (!/lo que Franco recomienda/.test(ramaSi)) F("3b · la rama de VARIOS caminos no nombra la recomendada");
        if (/solo con/.test(ramaSi)) F("3b · la rama de VARIOS caminos dice «solo»: es la afirmación que el goal vino a matar, invertida");
        if (!/solo con/.test(ramaNo)) F("3b · la rama de UN camino perdió el «solo», que ahí es el hecho");
        if (/lo que Franco recomienda/.test(ramaNo)) F("3b · la rama de UN camino nombra la recomendada: promete una elección que no existe");
      }
      // (a) el «solo» cuelga de que NO haya otros caminos…
      // Y EL SEPARADOR NO PUEDE SER « · », que es el del `join` de los chips: ahí el
      // cualificador sale como un ítem hermano de «precio» y «pie» en vez de calificar.
      if (/·\s*lo que Franco recomienda/.test(bloque)) {
        F("3b · el cualificador del ksub volvió al separador « · »: sale como un chip más, no como cualificador");
      }
    }
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runSalidaStrCopyTier(): { hard: number } {
  console.log("\n─── TIER SALIDA-STR-COPY (la frase estructural STR deja de negar el mix · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — titular y cierre bifurcados por la combinación con descuentoQueAdemásPide, el copy en un solo módulo, y pop-up, PDF, footer y capítulo leyendo de ahí");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runSalidaStrCopyTier();
  process.exit(hard ? 1 : 0);
}
