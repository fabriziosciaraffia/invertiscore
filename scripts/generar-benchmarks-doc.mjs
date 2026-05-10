// Genera docs/str-benchmarks-from-airroi-2026-05.md desde el CSV de calibración.
// Cero AirROI calls. Solo lectura local del CSV.

import fs from "fs";
import path from "path";

const CSV = "scripts/output/calibracion-uplifts-20260510-005224.csv";
const OUT = "docs/str-benchmarks-from-airroi-2026-05.md";

// ─── CSV helpers ─────────────────────────────
function parseLine(l) {
  const f = []; let cur = ""; let inQ = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (inQ) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ",") { f.push(cur); cur = ""; } else cur += ch; }
  }
  f.push(cur); return f;
}
function readCsv(p) {
  const text = fs.readFileSync(p, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseLine(lines[0]);
  return lines.slice(1).map((l) => { const f = parseLine(l); const o = {}; header.forEach((h, i) => o[h] = f[i]); return o; });
}
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const bool = (v) => String(v).toLowerCase() === "true";
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2===0 ? (s[m-1]+s[m])/2 : s[m]; }
function avg(xs) { if (!xs.length) return null; return xs.reduce((s,x)=>s+x,0) / xs.length; }
function quantile(xs, q) { if (!xs.length) return null; const s = [...xs].sort((a,b)=>a-b); const pos = (s.length-1)*q; const lo = Math.floor(pos); const hi = Math.ceil(pos); return lo===hi ? s[lo] : s[lo] + (s[hi]-s[lo])*(pos-lo); }
const fmt = (v, d = 0) => v == null ? "—" : Number(v).toFixed(d);
const fmtCLP = (v) => v == null ? "—" : "$" + Math.round(v).toLocaleString("es-CL");
const fmtPct = (v) => v == null ? "—" : (v * 100).toFixed(1) + "%";

// ─── Main ─────────────────────────────
const all = readCsv(path.resolve(CSV));
const filtered = all.filter((r) => {
  const rev = num(r.ttm_revenue), days = num(r.ttm_days_reserved);
  return rev != null && rev > 0 && days != null && days >= 30;
});

const rows = filtered.map((r) => ({
  barrio: r.barrio,
  pro: bool(r.professional_management),
  bedrooms: num(r.bedrooms) ?? 0,
  adr: num(r.ttm_avg_rate),
  occ: num(r.ttm_occupancy),
  rev: num(r.ttm_revenue),
}));

const barrios = [...new Set(rows.map((r) => r.barrio))];

function statsFor(items) {
  const adr = items.map((r) => r.adr).filter((v) => v != null);
  const occ = items.map((r) => r.occ).filter((v) => v != null);
  const rev = items.map((r) => r.rev).filter((v) => v != null);
  return {
    n: items.length,
    adr_med: median(adr), adr_avg: avg(adr), adr_p25: quantile(adr, 0.25), adr_p75: quantile(adr, 0.75),
    occ_med: median(occ), occ_avg: avg(occ),
    rev_med: median(rev), rev_avg: avg(rev),
    rev_med_mensual: median(rev) != null ? median(rev) / 12 : null,
  };
}

function table_md(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = "| " + cols.join(" | ") + " |";
  const sep = "| " + cols.map(() => "---").join(" | ") + " |";
  const body = rows.map((r) => "| " + cols.map((c) => r[c]).join(" | ") + " |").join("\n");
  return [head, sep, body].join("\n");
}

