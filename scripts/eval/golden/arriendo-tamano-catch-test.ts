// ============================================================================
// GOLDEN · ARRIENDO-TAMAÑO (03-oct-2026) — catch-test
// ============================================================================
//   En Ñuñoa 284 Comprar/Ajustar quedaban con el arriendo sugerido sobre su zona. No eran edificios
//   nuevos ni amoblados: eran deptos chicos (180 bajo 45 m²) que recibían la mediana del arriendo
//   MENSUAL de comparables ~10% más grandes. Decisión de Fabrizio (03-oct-2026):
//   1 · LA ESCALA: la mediana mensual del radio se lleva a los m² del depto con (m² / m² mediano)^e, con
//       e por tipología —1D 0,2, 2D 0,4, 3D y más 0,8: las que minimizan el error en un backtest con
//       1.371 arriendos reales—, y el arriendo del segmento igual. (Un 0,8 fijo no mejoraba nada.)
//   2 · LA MARCA de «arriendo sospechoso» compara contra deptos de tamaño parecido (±30% de m²), cada uno
//       llevado al tamaño del depto, no contra el $/m² de todos los tamaños.
//   3 · LA FICHA de comparables dice la mediana de los avisos y la llevada a tus m², y las dos salen de
//       la lista guardada; las muestras de antes se leen como antes.
//   4 · LA VERSIÓN de las sugerencias sube (s3): los avisos se reevalúan.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/arriendo-tamano-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elasticidadArriendo, escalarPorTamano, referenciaZonaPorTamano, resumirComparablesRadio, type FilaRadio } from "../../../src/lib/services/comparables-radio";
import { arriendoSegmentado } from "../../../src/lib/avisos/arriendo-segmentado";
import { leerMuestraArriendo } from "../../../src/lib/arriendo-referencia";
import { SUGERENCIAS_VERSION } from "../../../src/lib/services/market-suggestions";
import { VERSION_EVALUACION } from "../../../src/lib/avisos/evaluar-aviso";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

