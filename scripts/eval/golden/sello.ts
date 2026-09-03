// ============================================================================
// GOLDEN · sello de siembra (T5, 03-sep-2026)
// ============================================================================
// Las filas GOLDEN de la base se siembran desde seeds.ts/fixtures.ts (seed-db.ts) y
// los checks B8/B-PJ del QUICK recomputan sobre `row.input_data` persistido. Cuando
// alguien cambia un seed y no re-siembra, el rojo aparece en otra sesión y con otro
// nombre (pasó dos veces el 03-sep: B8 y B-PJ en GS-PJ). El sello guarda en cada fila
// el sha de los archivos de seeds y la fecha; el QUICK compara contra el repo y AVISA
// (soft, no rojo) cuando no coinciden.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Archivos que definen las filas GOLDEN: cambiarlos exige re-sembrar. */
const ARCHIVOS_SEED = ["scripts/eval/golden/seeds.ts", "scripts/eval/fixtures.ts", "scripts/eval/golden/ids.ts"];

/** sha1 (12 hex) del contenido de los archivos de seeds del repo. */
export function goldenSeedSha(raiz: string = process.cwd()): string {
  const h = createHash("sha1");
  for (const f of ARCHIVOS_SEED) h.update(readFileSync(join(raiz, f), "utf-8"));
  return h.digest("hex").slice(0, 12);
}

export const SELLO_KEYS = { sha: "goldenSeedSha", at: "goldenSeededAt" } as const;
