// ============================================================================
// GOLDEN · LA ALTERNATIVA DE COMUNAS — catch-test (11-sep-2026). 0 tokens, sin base.
// ============================================================================
// El dato que responde «¿y entonces a dónde voy?» a las 604 filas del parque que
// caen en el estado sin salida. Es determinista y PURO —el mercado por comuna vive
// en un módulo generado en build time—, así que este tier corre sin credenciales.
//
// Fija SIETE cosas. Las cuatro primeras son sobre la VERDAD del dato; las tres
// últimas, sobre la forma de la línea que lo muestra.
//
//   1. NO SE INVENTA UN UMBRAL. La comuna cruza porque `runAnalysis` —la misma
//      función del informe— deja de decir BUSCAR OTRA ahí. Si alguna vez esto pasa
//      a compararse contra una tasa fija, el dato deja de ser del motor.
//   2. EL PRESUPUESTO ACOTA. Ninguna comuna nombrada cuesta más que el techo.
//   3. EL DEPTO ES EL MISMO. Pie, tasa, plazo y superficie viajan intactos: lo que
//      cambia es el mercado, no el comprador.
//   4. SIN MUESTRA NO HAY COMUNA. Una celda bajo el umbral no se rellena.
//   5. DOS COMUNAS COMO MÁXIMO, las de mayor score.
//   6. LA LÍNEA NO DICE CIFRAS.
//   7. SIN NINGUNA, EL DATO ES VACÍO — y la card no inventa.
//
// Corre dentro del QUICK (tier "alternativa-comunas") y standalone:
//   node --import tsx scripts/eval/golden/alternativa-comunas-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  construirAlternativaComunas,
  deptoEnComuna,
  lineaAlternativaComunas,
  TOPE_PRESUPUESTO,
  MAX_NOMBRADAS,
} from "../../../src/lib/alternativa-comunas";
import { VENTA_POR_COMUNA, ARRIENDO_POR_COMUNA, COMUNA_MERCADO_FECHA } from "../../../src/lib/comuna-mercado.gen";
import type { AnalisisInput } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

const FUENTE = leer("src/lib/alternativa-comunas.ts");
const BLOQUE = leer("src/components/analysis/shared/LoQueHariaYoBloque.tsx");

/** Un caso que NO cierra en su comuna: caro para lo que renta. */
const SUJETO: AnalisisInput = {
  nombre: "caso", comuna: "Las Condes", ciudad: "Santiago", tipo: "departamento",
  dormitorios: 2, banos: 1, superficie: 60, superficieTotal: 60, antiguedad: 5,
  enConstruccion: false, piso: 5, estacionamiento: "no", precioEstacionamiento: 0,
  bodega: false, estadoVenta: "inmediata", cuotasPie: 1, montoCuota: 0,
  precio: 6000, piePct: 20, plazoCredito: 25, tasaInteres: 4.5,
  gastos: 120000, contribuciones: 90000, provisionMantencion: 30000,
  tipoRenta: "larga", arriendo: 700000, arriendoEstacionamiento: 0,
  arriendoBodega: 0, vacanciaMeses: 1,
};
const UF = 40000;
const ASOF = new Date("2026-09-01T12:00:00Z");

