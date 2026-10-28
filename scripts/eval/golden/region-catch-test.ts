// ─────────────────────────────────────────────────────────────────────────────
// Tier REGION (28-oct-2026, 0 tokens) — las funciones corren al lado de la base. Supabase está en sa-east-1 (São Paulo) y
// hasta el 28-oct las funciones de Node (rutas de API, páginas del servidor y crons) corrían en iad1 (Washington): cada
// consulta cruzaba el continente dos veces. Medido con `x-vercel-id` («gru1::iad1»: entra por São Paulo, corre en iad1).
// Desde ese día van en gru1 (`regions` de vercel.json); el middleware y las rutas `runtime = "edge"` (las imágenes OG)
// corren en el borde más cercano, que desde Chile ya es gru1.
//   1 · vercel.json lleva `"regions": ["gru1"]`, y nada más.
//   2 · ninguna ruta se va a otra región por su cuenta (`preferredRegion` fuera de gru1).
// ACTA DE MUTACIONES (28-oct-2026): M1 sin `regions` → ROJO §1 · M2 `regions: ["iad1"]` → ROJO §1 · M3 una ruta con
// `export const preferredRegion = "iad1"` → ROJO §2.
// Solo:  node --import tsx scripts/eval/golden/region-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
export const REGION_FUNCIONES = "gru1";

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

export function runRegionTier(): { hard: number } {
  console.log("\n─── TIER REGION (las funciones corren en gru1, al lado de la base · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  try {
    const vj = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf8")) as { regions?: unknown };
    if (!Array.isArray(vj.regions) || vj.regions.length !== 1 || vj.regions[0] !== REGION_FUNCIONES) F(`1 · vercel.json no pone las funciones en ${REGION_FUNCIONES}: ${JSON.stringify(vj.regions)}`);
    const fuera = archivos(join(RAIZ, "src"))
      .map((p) => ({ p: relative(RAIZ, p).replace(/\\/g, "/"), s: readFileSync(p, "utf8") }))
      .filter(({ s }) => /export const preferredRegion\s*=/.test(s) && !new RegExp(`export const preferredRegion\\s*=\\s*\\[?\\s*["']${REGION_FUNCIONES}["']\\s*\\]?\\s*;`).test(s))
      .map(({ p }) => p);
    if (fuera.length > 0) F(`2 · estas rutas se van a otra región con preferredRegion: ${fuera.join(", ")}`);
  } catch (e) {
    F(`no corrió: ${(e as Error).message}`);
  }
  if (fallas.length) {
    console.log(`  ✗ REGION · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — las funciones de Node corren en ${REGION_FUNCIONES} (vercel.json) y ninguna ruta se va a otra región`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runRegionTier().hard ? 1 : 0);
}
