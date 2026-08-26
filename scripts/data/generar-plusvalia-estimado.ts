// Generador del módulo de plusvalía consumido por el motor (F0).
//
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
//
// Emite src/lib/plusvalia-estimado.gen.ts. En F0 la fuente es la constante
// PLUSVALIA_HISTORICA (Arenas & Cayo) tal cual: mismos valores, mismo DEFAULT.
// La estructura ya soporta la cascada futura (campo `fuente` por comuna, rótulo
// de período por comuna); cuando exista la tabla derivada `plusvalia_estimado`
// (F2+), este script pasa a leer de ahí y el resto del producto no se toca.
//
// Determinístico: mismo input ⇒ mismo archivo byte a byte (el header lleva el
// hash del input, no un timestamp).

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "../../src/lib/plusvalia-historica";

const SALIDA = join(__dirname, "../../src/lib/plusvalia-estimado.gen.ts");
const RANGO_F0 = "2014-2024"; // rango A&C; con la cascada GFK pasa a ser per-comuna de verdad

const hashInput = createHash("sha256")
  .update(readFileSync(join(__dirname, "../../src/lib/plusvalia-historica.ts"), "utf8"))
  .digest("hex").slice(0, 12);

const filas = Object.entries(PLUSVALIA_HISTORICA)
  .map(([comuna, d]) => {
    const k = JSON.stringify(comuna);
    return `  ${k.padEnd(23)}: { plusvalia10a: ${d.plusvalia10a}, anualizada: ${d.anualizada}, precio2014: ${d.precio2014}, precio2024: ${d.precio2024}, fuente: "arenas_cayo", rangoHist: ${JSON.stringify(RANGO_F0)} },`;
  })
  .join("\n");

const contenido = `// GENERADO — no editar a mano. Regenerar con:
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuente F0: PLUSVALIA_HISTORICA (arenas_cayo) · input ${hashInput}
//
// Módulo de plusvalía por comuna que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia). Es la FUENTE ÚNICA en runtime: nadie
// lee la tabla plusvalia_fuentes_raw (forensics) ni constantes paralelas.
// La cascada futura (GFK serie → A&C fallback → DEFAULT) entra por el generador,
// cambiando \`fuente\`/\`rangoHist\` por comuna sin tocar a los consumidores.

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
${filas}
};

/**
 * Rótulo de período por comuna — fuente única del literal que antes vivía
 * hardcodeado ("2014-2024") en cards, drawers, wizard, prompt y zone-insight.
 * Comuna sin data ⇒ rango del promedio GS (hoy el mismo).
 */
export function rangoHistDe(comuna: string): string {
  return PLUSVALIA_ESTIMADO[comuna.trim()]?.rangoHist ?? ${JSON.stringify(RANGO_F0)};
}

/** Rango del agregado Gran Santiago (DEFAULT). */
export const PLUSVALIA_DEFAULT_RANGO = ${JSON.stringify(RANGO_F0)};

// Promedio Gran Santiago para comunas sin datos.
// plusvalia10a = ACUMULADO 10 años; anualizada = ANUAL. NO confundir.
export const PLUSVALIA_ESTIMADO_DEFAULT = { plusvalia10a: ${PLUSVALIA_DEFAULT.plusvalia10a}, anualizada: ${PLUSVALIA_DEFAULT.anualizada} };
`;

writeFileSync(SALIDA, contenido, "utf8");
console.log(`Escrito ${SALIDA} (${Object.keys(PLUSVALIA_HISTORICA).length} comunas · input ${hashInput})`);
