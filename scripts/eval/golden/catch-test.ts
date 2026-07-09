// ============================================================================
// GOLDEN SET — catch-test (meta-validación: ¿el runner CAZA?)
// ============================================================================
// Rompe sintéticamente cada clase de invariante sobre un resultado válido en
// memoria y verifica que el checker correspondiente FALLA. Si una mutación NO
// produce falla, el runner tiene un punto ciego → catch-test rojo. Es la prueba
// de que los verdes de las otras tiers significan algo.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF } from "./seeds";
import { extractFacts } from "./extract";
import { checkClassA, checkClassB, factsToBaseline, type Check } from "./invariants";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const failed = (checks: Check[], rulePrefix: string): boolean =>
  checks.some((c) => c.rule.startsWith(rulePrefix) && !c.pass);

interface CaseResult { nombre: string; cazado: boolean; nota: string }

export async function runCatchTest(): Promise<boolean> {
  const results: CaseResult[] = [];

  // Base sana: GS-1 (COMPRAR, N=8, con sensibilidad + patrimonio + sobreprecio).
  const seed = GOLDEN_SEEDS[0];
  const clean = runAnalysis(seed.input, GOLDEN_UF, seed.mediana);
  const cleanFacts = extractFacts(clean, seed.input.precio);
  const base = factsToBaseline(cleanFacts);
  const ctxOK = {
    arriendo: seed.input.arriendo,
    totalAportado: clean.exitScenario?.totalAportado ?? null,
    medianaConfiable: true,
  };

  // Sanity: sin mutar, TODO pasa (si no, el test base está mal).
  {
    const a = checkClassA(cleanFacts, base);
    const b = checkClassB(clean, cleanFacts, ctxOK);
    const allPass = [...a, ...b].every((c) => c.pass);
    results.push({ nombre: "SANITY (sin mutar → todo verde)", cazado: allPass, nota: allPass ? "ok" : "el base sano falla — bug en el checker" });
  }

  // 1) B2 dirección: invertir la dirección de sobreprecio → B2 debe fallar.
  {
    const mut = clone(clean);
    const sob = (mut.metrics as any).hallazgoSobreprecio || (mut.hallazgos || []).find((h: any) => h.id === "sobreprecio");
    if (sob) sob.direccion = sob.direccion === "favorable" ? "adverso" : "favorable";
    const f = extractFacts(mut, seed.input.precio);
    const b = checkClassB(mut, f, ctxOK);
    results.push({ nombre: "B2 dirección invertida (sobreprecio)", cazado: failed(b, "B2.dir"), nota: "" });
  }

  // 2) B1 KPI==body: corromper la cifra de la fraseCanonica de cap_rate.
  {
    const mut = clone(clean);
    const cr = (mut.metrics as any).hallazgoCapRate || (mut.hallazgos || []).find((h: any) => h.id === "cap_rate");
    if (cr) cr.fraseCanonica = "Tu CAP rate es 99,9% — un número que no calza con el motor.";
    const f = extractFacts(mut, seed.input.precio);
    const b = checkClassB(mut, f, ctxOK);
    results.push({ nombre: "B1 cifra body corrompida (cap_rate)", cazado: failed(b, "B1.kpi==body"), nota: "" });
  }

  // 3) B5 N fuera de rango: dejar 3 hallazgos → N<5.
  {
    const mut = clone(clean);
    mut.hallazgos = (mut.hallazgos || []).slice(0, 1);
    (mut.metrics as any).hallazgoSobreprecio = null;
    (mut.metrics as any).hallazgoFlujoMensual = null;
    (mut.metrics as any).hallazgoPlusvalia = null;
    (mut.metrics as any).hallazgoPuestaAPunto = null;
    const f = extractFacts(mut, seed.input.precio);
    const b = checkClassB(mut, f, ctxOK);
    results.push({ nombre: "B5 N<5 (hallazgos removidos)", cazado: failed(b, "B5.N"), nota: `N=${f.N}` });
  }

  // 4) B6 omisión: forzar contexto BUSCAR OTRA sobre un caso con sensibilidad presente.
  {
    const mut = clone(clean); // sí tiene sensibilidad (COMPRAR base)
    const f = extractFacts(mut, seed.input.precio);
    // ctx miente: veredicto del facts es COMPRAR pero simulamos que "no debería" haber sensibilidad
    const fBuscar = { ...f, veredicto: "BUSCAR OTRA" }; // BUSCAR ⇒ sensibilidad NO debe existir, pero existe
    const b = checkClassB(mut, fBuscar as any, ctxOK);
    results.push({ nombre: "B6 sensibilidad presente en BUSCAR OTRA", cazado: failed(b, "B6.sensibilidad"), nota: "" });
  }

  // 5) B4 corona: falsear la corona (gather dedup por id ⇒ probamos el corte de corona).
  {
    const mut2 = clone(clean);
    const f2 = extractFacts(mut2, seed.input.precio);
    (f2 as any).corona = "estructura_financiamiento"; // corona falsa
    const b2 = checkClassB(mut2, f2, ctxOK);
    results.push({ nombre: "B4 corona incorrecta", cazado: failed(b2, "B4.corona"), nota: "" });
  }

  // 6) Clase (a) veredicto: cambiar el veredicto recomputado.
  {
    const f = clone(cleanFacts);
    f.veredicto = f.veredicto === "COMPRAR" ? "BUSCAR OTRA" : "COMPRAR";
    const a = checkClassA(f, base);
    results.push({ nombre: "clase(a) veredicto cambiado", cazado: failed(a, "a.veredicto"), nota: "" });
  }

  // 7) Clase (a) cifra: mover capRate fuera de tolerancia.
  {
    const f = clone(cleanFacts);
    if (f.capRatePct != null) f.capRatePct += 5;
    const a = checkClassA(f, base);
    results.push({ nombre: "clase(a) capRate drift >tol", cazado: failed(a, "a.capRatePct"), nota: "" });
  }

  // Reporte
  console.log("\n─── CATCH-TEST (¿el runner caza?) ───");
  let todoCazado = true;
  for (const r of results) {
    const isSanity = r.nombre.startsWith("SANITY");
    const ok = isSanity ? r.cazado : r.cazado; // sanity: cazado==allPass; otros: cazado==detectó falla
    if (!ok) todoCazado = false;
    console.log(`  ${ok ? "✓" : "✗ PUNTO CIEGO"}  ${r.nombre}${r.nota ? ` — ${r.nota}` : ""}`);
  }
  console.log(todoCazado ? "\n  ✓ CATCH-TEST VERDE — el runner caza todas las clases probadas" : "\n  ✗ CATCH-TEST ROJO — hay puntos ciegos");
  return todoCazado;
}
