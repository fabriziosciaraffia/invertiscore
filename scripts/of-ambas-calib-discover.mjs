// of-ambas-calib-discover — descubrimiento READ-ONLY de pares AMBAS.
// Reproduce el pareo del audit anterior: propKey (user_id|direccion, un LTR + un STR
// creados <120s) + etiqueta payment-verified (charge product=analysis_charge intent=both,
// consumed_by_analysis_id apuntando a un miembro del par).
// Cero writes. Solo cuenta e imprime. Uso: node --env-file=.env.local scripts/of-ambas-calib-discover.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const tipoDe = (r) => {
  const sql = r.tipo_analisis;
  if (sql === "short-term") return "str";
  if (sql != null) return "ltr";
  // pre-migración: cae al jsonb
  return (r.results?.tipoAnalisis === "short-term") ? "str" : "ltr";
};

async function fetchAll(table, cols) {
  const out = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).order("created_at", { ascending: true }).range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}

async function main() {
  const rows = await fetchAll("analisis", "id, user_id, comuna, direccion, tipo_analisis, results, input_data, created_at");
  console.log(`Total filas analisis: ${rows.length}`);
  const strCount = rows.filter((r) => tipoDe(r) === "str").length;
  console.log(`  LTR: ${rows.length - strCount} · STR: ${strCount}`);

  // ── propKey pairing ──
  const byKey = new Map();
  for (const a of rows) {
    if (!a.user_id || !a.direccion) continue;
    const key = `${a.user_id}|${a.direccion}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(a);
  }

  const pairs = [];
  for (const [key, items] of byKey.entries()) {
    if (items.length < 2) continue;
    const ltrs = items.filter((i) => tipoDe(i) === "ltr");
    const strs = items.filter((i) => tipoDe(i) === "str");
    if (!ltrs.length || !strs.length) continue;
    // emparejar cada LTR con el STR más cercano <120s (una sola vez)
    const usedStr = new Set();
    for (const ltr of ltrs) {
      let best = null, bestDt = Infinity;
      for (const str of strs) {
        if (usedStr.has(str.id)) continue;
        const dt = Math.abs(new Date(ltr.created_at).getTime() - new Date(str.created_at).getTime()) / 1000;
        if (dt < 120 && dt < bestDt) { best = str; bestDt = dt; }
      }
      if (best) { usedStr.add(best.id); pairs.push({ key, ltr, str: best, deltaSec: Math.round(bestDt) }); }
    }
  }
  console.log(`\nPares propKey (LTR+STR <120s): ${pairs.length}`);

  // ── payment/charge linkage ──
  // El intent both vive en payments.payment_data. Etiquetamos por user+ventana temporal.
  let paymentRows = [];
  try {
    paymentRows = await fetchAll("payments", "id, user_id, product, status, flow_status, analysis_id, payment_data, created_at");
  } catch (e) { console.log("(payments fetch fail)", e.message); }
  console.log(`payments totales: ${paymentRows.length}`);
  // muestra de products/intents presentes
  const prodCount = {};
  const intentCount = {};
  for (const p of paymentRows) {
    prodCount[p.product ?? "(null)"] = (prodCount[p.product ?? "(null)"] || 0) + 1;
    const it = p.payment_data?.intent ?? "(none)";
    intentCount[it] = (intentCount[it] || 0) + 1;
  }
  console.log("products:", JSON.stringify(prodCount));
  console.log("intents :", JSON.stringify(intentCount));

  // Dump de los charges intent=both para ver qué campos linkean
  const boths = paymentRows.filter((p) => p.payment_data?.intent === "both");
  console.log(`\n=== charges intent=both (${boths.length}) — campos de link ===`);
  console.table(boths.map((p) => ({
    id: p.id?.toString().slice(0, 8), user: (p.user_id ?? "").slice(0, 8),
    analysis_id: (p.analysis_id ?? "(null)")?.toString().slice(0, 8),
    consumed: (p.payment_data?.consumed_by_analysis_id ?? "(none)")?.toString().slice(0, 8),
    status: p.status, created: p.created_at?.slice(0, 19),
  })));

  // Link por user_id + proximidad temporal del par al charge (ventana 300s)
  const bothByUser = new Map();
  for (const p of boths) {
    if (!p.user_id) continue;
    if (!bothByUser.has(p.user_id)) bothByUser.set(p.user_id, []);
    bothByUser.get(p.user_id).push(new Date(p.created_at).getTime());
  }
  // Los charges intent=both NO guardan consumed_by_analysis_id ni analysis_id, así que el linkeo
  // por id directo no aplica. Etiquetamos el par por ventana temporal user+time contra el charge.
  const payByWindow = (p) => {
    const times = bothByUser.get(p.ltr.user_id) ?? [];
    const t = new Date(p.ltr.created_at).getTime();
    return times.some((bt) => Math.abs(bt - t) / 1000 < 900); // 15 min
  };

  // etiquetar pares
  let verified = 0, propOnly = 0;
  const tabla = [];
  for (const p of pairs) {
    const pay = payByWindow(p);
    if (pay) verified++; else propOnly++;
    tabla.push({
      comuna: p.str.comuna ?? p.ltr.comuna,
      dir: (p.ltr.direccion ?? "").slice(0, 28),
      dt: p.deltaSec,
      pay: pay ? "PAY" : "prop",
      strReco: p.str.results?.recomendacionModalidad ?? "?",
      sobrePctPersist: p.str.results?.comparativa?.sobreRentaPct != null ? (p.str.results.comparativa.sobreRentaPct * 100).toFixed(1) + "%" : "—",
      ltrId: p.ltr.id.slice(0, 8),
      strId: p.str.id.slice(0, 8),
      hasStrInput: !!(p.str.input_data?.precioCompra && p.str.results?.airbnbRaw),
      hasLtrInput: !!(p.ltr.input_data?.precioCompra ?? p.ltr.input_data?.precioCompraUF ?? p.ltr.input_data?.precio),
    });
  }
  console.table(tabla);
  console.log(`\nRESUMEN pareo: ${pairs.length} pares · payment-verified: ${verified} · propKey-only: ${propOnly}`);
  const recomputables = tabla.filter((t) => t.hasStrInput).length;
  console.log(`STR recomputables (input_data+airbnbRaw): ${recomputables}/${pairs.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
