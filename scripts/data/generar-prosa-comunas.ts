/**
 * Generador de la prosa de Franco por comuna (páginas /comunas/[slug]), a mano.
 *
 *   node --env-file=.env.local --import tsx scripts/data/generar-prosa-comunas.ts [--dry] [--todas] [--solo=slug]
 *
 * Desde el 20-oct-2026 lo mismo corre solo cada lunes (/api/cron/prosa-comunas). Este script queda para correrlo a
 * mano: un bump del prompt (`--todas`), una comuna puntual (`--solo=`), o un ensayo (`--dry`, genera y controla sin
 * guardar). La lógica es UNA para los dos: `regenerarProsas` (src/lib/data/comuna-prosa-generador.ts) —solo lo que el
 * detector marca desfasado, todos los controles, un reintento con lo rechazado, y la anterior si vuelve a fallar—.
 *
 * NUNCA corre en render. La página lee la fila; si no hay, cae a su síntesis calculada, que dice menos pero no miente.
 *
 * Costo medido el 20-oct-2026 (v6, las 25 con `--todas`): 38 llamadas, 97.101 tokens de entrada y 10.600 de salida
 * (~US$0,45 con claude-sonnet-4-6). Detalle en src/app/api/cron/prosa-comunas/route.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { esComunaDelRoster } from "@/lib/data/comunas-roster";
import { getAllComunasStats } from "@/lib/data/comunas-seo";
import { getTodasLasProsas } from "@/lib/data/comuna-prosa";
import { generadorAnthropic, regenerarProsas } from "@/lib/data/comuna-prosa-generador";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TODAS = args.includes("--todas");
const SOLO = args.find((a) => a.startsWith("--solo="))?.split("=")[1] ?? null;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const [todas, prosas] = await Promise.all([getAllComunasStats(), getTodasLasProsas()]);
  const parque = todas.filter((s) => esComunaDelRoster(s.slug));
  if (SOLO && !esComunaDelRoster(SOLO)) {
    console.error(`slug desconocido: ${SOLO}`);
    process.exit(1);
  }
  const r = await regenerarProsas({
    parque,
    prosas,
    generar: generadorAnthropic(new Anthropic()),
    guardar: async (fila) => {
      const { error } = await supabase.from("comuna_prosa").upsert(fila, { onConflict: "slug" });
      if (error) throw new Error(error.message);
    },
    todas: TODAS,
    solo: SOLO,
    dry: DRY,
    concurrencia: 4,
    informar: (linea) => console.log(linea),
  });
  for (const s of r.sinStats) console.log(`  ---  ${s.padEnd(18)} sin stats esta semana, no se genera`);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  regeneradas ${r.regeneradas.length} · al día ${r.intactas.length} · rechazadas ${r.rechazadas.length}${DRY ? "  (DRY: nada se escribió)" : ""}`);
  console.log(`  llamadas ${r.llamadas} · tokens: ${r.tokens.entrada} in · ${r.tokens.salida} out`);
  if (r.rechazadas.length > 0) process.exit(1);
}

main();
