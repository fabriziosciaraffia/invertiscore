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
//   2. EL POP-UP «Ver ajustes» (DrawerDistanciaStr): intro, pie de la matriz y cierre «Este
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
import { salidaPorMixStr, mixAlEscalonStr, cierreFraseCanonicaStr, cierrePopupEscalonStr, pieDocumentoSalidaStr, cierrePopupSalida } from "../../../src/lib/salida-por-mix";
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
  // AJUSTA estructural con mix a COMPRAR (761b08ad): pie 30% + plazo 30 años + −17,5%.
  const h = distanciaDe("estructuralMixStr");
  if (!h.valor.esEstructural || !salidaPorMixStr(h.valor)) F("1 · estructuralMixStr tenía que ser estructural con combinación a COMPRAR");
  if (h.titular !== "Ningún ajuste por separado lo lleva al veredicto de arriba; juntos, sí.") F(`1 · titular con mix: «${h.titular}»`);
  if (!h.fraseCanonica.includes("Con lo tuyo —pie y plazo— y un descuento de 17,5% llega a Comprar.")) F(`1 · el cierre no lee descuentoQueAdemásPide: «${h.fraseCanonica.slice(-160)}»`);
  if (/brecha/i.test(h.fraseCanonica)) F("1 · con combinación la frase sigue diciendo «brecha»");
  if (!/no cambia el veredicto; recién/.test(h.fraseCanonica)) F("1 · la primera oración (los topes probados de a uno) tenía que quedar: sigue siendo verdad");

  // BUSCAR estructural con mix solo al escalón (grajalesStr 5dc42a82): pie 25% + plazo 30 + −11%.
  const g = distanciaDe("grajalesStr");
  if (salidaPorMixStr(g.valor) || !mixAlEscalonStr(g.valor)) F("1 · grajalesStr tenía que llegar solo al escalón");
  if (g.titular !== "Ningún ajuste por separado lo lleva al veredicto de arriba; juntos, sí.") F(`1 · titular al escalón: «${g.titular}»`);
  if (!g.fraseCanonica.includes(`Con lo tuyo —pie y plazo— y un descuento de 11% llega a ${ESCALON}, no a Comprar.`)) F(`1 · el cierre al escalón: «${g.fraseCanonica.slice(-160)}»`);

  // Sin combinación (maculStrSinSalida 213d321c): nada cambia.
  const m = distanciaDe("maculStrSinSalida");
  if (salidaPorMixStr(m.valor) || mixAlEscalonStr(m.valor)) F("1 · maculStrSinSalida no tenía combinación");
  if (m.titular !== "Ningún ajuste realista lo lleva al veredicto de arriba.") F(`1 · sin combinación el titular cambió: «${m.titular}»`);
  if (!/La brecha (es del negocio|no es de este departamento)/.test(m.fraseCanonica)) F("1 · sin combinación el cierre de siempre tenía que quedar");
}

