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
//     --seed=ID[,ID] acota los tiers POR SEED (quick, full AUTO, semántico) a esas
//                    claves. NO altera QUÉ tiers corren: los catch-tests siguen
//                    corriendo siempre (cuestan 0) y STR/AMBAS siguen su propia regla
//                    (--str, --ambas, --ltr-only). Para acotar el COSTO de un --full
//                    hay que combinarlo: --seed=GS-7 --ltr-only --no-semantic.
//                    Claves válidas: las 10 GS-* + 3 BE-* de LTR (seeds.ts) y las
//                    GE-* + BE-*-str de STR (str-seeds.ts).
//                    Una clave de LTR deja los tiers STR en cero y al revés, así que
//                    el filtro EXIGE acotar la modalidad: --seed=GS-7 pide --ltr-only
//                    y --seed=GE-2 pide --str-only. Si no, la capa 2 lo pone en rojo
//                    en vez de correr cero y reportar verde.
//     --catch-test   auto-test: rompe invariantes en memoria y verifica que FALLA
//
// Exit code 0 solo si no hay fallas duras. Drift de cifra clase (a) → warning
// (candidato a re-baseline, no bloquea).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { runRecomputeTier, type SeedReport } from "./recompute";
import { GOLDEN_SEEDS, BORDE_SEEDS } from "./seeds";
import { STR_GE_SEEDS } from "./str-seeds";
import { runCatchTest } from "./catch-test";
import { runGenerateTier } from "./generate";
import { runSemanticTier } from "./semantic";
import { runStrTier } from "./str-recompute";
import { runEtiquetaTier } from "./etiqueta-veredicto-catch-test";
import { runTitularFinalTier } from "./titular-final-catch-test";
import { runInstrumentosTier } from "./instrumentos-catch-test";
import { runMesVacioTier } from "./mes-vacio-catch-test";
import { runRegulacionTier } from "./regulacion-catch-test";
import { runPlusvaliaGlosaTier } from "./plusvalia-glosa-catch-test";
import { runRespaldoArriendoTier } from "./respaldo-arriendo-catch-test";
import { runDistanciaComprarTier } from "./distancia-comprar-catch-test";
import { runMixPalancasTier } from "./mix-palancas-catch-test";
import { runMixStrTier } from "./mix-str-catch-test";
import { runLoQueHariaYoTier } from "./lo-que-haria-yo-catch-test";
import { runSalidaPorMixTier } from "./salida-por-mix-catch-test";
import { runEscalaSuperficiesTier } from "./escala-superficies-catch-test";
import { runTipografiaRedisenoTier } from "./tipografia-rediseno-catch-test";
import { runPaletaRedisenoTier } from "./paleta-rediseno-catch-test";
import { runRadiosSombrasTier } from "./radios-sombras-catch-test";
import { runEstructuraRedisenoTier } from "./estructura-rediseno-catch-test";
import { runHeroRedisenoTier } from "./hero-rediseno-catch-test";
import { runRecomendacionRedisenoTier } from "./recomendacion-rediseno-catch-test";
import { runInterruptorRedisenoTier } from "./interruptor-rediseno-catch-test";
import { runBajadaNoMienteTier } from "./bajada-no-miente-catch-test";
import { runAlternativaComunasTier } from "./alternativa-comunas-catch-test";
import { runCandadoTier } from "./candado-catch-test";
import { runGeneradorEnScriptsTier } from "./generador-en-scripts-catch-test";
import { runStrGenerateTier, type TandaStr } from "./str-generate";
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
// --dump=<dir>: guarda cada generación LTR del tier FULL; --from=<dir>: reutiliza esas
// salidas (checks + juez sobre la MISMA prosa, cero tokens de generación).
// --ltr-only: en FULL, salta la generación STR y los jueces AMBAS/STR.
// --str-only: en FULL, salta la generación LTR, su juez y AMBAS: corre SOLO la tanda STR
//   (generación fresca de los seis GE + juez Opus con el criterio del lead-coronado).
const DUMP = argv.find((a) => a.startsWith("--dump="))?.slice("--dump=".length);
const FROM = argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
const LTR_ONLY = has("--ltr-only");
const STR_ONLY = has("--str-only");

// ── --seed: filtro de seeds, resuelto UNA vez y validado acá ────────────────
// Reemplaza al `--solo=` que `generate.ts` leía por su cuenta desde process.argv:
// indocumentado, sin validar y respetado por un solo tier.
const seedArg = argv.find((a) => a.startsWith("--seed="));
const SEED_FILTRO: Set<string> | null = seedArg
  ? new Set(seedArg.slice("--seed=".length).split(",").map((x) => x.trim()).filter(Boolean))
  : null;
