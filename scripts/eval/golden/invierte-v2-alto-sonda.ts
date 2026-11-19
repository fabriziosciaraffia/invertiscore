// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · LAS VENTANAS DE INVIERTE CON FRANCO CABEN (18-nov-2026, pedido de Fabrizio: «la ventana de contacto en PC queda
// con barra de scroll» en un notebook de ~650 px de alto útil). Contra /dev/invierte-v2 (next dev o un preview), mide la hoja
// de contacto, «Ver mi orden» y las preguntas de la firma en las medidas de la regla de revisión visual de CLAUDE.md:
//   celular 390 × 844 y 360 × 740 (WebKit con perfil de iPhone) · notebook 1366 × 768 y 1280 × 720 CON la barra del navegador
//   (1366 × 650 y 1280 × 610 de alto útil) · escritorio 1920 × 1080 (1920 × 960 útil), en Chromium.
// En cada una:
//   ALTO · la ventana entera dentro de la pantalla y SIN barra propia (su scrollHeight ≤ clientHeight). Si el contenido es largo,
//          el scroll va adentro (el cuerpo de la hoja o el texto del documento) y el botón principal queda a la vista: dentro
//          de la pantalla y no tapado por el borde del contenedor que hace scroll.
//   ANCHO · la página sin scroll horizontal y nada se sale de la ventana.
//   FUENTE · todo lo de adentro en Inter, sin monoespaciada ni la fuente del wordmark.
//   TOQUE · en el celular, botones, campos y casillas de al menos 44 px de alto (la casilla cuenta por su fila).
//   CONSOLA · sin errores.
// Imprime el alto de cada ventana y lo que sobra. Sale con 1 si algo falla, con 2 si no pudo correr. Nada escribe: lo que no es
// GET se corta.
// Uso: PLAYWRIGHT_DIR=<carpeta con playwright 1.60 y sus navegadores> node --import tsx scripts/eval/golden/invierte-v2-alto-sonda.ts [--base http://localhost:3000]
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "http://localhost:3000").replace(/\/$/, "");
// «comparar» (láminas del 19-nov-2026): la tabla del resultado a pedido, que se abre en ventana desde /dev/invierte-v2/resultado.
const ESTADOS = ["contacto", "orden", "preguntas", "comparar"] as const;
const MEDIDAS = [
  { n: "390×844", w: 390, h: 844, movil: true },
  { n: "360×740", w: 360, h: 740, movil: true },
  { n: "1366×768", w: 1366, h: 650, movil: false },
  { n: "1280×720", w: 1280, h: 610, movil: false },
  { n: "1920×1080", w: 1920, h: 960, movil: false },
] as const;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
class NoCorrio extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
const cerrar = (x: any) => Promise.race([Promise.resolve().then(() => x.close()).catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);

/** Lo que se mide en la página, como TEXTO (tsx envuelve las funciones con nombre en un `__name` que el navegador no tiene). */
const MEDIR = `((movil) => {
  const panel = document.querySelector('.iv2-hoja, .iv2-doc');
  if (!panel) return null;
  const r = panel.getBoundingClientRect();
  const boton = panel.querySelector('[data-inv2="continuar"], .iv2-doc-pie button, .iv2-doc-pie a');
  const b = boton ? boton.getBoundingClientRect() : null;
  // El contenedor que hace scroll más cercano al botón, dentro de la ventana: el botón no puede quedar fuera de su vista.
  let cont = boton ? boton.parentElement : null;
  while (cont && cont !== panel && !(cont.scrollHeight > cont.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(cont).overflowY))) cont = cont.parentElement;
  const c = cont ? cont.getBoundingClientRect() : r;
  const todos = Array.from(panel.querySelectorAll('*'));
  const fuentes = new Set(todos.filter((el) => (el.textContent || '').trim() && el.children.length === 0).map((el) => getComputedStyle(el).fontFamily));
  const malas = Array.from(fuentes).filter((f) => !/Inter/.test(f) || /mono|serif(?!-)|Source Serif|JetBrains/i.test(f.replace(/sans-serif/g, '')));
  // ⚠ ACTA (19-nov-2026, «comparar»): lo que vive dentro de un contenedor que se desliza de lado DENTRO de la ventana (la tabla de
  // comparar en el celular: tres columnas a la vista y «Desliza para ver el resto») no se sale: el scroll va adentro. Ese
  // contenedor sí tiene que caber.
  const deslizable = (el) => { for (let a = el.parentElement; a && a !== panel; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth) return true; } return false; };
  const anchos = todos.filter((el) => { const q = el.getBoundingClientRect(); return q.width > 0 && !deslizable(el) && (q.right > r.right + 0.5 || q.left < r.left - 0.5); }).map((el) => (el.textContent || el.className).toString().trim().slice(0, 40));
  const chicos = movil ? Array.from(panel.querySelectorAll('button, input:not([type=checkbox]), a, label.iv2-casilla')).filter((el) => { const q = el.getBoundingClientRect(); return q.height > 0 && q.height < 44 && !el.closest('.iv2-doc-texto'); }).map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30) + ' (' + Math.round(el.getBoundingClientRect().height) + ')') : [];
  return {
    vh: innerHeight, vw: innerWidth,
    top: Math.round(r.top), bottom: Math.round(r.bottom), alto: Math.round(r.height),
    barraPropia: panel.scrollHeight - panel.clientHeight,
    scrollAdentro: cont && cont !== panel ? cont.scrollHeight - cont.clientHeight : 0,
    boton: b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), texto: boton.textContent.trim() } : null,
    botonVisible: !!b && b.bottom <= innerHeight + 0.5 && b.top >= c.top - 0.5 && b.bottom <= c.bottom + 0.5,
    horizontal: document.scrollingElement.scrollWidth - innerWidth,
    anchos, malas, chicos,
  };
})`;

async function main(): Promise<void> {
  let pw: any;
  try {
    pw = createRequire(join(process.env.PLAYWRIGHT_DIR ?? "", "package.json"))("playwright");
  } catch {
    throw new NoCorrio("falta PLAYWRIGHT_DIR (una carpeta con `npm i playwright@1.60.0` y sus navegadores)");
  }
  const webkit = await pw.webkit.launch();
  const chromium = await pw.chromium.launch();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { viewport: _v, ...iphone } = pw.devices["iPhone 13"];
    for (const m of MEDIDAS) {
      const ctx = await (m.movil ? webkit : chromium).newContext(m.movil ? { ...iphone, viewport: { width: m.w, height: m.h } } : { viewport: { width: m.w, height: m.h } });
      await ctx.route("**/*", (ruta: any) => (ruta.request().method() === "GET" && !/posthog|sentry|vercel\.live|facebook/.test(ruta.request().url()) ? ruta.continue() : ruta.abort()));
      const page = await ctx.newPage();
      const errores: string[] = [];
      page.on("console", (msg: any) => { if (msg.type() === "error" && !/Failed to load resource|net::ERR_FAILED|posthog|sentry/i.test(msg.text())) errores.push(msg.text().slice(0, 120)); });
      page.on("pageerror", (e: any) => errores.push(String(e?.message ?? e).slice(0, 120)));
      for (const e of ESTADOS) {
        const url = e === "comparar" ? `${BASE}/dev/invierte-v2/resultado?n=4` : `${BASE}/dev/invierte-v2?estado=${e}`;
        const res = await page.goto(url, { waitUntil: "load", timeout: 120_000 }).catch(() => null);
        if (!res || res.status() !== 200) throw new NoCorrio(`${url} respondió ${res?.status() ?? "sin respuesta"}`);
        if (e === "comparar") {
          const enlace = page.locator('[data-inv2="comparar"]:visible').first();
          await enlace.click({ timeout: 30_000 }).catch(() => { throw new NoCorrio(`${url}: no está «Comparar los N lado a lado»`); });
        }
        await page.waitForSelector(".iv2-hoja, .iv2-doc", { timeout: 30_000 }).catch(() => { throw new NoCorrio(`${url}: no se abrió la ventana`); });
        await page.waitForTimeout(400);
        await page.evaluate("document.fonts.ready");
        const x: any = await page.evaluate(`${MEDIR}(${m.movil})`);
        const id = `${m.n} ${e}`;
        if (!x) { F(`${id} · no hay ventana`); continue; }
        console.log(`${id.padEnd(22)} ventana ${x.top}–${x.bottom} (${x.alto} px) de ${x.vh}, sobran ${x.vh - x.bottom} · barra propia ${x.barraPropia} · scroll adentro ${x.scrollAdentro} · «${x.boton?.texto ?? "—"}» ${x.botonVisible ? "a la vista" : "NO se ve"}`);
        if (x.top < 0 || x.bottom > x.vh) F(`${id} · ALTO · la ventana no cabe en la pantalla (${x.top}–${x.bottom} de ${x.vh})`);
        if (x.barraPropia > 1) F(`${id} · ALTO · la ventana tiene barra propia (${x.barraPropia} px de más)`);
        // El contacto en notebook y escritorio cabe ENTERO: ni barra propia ni scroll adentro (pedido de Fabrizio, 18-nov-2026).
        if (!m.movil && e === "contacto" && x.scrollAdentro > 1) F(`${id} · ALTO · el contacto no cabe entero: el cuerpo hace scroll (${x.scrollAdentro} px)`);
        if (!x.botonVisible) F(`${id} · ALTO · el botón principal no queda a la vista (${JSON.stringify(x.boton)})`);
        if (x.horizontal > 0) F(`${id} · ANCHO · la página hace scroll horizontal (${x.horizontal} px)`);
        if (x.anchos.length) F(`${id} · ANCHO · se salen de la ventana: ${x.anchos.slice(0, 4).join(" | ")}`);
        if (x.malas.length) F(`${id} · FUENTE · ${x.malas.join(" | ")}`);
        if (x.chicos.length) F(`${id} · TOQUE · de menos de 44 px: ${x.chicos.join(" | ")}`);
      }
      if (errores.length) F(`${m.n} · CONSOLA · ${errores.slice(0, 3).join(" | ")}`);
      await cerrar(ctx);
    }
  } finally {
    await cerrar(webkit);
    await cerrar(chromium);
  }
}

main()
  .then(() => {
    if (fallas.length) { console.log(`\n✗ ${fallas.length} falla(s):\n  ${fallas.join("\n  ")}`); process.exit(1); }
    console.log("\n✓ las cuatro ventanas caben en las cinco medidas, con el botón a la vista");
  })
  .catch((e) => {
    if (fallas.length) console.log(`\n✗ ${fallas.length} falla(s) antes de cortarse:\n  ${fallas.join("\n  ")}`);
    console.log(`\n⚠ NO CORRIÓ: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(e instanceof NoCorrio ? 2 : 1);
  });
