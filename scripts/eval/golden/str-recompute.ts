// ============================================================================
// GOLDEN SET STR (E.1b) — RECOMPUTE + INVARIANTES BS1-BS8 + BASELINE CLASE (a)
// ============================================================================
// Capa 1 (0 tokens): recompute determinístico de los 6 GE (frozen airbnbRaw) + 3 BE
// (razor-edge a nivel de builder). Corre calcShortTerm → calcFrancoScoreSTR →
// buildStrHallazgos y verifica los invariantes estructurales BS1-BS8 (of-e1a §Fase 5).
//
// F0.5 (rama motor-supuestos): AHORA sí tiene baseline exacto (clase a) — str-baseline.json,
// la PRE-FOTO de los números que el cambio de semántica del multiplicador (F2) va a mover.
// checkClassAStr compara el recompute vs esa pre-foto: veredicto/N duros; las cifras
// (tirPct, multiplicadorCapital, equityCLP, valorVenta, capitalInvertido, patrimonio)
// son drift → candidatas a re-baseline (no bloquean), igual que el tier LTR.
// Uso: node --env-file=.env.local --import tsx scripts/eval/golden/str-recompute.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos } from "../../../src/lib/str-hallazgos";
import type { Hallazgo } from "../../../src/lib/types";
import { STR_GE_SEEDS, loadFrozen, type FrozenFixture, type Sintesis, type StrGeSeed } from "./str-seeds";
import { buildHallazgoRentabilidadStr } from "../../../src/lib/rentabilidad-str-hallazgo";
import { buildHallazgoSensibilidadStr } from "../../../src/lib/sensibilidad-str-hallazgo";
import { buildHallazgoEstructuraCostosStr } from "../../../src/lib/estructura-costos-str-hallazgo";
// La MISMA transformación raw→airbnbData que producción (sin réplica que pueda driftar).
import { buildAirbnbData } from "../../../src/lib/api-helpers/analisis-pipeline";
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

// Aplica la síntesis del caso (GE-3 reg=no; GE-5 occ-strip) sobre el frozen.
function synth(fx: FrozenFixture, s: Sintesis): { d: any; raw: any; reg: string } {
  const d = { ...fx.input_data };
  let raw = fx.airbnbRaw;
  let reg = d.edificioPermiteAirbnb || "no_seguro";
  if (s === "reg_no") reg = "no";
  if (s === "occ_strip") {
    // Quita toda señal de ocupación → resolveOccObservada cae a fallback 0,45.
    raw = { ...fx.airbnbRaw, estimated_occupancy: 0, percentiles: { ...fx.airbnbRaw.percentiles, occupancy: { p25: 0, p50: 0, p75: 0, p90: 0, avg: 0 } } };
  }
  return { d, raw, reg };
}

interface Check { rule: string; pass: boolean; detail: string }
const decisivos = new Set(["rentabilidad_str", "flujo_str", "ocupacion_vs_banda", "ventaja_vs_ltr"]);

