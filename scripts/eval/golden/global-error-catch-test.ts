// ============================================================================
// GOLDEN · GLOBAL-ERROR — catch-test (19-oct-2026)
// ============================================================================
//   Sentry JAVASCRIPT-NEXTJS-9, «Cannot read properties of null (reading 'get')» en /analisis/:id. El caso: el 19-oct a
//   las 12:04 UTC, una persona que entró desde el correo semanal (Android, app de Gmail) perdió la conexión a mitad de la
//   navegación al informe («network error», JAVASCRIPT-NEXTJS-1B). Sin `error.tsx` en la ruta, el error subió a
//   `global-error`, que reemplaza la página entera por «Algo salió mal · Intentar de nuevo». Tocó el botón cinco veces y
//   cada toque fue el TypeError: no salió de esa pantalla hasta recargar a mano.
//   Por qué: en Next 14.2 el `reset()` de global-error vuelve a montar el router, y el router arma su caché inicial con
//   `initialParallelRoutes`, que un efecto deja en null después del primer montaje (app-router.js); el `.get` revienta
//   en fill-lazy-items-till-leaf-with-head.js. El botón NUNCA funcionó, en ninguna ruta.
//   Lo que este tier vigila:
//   1 · «Intentar de nuevo» RECARGA LA PÁGINA (`window.location.reload()`), que es lo que de verdad saca de ahí.
//   2 · `reset` no se usa en ninguna forma en global-error.
//   3 · El error se sigue mandando a Sentry.
//
// Verificado EN ROJO: contra el código de producción (0c3ae098) da 2 fallas (1 y 2); mutaciones 7/7 en rojo, restauradas
// byte a byte (scratchpad mutar-global-error.cjs): G1 vuelve onClick={reset} · G2 onClick={() => reset()} · G3 la recarga
// solo en un comentario · G4 la recarga en el título y el botón sin nada · G5 sin Sentry · G6 otro texto · G7 un segundo
// botón. Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/global-error-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "./lectura-paginada-catch-test";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

export function runGlobalErrorTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER GLOBAL-ERROR (la pantalla de error de toda la app · 0 tokens) ───");

  const ge = sinComentarios(leer("src/app/global-error.tsx"));
  const botones = ge.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  if (botones.length !== 1) F(`1 · global-error tiene ${botones.length} botones (se espera uno: «Intentar de nuevo»)`);
  const boton = botones[0] ?? "";
  if (!/onClick=\{\(\) => window\.location\.reload\(\)\}/.test(boton)) F("1 · «Intentar de nuevo» no recarga la página (en Next 14.2 el reset de global-error revienta: Sentry JAVASCRIPT-NEXTJS-9)");
  if (!/>\s*Intentar de nuevo\s*<\/button>$/.test(boton)) F("1 · el botón dejó de decir «Intentar de nuevo»");
  if (/\breset\b/.test(ge)) F("2 · global-error usa `reset` (vuelve a montar el router con el caché inicial en null y revienta en el `.get`)");
  if (!/import\("@sentry\/nextjs"\)\.then\(\(Sentry\) => Sentry\.captureException\(error\)\)/.test(ge)) F("3 · global-error dejó de mandar el error a Sentry");

  if (fallas.length) {
    console.log(`  ✗ GLOBAL-ERROR · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — «Intentar de nuevo» recarga la página, sin `reset`, y el error va a Sentry");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runGlobalErrorTier().hard ? 1 : 0);
}
