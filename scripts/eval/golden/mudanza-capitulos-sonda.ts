// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · la mudanza de los capítulos al pop-up (23-sep-2026). Corre standalone contra un
// dev server, con Chrome headless (puppeteer-core), y mide lo que el tier estático no puede:
//
//   · useAncho LEE EL ANCHO DEL CUERPO DE LA HOJA, no el de referencia: para cada SVG de los
//     gráficos que lo usan (`.pb-svg`, `.sp-svg`, `.cf-svg`) dentro del pop-up abierto, el atributo
//     `width` es el ancho medido de su contenedor (±1 px) y no 600.
//   · CADA CAPÍTULO ABRE EN EL POP-UP: las once filas, tocadas una por una (tap en 390 esperando el
//     scroll, click en 1100), montan `.v-modal` con el título de la fila, y en 390 el cuerpo scrollea.
//   · MEDIR DISPARA: tras abrir, `window.__informeEvents` tiene `informe_capitulo_abierto` con el
//     `id_capitulo` de la fila (solo fuera de producción).
//   · EL HASH ABRE: cargar la página con `#<anchorId>` deja el pop-up de esa fila abierto.
//
// Uso:
//   node --import tsx scripts/eval/golden/mudanza-capitulos-sonda.ts --base http://localhost:3007 [--fotos DIR] [--solo-hash]
// Sale con 1 si alguna medición falla. Las filas son las de QA del arco (LTR 8395ea55 y STR 11a6dc52).
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer, { type Page } from "puppeteer-core";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg("--base") ?? "http://localhost:3007";
const FOTOS = arg("--fotos");
const SOLO_HASH = process.argv.includes("--solo-hash");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGINAS = { ltr: "/analisis/8395ea55-0272-4dbd-bbb0-49be84888a00", str: "/analisis/renta-corta/11a6dc52-e437-4353-8f68-63e79ec03d5a" } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fallas: string[] = [];
const F = (m: string) => { fallas.push(m); console.log("  ✗ " + m); };

type Fila = { anchorId: string; titulo: string; tieneCuerpo: boolean };
const leerFilas = (t: Page): Promise<Fila[]> =>
  t.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".hall.cap")].map((h) => ({
      anchorId: h.id,
      titulo: (h.querySelector(".q") as HTMLElement)?.childNodes[0]?.textContent?.trim() ?? "",
      tieneCuerpo: !(h.querySelector(".hall-head") as HTMLButtonElement)?.disabled,
    })),
  );

