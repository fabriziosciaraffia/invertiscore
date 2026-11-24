// Instala el candado del push (scripts/hooks/pre-push) en la carpeta de hooks común del repo: vale para todos los worktrees.
// Uso: node scripts/hooks/instalar.mjs   (no pisa un pre-push distinto sin avisar: lo deja en pre-push.anterior).
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
// Siempre LF: con autocrlf el checkout puede traerlo en CRLF, y sh no lo corre.
const contenido = readFileSync(join(aqui, "pre-push"), "utf8").replace(/\r\n/g, "\n");
const comun = execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
const destino = join(isAbsolute(comun) ? comun : resolve(process.cwd(), comun), "hooks", "pre-push");
if (existsSync(destino) && readFileSync(destino, "utf8") !== contenido) {
  renameSync(destino, destino + ".anterior");
  console.log(`había otro pre-push: quedó en ${destino}.anterior`);
}
writeFileSync(destino, contenido);
chmodSync(destino, 0o755);
console.log(`candado del push instalado en ${destino}`);
