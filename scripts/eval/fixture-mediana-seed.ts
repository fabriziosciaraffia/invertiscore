// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE del golden — NO es dato de producción.
//
// Estos números vivieron en src/lib/market-seed.ts desde el 2026-03-06 como
// "datos de mercado" y alimentaban getMarketDataForComuna, que consultaba una
// tabla `market_data` que NUNCA existió: el try/catch se comía el PGRST205 y
// caía siempre acá. Medido contra las medianas reales de scraped_properties,
// subestimaban el precio/m² entre 17% y 30% (Las Condes UF 75 vs 90,6 real;
// Ñuñoa 58 vs 82,8; Providencia 68 vs 91,3). Ese camino se retiró el 2026-08-03.
//
// Lo que queda es su único uso legítimo: `medianaSeed()` en fixtures.ts los usa
// como valor CONGELADO de "mediana de zona" para 38 casos del golden. Ahí no
// importa que sean irreales — importa que no cambien, porque los baselines se
// calcularon con ellos.
//
// Por eso viven en scripts/eval/ y no en src/: nada de producción puede
// importarlos, y el nombre del archivo dice lo que son.
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketSeedRow {
  comuna: string;
  tipo: string;
  arriendo_promedio: number;
  precio_m2_promedio: number;
  precio_m2_venta_promedio: number;
  gastos_comunes_m2: number;
  numero_publicaciones: number;
}

function deriveFromRef(ref2D: { precioM2Venta: number; arriendo2D: number; pubs: number; gastos: number }, tipo: "1D" | "3D") {
  if (tipo === "1D") {
    return {
      arriendo: Math.round(ref2D.arriendo2D * 0.72),
      precioM2Venta: Math.round((ref2D.precioM2Venta * 1.06) * 10) / 10,
      pubs: Math.round(ref2D.pubs * 0.42),
    };
  }
  return {
    arriendo: Math.round(ref2D.arriendo2D * 1.45),
    precioM2Venta: Math.round((ref2D.precioM2Venta * 0.94) * 10) / 10,
    pubs: Math.round(ref2D.pubs * 0.18),
  };
}

const REF_DATA: Record<string, { precioM2Venta: number; arriendo2D: number; pubs: number; gastos: number }> = {
  "Providencia":          { precioM2Venta: 68, arriendo2D: 580000, pubs: 720, gastos: 1400 },
  "Las Condes":           { precioM2Venta: 75, arriendo2D: 650000, pubs: 850, gastos: 1500 },
  "Ñuñoa":                { precioM2Venta: 58, arriendo2D: 480000, pubs: 540, gastos: 1300 },
  "Santiago Centro":      { precioM2Venta: 52, arriendo2D: 380000, pubs: 1200, gastos: 1200 },
  "La Florida":           { precioM2Venta: 42, arriendo2D: 350000, pubs: 380, gastos: 1100 },
  "Macul":                { precioM2Venta: 45, arriendo2D: 370000, pubs: 180, gastos: 1100 },
  "San Miguel":           { precioM2Venta: 48, arriendo2D: 400000, pubs: 220, gastos: 1200 },
  "Estación Central":     { precioM2Venta: 40, arriendo2D: 320000, pubs: 450, gastos: 1100 },
  "Independencia":        { precioM2Venta: 43, arriendo2D: 340000, pubs: 350, gastos: 1100 },
  "Vitacura":             { precioM2Venta: 95, arriendo2D: 850000, pubs: 280, gastos: 1600 },
  "Lo Barnechea":         { precioM2Venta: 85, arriendo2D: 780000, pubs: 150, gastos: 1500 },
  "Recoleta":             { precioM2Venta: 38, arriendo2D: 300000, pubs: 280, gastos: 1000 },
  "Quinta Normal":        { precioM2Venta: 36, arriendo2D: 290000, pubs: 150, gastos: 1000 },
  "Pedro Aguirre Cerda":  { precioM2Venta: 32, arriendo2D: 270000, pubs: 90, gastos: 950 },
  "San Joaquín":          { precioM2Venta: 38, arriendo2D: 310000, pubs: 120, gastos: 1050 },
};

export const SEED_MARKET_DATA: MarketSeedRow[] = [];

for (const [comuna, ref] of Object.entries(REF_DATA)) {
  const d1 = deriveFromRef(ref, "1D");
  const d3 = deriveFromRef(ref, "3D");

  SEED_MARKET_DATA.push(
    { comuna, tipo: "1D", arriendo_promedio: d1.arriendo, precio_m2_promedio: d1.precioM2Venta, precio_m2_venta_promedio: d1.precioM2Venta, gastos_comunes_m2: ref.gastos, numero_publicaciones: d1.pubs },
    { comuna, tipo: "2D", arriendo_promedio: ref.arriendo2D, precio_m2_promedio: ref.precioM2Venta, precio_m2_venta_promedio: ref.precioM2Venta, gastos_comunes_m2: ref.gastos, numero_publicaciones: ref.pubs },
    { comuna, tipo: "3D", arriendo_promedio: d3.arriendo, precio_m2_promedio: d3.precioM2Venta, precio_m2_venta_promedio: d3.precioM2Venta, gastos_comunes_m2: ref.gastos, numero_publicaciones: d3.pubs },
  );
}
