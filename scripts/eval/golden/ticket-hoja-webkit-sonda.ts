// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · el ticket y la hoja de la dirección en WebKit a 390 px (12-oct-2026). Corre contra `next dev`
// (la cookie de QA `franco_qa_dueno` hace de dueño anónimo SOLO ahí) y prueba, en un perfil de iPhone:
//   8S · EL TICKET A LOS 8 S: en un informe de renta larga, como dueño, el ticket sube a los 8 s de que la marca
//        del final de los capítulos entra en pantalla, y no antes.
//   3  · EL BANNER DE PASO: para llegar al final se baja con el dedo POR ENCIMA del banner del registro (toques que
//        no son un campo, un botón ni un chip), y el ticket sube igual a los 8 s.
//   2B · FIJO A LA PANTALLA: con un área visible que iOS 26 reporta mal (`offsetTop` 400, alto 332, más allá del
//        borde de la pantalla), la hoja del ticket y la pestaña quedan DENTRO de la pantalla.
//   2D · «YA SE MOSTRÓ» solo después de un segundo con la hoja dentro de la pantalla: a los 0,5 s no está; al
//        segundo, sí. Y con la hoja forzada fuera de la pantalla, no se guarda nunca.
//   2C · EL VELO: un toque en el velo que es el final de un gesto empezado ANTES de abrirse no cierra; un toque
//        en el primer segundo tampoco; uno nuevo, pasado el segundo, sí (la despedida).
//   RG · EL QUE VUELVE: al recargar, la pestaña está a la vista desde arriba y el ticket no se abre solo.
//   2A · CON `?lqs=1` el recuadro dice el estado y los últimos eventos del ticket, con hora y por dónde se cerró.
//   1  · LA HOJA DE LA DIRECCIÓN: con el área visible a la mitad (el teclado) y lo que hace iOS al enfocar —un
//        scroll de la ventana de 300 px justo después del foco—, la página vuelve a cero, la hoja queda arriba con
//        el campo a la vista y la lista de sugerencias, bajo el campo, hace scroll adentro sobre el teclado.
//        WebKit de escritorio no corre lo fijo con el scroll; iOS, con el teclado abierto, sí: la posición que se
//        VE es la medida menos `scrollY`, y así se mide. En local Google no responde (la clave solo acepta
//        refranco.ai): se cuelga del <body> una lista como la del widget.
// ACTA (12-oct-2026, segunda pasada, contra `next dev`). VERDE con el código nuevo (el ticket a los 8.040 ms de la
// marca, bajando por encima del banner; la hoja en 206–664 de 664 con el área visible corrida a 400 + 332; a los 511 ms
// todavía no «ya se mostró», al segundo sí; la hoja forzada afuera, nunca; un toque a los 26 ms en el velo, ignorado).
// ROJO en 6/6 corridas mutadas, cada una con la falla de su gate: W1 la vuelta a cero sin hacer nada (la hoja se ve
// desde −300 y el campo bajo el borde de arriba) · W2 el ancla al área visible de vuelta (la hoja en 274–732 y la
// pestaña en 691–732 de 664) · W3 el velo sin la cláusula del gesto previo · W4 sin la gracia · W5 «ya se mostró» al
// subir · W6 sin mirar la pantalla · W7 el dedo de paso marca el banner (el ticket no sube a los 9,5 s) · W8 el
// recuadro sin la bitácora. Antes de simular el scroll de iOS hubo que hacerlo instantáneo: el <html> del sitio lleva
// `scroll-behavior: smooth` y un `scrollTo(0, 300)` pelado dejaba la ventana en 0 —la sonda lo marcaba «NO CORRIÓ»—.
// Sale con 1 si algo falla, con 2 si no pudo correr (sin Playwright, sin servidor, sin el informe). Nada escribe:
// todo lo que no es GET se corta.
// Uso: PLAYWRIGHT_DIR=<carpeta con playwright 1.60 y su WebKit> node --import tsx scripts/eval/golden/ticket-hoja-webkit-sonda.ts [--base http://localhost:3000] [--id <informe LTR que nació anónimo>] [--solo hoja]
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "http://localhost:3000").replace(/\/$/, "");
/** Un informe de renta larga que nació anónimo (el de la prueba de Fabrizio en el iPhone del 09-oct). */
const ID = arg("--id") ?? "4e90b219-1430-4337-8027-e43dae7a53c6";
const SOLO = arg("--solo");
const ESPERA_ESPERADA_MS = 8_000;
const TOLERANCIA_MS = 1_500;
const CLAVE_TICKET = `lqs_ticket_${ID}`;

