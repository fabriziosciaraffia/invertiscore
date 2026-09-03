/**
 * Deriva los factores por tipología del estimador comunal de arriendo y los
 * escribe en `src/lib/factores-tipologia-arriendo.gen.ts` con su procedencia.
 *
 *   node --env-file=.env.local --import tsx scripts/data/derivar-factores-tipologia-arriendo.ts [--dry] [--check]
 *
 * --dry    calcula e imprime; no escribe.
 * --check  re-deriva y compara contra el módulo vigente: sale con 1 si algún
 *          factor se movió más de TOLERANCIA_FACTOR_PTS puntos (×100). Es el
 *          test que avisa que el mercado, o el scraping, dejaron vieja la
 *          calibración. No escribe.
 *
 * MÉTODO. Sobre las comunas del roster, con los MISMOS filtros que comunas-seo
 * (activo, precio > 0, superficie útil, 1 a 4 dormitorios), para cada tipología
 * con ≥ MIN_ARRIENDOS_TIPOLOGIA arriendos y ≥ MIN_PER_TYPE ventas:
 *
 *   crudo = UF/m²/mes comunal (todas las tipologías) × sup. mediana de VENTA × UF
 *   ratio = mediana real de arriendo de la tipología / crudo
 *
 * El factor de la tipología es la MEDIANA de esos ratios entre comunas. El error
 * residual es el percentil 75 de |factor × crudo / real − 1|: tres de cada
 * cuatro tipologías con muestra caen dentro de ese ± del estimado corregido.
 * Una tipología con menos de MIN_FILAS_FACTOR filas no calibra sola (el 4D
 * tiene dos): hereda el factor de la vecina más cercana con filas y su residual
 * es el mayor entre el propio y el de esa vecina.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import {
  MIN_PER_TYPE,
  dormsEnRango,
  fetchAllRows,
  normalizeComunaName,
  superficieUtil,
  type RawRow,
} from "@/lib/data/comunas-seo";
import { median } from "@/lib/comuna-stats";
import {
  MIN_ARRIENDOS_TIPOLOGIA,
  MIN_FILAS_FACTOR,
  TOLERANCIA_FACTOR_PTS,
  medianaArriendoUFm2Mes,
} from "@/lib/referencia-arriendo";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const CHECK = args.includes("--check");
const PERCENTIL_ERROR = 75;
const DORMS = [1, 2, 3, 4] as const;
type Dorms = (typeof DORMS)[number];

const SALIDA = join(__dirname, "../../src/lib/factores-tipologia-arriendo.gen.ts");

function percentil(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

interface Fila {
  comuna: string;
  dorms: Dorms;
  nArr: number;
  nVen: number;
  real: number;
  crudo: number;
}

interface FactorDerivado {
  factor: number;
  errorResidualPct: number;
  n: number;
  heredadoDe: Dorms | null;
}

async function derivar(): Promise<{ filas: Fila[]; factores: Record<Dorms, FactorDerivado>; comunas: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: cfg } = await supabase.from("config").select("value").eq("key", "uf_value").single();
  const rawUF = parseFloat(cfg?.value || "0");
  const ufCLP = rawUF > 30000 && rawUF < 50000 ? rawUF : 38800;

  const roster = new Set<string>(COMUNAS_ROSTER.map((c) => c.nombre));
  const entra = (r: RawRow) => roster.has(r.comuna) && superficieUtil(r) && dormsEnRango(r);

  const arr = (await fetchAllRows(supabase, "arriendo")).map((r) => ({ ...r, comuna: normalizeComunaName(r.comuna) })).filter(entra);
  const ven = (await fetchAllRows(supabase, "venta")).map((r) => ({ ...r, comuna: normalizeComunaName(r.comuna) })).filter(entra);

  const filas: Fila[] = [];
  for (const comuna of Array.from(roster)) {
    const arrC = arr.filter((r) => r.comuna === comuna);
    const venC = ven.filter((r) => r.comuna === comuna);
    const ufM2Com = medianaArriendoUFm2Mes(arrC, ufCLP);
    if (!(ufM2Com > 0)) continue;
    for (const d of DORMS) {
      const arrT = arrC.filter((r) => r.dormitorios === d);
      const venT = venC.filter((r) => r.dormitorios === d);
      if (arrT.length < MIN_ARRIENDOS_TIPOLOGIA || venT.length < MIN_PER_TYPE) continue;
      const real = median(arrT.map((r) => r.precio));
      const supVen = median(venT.map((r) => r.superficie_m2));
      const crudo = ufM2Com * supVen * ufCLP;
      if (!(real > 0) || !(crudo > 0)) continue;
      filas.push({ comuna, dorms: d, nArr: arrT.length, nVen: venT.length, real, crudo });
    }
  }

  const porDorms = (d: Dorms) => filas.filter((f) => f.dorms === d);
  const factores = {} as Record<Dorms, FactorDerivado>;
  // Primera pasada: las tipologías con filas suficientes calibran solas.
  for (const d of DORMS) {
    const fs = porDorms(d);
    if (fs.length >= MIN_FILAS_FACTOR) {
      factores[d] = { factor: median(fs.map((f) => f.real / f.crudo)), errorResidualPct: 0, n: fs.length, heredadoDe: null };
    }
  }
  // Segunda pasada: las que no, heredan de la vecina más cercana que sí calibró.
  for (const d of DORMS) {
    if (factores[d]) continue;
    const vecina = DORMS
      .filter((v) => factores[v] && factores[v].heredadoDe === null)
      .sort((a, b) => Math.abs(a - d) - Math.abs(b - d) || b - a)[0];
    if (!vecina) throw new Error(`ninguna tipología calibra: ${filas.length} filas`);
    factores[d] = { factor: factores[vecina].factor, errorResidualPct: 0, n: porDorms(d).length, heredadoDe: vecina };
  }
  // Residual contra el factor vigente de cada tipología (propio o heredado).
  const residual = (d: Dorms) =>
    percentil(porDorms(d).map((f) => Math.abs((factores[d].factor * f.crudo) / f.real - 1) * 100), PERCENTIL_ERROR);
  for (const d of DORMS) {
    // Una tipología heredada no puede prometer un rango más angosto que el de
    // la vecina que la calibra: con dos filas, un p75 de ±7% es azar, no medida.
    const propio = residual(d);
    const h = factores[d].heredadoDe;
    const piso = h ? residual(h) : 0;
    factores[d].errorResidualPct = Math.round(Math.max(propio, piso) * 10) / 10;
  }
  for (const d of DORMS) factores[d].factor = Math.round(factores[d].factor * 1000) / 1000;

  const comunas = new Set(filas.map((f) => f.comuna)).size;
  return { filas, factores, comunas };
}

function render(factores: Record<Dorms, FactorDerivado>, filas: number, comunas: number): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const lineas = DORMS.map((d) => {
    const f = factores[d];
    return `  ${d}: { factor: ${f.factor.toFixed(3)}, errorResidualPct: ${f.errorResidualPct.toFixed(1)}, n: ${f.n}, heredadoDe: ${f.heredadoDe ?? "null"} },`;
  }).join("\n");
  return [
    "// GENERADO — no editar a mano. Regenerar con:",
    "//   node --env-file=.env.local --import tsx scripts/data/derivar-factores-tipologia-arriendo.ts",
    "// Verificar vigencia (falla si un factor se movió > TOLERANCIA_FACTOR_PTS):",
    "//   node --env-file=.env.local --import tsx scripts/data/derivar-factores-tipologia-arriendo.ts --check",
    "//",
    "// Factores por tipología del estimador comunal de arriendo (ver",
    "// `referencia-arriendo.ts`, fuente 'comunalPorM2'). El UF/m²/mes comunal lo",
    "// domina el 1D, que renta más por metro; sin factor, el estimado de un 3D o",
    "// un 4D sale inflado de forma sistemática. `factor` centra el estimado y",
    "// `errorResidualPct` es el ancho del rango que se publica con él.",
    "",
    "export type DormsTipologia = 1 | 2 | 3 | 4;",
    "",
    "export interface FactorTipologiaArriendo {",
    "  /** Multiplica al estimado crudo (UF/m² comunal × sup. mediana de venta × UF). */",
    "  factor: number;",
    `  /** Percentil ${PERCENTIL_ERROR} de |estimado corregido / real − 1| entre las tipologías con muestra, %. */`,
    "  errorResidualPct: number;",
    "  /** Tipologías (comuna × dorms) con muestra que respaldan el factor. */",
    "  n: number;",
    "  /** Si no hubo filas suficientes para calibrar sola, de qué tipología heredó el factor. */",
    "  heredadoDe: DormsTipologia | null;",
    "}",
    "",
    "export const FACTORES_TIPOLOGIA_ARRIENDO: Record<DormsTipologia, FactorTipologiaArriendo> = {",
    lineas,
    "};",
    "",
    "/** De dónde salen los factores. Cambia en cada re-derivación. */",
    "export const PROCEDENCIA_FACTORES_TIPOLOGIA = {",
    `  fecha: "${hoy}",`,
    "  metodo: \"mediana entre comunas del roster de (mediana real de arriendo de la tipología) / (UF/m²/mes comunal × sup. mediana de venta × UF)\",",
    `  filas: ${filas},`,
    `  comunas: ${comunas},`,
    `  minArriendosTipologia: ${MIN_ARRIENDOS_TIPOLOGIA},`,
    `  minVentasTipologia: ${MIN_PER_TYPE},`,
    `  percentilError: ${PERCENTIL_ERROR},`,
    "} as const;",
    "",
  ].join("\n");
}