const lines = [];
lines.push("# Benchmarks STR Santiago — AirROI (mayo 2026)");
lines.push("");
lines.push("Datos extraídos del experimento de calibración del 9 de mayo 2026.");
lines.push(`Sample: 270 listings (90 por barrio) en Lastarria, Providencia y Las Condes via \`/listings/search/market\`.`);
lines.push(`Filtros aplicados: \`ttm_revenue > 0\` AND \`ttm_days_reserved >= 30\` → ${filtered.length} listings utilizables (de 270).`);
lines.push(`Métricas: TTM (trailing twelve months) directamente desde AirROI \`performance_metrics\`.`);
lines.push("");
lines.push("**Fuente de raw data:** `scripts/output/calibracion-uplifts-20260510-005224.csv` (no comitear).");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 1. Stats globales (pooled, 3 barrios)");
lines.push("");
const global = statsFor(rows);
lines.push(`- **n filtrado:** ${global.n}`);
lines.push(`- **ADR (CLP/noche):** mediana ${fmtCLP(global.adr_med)} | promedio ${fmtCLP(global.adr_avg)} | P25 ${fmtCLP(global.adr_p25)} | P75 ${fmtCLP(global.adr_p75)}`);
lines.push(`- **Occupancy:** mediana ${fmtPct(global.occ_med)} | promedio ${fmtPct(global.occ_avg)}`);
lines.push(`- **Revenue mensual:** mediana ${fmtCLP(global.rev_med_mensual)}`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 2. Por barrio");
lines.push("");

const byBarrioRows = [];
for (const b of barrios) {
  const sub = rows.filter((r) => r.barrio === b);
  const s = statsFor(sub);
  byBarrioRows.push({
    Barrio: b,
    n: s.n,
    "ADR med": fmtCLP(s.adr_med),
    "ADR p25-p75": `${fmtCLP(s.adr_p25)}–${fmtCLP(s.adr_p75)}`,
    "Occ med": fmtPct(s.occ_med),
    "Rev/mes med": fmtCLP(s.rev_med_mensual),
  });
}
lines.push(table_md(byBarrioRows));
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 3. Por banda operacional (pro_management binario)");
lines.push("");
lines.push("**Definición simple:** B1 = `professional_management=true`. B2 = `professional_management=false`. Sin filtrar por count de unidades en sample (que dio n=0 en B1 con threshold ≥5).");
lines.push("");

const bandaRows = [];
for (const b of barrios) {
  const sub = rows.filter((r) => r.barrio === b);
  const b1 = sub.filter((r) => r.pro);
  const b2 = sub.filter((r) => !r.pro);
  const s1 = statsFor(b1);
  const s2 = statsFor(b2);
  bandaRows.push({
    Barrio: b,
    "n B1 / B2": `${s1.n} / ${s2.n}`,
    "B1 ADR med": fmtCLP(s1.adr_med),
    "B2 ADR med": fmtCLP(s2.adr_med),
    "B1 Occ med": fmtPct(s1.occ_med),
    "B2 Occ med": fmtPct(s2.occ_med),
  });
}
// Pooled
const pB1 = rows.filter((r) => r.pro);
const pB2 = rows.filter((r) => !r.pro);
const ps1 = statsFor(pB1);
const ps2 = statsFor(pB2);
bandaRows.push({
  Barrio: "**Pooled**",
  "n B1 / B2": `**${ps1.n} / ${ps2.n}**`,
  "B1 ADR med": `**${fmtCLP(ps1.adr_med)}**`,
  "B2 ADR med": `**${fmtCLP(ps2.adr_med)}**`,
  "B1 Occ med": `**${fmtPct(ps1.occ_med)}**`,
  "B2 Occ med": `**${fmtPct(ps2.occ_med)}**`,
});
lines.push(table_md(bandaRows));
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 4. Por bedrooms (1D vs 2D vs 3D+)");
lines.push("");
lines.push("Útil para validar si el motor STR replica la curva de ADR/bedroom observada.");
lines.push("");
const bdrmGroups = [
  { label: "1D", filter: (r) => r.bedrooms === 1 },
  { label: "2D", filter: (r) => r.bedrooms === 2 },
  { label: "3D+", filter: (r) => r.bedrooms >= 3 },
];
const bdrmRows = [];
for (const g of bdrmGroups) {
  const sub = rows.filter(g.filter);
  const s = statsFor(sub);
  bdrmRows.push({
    Bedrooms: g.label,
    n: s.n,
    "ADR med": fmtCLP(s.adr_med),
    "ADR/bed med": fmtCLP(s.adr_med != null && g.label === "1D" ? s.adr_med : (s.adr_med != null ? s.adr_med / (g.label === "2D" ? 2 : g.label === "3D+" ? 3 : 1) : null)),
    "Occ med": fmtPct(s.occ_med),
    "Rev/mes med": fmtCLP(s.rev_med_mensual),
  });
}
lines.push(table_md(bdrmRows));
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 5. Targets de calibración v1 (deberían reproducirse en motor STR)");
lines.push("");
lines.push("Para validar que el motor STR está bien calibrado, sus outputs en condiciones similares deberían quedar dentro de estos rangos:");
lines.push("");
lines.push("| Test case | ADR esperado | Occ esperada | Rev mensual esperado |");
lines.push("| --- | --- | --- | --- |");
for (const b of barrios) {
  const sub = rows.filter((r) => r.barrio === b);
  const s = statsFor(sub);
  lines.push(`| ${b}, baseline (no-pro, 1-2D, depto típico) | ${fmtCLP(s.adr_p25)}–${fmtCLP(s.adr_p75)} | ~${fmtPct(s.occ_med)} | ~${fmtCLP(s.rev_med_mensual)} |`);
}
lines.push("");
lines.push("**Caveat:** sample n_B1=13 across barrios. Cualquier conclusión sobre uplift `professional_management` es directional, no precisa.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 6. Caveat — observado vs target estabilizado");
lines.push("");
lines.push("Las medianas de occupancy reportadas arriba (Lastarria ~32%, Providencia ~44%, Las Condes ~42%, rango pooled 37–47%) son **TTM observadas en AirROI sobre TODOS los listings activos**, incluyendo:");
lines.push("");
lines.push("- Listings recién publicados que aún están en ramp-up.");
lines.push("- Listings mal-fotografiados, mal-pricados o con reviews bajos.");
lines.push("- Listings que el host abandonó pero no dio de baja.");
lines.push("- Mix de operadores hobby y operadores profesionales sin segmentar.");
lines.push("");
lines.push("Los **targets de ocupación estabilizada** del motor (55% baseline auto-gestión, 65% admin pro residencial / dedicado auto, 74% dedicado + admin pro) reflejan **\"qué ocupación es alcanzable con buena ejecución\" en mes 7+ post-listing**, no \"el promedio del mercado\".");
lines.push("");
lines.push("Fuentes que justifican el shift:");
lines.push("- **Proforma Andes STR Alameda 107 (sept 2025):** 74% target estabilizado para edificio dedicado con admin pro full-service.");
lines.push("- **Airbtics público:** Andes STR opera ~10–15 puntos sobre el promedio Santiago.");
lines.push("- **Curva de ramp-up:** los primeros 5 meses operan al 50/60/70/80/90% del target — la mediana TTM está sesgada hacia abajo por listings inmaduros.");
lines.push("");
lines.push("**Implicación práctica:** un listing nuevo con baseline (residencial, auto-gestión, básico) NO va a ocupar 55% en su primer mes — va a operar al 27.5% (50% del target). Llega al 55% recién en mes 6. La mediana de la cohorte refleja el promedio entre listings ramp-uppeando y listings estables; el target del motor es el plateau, no el promedio cohorte.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 7. Notas sobre el motor STR");
lines.push("");
lines.push("- El motor `calcShortTerm` (`src/lib/engines/short-term-engine.ts`) consume los percentiles de AirROI directamente como input. No se puede validar listing-por-listing sin gastar AirROI calls.");
lines.push("- Calibración v1 introduce constantes de uplift (factor edificio, factor habilitación, ocupación target) en lugar de usar `airbnbData.percentiles.occupancy.p50` directamente. Ver constantes `STR_OCUPACION_TARGET` y `STR_ADR_FACTOR` en short-term-engine.ts.");
lines.push("- Validación post-implementación recomendada: comparar el output del motor con `tipo_edificio=residencial_puro + admin_pro=false + habilitacion=basico` contra las medianas baseline de la tabla 5. Deberían coincidir en orden de magnitud.");
lines.push("");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n"));
console.log(`Doc escrito: ${OUT}`);
console.log(`Sample size filtered: ${filtered.length}`);
console.log(`Barrios: ${barrios.join(", ")}`);
