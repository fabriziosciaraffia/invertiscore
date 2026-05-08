// Ronda 4b — smoke test del motor STR.
// Verifica que projections + exitScenario + engineSignal + francoVerdict
// aparezcan en el output con valores coherentes para un caso típico.
import { calcShortTerm, type ShortTermInputs, type AirbnbData } from '../src/lib/engines/short-term-engine';

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

const input: ShortTermInputs = {
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

const r = calcShortTerm(input);

console.log('=== TOP-LEVEL ===');
console.log(JSON.stringify({
  veredicto: r.veredicto,
  engineSignal: r.engineSignal,
  francoVerdict: r.francoVerdict,
  pie: r.pie,
  capitalInvertido: r.capitalInvertido,
  dividendoMensual: r.dividendoMensual,
  perdidaRampUp: r.perdidaRampUp,
  baseNoiMensual: r.escenarios.base.noiMensual,
  baseFlujoCaja: r.escenarios.base.flujoCajaMensual,
}, null, 2));

console.log('\n=== PROJECTIONS (10 años) ===');
console.log(JSON.stringify(r.projections, null, 2));

console.log('\n=== EXIT SCENARIO (año 10) ===');
console.log(JSON.stringify(r.exitScenario, null, 2));

console.log('\n=== AÑO 10 ASSERTS ===');
const y10 = r.projections?.[9];
if (!y10) throw new Error('projections[9] vacío');
console.log({
  patrimonioNetoY10: y10.patrimonioNeto,
  patrimonioPositivo: y10.patrimonioNeto > 0,
  saldoMenorPrecio: y10.saldoCredito < input.precioCompra,
  valorMayorPrecio: y10.valorDepto > input.precioCompra,
});
const ex = r.exitScenario;
if (!ex) throw new Error('exitScenario undefined');
console.log({
  tirAnualPct: ex.tirAnual,
  multiplicadorCapital: ex.multiplicadorCapital,
  gananciaNetaPositiva: ex.gananciaNeta > 0,
});