function invariantes(hz: Hallazgo[], score: any, rec: any, medianaConfiable: boolean): Check[] {
  const out: Check[] = [];
  const byId = (id: string) => hz.find((h) => h.id === id) as any;

  // BS1 — KPI == body (mismo número redondeado) en los builders numéricos.
  const r = byId("rentabilidad_str");
  if (r) { const kpi = (Math.round(r.valor.capRatePct*10)/10).toFixed(1).replace(".", ","); out.push({ rule: "BS1.rentabilidad", pass: r.fraseCanonica.includes(kpi + "%"), detail: `frase incluye ${kpi}%` }); }
  const cs = byId("estructura_costos_str");
  if (cs) out.push({ rule: "BS1.costos", pass: cs.fraseCanonica.includes(String(cs.valor.costStackPct)), detail: `frase incluye ${cs.valor.costStackPct}` });

  // BS2 — dirección coherente con valor y corte.
  const dir = (id: string, adverso: boolean, why: string) => { const h = byId(id); if (h) out.push({ rule: `BS2.${id}`, pass: (h.direccion !== "favorable") === adverso, detail: `${h.direccion} — ${why}` }); };
  if (r) dir("rentabilidad_str", r.valor.capRatePct < r.valor.umbralPct, `cap=${r.valor.capRatePct} umbral=${r.valor.umbralPct}`);
  const fl = byId("flujo_str"); if (fl) dir("flujo_str", fl.valor.flujoMensualCLP < 0, `flujo=${fl.valor.flujoMensualCLP}`);
  const se = byId("sensibilidad_str"); if (se) dir("sensibilidad_str", se.valor.beRatioPct > se.valor.corteFragil, `be=${se.valor.beRatioPct} frágil=${se.valor.corteFragil}`);
  if (cs) dir("estructura_costos_str", cs.valor.costStackPct > cs.valor.bandaAdvPct, `cs=${cs.valor.costStackPct} banda=${cs.valor.bandaAdvPct}`);

  // BS3 — decisividad>0 SOLO en los 4 dim-outcomes.
  let bs3 = true;
  for (const h of hz) { const dec = decisivos.has(h.id); if ((dec && h.decisividad <= 0) || (!dec && h.decisividad !== 0)) bs3 = false; }
  out.push({ rule: "BS3.decisividad", pass: bs3, detail: bs3 ? "solo los 4 con dec>0" : "violación decisividad/solo-lectura" });

  // BS4 — omisiones.
  const has = (id: string) => hz.some((h) => h.id === id);
  out.push({ rule: "BS4.tir⟺exit", pass: has("tir") === !!rec.exitScenario, detail: `tir=${has("tir")} exit=${!!rec.exitScenario}` });
  out.push({ rule: "BS4.patrimonio⟺exit", pass: has("patrimonio") === !!rec.exitScenario, detail: `patr=${has("patrimonio")}` });
  out.push({ rule: "BS4.sobreprecio⟺mediana", pass: has("sobreprecio") === medianaConfiable, detail: `sob=${has("sobreprecio")} conf=${medianaConfiable}` });

  // BS5 — ventaja LTR-negativo ⇒ KPI en CLP ($), sin % de ventaja en la frase.
  const ve = byId("ventaja_vs_ltr");
  if (ve && ve.valor.ltrNegativo) out.push({ rule: "BS5.ventaja-CLP", pass: ve.fraseCanonica.includes("$") && ve.fraseCanonica.includes("porcentaje no dice"), detail: "frase usa CLP y declina el %" });

  // BS6 — ocupación fallback ⇒ confianza baja, frase declara supuesto, cero "ramp-up".
  const oc = byId("ocupacion_vs_banda");
  if (oc && oc.valor.esFallback) out.push({ rule: "BS6.fallback", pass: oc.procedencia.confianza === "baja" && !/ramp-?up/i.test(oc.fraseCanonica) && /no hay datos/i.test(oc.fraseCanonica), detail: `conf=${oc.procedencia.confianza}` });

  // BS7 — N∈[7,12]; corona no "Lo más decisivo" si maxDecisividad≈0.
  out.push({ rule: "BS7.N∈[7,12]", pass: hz.length >= 7 && hz.length <= 12, detail: `N=${hz.length}` });

  // BS8 — "revenue" prohibido en output (frases + procedencia).
  const revLeak = hz.some((h) => /revenue/i.test(h.fraseCanonica) || /revenue/i.test(h.procedencia.base));
  out.push({ rule: "BS8.no-revenue", pass: !revLeak, detail: revLeak ? "fuga de 'revenue'" : "sin 'revenue'" });

  return out;
}

// ── Baseline numérico STR (clase a) ─────────────────────────────────────────
// Congela por seed GS-STR los números del exit + card. Historia:
//   · F0.5 (commit ec78e5f): pre-foto en semántica GANANCIA (STR restaba capitalInicial).
//   · F2 (re-baseline): post-foto en semántica EQUITY (ya NO resta capital). Vs la pre-foto,
//     el patrimonio subió +capital y el multiplicador +1 (flip verificado exacto).
// checkClassAStr compara el recompute vigente contra esta baseline: veredicto/N duros, cifras drift.
export interface StrBaseline {
  veredicto: string;
  score: number;
  N: number;
  tirPct: number | null;
  multiplicadorCapital: number | null;  // exit.multiplicadorCapital (EQUITY desde F2; ganancia en F0.5)
  equityCLP: number | null;             // exit.equityCLP (= equity al vender)
  valorVenta: number | null;            // exit.valorVenta
  capitalInvertido: number | null;      // result.capitalInvertido (= aportado de la card)
  patrimonioCLP: number | null;         // hallazgo patrimonio valor.patrimonioCLP (= exit.equityCLP)
  patrimonioMult: number | null;        // hallazgo patrimonio valor.multiplicador (card; redondeado 2 dec)
}

