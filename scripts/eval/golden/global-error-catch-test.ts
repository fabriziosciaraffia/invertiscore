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
//   4 · EL INFORME TIENE SU PROPIA PANTALLA DE ERROR (19-oct-2026): /analisis/[id] y /analisis/renta-corta/[id] montan
//       ErrorInforme —«No pudimos mostrar este informe», que está guardado, «Recargar» que recarga y «Ir a mis análisis»—,
//       sin `reset` y con el error a Sentry: un corte de red ya no sube a global-error ni tapa la app.
//   5 · LOS MAPAS A SENTRY (19-oct-2026): solo el build de producción los genera y sube, se borran después y su log se ve;
//       sin las opciones viejas, que la versión 10 ignoraba en silencio.
//
// Verificado EN ROJO: contra el código de producción (0c3ae098) da 2 fallas (1 y 2); mutaciones 7/7 en rojo, restauradas
// byte a byte (scratchpad mutar-global-error.cjs): G1 vuelve onClick={reset} · G2 onClick={() => reset()} · G3 la recarga
// solo en un comentario · G4 la recarga en el título y el botón sin nada · G5 sin Sentry · G6 otro texto · G7 un segundo
// botón. §4: contra el código sin la pantalla, 3 fallas; mutaciones 7/7 en rojo (scratchpad mutar-error-informe.cjs): E1 el
// botón usa reset · E2 sin Sentry · E3 sin «use client» · E4 renta corta sin error.tsx · E5 no dice que está guardado ·
// E6 sin salida a mis análisis · E7 renta larga monta otra cosa. Verificado en el navegador (local, WebKit iPhone) con un
// error forzado y restaurado: la pantalla se ve y «Recargar» recarga. §5: contra la config de producción, 2 fallas;
// mutaciones 3/3 en rojo (sube desde cualquier build · no borra los mapas · el log callado). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/global-error-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
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

  // ── 4 · el informe tiene su propia pantalla de error (19-oct-2026) ──
  // Un error al dibujar el informe —un stream cortado— se queda en la ruta: no sube a global-error ni tapa la app.
  const rutaComp = "src/components/analysis/ErrorInforme.tsx";
  const comp = existsSync(join(RAIZ, rutaComp)) ? sinComentarios(leer(rutaComp)) : "";
  if (!comp) F("4 · el informe no tiene pantalla de error propia (un corte de red sube a global-error y tapa la página entera)");
  else {
    if (!/^"use client";/.test(leer(rutaComp))) F("4 · la pantalla de error del informe no es un componente de cliente (Next lo exige)");
    const bts = comp.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    if (bts.length !== 1 || !/onClick=\{\(\) => window\.location\.reload\(\)\}/.test(bts[0]) || !/>\s*Recargar\s*<\/button>$/.test(bts[0])) F("4 · «Recargar» no recarga la página (con la respuesta del servidor rota, reset dibuja lo mismo)");
    if (/\breset\b/.test(comp)) F("4 · la pantalla de error del informe usa `reset`");
    if (!/import\("@sentry\/nextjs"\)\.then\(\(Sentry\) => Sentry\.captureException\(error\)\)/.test(comp)) F("4 · la pantalla de error del informe no manda el error a Sentry (quedaría en silencio: ya no llega a global-error)");
    if (!/>\s*No pudimos mostrar este informe\s*</.test(comp) || !comp.includes("Puede que se haya cortado la conexión mientras cargaba. El informe está guardado: recarga la página para verlo.")
      || !/<Link href="\/dashboard"[^>]*>\s*Ir a mis análisis\s*<\/Link>/.test(comp)) F("4 · la pantalla de error del informe no dice qué pasó, que el informe está guardado y cómo salir");
  }
  for (const ruta of ["src/app/analisis/[id]/error.tsx", "src/app/analisis/renta-corta/[id]/error.tsx"]) {
    const s = existsSync(join(RAIZ, ruta)) ? leer(ruta) : "";
    if (!/^"use client";/.test(s) || !/export \{ ErrorInforme as default \} from "@\/components\/analysis\/ErrorInforme";/.test(s)) F(`4 · ${ruta} no monta la pantalla de error del informe`);
  }

  // ── 5 · los mapas a Sentry, solo desde el build de producción (19-oct-2026) ──
  // Las opciones viejas no existen en @sentry/nextjs 10: se ignoraban sin aviso. Se fijan las vigentes y que la versión
  // instalada todavía las tenga (una actualización que las renombre tiene que ponerse roja, no callar).
  const nc = sinComentarios(leer("next.config.mjs"));
  if (/disableSourceMapUpload|hideSourceMaps/.test(nc)) F("5 · next.config usa opciones de Sentry que la versión 10 ignora (los mapas no se controlan con ellas)");
  if (!/const buildDeProduccion = process\.env\.VERCEL_ENV === "production";/.test(nc) || !/sourcemaps: \{ disable: !buildDeProduccion, deleteSourcemapsAfterUpload: true \},/.test(nc) || !/silent: !buildDeProduccion,/.test(nc))
    F("5 · los mapas no se suben solo desde el build de producción, no se borran después de subir o su log no se ve");
  const tipos = leer("node_modules/@sentry/nextjs/build/types/config/types.d.ts");
  if (!/sourcemaps\?: \{[\s\S]*?disable\?: boolean;[\s\S]*?deleteSourcemapsAfterUpload\?: boolean;/.test(tipos)) F("5 · la versión instalada de @sentry/nextjs ya no acepta `sourcemaps.disable` / `deleteSourcemapsAfterUpload`");

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
