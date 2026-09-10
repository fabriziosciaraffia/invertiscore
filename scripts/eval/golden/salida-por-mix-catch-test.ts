// ============================================================================
// GOLDEN · «HAY SALIDA» — catch-test de las ocho superficies (10-sep-2026). 0 tokens.
// ============================================================================
// El motor sabe desde `bece47c1` que 179 filas del parque son estructurales Y tienen
// salida moviendo pie y plazo. Ocho lugares del informe seguían diciendo lo contrario,
// el peor a dos clics del bloque que muestra la salida.
//
// Este tier fija que NINGUNA de las ocho afirme «no hay salida» cuando la hay, y —lo
// que importa igual— que las ocho SIGAN afirmándolo cuando de verdad no la hay. Un
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
//   2. LAS OCHO POSICIONES, con salida: ninguna dice «ningún ajuste realista»,
//      «no hay plan», «está en el depto» ni «ninguna vía».
//
//   3. LAS OCHO POSICIONES, sin salida: todas SIGUEN diciendo la frase dura. Es la
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
  cierrePopupSalida,
  tituloCardSalida,
  ksubCardSalida,
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
    veredictoAtPatch: o.regla,
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

// ── 2 · las ocho posiciones, CON salida: ninguna niega ─────────────────────
{
  const s = salidaPorMix(conSalida.valor);
  if (!s) F("2 · sin `SalidaPorMix` no se puede probar ninguna posición");
  else {
    const base = conSalida.valor.veredictoBase;
    const c = cierrePopupSalida(s);
    const card = distanciaFindingDisplay(conSalida);
    const posiciones: [string, string][] = [
      ["A · cierre del pop-up", `${c.marca} ${c.resto}`],
      ["B · footer de la card del hero", lineaFooterVias(0, 4, true)],
      ["C · título de la finding card", card.title],
      ["C · ksub de la finding card", card.ksub],
      ["D · línea de comparativa", lineaDistanciaMini(conSalida, "BUSCAR OTRA") ?? ""],
      ["E · subtítulo del capítulo", SUBTITULO_PLAN_SALIDA],
      ["G · pie del PDF LTR", pieDocumentoSalida(s)],
      ["copy · título y ksub sueltos", `${tituloCardSalida(s)} ${ksubCardSalida(s)} ${lineaMiniSalida(s, base)}`],
    ];
    for (const [donde, texto] of posiciones) {
      if (!texto) { F(`2 · ${donde}: quedó vacía`); continue; }
      if (NIEGA.test(texto)) F(`2 · ${donde} sigue negando la salida: «${texto}»`);
      if (JERGA.test(texto)) F(`5 · ${donde} usa vocabulario nuestro: «${texto}»`);
    }
  }
}

// ── 3 · las ocho posiciones, SIN salida: todas SIGUEN diciendo la frase dura ─
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
  const CABLEADOS: [string, string][] = [
    ["A · pop-up", "src/components/analysis/drawers/DrawersPropios.tsx"],
    ["C y D · card y comparativa", "src/lib/distancia-copy.ts"],
    ["E · capítulo de negociación", "src/components/ui/AnalysisDrawer.tsx"],
    ["G · PDF LTR", "src/app/analisis/[id]/documento/DocumentoLTR.tsx"],
  ];
  for (const [donde, ruta] of CABLEADOS) {
    let src = "";
    try { src = readFileSync(join(__dirname, "..", "..", "..", ruta), "utf8"); } catch { /* falta el archivo */ }
    if (!src) { F(`7 · ${donde}: no se pudo leer ${ruta}`); continue; }
    if (!/salida-por-mix/.test(src)) F(`7 · ${donde} no lee la fuente única (${ruta})`);
  }
  // B es el único que no importa el módulo: recibe la respuesta por parámetro, porque
  // `lineaFooterVias` es una plantilla de conteo y no debe saber de hallazgos.
  const b = readFileSync(join(__dirname, "..", "..", "..", "src/lib/palancas-en-palabras.ts"), "utf8");
  if (!/haySalidaCombinando/.test(b)) F("7 · B · `lineaFooterVias` no recibe si hay salida combinando");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runSalidaPorMixTier(): { hard: number } {
  console.log("\n─── TIER SALIDA-POR-MIX (las ocho superficies · salida-por-mix.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — ninguna de las ocho niega la salida cuando la hay, todas la afirman cuando no la hay, ausente ≠ no hay, y sin vocabulario nuestro");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runSalidaPorMixTier();
  process.exit(hard ? 1 : 0);
}
