// Ronda 4b — smoke test de persistencia.
// 1) Corre calcShortTerm con caso sintético.
// 2) Inserta el `result` en `analisis` con cliente service-role (mismo shape
//    que la ruta /api/analisis/short-term).
// 3) Lee la fila persistida y verifica que projections + exitScenario +
//    engineSignal + francoVerdict estén en el JSON guardado.
// 4) DELETE para no dejar basura.

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { calcShortTerm, type ShortTermInputs, type AirbnbData } from '../src/lib/engines/short-term-engine';

config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const airbnbData: AirbnbData = {
  estimated_adr: 75000,
  estimated_occupancy: 0.72,
  estimated_annual_revenue: 19_710_000,
  percentiles: {
    revenue: { p25: 14_500_000, p50: 19_710_000, p75: 24_900_000, p90: 30_500_000, avg: 19_900_000 },
    occupancy: { p25: 0.55, p50: 0.72, p75: 0.85, p90: 0.92, avg: 0.72 },
    average_daily_rate: { p25: 60000, p50: 75000, p75: 90000, p90: 105000, avg: 75000 },
  },
  monthly_revenue: [0.075, 0.07, 0.07, 0.075, 0.085, 0.090, 0.105, 0.110, 0.090, 0.085, 0.075, 0.070],
  currency: 'CLP',
};

const inputs: ShortTermInputs = {
  precioCompra: 165_000_000,
  superficie: 42,
  dormitorios: 1,
  banos: 1,
  piePercent: 0.20,
  tasaCredito: 0.045,
  plazoCredito: 25,
  airbnbData,
  modoGestion: 'auto',
  comisionAdministrador: 0.20,
  costoElectricidad: 35000,
  costoAgua: 8000,
  costoWifi: 22000,
  costoInsumos: 20000,
  gastosComunes: 70000,
  mantencion: 11000,
  contribuciones: 180000,
  costoAmoblamiento: 3_500_000,
  arriendoLargoMensual: 750_000,
  valorUF: 38800,
};

async function main() {
  const result = calcShortTerm(inputs);

  // Buscar un user_id real (cualquiera) para no violar FK.
  const { data: users, error: usersErr } = await supabase
    .from('analisis')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1);
  if (usersErr) throw usersErr;
  const user_id = users?.[0]?.user_id;
  if (!user_id) throw new Error('No hay user_id disponible para FK; crea un análisis primero.');

  const insertPayload = {
    user_id,
    nombre: '[smoke 4b] Renta Corta - Test',
    comuna: 'Providencia',
    ciudad: 'Santiago',
    direccion: null,
    tipo: 'Departamento',
    dormitorios: 1,
    banos: 1,
    superficie: 42,
    antiguedad: 0,
    precio: Math.round(inputs.precioCompra / inputs.valorUF),
    arriendo: inputs.arriendoLargoMensual,
    gastos: inputs.gastosComunes,
    contribuciones: inputs.contribuciones,
    score: 65,
    desglose: {},
    resumen: result.veredicto,
    results: { ...result, tipoAnalisis: 'short-term', veredicto: result.veredicto },
    input_data: { tipoAnalisis: 'short-term', smoke: '4b' },
    is_premium: false,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('analisis')
    .insert(insertPayload)
    .select()
    .single();
  if (insertErr) throw insertErr;
  if (!inserted) throw new Error('Insert sin retorno');

  console.log('=== INSERTED ===');
  console.log('id:', inserted.id);

  // Leer de vuelta para confirmar persistencia
  const { data: row, error: readErr } = await supabase
    .from('analisis')
    .select('id, results')
    .eq('id', inserted.id)
    .single();
  if (readErr) throw readErr;
  if (!row?.results) throw new Error('results vacío en BD');

  const r = row.results as Record<string, unknown>;
  const projections = r.projections as Array<Record<string, unknown>> | undefined;
  const exitScenario = r.exitScenario as Record<string, unknown> | undefined;

  const checks = {
    'has_projections_array': Array.isArray(projections),
    'projections_length_10': projections?.length === 10,
    'has_exitScenario_obj': exitScenario && typeof exitScenario === 'object',
    'has_engineSignal': typeof r.engineSignal === 'string',
    'has_francoVerdict': typeof r.francoVerdict === 'string',
    'engineSignal_eq_veredicto': r.engineSignal === r.veredicto,
    'projections_y10_patrimonio_positive': typeof projections?.[9]?.patrimonioNeto === 'number' && (projections[9].patrimonioNeto as number) > 0,
    'exit_tirAnual_is_number': typeof exitScenario?.tirAnual === 'number',
  };

  console.log('=== PERSISTENCE CHECKS ===');
  console.log(JSON.stringify(checks, null, 2));
  const allPass = Object.values(checks).every(Boolean);
  console.log('all_checks_pass:', allPass);

  console.log('\n=== SAMPLE — projections[9] (año 10) ===');
  console.log(JSON.stringify(projections?.[9], null, 2));
  console.log('\n=== SAMPLE — exitScenario ===');
  console.log(JSON.stringify(exitScenario, null, 2));
  console.log('\n=== TOP-LEVEL veredicto / engineSignal / francoVerdict ===');
  console.log(JSON.stringify({ veredicto: r.veredicto, engineSignal: r.engineSignal, francoVerdict: r.francoVerdict }, null, 2));

  // Cleanup
  const { error: delErr } = await supabase.from('analisis').delete().eq('id', inserted.id);
  if (delErr) throw delErr;
  console.log('\n=== CLEANUP === deleted id', inserted.id);

  if (!allPass) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
