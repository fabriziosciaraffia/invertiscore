// Invalida ai_analysis cacheado de TODOS los análisis STR.
// Tras el fix de voz (Prompt A), los outputs persistidos contienen voseo.
// Este script setea ai_analysis = NULL para que se regeneren on-demand.
//
// REGLAS DE EJECUCIÓN:
//   • Solo afecta input_data.tipoOperacion === "short-term"
//   • NUNCA toca LTR
//   • Confirmación interactiva obligatoria — no auto-ejecuta
//   • Lista IDs antes de aplicar el update
//   • Re-verifica conteos después
//
// Ejecución manual cuando el prompt nuevo esté en producción:
//   npx tsx scripts/invalidate-str-ai-cache.ts

import { config } from 'dotenv';
import path from 'path';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('=== Invalidación de ai_analysis para análisis STR ===\n');

  // 1. SELECT — el filtro vive en aplicación, no en query, porque el operador
  //    ->> de Supabase JS no es 100% confiable con jsonb anidado y queremos
  //    poder doble-chequear con results.tipoAnalisis también.
  const { data: rows, error: selectErr } = await supabase
    .from('analisis')
    .select('id, nombre, comuna, created_at, input_data, results, ai_analysis')
    .not('ai_analysis', 'is', null);

  if (selectErr) {
    console.error('Supabase SELECT error:', selectErr);
    process.exit(1);
  }

  const targets = (rows ?? []).filter((r) => {
    const tipoInput = (r.input_data as Record<string, unknown> | null)?.tipoOperacion;
    const tipoResults = (r.results as Record<string, unknown> | null)?.tipoAnalisis;
    return tipoInput === 'short-term' || tipoResults === 'short-term';
  });

  console.log(`Total análisis con ai_analysis no nulo: ${rows?.length ?? 0}`);
  console.log(`De esos, STR (short-term): ${targets.length}\n`);

  if (targets.length === 0) {
    console.log('Nada que invalidar. Saliendo.');
    return;
  }

  console.log('IDs a invalidar:');
  for (const t of targets) {
    console.log(`  ${t.id}  ${t.comuna ?? '—'}  ${t.nombre ?? '—'}  (creado ${t.created_at?.slice(0, 10) ?? '—'})`);
  }
  console.log();

  const answer = await ask(`¿Invalidar ai_analysis en ${targets.length} análisis STR? (yes/no): `);
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelado. Sin cambios.');
    return;
  }

  // 2. UPDATE — uno por uno por seguridad. Si falla a mitad, sabemos cuáles
  //    quedaron afectados.
  let success = 0;
  let failed = 0;
  for (const t of targets) {
    const { error: updErr } = await supabase
      .from('analisis')
      .update({ ai_analysis: null })
      .eq('id', t.id);
    if (updErr) {
      console.error(`  ✗ ${t.id} — ${updErr.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${t.id}`);
      success++;
    }
  }

  console.log(`\nResumen: ${success} invalidados, ${failed} fallaron.`);

  // 3. Verificación post-update
  const { data: postCheck } = await supabase
    .from('analisis')
    .select('id')
    .in('id', targets.map((t) => t.id))
    .not('ai_analysis', 'is', null);

  const remainingWithAi = postCheck?.length ?? 0;
  console.log(`Verificación: ${remainingWithAi} análisis STR todavía tienen ai_analysis (debería ser 0 si todo OK).`);
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
