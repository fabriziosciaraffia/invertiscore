// of-ambas-calib-recompute — FASE 1 del calibration-pairs.
// READ-ONLY, CERO WRITES. Reproduce el pareo AMBAS (propKey + payment window) y
// recomputa AMBOS lados de cada par con el motor NUEVO (post-Rama-0), asOf=created_at,
// UF congelada. Emite: por par (delta patrimonio Y10 misma-vara, sobreRentaPct recomputado,
// veredictos individuales, veredicto comparativo del umbral actual) + distribución por bandas
// + diagnóstico de degenerados.
//
// Uso: node --env-file=.env.local --import tsx scripts/of-ambas-calib-recompute.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { runAnalysis } from "../src/lib/analysis";
import { resolveUfForAnalysis } from "../src/lib/uf";
import { recomputeShortTermForLegacy } from "../src/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "../src/lib/api-helpers/analisis-pipeline";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const UF_LIVE_FALLBACK = 39250; // solo fallback para filas irreconstruibles

const tipoDe = (r: any) => {
  if (r.tipo_analisis === "short-term") return "str";
  if (r.tipo_analisis != null) return "ltr";
  return r.results?.tipoAnalisis === "short-term" ? "str" : "ltr";
};

async function fetchAll(table: string, cols: string) {
  const out: any[] = [];
  let from = 0; const page = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).order("created_at", { ascending: true }).range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}

// umbral actual del motor (str-universo-santiago.ts:229-241)
function veredictoComparativo(sobrePct: number, tier: string | undefined): string {
  if (tier === "baja") return "LTR_PREFERIDO";
  if (sobrePct < 0.05) return "LTR_PREFERIDO";
  if (sobrePct >= 0.15) return "STR_VENTAJA_CLARA";
  return "INDIFERENTE";
}