const CLAVES_LTR = [...GOLDEN_SEEDS.map((x) => x.key), ...BORDE_SEEDS.map((x) => x.key)];
const CLAVES_STR = STR_GE_SEEDS.map((x) => x.key);
const CLAVES_SEED = [...CLAVES_LTR, ...CLAVES_STR];

// EL NAMESPACE DEL FILTRO DECIDE LA MODALIDAD. Nombrar solo seeds STR no es una falla
// de los tiers LTR: es el filtro funcionando, y esos tiers no tienen nada que hacer. Se
// SALTAN diciéndolo (nunca en silencio), y la capa 2 queda para la falla de verdad —
// una clave de la modalidad correcta que igual deja el tier en cero, como `BE-caprate`
// en el FULL AUTO de LTR.
const FILTRO_SOLO_LTR = !!SEED_FILTRO && [...SEED_FILTRO].every((k) => CLAVES_LTR.includes(k));
const FILTRO_SOLO_STR = !!SEED_FILTRO && [...SEED_FILTRO].every((k) => CLAVES_STR.includes(k));

/** Los tiers por seed de la modalidad que el filtro no nombra se saltan, con línea. */
function saltadoPorFiltro(tier: string, esDeStr: boolean): boolean {
  if (!SEED_FILTRO) return false;
  const salta = esDeStr ? FILTRO_SOLO_LTR : FILTRO_SOLO_STR;
  if (salta) console.log(`\n─── ${tier} — SALTADO: el filtro --seed nombra solo seeds de ${esDeStr ? "LTR" : "STR"} ───`);
  return salta;
}

/** CAPA 1 de validación: una clave que no existe muere ANTES de tocar la base o gastar
 *  un token. Sin esto, un ID mal escrito recorre cero seeds y la tanda reporta verde. */
function validarFiltroSeed(): void {
  if (!SEED_FILTRO) return;
  if (SEED_FILTRO.size === 0) {
    console.error("\n✗ --seed= vino vacío. Claves válidas:\n   " + CLAVES_SEED.join(" "));
    process.exit(1);
  }
  const invalidas = [...SEED_FILTRO].filter((k) => !CLAVES_SEED.includes(k));
  if (invalidas.length > 0) {
    console.error(`\n✗ --seed: clave(s) inexistente(s): ${invalidas.join(", ")}`);
    console.error("   LTR:\n   " + CLAVES_LTR.join(" "));
    console.error("   STR:\n   " + CLAVES_STR.join(" "));
    process.exit(1);
  }
}

/** CAPA 2: cero seeds tras filtrar es FALLA DURA, por tier. Hace falta además de la
 *  capa 1 porque los tiers no comparten universo: `BE-caprate` es válida en el QUICK
 *  (que recorre GOLDEN + BORDE) y no existe en el tier FULL (solo GOLDEN). Sin este
 *  chequeo, `--seed=BE-caprate --full` pasaba la validación y corría cero generaciones
 *  reportando verde. */
function ceroSeedsEsFalla(tier: string, corridas: number): number {
  if (!SEED_FILTRO || corridas > 0) return 0;
  console.log(`\n  ✗ ${tier}: --seed=${[...SEED_FILTRO].join(",")} no dejó NINGUNA seed en este tier.`);
  console.log(`      El tier corrió y no probó nada. La clave es de esta modalidad pero no está en el`);
  console.log(`      universo de ESTE tier: el FULL AUTO de LTR solo conoce las GS-*, no las BE-*.`);
  return 1;
}

/** La línea de TANDA ACOTADA. Va en el encabezado Y pegada al veredicto: en una corrida
 *  larga el encabezado queda fuera de pantalla y lo último que se lee es el verde. */
function lineaTandaAcotada(): void {
  if (!SEED_FILTRO) return;
  const claves = [...SEED_FILTRO].join(",");
  const enQuick = CLAVES_LTR.filter((k) => SEED_FILTRO.has(k)).length;
  const enFull = GOLDEN_SEEDS.filter((x) => SEED_FILTRO.has(x.key)).length;
  const enStr = CLAVES_STR.filter((k) => SEED_FILTRO.has(k)).length;
  console.log(`\n⚠ TANDA ACOTADA · --seed=${claves} — QUICK ${enQuick} de ${CLAVES_LTR.length} · FULL LTR ${enFull} de ${GOLDEN_SEEDS.length} · STR ${enStr} de ${CLAVES_STR.length}`);
  console.log("  El verde NO cubre las otras seeds.");
}

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

