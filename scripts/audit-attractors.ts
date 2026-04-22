/**
 * Audita las coordenadas de los POIs en src/lib/data/attractors.ts
 * contra OpenStreetMap Overpass API (gratis, sin key).
 *
 * Uso:
 *   npm run audit:attractors
 *
 * Salida:
 *   - Reporte en consola
 *   - JSON con sugerencias en ./audit-attractors-results.json
 *
 * Rate limit: ~1 request por 1.5s, ~50 POIs → ~75s en total.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CLINICAS,
  ZONAS_NEGOCIOS,
  UNIVERSIDADES,
  INSTITUTOS,
  COLEGIOS_TOP,
  PARQUES,
  MALLS,
  TREN_EFE,
  distanciaMetros,
  type Attractor,
} from "../src/lib/data/attractors";

// ─── Types ──────────────────────────────────────────
interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassMatch {
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

interface AuditResult {
  nombre: string;
  tipo: string;
  comuna?: string;
  current: { lat: number; lng: number };
  suggested: { lat: number; lng: number } | null;
  distance: number;
  status: "ok" | "needs_review" | "wrong" | "not_found";
  source: "osm" | "none";
  osmTags?: Record<string, string>;
}

// ─── Config ─────────────────────────────────────────
// Solo el endpoint oficial está disponible públicamente. Los mirrors privados requieren
// token o no responden. Como la cuota es por IP con 2 slots, el script corre secuencial
// y respeta un rate limit conservador.
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 2500;
const THRESHOLD_OK = 100;
const THRESHOLD_REVIEW = 300;
const RATE_LIMIT_MS = 4000;      // 4s entre requests — respeta la cuota
const RATE_LIMITED_WAIT_MS = 30_000; // Tras detectar rate-limit, esperar 30s y reintentar
const MAX_ATTEMPTS = 3;

// Tags de OSM usados para acotar la búsqueda. Sin este filtro, el query con regex
// insensible + radius 2.5km hace timeout en Overpass (>50s por query).
const TAGS_BY_TIPO: Record<string, string[]> = {
  clinica: ['amenity~"clinic|hospital"', 'healthcare~"clinic|hospital|doctor"'],
  universidad: ['amenity=university'],
  instituto: ['amenity~"college|university"'],
  colegio: ['amenity=school'],
  parque: ['leisure~"park|garden|nature_reserve"'],
  mall: ['shop=mall', 'amenity=marketplace'],
  negocios: ['landuse~"commercial|retail"', 'place=neighbourhood'],
  tren: ['railway~"station|halt"', 'public_transport=station'],
};

// ─── Helpers ────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function buildTagClause(t: string): string {
  // Accept `key=value`, `key~"regex"`, or `key~regex`.
  if (t.includes("~")) {
    const [k, v] = t.split("~");
    const val = v.startsWith('"') ? v : `"${v}"`;
    return `["${k}"~${val}]`;
  }
  const [k, v] = t.split("=");
  return `["${k}"="${v}"]`;
}

async function queryOverpass(
  currentLat: number,
  currentLng: number,
  tagFilter: string
): Promise<OverpassMatch[]> {
  // Query SOLO por tag + radio. Sin regex de nombre (muy pesado, hace timeout).
  // El filtrado por nombre se hace en JS sobre el set devuelto.
  const clause = buildTagClause(tagFilter);
  const query =
    `[out:json][timeout:25];(` +
    `node${clause}(around:${SEARCH_RADIUS_M},${currentLat},${currentLng});` +
    `way${clause}(around:${SEARCH_RADIUS_M},${currentLat},${currentLng});` +
    `);out center tags;`;

  let jsonText = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "Franco-POI-Audit/1.0 (refranco.ai; audit script)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (e) {
      console.warn(`  → network error: ${(e as Error).message}`);
      await sleep(RATE_LIMITED_WAIT_MS);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      console.warn(`  → overpass ${response.status}, esperando ${RATE_LIMITED_WAIT_MS / 1000}s y reintentando`);
      await sleep(RATE_LIMITED_WAIT_MS);
      continue;
    }
    if (!response.ok) {
      console.warn(`  → overpass ${response.status} ${response.statusText}`);
      return [];
    }

    const text = await response.text();
    // Overpass a veces responde 200 con HTML de error (rate-limited, timeout).
    // Detectamos por prefijo y reintentamos.
    if (text.startsWith("<?xml") || text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      const isRateLimited = /rate_limited|Rate limit/i.test(text);
      console.warn(`  → overpass HTML error${isRateLimited ? " (rate-limited)" : ""}, esperando ${RATE_LIMITED_WAIT_MS / 1000}s`);
      await sleep(RATE_LIMITED_WAIT_MS);
      continue;
    }
    jsonText = text;
    break;
  }

  if (!jsonText) {
    console.warn(`  → falló tras ${MAX_ATTEMPTS} intentos`);
    return [];
  }

  let json: { elements?: OverpassElement[]; remark?: string };
  try {
    json = JSON.parse(jsonText) as { elements?: OverpassElement[]; remark?: string };
  } catch {
    console.warn(`  → respuesta no-JSON`);
    return [];
  }
  // Overpass puede responder 200 + JSON válido con elements vacío y "remark" de timeout.
  // En ese caso no tiene sentido quedarse con el set vacío — retry con wait.
  if (json.remark && json.elements && json.elements.length === 0) {
    console.warn(`  → overpass remark: ${json.remark.slice(0, 80)}`);
  }
  const elements = json.elements ?? [];
  return elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return { lat, lng, tags: el.tags ?? {} } as OverpassMatch;
    })
    .filter((m): m is OverpassMatch => m !== null);
}

function nameSimilarity(a: string, b: string): number {
  // Shared normalized-token fraction. Low-effort Jaccard-like measure.
  const ta = new Set(a.split(/\s+/).filter((t) => t.length >= 3));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => { if (tb.has(t)) shared++; });
  return shared / Math.min(ta.size, tb.size);
}

function selectBestMatch(
  results: OverpassMatch[],
  _currentLat: number,
  _currentLng: number,
  expectedName: string
): OverpassMatch | null {
  if (results.length === 0) return null;
  const expected = normalizeName(expectedName);

  // 1. Match normalizado exacto
  const exact = results.find((r) => r.tags.name && normalizeName(r.tags.name) === expected);
  if (exact) return exact;

  // 2. Contiene o es contenido
  const contains = results.find((r) => {
    const n = r.tags.name ? normalizeName(r.tags.name) : "";
    return n && (n.includes(expected) || expected.includes(n));
  });
  if (contains) return contains;

  // 3. Similaridad por tokens (umbral conservador: ≥50% tokens compartidos)
  const scored = results
    .map((r) => ({
      r,
      score: r.tags.name ? nameSimilarity(normalizeName(r.tags.name), expected) : 0,
    }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 0) return scored[0].r;

  // 4. No hay match aceptable → not found (evita false positives)
  return null;
}

function classifyStatus(distance: number): AuditResult["status"] {
  if (!Number.isFinite(distance)) return "not_found";
  if (distance < THRESHOLD_OK) return "ok";
  if (distance < THRESHOLD_REVIEW) return "needs_review";
  return "wrong";
}

async function auditPOI(attractor: Attractor): Promise<AuditResult> {
  const tags = TAGS_BY_TIPO[attractor.tipo] ?? [];
  // Junta resultados de todos los tags aplicables para el tipo. Dedup por lat+lng.
  const allResults: OverpassMatch[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const rs = await queryOverpass(attractor.lat, attractor.lng, tag);
    for (const r of rs) {
      const key = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allResults.push(r);
    }
    if (i < tags.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const best = selectBestMatch(allResults, attractor.lat, attractor.lng, attractor.nombre);

  if (!best) {
    return {
      nombre: attractor.nombre,
      tipo: attractor.tipo,
      comuna: attractor.comuna,
      current: { lat: attractor.lat, lng: attractor.lng },
      suggested: null,
      distance: Infinity,
      status: "not_found",
      source: "none",
    };
  }

  const distance = distanciaMetros(attractor.lat, attractor.lng, best.lat, best.lng);
  return {
    nombre: attractor.nombre,
    tipo: attractor.tipo,
    comuna: attractor.comuna,
    current: { lat: attractor.lat, lng: attractor.lng },
    suggested: { lat: best.lat, lng: best.lng },
    distance,
    status: classifyStatus(distance),
    source: "osm",
    osmTags: best.tags,
  };
}

// ─── Report ─────────────────────────────────────────
function formatRow(r: AuditResult): string {
  const icon =
    r.status === "ok" ? "✅" :
    r.status === "needs_review" ? "⚠️ " :
    r.status === "wrong" ? "❌" : "❓";
  const dist = Number.isFinite(r.distance) ? `${Math.round(r.distance)}m` : "—";
  return `${icon} ${r.nombre.padEnd(38)} ${r.tipo.padEnd(14)} ${dist.padStart(7)}`;
}

function generateReport(results: AuditResult[], elapsedMs: number) {
  const ok = results.filter((r) => r.status === "ok");
  const review = results.filter((r) => r.status === "needs_review");
  const wrong = results.filter((r) => r.status === "wrong");
  const notFound = results.filter((r) => r.status === "not_found");

  console.log("\n=== REPORTE DE AUDITORÍA DE COORDENADAS ===\n");
  console.log(`Total POIs auditados: ${results.length}`);
  console.log(`✅ OK (<${THRESHOLD_OK}m):              ${ok.length}`);
  console.log(`⚠️  Review (${THRESHOLD_OK}-${THRESHOLD_REVIEW}m):       ${review.length}`);
  console.log(`❌ Wrong (>${THRESHOLD_REVIEW}m):             ${wrong.length}`);
  console.log(`❓ No encontrados en OSM:       ${notFound.length}`);
  console.log(`⏱  Tiempo total: ${(elapsedMs / 1000).toFixed(1)}s`);

  if (wrong.length > 0) {
    console.log("\n🔴 POIS CON ERROR >300m:\n");
    wrong.forEach((r) => {
      console.log(`  ${r.nombre} (${r.tipo})`);
      console.log(`    Actual:    ${r.current.lat.toFixed(6)}, ${r.current.lng.toFixed(6)}`);
      console.log(`    Sugerido:  ${r.suggested?.lat.toFixed(6)}, ${r.suggested?.lng.toFixed(6)}`);
      console.log(`    Distancia: ${Math.round(r.distance)}m`);
      if (r.osmTags?.name) console.log(`    OSM name:  "${r.osmTags.name}"`);
      console.log();
    });
  }

  if (review.length > 0) {
    console.log("\n🟡 POIS A REVISAR (100-300m):\n");
    review.forEach((r) => {
      console.log(`  ${r.nombre} (${r.tipo}) — ${Math.round(r.distance)}m`);
    });
  }

  if (notFound.length > 0) {
    console.log("\n❓ NO ENCONTRADOS EN OSM (buscar manualmente):\n");
    notFound.forEach((r) => {
      console.log(`  - ${r.nombre} (${r.tipo})`);
    });
  }

  // Top 10 con mayor distancia entre los que se encontraron
  const found = results.filter((r) => Number.isFinite(r.distance));
  const top10 = [...found].sort((a, b) => b.distance - a.distance).slice(0, 10);
  console.log("\n📍 TOP 10 POIS MÁS DESALINEADOS:\n");
  top10.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${formatRow(r)}`);
  });

  const suggestions = results
    .filter((r) => r.status === "wrong" || r.status === "needs_review")
    .map((r) => ({
      nombre: r.nombre,
      tipo: r.tipo,
      comuna: r.comuna,
      current: r.current,
      suggested: r.suggested,
      distance: Math.round(r.distance),
      status: r.status,
      osmName: r.osmTags?.name,
    }));

  const outPath = path.resolve(process.cwd(), "audit-attractors-results.json");
  fs.writeFileSync(outPath, JSON.stringify(suggestions, null, 2));
  console.log(`\n📄 Sugerencias guardadas en: ${outPath}`);
  console.log("   Revisar el archivo y aplicar correcciones manualmente al attractors.ts");
}

// ─── Main ──────────────────────────────────────────
async function main() {
  // `a.tipo` del dataset es AttractorTipo ("clinica" | ... | "turismo"). El spread mantiene
  // ese tipo literal, así que el override explícito en el map es innecesario y chocaba
  // con `tipo: string` del alias. Usamos directamente `Attractor` (sin override).
  const allPOIs: Attractor[] = [
    ...CLINICAS,
    ...ZONAS_NEGOCIOS,
    ...UNIVERSIDADES,
    ...INSTITUTOS,
    ...COLEGIOS_TOP,
    ...PARQUES,
    ...MALLS,
    ...TREN_EFE,
  ];

  console.log(`Auditando ${allPOIs.length} POIs contra OpenStreetMap Overpass API...`);
  console.log(`Rate limit: ~1 request cada ${RATE_LIMIT_MS}ms → tiempo estimado ~${Math.round((allPOIs.length * RATE_LIMIT_MS) / 1000)}s\n`);

  const results: AuditResult[] = [];
  const t0 = Date.now();

  for (let i = 0; i < allPOIs.length; i++) {
    const attractor = allPOIs[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${allPOIs.length}] ${attractor.nombre} ... `);
    try {
      const result = await auditPOI(attractor);
      results.push(result);
      const icon =
        result.status === "ok" ? "✅" :
        result.status === "needs_review" ? "⚠️ " :
        result.status === "wrong" ? "❌" : "❓";
      const dist = Number.isFinite(result.distance) ? `${Math.round(result.distance)}m` : "—";
      console.log(`${icon} ${dist}`);
    } catch (e) {
      console.log(`⚠️  error: ${(e as Error).message}`);
      results.push({
        nombre: attractor.nombre,
        tipo: attractor.tipo,
        comuna: attractor.comuna,
        current: { lat: attractor.lat, lng: attractor.lng },
        suggested: null,
        distance: Infinity,
        status: "not_found",
        source: "none",
      });
    }
    if (i < allPOIs.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const elapsed = Date.now() - t0;
  generateReport(results, elapsed);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
