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
//   3 · FUENTES: no se precarga ningún latin-ext; solo las caras de arriba del pliegue (Source Serif normal e
//       itálica, Inter); todas las caras son swap con respaldo ajustado; el fondo del hero sin prioridad alta.
//   4 · ANALÍTICA CUANDO LA PÁGINA ESTÁ QUIETA: PostHog por `import()` con fachada que encola;
//       ningún `usePostHog` viene de `posthog-js/react`; el pixel corre su snippet en la ventana
//       quieta y el PageView espera a `listo`; Sentry inicializa por `import()` y guarda lo de antes.
//       `cuandoLaPaginaEsteQuieta` espera `load` y el ocio, y se puede cancelar.
//   5 · EL VIEWPORT PERMITE ZOOM: sin `maximumScale` en el layout raíz.
//   6 · LCP EN TELÉFONO (19-oct-2026, goal «en regla y rápido»: Lighthouse móvil, mediana de tres, bajo 2,5 s). El LCP
//       simulado es todo lo que baja y corre ANTES del titular. Lo que se cortó y este tier vigila: ningún import
//       estático de cliente de la landing llega a `crypto` (98 kB de polyfills), a Supabase, a Sentry ni a posthog-js
//       (el grafo se recorre acá); el fondo del hero va liso (≤ 30 kB) con el grano aparte (≤ 12 kB); lo de abajo del
//       hero lleva `content-visibility: auto`; Supabase entra por import() con la página quieta; y las fuentes de
//       arriba van en su subconjunto del español (≤ 42 kB), con el «re» del wordmark en su propia cara incrustada.
//   7 · /pricing EN TELÉFONO (20-oct-2026, goal «el LCP de /pricing»: mediana de cinco, bajo 2,5 s). El LCP es la tarjeta
//       del pack: pinta primero el degradado liso (las mismas medidas que el de grano) y el fondo con grano y su capa
//       entran solo detrás de `html[data-grano]`, que el header de la página marca con la página quieta; el JS de las
//       islas de /pricing no llega a Node, Supabase, Sentry ni posthog-js.
//   8 · /deptos Y /i/CÓDIGO EN TELÉFONO (20-oct-2026, goal «las dos páginas de aterrizaje de la campaña»: mediana de
//       cinco, bajo 2,5 s). El LCP de las dos es la banda del correo (`.dp-banda`, deptos.css, que /i/CÓDIGO importa): la
//       misma receta que §7, y el cliente de Supabase fuera del primer paquete (DeptosCliente lo pide por import() al
//       pedir el código, al entrar con él o con Google). Y la IBM Plex (40 kB) tampoco baja antes: el «.ai» del wordmark
//       con su cara incrustada (recortada del mismo archivo variable) y el pie con su fuente diferida a la página quieta.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
//   Acta 28-sep-2026: A Maps al montar (prepararPlaces() pelado en el efecto) → 1 falla · B solo `focus`
//   dispara → 1 · C Secciones importa la card real → 1 · D vuelve un latin-ext → 2 · E PostHog carga al
//   montar → 1 · F vuelve maximumScale → 1 · G el PageView del pixel sin esperar → 1. Restaurado: verde.
//   Acta 01-oct-2026 (LCP móvil): H vuelve JetBrains a la precarga → 1 · I una cara sin swap → 1 · J el titular sin
//   respaldo ajustado → 1 · K el fondo con fetchPriority="high" → 1 · L el fondo precargado en el layout → 1 ·
//   M falta Inter en la precarga → 1.
//   Acta 20-oct-2026 (/pricing, §7; scratchpad mutar-pricing.cjs, cada archivo restaurado byte a byte): Q1 el pack vuelve
//   al fondo con grano de entrada → 2 (y PLANES rojo) · Q2 lo mismo desde 768 → 2 · Q3 la capa de grano sin esperar la
//   señal → 1 · Q4 sin el fondo con grano encima → 1 (y PLANES) · Q5 sin él desde 768 → 1 · Q6 se pierde la capa → 1 (y
//   PLANES) · Q7 /pricing sin el header que marca la señal → 1 · Q8 la vista de planes importa posthog-js → 2 · Q9 el
//   grano detrás de otra señal → 5 (y PLANES) · Q10 el ::before no cubre la tarjeta → 1 · Q11 el liso con otras medidas
//   (el m1x copiado sobre el m2x) → 1. 15/15 ROJO; restaurado: verde.
//   Acta 20-oct-2026 (/deptos y /i/CÓDIGO, §8; §7 pasó a ayudantes compartidos y sus 15 se volvieron a correr: 15/15
//   ROJO; scratchpad mutar-deptos.cjs): R1 la banda vuelve al fondo con grano de entrada → 2 (y PUERTA-B) · R2 lo mismo
//   desde 768 → 2 · R3 la capa sin esperar la señal → 1 · R4 sin el fondo con grano encima → 1 (y PUERTA-B) · R5 sin él
//   desde 768 → 1 · R6 se pierde la capa → 1 (y PUERTA-B) · R7 /deptos sin el header → 1 · R8 /i/CÓDIGO sin el header → 1
//   · R9 DeptosCliente vuelve a importar Supabase estático → 2 · R10 /i/CÓDIGO deja de importar deptos.css → 1 · R11 otro
//   fondo con color (PUERTA-B) → 1 · R12 el ::before no cubre la banda → 1 · R13 el header deja de marcar data-grano → 1 ·
//   R14 PrimeraSeleccion importa supabase-js → 2 · C1 el censo con el build de ANTES del cambio → 1 (el chunk 2990 trae el
//   cliente de Supabase). 18/18 ROJO; restaurado y con el build nuevo: verde.
//   Segunda pasada del §8 (la IBM Plex; scratchpad mutar-ai.cjs): S1 el «.ai» vuelve a la IBM Plex entera · S2 sin su cara ·
//   S3 la cara es la IBM Plex entera incrustada · S4 es una instancia fija, sin variación · S5 declarada en 600 · S6 el
//   pie sin el atributo · S7 la regla solo cambia la variable (el enlace del logo la seguía pidiendo) · S8 /deptos y S9
//   /i/CÓDIGO con el pie de siempre · S10 el respaldo sin ajustar · S11 el pie espera otra señal. 11/11 ROJO (una falla
//   cada una); restaurado: verde.
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
  if (!/cuandoLaPaginaEsteQuieta\(\(\) => setListo\(true\)\)/.test(diferida) || !/new IntersectionObserver\(/.test(diferida) || !/rootMargin: "50% 0px"/.test(diferida)) F("2 · la card no espera a la página quieta ni a acercarse");
  // ⚠ ACTA (19-oct-2026, LCP en teléfono) · media pantalla y no una: con una, en el teléfono la sección quedaba en el
  // borde (hero + sección 2 = dos pantallas) y la card bajaba al hidratar, antes del titular.
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
    // El layout también (19-oct-2026): los polyfills de criptografía entraban por el provider global, no por la página.
    // Y /pricing (20-oct-2026, §7): sus chunks propios tampoco traen nada de esto.
    // Y /deptos y /i/CÓDIGO (20-oct-2026, §8): ahí el cliente de Supabase venía en el chunk de la página.
    const PAGINAS = ["/pricing/page", "/deptos/page", "/i/[codigo]/page"];
    const chunks = [...new Set([...(pages["/page"] ?? []), ...(pages["/layout"] ?? []), ...PAGINAS.flatMap((p) => pages[p] ?? [])])].filter((f) => f.endsWith(".js"));
    const esProduccion = chunks.length > 3 && chunks.every((f) => /-[a-f0-9]{16}\.js$/.test(f) || /webpack-|main-app-/.test(f));
    if (!esProduccion) {
      console.log(`  · el .next de ${raizBuild} es de \`next dev\` (${chunks.length} chunks sin hash): el censo del bundle no corrió acá`);
    } else {
      const marcas: Array<[string, RegExp]> = [
        ["el motor", /calcIRR|hallazgoCapRate/],
        ["DocTokens", /doc-dictamen/],
        ["el SDK de PostHog", /\$feature_flag_called|\$autocapture_disabled_server_side|posthog-recorder/],
        ["el SDK de Sentry", /sentry\.javascript\.nextjs|__SENTRY__|sentry-trace/],
        ["los polyfills de criptografía de Node", /\.bignum=|asn1\.js|BN\.prototype\./],
        ["el cliente de Supabase", /GoTrueClient|@supabase\/auth-js/],
      ];
      for (const f of chunks) {
        const b = readFileSync(join(raizBuild, ".next", f), "utf8");
        for (const [que, rx] of marcas) if (rx.test(b)) F(`2 · el chunk ${f.split("/").pop()} (de «/», /pricing, /deptos o /i/CÓDIGO) trae ${que}`);
      }
      for (const p of PAGINAS) if (!pages[p]?.length) F(`2 · el manifiesto del build no tiene ${p} (el censo de esa página no corrió)`);
      console.log(`  · build de producción en ${raizBuild}: ${chunks.length} chunks de «/», /pricing, /deptos y /i/CÓDIGO revisados`);
    }
  } else {
    console.log("  · sin build a mano (.next/app-build-manifest.json): el censo del bundle no corrió acá");
  }

  // ── 3 · FUENTES ────────────────────────────────────────────────────────────
  const layout = sinComentarios(leer("src/app/layout.tsx"));
  const precarga = (layout.match(/const FUENTES_PRECARGA = \[([\s\S]*?)\] as const;/) ?? [])[1] ?? "";
  if (!precarga) F("3 · no encuentro FUENTES_PRECARGA (el extractor no corrió)");
  if (/latin-ext/.test(precarga)) F("3 · vuelve a precargarse un latin-ext");
  // (01-oct-2026) Solo lo de arriba del pliegue: el titular (Source Serif normal e itálica) y el campo (Inter).
  // ⚠ ACTA (19-oct-2026, LCP en teléfono) · ahora el SUBCONJUNTO DEL ESPAÑOL de la serif normal y de Inter; la itálica
  // sale de la precarga porque el «re» del wordmark tiene su cara incrustada (ver §6). Y de la serif, la instancia FIJA
  // en 700: la primera pantalla solo tiene serif en 700 (el titular y el «franco» del wordmark).
  const caras = (precarga.match(/"[a-z0-9-]+\.woff2"/g) ?? []).map((c) => c.slice(1, -1).replace(/\.woff2$/, "")).sort();
  const ARRIBA = ["inter-normal-es", "source-serif-4-700-es"];
  if (caras.join() !== ARRIBA.join()) F(`3 · se precarga ${caras.join(", ")}: solo van las fuentes de arriba del pliegue (${ARRIBA.join(", ")})`);
  // Ninguna cara bloquea el titular: TODAS las @font-face con archivo propio son swap.
  const fuentes = leer("src/app/fuentes.css");
  const caraConArchivo = Array.from(fuentes.matchAll(/@font-face \{([^}]*)\}/g)).map((m) => m[1]).filter((b) => /url\(\/fonts\//.test(b));
  const sinSwap = caraConArchivo.filter((b) => !/font-display: swap;/.test(b));
  if (caraConArchivo.length < 10 || sinSwap.length > 0) F(`3 · ${sinSwap.length} caras no son swap (o el extractor no corrió: ${caraConArchivo.length}): la fuente bloquearía el titular`);
  // El titular y el campo pintan con un respaldo AJUSTADO en tamaño mientras llega la real (no salta).
  for (const [variable, respaldo] of [["--font-heading", "Source Serif 4 Franco Fallback"], ["--font-ui", "Inter Franco Fallback"]]) {
    if (!new RegExp(`${variable}: '[^']+ Franco', '${respaldo}';`).test(fuentes) || !new RegExp(`font-family: '${respaldo}';[^}]*size-adjust: \\d`).test(fuentes)) F(`3 · ${variable} no cae a un respaldo ajustado en tamaño (${respaldo})`);
  }
  // El fondo del hero no es el LCP: no compite con prioridad alta.
  const heroFondo = sinComentarios(leer("src/components/entrada/HeroEntrada.tsx"));
  if (/fetchPriority=["{]|fetchpriority=/i.test(heroFondo) || /<link[^>]+hero-[md]\dx\.webp/.test(layout)) F("3 · el fondo del hero vuelve a pedirse con prioridad alta (o se precarga)");

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

  // ── 6 · LCP EN TELÉFONO (19-oct-2026) ──────────────────────────────────────
  // a · Ningún import ESTÁTICO de cliente de la landing (el layout con sus providers, el header, el hero y las islas de
  //     la landing) llega a un módulo de Node, a Supabase, a Sentry ni a posthog-js. Los import() son otro chunk: valen.
  {
    const NODE = /^(node:)?(crypto|buffer|stream|zlib|fs|path|os|util|http|https|net|tls)$/;
    const PESADOS = /^(@supabase\/|@sentry\/|posthog-js$)/;
    const entradas = ["src/app/providers.tsx", "src/components/chrome/HeaderFranco.tsx", "src/components/entrada/HeroEntrada.tsx",
      "src/components/landing-v14/Telemetria.tsx", "src/components/landing-v14/SuaveScroll.tsx", "src/components/landing-v14/Rotacion.tsx",
      "src/components/landing-v14/RecomendacionDiferida.tsx", "src/components/landing-v14/Secciones.tsx"];
    const visto = new Set<string>();
    const cola: Array<[string, string[]]> = entradas.map((e) => [e, [e]]);
    const hallazgos: string[] = [];
    const resolver = (desde: string, esp: string): string | null => {
      const base = esp.startsWith("@/") ? `src/${esp.slice(2)}` : esp.startsWith(".") ? join(desde, "..", esp).replace(/\\/g, "/") : null;
      if (!base) return null;
      for (const suf of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const p = base + suf;
        if (existsSync(join(RAIZ, p)) && /\.(ts|tsx)$/.test(p)) return p;
      }
      return null;
    };
    while (cola.length) {
      const [archivo, camino] = cola.shift()!;
      if (visto.has(archivo)) continue;
      visto.add(archivo);
      const fuente = sinComentarios(leer(archivo));
      // También el import de efecto (`import "x";`, sin `from`): carga el módulo entero igual (lo cazó la mutación).
      for (const m of fuente.matchAll(/(?:^|\n)\s*(?:(?:import|export)\s+(type\s+)?[^'"]*?from\s+|import\s+)["']([^"']+)["']/g)) {
        if (m[1]) continue; // import type: no llega al paquete
        const esp = m[2];
        if (NODE.test(esp) || PESADOS.test(esp)) { hallazgos.push(`${esp} ← ${camino.join(" → ")}`); continue; }
        const r = resolver(archivo, esp);
        if (r) cola.push([r, [...camino, r]]);
      }
    }
    if (visto.size < 40) F(`6 · el grafo de la landing recorrió solo ${visto.size} archivos (el extractor no corrió)`);
    for (const h of hallazgos) F(`6 · un import estático de cliente arrastra al primer paquete: ${h}`);
  }
  // b · El fondo del hero, liso y chico; el grano, aparte.
  const pesa = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p)).length : Infinity);
  for (const v of ["m1x", "m2x", "m3x", "d1x", "d2x"]) if (pesa(`public/landing/hero-liso-${v}.webp`) > 30_000) F(`6 · hero-liso-${v}.webp pesa más de 30 kB (o no existe)`);
  if (pesa("public/landing/grano-fino.png") > 12_000) F("6 · grano-fino.png pesa más de 12 kB (o no existe)");
  for (const p of ["src/components/entrada/HeroEntrada.tsx", "src/components/landing-v14/Marca.tsx"]) {
    const s6 = sinComentarios(leer(p));
    if (/\/landing\/hero-[md]\dx\.webp/.test(s6) || !/\/landing\/hero-liso-m2x\.webp 2x/.test(s6)) F(`6 · ${p} vuelve al fondo con el grano incorporado`);
  }
  for (const p of ["src/components/entrada/hero-entrada.css", "src/components/landing-v14/landing.css"]) {
    const c6 = leer(p);
    if (/grano-256\.png/.test(c6) || !/background-image: url\("\/landing\/grano-fino\.png"\); background-size: 64px; opacity: 0\.8; mix-blend-mode: hard-light;/.test(c6)) F(`6 · ${p} vuelve al grano de 52 kB (o pierde el grano fino)`);
  }
  // c · Lo de abajo del hero no se calcula ni se pinta (ni pide el mapa) hasta que se acerca.
  if (!/\.lv-s2, \.lv-s3, \.lv-cierre-wrap \{ content-visibility: auto; contain-intrinsic-size: auto 100svh; \}/.test(leer("src/components/landing-v14/landing.css"))) F("6 · las pantallas de abajo del hero vuelven a calcularse antes del titular (sin content-visibility)");
  // d · Supabase entra con la página quieta, en el header y en la atribución.
  const header6 = sinComentarios(leer("src/components/chrome/HeaderFranco.tsx"));
  const atrib6 = sinComentarios(leer("src/hooks/useAttributionSync.ts"));
  if (!/const cancelarQuieta = cuandoLaPaginaEsteQuieta\(\(\) => import\("@\/lib\/supabase\/client"\)/.test(header6)) F("6 · el header pide Supabase antes de que la página esté quieta");
  if (!/const cancelarQuieta = cuandoLaPaginaEsteQuieta\(\(\) => void \(async \(\) => \{\s*try \{\s*const \{ createClient \} = await import\("@\/lib\/supabase\/client"\);/.test(atrib6)) F("6 · la atribución pide Supabase antes de que la página esté quieta");
  // d' · La hoja de la dirección (~52 kB con lo suyo) se pide con la página CARGADA, no al montar: pedida al montar, a
  //      veces terminaba antes del primer pintado y el LCP simulado saltaba de 2,3 a 2,65 s según la corrida.
  const hero6 = sinComentarios(leer("src/components/entrada/HeroEntrada.tsx"));
  if ((hero6.match(/import\("\.\/HojaDireccion"\)/g) ?? []).length !== 1
    || !/const pedir = \(\) => \{\s*import\("\.\/HojaDireccion"\)/.test(hero6)
    || !/if \(document\.readyState === "complete"\) pedir\(\);\s*else window\.addEventListener\("load", pedir, \{ once: true \}\);/.test(hero6)) F("6 · la hoja de la dirección vuelve a pedirse al montar el hero (antes del titular)");
  // e · Las fuentes de arriba en su subconjunto del español, partidas sin solaparse, y el wordmark con su cara.
  for (const n of ["source-serif-4-normal-es", "inter-normal-es"]) if (pesa(`public/fonts/${n}.woff2`) > 42_000) F(`6 · ${n}.woff2 pesa más de 42 kB (o no existe)`);
  if (pesa("public/fonts/source-serif-4-700-es.woff2") > 20_000) F("6 · source-serif-4-700-es.woff2 pesa más de 20 kB (o no existe)");
  const fuentes6 = leer("src/app/fuentes.css");
  // La cara 700 del español de la serif apunta a la instancia fija; las otras (300, 400, 600), a la variable.
  if (!/font-weight: 700;\s*font-display: swap;\s*src: url\(\/fonts\/source-serif-4-700-es\.woff2\) format\('woff2'\);/.test(fuentes6)) F("6 · la cara 700 de la serif vuelve a la variable entera (39 kB en vez de 17)");
  for (const [n, esN] of [["source-serif-4-normal", "source-serif-4-(?:normal|700)"], ["inter-normal", "inter-normal"]]) {
    const es6 = Array.from(fuentes6.matchAll(new RegExp(`src: url\\(/fonts/${esN}-es\\.woff2\\) format\\('woff2'\\);\\s*unicode-range: ([^;]+);`, "g"))).map((m) => m[1]);
    const resto6 = Array.from(fuentes6.matchAll(new RegExp(`src: url\\(/fonts/${n}-latin\\.woff2\\) format\\('woff2'\\);\\s*unicode-range: ([^;]+);`, "g"))).map((m) => m[1]);
    if (!es6.length || es6.length !== resto6.length) F(`6 · ${n}: las caras latin no están partidas en el español y el resto`);
    if (es6.some((r) => !/U\+0020-007E/.test(r)) || resto6.some((r) => /U\+0020-007E|U\+00E1|U\+00F1/.test(r))) F(`6 · ${n}: el español y el resto se solapan (o el español no cubre ASCII)`);
  }
  if (!/font-family: 'Source Serif 4 Franco Marca';\s*font-style: italic;\s*font-weight: 400;\s*font-display: swap;\s*src: url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{200,}\) format\('woff2'\);\s*unicode-range: U\+0065, U\+0072;/.test(fuentes6)
    // El respaldo es el LOCAL ajustado, no la serif: mientras la cara se decodifica el navegador dibuja con el respaldo, y
    // con la serif pedía su itálica entera (medido en el preview del 19-oct-2026).
    || !/fontFamily: "'Source Serif 4 Franco Marca', 'Source Serif 4 Franco Fallback'"/.test(leer("src/components/franco-logo.tsx"))) F("6 · el «re» del wordmark vuelve a pedir la itálica latin entera");

  // ── 7 · /pricing EN TELÉFONO (20-oct-2026) ─────────────────────────────────
  // El LCP de /pricing es la tarjeta del pack (su fondo), no el título: con el fondo con grano incorporado (121 kB) y la
  // capa de grano (52 kB) bajando antes de pintarla, daba 3,16 s (mediana de 5). La tarjeta pinta primero el MISMO
  // degradado sin grano; el fondo con grano y la capa entran con la página quieta (`html[data-grano]`, que marca el header).
  // ── 8 · /deptos Y /i/CÓDIGO EN TELÉFONO (20-oct-2026) ──────────────────────
  // Las dos páginas de aterrizaje de la campaña. El LCP de las dos es la banda del correo (`.dp-banda`, deptos.css, que
  // /i/CÓDIGO importa): 3,52 y 3,67 s (mediana de 5) con el mismo fondo pesado y, además, el cliente de Supabase (48 kB)
  // importado de forma estática por DeptosCliente, que solo lo usa al pedir el código, al entrar con él o con Google.
  // La misma receta que §7 para la banda, y Supabase por import() dentro de esas tres acciones.
  {
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // La receta, superficie por superficie: pinta el liso, lo pesado SOLO detrás de la señal, termina en lo de siempre, y la
    // página que la muestra tiene el header que marca la señal.
    const enDosTiempos = (sec: string, archivo: string, selector: string, que: string, paginas: string[]) => {
      const css = sinComentarios(leer(archivo));
      const s = escapar(selector);
      // a · lo que pinta primero: el liso, en el teléfono y desde 768.
      if (!new RegExp(`(^|\\n)${s} \\{[^}]*background: #1F3D67 url\\("/landing/hero-liso-m2x\\.webp"\\) center top / cover no-repeat;`).test(css)
        || !new RegExp(`@media \\(min-width: 768px\\) \\{ ${s} \\{[^}]*background-image: url\\("/landing/hero-liso-d1x\\.webp"\\); \\} \\}`).test(css)) F(`${sec} · ${que} no pinta primero el degradado liso (en el teléfono y desde 768)`);
      // b · lo pesado, SOLO detrás de `html[data-grano]`: ninguna regla sin ese prefijo nombra el fondo con grano ni la capa.
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim();
        if (/hero-[md]\dx\.webp|grano-256\.png/.test(m[2]) && !/^html\[data-grano\] /.test(sel)) F(`${sec} · «${sel}» baja el fondo con grano (o la capa) antes de que la página esté quieta`);
      }
      // c · y detrás de la señal está todo lo de siempre: el fondo con grano encima, opaco, y la capa con su mezcla.
      if (!new RegExp(`html\\[data-grano\\] ${s}::before \\{ background-image: url\\("/landing/hero-m2x\\.webp"\\); opacity: 1; \\}`).test(css)
        || !new RegExp(`@media \\(min-width: 768px\\) \\{ html\\[data-grano\\] ${s}::before \\{ background-image: url\\("/landing/hero-d1x\\.webp"\\); \\} \\}`).test(css)
        || !new RegExp(`${s}::before \\{[^}]*inset: 0;[^}]*background: center top / cover no-repeat;`).test(css)) F(`${sec} · ${que} ya no termina con el fondo con grano (con la página quieta, encima y opaco)`);
      if (!new RegExp(`html\\[data-grano\\] ${s}::after \\{ background-image: url\\("/landing/grano-256\\.png"\\); opacity: 0\\.08; \\}`).test(css)
        || !new RegExp(`${s}::after \\{[^}]*background-size: 256px; opacity: 0; mix-blend-mode: soft-light;`).test(css)) F(`${sec} · ${que} perdió la capa de grano (o su mezcla)`);
      // d · alguien marca la señal EN CADA PÁGINA que la muestra: su header, el que la pone con la página quieta.
      for (const p of paginas) if (!/<HeaderFranco /.test(sinComentarios(leer(p)))) F(`${sec} · ${p} no monta el header que marca data-grano: ${que} se queda sin grano`);
    };
    if (!/useEffect\(\(\) => cuandoLaPaginaEsteQuieta\(\(\) => document\.documentElement\.setAttribute\("data-grano", ""\)\), \[\]\);/.test(sinComentarios(leer("src/components/chrome/HeaderFranco.tsx")))) F("7 · nadie marca data-grano: la tarjeta del pack y la banda del correo se quedan sin grano");
    // e · el liso es la misma imagen: las mismas medidas que la de grano (con `cover`, otras medidas cortan otro encuadre
    //     y el fundido correría el degradado).
    const medidas = (p: string): string => {
      if (!existsSync(join(RAIZ, p))) return "no existe";
      const b = readFileSync(join(RAIZ, p));
      const tipo = b.toString("latin1", 12, 16);
      if (tipo === "VP8 ") return `${b.readUInt16LE(26) & 0x3fff}×${b.readUInt16LE(28) & 0x3fff}`;
      if (tipo === "VP8X") return `${1 + b.readUIntLE(24, 3)}×${1 + b.readUIntLE(27, 3)}`;
      if (tipo === "VP8L") { const v = b.readUInt32LE(21); return `${1 + (v & 0x3fff)}×${1 + ((v >> 14) & 0x3fff)}`; }
      return `formato ${tipo}`;
    };
    for (const v of ["m2x", "d1x"]) {
      const [liso, grano] = [medidas(`public/landing/hero-liso-${v}.webp`), medidas(`public/landing/hero-${v}.webp`)];
      if (liso !== grano || !/^\d+×\d+$/.test(liso)) F(`7 · hero-liso-${v} (${liso}) no tiene las medidas de hero-${v} (${grano})`);
    }
    // f · el JS de la página tampoco arrastra lo pesado (mismo recorrido que §6a, desde las islas de la página).
    const sinPesados = (sec: string, pagina: string, entradas: string[], minimo: number) => {
      const NODE = /^(node:)?(crypto|buffer|stream|zlib|fs|path|os|util|http|https|net|tls)$/;
      const PESADOS = /^(@supabase\/|@sentry\/|posthog-js$)/;
      const visto = new Set<string>();
      const cola: Array<[string, string[]]> = entradas.map((e) => [e, [e]]);
      while (cola.length) {
        const [archivo, camino] = cola.shift()!;
        if (visto.has(archivo)) continue;
        visto.add(archivo);
        for (const m of sinComentarios(leer(archivo)).matchAll(/(?:^|\n)\s*(?:(?:import|export)\s+(type\s+)?[^'"]*?from\s+|import\s+)["']([^"']+)["']/g)) {
          if (m[1]) continue;
          const esp = m[2];
          if (NODE.test(esp) || PESADOS.test(esp)) { F(`${sec} · un import estático de cliente de ${pagina} arrastra al primer paquete: ${esp} ← ${camino.join(" → ")}`); continue; }
          const base = esp.startsWith("@/") ? `src/${esp.slice(2)}` : esp.startsWith(".") ? join(archivo, "..", esp).replace(/\\/g, "/") : null;
          const r = base && ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((s) => base + s).find((p) => existsSync(join(RAIZ, p)) && /\.(ts|tsx)$/.test(p));
          if (r) cola.push([r, [...camino, r]]);
        }
      }
      if (visto.size < minimo) F(`${sec} · el grafo de ${pagina} recorrió solo ${visto.size} archivos (el extractor no corrió)`);
    };

    enDosTiempos("7", "src/app/pricing/planes.css", ".pl-pack", "la tarjeta del pack", ["src/app/pricing/page.tsx"]);
    sinPesados("7", "/pricing", ["src/app/pricing/vista-planes.tsx", "src/components/chrome/EnlaceCarga.tsx", "src/components/chrome/HeaderFranco.tsx"], 15);

    enDosTiempos("8", "src/app/deptos/deptos.css", ".dp-banda", "la banda del correo", ["src/app/deptos/page.tsx", "src/app/i/[codigo]/page.tsx"]);
    // La banda de /i/CÓDIGO es la de deptos.css: la página del invitado la importa (si deja de hacerlo, este §8 no la cubre).
    if (!/import "@\/app\/deptos\/deptos\.css";/.test(sinComentarios(leer("src/app/i/[codigo]/invitacion-cliente.tsx")))) F("8 · /i/CÓDIGO ya no usa la banda de deptos.css: revisa su fondo");
    sinPesados("8", "/deptos", ["src/app/deptos/deptos-cliente.tsx", "src/components/chrome/EnlaceCarga.tsx", "src/components/chrome/HeaderFranco.tsx"], 25);
    sinPesados("8", "/i/CÓDIGO", ["src/app/i/[codigo]/invitacion-cliente.tsx", "src/components/chrome/HeaderFranco.tsx"], 30);
    // g · La IBM Plex (40 kB) tampoco baja antes de la banda: el «.ai» del wordmark dibuja con su cara incrustada —«.», «a» e
    //     «i» recortadas del MISMO archivo variable, declarada en 500 como la cara de la que sale, para que el 600 se dibuje
    //     igual—, con el respaldo local; y el pie (el aviso va en IBM Plex) no se calcula hasta acercarse.
    const fuentes8 = leer("src/app/fuentes.css");
    const caraAi = (fuentes8.match(/@font-face \{\s*font-family: 'IBM Plex Sans Franco Marca';\s*font-style: normal;\s*font-weight: 500;\s*font-display: swap;\s*src: url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\) format\('woff2'\);\s*unicode-range: U\+002E, U\+0061, U\+0069;\s*\}/) ?? [])[1];
    const binAi = caraAi ? Buffer.from(caraAi, "base64") : null;
    if (!binAi || binAi.toString("latin1", 0, 4) !== "wOF2" || binAi.length > 3_000) F("8 · el «.ai» del wordmark no tiene su cara incrustada (500, swap, solo «.ai», ≤ 3 kB)");
    else {
      // Las tablas de la woff2: el recorte conserva la variación (fvar, gvar) del archivo del que sale.
      const CONOCIDAS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt", "fpgm", "glyf", "loca", "prep", "CFF", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar"];
      const tablas = (b: Buffer): string[] => {
        let o = 48; const out: string[] = [];
        const base128 = () => { for (let i = 0; i < 5; i++) if (!(b[o++] & 0x80)) break; };
        for (let i = 0; i < b.readUInt16BE(12); i++) {
          const flags = b[o++];
          const tag = (flags & 0x3f) === 0x3f ? b.toString("latin1", o, (o += 4)).trim() : (CONOCIDAS[flags & 0x3f] ?? "?");
          base128();
          if ((tag === "glyf" || tag === "loca") ? ((flags >> 6) & 3) === 0 : ((flags >> 6) & 3) !== 0) base128();
          out.push(tag);
        }
        return out;
      };
      const t8 = tablas(binAi);
      if (!t8.includes("fvar") || !t8.includes("gvar") || !tablas(readFileSync(join(RAIZ, "public/fonts/ibm-plex-sans-normal-latin.woff2"))).includes("fvar")) F(`8 · la cara del «.ai» no conserva la variación del archivo del que sale (${t8.join(",")})`);
    }
    if (!/fontFamily: "'IBM Plex Sans Franco Marca', 'IBM Plex Sans Franco Fallback'"/.test(leer("src/components/franco-logo.tsx"))) F("8 · el «.ai» del wordmark vuelve a pedir la IBM Plex latin entera");
    // El pie: en las páginas cortas queda junto al pliegue (content-visibility no lo difiere, medido), así que su fuente
    // espera a la página quieta: hasta `data-grano` dibuja con el respaldo local AJUSTADO (con size-adjust: no corre nada).
    if (!/data-fuente-diferida=\{diferido \? "" : undefined\}/.test(sinComentarios(leer("src/components/chrome/AppFooter.tsx")))
      // la variable Y la fuente heredada: el enlace del logo no declara fuente y su línea pedía la IBM Plex para medirse
      || !/(^|\n)html:not\(\[data-grano\]\) footer\[data-fuente-diferida\] \{ --font-body: 'IBM Plex Sans Franco Fallback'; font-family: var\(--font-body\); \}/.test(sinComentarios(fuentes8))
      || !/font-family: 'IBM Plex Sans Franco Fallback';\s*src: local\("Arial"\);[^}]*size-adjust: \d/.test(fuentes8)) F("8 · el pie diferido ya no espera a la página quieta para pedir la IBM Plex (o su respaldo no está ajustado)");
    for (const p of ["src/app/deptos/page.tsx", "src/app/i/[codigo]/page.tsx", "src/app/pricing/page.tsx"]) {
      if (!/<AppFooter variant="informe" diferido \/>/.test(sinComentarios(leer(p)))) F(`8 · el pie de ${p} pide la IBM Plex antes de la banda`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ LANDING-RENDIMIENTO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — Google Maps espera al primer toque; la sección 3 llega después del titular con su altura reservada y sin el motor en el paquete; sin latin-ext precargadas; PostHog, Sentry y el pixel cargan con la página quieta y no pierden lo de antes; el viewport permite zoom; en /pricing la tarjeta del pack y en /deptos y /i/CÓDIGO la banda del correo pintan el degradado liso y su grano entra con la página quieta, sin Supabase antes");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLandingRendimientoTier();
  process.exit(hard ? 1 : 0);
}
