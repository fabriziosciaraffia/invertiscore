// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · el ticket y la hoja de la dirección en WebKit a 390 px (12-oct-2026). Corre contra `next dev`
// (la cookie de QA `franco_qa_dueno` hace de dueño anónimo SOLO ahí) y prueba, en un perfil de iPhone:
//   1 · EL TICKET A LOS 8 S: en un informe de renta larga, como dueño, el ticket sube a los 8 s de que la marca
//       del final de los capítulos (`FinCapitulos`, después de «Tu resultado a 10 años») entra en pantalla, y no
//       antes. Sin la marca en la página, ROJO.
//   2 · EL QUE VUELVE LO ENCUENTRA: después de cerrar el ticket, al recargar el informe la pestaña está a la vista
//       desde arriba de la página y el ticket no se abre solo.
//   3 · «POR QUÉ NO SALE»: con `?lqs=1` el recuadro aparece para el dueño; sin el parámetro, no.
//   4 · LA HOJA DE LA DIRECCIÓN con el área visible recortada a la mitad (lo que hace el teclado): ocupa la
//       pantalla —no el área visible— y las cinco sugerencias se alcanzan por encima del teclado. En local Google
//       no responde (la clave solo acepta refranco.ai): se cuelga del <body> una lista como la del widget.
// Sale con 1 si algo falla, con 2 si no pudo correr (sin Playwright, sin servidor, sin el informe). Nada escribe:
// todo lo que no es GET se corta.
// Uso: PLAYWRIGHT_DIR=<carpeta con playwright 1.60 y su WebKit> node --import tsx scripts/eval/golden/ticket-hoja-webkit-sonda.ts [--base http://localhost:3000] [--id <informe LTR que nació anónimo>]
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "http://localhost:3000").replace(/\/$/, "");
/** Un informe de renta larga que nació anónimo (el de la prueba de Fabrizio en el iPhone del 09-oct). */
const ID = arg("--id") ?? "4e90b219-1430-4337-8027-e43dae7a53c6";
const ESPERA_ESPERADA_MS = 8_000;
const TOLERANCIA_MS = 1_500;

