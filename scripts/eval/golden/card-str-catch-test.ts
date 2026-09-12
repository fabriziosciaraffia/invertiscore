// ============================================================================
// GOLDEN · LA CARD STR (contrato §5, §7 y §11 · bloque C) — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// La card de STR es la MISMA de LTR (`EcuacionRecomendacion`) alimentada por el mismo
// constructor (`construirLoQueHariaYo`) con parámetro de modalidad. Este tier fija lo que
// es propio de STR y lo que no puede moverse en LTR:
//
//   1. EL CONSTRUCTOR POR MODALIDAD. Con `modalidad: "str"` dice «tarifa» donde LTR dice
//      «arriendo» —en la fila de COMPRAR y en el contexto de BUSCAR— y con el default
//      sigue diciendo «arriendo»: el call site LTR no cambia.
//
//   2. LOS CUATRO ESTADOS DE §5 con el motor STR: COMPRAR; con salida por mix a COMPRAR
//      (desde AJUSTA por `mixPalancas`, desde BUSCAR por `mixPalancasHastaComprar`) o por
//      palancas solas (`palancas` / `palancasHastaComprar`); sin salida. NUNCA el mix al
//      escalón: desde BUSCAR con mix solo a AJUSTA la card cae a sin salida.
//
//   3. «VERIFICA» SOLO CON OVERRIDE. `aguanta` y `verifica` los resuelve el caller: el hero
//      STR pasa `verifica` solo si `adrFuente === "override"` —si la tarifa es la mediana
//      de la zona no hay nada que verificar y la fila no va— y `aguanta` desde
//      `fronterasIngreso.abajo`.
//
//   4. RENTA LARGA SOLO CON EL HALLAZGO. «Analízalo como renta larga» viaja por la prop
//      `alternativa` únicamente en sin salida y solo si `ventaja_vs_ltr` es adverso con
//      `pctConfiable`; si no, el puente sin salida.
//
//   5. EL ESTADO REAL. `PosicionFranco` recibe `estadoRecomendacion(veredicto, bloque)`
//      con el bloque construido, no null; el CTA de sin salida dice «Ver qué se probó».
//
//   6. LOS CAPÍTULOS DE §7 con apellido: Cap rate · Flujo · Al año · Precio · vs arriendo
//      largo · Resultado, con el MISMO `conApellido` de LTR (sin interruptor desde el 12-sep-2026).
//
// Corre dentro del QUICK (tier "card-str") y standalone:
//   node --import tsx scripts/eval/golden/card-str-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildHallazgoDistanciaVeredictoStr } from "../../../src/lib/distancia-veredicto-str-hallazgo";
import { construirLoQueHariaYo, estadoRecomendacion } from "../../../src/lib/lo-que-haria-yo";
import type { StrPatch } from "../../../src/lib/analysis/veredicto-str-con-patch";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const HSTR = leer("src/components/analysis/str/HeroStrDictamen.tsx");
const CAPS_STR = leer("src/components/analysis/str/CapitulosInversionStr.tsx");
const CAPS_LTR = leer("src/components/analysis/CapitulosInversion.tsx");
const HERO_LTR = leer("src/components/analysis/HeroLTR.tsx");

const PRECIO_UF = 3_000;
const UF = 38_500;
const PRECIO_CLP = PRECIO_UF * UF;
const ADR = 45_000;
const esSondaMix = (x: StrPatch) => x.precioCompra != null && x.piePercent != null && x.plazoCredito != null;
const pie = (x: StrPatch, dflt: number) => (x.piePercent != null ? x.piePercent * 100 : dflt);
const plazo = (x: StrPatch, dflt: number) => x.plazoCredito ?? dflt;
const dcto = (x: StrPatch) => (x.precioCompra != null ? 1 - x.precioCompra / PRECIO_CLP : 0);
const adrF = (x: StrPatch) => (x.adrOverride != null ? x.adrOverride / ADR : 1);

