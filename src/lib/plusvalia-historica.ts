/**
 * Plusvalía histórica de departamentos por comuna 2014-2024
 * Fuente: Arenas & Cayo, Propital, Tinsa, Activo Más Inversiones
 * Datos de precios promedio de departamentos vendidos
 */
export const PLUSVALIA_HISTORICA: Record<string, { plusvalia10a: number; anualizada: number; precio2014: number; precio2024: number }> = {
  "Quilicura":           { plusvalia10a: 68, anualizada: 5.3, precio2014: 1077, precio2024: 1813 },
  "San Bernardo":        { plusvalia10a: 61, anualizada: 4.9, precio2014: 1309, precio2024: 2109 },
  "Lo Prado":            { plusvalia10a: 52, anualizada: 4.3, precio2014: 1138, precio2024: 1729 },
  "Conchalí":            { plusvalia10a: 51, anualizada: 4.2, precio2014: 1461, precio2024: 2195 },
  "Maipú":               { plusvalia10a: 50, anualizada: 4.1, precio2014: 1752, precio2024: 2653 },
  "La Reina":            { plusvalia10a: 46, anualizada: 3.9, precio2014: 4950, precio2024: 7237 },
  "Cerrillos":           { plusvalia10a: 45, anualizada: 3.8, precio2014: 1479, precio2024: 2151 },
  "La Florida":          { plusvalia10a: 42, anualizada: 3.6, precio2014: 2239, precio2024: 3170 },
  "Macul":               { plusvalia10a: 42, anualizada: 3.6, precio2014: 2585, precio2024: 3670 },
  "Quinta Normal":       { plusvalia10a: 42, anualizada: 3.6, precio2014: 1453, precio2024: 2069 },
  "La Cisterna":         { plusvalia10a: 42, anualizada: 3.6, precio2014: 1694, precio2024: 2410 },
  "San Joaquín":         { plusvalia10a: 40, anualizada: 3.4, precio2014: 2041, precio2024: 2858 },
  "Pudahuel":            { plusvalia10a: 40, anualizada: 3.4, precio2014: 1535, precio2024: 2143 },
  "Ñuñoa":               { plusvalia10a: 37, anualizada: 3.2, precio2014: 4013, precio2024: 5900 },
  "Huechuraba":          { plusvalia10a: 34, anualizada: 3.0, precio2014: 4403, precio2024: 5900 },
  "Providencia":         { plusvalia10a: 34, anualizada: 3.0, precio2014: 5645, precio2024: 5900 },
  "Las Condes":          { plusvalia10a: 31, anualizada: 2.7, precio2014: 7154, precio2024: 9400 },
  "Vitacura":            { plusvalia10a: 31, anualizada: 2.7, precio2014: 9597, precio2024: 12574 },
  "Lo Barnechea":        { plusvalia10a: 30, anualizada: 2.7, precio2014: 8596, precio2024: 11200 },
  "Independencia":       { plusvalia10a: 29, anualizada: 2.6, precio2014: 1685, precio2024: 2175 },
  "Recoleta":            { plusvalia10a: 27, anualizada: 2.4, precio2014: 2432, precio2024: 3100 },
  "San Miguel":          { plusvalia10a: 24, anualizada: 2.2, precio2014: 2676, precio2024: 3320 },
  "Estación Central":    { plusvalia10a: 24, anualizada: 2.2, precio2014: 1809, precio2024: 2240 },
  "Puente Alto":         { plusvalia10a: 21, anualizada: 1.9, precio2014: 1791, precio2024: 2167 },
  "Pedro Aguirre Cerda": { plusvalia10a: 18, anualizada: 1.7, precio2014: 1472, precio2024: 1740 },
  "Santiago":            { plusvalia10a: -10, anualizada: -1.1, precio2014: 3040, precio2024: 2730 },
  "El Bosque":           { plusvalia10a: -7, anualizada: -0.7, precio2014: 1737, precio2024: 1612 },
};

// Promedio Gran Santiago para comunas sin datos
export const PLUSVALIA_DEFAULT = { plusvalia10a: 35, anualizada: 3.0 };
