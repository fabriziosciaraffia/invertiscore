// ============================================================================
// GOLDEN SET — runner (CLI orquestador)
// ============================================================================
// Fase 2.0 del sistema. Corre el eval de regresión y reporta matriz pasa/falla.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts [flags]
//     --quick        (default) solo recompute determinístico LTR (0 tokens)
//     --str          agrega el tier STR (GS-STR, BS1-BS8, 0 tokens)
//     --ambas        agrega el tier AMBAS (GS-AMBAS veredicto comparativo D1+D2, 0 tokens)
//     --all          LTR quick + STR + AMBAS (0 tokens)
//     --full         recompute + generación fresca (AUTO) + semántico (LTR + AMBAS)
//     --no-semantic  con --full, salta el juez Opus (solo AUTO)
//     --ambas-semantic  standalone: solo el tier semántico AMBAS (juez Opus, cuesta tokens)
//     --str-semantic    standalone: coherencia modo-gestión STR (determinístico, cuesta tokens de gen)
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
import { runAmbasTier } from "./ambas-recompute";
import { runAmbasSemanticTier } from "./ambas-semantic";
import { runStrSemanticTier } from "./str-semantic";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const kArg = argv.find((a) => a.startsWith("--k="));
const K = kArg ? Math.max(1, parseInt(kArg.split("=")[1], 10) || 2) : 2;
const MODE_FULL = has("--full");
const NO_SEM = has("--no-semantic");
const AMBAS_SEM = has("--ambas-semantic"); // tier semántico AMBAS standalone (cuesta tokens)
const STR_SEM = has("--str-semantic"); // tier coherencia modo-gestión STR standalone (cuesta tokens de gen)

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

async function printAmbasSemantic(sbClient: ReturnType<typeof sb>) {
  console.log("\n─── TIER AMBAS · checklist semántico comparativo (juez Opus) ───");
  const sem = await runAmbasSemanticTier(sbClient);
  const byBanda: Record<string, number> = {};
  for (const s of sem) {
    byBanda[s.bandaCaso] = (byBanda[s.bandaCaso] ?? 0) + 1;
    const head = s.error ? `⚠ ERROR (${s.error})` : `${s.flags.length === 0 ? "✓" : "⚑"} ${s.flags.length} flags`;
    console.log(`\n  ${s.key}  ${s.comuna} · ${s.bandaCaso}${s.flipCaso ? " · flip" : ""} — ${head}`);
    for (const fl of s.flags) console.log(`      ⚑ [${fl.severidad}/${fl.categoria}] ${fl.detalle}`);
  }
  console.log("\n  cobertura por banda:", JSON.stringify(byBanda));
  console.log("  (flags semánticos AMBAS = reporte para Fabrizio, NO bloquean)");
}

async function printStrSemantic() {
  console.log("\n─── TIER STR · coherencia modo-gestión (determinístico, cuesta tokens de gen) ───");
  const sem = await runStrSemanticTier();
  for (const s of sem) {
    const head = s.error ? `⚠ ERROR (${s.error})` : `${s.flags.length === 0 ? "✓" : "⚑"} ${s.flags.length} flags`;
    console.log(`\n  ${s.key}  modo=${s.mode} — ${head}`);
    for (const fl of s.flags) console.log(`      ⚑ [${fl.severidad}/${fl.categoria}] ${fl.detalle}`);
  }
  console.log("\n  (aserción modo-gestión STR = reporte, NO bloquea; test puro, prompts intactos)");
}

(async () => {
  console.log("════════════════════ GOLDEN SET · runner ════════════════════");

  if (has("--catch-test")) {
    const ok = await runCatchTest();
    process.exit(ok ? 0 : 1);
  }

  // Standalone: solo el tier semántico AMBAS (sin correr QUICK/STR/etc.).
  if (AMBAS_SEM && !MODE_FULL) {
    await printAmbasSemantic(sb());
    console.log("\n  (tier semántico AMBAS standalone — no evalúa fallas duras)");
    process.exit(0);
  }

  // Standalone: solo el tier de coherencia modo-gestión STR.
  if (STR_SEM && !MODE_FULL) {
    await printStrSemantic();
    console.log("\n  (tier modo-gestión STR standalone — reporte, no evalúa fallas duras)");
    process.exit(0);
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

  // ── Tier AMBAS (D1+D2 · GS-AMBAS veredicto comparativo, 0 tokens). --ambas o --all/--full. ──
  if (has("--ambas") || has("--all") || MODE_FULL) {
    const ambas = runAmbasTier();
    totalHard += ambas.hard;
    totalDrift += ambas.drift;
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

      // Tier semántico AMBAS (prosa comparativa nueva) — mismo gate que el LTR.
      await printAmbasSemantic(sb());

      // Tier coherencia modo-gestión STR (F6 · audit b) — no-bloqueante.
      await printStrSemantic();
    }
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  console.log("\n════════════════════ RESUMEN ════════════════════");
  console.log(`  fallas duras:        ${totalHard}`);
  console.log(`  drift clase (a):     ${totalDrift} (candidatos a re-baseline)`);
  console.log(totalHard === 0 ? "  ✓ VERDE — sin regresiones estructurales" : "  ✗ ROJO — hay regresiones");
  process.exit(totalHard === 0 ? 0 : 1);
})();