function distancia(o: { base: "AJUSTA SUPUESTOS" | "BUSCAR OTRA"; regla: (patch: StrPatch) => Veredicto }) {
  return buildHallazgoDistanciaVeredictoStr({
    veredictoBase: o.base,
    score: o.base === "BUSCAR OTRA" ? 40 : 60,
    precioUF: PRECIO_UF,
    precioCLP: PRECIO_CLP,
    adrActual: ADR,
    modoGestionActual: "auto",
    comisionAutoDec: 0.03,
    comisionAdminDec: 0.2,
    plazoCredito: 25,
    piePct: 20,
    motivosGate: [],
    veredictoAtPatch: o.regla,
  });
}
const bloqueStr = (veredicto: Veredicto, dist: ReturnType<typeof distancia>, comprar?: { aguanta?: { marginPct: number; firme: boolean } | null; verifica?: { cifraCLP: number } | null }) =>
  construirLoQueHariaYo({ modalidad: "str", veredicto, distancia: dist ?? null, currency: "CLP", valorUF: UF, aguanta: comprar?.aguanta ?? null, verifica: comprar?.verifica ?? null });

// ── 1 · el constructor por modalidad: «tarifa» en STR, «arriendo» en LTR ─────
{
  const str = construirLoQueHariaYo({ modalidad: "str", veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: UF, aguanta: { marginPct: 12, firme: false }, verifica: { cifraCLP: 52_000 } });
  if (!str) F("1 · COMPRAR STR con aguanta y verifica no construyó bloque");
  else {
    const ver = str.filas.find((f) => f.rotuloCorto === "Verifica");
    if (!ver) F("1 · falta la fila «Verifica» en COMPRAR STR");
    else if (ver.titulo !== "Verifica la tarifa" || ver.nombre !== "tarifa") F(`1 · la fila de COMPRAR STR dice «${ver.titulo}» / «${ver.nombre}»: en STR se verifica la TARIFA`);
    else if (!/Definiste \$52\.000 la noche/.test(ver.oracion ?? "")) F(`1 · la oración de Verifica no nombra la tarifa declarada: «${ver.oracion}»`);
    const ag = str.filas.find((f) => f.rotuloCorto === "Margen");
    if (!ag) F("1 · falta la fila «Margen» en COMPRAR STR");
    else if (!/^La tarifa por noche puede caer hasta .*\(−12%\) y sigue siendo Comprar\.$/.test(ag.oracion ?? "")) F(`1 · Margen debía decir «La tarifa por noche puede caer hasta … (−12%) y sigue siendo Comprar.», dio «${ag.oracion}»`);
  }
  // el default sigue siendo LTR: misma llamada de siempre, «arriendo»
  const ltr = construirLoQueHariaYo({ veredicto: "COMPRAR", distancia: null, sensibilidad: null, arriendoDeclaradoCLP: 500_000, currency: "CLP", valorUF: UF });
  const verL = ltr?.filas.find((f) => f.rotuloCorto === "Verifica");
  if (!verL || verL.titulo !== "Verifica el arriendo" || verL.nombre !== "arriendo") F("1 · el default del constructor dejó de ser LTR: la fila de COMPRAR ya no dice «Verifica el arriendo»");
  // firme: «−50% o más», igual que LTR
  const firme = construirLoQueHariaYo({ modalidad: "str", veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: UF, aguanta: { marginPct: 70, firme: true }, verifica: null });
  if (firme?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion !== "La tarifa por noche puede caer hasta −50% o más y sigue siendo Comprar.") F("1 · con aguanta firme la oración es «… hasta −50% o más y sigue siendo Comprar.», como en LTR");
}

