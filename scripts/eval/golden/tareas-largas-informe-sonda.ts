// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · tareas largas del informe en un teléfono (09-oct-2026). El hilo principal ocupado: en iPhone el
// informe se quedaba en blanco desde la recomendación más de un minuto, y el ticket tardaba mucho más de sus
// 8 segundos. La causa: la alternativa de comunas (23 corridas de `runAnalysis`) se calculaba en el CLIENTE, en
// HeroLTR al hidratar y en CapitulosInversion al bajar. Medido en Chromium con perfil de iPhone y la CPU frenada
// 6×: 26,9 s de tareas largas al cargar y 24,3 s al bajar; con el arreglo, 1,3 s y 0,07 s.
//
// Mide eso: el total de tareas largas (PerformanceObserver «longtask») al cargar y al bajar de a 300 px hasta el
// fondo, en Chrome headless a 390 px de ancho, móvil, con la CPU frenada `--freno` veces (6 por defecto), y sale
// con 1 si pasa el tope. Sin el informe en pantalla (otra página, 404, error) sale con 2: un cero que no corrió no
// es un verde. Solo hace GET: todo lo demás se corta (el informe marca «visto» con un POST).
// Complementa el tier estático TAREAS-LARGAS del QUICK.
// Uso: node --import tsx scripts/eval/golden/tareas-largas-informe-sonda.ts [--base https://refranco.ai] [--id <análisis>] [--freno 6]
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer from "puppeteer-core";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg("--base") ?? "http://localhost:3000";
/** El demo protegido: nunca se borra y da AJUSTA SUPUESTOS, así que corre la alternativa de comunas. */
const ID = arg("--id") ?? "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
const FRENO = Number(arg("--freno") ?? 6);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
/** Topes con la CPU frenada 6×. Con el arreglo se midió 1,3–1,7 s al cargar y ≤ 0,11 s al bajar; antes, 27–32 s y 22–24 s. */
export const TOPE_CARGA_MS = 4000;
export const TOPE_BAJADA_MS = 1000;

async function main() {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const t = await b.newPage();
    await t.setViewport({ width: 390, height: 664, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await t.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1");
    await t.setRequestInterception(true);
    let cortados = 0;
    t.on("request", (r) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(r.method()) || /vercel\.live|posthog|sentry/.test(r.url())) { cortados++; return void r.abort(); }
      return void r.continue();
    });
    await t.evaluateOnNewDocument(() => {
      (window as unknown as { __largas: Array<{ t: number; d: number }> }).__largas = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as unknown as { __largas: Array<{ t: number; d: number }> }).__largas.push({ t: e.startTime, d: e.duration }); })
          .observe({ type: "longtask", buffered: true });
      } catch { /* sin la API no hay medida: lo dice el chequeo de abajo */ }
    });
    await t.emulateCPUThrottling(FRENO);
    const url = `${BASE.replace(/\/$/, "")}/analisis/${ID}`;
    const r = await t.goto(url, { waitUntil: "load", timeout: 240_000 });
    await new Promise((res) => setTimeout(res, 12_000));
    const hayInforme = await t.evaluate(() => !!document.querySelector("#la-inversion") && typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask"));
    if (!r || r.status() !== 200 || !hayInforme) {
      console.log(`✗ NO CORRIÓ — ${url} respondió ${r?.status()} o no dibujó el informe (o el navegador no mide tareas largas)`);
      process.exit(2);
    }
    const finCarga = await t.evaluate(() => performance.now());
    let y = -1;
    for (let i = 0; i < 40; i++) {
      await t.evaluate(() => scrollBy(0, 300));
      await new Promise((res) => setTimeout(res, 600));
      const ny = await t.evaluate(() => Math.round(scrollY));
      if (ny === y) break;
      y = ny;
    }
    await new Promise((res) => setTimeout(res, 1500));
    const largas = await t.evaluate(() => (window as unknown as { __largas: Array<{ t: number; d: number }> }).__largas);
    const suma = (xs: Array<{ d: number }>) => Math.round(xs.reduce((s, x) => s + x.d, 0));
    const enCarga = largas.filter((x) => x.t < finCarga), enBajada = largas.filter((x) => x.t >= finCarga);
    const carga = suma(enCarga), bajada = suma(enBajada);
    const mayor = (xs: Array<{ d: number }>) => Math.round(Math.max(0, ...xs.map((x) => x.d)));
    console.log(`─── SONDA TAREAS-LARGAS · ${url} · CPU ${FRENO}× · 390 px móvil · ${cortados} pedidos cortados ───`);
    console.log(`  al cargar: ${carga} ms en ${enCarga.length} tareas largas (la mayor, ${mayor(enCarga)} ms) · tope ${TOPE_CARGA_MS} ms`);
    console.log(`  al bajar:  ${bajada} ms en ${enBajada.length} tareas largas (la mayor, ${mayor(enBajada)} ms) · tope ${TOPE_BAJADA_MS} ms (hasta y = ${y})`);
    const fallas: string[] = [];
    if (carga > TOPE_CARGA_MS) fallas.push(`al cargar el hilo principal queda ocupado ${carga} ms (tope ${TOPE_CARGA_MS})`);
    if (bajada > TOPE_BAJADA_MS) fallas.push(`al bajar el hilo principal queda ocupado ${bajada} ms (tope ${TOPE_BAJADA_MS})`);
    if (fallas.length) {
      console.log(`  ✗ ROJO — ${fallas.join("; ")}`);
      process.exit(1);
    }
    console.log("  ✓ VERDE — el informe carga y se baja sin congelar el hilo principal");
  } finally {
    await b.close();
  }
}

main().catch((e) => { console.log(`✗ NO CORRIÓ — ${e instanceof Error ? e.message : String(e)}`); process.exit(2); });
