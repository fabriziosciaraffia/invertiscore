// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuentes: PLUSVALIA_HISTORICA (arenas_cayo) + franco-fuentes-2025.csv (GFK) +
// tabla derivada plusvalia_estimado (F2) · input b426a149e403
//
// Módulo de plusvalía que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia) y la página /comunas (F1/F2). Es la
// FUENTE ÚNICA en runtime: nadie lee las tablas plusvalia_fuentes_raw
// (forensics) ni plusvalia_estimado (derivada) ni constantes paralelas. La
// cascada del MOTOR (GfK → A&C → DEFAULT, F3) se resuelve en el generador: una
// sola trayectoria vigente por comuna, con su procedencia declarada.

/**
 * Trayectoria histórica VIGENTE de una comuna, ya resuelta por la cascada.
 * Nunca conviven dos: \`fuente\` dice cuál quedó y \`rangoHist\` su período.
 */
export interface PlusvaliaComunaEntry {
  /** % acumulado en el rango histórico (ej: 37 = 37% en el período). */
  plusvalia10a: number;
  /**
   * % anual. Con \`fuente: "gfk"\` es la pendiente log-lineal de la serie;
   * con \`"arenas_cayo"\`, la anualizada de dos puntos del estudio.
   */
  anualizada: number;
  /** Precio al inicio del rango. La UNIDAD la declara \`unidadPrecio\`. */
  precioInicio: number;
  /** Precio al fin del rango, en la misma unidad. */
  precioFin: number;
  /**
   * Qué miden precioInicio/precioFin — las fuentes NO coinciden en unidad:
   * · "uf_m2"    → UF por m² de deptos nuevos (GfK).
   * · "uf_depto" → precio del depto completo en UF (Arenas & Cayo).
   * Todo consumidor que muestre estos precios rotula por este campo.
   */
  unidadPrecio: "uf_m2" | "uf_depto";
  /** Procedencia de la trayectoria de ESTA comuna. */
  fuente: "arenas_cayo" | "gfk";
  /** Rango del dato histórico de ESTA comuna (rótulo de período). */
  rangoHist: string;
}

