// Importador de la base multi-fuente de plusvalía (F0) → plusvalia_fuentes_raw.
//
//   node --env-file=.env.local --import tsx scripts/data/importar-plusvalia-fuentes.ts
//
// Determinístico e idempotente: batch_id = hash del contenido del CSV, y el
// escritor es un upsert sobre la UNIQUE (fuente, comuna, periodo). Correrlo dos
// veces con el mismo CSV deja la tabla idéntica.
//
// Reglas (aprobadas en F0):
//   · periodo normalizado: '2024-ANUAL'→'2024' · '2025-T1'→'2025-Q1' · '2025-3T'→'2025-Q3'.
//   · tipologia: GFK=deptos_nuevos · INCOIN centro=deptos_nuevos, oriente/periferia=
//     mixto_casas_deptos · COLLIERS=asking · CCHC=deptos_mix · arenas_cayo=deptos_mix.
//   · 'PROMEDIO GS' es comuna sentinel (agregado GS) — entra tal cual, se excluye
//     de agregaciones por comuna aguas abajo.
//   · arenas_cayo: 2 filas por comuna (2014 y 2024) desde PLUSVALIA_HISTORICA.
//   · La UNIQUE no incluye zona_incoin: si una comuna INCOIN apareciera en más de
//     una zona, el upsert pisaría una zona con otra EN SILENCIO. Se aborta antes.
//   · Fila que no normaliza → se rechaza y se reporta; si hay rechazos no se escribe.

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PLUSVALIA_HISTORICA } from "../../src/lib/plusvalia-historica";

const CSV_PATH = join(__dirname, "franco-fuentes-2025.csv");

type Fila = {
  fuente: string;
  comuna: string;
  zona_incoin: string | null;
  periodo: string;
  uf_m2: number;
  tipologia: string;
  metodologia: string | null;
  nota: string | null;
  batch_id: string;
};

// ── Normalización de período ────────────────────────────────────────────────
// Acepta '2024-ANUAL' | '2025-T1' | '2025-3T' | '2024' | '2025-Q1'. Devuelve
// null si no calza — el rechazo lo reporta el caller.
function normalizarPeriodo(crudo: string): string | null {
  const p = crudo.trim().toUpperCase();
  let m = p.match(/^(\d{4})(-ANUAL)?$/);
  if (m) return m[1];
  m = p.match(/^(\d{4})-[TQ]([1-4])$/);
  if (m) return `${m[1]}-Q${m[2]}`;
  m = p.match(/^(\d{4})-([1-4])T$/);
  if (m) return `${m[1]}-Q${m[2]}`;
  return null;
}

function tipologiaDe(fuente: string, zona: string | null): string | null {
  switch (fuente) {
    case "GFK": return "deptos_nuevos";
    case "COLLIERS": return "asking";
    case "CCHC": return "deptos_mix";
    case "INCOIN":
      if (zona === "centro") return "deptos_nuevos";
      if (zona === "oriente" || zona === "periferia") return "mixto_casas_deptos";
      return null; // zona desconocida o ausente → rechazo, no adivinar
    default: return null;
  }
}

const METODOLOGIA: Record<string, string> = {
  gfk: "precio de oferta, deptos nuevos, promedio anual/trimestral",
  incoin: "informe INCOIN (Tinsa), 3 zonas RM; oriente/periferia mezclan casas y deptos",
  colliers: "asking price trimestral",
  cchc: "agregado deptos Gran Santiago",
  arenas_cayo: "precio promedio deptos vendidos; 2 puntos 2014/2024 (Arenas & Cayo, Propital, Tinsa, Activo Más)",
};