const estadoModal = (t: Page) =>
  t.evaluate(() => {
    const m = document.querySelector(".v-modal");
    if (!m) return null;
    const cuerpo = document.querySelector(".v-modal-cuerpo") as HTMLElement | null;
    const svgs = [...m.querySelectorAll<SVGSVGElement>("svg.pb-svg, svg.sp-svg, svg.cf-svg")].map((s) => {
      const cont = s.parentElement as HTMLElement;
      return { clase: s.getAttribute("class") ?? "", width: Number(s.getAttribute("width")), contenedor: Math.round(cont.getBoundingClientRect().width) };
    });
    const w = window as unknown as { __informeEvents?: Array<{ name: string; props: Record<string, unknown> }> };
    return {
      titulo: (m.querySelector(".v-modal-head h3") as HTMLElement)?.innerText ?? "",
      rect: (() => { const r = m.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      cuerpoScroll: cuerpo ? { max: cuerpo.scrollHeight - cuerpo.clientHeight, overscroll: getComputedStyle(cuerpo).overscrollBehaviorY } : null,
      svgs,
      eventos: (w.__informeEvents ?? []).filter((e) => e.name === "informe_capitulo_abierto").map((e) => String(e.props.id_capitulo)),
    };
  });

async function abrirFila(t: Page, anchorId: string, touch: boolean): Promise<boolean> {
  const btn = await t.$(`#${anchorId} .hall-head`);
  if (!btn) return false;
  await btn.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(1600); // html{scroll-behavior:smooth}: el tap antes de que termine cae al lado
  const bb = await btn.boundingBox();
  if (!bb) return false;
  if (touch) await t.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  else await t.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await sleep(700);
  return !!(await t.$(".v-modal"));
}

async function cerrar(t: Page) {
  const x = await t.$(".v-modal-x");
  if (x) await x.click();
  await sleep(500);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  let n = 0;
  for (const tema of ["light", "dark"] as const) for (const [pag, ruta] of Object.entries(PAGINAS)) for (const ancho of [390, 1100]) {
    const t = await b.newPage();
    const errs: string[] = [];
    t.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await t.evaluateOnNewDocument((tm: string) => { try { localStorage.setItem("franco-theme", tm); } catch { /* sin storage */ } }, tema);
    const touch = ancho === 390;
    await t.setViewport({ width: ancho, height: touch ? 844 : 900, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
    await t.goto(BASE + ruta, { waitUntil: "networkidle2", timeout: 180000 });
    await sleep(600);
    const filas = await leerFilas(t);
    const esperadas = pag === "ltr" ? 5 : 6;
    if (filas.length !== esperadas) F(`${tema} ${pag} ${ancho} · ${filas.length} filas de capítulo, se esperaban ${esperadas}`);
    for (const f of SOLO_HASH ? [] : filas) {
      const k = `${tema} ${pag} ${ancho} #${f.anchorId} «${f.titulo}»`;
      if (!f.tieneCuerpo) { console.log(`  · ${k} sin cuerpo (fila deshabilitada)`); continue; }
      if (!(await abrirFila(t, f.anchorId, touch))) { F(`${k} · no abrió el pop-up`); continue; }
      const e = await estadoModal(t);
      if (!e) { F(`${k} · sin estado`); continue; }
      n++;
      if (e.titulo.trim() !== f.titulo) F(`${k} · el pop-up titula «${e.titulo}»`);
      if (touch) {
        if (e.rect.y !== 56 || e.rect.w !== ancho) F(`${k} · la hoja no está en y=56 a todo el ancho: ${JSON.stringify(e.rect)}`);
        if (!e.cuerpoScroll || e.cuerpoScroll.overscroll !== "contain") F(`${k} · el cuerpo no contiene el overscroll`);
        if (e.cuerpoScroll && e.cuerpoScroll.max <= 0) console.log(`  · ${k} entra sin scroll (${e.rect.h} px)`);
      } else if (e.rect.w !== 720) F(`${k} · el panel no mide 720: ${JSON.stringify(e.rect)}`);
      for (const s of e.svgs) {
        if (Math.abs(s.width - s.contenedor) > 1) F(`${k} · ${s.clase} width=${s.width} contra contenedor ${s.contenedor}`);
        if (s.width === 600 && s.contenedor !== 600) F(`${k} · ${s.clase} quedó en el ancho de referencia (600)`);
      }
      const idCap = f.anchorId.replace(/^cap-(str-)?/, "");
      if (!e.eventos.includes(idCap)) F(`${k} · sin informe_capitulo_abierto para «${idCap}» (hay: ${e.eventos.join(",") || "ninguno"})`);
      if (FOTOS) {
        await t.screenshot({ path: join(FOTOS, `cap-${tema}-${pag}-${ancho}-${f.anchorId}.png`) });
        if (touch) {
          await t.evaluate(() => { const c = document.querySelector(".v-modal-cuerpo"); if (c) c.scrollTop = c.scrollHeight; });
          await sleep(250);
          await t.screenshot({ path: join(FOTOS, `cap-${tema}-${pag}-${ancho}-${f.anchorId}-fondo.png`) });
        }
      }
      await cerrar(t);
      if (await t.$(".v-modal")) F(`${k} · no cerró con la ✕`);
    }
    // el hash abre: la segunda fila con cuerpo
    const conCuerpo = filas.filter((f) => f.tieneCuerpo);
    const objetivo = conCuerpo[1] ?? conCuerpo[0];
    if (objetivo) {
      // Carga FRESCA con el hash: un goto a la misma URL cambiando solo el hash no remonta la página.
      await t.goto("about:blank");
      await t.goto(`${BASE}${ruta}#${objetivo.anchorId}`, { waitUntil: "networkidle2", timeout: 180000 });
      await sleep(900);
      const e = await estadoModal(t);
      if (!e) F(`${tema} ${pag} ${ancho} · #${objetivo.anchorId} en la URL no abrió el pop-up`);
      else if (e.titulo.trim() !== objetivo.titulo) F(`${tema} ${pag} ${ancho} · el hash abrió «${e.titulo}» y no «${objetivo.titulo}»`);
      else if (!e.eventos.includes(objetivo.anchorId.replace(/^cap-(str-)?/, ""))) F(`${tema} ${pag} ${ancho} · el hash abrió sin medir`);
    }
    if (errs.length) F(`${tema} ${pag} ${ancho} · errores de página: ${errs.join(" | ")}`);
    await t.close();
  }
  await b.close();
  console.log(fallas.length ? `\n  ✗ SONDA MUDANZA · ${fallas.length} falla(s) sobre ${n} aperturas` : `\n  ✓ SONDA MUDANZA · ${n} aperturas: los once en el pop-up, SVG al ancho del cuerpo, medir y hash`);
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
