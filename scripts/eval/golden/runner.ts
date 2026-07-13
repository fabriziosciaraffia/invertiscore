// ============================================================================
// GOLDEN SET — runner (CLI orquestador)
// ============================================================================
// Fase 2.0 del sistema. Corre el eval de regresión y reporta matriz pasa/falla.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts [flags]
//     --quick        (default) solo recompute determinístico LTR (0 tokens)
//     --str          agrega el tier STR (GS-STR, BS1-BS8, 0 tokens)
//     --all          LTR quick + STR (0 tokens)
//     --full         recompute + generación fresca (AUTO) + semántico
//     --no-semantic  con --full, salta el juez Opus (solo AUTO)
//     --k=N          generaciones frescas por caso (default 2)
//     --catch-test   auto-test: rompe invariantes en memoria y verifica que FALLA
//
// Exit code 0 solo si no hay fallas duras. Drift de cifra clase (a) → warning
// (candidato a re-baseline, no bloquea).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { runRecomputeTier, type SeedReport } from "./recompute";
import { runCatchTest } from "./catch-test";
import { runGenerateTier } from "./generate";
import { runSemanticTier } from "./semantic";
import { runStrTier } from "./str-recompute";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const kArg = argv.find((a) => a.startsWith("--k="));
const K = kArg ? Math.max(1, parseInt(kArg.split("=")[1], 10) || 2) : 2;
const MODE_FULL = has("--full");
const NO_SEM = has("--no-semantic");

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function printSeed(r: SeedReport) {
  const fails = r.checks.filter((c) => !c.pass);
  const status = r.hardFail > 0 ? "✗ FAIL" : r.rebaseline > 0 ? "~ DRIFT" : "✓ PASS";
  console.log(`\n  ${status}  ${r.key}  (${r.checks.length} reglas, ${r.hardFail} duras, ${r.rebaseline} drift)`);
  for (const c of fails) {
    console.log(`      ${c.rebaseline ? "~" : "✗"} ${c.rule}: ${c.detail}`);
  }
}

(async () => {
  console.log("════════════════════ GOLDEN SET · runner ════════════════════");

  if (has("--catch-test")) {
    const ok = await runCatchTest();
    process.exit(ok ? 0 : 1);
  }

  let totalHard = 0;
  let totalDrift = 0;

  // ── Tier QUICK (siempre corre) ──────────────────────────────────────────
  console.log("\n─── TIER QUICK (recompute §1, 0 tokens) ───");
  const quick = await runRecomputeTier(sb());
  quick.forEach(printSeed);
  totalHard += quick.reduce((n, r) => n + r.hardFail, 0);
  totalDrift += quick.reduce((n, r) => n + r.rebaseline, 0);

  // ── Tier STR (E.1b · GS-STR, 0 tokens). Corre con --str o --all/--full. ──
  if (has("--str") || has("--all") || MODE_FULL) {
    const str = runStrTier();
    totalHard += str.hard;
    totalDrift += str.drift;
  }

  // ── Tier FULL (opcional) ────────────────────────────────────────────────
  if (MODE_FULL) {
    console.log(`\n─── TIER FULL · generación fresca AUTO (K=${K}) ───`);
    const gen = await runGenerateTier(sb(), K);
    gen.forEach(printSeed);
    totalHard += gen.reduce((n, r) => n + r.hardFail, 0);
    totalDrift += gen.reduce((n, r) => n + r.rebaseline, 0);

    if (!NO_SEM) {
      console.log("\n─── TIER FULL · checklist semántico (juez Opus) ───");
      const sem = await runSemanticTier(sb());
      for (const s of sem) {
        console.log(`\n  ${s.flags.length === 0 ? "✓" : "⚑"} ${s.key} — ${s.flags.length} flags`);
        for (const fl of s.flags) console.log(`      ⚑ [${fl.categoria}] ${fl.detalle}`);
      }
      console.log("\n  (flags semánticos = reporte para Fabrizio, NO bloquean)");
    }
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  console.log("\n════════════════════ RESUMEN ════════════════════");
  console.log(`  fallas duras:        ${totalHard}`);
  console.log(`  drift clase (a):     ${totalDrift} (candidatos a re-baseline)`);
  console.log(totalHard === 0 ? "  ✓ VERDE — sin regresiones estructurales" : "  ✗ ROJO — hay regresiones");
  process.exit(totalHard === 0 ? 0 : 1);
})();
