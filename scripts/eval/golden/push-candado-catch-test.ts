// ─────────────────────────────────────────────────────────────────────────────
// TIER PUSH-CANDADO (24-nov-2026, decisión de Fabrizio, 0 tokens): ningún commit sube a master ni a una rama claude/* sin un
// QUICK verde sobre ESE commit. Dos piezas: el runner deja la marca solo con el QUICK completo, 0 fallas duras y el árbol limpio
// (marca-quick.ts), y el hook scripts/hooks/pre-push rechaza el push sin ella. El hook se prueba con `git push` DE VERDAD, contra
// un remoto temporal en la carpeta temporal del sistema: nada toca este repo ni su remoto.
//   §1 · la marca: cuándo se deja y cuándo no (la regla pura y la escritura real sobre un árbol con cambios)
//   §2 · el hook: sin marca, rechazado; con la marca de OTRO commit, rechazado; con una marca copiada que dice otro commit,
//        rechazado; a master sin marca, rechazado; con su marca, aceptado; una rama fuera del alcance, pasa
//   §3 · el runner deja la marca al final del QUICK, con el total de fallas duras
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contenidoMarca, debeMarcar, esQuickCompleto, marcarSiCorresponde } from "./marca-quick";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");

export async function runPushCandadoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PUSH-CANDADO (ningún commit sube a master ni a claude/* sin un QUICK verde sobre él · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── §1 · la marca ──
  if (!esQuickCompleto(["--quick"]) || esQuickCompleto(["--quick", "--seed=GS-01"]) || esQuickCompleto([]) || esQuickCompleto(["--full"])) F("1 · el QUICK completo no es exactamente `--quick`");
  if (!debeMarcar({ argv: ["--quick"], hard: 0, limpio: true })) F("1 · el QUICK completo, verde y limpio no deja la marca");
  if (debeMarcar({ argv: ["--quick"], hard: 1, limpio: true })) F("1 · se marca con fallas duras");
  if (debeMarcar({ argv: ["--quick"], hard: 0, limpio: false })) F("1 · se marca con el árbol con cambios");
  if (debeMarcar({ argv: ["--quick", "--seed=GS-01"], hard: 0, limpio: true })) F("1 · se marca una tanda acotada");

  // ── §2 · el hook, con git push de verdad ──
  const base = mkdtempSync(join(tmpdir(), "candado-"));
  try {
    const g = (cwd: string, args: string[]) => execFileSync("git", ["-c", "user.name=Prueba", "-c", "user.email=prueba@ejemplo.invalid", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const remoto = join(base, "remoto.git"), clon = join(base, "clon");
    mkdirSync(clon);
    g(base, ["init", "-q", "--bare", remoto]);
    g(clon, ["init", "-q", "-b", "trabajo"]);
    g(clon, ["remote", "add", "origin", remoto]);
    writeFileSync(join(clon, "a.txt"), "uno\n"); g(clon, ["add", "a.txt"]); g(clon, ["commit", "-q", "-m", "uno"]);
    const shaA = g(clon, ["rev-parse", "HEAD"]);
    writeFileSync(join(clon, "a.txt"), "dos\n"); g(clon, ["commit", "-q", "-am", "dos"]);
    const shaB = g(clon, ["rev-parse", "HEAD"]);
    // El hook, tal como lo instala instalar.mjs (siempre LF).
    writeFileSync(join(clon, ".git", "hooks", "pre-push"), leer("scripts/hooks/pre-push"), { mode: 0o755 });
    const marcas = join(clon, ".git", "quick-verde");
    const push = (ref: string, sha = shaB) => spawnSync("git", ["push", "-q", "origin", `${sha}:refs/heads/${ref}`], { cwd: clon, encoding: "utf8" });

    // Sin marca: rechazado, y el remoto no la recibe.
    const sin = push("claude/prueba");
    if (sin.status === 0) F("2 · un push a claude/* sin marca pasó");
    else if (!/candado del push/.test(sin.stderr)) F(`2 · el push sin marca falló por otra cosa: ${sin.stderr.slice(0, 120)}`);
    // La marca de OTRO commit (el anterior): rechazado.
    mkdirSync(marcas, { recursive: true });
    writeFileSync(join(marcas, shaA), contenidoMarca(shaA));
    if (push("claude/prueba").status === 0) F("2 · un push con la marca de otro commit pasó");
    // Una marca con el nombre del commit pero copiada de otro (adentro dice otro sha): rechazado.
    writeFileSync(join(marcas, shaB), contenidoMarca(shaA));
    if (push("claude/prueba").status === 0) F("2 · una marca copiada de otro commit dejó pasar el push");
    rmSync(join(marcas, shaB));
    // A master sin marca: rechazado.
    if (push("master").status === 0) F("2 · un push a master sin marca pasó");
    // Con su marca, escrita por la misma función del runner: aceptado.
    const m = marcarSiCorresponde(["--quick"], 0, clon);
    if (!m.ruta) F(`2 · el runner no dejó la marca en un árbol limpio: ${m.motivo}`);
    const con = push("claude/prueba");
    if (con.status !== 0) F(`2 · un push con su marca fue rechazado: ${con.stderr.slice(0, 120)}`);
    else if (g(remoto, ["rev-parse", "refs/heads/claude/prueba"]) !== shaB) F("2 · el push con marca no llegó al remoto");
    // Una rama fuera del alcance, sin marca: pasa.
    if (push("otra/rama", shaA).status !== 0) F("2 · el candado frena una rama que no es master ni claude/*");
    // Con el árbol con cambios, el runner no marca.
    writeFileSync(join(clon, "a.txt"), "tres\n");
    if (marcarSiCorresponde(["--quick"], 0, clon).ruta) F("1 · el runner marcó con el árbol con cambios");
  } catch (e) {
    F(`2 · no se pudo armar el repo de prueba: ${String(e).slice(0, 160)}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  // ── §3 · el runner deja la marca al final del QUICK ──
  const runner = leer("scripts/eval/golden/runner.ts").replace(/\/\/[^\n]*/g, "");
  if (!/const marca = marcarSiCorresponde\(argv, totalHard\);\s*console\.log\(marca\.ruta \? [^\n]*: [^\n]*\);\s*process\.exit\(totalHard === 0 \? 0 : 1\);/.test(runner)) F("3 · el runner no deja la marca al final del QUICK (o no con el total de fallas duras)");
  if (!/^scripts\/hooks\/pre-push text eol=lf$/m.test(leer(".gitattributes"))) F("3 · el hook no está fijado en LF (.gitattributes)");

  for (const f of fallas) console.log(`  ✗ ${f}`);
  if (fallas.length === 0) console.log("  ✓ VERDE — sin marca no sube: ni sin QUICK, ni con la marca de otro commit, ni a master; con su marca, sí; las demás ramas pasan");
  return { hard: fallas.length };
}
