import { createClient } from "@/lib/supabase/server";

export interface MarketDataRow {
  id?: number;
  comuna: string;
  tipo: string; // "1D", "2D", "3D"
  arriendo_promedio: number; // CLP/mes
  precio_m2_promedio: number; // UF/m²
  gastos_comunes_m2: number; // CLP/m²
  numero_publicaciones: number;
  fecha_actualizacion: string; // ISO date
}

// Reference data for main comunas in Santiago
// These are realistic averages based on Portal Inmobiliario market data (2024-2025)
export const SEED_MARKET_DATA: Omit<MarketDataRow, "id" | "fecha_actualizacion">[] = [
  // Providencia
  { comuna: "Providencia", tipo: "1D", arriendo_promedio: 420000, precio_m2_promedio: 72, gastos_comunes_m2: 1400, numero_publicaciones: 320 },
  { comuna: "Providencia", tipo: "2D", arriendo_promedio: 580000, precio_m2_promedio: 68, gastos_comunes_m2: 1400, numero_publicaciones: 280 },
  { comuna: "Providencia", tipo: "3D", arriendo_promedio: 850000, precio_m2_promedio: 65, gastos_comunes_m2: 1400, numero_publicaciones: 120 },

  // Las Condes
  { comuna: "Las Condes", tipo: "1D", arriendo_promedio: 450000, precio_m2_promedio: 80, gastos_comunes_m2: 1500, numero_publicaciones: 250 },
  { comuna: "Las Condes", tipo: "2D", arriendo_promedio: 650000, precio_m2_promedio: 75, gastos_comunes_m2: 1500, numero_publicaciones: 310 },
  { comuna: "Las Condes", tipo: "3D", arriendo_promedio: 950000, precio_m2_promedio: 72, gastos_comunes_m2: 1500, numero_publicaciones: 180 },

  // Ñuñoa
  { comuna: "Ñuñoa", tipo: "1D", arriendo_promedio: 380000, precio_m2_promedio: 62, gastos_comunes_m2: 1300, numero_publicaciones: 280 },
  { comuna: "Ñuñoa", tipo: "2D", arriendo_promedio: 520000, precio_m2_promedio: 58, gastos_comunes_m2: 1300, numero_publicaciones: 250 },
  { comuna: "Ñuñoa", tipo: "3D", arriendo_promedio: 750000, precio_m2_promedio: 55, gastos_comunes_m2: 1300, numero_publicaciones: 100 },

  // Santiago Centro
  { comuna: "Santiago Centro", tipo: "1D", arriendo_promedio: 350000, precio_m2_promedio: 55, gastos_comunes_m2: 1200, numero_publicaciones: 520 },
  { comuna: "Santiago Centro", tipo: "2D", arriendo_promedio: 480000, precio_m2_promedio: 52, gastos_comunes_m2: 1200, numero_publicaciones: 380 },
  { comuna: "Santiago Centro", tipo: "3D", arriendo_promedio: 650000, precio_m2_promedio: 50, gastos_comunes_m2: 1200, numero_publicaciones: 90 },

  // La Florida
  { comuna: "La Florida", tipo: "1D", arriendo_promedio: 300000, precio_m2_promedio: 48, gastos_comunes_m2: 1100, numero_publicaciones: 180 },
  { comuna: "La Florida", tipo: "2D", arriendo_promedio: 420000, precio_m2_promedio: 44, gastos_comunes_m2: 1100, numero_publicaciones: 220 },
  { comuna: "La Florida", tipo: "3D", arriendo_promedio: 580000, precio_m2_promedio: 42, gastos_comunes_m2: 1100, numero_publicaciones: 80 },

  // Macul
  { comuna: "Macul", tipo: "1D", arriendo_promedio: 310000, precio_m2_promedio: 48, gastos_comunes_m2: 1100, numero_publicaciones: 120 },
  { comuna: "Macul", tipo: "2D", arriendo_promedio: 430000, precio_m2_promedio: 45, gastos_comunes_m2: 1100, numero_publicaciones: 150 },
  { comuna: "Macul", tipo: "3D", arriendo_promedio: 600000, precio_m2_promedio: 43, gastos_comunes_m2: 1100, numero_publicaciones: 50 },

  // San Miguel
  { comuna: "San Miguel", tipo: "1D", arriendo_promedio: 330000, precio_m2_promedio: 52, gastos_comunes_m2: 1200, numero_publicaciones: 160 },
  { comuna: "San Miguel", tipo: "2D", arriendo_promedio: 460000, precio_m2_promedio: 48, gastos_comunes_m2: 1200, numero_publicaciones: 200 },
  { comuna: "San Miguel", tipo: "3D", arriendo_promedio: 630000, precio_m2_promedio: 46, gastos_comunes_m2: 1200, numero_publicaciones: 60 },

  // Estación Central
  { comuna: "Estación Central", tipo: "1D", arriendo_promedio: 300000, precio_m2_promedio: 46, gastos_comunes_m2: 1100, numero_publicaciones: 280 },
  { comuna: "Estación Central", tipo: "2D", arriendo_promedio: 400000, precio_m2_promedio: 43, gastos_comunes_m2: 1100, numero_publicaciones: 200 },
  { comuna: "Estación Central", tipo: "3D", arriendo_promedio: 550000, precio_m2_promedio: 41, gastos_comunes_m2: 1100, numero_publicaciones: 40 },

  // Independencia
  { comuna: "Independencia", tipo: "1D", arriendo_promedio: 320000, precio_m2_promedio: 50, gastos_comunes_m2: 1100, numero_publicaciones: 200 },
  { comuna: "Independencia", tipo: "2D", arriendo_promedio: 430000, precio_m2_promedio: 46, gastos_comunes_m2: 1100, numero_publicaciones: 160 },
  { comuna: "Independencia", tipo: "3D", arriendo_promedio: 580000, precio_m2_promedio: 44, gastos_comunes_m2: 1100, numero_publicaciones: 35 },

  // Vitacura
  { comuna: "Vitacura", tipo: "1D", arriendo_promedio: 480000, precio_m2_promedio: 90, gastos_comunes_m2: 1600, numero_publicaciones: 80 },
  { comuna: "Vitacura", tipo: "2D", arriendo_promedio: 700000, precio_m2_promedio: 85, gastos_comunes_m2: 1600, numero_publicaciones: 120 },
  { comuna: "Vitacura", tipo: "3D", arriendo_promedio: 1100000, precio_m2_promedio: 80, gastos_comunes_m2: 1600, numero_publicaciones: 90 },

  // Lo Barnechea
  { comuna: "Lo Barnechea", tipo: "1D", arriendo_promedio: 450000, precio_m2_promedio: 82, gastos_comunes_m2: 1500, numero_publicaciones: 60 },
  { comuna: "Lo Barnechea", tipo: "2D", arriendo_promedio: 650000, precio_m2_promedio: 78, gastos_comunes_m2: 1500, numero_publicaciones: 100 },
  { comuna: "Lo Barnechea", tipo: "3D", arriendo_promedio: 1000000, precio_m2_promedio: 74, gastos_comunes_m2: 1500, numero_publicaciones: 70 },
];

