// Ronda 4c — seed de análisis STR completo para validación visual v2.
// Inserta un análisis con ShortTermResult (incluye projections + exitScenario
// de Ronda 4b) + un FrancoScoreSTR mock (estructura mínima para que el client
// renderee el score y veredicto).
//
// Deja el análisis en BD: imprime el ID + URL. Para limpiar, borrar manualmente.

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { calcShortTerm, type ShortTermInputs, type AirbnbData } from '../src/lib/engines/short-term-engine';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

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

  // Buscar un user_id real (cualquiera) para FK.
  const { data: anyUser } = await supabase
    .from('analisis')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1);
  const user_id = anyUser?.[0]?.user_id;
  if (!user_id) throw new Error('No hay user_id disponible');

  // FrancoScore mock — estructura mínima para que el client lo lea (score + veredicto).
  const francoScore = {
    score: 72,
    veredicto: result.veredicto,
    desglose: {
      rentabilidad: { score: 75, label: 'Rentabilidad', detail: '' },
      sostenibilidad: { score: 70, label: 'Sostenibilidad', detail: '' },
      ventaja: { score: 78, label: 'Ventaja vs LTR', detail: '' },
      factibilidad: { score: 65, label: 'Factibilidad', detail: '' },
    },
  };

  const body = {
    precioCompra: inputs.precioCompra,
    precioCompraUF: Math.round(inputs.precioCompra / inputs.valorUF),
    dormitorios: inputs.dormitorios,
    banos: inputs.banos,
    superficieUtil: inputs.superficie,
    comuna: 'Providencia',
    ciudad: 'Santiago',
    direccion: 'Pedro de Valdivia 1234, Providencia',
    tipoPropiedad: 'usado',
    edificioPermiteAirbnb: 'no_seguro',
    modoGestion: inputs.modoGestion,
    comisionAdministrador: inputs.comisionAdministrador,
    piePercent: inputs.piePercent,
    tasaCredito: inputs.tasaCredito,
    plazoCredito: inputs.plazoCredito,
    arriendoLargoMensual: inputs.arriendoLargoMensual,
    gastosComunes: inputs.gastosComunes,
    contribuciones: inputs.contribuciones,
    costoAmoblamiento: inputs.costoAmoblamiento,
  };

  const { data: inserted, error } = await supabase
    .from('analisis')
    .insert({
      user_id,
      nombre: '[seed 4c] Pedro de Valdivia 1234',
      comuna: 'Providencia',
      ciudad: 'Santiago',
      direccion: body.direccion,
      tipo: 'Departamento',
      dormitorios: body.dormitorios,
      banos: body.banos,
      superficie: body.superficieUtil,
      antiguedad: 5,
      precio: body.precioCompraUF,
      arriendo: body.arriendoLargoMensual,
      gastos: body.gastosComunes,
      contribuciones: body.contribuciones,
      score: francoScore.score,
      desglose: francoScore.desglose,
      resumen: francoScore.veredicto,
      results: { ...result, tipoAnalisis: 'short-term', veredicto: francoScore.veredicto, francoScore },
      input_data: { ...body, tipoAnalisis: 'short-term' },
      is_premium: true,
    })
    .select()
    .single();

  if (error) throw error;
  if (!inserted) throw new Error('Insert sin retorno');

  console.log('Análisis seed creado:');
  console.log('  ID :', inserted.id);
  console.log('  URL:', `http://localhost:3000/analisis/renta-corta/${inserted.id}`);
  console.log('  Veredicto:', francoScore.veredicto);
  console.log('  Score:', francoScore.score);
}

main().catch((e) => { console.error(e); process.exit(1); });
