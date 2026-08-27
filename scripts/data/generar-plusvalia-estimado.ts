// Generador del módulo de plusvalía consumido por el motor y las páginas (F0/F1/F2).
//
//   node --env-file=.env.local --import tsx scripts/data/generar-plusvalia-estimado.ts
//
// Emite src/lib/plusvalia-estimado.gen.ts. Tres bloques:
//   · F0 — trayectoria del MOTOR: la constante PLUSVALIA_HISTORICA (Arenas &
//     Cayo) tal cual, mismos valores, mismo DEFAULT. El swap a la cascada
//     GFK→A&C en el score es F3 (exige recalibrar historicaScore) — NO acá.
//   · F1 — data de PÁGINA (/comunas): serie anual GFK 2015-2024 (comunas con
//     serie completa), nivel GFK 2024/2025-Q1 y anualizada log-lineal, leídos de
//     scripts/data/franco-fuentes-2025.csv (committeado). 'PROMEDIO GS' queda
//     en export propio, nunca mezclado en las vistas por comuna.
//   · F2 — ESTIMADO 2025: lee la tabla derivada `plusvalia_estimado` (filas
//     vigentes) en BUILD TIME y la emite con banda, versión y método. El
//     runtime jamás consulta la tabla. Sin filas (job no corrido) emite el
//     mapa vacío y la página degrada sola.
//
// POR QUÉ FALTAN 5 COMUNAS EN EL ESTIMADO 2025 (corrida del 26-ago-2026, 25 de
// 30). No es un bug ni data perdida: son las guardas del job haciendo su
// trabajo. Queda escrito acá para que nadie tenga que recalcular para saberlo.
//   · Peñalolén      — Δincoin intra-año +18,0% > 8%: delta implausible, la
//                      zona oriente de INCOIN mezcla casas y departamentos.
//   · Pudahuel       — estimado 78,1 se aleja +20,3% del anual GfK 2024 (64,9).
//   · Quilicura      — estimado 51,2 se aleja −11,6% del 2024 (57,9).
//   · Padre Hurtado  — estimado 45,6 se aleja −11,1% del 2024 (51,3).
//   · Maipú          — estimado 62,0 se aleja −10,4% del 2024 (69,2).
// Estas comunas muestran su último dato observado y nada más. Antes que
// rellenar con el promedio del Gran Santiago, se declara que no hay estimado.
//
// La tabla plusvalia_fuentes_raw (forensics) NUNCA se lee, ni en runtime ni acá:
// el estimado ya viene compuesto por el job (scripts/data/calcular-plusvalia-estimado.ts).
//
// Determinístico: mismo input ⇒ mismo archivo byte a byte (el header lleva el
// hash de los inputs — CSV, constante A&C y estado de la derivada —, nunca un
// timestamp). La lectura de la derivada se ordena por comuna por lo mismo.

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "../../src/lib/plusvalia-historica";

const SALIDA = join(__dirname, "../../src/lib/plusvalia-estimado.gen.ts");
const CSV_PATH = join(__dirname, "franco-fuentes-2025.csv");
const RANGO_F0 = "2014-2024"; // rango A&C; con la cascada GFK pasa a ser per-comuna de verdad
const ANIO_ESTIMADO = 2025;

const csvCrudo = readFileSync(CSV_PATH, "utf8");

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

/**
 * Anualizada de una serie por PENDIENTE LOG-LINEAL (mínimos cuadrados sobre
 * ln(precio) vs año). Reemplaza al CAGR punta a punta (F3, decisión 26-ago).
 *
 * Por qué: el punta a punta descansa en dos observaciones —la primera y la
 * última— y hereda todo el ruido de esos dos años; teniendo diez puntos, usar
 * ocho de ellos solo para dibujar es desperdiciarlos. La pendiente log-lineal
 * usa la serie completa y amortigua los extremos.
 *
 * Cuánto mueve (medido sobre las 15 series): Δ medio +0,4 pts, máximo +1,1
 * (Puente Alto 6,0 → 7,1). Es casi siempre al alza porque las series son
 * cóncavas —crecieron más al principio— y el punta a punta subpondera ese
 * tramo. La Reina es la única que baja (3,1 → 2,8).
 */
function anualizadaLogLineal(valores: number[]): number {
  const n = valores.length;
  const xs = valores.map((_, i) => i);
  const ys = valores.map((p) => Math.log(p));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return (Math.exp(num / den) - 1) * 100;
}

