// Genera public/email/wordmark-claro-2x.png: el wordmark de los correos, a doble resolución, sobre
// papel. Lo dibuja Chrome con el MISMO fuentes.css del sitio y los mismos estilos de FrancoLogo en el
// tema claro («re» Source Serif 4 cursiva en tinta al 20 %, «franco» en la serif bold, «.ai» en
// IBM Plex Sans semibold, Signal Red, a 0,35 em con 0,1 em de espaciado): así el PNG es el wordmark
// del sitio y no una imitación. En correo va como imagen porque las fuentes web no cargan.
// Uso: node --import tsx scripts/emails/generar-wordmark.ts   (necesita Chrome instalado)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { ANCHO_WORDMARK, PAPEL } from "../../src/lib/email/plantilla-clara";

const RAIZ = join(__dirname, "..", "..");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ESCALA = 2;
/** Tamaño del texto en px CSS. El ancho final lo fija ANCHO_WORDMARK: el script ajusta el tamaño. */
// Las fuentes van embebidas (data:): una página en blanco no puede leer file://.
const FUENTES = readFileSync(join(RAIZ, "src", "app", "fuentes.css"), "utf8").replace(
  /url\(\/fonts\/([^)]+)\)/g,
  (_m, archivo: string) => `url(data:font/woff2;base64,${readFileSync(join(RAIZ, "public", "fonts", archivo)).toString("base64")})`,
);

const pagina = (px: number) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FUENTES}
html,body{margin:0;background:${PAPEL}}
#wm{display:inline-flex;align-items:baseline;line-height:1.25;padding:2px 3px 4px 1px;font-size:${px}px;background:${PAPEL}}
.re{font-family:'Source Serif 4 Franco';font-style:italic;font-weight:400;color:rgba(0,0,0,0.2);margin-right:-0.08em}
.fr{font-family:'Source Serif 4 Franco';font-weight:700;color:#0F0F0F}
.ai{font-family:'IBM Plex Sans Franco';font-weight:600;color:#C8323C;font-size:0.35em;letter-spacing:0.1em}
</style></head><body><span id="wm"><span class="re">re</span><span class="fr">franco</span><span class="ai">.ai</span></span></body></html>`;

(async () => {
  const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const p = await navegador.newPage();
    await p.setViewport({ width: 800, height: 200, deviceScaleFactor: ESCALA });
    // Primero se mide a 40 px y se escala para que el ancho CSS sea exactamente ANCHO_WORDMARK.
    await p.setContent(pagina(40), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const ancho40 = await p.$eval("#wm", (e) => e.getBoundingClientRect().width);
    const px = (40 * ANCHO_WORDMARK) / ancho40;
    await p.setContent(pagina(px), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    // Las tres caras que usa el wordmark tienen que estar CARGADAS (no basta con declaradas).
    const fuentesOk = await p.evaluate(() => ["italic 400 16px 'Source Serif 4 Franco'", "700 16px 'Source Serif 4 Franco'", "600 16px 'IBM Plex Sans Franco'"].every((f) => document.fonts.check(f, "ref.ai")));
    if (!fuentesOk) throw new Error("Las fuentes de marca no cargaron: el PNG saldría con Georgia/Arial");
    const caja = await p.$eval("#wm", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: Math.ceil(r.width), height: Math.ceil(r.height) }; });
    const png = await p.screenshot({ type: "png", clip: { x: caja.x, y: caja.y, width: ANCHO_WORDMARK, height: caja.height } });
    const destino = join(RAIZ, "public", "email", "wordmark-claro-2x.png");
    writeFileSync(destino, png);
    console.log(`ok ${destino} · ${ANCHO_WORDMARK * ESCALA}×${caja.height * ESCALA} px (se muestra a ${ANCHO_WORDMARK}×${caja.height}) · texto ${px.toFixed(2)} px`);
  } finally {
    await navegador.close();
  }
})();
