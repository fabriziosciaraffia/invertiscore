// Ronda 4d — busca un análisis STR con ai_analysis persistido (v1 legacy)
// para validar compat de render en AIInsightSTR.
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
    .select('id, nombre, comuna, results, ai_analysis')
    .order('created_at', { ascending: false })
    .limit(50);

  const strWithAi = (data ?? []).filter((r) => {
    const tipo = (r.results as Record<string, unknown> | null)?.tipoAnalisis;
    const hasAi = !!r.ai_analysis;
    return tipo === 'short-term' && hasAi;
  });

  console.log(`STR con ai_analysis persistido: ${strWithAi.length}`);
  for (const r of strWithAi.slice(0, 5)) {
    const ai = r.ai_analysis as Record<string, unknown>;
    const isV2 = typeof ai.siendoFrancoHeadline_clp === 'string'
      && typeof ai.engineSignal === 'string';
    const shape = isV2 ? 'v2' : 'v1';
    console.log(`  ${r.id}  ${r.comuna}  ${r.nombre}  shape:${shape}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
