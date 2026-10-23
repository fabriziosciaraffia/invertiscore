// ============================================================================
// TIER VEREDICTO-GUARDADO — el correo lleva el mismo veredicto que la portada, siempre (22-oct-2026, Fabrizio)
//
// Lo que pasó: el informe 8678e963 de fsm@ quedó BUSCAR OTRA al crearse —el brazo de sobreprecio comunal con flujo negativo
// del gate 1— y el correo «tu informe está listo» lo dijo; la portada mostraba Ajustar, porque al rearmar la mediana desde
// `mediana_comuna_snapshot` perdía el `universo`, y sin universo ese brazo no dispara. 17 informes guardados así.
//
// La regla (decisión de Fabrizio): LA PORTADA NO RECALCULA EL VEREDICTO. Muestra el guardado (`results.veredicto`), el que
// calculó el motor y el que usan el correo y el dashboard. Una sola fuente. Y el snapshot se lee ENTERO.
//
//   1 · `medianaDesdeSnapshot` conserva el universo, los cuartiles y «estimada»: el motor da lo mismo con la mediana viva
//       que con la mediana leída del snapshot (ida y vuelta). EN ROJO CON EL CÓDIGO DE HOY: sin universo, AJUSTA.
//   2 · `conVeredictoGuardado`: con un informe guardado AJUSTA SUPUESTOS cuyo recálculo da BUSCAR OTRA, la portada dice
//       AJUSTA (y su clasificación y color siguen al veredicto). Sin veredicto guardado, queda el recalculado.
//   3 · Cableado: la portada, el PDF, comparar y la landing leen el snapshot con `medianaDesdeSnapshot` y el veredicto con
//       `conVeredictoGuardado`; el correo manda `readVeredicto(result)`, el guardado; el color se decide en un solo lugar.
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/veredicto-guardado-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { buildMedianaSnapshot } from "../../../src/lib/api-helpers/analisis-pipeline";
import { readVeredicto } from "../../../src/lib/results-helpers";
import type { AnalisisInput } from "../../../src/lib/types";

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
/** Los módulos del goal se cargan en tiempo de ejecución: contra el código de HOY, faltan, y el tier lo dice en vez de explotar. */
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
type MedianaSnapshotMod = typeof import("../../../src/lib/analysis/mediana-snapshot");
type ResultsHelpersMod = typeof import("../../../src/lib/results-helpers");

// El informe de fsm@ del 22-oct-2026 (8678e963), sin la muestra de arriendo: Santiago, 2D1B, 50 m², UF 3.000 a UF 60/m²
// contra una mediana usada de 49,66 (+21 %), arriendo de $439.000 con flujo negativo. Por puntaje (51) es AJUSTA; el
// brazo de sobreprecio comunal con flujo lo cierra en BUSCAR OTRA —solo si la mediana trae su universo—.
const INPUT = {
  piso: 0, tipo: "Departamento", banos: 1, bodega: false, ciudad: "Santiago", comuna: "Santiago", gastos: 90000, piePct: 20,
  precio: 3000, esNuevo: false, amoblado: false, arriendo: 439000, esStudio: false, cuotasPie: 0, tipoRenta: "larga",
  antiguedad: 25, montoCuota: 0, superficie: 50, dormitorios: 2, estadoVenta: "inmediata", tasaInteres: 4.07, tasaMercado: 4.07,
  plazoCredito: 25, vacanciaMeses: 0.6, arriendoBodega: 0, contribuciones: 55385, enConstruccion: false, cantidadBodegas: 0,
  estacionamiento: "no", superficieTotal: 50, usaAdministrador: false, methodologyVersion: "v3", ubicacionPrecision: "numero",
  provisionMantencion: 0, contribucionesOrigen: "estimada", precioEstacionamiento: 0, arriendoEstacionamiento: 0,
  incluyeCorretajeInicial: true, cantidadEstacionamientos: 0,
  valorMercadoRef: { n: 313, nivel: "radio", valorUF: 2519, universo: "usado", radioMetros: 500 }, valorMercadoFranco: 2519,
  zonaRadio: { lat: -33.4521473, lng: -70.6459061, ventaRadio: 500, radioMetros: 500, ventaFuente: "radio", ventaUniverso: "usado", arriendoFuente: "radio", sampleSizeVenta: 313, arriendoPromedio: 439000, precioM2VentaCLP: 2075442, sampleSizeArriendo: 66 },
} as unknown as AnalisisInput;
const UF = 41200;
const ASOF = new Date("2026-10-22T14:49:56.039Z");
const MEDIANA_VIVA = { mediana: 49.66, n: 2041, universo: "usado" as const, ventanaDias: 90, p25: 43.22, p75: 57.23 };

