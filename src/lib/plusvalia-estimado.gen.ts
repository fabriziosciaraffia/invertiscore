// GENERADO — no editar a mano. Regenerar con:
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuentes: PLUSVALIA_HISTORICA (arenas_cayo) + franco-fuentes-2025.csv (GFK) · input 3ea769353239
//
// Módulo de plusvalía que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia) y la página /comunas (F1). Es la
// FUENTE ÚNICA en runtime: nadie lee la tabla plusvalia_fuentes_raw (forensics)
// ni constantes paralelas. La cascada futura del MOTOR (GFK → A&C → DEFAULT, F3)
// entra por el generador, cambiando `fuente`/`rangoHist` por comuna sin tocar a
// los consumidores.

/** Trayectoria histórica de una comuna, con procedencia declarada. */
export interface PlusvaliaComunaEntry {
  /** % acumulado en el rango histórico (ej: 37 = 37% en 10 años). */
  plusvalia10a: number;
  /** % anual equivalente. */
  anualizada: number;
  /** Precio promedio del depto (UF, valor total) al inicio del rango — NO es UF/m², pese al header histórico de plusvalia-historica.ts (Recoleta 2.432→3.100 no puede ser m²). */
  precio2014: number;
  /** Precio promedio del depto (UF, valor total) al fin del rango. */
  precio2024: number;
  /** Procedencia de la trayectoria de ESTA comuna. */
  fuente: "arenas_cayo" | "gfk";
  /** Rango del dato histórico de ESTA comuna (rótulo de período). */
  rangoHist: string;
}

