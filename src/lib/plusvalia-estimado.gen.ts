// GENERADO — no editar a mano. Regenerar con:
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuente F0: PLUSVALIA_HISTORICA (arenas_cayo) · input a59449673dee
//
// Módulo de plusvalía por comuna que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia). Es la FUENTE ÚNICA en runtime: nadie
// lee la tabla plusvalia_fuentes_raw (forensics) ni constantes paralelas.
// La cascada futura (GFK serie → A&C fallback → DEFAULT) entra por el generador,
// cambiando `fuente`/`rangoHist` por comuna sin tocar a los consumidores.

/** Trayectoria histórica de una comuna, con procedencia declarada. */
export interface PlusvaliaComunaEntry {
  /** % acumulado en el rango histórico (ej: 37 = 37% en 10 años). */
  plusvalia10a: number;
  /** % anual equivalente. */
  anualizada: number;
  /** UF/m² al inicio del rango. */
  precio2014: number;
  /** UF/m² al fin del rango. */
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
