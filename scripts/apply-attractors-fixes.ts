/**
 * Aplica las sugerencias válidas de audit-attractors-results.json al dataset
 * src/lib/data/attractors.ts. Deja backup y genera AUDIT_MANUAL_REVIEW.md con
 * los POIs que necesitan revisión humana (por false positive en OSM).
 *
 * Uso:
 *   npx tsx scripts/apply-attractors-fixes.ts
 */

import fs from "node:fs";
import path from "node:path";

interface Suggestion {
  nombre: string;
  tipo: string;
  comuna?: string;
  current: { lat: number; lng: number };
  suggested: { lat: number; lng: number } | null;
  distance: number;
  status: "ok" | "needs_review" | "wrong" | "not_found";
  osmName?: string;
}

// Matches explícitamente validados en el reporte previo (Claude Code confirmó
// que el osmName corresponde al mismo lugar buscado).
const VALID_MATCHES_EXPLICIT = new Set<string>([
  "Clínica Santa María",
  "Clínica Indisa",
  "Clínica Dávila",
  "FALP (Oncológico)",
  "Hospital Salvador",
  "Hospital Calvo Mackenna",
  "U. Mayor",
  "U. de los Andes",
  "U. Andrés Bello República",
  "UAI Peñalolén",
  "DuocUC Antonio Varas",
  "DuocUC Plaza Oeste",
  "Parque Inés de Suárez",
  "Parque Araucano",
  "Parque Bicentenario",
  "Mall Plaza Norte",
  "Mall Plaza Egaña",
  "Portal La Dehesa",
  "Colegio Tabancura",
  "Colegio San Ignacio El Bosque",
  "Colegio Nido de Águilas",
  "Nueva Las Condes",
  "El Golf / Sanhattan",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/\\\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCleanMatch(original: string, osmName: string | undefined): boolean {
  if (!osmName) return false;
  const a = normalize(original);
  const b = normalize(osmName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const tokensA = a.split(" ").filter((t) => t.length > 3);
  const tokensB = b.split(" ").filter((t) => t.length > 3);
  const common = tokensA.filter((t) => tokensB.includes(t));
  return common.length >= 2;
}

function shouldApply(s: Suggestion): boolean {
  if (!s.suggested) return false;
  if (s.status === "ok" || s.status === "not_found") return false;
  return VALID_MATCHES_EXPLICIT.has(s.nombre) || isCleanMatch(s.nombre, s.osmName);
}

function replaceCoords(
  fileContent: string,
  nombre: string,
  newLat: number,
  newLng: number
): { updated: string; matched: boolean } {
  const escaped = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(nombre:\\s*"${escaped}"[^}]*?lat:\\s*)(-?\\d+\\.?\\d*)([^}]*?lng:\\s*)(-?\\d+\\.?\\d*)`,
    "s"
  );
  if (!pattern.test(fileContent)) return { updated: fileContent, matched: false };
  return {
    updated: fileContent.replace(pattern, `$1${newLat}$3${newLng}`),
    matched: true,
  };
}

function generateManualReviewMd(toReview: Suggestion[]) {
  const lines: string[] = [];
  lines.push("# POIs pendientes de revisión manual\n");
  lines.push(
    `Generado automáticamente tras el audit. **${toReview.length} POIs** requieren verificación con Google Maps antes de aplicar correcciones.\n`
  );
  lines.push("## Instrucciones\n");
  lines.push("1. Para cada fila, abrir el link de Google Maps");
  lines.push("2. Confirmar que el resultado corresponde al **nombre buscado** (no el `osmName`, que puede ser un false positive)");
  lines.push("3. Click derecho sobre el pin correcto en Google Maps → copiar las coordenadas que aparecen al tope del menú");
  lines.push("4. Reemplazar en la columna *Coord correcta*");
  lines.push("5. Cuando estén completas, un segundo script puede leer este MD y aplicar las correcciones al dataset");
  lines.push("\n---\n");

  const byTipo = new Map<string, Suggestion[]>();
  for (const s of toReview) {
    if (!byTipo.has(s.tipo)) byTipo.set(s.tipo, []);
    byTipo.get(s.tipo)!.push(s);
  }

  const tipoNames: Record<string, string> = {
    clinica: "Clínicas y hospitales",
    universidad: "Universidades",
    instituto: "Institutos profesionales",
    colegio: "Colegios",
    parque: "Parques",
    mall: "Centros comerciales",
    negocios: "Zonas de negocios",
    tren: "Estaciones de tren",
  };

  // Orden estable por tipo
  const orderedTipos = Array.from(byTipo.keys()).sort();
  for (const tipo of orderedTipos) {
    const list = byTipo.get(tipo)!;
    lines.push(`## ${tipoNames[tipo] ?? tipo} (${list.length})\n`);
    lines.push("| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |");
    lines.push("|---|---|---|---|---|---|");
    for (const s of list) {
      const osmInfo = s.osmName
        ? `${s.osmName} (${Math.round(s.distance)}m)`
        : "(no encontrado)";
      const cur = `${s.current.lat.toFixed(4)}, ${s.current.lng.toFixed(4)}`;
      const q = encodeURIComponent(`${s.nombre} Santiago Chile`);
      const link = `https://www.google.com/maps/search/${q}`;
      lines.push(`| ${s.nombre} | ${s.status} | ${osmInfo} | \`${cur}\` | _completar_ | [buscar](${link}) |`);
    }
    lines.push("");
  }

  lines.push("---\n");
  lines.push("## Después de completar la tabla\n");
  lines.push(
    "Guardar este archivo con las coordenadas llenadas y avisar a Claude con el prompt de “aplicar correcciones manuales” — un script leerá la columna *Coord correcta* y actualizará `src/lib/data/attractors.ts`.\n"
  );

  fs.writeFileSync("AUDIT_MANUAL_REVIEW.md", lines.join("\n"));
  console.log(`\n📄 Archivo manual generado: AUDIT_MANUAL_REVIEW.md (${toReview.length} POIs)`);
}

