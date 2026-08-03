// Sanity test del subsidio STR (Commit 3a · 2026-05-12).
// Verifica que calcShortTerm() expone subsidioTasa.califica correctamente
// según tipoPropiedad + precioUF.

import { calcShortTerm, type ShortTermInputs, type AirbnbData } from "../src/lib/engines/short-term-engine";

const airbnbData: AirbnbData = {
  estimated_adr: 50000,
  estimated_occupancy: 0.55,
  estimated_annual_revenue: 10037500,
  percentiles: {
    revenue: { p25: 7000000, p50: 10037500, p75: 13000000, p90: 16000000, avg: 11000000 },
    occupancy: { p25: 0.45, p50: 0.55, p75: 0.65, p90: 0.75, avg: 0.6 },
    average_daily_rate: { p25: 40000, p50: 50000, p75: 60000, p90: 70000, avg: 55000 },
  },
  monthly_revenue: [0.08, 0.07, 0.08, 0.08, 0.08, 0.085, 0.10, 0.09, 0.08, 0.085, 0.08, 0.085],
};

function build(precioCompraUF: number, tipo: string, tasaInteresPct = 4.7, valorUF = 38800): ShortTermInputs {
  return {
    precioCompra: precioCompraUF * valorUF,
    superficie: 50,
    dormitorios: 2,
    banos: 1,
    tipoPropiedad: tipo,
    piePercent: 0.2,
    tasaCredito: tasaInteresPct / 100,
    plazoCredito: 25,
    airbnbData,
    modoGestion: "auto",
    comisionAdministrador: 0.2,
    costoElectricidad: 35000,
    costoAgua: 8000,
    costoWifi: 22000,
    costoInsumos: 20000,
    gastosComunes: 80000,
    mantencion: 11000,
    contribuciones: 90000,
    costoAmoblamiento: 3500000,
    arriendoLargoMensual: 600000,
    valorUF,
  };
}

interface Caso {
  nombre: string;
  precioUF: number;
  tipo: string;
  tasaPct: number;
  expectedCalifica: boolean;
  expectedAplicado: boolean;
}

const CASOS: Caso[] = [
  { nombre: "Nuevo · 3500 UF · tasa mercado", precioUF: 3500, tipo: "nuevo", tasaPct: 4.7, expectedCalifica: true, expectedAplicado: false },
  { nombre: "Nuevo · 3500 UF · tasa subsidiada", precioUF: 3500, tipo: "nuevo", tasaPct: 3.5, expectedCalifica: true, expectedAplicado: true },
  { nombre: "Nuevo · 4500 UF (sobre techo)", precioUF: 4500, tipo: "nuevo", tasaPct: 4.7, expectedCalifica: false, expectedAplicado: false },
  { nombre: "Usado · 3000 UF", precioUF: 3000, tipo: "usado", tasaPct: 4.7, expectedCalifica: false, expectedAplicado: false },
  { nombre: "Sin tipoPropiedad", precioUF: 3500, tipo: "", tasaPct: 4.7, expectedCalifica: false, expectedAplicado: false },
];

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("SANITY TEST · subsidioTasa STR (Ley 21.748)");
  console.log("════════════════════════════════════════════════════════════\n");
  let allOk = true;
  for (const c of CASOS) {
    const r = calcShortTerm(build(c.precioUF, c.tipo, c.tasaPct));
    const sub = r.subsidioTasa!;
    const ok = sub.califica === c.expectedCalifica && sub.aplicado === c.expectedAplicado;
    const marker = ok ? "✓" : "✗";
    console.log(`${marker} ${c.nombre}`);
    console.log(`   califica: ${sub.califica} (esperado ${c.expectedCalifica}) · aplicado: ${sub.aplicado} (esperado ${c.expectedAplicado}) · tasaConSubsidio: ${sub.tasaConSubsidio}%`);
    console.log(`   sensibilidadPrecio rows: ${r.sensibilidadPrecio?.length ?? "?"}`);
    if (!ok) allOk = false;
  }
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(allOk ? "Todos OK." : "FAIL — revisar.");
  console.log("════════════════════════════════════════════════════════════\n");
  if (!allOk) process.exit(1);
}

main();
