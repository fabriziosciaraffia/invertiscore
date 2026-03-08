import { createClient } from "@/lib/supabase/server";
import { SEED_MARKET_DATA } from "./market-seed";
export { SEED_MARKET_DATA } from "./market-seed";

export interface MarketDataRow {
  id?: number;
  comuna: string;
  tipo: string; // "1D", "2D", "3D"
  arriendo_promedio: number; // CLP/mes
  precio_m2_promedio: number; // UF/m² (arriendo-derived)
  precio_m2_venta_promedio: number; // UF/m² (venta)
  gastos_comunes_m2: number; // CLP/m²
  numero_publicaciones: number;
  fecha_actualizacion: string; // ISO date
}

function dormitoriosToTipo(dormitorios: number): string {
  if (dormitorios <= 1) return "1D";
  if (dormitorios === 2) return "2D";
  return "3D";
}

export interface MarketSuggestion {
  arriendo_promedio: number;
  precio_m2_promedio: number;
  precio_m2_venta_promedio: number;
  gastos_comunes_m2: number;
  numero_publicaciones: number;
  source: "database" | "seed";
}

export async function getMarketDataForComuna(
  comuna: string,
  dormitorios: number
): Promise<MarketSuggestion | null> {
  const tipo = dormitoriosToTipo(dormitorios);

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
        precio_m2_venta_promedio: data.precio_m2_venta_promedio ?? data.precio_m2_promedio,
        gastos_comunes_m2: data.gastos_comunes_m2,
        numero_publicaciones: data.numero_publicaciones,
        source: "database",
      };
    }
  } catch {
    // Table might not exist yet — fall through to seed
  }

  const seed = SEED_MARKET_DATA.find((d) => d.comuna === comuna && d.tipo === tipo);
  if (seed) {
    return {
      arriendo_promedio: seed.arriendo_promedio,
      precio_m2_promedio: seed.precio_m2_promedio,
      precio_m2_venta_promedio: seed.precio_m2_venta_promedio,
      gastos_comunes_m2: seed.gastos_comunes_m2,
      numero_publicaciones: seed.numero_publicaciones,
      source: "seed",
    };
  }

  return null;
}

export async function getZoneComparison(comuna: string): Promise<MarketDataRow[] | null> {
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

  const seedRows = SEED_MARKET_DATA.filter((d) => d.comuna === comuna);
  if (seedRows.length > 0) {
    return seedRows.map((row) => ({
      ...row,
      fecha_actualizacion: new Date().toISOString(),
    }));
  }

  return null;
}

// ========== Config table helpers ==========

export interface AppConfig {
  key: string;
  value: string;
  updated_at: string;
}

export async function getConfig(key: string): Promise<{ value: string; updated_at: string } | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("config")
      .select("value, updated_at")
      .eq("key", key)
      .single();
    if (data) return data;
  } catch {
    // Table might not exist
  }
  return null;
}

// Hardcoded defaults for config values
const CONFIG_DEFAULTS: Record<string, string> = {
  tasa_hipotecaria: "4.72",
};

export async function getConfigValue(key: string): Promise<string> {
  const row = await getConfig(key);
  return row?.value ?? CONFIG_DEFAULTS[key] ?? "";
}