function main() {
  const rootDir = process.cwd();
  const jsonPath = path.join(rootDir, "audit-attractors-results.json");
  const filePath = path.join(rootDir, "src/lib/data/attractors.ts");
  const backupPath = filePath + ".backup";

  if (!fs.existsSync(jsonPath)) {
    console.error(`No existe ${jsonPath}. Corre primero: npm run audit:attractors`);
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`No existe ${filePath}`);
    process.exit(1);
  }

  fs.copyFileSync(filePath, backupPath);
  console.log(`📦 Backup creado: ${backupPath}`);

  const raw = fs.readFileSync(jsonPath, "utf8");
  const suggestions = JSON.parse(raw) as Suggestion[];

  const toApply = suggestions.filter(shouldApply);
  const toReview = suggestions.filter(
    (s) => !shouldApply(s) && s.status !== "ok"
  );

  console.log(`\nSugerencias totales: ${suggestions.length}`);
  console.log(`  → A aplicar automáticamente: ${toApply.length}`);
  console.log(`  → A revisar manualmente:     ${toReview.length}`);
  console.log("");

  let content = fs.readFileSync(filePath, "utf8");
  let applied = 0;
  const failed: Suggestion[] = [];
  const categoryCounts = new Map<string, number>();

  for (const s of toApply) {
    const { updated, matched } = replaceCoords(
      content,
      s.nombre,
      s.suggested!.lat,
      s.suggested!.lng
    );
    if (matched) {
      content = updated;
      applied++;
      categoryCounts.set(s.tipo, (categoryCounts.get(s.tipo) ?? 0) + 1);
      console.log(`  ✓ ${s.nombre.padEnd(44)} (${s.tipo})  -${Math.round(s.distance)}m`);
    } else {
      failed.push(s);
      console.log(`  ✗ ${s.nombre.padEnd(44)} (regex no matchó)`);
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`\n✅ ${applied} POIs actualizados en ${filePath}`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} POIs que deberían aplicarse pero el regex falló (estructura inesperada):`);
    for (const f of failed) {
      console.log(`  - ${f.nombre}`);
    }
    // Empujar los fallidos al review manual para no perderlos
    toReview.push(...failed);
  }

  if (categoryCounts.size > 0) {
    console.log("\nAplicados por categoría:");
    for (const [tipo, n] of Array.from(categoryCounts.entries()).sort()) {
      console.log(`  ${tipo.padEnd(14)} ${n}`);
    }
  }

  generateManualReviewMd(toReview);
}

main();