/** Fuera de `main`: si un paso se cae después de encontrar fallas, las fallas no se pierden (12-oct-2026). */
const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
class NoCorrio extends Error {}

// Los scripts de inicio van como TEXTO, no como función: tsx (esbuild) envuelve las funciones con nombre en un
// `__name` que en el navegador no existe, y el script moría sin registrar nada (visto el 12-oct-2026).
const VIGILAR = [
  "window.__t = {};",
  "(function vigilar() {",
  "  var m = document.querySelector('[data-lqs=\"fin-capitulos\"]');",
  "  if (m && window.__t.marca == null && m.getBoundingClientRect().top < innerHeight) window.__t.marca = performance.now();",
  "  var v = document.querySelector('.lqs-velo');",
  "  if (v && window.__t.abre == null && v.getAttribute('data-abierto') === '1') window.__t.abre = performance.now();",
  "  requestAnimationFrame(vigilar);",
  "})();",
].join("\n");
/** iOS 26 reporta el área visible corrida (WebKit 297779): acá, más allá del borde de abajo de la pantalla. */
const AREA_VISIBLE_CORRIDA = "try { Object.defineProperty(VisualViewport.prototype, 'offsetTop', { configurable: true, get: function () { return 400; } }); Object.defineProperty(VisualViewport.prototype, 'height', { configurable: true, get: function () { return 332; } }); } catch (e) {}";
/** El teclado: el área visible a la mitad de la pantalla, sin correrse. */
const AREA_VISIBLE_MITAD = "try { Object.defineProperty(VisualViewport.prototype, 'height', { configurable: true, get: function () { return Math.round(window.innerHeight / 2); } }); Object.defineProperty(VisualViewport.prototype, 'offsetTop', { configurable: true, get: function () { return 0; } }); } catch (e) {}";
/** La hoja del ticket forzada fuera de la pantalla (para 2D: lo que pasaba en el iPhone). */
const HOJA_AFUERA = "document.addEventListener('DOMContentLoaded', function () { var s = document.createElement('style'); s.textContent = '.lqs-velo[data-abierto=\"1\"] .lqs-hoja { transform: translateY(120vh) !important; transition: none !important; }'; document.head.appendChild(s); });";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  let pw: any;
  try {
    pw = createRequire(join(process.env.PLAYWRIGHT_DIR ?? "", "package.json"))("playwright");
  } catch {
    throw new NoCorrio("falta PLAYWRIGHT_DIR (una carpeta con `npm i playwright@1.60.0` y `npx playwright install webkit`)");
  }
  const { webkit, devices } = pw;
  const browser = await webkit.launch();
  // La oferta dura 24 h desde que nació el informe: si ya venció, el reloj DEL NAVEGADOR se pone dentro de su
  // ventana (el servidor no mira la hora para ofrecerla; la vigencia la mira el ticket).
  let relojDentro: Date | null = null;
  const nuevo = async (conDueno: boolean, init: string[]) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    if (conDueno) await ctx.addCookies([{ name: "franco_qa_dueno", value: ID, url: BASE }]);
    await ctx.route(/vercel\.live|posthog|sentry/, (r: any) => r.abort());
    await ctx.route("**/*", (r: any) => (["GET", "HEAD", "OPTIONS"].includes(r.request().method()) ? r.fallback() : r.abort()));
    for (const s of init) await ctx.addInitScript(s);
    if (conDueno && relojDentro) await ctx.clock.install({ time: relojDentro });
    return ctx;
  };
  /** `next dev` recarga la página entera unos segundos después de compilarla: se espera a que quede quieta
   *  (6 s sin navegar), si no el scroll vuelve arriba a mitad de la prueba. */
  const quieta = async (page: any) => {
    let ultima = Date.now();
    const marcar = (f: any) => { if (f === page.mainFrame()) ultima = Date.now(); };
    page.on("framenavigated", marcar);
    for (let i = 0; i < 120 && Date.now() - ultima < 6000; i++) await page.waitForTimeout(500);
    page.off("framenavigated", marcar);
  };
  const abrirInforme = async (page: any, sufijo = "") => {
    const r = await page.goto(`${BASE}/analisis/${ID}${sufijo}`, { waitUntil: "load", timeout: 180_000 }).catch(() => null);
    if (!r || r.status() !== 200) throw new NoCorrio(`${BASE}/analisis/${ID} respondió ${r?.status()}`);
    const conTicket = await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 }).then(() => true, () => false);
    if (!conTicket) throw new NoCorrio("el ticket no está montado: ¿`next dev` y un informe que nació anónimo, sin pack pagado y vigente?");
    await quieta(page);
    await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 });
    await page.waitForTimeout(2000);
  };
  /** Baja hasta la marca del final. Con `porElBanner`, primero pasa el dedo por encima del banner del registro
   *  —toques sobre su fondo, ni un campo, ni un botón, ni un chip— mientras la página baja. */
  const bajarAlFinal = async (page: any, porElBanner: boolean) => {
    let toques = 0;
    if (porElBanner) {
      for (let i = 0; i < 4; i++) {
        toques += await page.evaluate(`(() => {
          var b = document.querySelector('[data-lqs="banner"]');
          if (!b) return 0;
          if (${i} === 0) b.scrollIntoView({ block: 'start' });
          var r = b.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) return 0;
          var y = Math.max(r.top, 0) + 4, x = r.left + 6;
          var bajo = document.elementFromPoint(x, y) || b;
          if (!b.contains(bajo) || bajo.closest('button, a, input, textarea, select, [data-lqs="chip"]')) bajo = b;
          var o = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
          bajo.dispatchEvent(new PointerEvent('pointerdown', o));
          window.scrollBy(0, 120);
          bajo.dispatchEvent(new PointerEvent('pointermove', o));
          bajo.dispatchEvent(new PointerEvent('pointerup', o));
          return 1;
        })()`);
        await page.waitForTimeout(350);
      }
    }
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate("window.__t.marca != null")) break;
      await page.evaluate("scrollBy(0, 300)");
      await page.waitForTimeout(400);
    }
    return toques;
  };
  const estado = (page: any) => page.evaluate(`localStorage.getItem(${JSON.stringify(CLAVE_TICKET)})`);
  const desdeQueAbrio = (page: any) => page.evaluate("window.__t.abre == null ? -1 : performance.now() - window.__t.abre");
  const hastaTrasAbrir = async (page: any, ms: number) => {
    for (let i = 0; i < 400; i++) {
      const d = await desdeQueAbrio(page);
      if (d >= ms) return d;
      await page.waitForTimeout(Math.min(50, Math.max(10, ms - d)));
    }
    return desdeQueAbrio(page);
  };
  const cara = (page: any) => page.evaluate("(function () { var v = document.querySelector('.lqs-velo'); if (!v || v.getAttribute('data-abierto') !== '1') return 'cerrado'; var d = document.querySelector('.lqs-despedida-t'); return d && d.closest('.lqs-cara').getAttribute('data-activa') === '1' ? 'despedida' : 'ticket'; })()");
  const geometria = (page: any) => page.evaluate("(function () { var h = document.querySelector('.lqs-hoja').getBoundingClientRect(); var p = document.querySelector('[data-lqs=\"pestana\"]').getBoundingClientRect(); return { pantalla: innerHeight, hojaTop: Math.round(h.top), hojaBottom: Math.round(h.bottom), hojaAlto: Math.round(h.height), pestanaTop: Math.round(p.top), pestanaBottom: Math.round(p.bottom) }; })()");

  try {
    if (SOLO !== "hoja") {
      const html = await fetch(`${BASE}/analisis/${ID}`, { headers: { cookie: `franco_qa_dueno=${ID}` } }).then((x) => x.text(), () => "");
      const creado = /createdAt\\":\\"([^\\"]+)/.exec(html)?.[1];
      if (!creado) throw new NoCorrio(`no encuentro la fecha del informe ${ID} en ${BASE}`);
      const t0 = new Date(creado).getTime();
      if (Date.now() >= t0 + 24 * 3600_000) {
        relojDentro = new Date(t0 + 30 * 60_000);
        console.log(`  · la oferta del informe venció; el reloj del navegador va a ${relojDentro.toISOString()}`);
      }

      // ── 8S + 3 + 2B + 2D + 2C: el ticket, bajando por encima del banner, con el área visible corrida ──
      const ctx = await nuevo(true, [VIGILAR, AREA_VISIBLE_CORRIDA]);
      const page = await ctx.newPage();
      await abrirInforme(page);
      if (await page.locator('[data-lqs="diagnostico"]').count()) F("2A · el recuadro de diagnóstico aparece sin `?lqs=1`");
      if (!(await page.locator('[data-lqs="fin-capitulos"]').count())) throw new NoCorrio("el informe no tiene la marca del final de los capítulos");
      if (!(await page.locator('[data-lqs="banner"]').count())) throw new NoCorrio("el informe no muestra el banner del registro (¿el dueño anónimo, sin sesión?)");
      const toques = await bajarAlFinal(page, true);
      console.log(`  · ${toques} pasadas del dedo por encima del banner antes de bajar al final`);
      if (toques < 3) throw new NoCorrio(`el dedo no pasó por encima del banner (${toques} pasadas)`);
      const marca = await page.evaluate("window.__t.marca == null ? null : performance.now() - window.__t.marca");
      if (marca == null) throw new NoCorrio("la marca del final nunca entró en pantalla");
      // Un gesto que EMPIEZA antes de que se abra el ticket (a los 7 s de la marca) y sigue con el dedo puesto.
      await page.waitForTimeout(Math.max(0, 7_000 - marca));
      await page.evaluate("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: 195, clientY: 300 }))");
      for (let i = 0; i < 80; i++) {
        if (await page.evaluate("window.__t.abre != null")) break;
        await page.waitForTimeout(50);
      }
      const t = await page.evaluate("window.__t");
      if (t.abre == null) {
        F(`3 · bajando por encima del banner, el ticket no subió a los ${(ESPERA_ESPERADA_MS + TOLERANCIA_MS) / 1000} s del final (el banner lo dio por «en uso»)`);
      } else {
        const d = Math.round(t.abre - t.marca);
        console.log(`  · el ticket subió ${d} ms después de que la marca entró en pantalla`);
        if (d < ESPERA_ESPERADA_MS - TOLERANCIA_MS || d > ESPERA_ESPERADA_MS + TOLERANCIA_MS) F(`8S · el ticket subió ${d} ms después de la marca (debía ser ~8.000)`);
        // 2D · a la mitad del primer segundo todavía no se guardó.
        const a = await hastaTrasAbrir(page, 500);
        const e05 = await estado(page);
        console.log(`  · a los ${Math.round(a)} ms de abrirse, «ya se mostró» en este navegador: ${e05 ?? "no"}`);
        if (e05 === "visto") F("2D · «ya se mostró» se guarda cuando el disparador abre el ticket, antes de que se vea un segundo");
        // 2B · dentro de la pantalla, aunque el área visible diga otra cosa.
        await hastaTrasAbrir(page, 1_300);
        const g = await geometria(page);
        console.log(`  · la hoja: arriba ${g.hojaTop}, abajo ${g.hojaBottom} de ${g.pantalla} (área visible corrida a 400 + 332)`);
        if (g.hojaTop < -1 || g.hojaBottom > g.pantalla + 1 || g.hojaAlto <= 0) F(`2B · la hoja del ticket queda fuera de la pantalla (${g.hojaTop}–${g.hojaBottom} de ${g.pantalla}): sigue el área visible`);
        const e13 = await estado(page);
        if (e13 !== "visto") F(`2D · con la hoja un segundo dentro de la pantalla, «ya se mostró» no se guardó (${e13 ?? "nada"})`);
        // 2C · el final de un gesto que empezó antes de abrirse: un clic en el velo sin un toque nuevo.
        await hastaTrasAbrir(page, 1_500);
        await page.evaluate("document.querySelector('.lqs-velo').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 195, clientY: 20 }))");
        await page.waitForTimeout(350);
        const c1 = await cara(page);
        if (c1 !== "ticket") F(`2C · el final de un gesto que empezó antes de abrirse cierra el velo (quedó ${c1})`);
        // Cerrar por la X y «Sí, seguir leyendo».
        await page.evaluate("document.querySelector('.lqs-x').click()");
        await page.waitForTimeout(500);
        await page.evaluate("document.querySelector('.lqs-tinta').click()");
        await page.waitForTimeout(800);
        const g2 = await geometria(page);
        const pv = await page.evaluate("document.querySelector('[data-lqs=\"pestana\"]').getAttribute('data-visible')");
        console.log(`  · la pestaña ${pv === "1" ? "visible" : "oculta"}: arriba ${g2.pestanaTop}, abajo ${g2.pestanaBottom} de ${g2.pantalla}`);
        if (pv !== "1") F("RG · cerrado el ticket, la pestaña no está a la vista");
        else if (g2.pestanaTop < 0 || Math.abs(g2.pestanaBottom - g2.pantalla) > 2) F(`2B · la pestaña no queda en el borde de abajo de la pantalla (${g2.pestanaTop}–${g2.pestanaBottom} de ${g2.pantalla}): sigue el área visible`);
        // 2C · desde la pestaña: un toque en el velo en el primer segundo no cierra; uno pasado el segundo, sí.
        await page.evaluate("document.querySelector('[data-lqs=\"pestana\"]').click()");
        await page.waitForSelector('.lqs-velo[data-abierto="1"]', { timeout: 5_000 });
        const ab2 = await page.evaluate("performance.now()");
        await page.touchscreen.tap(195, 20);
        const tTap = (await page.evaluate("performance.now()")) - ab2;
        await page.waitForTimeout(300);
        const c2 = await cara(page);
        console.log(`  · reabierto desde la pestaña; un toque en el velo a los ${Math.round(tTap)} ms: ${c2}`);
        if (tTap >= 1_000) throw new NoCorrio(`el toque del primer segundo llegó tarde (${Math.round(tTap)} ms)`);
        if (c2 !== "ticket") F(`2C · un toque en el velo en el primer segundo lo cierra (quedó ${c2})`);
        for (let i = 0; i < 40 && (await page.evaluate("performance.now()")) - ab2 < 1_600; i++) await page.waitForTimeout(50);
        await page.touchscreen.tap(195, 20);
        await page.waitForTimeout(400);
        const c3 = await cara(page);
        if (c3 !== "despedida") F(`2C · pasado el segundo, un toque nuevo en el velo no lleva a la despedida (quedó ${c3})`);
        await page.evaluate("document.querySelector('.lqs-tinta').click()");
        await page.waitForTimeout(800);

        // ── RG · recargar: la pestaña a la vista y el ticket quieto ──
        await page.reload({ waitUntil: "load" });
        await quieta(page);
        await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 }).catch(() => null);
        await page.evaluate("scrollTo(0, 0)");
        await page.waitForTimeout(6000);
        const v = await page.evaluate("({ y: Math.round(scrollY), pestana: document.querySelector('[data-lqs=\"pestana\"]') && document.querySelector('[data-lqs=\"pestana\"]').getAttribute('data-visible'), abierto: document.querySelector('.lqs-velo') && document.querySelector('.lqs-velo').getAttribute('data-abierto') })");
        console.log(`  · al recargar: scrollY ${v.y}, pestaña ${v.pestana === "1" ? "visible" : "oculta"}, ticket ${v.abierto === "1" ? "abierto" : "cerrado"}`);
        if (v.pestana !== "1") F("RG · al recargar después de cerrar el ticket, la pestaña no está a la vista");
        if (v.abierto === "1") F("RG · al recargar después de cerrar el ticket, se abre solo otra vez");

        // ── 2A · con ?lqs=1, el recuadro con los eventos ──
        await page.goto(`${BASE}/analisis/${ID}?lqs=1`, { waitUntil: "load" });
        await quieta(page);
        const caja = await page.waitForSelector('[data-lqs="diagnostico"]', { timeout: 60_000 }).then(() => true, () => false);
        const texto: string = caja ? await page.locator('[data-lqs="diagnostico"]').innerText() : "";
        console.log(`  · ?lqs=1:\n      ${texto.replace(/\n/g, "\n      ")}`);
        if (!/Oferta: vigente/.test(texto) || !/En este navegador: se mostró y se cerró/.test(texto) || !/Ticket: cerrado · pestaña visible/.test(texto)) F("2A · con `?lqs=1` el recuadro no dice el estado del ticket (oferta, este navegador, pestaña)");
        const esperados: Array<[RegExp, string]> = [
          [/Últimos eventos:/, "el título de los eventos"],
          [/\d\d:\d\d:\d\d · abierto \(pestaña\)/, "abierto y con qué disparador"],
          [/\d\d:\d\d:\d\d · al segundo, dentro de la pantalla: arriba \d+ · alto \d+ de \d+/, "si estaba dentro de la pantalla, con posición y tamaño"],
          [/toque en el velo ignorado/, "el toque en el velo ignorado"],
          [/a la despedida por el velo/, "la despedida por el velo"],
          [/cerrado por «Sí, seguir leyendo»/, "el cierre por «Sí, seguir leyendo»"],
        ];
        for (const [re, q] of esperados) if (!re.test(texto)) F(`2A · el recuadro de ?lqs=1 no muestra ${q}`);
      }
      await ctx.close();

      // ── 2D · con la hoja fuera de la pantalla, «ya se mostró» no se guarda ──
      const ctx3 = await nuevo(true, [VIGILAR, HOJA_AFUERA]);
      const p3 = await ctx3.newPage();
      await abrirInforme(p3);
      await bajarAlFinal(p3, false);
      for (let i = 0; i < 260; i++) {
        if (await p3.evaluate("window.__t.abre != null")) break;
        await p3.waitForTimeout(50);
      }
      if (!(await p3.evaluate("window.__t.abre != null"))) F("2D · (fuera de la pantalla) el ticket no subió para medir");
      else {
        await hastaTrasAbrir(p3, 2_000);
        const g = await geometria(p3);
        const e = await estado(p3);
        const bit = await p3.evaluate(`localStorage.getItem(${JSON.stringify(`lqs_bitacora_${ID}`)})`);
        console.log(`  · hoja forzada afuera (arriba ${g.hojaTop} de ${g.pantalla}): «ya se mostró» ${e ?? "no"}; bitácora ${bit}`);
        if (g.hojaTop < g.pantalla) throw new NoCorrio(`no se pudo sacar la hoja de la pantalla (arriba ${g.hojaTop})`);
        if (e === "visto") F("2D · con la hoja fuera de la pantalla, «ya se mostró» se guarda igual (el ticket no vuelve y nadie lo vio)");
        if (!/"tipo":"medido","dentro":false/.test(bit ?? "")) F("2D · la bitácora no anota que la hoja estaba fuera de la pantalla");
      }
      await ctx3.close();
    }

    // ── 1 · la hoja de la dirección: foco, iOS desplaza 300 px, el área visible a la mitad ──
    const ctx2 = await nuevo(false, [AREA_VISIBLE_MITAD]);
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/analisis/nuevo-v4`, { waitUntil: "load", timeout: 180_000 });
    await quieta(p2);
    await p2.waitForSelector(".he-input-boton", { timeout: 90_000 });
    await p2.waitForTimeout(2500);
    await p2.locator(".he-input-boton").first().tap();
    await p2.waitForSelector(".he-hoja-input", { timeout: 30_000 });
    await p2.waitForTimeout(800);
    // Lo que hace iOS: con un panel fijo, al enfocar el campo desplaza la ventana. Para que haya adónde desplazarla
    // con el body fijo, se cuelga del <html> un espaciador alto (en iOS la ventana se mueve igual, sobre el teclado).
    const foco = await p2.evaluate(`(() => {
      var esp = document.createElement('div');
      esp.setAttribute('data-sonda', 'espaciador');
      esp.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:3000px;pointer-events:none;';
      document.documentElement.appendChild(esp);
      document.querySelector('.he-hoja-input').focus();
      // Instantáneo: el <html> del sitio lleva scroll suave, y el de iOS al enfocar no espera.
      window.scrollTo({ top: 300, left: 0, behavior: 'instant' });
      var tras = window.scrollY;
      window.visualViewport && window.visualViewport.dispatchEvent(new Event('resize'));
      return tras;
    })()`);
    await p2.waitForTimeout(400);
    await p2.locator(".he-hoja-input").first().pressSequentially("82", { delay: 80 });
    await p2.waitForTimeout(3000);
    const deGoogle = await p2.evaluate("document.querySelectorAll('.pac-container .pac-item').length");
    if (!deGoogle) await p2.evaluate(`(() => {
      var c = document.createElement('div');
      c.className = 'pac-container pac-logo';
      c.style.cssText = 'width: 300px; position: absolute; left: 12px; top: 900px; display: block;';
      ['Calle 82', 'Avenida 82', 'Pasaje 82', 'Calle 82 Oriente', 'Calle 82 Poniente', 'Pasaje 82 Norte', 'Calle 82 Sur'].forEach(function (t) {
        var it = document.createElement('div');
        it.className = 'pac-item';
        it.innerHTML = '<span class="pac-item-query">' + t + '</span><span>Santiago, Chile</span>';
        c.appendChild(it);
      });
      document.body.appendChild(c);
    })()`);
    await p2.waitForTimeout(600);
    // En iOS, con el teclado, lo fijo se corre con la ventana: lo que se VE está en (medida − scrollY).
    const h = await p2.evaluate(`(() => {
      var sy = window.scrollY;
      var ve = function (el) { var r = el.getBoundingClientRect(); return { top: Math.round(r.top - sy), bottom: Math.round(r.bottom - sy) }; };
      var hoja = document.querySelector('.v-modal');
      var campo = document.querySelector('.he-hoja-input');
      var cont = document.querySelector('.he-hoja-sugerencias');
      var lista = Array.prototype.slice.call(document.querySelectorAll('.he-hoja-sugerencias .pac-container')).filter(function (c) { return getComputedStyle(c).display !== 'none'; })[0];
      var items = lista ? Array.prototype.slice.call(lista.querySelectorAll('.pac-item')) : [];
      var teclado = Math.round(innerHeight / 2);
      var alcanzables = items.map(function (it) {
        it.scrollIntoView({ block: 'nearest' });
        var s2 = window.scrollY, b = it.getBoundingClientRect(), c = cont.getBoundingClientRect();
        return b.top - s2 >= -1 && b.bottom - s2 <= teclado + 1 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1;
      });
      return {
        innerH: innerHeight, vvH: window.visualViewport && window.visualViewport.height, scrollY: sy,
        hoja: hoja ? ve(hoja) : null, campo: campo ? ve(campo) : null, lista: cont ? ve(cont) : null,
        listaScroll: cont ? getComputedStyle(cont).overflowY : null, listaDesborda: cont ? cont.scrollHeight > cont.clientHeight + 1 : false,
        items: items.length, alcanzables: alcanzables,
      };
    })()`);
    console.log(`  · hoja de la dirección: tras el foco iOS desplazó la ventana a ${foco}; ahora scrollY ${h.scrollY}; área visible ${h.vvH} de ${h.innerH}`);
    console.log(`    se ve: hoja ${h.hoja?.top}–${h.hoja?.bottom}, campo ${h.campo?.top}–${h.campo?.bottom}, lista ${h.lista?.top}–${h.lista?.bottom} (${h.listaScroll}${h.listaDesborda ? ", con scroll adentro" : ""}); ${h.items} sugerencias ${deGoogle ? "de Google" : "inyectadas"}, alcanzables sobre el teclado: ${h.alcanzables.filter(Boolean).length}/${h.items}`);
    if (foco !== 300) throw new NoCorrio(`no se pudo simular el desplazamiento de iOS al enfocar (la ventana quedó en ${foco})`);
    if (h.vvH !== Math.round(h.innerH / 2)) throw new NoCorrio(`no se pudo recortar el área visible (${h.vvH})`);
    if (h.scrollY !== 0) F(`1 · al enfocar el campo, iOS desplaza la página ${h.scrollY} px y no vuelve a cero: la hoja se va de la pantalla`);
    if (!h.hoja || Math.abs(h.hoja.top) > 1) F(`1 · la hoja de la dirección no se ve anclada arriba (se ve desde ${h.hoja?.top})`);
    if (!h.campo || h.campo.top < 0 || h.campo.bottom > h.vvH) F(`1 · el campo de la dirección no se ve sobre el teclado (${h.campo?.top}–${h.campo?.bottom}, teclado desde ${h.vvH})`);
    if (h.items < 3) F(`1 · la lista no está dentro de la hoja (${h.items} sugerencias adentro)`);
    else {
      if (!h.lista || h.lista.top < (h.campo?.bottom ?? 0) - 1 || h.lista.bottom > h.vvH + 1) F(`1 · la lista no queda bajo el campo y sobre el teclado (${h.lista?.top}–${h.lista?.bottom}, teclado desde ${h.vvH})`);
      if (h.listaScroll !== "auto" && h.listaScroll !== "scroll") F(`1 · la lista no tiene scroll propio (overflow-y ${h.listaScroll})`);
      if (h.alcanzables.some((a: boolean) => !a)) F(`1 · ${h.alcanzables.filter((a: boolean) => !a).length} sugerencias no se alcanzan dentro de la lista, sobre el teclado`);
    }
    await ctx2.close();
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(`─── SONDA TICKET-Y-HOJA (WebKit 390) · ${BASE} · ${ID} ───`);
  if (fallas.length) {
    for (const f of fallas) console.log(`  ✗ ${f}`);
    console.log(`  ✗ ROJO — ${fallas.length} falla(s)`);
    process.exit(1);
  }
  console.log(SOLO === "hoja"
    ? "  ✓ VERDE (solo la hoja) — al enfocar el campo la página vuelve a cero, la hoja queda arriba con el campo a la vista y la lista hace scroll adentro sobre el teclado"
    : "  ✓ VERDE — bajando por encima del banner el ticket sube a los 8 s; la hoja y la pestaña quedan dentro de la pantalla aunque el área visible diga otra cosa; «ya se mostró» solo tras un segundo en pantalla, y nunca con la hoja afuera; el velo no cierra con un gesto previo ni en el primer segundo; quien vuelve encuentra la pestaña; ?lqs=1 muestra los eventos; la hoja de la dirección vuelve a cero, va arriba y su lista hace scroll adentro");
}

main().then(() => process.exit(0), (e) => {
  const msj = e instanceof Error ? e.message : String(e);
  if (fallas.length) {
    for (const f of fallas) console.log(`  ✗ ${f}`);
    console.log(`  ✗ ROJO — ${fallas.length} falla(s) (y después un paso se cayó: ${msj})`);
    process.exit(1);
  }
  console.log(`✗ NO CORRIÓ — ${msj}`);
  process.exit(2);
});