export async function runArriendoTamanoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER ARRIENDO-TAMAÑO (el arriendo sugerido sigue al tamaño del depto · 0 tokens) ───");

  // ── 1 · la escala ──
  const fila = (precio: number, sup: number): FilaRadio => ({ precio, superficie_m2: sup, gastos_comunes: null, dormitorios: 2, lat: -33.45, lng: -70.6, distance_meters: 300 });
  const radio = [fila(450000, 45), fila(520000, 48), fila(560000, 52), fila(600000, 50), fila(640000, 55), fila(680000, 56)];
  {
    const es = [0, 1, 2, 3, 4, 6, null].map((d) => elasticidadArriendo(d));
    if (es.join() !== "0.2,0.2,0.4,0.8,0.8,0.8,0.2") F(`1 · la elasticidad por tipología no es 1D 0,2 · 2D 0,4 · 3D y más 0,8 (estudio como 1D): ${es.join(" · ")}`);
    if (Math.round(escalarPorTamano(580000, 51, [45, 48, 52, 50, 55, 56], 0.4)) !== 580000 || escalarPorTamano(580000, 0, [50], 0.4) !== 580000 || escalarPorTamano(580000, 40, [], 0.4) !== 580000) F("1 · la escala mueve un depto del tamaño de sus comparables (o uno sin m²)");
    const chico = resumirComparablesRadio(radio, 35, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    const igual = resumirComparablesRadio(radio, 51, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    const grande = resumirComparablesRadio(radio, 60, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    if (chico !== 499000 || igual !== 580000 || grande !== 619000) F(`1 · con dormitorios el radio no lleva la mediana mensual a los m² del depto con la elasticidad del 2D (35 m² ${chico}, 51 ${igual}, 60 ${grande}; se esperaba 499.000, 580.000 y 619.000)`);
    const unD = resumirComparablesRadio(radio.map((f) => ({ ...f, dormitorios: 1 })), 35, { modo: "conDorms", factorCierre: 1, dormitorios: 1 })?.arriendo;
    if (unD !== Math.round((580000 * Math.pow(35 / 51, 0.2)) / 1000) * 1000) F(`1 · un 1D no usa la elasticidad del 1D (${unD})`);
    // Segmento: 12 arriendos de 45 a 56 m² y 12 ventas de 60 a 82 UF/m²; el aviso cae al medio.
    const arriendosSeg = Array.from({ length: 12 }, (_, i) => ({ precio: 480000 + i * 15000, superficie_m2: 45 + i }));
    const ventasSeg = Array.from({ length: 12 }, (_, i) => ({ precio: (60 + i * 2) * 50, superficie_m2: 50 }));
    const seg = (sujetoM2?: number, d?: number) => arriendoSegmentado(arriendosSeg as never, ventasSeg as never, 71, 39000, sujetoM2, d);
    const sSin = seg(), s35 = seg(35, 2);
    const m2Tramo = sSin ? 50.5 : NaN; // los 6 del medio: 48 a 53 m²
    if (!sSin || !s35 || Math.abs(s35.monto - sSin.monto * Math.pow(35 / m2Tramo, 0.4)) > 2000 || !(s35.monto < sSin.monto * 0.9)) F(`1 · el arriendo del segmento no se lleva a los m² del depto con la elasticidad de su tipología (sin m² ${sSin?.monto}, 35 m² ${s35?.monto})`);
    const ev = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
    if (!/arriendoSegmentado\(arr\.comparables \?\? \[\], vta\.nearbyProperties \?\? \[\], a\.precioUF \/ a\.m2, uf, a\.m2, a\.dormitorios\)/.test(ev)) F("1 · la evaluación no le pasa los m² y la tipología del aviso al segmento");
    const ms1 = sinComentarios(leer("src/lib/services/market-suggestions.ts"));
    if (!/const conDorms = resumirComparablesRadio\(\(arriendos \|\| \[\]\) as FilaRadio\[\], superficie, \{\s*modo: "conDorms",\s*dormitorios,/.test(ms1)) F("1 · el radio no le pasa la tipología del depto al resumen");
  }

  // ── 2 · la marca contra deptos de tamaño parecido ──
  {
    // Zona: deptos chicos caros por m² y grandes baratos por m².
    const zona = [...[30, 32, 34, 36, 38, 40].map((m) => fila(Math.round(m * 15000), m)), ...[60, 65, 70, 75, 80, 85].map((m) => fila(Math.round(m * 10000), m))];
    const chico = referenciaZonaPorTamano(zona, 35, 5, 0.4);
    const grande = referenciaZonaPorTamano(zona, 72, 5, 0.4);
    if (!chico || !grande || Math.abs(chico - 15000) > 600 || Math.abs(grande - 10000) > 600) F(`2 · la referencia de la zona no es la de los deptos de su tamaño (35 m² ${chico}, 72 m² ${grande}; se esperaba ~15.000 y ~10.000 $/m²)`);
    if (referenciaZonaPorTamano(zona, 52, 5, 0.4) !== null) F("2 · sin 5 deptos de tamaño parecido la referencia no es null (se inventa con otros tamaños)");
    const ms = sinComentarios(leer("src/lib/services/market-suggestions.ts"));
    if (!/if \(superficie && superficie > 0\) return referenciaZonaPorTamano\(limpios, superficie, MIN_ZONA, elasticidadArriendo\(dormitorios\)\);/.test(ms)) F("2 · la mediana de la zona no usa la referencia por tamaño con la elasticidad de su tipología");
    if (!/const zonaM2 = await medianaArriendoZonaM2\(a\.lat, a\.lng, a\.dormitorios \|\| null, false, a\.m2\)/.test(sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts")))) F("2 · la marca del aviso no le pasa sus m² a la zona");
  }

  // ── 3 · la ficha de comparables ──
  {
    const r = resumirComparablesRadio(radio, 35, { modo: "conDorms", factorCierre: 1 })!;
    if (!r?.muestra.ajuste || r.muestra.ajuste.medianaMensual !== 580000 || r.muestra.ajuste.m2Mediano !== 51 || r.muestra.ajuste.elasticidad !== 0.4) F(`3 · la muestra no guarda la mediana mensual y los m² medianos (${JSON.stringify(r?.muestra.ajuste)})`);
    const input = (ajuste: unknown) => ({ arriendo: 429000, zonaRadio: { arriendoPromedio: 429000, sampleSizeArriendo: 6, radioMetros: 750, arriendoFuente: "radio", muestraArriendo: { modo: "conDorms", avisos: r.muestra.avisos, ...(ajuste ? { ajuste } : {}) } } });
    const con = leerMuestraArriendo(input(r.muestra.ajuste)), sin = leerMuestraArriendo(input(null));
    if (!con?.ajuste || con.ajuste.medianaMensual !== 580000 || con.ajuste.elasticidad !== 0.4 || !sin || "ajuste" in sin) F("3 · leer la muestra guardada pierde el ajuste (o se lo inventa a una muestra de antes)");
    const z = sinComentarios(leer("src/components/analysis/zona/ZonaLtr.tsx"));
    if (!/const aj = conDorms && muestra\.ajuste && superficie > 0 \? muestra\.ajuste : null;/.test(z) || !/\{conDorms && aj \? \(/.test(z)
      || !/<FilaDato k="Mediana de sus arriendos" sub=\{`sus m²: \$\{aj\.m2Mediano\.toLocaleString\("es-CL"\)\} de mediana`\} v=\{money\(aj\.medianaMensual\)\} unidad="\/mes" \/>/.test(z)
      || !/<FilaDato k=\{`Llevada a tus \$\{superficie\.toLocaleString\("es-CL"\)\} m²`\} sub="la referencia de la card" v=\{money\(ar\.mediana\)\} unidad="\/mes" tono="in" \/>/.test(z)
      || !/\[percentilOrdenado\(precios, 25\) \* fAj, percentilOrdenado\(precios, 75\) \* fAj\]/.test(z)
      || !/const fAj = aj \? Math\.pow\(superficie \/ aj\.m2Mediano, aj\.elasticidad\) : 1;/.test(z)) F("3 · la ficha de comparables no dice la mediana de los avisos y la llevada a tus m²");
  }

  // ── 4 · la versión ──
  if (SUGERENCIAS_VERSION !== "s3" || !VERSION_EVALUACION.endsWith("+s3")) F(`4 · la versión de las sugerencias no sube a s3 (${SUGERENCIAS_VERSION}, ${VERSION_EVALUACION})`);

  if (fallas.length) {
    console.log(`  ✗ ARRIENDO-TAMAÑO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la mediana mensual del radio y la del segmento se llevan a los m² del depto con la elasticidad de su tipología (1D 0,2 · 2D 0,4 · 3D+ 0,8); la marca compara contra deptos de su tamaño; la ficha cuenta el ajuste con la lista guardada; sugerencias s3");
  }
  return { hard: fallas.length };
}

// ACTA · verificado EN ROJO (scratchpad mutar-congelar.py, restauradas byte a byte)
// 03-oct-2026, con 0,8 fijo: 14/14 (A12 quedó VERDE al principio y se endureció).
// 03-oct-2026, por tipología (1D 0,2 · 2D 0,4 · 3D+ 0,8): 20/20.
//   A1  el 2D con 0,8 ....................................... 1 · 3
//   A2  el radio sin escala ................................. 1
//   A3  la escala con otra cifra que la mediana de m² ....... 1 · 3
//   A4  el segmento sin escala .............................. 1
//   A5  la evaluación no pasa m² ni tipología al segmento ... 1
//   A6  la zona de todos los tamaños ........................ 2
//   A7  la banda de la zona sin llevar al tamaño ............ 2
//   A8  la zona sin mínimo de deptos parecidos .............. 2
//   A9  la marca sin los m² del aviso ....................... 2
//   A10 la muestra sin el ajuste ............................ 3
//   A11 leer la muestra pierde el ajuste .................... 3
//   A12 la ficha sin la mediana llevada ..................... 3
//   A13 la mitad de los avisos sin el factor ................ 3
//   A14 la versión no sube .................................. 4
//   A15 el segmento sin la tipología ........................ 1
//   A16 el radio sin la tipología del depto ................. 1
//   A17 la ficha con 0,8 fijo en vez de la de la muestra .... 3
//   A18 el estudio y el 1D con la del 2D .................... 1
//   A19 4D o más con la del 2D .............................. 1
//   A20 la zona con 0,8 fijo ................................ 2

if (require.main === module) {
  runArriendoTamanoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
