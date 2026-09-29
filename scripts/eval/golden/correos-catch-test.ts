// ============================================================================
// GOLDEN · CORREOS (29-sep-2026) — catch-test
// ============================================================================
//   Todos los correos de Franco en la plantilla clara (src/lib/email/plantilla-clara.ts):
//   1 · UNA SOLA PLANTILLA: cada correo del catálogo sale de plantillaClara (papel, wordmark PNG,
//       legal al pie); ningún envío de email.ts arma HTML propio salvo los PENDIENTES declarados.
//   2 · SIN OSCURO NI MONO: ni fondos de tinta, ni Courier/monospace/JetBrains, en ningún correo ni
//       en las plantillas de Supabase.
//   3 · SIN «CON IA» NI «20 AÑOS», y en tuteo.
//   4 · CADA UNO CON SUS ETIQUETAS: todo envío pasa por enviarCorreo (tags `tipo` y `pid`); ningún
//       `new Resend` suelto; cada tipo tiene su entrada en el catálogo y al revés. EXCEPCIÓN DECLARADA:
//       los de Supabase Auth salen por el SMTP de Resend, que no acepta tags; para llevarlos habría que
//       mandarlos desde la app con el «Send Email Hook» de Supabase.
//   5 · EL WORDMARK ES EL PNG FIEL: 2× (264×86), ancho fijo 132, alt «refranco.ai», nunca SVG.
//   6 · UN SOLO BOTÓN por correo.
//   7 · LAS PLANTILLAS DE SUPABASE en docs/emails/ son exactamente lo que genera el componente.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/correos-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO_CORREOS } from "../../../src/lib/email/catalogo";
import { ALTO_WORDMARK, ANCHO_WORDMARK, PAPEL, URL_WORDMARK } from "../../../src/lib/email/plantilla-clara";
import { PLANTILLAS_SUPABASE } from "../../../src/lib/email/supabase-plantillas";
import { TIPOS_CORREO } from "../../../src/lib/medicion-correo";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Los correos que todavía no pasaron a la plantilla clara porque esperan una decisión. VACÍO al cerrar el goal. */
const PENDIENTES = new Set<string>();

