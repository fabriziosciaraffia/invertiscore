/* eslint-disable @typescript-eslint/no-explicit-any */
// SONDA VIVA · sin ocre ni verde en el informe (23-sep-2026). El censo que sacó el semáforo, hecho
// gate: sale con 1 si algo visible se pinta ocre o verde, salvo la leyenda del mapa
// ([data-mapa-leyenda], familia propia que espera decisión). Standalone contra un dev server, con
// Chrome headless (puppeteer-core). Complementa el tier estático `sin-semaforo-catch-test`.
// Abre cada superficie (página, capítulos, planilla, pop-up, comparables, ficha) en
// 390, en oscuro y en claro, y escanea color / fondo / borde / fill / stroke / degradados de cada
// elemento visible. Clasifica por tono y dice la familia comparando con los valores exactos:
//   semáforo  --doc-good #2E8B57 (claro) / #57B98A (oscuro) · --doc-warn #B7791F / #DFA34F
//   tríada    --verdict #C8323C / #6E4560 / #2B558F (no tiene ocre ni verde)
// Uso: node --import tsx scripts/eval/golden/sin-ocre-verde-sonda.ts --base http://localhost:3000 [--fotos DIR]
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg("--base") ?? "http://localhost:3000";
const FOTOS = arg("--fotos");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGINAS: Record<string, string> = {
  "LTR·BUSCAR 38b9e336": "/analisis/38b9e336-a568-4871-bad7-114c196358bb",
  "LTR·demo 6db7a9ac": "/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1",
  "LTR·COMPRAR 637c35fb": "/analisis/637c35fb-b838-4506-b895-1349821277b6",
  "LTR·AJUSTA 4ceafe4c": "/analisis/4ceafe4c-3c16-46c9-9b0f-7c23da27f7ef",
  "STR·BUSCAR 143bc85b": "/analisis/renta-corta/143bc85b-62b8-4069-9f7d-3036c3e70c29",
  "STR·AJUSTA 06d44c93": "/analisis/renta-corta/06d44c93-d5b5-4df6-89b9-6213de571054",
  "STR·COMPRAR 56f90bb9": "/analisis/renta-corta/56f90bb9-86a7-4710-a043-c887ac746664",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Corre en la página: marca y devuelve los hallazgos de color de una raíz (documento o modal).
const ESCANER = `
window.__escanear = (raiz, superficie) => {
  const SEM = { good: [[46,139,87],[87,185,138]], warn: [[183,121,31],[223,163,79]] };
  const colores = (s) => {
    const out = [];
    for (const m of String(s).matchAll(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/g)) out.push([+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]);
    for (const m of String(s).matchAll(/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)/g)) out.push([+m[1]*255, +m[2]*255, +m[3]*255, m[4] === undefined ? 1 : +m[4]]);
    return out;
  };
  const hsl = ([r,g,b]) => { r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2; if (mx===mn) return [0,0,l]; const d=mx-mn; const s=l>0.5?d/(2-mx-mn):d/(mx+mn); let h; if (mx===r) h=((g-b)/d+(g<b?6:0)); else if (mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; return [h*60,s,l]; };
  const cerca = (c, t) => Math.abs(c[0]-t[0]) + Math.abs(c[1]-t[1]) + Math.abs(c[2]-t[2]) < 12;
  const familia = (c) => SEM.good.some((t) => cerca(c, t)) ? "semáforo · --doc-good" : SEM.warn.some((t) => cerca(c, t)) ? "semáforo · --doc-warn" : "literal fuera de los tokens";
  const tono = (c) => { const [h, s, l] = hsl(c); if (c[3] < 0.04 || l < 0.08 || l > 0.95) return null; if (h >= 20 && h <= 60 && s >= 0.3) return "ocre"; if (h >= 75 && h <= 170 && s >= 0.2) return "verde"; return null; };
  const hallazgos = [];
  const todos = [...raiz.querySelectorAll("*")];
  for (const e of todos) {
    if (!(raiz === document) && !raiz.contains(e)) continue;
    if (raiz === document && e.closest(".v-modal-overlay")) continue;
    if (e.closest("[data-mapa-leyenda]")) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const props = { color: e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ? cs.color : "", fondo: cs.backgroundColor, degradado: cs.backgroundImage !== "none" ? cs.backgroundImage : "", borde: cs.borderTopWidth !== "0px" && cs.borderTopStyle !== "none" ? cs.borderTopColor : "", fill: e instanceof SVGElement ? cs.fill : "", stroke: e instanceof SVGElement && cs.stroke !== "none" ? cs.stroke : "" };
    for (const [prop, val] of Object.entries(props)) {
      if (!val) continue;
      for (const c of colores(val)) {
        const t = tono(c); if (!t) continue;
        const id = "c" + Math.random().toString(36).slice(2, 9);
        e.setAttribute("data-censo", id);
        const clase = (e.getAttribute("class") || e.tagName.toLowerCase()).toString().split(" ").slice(0, 2).join(".");
        hallazgos.push({ superficie, tono: t, familia: familia(c), prop, clase, rgb: c.map((x, i) => i < 3 ? Math.round(x) : +x.toFixed(2)).join(","), texto: (e.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60), id });
        break;
      }
    }
  }
  return hallazgos;
};`;

(async () => {
  if (FOTOS) mkdirSync(FOTOS, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const t = await b.newPage();
  await t.evaluateOnNewDocument("window.__name = (f) => f;");
  await t.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const todo: any[] = [];
  const fotos = new Set<string>();
  for (const [nombre, ruta] of Object.entries(PAGINAS)) {
    for (const tema of ["dark", "light"]) {
      await t.goto(BASE + ruta, { waitUntil: "networkidle2", timeout: 120000 });
      await sleep(1800);
      const veredicto = await t.evaluate((tm: string, esc: string) => { document.documentElement.dataset.theme = tm; (0, eval)(esc); return document.querySelector("[data-verdict]")?.getAttribute("data-verdict") ?? "?"; }, tema, ESCANER);
      await sleep(300);
      const foto = async (h: any) => {
        const clave = `${h.superficie}|${h.clase}|${h.prop}|${h.familia}|${tema}|${nombre.split("·")[0]}`;
        if (!FOTOS || fotos.has(clave)) return;
        fotos.add(clave);
        const el = await t.$(`[data-censo="${h.id}"]`); if (!el) return;
        await el.evaluate((x: Element) => x.scrollIntoView({ block: "center" })); await sleep(200);
        const bb = await el.boundingBox(); if (!bb) return;
        const pad = 36, W = 390, H = 844;
        const x = Math.max(0, bb.x - pad), y = Math.max(0, bb.y - pad);
        const clip = { x, y, width: Math.min(W - x, bb.width + pad * 2), height: Math.min(H - y, Math.max(bb.height + pad * 2, 60)) };
        const archivo = `${String(fotos.size).padStart(3, "0")}-${tema}-${nombre.split(" ")[0].replace("·", "-")}-${h.clase.replace(/[^a-z0-9.-]/gi, "")}.png`;
        await t.screenshot({ path: join(FOTOS, archivo), clip });
        h.foto = archivo;
      };
      const registrar = async (hs: any[]) => { for (const h of hs) { h.pagina = nombre; h.tema = tema; h.veredicto = veredicto; await foto(h); todo.push(h); } };
      // 1 · la página, sin hojas abiertas
      await registrar(await t.evaluate(() => (window as any).__escanear(document, "página")));
      // 2 · cada capítulo, la planilla, el pop-up, los comparables y la ficha
      const botones: string[] = await t.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.innerText.trim()).filter((x) => /^(Ver cómo se calcula|▶\nVer ajustes|Ver ajustes|Ver los comparables|🏢 FICHA)/.test(x) ));
      const caps: string[] = await t.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button.hall-head")].filter((x) => !x.disabled).map((x) => x.innerText.split("\n")[0].trim()));
      for (const cap of [...caps.map((c) => ["cap", c]), ...botones.map((c) => ["btn", c])]) {
        const abierto = await t.evaluate(async (tipo: string, txt: string) => {
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
          const btn = tipo === "cap" ? [...document.querySelectorAll<HTMLButtonElement>("button.hall-head")].find((x) => x.innerText.split("\n")[0].trim() === txt) : [...document.querySelectorAll<HTMLButtonElement>("button")].find((x) => x.innerText.trim() === txt);
          btn?.click(); await sleep(900);
          return !!document.querySelector(".v-modal, [role=dialog]");
        }, cap[0], cap[1]);
        if (!abierto) continue;
        const sup = cap[0] === "cap" ? `capítulo «${cap[1]}»` : cap[1].replace(/[▶\n🏢]/g, "").trim();
        await registrar(await t.evaluate((s: string) => { const m = document.querySelector(".v-modal") ?? document.querySelector("[role=dialog]"); return (window as any).__escanear(m, s); }, sup));
        await t.evaluate(async () => { (document.querySelector(".v-modal .v-modal-x, [role=dialog] [aria-label=Cerrar], [role=dialog] button") as HTMLElement | null)?.click(); await new Promise((r) => setTimeout(r, 400)); });
        await t.keyboard.press("Escape"); await sleep(300);
      }
    }
  }
  await b.close();
  if (FOTOS) writeFileSync(join(FOTOS, "censo.json"), JSON.stringify(todo, null, 1));
  // resumen por grupo
  const g = new Map<string, any>();
  for (const h of todo) { const k = `${h.tono} | ${h.familia} | ${h.superficie.replace(/«.*»/, (m: string) => m)} | .${h.clase} | ${h.prop}`; const x = g.get(k) ?? { n: 0, temas: new Set(), modos: new Set(), ej: h }; x.n++; x.temas.add(h.tema); x.modos.add(h.pagina.split("·")[0]); g.set(k, x); }
  for (const [k, x] of [...g.entries()].sort()) console.log(`${k} · ${[...x.modos].join("+")} · ${[...x.temas].join("+")} · n=${x.n} · «${x.ej.texto}» · ${x.ej.rgb} · ${x.ej.foto ?? ""}`);
  console.log(todo.length ? `\n✗ SIN-OCRE-VERDE (sonda) · ${todo.length} elemento(s) ocre o verde` : "\n✓ SIN-OCRE-VERDE (sonda) · nada visible en ocre ni verde en 7 filas, las dos modalidades, 390, oscuro y claro, con cada hoja abierta (salvo la leyenda del mapa, declarada)");
  process.exit(todo.length ? 1 : 0);
})();