/** Fuera de `main`: si un paso se cae después de encontrar fallas, las fallas no se pierden (12-oct-2026). */
const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  let pw: any;
  try {
    pw = createRequire(join(process.env.PLAYWRIGHT_DIR ?? "", "package.json"))("playwright");
  } catch {
    console.log("✗ NO CORRIÓ — falta PLAYWRIGHT_DIR (una carpeta con `npm i playwright@1.60.0` y `npx playwright install webkit`)");
    process.exit(2);
  }
  const { webkit, devices } = pw;
  const browser = await webkit.launch();
  const nuevo = async (conDueno: boolean, init?: (() => void) | string) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    if (conDueno) await ctx.addCookies([{ name: "franco_qa_dueno", value: ID, url: BASE }]);
    await ctx.route(/vercel\.live|posthog|sentry/, (r: any) => r.abort());
    await ctx.route("**/*", (r: any) => (["GET", "HEAD", "OPTIONS"].includes(r.request().method()) ? r.fallback() : r.abort()));
    if (init) await ctx.addInitScript(init);
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
  try {
    // ── 1 · el ticket a los 8 s de la marca ──
    // Como TEXTO, no como función: tsx (esbuild) envuelve las funciones con nombre en un `__name` que en el
    // navegador no existe, y el script de inicio moría sin registrar nada (visto el 12-oct-2026).
    const ctx = await nuevo(true, [
      "window.__t = {};",
      "(function vigilar() {",
      "  var m = document.querySelector('[data-lqs=\"fin-capitulos\"]');",
      "  if (m && window.__t.marca == null && m.getBoundingClientRect().top < innerHeight) window.__t.marca = performance.now();",
      "  var v = document.querySelector('.lqs-velo');",
      "  if (v && window.__t.abre == null && v.getAttribute('data-abierto') === '1') window.__t.abre = performance.now();",
      "  requestAnimationFrame(vigilar);",
      "})();",
    ].join("\n"));
    // La oferta dura 24 h desde que nació el informe: si ya venció, el reloj DEL NAVEGADOR se pone dentro de su
    // ventana (el servidor no mira la hora para ofrecerla; la vigencia la mira el ticket). Sin esto, un informe
    // de prueba viejo daría «no sube» con razón.
    const html = await fetch(`${BASE}/analisis/${ID}`, { headers: { cookie: `franco_qa_dueno=${ID}` } }).then((x) => x.text(), () => "");
    const creado = /createdAt\\":\\"([^\\"]+)/.exec(html)?.[1];
    if (!creado) { console.log(`✗ NO CORRIÓ — no encuentro la fecha del informe ${ID} en ${BASE}`); process.exit(2); }
    const t0 = new Date(creado).getTime();
    if (Date.now() >= t0 + 24 * 3600_000) {
      await ctx.clock.install({ time: new Date(t0 + 30 * 60_000) });
      console.log(`  · la oferta del informe venció; el reloj del navegador va a ${new Date(t0 + 30 * 60_000).toISOString()}`);
    }
    const page = await ctx.newPage();
    const r = await page.goto(`${BASE}/analisis/${ID}`, { waitUntil: "load", timeout: 180_000 }).catch(() => null);
    if (!r || r.status() !== 200) { console.log(`✗ NO CORRIÓ — ${BASE}/analisis/${ID} respondió ${r?.status()}`); process.exit(2); }
    const conTicket = await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 }).then(() => true, () => false);
    if (!conTicket) { console.log("✗ NO CORRIÓ — el ticket no está montado: ¿`next dev` y un informe que nació anónimo, sin pack pagado y vigente?"); process.exit(2); }
    await quieta(page);
    await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 });
    await page.waitForTimeout(3000);
    if (await page.locator("[data-lqs=\"diagnostico\"]").count()) F("3 · el recuadro de diagnóstico aparece sin `?lqs=1`");
    if (!(await page.locator('[data-lqs="fin-capitulos"]').count())) F("1 · el informe de renta larga no tiene la marca del final de los capítulos: el ticket no sube a los 8 s");
    else {
      for (let i = 0; i < 60; i++) {
        if (await page.evaluate(() => (window as any).__t.marca != null)) break;
        await page.evaluate(() => scrollBy(0, 300));
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(ESPERA_ESPERADA_MS + TOLERANCIA_MS + 2000);
      const t = await page.evaluate(() => (window as any).__t);
      if (t.marca == null) F("1 · la marca del final nunca entró en pantalla");
      else if (t.abre == null) F(`1 · el ticket no subió a los ${(ESPERA_ESPERADA_MS + TOLERANCIA_MS) / 1000} s de pasar la marca`);
      else {
        const d = Math.round(t.abre - t.marca);
        console.log(`  · el ticket subió ${d} ms después de que la marca entró en pantalla`);
        if (d < ESPERA_ESPERADA_MS - TOLERANCIA_MS || d > ESPERA_ESPERADA_MS + TOLERANCIA_MS) F(`1 · el ticket subió ${d} ms después de la marca (debía ser ~8.000)`);
      }
    }
    // ── 2 · cerrar, recargar: la pestaña a la vista y el ticket quieto ──
    if (await page.locator('.lqs-velo[data-abierto="1"]').count()) {
      await page.locator(".lqs-x").first().tap();
      await page.waitForTimeout(600);
      await page.locator(".lqs-tinta").first().tap();
      await page.waitForTimeout(800);
      await page.reload({ waitUntil: "load" });
      await quieta(page);
      await page.waitForSelector(".lqs-velo", { state: "attached", timeout: 90_000 }).catch(() => null);
      // Desde ARRIBA de la página: el navegador restaura el scroll al recargar, y abajo la pestaña ya se veía antes.
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(6000);
      const v = await page.evaluate(() => ({ y: Math.round(scrollY), pestana: document.querySelector('[data-lqs="pestana"]')?.getAttribute("data-visible"), abierto: document.querySelector(".lqs-velo")?.getAttribute("data-abierto") }));
      console.log(`  · al recargar: scrollY ${v.y}, pestaña ${v.pestana === "1" ? "visible" : "oculta"}, ticket ${v.abierto === "1" ? "abierto" : "cerrado"}`);
      if (v.pestana !== "1") F("2 · al recargar después de cerrar el ticket, la pestaña no está a la vista");
      if (v.abierto === "1") F("2 · al recargar después de cerrar el ticket, se abre solo otra vez");
      // ── 3 · con ?lqs=1, el recuadro ──
      await page.goto(`${BASE}/analisis/${ID}?lqs=1`, { waitUntil: "load" });
      await quieta(page);
      const caja = await page.waitForSelector('[data-lqs="diagnostico"]', { timeout: 60_000 }).then(() => true, () => false);
      const texto = caja ? await page.locator('[data-lqs="diagnostico"]').innerText() : "";
      console.log(`  · ?lqs=1: ${texto.replace(/\n/g, " | ").slice(0, 300)}`);
      if (!/Oferta: vigente/.test(texto) || !/En este navegador: se mostró y se cerró/.test(texto) || !/Ticket: cerrado · pestaña visible/.test(texto)) F("3 · con `?lqs=1` el recuadro no dice el estado del ticket (oferta, este navegador, pestaña)");
    } else if (!fallas.length) F("2 · el ticket no quedó abierto para cerrarlo y recargar");
    await ctx.close();

    // ── 4 · la hoja de la dirección con el área visible a la mitad ──
    // El área visible a la mitad, en el PROTOTIPO: el objeto de `visualViewport` del documento puede no ser el
    // mismo cuando arranca el script de inicio.
    const ctx2 = await nuevo(false, () => {
      try {
        Object.defineProperty(VisualViewport.prototype, "height", { configurable: true, get() { return Math.round(window.innerHeight / 2); } });
        Object.defineProperty(VisualViewport.prototype, "offsetTop", { configurable: true, get() { return 0; } });
      } catch { /* sin VisualViewport no hay nada que recortar */ }
    });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/analisis/nuevo-v4`, { waitUntil: "load", timeout: 180_000 });
    await quieta(p2);
    await p2.waitForSelector(".he-input-boton", { timeout: 90_000 });
    await p2.waitForTimeout(2500);
    await p2.locator(".he-input-boton").first().tap();
    await p2.waitForSelector(".he-hoja-input", { timeout: 30_000 });
    await p2.waitForTimeout(800);
    await p2.locator(".he-hoja-input").first().focus();
    await p2.evaluate(() => window.visualViewport?.dispatchEvent(new Event("resize")));
    await p2.locator(".he-hoja-input").first().pressSequentially("82", { delay: 80 });
    await p2.waitForTimeout(3000);
    // Si Google respondió (la clave acepta el origen), la lista es la de verdad; si no, una como la del widget.
    const deGoogle = await p2.evaluate(() => document.querySelectorAll(".pac-container .pac-item").length);
    if (!deGoogle) await p2.evaluate(() => {
      const c = document.createElement("div");
      c.className = "pac-container pac-logo";
      c.style.cssText = "width: 300px; position: absolute; left: 12px; top: 900px; display: block;";
      for (const t of ["Calle 82", "Avenida 82", "Pasaje 82", "Calle 82 Oriente", "Calle 82 Poniente"]) {
        const it = document.createElement("div");
        it.className = "pac-item";
        it.innerHTML = `<span class="pac-item-query">${t}</span><span>Santiago, Chile</span>`;
        c.appendChild(it);
      }
      document.body.appendChild(c);
    });
    await p2.waitForTimeout(600);
    const h = await p2.evaluate(() => {
      const hoja = document.querySelector(".v-modal") as HTMLElement | null;
      const cuerpo = document.querySelector(".v-modal-cuerpo") as HTMLElement | null;
      const lista = Array.from(document.querySelectorAll(".he-hoja-sugerencias .pac-container")).find((c) => getComputedStyle(c).display !== "none");
      const items = lista ? (Array.from(lista.querySelectorAll(".pac-item")) as HTMLElement[]) : [];
      const teclado = Math.round(innerHeight / 2);
      const alcanzables = items.map((it) => {
        it.scrollIntoView({ block: "start" });
        const b = it.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= teclado;
      });
      return { innerH: innerHeight, vvH: window.visualViewport?.height, hojaBottom: hoja ? Math.round(hoja.getBoundingClientRect().bottom) : null, cuerpo: !!cuerpo, items: items.length, alcanzables };
    });
    console.log(`  · hoja con el área visible a ${h.vvH} de ${h.innerH}: termina en ${h.hojaBottom}; ${h.items} sugerencias ${deGoogle ? "de Google" : "inyectadas"} en la hoja; alcanzables sobre el teclado: ${h.alcanzables.filter(Boolean).length}/${h.items}`);
    if (h.vvH !== Math.round(h.innerH / 2)) F(`4 · no se pudo recortar el área visible (${h.vvH})`);
    if (h.hojaBottom === null || Math.abs(h.hojaBottom - h.innerH) > 2) F(`4 · la hoja se mide contra el área visible (termina en ${h.hojaBottom}, la pantalla en ${h.innerH})`);
    if (h.items < 3) F(`4 · la lista no está dentro de la hoja (${h.items} sugerencias adentro)`);
    else if (h.alcanzables.some((a: boolean) => !a)) F(`4 · ${h.alcanzables.filter((a: boolean) => !a).length} sugerencias no se alcanzan por encima del teclado`);
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
  console.log("  ✓ VERDE — el ticket sube a los 8 s de la marca; quien vuelve encuentra la pestaña y el ticket no se abre solo; `?lqs=1` dice el estado; la hoja de la dirección ocupa la pantalla y todas las sugerencias se alcanzan sobre el teclado");
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