export const PLUSVALIA_ESTIMADO: Record<string, PlusvaliaComunaEntry> = {
  "Cerrillos"            : { plusvalia10a: 45, anualizada: 3.8, precioInicio: 1479, precioFin: 2151, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Conchalí"             : { plusvalia10a: 142, anualizada: 9.4, precioInicio: 31, precioFin: 74.9, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "El Bosque"            : { plusvalia10a: -7, anualizada: -0.7, precioInicio: 1737, precioFin: 1612, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Estación Central"     : { plusvalia10a: 32, anualizada: 3.7, precioInicio: 45.4, precioFin: 59.9, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Huechuraba"           : { plusvalia10a: 34, anualizada: 3, precioInicio: 4403, precioFin: 5900, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Independencia"        : { plusvalia10a: 29, anualizada: 2.6, precioInicio: 1685, precioFin: 2175, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "La Cisterna"          : { plusvalia10a: 42, anualizada: 3.6, precioInicio: 1694, precioFin: 2410, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "La Florida"           : { plusvalia10a: 66, anualizada: 5.8, precioInicio: 43.9, precioFin: 72.9, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "La Reina"             : { plusvalia10a: 35, anualizada: 2.7, precioInicio: 65.7, precioFin: 88.4, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Las Condes"           : { plusvalia10a: 36, anualizada: 3.3, precioInicio: 82.6, precioFin: 112.1, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Lo Barnechea"         : { plusvalia10a: 26, anualizada: 2.9, precioInicio: 82.4, precioFin: 103.5, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Lo Prado"             : { plusvalia10a: 52, anualizada: 4.3, precioInicio: 1138, precioFin: 1729, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Macul"                : { plusvalia10a: 53, anualizada: 5.3, precioInicio: 46.6, precioFin: 71.4, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Maipú"                : { plusvalia10a: 53, anualizada: 5.3, precioInicio: 45.3, precioFin: 69.2, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2024" },
  "Ñuñoa"                : { plusvalia10a: 32, anualizada: 3.0, precioInicio: 65, precioFin: 85.8, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Pedro Aguirre Cerda"  : { plusvalia10a: 18, anualizada: 1.7, precioInicio: 1472, precioFin: 1740, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Providencia"          : { plusvalia10a: 30, anualizada: 2.9, precioInicio: 81.9, precioFin: 106.5, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Pudahuel"             : { plusvalia10a: 40, anualizada: 3.4, precioInicio: 1535, precioFin: 2143, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Puente Alto"          : { plusvalia10a: 53, anualizada: 6.0, precioInicio: 33.9, precioFin: 52, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Quilicura"            : { plusvalia10a: 102, anualizada: 8.2, precioInicio: 28.6, precioFin: 57.9, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2024" },
  "Quinta Normal"        : { plusvalia10a: 42, anualizada: 3.6, precioInicio: 1453, precioFin: 2069, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "Recoleta"             : { plusvalia10a: 27, anualizada: 2.4, precioInicio: 2432, precioFin: 3100, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Bernardo"         : { plusvalia10a: 61, anualizada: 4.9, precioInicio: 1309, precioFin: 2109, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Joaquín"          : { plusvalia10a: 40, anualizada: 3.4, precioInicio: 2041, precioFin: 2858, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: "2014-2024" },
  "San Miguel"           : { plusvalia10a: 53, anualizada: 4.8, precioInicio: 45.3, precioFin: 69.2, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Santiago"             : { plusvalia10a: 50, anualizada: 5.0, precioInicio: 52.8, precioFin: 79.1, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
  "Vitacura"             : { plusvalia10a: 41, anualizada: 3.7, precioInicio: 87.1, precioFin: 122.9, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: "2015-2025" },
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
/**
 * Puntos OBSERVADOS de la serie, para DIBUJAR el gráfico y nada más.
 *
 * No trae anualizada a propósito (F4.1): la única del producto vive en
 * \`PLUSVALIA_ESTIMADO[comuna].anualizada\`, que además incorpora el cierre
 * estimado cuando existe. Mientras hubo dos campos con la misma semántica,
 * divergieron — la página titulaba 5,8% para Santiago con el informe diciendo
 * 5,0%. Si necesitas el % de una comuna, léelo de la trayectoria.
 */
export interface SerieGfk {
  /** Primer año de la serie. Los valores son años consecutivos desde aquí. */
  desde: number;
  /** UF/m² por año (deptos nuevos, precio de oferta, promedio anual). */
  valores: number[];
}

/** Serie GFK 2015-2024 por comuna (15 comunas con serie completa). */
export const GFK_SERIE: Record<string, SerieGfk> = {
  "Conchalí"             : { desde: 2015, valores: [31, 35, 41.7, 50.1, 54.8, 58, 63.1, 66.3, 74.3, 75.2] },
  "Estación Central"     : { desde: 2015, valores: [45.4, 46.8, 48.2, 50.5, 54.8, 57.3, 59.8, 61.2, 63.5, 64.3] },
  "La Florida"           : { desde: 2015, valores: [43.9, 45.8, 48.9, 50.6, 56, 60.5, 65.7, 67.9, 71.2, 71.9] },
  "La Reina"             : { desde: 2015, valores: [65.7, 69.8, 74.2, 79.2, 79, 81.3, 83.4, 84, 84.5, 86.3] },
  "Las Condes"           : { desde: 2015, valores: [82.6, 86.7, 88.3, 92.7, 98.3, 102.8, 107.1, 109.3, 110.3, 111.1] },
  "Lo Barnechea"         : { desde: 2015, valores: [82.4, 82.8, 85.2, 90.9, 96.3, 100.1, 103.7, 104.6, 104.9, 105.7] },
  "Macul"                : { desde: 2015, valores: [46.6, 47.2, 49.3, 52, 54.9, 59.1, 63.2, 67.2, 72.1, 72.9] },
  "Maipú"                : { desde: 2015, valores: [45.3, 46.8, 48, 52.5, 54.3, 60.4, 63.5, 65.4, 67.1, 69.2] },
  "Ñuñoa"                : { desde: 2015, valores: [65, 69.2, 72.4, 77, 81.6, 83.6, 86.4, 87.1, 87.8, 88.7] },
  "Providencia"          : { desde: 2015, valores: [81.9, 84.7, 85.1, 89.3, 93.8, 98.2, 101.4, 103.3, 103.9, 105] },
  "Puente Alto"          : { desde: 2015, valores: [33.9, 34.2, 36.6, 38.9, 43.5, 46.9, 52.3, 55.6, 56.9, 57.2] },
  "Quilicura"            : { desde: 2015, valores: [28.6, 34.7, 36.5, 38.9, 43, 47.5, 52.8, 55.3, 57.2, 57.9] },
  "San Miguel"           : { desde: 2015, valores: [45.3, 49.3, 51.4, 54.7, 57.9, 58.2, 65.1, 69.1, 70.4, 71] },
  "Santiago"             : { desde: 2015, valores: [52.8, 55.3, 57.1, 61.6, 69.2, 72.3, 78.3, 81.4, 80.5, 84] },
  "Vitacura"             : { desde: 2015, valores: [87.1, 90.9, 92.2, 101.1, 106.8, 109.1, 115.7, 117.7, 119.5, 120.8] },
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
  serie: { desde: 2015, valores: [62.2, 65.2, 67.4, 70.1, 75.5, 78, 82, 83.1, 83.7, 83.9] },
  nivel: { ufM2: 83.3, periodo: "1T-2025" },
};

// ─────────────────────────────────────────────────────────────────────────────
// F2 — ESTIMADO 2025 (tabla derivada plusvalia_estimado, filas vigentes).
// Cierre de año COMPUESTO DE OBSERVADO (ancla GfK 1T × trayectoria intra-año
// INCOIN medida sobre la propia fuente), NO una proyección: 2025 es pasado.
// La banda es la única incertidumbre declarada.
//
// 2026 NO se emite por comuna, a propósito. CONDICIÓN PARA ENCENDERLO: que
// exista al menos un trimestre 2026 observado POR COMUNA en la cruda y su fila
// correspondiente en la derivada. Recién ahí el año corriente entra como
// parcial observado (sólido) + cierre con banda (punteado) — y el punteado va
// SOLO en el tramo no transcurrido. Mientras tanto la página termina en
// "2025 est." sólido.
// ─────────────────────────────────────────────────────────────────────────────

/** Estimado anual con banda y versión (auditable contra plusvalia_estimado). */
export interface EstimadoAnual {
  /** UF/m² estimado del año (promedio anual, misma base que la serie GFK). */
  ufM2: number;
  bandaMin: number;
  bandaMax: number;
  /** Versión vigente en la derivada — las cifras citadas quedan auditables. */
  version: number;
  vigenteDesde: string;
}

/** Cierre 2025 estimado por comuna (25 comunas; las guardas del job degradan al resto). */
export const PLUSVALIA_ESTIMADO_2025: Record<string, EstimadoAnual> = {
  "Buin"                 : { ufM2: 50.2, bandaMin: 48.9, bandaMax: 51.6, version: 1, vigenteDesde: "2026-08-26" },
  "Cerrillos"            : { ufM2: 69.1, bandaMin: 66.5, bandaMax: 71.8, version: 1, vigenteDesde: "2026-08-26" },
  "Colina"               : { ufM2: 77.8, bandaMin: 76.2, bandaMax: 79.3, version: 1, vigenteDesde: "2026-08-26" },
  "Conchalí"             : { ufM2: 74.9, bandaMin: 73.4, bandaMax: 76.4, version: 1, vigenteDesde: "2026-08-26" },
  "Estación Central"     : { ufM2: 59.9, bandaMin: 58.4, bandaMax: 61.5, version: 1, vigenteDesde: "2026-08-26" },
  "Huechuraba"           : { ufM2: 72.2, bandaMin: 70.5, bandaMax: 74, version: 1, vigenteDesde: "2026-08-26" },
  "Independencia"        : { ufM2: 65.2, bandaMin: 63.9, bandaMax: 66.5, version: 1, vigenteDesde: "2026-08-26" },
  "La Cisterna"          : { ufM2: 64.6, bandaMin: 63.3, bandaMax: 65.9, version: 1, vigenteDesde: "2026-08-26" },
  "La Florida"           : { ufM2: 72.9, bandaMin: 71.5, bandaMax: 74.4, version: 1, vigenteDesde: "2026-08-26" },
  "La Reina"             : { ufM2: 88.4, bandaMin: 86.6, bandaMax: 90.1, version: 1, vigenteDesde: "2026-08-26" },
  "Lampa"                : { ufM2: 41.2, bandaMin: 40.4, bandaMax: 42, version: 1, vigenteDesde: "2026-08-26" },
  "Las Condes"           : { ufM2: 112.1, bandaMin: 109.8, bandaMax: 114.3, version: 1, vigenteDesde: "2026-08-26" },
  "Lo Barnechea"         : { ufM2: 103.5, bandaMin: 101.5, bandaMax: 105.6, version: 1, vigenteDesde: "2026-08-26" },
  "Macul"                : { ufM2: 71.4, bandaMin: 70, bandaMax: 72.9, version: 1, vigenteDesde: "2026-08-26" },
  "Ñuñoa"                : { ufM2: 85.8, bandaMin: 81.5, bandaMax: 90.2, version: 1, vigenteDesde: "2026-08-26" },
  "Providencia"          : { ufM2: 106.5, bandaMin: 104.4, bandaMax: 108.6, version: 1, vigenteDesde: "2026-08-26" },
  "Puente Alto"          : { ufM2: 52, bandaMin: 51, bandaMax: 53.1, version: 1, vigenteDesde: "2026-08-26" },
  "Quinta Normal"        : { ufM2: 70.9, bandaMin: 69.5, bandaMax: 72.3, version: 1, vigenteDesde: "2026-08-26" },
  "Recoleta"             : { ufM2: 71.4, bandaMin: 70, bandaMax: 72.8, version: 1, vigenteDesde: "2026-08-26" },
  "Renca"                : { ufM2: 52.7, bandaMin: 51.7, bandaMax: 53.8, version: 1, vigenteDesde: "2026-08-26" },
  "San Bernardo"         : { ufM2: 57, bandaMin: 54.2, bandaMax: 59.8, version: 1, vigenteDesde: "2026-08-26" },
  "San Joaquín"          : { ufM2: 69.3, bandaMin: 68, bandaMax: 70.7, version: 1, vigenteDesde: "2026-08-26" },
  "San Miguel"           : { ufM2: 69.2, bandaMin: 66.3, bandaMax: 72.2, version: 1, vigenteDesde: "2026-08-26" },
  "Santiago"             : { ufM2: 79.1, bandaMin: 75.2, bandaMax: 83, version: 1, vigenteDesde: "2026-08-26" },
  "Vitacura"             : { ufM2: 122.9, bandaMin: 120.4, bandaMax: 125.4, version: 1, vigenteDesde: "2026-08-26" },
};

/** Año del estimado emitido. */
export const ANIO_ESTIMADO = 2025;

/** Textos de método del estimado (campo \`metodo\` de la derivada), para la página de metodología. */
export const METODOS_ESTIMADO: string[] = [
  "Cierre 2025 estimado, compuesto de datos observados del propio año: ancla de nivel GfK/NielsenIQ 1T-2025 (precio de oferta, deptos nuevos) ajustada por la trayectoria intra-año de INCOIN (Tinsa) — factor = promedio de los 4 trimestres 2025 de la comuna dividido por su 1T, medido sobre la misma fuente (nunca se mezclan niveles entre fuentes). Banda: ± el mayor entre la divergencia con la trayectoria GfK del Gran Santiago y 2 puntos porcentuales. Guardas: se descarta el estimado si el delta intra-año supera 8% o si el resultado se aleja más de 10% del anual GfK 2024. La zona INCOIN de esta comuna (centro) es 100% departamentos. Los precios de lista de deptos nuevos 2025-2026 pueden estar afectados por cambios tributarios (beneficios/IVA a la vivienda); el estimado refleja precios publicados, sin ajuste por ese efecto. Es un estimado de año terminado, no una proyección.",
  "Cierre 2025 estimado, compuesto de datos observados del propio año: ancla de nivel GfK/NielsenIQ 1T-2025 (precio de oferta, deptos nuevos) ajustada por la trayectoria intra-año de INCOIN (Tinsa) — factor = promedio de los 4 trimestres 2025 de la comuna dividido por su 1T, medido sobre la misma fuente (nunca se mezclan niveles entre fuentes). Banda: ± el mayor entre la divergencia con la trayectoria GfK del Gran Santiago y 2 puntos porcentuales. Guardas: se descarta el estimado si el delta intra-año supera 8% o si el resultado se aleja más de 10% del anual GfK 2024. La zona INCOIN de esta comuna (oriente) mezcla casas y departamentos; el factor se usa igual porque es relativo, pero se declara. Los precios de lista de deptos nuevos 2025-2026 pueden estar afectados por cambios tributarios (beneficios/IVA a la vivienda); el estimado refleja precios publicados, sin ajuste por ese efecto. Es un estimado de año terminado, no una proyección.",
  "Cierre 2025 estimado, compuesto de datos observados del propio año: ancla de nivel GfK/NielsenIQ 1T-2025 (precio de oferta, deptos nuevos) ajustada por la trayectoria intra-año de INCOIN (Tinsa) — factor = promedio de los 4 trimestres 2025 de la comuna dividido por su 1T, medido sobre la misma fuente (nunca se mezclan niveles entre fuentes). Banda: ± el mayor entre la divergencia con la trayectoria GfK del Gran Santiago y 2 puntos porcentuales. Guardas: se descarta el estimado si el delta intra-año supera 8% o si el resultado se aleja más de 10% del anual GfK 2024. La zona INCOIN de esta comuna (periferia) mezcla casas y departamentos; el factor se usa igual porque es relativo, pero se declara. Los precios de lista de deptos nuevos 2025-2026 pueden estar afectados por cambios tributarios (beneficios/IVA a la vivienda); el estimado refleja precios publicados, sin ajuste por ese efecto. Es un estimado de año terminado, no una proyección."
];

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
