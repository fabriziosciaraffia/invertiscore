// ============================================================================
// GOLDEN · LA CARD COMPRAR CON DOS MÁRGENES, Y «(c/u por separado)» SOLO CON DOS
// catch-test (12-sep-2026). 0 tokens, sin base.
// ============================================================================
// Contrato §5, estado COMPRAR, para las DOS modalidades (copy compartido de la card):
//
//   1. EL MOTOR LTR MIDE HASTA QUÉ PRECIO SIGUE SIENDO COMPRAR. `sensibilidad-hallazgo.ts`
//      —la pieza que ya vive en COMPRAR y mide el otro margen— bisecciona el precio HACIA
//      ARRIBA con `biseccionFactor` (la forma «subiendo» con que STR encuentra `caeA`),
//      hasta ×2, y emite `precioMaximoComprarUF`: el último precio que conserva el
//      veredicto. `null` = aguanta más de ×2, o base distinta de COMPRAR. AUSENTE = fila
//      vieja, no calculado. `analysis.ts` le pasa el MISMO closure de veredicto que usa
//      la distancia, con `precio`.
//
//   2. TRES FILAS CON ORACIÓN COMPLETA, rótulo en la columna: Margen · Precio · Verifica.
//        LTR  «El arriendo puede caer hasta $719.616 (−6,3%) y sigue siendo Comprar.»
//        STR  «La tarifa por noche puede caer hasta $61.000 (−6,3%) y sigue siendo Comprar.»
//        firme «… puede caer hasta −50% o más y sigue siendo Comprar.»
//        precio «Puedes pagar hasta UF 4.480 (+6,7%) y sigue siendo Comprar.» — sin
//               precio máximo, la fila no va.
//        verifica LTR «Declaraste $768.000 de arriendo. Todo cuelga de ese número:
//               confírmalo antes de firmar.» · STR «Definiste $65.000 la noche. …» — solo
//               si el dato es tuyo.
//      El piso en pesos es declarado × (1 + margen); sin el monto, la oración va solo con
//      el porcentaje. `aguanta`, `verifica` y `precioMax` los resuelve el caller.
//
//   3. «(c/u por separado)» SOLO con dos alternativas. Con una: «Alternativamente: −24,3%
//      de precio.» y «Pero eso no depende de ti: lo pone el vendedor.»
//
//   4. LOS DOS HEROS PASAN EL PRECIO MÁXIMO: LTR desde `precioMaximoComprarUF`, STR desde
//      `fronteraPrecio.caeA`.
//
//   5. «VERIFICA» SEGÚN LA PROCEDENCIA DEL ARRIENDO (12-sep-2026). El wizard prellena el
//      arriendo con la estimación de Franco y no persiste si la aceptaste; el motor lo
//      deriva (`resolverProcedenciaArriendo`: igualdad al peso con `zonaRadio.arriendoPromedio`).
//      Tres copys, no dos:
//        declarado_usuario  «Declaraste $X de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.»
//        estimacion_franco  «Usamos $X de arriendo, la mediana de tu zona. Confírmalo con avisos reales antes de firmar.»
//                           (fuente comuna-m2: «…, el estimado de tu comuna. …»: es un estimado, no una mediana)
//        sin_registro       «El análisis usa $X de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.»
//      HeroLTR la resuelve con la MISMA función que ya usa el prompt. Medido: 55 · 20 · 85 de
//      las 160 COMPRAR. STR no cambia: `adrFuente` viene persistido.
//
// Corre dentro del QUICK (tier "comprar-dos-margenes") y standalone:
//   node --import tsx scripts/eval/golden/comprar-dos-margenes-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildHallazgoSensibilidad } from "../../../src/lib/sensibilidad-hallazgo";
import { construirLoQueHariaYo, lineaNoDependeDeTi } from "../../../src/lib/lo-que-haria-yo";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const ANALYSIS = leer("src/lib/analysis.ts");
const SENS = leer("src/lib/sensibilidad-hallazgo.ts");
const BLO = leer("src/components/analysis/shared/LoQueHariaYoBloque.tsx");
const HERO_LTR = leer("src/components/analysis/HeroLTR.tsx");
const HSTR = leer("src/components/analysis/str/HeroStrDictamen.tsx");
const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");