/** Valores de la serie de una comuna, solo si está COMPLETA. */
function valoresSerie(comuna: string): number[] | null {
  const s = serieGfk.get(comuna);
  if (!s) return null;
  const anios: number[] = [];
  for (let a = SERIE_DESDE; a <= SERIE_HASTA; a++) if (s.has(a)) anios.push(a);
  // Serie solo si está COMPLETA 2015-2024 (10 puntos): una serie con huecos
  // dibujada como continua miente. Las comunas 2024-only quedan en nivel.
  if (anios.length !== SERIE_HASTA - SERIE_DESDE + 1) return null;
  return anios.map((a) => s.get(a)!);
}

function filaSerie(comuna: string): string | null {
  const valores = valoresSerie(comuna);
  if (!valores) return null;
  const anual = anualizadaLogLineal(valores);
  return `{ desde: ${SERIE_DESDE}, valores: [${valores.join(", ")}], anualPct: ${anual.toFixed(1)} }`;
}

const comunasSerie = [...serieGfk.keys()].filter((c) => c !== GS_SENTINEL && filaSerie(c) !== null).sort((a, b) => a.localeCompare(b, "es"));
const filasSerie = comunasSerie.map((c) => `  ${JSON.stringify(c).padEnd(23)}: ${filaSerie(c)},`).join("\n");

const comunasNivel = [...nivelGfk.keys()].filter((c) => c !== GS_SENTINEL).sort((a, b) => a.localeCompare(b, "es"));
const filasNivel = comunasNivel
  .map((c) => { const n = nivelGfk.get(c)!; return `  ${JSON.stringify(c).padEnd(23)}: { ufM2: ${n.ufM2}, periodo: ${JSON.stringify(n.periodo)} },`; })
  .join("\n");

const gsSerie = filaSerie(GS_SENTINEL);
const gsNivel = nivelGfk.get(GS_SENTINEL);

// ── F3: CASCADA DE TRAYECTORIA ─────────────────────────────────────────────
// Una sola trayectoria vigente por comuna, resuelta ACÁ (build time) para que
// el motor y la superficie lean exactamente lo mismo:
//   1. serie anual GfK completa 2015-2024 → anualizada log-lineal (15 comunas)
//   2. Arenas & Cayo 2014-2024 → su anualizada de dos puntos (fallback)
//   3. sin ninguna de las dos → DEFAULT declarado, nunca heredado en silencio
// Nunca conviven dos trayectorias para la misma comuna: `fuente` y `rangoHist`
// dicen cuál quedó, y la superficie rotula por ese campo.
//
// Las unidades NO son las mismas entre fuentes —GfK mide UF por m² de deptos
// nuevos y A&C el precio del depto completo—, así que el par de precios viaja
// con `unidadPrecio` y los consumidores rotulan según ese campo. Por eso los
// campos se llaman precioInicio/precioFin y no precio2014/precio2024: para una
// comuna GfK el inicio es 2015.
const comunasCascada = new Set([...Object.keys(PLUSVALIA_HISTORICA), ...comunasSerie]);
const filas = [...comunasCascada]
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((comuna) => {
    const k = JSON.stringify(comuna).padEnd(23);
    const serie = valoresSerie(comuna);
    if (serie) {
      const anual = anualizadaLogLineal(serie);
      const acum = (serie[serie.length - 1] / serie[0] - 1) * 100;
      const rango = `${SERIE_DESDE}-${SERIE_HASTA}`;
      return `  ${k}: { plusvalia10a: ${acum.toFixed(0)}, anualizada: ${anual.toFixed(1)}, precioInicio: ${serie[0]}, precioFin: ${serie[serie.length - 1]}, unidadPrecio: "uf_m2", fuente: "gfk", rangoHist: ${JSON.stringify(rango)} },`;
    }
    const d = PLUSVALIA_HISTORICA[comuna];
    return `  ${k}: { plusvalia10a: ${d.plusvalia10a}, anualizada: ${d.anualizada}, precioInicio: ${d.precio2014}, precioFin: ${d.precio2024}, unidadPrecio: "uf_depto", fuente: "arenas_cayo", rangoHist: ${JSON.stringify(RANGO_F0)} },`;
  })
  .join("\n");

// ── F2: estimado desde la tabla derivada ───────────────────────────────────
interface FilaEstimado {
  comuna: string;
  uf_m2: number;
  banda_min: number;
  banda_max: number;
  version: number;
  vigente_desde: string;
  metodo: string;
}

async function leerEstimado(): Promise<FilaEstimado[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (correr con --env-file=.env.local)");
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plusvalia_estimado")
    .select("comuna, uf_m2, banda_min, banda_max, version, vigente_desde, metodo")
    .eq("anio", ANIO_ESTIMADO)
    .eq("vigente", true);
  if (error) throw new Error(`Lectura de plusvalia_estimado falló: ${error.message}`);
  // Orden estable por comuna: mismo estado de la tabla ⇒ mismo archivo byte a byte.
  return (data ?? []).sort((a, b) => a.comuna.localeCompare(b.comuna, "es")) as FilaEstimado[];
}

