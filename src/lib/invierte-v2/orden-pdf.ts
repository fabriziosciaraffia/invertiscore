// ─────────────────────────────────────────────────────────────────────────────
// EL PDF DE LA ORDEN FIRMADA (etapa 1 de Invierte con Franco, 18-nov-2026). Un dibujo del texto GUARDADO en la fila (lo que se
// firmó, con su huella) más el registro de la firma: quién, cuándo, desde dónde, con qué navegador y qué versión. Se imprime
// con el mismo Chromium de los PDF del informe (render-pdf.ts › launchBrowser), pero desde HTML propio: no hay una vista
// pública que proteger.
// ─────────────────────────────────────────────────────────────────────────────
import { launchBrowser } from "@/lib/pdf/render-pdf";
import { DOC_CHROME_FONT_FACES } from "@/lib/pdf/doc-chrome-fonts";
import { DOC_WORDMARK_LIGHT_DATA_URI } from "@/lib/pdf/doc-wordmark";
import { formatearRut } from "./rut";

export interface OrdenParaPdf {
  id: string;
  nombre: string;
  rut: string;
  email: string;
  texto: string;
  textoVersion: number;
  textoSha256: string;
  firmadoAt: string;
  ip: string | null;
  userAgent: string | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** La hora de la firma en Chile, «17-11-2026, 16:42:05 (hora de Chile)». */
export function horaChile(iso: string): string {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
  return `${f} (hora de Chile)`;
}

/** El HTML del PDF. Puro (lo prueba el tier): el primer párrafo del texto es el título y el último, la nota de la firma. */
export function htmlOrden(o: OrdenParaPdf): string {
  const partes = o.texto.split(/\n\n+/);
  const [titulo, ...cuerpo] = partes;
  const parrafos = cuerpo.map((p) => {
    const m = /^(\d+)\. ([^.]+)\. ([\s\S]*)$/.exec(p);
    return m ? `<p><b>${esc(m[1])}. ${esc(m[2])}.</b> ${esc(m[3])}</p>` : `<p>${esc(p)}</p>`;
  }).join("\n");
  const filas: [string, string][] = [
    ["Firmó", esc(o.nombre)],
    ["RUT", esc(formatearRut(o.rut))],
    ["Correo", esc(o.email)],
    ["Fecha y hora", esc(horaChile(o.firmadoAt))],
    ["Dirección IP", esc(o.ip ?? "no disponible")],
    ["Navegador", esc(o.userAgent ?? "no disponible")],
    ["Versión del texto", String(o.textoVersion)],
    ["Huella del texto (SHA-256)", `<span class="mono">${esc(o.textoSha256)}</span>`],
    ["N.º de la orden", `<span class="mono">${esc(o.id)}</span>`],
  ];
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo ?? "Orden")}</title>
<style>${DOC_CHROME_FONT_FACES}
@page { size: A4; margin: 18mm 16mm; }
body { margin: 0; color: #0F0F0F; font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 11pt; line-height: 1.55; }
.marca { height: 14px; display: block; margin-bottom: 22px; }
h1 { font-size: 18pt; line-height: 1.2; margin: 0 0 14px; }
p { margin: 0 0 10px; }
.registro { margin-top: 24px; border-top: 1px solid #DDDDE1; padding-top: 14px; }
.registro h2 { font-size: 10pt; letter-spacing: 0.06em; text-transform: uppercase; color: #6B6B72; margin: 0 0 8px; font-weight: 400; }
table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
td { padding: 4px 0; vertical-align: top; border-bottom: 1px solid #EEEEF1; }
td:first-child { color: #6B6B72; width: 34%; padding-right: 10px; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8.5pt; word-break: break-all; }
.pie { margin-top: 18px; font-size: 8.5pt; color: #6B6B72; }
</style></head><body data-orden-pdf="${esc(o.id)}">
<img class="marca" src="${DOC_WORDMARK_LIGHT_DATA_URI}" alt="refranco.ai">
<h1>${esc(titulo ?? "")}</h1>
${parrafos}
<div class="registro"><h2>Registro de la firma electrónica simple</h2>
<table>${filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table></div>
<p class="pie">La huella SHA-256 identifica el texto exacto que se firmó. Esta copia se generó a partir del registro guardado en Franco.</p>
</body></html>`;
}

/** El PDF de la orden, en bytes. */
export async function pdfOrden(o: OrdenParaPdf): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlOrden(o), { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new Uint8Array(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