export function runVeredictoGuardadoTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER VEREDICTO-GUARDADO (la portada muestra el veredicto que calculó el motor; el snapshot se lee entero · 0 tokens) ───");
  const ms = cargar<MedianaSnapshotMod>("src/lib/analysis/mediana-snapshot.ts");
  const rh = cargar<ResultsHelpersMod>("src/lib/results-helpers.ts");
  const medianaDesdeSnapshot = ms?.medianaDesdeSnapshot;
  const conVeredictoGuardado = rh?.conVeredictoGuardado;
  const colorClasificacion = rh?.colorClasificacion;

  // ── 1 · el snapshot, ida y vuelta ──
  if (!medianaDesdeSnapshot) F("1 · falta src/lib/analysis/mediana-snapshot.ts (medianaDesdeSnapshot)");
  else try {
    const vivo = runAnalysis(INPUT, UF, MEDIANA_VIVA, ASOF);
    if (readVeredicto(vivo) !== "BUSCAR OTRA") F(`1 · el caso base no cierra en BUSCAR OTRA con la mediana viva (dio ${readVeredicto(vivo)}, score ${vivo.score}): la sonda no sirve`);
    const { universo: _u, ...sinUniverso } = MEDIANA_VIVA;
    void _u;
    const mixto = runAnalysis(INPUT, UF, sinUniverso, ASOF);
    if (readVeredicto(mixto) !== "AJUSTA SUPUESTOS") F(`1 · sin universo el gate no debería disparar (dio ${readVeredicto(mixto)}): la sonda no mide lo que dice`);
    const snap = buildMedianaSnapshot(MEDIANA_VIVA);
    const leida = medianaDesdeSnapshot(snap, { capRefComuna: null });
    if (leida.universo !== "usado" || leida.p25 !== 43.22 || leida.p75 !== 57.23 || leida.n !== 2041 || leida.mediana !== 49.66) F(`1 · medianaDesdeSnapshot pierde algo del snapshot: ${JSON.stringify(leida)}`);
    if (!("capRefComuna" in leida) || leida.capRefComuna !== null) F("1 · la referencia de cap rate no viaja como se le pasa");
    if ("capRefComuna" in medianaDesdeSnapshot(snap)) F("1 · sin referencia pasada, inventa la clave capRefComuna");
    const estimada = medianaDesdeSnapshot(buildMedianaSnapshot({ ...MEDIANA_VIVA, estimada: true }));
    if (estimada.estimada !== true) F("1 · «estimada» no viaja");
    const vuelta = recomputeResultsForLegacy(INPUT, UF, leida, ASOF);
    if (readVeredicto(vuelta) !== readVeredicto(vivo)) F(`1 · la ida y vuelta por el snapshot cambia el veredicto: vivo ${readVeredicto(vivo)}, leído del snapshot ${readVeredicto(vuelta)}`);
    if (vuelta.score !== vivo.score) F(`1 · la ida y vuelta por el snapshot cambia el puntaje: ${vivo.score} → ${vuelta.score}`);
  } catch (e) {
    F(`1 · explotó: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2 · un informe guardado AJUSTA, recalculado BUSCAR OTRA: la portada dice AJUSTA ──
  if (!conVeredictoGuardado || !colorClasificacion) F("2 · results-helpers.ts no tiene conVeredictoGuardado / colorClasificacion");
  else try {
    const recalculo = runAnalysis(INPUT, UF, MEDIANA_VIVA, ASOF);
    if (readVeredicto(recalculo) !== "BUSCAR OTRA") F("2 · la sonda necesita un recálculo en BUSCAR OTRA");
    const guardado = { veredicto: "AJUSTA SUPUESTOS", score: 51 };
    const portada = conVeredictoGuardado(recalculo, guardado);
    if (portada.veredicto !== "AJUSTA SUPUESTOS") F(`2 · la portada no muestra el veredicto guardado (dio ${portada.veredicto})`);
    if (portada.clasificacion !== "AJUSTA SUPUESTOS" || portada.clasificacionColor !== "yellow") F(`2 · la clasificación no sigue al veredicto guardado (${portada.clasificacion} / ${portada.clasificacionColor})`);
    if (portada.score !== recalculo.score || portada.metrics !== recalculo.metrics || portada.hallazgos !== recalculo.hallazgos) F("2 · el veredicto guardado toca algo más que el veredicto (puntaje, cifras o hallazgos)");
    if (recalculo.veredicto !== "BUSCAR OTRA") F("2 · conVeredictoGuardado muta el recálculo en vez de devolver otro objeto");
    const buscar = conVeredictoGuardado(recalculo, { veredicto: "BUSCAR OTRA" });
    if (buscar.veredicto !== "BUSCAR OTRA" || buscar.clasificacionColor !== "red") F("2 · con el guardado igual al recálculo cambia algo");
    const comprar = conVeredictoGuardado(recalculo, { veredicto: "COMPRAR" });
    if (comprar.veredicto !== "COMPRAR" || comprar.clasificacionColor !== "positive") F("2 · COMPRAR guardado no se impone");
    const legacy = conVeredictoGuardado(recalculo, { veredicto: "AJUSTA EL PRECIO" });
    if (legacy.veredicto !== "AJUSTA SUPUESTOS") F("2 · un veredicto legacy guardado no se normaliza");
    const sinGuardado = conVeredictoGuardado(recalculo, null);
    if (sinGuardado.veredicto !== "BUSCAR OTRA") F("2 · sin veredicto guardado no queda el recalculado");
    const vacio = conVeredictoGuardado(recalculo, { score: 51 } as never);
    if (vacio.veredicto !== "BUSCAR OTRA") F("2 · con results sin veredicto no queda el recalculado");
    for (const [v, c] of [["COMPRAR", "positive"], ["AJUSTA SUPUESTOS", "yellow"], ["BUSCAR OTRA", "red"]] as const) {
      if (colorClasificacion(v) !== c) F(`2 · colorClasificacion(${v}) ≠ ${c}`);
    }
  } catch (e) {
    F(`2 · explotó: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 3 · cableado: cuatro lectores, un correo, un color ──
  const lectores: Array<[string, RegExp]> = [
    ["src/app/analisis/[id]/informe-ltr.tsx", /conVeredictoGuardado\(recomputeResultsForLegacy\(inputDataRaw, ufFrozen, medianaComuna, asOfFrozen\), rawResults\)/],
    ["src/app/analisis/[id]/documento/page.tsx", /conVeredictoGuardado\(recomputeResultsForLegacy\(inputDataRaw, ufFrozen, medianaComuna, asOfFrozen\), rawResults\)/],
    ["src/lib/lo-que-sigue/comparar.ts", /conVeredictoGuardado\(recomputeResultsForLegacy\(inp as never, uf, med as never, asOf\), f\.results as never\)/],
    ["src/lib/landing-vivo.ts", /conVeredictoGuardado\(recomputeResultsForLegacy\(input, uf, medianaComuna, new Date\(fila\.created_at\)\), fila\.results\)/],
  ];
  for (const [p, re] of lectores) {
    const s = codigo(p);
    if (!s) { F(`3 · falta ${p}`); continue; }
    if (!re.test(s)) F(`3 · ${p} no impone el veredicto guardado sobre el recálculo`);
    if (!/medianaDesdeSnapshot\(/.test(s)) F(`3 · ${p} no lee el snapshot con medianaDesdeSnapshot`);
    if (/\bp25: (medianaSnapshot|snap)\.p25\b/.test(s)) F(`3 · ${p} rearma la mediana a mano (y pierde el universo)`);
  }
  const helper = codigo("src/lib/analysis/mediana-snapshot.ts");
  if (!/\.\.\.\(snap\.universo \? \{ universo: snap\.universo \} : \{\}\)/.test(helper)) F("3 · medianaDesdeSnapshot no copia el universo");
  const ruta = codigo("src/app/api/analisis/route.ts");
  const correo = ruta.slice(ruta.indexOf("sendAnalysisReadyEmail("), ruta.indexOf("sendAnalysisReadyEmail(") + 400);
  if (!/readVeredicto\(result\)/.test(correo)) F("3 · el correo «tu informe está listo» no manda el veredicto guardado del motor");
  const motor = codigo("src/lib/analysis.ts");
  if (!/const clasificacionColor: string = colorClasificacion\(veredicto\);/.test(motor)) F("3 · el motor decide el color por su cuenta (dos reglas espejo)");
  if (/veredicto === "COMPRAR" \? "positive"/.test(motor)) F("3 · el motor conserva la regla del color duplicada");

  if (fallas.length) {
    console.log(`  ✗ VEREDICTO-GUARDADO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el snapshot se lee entero (universo incluido) y la portada, el PDF, comparar y la landing muestran el veredicto que calculó el motor, el mismo del correo y el dashboard");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 63306fb2, `src/` del goal de vuelta a HEAD y los módulos
// nuevos apartados): 17 fallas —falta mediana-snapshot.ts, faltan conVeredictoGuardado y colorClasificacion, y los cuatro
// lectores «rearman la mediana a mano (y pierden el universo)» y «no imponen el veredicto guardado»—. Y 6 mutaciones, cada
// una restaurada byte a byte, todas ROJAS: V1 medianaDesdeSnapshot sin el universo (la ida y vuelta cambia el veredicto:
// BUSCAR OTRA → AJUSTA, el caso de fsm@) · V2 conVeredictoGuardado devuelve el recálculo · V3 la portada sin
// conVeredictoGuardado · V4 el motor con su propia regla del color · V5 el veredicto guardado sin arrastrar la
// clasificación · V6 el snapshot sin cuartiles.

if (require.main === module) {
  process.exit(runVeredictoGuardadoTier().hard ? 1 : 0);
}
