// regen-corpus-str-sweep.ts — regen-corpus-str · F3 · SWEEP DE INVARIANTE (READ-ONLY).
// Verifica el corpus STR regenerado: 46/46 con factorADR=1 · veredicto canónico · N∈[7,12]
// (con distribución de N y CAUSA de cada omisión) · 0 "revenue" en prosa · 0 eco de uplift.
//
//   --persisted (default): lee results.hallazgos + ai_analysis PERSISTIDOS (post --go).
//   --recompute          : recomputa en memoria desde airbnbRaw (pre --go, para cuantificar).
//
// Uso: node --env-file=.env.local --import tsx scripts/regen-corpus-str-sweep.ts [--recompute]
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { calcShortTerm } from "../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../src/lib/engines/short-term-score";
import { buildStrHallazgos } from "../src/lib/str-hallazgos";
import { buildAirbnbData } from "../src/lib/api-helpers/analisis-pipeline";
import { getComunaMedianaVentaUF } from "../src/lib/comuna-stats";
config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CANONICOS = new Set(["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]);
const REVENUE_RE = /\brevenue\b/i;
const UPLIFT_ECO_RE = /\buplift\b|factor\s*adr|adr\s+ajustad|adr\s+del\s+motor/i;
function collectStrings(node: any, out: string[]) { if (typeof node === "string") { out.push(node); return; } if (Array.isArray(node)) { for (const n of node) collectStrings(n, out); return; } if (node && typeof node === "object") for (const v of Object.values(node)) collectStrings(v, out); }

function buildInputs(d: any, airbnbData: any, uf: number) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: typeof d.comuna === "string" ? d.comuna : undefined, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100,
    plazoCredito: d.plazoCredito, airbnbData, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador,
    tipoEdificio: d.tipoEdificio, habilitacion: d.habilitacion, adminPro: d.adminPro === true,
    adrOverride: typeof d.adrOverride === "number" ? d.adrOverride : null, occOverride: typeof d.occOverride === "number" ? d.occOverride : null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf,
  };
}

// Universo canónico de la pirámide STR (12) — para nombrar qué falta cuando N<12.
const UNIVERSO = [
  "capex_puesta_a_punto", "rentabilidad_str", "flujo_str", "ocupacion_vs_banda", "ventaja_vs_ltr",
  "sensibilidad_str", "estructura_costos_str", "estructura_financiamiento", "sobreprecio", "plusvalia", "tir", "patrimonio",
];
function causaOmision(id: string, exit: boolean, medianaConf: boolean): string {
  if (id === "sobreprecio") return medianaConf ? "?" : "mediana comunal no confiable (n=0)";
  if (id === "tir" || id === "patrimonio") return exit ? "?" : "sin exitScenario";
  if (id === "capex_puesta_a_punto") return "capex no aplicable (sin puesta a punto)";
  return "?";
}

