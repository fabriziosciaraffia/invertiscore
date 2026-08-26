// Generador del módulo de plusvalía consumido por el motor y las páginas (F0/F1).
//
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
//
// Emite src/lib/plusvalia-estimado.gen.ts. Dos bloques:
//   · F0 — trayectoria del MOTOR: la constante PLUSVALIA_HISTORICA (Arenas &
//     Cayo) tal cual, mismos valores, mismo DEFAULT. El swap a la cascada
//     GFK→A&C en el score es F3 (exige recalibrar historicaScore) — NO acá.
//   · F1 — data de PÁGINA (/comunas): serie anual GFK 2015-2024 (comunas con
//     serie completa), nivel GFK 2024/2025-Q1 y CAGR punta a punta, leídos de
//     scripts/data/franco-fuentes-2025.csv (committeado). 'PROMEDIO GS' queda
//     en export propio, nunca mezclado en las vistas por comuna.
//
// La tabla plusvalia_fuentes_raw (forensics) NUNCA se lee en runtime; este
// módulo generado es la única fuente. Cuando exista la tabla derivada
// `plusvalia_estimado` (F2+), este script pasa a leer de ahí y el resto del
// producto no se toca.
//
// Determinístico: mismo input ⇒ mismo archivo byte a byte (el header lleva el
// hash de los inputs, no un timestamp).

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "../../src/lib/plusvalia-historica";

const SALIDA = join(__dirname, "../../src/lib/plusvalia-estimado.gen.ts");
const CSV_PATH = join(__dirname, "franco-fuentes-2025.csv");
const RANGO_F0 = "2014-2024"; // rango A&C; con la cascada GFK pasa a ser per-comuna de verdad

const csvCrudo = readFileSync(CSV_PATH, "utf8");
const hashInput = createHash("sha256")
  .update(readFileSync(join(__dirname, "../../src/lib/plusvalia-historica.ts"), "utf8"))
  .update(csvCrudo)
  .digest("hex").slice(0, 12);

// ── F1: series y niveles GFK desde el CSV ──────────────────────────────────
const GS_SENTINEL = "PROMEDIO GS";
const serieGfk = new Map<string, Map<number, number>>(); // comuna → año → UF/m² (solo filas ANUAL)
const nivelGfk = new Map<string, { ufM2: number; periodo: string }>(); // mejor nivel disponible

for (const linea of csvCrudo.trim().split(/\r?\n/).slice(1)) {
  const [fuente, comuna, , periodo, uf] = linea.split(",").map((c) => c.trim());
  if (fuente !== "GFK") continue;
  const valor = Number(uf);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error(`GFK: uf_m2 inválido en: ${linea}`);
  const mAnual = periodo.match(/^(\d{4})-ANUAL$/);
  if (mAnual) {
    const anio = Number(mAnual[1]);
    if (!serieGfk.has(comuna)) serieGfk.set(comuna, new Map());
    serieGfk.get(comuna)!.set(anio, valor);
  }
  // Nivel: preferir 2025-T1 (más fresco); si la comuna solo tiene 2024-ANUAL,
  // ese. 2025-T1 gana siempre, sin importar el orden del CSV.
  if (periodo === "2025-T1") nivelGfk.set(comuna, { ufM2: valor, periodo: "1T-2025" });
  else if (mAnual && mAnual[1] === "2024" && !nivelGfk.has(comuna)) nivelGfk.set(comuna, { ufM2: valor, periodo: "2024" });
}

const SERIE_DESDE = 2015;
const SERIE_HASTA = 2024;

function filaSerie(comuna: string): string | null {
  const s = serieGfk.get(comuna);
  if (!s) return null;
  const anios: number[] = [];
  for (let a = SERIE_DESDE; a <= SERIE_HASTA; a++) if (s.has(a)) anios.push(a);
  // Serie de página solo si está COMPLETA 2015-2024 (10 puntos): una serie con
  // huecos dibujada como continua miente. Las comunas 2024-only quedan en nivel.
  if (anios.length !== SERIE_HASTA - SERIE_DESDE + 1) return null;
  const valores = anios.map((a) => s.get(a)!);
  const cagr = (Math.pow(valores[valores.length - 1] / valores[0], 1 / (SERIE_HASTA - SERIE_DESDE)) - 1) * 100;
  return `{ desde: ${SERIE_DESDE}, valores: [${valores.join(", ")}], cagrPct: ${cagr.toFixed(1)} }`;
}

