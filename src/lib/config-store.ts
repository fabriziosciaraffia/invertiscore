/**
 * Lectura de la tabla `config` (key-value global: uf_value, tasa_hipotecaria).
 *
 * Vivía en `market-data.ts` junto a los helpers de la tabla `market_data`. Ese
 * archivo se borró el 2026-08-03 —la tabla nunca existió y sus lectores caían a
 * un seed hardcodeado—, y `getConfig` se mudó acá porque es lo único que
 * quedaba vivo y no tenía nada que ver con datos de mercado.
 */

import { createClient } from "@/lib/supabase/server";
import { reportarFalloQuery } from "@/lib/observabilidad";

export async function getConfig(key: string): Promise<{ value: string; updated_at: string } | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("config")
      .select("value, updated_at")
      .eq("key", key)
      .single();
    // `.single()` devuelve PGRST116 cuando la key no existe, que es una
    // respuesta válida y no una falla — reportarFalloQuery lo filtra. Lo que sí
    // importa es todo lo demás: esta tabla sirve la UF y la tasa del día, así que
    // un fallo silencioso manda a los consumidores a sus valores de fallback sin
    // que nadie se entere de que dejaron de leer el dato real.
    reportarFalloQuery(error, {
      ruta: "lib/config-store",
      operacion: "leer-config",
      tags: { tabla: "config", key },
    });
    if (data) return data;
  } catch (e) {
    // PostgREST devuelve los fallos en el objeto, no como excepción: acá solo
    // caen los cortes de red o un cliente mal construido.
    reportarFalloQuery(e, {
      ruta: "lib/config-store",
      operacion: "leer-config-excepcion",
      tags: { tabla: "config", key },
    });
  }
  return null;
}