async function main() {
  const est = await leerEstimado();

  const filasEst = est
    .map((e) => `  ${JSON.stringify(e.comuna).padEnd(23)}: { ufM2: ${Number(e.uf_m2)}, bandaMin: ${Number(e.banda_min)}, bandaMax: ${Number(e.banda_max)}, version: ${e.version}, vigenteDesde: ${JSON.stringify(e.vigente_desde)} },`)
    .join("\n");
  // Método para la página de metodología: textos únicos (hoy varían solo por zona INCOIN).
  const metodosUnicos = [...new Set(est.map((e) => e.metodo))].sort();

  const hashInput = createHash("sha256")
    .update(readFileSync(join(__dirname, "../../src/lib/plusvalia-historica.ts"), "utf8"))
    .update(csvCrudo)
    .update(JSON.stringify(est))
    .digest("hex")
    .slice(0, 12);

  const contenido = `// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-plusvalia-estimado.ts
// Fuentes: PLUSVALIA_HISTORICA (arenas_cayo) + franco-fuentes-2025.csv (GFK) +
// tabla derivada plusvalia_estimado (F2) · input ${hashInput}
//
// Módulo de plusvalía que consume el motor (score, hallazgo, prompt,
// zone-insight, wizard, UI de procedencia) y la página /comunas (F1/F2). Es la
// FUENTE ÚNICA en runtime: nadie lee las tablas plusvalia_fuentes_raw
// (forensics) ni plusvalia_estimado (derivada) ni constantes paralelas. La
// cascada del MOTOR (GfK → A&C → DEFAULT, F3) se resuelve en el generador: una
// sola trayectoria vigente por comuna, con su procedencia declarada.

/**
 * Trayectoria histórica VIGENTE de una comuna, ya resuelta por la cascada.
 * Nunca conviven dos: \\\`fuente\\\` dice cuál quedó y \\\`rangoHist\\\` su período.
 */
export interface PlusvaliaComunaEntry {
  /** % acumulado en el rango histórico (ej: 37 = 37% en el período). */
  plusvalia10a: number;
  /**
   * % anual. Con \\\`fuente: "gfk"\\\` es la pendiente log-lineal de la serie;
   * con \\\`"arenas_cayo"\\\`, la anualizada de dos puntos del estudio.
   */
  anualizada: number;
  /** Precio al inicio del rango. La UNIDAD la declara \\\`unidadPrecio\\\`. */
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
  /**
   * % anual de la serie ${SERIE_DESDE}→${SERIE_HASTA}, 1 decimal, por PENDIENTE LOG-LINEAL
   * sobre los ${SERIE_HASTA - SERIE_DESDE + 1} puntos (F3) — no es un CAGR punta a punta: ese
   * descansaba solo en el primer y el último año.
   */
  anualPct: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// F2 — ESTIMADO ${ANIO_ESTIMADO} (tabla derivada plusvalia_estimado, filas vigentes).
// Cierre de año COMPUESTO DE OBSERVADO (ancla GfK 1T × trayectoria intra-año
// INCOIN medida sobre la propia fuente), NO una proyección: ${ANIO_ESTIMADO} es pasado.
// La banda es la única incertidumbre declarada.
//
// 2026 NO se emite por comuna, a propósito. CONDICIÓN PARA ENCENDERLO: que
// exista al menos un trimestre 2026 observado POR COMUNA en la cruda y su fila
// correspondiente en la derivada. Recién ahí el año corriente entra como
// parcial observado (sólido) + cierre con banda (punteado) — y el punteado va
// SOLO en el tramo no transcurrido. Mientras tanto la página termina en
// "${ANIO_ESTIMADO} est." sólido.
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

/** Cierre ${ANIO_ESTIMADO} estimado por comuna (${est.length} comunas; las guardas del job degradan al resto). */
export const PLUSVALIA_ESTIMADO_2025: Record<string, EstimadoAnual> = {
${filasEst}
};

/** Año del estimado emitido. */
export const ANIO_ESTIMADO = ${ANIO_ESTIMADO};

/** Textos de método del estimado (campo \\\`metodo\\\` de la derivada), para la página de metodología. */
export const METODOS_ESTIMADO: string[] = ${JSON.stringify(metodosUnicos, null, 2)};

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
  console.log(
    `Escrito ${SALIDA} (${Object.keys(PLUSVALIA_HISTORICA).length} comunas A&C · ${comunasSerie.length} series GFK · ${comunasNivel.length} niveles GFK · ${est.length} estimados ${ANIO_ESTIMADO} · input ${hashInput})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