async function main() {
  const { filas, factores, comunas } = await derivar();
  console.log(`filas de calibración: ${filas.length} (${comunas} comunas)`);
  for (const d of DORMS) {
    const fs = filas.filter((f) => f.dorms === d);
    const crudoMed = median(fs.map((f) => (f.crudo / f.real - 1) * 100));
    const f = factores[d];
    console.log(
      `  ${d}D · n=${f.n} · error crudo mediano ${crudoMed >= 0 ? "+" : ""}${crudoMed.toFixed(1)}% · factor ${f.factor.toFixed(3)}${f.heredadoDe ? ` (heredado del ${f.heredadoDe}D)` : ""} · residual p${PERCENTIL_ERROR} ±${f.errorResidualPct.toFixed(1)}%`,
    );
  }

  if (CHECK) {
    const vigente = await import("@/lib/factores-tipologia-arriendo.gen");
    let fallas = 0;
    console.log(`\n--check contra el módulo vigente (${vigente.PROCEDENCIA_FACTORES_TIPOLOGIA.fecha || "placeholder"}), tolerancia ${TOLERANCIA_FACTOR_PTS} pts:`);
    for (const d of DORMS) {
      const v = vigente.FACTORES_TIPOLOGIA_ARRIENDO[d];
      const deltaPts = Math.abs(factores[d].factor - v.factor) * 100;
      const ok = deltaPts <= TOLERANCIA_FACTOR_PTS;
      if (!ok) fallas++;
      console.log(`  ${ok ? "OK  " : "FAIL"} ${d}D: vigente ${v.factor.toFixed(3)} → re-derivado ${factores[d].factor.toFixed(3)} (Δ ${deltaPts.toFixed(1)} pts) · residual ${v.errorResidualPct.toFixed(1)} → ${factores[d].errorResidualPct.toFixed(1)}`);
    }
    if (fallas) {
      console.log(`\n${fallas} factor(es) fuera de tolerancia: re-derivar y revisar el rango publicado.`);
      process.exit(1);
    }
    console.log("\ncalibración vigente.");
    return;
  }

  const contenido = render(factores, filas.length, comunas);
  if (DRY) {
    console.log("\n--dry: no se escribe. Módulo resultante:\n");
    console.log(contenido);
    return;
  }
  writeFileSync(SALIDA, contenido, "utf8");
  console.log(`\nescrito ${SALIDA}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
