// Quick lookup: find a recent STR analysis ID for Playwright testing.
import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data } = await supabase
    .from('analisis')
    .select('id, nombre, comuna, created_at, results, user_id')
    .order('created_at', { ascending: false })
    .limit(50);

  const strs = (data ?? []).filter((r) => {
    const tipo = (r.results as Record<string, unknown> | null)?.tipoAnalisis;
    return tipo === 'short-term';
  });

  console.log(`Encontré ${strs.length} análisis STR (más recientes primero):`);
  for (const r of strs.slice(0, 10)) {
    const projs = (r.results as Record<string, unknown> | null)?.projections as unknown[] | undefined;
    const has4b = Array.isArray(projs) && projs.length > 0;
    console.log(`  ${r.id}  ${r.comuna}  ${r.nombre}  4b:${has4b ? 'sí' : 'no'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
