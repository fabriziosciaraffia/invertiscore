// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · «Cómo se calcula» (23-sep-2026). Corre standalone contra un dev server, con Chrome
// headless (puppeteer-core), sobre las tres filas del mockup aprobado
// (docs/wireframes/rediseno-informe/planilla-como-se-calcula.html), en 390, 350 y 1100, claro y
// oscuro, CLP y UF. Mide lo que el tier estático `planilla-calculo-catch-test` no puede:
//
//   · CINCO COLUMNAS QUE ENTRAN: ninguna celda de la tabla ni ningún indicador desborda, y el
//     cuerpo de la hoja no scrollea de lado.
//   · LOS MONTOS SEGÚN LA FORMA: en teléfono, millones (o UF sin decimales) con el redondeo
//     avisado; en escritorio, pesos exactos y sin aviso. En UF ninguna celda ni cuenta lleva «$».
//   · LA CUENTA DA EL RESULTADO: el cash on cash, rehecho con los dos montos de su cuenta.
//   · LA VENTA NO ESTÁ: ni «Escenario de salida» ni «Tu parte»; sí la fila que remite, y su
//     enlace cierra la planilla y abre «Tu resultado».
//   · LOS TEXTOS DEL DATO: la vacancia de 1,2 meses (38b9e336), la entrega de agosto de 2027 con
//     el año 1 operando un mes (9102b7e6), el administrador al 25% (143bc85b), y el pie STR con la
//     misma referencia de la zona que dice el hero.
//
// Uso:
//   node --import tsx scripts/eval/golden/planilla-calculo-sonda.ts --base http://localhost:3000
// Sale con 1 si alguna medición falla.
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer, { type Page } from "puppeteer-core";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg("--base") ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FILAS = [
  { ruta: "/analisis/38b9e336-a568-4871-bad7-114c196358bb", str: false, texto: /vacancia de 1,2 meses al año/ },
  { ruta: "/analisis/renta-corta/9102b7e6-3bae-4174-971f-afb8bd99547c", str: true, texto: /se entrega en agosto de 2027: el año 1 opera 1 mes/ },
  { ruta: "/analisis/renta-corta/143bc85b-62b8-4069-9f7d-3036c3e70c29", str: true, texto: /administrador 25% del ingreso, en vez de la comisión de plataforma/ },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fallas: string[] = [];
const F = (m: string) => { fallas.push(m); console.log("  ✗ " + m); };
const num = (s: string) => Number(s.replace(/[^\d,−-]/g, "").replace(/\./g, "").replace(",", ".").replace("−", "-"));

async function ir(t: Page, url: string) {
  for (let i = 0; i < 3; i++) {
    try { await t.goto(url, { waitUntil: "networkidle2", timeout: 120000 }); return; } catch (e) { if (i === 2) throw e; await sleep(3000); }
  }
}

type Lectura = {
  bloques: number; columnas: number; celdasMal: number; indMal: number; cuerpoLado: boolean;
  unidad: string; nota: string; celdas: string[]; cuentas: string[]; cocCuenta: string; cocRes: string;
  texto: string; pie: string; filaEntrega: string; ref: string;
};

const leer = (t: Page): Promise<Lectura | null> =>
  t.evaluate(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const refHero = (document.body.innerText.match(/La referencia de la zona es (\d+,\d)%/) ?? [])[1] ?? "";
    const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find((x) => /Ver cómo se calcula/.test(x.innerText));
    if (!b) return null;
    b.click(); await sleep(900);
    const m = document.querySelector<HTMLElement>(".v-modal");
    if (!m) return null;
    const cuerpo = m.querySelector<HTMLElement>(".v-modal-cuerpo") ?? m;
    const tabla = m.querySelector("table.pc-flujo");
    const celdas = [...m.querySelectorAll<HTMLElement>(".pc-flujo td, .pc-flujo th")];
    const inds = [...m.querySelectorAll<HTMLElement>(".pc-ind")];
    const coc = inds.find((i) => /Cash on cash/.test(i.querySelector(".pc-ind-n")?.textContent ?? ""));
    return {
      bloques: m.querySelectorAll(".m-block").length,
      columnas: tabla ? tabla.querySelectorAll("thead th").length : 0,
      celdasMal: celdas.filter((c) => c.scrollWidth > c.clientWidth + 1).length,
      indMal: inds.filter((i) => i.scrollWidth > i.clientWidth + 1).length,
      cuerpoLado: cuerpo.scrollWidth > cuerpo.clientWidth + 1,
      unidad: m.querySelector(".pc-u")?.textContent ?? "",
      nota: m.querySelector(".pc-nota")?.textContent ?? "",
      celdas: [...m.querySelectorAll<HTMLElement>(".pc-flujo tbody td:not(:first-child)")].map((c) => c.textContent ?? ""),
      cuentas: [...m.querySelectorAll<HTMLElement>(".pc-ind-c, .pc-ind-r, .pc-remite .v")].map((c) => c.textContent ?? ""),
      cocCuenta: coc?.querySelector(".pc-ind-c")?.textContent ?? "",
      cocRes: coc?.querySelector(".pc-ind-r")?.textContent ?? "",
      texto: m.innerText,
      pie: m.querySelector(".v-modal-pie, .v-pie")?.textContent ?? m.innerText.split("\n").filter((l) => /Motor Franco/.test(l)).pop() ?? "",
      filaEntrega: m.querySelector(".pc-flujo tr.ent td:first-child")?.textContent ?? "",
      ref: refHero,
    };
  });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const t = await b.newPage();
  await t.evaluateOnNewDocument("window.__name = (f) => f;");
  let n = 0;
  for (const ancho of [390, 350, 1100]) {
    const tel = ancho < 768;
    await t.setViewport({ width: ancho, height: tel ? 844 : 900, isMobile: tel, hasTouch: tel });
    for (const f of FILAS) {
      for (const tema of ["light", "dark"] as const) {
        for (const moneda of ["CLP", "UF"] as const) {
          await ir(t, BASE + f.ruta);
          await sleep(1200);
          await t.evaluate((tm, mo) => {
            document.documentElement.dataset.theme = tm;
            [...document.querySelectorAll<HTMLButtonElement>(".doc-cur-toggle button")].find((x) => x.textContent?.trim() === mo)?.click();
          }, tema, moneda);
          await sleep(500);
          const r = await leer(t);
          const lugar = `${ancho} ${tema} ${moneda} ${f.ruta.split("/").pop()!.slice(0, 8)}`;
          n++;
          if (!r) { F(`${lugar}: no se abrió la planilla`); continue; }
          if (process.argv.includes("--ver") && tema === "light") console.log(lugar, JSON.stringify({ unidad: r.unidad, nota: r.nota.slice(0, 30), celdas: r.celdas.slice(0, 5), coc: r.cocCuenta + " " + r.cocRes, ent: r.filaEntrega, ref: r.ref }));
          if (r.bloques !== 2) F(`${lugar}: ${r.bloques} bloques, no 2`);
          if (r.columnas !== 5) F(`${lugar}: la tabla tiene ${r.columnas} columnas, no 5`);
          if (r.celdasMal) F(`${lugar}: ${r.celdasMal} celdas desbordan`);
          if (r.indMal) F(`${lugar}: ${r.indMal} indicadores desbordan`);
          if (r.cuerpoLado) F(`${lugar}: el cuerpo scrollea de lado`);
          // la forma de los montos
          if (tel) {
            if (moneda === "CLP" ? !/^Millones de pesos/.test(r.unidad) : !/^UF de cada año, sin decimales/.test(r.unidad)) F(`${lugar}: la unidad dice «${r.unidad}»`);
            if (!/una fila puede no sumar por una décima/.test(r.nota)) F(`${lugar}: falta el aviso del redondeo`);
            if (moneda === "CLP" && r.celdas.some((c) => !/^−?\d{1,3},\d$/.test(c))) F(`${lugar}: celdas que no son millones con un decimal: ${r.celdas.filter((c) => !/^−?\d{1,3},\d$/.test(c)).slice(0, 3).join(" | ")}`);
          } else {
            if (moneda === "CLP" ? r.unidad !== "Pesos de cada año" : r.unidad !== "UF de cada año") F(`${lugar}: la unidad dice «${r.unidad}»`);
            if (r.nota) F(`${lugar}: en escritorio aparece el aviso del redondeo`);
            if (moneda === "CLP" && r.celdas.some((c) => !/^−?\d{1,3}(\.\d{3})+$|^−?\d{1,3}$/.test(c))) F(`${lugar}: celdas que no son pesos exactos: ${r.celdas.slice(0, 3).join(" | ")}`);
          }
          if (moneda === "UF" && [...r.celdas, ...r.cuentas].some((c) => c.includes("$"))) F(`${lugar}: en UF quedan montos con «$»`);
          if (moneda === "CLP" && !r.cuentas.some((c) => c.includes("$"))) F(`${lugar}: en CLP no hay montos con «$»`);
          // la cuenta del cash on cash da el resultado (en pesos exactos: escritorio y CLP)
          if (!tel && moneda === "CLP") {
            const [a, d] = r.cocCuenta.split("÷").map(num);
            const res = num(r.cocRes);
            if (!(Math.abs((a / d) * 100 - res) < 0.006)) F(`${lugar}: el cash on cash no da: ${r.cocCuenta} ${r.cocRes}`);
          }
          // la venta no está; la fila que remite sí
          if (/Escenario de salida|Tu parte/.test(r.texto)) F(`${lugar}: la venta sigue en la planilla`);
          if (!/Si vendes el año 10, te queda/.test(r.texto)) F(`${lugar}: falta la fila que remite a «Tu resultado»`);
          if (/escenario de salida/i.test(r.texto)) F(`${lugar}: el sub nombra el escenario de salida`);
          // textos del dato
          if (!f.texto.test(r.texto)) F(`${lugar}: falta «${f.texto.source}»`);
          if (/0,6 mes/.test(r.texto)) F(`${lugar}: la vacancia fija «0,6 mes» sigue`);
          if (f.ruta.includes("9102b7e6") && !/entrega · 1 mes/.test(r.filaEntrega)) F(`${lugar}: la fila de entrega dice «${r.filaEntrega}»`);
          if (f.ruta.includes("9102b7e6") && /Entrega inmediata/.test(r.texto)) F(`${lugar}: dice «Entrega inmediata» con entrega futura`);
          if (f.str) {
            if (/umbral de renta corta/.test(r.texto)) F(`${lugar}: el pie cita el umbral fijo`);
            if (!r.ref) F(`${lugar}: no se leyó la referencia de la zona en el hero (la medición no corrió)`);
            else if (!r.texto.includes(`referencia de la zona ${r.ref}%`)) F(`${lugar}: el pie no dice la referencia del hero (${r.ref}%)`);
          }
        }
      }
    }
  }
  // el enlace de la fila que remite: cierra la planilla y abre «Tu resultado» (una vez por modalidad y forma)
  for (const ancho of [390, 1100]) {
    const tel = ancho < 768;
    await t.setViewport({ width: ancho, height: tel ? 844 : 900, isMobile: tel, hasTouch: tel });
    for (const f of [FILAS[0], FILAS[2]]) {
      await ir(t, BASE + f.ruta);
      await sleep(1200);
      const h = await t.evaluate(async () => {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        [...document.querySelectorAll<HTMLButtonElement>("button")].find((x) => /Ver cómo se calcula/.test(x.innerText))?.click(); await sleep(900);
        document.querySelector<HTMLButtonElement>(".v-modal .pc-remite .lnk")?.click(); await sleep(1200);
        return [...document.querySelectorAll(".v-modal")].map((x) => x.querySelector("h3")?.textContent ?? "").join(" | ");
      });
      if (!/Tu resultado a 10 años/.test(h) || /Cómo se calcula/.test(h)) F(`${ancho} ${f.ruta.split("/").pop()!.slice(0, 8)}: el enlace dejó abierto «${h}»`);
    }
  }
  await b.close();
  console.log(fallas.length ? `\n✗ PLANILLA-CALCULO (sonda) · ${fallas.length} falla(s) en ${n} planillas` : `\n✓ PLANILLA-CALCULO (sonda) · ${n} planillas (3 filas × 390/350/1100 × claro/oscuro × CLP/UF): cinco columnas que entran, montos según la forma, la cuenta da el resultado, la venta remite y los textos salen del dato`);
  process.exit(fallas.length ? 1 : 0);
})();
