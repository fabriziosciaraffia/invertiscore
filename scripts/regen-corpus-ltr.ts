// regen-corpus-ltr.ts — regen del corpus LTR (rama motor-supuestos, cierre F6).
// Espejo del regen STR para LTR: recompute-persist DETERMINÍSTICO de `results` (0 tokens).
// Necesario porque generateAiAnalysis lee `results` PERSISTIDO (no recomputa): sin este regen
// la prosa LTR cita números 4% (stale) aunque el render (recomputeResultsForLegacy) ya muestre
// card/drawer a 3%. Score y veredicto son INVARIANTES a la tasa (F1: gates día-1, score usa
// plusvalía histórica) → solo se persiste `results` (exit/hallazgos/proyecciones a 3%).
//
// PATH ANTI-HOOKS: service-role sb.update directo → no cobra crédito, no dispara email/Resend.
// FUENTE: input_data + mediana_comuna_snapshot PERSISTIDOS. Determinístico, sin API.
//
// Modos:
//   --dry : recompute de las N, tabla veredicto viejo→nuevo + N hallazgos. NO persiste.
//   --go  : persiste `results` recomputado. Reporta sweep de veredictos (deben ser todos "=").
//   node --env-file=.env.local --import tsx scripts/regen-corpus-ltr.ts --dry
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { recomputeResultsForLegacy } from "../src/lib/analysis/recompute-results-for-legacy";
config({ path: path.resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const dry = args.includes("--dry"), go = args.includes("--go");
if (!dry && !go) { console.error("Especificá --dry | --go"); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const frozenUF = (row: any): number => {
  const p = row?.results?.metrics?.precioCLP;
  const uf = row?.input_data?.precio;
  const d = p && uf ? Math.round(p / uf) : NaN;
  return Number.isFinite(d) && d > 0 ? d : 38800;
};

(async () => {
  const { data, error } = await sb.from("analisis").select("id, comuna, input_data, results, mediana_comuna_snapshot").limit(2000);
  if (error) { console.error(error.message); process.exit(1); }
  const ltr = (data as any[]).filter((r) => r?.results?.tipoAnalisis !== "short-term");
  const recomputables = ltr.filter((r) => r.input_data && typeof r.input_data.precio === "number");
  const excluidas = ltr.filter((r) => !recomputables.includes(r));
  console.log(`\nCorpus LTR: ${ltr.length} · recomputables: ${recomputables.length} · excluidas (sin input.precio): ${excluidas.length} [${excluidas.map((e) => e.id.slice(0, 8)).join(", ")}]`);

  const cambios: string[] = [];
  let ok = 0, fail = 0;
  const nDist: Record<string, number> = {};
  for (const r of recomputables) {
    let rec: any;
    try { rec = recomputeResultsForLegacy(r.input_data, frozenUF(r), r.mediana_comuna_snapshot ?? undefined); }
    catch (e: any) { fail++; console.log(`  ✗ recompute FALLÓ ${r.id.slice(0, 8)}: ${e?.message ?? e}`); continue; }
    const vOld = r.results?.veredicto, vNew = rec.veredicto;
    if (vOld && vNew && vOld !== vNew) cambios.push(`${r.id.slice(0, 8)} ${r.comuna}: ${vOld} → ${vNew}`);
    const n = (rec.hallazgos ?? []).length; nDist[n] = (nDist[n] || 0) + 1;
    if (go) {
      const { error: upErr } = await sb.from("analisis").update({ results: rec }).eq("id", r.id);
      if (upErr) { fail++; console.log(`  ✗ update FALLÓ ${r.id.slice(0, 8)}: ${upErr.message}`); continue; }
    }
    ok++;
  }

  console.log(`\n${go ? "GO" : "DRY"} — ${ok} ${go ? "persistidas" : "recomputadas"} · fails: ${fail}`);
  console.log(`  distribución N (hallazgos): ${JSON.stringify(nDist)}`);
  console.log(`\n═══ SWEEP DE VEREDICTOS (deben ser todos "=") ═══`);
  if (cambios.length === 0) console.log(`  ✓ CERO cambios de veredicto sobre ${recomputables.length} filas — invariante a la tasa confirmado sobre persistido.`);
  else { console.log(`  ✗ ${cambios.length} VEREDICTOS CAMBIARON — STOP, revisar (NO se arregla acá):`); cambios.forEach((c) => console.log("    " + c)); }
})();
