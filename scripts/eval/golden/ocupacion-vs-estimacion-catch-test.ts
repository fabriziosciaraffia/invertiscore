// ============================================================================
// GOLDEN · OCUPACION_VS_ESTIMACION — catch-test (Goal 4 · 04-sep-2026). 0 tokens, read-only.
// ============================================================================
// El hallazgo compara el supuesto del usuario contra la ESTIMACIÓN de mercado para ese
// depto, no contra la comuna. Contrato:
//   · sin override ⇒ neutral, gap 0, decisividad 0 (neutralización: caso = estimación) y
//     nunca en la punta;
//   · override sobre la estimación ⇒ adverso; bajo ⇒ favorable; ±1 pt ⇒ neutral;
//   · fallback (sin dato de la dirección) ⇒ confianza baja y "no hay datos" en la frase;
//   · copy en tuteo: nunca "banda", "llenar", "ramp-up", ni el nombre del proveedor.
// La comparación con la comuna vive en zonaSTR (V2): "sin_datos" cuando la comuna tiene
// menos de 3 direcciones, alias "Santiago Centro" → Santiago.
//
// Parte pura (builder + universo) y parte con parque: Sta. Rosa eb7b3a66 (sin override),
// bc61f612 (override sobre: 65% vs 43%), 4ed66f89 (override bajo: 35% vs 42%) y
// fc14758f (Pudahuel, comuna sin datos suficientes).
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/ocupacion-vs-estimacion-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildHallazgoOcupacionVsEstimacion, OCC_FALLBACK_PCT } from "../../../src/lib/ocupacion-vs-estimacion-hallazgo";
import { calcZonaSTR, datosComunaSTR, STR_UNIVERSO_V2, STR_UNIVERSO_V2_META } from "../../../src/lib/engines/str-universo-santiago";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { ordenarHallazgosPiramideSTR } from "../../../src/lib/piramide-orden-str";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { DECISIVIDAD_FLOOR } from "../../../src/lib/analysis";
import type { HallazgoOcupacionVsEstimacion } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const PROHIBIDO = /\bbanda\b|\bllen(a|as|ar|an)\b|ramp-?up|airroi|\boverride\b|\bfallback\b/i;

function textoLimpio(h: HallazgoOcupacionVsEstimacion, tag: string) {
  for (const t of [h.titular, h.fraseCanonica, h.procedencia.base]) {
    const m = PROHIBIDO.exec(t);
    if (m) F(`${tag} · palabra prohibida "${m[0]}" en: ${t.slice(0, 80)}`);
  }
}

