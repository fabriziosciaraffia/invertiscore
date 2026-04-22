/**
 * Aplica las coordenadas manuales del AUDIT_MANUAL_REVIEW.md al dataset
 * src/lib/data/attractors.ts. Deja backup.
 *
 * Uso:
 *   npx tsx scripts/apply-manual-fixes.ts
 */

import fs from "node:fs";
import path from "node:path";

interface Fix {
  nombre: string;
  lat: number;
  lng: number;
  source: "manual_md" | "override";
}

// Overrides cuando la búsqueda manual dejó el POI como "NO ENCONTRADO".
// Coordenadas derivadas de la dirección oficial.
const MANUAL_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  "INACAP Providencia": { lat: -33.4535, lng: -70.6070 }, // Brown Norte 290, Ñuñoa
};

function extractCoords(raw: string): { lat: number; lng: number } | null {
  // Quita itálica/bold/backticks markdown y espacios.
  const cleaned = raw.replace(/[_*`]/g, "").trim();
  const match = cleaned.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  // Sanity range for Chile (aprox).
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -40 || lat > -30) return null;
  if (lng < -75 || lng > -65) return null;
  return { lat, lng };
}

function parseMd(mdContent: string): Fix[] {
  const fixes: Fix[] = [];
  const lines = mdContent.split("\n");

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.toLowerCase().includes("nombre buscado")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 5) continue;

    const nombre = cells[0];
    const coordCorrecta = cells[4];
    const lower = coordCorrecta.toLowerCase();

    if (lower.includes("por completar")) continue;
    if (lower.includes("completar")) continue;
    if (lower.includes("no encontrado")) continue;
    if (lower.includes("??")) continue;

    const coords = extractCoords(coordCorrecta);
    if (!coords) continue;

    fixes.push({ nombre, lat: coords.lat, lng: coords.lng, source: "manual_md" });
  }

  return fixes;
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

function main() {
  const rootDir = process.cwd();
  const mdPath = path.join(rootDir, "AUDIT_MANUAL_REVIEW.md");
  const filePath = path.join(rootDir, "src/lib/data/attractors.ts");
  const backupPath = filePath + ".manual-backup";

  if (!fs.existsSync(mdPath)) {
    console.error(`No existe ${mdPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`No existe ${filePath}`);
    process.exit(1);
  }

  fs.copyFileSync(filePath, backupPath);
  console.log(`📦 Backup creado: ${backupPath}\n`);

  const mdContent = fs.readFileSync(mdPath, "utf8");
  let fixes = parseMd(mdContent);
  console.log(`Del MD parseé ${fixes.length} correcciones con coordenadas válidas.`);

  // Apply overrides (pueden pisar un valor del MD o agregar uno nuevo).
  const fixesByName = new Map(fixes.map((f) => [f.nombre, f]));
  for (const [nombre, coords] of Object.entries(MANUAL_OVERRIDES)) {
    const existed = fixesByName.has(nombre);
    fixesByName.set(nombre, { nombre, ...coords, source: "override" });
    console.log(`  ↳ Override: ${nombre}${existed ? " (pisa valor del MD)" : " (nuevo)"}`);
  }
  fixes = Array.from(fixesByName.values());

  console.log(`\nAplicando ${fixes.length} correcciones al dataset...\n`);

  let content = fs.readFileSync(filePath, "utf8");
  let applied = 0;
  const failed: string[] = [];
  const byCategory = new Map<string, number>();

  for (const fix of fixes) {
    const { updated, matched } = replaceCoords(content, fix.nombre, fix.lat, fix.lng);
    if (matched) {
      content = updated;
      applied++;
      const tag = fix.source === "override" ? " [override]" : "";
      console.log(`  ✓ ${fix.nombre.padEnd(42)} → ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}${tag}`);
    } else {
      failed.push(fix.nombre);
      console.log(`  ✗ ${fix.nombre} (regex no matchó)`);
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`\n✅ ${applied}/${fixes.length} POIs actualizados en ${filePath}`);
  if (byCategory.size > 0) {
    console.log("\nPor categoría:");
    byCategory.forEach((v, k) => console.log(`  ${k}: ${v}`));
  }

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} no se pudieron aplicar (estructura inesperada):`);
    failed.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

main();
