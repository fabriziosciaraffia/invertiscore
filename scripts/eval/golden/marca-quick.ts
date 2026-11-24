// ─────────────────────────────────────────────────────────────────────────────
// LA MARCA DEL QUICK VERDE (24-nov-2026, decisión de Fabrizio: «un paso previo al push que falle si no hay un QUICK verde sobre
// ese mismo commit»). El runner la deja SOLO si corrió el QUICK completo (exactamente `--quick`, sin `--seed` ni otra opción),
// terminó en 0 fallas duras y el árbol no tenía cambios en archivos versionados. La marca es un archivo con el nombre del commit
// en la carpeta común del repo (`<git-common-dir>/quick-verde/<sha>`, la misma para todos los worktrees), y adentro dice ese
// mismo commit: el hook `scripts/hooks/pre-push` rechaza el push a master o a una rama `claude/*` de un commit sin su marca.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface CorridaQuick {
  /** Los argumentos con que se llamó al runner. */
  argv: string[];
  /** Fallas duras del resumen. */
  hard: number;
  /** El árbol sin cambios en archivos versionados (`git status --porcelain --untracked-files=no` vacío). */
  limpio: boolean;
}

/** El QUICK completo es el runner llamado exactamente con `--quick`: un filtro de seeds o cualquier otra opción no cuentan. */
export function esQuickCompleto(argv: string[]): boolean {
  return argv.length === 1 && argv[0] === "--quick";
}

/** Se marca solo con el QUICK completo, 0 fallas duras y el árbol limpio. */
export function debeMarcar(c: CorridaQuick): boolean {
  return esQuickCompleto(c.argv) && c.hard === 0 && c.limpio;
}

/** El contenido de la marca: el commit (lo que el hook compara) y cuándo. */
export function contenidoMarca(sha: string, ahora: Date = new Date()): string {
  return `sha=${sha}\nquick=verde\nat=${ahora.toISOString()}\n`;
}

const git = (args: string[], cwd: string) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Deja la marca si corresponde. Devuelve la ruta escrita, o null y el motivo. */
export function marcarSiCorresponde(argv: string[], hard: number, cwd: string = process.cwd()): { ruta: string | null; motivo: string } {
  if (!esQuickCompleto(argv)) return { ruta: null, motivo: "no es el QUICK completo (solo `--quick`)" };
  if (hard !== 0) return { ruta: null, motivo: `${hard} falla(s) dura(s)` };
  let sha: string, comun: string, cambios: string;
  try {
    sha = git(["rev-parse", "HEAD"], cwd);
    comun = git(["rev-parse", "--git-common-dir"], cwd);
    cambios = git(["status", "--porcelain", "--untracked-files=no"], cwd);
  } catch (e) {
    return { ruta: null, motivo: `git no respondió: ${String(e).slice(0, 80)}` };
  }
  if (!debeMarcar({ argv, hard, limpio: cambios === "" })) return { ruta: null, motivo: "el árbol tiene cambios en archivos versionados" };
  const dir = join(isAbsolute(comun) ? comun : resolve(cwd, comun), "quick-verde");
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, sha);
  writeFileSync(ruta, contenidoMarca(sha));
  return { ruta, motivo: "QUICK completo, 0 fallas duras, árbol limpio" };
}