function parteBuilder() {
  const base = { comuna: "Santiago", decisividad: 0, modalidad: "str" as const };
  const sin = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 42.7, estimacionPct: 42.7, esOverride: false, esFallback: false })!;
  if (sin.direccion !== "neutral" || sin.valor.gapPts !== 0 || sin.magnitudContinua !== 0) F(`sin override · debía ser neutral/gap 0/mag 0: ${sin.direccion}/${sin.valor.gapPts}/${sin.magnitudContinua}`);
  if (sin.procedencia.confianza !== "media") F(`sin override · confianza ${sin.procedencia.confianza}, esperada media`);
  if (!/estima/i.test(sin.fraseCanonica)) F("sin override · la frase debía nombrar la estimación de mercado");
  textoLimpio(sin, "sin override");

  const fb = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 45, estimacionPct: 45, esOverride: false, esFallback: true })!;
  if (fb.direccion !== "neutral" || fb.procedencia.confianza !== "baja" || !/no hay datos/i.test(fb.fraseCanonica)) F(`fallback · neutral/baja/"no hay datos": ${fb.direccion}/${fb.procedencia.confianza}`);
  if (fb.valor.ocupacionPct !== OCC_FALLBACK_PCT) F(`fallback · KPI ${fb.valor.ocupacionPct}, esperado ${OCC_FALLBACK_PCT}`);
  textoLimpio(fb, "fallback");

  const sobre = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 65, estimacionPct: 43, esOverride: true, esFallback: false, decisividad: 1 })!;
  if (sobre.direccion !== "adverso" || sobre.valor.gapPts !== 22 || !(sobre.magnitudContinua! > 0)) F(`override sobre · adverso/+22: ${sobre.direccion}/${sobre.valor.gapPts}`);
  if (!/supusiste 65%/i.test(sobre.fraseCanonica) || !/43%/.test(sobre.fraseCanonica) || !/22 puntos más/.test(sobre.fraseCanonica)) F(`override sobre · la frase debía decir "supusiste 65%", "43%" y "22 puntos más": ${sobre.fraseCanonica}`);
  if (sobre.procedencia.confianza !== "baja") F("override sobre · confianza debía ser baja");
  textoLimpio(sobre, "override sobre");

  const bajo = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 35, estimacionPct: 42, esOverride: true, esFallback: false, decisividad: 0.85 })!;
  if (bajo.direccion !== "favorable" || bajo.valor.gapPts !== -7) F(`override bajo · favorable/−7: ${bajo.direccion}/${bajo.valor.gapPts}`);
  if (!/7 puntos menos/.test(bajo.fraseCanonica)) F(`override bajo · la frase debía decir "7 puntos menos": ${bajo.fraseCanonica}`);
  textoLimpio(bajo, "override bajo");

  const linea = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 43, estimacionPct: 42.6, esOverride: true, esFallback: false })!;
  if (linea.direccion !== "neutral" || linea.magnitudContinua !== 0) F(`override en línea · neutral/mag 0: ${linea.direccion}/${linea.magnitudContinua}`);
  textoLimpio(linea, "override en línea");

  const overFb = buildHallazgoOcupacionVsEstimacion({ ...base, ocupacionPct: 60, estimacionPct: OCC_FALLBACK_PCT, esOverride: true, esFallback: true })!;
  if (overFb.direccion !== "adverso" || overFb.valor.estimacionPct !== OCC_FALLBACK_PCT || !/no hay datos/i.test(overFb.fraseCanonica)) F(`override + fallback · adverso contra 45 y "no hay datos": ${overFb.direccion}/${overFb.valor.estimacionPct}`);
  textoLimpio(overFb, "override + fallback");

  // Universo V2: todo n ≥ minN, ocupación en (0,1], fecha ISO; sin datos y alias.
  for (const [c, d] of Object.entries(STR_UNIVERSO_V2)) {
    if (d.ocupacion.n < STR_UNIVERSO_V2_META.minN || d.adr.n < STR_UNIVERSO_V2_META.minN) F(`V2 · ${c} con n < ${STR_UNIVERSO_V2_META.minN}`);
    if (!(d.ocupacion.valor > 0 && d.ocupacion.valor <= 1) || !(d.adr.valor > 0)) F(`V2 · ${c} valores fuera de rango`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.ocupacion.fecha)) F(`V2 · ${c} fecha no ISO: ${d.ocupacion.fecha}`);
  }
  if (datosComunaSTR("Pudahuel") !== null) F("V2 · Pudahuel (n=2) debía estar sin datos suficientes");
  if (datosComunaSTR("Santiago Centro")?.ocupacion.valor !== STR_UNIVERSO_V2["Santiago"].ocupacion.valor) F("V2 · alias Santiago Centro → Santiago");
  const zSin = calcZonaSTR("Pudahuel", 40000, 0.38);
  if (!zSin.comunaNoListada || zSin.ocupacionVsComuna !== "sin_datos" || zSin.ocupacionVsComunaPts !== null || zSin.comunaOcupacion) F(`zona sin datos · ${JSON.stringify({ nl: zSin.comunaNoListada, vs: zSin.ocupacionVsComuna })}`);
  const zCon = calcZonaSTR("Santiago", 48000, STR_UNIVERSO_V2["Santiago"].ocupacion.valor + 0.05);
  if (zCon.comunaNoListada || zCon.ocupacionVsComuna !== "mas" || zCon.ocupacionVsComunaPts !== 5 || zCon.comunaOcupacion?.n !== STR_UNIVERSO_V2["Santiago"].ocupacion.n) F(`zona con datos · ${JSON.stringify({ vs: zCon.ocupacionVsComuna, pts: zCon.ocupacionVsComunaPts })}`);
}

const CASOS = [
  { id: "eb7b3a66-5769-4c57-92dc-a7c40229d6f9", tag: "Sta. Rosa sin override", esOverride: false, direccion: "neutral", enPunta: false },
  { id: "bc61f612-f1d0-44c9-af0c-a689ca4ab7fd", tag: "override sobre", esOverride: true, direccion: "adverso", enPunta: true },
  { id: "4ed66f89-3399-4b98-b633-3be7dc3bbfca", tag: "override bajo", esOverride: true, direccion: "favorable", enPunta: false },
  { id: "fc14758f-7b57-42fe-bc8a-e19c3277135d", tag: "Pudahuel sin datos comunales", esOverride: false, direccion: "neutral", enPunta: false, sinDatosComuna: true },
];

