// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · LOS AJUSTES DEL RECORRIDO DEL 25-oct-2026, en WebKit a 390 con perfil de iPhone:
//   QV · la confirmación de «Quiero verlo» con un correo de 40 caracteres (/dev/quiero-verlo, «listo» y «ya»): el título en
//        UNA línea, el correo en dos como mucho y cortado SOLO en el arroba (lo de antes y lo de después, cada uno entero en
//        su línea), nada que se salga de la banda ni de la pantalla;
//   PE · el perfil del dashboard abierto en edición (necesita una sesión de una cuenta de prueba): la sección mide lo que
//        necesita —contiene el pie y el plazo—, ningún contenedor los recorta y la página baja hasta verlos.
// Sale con 1 si algo falla, con 2 si no pudo correr. Nada escribe: lo que no es GET se corta.
// Uso: PLAYWRIGHT_DIR=<playwright 1.60 con WebKit> node --import tsx scripts/eval/golden/ajustes-1025-webkit-sonda.ts [--base http://localhost:3000] [--sesion <storageState.json>]
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "http://localhost:3000").replace(/\/$/, "");
const SESION = arg("--sesion");
const CORREO = "fabriziosciaraffia+qadeptos5xy@gmail.com";
const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
class NoCorrio extends Error {}
/* eslint-disable @typescript-eslint/no-explicit-any */

const MEDIR_QV = `(() => {
  const banda = document.querySelector('.qv-banda');
  const t = document.querySelector('.qv-listo-t');
  const c = document.querySelector('[data-qv="correo"]');
  if (!banda || !t || !c) return null;
  const lineas = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  // Las líneas de un trozo de texto: los rectángulos de un Range, agrupados por su altura.
  const lineasDe = (nodo, desde, hasta) => { const r = document.createRange(); r.setStart(nodo, desde); r.setEnd(nodo, hasta); return new Set(Array.from(r.getClientRects()).filter((x) => x.width > 0).map((x) => Math.round(x.top))).size; };
  // Ninguna palabra del título partida: cada palabra, entera en una línea.
  const nt = t.firstChild; let partidas = 0;
  if (nt && nt.nodeType === 3) { const re = /\S+/g; let w; while ((w = re.exec(nt.data))) if (lineasDe(nt, w.index, w.index + w[0].length) > 1) partidas++; }
  const textos = Array.from(c.childNodes).filter((n) => n.nodeType === 3);
  const local = textos[0], dominio = textos[1];
  const b = banda.getBoundingClientRect();
  const fuera = Array.from(banda.querySelectorAll('*')).filter((e) => e.getBoundingClientRect().right > b.right + 0.5).map((e) => e.className || e.tagName);
  return { titulo: t.textContent, lineasTitulo: lineas(t), partidas, correo: c.textContent, lineasCorreo: lineas(c), wbr: !!c.querySelector('wbr'),
    lineasLocal: local ? lineasDe(local, 0, local.length) : null, lineasDominio: dominio ? lineasDe(dominio, 0, dominio.length) : null,
    fuera, scrollX: document.scrollingElement.scrollWidth - innerWidth, fuente: getComputedStyle(c).fontWeight };
})()`;

