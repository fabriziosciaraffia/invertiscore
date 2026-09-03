// ============================================================================
// GOLDEN · GUARDS CONTABLES — catch-test (goal "tres reglas contables", 03-sep-2026).
// 0 tokens, puro. Fija:
//   1. [HERO-CLAIM] el sujeto elige la razón: "aportas más de la mitad de la cuota" con
//      aporte/cuota 0,53 es verdadera (GS-4); "el arriendo cubre menos de la mitad de la
//      cuota" con arriendo/cuota 0,74 es falsa; sin sujeto claro, sin licencia.
//   2. [HERO-CLAIM] razones de largoPlazo: "tu parte al vender … más del doble del fondo"
//      con 1,6× dispara (GS-3); "casi el doble del fondo mutuo" con 1,59× dispara (GS-PJ).
//   3. Unidad "por metro": "UF 700 más por metro" con +35 UF/m² dispara (GS-4); "UF 146 de
//      más por cada metro" con +32,8 dispara (GS-7); "UF 110 el metro" (el precio/m² del
//      sujeto) no.
//   node --env-file=.env.local --import tsx scripts/eval/golden/guards-contables-catch-test.ts
// ============================================================================
import { violacionesHeroClaim, type RazonesHeroClaim } from "../../../src/lib/ai-generation";
import { cifrasPorMetroFueraDeUnidad } from "../../../src/lib/cifras-guard";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const base: RazonesHeroClaim = {
  viasCruzan: [], capRatePct: 8.7, capRefPct: 4, arriendoM: 650000, dividendoM: 880365, aporteM: 466000,
  precioUF: 3000, vmUF: 3000, vmConFuente: false, exitEquityCLP: 70865849, depositoCLP: 60000000, fondoCLP: 44421425,
  sujetoUfM2: 80, medianaUfM2: 45, medianaConfiable: true,
};
const v = (t: string, r: Partial<RazonesHeroClaim> = {}) => violacionesHeroClaim(t, { ...base, ...r });

// ── 1. el sujeto elige la razón ──
if (v("así que aportas de tu bolsillo más de la mitad de la cuota cada mes.").length) F("1 · GS-4 'aportas más de la mitad de la cuota' (aporte/cuota 0,53) debía pasar");
if (!v("El arriendo cubre menos de la mitad de la cuota.").length) F("1 · 'el arriendo cubre menos de la mitad de la cuota' (0,74) debía disparar");
if (v("El arriendo cubre menos de la mitad de la cuota.", { arriendoM: 400000 }).length) F("1 · arriendo/cuota 0,45 con 'menos de la mitad' debía pasar");
if (!v("Es más del doble de la cuota.").length) F("1 · sin sujeto claro debía quedar sin licencia");
if (!v("Pones el doble cada mes.").length) F("1 · sin comparador debía quedar sin licencia");
if (v("El CAP rate de 8,7% es más del doble de la referencia de 4,0%.").length) F("1 · CAP/referencia 2,17× con 'más del doble' debía pasar");
if (!v("El CAP rate de 6,0% es más del doble de la referencia de 4,0%.", { capRatePct: 6 }).length) F("1 · CAP/referencia 1,5× con 'más del doble' debía disparar");
if (v("hay una sola vía: el precio.", { viasCruzan: ["precio"] }).length) F("1 · única vía con una vía debía pasar");
if (!v("hay una sola vía: el precio.", { viasCruzan: ["precio", "pie"] }).length) F("1 · única vía con dos vías debía disparar");

// ── 2. razones de largoPlazo ──
if (!v("El depto proyecta que tu parte al vender a 10 años es $70.865.849 —más del doble del fondo—, pero pones $66.618 al mes.").length) F("2 · GS-3 'tu parte al vender … más del doble del fondo' (1,6×) debía disparar");
if (!v("el depto te deja tu parte al vender en $59.214.387 — casi el doble del fondo mutuo —", { exitEquityCLP: 59214387, fondoCLP: 37216300 }).length) F("2 · GS-PJ 'casi el doble del fondo mutuo' (1,59×) debía disparar");
if (v("tu parte al vender es más del doble del fondo mutuo.", { exitEquityCLP: 100000000, fondoCLP: 44421425 }).length) F("2 · tu parte/fondo 2,25× debía pasar");
if (v("El CAP rate de 9,0% más que duplica la referencia de 4,0%.", { capRatePct: 9 }).length) F("2 · 'más que duplica' 2,25× debía pasar");

// ── 3. unidad "por metro" ──
const ref = { sobreprecioUfM2: 35, sujetoUfM2: 80, medianaUfM2: 45, ufClp: 38800 };
if (!cifrasPorMetroFueraDeUnidad({ conviene: { respuestaDirecta_clp: "pagas UF 700 más por metro que el departamento promedio." } }, ref).length) F("3 · GS-4 'UF 700 más por metro' con +35 debía disparar");
if (!cifrasPorMetroFueraDeUnidad({ conviene: { respuestaDirecta_clp: "estás pagando UF 146 de más por cada metro que compras." } }, { ...ref, sobreprecioUfM2: 32.8, sujetoUfM2: 88.5, medianaUfM2: 55.7 }).length) F("3 · GS-7 'UF 146 de más por cada metro' con +32,8 debía disparar");
if (cifrasPorMetroFueraDeUnidad({ conviene: { cajaAccionable_clp: "en esta comuna existen, pero no a UF 110 el metro." } }, { ...ref, sujetoUfM2: 110, medianaUfM2: 58 }).length) F("3 · 'UF 110 el metro' (precio/m² del sujeto) no debía disparar");
if (cifrasPorMetroFueraDeUnidad({ conviene: { respuestaDirecta_clp: "pagas UF 35 más por metro que la mediana (UF 45/m²)." } }, ref).length) F("3 · 'UF 35 más por metro' (la diferencia) no debía disparar");
if (cifrasPorMetroFueraDeUnidad({ conviene: { respuestaDirecta_clp: "estás pagando UF 700 sobre la mediana por los 20 m²." } }, ref).length) F("3 · total sin 'por metro' no debía disparar");

console.log("\nGUARDS CONTABLES · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
