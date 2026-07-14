// ============================================================================
// GOLDEN SET — tier QUICK (recompute determinístico, 0 tokens)
// ============================================================================
// testing-patterns §1: carga la fila PERSISTIDA real desde Supabase, recomputa
// con el path del render (recomputeResultsForLegacy) usando la UF CONGELADA del
// snapshot, y valida clase (a) contra baseline.json + clase (b) estructural +
// B8 (veredicto persistido == recompute). NO llama al LLM.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "fs";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { extractFacts } from "./extract";
import { checkClassA, checkClassB, type Baseline, type Check } from "./invariants";
import { BE_UUID } from "./ids";

export interface SeedReport {
  key: string;
  checks: Check[];
  hardFail: number;      // fallas estructurales / duras (bloquean)
  rebaseline: number;    // drift de cifra clase (a) → candidato a re-baseline
}

function loadBaseline(): Record<string, Baseline> {
  const raw = JSON.parse(readFileSync(join(__dirname, "baseline.json"), "utf8"));
  return raw.seeds as Record<string, Baseline>;
}

const frozenUF = (row: any): number => {
  const p = row?.results?.metrics?.precioCLP;
  const uf = row?.input_data?.precio;
  const derived = p && uf ? Math.round(p / uf) : NaN;
  return Number.isFinite(derived) && derived > 0 ? derived : GOLDEN_UF;
};

export async function runRecomputeTier(sb: SupabaseClient): Promise<SeedReport[]> {
  const baseline = loadBaseline();
  const all = [
    ...GOLDEN_SEEDS.map((s) => ({ key: s.key, uuid: s.uuid })),
    ...BORDE_SEEDS.map((s) => ({ key: s.key, uuid: BE_UUID[s.key] })),
  ];
  const reports: SeedReport[] = [];

  for (const { key, uuid } of all) {
    const checks: Check[] = [];
    const { data: row, error } = await sb.from("analisis").select("*").eq("id", uuid).single();
    if (error || !row) {
      checks.push({ rule: "§1.load", pass: false, detail: `fila ${uuid} no cargó: ${error?.message}` });
      reports.push({ key, checks, hardFail: 1, rebaseline: 0 });
      continue;
    }
    checks.push({ rule: "§1.load", pass: true, detail: `fila persistida cargada` });

    const input = row.input_data;
    const mediana = row.mediana_comuna_snapshot ?? undefined;
    const uf = frozenUF(row);
    checks.push({ rule: "uf.congelada", pass: uf === GOLDEN_UF, detail: `UF=${uf}` });

    // Path del render: recompute con UF congelada (no getUFValue viva).
    const recomputed = recomputeResultsForLegacy(input, uf, mediana, GOLDEN_ASOF);
    const facts = extractFacts(recomputed, input.precio);

    // Clase (a) vs baseline congelado.
    const base = baseline[key];
    if (!base) checks.push({ rule: "a.baseline", pass: false, detail: `sin baseline para ${key}` });
    else checks.push(...checkClassA(facts, base));

    // Clase (b) estructural.
    checks.push(...checkClassB(recomputed, facts, {
      arriendo: input.arriendo,
      totalAportado: recomputed.exitScenario?.totalAportado ?? null,
      medianaConfiable: !!(mediana && typeof mediana.mediana === "number" && mediana.mediana > 0),
    }));

    // B8 — veredicto persistido == recompute (idempotencia del motor sobre la fila real).
    checks.push({ rule: "B8.persist==recompute", pass: row.results?.veredicto === recomputed.veredicto, detail: `persist=${row.results?.veredicto} recompute=${recomputed.veredicto}` });

    const hardFail = checks.filter((c) => !c.pass && !c.rebaseline).length;
    const rebaseline = checks.filter((c) => !c.pass && c.rebaseline).length;
    reports.push({ key, checks, hardFail, rebaseline });
  }
  return reports;
}