function printTandaStr(tanda: TandaStr[]) {
  console.log("\n─── TANDA STR · lead del hero vs hallazgo coronado (juez Opus, reporte) ───");
  for (const t of tanda) {
    console.log(`\n  ${t.key}  ${t.veredicto}/${t.score} · 01 ${t.coronadoId ?? "—"}${t.coronadoTitular ? ` «${t.coronadoTitular}»` : ""}`);
    console.log(`      lead: ${t.lead.replace(/\s+/g, " ").slice(0, 320)}${t.lead.length > 320 ? "…" : ""}`);
    if (t.error) console.log(`      ⚠ juez: ${t.error}`);
    for (const fl of t.flags) console.log(`      ⚑ [${fl.severidad}/${fl.categoria}] ${fl.detalle}`);
    if (!t.error && t.flags.length === 0) console.log("      ✓ sin flags");
  }
  console.log("\n  (flags del juez STR = reporte para Fabrizio, NO bloquean; AS1-AS5 sí)");
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
  validarFiltroSeed();
  lineaTandaAcotada();

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

  // ── Tier QUICK (corre siempre, salvo que el filtro sea solo de STR) ─────
  if (!saltadoPorFiltro("TIER QUICK", false)) {
    console.log("\n─── TIER QUICK (recompute §1, 0 tokens) ───");
    const quick = await runRecomputeTier(sb(), { seeds: SEED_FILTRO });
    quick.forEach(printSeed);
    totalHard += quick.reduce((n, r) => n + r.hardFail, 0);
    totalDrift += quick.reduce((n, r) => n + r.rebaseline, 0);
    totalHard += ceroSeedsEsFalla("TIER QUICK", quick.length);
  }

  // ── Tier ETIQUETA (goal 10a · 07-sep-2026, 0 tokens): ningún literal de etiqueta de
  // veredicto fuera de src/lib/veredicto-etiqueta.ts. Corre siempre con el QUICK. ──
  totalHard += runEtiquetaTier().hard;

  // ── Tier TITULAR (goal #8 · 07-sep-2026, 0 tokens): el titular final de portada nunca
  // queda vacío (titular-final.ts: reescrito → escalón → motor). Corre siempre con el QUICK. ──
  totalHard += runTitularFinalTier().hard;

  // ── Tier INSTRUMENTOS (#11 · 07-sep-2026, 0 tokens): el matcher A8·D1 acepta los
  // wordings legítimos del instrumento y rechaza el género. Corre siempre con el QUICK. ──
  totalHard += runInstrumentosTier().hard;

  // ── Tier MES VACÍO (v21.1 · 09-sep-2026, 0 tokens): el escenario de vacancia en plata
  // lo pone el MOTOR (cierre del capítulo II) con la aritmética completa — dividendo +
  // gastos comunes COMPLETOS + contribuciones del mes. Reemplaza a A-PC2.vacancia, que
  // lo exigía en la prosa y se retiró con acta. Corre siempre con el QUICK. ──
  totalHard += runMesVacioTier().hard;

  // ── Tier REGULACIÓN (09-sep-2026, 0 tokens): el bloque determinista que dice si el
  // edificio permite operar por día, con el amoblamiento en riesgo. Reemplaza al bloque
  // `riesgos` del schema STR, retirado con acta: de las nueve familias de riesgo que el
  // modelo escribía, ocho ya las dibuja el motor y esta era la única sin cubrir.
  // Corre siempre con el QUICK. ──
  totalHard += runRegulacionTier().hard;
  totalHard += runPlusvaliaGlosaTier().hard;
  totalHard += runRespaldoArriendoTier().hard;
  totalHard += runDistanciaComprarTier().hard;
  totalHard += runMixPalancasTier().hard;
  // ── Tier MIX STR (11-sep-2026, 0 tokens, sin base): el builder STR emite el mismo mix
  // que LTR a través del adaptador UF→CLP / %→decimal; destino = escalón, tope 25/15,
  // redundancia con palanca sola y «sin salida» coherente. Corre siempre con el QUICK. ──
  totalHard += runMixStrTier().hard;
  totalHard += runLoQueHariaYoTier().hard;
  totalHard += runSalidaPorMixTier().hard;
  totalHard += runEscalaSuperficiesTier().hard;
  totalHard += runTipografiaRedisenoTier().hard;
  totalHard += runPaletaRedisenoTier().hard;
  totalHard += runRadiosSombrasTier().hard;
  totalHard += runEstructuraRedisenoTier().hard;
  totalHard += runHeroRedisenoTier().hard;
  totalHard += runRecomendacionRedisenoTier().hard;
  totalHard += runInterruptorRedisenoTier().hard;
  totalHard += runBajadaNoMienteTier().hard;
  totalHard += runAlternativaComunasTier().hard;

  // ── Tier CANDADO (goal #3 · 07-sep-2026, 0 tokens, sin base): generating_since solo
  // se escribe en candado-generacion.ts; dos tomas → una gana; TTL vence. Siempre con el QUICK. ──
  totalHard += (await runCandadoTier()).hard;

  // ── Tier INSTRUMENTO (07-sep-2026, 0 tokens): ningún call site del generador en scripts/
  // escribe en la base sin declararlo (persist:false o trigger). Corre siempre con el QUICK. ──
  totalHard += runGeneradorEnScriptsTier().hard;

  // ── Tier STR (E.1b · GS-STR, 0 tokens). Corre con --str o --all/--full. ──
  if ((has("--str") || has("--all") || MODE_FULL) && !saltadoPorFiltro("TIER STR · recompute", true)) {
    const str = runStrTier({ seeds: SEED_FILTRO });
    totalHard += str.hard;
    totalDrift += str.drift;
    totalHard += ceroSeedsEsFalla("TIER STR · recompute", str.corridas);
  }

  // ── Tier AMBAS (D1+D2 · GS-AMBAS veredicto comparativo, 0 tokens). --ambas o --all/--full. ──
  if (has("--ambas") || has("--all") || MODE_FULL) {
    const ambas = runAmbasTier();
    totalHard += ambas.hard;
    totalDrift += ambas.drift;
  }

  // ── Tier FULL (opcional) ────────────────────────────────────────────────
  if (MODE_FULL) {
    if (!STR_ONLY && !saltadoPorFiltro("TIER FULL · AUTO LTR", false)) {
      console.log(`\n─── TIER FULL · generación fresca AUTO (K=${K}) ───`);
      const gen = await runGenerateTier(sb(), K, { dump: DUMP, from: FROM, seeds: SEED_FILTRO });
      gen.forEach(printSeed);
      totalHard += gen.reduce((n, r) => n + r.hardFail, 0);
      totalDrift += gen.reduce((n, r) => n + r.rebaseline, 0);
      totalHard += ceroSeedsEsFalla("TIER FULL · AUTO", gen.length);
    }

    // Tier STR generación fresca (FASE 2 dictamen · refuerzo 1) — BLOQUEANTE: los seis
    // GE con checks AUTO duros (AS1-AS5) y, salvo --no-semantic, el juez Opus por corrida
    // con el criterio del lead-coronado (flags = reporte, no bloquean). Antes la única gen
    // STR era el tier modo-gestión, no-bloqueante — un cambio de prompt STR corría sin red.
    if (!LTR_ONLY && !saltadoPorFiltro("TIER FULL · AUTO STR", true)) {
      console.log(`\n─── TIER FULL · generación fresca STR AUTO (K=${K}, BLOQUEANTE${NO_SEM ? "" : " + juez"}) ───`);
      const genStr = await runStrGenerateTier(K, {
        dump: DUMP,
        judge: !NO_SEM,
        // `runStrGenerateTier` ya aceptaba `seeds` desde su primera versión y el runner
        // nunca se lo pasaba: acotar la tanda STR era imposible desde el CLI.
        seeds: SEED_FILTRO ? [...SEED_FILTRO] : undefined,
      });
      genStr.reports.forEach(printSeed);
      totalHard += genStr.reports.reduce((n, r) => n + r.hardFail, 0);
      totalHard += ceroSeedsEsFalla("TIER FULL · AUTO STR", genStr.reports.length);
      printTandaStr(genStr.tanda);
    }

    if (!NO_SEM && !STR_ONLY && !saltadoPorFiltro("TIER FULL · semántico LTR", false)) {
      console.log("\n─── TIER FULL · checklist semántico (juez Opus) ───");
      const sem = await runSemanticTier(sb(), { from: FROM ?? DUMP, seeds: SEED_FILTRO });
      for (const s of sem) {
        console.log(`\n  ${s.flags.length === 0 ? "✓" : "⚑"} ${s.key} — ${s.flags.length} flags`);
        for (const fl of s.flags) console.log(`      ⚑ [${fl.categoria}] ${fl.detalle}`);
      }
      console.log("\n  (flags semánticos = reporte para Fabrizio, NO bloquean)");
      totalHard += ceroSeedsEsFalla("TIER FULL · semántico", sem.length);

      if (!LTR_ONLY) {
        // Tier semántico AMBAS (prosa comparativa nueva) — mismo gate que el LTR.
        await printAmbasSemantic(sb());

        // Tier coherencia modo-gestión STR (F6 · audit b) — no-bloqueante.
        await printStrSemantic();
      }
    }
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  console.log("\n════════════════════ RESUMEN ════════════════════");
  console.log(`  fallas duras:        ${totalHard}`);
  console.log(`  drift clase (a):     ${totalDrift} (candidatos a re-baseline)`);
  console.log(totalHard === 0 ? "  ✓ VERDE — sin regresiones estructurales" : "  ✗ ROJO — hay regresiones");
  lineaTandaAcotada();
  process.exit(totalHard === 0 ? 0 : 1);
})();
