// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · las capas en oscuro (23-sep-2026). Corre standalone contra un dev server, con Chrome
// headless (puppeteer-core), y mide lo que el tier estático `capas-oscuro-catch-test` no puede:
//
//   · NINGUNA PIEZA DEL COLOR DE SU CONTENEDOR dentro de una hoja, en oscuro: cada capítulo, la
//     planilla y el pop-up de ajustes, abiertos uno por uno; se compara el fondo de cada pieza con
//     el del ancestro opaco más cercano. Excepción declarada: la columna fija de la planilla, que
//     pinta el fondo de su contenedor A PROPÓSITO (tapa lo que scrollea).
//   · LA ESCALERA EN EL DOM: la hoja grande es más clara que la página; la hoja chica (390) más
//     clara que la grande; el popover (1100) más claro que el panel.
//   · EL CLARO NO CAMBIA: en claro la hoja sigue siendo el papel de la página, sin borde arriba.
//
// Uso:
//   node --import tsx scripts/eval/golden/capas-oscuro-sonda.ts --base http://localhost:3000
// Sale con 1 si alguna medición falla. Filas: LTR 38b9e336 y el demo 6db7a9ac (pop-up LTR), STR
// 143bc85b y 06d44c93 (pop-up STR).
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer, { type Page } from "puppeteer-core";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg("--base") ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGINAS = [
  "/analisis/38b9e336-a568-4871-bad7-114c196358bb",
  "/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1",
  "/analisis/renta-corta/143bc85b-62b8-4069-9f7d-3036c3e70c29",
  "/analisis/renta-corta/06d44c93-d5b5-4df6-89b9-6213de571054",
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fallas: string[] = [];
const F = (m: string) => { fallas.push(m); console.log("  ✗ " + m); };

type Medida = { hoja: string; fondo: string; borde: string; choques: string[] };

/** Abre cada hoja de la página (capítulos, planilla, pop-up) y mide fondo, borde y choques. */
const medirHojas = (t: Page): Promise<Medida[]> =>
  t.evaluate(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const opaco = (c: string) => !!c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/\/ 0?\.\d+\)|, 0?\.\d+\)$/.test(c);
    const fondoDe = (e: Element) => { for (let p = e.parentElement; p; p = p.parentElement) { const c = getComputedStyle(p).backgroundColor; if (opaco(c)) return c; } return null; };
    const medir = (m: HTMLElement) => {
      const piezas = [...m.querySelectorAll<HTMLElement>(".v-modal-cuerpo *")].filter((e) => opaco(getComputedStyle(e).backgroundColor) && e.offsetHeight > 14 && e.offsetWidth > 40);
      // La columna fija de la planilla pinta el fondo de su contenedor a propósito: tapa lo que scrollea.
      const choques = piezas.filter((e) => getComputedStyle(e).backgroundColor === fondoDe(e) && !(e.closest(".pl") && getComputedStyle(e).position === "sticky"));
      return { hoja: m.querySelector("h3")?.textContent ?? "?", fondo: getComputedStyle(m).backgroundColor, borde: getComputedStyle(m).borderTopColor + " " + getComputedStyle(m).borderTopWidth, choques: [...new Set(choques.map((e) => e.className.toString().split(" ")[0] || e.tagName))] };
    };
    const out: Array<{ hoja: string; fondo: string; borde: string; choques: string[] }> = [];
    const cerrar = async () => { (document.querySelector(".v-modal .v-modal-x") as HTMLElement | null)?.click(); await sleep(350); };
    for (const b of [...document.querySelectorAll<HTMLButtonElement>("button.hall-head")].filter((x) => !x.disabled)) {
      b.click(); await sleep(550);
      const m = document.querySelector<HTMLElement>(".v-modal"); if (m) { out.push(medir(m)); await cerrar(); }
    }
    for (const rx of [/Ver cómo se calcula/, /Ver ajustes/]) {
      const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find((x) => rx.test(x.innerText));
      if (!b) continue;
      b.click(); await sleep(850);
      const m = document.querySelector<HTMLElement>(".v-modal"); if (m) { out.push(medir(m)); await cerrar(); }
    }
    return out;
  });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const t = await b.newPage();
  // tsx/esbuild envuelve las funciones con nombre en `__name(...)`: dentro de `evaluate` no existe.
  await t.evaluateOnNewDocument("window.__name = (f) => f;");
  let hojas = 0;
  for (const [ancho, alto] of [[390, 844], [1100, 900]] as const) {
    await t.setViewport({ width: ancho, height: alto, isMobile: ancho < 768, hasTouch: ancho < 768 });
    for (const ruta of PAGINAS) {
      for (const tema of ["dark", "light"] as const) {
        await t.goto(BASE + ruta, { waitUntil: "networkidle2", timeout: 120000 });
        await sleep(1500);
        const papel = await t.evaluate((tm) => {
          document.documentElement.dataset.theme = tm;
          const d = document.querySelector(".doc-dictamen");
          return d ? getComputedStyle(d).getPropertyValue("--page").trim() : "";
        }, tema);
        await sleep(300);
        const medidas = await medirHojas(t);
        hojas += medidas.length;
        if (!medidas.length) F(`${ancho} ${tema} ${ruta}: no se abrió ninguna hoja`);
        for (const m of medidas) {
          const lugar = `${ancho} ${tema} ${ruta.split("/").pop()!.slice(0, 8)} «${m.hoja}»`;
          if (tema === "dark") {
            if (m.choques.length) F(`${lugar}: piezas del color de su contenedor: ${m.choques.join(", ")}`);
            if (m.fondo !== "rgb(26, 26, 30)") F(`${lugar}: la hoja pinta ${m.fondo}, no --card (#1A1A1E)`);
            if (!/^rgb\(55, 55, 61\) 1px/.test(m.borde)) F(`${lugar}: sin el borde fino arriba (${m.borde})`);
          } else {
            const hex = papel.toLowerCase();
            const esperado = hex === "#ffffff" ? "rgb(255, 255, 255)" : "";
            if (esperado && m.fondo !== esperado) F(`${lugar}: en claro la hoja cambió de fondo (${m.fondo})`);
          }
        }
        // La escalera, en el DOM: hoja chica (390) sobre el capítulo I; popover (1100) sobre el panel de la planilla.
        if (tema === "dark" && ruta.includes("143bc85b") && ancho === 390) {
          const r = await t.evaluate(async () => {
            const sleep = (ms: number) => new Promise((x) => setTimeout(x, ms));
            [...document.querySelectorAll<HTMLButtonElement>("button.hall-head")].find((x) => /^Cuánto renta/.test(x.innerText.trim()))?.click(); await sleep(600);
            (document.querySelector(".v-modal-sub .v-i") as HTMLElement | null)?.click(); await sleep(600);
            const g = document.querySelector(".v-glosa"); const h = document.querySelector(".v-modal:not(.v-glosa)");
            return { glosa: g ? getComputedStyle(g).backgroundColor : "", hoja: h ? getComputedStyle(h).backgroundColor : "" };
          });
          if (r.glosa !== "rgb(35, 35, 40)" || r.hoja !== "rgb(26, 26, 30)") F(`390 dark: la hoja chica (${r.glosa}) no queda un escalón sobre la grande (${r.hoja})`);
        }
        if (tema === "dark" && ruta.includes("38b9e336") && ancho === 1100) {
          const r = await t.evaluate(async () => {
            const sleep = (ms: number) => new Promise((x) => setTimeout(x, ms));
            [...document.querySelectorAll<HTMLButtonElement>("button")].find((x) => /Ver cómo se calcula/.test(x.innerText))?.click(); await sleep(800);
            [...document.querySelectorAll(".v-modal .pl.ind th")].find((x) => /Cash on cash/.test((x as HTMLElement).innerText))?.querySelector<HTMLElement>(".v-i")?.click(); await sleep(500);
            const p = document.querySelector(".v-pop"); const h = document.querySelector(".v-modal");
            return { pop: p ? getComputedStyle(p).backgroundColor : "", panel: h ? getComputedStyle(h).backgroundColor : "" };
          });
          if (r.pop !== "rgb(44, 44, 48)" || r.panel !== "rgb(26, 26, 30)") F(`1100 dark: el popover (${r.pop}) no queda un escalón sobre el panel (${r.panel})`);
        }
      }
    }
  }
  await b.close();
  console.log(fallas.length ? `\n✗ CAPAS-OSCURO (sonda) · ${fallas.length} falla(s) en ${hojas} hojas medidas` : `\n✓ CAPAS-OSCURO (sonda) · ${hojas} hojas medidas en 390 y 1100, oscuro y claro: ninguna pieza del color de su contenedor, la escalera sube y el claro no cambia`);
  process.exit(fallas.length ? 1 : 0);
})();