// ── 2 · el copy, desde el único módulo ──────────────────────────────────────
{
  const s = { movimiento: "el pie en 30% y el plazo en 30 años", remate: "moviendo dos cosas a la vez", descuentoPct: 17.5, costoDiaUnoUF: 261, mueve: ["pie", "plazo"] as ("pie" | "plazo")[] };
  const sin = { ...s, movimiento: "el pie en 30%", remate: "subiendo el pie", descuentoPct: null, mueve: ["pie"] as ("pie" | "plazo")[] };
  if (cierreFraseCanonicaStr(s, null) !== "Con lo tuyo —pie y plazo— y un descuento de 17,5% llega a Comprar.") F(`2 · cierreFraseCanonicaStr con descuento: «${cierreFraseCanonicaStr(s, null)}»`);
  if (cierreFraseCanonicaStr(sin, null) !== "Con lo tuyo —el pie— sí llega a Comprar.") F(`2 · cierreFraseCanonicaStr forma corta: «${cierreFraseCanonicaStr(sin, null)}»`);
  if (cierreFraseCanonicaStr(s, ESCALON) !== `Con lo tuyo —pie y plazo— y un descuento de 17,5% llega a ${ESCALON}, no a Comprar.`) F(`2 · cierreFraseCanonicaStr al escalón: «${cierreFraseCanonicaStr(s, ESCALON)}»`);
  const pop = cierrePopupEscalonStr(s, ESCALON);
  if (pop.marca !== `Ningún cambio por separado alcanza. Moviendo dos cosas a la vez, llega a ${ESCALON}.`) F(`2 · cierrePopupEscalonStr.marca: «${pop.marca}»`);
  if (pop.resto !== "Con el pie en 30% y el plazo en 30 años, y un 17,5% de descuento, deja de ser un no, pero no llega a Comprar. Lo que cuesta es plata tuya el día uno.") F(`2 · cierrePopupEscalonStr.resto: «${pop.resto}»`);
  if (pieDocumentoSalidaStr(s, null) !== "Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero con el pie en 30% y el plazo en 30 años, y un 17,5% de descuento, sí. Lo que pide es plata tuya el día uno.") F(`2 · pieDocumentoSalidaStr a Comprar: «${pieDocumentoSalidaStr(s, null)}»`);
  if (pieDocumentoSalidaStr(sin, "Ajusta supuestos") !== "Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero con el pie en 30% llega a Ajusta supuestos, no a Comprar. Lo que pide es plata tuya el día uno.") F(`2 · pieDocumentoSalidaStr al escalón: «${pieDocumentoSalidaStr(sin, "Ajusta supuestos")}»`);
  // El cierre del pop-up a Comprar es el de LTR, tal cual: no dice arriendo ni renta corta.
  if (/arriendo|renta corta|STR/i.test(cierrePopupSalida(s).marca + cierrePopupSalida(s).resto)) F("2 · cierrePopupSalida no es neutral de modalidad");
  if (lineaFooterVias(0, 5, true) !== "Franco probó cinco ajustes por separado. Ninguno mueve el veredicto; juntos, sí.") F(`2 · lineaFooterVias con salida: «${lineaFooterVias(0, 5, true)}»`);
  if (lineaFooterVias(0, 5, true, ESCALON) !== `Franco probó cinco ajustes por separado. Ninguno mueve el veredicto; juntos, solo hasta ${ESCALON}.`) F(`2 · lineaFooterVias al escalón: «${lineaFooterVias(0, 5, true, ESCALON)}»`);
  if (lineaFooterVias(0, 4, true) !== "Franco probó cuatro ajustes por separado. Ninguno mueve el veredicto; juntos, sí.") F("2 · la línea de LTR (cuatro ajustes, sin escalón) cambió");
}

// ── 3 · las cuatro superficies leen del módulo ──────────────────────────────
{
  const drawer = leer("src/components/analysis/drawers/DrawersPropios.tsx");
  const i = drawer.indexOf("export function DrawerDistanciaStr(");
  const cuerpo = i === -1 ? "" : drawer.slice(i);
  if (!cuerpo) F("3 · no se encontró DrawerDistanciaStr");
  if (!/salidaPorMixStr\(/.test(cuerpo) || !/mixAlEscalonStr\(/.test(cuerpo)) F("3 · DrawerDistanciaStr no lee salidaPorMixStr / mixAlEscalonStr");
  if (!/cierrePopupSalida\(/.test(cuerpo) || !/cierrePopupEscalonStr\(/.test(cuerpo)) F("3 · DrawerDistanciaStr no usa los cierres del módulo (cierrePopupSalida / cierrePopupEscalonStr)");
  if (/Este departamento no da, y no es por cómo lo estás mirando\.<\/mark>\{" "\}\s*Ajustar los números sirve cuando falta poco; acá lo que pide es de otro orden\.\{" "\}\s*\{v\.piePctActual/.test(cuerpo) && !/salidaMixStr|salidaEscalonStr|salida(Str)?\s*\?/.test(cuerpo)) F("3 · el cierre «Este departamento no da» sigue sin bifurcar por la combinación");
  const pdf = leer("src/app/analisis/renta-corta/[id]/documento/DocumentoSTR.tsx");
  if (!/pieDocumentoSalidaStr\(/.test(pdf)) F("3 · DocumentoSTR no usa pieDocumentoSalidaStr con combinación");
  const hero = leer("src/components/analysis/str/HeroStrDictamen.tsx");
  if (!/lineaFooterVias\([^)]*salidaPorMixStr|salidaPorMixStr\(distancia\.valor\)/.test(hero)) F("3 · el footer de la card STR no pasa la combinación a lineaFooterVias");
  const cap = leer("src/components/analysis/str/CapitulosInversionStr.tsx");
  if (/esEstructural \? "fuera de lo negociable" : subeTxt/.test(cap)) F("3 · el capítulo «Cómo lo pagas» sigue diciendo «fuera de lo negociable» aunque haya combinación");
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