const PRECIO_UF = 3_000;
const sens = (o: { base?: Veredicto; cae?: number | null; arriendoCae?: number }) =>
  buildHallazgoSensibilidad({
    veredictoBase: o.base ?? "COMPRAR",
    arriendo: 768_000,
    veredictoAt: (f) => (f < (o.arriendoCae ?? 0.9) ? "AJUSTA SUPUESTOS" : (o.base ?? "COMPRAR")),
    modalidad: "ltr",
    precioUF: PRECIO_UF,
    // El precio sube: COMPRAR hasta el factor `cae`, y de ahí AJUSTA. `null` = nunca cae.
    veredictoAtPrecio: (f) => (o.cae != null && f >= o.cae ? "AJUSTA SUPUESTOS" : (o.base ?? "COMPRAR")),
  });

// ── 1 · el motor LTR: hasta qué precio sigue siendo COMPRAR ─────────────────
{
  const h = sens({ cae: 1.2 });
  const max = h?.valor.precioMaximoComprarUF;
  if (max === undefined) F("1 · el hallazgo de sensibilidad no emite `precioMaximoComprarUF` (undefined = no calculado)");
  else if (max === null) F("1 · el precio cae a AJUSTA en +20% y el motor devolvió null: ¿biseccionó hacia arriba?");
  else {
    if (Math.abs(max / PRECIO_UF - 1.2) > 0.01) F(`1 · el precio máximo debía rondar UF 3.600 (+20%), dio UF ${max}`);
    if (max >= PRECIO_UF * 1.2) F(`1 · UF ${max} ya NO es Comprar: el máximo es el último precio que CONSERVA el veredicto, no el primero que lo pierde`);
  }
  const firme = sens({ cae: null });
  if (firme?.valor.precioMaximoComprarUF !== null) F("1 · con el veredicto firme hasta ×2 el precio máximo tiene que ser null explícito (aguanta más de ×2)");
  const ajusta = sens({ base: "AJUSTA SUPUESTOS", cae: 1.2 });
  if (ajusta && ajusta.valor.precioMaximoComprarUF !== null) F("1 · desde AJUSTA no se mide el precio máximo de COMPRAR: null explícito");
  if (!/biseccionFactor\(/.test(SENS)) F("1 · sensibilidad-hallazgo no reusa `biseccionFactor` del builder de distancia");
  if (!/veredictoAtPrecio:\s*\(factor(?:: number)?\)\s*=>\s*veredictoAtPatch\(\{\s*precio:/.test(ANALYSIS)) F("1 · analysis.ts no le pasa a la sensibilidad el closure de precio (`veredictoAtPrecio`) sobre `veredictoAtPatch`: tiene que ser LA MISMA ruta de veredicto que usa la distancia");
  if (!/precioUF:\s*input\.precio,?\s*\n?\s*veredictoAtPrecio|veredictoAtPrecio[\s\S]{0,200}precioUF:\s*input\.precio|precioUF:\s*input\.precio[\s\S]{0,200}veredictoAtPrecio/.test(ANALYSIS)) F("1 · analysis.ts no le pasa `precioUF: input.precio` a la sensibilidad");
}

// ── 2 · las tres filas con oración, LTR y STR ────────────────────────────────
{
  const ltr = construirLoQueHariaYo({
    veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: 39_000,
    sensibilidad: { valor: { marginPct: 6.3, firme: false } } as never, arriendoDeclaradoCLP: 768_000,
    precioMax: { uf: 4_480, pct: 6.7 },
  });
  const fila = (rot: string) => ltr?.filas.find((f) => f.rotuloCorto === rot);
  if (!ltr) F("2 · COMPRAR LTR no construyó bloque");
  else {
    const rot = ltr.filas.map((f) => f.rotuloCorto).join(" · ");
    if (rot !== "Margen · Precio · Verifica") F(`2 · el orden de las filas COMPRAR es Margen · Precio · Verifica, dio «${rot}»`);
    if (fila("Margen")?.oracion !== "El arriendo puede caer hasta $719.616 (−6,3%) y sigue siendo Comprar.") F(`2 · Margen LTR: «${fila("Margen")?.oracion}»`);
    if (fila("Precio")?.oracion !== "Puedes pagar hasta UF 4.480 (+6,7%) y sigue siendo Comprar.") F(`2 · Precio: «${fila("Precio")?.oracion}»`);
    if (fila("Verifica")?.oracion !== "Declaraste $768.000 de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.") F(`2 · Verifica LTR: «${fila("Verifica")?.oracion}»`);
  }
  // firme, sin precio máximo
  const firme = construirLoQueHariaYo({
    veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: 39_000,
    sensibilidad: { valor: { marginPct: 50, firme: true } } as never, arriendoDeclaradoCLP: 768_000, precioMax: null,
  });
  if (firme?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion !== "El arriendo puede caer hasta −50% o más y sigue siendo Comprar.") F(`2 · Margen firme: «${firme?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion}»`);
  if (firme?.filas.some((f) => f.rotuloCorto === "Precio")) F("2 · sin precio máximo la fila «Precio» no va");
  // STR
  const str = construirLoQueHariaYo({
    modalidad: "str", veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: 39_000,
    aguanta: { marginPct: 6.3, firme: false }, montoMercadoCLP: 65_000, verifica: { cifraCLP: 65_000 }, precioMax: { uf: 4_480, pct: 6.7 },
  });
  const fs = (rot: string) => str?.filas.find((f) => f.rotuloCorto === rot);
  if (fs("Margen")?.oracion !== "La tarifa por noche puede caer hasta $60.905 (−6,3%) y sigue siendo Comprar.") F(`2 · Margen STR: «${fs("Margen")?.oracion}»`);
  if (fs("Verifica")?.oracion !== "Definiste $65.000 la noche. Todo cuelga de ese número: confírmalo antes de firmar.") F(`2 · Verifica STR: «${fs("Verifica")?.oracion}»`);
  // STR sin override: sin Verifica, y el piso en pesos igual sale de la tarifa que usa el análisis
  const sinV = construirLoQueHariaYo({
    modalidad: "str", veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: 39_000,
    aguanta: { marginPct: 10, firme: false }, montoMercadoCLP: 50_000, verifica: null, precioMax: null,
  });
  if (sinV?.filas.some((f) => f.rotuloCorto === "Verifica")) F("2 · sin override no hay «Verifica»");
  if (sinV?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion !== "La tarifa por noche puede caer hasta $45.000 (−10%) y sigue siendo Comprar.") F(`2 · Margen STR sin override: «${sinV?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion}»`);
  // sin monto no se muestra el piso en pesos: solo el porcentaje
  const sinMonto = construirLoQueHariaYo({
    modalidad: "str", veredicto: "COMPRAR", distancia: null, currency: "CLP", valorUF: 39_000,
    aguanta: { marginPct: 10, firme: false }, verifica: null, precioMax: null,
  });
  if (sinMonto?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion !== "La tarifa por noche puede caer hasta −10% y sigue siendo Comprar.") F(`2 · Margen sin monto: «${sinMonto?.filas.find((f) => f.rotuloCorto === "Margen")?.oracion}»`);
  // en UF el piso del arriendo va en UF
  const uf = construirLoQueHariaYo({
    veredicto: "COMPRAR", distancia: null, currency: "UF", valorUF: 38_400,
    sensibilidad: { valor: { marginPct: 6.3, firme: false } } as never, arriendoDeclaradoCLP: 768_000, precioMax: null,
  });
  if (!/^El arriendo puede caer hasta UF 18,7 \(−6,3%\)/.test(uf?.filas[0]?.oracion ?? "")) F(`2 · en UF el piso va en UF: «${uf?.filas[0]?.oracion}»`);
}

// ── 5 · «Verifica» según la procedencia del arriendo ────────────────────────
{
  const base = { veredicto: "COMPRAR" as const, distancia: null, currency: "CLP" as const, valorUF: 39_000, sensibilidad: null, precioMax: null, montoMercadoCLP: 768_000 };
  const ver = (v: Parameters<typeof construirLoQueHariaYo>[0]["verifica"]) =>
    construirLoQueHariaYo({ ...base, verifica: v })?.filas.find((f) => f.rotuloCorto === "Verifica")?.oracion;
  if (ver({ cifraCLP: 768_000, procedencia: "declarado_usuario" }) !== "Declaraste $768.000 de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.") F(`5 · declarado_usuario: «${ver({ cifraCLP: 768_000, procedencia: "declarado_usuario" })}»`);
  if (ver({ cifraCLP: 768_000, procedencia: "estimacion_franco", fuente: "radio" }) !== "Usamos $768.000 de arriendo, la mediana de tu zona. Confírmalo con avisos reales antes de firmar.") F(`5 · estimacion_franco: «${ver({ cifraCLP: 768_000, procedencia: "estimacion_franco", fuente: "radio" })}»`);
  if (ver({ cifraCLP: 768_000, procedencia: "estimacion_franco", fuente: "comuna-m2" }) !== "Usamos $768.000 de arriendo, el estimado de tu comuna. Confírmalo con avisos reales antes de firmar.") F(`5 · estimacion_franco desde el m²: «${ver({ cifraCLP: 768_000, procedencia: "estimacion_franco", fuente: "comuna-m2" })}»`);
  if (ver({ cifraCLP: 768_000, procedencia: "sin_registro" }) !== "El análisis usa $768.000 de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.") F(`5 · sin_registro: «${ver({ cifraCLP: 768_000, procedencia: "sin_registro" })}»`);
  // sin procedencia (la llamada LTR de siempre y STR con override) sigue diciendo «Declaraste» / «Definiste»
  if (ver({ cifraCLP: 768_000 }) !== "Declaraste $768.000 de arriendo. Todo cuelga de ese número: confírmalo antes de firmar.") F("5 · sin procedencia el copy tiene que seguir siendo «Declaraste…»");
  // y HeroLTR la resuelve con la función del motor, no con una igualdad propia
  if (!/resolverProcedenciaArriendo\(/.test(HERO_LTR)) F("5 · HeroLTR no resuelve la procedencia del arriendo con `resolverProcedenciaArriendo`, la misma que usa el prompt");
  if (!/procedencia:/.test(HERO_LTR)) F("5 · HeroLTR no le pasa `procedencia` al constructor en `verifica`");
  if (/procedencia/.test(HSTR)) F("5 · STR no lleva procedencia: la tarifa tuya ya viene persistida en `adrFuente`");
}

// ── 3 · «(c/u por separado)» solo con dos, y la línea en singular ───────────
{
  if (!/alternativas\.length > 1 && <em>\(c\/u por separado\)<\/em>/.test(BLO)) F("3 · la card imprime «(c/u por separado)» también con UNA alternativa: solo va con dos");
  if (lineaNoDependeDeTi(["vendedor"]) !== "Pero eso no depende de ti: lo pone el vendedor.") F(`3 · con una alternativa la línea va en singular: «${lineaNoDependeDeTi(["vendedor"])}»`);
  if (lineaNoDependeDeTi(["mercado", "vendedor"]) !== "Pero eso no depende de ti: lo pone el mercado o el vendedor.") F("3 · con dos la línea nombra a los dos");
  // y la card dibuja la oración de las filas COMPRAR
  if (!/f\.oracion/.test(BLO)) F("3 · la card no dibuja `f.oracion` en las filas COMPRAR");
  const o = CSS.match(/\.doc-r2 \.rec-v\.rec-o\{([^}]*)\}/)?.[1] ?? "";
  if (!o) F("3 · falta la regla «.doc-r2 .rec-v.rec-o» de la oración (cuerpo de lectura, no cifra en mono)");
  else if (!/font-size:\s*13\.5px/.test(o)) F(`3 · la oración de COMPRAR va a 13,5 px: «${o.trim()}»`);
}

// ── 4 · los dos heros pasan el precio máximo ────────────────────────────────
{
  if (!/precioMax:[\s\S]{0,300}precioMaximoComprarUF/.test(HERO_LTR)) F("4 · HeroLTR no resuelve `precioMax` desde `precioMaximoComprarUF` del hallazgo de sensibilidad");
  if (!/precioMax:[\s\S]{0,300}fronteraPrecio/.test(HSTR)) F("4 · HeroStrDictamen no resuelve `precioMax` desde `fronteraPrecio.caeA` de la simulación");
  if (!/montoMercadoCLP:\s*adr/.test(HSTR)) F("4 · HeroStrDictamen no pasa la tarifa que usa el análisis como monto del piso (`montoMercadoCLP: adr`)");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runComprarDosMargenesTier(): { hard: number } {
  console.log("\n─── TIER COMPRAR-DOS-MÁRGENES (contrato §5 · estado COMPRAR · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el motor LTR mide hasta qué precio sigue siendo Comprar, las tres filas con oración en las dos modalidades (Verifica solo si el dato es tuyo, el piso en pesos solo con monto), Verifica con los tres copys por procedencia del arriendo, «(c/u por separado)» solo con dos, y los dos heros pasan el precio máximo");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runComprarDosMargenesTier();
  process.exit(hard ? 1 : 0);
}
