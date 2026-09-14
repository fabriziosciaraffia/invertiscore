// ============================================================================
// GOLDEN · EL MOTOR EMITE LA GRILLA DEL POP-UP — catch-test (13-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El pop-up de ajustes (mockup `popup-palancas-final.html`) necesita, por celda de la
// matriz pie × plazo: veredicto, score, el descuento que pide y el pie extra del día uno.
// Y del ajuste óptimo, siete pares antes → después. Nada de eso viajaba, aunque el motor
// lo calcula TODO hoy:
//
//   · cada celda se sondea a descuento 0 para saber si ya cruza — ahí están su veredicto
//     y su score, y se descartaban;
//   · las celdas que cruzan se bisecan hasta el descuento mínimo y se vuelven a sondear
//     para leer el score de la elegida — ahí están las cifras del «después», y también
//     se descartaban;
//   · `MixPalancas` ni siquiera llevaba el score de la elegida, con el que se eligió.
//
// MEDIDO ANTES DE TOCAR NADA (scripts/of-conteo-grilla.ts, gitignored): una carga LTR con
// mix recorre 16 celdas de la matriz de simulación SIN bisecar, y 42-50 sondas del mix,
// que sí bisecan. Son DOS pasadas. Este goal no agrega una tercera: emite lo que la
// segunda ya calculó.
//
// Fija SEIS cosas:
//
//   1. LA GRILLA VIAJA. `MixPalancas.celdas` trae TODAS las combinaciones probadas, no
//      solo las que cruzan: la matriz del pop-up tiene que poder pintar «Buscar» en una
//      celda que no llega.
//
//   2. CADA CELDA TRAE LOS CUATRO DATOS. Veredicto y score SIN descuento (que es lo que
//      la celda muestra), descuento mínimo que cruza —o null— y el pie extra del día uno.
//
//   3. LA ELEGIDA ESTÁ MARCADA Y ES LA DEL CONTRATO. Exactamente una celda con
//      `esElegida`, y es la que `MixPalancas` describe en sus campos planos.
//
//   4. EL ÓPTIMO TRAE SU «DESPUÉS». Cuota, flujo, retorno sobre lo puesto, cap rate, TIR
//      y score de la combinación elegida. Sin eso el pop-up tendría que recomputar en el
//      cliente, que es exactamente lo que el informe no hace.
//
//   5. LAS PALANCAS SOLAS TRAEN SCORE Y DESTINO. La tabla «No depende de ti» dice
//      «Llegas a Comprar · score NN» por palanca.
//
//   6. NO SE AGREGA UNA TERCERA PASADA. El módulo del mix no puede sondear más veces por
//      celda que antes: una a descuento 0, la bisección, y una final en el mínimo.
//
// Y DESDE EL MENÚ DE RESPUESTAS (16-sep-2026), SIETE MÁS —los invariantes 7 a 13—, que
// fijan que la grilla ofrezca hasta tres caminos en vez de uno. Su acta está abajo, junto
// al invariante 7. El cambio más importante de este archivo no es un invariante nuevo sino
// que LAS MÉTRICAS DEL ARNÉS DEJARON DE SER UNA RAMPA EN EL PIE: hasta acá el flujo y la
// TIR dependían solo del pie y solo subían con él, así que las tres coronas caían siempre
// en la misma celda y un criterio de flujo se podía ejercitar en la única forma en la que
// no puede fallar. Ver `METRICA`, más abajo.
//
// Corre dentro del QUICK (tier "grilla-popup") y standalone:
//   node --import tsx scripts/eval/golden/grilla-popup-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularMixPalancas, MIX_COSTO_TOPE_PTS_PRECIO } from "../../../src/lib/mix-palancas";
import type { CriterioRespuesta, RespuestaMix } from "../../../src/lib/mix-palancas";
import { DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { MixPalancas, Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

type Patch = { precio?: number; piePct?: number; plazoCredito?: number };
const PRECIO_UF = 3_000;

/**
 * LAS MÉTRICAS DEL ARNÉS, Y POR QUÉ DEJARON DE SER UNA RAMPA EN EL PIE (16-sep-2026).
 *
 * Hasta el menú de respuestas el arnés devolvía `flujoMensual: −100.000 + pie×2.000` y
 * `tirPct: 7 + pie/50`: las dos dependían SOLO del pie y las dos subían con él. Con eso
 * el argmax de flujo, el de TIR y el de score caían SIEMPRE en la misma celda —la del pie
 * máximo— así que un criterio de flujo se podía ejercitar acá en la única forma en la que
 * no puede fallar. Un arnés que no puede separar dos respuestas no prueba que haya dos.
 *
 * Ahora siguen LA DOCTRINA DE LAS ESCALERAS que el contrato del menú ya declara
 * (`docs/wireframes/rediseno-informe/popup-menu-respuestas.html`): «más pie alivia el mes
 * y baja el retorno sobre tu plata; estirar el plazo alivia el mes y encarece el crédito».
 * O sea que el flujo y la TIR tiran PARA LADOS OPUESTOS en pie y en plazo, y el descuento
 * mejora a las dos. Verificado sobre la grilla real: con estos defaults las tres coronas
 * caen en tres celdas distintas (score pie 30·25a, flujo pie 20·30a, TIR pie 20·25a).
 *
 * Viven acá arriba, con nombre, porque las aserciones las leen de la MISMA fuente que la
 * sonda: una aserción que recalcula la fórmula por su cuenta se desincroniza en silencio.
 */
export const METRICA = {
  cuota: (pie: number, plazo: number, d: number) => 800_000 - pie * 1_000 - (plazo - 25) * 6_000 - d * 4_000,
  flujo: (pie: number, plazo: number, d: number) => -100_000 + pie * 1_000 + (plazo - 25) * 6_000 + d * 4_000,
  coc: (pie: number, _plazo: number, d: number) => -3 - pie / 10 + d / 5,
  capRate: (_pie: number, _plazo: number, d: number) => 4 + d / 10,
  tir: (pie: number, plazo: number, d: number) => 12 - pie / 10 - (plazo - 25) / 5 + d / 4,
};

/** Mix sobre una grilla dirigida, contando las sondas por celda. */
function mix(o: {
  piePct?: number;
  plazoCredito?: number;
  /** Techo del NIVEL de pie. Por defecto el del hallazgo; una seed puede estrecharlo. */
  pieTopePct?: number;
  /** Tope del DESCUENTO. Por defecto 15; el tramo alto de la grilla necesita 30. */
  topePct?: number;
  cruza: (pie: number, plazo: number, descuentoPct: number) => boolean;
  score?: (pie: number, plazo: number, descuentoPct: number) => number;
  /** Flujo mensual de la celda. Sin esto, el de la doctrina. */
  flujo?: (pie: number, plazo: number, descuentoPct: number) => number;
  /** TIR de la celda. Sin esto, la de la doctrina. */
  tir?: (pie: number, plazo: number, descuentoPct: number) => number;
  /**
   * Las celdas que sondean SIN métricas. Es la excepción de `SondaMix.metricas` —opcional
   * a propósito, «los catch-tests y los censos sondean sin métricas»— puesta a prueba en
   * vez de abandonada: un criterio que necesita métricas tiene que saber no elegir ahí.
   */
  sinMetricas?: (pie: number, plazo: number, descuentoPct: number) => boolean;
}) {
  const pieBase = o.piePct ?? 20;
  const plazoBase = o.plazoCredito ?? 25;
  const sondasPorCelda = new Map<string, number>();
  const m = calcularMixPalancas({
    meta: "COMPRAR",
    precioUF: PRECIO_UF,
    piePct: pieBase,
    plazoCredito: plazoBase,
    pieCalifica: true,
    pieTopePct: o.pieTopePct ?? DIST_PIE_TOPE_PCT,
    topePct: o.topePct ?? 15,
    palancasQueCruzan: [],
    sondaAtPatch: (patch: Patch) => {
      const pie = patch.piePct ?? pieBase;
      const plazo = patch.plazoCredito ?? plazoBase;
      const d = patch.precio == null ? 0 : Math.round((1 - patch.precio / PRECIO_UF) * 1000) / 10;
      const k = `${pie}|${plazo}`;
      sondasPorCelda.set(k, (sondasPorCelda.get(k) ?? 0) + 1);
      const veredicto: Veredicto = o.cruza(pie, plazo, d) ? "COMPRAR" : "AJUSTA SUPUESTOS";
      const score = o.score ? o.score(pie, plazo, d) : 60;
      const metricas = o.sinMetricas?.(pie, plazo, d)
        ? null
        : {
            cuotaMensual: METRICA.cuota(pie, plazo, d),
            flujoMensual: o.flujo ? o.flujo(pie, plazo, d) : METRICA.flujo(pie, plazo, d),
            cocPct: METRICA.coc(pie, plazo, d),
            capRateNetoPct: METRICA.capRate(pie, plazo, d),
            tirPct: o.tir ? o.tir(pie, plazo, d) : METRICA.tir(pie, plazo, d),
          };
      return { veredicto, score, metricas };
    },
  });
  return { m, sondasPorCelda };
}

/** La celda de una respuesta, para comparar coronas sin repetir la tripleta. */
const celdaDe = (r: { piePct: number; plazoAnios: number; descuentoPct: number | null } | null | undefined) =>
  r ? `${r.piePct}|${r.plazoAnios}|${r.descuentoPct}` : "(ninguna)";
/** Las respuestas del mix, indexadas por criterio. `null` mientras el motor no emita. */
const respuesta = (m: MixPalancas | null | undefined, criterio: CriterioRespuesta): RespuestaMix | null =>
  (m?.respuestas ?? []).find((r) => r.criterio === criterio) ?? null;

// ── 1 · la grilla viaja entera ─────────────────────────────────────────────
{
  // Solo cruza pie 30 · plazo 30: las demás celdas NO cruzan y tienen que venir igual.
  const { m } = mix({ cruza: (pie, plazo) => pie === 30 && plazo === 30 });
  if (!m) F("1 · el mix devolvió null con una celda que cruza");
  else if (!Array.isArray(m.celdas)) F("1 · `MixPalancas.celdas` no existe: la matriz del pop-up no tiene de dónde leer");
  else {
    // pie 20/25/30 × plazo 25/30 (el mix no baja del plazo declarado) = 6 celdas.
    if (m.celdas.length !== 6) F(`1 · la grilla trae ${m.celdas.length} celdas, esperaba las 6 probadas (3 pies × 2 plazos)`);
    if (m.celdas.length !== m.combinacionesProbadas) F(`1 · celdas (${m.celdas.length}) ≠ combinacionesProbadas (${m.combinacionesProbadas}): la matriz mostraría menos de lo que el motor probó`);
    const queNoCruzan = m.celdas.filter((c) => c.descuentoPct === null);
    if (queNoCruzan.length === 0) F("1 · ninguna celda viaja con `descuentoPct: null`: las que no llegan se están filtrando");
  }
}

// ── 2 · los cuatro datos por celda ─────────────────────────────────────────
{
  const { m } = mix({
    cruza: (pie, plazo, d) => pie >= 25 || (plazo === 30 && d >= 10),
    score: (pie, plazo, d) => 50 + pie + (plazo - 25) + Math.round(d),
  });
  const c = m?.celdas?.find((x) => x.piePct === 20 && x.plazoAnios === 25);
  if (!c) F("2 · falta la celda del caso declarado (pie 20% · plazo 25a)");
  else {
    if (c.veredicto !== "AJUSTA SUPUESTOS") F(`2 · la celda declarada trae veredicto ${c.veredicto}; tiene que ser el de SIN descuento`);
    if (c.score !== 70) F(`2 · la celda declarada trae score ${c.score}; el de SIN descuento es 70 (50 + 20 + 0 + 0)`);
    if (!c.esActual) F("2 · la celda del pie y plazo declarados no viene marcada como `esActual`");
    if (c.costoDiaUnoUF !== 0) F(`2 · el pie extra de la celda declarada es ${c.costoDiaUnoUF}, tiene que ser 0`);
  }
  const c30 = m?.celdas?.find((x) => x.piePct === 30 && x.plazoAnios === 25);
  if (!c30) F("2 · falta la celda pie 30% · plazo 25a");
  else {
    if (c30.descuentoPct !== 0) F(`2 · pie 30% cruza sin descuento y la celda dice ${c30.descuentoPct}`);
    // pie 30 sobre 20 declarado = 10 puntos del precio = UF 300 sobre UF 3.000.
    if (c30.costoDiaUnoUF !== 300) F(`2 · el pie extra de pie 30% es ${c30.costoDiaUnoUF} UF, esperaba 300`);
    // `alcanzable` mide el tope de LA EQUILIBRADA y nada más — es el único sitio del golden
    // que mide ese campo por celda, y desde el menú de respuestas el campo ya no contesta
    // solo: una celda del tramo (15, 25] viaja con `alcanzable: false` y a la vez ofrecida
    // como «la que más alivia el mes». Ver el acta del campo en `mix-palancas.ts`.
    if (c30.costoPtsPrecio > MIX_COSTO_TOPE_PTS_PRECIO && c30.alcanzable) {
      F(`2 · una celda de ${c30.costoPtsPrecio} pts viaja como alcanzable, y el tope de la EQUILIBRADA es ${MIX_COSTO_TOPE_PTS_PRECIO}`);
    }
  }
}

// ── 3 · la elegida, marcada y coherente con los campos planos ──────────────
{
  const { m } = mix({
    cruza: (pie) => pie >= 25,
    score: (pie) => 50 + pie,
  });
  const marcadas = m?.celdas?.filter((c) => c.esElegida) ?? [];
  if (marcadas.length !== 1) F(`3 · hay ${marcadas.length} celdas marcadas como elegidas, tiene que haber exactamente una`);
  const e = marcadas[0];
  if (m && e && !(e.piePct === m.piePct && e.plazoAnios === m.plazoAnios && e.descuentoPct === m.descuentoPct)) {
    F(`3 · la celda marcada (pie ${e.piePct}% · ${e.plazoAnios}a · −${e.descuentoPct}%) no es la que describen los campos planos (pie ${m.piePct}% · ${m.plazoAnios}a · −${m.descuentoPct}%)`);
  }
  if (m && m.score == null) F("3 · `MixPalancas.score` no viaja: se elige POR score y el número con el que se eligió no llega al informe");

  // ENSANCHADO CON EL MENÚ DE RESPUESTAS (16-sep-2026). Hasta acá este invariante medía
  // «exactamente una elegida» y con eso alcanzaba, porque había exactamente una respuesta.
  // Con el menú siguen siendo una sola tinta plena —el contrato lo fija: «El fondo de tinta
  // no se mueve: marca siempre lo que Franco recomienda»— pero las OTRAS coronas también
  // tienen que estar marcadas en la grilla, o el pop-up no sabe qué celda encender al
  // elegir una respuesta. Sin esto el invariante se quedaba verde mientras la cosa que
  // vigila se triplicaba.
  if (m && Array.isArray(m.celdas)) {
    const conRol = m.celdas.filter((c) => (c.coronaDe ?? []).length > 0);
    if (conRol.length === 0) F("3 · ninguna celda declara a qué respuesta corona: `CeldaMix.coronaDe` no viaja y el pop-up no puede encender la celda de cada opción");
    const eq = m.celdas.find((c) => (c.coronaDe ?? []).includes("score")) ?? null;
    if (e && eq && celdaDe(e) !== celdaDe(eq)) {
      F(`3 · la celda de tinta plena (${celdaDe(e)}) no es la que lleva el rol «score» (${celdaDe(eq)}): la recomendación y su marca se separaron`);
    }
    if (e && !(e.coronaDe ?? []).includes("score")) F("3 · la celda con `esElegida` no lleva el rol «score»: la redundancia declarada en el tipo se rompió");
  }
}

// ── 4 · el «después» del óptimo ────────────────────────────────────────────
{
  const { m } = mix({ cruza: (pie) => pie >= 25, score: (pie) => 50 + pie });
  const d = m?.despues;
  if (!d) F("4 · `MixPalancas.despues` no viaja: los siete pares del pop-up no tienen el lado derecho");
  else {
    for (const k of ["cuotaMensual", "flujoMensual", "cocPct", "capRateNetoPct", "tirPct"] as const) {
      if (typeof d[k] !== "number" && d[k] !== null) F(`4 · el «después» no trae \`${k}\``);
    }
    // El «después» es el de LA CELDA ELEGIDA, y se verifica contra las coordenadas que la
    // propia raíz publica en vez de contra un número escrito a mano: así la aserción no
    // puede quedar midiendo una celda que ya no es la coronada.
    if (m) {
      const esperada = METRICA.cuota(m.piePct, m.plazoAnios, m.descuentoPct);
      if (d.cuotaMensual !== esperada) {
        F(`4 · el «después» no corresponde a la celda elegida: cuota ${d.cuotaMensual} para pie ${m.piePct}% · ${m.plazoAnios}a · −${m.descuentoPct}%, esperaba ${esperada}`);
      }
    }
  }
}

// ── 5 · las palancas solas: score y destino ────────────────────────────────
{
  // Se fija sobre el TIPO, que es lo que el pop-up lee. El cableado y su costo los mide
  // el censo; acá basta que los campos existan en el contrato del motor.
  const T = readFileSync(join(__dirname, "..", "..", "..", "src", "lib", "types.ts"), "utf8").replace(/\r\n/g, "\n");
  const i = T.indexOf("export interface PalancaDistancia");
  const bloque = i === -1 ? "" : T.slice(i, T.indexOf("\n}", i));
  if (!/score\??:/.test(bloque)) F("5 · `PalancaDistancia` no lleva `score`: la tabla «No depende de ti» no puede decir el score del destino");
  if (!/destino\??:/.test(bloque)) F("5 · `PalancaDistancia` no lleva `destino`: la tabla no puede decir a qué veredicto llegas");
}

// ── 6 · ni una sonda más por celda ─────────────────────────────────────────
{
  // Presupuesto: 1 sonda a descuento 0 + la bisección (tope 15, precisión 0,1 ⇒ ≤ 8
  // pasos) + 1 en el mínimo + 1 de control del tope = 12 con holgura. Si alguien agrega
  // una pasada para leer datos nuevos, esto se dispara.
  const { sondasPorCelda } = mix({ cruza: (pie, plazo, d) => pie >= 25 && d >= 5 });
  const peor = [...sondasPorCelda.entries()].sort((a, b) => b[1] - a[1])[0];
  if (peor && peor[1] > 12) F(`6 · la celda ${peor[0]} recibió ${peor[1]} sondas: emitir lo que ya se calcula no puede agregar una pasada`);
}

// ════════════════════════════════════════════════════════════════════════════
// EL MENÚ DE RESPUESTAS (16-sep-2026) — invariantes 7 a 13.
//
// El pop-up deja de ofrecer UNA respuesta y ofrece hasta TRES sobre la MISMA grilla, en el
// orden que fija el contrato (`popup-menu-respuestas.html`, estados A y B):
//
//   1. «Lo que Franco recomienda» — corona por SCORE. Es el default y no se mueve.
//   2. «La que más rinde»         — corona por TIR.
//   3. «La que más alivia el mes» — corona por FLUJO mensual, con el tope de alcance en 25
//      puntos del precio en vez de 15: es la única respuesta que puede comprar mes con
//      capital, así que es la única a la que se le ensancha la puerta.
//
// Cuando la corona de TIR cae en la misma celda que la de score, las dos se fusionan en una
// línea («Lo que Franco recomienda, y la que más rinde»). LA FUSIÓN LA RESUELVE EL MOTOR:
// si la decidiera el render, cada superficie tendría que volver a comparar celdas y dos
// superficies terminarían fusionando distinto.
//
// LA VARA ÚNICA ES PARA EL VEREDICTO, NO PARA EL CONSEJO. Franco juzga con una sola vara
// —el score, la misma con la que la página declara el veredicto— y después muestra que hay
// más de un camino para llegar ahí. Por eso la raíz de `MixPalancas` sigue describiendo la
// equilibrada y las otras respuestas entran AL LADO: nadie que lea la raíz se entera.
// ════════════════════════════════════════════════════════════════════════════

// ── 7 · el menú viaja, en el orden del contrato, y su primera línea ES la raíz ──
{
  const { m } = mix({ cruza: (pie, _p, d) => d >= 30 - pie, score: (pie) => 50 + pie });
  if (!m) F("7 · el mix devolvió null con celdas que cruzan");
  else if (!Array.isArray(m.respuestas)) {
    F("7 · `MixPalancas.respuestas` no viaja: el pop-up no tiene de dónde leer el menú");
  } else {
    const orden = m.respuestas.map((r) => r.criterio).join(",");
    if (orden !== "score,tir,flujo") F(`7 · el menú viene en el orden «${orden}»; el contrato fija score,tir,flujo`);
    const eq = respuesta(m, "score");
    if (!eq) F("7 · el menú no trae la respuesta por score: la equilibrada es el default y tiene que estar siempre");
    else if (celdaDe(eq) !== celdaDe(m)) {
      F(`7 · la respuesta por score (${celdaDe(eq)}) no es la que describe la raíz (${celdaDe(m)}): la equilibrada dejó de ser el default`);
    }
    // El tope viaja DECLARADO, no supuesto. Mismo argumento que `costoDiaUnoBase`: con dos
    // topes en juego, un consumidor que tenga que adivinar cuál se aplicó lo va a adivinar mal.
    for (const r of m.respuestas) {
      const esperado = r.criterio === "flujo" ? 25 : MIX_COSTO_TOPE_PTS_PRECIO;
      if (r.topePtsPrecio !== esperado) F(`7 · la respuesta «${r.criterio}» declara tope ${r.topePtsPrecio}, esperaba ${esperado}`);
      if (typeof r.dentroDeSuTope !== "boolean") F(`7 · la respuesta «${r.criterio}» no declara si cabe en SU tope`);
    }
  }
}

// ── 8 · SEED · la corona de FLUJO se separa de la de SCORE ──────────────────
// Sin esto «hay más de un camino» está sin probar: nada demuestra que la segunda respuesta
// sea una segunda. La grilla es la de la doctrina —el flujo mejora con plazo y descuento,
// el score sube con el pie— así que las dos coronas caen en celdas distintas por razones
// opuestas, no por casualidad.
{
  const { m } = mix({ cruza: (pie, _p, d) => d >= 30 - pie, score: (pie) => 50 + pie });
  const eq = respuesta(m, "score");
  const fl = respuesta(m, "flujo");
  if (!fl) F("8 · no hay respuesta de flujo en una grilla donde todas las celdas traen métricas");
  else if (eq && celdaDe(eq) === celdaDe(fl)) {
    F(`8 · la corona de flujo cayó en la misma celda que la de score (${celdaDe(fl)}): el arnés no está separando las dos respuestas`);
  } else if (fl && (fl.piePct !== 20 || fl.plazoAnios !== 30)) {
    F(`8 · la corona de flujo es ${celdaDe(fl)}; con la doctrina de las escaleras tiene que ser pie 20% · 30a (menos pie, más plazo, más descuento)`);
  }
  if (eq && (eq.piePct !== 30 || eq.plazoAnios !== 25)) F(`8 · la corona de score es ${celdaDe(eq)}; esperaba pie 30% · 25a`);
}

// ── 9 · SEED · la FUSIÓN score ⟷ TIR, declarada por el motor ────────────────
// Dos casos y los dos son seed, porque una fusión que nunca se compara contra una
// no-fusión no prueba que el motor distinga.
{
  // (a) FUSIONAN: la TIR sube con el pie igual que el score, así que coronan la misma celda.
  const { m } = mix({ cruza: (pie, _p, d) => d >= 30 - pie, score: (pie) => 50 + pie, tir: (pie) => 7 + pie / 10 });
  const eq = respuesta(m, "score");
  const ti = respuesta(m, "tir");
  if (!eq || !ti) F("9a · falta una de las dos respuestas que tienen que fusionar");
  else {
    if (celdaDe(eq) !== celdaDe(ti)) F(`9a · score corona ${celdaDe(eq)} y TIR ${celdaDe(ti)}: esta grilla está construida para que fusionen`);
    if (!(eq.fusionadaCon ?? []).includes("tir")) F("9a · las dos coronan la misma celda y la respuesta por score NO declara la fusión: el render tendría que volver a compararlas");
    if (!(ti.fusionadaCon ?? []).includes("score")) F("9a · la fusión se declara en una sola dirección: la respuesta por TIR no nombra a la de score");
  }
}
{
  // (b) NO FUSIONAN: con la TIR de la doctrina —que BAJA con el pie— la tasa corona en el
  //     otro extremo de la grilla. Es el estado A del contrato, el de tres líneas.
  const { m } = mix({ cruza: (pie, _p, d) => d >= 30 - pie, score: (pie) => 50 + pie });
  const eq = respuesta(m, "score");
  const ti = respuesta(m, "tir");
  if (!eq || !ti) F("9b · falta una de las dos respuestas");
  else {
    if (celdaDe(eq) === celdaDe(ti)) F(`9b · score y TIR coronan la misma celda (${celdaDe(ti)}): esta grilla está construida para que se separen`);
    if ((eq.fusionadaCon ?? []).length > 0) F(`9b · la respuesta por score declara fusión con ${(eq.fusionadaCon ?? []).join(",")} cuando ninguna comparte su celda`);
  }
}

// ── 10 · SEED · el tramo 15-25: la respuesta de flujo alcanza donde la equilibrada no ──
// Es LA seed de los dos topes. Con el pie declarado en 5% la grilla llega a 25 puntos del
// precio; la celda de pie 30% cuesta exactamente eso y queda fuera del tope de la
// equilibrada y dentro del de flujo.
{
  const { m } = mix({
    piePct: 5,
    cruza: (pie, _p, d) => pie >= 30 || (pie === 10 && d >= 8),
    score: (pie) => 90 - pie,
    flujo: (pie) => -200_000 + pie * 5_000,
  });
  const eq = respuesta(m, "score");
  const fl = respuesta(m, "flujo");
  if (!eq || !fl) F("10 · falta una de las dos respuestas en la grilla del tramo 15-25");
  else {
    if (!(eq.costoPtsPrecio <= MIX_COSTO_TOPE_PTS_PRECIO)) F(`10 · la equilibrada cuesta ${eq.costoPtsPrecio} pts: tenía que caber en el tope de ${MIX_COSTO_TOPE_PTS_PRECIO}`);
    if (!(fl.costoPtsPrecio > MIX_COSTO_TOPE_PTS_PRECIO && fl.costoPtsPrecio <= 25)) {
      F(`10 · la respuesta de flujo cuesta ${fl.costoPtsPrecio} pts: la seed la quiere en el tramo (${MIX_COSTO_TOPE_PTS_PRECIO}, 25]`);
    }
    if (!fl.dentroDeSuTope) F(`10 · la respuesta de flujo cuesta ${fl.costoPtsPrecio} pts y se declara FUERA de su propio tope de 25`);
    if (fl.piePct !== 30) F(`10 · la respuesta de flujo corona pie ${fl.piePct}%, esperaba 30%`);
  }
  // Y la raíz NO se entera: `dentroDelAlcance` sigue contestando por la equilibrada.
  if (m && !m.dentroDelAlcance) F("10 · `dentroDelAlcance` de la raíz dio false con una equilibrada que sí cabe en 15: el campo dejó de contestar por la equilibrada");
}

// ── 11 · SEED · el empate de flujo lo rompe el CAPITAL, no el descuento ─────
// El desempate aporta lo que el criterio no mira. El score pondera flujo, retorno y TIR
// juntas, así que ya tiene el capital adentro y puede gastar su desempate en lo escaso —lo
// que hay que pedirle a un tercero—. El flujo mira SOLO el mes: es ciego al capital, y si
// desempatara por descuento coronaría la celda que cuesta más plata por el mismo mes.
// Medido en el parque: pasa en 3 filas, con sobrecostos de 154 · 318 · 573 UF.
{
  const { m } = mix({
    cruza: (pie, plazo, d) => plazo === 25 && (pie === 30 || (pie === 25 && d >= 10)),
    score: (pie) => 50 + pie,
    flujo: () => -50_000,
  });
  const fl = respuesta(m, "flujo");
  if (!fl) F("11 · no hay respuesta de flujo con dos celdas empatadas en el mes");
  else {
    // pie 25 · −10% cuesta UF 75; pie 30 · −0% cuesta UF 300. Empatan en flujo.
    // «Descuento primero» coronaría pie 30 (pide 0%); «costo primero» corona pie 25.
    if (fl.piePct !== 25) {
      F(`11 · con el mes empatado el flujo coronó pie ${fl.piePct}% (UF ${fl.costoDiaUnoUF}); tenía que coronar pie 25% (UF 75), que deja el mismo mes por UF 225 menos`);
    }
    if (fl.costoDiaUnoUF !== 75) F(`11 · la respuesta de flujo cuesta UF ${fl.costoDiaUnoUF}, esperaba UF 75`);
  }
  // Y el score, que NO es ciego al capital, sigue desempatando por descuento.
  const eq = respuesta(m, "score");
  if (eq && eq.piePct !== 30) F(`11 · la equilibrada coronó pie ${eq.piePct}%: el desempate del score no tenía que moverse`);
}

// ── 12 · SEED · una celda SIN métricas no corona por flujo, y no rompe el tier ──
// `SondaMix.metricas` es opcional A PROPÓSITO: «los catch-tests y los censos sondean sin
// métricas y el módulo no las necesita para elegir». Un criterio de flujo SÍ las necesita,
// y la salida no es volver el campo obligatorio —eso pondría en rojo los nueve arneses de
// un saque— sino ordenar esa celda al final, igual que ya se ordena la celda sin score.
// La seed es la versión filosa: la MISMA celda corona la equilibrada (el score no necesita
// métricas) y es saltada por el flujo.
{
  const { m } = mix({
    cruza: (pie) => pie >= 25,
    score: (pie) => 50 + pie,
    flujo: (pie) => -200_000 + pie * 5_000,
    sinMetricas: (pie) => pie === 30,
  });
  const eq = respuesta(m, "score");
  const fl = respuesta(m, "flujo");
  if (!eq) F("12 · la equilibrada desapareció: el score no necesita métricas para elegir");
  else if (eq.piePct !== 30) F(`12 · la equilibrada coronó pie ${eq.piePct}%: la celda sin métricas tiene el mejor score y el score no la puede saltar`);
  if (!fl) F("12 · no hay respuesta de flujo: con celdas sin métricas el criterio tiene que elegir entre las que sí las traen, no rendirse");
  else {
    if (fl.piePct === 30) F("12 · la respuesta de flujo coronó la celda SIN métricas: un criterio que necesita el dato eligió sin el dato");
    if (fl.metricas == null) F("12 · la respuesta de flujo viaja sin métricas: es el número con el que se eligió y tiene que llegar");
  }
}

// ── 13 · el BORDE del tope nuevo: 25,0 entra y 25,1 no ─────────────────────
// El gemelo del borde de §7c. El tope de la equilibrada tiene su borde fijado desde el
// 13-sep («el borde EXACTO entra: el tope es <=, no <»); el de la respuesta de flujo no
// tenía ninguno, así que nadie fijaba que 25,0 entrara ni que 25,1 quedara afuera.
{
  // (a) 25,0 EXACTO: pie declarado 5% → pie 30% son 25 puntos justos, sin descuento.
  const { m } = mix({ piePct: 5, cruza: (pie) => pie >= 30 });
  const fl = respuesta(m, "flujo");
  if (!fl) F("13a · no hay respuesta de flujo con una celda que cruza a 25,0 puntos");
  else {
    if (Math.abs(fl.costoPtsPrecio - 25) > 0.05) F(`13a · la celda del borde cuesta ${fl.costoPtsPrecio} pts, la seed la construye en 25,0 justos`);
    if (!fl.dentroDeSuTope) F("13a · el borde EXACTO (25,0 pts) quedó afuera: el tope de la respuesta de flujo es <=, no <");
  }
}
{
  // (b) 25,1: un décimo por encima. Hace falta el tope de descuento en 30 —el de LTR desde
  //     AJUSTA— porque el salto de pie solo produce múltiplos de 5 y el décimo lo pone el
  //     descuento mínimo de la celda.
  const { m } = mix({ piePct: 0, topePct: 30, cruza: (pie, _p, d) => pie === 30 && d >= 16.35 });
  const fl = respuesta(m, "flujo");
  const celda = m?.celdas?.find((c) => c.piePct === 30 && c.plazoAnios === 25) ?? null;
  if (!celda) F("13b · falta la celda pie 30% · 25a");
  else if (Math.abs(celda.costoPtsPrecio - 25.1) > 0.05) {
    F(`13b · la celda del borde cuesta ${celda.costoPtsPrecio} pts, la seed la construye en 25,1`);
  }
  if (fl) F(`13b · hay respuesta de flujo (${celdaDe(fl)}) cuando la única celda que cruza cuesta 25,1 pts: el tope de 25 no la está filtrando`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runGrillaPopupTier(): { hard: number } {
  console.log("\n─── TIER GRILLA-POPUP (el motor emite la grilla, el óptimo y los scores · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la grilla viaja entera con veredicto, score, descuento y pie extra por celda; la elegida marcada con su «después»; las palancas solas con score y destino; ni una sonda más por celda; y el menú de respuestas con sus tres coronas, su fusión declarada y los dos topes");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runGrillaPopupTier();
  process.exit(hard ? 1 : 0);
}