async function main() {
  const recompute = process.argv.includes("--recompute");
  const { data: rows, error } = await sb.from("analisis")
    .select("id, comuna, input_data, results, ai_analysis").eq("tipo_analisis", "short-term").order("created_at", { ascending: true }).range(0, 999);
  if (error) { console.error(error); process.exit(1); }
  // Mismas exclusiones que el regen (⛔#2): 8e006a98 sin insumos + 4ea0b582 (LTR $0) + c53331bf (occOverride).
  const EXCLUDE_PREFIXES = ["4ea0b582", "c53331bf"];
  const recomputables = (rows ?? []).filter((r) => {
    const d = r.input_data as any, res = r.results as any;
    return d?.precioCompra && d?.precioCompraUF && res?.airbnbRaw && !EXCLUDE_PREFIXES.some((p) => r.id.startsWith(p));
  });
  console.log(`\n=== SWEEP POST-REGEN (${recompute ? "RECOMPUTE en memoria" : "PERSISTIDO en DB"}) · ${recomputables.length} filas del batch (46 − 2 exclusiones ⛔#2) ===\n`);

  const nDist: Record<number, number> = {};
  const causas: Record<string, number> = {};
  let violFactor = 0, violVer = 0, violN = 0, revLeaks = 0, ecoLeaks = 0;
  const detalleFallas: any[] = [];

  for (const r of recomputables) {
    const d = r.input_data as any;
    const oldResults = r.results as any;
    let hallazgos: any[], veredicto: string, factorADR: number | undefined, exit: boolean, medianaConf: boolean, ai: any;

    if (recompute) {
      const uf = d.precioCompra / d.precioCompraUF;
      const airbnbData = buildAirbnbData(oldResults.airbnbRaw, uf);
      const rec = calcShortTerm(buildInputs(d, airbnbData, uf) as any);
      const score = calcFrancoScoreSTR({ results: rec, precioCompra: d.precioCompra, dormitorios: d.dormitorios, superficie: d.superficieUtil,
        regulacionEdificio: d.edificioPermiteAirbnb || "no_seguro", lat: typeof d.lat === "number" ? d.lat : -33.4378, lng: typeof d.lng === "number" ? d.lng : -70.6504,
        revenueP50: airbnbData.percentiles.revenue.p50, monthlyRevenue: airbnbData.monthly_revenue } as any);
      let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
      try { mediana = await getComunaMedianaVentaUF(sb, r.comuna as string, d.superficieUtil, d.dormitorios ?? null, uf); } catch { /* null */ }
      const str = buildStrHallazgos({ result: rec, francoScore: score, comuna: (r.comuna as string) || "", precioUF: d.precioCompraUF, superficieM2: d.superficieUtil,
        piePct: d.piePct, tasaPct: d.tasaInteres, plazoAnios: d.plazoCredito, mediana, valorUF: uf, incluyeCorretaje: false });
      hallazgos = [...(rec.hallazgos ?? []), ...str];
      veredicto = score.veredicto; factorADR = rec.ejesAplicados?.factorADRTotal; exit = !!rec.exitScenario;
      medianaConf = mediana.mediana != null && mediana.n > 0; ai = r.ai_analysis;
    } else {
      hallazgos = Array.isArray(oldResults.hallazgos) ? oldResults.hallazgos : [];
      veredicto = oldResults?.francoScore?.veredicto ?? oldResults?.veredicto ?? "(null)";
      factorADR = oldResults?.ejesAplicados?.factorADRTotal; exit = !!oldResults?.exitScenario;
      medianaConf = hallazgos.some((h) => h.id === "sobreprecio"); ai = r.ai_analysis;
    }

    const N = hallazgos.length;
    nDist[N] = (nDist[N] || 0) + 1;
    const ids = new Set(hallazgos.map((h) => h.id));
    const faltantes = UNIVERSO.filter((id) => !ids.has(id));
    for (const f of faltantes) { const c = causaOmision(f, exit, medianaConf); causas[`${f}: ${c}`] = (causas[`${f}: ${c}`] || 0) + 1; }

    const factorOK = Number.isFinite(factorADR) && Math.abs(factorADR! - 1) < 1e-6;
    const verOK = CANONICOS.has(veredicto);
    const nOK = N >= 7 && N <= 12;
    // prosa: solo cuenta si la fila tiene ai_analysis persistido.
    let rowRev = 0, rowEco = 0;
    if (ai && typeof ai === "object") { const s: string[] = []; collectStrings(ai, s); rowRev = s.filter((x) => REVENUE_RE.test(x)).length; rowEco = s.filter((x) => UPLIFT_ECO_RE.test(x)).length; }
    if (!factorOK) violFactor++;
    if (!verOK) violVer++;
    if (!nOK) violN++;
    if (rowRev) revLeaks++;
    if (rowEco) ecoLeaks++;
    if (!factorOK || !verOK || !nOK || rowRev || rowEco) detalleFallas.push({ id: r.id.slice(0, 8), comuna: r.comuna, factorADR, veredicto, N, faltan: faltantes.join(","), rev: rowRev, eco: rowEco });
  }

  const T = recomputables.length;
  console.log(`INVARIANTE:`);
  console.log(`  factorADR=1:            ${violFactor === 0 ? `${T}/${T} ✓` : `${violFactor} violaciones ✗`}`);
  console.log(`  veredicto canónico:    ${violVer === 0 ? `${T}/${T} ✓` : `${violVer} violaciones ✗`}`);
  console.log(`  N∈[7,12]:              ${violN === 0 ? `${T}/${T} ✓` : `${violN} violaciones ✗`}`);
  console.log(`  0 "revenue" en prosa:  ${revLeaks === 0 ? "✓" : `${revLeaks} filas con fuga ✗`}`);
  console.log(`  0 eco de uplift:       ${ecoLeaks === 0 ? "✓" : `${ecoLeaks} filas con eco ✗`}`);
  console.log(`\nDISTRIBUCIÓN N (hallazgos):`, nDist);
  console.log(`\nCAUSAS de N<12 (omisiones esperadas):`);
  for (const [k, v] of Object.entries(causas).sort((a, b) => b[1] - a[1])) console.log(`  ${v}×  ${k}`);
  if (detalleFallas.length) { console.log(`\n⚠️ FILAS CON VIOLACIÓN REAL (no omisión esperada):`); console.table(detalleFallas.filter((f) => f.faltan.split(",").some((id: string) => !["sobreprecio", "tir", "patrimonio", "capex_puesta_a_punto"].includes(id)) || !CANONICOS.has(f.veredicto) || f.rev || f.eco || (Number.isFinite(f.factorADR) && Math.abs(f.factorADR - 1) > 1e-6))); }
  console.log(`\n${violFactor + violVer + violN + revLeaks + ecoLeaks === 0 ? "✓ VERDE — invariante limpio" : "✗ hay violaciones — revisar arriba"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