// ── 1 · el veredicto lo da el MOTOR, no un umbral inventado ───────────────
{
  if (!/runAnalysis\(/.test(FUENTE)) {
    F("1 · la alternativa dejó de correr `runAnalysis`. El veredicto no sale de un cap rate: sale de las bandas del score y de los tres gates, así que la única forma de saber si un depto convendría en otra comuna es correrlo ahí con la MISMA función del informe.");
  }
  if (!/veredicto === "BUSCAR OTRA"/.test(FUENTE)) {
    F("1 · la alternativa dejó de filtrar por el veredicto del motor");
  }
  // Y NO contra una tasa fija: un número suelto comparado con cap/CoC/TIR es
  // exactamente el instrumento propio que esto vino a evitar.
  const sospechosas = FUENTE.match(/(cap|coc|tir|rentabilidad)\w*\s*[<>]=?\s*\d/gi) ?? [];
  if (sospechosas.length > 0) {
    F(`1 · apareció una comparación contra un umbral fijo: «${sospechosas[0]}». No hay umbral de cap rate en el motor; si se agrega uno acá, la alternativa mide con una regla que el veredicto no usa.`);
  }
}

// ── 2 · el presupuesto acota ──────────────────────────────────────────────
{
  const a = construirAlternativaComunas({ input: SUJETO, ufClp: UF, asOf: ASOF });
  if (a) {
    const techo = SUJETO.precio * TOPE_PRESUPUESTO;
    for (const c of a.todas) {
      if (c.precioUF > techo) {
        F(`2 · «${c.comuna}» entró con el depto a UF ${Math.round(c.precioUF)} contra un techo de UF ${Math.round(techo)}. Una comuna donde el mismo departamento vale más de lo que el comprador iba a pagar no es una alternativa: es otro problema.`);
      }
    }
  }
  if (!/cf\.precio > techo/.test(FUENTE)) F("2 · desapareció el filtro de presupuesto");
  if (!(TOPE_PRESUPUESTO > 1 && TOPE_PRESUPUESTO <= 1.1)) {
    F(`2 · el tope de presupuesto quedó en ${TOPE_PRESUPUESTO}: fuera del margen que se midió (hasta 5% arriba cuesta 7 filas de cobertura; más que eso deja de ser el mismo presupuesto)`);
  }
}

// ── 3 · es el MISMO depto: cambia el mercado, no el comprador ─────────────
{
  const cf = deptoEnComuna(SUJETO, "Macul", UF);
  if (!cf) F("3 · no se pudo construir el contrafactual en Macul, que tiene muestra");
  else {
    const iguales: (keyof AnalisisInput)[] = ["piePct", "tasaInteres", "plazoCredito", "superficie", "dormitorios", "gastos"];
    for (const k of iguales) {
      if (cf[k] !== SUJETO[k]) {
        F(`3 · el contrafactual cambió «${String(k)}» (${String(SUJETO[k])} → ${String(cf[k])}). Pie, tasa, plazo y superficie son del COMPRADOR y viajan intactos: lo que cambia al mudarse de comuna es el mercado.`);
      }
    }
    if (cf.comuna !== "Macul") F("3 · el contrafactual no quedó en la comuna pedida");
    if (cf.precio === SUJETO.precio) F("3 · el precio no cambió: el contrafactual está mirando el mercado del sujeto");
    // Las contribuciones SÍ escalan: son proporcionales al avalúo.
    const esperado = Math.round(SUJETO.contribuciones * (cf.precio / SUJETO.precio));
    if (cf.contribuciones !== esperado) {
      F(`3 · las contribuciones no escalaron con el precio (${cf.contribuciones} ≠ ${esperado}). Dejarlas fijas le regala al depto caro el gasto del barato.`);
    }
  }
}

// ── 4 · sin muestra no hay comuna ─────────────────────────────────────────
{
  // Una tipología que ninguna celda cubre: 4D en una comuna que solo tiene 1-3D.
  const sinCelda = { ...SUJETO, dormitorios: 4, comuna: "Santiago" };
  for (const c of Object.keys(ARRIENDO_POR_COMUNA)) {
    const hay = VENTA_POR_COMUNA[`${c}|4|usado`];
    const cf = deptoEnComuna(sinCelda as AnalisisInput, c, UF);
    if (!hay && cf !== null) {
      F(`4 · «${c}» devolvió un contrafactual de 4D sin celda de venta para esa tipología. Una celda bajo el umbral NO se rellena con la de al lado — es el mismo relleno que la mediana comunal tiene prohibido.`);
      break;
    }
  }
  if (!/if \(!celda \|\| !arr\) return null;/.test(FUENTE)) {
    F("4 · el contrafactual dejó de exigir celda de venta Y de arriendo");
  }
}

// ── 5 · dos comunas como máximo, las de mayor score ───────────────────────
{
  if (MAX_NOMBRADAS !== 2) F(`5 · la línea pasó a nombrar ${MAX_NOMBRADAS} comunas: el contrato dice DOS como máximo`);
  const a = construirAlternativaComunas({ input: SUJETO, ufClp: UF, asOf: ASOF });
  if (a) {
    if (a.nombradas.length > MAX_NOMBRADAS) {
      F(`5 · la línea nombra ${a.nombradas.length} comunas: una lista larga no es una recomendación`);
    }
    // Y son las de mayor score, no las primeras del roster.
    const top = a.todas.slice(0, a.nombradas.length).map((c) => c.comuna);
    if (JSON.stringify(top) !== JSON.stringify(a.nombradas)) {
      F(`5 · las nombradas (${a.nombradas.join(", ")}) no son las de mayor score (${top.join(", ")})`);
    }
    for (let i = 1; i < a.todas.length; i++) {
      if (a.todas[i - 1].score < a.todas[i].score) {
        F("5 · `todas` dejó de venir ordenada por score: el pop-up y la línea leerían órdenes distintos");
        break;
      }
    }
  }
}

// ── 6 · la línea no dice cifras ───────────────────────────────────────────
{
  const casos = [["Ñuñoa"], ["Ñuñoa", "Macul"]];
  for (const nombradas of casos) {
    const linea = lineaAlternativaComunas({ nombradas, todas: [] }) ?? "";
    if (!linea) { F(`6 · la línea salió vacía con ${nombradas.length} comuna(s)`); continue; }
    if (/\d/.test(linea)) {
      F(`6 · la línea trae una cifra: «${linea}». El número es del pop-up: al lado del nombre invita a compararlo con el depto que el lector ya descartó.`);
    }
    for (const c of nombradas) {
      if (!linea.includes(c)) F(`6 · la línea no nombra «${c}»: «${linea}»`);
    }
    if (nombradas.length === 2 && !linea.includes(" o ")) {
      F(`6 · con dos comunas la línea no las separa con «o»: «${linea}»`);
    }
  }
}

// ── 7 · sin ninguna, el dato es vacío y la card no inventa ────────────────
{
  // Un depto tan barato que ninguna comuna entra bajo su presupuesto.
  const imposible: AnalisisInput = { ...SUJETO, precio: 1, superficie: 60 };
  const a = construirAlternativaComunas({ input: imposible, ufClp: UF, asOf: ASOF });
  if (a !== null) {
    F(`7 · con un presupuesto que ninguna comuna alcanza la alternativa devolvió ${a.nombradas.length} comuna(s) en vez de null`);
  }
  if (lineaAlternativaComunas(null) !== null) F("7 · la línea no es null cuando no hay alternativa");
  // Y el render la monta CONDICIONADA: una línea vacía no deja su hueco.
  if (BLOQUE && !/alternativa && /.test(BLOQUE) && !/\{alternativa\?/.test(BLOQUE)) {
    F("7 · la card monta la línea sin condicionarla al dato: con 151 de las 604 filas sin ninguna comuna, ahí quedaría un hueco o una frase a medias.");
  }
}

// ── 8 · el módulo generado está y declara cuándo se hizo ──────────────────
{
  if (!/^\d{4}-\d{2}-\d{2}$/.test(COMUNA_MERCADO_FECHA)) {
    F("8 · el módulo de mercado no declara su fecha de generación: sin eso nadie sabe cuándo regenerarlo");
  }
  const nVentas = Object.keys(VENTA_POR_COMUNA).length;
  const nArr = Object.keys(ARRIENDO_POR_COMUNA).length;
  if (nVentas < 100) F(`8 · el mercado por comuna trae ${nVentas} celdas de venta y se generó con 133: se perdió cobertura`);
  if (nArr < 20) F(`8 · el mercado por comuna trae ${nArr} comunas con arriendo y se generó con 24`);
  for (const [k, v] of Object.entries(VENTA_POR_COMUNA)) {
    if (!(v.n >= 15)) { F(`8 · la celda «${k}» quedó con n=${v.n}, bajo el umbral de la mediana comunal`); break; }
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runAlternativaComunasTier(): { hard: number } {
  console.log("\n─── TIER ALTERNATIVA-COMUNAS (contrato §5 · 0 tokens, sin base) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el veredicto lo da runAnalysis y no un umbral, el presupuesto acota, el depto es el mismo, sin muestra no hay comuna, dos nombradas por score, la línea sin cifras, el vacío devuelve null y el mercado generado declara su fecha");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runAlternativaComunasTier();
  process.exit(hard ? 1 : 0);
}
