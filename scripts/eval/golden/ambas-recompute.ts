// ============================================================================
// GOLDEN SET COMPARATIVO (AMBAS · D1+D2) — RECOMPUTE + BASELINE
// ============================================================================
// Capa 0 tokens: recompute determinístico de los 7 seeds (frozen airbnbRaw) → calcShortTerm
// → `veredictoComparativo`. Congela/compara veredicto + banda + señales (flip, N/D) contra
// ambas-baseline.json. Todo el veredicto es DURO: la banda, el flip y la ruta por absoluto
// son decisiones tipadas — si cambian, el motor cambió de doctrina y debe ser deliberado.
// Los drivers numéricos (break-even %, sobre-renta %) son drift (candidatos a re-baseline).
//
// Uso: node --env-file=.env.local --import tsx scripts/eval/golden/ambas-recompute.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { buildAirbnbData } from "../../../src/lib/api-helpers/analisis-pipeline";
import { AMBAS_SEEDS, loadFrozenAmbas, type FrozenFixtureAmbas } from "./ambas-seeds";

// Reconstrucción de inputs idéntica al tier STR (str-recompute.buildInputs) — producción-fiel.
function buildInputs(d: any, airbnbData: any, uf: number) {
  return { precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: typeof d.comuna === "string" ? d.comuna : undefined, piePercent: d.piePct/100, tasaCredito: d.tasaInteres/100,
    plazoCredito: d.plazoCredito, airbnbData, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador,
    tipoEdificio: d.tipoEdificio, habilitacion: d.habilitacion, adminPro: d.adminPro === true,
    adrOverride: typeof d.adrOverride === "number" ? d.adrOverride : null, occOverride: typeof d.occOverride === "number" ? d.occOverride : null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf };
}

export interface AmbasBaseline {
  recomendacion: string;
  banda: string;
  fragil: boolean;
  porAbsoluto: boolean;
  bePct: number | null;      // breakEvenPctDelMercado × 100 (1 decimal)
  sobrePct: number | null;   // sobreRentaPct × 100 (1 decimal)
  flipCambia: boolean;
  flipAuto: string;
  flipAdmin: string;
}

// Recompute determinístico de UN seed (reusado por el tier de checks y por ambas-accept).
export function recomputeAmbasSeed(key: string, frozen: Record<string, FrozenFixtureAmbas>): any | null {
  const fx = frozen[key];
  if (!fx) return null;
  const airbnbData = buildAirbnbData(fx.airbnbRaw as any, fx.uf);
  // asOf constante fija (determinismo golden). No-op en la aritmética del veredicto.
  const rec = calcShortTerm(buildInputs(fx.input_data, airbnbData, fx.uf) as any, new Date("2026-01-01T00:00:00Z"));
  return rec;
}

const r1 = (x: number | null | undefined): number | null =>
  x == null || !isFinite(x) ? null : Math.round(x * 1000) / 10; // ×100 con 1 decimal

export function ambasFactsFromSeed(rec: any): AmbasBaseline {
  const vc = rec.veredictoComparativo;
  return {
    recomendacion: vc?.recomendacion ?? "?",
    banda: vc?.banda ?? "?",
    fragil: vc?.fragil ?? false,
    porAbsoluto: vc?.porAbsoluto ?? false,
    bePct: r1(vc?.breakEvenPctDelMercado),
    sobrePct: r1(vc?.sobreRentaPct),
    flipCambia: vc?.flipGestion?.cambiaVeredicto ?? false,
    flipAuto: vc?.flipGestion?.recomendacionAuto ?? "?",
    flipAdmin: vc?.flipGestion?.recomendacionAdmin ?? "?",
  };
}

function loadBaseline(): Record<string, AmbasBaseline> | null {
  const p = path.resolve(process.cwd(), "scripts/eval/golden/ambas-baseline.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")).seeds;
}

function near(a: number | null, b: number | null, tol: number): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol + 1e-9;
}

// Veredicto/banda/señales DUROS; break-even% y sobre-renta% → drift (candidatos a re-baseline).
function checkSeed(f: AmbasBaseline, base: AmbasBaseline): { hard: number; drift: number; lines: string[] } {
  const lines: string[] = [];
  let hard = 0, drift = 0;
  const H = (rule: string, pass: boolean, detail: string) => { if (!pass) { hard++; lines.push(`         ✗ ${rule}: ${detail}`); } };
  const N = (rule: string, a: number | null, b: number | null, tol: number) => {
    if (!near(a, b, tol)) { drift++; lines.push(`         ~ ${rule}: ${a} vs ${b}`); }
  };
  H("recomendacion", f.recomendacion === base.recomendacion, `${f.recomendacion} vs ${base.recomendacion}`);
  H("banda", f.banda === base.banda, `${f.banda} vs ${base.banda}`);
  H("fragil", f.fragil === base.fragil, `${f.fragil} vs ${base.fragil}`);
  H("porAbsoluto", f.porAbsoluto === base.porAbsoluto, `${f.porAbsoluto} vs ${base.porAbsoluto}`);
  H("flipCambia", f.flipCambia === base.flipCambia, `${f.flipCambia} vs ${base.flipCambia}`);
  H("flipAuto", f.flipAuto === base.flipAuto, `${f.flipAuto} vs ${base.flipAuto}`);
  H("flipAdmin", f.flipAdmin === base.flipAdmin, `${f.flipAdmin} vs ${base.flipAdmin}`);
  N("bePct", f.bePct, base.bePct, 0.5);
  N("sobrePct", f.sobrePct, base.sobrePct, 0.5);
  return { hard, drift, lines };
}

export function runAmbasTier(): { hard: number; drift: number } {
  const frozen = loadFrozenAmbas();
  const baseline = loadBaseline();
  let hard = 0, drift = 0;
  console.log(`\n─── TIER AMBAS (veredicto comparativo D1+D2${baseline ? " + baseline" : ""}, 0 tokens) ───\n`);

  for (const seed of AMBAS_SEEDS) {
    const rec = recomputeAmbasSeed(seed.key, frozen);
    if (!rec) { console.log(`  ⚠️  ${seed.key}  sin fixture frozen`); hard++; continue; }
    const f = ambasFactsFromSeed(rec);
    let a = { hard: 0, drift: 0, lines: [] as string[] };
    if (baseline && baseline[seed.key]) a = checkSeed(f, baseline[seed.key]);
    else if (baseline) { console.log(`         (sin baseline para ${seed.key})`); }
    hard += a.hard; drift += a.drift;
    const status = a.hard > 0 ? "✗ FAIL" : a.drift > 0 ? "~ DRIFT" : "✓ PASS";
    console.log(`  ${status}  ${seed.key}  ${f.banda} · reco=${f.recomendacion} · be=${f.bePct}% · sobre=${f.sobrePct}% · flip=${f.flipCambia}`);
    for (const l of a.lines) console.log(l);
    if (!baseline) console.log(`         (sin ambas-baseline.json — corré ambas-accept.ts para congelar)`);
  }

  console.log(`\n  ${hard === 0 ? "✓ VERDE — GS-AMBAS sin regresiones de veredicto/banda/flip" : `✗ ${hard} fallas`}${drift ? ` · ${drift} drift (candidatos a re-baseline)` : ""}`);
  return { hard, drift };
}

// Ejecución directa (standalone). El runner lo importa vía runAmbasTier() sin auto-ejecutar.
if (process.argv[1] && /ambas-recompute\.ts$/.test(process.argv[1])) {
  const { hard } = runAmbasTier();
  process.exit(hard === 0 ? 0 : 1);
}