// ── 2 · los cuatro estados con el motor STR ─────────────────────────────────
{
  // (a) AJUSTA con mix a COMPRAR
  const dA = distancia({ base: "AJUSTA SUPUESTOS", regla: (x) => (esSondaMix(x) && pie(x, 20) >= 30 && plazo(x, 25) >= 30 && dcto(x) >= 0.05 - 1e-9 ? "COMPRAR" : "AJUSTA SUPUESTOS") });
  const bA = bloqueStr("AJUSTA SUPUESTOS", dA);
  if (estadoRecomendacion("AJUSTA SUPUESTOS", bA) !== "con_salida" || bA?.mix?.destino !== "COMPRAR") F("2a · AJUSTA con mix a COMPRAR no da «con_salida» con mix a COMPRAR");
  // (b) AJUSTA sin mix, con palanca sola (precio)
  const dB = distancia({ base: "AJUSTA SUPUESTOS", regla: (x) => (!esSondaMix(x) && x.precioCompra != null && dcto(x) >= 0.05 ? "COMPRAR" : "AJUSTA SUPUESTOS") });
  const bB = bloqueStr("AJUSTA SUPUESTOS", dB);
  if (estadoRecomendacion("AJUSTA SUPUESTOS", bB) !== "con_salida" || bB?.mix !== null || (bB?.filas.length ?? 0) !== 1) F("2b · AJUSTA con palanca sola no da «con_salida» sin mix y con una fila");
  // (c) BUSCAR con mix a COMPRAR: lee `mixPalancasHastaComprar`, no el del escalón
  const dC = distancia({
    base: "BUSCAR OTRA",
    regla: (x) => {
      if (esSondaMix(x)) return pie(x, 20) >= 30 && plazo(x, 25) >= 30 && dcto(x) >= 0.1 - 1e-9 ? "COMPRAR" : pie(x, 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      return "BUSCAR OTRA";
    },
  });
  const bC = bloqueStr("BUSCAR OTRA", dC);
  if (!dC?.valor.mixPalancasHastaComprar) F("2c · el motor no emitió el mix a COMPRAR desde BUSCAR (¿master sin el mini-goal?)");
  if (estadoRecomendacion("BUSCAR OTRA", bC) !== "con_salida" || bC?.mix?.destino !== "COMPRAR") F("2c · BUSCAR con mix a COMPRAR no da «con_salida»: la card tiene que leer `mixPalancasHastaComprar`");
  else if (Math.abs(parseFloat((bC.mix.descuento ?? "0").replace("−", "").replace(",", ".")) - 10) > 1) F(`2c · el descuento del mix a COMPRAR debía rondar 10%, dio «${bC.mix.descuento}»`);
  // (d) BUSCAR con mix SOLO al escalón: sin salida, nunca el escalón
  const dD = distancia({ base: "BUSCAR OTRA", regla: (x) => (esSondaMix(x) && pie(x, 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  const bD = bloqueStr("BUSCAR OTRA", dD);
  if (!dD?.valor.mixPalancas) F("2d · el caso (d) debía tener mix al escalón");
  if (estadoRecomendacion("BUSCAR OTRA", bD) !== "sin_salida") F(`2d · BUSCAR con mix solo al escalón debía ser «sin_salida», dio «${estadoRecomendacion("BUSCAR OTRA", bD)}» (§5: nunca se muestra un mix que solo llega al escalón)`);
  if (bD?.mix) F("2d · la card dibujaría el mix al escalón");
  // (e) BUSCAR sin salida con el número: el contexto dice «tarifa», no «arriendo»
  const dE = distancia({
    base: "BUSCAR OTRA",
    regla: (x) => (esSondaMix(x) ? "BUSCAR OTRA" : x.adrOverride != null && adrF(x) >= 1.6 ? "COMPRAR" : "BUSCAR OTRA"),
  });
  const bE = bloqueStr("BUSCAR OTRA", dE);
  if (estadoRecomendacion("BUSCAR OTRA", bE) !== "sin_salida") F("2e · BUSCAR sin nada que cruce debía ser «sin_salida»");
  if (!bE?.contexto) F("2e · sin salida con el mínimo fuera de tope (tarifa +60%) el contexto tiene que citar el número");
  else if (!/más de tarifa/.test(bE.contexto) || /arriendo/.test(bE.contexto)) F(`2e · el contexto STR dice «${bE.contexto}»: en STR es «más de tarifa»`);
  // (f) el descarte nombra las cinco vías STR en llano
  if (bE && !/tarifa/.test(bE.descarte ?? "")) F(`2f · el descarte STR no nombra la tarifa: «${bE.descarte}»`);
}

// ── 3 · «Verifica» solo con override, «Margen» desde la frontera ───────────
{
  const sinVerifica = bloqueStr("COMPRAR", null, { aguanta: { marginPct: 8, firme: false }, verifica: null });
  if (!sinVerifica) F("3 · COMPRAR sin verifica pero con aguanta tiene que construir bloque (una fila)");
  else if (sinVerifica.filas.some((f) => f.rotuloCorto === "Verifica")) F("3 · sin override no hay nada que verificar: la fila «Verifica» no va");
  const nada = bloqueStr("COMPRAR", null, { aguanta: null, verifica: null });
  if (nada !== null) F("3 · COMPRAR sin aguanta ni verifica devuelve null (sin filas no hay bloque)");
  // y el hero STR resuelve los dos así:
  if (!/verifica:\s*results\.adrFuente === "override"/.test(HSTR)) F("3 · HeroStrDictamen no condiciona `verifica` a `results.adrFuente === \"override\"`");
  if (!/fronterasIngreso/.test(HSTR) || !/aguanta:/.test(HSTR)) F("3 · HeroStrDictamen no resuelve `aguanta` desde `fronterasIngreso`");
  if (!/modalidad: "str"/.test(HSTR)) F("3 · HeroStrDictamen no llama al constructor con `modalidad: \"str\"`");
  // LTR no cambia de forma
  if (!/arriendoDeclaradoCLP: Number\(inputData\?\.arriendo \?\? 0\)/.test(HERO_LTR)) F("3 · el call site LTR del constructor cambió: tenía que quedar como estaba");
  if (/modalidad:/.test(HERO_LTR)) F("3 · HeroLTR pasa `modalidad`: el default del constructor es LTR y el call site no debía tocarse");
}

// ── 4 · renta larga solo con el hallazgo, y solo en sin salida ─────────────
{
  if (!/Analízalo como renta larga/.test(HSTR)) F("4 · falta la salida «Analízalo como renta larga» en el hero STR");
  if (!/direccion === "adverso"[\s\S]{0,120}pctConfiable/.test(HSTR)) F("4 · la salida a renta larga no exige `ventaja_vs_ltr` adverso CON `pctConfiable`");
  const i = HSTR.indexOf("Analízalo como renta larga");
  const tramo = i === -1 ? "" : HSTR.slice(Math.max(0, i - 700), i + 200);
  if (tramo && !/sin_salida/.test(tramo)) F("4 · la salida a renta larga no está condicionada al estado sin salida: en cualquier otro estado la card ya tiene qué decir");
  if (!/alternativa=\{/.test(HSTR)) F("4 · el hero STR no pasa `alternativa` a la card");
}

// ── 5 · el estado real, y el CTA de sin salida ──────────────────────────────
{
  if (!/estadoRecomendacion\(veredicto, bloqueDeterminista\)/.test(HSTR)) F("5 · PosicionFranco sigue recibiendo el estado de `estadoRecomendacion(veredicto, null)`: tiene que ser el del bloque construido");
  if (!/btn: "Ver qué se probó"/.test(HSTR)) F("5 · el CTA del estado sin salida no dice «Ver qué se probó» (mismo rótulo que LTR)");
  if (!/<LoQueHariaYoBloque bloque=\{bloqueDeterminista\}/.test(HSTR)) F("5 · el hero STR no monta `LoQueHariaYoBloque` con el bloque determinista");
  if (!/bloque=\{\s*(?:\/\*[\s\S]*?\*\/\s*)?bloqueDeterminista \?/.test(HSTR)) F("5 · el bloque no va a PosicionFranco desde el bloque construido");
}

// ── 6 · los capítulos de §7 con apellido ────────────────────────────────────
{
  if (!/export const conApellido/.test(CAPS_LTR)) F("6 · `conApellido` no se exporta de CapitulosInversion.tsx: STR tiene que usar el mismo helper, no una copia");
  if (!/import \{[^}]*conApellido[^}]*\} from "@\/components\/analysis\/CapitulosInversion"/.test(CAPS_STR)) F("6 · CapitulosInversionStr no importa `conApellido` de LTR");
  if (/useRediseno/.test(CAPS_STR)) F("6 · CapitulosInversionStr volvió a leer un interruptor que ya no existe");
  for (const ap of ["Cap rate", "Flujo", "Al año", "Precio", "vs arriendo largo", "Resultado"]) {
    if (!new RegExp(`conApellido\\("${ap.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`).test(CAPS_STR)) F(`6 · falta el apellido «${ap}» en las filas STR (§7)`);
  }
  const n = [...CAPS_STR.matchAll(/conApellido\("/g)].length;
  if (n !== 6) F(`6 · ${n} filas con apellido en STR; §7 pide seis`);
  if (!/noches/.test(CAPS_STR.slice(CAPS_STR.indexOf('conApellido("Al año"'), CAPS_STR.indexOf('conApellido("Al año"') + 120))) F("6 · «Al año» va con la unidad: «Al año 171 noches»");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runCardStrTier(): { hard: number } {
  console.log("\n─── TIER CARD-STR (contrato §5, §7 y §11 · bloque C · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el constructor por modalidad dice tarifa en STR y arriendo por default, los cuatro estados con el motor STR y nunca el escalón, Verifica solo con override y Aguanta desde la frontera, renta larga solo con el hallazgo y en sin salida, el estado real con «Ver qué se probó», y los seis capítulos con apellido");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCardStrTier();
  process.exit(hard ? 1 : 0);
}
