/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL CAP RATE SE REDONDEA UNA VEZ, EN TODAS LAS SUPERFICIES — catch-test (21-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El hero (`LosNumeros`) formateaba `metrics.capRate` —que sale redondeado a DOS decimales— a
// uno, o sea redondeaba dos veces (2,848 → 2,85 → «2,9»); el capítulo I lee `valor.capRatePct`
// del hallazgo, redondeado UNA vez desde el crudo (2,8). 55 filas del parque (4,5%) mostraban
// dos cap rates en la misma página. Ahora el hero lee la misma cifra que el capítulo. Fija:
//   1. `capRateDisplayPct` redondea una vez desde el crudo (2,848 → 2,8; 2,85 → 2,9): un
//      doble redondeo o un toFixed no dan lo mismo en el borde;
//   2. que sobre las 13 seeds hero y capítulo den EL MISMO string;
//   3. cableado: `LosNumeros` muestra `valor.capRatePct` del hallazgo y no formatea
//      `metrics.capRate` a pelo; el builder redondea con `capRateDisplayPct`.
// VERIFICADO EN ROJO (21-sep-2026): `LosNumeros` con `pct1(metrics.capRate)` → cae 3; el
// builder redondeando a dos decimales antes de uno → cae 2 (GS-7, la seed que cae en el
// borde: 2,848 → 2,85 → 2,9). Un `toFixed` en la función NO se distingue con estos fixtures
// —solo difiere de Math.round en bordes binarios exactos— y no es lo que este tier vigila:
// vigila que se redondee UNA vez y que el hero lea la misma cifra.
//   node --import tsx scripts/eval/golden/caprate-redondeo-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { capRateDisplayPct, capRateNetoLtrPct } from "../../../src/lib/cap-rate-hallazgo";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

export function runCapRateRedondeoTier(): { hard: number } {
  fallas.length = 0;
  // 1 · una vez, desde el crudo: el doble redondeo (2 dec → 1 dec) da 2,9 donde el crudo da 2,8
  for (const [crudo, esperado] of [[2.8482721364822945, 2.8], [2.85, 2.9], [3.449, 3.4], [7.4, 7.4]] as const) {
    if (capRateDisplayPct(crudo) !== esperado) F(`1 · capRateDisplayPct(${crudo}) = ${capRateDisplayPct(crudo)}, esperaba ${esperado}`);
  }
  if (capRateDisplayPct(Number((2.8482721364822945).toFixed(2))) === capRateDisplayPct(2.8482721364822945)) F("1 · PISO · el fixture ya no distingue el doble redondeo del simple");
  // 2 · hero ≡ hallazgo en las seeds, con la misma función que usa LosNumeros. Desde el
  //     23-sep-2026 la cifra es el cap rate NETO de mercado (`rentabilidadNeta`); el capítulo I
  //     ya no la muestra (compara bruto contra bruto), pero el hallazgo la lleva y el prompt la cita.
  for (const s of [...GOLDEN_SEEDS, ...BORDE_SEEDS]) {
    const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
    const h = (r.hallazgos ?? []).find((x: any) => x.id === "cap_rate") ?? r.metrics?.hallazgoCapRate;
    if (!h) continue;
    const heroN = capRateNetoLtrPct(r.metrics);
    if (heroN == null || pct1(heroN) !== pct1(h.valor.capRatePct)) F(`2 · ${s.key}: hero «${heroN}» ≠ hallazgo «${h.valor.capRatePct}»`);
    // y la cifra sale del CRUDO (arriendo − todos los gastos, sobre el precio), no de
    // `rentabilidadNeta` ya redondeada a dos: si se redondeara dos veces, hero y hallazgo
    // coincidirían en la cifra equivocada y el invariante de arriba quedaría verde y vacío.
    const M = r.metrics;
    const crudo = M.precioCLP > 0 ? ((M.ingresoMensual * 12 - (M.egresosMensuales - M.dividendo) * 12) / M.precioCLP) * 100 : 0;
    if (h.valor.capRatePct !== capRateDisplayPct(crudo) || heroN !== capRateDisplayPct(crudo)) F(`2 · ${s.key}: el neto (${h.valor.capRatePct} / ${heroN}) no es el crudo redondeado una vez (${capRateDisplayPct(crudo)})`);
  }
  // 3 · cableado
  const hero = leer("src/components/analysis/LosNumeros.tsx");
  if (!/const n = capRateNetoLtrPct\(metrics\);/.test(hero)) F("3 · LosNumeros no muestra el cap rate neto con capRateNetoLtrPct");
  if (/metrics\.capRate\b/.test(hero)) F("3 · LosNumeros vuelve a leer metrics.capRate");
  const builder = leer("src/lib/cap-rate-hallazgo.ts");
  if (!/const capRatePct = capRateDisplayPct\(p\.capRatePct\);/.test(builder)) F("3 · el builder del hallazgo no usa capRateDisplayPct");
  if (fallas.length) {
    console.log(`   caprate-redondeo ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   caprate-redondeo ✓ (una sola forma de redondear el cap rate; hero ≡ hallazgo en las 13 seeds, el neto desde el crudo)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCapRateRedondeoTier();
  process.exit(hard ? 1 : 0);
}
