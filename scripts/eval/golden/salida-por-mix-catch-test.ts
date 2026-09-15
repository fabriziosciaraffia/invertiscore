// ============================================================================
// GOLDEN · «HAY SALIDA» — catch-test de las cinco superficies vivas (10-sep-2026). 0 tokens.
// ============================================================================
// El motor sabe desde `bece47c1` que 179 filas del parque son estructurales Y tienen
// salida moviendo pie y plazo. Ocho lugares del informe seguían diciendo lo contrario,
// el peor a dos clics del bloque que muestra la salida.
//
// Este tier fija que NINGUNA afirme «no hay salida» cuando la hay, y —lo que importa
// igual— que TODAS SIGAN afirmándolo cuando de verdad no la hay. Un
// arreglo que apague la frase dura en las 258 filas donde es cierta cambia una mentira
// por otra.
//
// Fija SEIS cosas:
//
//   1. LA CONDICIÓN LLEVA LAS DOS MITADES. `sinSalida` es `esEstructural &&
//      !alcanzable`, así que en una fila NORMAL también vale `false`. Preguntar solo
//      por `sinSalida === false` manda a las filas sanas por la rama de la salida
//      combinada: 778 contra 179. Es el error que este test existe para cazar.
//
//   2. LAS POSICIONES VIVAS, con salida: ninguna dice «ningún ajuste realista»,
//      «no hay plan», «está en el depto» ni «ninguna vía». Eran ocho; el 17-sep-2026
//      quedaron CINCO (el acta del bloque 2 dice cuáles se fueron y por qué).
//
//   3. LAS MISMAS, sin salida: todas SIGUEN diciendo la frase dura. Es la
//      mitad que un arreglo apurado rompe.
//
//   4. AUSENTE ≠ «no hay». Sin `sinSalida` medido nadie puede afirmar que hay salida:
//      se conserva el texto viejo.
//
//   5. VOCABULARIO: nada de «palanca», «vía», «por sí sola», «brecha» ni «supuesto» en
//      lo que el lector lee. Son palabras nuestras.
//
//   6. LA FORMA SE ADAPTA AL MIX: «dos cosas a la vez» solo cuando de verdad se mueven
//      dos. Medido: 128 de 179 mueven pie y plazo, 47 solo el pie, 4 solo el plazo.
//
// Corre dentro del QUICK (tier "salida-por-mix") y standalone:
//   node --import tsx scripts/eval/golden/salida-por-mix-catch-test.ts
// ============================================================================
import {
  salidaPorMix,
  lineaMiniSalida,
  pieDocumentoSalida,
  SUBTITULO_PLAN_SALIDA,
} from "../../../src/lib/salida-por-mix";
import { distanciaFindingDisplay, lineaDistanciaMini } from "../../../src/lib/distancia-copy";
import { lineaFooterVias } from "../../../src/lib/palancas-en-palabras";
import { buildHallazgoDistanciaVeredicto } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { HallazgoDistanciaVeredicto, Veredicto } from "../../../src/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
type Patch = { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number };

function hallazgo(o: { piePct?: number; plazoCredito?: number; regla: (p: Patch) => Veredicto }): HallazgoDistanciaVeredicto {
  return buildHallazgoDistanciaVeredicto({
    veredictoBase: "BUSCAR OTRA",
    arriendo: 500_000,
    precioUF: 3_000,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    sondaAtPatch: (patch) => ({ veredicto: o.regla(patch), score: null }),
    brazosGate1Activos: [],
    modalidad: "ltr",
  }) as HallazgoDistanciaVeredicto;
}