export const PLUSVALIA_ESTIMADO: Record<string, PlusvaliaComunaEntry> = {
  "Quilicura"            : { plusvalia10a: 68, anualizada: 5.3, precio2014: 1077, precio2024: 1813, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Bernardo"         : { plusvalia10a: 61, anualizada: 4.9, precio2014: 1309, precio2024: 2109, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Lo Prado"             : { plusvalia10a: 52, anualizada: 4.3, precio2014: 1138, precio2024: 1729, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Conchalí"             : { plusvalia10a: 51, anualizada: 4.2, precio2014: 1461, precio2024: 2195, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Maipú"                : { plusvalia10a: 50, anualizada: 4.1, precio2014: 1752, precio2024: 2653, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "La Reina"             : { plusvalia10a: 46, anualizada: 3.9, precio2014: 4950, precio2024: 7237, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Cerrillos"            : { plusvalia10a: 45, anualizada: 3.8, precio2014: 1479, precio2024: 2151, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "La Florida"           : { plusvalia10a: 42, anualizada: 3.6, precio2014: 2239, precio2024: 3170, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Macul"                : { plusvalia10a: 42, anualizada: 3.6, precio2014: 2585, precio2024: 3670, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Quinta Normal"        : { plusvalia10a: 42, anualizada: 3.6, precio2014: 1453, precio2024: 2069, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "La Cisterna"          : { plusvalia10a: 42, anualizada: 3.6, precio2014: 1694, precio2024: 2410, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Joaquín"          : { plusvalia10a: 40, anualizada: 3.4, precio2014: 2041, precio2024: 2858, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Pudahuel"             : { plusvalia10a: 40, anualizada: 3.4, precio2014: 1535, precio2024: 2143, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Ñuñoa"                : { plusvalia10a: 37, anualizada: 3.2, precio2014: 4013, precio2024: 5900, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Huechuraba"           : { plusvalia10a: 34, anualizada: 3, precio2014: 4403, precio2024: 5900, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Providencia"          : { plusvalia10a: 34, anualizada: 3, precio2014: 5645, precio2024: 5900, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Las Condes"           : { plusvalia10a: 31, anualizada: 2.7, precio2014: 7154, precio2024: 9400, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Vitacura"             : { plusvalia10a: 31, anualizada: 2.7, precio2014: 9597, precio2024: 12574, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Lo Barnechea"         : { plusvalia10a: 30, anualizada: 2.7, precio2014: 8596, precio2024: 11200, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Independencia"        : { plusvalia10a: 29, anualizada: 2.6, precio2014: 1685, precio2024: 2175, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Recoleta"             : { plusvalia10a: 27, anualizada: 2.4, precio2014: 2432, precio2024: 3100, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Miguel"           : { plusvalia10a: 24, anualizada: 2.2, precio2014: 2676, precio2024: 3320, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Estación Central"     : { plusvalia10a: 24, anualizada: 2.2, precio2014: 1809, precio2024: 2240, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Puente Alto"          : { plusvalia10a: 21, anualizada: 1.9, precio2014: 1791, precio2024: 2167, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Pedro Aguirre Cerda"  : { plusvalia10a: 18, anualizada: 1.7, precio2014: 1472, precio2024: 1740, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Santiago"             : { plusvalia10a: -10, anualizada: -1.1, precio2014: 3040, precio2024: 2730, fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "El Bosque"            : { plusvalia10a: -7, anualizada: -0.7, precio2014: 1737, precio2024: 1612, fuente: "arenas_cayo", rangoHist: "2014-2024" },
};

/**
 * Rótulo de período por comuna — fuente única del literal que antes vivía
 * hardcodeado ("2014-2024") en cards, drawers, wizard, prompt y zone-insight.
 * Comuna sin data ⇒ rango del promedio GS (hoy el mismo).
 */
export function rangoHistDe(comuna: string): string {
  return PLUSVALIA_ESTIMADO[comuna.trim()]?.rangoHist ?? "2014-2024";
}

/** Rango del agregado Gran Santiago (DEFAULT). */
export const PLUSVALIA_DEFAULT_RANGO = "2014-2024";

// Promedio Gran Santiago para comunas sin datos.
// plusvalia10a = ACUMULADO 10 años; anualizada = ANUAL. NO confundir.
export const PLUSVALIA_ESTIMADO_DEFAULT = { plusvalia10a: 35, anualizada: 3 };

// ─────────────────────────────────────────────────────────────────────────────
// F1 — data de PÁGINA (/comunas). Solo la consume la superficie pública; el
// motor NO lee nada de acá (su trayectoria sigue siendo PLUSVALIA_ESTIMADO
// hasta F3). GFK = precios de OFERTA de deptos NUEVOS — otra canasta que A&C:
// las dos cifras conviven solo con procedencia declarada, nunca mezcladas.
// ─────────────────────────────────────────────────────────────────────────────

/** Serie anual GFK de UF/m² (deptos nuevos, oferta). Solo series COMPLETAS. */
export interface SerieGfk {
  /** Primer año de la serie. Los valores son años consecutivos desde aquí. */
  desde: number;
  /** UF/m² por año (deptos nuevos, precio de oferta, promedio anual). */
  valores: number[];
  /** % anual punta a punta de la serie (CAGR 2015→2024), 1 decimal. */
  cagrPct: number;
}

/** Serie GFK 2015-2024 por comuna (15 comunas con serie completa). */
export const GFK_SERIE: Record<string, SerieGfk> = {
  "Conchalí"             : { desde: 2015, valores: [31, 35, 41.7, 50.1, 54.8, 58, 63.1, 66.3, 74.3, 75.2], cagrPct: 10.3 },
  "Estación Central"     : { desde: 2015, valores: [45.4, 46.8, 48.2, 50.5, 54.8, 57.3, 59.8, 61.2, 63.5, 64.3], cagrPct: 3.9 },
  "La Florida"           : { desde: 2015, valores: [43.9, 45.8, 48.9, 50.6, 56, 60.5, 65.7, 67.9, 71.2, 71.9], cagrPct: 5.6 },
  "La Reina"             : { desde: 2015, valores: [65.7, 69.8, 74.2, 79.2, 79, 81.3, 83.4, 84, 84.5, 86.3], cagrPct: 3.1 },
  "Las Condes"           : { desde: 2015, valores: [82.6, 86.7, 88.3, 92.7, 98.3, 102.8, 107.1, 109.3, 110.3, 111.1], cagrPct: 3.3 },
  "Lo Barnechea"         : { desde: 2015, valores: [82.4, 82.8, 85.2, 90.9, 96.3, 100.1, 103.7, 104.6, 104.9, 105.7], cagrPct: 2.8 },
  "Macul"                : { desde: 2015, valores: [46.6, 47.2, 49.3, 52, 54.9, 59.1, 63.2, 67.2, 72.1, 72.9], cagrPct: 5.1 },
  "Maipú"                : { desde: 2015, valores: [45.3, 46.8, 48, 52.5, 54.3, 60.4, 63.5, 65.4, 67.1, 69.2], cagrPct: 4.8 },
  "Ñuñoa"                : { desde: 2015, valores: [65, 69.2, 72.4, 77, 81.6, 83.6, 86.4, 87.1, 87.8, 88.7], cagrPct: 3.5 },
  "Providencia"          : { desde: 2015, valores: [81.9, 84.7, 85.1, 89.3, 93.8, 98.2, 101.4, 103.3, 103.9, 105], cagrPct: 2.8 },
  "Puente Alto"          : { desde: 2015, valores: [33.9, 34.2, 36.6, 38.9, 43.5, 46.9, 52.3, 55.6, 56.9, 57.2], cagrPct: 6.0 },
  "Quilicura"            : { desde: 2015, valores: [28.6, 34.7, 36.5, 38.9, 43, 47.5, 52.8, 55.3, 57.2, 57.9], cagrPct: 8.2 },
  "San Miguel"           : { desde: 2015, valores: [45.3, 49.3, 51.4, 54.7, 57.9, 58.2, 65.1, 69.1, 70.4, 71], cagrPct: 5.1 },
  "Santiago"             : { desde: 2015, valores: [52.8, 55.3, 57.1, 61.6, 69.2, 72.3, 78.3, 81.4, 80.5, 84], cagrPct: 5.3 },
  "Vitacura"             : { desde: 2015, valores: [87.1, 90.9, 92.2, 101.1, 106.8, 109.1, 115.7, 117.7, 119.5, 120.8], cagrPct: 3.7 },
};

/** Nivel GFK más fresco por comuna (1T-2025 si existe; si no, 2024). */
export const GFK_NIVEL: Record<string, { ufM2: number; periodo: string }> = {
  "Buin"                 : { ufM2: 50.6, periodo: "1T-2025" },
  "Cerrillos"            : { ufM2: 67.3, periodo: "1T-2025" },
  "Colina"               : { ufM2: 78.4, periodo: "1T-2025" },
  "Conchalí"             : { ufM2: 74.6, periodo: "1T-2025" },
  "Estación Central"     : { ufM2: 60.4, periodo: "1T-2025" },
  "Huechuraba"           : { ufM2: 71.6, periodo: "1T-2025" },
  "Independencia"        : { ufM2: 65.2, periodo: "1T-2025" },
  "La Cisterna"          : { ufM2: 64.3, periodo: "1T-2025" },
  "La Florida"           : { ufM2: 72.3, periodo: "1T-2025" },
  "La Reina"             : { ufM2: 86.9, periodo: "1T-2025" },
  "Lampa"                : { ufM2: 40.3, periodo: "1T-2025" },
  "Las Condes"           : { ufM2: 111.6, periodo: "1T-2025" },
  "Lo Barnechea"         : { ufM2: 102.2, periodo: "1T-2025" },
  "Macul"                : { ufM2: 71.5, periodo: "1T-2025" },
  "Maipú"                : { ufM2: 62.3, periodo: "1T-2025" },
  "Ñuñoa"                : { ufM2: 87.8, periodo: "1T-2025" },
  "Padre Hurtado"        : { ufM2: 45.4, periodo: "1T-2025" },
  "Peñalolén"            : { ufM2: 69.8, periodo: "1T-2025" },
  "Providencia"          : { ufM2: 106, periodo: "1T-2025" },
  "Pudahuel"             : { ufM2: 76.9, periodo: "1T-2025" },
  "Puente Alto"          : { ufM2: 52.4, periodo: "1T-2025" },
  "Quilicura"            : { ufM2: 51.8, periodo: "1T-2025" },
  "Quinta Normal"        : { ufM2: 70.3, periodo: "1T-2025" },
  "Recoleta"             : { ufM2: 71.4, periodo: "1T-2025" },
  "Renca"                : { ufM2: 52.7, periodo: "1T-2025" },
  "San Bernardo"         : { ufM2: 58.4, periodo: "1T-2025" },
  "San Joaquín"          : { ufM2: 68.9, periodo: "1T-2025" },
  "San Miguel"           : { ufM2: 69.8, periodo: "1T-2025" },
  "Santiago"             : { ufM2: 80.9, periodo: "1T-2025" },
  "Vitacura"             : { ufM2: 121.9, periodo: "1T-2025" },
};

/** Agregado Gran Santiago (sentinel 'PROMEDIO GS' del CSV) — nunca por comuna. */
export const GFK_GRAN_SANTIAGO = {
  serie: { desde: 2015, valores: [62.2, 65.2, 67.4, 70.1, 75.5, 78, 82, 83.1, 83.7, 83.9], cagrPct: 3.4 },
  nivel: { ufM2: 83.3, periodo: "1T-2025" },
};

/** Estado de cobertura de plusvalía de una comuna en la superficie pública. */
export type CoberturaPlusvalia =
  /** Serie anual GFK completa 2015-2024. */
  | "trayectoria_gfk"
  /** Nivel GFK fresco + trayectoria A&C 2014-2024. */
  | "nivel_mas_ac"
  /** Solo nivel GFK — sin trayectoria histórica propia en ninguna fuente. */
  | "solo_nivel"
  /** Trayectoria A&C sin nivel GFK. */
  | "solo_ac"
  /** Sin dato de plusvalía en ninguna fuente. */
  | "sin_dato";

export function coberturaPlusvaliaDe(comuna: string): CoberturaPlusvalia {
  const c = comuna.trim();
  if (GFK_SERIE[c]) return "trayectoria_gfk";
  const nivel = !!GFK_NIVEL[c];
  const ac = !!PLUSVALIA_ESTIMADO[c];
  if (nivel && ac) return "nivel_mas_ac";
  if (nivel) return "solo_nivel";
  if (ac) return "solo_ac";
  return "sin_dato";
}
