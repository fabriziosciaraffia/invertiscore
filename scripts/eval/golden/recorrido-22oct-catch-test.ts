// ============================================================================
// TIER RECORRIDO-22-OCT — tres arreglos chicos del recorrido real por la puerta B (22-oct-2026, Fabrizio)
//
//   1 · LA TARJETA DEL RE-ANÁLISIS: «Analizado a UF X, el precio que Franco recomendó negociar · Ver informe original» deja
//       de ser texto plano: es una tarjeta destacada bajo la portada con el material del banner (guia.css › .qv-banda), la
//       línea como título y el enlace como botón.
//   2 · «SE RENUEVA EL LUNES 27»: en «Tu selección de esta semana» del dashboard y en el correo; el próximo lunes en la
//       hora de Chile (un lunes dice el siguiente).
//   3 · EL «CUÁNDO» DEL PERFIL: al contestarlo, una línea dice qué cambia —«Te avisamos el mismo día que aparece uno.» con
//       «Quiero comprar ya»; «Te llegan cada lunes.» con las otras dos—.
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/recorrido-22oct-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { correoSemanal, type DatosCorreoSemanal } from "../../../src/lib/email/correo-semanal";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
type RenovacionMod = typeof import("../../../src/lib/guia/renovacion");

export function runRecorrido22OctTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER RECORRIDO-22-OCT (la tarjeta del re-análisis, «Se renueva el lunes 27», qué cambia con el «cuándo» · 0 tokens) ───");

  // ── 1 · la tarjeta del re-análisis ──
  try {
    const { InformeDeReanalisis } = require(join(RAIZ, "src/components/analysis/InformeDeReanalisis")) as typeof import("../../../src/components/analysis/InformeDeReanalisis");
    const html = dibujar(createElement(InformeDeReanalisis as unknown as FC<Record<string, unknown>>, { reanalisis: { origenId: "11111111-2222-3333-4444-555555555555", precioOriginalUF: 3480, precioRecomendadoUF: 3131, piePct: 25, plazoAnios: 30 }, modalidad: "ltr" }));
    if (!/<div class="qv-banda" data-reanalisis="tarjeta">/.test(html)) F("1 · el re-análisis no es una tarjeta con el material del banner (.qv-banda)");
    if (!/<p class="qv-t">Analizado a UF 3\.131, el precio que Franco recomendó negociar\.<\/p>/.test(html)) F("1 · la línea no es el título de la tarjeta");
    if (!/<a [^>]*class="qv-btn"[^>]*href="\/analisis\/11111111-2222-3333-4444-555555555555"[^>]*>Ver el informe original<\/a>/.test(html)) F("1 · «Ver el informe original» no es el botón de la tarjeta, al informe original");
    if (/qv-origen/.test(html)) F("1 · sigue siendo la línea plana (qv-origen)");
    const css = leer("src/components/guia/guia.css");
    if (!/\.qv-banda \{[^}]*background: #1F3D67 url\("\/landing\/hero-m2x\.webp"\)/.test(css) || !/\.qv-banda::after \{[^}]*grano-256\.png/.test(css)) F("1 · .qv-banda ya no es el material del banner (degradado y grano)");
  } catch (e) {
    F(`1 · explotó: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2 · «Se renueva el lunes 27» ──
  const ren = cargar<RenovacionMod>("src/lib/guia/renovacion.ts");
  if (!ren) F("2 · falta src/lib/guia/renovacion.ts");
  else {
    // El 22-oct-2026 es jueves (el «lunes 27» del pedido era el ejemplo; el lunes siguiente es el 26).
    const casos: Array<[string, string, string]> = [
      ["2026-10-22T15:00:00Z", "lunes 26", "un jueves"],
      ["2026-10-26T15:00:00Z", "lunes 2", "un lunes (dice el siguiente, y cambia de mes)"],
      ["2026-10-25T23:30:00Z", "lunes 26", "un domingo de noche en Chile"],
      ["2026-10-27T02:30:00Z", "lunes 2", "un lunes a las 23:30 en Chile (02:30 UTC del martes)"],
      ["2026-10-20T15:00:00Z", "lunes 26", "un martes"],
    ];
    for (const [iso, esperado, que] of casos) {
      const d = ren.diaRenovacion(new Date(iso));
      if (d !== esperado) F(`2 · ${que}: «${d}» (esperado «${esperado}»)`);
    }
    if (ren.textoRenueva(new Date("2026-10-22T15:00:00Z")) !== "Se renueva el lunes 26.") F(`2 · el texto no es «Se renueva el lunes 26.»: ${ren.textoRenueva(new Date("2026-10-22T15:00:00Z"))}`);
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) ·el banner se retiró: la línea bajo «Tu selección de esta
    // semana» dice el perfil y cuándo se renueva (lib/casa/reglas.ts › lineaRenueva: el lunes, o todos los días con «Quiero
    // comprar ya»; tier PUERTA-B-DASHBOARD §1 y §6).
    const pag2 = codigo("src/app/dashboard/page.tsx");
    if (!/lineaRenueva\(pb\.horizonte\)/.test(pag2) || !/data-casa="seleccion-linea">\{lineaSel\}/.test(pag2)) F("2 · «Tu selección de esta semana» del dashboard no dice cuándo se renueva");
    const correo = codigo("src/lib/email/correo-semanal.ts");
    if (!/if \(d\.renueva\) filas\.push\(parrafo\(`<span data-correo="renueva">\$\{escaparHtml\(d\.renueva\)\}<\/span>`\)\);/.test(correo)) F("2 · el correo no dice cuándo se renueva");
    for (const p of ["src/lib/guia/semanal-servidor.ts", "src/lib/guia/del-dia-servidor.ts"]) if (!/renueva: textoRenueva\(\),/.test(codigo(p))) F(`2 · ${p} no le pasa la renovación al correo`);
    const d = (n: number): DatosCorreoSemanal["deptos"][number] => ({ comuna: "Ñuñoa", tipologia: "2D1B", m2: 50, precioUF: 3000 + n, veredicto: "COMPRAR", score: 80, flujo: 100000, url: `https://x/${n}` });
    const html = correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "2 dormitorios, Ñuñoa", piePct: 20, plazoAnios: 25, deptos: [d(1), d(2), d(3)], conRegalo: false, saldo: 2, urlBoton: "https://x/b", urlTres: "https://x/t", urlBaja: "https://x/baja", renueva: "Se renueva el lunes 27." }).html;
    const iIntro = html.indexOf("Esta semana, 3 deptos"), iRen = html.indexOf('<span data-correo="renueva">Se renueva el lunes 27.</span>'), iTarjeta = html.indexOf("Ñuñoa · 2D1B");
    if (iRen < 0 || iIntro < 0 || iRen < iIntro || (iTarjeta >= 0 && iRen > iTarjeta)) F(`2 · en el correo la renovación no va después de la intro y antes de los deptos (${iIntro}, ${iRen}, ${iTarjeta})`);
    if (/renueva/.test(correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "x", piePct: 20, plazoAnios: 25, deptos: [d(1)], conRegalo: false, saldo: 2, urlBoton: "https://x/b", urlTres: "https://x/t", urlBaja: "https://x/baja" }).html)) F("2 · sin la fecha, el correo igual dibuja la línea");
  }

  // ── 3 · qué cambia con el «cuándo» ──
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) · qué cambia con el «cuándo» lo dice la regla de la frecuencia
  // bajo la pregunta, una sola frase para las tres respuestas (lib/guia/inmediato.ts › FRECUENCIA_COPY; tier
  // PUERTA-B-DASHBOARD §5 y §6): «Con «Quiero comprar ya» te enviamos una selección todos los días. Con las otras, una
  // selección cada lunes.»
  if (CASA.perfil.nota !== "Con «Quiero comprar ya» te enviamos una selección todos los días. Con las otras, una selección cada lunes.") F(`3 · el copy de qué cambia no es el aprobado: ${CASA.perfil.nota}`);
  const casa = codigo("src/app/dashboard/casa.tsx");
  if (!/<p className="ca-nota" data-casa="nota-frecuencia">\{CASA\.perfil\.nota\}<\/p>/.test(casa)) F("3 · el perfil del dashboard no dice qué cambia bajo la pregunta");

  if (fallas.length) {
    console.log(`  ✗ RECORRIDO-22-OCT · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el re-análisis es una tarjeta con el material del banner; el dashboard y el correo dicen «Se renueva el lunes N»; el perfil dice qué cambia con el «cuándo»");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 26eba2a0): 7 fallas —la línea plana del re-análisis, sin
// renovacion.ts, sin el copy de qué cambia ni su línea—. Y 7 mutaciones, cada una restaurada byte a byte, todas ROJAS: X1 la
// tarjeta vuelve a la línea plana · X2 un lunes dice el mismo día · X3 el dashboard sin la renovación · X4 el correo sin la
// renovación · X5 el copy de «meses» dice lo de «ya» · X6 el semanal no le pasa la renovación al correo · X7 el perfil repite
// la respuesta en vez de decir qué cambia. REANALISIS §4 (la línea → la tarjeta) se reescribió con su acta.

if (require.main === module) {
  process.exit(runRecorrido22OctTier().hard ? 1 : 0);
}
