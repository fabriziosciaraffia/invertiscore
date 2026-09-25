// ============================================================================
// GOLDEN · qué archivos de scripts/ recorre un tier (25-sep-2026)
// ============================================================================
// Los tiers protegen lo que se publica. Un script suelto en la carpeta de alguien —sin trackear o
// ignorado— no llega a ningún deploy ni a ningún otro árbol, y leerlo del disco hacía que el mismo
// commit diera verde en un worktree y 29 fallas duras en el repo principal: 28 scripts viejos que
// llaman a un generador retirado y uno que pagina sin orden, ninguno en git. Decisión de Fabrizio:
// los tiers que recorren `scripts/` leen solo lo que git trackea. Los scripts sueltos no se borran.
//
// Si git no responde, esto TIRA: una lista vacía se leería como «no hay nada que revisar» y el
// tier daría verde sin haber leído nada.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Rutas absolutas de los archivos trackeados bajo `dir` (relativo a `raizRepo`) que existen en disco. */
export function archivosTrackeados(raizRepo: string, dir: string): string[] {
  const salida = execFileSync("git", ["ls-files", "-z", "--", dir], { cwd: raizRepo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const rutas = salida.split("\0").filter(Boolean);
  if (rutas.length === 0) throw new Error(`git ls-files no devolvió nada bajo ${dir}: el tier no puede leer el repo`);
  // Un archivo borrado en el árbol sin commitear sigue en el índice: se salta, no se lee.
  return rutas.map((r) => join(raizRepo, r)).filter((a) => existsSync(a));
}
