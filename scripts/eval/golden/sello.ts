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

// Los fines de línea NO son contenido. git guarda estos archivos en LF y cada checkout los
// escribe como quiere: en el principal `fixtures.ts` sale en CRLF y en un worktree en LF, así que
// el sha de los bytes crudos cambiaba de carpeta en carpeta con el mismo contenido y el QUICK
// marcaba 13 drift «corre seed-db.ts» que no eran nada (25-sep-2026). El sello se calcula sobre el
// texto con los saltos llevados a LF.
function shaDe(raiz: string, salto: "\n" | "\r\n"): string {
  const h = createHash("sha1");
  for (const f of ARCHIVOS_SEED) h.update(readFileSync(join(raiz, f), "utf-8").replace(/\r\n/g, "\n").replace(/\n/g, salto));
  return h.digest("hex").slice(0, 12);
}

/** sha1 (12 hex) del contenido de los archivos de seeds del repo, con los saltos normalizados a LF. */
export function goldenSeedSha(raiz: string = process.cwd()): string {
  return shaDe(raiz, "\n");
}

/**
 * ¿El sello guardado en una fila corresponde al contenido del repo? Acepta el sello normalizado
 * y, para las filas sembradas antes del 25-sep-2026 —cuando el sello era el de los bytes crudos
 * de un checkout en CRLF—, ese mismo contenido escrito en CRLF. Las dos formas describen el mismo
 * texto: un cambio real en un seed cambia las dos y sigue marcando drift.
 */
export function selloCoincide(selloFila: unknown, raiz: string = process.cwd()): boolean {
  return selloFila === shaDe(raiz, "\n") || selloFila === shaDe(raiz, "\r\n");
}

export const SELLO_KEYS = { sha: "goldenSeedSha", at: "goldenSeededAt" } as const;
