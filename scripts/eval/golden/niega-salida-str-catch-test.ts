/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · A8-STR — la prosa no niega una salida que el motor tiene (12-sep-2026 · v19). 0 tokens.
// ============================================================================
// El motor STR sabe desde 7cdf3250 que hay filas estructurales —ningún cambio por separado
// alcanza— con salida combinando pie y plazo, y la card la dibuja. Hasta v18 el prompt no
// recibía ese dato y le mandaba al modelo cerrar la puerta («NINGÚN AJUSTE REALISTA
// ALCANZA»). Medido sobre las 169 prosas STR: 16 estructurales con combinación, 13 con
// prosa, 10 la NIEGAN por escrito y ninguna la nombra. Mismo arreglo que LTR v24:
//
//   1. EL USER PROMPT LLEVA EL BLOQUE «SALIDA COMBINADA» con `hayMixACOMPRAR` y, con sí,
//      el movimiento, el costo del día uno y el descuento que además pide. LA FUENTE ES LA
//      DE LA CARD (`salidaPorMixStr`): AJUSTA lee `mixPalancas` (meta COMPRAR), BUSCAR lee
//      `mixPalancasHastaComprar`. Desde BUSCAR, cuando la combinación llega solo al escalón,
//      va `mixAlEscalon: sí` con su movimiento: la prosa no dice «no hay forma» ni promete
//      Comprar (9 filas del parque).
//   2. EL GUARD ES EL MISMO DE LTR, `niegaSalidaConMix` de cifras-guard.ts: lee el bloque
//      del user prompt, absuelve si la prosa nombra la salida, quita «por separado» / «por
//      sí sola» antes de mirar, y dispara con las siete familias. Cableado en el generador
//      STR como reintento quirúrgico [STR-NIEGA-MIX] que solo acepta si baja el conteo.
//      Verificado con una fila REAL: la prosa v4 de 2cb57d90 (AJUSTA, mix pie 30% + plazo
//      30 años y −18,1%) dice «ningún ajuste» dos veces.
//   3. STR-ESTRUCTURAL SE ACOTA (ver estructural-str-catch-test): con combinación, la caja
//      que nombra el descuento del mix no es una oferta de negociación.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/niega-salida-str-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildUserPromptSTR } from "../../../src/lib/ai-generation-str";
import { simularStrDesdePersistido } from "../../../src/lib/analysis/simular-str";
import { niegaSalidaConMix } from "../../../src/lib/cifras-guard";
import { salidaPorMixStr, mixAlEscalonStr } from "../../../src/lib/salida-por-mix";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const fixtures = JSON.parse(leer("src/app/dev/drawers-pixel/fixtures.json")) as Record<string, any>;
const promptDe = (clave: string): string => {
  const fx = fixtures[clave];
  const d = fx.input_data as Record<string, unknown>;
  const uf = Number(d.precioCompra) / Number(d.precioCompraUF);
  const sim = simularStrDesdePersistido(d, fx.results, uf, new Date(fx.created_at));
  return buildUserPromptSTR(d as never, fx.results, fx.comuna, sim).userPrompt;
};
const dvDe = (clave: string): HallazgoDistanciaVeredicto["valor"] =>
  (fixtures[clave].results.hallazgos as HallazgoDistanciaVeredicto[]).find((h) => h.id === "distancia_veredicto")!.valor;

