// ============================================================================
// GOLDEN · RENDIMIENTO DE LA LANDING EN MÓVIL — catch-test (28-sep-2026)
// ============================================================================
//   Lighthouse móvil daba 53 con el titular a los 7,5 s. Lo que se decidió, y este tier vigila:
//   1 · GOOGLE MAPS NO SE CARGA AL MONTAR: `useDireccionPlaces` carga y ata en `prepararPlaces()`,
//       al primer foco / toque / tecla del campo o al abrir la hoja; con `activo` y sin toque no hay
//       script. El hero abre `preconnect` a Google desde el montaje.
//   2 · LA SECCIÓN 3 LLEGA DESPUÉS DEL TITULAR: `Secciones.tsx` no importa la card real; la monta
//       `RecomendacionDiferida` por `next/dynamic` sin SSR, cuando la página está quieta o la
//       sección se acerca, con la altura reservada en `.lv-sreco`. Con un build a mano
//       (`.next/app-build-manifest.json`), ningún chunk de `/` trae el motor ni DocTokens.
//   3 · FUENTES: no se precarga ningún latin-ext; se precargan las cinco caras latin.
//   4 · ANALÍTICA CUANDO LA PÁGINA ESTÁ QUIETA: PostHog por `import()` con fachada que encola;
//       ningún `usePostHog` viene de `posthog-js/react`; el pixel corre su snippet en la ventana
//       quieta y el PageView espera a `listo`; Sentry inicializa por `import()` y guarda lo de antes.
//       `cuandoLaPaginaEsteQuieta` espera `load` y el ocio, y se puede cancelar.
//   5 · EL VIEWPORT PERMITE ZOOM: sin `maximumScale` en el layout raíz.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
//   Acta 28-sep-2026: A Maps al montar (prepararPlaces() pelado en el efecto) → 1 falla · B solo `focus`
//   dispara → 1 · C Secciones importa la card real → 1 · D vuelve un latin-ext → 2 · E PostHog carga al
//   montar → 1 · F vuelve maximumScale → 1 · G el PageView del pixel sin esperar → 1. Restaurado: verde.
// Solo:  node --import tsx scripts/eval/golden/landing-rendimiento-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { cuandoLaPaginaEsteQuieta, type OpcionesQuieta } from "../../../src/lib/pagina-quieta";
import { pendientesPostHog, posthogCliente } from "../../../src/lib/posthog-cliente";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

