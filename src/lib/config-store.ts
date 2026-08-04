/**
 * Lectura de la tabla `config` (key-value global: uf_value, tasa_hipotecaria).
 *
 * Vivía en `market-data.ts` junto a los helpers de la tabla `market_data`. Ese
 * archivo se borró el 2026-08-03 —la tabla nunca existió y sus lectores caían a
 * un seed hardcodeado—, y `getConfig` se mudó acá porque es lo único que
 * quedaba vivo y no tenía nada que ver con datos de mercado.
 */

import { createClient } from "@/lib/supabase/server";

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