const comunasSerie = [...serieGfk.keys()].filter((c) => c !== GS_SENTINEL && filaSerie(c) !== null).sort((a, b) => a.localeCompare(b, "es"));
const filasSerie = comunasSerie.map((c) => `  ${JSON.stringify(c).padEnd(23)}: ${filaSerie(c)},`).join("\n");

const comunasNivel = [...nivelGfk.keys()].filter((c) => c !== GS_SENTINEL).sort((a, b) => a.localeCompare(b, "es"));
const filasNivel = comunasNivel
  .map((c) => { const n = nivelGfk.get(c)!; return `  ${JSON.stringify(c).padEnd(23)}: { ufM2: ${n.ufM2}, periodo: ${JSON.stringify(n.periodo)} },`; })
  .join("\n");

const gsSerie = filaSerie(GS_SENTINEL);
const gsNivel = nivelGfk.get(GS_SENTINEL);

// ── F0: trayectoria A&C (idéntica, movimiento cero en el motor) ────────────
const filas = Object.entries(PLUSVALIA_HISTORICA)
  .map(([comuna, d]) => {
    const k = JSON.stringify(comuna);
    return `  ${k.padEnd(23)}: { plusvalia10a: ${d.plusvalia10a}, anualizada: ${d.anualizada}, precio2014: ${d.precio2014}, precio2024: ${d.precio2024}, fuente: "arenas_cayo", rangoHist: ${JSON.stringify(RANGO_F0)} },`;
  })
  .join("\n");

const contenido = `// GENERADO — no editar a mano. Regenerar con:
//   node --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuentes: PLUSVALIA_HISTORICA (arenas_cayo) + franco-fuentes-2025.csv (GFK) · input ${hashInput}
//
// Módulo de plusvalía que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia) y la página /comunas (F1). Es la
// FUENTE ÚNICA en runtime: nadie lee la tabla plusvalia_fuentes_raw (forensics)
// ni constantes paralelas. La cascada futura del MOTOR (GFK → A&C → DEFAULT, F3)
// entra por el generador, cambiando \`fuente\`/\`rangoHist\` por comuna sin tocar a
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
  /** % anual punta a punta de la serie (CAGR ${SERIE_DESDE}→${SERIE_HASTA}), 1 decimal. */
  cagrPct: number;
}

/** Serie GFK ${SERIE_DESDE}-${SERIE_HASTA} por comuna (${comunasSerie.length} comunas con serie completa). */
export const GFK_SERIE: Record<string, SerieGfk> = {
${filasSerie}
};

/** Nivel GFK más fresco por comuna (1T-2025 si existe; si no, 2024). */
export const GFK_NIVEL: Record<string, { ufM2: number; periodo: string }> = {
${filasNivel}
};

/** Agregado Gran Santiago (sentinel 'PROMEDIO GS' del CSV) — nunca por comuna. */
export const GFK_GRAN_SANTIAGO = {
  serie: ${gsSerie ?? "null"},
  nivel: ${gsNivel ? `{ ufM2: ${gsNivel.ufM2}, periodo: ${JSON.stringify(gsNivel.periodo)} }` : "null"},
};

/** Estado de cobertura de plusvalía de una comuna en la superficie pública. */
export type CoberturaPlusvalia =
  /** Serie anual GFK completa ${SERIE_DESDE}-${SERIE_HASTA}. */
  | "trayectoria_gfk"
  /** Nivel GFK fresco + trayectoria A&C ${RANGO_F0}. */
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
`;

writeFileSync(SALIDA, contenido, "utf8");
console.log(`Escrito ${SALIDA} (${Object.keys(PLUSVALIA_HISTORICA).length} comunas A&C · ${comunasSerie.length} series GFK · ${comunasNivel.length} niveles GFK · input ${hashInput})`);
