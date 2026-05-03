/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Spot-check del rename veredicto → engineSignal/francoVerdict.
 *
 * Lee los 3 análisis de auditoría desde Supabase. Estos análisis fueron
 * creados ANTES del rename, así que su JSONB tiene la llave vieja `veredicto`
 * y NO tiene `engineSignal/francoVerdict`. Verifica que los helpers resuelven
 * correctamente el fallback.
 *
 *   npx tsx scripts/audit-spotcheck-verdict.ts
 */

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { readEngineSignal, readFrancoVerdict } from "../src/lib/results-helpers";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const CASOS = [
  { veredictoEsperado: "COMPRAR",          id: "2aa47321-ec4c-4d4e-aac5-95689933105a" },
  { veredictoEsperado: "AJUSTA EL PRECIO", id: "671ed774-4873-41b2-92b2-66086dd0d841" },
  { veredictoEsperado: "BUSCAR OTRA",      id: "860f5607-d469-41f1-a6e8-6288b993fe8c" },
];

let pass = 0;
let fail = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  OK   ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL ${name}`);
    console.error("       ", (e as Error).message);
    fail++;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  for (const c of CASOS) {
    const { data, error } = await supabase
      .from("analisis")
      .select("id, results")
      .eq("id", c.id)
      .single();
    if (error || !data) {
      console.log(`SKIP ${c.id}: no encontrado`);
      fail++;
      continue;
    }

    const results = data.results as any;

    console.log(`\n[${c.veredictoEsperado}] ${c.id}`);
    console.log(`  llaves en JSONB: ${Object.keys(results || {}).filter(k => /veredicto|engineSignal|francoVerdict/.test(k)).join(", ") || "(ninguna llave de veredicto)"}`);

    check(`legacy: results.veredicto presente (análisis pre-rename)`, () => {
      assert.ok(results.veredicto, `esperaba results.veredicto en análisis legacy`);
      assert.equal(results.veredicto, c.veredictoEsperado);
    });

    check(`readEngineSignal devuelve "${c.veredictoEsperado}" desde llave legacy`, () => {
      const v = readEngineSignal(results);
      assert.equal(v, c.veredictoEsperado);
    });

    check(`readFrancoVerdict devuelve "${c.veredictoEsperado}" desde llave legacy`, () => {
      const v = readFrancoVerdict(results);
      assert.equal(v, c.veredictoEsperado);
    });

    check(`francoOverridesEngine = false (mismo valor en ambos helpers)`, () => {
      const overrides = readFrancoVerdict(results) !== readEngineSignal(results);
      assert.equal(overrides, false);
    });
  }

  // Test extra: simular un análisis NUEVO con engineSignal + francoVerdict.
  console.log("\n[NUEVO] simulación de análisis post-rename");
  const nuevoResults = {
    engineSignal: "COMPRAR",
    francoVerdict: "COMPRAR",
    score: 75,
  };
  check("readEngineSignal lee engineSignal directo en análisis nuevos", () => {
    assert.equal(readEngineSignal(nuevoResults), "COMPRAR");
  });
  check("readFrancoVerdict lee francoVerdict directo en análisis nuevos", () => {
    assert.equal(readFrancoVerdict(nuevoResults), "COMPRAR");
  });

  // Test extra: análisis hipotético con divergencia (Fase 3)
  console.log("\n[FASE 3] simulación de divergencia franco-vs-engine");
  const divergente = {
    engineSignal: "COMPRAR",
    francoVerdict: "AJUSTA EL PRECIO",
    score: 75,
  };
  check("francoOverridesEngine = true cuando divergen", () => {
    const overrides = readFrancoVerdict(divergente) !== readEngineSignal(divergente);
    assert.equal(overrides, true);
  });

  console.log("\n────────────────────────────────────");
  console.log(`Total: ${pass + fail}  ·  OK: ${pass}  ·  FAIL: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