export interface StrRecompute { rec: any; score: any; hz: Hallazgo[]; mediana: { mediana: number; n: number } }

// Recompute determinístico de UN seed GE (reusado por el tier de checks y por str-accept).
export function recomputeStrSeed(seed: StrGeSeed, frozen: Record<string, FrozenFixture>): StrRecompute | null {
  const fx = frozen[seed.key];
  if (!fx) return null;
  const { d, raw, reg } = synth(fx, seed.sintesis);
  const airbnbData = buildAirbnbData(raw as any, fx.uf);
  const rec = calcShortTerm(buildInputs(d, airbnbData, fx.uf) as any);
  const score = calcFrancoScoreSTR({ results: rec, precioCompra: d.precioCompra, dormitorios: d.dormitorios,
    superficie: d.superficieUtil, regulacionEdificio: reg, lat: d.lat ?? -33.4378, lng: d.lng ?? -70.6504,
    revenueP50: airbnbData.percentiles.revenue.p50, monthlyRevenue: airbnbData.monthly_revenue } as any);
  // mediana fake confiable para ejercitar sobreprecio: comuna típica.
  const mediana = { mediana: 3200, n: 12 };
  const hz = [...(rec.hallazgos ?? []), ...buildStrHallazgos({ result: rec, francoScore: score, comuna: d.comuna || "",
    precioUF: d.precioCompraUF, superficieM2: d.superficieUtil, piePct: d.piePct, tasaPct: d.tasaInteres,
    plazoAnios: d.plazoCredito, mediana, valorUF: fx.uf, incluyeCorretaje: false })];
  return { rec, score, hz, mediana };
}

// Extrae los HECHOS numéricos STR de un recompute (para congelar o comparar).
export function strFactsFromSeed(r: StrRecompute): StrBaseline {
  const exit = r.rec.exitScenario;
  const patr = r.hz.find((h) => h.id === "patrimonio") as any;
  return {
    veredicto: r.score.veredicto,
    score: r.score.score,
    N: r.hz.length,
    tirPct: exit?.tirAnual ?? null,
    multiplicadorCapital: exit?.multiplicadorCapital ?? null,
    equityCLP: exit?.equityCLP ?? null,
    valorVenta: exit?.valorVenta ?? null,
    capitalInvertido: r.rec.capitalInvertido ?? null,
    patrimonioCLP: patr?.valor?.patrimonioCLP ?? null,
    patrimonioMult: patr?.valor?.multiplicador ?? null,
  };
}

function loadStrBaseline(): Record<string, StrBaseline> | null {
  const p = path.resolve(process.cwd(), "scripts/eval/golden/str-baseline.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")).seeds;
}

function nearStr(a: number | null, b: number | null, tol: number): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol + 1e-9;
}

// Clase (a) STR vs pre-foto: veredicto/N duros; cifras → drift (candidato re-baseline).
function checkClassAStr(f: StrBaseline, base: StrBaseline): { hard: number; drift: number; lines: string[] } {
  const lines: string[] = [];
  let hard = 0, drift = 0;
  const hardChk = (rule: string, pass: boolean, detail: string) => { if (!pass) { hard++; lines.push(`         ✗ ${rule}: ${detail}`); } };
  const numChk = (rule: string, a: number | null, b: number | null, tol: number) => {
    if (!nearStr(a, b, tol)) { drift++; lines.push(`         ~ ${rule}: ${a} vs ${b}`); }
  };
  hardChk("aStr.veredicto", f.veredicto === base.veredicto, `${f.veredicto} vs ${base.veredicto}`);
  hardChk("aStr.N", f.N === base.N, `N=${f.N} vs ${base.N}`);
  numChk("aStr.score", f.score, base.score, 0);
  numChk("aStr.tirPct", f.tirPct, base.tirPct, 0.1);
  numChk("aStr.multiplicadorCapital", f.multiplicadorCapital, base.multiplicadorCapital, 0.02);
  numChk("aStr.equityCLP", f.equityCLP, base.equityCLP, 1);
  numChk("aStr.valorVenta", f.valorVenta, base.valorVenta, 1);
  numChk("aStr.capitalInvertido", f.capitalInvertido, base.capitalInvertido, 1);
  numChk("aStr.patrimonioCLP", f.patrimonioCLP, base.patrimonioCLP, 1);
  numChk("aStr.patrimonioMult", f.patrimonioMult, base.patrimonioMult, 0.02);
  return { hard, drift, lines };
}