/** ESTRUCTURAL CON SALIDA: nada cruza solo, pie 30 + plazo 30 sí. Son las 179. */
const conSalida = hallazgo({
  regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
});
/** ESTRUCTURAL SIN SALIDA: no cruza ni combinando. Son las 258. */
const sinSalida = hallazgo({ regla: () => "BUSCAR OTRA" });
/** FILA NORMAL: el precio cruza solo. `sinSalida` también es false — la trampa del punto 1. */
const normal = hallazgo({ regla: (p) => (p.precio != null && p.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });

/** Frases que afirman que no hay salida. Si alguna aparece con salida, es una mentira. */
const NIEGA = /ningún ajuste realista|no hay plan|está en el depto|está en el departamento|ninguna vía|ninguno mueve el veredicto\.$|ninguno mueve el veredicto\.\s*$|fuera de todo rango razonable/i;
/** Vocabulario interno que el lector no usa. */
const JERGA = /\bpalanca|\bvía\b|\bvías\b|por sí sola|\bbrecha\b|supuesto/i;

// ── 1 · la condición lleva las DOS mitades ─────────────────────────────────
{
  if (normal.valor.esEstructural) F("1 · el caso de control tiene que ser una fila NORMAL, y salió estructural");
  if (normal.valor.sinSalida !== false) F("1 · el caso normal tiene `sinSalida` false: si no, el test no prueba la trampa");
  if (salidaPorMix(normal.valor) !== null) {
    F("1 · una fila NORMAL no puede entrar por la rama de la salida combinada — es el bug de las 778 contra 179");
  }
  if (!conSalida.valor.esEstructural) F("1 · el caso con salida tiene que ser estructural");
  if (conSalida.valor.sinSalida !== false) F("1 · el caso con salida tiene que tener `sinSalida` false");
  if (salidaPorMix(conSalida.valor) === null) F("1 · el caso con salida tiene que entrar por la rama nueva");
  if (salidaPorMix(sinSalida.valor) !== null) F("1 · el caso SIN salida no puede entrar por la rama nueva");
}

// ── 2 · las cinco posiciones vivas, CON salida: ninguna niega ──────────────
{
  const s = salidaPorMix(conSalida.valor);
  if (!s) F("2 · sin `SalidaPorMix` no se puede probar ninguna posición");
  else {
    const base = conSalida.valor.veredictoBase;
    // ⛔ TRES POSICIONES SE RETIRARON CON SUS SUPERFICIES (17-sep-2026). El tier medía que
    //   NINGUNA de las ocho negara la salida; tres de ellas ya no existen porque nadie las
    //   leía: «A · cierre del pop-up» (`cierrePopupSalida`, vivía en `DrawerDistanciaLtr`,
    //   detrás de `drawerSequence = ["zona"]`) y las dos «C» de la finding card
    //   (`tituloCardSalida` / `ksubCardSalida`).
    //
    //   ⚠ LA RAZÓN DE LAS DOS «C» NO ES «nadie lee esos campos», y así estaba escrito acá:
    //     `.title` se pinta en `GenericFindingCard.tsx:501` y se imprime en el bundle del
    //     juez. Lo que no pasa es que el hallazgo de distancia LLEGUE: `orden-hallazgos.ts`
    //     lo saca de la pirámide por id (136 y 195), y el anexo —la única vía que no filtra
    //     por id— ordena por decisividad, donde la distancia lleva 0 por construcción
    //     (medido: 0 de 742 filas entran a su top-3).
    //
    //     Por eso los bloques 3 y 4 SIGUEN midiendo `card.title` y no se contradicen con
    //     esto: vigilan la FUNCIÓN, que sigue viva y exportada, no la superficie, que hoy
    //     no la recibe. El día que la distancia vuelva a la pirámide ese título se lee sin
    //     que nadie toque nada, y tiene que seguir siendo honesto.
    //
    //   Las cinco que quedan son las que el lector SÍ ve, y siguen con el mismo guard. «E»
    //   se queda porque `DrawerNegociacion` está VIVO en `CapitulosInversion.tsx` — estuvo a
    //   un paso de retirarse por confundir el archivo con el símbolo.
    const posiciones: [string, string][] = [
      ["B · footer de la card del hero", lineaFooterVias(0, 4, true)],
      ["D · línea de comparativa", lineaDistanciaMini(conSalida, "BUSCAR OTRA") ?? ""],
      ["E · subtítulo del capítulo", SUBTITULO_PLAN_SALIDA],
      ["G · pie del PDF LTR", pieDocumentoSalida(s)],
      ["copy · la línea mini", lineaMiniSalida(s, base)],
    ];
    for (const [donde, texto] of posiciones) {
      if (!texto) { F(`2 · ${donde}: quedó vacía`); continue; }
      if (NIEGA.test(texto)) F(`2 · ${donde} sigue negando la salida: «${texto}»`);
      if (JERGA.test(texto)) F(`5 · ${donde} usa vocabulario nuestro: «${texto}»`);
    }
  }
}

// ── 3 · las mismas, SIN salida: todas SIGUEN diciendo la frase dura ──────────
{
  const card = distanciaFindingDisplay(sinSalida);
  if (!/ningún ajuste realista/i.test(card.title)) F(`3 · sin salida la card mantiene la frase dura: «${card.title}»`);
  const mini = lineaDistanciaMini(sinSalida, "BUSCAR OTRA") ?? "";
  if (!/ningún ajuste realista/i.test(mini)) F(`3 · sin salida la línea de comparativa mantiene la frase dura: «${mini}»`);
  const footer = lineaFooterVias(0, 4, false);
  if (/juntos|a la vez/i.test(footer)) F(`3 · sin salida el footer NO puede prometer una combinación: «${footer}»`);
  if (salidaPorMix(sinSalida.valor) !== null) F("3 · sin salida no hay copy de salida que construir");
}

// ── 4 · AUSENTE ≠ «no hay» ─────────────────────────────────────────────────
{
  const vieja = JSON.parse(JSON.stringify(conSalida)) as HallazgoDistanciaVeredicto;
  delete vieja.valor.sinSalida;
  if (salidaPorMix(vieja.valor) !== null) {
    F("4 · sin `sinSalida` medido nadie puede afirmar que hay salida: se conserva el texto viejo");
  }
  const card = distanciaFindingDisplay(vieja);
  if (!/ningún ajuste realista/i.test(card.title)) F(`4 · con el campo ausente la card conserva su título viejo: «${card.title}»`);
}

// ── 6 · la forma se adapta al mix ──────────────────────────────────────────
{
  // Dos dimensiones ⇒ «dos cosas a la vez» es literal.
  const dos = salidaPorMix(conSalida.valor);
  if (dos && !/dos cosas a la vez/.test(dos.remate)) F(`6 · con pie y plazo el remate nombra las dos: «${dos.remate}»`);
  if (dos && !(/el pie en/.test(dos.movimiento) && /el plazo en/.test(dos.movimiento))) {
    F(`6 · el movimiento nombra lo que se mueve: «${dos.movimiento}»`);
  }

  // UNA sola dimensión y sin descuento ⇒ NO se puede decir «dos a la vez».
  const unaSola = hallazgo({
    plazoCredito: 30, // el plazo ya está en el máximo: solo queda el pie
    piePct: 10,
    regla: (p) => ((p.piePct ?? 10) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  const una = salidaPorMix(unaSola.valor);
  if (una && una.descuentoPct === null && /dos cosas/.test(una.remate)) {
    F(`6 · con una sola dimensión y sin descuento «dos a la vez» es falso: «${una.remate}»`);
  }
  if (una && /plazo/.test(una.movimiento)) F(`6 · el plazo ya está en el máximo: no se nombra — «${una.movimiento}»`);
}

// ── 7 · LAS CINCO SUPERFICIES LEEN LA FUENTE ÚNICA ─────────────────────────
{
  // Las funciones puras de arriba pueden estar perfectas y el informe seguir mintiendo
  // si el componente no las llama. Esto no prueba la rama —para eso está el shot— pero
  // sí caza el caso que de verdad pasa: alguien arregla el copy y se olvida de cablearlo.
  // ⚠ EL ANCLAJE VA SOBRE CÓDIGO, NO SOBRE EL ARCHIVO CRUDO (17-sep-2026). Hasta hoy esto
  //   era /salida-por-mix/ sobre el texto entero, y en los tres archivos lo satisfacía la
  //   línea del import —y en `AnalysisDrawer.tsx`, además, un comentario que nombra el
  //   módulo—. Es «presencia ≠ cableado», el tercero de los doce falsos verdes de
  //   `CLAUDE.md`: borrar el uso y dejar el import dejaba el guard VERDE. Ahora el cuerpo se
  //   mira sin comentarios y sin imports, y cada entrada pide el SÍMBOLO que esa superficie
  //   tiene que llamar, no el nombre del módulo.
  const soloCodigo = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split(/\r?\n/)
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n")
      .replace(/import[\s\S]*?from\s+"[^"]+";/g, " ");
  const CABLEADOS: [string, string, RegExp][] = [
    ["D · línea de comparativa", "src/lib/distancia-copy.ts", /salidaPorMix\s*\(/],
    ["E · capítulo de negociación", "src/components/ui/AnalysisDrawer.tsx", /SUBTITULO_PLAN_SALIDA/],
    ["G · PDF LTR", "src/app/analisis/[id]/documento/DocumentoLTR.tsx", /pieDocumentoSalida\s*\(/],
  ];
  for (const [donde, ruta, pide] of CABLEADOS) {
    let src = "";
    try { src = readFileSync(join(__dirname, "..", "..", "..", ruta), "utf8"); } catch { /* falta el archivo */ }
    if (!src) { F(`7 · ${donde}: no se pudo leer ${ruta}`); continue; }
    if (!pide.test(soloCodigo(src))) F(`7 · ${donde} no llama a la fuente única (${ruta}: falta ${pide.source})`);
  }
  // ⚠ ACTA (13-sep-2026) · LA SUPERFICIE A CAMBIÓ DE FUENTE. El pop-up se reescribió en el
  // bloque B y ya no lleva prosa: no dice «hay salida» ni «no hay forma», DIBUJA la grilla
  // del motor con su celda óptima. Pedirle que importe `salida-por-mix` —el módulo que
  // redacta esas frases— sería pedirle copy que el contrato visual sacó. Lo que sí tiene que
  // hacer, y se fija acá, es leer la grilla: una superficie que dibuja el mix desde otra
  // fuente podría mostrar una combinación distinta de la que la card promete.
  const popup = readFileSync(join(__dirname, "..", "..", "..", "src/components/analysis/shared/PopupAjustes.tsx"), "utf8");
  if (!/mixPalancas/.test(popup) || !/\.celdas/.test(popup)) F("7 · A · el pop-up no dibuja la grilla del motor (`mixPalancas.celdas`)");
  if (!/despues/.test(popup)) F("7 · A · el pop-up no lee el «después» de la celda elegida");

  // B es el único que no importa el módulo: recibe la respuesta por parámetro, porque
  // `lineaFooterVias` es una plantilla de conteo y no debe saber de hallazgos.
  const b = readFileSync(join(__dirname, "..", "..", "..", "src/lib/palancas-en-palabras.ts"), "utf8");
  if (!/haySalidaCombinando/.test(b)) F("7 · B · `lineaFooterVias` no recibe si hay salida combinando");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runSalidaPorMixTier(): { hard: number } {
  console.log("\n─── TIER SALIDA-POR-MIX (las cinco superficies vivas · salida-por-mix.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — ninguna de las cinco niega la salida cuando la hay, todas la afirman cuando no la hay, ausente ≠ no hay, y sin vocabulario nuestro");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runSalidaPorMixTier();
  process.exit(hard ? 1 : 0);
}
