// Count análisis con input_data.tipoEdificio = 'mixto'.
// Esos rows van a migrarse a 'residencial_puro' antes de eliminar el enum value.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supa
  .from("analisis")
  .select("id, comuna, created_at, input_data")
  .eq("results->>tipoAnalisis", "short-term");

if (error) { console.error(error); process.exit(1); }

const mixtos = (data ?? []).filter((r) => r.input_data?.tipoEdificio === "mixto");

console.log(`Total STR: ${data.length}`);
console.log(`tipoEdificio='mixto': ${mixtos.length}`);
for (const r of mixtos) {
  console.log(`  ${r.id} · ${r.comuna} · ${r.created_at}`);
}