async function main(): Promise<void> {
  let pw: any;
  try { pw = createRequire(join(process.env.PLAYWRIGHT_DIR ?? "", "package.json"))("playwright"); } catch { throw new NoCorrio("falta PLAYWRIGHT_DIR"); }
  const browser = await pw.webkit.launch();
  const corta = (r: any) => (r.request().method() === "GET" && !/posthog|sentry|vercel\.live|facebook/.test(r.request().url()) ? r.continue() : r.abort());
  try {
    // ── QV ──
    const ctx = await browser.newContext({ ...pw.devices["iPhone 13"] });
    await ctx.route("**/*", corta);
    const page = await ctx.newPage();
    for (const estado of ["listo", "ya"]) {
      const res = await page.goto(`${BASE}/dev/quiero-verlo?estado=${estado}&correo=${encodeURIComponent(CORREO)}`, { waitUntil: "load", timeout: 120_000 }).catch(() => null);
      if (!res || res.status() !== 200) throw new NoCorrio(`/dev/quiero-verlo respondió ${res?.status() ?? "sin respuesta"}`);
      await page.evaluate("document.fonts.ready");
      const m: any = await page.evaluate(MEDIR_QV);
      if (!m) { F(`QV ${estado} · no se dibujó la confirmación en dos partes`); continue; }
      console.log(`QV ${estado} · «${m.titulo}» en ${m.lineasTitulo} línea(s) · «${m.correo}» en ${m.lineasCorreo} (antes del arroba ${m.lineasLocal}, después ${m.lineasDominio}) · fuera de la banda ${m.fuera.length} · scroll lateral ${m.scrollX}`);
      // «Listo: te lo mandamos a» cabe en una línea; «Ya te lo mandamos el 17 de octubre a» puede tomar dos, sin partir palabras.
      if ((estado === "listo" && m.lineasTitulo !== 1) || m.lineasTitulo > 2 || m.partidas > 0) F(`QV ${estado} · el título ocupa ${m.lineasTitulo} líneas o parte ${m.partidas} palabra(s)`);
      if (m.correo !== CORREO || m.lineasCorreo > 2) F(`QV ${estado} · el correo («${m.correo}») ocupa ${m.lineasCorreo} líneas`);
      if (!m.wbr || m.lineasLocal !== 1 || m.lineasDominio !== 1) F(`QV ${estado} · el correo no se corta limpio en el arroba (antes ${m.lineasLocal}, después ${m.lineasDominio}, <wbr> ${m.wbr})`);
      if (m.fuera.length || m.scrollX > 0) F(`QV ${estado} · algo se sale: ${m.fuera.join(", ")} (scroll lateral ${m.scrollX})`);
      if (Number(m.fuente) >= 600) F(`QV ${estado} · el correo va en negrita (${m.fuente}), no en Inter normal`);
    }
    await ctx.close();

    // ── PE ──
    if (!SESION) console.log("PE · sin --sesion: no se mide el perfil (necesita una cuenta de prueba)");
    else {
      const ctx2 = await browser.newContext({ ...pw.devices["iPhone 13"], storageState: SESION });
      await ctx2.route("**/*", corta);
      const p = await ctx2.newPage();
      await p.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 180_000 });
      if (!(await p.$('[data-casa="perfil"]'))) throw new NoCorrio("el dashboard no tiene el perfil (¿la sesión venció?)");
      await p.click('[data-casa="perfil"] .ca-plegada-cab, [data-casa="perfil"] summary');
      await p.click('[data-casa="editar"]');
      await p.waitForSelector('[data-campo="plazo"]', { timeout: 10_000 });
      await p.waitForTimeout(400);
      const m: any = await p.evaluate(`(() => {
        const plazo = document.querySelector('[data-campo="plazo"]'), pie = document.querySelector('[data-campo="pie"]'), sec = document.querySelector('[data-casa="perfil"]');
        const recortan = []; for (let e = plazo.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); const r = e.getBoundingClientRect(), q = plazo.getBoundingClientRect();
          if ((s.overflowY !== 'visible' || s.overflowX !== 'visible') && (q.bottom > r.bottom + 0.5 || q.top < r.top - 0.5)) recortan.push(e.className || e.tagName); }
        const s = sec.getBoundingClientRect(), q = plazo.getBoundingClientRect(), pi = pie.getBoundingClientRect();
        // Cada select cabe en su campo y no pisa lo que sigue: con la clase del correo de /deptos (alto fijo de 48) el select
        // se salía de su caja y caía sobre «Una pregunta pendiente» (25-oct-2026, en master desde el 23-oct).
        const campos = document.querySelector('[data-casa="campos"]'), sigue = campos && campos.nextElementSibling;
        const desbordan = [pie, plazo].filter((x) => { const c = x.closest('label') || x.parentElement, r = c.getBoundingClientRect(), q2 = x.getBoundingClientRect();
          return q2.bottom > r.bottom + 0.5 || q2.right > r.right + 0.5 || q2.left < r.left - 0.5 || (sigue && q2.bottom > sigue.getBoundingClientRect().top + 0.5); }).map((x) => x.dataset.campo);
        return { contiene: q.bottom <= s.bottom + 0.5 && pi.bottom <= s.bottom + 0.5, recortan, esDetails: sec.tagName === 'DETAILS', secScroll: sec.scrollHeight - sec.clientHeight, desbordan };
      })()`);
      await p.evaluate("document.querySelector('[data-campo=\"plazo\"]').scrollIntoView({ block: 'center' })");
      await p.waitForTimeout(300);
      const visible = await p.evaluate("(() => { const r = document.querySelector('[data-campo=\"plazo\"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()");
      console.log(`PE · la sección contiene el pie y el plazo: ${m.contiene} · los recortan: ${m.recortan.join(", ") || "nadie"} · <details>: ${m.esDetails} · se salen de su campo: ${m.desbordan.join(", ") || "ninguno"} · el plazo se ve al bajar: ${visible}`);
      if (!m.contiene || m.recortan.length || m.secScroll > 1) F(`PE · el perfil en edición queda cortado (contiene ${m.contiene}, recortan ${m.recortan.join(", ")}, scroll interno ${m.secScroll})`);
      if (m.desbordan.length) F(`PE · el select de ${m.desbordan.join(" y ")} se sale de su campo o pisa lo que sigue`);
      if (m.esDetails) F("PE · el perfil sigue siendo un <details> (Safari en iOS no recalcula su alto al crecer)");
      if (!visible) F("PE · la página no baja hasta el plazo");
      await ctx2.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main()
  .then(() => { if (fallas.length) { console.log(`\n✗ ${fallas.length} falla(s):\n  ${fallas.join("\n  ")}`); process.exit(1); } console.log("\n✓ la confirmación con un correo largo y el perfil en edición, sin cortes"); })
  .catch((e) => { if (fallas.length) console.log(`\n✗ ${fallas.length} falla(s):\n  ${fallas.join("\n  ")}`); console.log(`\n⚠ NO CORRIÓ: ${e instanceof Error ? e.message : String(e)}`); process.exit(e instanceof NoCorrio ? 2 : 1); });