// ── 1 · el bloque en el user prompt, desde la fuente de la card ─────────────
{
  // AJUSTA estructural con mix a COMPRAR (761b08ad): pie 30%, plazo 30 años, −17,5%, UF 261.
  const sm = salidaPorMixStr(dvDe("estructuralMixStr"));
  if (!sm) F("1 · salidaPorMixStr no ve la combinación de estructuralMixStr (AJUSTA, mixPalancas meta COMPRAR)");
  else if (sm.movimiento !== "el pie en 30% y el plazo en 30 años" || sm.descuentoPct !== 17.5 || sm.costoDiaUnoUF !== 261) {
    F(`1 · la salida de estructuralMixStr salió distinta al motor: «${sm.movimiento}» · −${sm.descuentoPct}% · UF ${sm.costoDiaUnoUF}`);
  }
  const p = promptDe("estructuralMixStr");
  for (const linea of ["- hayMixACOMPRAR: sí", "- movimiento: el pie en 30% y el plazo en 30 años", "- costoDiaUno: UF 261 de tu bolsillo el día uno", "- descuentoQueAdemásPide: −17,5%"]) {
    if (!p.includes(linea)) F(`1 · el user prompt de estructuralMixStr no trae «${linea}»`);
  }
  if (/NINGÚN AJUSTE REALISTA ALCANZA/.test(p)) F("1 · con salida combinada el prompt sigue mandando cerrar la puerta («NINGÚN AJUSTE REALISTA ALCANZA»)");
  if (!/hayMixACOMPRAR: sí` → HAY salida/.test(p)) F("1 · falta la instrucción del caso «sí» (HAY salida, y es la combinación que el bloque describe)");
  if (!/descuentoQueAdemásPide/.test(p) || /«chico»/.test(p) && !/NO lo llames «chico»/.test(p)) F("1 · la instrucción tiene que leer `descuentoQueAdemásPide` y prohibir «chico»");

  // BUSCAR estructural con mix solo al escalón (grajalesStr 5dc42a82): no promete Comprar.
  const dvG = dvDe("grajalesStr");
  if (salidaPorMixStr(dvG)) F("1 · grajalesStr llega solo al escalón: salidaPorMixStr (la fuente de la card) tenía que dar null");
  const esc = mixAlEscalonStr(dvG);
  if (!esc) F("1 · mixAlEscalonStr no ve la combinación al escalón de grajalesStr (pie 25% + plazo 30 años + −11%)");
  const pg = promptDe("grajalesStr");
  if (!pg.includes("- hayMixACOMPRAR: no")) F("1 · el user prompt de grajalesStr no dice `hayMixACOMPRAR: no`");
  if (!/- mixAlEscalon: sí — con el pie en 25% y el plazo en 30 años/.test(pg)) F("1 · el user prompt de grajalesStr no trae `mixAlEscalon: sí` con su movimiento");
  if (/NINGÚN AJUSTE REALISTA ALCANZA/.test(pg)) F("1 · con mix al escalón el prompt sigue mandando cerrar la puerta entera");

  // Sin ninguna combinación (maculStrSinSalida 213d321c): `no`, sin escalón, y la puerta se cierra.
  const pm = promptDe("maculStrSinSalida");
  if (!pm.includes("- hayMixACOMPRAR: no")) F("1 · el user prompt de maculStrSinSalida no dice `hayMixACOMPRAR: no`");
  if (/^- mixAlEscalon: sí/m.test(pm)) F("1 · maculStrSinSalida no tiene combinación al escalón y el prompt dice que sí");
  if (!/se cierra la puerta, y se cierra entera/.test(pm)) F("1 · sin combinación el prompt tiene que cerrar la puerta entera (caso tres)");
  // Y una fila NO estructural no lleva el bloque: hay una salida más simple y ya se cuenta en las vías.
  if (/SALIDA COMBINADA/.test(promptDe("staRosaStr"))) F("1 · staRosaStr no es estructural y el prompt le mete el bloque de salida combinada");
}

// ── 2 · el guard, con una fila real ─────────────────────────────────────────
{
  const p = promptDe("estructuralMixNiegaStr");
  const dv = dvDe("estructuralMixNiegaStr");
  if (!dv.esEstructural || !salidaPorMixStr(dv)) F("2 · estructuralMixNiegaStr tenía que ser estructural con combinación (2cb57d90)");
  if (!p.includes("- hayMixACOMPRAR: sí")) F("2 · el user prompt de estructuralMixNiegaStr no trae `hayMixACOMPRAR: sí`");
  const real = niegaSalidaConMix(p, fixtures.estructuralMixNiegaStr.ai_analysis);
  if (real.length === 0) F("2 · la prosa REAL de 2cb57d90 («ningún ajuste» dos veces, al lado de un mix pie 30% + plazo 30 años) no dispara el guard");
  // Nombrar la salida absuelve, y «por separado» no es negar.
  const nombra = { conviene: { cajaAccionable: "Ningún cambio por separado alcanza; subiendo el pie a 30% y estirando el plazo a 30 años, con un 18,1% de descuento, el veredicto cambia." } };
  if (niegaSalidaConMix(p, nombra).length) F("2 · nombrar la salida combinada tiene que absolver");
  const separado = { conviene: { cajaAccionable: "Ningún ajuste por separado lo saca de este veredicto." } };
  if (niegaSalidaConMix(p, separado).length) F("2 · «por separado» dice lo mismo que el motor y no puede disparar");
  const niega = { conviene: { cajaAccionable: "No hay forma de que este depto llegue a Comprar: el problema es estructural." } };
  if (niegaSalidaConMix(p, niega).length === 0) F("2 · «no hay forma» / «estructural» con mix tiene que disparar");
  // Sin el bloque en el prompt el guard no audita nada (prosa vieja, o caller que no lo pasa).
  if (niegaSalidaConMix(promptDe("maculStrSinSalida"), niega).length) F("2 · sin `hayMixACOMPRAR: sí` en el prompt el guard no puede disparar");
}

// ── 3 · cableado en el generador STR ─────────────────────────────────────────
{
  const src = leer("src/lib/ai-generation-str.ts");
  if (!/niegaSalidaConMix\(userPrompt,/.test(src)) F("3 · el generador STR no evalúa `niegaSalidaConMix(userPrompt, …)`");
  if (!/\[STR-NIEGA-MIX\]/.test(src)) F("3 · falta la etiqueta [STR-NIEGA-MIX] del reintento quirúrgico en el generador STR");
  if (!/salidaPorMixStr\(/.test(src)) F("3 · el prompt STR no arma el bloque con `salidaPorMixStr` (la fuente de la card)");
  if (!/mixAlEscalonStr\(/.test(src)) F("3 · el prompt STR no arma `mixAlEscalon` con `mixAlEscalonStr`");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runNiegaSalidaStrTier(): { hard: number } {
  console.log("\n─── TIER NIEGA-SALIDA-STR (A8-STR · v19 · el mix llega al modelo y la prosa no lo niega · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el bloque SALIDA COMBINADA desde la fuente de la card (sí / no + escalón / no), el guard de LTR reutilizado y disparando con la fila real 2cb57d90, absuelto al nombrar la salida y con «por separado», y cableado en el generador STR");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runNiegaSalidaStrTier();
  process.exit(hard ? 1 : 0);
}
