// Render one-off del hero del welcome email a PNG.
// Uso: node scripts/email-assets/render-hero.mjs
// Requiere playwright disponible (via npx). Abre el HTML local, espera a que
// carguen las fuentes web (document.fonts.ready) y captura SOLO #hero a 2x.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "hero-compra-canonico.html");
const outPath = join(__dirname, "welcome-hero-compra.png");

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// margen extra para que el layout con fuentes reales se asiente
await page.waitForTimeout(500);
const el = await page.$("#hero");
await el.screenshot({ path: outPath });
await browser.close();
console.log("OK:", outPath);
