// ============================================================================
// GOLDEN SET — seed-db (upsert idempotente a Supabase)
// ============================================================================
// Persiste las 10 filas GOLDEN:: por UUID FIJO (upsert onConflict id). Congela
// results = runAnalysis(input, 38800, mediana) y mediana_comuna_snapshot, de modo
// que generateAiAnalysis y el recompute del render lean una fila real e inmutable
// (testing-patterns §1). Idempotente: re-correrlo restaura la fila a la verdad
// del motor actual. Marca nombre="GOLDEN::…" para excluirlas de deletes/regen.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/seed-db.ts
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF, type GoldenSeed, type BordeSeed } from "./seeds";
import { BE_UUID } from "./ids";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

(async () => {
  const { data: users, error: uErr } = await sb.auth.admin.listUsers();
  if (uErr) throw uErr;
  const admin = users?.users.find((u: any) => u.email === "fabriziosciaraffia@gmail.com");
  if (!admin) throw new Error("Admin user no encontrado");

  const all: { key: string; uuid: string; seed: GoldenSeed | BordeSeed }[] = [
    ...GOLDEN_SEEDS.map((s) => ({ key: s.key, uuid: s.uuid, seed: s })),
    ...BORDE_SEEDS.map((s) => ({ key: s.key, uuid: BE_UUID[s.key], seed: s })),
  ];

  for (const { key, uuid, seed } of all) {
    const input = seed.input;
    const results = runAnalysis(input, GOLDEN_UF, seed.mediana);
    const row = {
      id: uuid,
      user_id: admin.id,
      nombre: `GOLDEN::${key} ${input.comuna}`,
      comuna: input.comuna,
      ciudad: input.ciudad ?? "Santiago",
      direccion: input.direccion ?? null,
      tipo: input.tipo ?? "Departamento",
      dormitorios: input.dormitorios,
      banos: input.banos,
      superficie: input.superficie,
      antiguedad: input.antiguedad,
      precio: input.precio,
      arriendo: input.arriendo,
      gastos: input.gastos,
      contribuciones: input.contribuciones ?? 0,
      score: results.score,
      desglose: results.desglose,
      resumen: results.veredicto,
      tipo_analisis: "long-term",
      results: { ...results, tipoAnalisis: "long-term" },
      input_data: { ...input, tipoAnalisis: "long-term" },
      mediana_comuna_snapshot: seed.mediana,
      is_premium: true,
      creator_name: "GOLDEN SET",
    };
    const { error } = await sb.from("analisis").upsert(row, { onConflict: "id" });
    if (error) { console.error(`  ✗ ${key} (${uuid}):`, error.message); continue; }
    console.log(`  ✓ ${key} → ${uuid}  [${results.veredicto} score=${results.score}]`);
  }
  console.log("\nseed-db completo.");
})();