const OSCURO = /background(-color)?:\s*#(0F0F0F|151515|1A1A1A|111111|000000)\b|bgcolor="#(0F0F0F|151515|1A1A1A)"/i;
/** El botón en tinta es lo único con fondo de tinta: se saca antes de buscar oscuro. */
const sinBoton = (s: string) => s.replace(/border-radius: 999px; background: (#0F0F0F|\$\{TINTA\});/g, "");
const oscuro = (s: string) => OSCURO.test(sinBoton(s));
const MONO = /Courier|monospace|JetBrains/i;
/** Lo que el producto de hoy ya no hace o no dice: la IA, los 20 años, los escenarios de salida del informe viejo. */
const PROHIBIDO = /con IA\b|inteligencia artificial|\b20 años\b|escenarios de salida|refinanciamiento|buena oportunidad de inversión/i;
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|fijate|hacé|decime|confirmá|respondé|escribinos|vos)(?![a-záéíóúñ])/i;
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

export function runCorreosTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CORREOS (una sola plantilla, clara, con sus tags · 0 tokens) ───");

  // ── 1 · 2 · 3 · 5 · 6 sobre cada correo renderizado ────────────────────────
  const wordmark = new RegExp(`<img src="${URL_WORDMARK.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" width="${ANCHO_WORDMARK}" height="${ALTO_WORDMARK}" alt="refranco\\.ai"`);
  let renderizados = 0;
  for (const c of CATALOGO_CORREOS) {
    if (!c.render) {
      if (!PENDIENTES.has(c.id)) F(`1 · ${c.id} no tiene render y no está entre los pendientes declarados`);
      continue;
    }
    renderizados++;
    const { subject, html } = c.render();
    if (!html.includes(`<body style="margin: 0; padding: 0; background: ${PAPEL};">`)) F(`1 · ${c.id} no sale de la plantilla clara (sin el papel en el body)`);
    if (!wordmark.test(html)) F(`5 · ${c.id} no lleva el wordmark PNG fiel (ancho fijo, alt refranco.ai)`);
    if (/<svg/i.test(html)) F(`5 · ${c.id} lleva SVG (Gmail no lo muestra)`);
    if ((html.match(/<img /g) ?? []).length !== 1) F(`1 · ${c.id} lleva imágenes además del wordmark (con las imágenes bloqueadas no se lee; los heros del informe viejo salieron)`);
    if (oscuro(html)) F(`2 · ${c.id} tiene fondo oscuro`);
    if (MONO.test(html)) F(`2 · ${c.id} usa mono`);
    if (PROHIBIDO.test(texto(html)) || PROHIBIDO.test(subject)) F(`3 · ${c.id} dice lo que el producto de hoy no dice («con IA», «20 años», escenarios de salida, «buena oportunidad de inversión»)`);
    if (VOSEO.test(texto(html)) || VOSEO.test(subject)) F(`3 · ${c.id} tiene voseo`);
    const botones = (html.match(/border-radius: 999px; background: #0F0F0F;/g) ?? []).length;
    if (botones > 1) F(`6 · ${c.id} tiene ${botones} botones`);
    if (!/Franco analiza datos de mercado|correo sobre la seguridad|Correo interno de Franco|Aviso interno de Franco/.test(html)) F(`1 · ${c.id} no lleva el legal al pie`);
  }
  if (renderizados < 14) F(`1 · el catálogo renderiza ${renderizados} correos (el instrumento no corrió)`);

  // ── 1 · 2 · email.ts: fuera de los pendientes, nada de HTML propio ──────────
  const email = sinComentarios(leer("src/lib/email.ts"));
  const funciones = email.split(/\nexport (?:async )?function /).slice(1).map((f) => ({ nombre: f.slice(0, f.indexOf("(")), cuerpo: f }));
  if (funciones.length < 10) F(`1 · email.ts expone ${funciones.length} funciones (el extractor no corrió)`);
  for (const f of funciones) {
    if (/emailWrapper\(|ctaButton\(|<!DOCTYPE|<table|<div style/.test(f.cuerpo)) F(`1 · ${f.nombre} arma su propio HTML en vez de la plantilla clara`);
    if (oscuro(f.cuerpo) || MONO.test(f.cuerpo)) F(`2 · ${f.nombre} tiene oscuro o mono`);
  }

  // ── el pack se confirma con sus análisis, no como «1 análisis» ─────────────
  if (!/const n = fp\.capacity \?\? 1;\s*return \{\s*productName: n === 1 \? '1 análisis' : `\$\{n\} análisis`,/.test(email)) F("1 · pago confirmado no toma los análisis de la capacidad del producto (el pack dice «1 análisis»)");
  if (PROHIBIDO.test(email)) F("3 · email.ts todavía promete algo que el informe de hoy no tiene (escenarios de salida, refinanciamiento, IA)");

  // ── 4 · las etiquetas: todo pasa por enviarCorreo ───────────────────────────
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(join(RAIZ, d))) {
      const p = `${d}/${n}`;
      if (statSync(join(RAIZ, p)).isDirectory()) recorrer(p);
      else if (/\.(ts|tsx)$/.test(n)) archivos.push(p);
    }
  };
  recorrer("src");
  for (const f of archivos) {
    const s = sinComentarios(leer(f));
    if (f === "src/lib/email.ts") {
      if ((s.match(/resend\.emails\.send\(/g) ?? []).length !== 1) F("4 · email.ts manda por fuera de enviarCorreo");
      continue;
    }
    if (/new Resend\(|\.emails\.send\(/.test(s)) F(`4 · ${f} manda correo sin pasar por enviarCorreo (sin tags ni evento)`);
  }
  if (!/tags: \[\.\.\.\(mensaje\.tags \?\? \[\]\), \.\.\.tagsCorreo\(tipo, distinctId\)\]/.test(email)) F("4 · enviarCorreo no le pone las etiquetas tipo y pid");
  const tiposCatalogo = new Set(CATALOGO_CORREOS.map((c) => c.tipo).filter((t) => t !== "supabase"));
  for (const t of TIPOS_CORREO) if (!tiposCatalogo.has(t)) F(`4 · el tipo ${t} no tiene entrada en el catálogo (no se revisa ni se ve en /dev/correos)`);
  const usados = new Set(Array.from(email.matchAll(/enviarCorreo\("([a-z_]+)"/g), (m) => m[1]));
  for (const t of usados) if (!tiposCatalogo.has(t as never)) F(`4 · email.ts manda el tipo ${t} y el catálogo no lo tiene`);

  // ── 5 · el PNG del wordmark ─────────────────────────────────────────────────
  const png = readFileSync(join(RAIZ, "public", "email", "wordmark-claro-2x.png"));
  if (png.readUInt32BE(16) !== ANCHO_WORDMARK * 2 || png.readUInt32BE(20) !== ALTO_WORDMARK * 2) F(`5 · el PNG del wordmark no es 2× de ${ANCHO_WORDMARK}×${ALTO_WORDMARK} (es ${png.readUInt32BE(16)}×${png.readUInt32BE(20)})`);

  // ── 7 · Supabase: lo pegable es lo generado ─────────────────────────────────
  for (const p of PLANTILLAS_SUPABASE) {
    const archivo = leer(`docs/emails/${p.archivo}`).replace(/<!--[\s\S]*?-->\n?/g, "").trim();
    if (archivo !== p.html().trim()) F(`7 · docs/emails/${p.archivo} no es lo que genera el componente (regenerar con scripts/emails/generar-supabase-codigo.ts)`);
    if (oscuro(archivo) || MONO.test(archivo)) F(`7 · docs/emails/${p.archivo} tiene oscuro o mono`);
  }
  if (!/\{\{ \.Token \}\}/.test(PLANTILLAS_SUPABASE[0].html())) F("7 · la plantilla del código no lleva {{ .Token }}");

  if (fallas.length) {
    console.log(`  ✗ CORREOS · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${renderizados} correos en la plantilla clara (papel, wordmark PNG, un botón, legal), sin oscuro ni mono ni «con IA», todos por enviarCorreo con sus tags; los de Supabase sin tags por el SMTP (excepción declarada)`);
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES v2 (29-sep-2026, los cuatro que esperaban decisión: 5/5 en rojo) ──────────
// C19 el pack vuelve a «1 análisis» · C20 vuelve «escenarios de salida (venta y refinanciamiento)» ·
// C21 vuelve el hero /api/og/veredicto al informe listo · C22 la boleta vuelve a dos botones · C23
// la bienvenida dice «buena oportunidad de inversión». La v1 corrida de nuevo: 17/18 (la que no
// aplica es la primera versión de C10, la del ancla no única, ya reemplazada).
// ── ACTA DE MUTACIONES v1 (29-sep-2026, 18/18 en rojo, restauradas byte a byte) ─────────────
// C1 el body vuelve a oscuro · C2 un monto en mono · C3 «con IA» · C4 «20 años» · C5 voseo en la
// plantilla de Supabase · C6 el alt deja de ser refranco.ai · C7 el wordmark sin ancho fijo · C8 un
// SVG · C9 dos botones · C10 un `new Resend` suelto (primera versión NO APLICÓ: el ancla no era única;
// se rehízo) · C11 enviarCorreo sin tags · C12 un tipo sin entrada en el catálogo · C13 la plantilla
// pegable desincronizada · C14 pago fallido vuelve a emailWrapper · C15 un aviso sin legal · C16 un
// correo sin render que no es pendiente (primera versión rompía el catálogo en vez de caer en su
// chequeo; se rehízo) · C17 el código de Supabase sin {{ .Token }} · C18 una nota con fondo oscuro.

if (require.main === module) {
  const { hard } = runCorreosTier();
  process.exit(hard ? 1 : 0);
}