export function runLandingRendimientoTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER LANDING-RENDIMIENTO (móvil, 0 tokens) ───");

  // ── 1 · GOOGLE MAPS NO SE CARGA AL MONTAR ──────────────────────────────────
  const places = sinComentarios(leer("src/components/entrada/useDireccionPlaces.ts"));
  // cada `loadGoogleMaps()` del hook vive dentro de `prepararPlaces`, nunca en el cuerpo de un efecto
  const cuerpoPreparar = (places.match(/const prepararPlaces = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[activo\]\);/) ?? [])[1] ?? "";
  if (!cuerpoPreparar) F("1 · no encuentro `prepararPlaces` en useDireccionPlaces (el extractor no corrió)");
  const llamadas = (places.match(/loadGoogleMaps\(\)/g) ?? []).length;
  const dentro = (cuerpoPreparar.match(/loadGoogleMaps\(\)/g) ?? []).length;
  if (llamadas !== 1 || dentro !== 1) F(`1 · loadGoogleMaps() aparece ${llamadas} vez/veces en el hook y ${dentro} dentro de prepararPlaces: tiene que ser una, ahí`);
  if (/useEffect\(\(\) => \{\s*\n\s*if \(!activo\) return;\s*\n\s*let cancelado = false;\s*\n\s*loadGoogleMaps\(\)/.test(places)) F("1 · vuelve la carga de Google Maps al montar (efecto con loadGoogleMaps)");
  if (!/const eventos = \["focus", "pointerdown", "touchstart", "keydown"\] as const;\s*\n\s*for \(const e of eventos\) input\.addEventListener\(e, alPrimerToque, \{ once: true, passive: true \}\);/.test(places)) F("1 · el primer toque del campo no dispara la carga (listeners focus/pointerdown/touchstart/keydown, once)");
  if (!/\}, \[activo, clave, prepararPlaces\]\);/.test(places)) F("1 · los listeners no se vuelven a atar cuando el input vivo es otro (clave)");
  // dentro del efecto de los listeners, `prepararPlaces()` solo corre si ya hubo toque o el campo ya
  // tiene el foco: cualquier llamada pelada es Maps al montar
  const efectoToque = (places.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[activo, clave, prepararPlaces\]\);/) ?? [])[1] ?? "";
  if (!efectoToque) F("1 · no encuentro el efecto de los listeners (el extractor no corrió)");
  for (const linea of efectoToque.split("\n")) {
    if (!/prepararPlaces\(\)/.test(linea) || /const alPrimerToque = \(\) => prepararPlaces\(\);/.test(linea)) continue;
    if (!/^\s*if \((tocado\.current|document\.activeElement === input)\) /.test(linea)) F(`1 · Google Maps se carga al montar: «${linea.trim()}» no espera el toque`);
  }
  if (!/input\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\);/.test(places)) F("1 · con texto ya escrito al atar, el widget no recibe el aviso para proponer");
  if (!/return \{ inputRef, geocodificarEscrita, prepararPlaces \};/.test(places)) F("1 · el hook no expone prepararPlaces a quien monta");
  const hero = sinComentarios(leer("src/components/entrada/HeroEntrada.tsx"));
  if (!/const abrirHoja = \(\) => \{\s*\n\s*prepararPlaces\(\);\s*\n\s*flushSync\(\(\) => setHoja\(true\)\);/.test(hero)) F("1 · abrir la hoja del teléfono no arranca Google Maps en el mismo toque");
  if (!/onFocus=\{\(\) => \{ setEnfocado\(true\); medirFoco\(\); prepararPlaces\(\); \}\}/.test(hero)) F("1 · el foco del campo del hero no arranca Google Maps");
  if (!/<link rel="preconnect" href="https:\/\/maps\.googleapis\.com" \/>/.test(hero)) F("1 · el hero no abre la conexión con Google desde el montaje");

  // ── 2 · LA SECCIÓN 3 LLEGA DESPUÉS DEL TITULAR ─────────────────────────────
  const secciones = sinComentarios(leer("src/components/landing-v14/Secciones.tsx"));
  if (/from "\.\/Recomendacion"/.test(secciones)) F("2 · Secciones.tsx vuelve a importar la card real de forma estática");
  if (!/import \{ LoQueHariaFrancoDiferida \} from "\.\/RecomendacionDiferida";/.test(secciones) || !/<LoQueHariaFrancoDiferida \/>/.test(secciones)) F("2 · la sección 3 no monta la versión diferida");
  const diferida = sinComentarios(leer("src/components/landing-v14/RecomendacionDiferida.tsx"));
  if (!/dynamic\(\(\) => import\("\.\/Recomendacion"\)\.then\(\(m\) => \(\{ default: m\.LoQueHariaFranco \}\)\), \{\s*\n\s*ssr: false,/.test(diferida)) F("2 · la card real no entra por next/dynamic sin SSR");
  if (!/cuandoLaPaginaEsteQuieta\(\(\) => setListo\(true\)\)/.test(diferida) || !/new IntersectionObserver\(/.test(diferida) || !/rootMargin: "100% 0px"/.test(diferida)) F("2 · la card no espera a la página quieta ni a acercarse");
  if (!/\{listo && <LoQueHariaFranco \/>\}/.test(diferida)) F("2 · la card se monta antes de estar lista");
  for (const f of ["Entrada.tsx", "Respuesta.tsx", "Rotacion.tsx", "Telemetria.tsx", "Marca.tsx", "MapaSantiago.tsx", "Poblamiento.tsx", "SuaveScroll.tsx", "LinkMedido.tsx"]) {
    if (/from "\.\/Recomendacion"|analysis\/shared\/PosicionFranco|analysis\/shared\/PopupAjustes|portada\/PortadaInforme|hallazgos\/HallazgosAcordeon/.test(sinComentarios(leer(`src/components/landing-v14/${f}`)))) F(`2 · ${f} importa la card real o sus tokens: vuelve al primer paquete`);
  }
  if (/from "@\/components\/landing-v14\/Recomendacion"/.test(sinComentarios(leer("src/app/page.tsx")))) F("2 · page.tsx importa la card real de forma estática");
  const css = leer("src/components/landing-v14/landing.css");
  if (!/\.lv-sreco \{ --lv-sreco-reserva: 1083px; padding: var\(--lv-sec\) 0; min-height: max\(100svh, var\(--lv-sreco-reserva\)\);/.test(css)) F("2 · la sección 3 no reserva su altura antes de que llegue la card");
  for (const [w, h] of [["430", "996"], ["768", "1062"], ["1100", "900"]]) {
    if (!new RegExp(`@media \\(min-width: ${w}px\\) \\{ \\.lv-sreco \\{ --lv-sreco-reserva: ${h}px; \\} \\}`).test(css)) F(`2 · falta la reserva de altura a ${w} px (${h})`);
  }
  // Con un build de PRODUCCIÓN a mano (`GOLDEN_RAIZ_BUILD` o esta raíz): ningún chunk de `/` trae el
  // motor, DocTokens, el SDK de PostHog ni el de Sentry. Los marcadores son cadenas de las
  // librerías, no de nuestro código (nuestro `posthog-cliente.ts` nombra `capture_pageview` y el
  // config de Sentry nombra `captureException`). El `.next` de `next dev` empaqueta todo en tres
  // chunks sin hash: ahí el censo no vale y se dice.
  const raizBuild = process.env.GOLDEN_RAIZ_BUILD ?? RAIZ;
  const manifest = join(raizBuild, ".next", "app-build-manifest.json");
  if (existsSync(manifest)) {
    const pages = JSON.parse(readFileSync(manifest, "utf8")).pages as Record<string, string[]>;
    const chunks = (pages["/page"] ?? []).filter((f) => f.endsWith(".js"));
    const esProduccion = chunks.length > 3 && chunks.every((f) => /-[a-f0-9]{16}\.js$/.test(f) || /webpack-|main-app-/.test(f));
    if (!esProduccion) {
      console.log(`  · el .next de ${raizBuild} es de \`next dev\` (${chunks.length} chunks sin hash): el censo del bundle no corrió acá`);
    } else {
      const marcas: Array<[string, RegExp]> = [
        ["el motor", /calcIRR|hallazgoCapRate/],
        ["DocTokens", /doc-dictamen/],
        ["el SDK de PostHog", /\$feature_flag_called|\$autocapture_disabled_server_side|posthog-recorder/],
        ["el SDK de Sentry", /sentry\.javascript\.nextjs|__SENTRY__|sentry-trace/],
      ];
      for (const f of chunks) {
        const b = readFileSync(join(raizBuild, ".next", f), "utf8");
        for (const [que, rx] of marcas) if (rx.test(b)) F(`2 · el chunk ${f.split("/").pop()} de la landing trae ${que}`);
      }
      console.log(`  · build de producción en ${raizBuild}: ${chunks.length} chunks de «/» revisados`);
    }
  } else {
    console.log("  · sin build a mano (.next/app-build-manifest.json): el censo del bundle no corrió acá");
  }

  // ── 3 · FUENTES ────────────────────────────────────────────────────────────
  const layout = sinComentarios(leer("src/app/layout.tsx"));
  const precarga = (layout.match(/const FUENTES_PRECARGA = \[([\s\S]*?)\] as const;/) ?? [])[1] ?? "";
  if (!precarga) F("3 · no encuentro FUENTES_PRECARGA (el extractor no corrió)");
  if (/latin-ext/.test(precarga)) F("3 · vuelve a precargarse un latin-ext");
  const caras = precarga.match(/"[a-z0-9-]+\.woff2"/g) ?? [];
  if (caras.length !== 5) F(`3 · se precargan ${caras.length} caras, no las cinco latin`);
  for (const c of ["source-serif-4-normal-latin", "source-serif-4-italic-latin", "ibm-plex-sans-normal-latin", "inter-normal-latin", "jetbrains-mono-normal-latin"]) {
    if (!precarga.includes(`"${c}.woff2"`)) F(`3 · falta la precarga de ${c}`);
  }
  if (!/font-display: swap/.test(leer("src/app/fuentes.css"))) F("3 · las fuentes dejaron de ser swap");

  // ── 4 · ANALÍTICA CUANDO LA PÁGINA ESTÁ QUIETA ─────────────────────────────
  // (a) la primitiva: espera `load` y el ocio, corre una vez, se cancela
  {
    const llamadas: string[] = [];
    let idleCb: (() => void) | null = null;
    let loadCb: (() => void) | null = null;
    const win = {
      addEventListener: (ev: string, cb: () => void) => { if (ev === "load") loadCb = cb; },
      removeEventListener: () => { /* nada */ },
      setTimeout: (() => 0) as unknown as Window["setTimeout"],
      clearTimeout: () => { /* nada */ },
      requestIdleCallback: (cb: () => void) => { idleCb = cb; return 1; },
      cancelIdleCallback: () => { llamadas.push("cancelado"); },
    };
    const doc = { readyState: "loading" as DocumentReadyState };
    const cancelar = cuandoLaPaginaEsteQuieta(() => llamadas.push("corrio"), { doc, win: win as unknown as OpcionesQuieta["win"] });
    if (llamadas.length || idleCb) F("4 · la primitiva corre o pide ocio antes de `load`");
    (loadCb as (() => void) | null)?.();
    if (llamadas.length) F("4 · la primitiva corre en `load` sin esperar el ocio");
    (idleCb as (() => void) | null)?.();
    if (llamadas.join(",") !== "corrio") F(`4 · la primitiva no corrió una vez tras load+ocio (${llamadas.join(",")})`);
    const llamadas2: string[] = [];
    let idle2: (() => void) | null = null;
    const win2 = { ...win, requestIdleCallback: (cb: () => void) => { idle2 = cb; return 2; }, cancelIdleCallback: () => llamadas2.push("cancelado") };
    const cancelar2 = cuandoLaPaginaEsteQuieta(() => llamadas2.push("corrio"), { doc: { readyState: "complete" }, win: win2 as unknown as OpcionesQuieta["win"] });
    cancelar2();
    (idle2 as (() => void) | null)?.();
    if (llamadas2.join(",") !== "cancelado") F(`4 · cancelar no cancela (${llamadas2.join(",")})`);
    if (cuandoLaPaginaEsteQuieta(() => llamadas.push("servidor"), { doc: null as unknown as undefined, win: null as unknown as undefined }) === undefined) F("4 · en el servidor no devuelve el cancelador");
    void cancelar;
  }
  // (b) la fachada de PostHog encola hasta que el SDK cargue
  {
    const antes = pendientesPostHog();
    (posthogCliente as unknown as { capture: (e: string, p?: unknown) => void }).capture("tier_prueba", { a: 1 });
    (posthogCliente as unknown as { register: (p: unknown) => void }).register({ b: 2 });
    if (pendientesPostHog() !== antes + 2) F(`4 · la fachada de PostHog no encola (${pendientesPostHog() - antes} de 2)`);
    if ((posthogCliente as unknown as { __fachadaPostHog?: boolean }).__fachadaPostHog !== true) F("4 · el cliente que reciben los componentes no es la fachada");
  }
  const cliente = sinComentarios(leer("src/lib/posthog-cliente.ts"));
  if (!/cargando = import\("posthog-js"\)/.test(cliente) || !/for \(const \{ metodo, args \} of cola\.splice\(0\)\)/.test(cliente)) F("4 · el SDK de PostHog no entra por import() con la cola reproducida");
  if (!/session_recording: \{ maskAllInputs: true \}/.test(cliente) || !/capture_pageview: "history_change"/.test(cliente)) F("4 · las opciones de PostHog (grabación enmascarada, pageview por history) no viajan con la carga diferida");
  const providers = sinComentarios(leer("src/app/providers.tsx"));
  if (!/useEffect\(\(\) => cuandoLaPaginaEsteQuieta\(\(\) => \{ void cargarPostHog\(\) \}\), \[\]\)/.test(providers) || !/<PostHogProvider client=\{posthogCliente\}>/.test(providers)) F("4 · el provider no carga PostHog con la página quieta ni entrega la fachada");
  if (/from ['"]posthog-js['"]/.test(providers)) F("4 · el provider vuelve a importar posthog-js de forma estática");
  const estaticos = execSync("git grep -l -E \"from ['\\\"]posthog-js(/react)?['\\\"]\" -- src", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((f) => !/^import type/.test("") && /(^|\n)import (?!type)[^\n]*from ['"]posthog-js(\/react)?['"]/.test(leer(f)));
  if (estaticos.length) F(`4 · quedan imports estáticos de posthog-js: ${estaticos.join(", ")}`);
  const pixel = sinComentarios(leer("src/components/analytics/MetaPixel.tsx"));
  if (!/return cuandoLaPaginaEsteQuieta\(\(\) => \{/.test(pixel) || !/\}\)\(window, document, "script", "https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js"\);/.test(pixel)) F("4 · el snippet del pixel no corre con la página quieta");
  if (!/if \(!PIXEL_ID \|\| !listo\) return;\s*\n\s*metaTrack\("PageView"\);\s*\n\s*\}, \[listo, pathname, searchParams\]\);/.test(pixel)) F("4 · el PageView del pixel no espera a que el snippet haya corrido");
  const sentry = sinComentarios(leer("sentry.client.config.ts"));
  if (/^import \* as Sentry from "@sentry\/nextjs";/m.test(sentry)) F("4 · Sentry vuelve a entrar de forma estática en el navegador");
  if (!/cuandoLaPaginaEsteQuieta\(\(\) => \{\s*\n\s*import\("@sentry\/nextjs"\)/.test(sentry) || !/for \(const err of pendientes\.splice\(0\)\) Sentry\.captureException\(err\);/.test(sentry)) F("4 · Sentry no inicializa con la página quieta ni manda lo que falló antes");
  if (!/window\.addEventListener\("error", /.test(sentry) || !/window\.addEventListener\("unhandledrejection", /.test(sentry)) F("4 · los errores anteriores a Sentry no se guardan");
  if (/^import \* as Sentry from "@sentry\/nextjs";/m.test(sinComentarios(leer("src/app/global-error.tsx")))) F("4 · global-error.tsx importa Sentry de forma estática");

  // ── 5 · EL VIEWPORT PERMITE ZOOM ───────────────────────────────────────────
  const viewport = (layout.match(/export const viewport: Viewport = \{([\s\S]*?)\};/) ?? [])[1] ?? "";
  if (!viewport) F("5 · no encuentro el viewport del layout raíz (el extractor no corrió)");
  if (/maximumScale|userScalable: false/.test(viewport)) F("5 · el viewport vuelve a impedir el zoom");
  if (!/width: "device-width"/.test(viewport) || !/initialScale: 1/.test(viewport)) F("5 · el viewport perdió width/initialScale");

  if (fallas.length) {
    console.log(`  ✗ LANDING-RENDIMIENTO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — Google Maps espera al primer toque; la sección 3 llega después del titular con su altura reservada y sin el motor en el paquete; sin latin-ext precargadas; PostHog, Sentry y el pixel cargan con la página quieta y no pierden lo de antes; el viewport permite zoom");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLandingRendimientoTier();
  process.exit(hard ? 1 : 0);
}