// Dormitorios to tipo mapping
function dormitoriosToTipo(dormitorios: number): string {
  if (dormitorios <= 1) return "1D";
  if (dormitorios === 2) return "2D";
  return "3D";
}

export interface MarketSuggestion {
  arriendo_promedio: number;
  precio_m2_promedio: number;
  gastos_comunes_m2: number;
  numero_publicaciones: number;
  source: "database" | "seed";
}

/**
 * Get market data for a comuna + property type from Supabase,
 * falling back to seed data if not in the database.
 */
export async function getMarketDataForComuna(
  comuna: string,
  dormitorios: number
): Promise<MarketSuggestion | null> {
  const tipo = dormitoriosToTipo(dormitorios);

  // Try Supabase first
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("market_data")
      .select("*")
      .eq("comuna", comuna)
      .eq("tipo", tipo)
      .order("fecha_actualizacion", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return {
        arriendo_promedio: data.arriendo_promedio,
        precio_m2_promedio: data.precio_m2_promedio,
        gastos_comunes_m2: data.gastos_comunes_m2,
        numero_publicaciones: data.numero_publicaciones,
        source: "database",
      };
    }
  } catch {
    // Table might not exist yet or query failed — fall through to seed
  }

  // Fallback to seed data
  const seed = SEED_MARKET_DATA.find(
    (d) => d.comuna === comuna && d.tipo === tipo
  );
  if (seed) {
    return {
      arriendo_promedio: seed.arriendo_promedio,
      precio_m2_promedio: seed.precio_m2_promedio,
      gastos_comunes_m2: seed.gastos_comunes_m2,
      numero_publicaciones: seed.numero_publicaciones,
      source: "seed",
    };
  }

  return null;
}

/**
 * Get all market data rows for a comuna (all tipos).
 * Used for zone comparison in results page.
 */
export async function getZoneComparison(comuna: string): Promise<MarketDataRow[] | null> {
  // Try Supabase first
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("market_data")
      .select("*")
      .eq("comuna", comuna)
      .order("tipo", { ascending: true });

    if (data && data.length > 0) return data;
  } catch {
    // Fall through to seed
  }

  // Fallback to seed data
  const seedRows = SEED_MARKET_DATA.filter((d) => d.comuna === comuna);
  if (seedRows.length > 0) {
    return seedRows.map((row) => ({
      ...row,
      fecha_actualizacion: new Date().toISOString(),
    }));
  }

  return null;
}