export function runStrTier(): { hard: number; drift: number } {
  const frozen = loadFrozen();
  const baseline = loadStrBaseline();
  let hard = 0, drift = 0;
  console.log(`\n─── TIER STR (recompute BS1-BS8${baseline ? " + baseline clase a" : ""}, 0 tokens) ───\n`);

  for (const seed of STR_GE_SEEDS) {
    const r = recomputeStrSeed(seed, frozen);
    if (!r) { console.log(`  ⚠️  ${seed.key}  sin fixture frozen`); hard++; continue; }
    const bad = invariantes(r.hz, r.score, r.rec, r.mediana.mediana != null).filter((c) => !c.pass);
    let a = { hard: 0, drift: 0, lines: [] as string[] };
    if (baseline && baseline[seed.key]) a = checkClassAStr(strFactsFromSeed(r), baseline[seed.key]);
    const seedHard = bad.length + a.hard;
    hard += seedHard; drift += a.drift;
    const status = seedHard > 0 ? "✗ FAIL" : a.drift > 0 ? "~ DRIFT" : "✓ PASS";
    console.log(`  ${status}  ${seed.key}  ${r.score.veredicto} · N=${r.hz.length} · ${seed.label}`);
    for (const b of bad) console.log(`         ✗ ${b.rule}: ${b.detail}`);
    for (const l of a.lines) console.log(l);
    if (!baseline) console.log(`         (sin str-baseline.json — corré str-accept.ts para congelar la pre-foto)`);
  }

  // ── BE razor-edges (frontera exacta a nivel de builder) ──
  console.log("\n  ── razor-edges (builder) ──");
  const be = (key: string, cond: boolean, detail: string) => { const ok = cond; if (!ok) hard++; console.log(`  ${ok ? "✓" : "✗"}  ${key}: ${detail}`); };
  const rFav = buildHallazgoRentabilidadStr({ capRatePct: 5.0, decisividad: 0.5, modalidad: "str" })!;
  const rAdv = buildHallazgoRentabilidadStr({ capRatePct: 4.9, decisividad: 0.5, modalidad: "str" })!;
  be("BE-caprate-str", rFav.direccion === "favorable" && rAdv.direccion === "adverso", `5,0→${rFav.direccion} · 4,9→${rAdv.direccion}`);
  const sFav = buildHallazgoSensibilidadStr({ breakEvenPctDelMercado: 1.10, modalidad: "str" })!;
  const sAdv = buildHallazgoSensibilidadStr({ breakEvenPctDelMercado: 1.11, modalidad: "str" })!;
  be("BE-sensibilidad-str", sFav.direccion === "favorable" && sAdv.direccion === "adverso", `110→${sFav.direccion} · 111→${sAdv.direccion}`);
  const cFav = buildHallazgoEstructuraCostosStr({ costStackPct: 0.40, modalidad: "str" })!;
  const cAdv = buildHallazgoEstructuraCostosStr({ costStackPct: 0.41, modalidad: "str" })!;
  be("BE-costos-str", cFav.direccion === "favorable" && cAdv.direccion === "adverso", `40→${cFav.direccion} · 41→${cAdv.direccion}`);

  console.log(`\n  ${hard === 0 ? `✓ VERDE — GS-STR sin violaciones (BS1-BS8${baseline ? " + baseline clase a" : ""})` : `✗ ${hard} fallas`}${drift ? ` · ${drift} drift clase (a) (candidatos a re-baseline)` : ""}`);
  return { hard, drift };
}

// Ejecución directa (standalone). El runner lo importa vía runStrTier() sin auto-ejecutar.
if (process.argv[1] && /str-recompute\.ts$/.test(process.argv[1])) {
  const { hard } = runStrTier();
  process.exit(hard === 0 ? 0 : 1);
}
