// ============================================================================
// GOLDEN · LA MATRIZ EN LOS EXTREMOS — catch-test (25-sep-2026)
// ============================================================================
// Decisiones de Fabrizio tras la auditoría de extremos (`auditoria-matriz-extremos` en memoria):
//
//   1 · UNA SOLA REGLA PARA MOVER EL PIE con pie 0%: bono pie declarado lo deja fijo; cualquier
//       otra razón (otra fuente, prefiero no decir, sin razón) lo mueve. Igual en la grilla hacia
//       Comprar (LTR y STR), la de Comprar LTR, la de Comprar STR y el rescate. Vive en
//       `pie-se-mueve.ts`; ningún sitio escribe su propia condición.
//   2 · EL PLAZO DECLARADO ES SIEMPRE COLUMNA, aunque esté fuera de 20–30 años (10, 15, 35): así
//       existe la celda «hoy».
//   3 · AL CONTADO NO HAY MATRIZ: sin crédito no hay pie ni plazo que mover. El motor deja la
//       celda declarada (la lee el filtro del descuento), pero ni el pop-up ni la card la
//       ofrecen, la recomendación cae al precio y la vía del plazo no dice «no alcanza».
//   4 · LA CARD CON PIE 0% dice «Aun sin pie y con crédito a N años…», nunca «pie de 0%», y no
//       nombra el bono pie.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/matriz-extremos-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { calcularMixPalancas, type SondaMix } from "../../../src/lib/mix-palancas";
import { pieSeMueveEnLaGrilla, PIE_TOPE_GRILLA_PCT } from "../../../src/lib/pie-se-mueve";
import { DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import { RESCATE_PIE_TOPE_PCT } from "../../../src/lib/rescate-pie-plazo";
import { grillaDelPopup } from "../../../src/lib/matriz-popup";
import { mixAComprar, recomendacionFranco } from "../../../src/lib/mix-a-comprar";
import { distanciaPorDescuento, combinacionTexto } from "../../../src/lib/ajustar-sin-camino";
import type { MixPalancas, RazonSinCapital } from "../../../src/lib/types";
import { construirCardLtr } from "../../../src/lib/card-recomendacion";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Una grilla sobre una sonda sintética: cruza a COMPRAR con 5% de descuento o más. */
function grilla(p: { piePct: number; plazo: number; modo?: "cruzar" | "mejorar"; pieCalifica?: boolean }): MixPalancas | null {
  const precioUF = 3000;
  const sonda = (m: { precio?: number; piePct?: number; plazoCredito?: number }): SondaMix => {
    const desc = 1 - (m.precio ?? precioUF) / precioUF;
    return { veredicto: p.modo === "mejorar" || desc >= 0.05 ? "COMPRAR" : "AJUSTA SUPUESTOS", score: 60 };
  };
  return calcularMixPalancas({
    meta: "COMPRAR", modo: p.modo ?? "cruzar", precioUF, piePct: p.piePct, plazoCredito: p.plazo,
    pieCalifica: p.pieCalifica ?? pieSeMueveEnLaGrilla(p.piePct, undefined), pieTopePct: DIST_PIE_TOPE_PCT, topePct: 30,
    palancasQueCruzan: [], sondaAtPatch: sonda,
  });
}
const plazosDe = (m: MixPalancas | null) => [...new Set((m?.celdas ?? []).map((c) => c.plazoAnios))].join("/");

export function runMatrizExtremosTier(): { hard: number } {
  console.log("\n─── TIER MATRIZ-EXTREMOS (una regla del pie · plazo declarado · contado · «sin pie» · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · una sola regla para mover el pie ───────────────────────────────────
  {
    const casos: [number, RazonSinCapital | undefined, boolean][] = [
      [0, "bono_pie", false], [0, "otra_fuente", true], [0, "no_declarada", true], [0, "sin_pie", true], [0, undefined, true],
      [20, undefined, true], [PIE_TOPE_GRILLA_PCT, undefined, false], [50, undefined, false],
    ];
    for (const [pie, razon, esperado] of casos) {
      if (pieSeMueveEnLaGrilla(pie, razon) !== esperado) F(`1 · pie ${pie}% con razón ${razon ?? "ninguna"}: la regla dice ${!esperado ? "que se mueve" : "que queda fijo"}`);
    }
    if (DIST_PIE_TOPE_PCT !== PIE_TOPE_GRILLA_PCT || RESCATE_PIE_TOPE_PCT !== PIE_TOPE_GRILLA_PCT) F("1 · el tope del pie dejó de ser una sola constante");
    // Ningún sitio escribe su propia condición: todos llaman a la regla.
    const SITIOS: [string, RegExp][] = [
      ["src/lib/distancia-veredicto-hallazgo.ts", /const pieCalifica = pieSeMueveEnLaGrilla\(p\.piePct, p\.razonSinPie\);/],
      ["src/lib/distancia-veredicto-str-hallazgo.ts", /const pieExplorado = pieSeMueveEnLaGrilla\(p\.piePct, p\.razonSinPie\);/],
      ["src/lib/analysis.ts", /pieCalifica: pieSeMueveEnLaGrilla\(input\.piePct, input\.razonSinPie\),/],
      ["src/lib/analysis/simular-str.ts", /pieCalifica: pieSeMueveEnLaGrilla\(piePct, ctx\.inputs\.razonSinPie\),/],
      ["src/lib/rescate-pie-plazo.ts", /const pieSeMueve = pieSeMueveEnLaGrilla\(p\.piePct, p\.razonSinPie\);/],
    ];
    for (const [archivo, re] of SITIOS) {
      const src = sinComentarios(leer(archivo));
      if (!re.test(src)) F(`1 · ${archivo} no decide el pie con pieSeMueveEnLaGrilla`);
      if (/!\s*(input|ctx\.inputs|p)\.razonSinPie\b|razonSinPie\s*===\s*["']bono_pie["']|===\s*DIST_PIE_RAZON_EXCLUIDA/.test(src)) F(`1 · ${archivo} escribe su propia condición sobre la razón del pie`);
    }
    // Comportamiento: la grilla de Comprar LTR con pie 0% mueve el pie salvo con bono pie.
    const s = GOLDEN_SEEDS.find((x) => x.key === "GS-PC2");
    if (!s) F("0 · falta GS-PC2");
    else {
      for (const razon of ["otra_fuente", "no_declarada", "bono_pie"] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = runAnalysis({ ...s.input, piePct: 0, razonSinPie: razon }, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
        if (r.veredicto !== "COMPRAR" || !r.mixComprar) { F(`0 · GS-PC2 con ${razon} ya no es COMPRAR con grilla: el caso no prueba nada`); continue; }
        const mueve = r.mixComprar.celdas.some((c: { piePct: number }) => c.piePct > 0);
        if (mueve !== (razon !== "bono_pie")) F(`1 · grilla de Comprar LTR, pie 0% con ${razon}: el pie ${mueve ? "se movió" : "quedó fijo"}`);
      }
    }
  }

  // ── 2 · el plazo declarado es siempre columna ──────────────────────────────
  for (const [plazo, modo, esperado] of [
    [10, "cruzar", "10/20/25/30"], [15, "cruzar", "15/20/25/30"], [35, "cruzar", "35"],
    [10, "mejorar", "10/20/25/30"], [15, "mejorar", "15/20/25/30"], [35, "mejorar", "20/25/30/35"], [25, "cruzar", "25/30"],
  ] as const) {
    const m = grilla({ piePct: 20, plazo, modo });
    if (plazosDe(m) !== esperado) F(`2 · plazo ${plazo} (${modo}): columnas ${plazosDe(m)}, esperaba ${esperado}`);
    if (!m?.celdas?.some((c) => c.esActual)) F(`2 · plazo ${plazo} (${modo}): la grilla no tiene la celda de hoy`);
  }
  {
    const s = GOLDEN_SEEDS.find((x) => x.key === "GS-1")!;
    for (const plazo of [15, 35]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = runAnalysis({ ...s.input, plazoCredito: plazo }, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
      const dv = r.hallazgos?.find((h: { id: string }) => h.id === "distancia_veredicto");
      const g = grillaDelPopup({ veredicto: r.veredicto, distancia: dv, mixComprar: r.mixComprar });
      if (!g) continue; // Buscar otro: sin pop-up
      if (!g.celdas?.some((c) => c.esActual && c.plazoAnios === plazo)) F(`2 · GS-1 con ${plazo} años: el pop-up no trae la celda de hoy`);
    }
  }

  // ── 3 · al contado no hay matriz ──────────────────────────────────────────
  {
    for (const modo of ["cruzar", "mejorar"] as const) {
      const m = grilla({ piePct: 100, plazo: 25, modo, pieCalifica: false });
      if ((m?.celdas?.length ?? 0) !== 1) F(`3 · al contado (${modo}) la grilla tiene ${m?.celdas?.length ?? 0} celdas: sin crédito queda solo la declarada`);
      if (grillaDelPopup({ veredicto: modo === "mejorar" ? "COMPRAR" : "AJUSTA SUPUESTOS", mixComprar: m, distancia: modo === "cruzar" ? ({ valor: { veredictoBase: "AJUSTA SUPUESTOS", mixPalancas: m } } as never) : null })) F(`3 · al contado (${modo}) el pop-up dibuja una grilla`);
    }
    const m = grilla({ piePct: 100, plazo: 25, pieCalifica: false });
    const v = { veredictoBase: "AJUSTA SUPUESTOS", veredictoObjetivo: "COMPRAR", mixPalancas: m, palancas: [{ palanca: "precio", deltaPct: -3.8 }] } as never;
    if (mixAComprar(v)) F("3 · al contado mixAComprar ofrece la grilla");
    const rec = recomendacionFranco(v);
    if (rec?.via !== "precio_solo") F(`3 · al contado la recomendación de Franco es «${rec?.via ?? "ninguna"}», no la palanca de precio`);
    // La vía del plazo no dice «no alcanza» sin crédito.
    let probadas = 0;
    for (const s of GOLDEN_SEEDS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = runAnalysis({ ...s.input, piePct: 100 }, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
      const dv = r.hallazgos?.find((h: { id: string }) => h.id === "distancia_veredicto")?.valor;
      const via = dv?.vias?.find((x: { palanca: string }) => x.palanca === "plazo");
      if (!via) continue;
      probadas++;
      if (via.estado !== "noAplica") F(`3 · ${s.key} al contado: la vía del plazo está en «${via.estado}»; sin crédito no hay plazo que estirar`);
      const g = grillaDelPopup({ veredicto: r.veredicto, distancia: { valor: dv } as never, mixComprar: r.mixComprar });
      if (g) F(`3 · ${s.key} al contado: el pop-up dibuja una grilla`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card: any = construirCardLtr({ veredicto: r.veredicto, results: r, inputData: { ...s.input, piePct: 100 }, currency: "CLP", valorUF: GOLDEN_UF });
      if (card?.bloque?.mix) F(`3 · ${s.key} al contado: la card ofrece «${card.bloque.mix.titulo}»`);
      if (/plazo/i.test(card?.bloque?.descarte ?? "")) F(`3 · ${s.key} al contado: la card dice «${card.bloque.descarte}»`);
    }
    if (probadas === 0) F("0 · ninguna seed al contado quedó bajo Comprar: el chequeo de la vía del plazo no corrió");
  }

  // ── 4 · la card con pie 0% ────────────────────────────────────────────────
  {
    const d = distanciaPorDescuento({ descuentoPct: 25.9, piePct: 0, plazoAnios: 30, topePct: 30 });
    if (d !== "Aun sin pie y con crédito a 30 años, llegar a Comprar pediría un 25,9% menos de precio, y eso es muy difícil.") F(`4 · la card con pie 0% dice «${d}»`);
    const c = combinacionTexto({ descuentoPct: 25.9, piePct: 0, plazoAnios: 30, topePct: 30 });
    if (c !== "sin pie y con crédito a 30 años") F(`4 · el capítulo con pie 0% dice «${c}»`);
    for (const t of [d, c]) if (/pie de 0\s*%|bono/i.test(t)) F(`4 · con pie 0% el texto dice «pie de 0%» o nombra el bono: «${t}»`);
    const con = distanciaPorDescuento({ descuentoPct: 22, piePct: 15, plazoAnios: 25, topePct: 30 });
    if (!con.startsWith("Aun con pie de 15% y crédito a 25 años")) F(`4 · con pie 15% la card cambió: «${con}»`);
  }

  if (fallas.length) {
    console.log(`  ✗ MATRIZ-EXTREMOS · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — una regla del pie en las cinco grillas (solo el bono pie lo fija), el plazo declarado es columna con su celda «hoy», al contado no hay matriz ni «no alcanza», y la card dice «Aun sin pie»");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMatrizExtremosTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (25-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las trece en ROJO; restauradas, VERDE.
//    1 · la grilla de Comprar LTR vuelve a congelar el pie con cualquier razón
//    2 · la grilla de Comprar STR vuelve a exigir pie > 0
//    3 · la regla congela el pie con cualquier razón declarada        → unidad
//    4 · la grilla hacia Comprar STR escribe su propia condición
//    5 · sin la columna del plazo declarado                            → «columnas 20/25/30»
//    6 · al contado vuelven las columnas de plazo                      → «2 celdas»
//    7 · el pop-up dibuja la grilla al contado
//    8 · mixAComprar ofrece la grilla al contado
//    9 · la card ofrece «Si además mueves lo tuyo» al contado          → GS-4
//   10 · la vía del plazo vuelve a probarse al contado                 → GS-4 «noCruza»
//   11 · la card vuelve a «Aun con pie de 0%»
//   12 · la card nombra el bono pie
//   13 · el capítulo vuelve a «pie de 0%»
