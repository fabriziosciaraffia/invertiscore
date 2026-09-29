// ============================================================================
// GOLDEN · DFL2 (29-sep-2026) — catch-test
// ============================================================================
//   La exención DFL2 de contribuciones con la regla del SII. Hasta hoy era un monto fijo de $50M
//   en un Math.max contra la exención general de $57M: nunca aplicaba.
//   1 · El DFL2 exime el 50% del AVALÚO y compite con la exención general: se aplica la mayor.
//       Bajo dos veces la exención general no cambia nada; sobre eso baja la contribución, y el
//       cálculo calza con la fórmula del SII hecha a mano.
//   2 · Plazo por superficie desde la recepción: 20 años hasta 70 m², 15 hasta 100, 10 hasta
//       140; más de 140 no califica; un usado conserva los años que le quedan.
//   3 · Las filas guardadas: la contribución declarada manda; la que calza con la estimación
//       anterior se re-estima con DFL2; el origen explícito del wizard gana.
//   4 · El beneficio vence en la proyección: desde el año siguiente al último con DFL2 la
//       contribución es la completa.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/dfl2-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aniosRestantesDfl2, duracionDfl2, esEstimacionAnterior, estimarContribuciones, PARAMETROS_CONTRIBUCIONES as P, resolverContribuciones } from "../../../src/lib/contribuciones";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

/** La fórmula del SII hecha a mano: una sola exención, la mayor; tasas por tramo; sobretasa. */
function sii(precioCLP: number, dfl2Vigente: boolean): number {
  const avaluo = precioCLP * P.RATIO_AVALUO_COMERCIAL;
  const exento = Math.max(P.EXENCION_GENERAL, dfl2Vigente ? avaluo * 0.5 : 0);
  const afecto = Math.max(0, avaluo - exento);
  if (afecto <= 0) return 0;
  const t1 = Math.max(0, Math.min(afecto, P.CAMBIO_TASA - exento));
  const t2 = Math.max(0, afecto - t1);
  return Math.round((t1 * P.TASA_1 + t2 * P.TASA_2 + (t2 > 0 ? t2 * P.SOBRETASA_TRAMO_2 : 0)) / 4);
}

/** La estimación de ANTES del 29-sep-2026 (constantes del reavalúo 2018, DFL2 anulado): así están
 *  guardadas las filas viejas. Congelada acá igual que en contribuciones.ts. */
function siiAnterior(precioCLP: number): number {
  const avaluo = precioCLP * 0.7;
  const afecto = Math.max(0, avaluo - 57_000_000);
  if (afecto <= 0) return 0;
  const t1 = Math.max(0, Math.min(afecto, 118_571_000 - 57_000_000));
  const t2 = Math.max(0, afecto - t1);
  return Math.round((t1 * 0.00933 + t2 * 0.01088 + (t2 > 0 ? t2 * 0.00025 : 0)) / 4);
}

