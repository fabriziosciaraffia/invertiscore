// ============================================================================
// GOLDEN · CIERRE-INFORME (01-oct-2026) — catch-test
// ============================================================================
//   El final del informe tiene UNA acción (decisión de Fabrizio, 01-oct-2026). Salen «Un análisis no
//   decide — compara» (NextAnalysisCTA), «Tu wallet» (WalletStatusCTA), el banner Pro, el «Analizar otra
//   propiedad» suelto y el cierre rojo de conversión. Queda, según el caso, UNA de tres:
//     · el ticket del pack (primer informe anónimo);
//     · la banda del crédito de bienvenida (este informe lo usó);
//     · la línea discreta «Te quedan 2 análisis.» con «Analizar otro depto» (sin análisis: solo el enlace,
//       con el precio). Sans, sin mono, sin mayúsculas, sin rojo.
//   La vista de comparar se queda en el dashboard.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/cierre-informe-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textoCierre, ENLACE_CIERRE, ANCHO_COLUMNA_INFORME } from "../../../src/lib/cierre-informe";
import { sinComentarios } from "./lectura-paginada-catch-test";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

/** Lo que el informe renderiza después del documento: desde la banda de bienvenida hasta el final. */
function finalDe(s: string, desde: RegExp): string {
  const i = s.search(desde);
  return i < 0 ? "" : s.slice(i);
}

export function runCierreInformeTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CIERRE-INFORME (el final del informe, una acción · 0 tokens) ───");

  // ── el texto de la línea ──
  const casos: Array<[Parameters<typeof textoCierre>[0], string | null, string]> = [
    [{ analisis: 2, conSesion: true, suscriptor: false }, "Te quedan 2 análisis.", "Analizar otro depto"],
    [{ analisis: 1, conSesion: true, suscriptor: false }, "Te queda 1 análisis.", "Analizar otro depto"],
    [{ analisis: 0, conSesion: true, suscriptor: false }, null, "Analizar otro depto · $9.990"],
    [{ analisis: 0, conSesion: true, suscriptor: true }, null, "Analizar otro depto"],
    [{ analisis: 0, conSesion: false, suscriptor: false }, null, "Analizar otro depto"],
  ];
  for (const [p, saldo, enlace] of casos) {
    const t = textoCierre(p);
    if (t.saldo !== saldo || t.enlace !== enlace) F(`texto · ${JSON.stringify(p)} da «${t.saldo ?? ""} ${t.enlace}», no «${saldo ?? ""} ${enlace}»`);
  }
  if (ENLACE_CIERRE !== "Analizar otro depto") F("texto · el enlace no dice «Analizar otro depto»");
  const comp = sinComentarios(leer("src/components/analysis/CierreInforme.tsx"));
  if (/font-mono|uppercase|tracking-|signal-red|C8323C|franco-red|text-red/i.test(comp)) F("estilo · la línea del cierre usa mono, mayúsculas o rojo");
  if ((comp.match(/<EnlaceCarga\b/g) ?? []).length !== 1 || /<button\b/.test(comp)) F("estilo · la línea del cierre tiene más de una acción");
  // (01-oct-2026) Alineada con la columna del informe, no con el borde de la página.
  const portada = leer("src/components/analysis/portada/PortadaInforme.tsx");
  const col = Number((portada.match(/\.doc-dictamen \.doc-page--secciones\{max-width:(\d+)px;margin:0 auto\}/) ?? [])[1]);
  if (ANCHO_COLUMNA_INFORME !== col || !/className="[^"]*\bmx-auto\b[^"]*" style=\{\{ maxWidth: ANCHO_COLUMNA_INFORME \}\}/.test(comp)) F(`estilo · la línea del cierre no va en la columna del informe (${ANCHO_COLUMNA_INFORME} contra ${col} px)`);

  // ── el final de cada informe: una acción ──
  const RETIRADOS = /<NextAnalysisCTA\b|<WalletStatusCTA\b|<ProCTABanner\b|<ConversionCloser\b|Analizar otra propiedad|<ArrowRight\b/;
  for (const [f, sesion, tipo] of [
    ["src/app/analisis/[id]/results-client.tsx", "isLoggedIn", "ltr"],
    ["src/app/analisis/renta-corta/[id]/results-client.tsx", "!!userId", "str"],
  ] as const) {
    const s = sinComentarios(leer(f));
    const fin = finalDe(s, /\{showCtaWelcome && /);
    if (!fin) { F(`${tipo} · no encuentro el final del informe`); continue; }
    if (RETIRADOS.test(fin) || RETIRADOS.test(s)) F(`${tipo} · vuelve un bloque retirado del final (comparar, wallet, banner Pro, «Analizar otra propiedad» o el cierre rojo)`);
    // La única acción, en orden: ticket (anónimo) · banda de bienvenida · la línea. Nunca dos.
    // (01-oct-2026, ENTRADA-CÓDIGO) el ticket lleva `correoSesion`: quien acaba de entrar por código lo
    // sigue viendo tras el refresco, sin que le pida el correo.
    const tern = new RegExp(String.raw`\{loQueSigue \? \(\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} precioCierreUF=\{precioCierreLqs\} correoSesion=\{recienDentro\} \/>\s*\) : showCtaWelcome \? null : \(\s*<CierreInforme analisis=\{userCredits \+ \(${sesion.replace(/[!]/g, "!")} && welcomeAvailable \? 1 : 0\)\} conSesion=\{${sesion.replace(/[!]/g, "!")}\} suscriptor=\{`);
    if (!tern.test(fin)) F(`${tipo} · el final no elige UNA acción (ticket · bienvenida · línea)`);
    if ((fin.match(/<CierreInforme\b/g) ?? []).length !== 1 || (fin.match(/<TicketPack\b/g) ?? []).length !== 1 || (fin.match(/<CtaWelcome\b/g) ?? []).length !== 1) F(`${tipo} · el final monta dos veces una acción`);
    const acciones = (fin.match(/<(CierreInforme|TicketPack|CtaWelcome|EnlaceCarga|button|a)\b/g) ?? []).length;
    if (acciones !== 3) F(`${tipo} · el final tiene ${acciones} acciones montadas en el código (debe ser ticket, bienvenida y la línea, excluyentes)`);
    if (!/\{showCtaWelcome && /.test(fin)) F(`${tipo} · la banda de bienvenida no depende de showCtaWelcome`);
  }

  if (fallas.length) {
    console.log(`  ✗ CIERRE-INFORME · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el final del informe tiene una acción: el ticket, la banda de bienvenida o «Te quedan N análisis.» con «Analizar otro depto», en sans y sin rojo");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (01-oct-2026) ─────────────────────────────────────────────
// 12/12 en rojo, restauradas byte a byte: K1 vuelve «compara» al LTR · K2 vuelve el wallet al STR · K3 vuelve
// el banner Pro · K4 vuelve «Analizar otra propiedad» · K5 la línea y la bienvenida juntas · K6 la línea
// también en el anónimo · K7 la línea en mono y mayúsculas · K8 el enlace en rojo · K9 sin precio al quedar en
// cero · K10 el saldo en plural siempre · K11 un segundo botón en la línea · K12 el saldo sin la bienvenida.
// Segunda vuelta (01-oct-2026, la línea en la columna del informe, 2/2 en rojo): K13 la línea al borde de la página ·
// K14 otro ancho que la columna.

if (require.main === module) {
  const { hard } = runCierreInformeTier();
  process.exit(hard ? 1 : 0);
}