function main() {
  const csv = readFileSync(CSV_PATH, "utf8");
  const batchId = `csv-${createHash("sha256").update(csv).digest("hex").slice(0, 12)}`;
  const lineas = csv.trim().split(/\r?\n/);
  const header = lineas.shift();
  if (header !== "fuente,comuna,zona_incoin,periodo,uf_m2,nota") {
    throw new Error(`Header inesperado del CSV: ${header}`);
  }

  const filas: Fila[] = [];
  const rechazos: string[] = [];

  for (const [i, linea] of lineas.entries()) {
    const nLinea = i + 2; // 1-based + header
    const campos = linea.split(",");
    if (campos.length !== 6) {
      rechazos.push(`L${nLinea}: ${campos.length} campos (esperados 6): ${linea}`);
      continue;
    }
    const [fuente, comuna, zonaCruda, periodoCrudo, ufCrudo, nota] = campos.map((c) => c.trim());
    const zona = zonaCruda || null;
    const periodo = normalizarPeriodo(periodoCrudo);
    const uf = Number(ufCrudo);
    const tipologia = tipologiaDe(fuente, zona);
    if (!periodo) { rechazos.push(`L${nLinea}: periodo no normaliza: '${periodoCrudo}'`); continue; }
    if (!Number.isFinite(uf) || uf <= 0) { rechazos.push(`L${nLinea}: uf_m2 inválido: '${ufCrudo}'`); continue; }
    if (!tipologia) { rechazos.push(`L${nLinea}: sin tipología para fuente='${fuente}' zona='${zona}'`); continue; }
    if (!comuna) { rechazos.push(`L${nLinea}: comuna vacía`); continue; }
    filas.push({
      fuente: fuente.toLowerCase(),
      comuna,
      zona_incoin: fuente === "INCOIN" ? zona : null,
      periodo,
      uf_m2: uf,
      tipologia,
      metodologia: METODOLOGIA[fuente.toLowerCase()] ?? null,
      nota: nota || null,
      batch_id: batchId,
    });
  }

  // ── Guardas previas a cualquier escritura ─────────────────────────────────
  // 1. Una comuna INCOIN en dos zonas: la UNIQUE (fuente,comuna,periodo) no ve la
  //    zona, así que el upsert pisaría una zona con otra en silencio. Abortar.
  const zonaPorComuna = new Map<string, string>();
  for (const f of filas) {
    if (f.fuente !== "incoin" || !f.zona_incoin) continue;
    const previa = zonaPorComuna.get(f.comuna);
    if (previa && previa !== f.zona_incoin) {
      throw new Error(`INCOIN: comuna '${f.comuna}' aparece en dos zonas ('${previa}' y '${f.zona_incoin}') — la UNIQUE las pisaría. Corrige el CSV.`);
    }
    zonaPorComuna.set(f.comuna, f.zona_incoin);
  }
  // 2. Duplicados sobre la UNIQUE dentro del propio CSV (el upsert taparía el primero).
  const vistas = new Set<string>();
  for (const f of filas) {
    const k = `${f.fuente}|${f.comuna}|${f.periodo}`;
    if (vistas.has(k)) throw new Error(`Duplicado en el CSV sobre la UNIQUE: ${k}`);
    vistas.add(k);
  }

  // ── Filas arenas_cayo desde la constante (2 puntos × 27 comunas = 54) ─────
  for (const [comuna, d] of Object.entries(PLUSVALIA_HISTORICA)) {
    for (const [anio, uf] of [["2014", d.precio2014], ["2024", d.precio2024]] as const) {
      filas.push({
        fuente: "arenas_cayo",
        comuna,
        zona_incoin: null,
        periodo: anio,
        uf_m2: uf,
        tipologia: "deptos_mix",
        metodologia: METODOLOGIA.arenas_cayo,
        nota: `migrado de PLUSVALIA_HISTORICA (plusvalia-historica.ts); anualizada ${d.anualizada}%`,
        batch_id: batchId,
      });
    }
  }

  console.log(`CSV: ${lineas.length} filas leídas · ${filas.length} a escribir (incluye ${Object.keys(PLUSVALIA_HISTORICA).length * 2} de arenas_cayo) · ${rechazos.length} rechazos · batch ${batchId}`);
  if (rechazos.length > 0) {
    console.error("RECHAZOS — no se escribe nada:");
    for (const r of rechazos) console.error("  " + r);
    process.exit(1);
  }

  return { filas, batchId };
}

async function escribir(filas: Fila[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  // Lotes chicos para no pasar límites de payload; upsert = idempotente.
  const LOTE = 200;
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await supabase
      .from("plusvalia_fuentes_raw")
      .upsert(filas.slice(i, i + LOTE), { onConflict: "fuente,comuna,periodo" });
    if (error) throw new Error(`Upsert falló en lote ${i / LOTE}: ${error.message}`);
  }
  const { count, error } = await supabase
    .from("plusvalia_fuentes_raw")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Conteo de verificación falló: ${error.message}`);
  console.log(`OK: ${filas.length} filas upserteadas · total en tabla: ${count}`);
}

const { filas } = main();
escribir(filas).catch((e) => { console.error(e); process.exit(1); });