async function main() {
  const rows = await fetchAll("analisis", "id, user_id, comuna, direccion, tipo_analisis, results, input_data, created_at");
  const payments = await fetchAll("payments", "id, user_id, product, payment_data, created_at");
  const boths = payments.filter((p) => p.payment_data?.intent === "both" && p.user_id);
  const bothByUser = new Map<string, number[]>();
  for (const p of boths) {
    if (!bothByUser.has(p.user_id)) bothByUser.set(p.user_id, []);
    bothByUser.get(p.user_id)!.push(new Date(p.created_at).getTime());
  }

  // ── propKey pairing ──
  const byKey = new Map<string, any[]>();
  for (const a of rows) {
    if (!a.user_id || !a.direccion) continue;
    const key = `${a.user_id}|${a.direccion}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }
  const pairs: any[] = [];
  for (const items of Array.from(byKey.values())) {
    if (items.length < 2) continue;
    const ltrs = items.filter((i: any) => tipoDe(i) === "ltr");
    const strs = items.filter((i: any) => tipoDe(i) === "str");
    if (!ltrs.length || !strs.length) continue;
    const usedStr = new Set<string>();
    for (const ltr of ltrs) {
      let best: any = null, bestDt = Infinity;
      for (const str of strs) {
        if (usedStr.has(str.id)) continue;
        const dt = Math.abs(new Date(ltr.created_at).getTime() - new Date(str.created_at).getTime()) / 1000;
        if (dt < 120 && dt < bestDt) { best = str; bestDt = dt; }
      }
      if (best) { usedStr.add(best.id); pairs.push({ ltr, str: best, deltaSec: Math.round(bestDt) }); }
    }
  }
  pairs.sort((a, b) => new Date(a.str.created_at).getTime() - new Date(b.str.created_at).getTime());

  const out: any[] = [];
  for (const p of pairs) {
    const { ltr, str } = p;
    const ltrInput = ltr.input_data as any;
    const strInput = str.input_data as any;
    const strRes = str.results as any;

    // payment-verified?
    const times = bothByUser.get(ltr.user_id) ?? [];
    const tPair = new Date(ltr.created_at).getTime();
    const payVerified = times.some((bt) => Math.abs(bt - tPair) / 1000 < 900);

    // ── STR recompute (motor nuevo, asOf, UF congelada) ──
    const strPrecioUF = Number(strInput?.precioCompraUF) || 0;
    const strPrecioCLP = Number(strInput?.precioCompra) || 0;
    const strUf = strPrecioUF > 0 ? strPrecioCLP / strPrecioUF : UF_LIVE_FALLBACK;
    const strAsOf = new Date(str.created_at);
    let strMediana = { mediana: null as number | null, n: 0 };
    try {
      strMediana = await prefetchMedianaComunaVenta(sb as any, {
        comuna: (strInput?.comuna as string) ?? str.comuna ?? "",
        superficie: Number(strInput?.superficieUtil) || 0,
        dormitorios: Number(strInput?.dormitorios) || 0,
      } as any, strUf);
    } catch { /* null */ }
    const strNew = recomputeShortTermForLegacy(strInput, strRes, strUf, strAsOf, strMediana);

    // ── LTR recompute (motor nuevo, asOf, UF congelada) ──
    const ltrUf = resolveUfForAnalysis(ltr.results as any, ltrInput, UF_LIVE_FALLBACK, ltr.id);
    const ltrAsOf = new Date(ltr.created_at);
    let ltrMediana = { mediana: null as number | null, n: 0 };
    try {
      ltrMediana = await prefetchMedianaComunaVenta(sb as any, {
        comuna: (ltrInput?.comuna as string) ?? ltr.comuna ?? "",
        superficie: Number(ltrInput?.superficie) || 0,
        dormitorios: Number(ltrInput?.dormitorios) || 0,
      } as any, ltrUf);
    } catch { /* null */ }
    let ltrNew: any = null, ltrErr: string | null = null;
    try { ltrNew = runAnalysis(ltrInput, ltrUf, ltrMediana, ltrAsOf); }
    catch (e: any) { ltrErr = e.message; }

    const sobrePct = strNew?.comparativa?.sobreRentaPct ?? NaN;
    const tier = strNew?.zonaSTR?.tierZona;
    const recoEngine = strNew?.recomendacionModalidad ?? "?";
    const recoUmbral = Number.isFinite(sobrePct) ? veredictoComparativo(sobrePct, tier) : "?";

    const ltrP9: any = ltrNew?.projections?.[9] ?? {};
    const strP9: any = strNew?.projections?.[9] ?? {};
    const ltrY10 = ltrP9?.patrimonioNeto ?? null;
    const strY10 = strP9?.patrimonioNeto ?? null;
    const deltaY10 = (ltrY10 != null && strY10 != null) ? strY10 - ltrY10 : null;
    const deltaY10Pct = (deltaY10 != null && ltrY10) ? deltaY10 / Math.abs(ltrY10) : null;

    // filo: sobreRentaPct dentro de ±2pp de un corte (0.05 o 0.15)
    const near = (x: number, cut: number) => Math.abs(x - cut) <= 0.02;
    const filo = Number.isFinite(sobrePct) && (near(sobrePct, 0.05) || near(sobrePct, 0.15));

    // ¿misma vara? patrimonioNeto=valorDepto−saldo depende SOLO de precio+financiamiento,
    // idéntico entre LTR y STR si el par se entró con los mismos números. Exponemos la
    // divergencia de inputs entre las dos filas para no atribuir a modalidad lo que es
    // ruido de data.
    const ltrPrecioUF = Number(ltrInput?.precio) || 0;
    const strPrecioUFv = Number(strInput?.precioCompraUF) || 0;
    const mismoPrecio = ltrPrecioUF > 0 && strPrecioUFv > 0 && Math.abs(ltrPrecioUF - strPrecioUFv) / ltrPrecioUF < 0.01;
    const mismoFin =
      Number(ltrInput?.piePct) === Number(strInput?.piePct) &&
      Number(ltrInput?.tasaInteres) === Number(strInput?.tasaInteres) &&
      Number(ltrInput?.plazoCredito) === Number(strInput?.plazoCredito);

    out.push({
      ltrId: ltr.id, strId: str.id,
      comuna: str.comuna ?? ltr.comuna,
      direccion: (ltr.direccion ?? "").slice(0, 40),
      pay: payVerified ? "PAY" : "prop",
      ltrPrecioUF, strPrecioUF: strPrecioUFv, mismoPrecio, mismoFin,
      modoGestion: strInput?.modoGestion ?? "?",
      adminPro: strInput?.adminPro === true,
      ltrVer: ltrNew?.veredicto ?? (ltrErr ? `ERR:${ltrErr.slice(0, 20)}` : "?"),
      strVer: strNew?.veredicto ?? "?",
      sobrePct: Number.isFinite(sobrePct) ? +(sobrePct * 100).toFixed(1) : null,
      tier: tier ?? "?",
      recoEngine, recoUmbral,
      match: recoEngine === recoUmbral,
      ltrY10, strY10, deltaY10,
      ltrUf, strUf,
      ltrValorY10: (ltrP9 as any)?.valorPropiedad ?? null, ltrSaldoY10: (ltrP9 as any)?.saldoCredito ?? (ltrP9 as any)?.saldo ?? null,
      strValorY10: (strP9 as any)?.valorDepto ?? null, strSaldoY10: (strP9 as any)?.saldoCredito ?? (strP9 as any)?.saldo ?? null,
      deltaY10Pct: deltaY10Pct != null ? +(deltaY10Pct * 100).toFixed(1) : null,
      filo,
      createdAt: str.created_at,
    });
  }

  // ── distribución por bandas (recomputada) ──
  const bandas: Record<string, number> = { LTR_PREFERIDO: 0, INDIFERENTE: 0, STR_VENTAJA_CLARA: 0, "?": 0 };
  for (const o of out) bandas[o.recoUmbral] = (bandas[o.recoUmbral] ?? 0) + 1;

  console.log(`\n=== ${out.length} PARES · recompute motor nuevo (asOf=created_at) ===`);
  console.table(out.map((o) => ({
    comuna: o.comuna, dir: o.direccion.slice(0, 22), pay: o.pay, modo: o.modoGestion, admP: o.adminPro ? "Y" : "-",
    ltrVer: o.ltrVer, strVer: o.strVer, sobre: o.sobrePct != null ? o.sobrePct + "%" : "—", tier: o.tier,
    reco: o.recoUmbral, mtch: o.match ? "=" : "≠",
    pUF: o.mismoPrecio ? "=" : `${o.ltrPrecioUF}/${o.strPrecioUF}`,
    fin: o.mismoFin ? "=" : "≠",
    dY10M: o.deltaY10 != null ? (o.deltaY10 / 1e6).toFixed(1) : "—",
    dY10p: o.deltaY10Pct != null ? o.deltaY10Pct + "%" : "—",
    filo: o.filo ? "⚑" : "",
  })));
  const inputDiv = out.filter((o) => !o.mismoPrecio || !o.mismoFin).length;
  console.log(`\n  pares con inputs LTR≠STR (precio o financiamiento divergente): ${inputDiv}/${out.length}`);
  console.log(`  → en esos, el delta patrimonio Y10 NO es misma-vara (refleja data, no modalidad)`);

  console.log(`\n=== DISTRIBUCIÓN POR BANDAS (recomputada, umbral <5/5-15/≥15) ===`);
  console.log(JSON.stringify(bandas, null, 2));
  console.log(`  al filo (±2pp de 5% o 15%): ${out.filter((o) => o.filo).length}`);
  console.log(`  engine reco ≠ umbral manual: ${out.filter((o) => !o.match).length}`);

  // ── degenerados ──
  console.log(`\n=== DEGENERADOS / ATÍPICOS ===`);
  for (const o of out) {
    const flags: string[] = [];
    if (o.sobrePct == null) flags.push("sobrePct=NaN/null");
    if (o.sobrePct != null && Math.abs(o.sobrePct) > 150) flags.push(`sobrePct extremo ${o.sobrePct}%`);
    if (o.ltrVer?.startsWith?.("ERR")) flags.push(o.ltrVer);
    if (o.deltaY10 == null) flags.push("deltaY10 null");
    if (o.ltrY10 != null && o.ltrY10 <= 0) flags.push(`ltrY10<=0 (${o.ltrY10})`);
    if (flags.length) console.log(`  ${o.strId.slice(0, 8)} · ${o.comuna} · ${o.direccion.slice(0, 24)} → ${flags.join(" | ")}`);
  }

  const jsonPath = path.resolve(process.cwd(), "scripts/output/of-ambas-calib-recompute.json");
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  console.log(`\nJSON → ${jsonPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
