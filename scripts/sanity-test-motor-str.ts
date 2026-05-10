// Sanity check del motor STR con calibración v1. Mock AirROI data,
// dos casos: Andes (dedicado + adminPro + premium) y baseline (residencial + auto + basico).
// Cero AirROI calls.

import { calcShortTerm, aplicarEjesSTR, determinarBandaOcupacion, STR_OCUPACION_TARGET, STR_ADR_FACTOR } from "../src/lib/engines/short-term-engine";

const mockAirbnb = {
  estimated_adr: 50000,
  estimated_occupancy: 0.45,
  estimated_annual_revenue: 8200000,
  percentiles: {
    revenue: { p25: 6000000, p50: 8200000, p75: 10500000, p90: 13000000, avg: 9000000 },
    occupancy: { p25: 0.35, p50: 0.45, p75: 0.55, p90: 0.65, avg: 0.48 },
    average_daily_rate: { p25: 42000, p50: 50000, p75: 60000, p90: 72000, avg: 53000 },
  },
  monthly_revenue: Array(12).fill(1 / 12),
  currency: "CLP",
};

function buildInputs(overrides) {
  return {
    precioCompra: 150_000_000,
    superficie: 60,
    dormitorios: 2,
    banos: 1,
    piePercent: 0.20,
    tasaCredito: 0.045,
    plazoCredito: 25,
    airbnbData: mockAirbnb,
    modoGestion: "auto",
    comisionAdministrador: 0.20,
    costoElectricidad: 55000,
    costoAgua: 12000,
    costoWifi: 22000,
    costoInsumos: 22000,
    gastosComunes: 80000,
    mantencion: 20000,
    contribuciones: 240000,
    costoAmoblamiento: 5000000,
    arriendoLargoMensual: 600000,
    valorUF: 38800,
    ...overrides,
  };
}

console.log("═".repeat(60));
console.log("CASO 1: Andes (dedicado + adminPro + premium)");
console.log("═".repeat(60));
const andesEjes = aplicarEjesSTR(mockAirbnb, { tipoEdificio: "dedicado", habilitacion: "premium", adminPro: true });
console.log("ejes:", JSON.stringify(andesEjes, null, 2));
console.log(`Esperado: factorADRTotal = 1.10 × 1.10 = 1.21, banda = edificio_dedicado_admin_pro, occ = 0.74`);
console.log(`Real:     factorADRTotal = ${andesEjes.factorADRTotal}, banda = ${andesEjes.banda}, occ = ${andesEjes.ocupacionTarget}`);

const r1 = calcShortTerm(buildInputs({ tipoEdificio: "dedicado", habilitacion: "premium", adminPro: true }));
console.log(`\nResultado motor:`);
console.log(`  Base ADR = ${r1.escenarios.base.adrReferencia} (esperado: 50000 × 1.21 = ${Math.round(50000 * 1.21)})`);
console.log(`  Base Occ = ${r1.escenarios.base.ocupacionReferencia} (esperado: 0.74)`);
console.log(`  Base Revenue/año = ${r1.escenarios.base.revenueAnual.toLocaleString("es-CL")}`);
console.log(`  Base NOI mensual = $${r1.escenarios.base.noiMensual.toLocaleString("es-CL")}`);
console.log(`  Veredicto = ${r1.veredicto}`);

console.log("");
console.log("═".repeat(60));
console.log("CASO 2: Baseline (residencial + auto + básico)");
console.log("═".repeat(60));
const baseEjes = aplicarEjesSTR(mockAirbnb, {});
console.log(`Esperado: factorADRTotal = 1.00, banda = auto_gestion_residencial, occ = 0.55`);
console.log(`Real:     factorADRTotal = ${baseEjes.factorADRTotal}, banda = ${baseEjes.banda}, occ = ${baseEjes.ocupacionTarget}`);

const r2 = calcShortTerm(buildInputs({}));
console.log(`\nResultado motor:`);
console.log(`  Base ADR = ${r2.escenarios.base.adrReferencia} (esperado: 50000 × 1.00 = 50000)`);
console.log(`  Base Occ = ${r2.escenarios.base.ocupacionReferencia} (esperado: 0.55)`);
console.log(`  Base Revenue/año = ${r2.escenarios.base.revenueAnual.toLocaleString("es-CL")}`);
console.log(`  Base NOI mensual = $${r2.escenarios.base.noiMensual.toLocaleString("es-CL")}`);
console.log(`  Veredicto = ${r2.veredicto}`);

console.log("");
console.log("═".repeat(60));
console.log("Comparativa Andes vs Baseline:");
console.log("═".repeat(60));
const upliftRev = r1.escenarios.base.revenueAnual / r2.escenarios.base.revenueAnual;
console.log(`Revenue Andes / Revenue Baseline = ${upliftRev.toFixed(2)}x`);
console.log(`(esperado ≈ 1.21 × 0.74/0.55 = ${(1.21 * 0.74 / 0.55).toFixed(2)}x)`);
