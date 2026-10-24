// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · LOS POP-UPS CABEN EN UN TELÉFONO (24-oct-2026, decisión de Fabrizio). En WebKit, pantalla de 390 × 740 con
// perfil de iPhone, contra /dev/popups (next dev o un preview de Vercel), mide los siete estados: «Analizar este» sin saldo
// con la oferta de cuentas nuevas (a) y sin ella (a0), con saldo como se abre (d1), con la línea del ticket (d1t), después
// de «Cambiar» y bajar el pie a 10 % (d2), y el aviso E de Explorar con la oferta (e) y sin ella (e0). En cada uno:
//   ALTO · el panel entero dentro de la pantalla y su cuerpo SIN SCROLL (scrollHeight ≤ clientHeight): ni la tarjeta roja
//          ni un botón quedan cortados. Imprime el alto del panel y lo que sobra.
//   LÍNEAS · «No te quedan análisis.» en una línea; la tarjeta del depto en dos (comuna · tipología · m² · precio, y
//          veredicto · flujo) más la del enlace en UNA; la oferta en una fila («Solo para cuentas nuevas · vence …») y
//          debajo «3 análisis por $14.990 · $4.997 cada uno» en una línea.
//   CANCELAR · «Cancelar» (y «Ahora no») es texto, no un botón de borde: sin borde y más bajo que los botones.
//   SUELTO · «Comprar solo 1» es un botón de borde, más bajo que el principal.
//   ANCHO · ninguna de esas líneas se corta ni se sale a lo ancho (una sola línea no vale si el texto no cabe).
// Una línea se cuenta por su alto: alto del elemento / su line-height, redondeado.
// ACTA (24-oct-2026, contra el next dev del worktree). ROJO sobre el código de antes: 22 fallas, entre ellas D2 con 16 px
// de scroll en el cuerpo, el nombre del depto en dos líneas, la línea del enlace en tres, la oferta en dos filas,
// «Comprar solo 1» tan alto como el principal y «Cancelar» como botón de borde. VERDE con el código nuevo, a 740 y a 664
// (Safari con sus barras): el más alto es D2 con 549 px; las páginas reales con una cuenta de prueba sin saldo midieron
// lo mismo (aviso E 458 px, «Analizar este» sin saldo 411 px, sin scroll). Mutaciones, ROJO 8 de 9: sin el modo compacto,
// la línea del enlace larga, el nombre a 18 px con salto, la oferta a 20 px, la fila de la oferta en mayúsculas con la
// píldora, «Cancelar» como botón, «Comprar solo 1» alto en el pop-up y en el aviso E. VERDE la novena —devolver los
// márgenes de antes— y está bien: con las líneas compactas, los márgenes viejos caben igual; no son lo que sostiene la regla.
// Sale con 1 si algo falla, con 2 si no pudo correr (sin Playwright, sin servidor). Nada escribe: todo lo que no es GET
// se corta.
// Uso: PLAYWRIGHT_DIR=<carpeta con playwright 1.60 y su WebKit> node --import tsx scripts/eval/golden/popups-alto-webkit-sonda.ts [--base http://localhost:3000] [--alto 740]
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "http://localhost:3000").replace(/\/$/, "");
const ANCHO = 390;
const ALTO = Number(arg("--alto") ?? 740);
const ESTADOS = ["a", "a0", "d1", "d1t", "d2", "e", "e0"] as const;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
class NoCorrio extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
const cerrar = (x: any) => Promise.race([Promise.resolve().then(() => x.close()).catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);

/** Lo que se mide en la página, como TEXTO (tsx envuelve las funciones con nombre en un `__name` que el navegador no tiene). */
const MEDIR = `(() => {
  const r = (el) => el ? el.getBoundingClientRect() : null;
  const lineas = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return Math.round(el.getBoundingClientRect().height / lh);
  };
  // Lo que se corta a lo ancho: un texto en una línea que no cabe (nowrap lo deja en una línea aunque se salga).
  const anchos = Array.from(document.querySelectorAll('.av-sin-titulo, .av-nombre, .av-linea, .av-incluye, .av-ticket-fila, .av-ticket-t, .ex-ticket-fila, .ex-ticket-t, .wz-modal button'))
    .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > (document.querySelector('.wz-modal')?.getBoundingClientRect().right ?? innerWidth) + 0.5)
    .map((el) => (el.textContent || '').trim().slice(0, 40));
  const panel = document.querySelector('.wz-modal');
  const mc = document.querySelector('.wz-modal-mc');
  const fila = document.querySelector('.av-ticket-fila, .ex-ticket-fila');
  const filaHijos = fila ? Array.from(fila.children).map((c) => Math.round(c.getBoundingClientRect().top)) : [];
  const boton = (sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); return { alto: Math.round(el.getBoundingClientRect().height), borde: parseFloat(cs.borderTopWidth) || 0, fondo: cs.backgroundColor, texto: el.textContent.trim() }; };
  const cortados = Array.from(document.querySelectorAll('.wz-modal button, .wz-modal a, .av-ticket, .ex-ticket, .av-tarjeta'))
    .filter((el) => { const b = el.getBoundingClientRect(); return b.height > 0 && (b.bottom > innerHeight + 0.5 || b.top < -0.5); })
    .map((el) => (el.textContent || el.className).trim().slice(0, 40));
  return {
    vh: innerHeight,
    panel: panel ? { top: Math.round(r(panel).top), bottom: Math.round(r(panel).bottom), alto: Math.round(r(panel).height) } : null,
    mcScroll: mc ? mc.scrollHeight - mc.clientHeight : null,
    docScroll: document.scrollingElement.scrollHeight - innerHeight,
    cortados,
    anchos,
    titulo: lineas('.av-sin-titulo'),
    nombre: lineas('.av-tarjeta .av-nombre'),
    linea: lineas('.av-tarjeta .av-linea'),
    incluye: lineas('.av-tarjeta .av-incluye'),
    incluyeTexto: document.querySelector('.av-incluye') ? document.querySelector('.av-incluye').textContent.trim() : null,
    filaUna: filaHijos.length >= 2 ? filaHijos.every((t) => Math.abs(t - filaHijos[0]) <= 3) : null,
    filaTexto: fila ? fila.textContent.trim() : null,
    oferta: lineas('.av-ticket-t, .ex-ticket-t'),
    ofertaTexto: document.querySelector('.av-ticket-t, .ex-ticket-t') ? document.querySelector('.av-ticket-t, .ex-ticket-t').textContent.trim() : null,
    principal: boton('.wz-cta-modal'),
    suelto: boton('[data-modal-secundario], [data-explorar="comprar-suelto"]'),
    cancelar: boton('[data-modal-cancelar], [data-explorar="ahora-no"]'),
  };
})()`;

async function main(): Promise<void> {
  let pw: any;
  try {
    pw = createRequire(join(process.env.PLAYWRIGHT_DIR ?? "", "package.json"))("playwright");
  } catch {
    throw new NoCorrio("falta PLAYWRIGHT_DIR (una carpeta con `npm i playwright@1.60.0` y `npx playwright install webkit`)");
  }
  const browser = await pw.webkit.launch();
  try {
    const { viewport: _v, ...iphone } = pw.devices["iPhone 13"];
    const ctx = await browser.newContext({ ...iphone, viewport: { width: ANCHO, height: ALTO } });
    await ctx.route("**/*", (ruta: any) => (ruta.request().method() === "GET" && !/posthog|sentry|vercel\.live|facebook/.test(ruta.request().url()) ? ruta.continue() : ruta.abort()));
    const page = await ctx.newPage();
    for (const e of ESTADOS) {
      const url = `${BASE}/dev/popups?estado=${e}`;
      const res = await page.goto(url, { waitUntil: "load", timeout: 120_000 }).catch(() => null);
      if (!res || res.status() !== 200) throw new NoCorrio(`${url} respondió ${res?.status() ?? "sin respuesta"}`);
      await page.waitForSelector(".wz-modal", { timeout: 30_000 }).catch(() => { throw new NoCorrio(`${url}: no se abrió el pop-up`); });
      if (e === "d2") {
        await page.click("[data-modal-cambiar]");
        await page.selectOption('[data-aviso="pie"]', "10");
        await page.waitForSelector('[data-aviso="cambio"]', { timeout: 10_000 }).catch(() => { throw new NoCorrio("d2: no llegó el recálculo"); });
      }
      await page.evaluate("document.fonts.ready");
      const m: any = await page.evaluate(MEDIR);
      const p = m.panel;
      console.log(`${e.padEnd(4)} panel ${p ? `${p.top}–${p.bottom} (${p.alto} px) de ${m.vh}, sobran ${m.vh - p.bottom}` : "—"} · scroll del cuerpo ${m.mcScroll} · de la página ${m.docScroll}`);
      const ok = (cond: boolean, msg: string) => { if (!cond) F(`${e} · ${msg}`); };
      ok(!!p && p.bottom <= m.vh && p.top >= 0, `ALTO · el panel no cabe en la pantalla (${p ? `${p.top}–${p.bottom}` : "sin panel"} de ${m.vh})`);
      ok(m.mcScroll != null && m.mcScroll <= 1, `ALTO · el cuerpo del pop-up hace scroll (${m.mcScroll} px de más)`);
      ok(m.cortados.length === 0, `ALTO · quedan cortados: ${m.cortados.join(" | ")}`);
      ok(m.anchos.length === 0, `ANCHO · no caben a lo ancho (se cortan o se salen): ${m.anchos.join(" | ")}`);
      if (e === "a" || e === "a0") ok(m.titulo === 1, `LÍNEAS · «No te quedan análisis.» ocupa ${m.titulo} líneas`);
      if (e.startsWith("a") || e.startsWith("d")) {
        ok(m.nombre === 1, `LÍNEAS · comuna · tipología · m² · precio ocupa ${m.nombre} líneas`);
        if (e !== "d2") ok(m.linea === 1, `LÍNEAS · veredicto · flujo ocupa ${m.linea} líneas`);
        ok(m.incluye === 1 && m.incluyeTexto === "El informe incluye el enlace a la publicación.", `LÍNEAS · la línea del enlace: «${m.incluyeTexto}» en ${m.incluye} líneas`);
      }
      if (e === "a" || e === "e") {
        ok(m.filaUna === true && /^Solo para cuentas nuevas\s*·?\s*vence mañana 18:07$/i.test((m.filaTexto ?? "").replace(/\s+/g, " ")), `LÍNEAS · la oferta no va en una fila: «${m.filaTexto}» (una fila: ${m.filaUna})`);
        if (e === "a") ok(m.oferta === 1 && m.ofertaTexto === "3 análisis por $14.990 · $4.997 cada uno", `LÍNEAS · «${m.ofertaTexto}» en ${m.oferta} líneas`);
      }
      if (e === "a" || e === "a0" || e === "e" || e === "e0") {
        ok(!!m.suelto && m.suelto.borde >= 1 && !!m.principal && m.suelto.alto < m.principal.alto, `SUELTO · «Comprar solo 1» no es un botón de borde más bajo que el principal (${JSON.stringify(m.suelto)} vs ${JSON.stringify(m.principal)})`);
        if (e === "a") ok(m.principal?.texto === "Aprovechar · 3 por $14.990", `el principal dice «${m.principal?.texto}»`);
      }
      ok(!!m.cancelar && m.cancelar.borde === 0 && !!m.principal && m.cancelar.alto < m.principal.alto, `CANCELAR · «${m.cancelar?.texto}» no es texto (${JSON.stringify(m.cancelar)})`);
    }
    await cerrar(ctx);
  } finally {
    await cerrar(browser);
  }
}

main()
  .then(() => {
    if (fallas.length) { console.log(`\n✗ ${fallas.length} falla(s):\n  ${fallas.join("\n  ")}`); process.exit(1); }
    console.log("\n✓ los siete pop-ups caben enteros, sin scroll");
  })
  .catch((e) => {
    if (fallas.length) console.log(`\n✗ ${fallas.length} falla(s) antes de cortarse:\n  ${fallas.join("\n  ")}`);
    console.log(`\n⚠ NO CORRIÓ: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(e instanceof NoCorrio ? 2 : 1);
  });