async function parteParque() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  for (const caso of CASOS) {
    const pref = caso.id.slice(0, 8);
    const { data: row, error } = await sb.from("analisis").select("id, comuna, input_data, results, created_at").eq("id", caso.id).single();
    if (error || !row) { F(`${pref} · fila no cargó: ${error?.message}`); continue; }
    const d = row.input_data as Record<string, number | string>;
    const uf = (d.precioCompra as number) / (d.precioCompraUF as number);
    const ctx = buildStrRecomputeCtx(row.input_data, row.results, uf);
    if (!ctx) { F(`${pref} · sin contexto de recompute`); continue; }
    const asOf = new Date(row.created_at);
    const result = calcShortTerm(ctx.inputs, asOf);
    const francoScore = calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra: ctx.inputs.precioCompra });
    let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
    try {
      mediana = await getComunaMedianaVentaUF(sb, row.comuna as string, d.superficieUtil as number, (d.dormitorios as number) ?? null, uf,
        resolverCondicionMercado({ esNuevo: d.tipoPropiedad === "nuevo", antiguedad: d.antiguedad as number | undefined }));
    } catch { /* sin mediana ⇒ sobreprecio ausente */ }
    const hz = ordenarHallazgosPiramideSTR(mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
      result, francoScore, comuna: row.comuna as string, precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
      piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number, mediana, valorUF: uf, incluyeCorretaje: false,
      veredictoCtx: { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf },
    })));
    const h = hz.find((x) => x.id === "ocupacion_vs_estimacion") as HallazgoOcupacionVsEstimacion | undefined;
    if (!h) { F(`${pref} · sin ocupacion_vs_estimacion`); continue; }
    if (h.valor.esOverride !== caso.esOverride) F(`${pref} · esOverride ${h.valor.esOverride}, esperado ${caso.esOverride}`);
    if (h.direccion !== caso.direccion) F(`${pref} · dirección ${h.direccion}, esperada ${caso.direccion}`);
    if (!caso.esOverride && (h.decisividad !== 0 || h.valor.gapPts !== 0 || (h.magnitudContinua ?? 0) !== 0)) F(`${pref} · sin override debía dar decisividad 0/gap 0/mag 0: ${h.decisividad}/${h.valor.gapPts}/${h.magnitudContinua}`);
    if (caso.esOverride && !(h.decisividad > 0)) F(`${pref} · override sin decisividad`);
    if (caso.enPunta && (hz[0]?.id !== "ocupacion_vs_estimacion" || h.decisividad < DECISIVIDAD_FLOOR)) F(`${pref} · debía coronar sobre el piso: 01=${hz[0]?.id} dec ${h.decisividad}`);
    if (!caso.enPunta && hz[0]?.id === "ocupacion_vs_estimacion") F(`${pref} · no debía coronar`);
    if (h.valor.esFallback) F(`${pref} · no debía ser fallback`);
    textoLimpio(h, pref);
    const z = result.zonaSTR;
    if (caso.sinDatosComuna) {
      if (!z?.comunaNoListada || z.ocupacionVsComuna !== "sin_datos") F(`${pref} · zona debía ser sin datos: ${JSON.stringify({ nl: z?.comunaNoListada, vs: z?.ocupacionVsComuna })}`);
    } else if (!z || z.comunaNoListada || !z.comunaOcupacion || !["mas", "menos", "similar"].includes(z.ocupacionVsComuna ?? "")) {
      F(`${pref} · zona debía traer contexto comunal: ${JSON.stringify({ nl: z?.comunaNoListada, vs: z?.ocupacionVsComuna })}`);
    }
    console.log(`  ${pref} · ${caso.tag} · ${francoScore.veredicto}/${francoScore.score} · ${h.direccion} · supuesto ${h.valor.ocupacionPct}% est ${h.valor.estimacionPct}% gap ${h.valor.gapPts} · dec ${h.decisividad.toFixed(2)} · 01=${hz[0]?.id} · zona ${z?.ocupacionVsComuna}${z?.comunaOcupacion ? ` (${Math.round(z.occZona * 100)}% vs ${Math.round(z.comunaOcupacion.valor * 100)}%, n=${z.comunaOcupacion.n})` : ""}`);
  }
}

async function main() {
  parteBuilder();
  await parteParque();
  console.log("\nOCUPACION_VS_ESTIMACION · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
