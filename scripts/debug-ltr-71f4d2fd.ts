// Debug producción: carga LTR del par AMBAS + busca STR hermano + dump input_data.
import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(process.cwd(), '.env.local') });

const LTR_ID = '71f4d2fd-fd98-4e77-a61a-57e018e794a2';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: ltr, error } = await supabase
    .from('analisis')
    .select('*')
    .eq('id', LTR_ID)
    .single();
  if (error) throw error;
  if (!ltr) throw new Error('LTR no encontrado');

  console.log('═══════ LTR ═══════');
  console.log('id:', ltr.id);
  console.log('user_id:', ltr.user_id);
  console.log('created_at:', ltr.created_at);
  console.log('comuna:', ltr.comuna);
  console.log('direccion:', ltr.direccion);
  console.log('precio:', ltr.precio);

  const inp = ltr.input_data as Record<string, unknown>;
  console.log('\n─── input_data keys ───');
  console.log(Object.keys(inp ?? {}).sort().join(', '));
  console.log('\n─── input_data ───');
  console.log(JSON.stringify(inp, null, 2));

  // Buscar STR hermano (mismo user + direccion + ±5 min)
  const created = new Date(ltr.created_at).getTime();
  const minTime = new Date(created - 5 * 60 * 1000).toISOString();
  const maxTime = new Date(created + 5 * 60 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from('analisis')
    .select('id, created_at, results, comuna, direccion')
    .eq('user_id', ltr.user_id)
    .gte('created_at', minTime)
    .lte('created_at', maxTime)
    .neq('id', LTR_ID);

  console.log(`\n═══════ Candidatos STR hermano (±5min, mismo user) ═══════`);
  console.log(`encontrados: ${candidates?.length ?? 0}`);
  for (const c of candidates ?? []) {
    const tipo = (c.results as Record<string, unknown> | null)?.tipoAnalisis ?? '(LTR)';
    console.log(`  ${c.id}  ${c.created_at}  ${tipo}  ${c.direccion?.slice(0, 50)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
