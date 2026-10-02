// ============================================================================
// GOLDEN · ARRIENDO-TAMAÑO (03-oct-2026) — catch-test
// ============================================================================
//   En Ñuñoa 284 Comprar/Ajustar quedaban con el arriendo sugerido sobre su zona. No eran edificios
//   nuevos ni amoblados: eran deptos chicos (180 bajo 45 m²) que recibían la mediana del arriendo
//   MENSUAL de comparables ~10% más grandes. Decisión de Fabrizio (03-oct-2026):
//   1 · LA ESCALA: la mediana mensual del radio se lleva a los m² del depto con (m² / m² mediano)^0,8
//       —la elasticidad medida dentro de Ñuñoa: 0,58 en 1D, 0,82 en 2D—, y el arriendo del segmento igual.
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
import { ELASTICIDAD_ARRIENDO_M2, escalarPorTamano, referenciaZonaPorTamano, resumirComparablesRadio, type FilaRadio } from "../../../src/lib/services/comparables-radio";
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
    if (ELASTICIDAD_ARRIENDO_M2 !== 0.8) F(`1 · la elasticidad no es 0,8 (${ELASTICIDAD_ARRIENDO_M2})`);
    if (Math.round(escalarPorTamano(580000, 51, [45, 48, 52, 50, 55, 56])) !== 580000 || escalarPorTamano(580000, 0, [50]) !== 580000 || escalarPorTamano(580000, 40, []) !== 580000) F("1 · la escala mueve un depto del tamaño de sus comparables (o uno sin m²)");
    const chico = resumirComparablesRadio(radio, 35, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    const igual = resumirComparablesRadio(radio, 51, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    const grande = resumirComparablesRadio(radio, 60, { modo: "conDorms", factorCierre: 1 })?.arriendo;
    if (chico !== 429000 || igual !== 580000 || grande !== 661000) F(`1 · con dormitorios el radio no lleva la mediana mensual a los m² del depto (35 m² ${chico}, 51 ${igual}, 60 ${grande}; se esperaba 429.000, 580.000 y 661.000)`);
    // Segmento: 12 arriendos de 45 a 56 m² y 12 ventas de 60 a 82 UF/m²; el aviso cae al medio.
    const arriendosSeg = Array.from({ length: 12 }, (_, i) => ({ precio: 480000 + i * 15000, superficie_m2: 45 + i }));
    const ventasSeg = Array.from({ length: 12 }, (_, i) => ({ precio: (60 + i * 2) * 50, superficie_m2: 50 }));
    const seg = (sujetoM2?: number) => arriendoSegmentado(arriendosSeg as never, ventasSeg as never, 71, 39000, sujetoM2);
    const sSin = seg(), s35 = seg(35);
    const m2Tramo = sSin ? 50.5 : NaN; // los 6 del medio: 48 a 53 m²
    if (!sSin || !s35 || Math.abs(s35.monto - sSin.monto * Math.pow(35 / m2Tramo, 0.8)) > 2000 || !(s35.monto < sSin.monto * 0.8)) F(`1 · el arriendo del segmento no se lleva a los m² del depto (sin m² ${sSin?.monto}, 35 m² ${s35?.monto})`);
    const ev = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
    if (!/arriendoSegmentado\(arr\.comparables \?\? \[\], vta\.nearbyProperties \?\? \[\], a\.precioUF \/ a\.m2, uf, a\.m2\)/.test(ev)) F("1 · la evaluación no le pasa los m² del aviso al segmento");
  }

  // ── 2 · la marca contra deptos de tamaño parecido ──
  {
    // Zona: deptos chicos caros por m² y grandes baratos por m².
    const zona = [...[30, 32, 34, 36, 38, 40].map((m) => fila(Math.round(m * 15000), m)), ...[60, 65, 70, 75, 80, 85].map((m) => fila(Math.round(m * 10000), m))];
    const chico = referenciaZonaPorTamano(zona, 35, 5);
    const grande = referenciaZonaPorTamano(zona, 72, 5);
    if (!chico || !grande || Math.abs(chico - 15000) > 600 || Math.abs(grande - 10000) > 600) F(`2 · la referencia de la zona no es la de los deptos de su tamaño (35 m² ${chico}, 72 m² ${grande}; se esperaba ~15.000 y ~10.000 $/m²)`);
    if (referenciaZonaPorTamano(zona, 52, 5) !== null) F("2 · sin 5 deptos de tamaño parecido la referencia no es null (se inventa con otros tamaños)");
    const ms = sinComentarios(leer("src/lib/services/market-suggestions.ts"));
    if (!/if \(superficie && superficie > 0\) return referenciaZonaPorTamano\(limpios, superficie, MIN_ZONA\);/.test(ms)) F("2 · la mediana de la zona no usa la referencia por tamaño");
    if (!/const zonaM2 = await medianaArriendoZonaM2\(a\.lat, a\.lng, a\.dormitorios \|\| null, false, a\.m2\)/.test(sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts")))) F("2 · la marca del aviso no le pasa sus m² a la zona");
  }

  // ── 3 · la ficha de comparables ──
  {
    const r = resumirComparablesRadio(radio, 35, { modo: "conDorms", factorCierre: 1 })!;
    if (!r?.muestra.ajuste || r.muestra.ajuste.medianaMensual !== 580000 || r.muestra.ajuste.m2Mediano !== 51) F(`3 · la muestra no guarda la mediana mensual y los m² medianos (${JSON.stringify(r?.muestra.ajuste)})`);
    const input = (ajuste: unknown) => ({ arriendo: 429000, zonaRadio: { arriendoPromedio: 429000, sampleSizeArriendo: 6, radioMetros: 750, arriendoFuente: "radio", muestraArriendo: { modo: "conDorms", avisos: r.muestra.avisos, ...(ajuste ? { ajuste } : {}) } } });
    const con = leerMuestraArriendo(input(r.muestra.ajuste)), sin = leerMuestraArriendo(input(null));
    if (!con?.ajuste || con.ajuste.medianaMensual !== 580000 || !sin || "ajuste" in sin) F("3 · leer la muestra guardada pierde el ajuste (o se lo inventa a una muestra de antes)");
    const z = sinComentarios(leer("src/components/analysis/zona/ZonaLtr.tsx"));
    if (!/const aj = conDorms && muestra\.ajuste && superficie > 0 \? muestra\.ajuste : null;/.test(z) || !/\{conDorms && aj \? \(/.test(z)
      || !/<FilaDato k="Mediana de sus arriendos" sub=\{`sus m²: \$\{aj\.m2Mediano\.toLocaleString\("es-CL"\)\} de mediana`\} v=\{money\(aj\.medianaMensual\)\} unidad="\/mes" \/>/.test(z)
      || !/<FilaDato k=\{`Llevada a tus \$\{superficie\.toLocaleString\("es-CL"\)\} m²`\} sub="la referencia de la card" v=\{money\(ar\.mediana\)\} unidad="\/mes" tono="in" \/>/.test(z)
      || !/\[percentilOrdenado\(precios, 25\) \* fAj, percentilOrdenado\(precios, 75\) \* fAj\]/.test(z)) F("3 · la ficha de comparables no dice la mediana de los avisos y la llevada a tus m²");
  }

  // ── 4 · la versión ──
  if (SUGERENCIAS_VERSION !== "s3" || !VERSION_EVALUACION.endsWith("+s3")) F(`4 · la versión de las sugerencias no sube a s3 (${SUGERENCIAS_VERSION}, ${VERSION_EVALUACION})`);

  if (fallas.length) {
    console.log(`  ✗ ARRIENDO-TAMAÑO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la mediana mensual del radio y la del segmento se llevan a los m² del depto (elasticidad 0,8); la marca compara contra deptos de su tamaño; la ficha cuenta el ajuste con la lista guardada; sugerencias s3");
  }
  return { hard: fallas.length };
}

// ACTA · verificado EN ROJO
// 03-oct-2026, scratchpad mutar-congelar.py: 14/14 en rojo, restauradas byte a byte. A12 quedó VERDE al
// principio (el tier miraba las filas de la ficha, no la condición que las muestra); se endureció.
//   A1  elasticidad 1 (por m²) ............................ 1 · 3
//   A2  el radio sin escala ............................... 1
//   A3  la escala con otra cifra que la mediana de m² ...... 1 · 3
//   A4  el segmento sin escala ............................ 1
//   A5  la evaluación no le pasa m² al segmento ........... 1
//   A6  la zona de todos los tamaños ...................... 2
//   A7  la banda de la zona sin llevar al tamaño .......... 2
//   A8  la zona sin mínimo de deptos parecidos ............ 2
//   A9  la marca sin los m² del aviso ..................... 2
//   A10 la muestra sin el ajuste .......................... 3
//   A11 leer la muestra pierde el ajuste .................. 3
//   A12 la ficha sin la mediana llevada ................... 3
//   A13 la mitad de los avisos sin el factor .............. 3
//   A14 la versión no sube ................................ 4

if (require.main === module) {
  runArriendoTamanoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