export function runDfl2Tier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER DFL2 (la exención de contribuciones con la regla del SII · 0 tokens) ───");

  // ── 1 · 50% del avalúo contra la exención general ────────────────────────
  const nuevo60 = { superficieM2: 60, aniosDesdeRecepcion: 0 };
  const umbral = (2 * P.EXENCION_GENERAL) / P.RATIO_AVALUO_COMERCIAL; // precio donde el DFL2 empieza a ganar
  const bajo = Math.round(umbral * 0.8), alto = Math.round(umbral * 2.2);
  if (estimarContribuciones(bajo, nuevo60) !== estimarContribuciones(bajo, null)) F("1 · bajo dos veces la exención general el DFL2 cambia la contribución (la general ya es mayor)");
  if (!(estimarContribuciones(alto, nuevo60) < estimarContribuciones(alto, null))) F("1 · sobre dos veces la exención general el DFL2 no baja la contribución: no aplica");
  for (const precio of [bajo, alto, Math.round(umbral * 1.3), Math.round(umbral * 4)]) {
    if (estimarContribuciones(precio, nuevo60) !== sii(precio, true)) F(`1 · con DFL2 no calza con la fórmula del SII (precio ${precio}: ${estimarContribuciones(precio, nuevo60)} vs ${sii(precio, true)})`);
    if (estimarContribuciones(precio, null) !== sii(precio, false)) F(`1 · sin DFL2 no calza con la fórmula del SII (precio ${precio})`);
  }

  // ── 2 · Plazos por superficie desde la recepción ─────────────────────────
  const casos: Array<[number, number, number | null]> = [[40, 20, 20], [70, 0, 20], [70.5, 0, 15], [100, 0, 15], [101, 0, 10], [140, 0, 10], [141, 0, null]];
  for (const [sup, , dur] of casos) if (duracionDfl2(sup) !== dur) F(`2 · ${sup} m² da ${duracionDfl2(sup)} años de DFL2, no ${dur}`);
  const vig = (sup: number, edad: number) => aniosRestantesDfl2({ superficieM2: sup, aniosDesdeRecepcion: edad }) > 0;
  if (!vig(60, 19) || vig(60, 20)) F("2 · hasta 70 m² el DFL2 no dura 20 años desde la recepción");
  if (!vig(90, 14) || vig(90, 15)) F("2 · entre 70 y 100 m² el DFL2 no dura 15 años");
  if (!vig(120, 9) || vig(120, 10)) F("2 · entre 100 y 140 m² el DFL2 no dura 10 años");
  if (vig(150, 0)) F("2 · más de 140 m² califica al DFL2");
  if (aniosRestantesDfl2({ superficieM2: 60, aniosDesdeRecepcion: 15 }) !== 5) F("2 · un usado no conserva los años que le quedan");
  if (estimarContribuciones(alto, { superficieM2: 150, aniosDesdeRecepcion: 0 }) !== estimarContribuciones(alto, null)) F("2 · un depto de más de 140 m² recibe el DFL2");

  // ── 3 · Las filas guardadas ──────────────────────────────────────────────
  const legacy = siiAnterior(alto); // la estimación anterior (el Math.max anulaba el DFL2)
  if (!esEstimacionAnterior(legacy, alto)) F("3 · la estimación anterior no se reconoce como estimada");
  const r1 = resolverContribuciones({ declarada: legacy, precioCLP: alto, superficieM2: 60, aniosDesdeRecepcion: 0 });
  if (!r1.estimada || r1.trimestral !== sii(alto, true)) F("3 · una fila con la estimación anterior no se re-estima con DFL2");
  const r2 = resolverContribuciones({ declarada: Math.round(legacy * 1.4), precioCLP: alto, superficieM2: 60, aniosDesdeRecepcion: 0 });
  if (r2.estimada || r2.trimestral !== Math.round(legacy * 1.4)) F("3 · una contribución declarada por el usuario se reemplaza");
  const r3 = resolverContribuciones({ declarada: legacy, origen: "declarada", precioCLP: alto, superficieM2: 60, aniosDesdeRecepcion: 0 });
  if (r3.estimada) F("3 · el origen «declarada» del wizard no manda");
  const r4 = resolverContribuciones({ declarada: 123_456, origen: "estimada", precioCLP: alto, superficieM2: 60, aniosDesdeRecepcion: 0 });
  if (!r4.estimada || r4.trimestral !== sii(alto, true)) F("3 · el origen «estimada» del wizard no re-estima");
  const r0 = resolverContribuciones({ declarada: 0, precioCLP: alto, superficieM2: 60, aniosDesdeRecepcion: 0 });
  if (!r0.estimada) F("3 · una contribución vacía no se estima");

  // ── 4 · El beneficio vence en la proyección ──────────────────────────────
  const seed: any = (GOLDEN_SEEDS as any[]).find((s) => s.input.estadoVenta !== "futura" && !s.input.fechaEntrega && s.input.piePct > 0 && s.input.piePct < 100);
  if (!seed) F("4 · no hay seed LTR inmediata para medir el vencimiento");
  else {
    const precioUF = Math.ceil((umbral * 2.5) / GOLDEN_UF);
    const base = { ...seed.input, precio: precioUF, superficie: 60, antiguedad: 15, esNuevo: false, enConstruccion: false, contribucionesOrigen: "estimada" as const };
    const conDfl2: any = runAnalysis(base, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
    const info = conDfl2.metrics?.contribucionesDfl2;
    if (!info || info.aniosRestantes !== 5) F(`4 · un usado de 15 años y 60 m² no lleva 5 años de DFL2 en el motor (${JSON.stringify(info)})`);
    else {
      const sinDfl2: any = runAnalysis({ ...base, contribucionesOrigen: "declarada", contribuciones: info.trimestralSinDfl2 }, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
      const g = (r: any, anio: number) => r.projections[anio - 1].gastosOperativosAnual;
      if (!(g(conDfl2, 5) < g(sinDfl2, 5))) F("4 · en el año 5 (con beneficio) la contribución no es menor");
      if (Math.abs(g(conDfl2, 6) - g(sinDfl2, 6)) > 2 || Math.abs(g(conDfl2, 10) - g(sinDfl2, 10)) > 2) F("4 · desde el año 6 (vencido) la contribución no vuelve a la completa");
    }
  }

  // ── 5 · Sin el monto fijo de antes ───────────────────────────────────────
  const src = leer("src/lib/contribuciones.ts");
  if (/EXENCION_DFL2\s*=\s*50_000_000/.test(src) || /Math\.max\(EXENCION_GENERAL, EXENCION_DFL2\)/.test(src)) F("5 · vuelve el DFL2 como monto fijo de $50M");

  if (fallas.length) {
    console.log(`  ✗ DFL2 · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el DFL2 exime el 50% del avalúo y compite con la exención general, dura según los m² desde la recepción, re-estima las filas guardadas sin tocar lo declarado y vence en la proyección");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (29-sep-2026) ─────────────────────────────────────────────────────────
// 12/12 en rojo, restauradas byte a byte: M1 vuelve el tope fijo de $50M · M2 el DFL2 se suma a la
// exención general · M3 el DFL2 como 50% del impuesto · M4 70 m² da 15 años · M5 más de 140 m²
// califica · M6 un usado no conserva los años · M7 lo declarado se re-estima · M8 las filas
// guardadas no se re-estiman · M9 el origen del wizard no manda · M10 el beneficio no vence en la
// proyección · M11 vence un año tarde · M12 el motor cuenta un usado como nuevo.

if (require.main === module) {
  const { hard } = runDfl2Tier();
  process.exit(hard ? 1 : 0);
}
